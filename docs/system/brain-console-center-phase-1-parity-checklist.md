# Brain Console Center Phase 1 Parity Checklist

**Date:** 2026-06-04  
**Status:** Phase 1 implemented and build-validated  
**Leading dashboard:** Brain Console Center  
**Legacy dashboards:** ProBot dashboard, Brain Console Obsidian Plugin, Brain Console Web

## Validation evidence

Run from `projects/brain-console-center`:

```bash
npm run typecheck
npm run build
```

Current result:

```text
✓ typecheck passes
✓ production build passes
```

## Phase 1 surfaces

### Overview

| Requirement | Status | Source |
|---|---:|---|
| CPU load card | Covered | `GET /ops/system-metrics` |
| Memory pressure card | Covered | `GET /ops/system-metrics` |
| GPU load card | Covered as not-instrumented | `GET /ops/system-metrics` |
| Uptime card | Covered | `GET /ops/system-metrics` |
| Codex current window | Covered as not-instrumented | `GET /ops/ai-usage-windows` |
| Codex 5-hour window | Covered as not-instrumented | `GET /ops/ai-usage-windows` |
| Codex 7-day window | Covered as not-instrumented | `GET /ops/ai-usage-windows` |
| Claude Code Haiku cost | Covered as not-instrumented | `GET /ops/ai-costs` |
| Claude Code Sonnet cost | Covered as not-instrumented | `GET /ops/ai-costs` |
| Claude Code Opus cost | Covered as not-instrumented | `GET /ops/ai-costs` |

Not-instrumented metrics are intentional honest states, not fake values.

### Local Applications

| Requirement | Status | Source |
|---|---:|---|
| List all local apps | Covered | `GET /local-apps/dashboard` |
| Show canonical app id | Covered | `GET /local-apps/dashboard` |
| Show app name/label | Covered | `GET /local-apps/dashboard` |
| Show port | Covered | `GET /local-apps/dashboard` |
| Show URL/open target | Covered | `GET /local-apps/dashboard` |
| Show status/health | Covered | `GET /local-apps/dashboard` |
| Show action readiness | Covered | `GET /local-apps/action-readiness` |
| Start/restart action | Covered | `POST /local-apps/:id/start` or `POST /local-apps/:id/restart` |
| Stop action | Covered | `POST /local-apps/:id/stop` |
| Open action | Covered | Browser opens `http://localhost:<port>` when available |
| Refetch after mutations | Covered | TanStack Query invalidation |
| Browser never executes shell | Covered | Actions go through Brain Core only |

### AWS Video Pipeline

| Requirement | Status | Source |
|---|---:|---|
| Pipeline status | Covered | `GET /api/video-orchestrator/status` |
| Recent jobs | Covered | `GET /api/video-orchestrator/jobs/recent` |
| Selected job detail | Covered | `GET /api/video-orchestrator/jobs/:jobId` |
| Selected job timeline | Covered | `GET /api/video-orchestrator/jobs/:jobId/timeline` |
| Selected job artifacts | Covered | `GET /api/video-orchestrator/jobs/:jobId/artifacts` |
| Selected job AWS execution | Covered | `GET /api/video-orchestrator/jobs/:jobId/execution` |
| Create draft | Covered | `POST /api/video-orchestrator/jobs/create-from-prompt` |
| Approve script | Covered | `POST /api/video-orchestrator/scripts/:jobId/approve` |
| Request changes | Covered | `POST /api/video-orchestrator/scripts/:jobId/request-changes` |
| Generate artifacts/AWS workflow | Covered | `POST /api/video-orchestrator/scripts/:jobId/generate` |
| Activity/error feed | Covered | Browser session activity and mutation error rendering |
| YouTube publish controls absent | Covered | Phase 1 intentionally excludes publish routes |

## Legacy dashboard migration status

| Legacy dashboard | Phase 1 migration status | Notes |
|---|---:|---|
| Brain Console Web | Partially migrated | AWS Video operator view migrated except YouTube publish controls. |
| Brain Console Obsidian Plugin | Partially migrated | Local Apps safety/action model migrated into web dashboard form. |
| ProBot dashboard | Not broadly migrated | Only local-app-related operational concepts are covered in Phase 1. |

## Known limitations

- Phase 1 is type/build validated, but no browser/manual UX pass has been recorded in this checklist yet. Use `operations/runbooks/brain-console-center-manual-qa.md` for the first browser QA pass.
- Codex window and Claude Code cost cards depend on Brain Core telemetry that is currently represented as not-instrumented.
- Local Apps action support depends on Brain Core per-app action readiness and allowlisted execution policy.
- YouTube publish routes exist in Brain Core but are intentionally excluded from Phase 1.

## Next phase candidate

Phase 2 should add a browser/manual QA pass and then decide the next migration slice from legacy dashboards. Candidate slices:

1. ProBot sessions and continuations.
2. Scheduler and execution readiness.
3. Approval queues and audit trail.
4. AI selector health and agent cost summaries.
5. Legacy parity/decommission command center.
