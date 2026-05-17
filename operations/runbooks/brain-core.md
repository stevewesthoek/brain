# Brain Core Runbook

Brain Core is the local API boundary for the Obsidian-first operating cockpit.

## Current status

Brain Core lives at:

```text
projects/brain-core/
```

Default local URL:

```text
http://127.0.0.1:4877/status
```

Current role:

- expose read-only machine/session/repo/skill/scheduler/video/approval state
- provide an approval request boundary that records approval state but does not execute actions yet
- provide a read-only Brain Console widget contract for future Obsidian integration

## Start locally

```bash
cd projects/brain-core
npm install
npm run dev
```

## Validate

```bash
cd projects/brain-core
npm run ci
```

Expected coverage:

- TypeScript typecheck
- route contract tests
- session adapter test
- Brain Console widget/health tests

## Health checks

```bash
curl http://127.0.0.1:4877/status
curl http://127.0.0.1:4877/sessions
curl http://127.0.0.1:4877/repos
curl http://127.0.0.1:4877/orchestrators
curl http://127.0.0.1:4877/capabilities
curl http://127.0.0.1:4877/scheduler/status
curl http://127.0.0.1:4877/video/status
curl http://127.0.0.1:4877/approvals
```

## Obsidian integration health

The future Obsidian `brain-console` plugin should render the widget contract from:

```text
projects/brain-core/src/obsidian.ts
```

The expected widget IDs are:

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

If the integration is unhealthy, Obsidian should remain readable and show a Brain Core offline/unavailable state instead of copying runtime state into markdown.

## Restore path

1. Confirm the repo is on the intended branch.
2. Run `npm run ci` in `projects/brain-core`.
3. Start the service locally with `npm run dev`.
4. Verify `/status` returns `service: brain-core` and `mode: read-only`.
5. Verify Obsidian still links to `live/machine.md` and remains readable without live API data.
6. Do not enable mutation/action execution until approval-aware persistence and audit logging exist.

## Safety boundaries

- Bind to localhost by default.
- No broad shell execution.
- No secrets in responses.
- Do not paste runtime logs into Mind.
- Do not use Mind notes as a runtime database.
- Approval endpoints currently record and decide only; they return `executed: false`.
- `GET /approvals/audit` exposes approval audit events.
- Optional audit persistence uses `BRAIN_CORE_APPROVAL_AUDIT_PATH` as a JSONL file path. Use a safe ignored runtime path; do not store audit logs in Mind notes.
- Scheduler/video/local-app endpoints are placeholders until real adapters are separately validated.

## Rollback

If Brain Core breaks, use Obsidian notes directly and keep ProBot as a fallback diagnostic surface. Do not re-expand the ProBot dashboard; fix Brain Core or the Obsidian integration instead.
