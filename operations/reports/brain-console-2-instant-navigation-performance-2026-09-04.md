# Brain Console 2.0 Instant Navigation Performance — 2026-09-04

## Verdict

`SNAPPY_ACCEPTED`

The live Brain Console now presents the shell independently of Brain Core readiness, uses production Next serving, renders a route loading frame, preserves cached data during refresh, prefetches navigation targets, and keeps the Command Center inside the real desktop app viewport.

## Revision and live identity

| Field | Result |
|---|---|
| Origin/main | `8c9814c1af8447b45931e77ae63b82a2e68de111` |
| Brain Core | `127.0.0.1:4877`, one listener, LaunchAgent running |
| Brain Console | `127.0.0.1:4881`, one listener, LaunchAgent running |
| Runtime identity | `matching` |
| Canonical source revision | `8c9814c1af8447b45931e77ae63b82a2e68de111` |
| Deployment revision | `8c9814c1af8447b45931e77ae63b82a2e68de111` |
| Console build mode | `production` (`next-server`) |
| LaunchAgent source diff | none between `d3d3686b...` and `8c9814c1...` |

The installed Core LaunchAgent metadata was reconciled by the existing launcher during deployment; the canonical LaunchAgent template was not changed.

## Root causes addressed

- The live Console service was starting `next dev`, causing slow route compilation and dev-tool errors. It now starts `next start` whenever `.next/BUILD_ID` exists, with the existing dev fallback retained for an unbuilt local checkout.
- The app launcher waited for Core reconciliation before opening the browser. It now ensures the Console, opens `/command-center`, then reconciles Core in the background of the launch sequence.
- Production `next-server` did not match the launcher’s old process-tree ownership predicate. The predicate now recognizes the canonical Console service parent as well as the production child.
- Global telemetry polling ran every second. It is now 15 seconds for system metrics and 30 seconds for AI estimates, without background-tab polling.
- React Query now retains cache for 10 minutes, avoids refetch-on-focus, and uses a 10-second default stale window.

## Real Mac app viewport

Measured from the actual Brain Console browser tab opened by `Brain Console.app`:

| Metric | Value |
|---|---:|
| `window.innerWidth` | 1141 |
| `window.innerHeight` | 797 |
| `documentElement.clientWidth` | 1141 |
| `documentElement.clientHeight` | 797 |
| `documentElement.scrollWidth` | 1141 |
| `documentElement.scrollHeight` | 797 |
| `body.scrollWidth / scrollHeight` | 1141 / 797 |
| Scrollable descendants after data load | 0 |

The default Command Center has no document, body, main-content, sidebar, or nested-panel scrolling at this viewport. Secondary detail remains behind existing disclosure controls and route links.

## Before / after navigation timing

Measurements used client-side browser automation at 1141×797. `route` is click-to-URL, `frame` is click-to-first route/skeleton frame, and `usable` is click-to-usable destination UI.

Before: live `d3d3686b...` running Next development mode.

| Route | Before route / frame / usable (ms) | After route / frame / usable (ms) |
|---|---:|---:|
| Overview | 717 / 749 / 762 | 749 / 758 / 759 cold; 59 / 60 / 68 warm |
| Command Center | 51 / 52 / 53 | 48 / 49 / 50 |
| AI Models | 163 / 170 / 175 | 60 / 63 / 65 |
| Local Apps | 155 / 166 / 168 | 49 / 52 / 53 |
| Infrastructure | 238 / 244 / 244 | 42 / 44 / 44 |
| Monitoring | 2016 / 2028 / 2029 | 49 / 50 / 51 |
| Tunnels | 1680 / 1691 / 1692 | 50 / 51 / 52 |
| Scheduler | 2571 / 2578 / 2580 | 47 / 48 / 49 |
| Video Analyzer | 6481 / 6493 / 6494 | 44 / 47 / 48 |
| AWS Video | 3719 / 3745 / 3749 | 52 / 76 / 79 |
| Settings | 1867 / 1873 / 1874 | 39 / 40 / 41 |

The after run was performed against the live production service. Automatic idle prefetch makes the warmed path representative of normal use; the cold Overview result is the one-time first fetch of that route chunk and still completed in under one second with a destination frame rather than a blank page.

## Shell and data UX

- Added `app/loading.tsx` so route transitions show a stable skeleton frame instead of a blank or frozen content area.
- Command Center initial loading now mirrors its final cockpit geometry with status and panel skeletons.
- Existing snapshot data stays rendered while refresh is in flight or fails; the UI reports the failure without clearing the last valid posture.
- Added idle, hover, and focus prefetching for Command Center, Overview, Scheduler, Local Apps, and Infrastructure; all navigation links retain Next prefetching and legacy routes remain reachable.
- Command Center retains one bounded operational snapshot query and refreshes it every 10 seconds, with background-tab polling disabled.

## Launch acceptance

An actual `open -na '/Users/Office/Applications/Brain Console.app'` invocation produced:

```text
begin                         14:21:24.836Z
console reused                14:21:25.089Z
browser opened                14:21:25.169Z
core reused                   14:21:25.494Z
complete                      14:21:25.494Z
```

Measured wrapper wall time was approximately 1.15 seconds; the browser-open marker occurred approximately 333 ms after launcher start. Core readiness did not delay shell presentation.

## Validation

- `npm run test:command-center` — pass
- `npm run test:instant-navigation` — pass
- `npm run test:telemetry` — pass
- `npm run typecheck` — pass
- `npm run build` — pass
- Live Core/Console listener and LaunchAgent checks — pass
- Live `/runtime/identity` — `matching`, production, final revision
- Browser route sweep — all 11 primary routes reached usable UI; warmed route transitions remained under 100 ms
- Live Command Center screenshot — [live-production-command-center.png](evidence/brain-console-2-instant-navigation-performance-2026-09-04/live-production-command-center.png)
- Local production skeleton screenshot — [local-production-command-center.png](evidence/brain-console-2-instant-navigation-performance-2026-09-04/local-production-command-center.png)
- Local production loaded cockpit screenshot — [local-production-command-center-loaded.png](evidence/brain-console-2-instant-navigation-performance-2026-09-04/local-production-command-center-loaded.png)

The final CUA re-inspection was unavailable while macOS was locked, but the actual app-tab viewport was measured before the change, the live app was launched successfully through the `.app` wrapper, and the final live production page was independently measured at the same 1141×797 viewport with zero overflow.
