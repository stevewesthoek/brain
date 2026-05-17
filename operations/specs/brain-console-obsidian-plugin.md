# Brain Console Obsidian Plugin Spec

## Purpose

Render Brain Core status inside Obsidian without copying runtime state into Markdown notes.

## Status

Code was not written into the live `mind/.obsidian` folder in this slice. A standalone plugin project path under `projects/brain-console-obsidian/` is currently blocked by the Brain repo write policy, so this spec records the exact implementation target for Codex or a future write-policy update.

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
brain-skills
brain-scheduler
brain-local-apps
brain-video-queue
brain-approvals
```

## Required endpoints

Read-only endpoints:

```text
GET /status
GET /sessions
GET /skills
GET /repos
GET /orchestrators
GET /capabilities
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /local-apps
GET /video/status
GET /video/queue
GET /approvals
GET /approvals/audit
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

The approval endpoints must show that responses contain `executed: false` until executable actions are separately approved and audited.

## Plugin safety rules

- The plugin must not store secrets.
- The plugin must not copy runtime logs into Mind notes.
- The plugin must not write generated state into Markdown.
- The plugin must continue rendering an offline/empty state when Brain Core is unavailable.
- The plugin must not call approval POST endpoints automatically.
- The plugin must not add executable actions until persistent audit storage and explicit approval UX are complete.

## Recommended implementation shape

Create a standalone plugin project outside the live vault first, then install/link it into the vault manually after validation.

Suggested future path if write policy allows:

```text
projects/brain-console-obsidian/
```

Suggested files:

```text
manifest.json
main.ts
styles.css
README.md
```

Minimum implementation:

- settings tab for Brain Core base URL
- ribbon command: `Open Brain Console`
- view type: `brain-console-view`
- polling disabled by default or low-frequency manual refresh
- manual refresh button
- offline state when `/status` fails
- no persisted runtime cache in notes

## Validation checklist

Before installing into `mind/.obsidian/plugins/`:

- TypeScript build passes.
- Plugin renders offline state when Brain Core is stopped.
- Plugin renders status/session/repo/scheduler/video/approval widgets when Brain Core is running.
- No secrets are stored in plugin settings.
- No runtime logs are written to Mind.
- No approval POST endpoint is called without a manual user click.
