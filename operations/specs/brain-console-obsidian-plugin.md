# Brain Console Obsidian Plugin Spec

## Purpose

Provide the supported **knowledge and Decision Center bridge** for Brain + Mind
inside Obsidian while keeping Brain Core as the headless API/control/safety
boundary. The web Brain Console is the live operational cockpit; runtime and
Decision Core state remain behind Brain Core instead of being copied into
Markdown notes.

The port-`4881` Brain Console is the live operational cockpit. This plugin is
the durable knowledge and Decision Center bridge; it is not a second runtime
authority or operational store.

## Status

**Widget contract:** `brain-console-obsidian-widget-contract-v1` (version 1)

**Release status:** Brain Console 2.0 complete. The reviewed plugin is live in
the canonical Mind vault at `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/`.
Use `operations/runbooks/brain-console-2-operations.md` as the operational
authority for activation and bridge verification.

The source adapter and plugin package both carry this contract. The current visible plugin workflow remains Decision Center; the frozen widget list supports parity and future read-only cockpit expansion, not a Phase 0/A UI redesign.

CLR3 recreates the Brain-owned standalone plugin source under `projects/brain-console-obsidian/` as a thin dependency-free Brain Core client and adds the Decision Center source implementation.

The plugin also exposes stable inverse navigation commands for the standalone
Console (`Open Brain Command Center`, `Open Brain Operations`, and `Open Brain
Computer`). Console search results use `obsidian://open` only for notes from the
bounded known-note registry; no fuzzy vault pathname or note body is used.

The canonical source package remains in Brain. Only the reviewed install files
are present in the live Mind plugin folder; other Mind `.obsidian` state stays
protected and uncommitted.

## Source of truth

Brain Core endpoint base URL:

```text
http://127.0.0.1:4877
```

Brain Console data contract:

```text
projects/brain-core/src/obsidian.ts
```

Human-facing Mind page:

```text
mind/live/machine.md
```

## Required widgets

The plugin should render the widget IDs from `BrainConsoleWidgetId`:

```text
brain-status
brain-sessions
brain-repos
brain-orchestrators
brain-capabilities
brain-scheduler
brain-local-apps
brain-video
brain-approvals
brain-runtime-reports
```

## Required endpoints

Read-only endpoints:

```text
GET /status
GET /sessions
GET /repos
GET /orchestrators
GET /capabilities
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /local-apps
GET /video/status
GET /approvals
GET /approvals/audit
GET /runtime/reports
```

Approval boundary endpoints:

```text
POST /actions/request?kind=<safe-action-kind>
POST /scheduler/jobs/:id/request-run
POST /skills/profile?profile=<profile>
POST /sessions/:id/resume
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
POST /approvals/:id/approve
POST /approvals/:id/reject
```

CLR3 Decision Center endpoints:

```text
GET  /api/infinite-brain/decisions
POST /api/infinite-brain/decisions/:proposalId
POST /api/infinite-brain/decisions/notifications/poll
```

The Decision Center reads one logical queue projected from the existing Infinite Brain proposal report plus proposal-approval ledger. It must not create another decision store. Decision actions carry the rendered proposal hash; Brain Core rejects stale hashes and keeps proposal application/execution blocked.

The approval endpoints must show that responses contain `executed: false` until executable actions are separately approved and audited.

## Plugin safety rules

- The plugin must not store secrets.
- The plugin must not copy runtime logs into Mind notes.
- The plugin must not write generated state into Markdown.
- The plugin must continue rendering an offline/empty state when Brain Core is unavailable.
- The plugin must not call approval POST endpoints automatically.
- The plugin must not add executable actions until persistent audit storage and explicit approval UX are complete.
- Context, runtime, and capability data remain manual-refresh by default.
- CLR3 permits one bounded exception: aggregate Decision Center attention polling may run at a low fixed frequency while Obsidian is open; it must not fetch or surface sensitive proposal/source text in notifications.
- The plugin must render capabilities and runtime reports as read-only summaries.

## Implemented adapter shape

Keep the standalone plugin project outside the live vault. Validate it there,
then maintain the bounded reviewed install in the live vault through the
canonical operations runbook.

```text
projects/brain-console-obsidian/
```

CLR3 source files:

```text
package.json
manifest.json
main.js
decision-center-core.cjs
decision-center-core.test.mjs
styles.css
README.md
```

Minimum implementation:

- settings tab for configurable Brain Core base URL and local audit label;
- ribbon command: `Open Brain Console`;
- view type: `brain-console-view`;
- manual Decision Core refresh;
- five-minute bounded aggregate decision-attention polling, independently toggleable;
- persistent status-bar pending count while Obsidian is running;
- offline state when Brain Core is unavailable;
- stale-proposal-hash rejection rendered as refresh-and-review guidance;
- no persisted runtime or decision cache in Mind notes;
- no Brain Core/business logic duplicated in the plugin.

## Validation checklist

For source/package validation and live maintenance:

- dependency-free JavaScript syntax and Decision Center core tests pass;
- one-primary-portal contract validation passes;
- plugin renders an offline state when Brain Core is unavailable;
- plugin renders the Decision Core queue and pending-count status from Brain Core when available;
- stale proposal hashes are rejected and require refresh/review;
- repeated identical decisions are idempotent;
- notification dedupe/noise and sensitive-payload tests pass;
- no secrets are stored in plugin settings;
- no runtime logs or generated decision state are written to Mind;
- no decision POST endpoint is called without a manual user click;
- only the reviewed source/install files are present in the live vault; do not broaden the activation boundary.
