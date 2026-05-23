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
- Read-only execution readiness endpoints exist for the first future candidate, `scheduler-run-mind-steward-dry-run`, reporting `executionEnabled: false`.
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
curl http://127.0.0.1:4877/execution/plans/scheduler-run-mind-steward-dry-run
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


## Feature flag operator display

The first-action feature flag is now implemented as a read-only signal:

```bash
BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION=false
```

Operator surfaces should show both values separately:

- feature flag state: enabled/disabled
- execution state: enabled/disabled

Important: `BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION=true` is not enough to execute anything. It only removes the feature-flag blocker. Execution remains disabled until all other gates are proven for the exact request:

1. safe localhost request
2. durable approval store available
3. durable audit JSONL available
4. unexpired approval with status `approved`
5. exact action kind `scheduler-run-mind-steward-dry-run`
6. safe runtime output path under Brain `runtime/local/`
7. exact command allowlist match
8. rollback plan present
9. operator UX confirms the action and resulting state

Brain Console and ProBot must display the flag state as an operator warning, not as permission to execute.

## Rollback drill checklist for the first action

Before any future execution implementation is allowed, complete this drill without running the action:

```bash
unset BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION
curl -fsS http://127.0.0.1:4877/execution/readiness
curl -fsS http://127.0.0.1:4877/capabilities
```

Expected result:

```text
executionEnabled=false
mindStewardDryRunExecutionFlagEnabled=false
executableActions=false
readyCandidateCount=0
```

Then simulate the flag-on operator view without executing:

```bash
BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION=true npm run --prefix projects/brain-core dev
curl -fsS http://127.0.0.1:4877/execution/readiness
curl -fsS http://127.0.0.1:4877/execution/plans/scheduler-run-mind-steward-dry-run
curl -fsS http://127.0.0.1:4877/capabilities
```

Expected result:

```text
mindStewardDryRunExecutionFlagEnabled=true
executionEnabled=false
wouldExecute=false
executed=false
executableActions=false
readyCandidateCount=0
```

Rollback procedure:

1. Stop Brain Core.
2. Unset `BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION` or set it to `false`.
3. Restart Brain Core.
4. Recheck `/execution/readiness` and `/capabilities`.
5. Preserve approval store and audit logs; do not delete audit evidence.
6. Remove only generated runtime dry-run reports if a future execution implementation ever creates them and cleanup is explicitly required.
