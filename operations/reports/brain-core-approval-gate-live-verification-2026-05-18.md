# Brain Core Approval Gate Live Verification — 2026-05-18

## Summary

Brain Core approval persistence and audit logging were live-verified on 2026-05-18. All execution safety gates remain disabled. Approval store and audit JSONL persistence are confirmed operational.

## Live Verification Command

```bash
# Set safe runtime paths
APPROVAL_STORE_PATH="/Users/Office/Repos/stevewesthoek/brain/runtime/local/brain-core/live-verification-approvals.json"
APPROVAL_AUDIT_PATH="/Users/Office/Repos/stevewesthoek/brain/runtime/local/brain-core/live-verification-approval-audit.jsonl"

# Start Brain Core with approval persistence
export BRAIN_CORE_APPROVAL_STORE_PATH="$APPROVAL_STORE_PATH"
export BRAIN_CORE_APPROVAL_AUDIT_PATH="$APPROVAL_AUDIT_PATH"
npm run --prefix projects/brain-core dev
```

## Paths

- **Approval Store Path Category:** `runtime/local/brain-core/live-verification-approvals.json`
  - Safe location: local runtime directory, not committed
  - Persisted: ✓ Yes
  - Status: Available

- **Approval Audit Path Category:** `runtime/local/brain-core/live-verification-approval-audit.jsonl`
  - Safe location: local runtime directory, not committed
  - Persisted: ✓ Yes (append-only JSONL)
  - Status: Available

## Endpoints Verified

| Endpoint | Method | Result |
|----------|--------|--------|
| `/status` | GET | ✓ Returns read-only mode |
| `/execution/plans` | GET | ✓ Lists candidate plans |
| `/execution/plans/scheduler-run-mind-steward-dry-run` | GET | ✓ Returns plan metadata |
| `/execution/readiness` | GET | ✓ Returns disabled state |
| `/capabilities` | GET | ✓ Returns manifest |
| `/scheduler/jobs/mind-steward-dry-run/request-run` | POST | ✓ Creates approval request |
| `/approvals/store` | GET | ✓ Returns store health |
| `/approvals` | GET | ✓ Lists approval records |
| `/approvals/audit` | GET | ✓ Returns audit events |
| `/approvals/:id/approve` | POST | ✓ Marks approved without executing |
| `/approvals/:id/reject` | POST | ✓ Marks rejected without executing |

## Results

### Approval Store Persistence
- ✓ Approval store file created: `live-verification-approvals.json`
- ✓ Store is valid JSON
- ✓ Records persisted: 2 (one requested-approved, one requested-rejected)
- ✓ All records have `executed: false`
- ✓ Store endpoint reports `status: "available"` and `recordCount: 2`

### Audit JSONL Persistence
- ✓ Audit file created: `live-verification-approval-audit.jsonl`
- ✓ Audit is valid JSONL (one valid JSON object per line)
- ✓ Events persisted: 4 total
  - `requested`: 2 events
  - `approved`: 1 event
  - `rejected`: 1 event
- ✓ All audit events have `executed: false`
- ✓ Audit endpoint reports all events with `executed: false`

### Request/Approve/Reject Workflow
- ✓ `/scheduler/jobs/mind-steward-dry-run/request-run` POST creates approval request
  - Response: `accepted: true`, `executed: false`
  - Approval created with `status: "pending"`
  - Audit event created: `event: "requested"`, `executed: false`

- ✓ `/approvals/:id/approve` POST marks approval approved
  - Response: `accepted: true`, `executed: false`
  - Approval status changed to `approved`
  - Audit event created: `event: "approved"`, `executed: false`

- ✓ `/approvals/:id/reject` POST marks approval rejected
  - Response: `accepted: true`, `executed: false`
  - Approval status changed to `rejected`
  - Audit event created: `event: "rejected"`, `executed: false`

### Execution Safety Gates
- ✓ `executionEnabled: false` (all endpoints, all responses)
- ✓ `wouldExecute: false` (all execution plans, all approval responses)
- ✓ `executed: false` (all approval responses, all audit events)
- ✓ `writesToMind: false` (all responses)
- ✓ `externalSideEffects: false` (all execution plans)
- ✓ First candidate `scheduler-run-mind-steward-dry-run` remains report-only

## Test Coverage

All automated tests pass (48 total):
- ✓ Unsafe approval store paths are rejected
- ✓ Corrupted approval store JSON returns `status: "invalid"`
- ✓ Approve without execution
- ✓ Reject without execution
- ✓ Missing approval handling
- ✓ Approval audit JSONL persistence
- ✓ Invalid approval audit paths fall back to memory

Run tests with:
```bash
npm run --prefix projects/brain-core ci
```

## Verification Files

Generated local verification files (not committed):
- `/Users/Office/Repos/stevewesthoek/brain/runtime/local/brain-core/live-verification-approvals.json`
- `/Users/Office/Repos/stevewesthoek/brain/runtime/local/brain-core/live-verification-approval-audit.jsonl`

These files are in `.gitignore` and safe to leave for inspection.

## Key Findings

1. **Approval persistence is operational** — Approval records persist to JSON and audit events persist to JSONL.
2. **Audit trail is complete** — All approval lifecycle events (requested, approved, rejected) are recorded with timestamps.
3. **Execution is still disabled** — No action is executed even after approval is marked as `approved`.
4. **Safety gates are enforced** — All endpoints return `executed: false` and `executionEnabled: false`.
5. **Mind is untouched** — No files in the mind vault were accessed or modified.

## Remaining Blockers Before Any Execution

1. **Explicit user decision** — Feature flag design and approval to enable the first action
2. **Feature flag design** — See `operations/specs/brain-core-first-action-feature-flag.md`
3. **Rollback drill** — Validate recovery procedures if needed
4. **One-action-only enforcement** — Ensure only `scheduler-run-mind-steward-dry-run` is allowed
5. **Operator UI confirmation** — Brain Console/ProBot must surface the enabled state clearly

## Next Steps

1. Review feature flag design in `operations/specs/brain-core-first-action-feature-flag.md`
2. Decide whether to implement execution for the first action (still disabled by default)
3. Plan rollback drill
4. Update documentation with execution-enabled state
5. Prepare operator training/runbook

## Status

- Brain Core version: 0.1.0
- Approval store: Operational
- Audit JSONL: Operational
- Execution: Disabled (by design)
- Mind sync: Not affected
- Previous verification files: Cleaned up

---

**Verified by:** Claude Code
**Date:** 2026-05-18
**Duration:** Live server test, ~15 minutes
**Result:** ✅ All safety gates verified and operational
