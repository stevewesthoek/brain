# Brain Console 2.0 Operations Runbook

**Status:** released and accepted
**Release revision:** `9a5719e731f16c4e88bb34720c1679f1e3276be9`
**Last verified:** 2026-09-05

This is the maintenance runbook for the accepted Brain Console 2.0 release.
It documents the current local Mac deployment; it does not define a new
feature roadmap.

## Canonical documentation map

| Concern | Authority |
|---|---|
| Product contract | `operations/specs/brain-console-2-product-spec.md` |
| Architecture and safety boundary | `docs/system/brain-console-architecture.md` |
| Web project entry point | `projects/brain-console/README.md` |
| Obsidian integration entry point | `projects/brain-console-obsidian/README.md` and `operations/specs/brain-console-obsidian-plugin.md` |
| Release status and phase closure | `operations/reports/brain-console-2-modernization-roadmap.md` |
| Historical acceptance evidence | `operations/reports/brain-console-2-final-product-closeout-2026-09-05.md` |

## Canonical product surfaces

Brain Core is the operational API and safety boundary. Brain Console is the
live read/control cockpit. Obsidian is the durable knowledge and Decision
Center plane. They share stable IDs and deep links but do not create competing
stores of operational truth.

| Surface | Canonical route or location | Role |
|---|---|---|
| Command Center | `http://127.0.0.1:4881/command-center` | Primary posture, attention, active work, and next-action view |
| Brain | `http://127.0.0.1:4881/brain` | Orchestration, tasks/evidence, quality/safety, continuity, and routing |
| Computer | `http://127.0.0.1:4881/computer` | Host, service, local-app, process, storage, and network posture |
| Operations | `http://127.0.0.1:4881/operations` | Scheduler, runtime, tunnels, infrastructure, monitoring, and telemetry |
| Global Search | `Cmd/Ctrl-K` from the Console shell | Routes, tasks, operations, reports, capabilities, and Obsidian references |
| Settings | `http://127.0.0.1:4881/settings` | Console preferences and diagnostic settings |
| Advanced diagnostics | `/scheduler`, `/local-apps`, `/tunnels`, `/infrastructure`, `/monitoring`, `/dokploy`, `/ai-models` | Detail surfaces linked from the canonical shell |
| Specialist workflows | `/video-analyzer`, `/aws-video` | Specialist work surfaces, not competing home dashboards |
| Obsidian bridge | `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console` | Durable knowledge context and Decision Center bridge |

Compatibility/detail surfaces are not competing primary workflows. The legacy
`/infinite-brain` URL redirects to `/brain`; task detail routes under
`/brain/tasks/[taskId]` are drill-downs; provider/detail routes remain available
behind explicit links for diagnostics and specialist work.

## Current deployment

| Component | Current value |
|---|---|
| Brain Core | `com.office.brain-core`, `127.0.0.1:4877` |
| Brain Console | `com.office.brain-console`, `127.0.0.1:4881` |
| Runtime checkout | `/Users/Office/Repos/stevewesthoek/brain-runtime` |
| Canonical source | `/Users/Office/Repos/stevewesthoek/brain` |
| Brain Console.app | `/Users/Office/Applications/Brain Console.app` |
| App entry point | `/Users/Office/Repos/stevewesthoek/brain-runtime/tools/brain-console-launcher.mjs` |
| Core LaunchAgent | `/Users/Office/Library/LaunchAgents/com.office.brain-core.plist` |
| Console LaunchAgent | `/Users/Office/Library/LaunchAgents/com.office.brain-console.plist` |
| Scheduler LaunchAgent | `/Users/Office/Repos/stevewesthoek/brain-runtime/operations/system-configs/launchagents/com.office.nightly-scheduler.plist` |

The installed Core identity currently reports matching source/deployment
revision `9a5719e731f16c4e88bb34720c1679f1e3276be9`, production mode, and
LaunchAgent ownership. The Console app is a thin Finder/Dock wrapper around the
runtime launcher; product runtime logic remains in the repository/runtime
checkout.

## Scheduler relationship

`com.office.nightly-scheduler` is a separate one-shot LaunchAgent. It uses the
same versioned `brain-runtime` checkout, runs at `03:00` local time, and has
`RunAtLoad=false`. It is therefore expected to be loaded but not running
between scheduled executions. Its last accepted run was successful with zero
failed jobs; policy-blocked or disabled jobs remain visibly represented in the
Console rather than being treated as Console failures.

## Obsidian plugin

Canonical live vault: `/Users/Office/Repos/stevewesthoek/mind`.

The bounded live plugin is installed at:

```text
/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/
```

The `brain-console` entry is present in the vault's community-plugin registry.
The live plugin is version `0.3.0`, enabled and loaded, and registers the five
Brain Console commands. Do not modify other vault settings, content, plugins,
or secrets as part of routine Console maintenance.

## Verification

### Health and source/deployment identity

```bash
curl -fsS http://127.0.0.1:4877/health
curl -fsS http://127.0.0.1:4877/runtime/identity
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4881/command-center
launchctl print gui/$(id -u)/com.office.brain-core
launchctl print gui/$(id -u)/com.office.brain-console
```

The identity response must show `identityState: "matching"`, equal
`canonicalSource.revision` and `deployment.revision`, production build mode,
`serviceState: "running"`, and `launchMechanism: "launchagent"`.

### Normal restart and recovery

Use the managed labels and the current user GUI domain; do not kill broad
process groups or delete runtime state:

```bash
launchctl kickstart -k gui/$(id -u)/com.office.brain-core
launchctl kickstart -k gui/$(id -u)/com.office.brain-console
curl -fsS http://127.0.0.1:4877/health
curl -fsS http://127.0.0.1:4877/runtime/identity
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4881/command-center
```

For a missing/unloaded service, use the installed LaunchAgent plist with
`launchctl bootstrap gui/$(id -u) <plist>` after confirming the plist path and
its identity fields. The Brain Console.app launcher is the preferred normal
user-facing recovery entry point because it validates ownership and reconciles
stale managed identities before opening Command Center.

### Console and Obsidian bridge smoke test

1. Open Brain Console.app or Command Center.
2. Press `Cmd-K`, search `Run ledger`, and open task `0C-C`.
3. From the palette, search `Brain Mind Bridge` and use **Open in Obsidian**.
4. In Obsidian's command palette, run **Open Brain Command Center** or **Open Brain Task 0C-C**.
5. Confirm the embedded Console route and task title load.

The bridge is read-only with respect to runtime operations; durable decisions
remain in Obsidian and operational state remains in Brain Core.

## Logs

| Component | Logs |
|---|---|
| Brain Core stdout/stderr | `/Users/Office/Repos/stevewesthoek/brain-runtime/runtime/local/brain-core/launchd.stdout.log` and `launchd.stderr.log` |
| Brain Console stdout/stderr | `/Users/Office/Library/Logs/Brain Console/console.launchd.stdout.log` and `console.launchd.stderr.log` |
| Brain Console launcher | `/Users/Office/Library/Logs/Brain Console/launcher.log` |
| Nightly scheduler stdout/stderr | `/Users/Office/Library/Logs/office-scheduler/nightly.log` and `nightly.error.log` |

Do not copy logs into Mind notes or commit them. Inspect only the bounded lines
needed for the current incident, and redact sensitive values from any external
report.

## Maintenance boundary

Brain Console 2.0 is complete. Do not reopen the modernization roadmap for
Computer, Search, Obsidian activation, performance hardening, accessibility,
or Mac-launcher work unless a real regression is verified. New product scope
requires a separately approved Brain Console 2.1 release decision.
