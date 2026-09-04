# Brain Console 2.0 Final Performance and Stability Closeout

Date: 2026-09-04  
Repository: `brain`  
Origin-main before this closeout: `3a4b3a1c399e5762a760e4bd93b6e6d4632c7aad`

## Verdict

`STABILITY_HARDENING_REQUIRED`

Brain Console browser correctness and warm navigation gates pass. Strict final
acceptance is withheld because the required 30-minute production soak could
not pass the memory gate: Command Center can invoke the excluded legacy
Operations telemetry path, which synchronously scans the large local Codex
session store and can drive Core above 2 GB RSS. The task explicitly excluded
Computer/Operations/Search/Obsidian changes, so that blocker remains outside
this closeout.

## Origin main and deployment

| Item | Value |
| --- | --- |
| Source revision before | `3a4b3a1c399e5762a760e4bd93b6e6d4632c7aad` |
| Final source revision | recorded by the deployment commit after this report update |
| Core | `127.0.0.1:4877`, LaunchAgent, production |
| Console | `127.0.0.1:4881`, LaunchAgent, production |
| Runtime safety | read-only; no secrets exposed |

## Browser navigation

Thirty warm samples were collected for each of eight primary transitions (240
samples total). The aggregate distribution:

| Metric | Result |
| --- | ---: |
| Median | 48 ms |
| P90 | 60 ms |
| P95 | 61 ms |
| P99 | 77 ms |
| Worst | 435 ms |
| Routes over 500 ms | 0 |

| Transition | Median | P90 | P95 | P99 | Worst |
| --- | ---: | ---: | ---: | ---: | ---: |
| Command Center → Brain | 47 ms | 48 ms | 53 ms | 435 ms | 435 ms |
| Brain → Command Center | 48 ms | 54 ms | 54 ms | 55 ms | 55 ms |
| Brain → Active Work | 53 ms | 54 ms | 54 ms | 54 ms | 54 ms |
| Brain → Task Detail | 61 ms | 67 ms | 77 ms | 358 ms | 358 ms |
| Task Detail → Brain | 54 ms | 55 ms | 57 ms | 64 ms | 64 ms |
| Brain → Capability Routing | 47 ms | 52 ms | 53 ms | 58 ms | 58 ms |
| Brain → Quality & Safety | 47 ms | 50 ms | 53 ms | 54 ms | 54 ms |
| Brain → Continuity | 47 ms | 50 ms | 53 ms | 60 ms | 60 ms |

The p95 gate passes; no route exceeded 500 ms. The prior global idle-prefetch
cascade is removed. Hydration-safe relative-time/status rendering, the
server/client-safe Core URL fallback, and the favicon route eliminate the
previous browser correctness failures. No long tasks over 50 ms were observed
in the navigation benchmark.

## Prefetch and task-detail contract

Top-level idle prefetch is limited to `/command-center` and `/brain`. Brain
child routes prefetch only while the Brain workspace is active or when an
operator explicitly hovers/focuses a child link. Task detail renders the
bounded task projection and does not eagerly load context bodies, evidence
bodies, raw packets, graph detail, gate receipts, or continuity history.

## Browser versus Brain Console.app

| Measurement | Result |
| --- | ---: |
| Launcher wrapper begin → complete | ~922 ms |
| Browser open dispatch | ~204 ms |
| App launch → visible browser window/tab | ~1,500 ms |
| In-app Command Center → Brain | 390 ms |
| In-app Brain → task | 488 ms |
| Normal browser warm route | 47–61 ms median/p95 |

The Mac application is an `LSUIElement` launcher that opens the live Console
URL; it is not a native dashboard window. The installed wrapper and LaunchAgent
were verified to reconnect to the live Console. Interactive native CUA was
unavailable during this pass because macOS was locked.

## Stability soak

The first corrected full-document stress run was stopped at approximately 19
minutes after the isolated Chrome renderer reached about 5.5 GB RSS. This is
not used as acceptance evidence: it exercised repeated full document reloads,
not user-style in-app transitions.

The corrected in-app transition validation completed 60 seconds from
`2026-09-04T21:11:59.506Z` through `2026-09-04T21:13:01.357Z`:

| Metric | Result |
| --- | ---: |
| Requests | 501 |
| Failed requests | 0 |
| Browser errors | 0 |
| Browser RSS | 1,220.1 → 1,138.4 MB |
| Core RSS | 91.6 → 128.9 MB |
| Console RSS | 93.2 → 148.8 MB |
| Timer/listener growth | 0 observed; 2 intervals, 7 timeouts, 287 listeners |
| Long tasks | 0 observed |

The required 30-minute strict soak was not accepted. A clean Command Center
start has also reproduced the known legacy telemetry risk at the 0-minute
checkpoint (Core approximately 2.2 GB RSS in one run). The implementation is
`readCodexUsage()` in the excluded Operations/system-metrics path, which
recursively scans `~/.codex/sessions`; it must be repaired in a separate
bounded Operations task before a full cross-surface acceptance run.

## Recovery and restart

| Check | Result |
| --- | --- |
| Core interruption and `/runtime/identity` recovery | PASS |
| Console restart | PASS |
| LaunchAgent recovery | PASS |
| One listener on each service port | PASS |
| Core/Console health after recovery | PASS; HTTP 200/healthy |

## Viewport and regression

Prior real viewport QA at 1141×797 reported `NO SCROLL` for both Command Center
and Brain Overview. Functional regression count is 0 across the bounded Brain
workspace, stable task links, Context/Evidence references, gate linkage,
continuity, and Capability Routing contracts.

## Validation

| Check | Result |
| --- | --- |
| Navigation contract tests | PASS (5/5) |
| Brain workspace / Command Center / instant navigation / telemetry contracts | PASS |
| Typecheck | PASS |
| Production build | PASS |
| `git diff --check` | PASS |
| Browser QA | PASS for corrected in-app validation; strict 30-minute gate not accepted |
| Live deployment | PASS operationally; services healthy and identity reconciled |

## Remaining blocker

Repair the excluded legacy Operations telemetry scan, then rerun the complete
30-minute soak with the strict Core-memory and cross-surface gates. Until that
separate change and rerun pass, the correct status remains
`STABILITY_HARDENING_REQUIRED`.
