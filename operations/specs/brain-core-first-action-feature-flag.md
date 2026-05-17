# Brain Core First Action Feature Flag — Design Only

## Status

**Design only. Execution remains disabled. No implementation yet.**

This document specifies how to enable execution for the first action (`scheduler-run-model-router-dry-run`) when explicit approval is given.

## Proposed Environment Flag

```bash
# Default: false (execution disabled)
BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=false

# To enable: set to true
BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=true
```

## Proposed Allowed Action

- **Kind:** `scheduler-run-model-router-dry-run`
- **Type:** Report-only
- **Scope:** Single action, not batch execution
- **Default:** Disabled until explicit flag is set

## Required Conditions Before Execution

All of these must be true for execution to proceed:

1. **localhost only**
   - Non-local requests are rejected before reaching execution gates
   - Remote requests always return `403 Forbidden`

2. **Approval store available**
   - `BRAIN_CORE_APPROVAL_STORE_PATH` configured and writable
   - Store is not `unsafe` or `invalid`

3. **Audit available**
   - `BRAIN_CORE_APPROVAL_AUDIT_PATH` configured and writable
   - Audit is not `unsafe` or `invalid`

4. **Approval status approved**
   - Approval exists for this action
   - Approval status is exactly `approved`
   - Approval has not expired

5. **Execution plan kind matches exactly**
   - Requested kind: `scheduler-run-model-router-dry-run`
   - No other kinds allowed

6. **Feature flag true**
   - `BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=true`
   - Flag is checked at request time, not at startup

7. **Runtime output path safe**
   - Output target: `runtime/local/model-router/`
   - Path is within `runtime/local/`, not in Mind or system directories
   - Path exists and is writable

8. **Command allowlist exact match**
   - Only `bash tools/scripts/model-router-dry-run-report.sh`
   - No other commands
   - No environment variable injection
   - No piping, no redirection override

9. **Rollback plan present**
   - Rollback procedure documented and tested
   - Recovery steps for partial execution
   - Procedure for removing/resetting runtime output

## Proposed Command

**Symbolic representation only (design phase — not yet executable):**

```bash
# Execution would run:
bash tools/scripts/model-router-dry-run-report.sh

# Output would be written to:
runtime/local/model-router/dry-run-report-${timestamp}.json

# Approval audit event:
{
  "event": "executed",
  "approvalId": "approval-1",
  "kind": "scheduler-run-model-router-dry-run",
  "status": "ok",
  "executedAt": "2026-05-18T13:35:43.216Z",
  "executed": true,
  "output": {
    "path": "runtime/local/model-router/dry-run-report-2026-05-18.json",
    "size": 12345,
    "lines": 42
  }
}
```

## Explicit Non-Goals

The following are explicitly NOT supported in this first action:

1. **No Mind writes**
   - Only reads Mind stat-only metadata (file counts, ages)
   - No modifications to any Mind vault file
   - No markdown writes
   - No task mutations

2. **No arbitrary commands**
   - Only `bash tools/scripts/model-router-dry-run-report.sh`
   - No shell variable expansion in commands
   - No piping to other commands
   - No command substitution

3. **No local app lifecycle**
   - No starting ProBot
   - No stopping services
   - No restarting orchestrators
   - No background task triggers

4. **No session resume**
   - No resuming Claude Code sessions
   - No handoff workflows
   - No decision-log appends

5. **No video workflow trigger**
   - No n8n webhook calls
   - No Viral Flow orchestration
   - No video runtime state mutations

6. **No scheduler broad execution**
   - No executing all scheduler jobs
   - No triggering hygiene loops
   - No memory compaction
   - Only the single dry-run report action

## Rollback Plan

If execution needs to be rolled back:

1. **Disable flag immediately:**
   ```bash
   unset BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION
   # or
   BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=false
   ```

2. **Remove generated runtime output (if needed):**
   ```bash
   rm -rf /Users/Office/Repos/stevewesthoek/brain/runtime/local/model-router/
   ```

3. **Verify execution disabled:**
   ```bash
   curl -fsS http://127.0.0.1:4877/execution/readiness | grep executionEnabled
   # Should show: "executionEnabled": false
   ```

4. **Check audit trail:**
   ```bash
   curl -fsS http://127.0.0.1:4877/approvals/audit | tail -5
   # Should show last event is no longer "executed"
   ```

5. **Never remove approval store or audit logs** — these are the audit trail and must be preserved for compliance.

## Audit Logging

When execution occurs, a new audit event is created:

```json
{
  "event": "executed",
  "approvalId": "approval-1",
  "kind": "scheduler-run-model-router-dry-run",
  "status": "ok|error",
  "executedAt": "ISO-8601-timestamp",
  "duration_ms": 1234,
  "output": {
    "path": "relative/path/to/output.json",
    "size": 12345,
    "lines": 42
  },
  "error": null  // populated only if status: "error"
}
```

- Event is persisted to `BRAIN_CORE_APPROVAL_AUDIT_PATH`
- Timestamp is ISO-8601 UTC
- Output path is relative to brain repo root

## Current Phase

**Phase 0: Design Only**

- Execution is disabled by default
- Feature flag is designed but not implemented
- Approval store/audit is verified operational
- No code changes yet
- No CLI flag yet
- No operator training yet

## Future Phases

### Phase 1: Feature Flag Implementation

- Implement `BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION` env flag
- Add guards in execution path
- Add unit tests for flag-gated execution
- Update Brain Console to show flag state

### Phase 2: Execution Guard Tests

- Test all 9 execution conditions
- Test localhost-only enforcement
- Test approval state transitions
- Test rollback scenario

### Phase 3: Operator Training

- Document flag in runbooks
- Create rollback drill procedure
- Train operators on flag usage
- Prepare incident response playbook

### Phase 4: Production Ready

- All tests passing
- Rollback drill verified
- Operator training complete
- Approval from stakeholders

## Design Decisions

**Why `scheduler-run-model-router-dry-run` first?**
- Report-only, no side effects
- Safe to test execution gates
- Provides useful operational data
- No Mind writes
- Can be rolled back instantly

**Why `BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION` env flag?**
- Simple to toggle on/off
- No database or config file needed
- Clear intent
- Can be tested before production

**Why all 9 conditions?**
- Prevents accidental execution
- Defense in depth
- Operator audit trail
- Mind protection (condition 7)

**Why rollback plan required?**
- Operators need confidence
- Fast recovery if needed
- Reduces risk of widespread changes
- Demonstrates thoughtfulness

## Acceptance Criteria

Before implementation can proceed:

- [ ] Explicit user approval of this design
- [ ] Rollback drill procedure written and tested
- [ ] Brain Console updated to display flag state
- [ ] ProBot status includes execution flag state
- [ ] All 48 unit tests still pass
- [ ] New feature flag tests added and passing
- [ ] Operator runbook updated
- [ ] Incident response playbook prepared

## References

- Approval gate verification: `operations/reports/brain-core-approval-gate-live-verification-2026-05-18.md`
- Brain Core README: `projects/brain-core/README.md`
- Brain Core approval gates runbook: `operations/runbooks/brain-core-approval-gates.md`

---

**Status:** Design only, awaiting approval
**Author:** Brain Core Design
**Date:** 2026-05-18
**Execution:** Disabled (by design)
