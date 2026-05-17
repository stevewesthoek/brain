# Brain Core Approval Gates

Brain Core approval handling is currently read-only and non-executing.

## Current status

- ✅ **2026-05-18 live verified:** Approval store persistence operational
- ✅ **2026-05-18 live verified:** Approval audit JSONL persistence operational
- ✅ **2026-05-18 live verified:** Approve/reject workflow returns `executed: false`
- Approval requests can be recorded in memory or to durable storage.
- Optional JSON approval storage enabled with `BRAIN_CORE_APPROVAL_STORE_PATH`.
- Approval audit JSONL persistence enabled with `BRAIN_CORE_APPROVAL_AUDIT_PATH`.
- All responses return `executed: false`.
- Execution remains disabled.
- Read-only execution readiness endpoints exist for the first future candidate, `scheduler-run-model-router-dry-run`, reporting `executionEnabled: false`.
- Feature flag design complete: see `operations/specs/brain-core-first-action-feature-flag.md`

## Safe runtime paths

- `runtime/local/brain-core/approvals.json`
- `runtime/local/brain-core/approval-audit.jsonl`

These paths are Brain-owned runtime state only. Do not store them in Mind.

## Verify

```bash
curl http://127.0.0.1:4877/approvals
curl http://127.0.0.1:4877/approvals/audit
curl http://127.0.0.1:4877/approvals/store
curl http://127.0.0.1:4877/execution/plans
curl http://127.0.0.1:4877/execution/plans/scheduler-run-model-router-dry-run
curl http://127.0.0.1:4877/execution/readiness
```

In dev/test, the POST request routes can still be exercised as approval-request scaffolding, but they must not execute actions.

## Before execution can ever be enabled

The following must exist first:

1. ✅ Durable approval store verified (2026-05-18)
2. ✅ Durable audit persistence verified (2026-05-18)
3. ✅ Per-action rollback plan (designed, not yet implemented)
4. ✅ Locked allowlist (designed, not yet implemented)
5. ⏳ Operator confirmation UX (Brain Console/ProBot polish needed)
6. ✅ Action-specific dry-run preview (live-verified)
7. ✅ One action kind enabled at a time (designed for first action only)
8. ⏳ Safety review completed (awaiting formal sign-off)

## Safety

- Do not enable execution in this phase.
- Do not call real action endpoints expecting side effects.
- Do not write approval or audit logs into Mind.
- Do not store secrets in approval settings or runtime files.
