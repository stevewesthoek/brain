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
- ✅ **live-verified (2026-05-18):** provide an approval request boundary that records approval state to durable JSON + JSONL audit logs, but does not execute actions
- provide a read-only Brain Console widget contract for future Obsidian integration
- expose read-only capability metadata for Mind cleanup state, Brain Console scaffold status, and ProBot thin-client wiring
- ✅ **first action candidate live-verified:** execution readiness for `scheduler-run-model-router-dry-run` is read-only and reports `executionEnabled: false`

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
curl http://127.0.0.1:4877/scheduler/latest-run
curl http://127.0.0.1:4877/scheduler/jobs
curl http://127.0.0.1:4877/video/status
curl http://127.0.0.1:4877/approvals
curl http://127.0.0.1:4877/approvals/audit
curl http://127.0.0.1:4877/approvals/store
curl http://127.0.0.1:4877/execution/plans
curl http://127.0.0.1:4877/execution/readiness
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
- `GET /approvals/store` exposes read-only approval-store health and record counts.
- `GET /execution/plans` and `GET /execution/readiness` expose the first future execution candidate as read-only metadata only. They do not enable execution.
- `GET /runtime/reports` exposes read-only runtime report summaries for model-router, approval-audit, video, and local-apps. It never reads Mind content and always reports `writesToMind: false` and `executableActions: false`.
- Optional audit persistence uses `BRAIN_CORE_APPROVAL_AUDIT_PATH` as a JSONL file path. Use a safe ignored runtime path; do not store audit logs in Mind notes.
- Audit path validation rejects `..`, `mind`, `.env`, `.git`, `node_modules`, `dist`, and `build`. Unsafe paths fall back to memory-only audit events.
- Approval request kinds are normalized through a strict scaffold. Allowlisted scheduler/session/skill/local-app requests plus `manual-request` and `custom-*` are recorded; unsupported kinds are rejected without execution.
- Audit events always include `executed: false` and a `source` of `memory` or `jsonl`.
- ✅ **live-verified (2026-05-18):** Approval store JSON persistence operational with `BRAIN_CORE_APPROVAL_STORE_PATH`.
- ✅ **live-verified (2026-05-18):** Approval audit JSONL persistence operational with `BRAIN_CORE_APPROVAL_AUDIT_PATH`.
- ✅ **live-verified (2026-05-18):** Approve/reject endpoints return `executed: false` even after marking approval as `approved`.
- First-action feature flag design complete: see `operations/specs/brain-core-first-action-feature-flag.md` for planned flag `BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION`.
- Scheduler endpoints are read-only. They return placeholders until `runtime/local/model-router/latest.json` exists, or until `BRAIN_CORE_MODEL_ROUTER_REPORT_PATH` points to a safe JSON report.
- Video/local-app endpoints are report-backed when safe JSON exists under `runtime/local/video/latest.json` or `runtime/local/local-apps/latest.json`, or when the corresponding `BRAIN_CORE_*_REPORT_PATH` env var points to a safe JSON report. Missing or invalid reports fall back to placeholders and never execute actions.
- Those report-backed local app and video surfaces were live-verified over `http://127.0.0.1:4877`.

## Rollback

If Brain Core breaks, use Obsidian notes directly and keep ProBot as a fallback diagnostic surface. Do not re-expand the ProBot dashboard; fix Brain Core or the Obsidian integration instead.

Manual Brain Console install/test instructions live in `operations/runbooks/brain-console-manual-install-test.md`.
