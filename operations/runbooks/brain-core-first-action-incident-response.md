# Brain Core First Action Incident Response

## Scope

This playbook covers the first future Brain Core execution candidate:

```text
scheduler-run-model-router-dry-run
```

Current state:

- Feature-flag scaffold exists.
- Execution remains disabled.
- No Brain Core execution path exists yet.
- Model-router remains report-only and must not write to Mind.

## Safety invariants

During any incident or suspected misconfiguration:

1. Do not mutate Mind.
2. Do not delete approval store or audit logs.
3. Do not run broad scheduler jobs.
4. Do not run arbitrary shell commands through Brain Core.
5. Do not stage or commit runtime outputs.
6. Keep all generated runtime reports under Brain `runtime/local/`.

## Immediate containment

If execution appears unexpectedly enabled, or an operator is unsure:

```bash
unset BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION
# or explicitly set:
export BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION=false
```

Then stop and restart Brain Core using the normal local service procedure.

Verify containment:

```bash
curl -fsS http://127.0.0.1:4877/execution/readiness
curl -fsS http://127.0.0.1:4877/capabilities
```

Expected safety values:

```text
executionEnabled=false
modelRouterDryRunExecutionFlagEnabled=false
executableActions=false
readyCandidateCount=0
```

## Triage checklist

Collect read-only evidence only:

```bash
curl -fsS http://127.0.0.1:4877/status
curl -fsS http://127.0.0.1:4877/execution/readiness
curl -fsS http://127.0.0.1:4877/execution/plans/scheduler-run-model-router-dry-run
curl -fsS http://127.0.0.1:4877/approvals
curl -fsS http://127.0.0.1:4877/approvals/store
curl -fsS http://127.0.0.1:4877/approvals/audit
curl -fsS http://127.0.0.1:4877/runtime/reports
```

Record:

- timestamp
- Brain Core version
- flag state
- execution readiness blockers
- approval store status
- audit status
- latest model-router report path, if any

## Classification

### Severity 0 — display-only mismatch

Examples:

- Brain Console shows stale flag state.
- ProBot status text differs from `/execution/readiness`.

Response:

1. Refresh Brain Console manually.
2. Restart ProBot if needed.
3. Treat `/execution/readiness` as source of truth.
4. File a bug if display remains inconsistent.

### Severity 1 — unsafe configuration attempted

Examples:

- flag accidentally set to `true`
- approval store path points to unsafe location
- audit path unavailable or invalid

Response:

1. Disable the flag.
2. Correct runtime paths to Brain `runtime/local/`.
3. Verify endpoints return disabled execution.
4. Preserve all audit evidence.

### Severity 2 — unexpected execution claim

Examples:

- any response says `executed=true`
- any response says `wouldExecute=true`
- any response says `executableActions=true`
- any output appears outside Brain `runtime/local/`

Response:

1. Disable the flag immediately.
2. Stop Brain Core.
3. Preserve approval store, audit JSONL, runtime reports, and terminal logs.
4. Do not delete files until evidence is copied or summarized.
5. Inspect changed files and runtime paths.
6. Verify Mind git status before and after; there should be no model-router writes.
7. Open a remediation task before restarting with the flag enabled.

## Recovery

After containment:

```bash
git status --short
npm run --prefix projects/brain-core ci
npm run --prefix projects/model-router ci
```

If runtime reports need cleanup, remove only generated Brain runtime report files after evidence is preserved and only when the operator explicitly approves cleanup.

Allowed cleanup target for this first action only:

```text
runtime/local/model-router/
```

Never cleanup:

```text
runtime/local/brain-core/*approval*
```

Those files are audit evidence.

## Post-incident review

Document:

- what happened
- exact flag value
- endpoints queried
- approval IDs involved
- whether any response claimed execution
- whether any Mind files changed
- validation commands run
- corrective action

Update these docs if the incident reveals a missing guard:

```text
operations/runbooks/brain-core-approval-gates.md
operations/specs/brain-core-first-action-feature-flag.md
operations/runbooks/brain-core-first-action-incident-response.md
```

## Resume criteria

Do not resume any execution-path work until:

- Brain Core CI passes
- model-router CI passes
- `/execution/readiness` reports `executionEnabled=false`
- `/capabilities` reports `executableActionsEnabled=false`
- Mind git status is reviewed
- operator confirms the next action is safe
