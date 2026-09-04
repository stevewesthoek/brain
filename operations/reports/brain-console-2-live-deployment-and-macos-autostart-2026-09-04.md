# Brain Console 2.0 Live Deployment and macOS Autostart

**Date:** 2026-09-04
**Repository:** `brain`
**Canonical runtime:** `/Users/Office/Repos/stevewesthoek/brain-runtime`

## Integration

- `origin/main` before: `33616316369bfa3c1fd1e5a346c1e8f68aa4cdac`.
- The Command Center chain was based directly on that current main revision.
- Integrated foundation and vertical-slice commits include `ad240af0` and
  `35fba22b`, together with their required Phase 0/A ancestors.
- `origin/main` after the implementation commits: `2166e355c25217593a669e44e26a4eb6e1060048`.
- The final closeout-report commit is the deployed revision recorded in the
  final response; the runtime was updated to it before closeout.

## Live deployment

Brain Core and Brain Console run from the canonical `brain-runtime` checkout,
not a temporary worktree. The runtime checkout is pinned to the final
integrated `origin/main` revision and rebuilt before restart.

| Service | LaunchAgent | Port | Command | Log |
|---|---|---:|---|---|
| Brain Core | `com.office.brain-core` | `4877` | `/opt/homebrew/bin/node projects/brain-core/dist/index.js` | `~/Repos/stevewesthoek/brain-runtime/runtime/local/brain-core/launchd.{stdout,stderr}.log` |
| Brain Console | `com.office.brain-console` | `4881` | `/opt/homebrew/bin/node tools/brain-console-service.mjs` | `~/Library/Logs/Brain Console/console.launchd.{stdout,stderr}.log` |

Core exposes `GET /runtime/identity` and reports matching canonical source and
deployment revisions, production Core build mode, running service state, and
LaunchAgent ownership. The identity contract is bounded and does not expose
secrets or environment values.

## macOS app and startup

`/Users/Office/Applications/Brain Console.app` is an owned thin wrapper around
`/Users/Office/Repos/stevewesthoek/brain-runtime/tools/brain-console-launcher.mjs`.
It opens:

`http://localhost:4881/command-center`

The launcher uses a lock to serialize repeated launches, fails closed on
unknown port owners, reconciles only the two canonical LaunchAgents, and
stamps the installed Core plist with the runtime Git revision. The Console
LaunchAgent has `RunAtLoad=true`, `KeepAlive=true`, a five-second throttle, and
stable loopback port `4881`. Core has the corresponding `RunAtLoad=true` and
`KeepAlive=true` configuration on port `4877`.

No secrets, credentials, or `.env` values are stored in either plist.

## Acceptance evidence

- `GET http://127.0.0.1:4877/status`: healthy.
- `GET http://127.0.0.1:4877/runtime/identity`: `identityState=matching`.
- `GET http://127.0.0.1:4877/operational-snapshot`: real
  `operational-snapshot-v1` data with read-only safety flags.
- `GET http://localhost:4881/command-center`: HTTP 200.
- Browser inspection visibly showed Command Center, health, freshness,
  active work, attention, activity, domain posture, and matching source /
  deployed identity.
- Legacy `/`, `/scheduler`, `/local-apps`, `/infrastructure`, `/monitoring`,
  `/ai-models`, and `/settings`: HTTP 200.
- Recovery test restarted Core and Console through `launchctl kickstart -k`;
  both returned healthy with exactly one listener each.
- App launch was verified by the launcher log recording a successful
  `/command-center` open after launching the installed app bundle.
- A real logout/login or reboot was not performed; the loaded and enabled
  LaunchAgent configuration is verified instead.

## Validation

- Integrated Brain Core focused tests: 23 passed, 0 failed.
- Brain Console Command Center/schema/telemetry tests: 6 passed, 0 failed.
- Brain Core and Brain Console typechecks: passed.
- Brain Core and Brain Console production builds: passed.
- LaunchAgent plist lint and launcher syntax checks: passed.
- Duplicate listener check: one listener on `4877`, one on `4881`.
- `git diff --check`: passed.
- The original dirty checkout remained untouched.

## Preserved state and remaining scope

The pre-deployment dirty runtime edits were preserved in local branch
`backup/brain-runtime-pre-live-deploy-2026-09-04` before the canonical runtime
checkout was advanced. Obsidian was not redesigned; its existing routes and
plugin behavior were not changed by this deployment.
