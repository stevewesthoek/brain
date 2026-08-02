# BS0.18 — Typed capability workers

**Date:** 2026-07-16  
**Status:** complete  
**Repository:** Brain only  
**Commit/push:** not performed

## Canonical requirements

BS0.18 requires one report-only pilot worker with typed capability identity, inputs, outputs, receipts, failures, timeout, bounded retries, deterministic idempotency, kill-switch state, privilege/read/write scope, owner/contract references, and distinct repository/deployed/observed/verified state.

Canonical prerequisites are complete through BS0.17. Existing authority remains:

- capability-state model owns lifecycle evidence fields;
- typed scheduler manifests describe scheduling but do not own worker policy;
- Brain Core owns the worker core and validation;
- BS0.17 exact-scope approval remains the approval boundary;
- no second scheduler, approval authority, or execution framework was created.

## Pilot boundary

Pilot capability: `capability-state-report`.

The pilot is a pure Brain Core fixture worker that accepts one typed capability-state snapshot and produces a deterministic report receipt. It does not read production files, Mind, credentials, networks, or external services. It is not scheduled or exposed through API/CLI in this task; any future adapter must call the same core module.

Fixed authority:

- owner: `brain-runtime`;
- contract: `capability-state-contract`;
- privilege: `local-read-only`;
- read scope: `fixture-capability-state`;
- write scope: `none`;
- mode: `report-only`;
- kill switch: `BS0.18_TYPED_CAPABILITY_WORKERS`.

## Worker contract

The shared core implementation provides:

- typed capability, owner, and contract identities;
- validated typed input and deterministic output;
- receipt version `1.0.0`;
- repository, deployed, observed, and verified state fields;
- timeout threshold of 250 ms;
- two bounded retries and three maximum attempts;
- deterministic request hashing and idempotent replay receipts;
- explicit `succeeded`, `failed`, `blocked`, and `idempotent-replay` states;
- explicit kill-switch state in every receipt;
- fixed privilege, read scope, write scope, and report-only mode;
- `writesToMind: false` and `externalWrites: false` invariants.

## Failure and retry model

- identical idempotency retries return `idempotent-replay` without duplicate work;
- changed content under the same idempotency key fails with `idempotency_conflict`;
- retryable fixture failures can succeed within the three-attempt bound;
- retry exhaustion returns a typed failure receipt;
- simulated duration above 250 ms returns a typed timeout receipt;
- disabled kill switch returns a typed blocked receipt;
- invalid identity, owner, contract, privilege, scope, state, model authority, or mutation request fails closed before execution.

## Files examined

- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `operations/specs/capability-state.schema.json`
- `operations/specs/capability-state.json`
- `operations/specs/typed-scheduler-jobs.json`
- `tools/validate-capability-state.mjs`
- `tools/validate-typed-scheduler-jobs.mjs`
- BS0.17 exact-scope approval implementation and evidence
- `operations/specs/mcp-provider-admissions.json`
- `operations/system-configs/mcp/MCP-PROVIDER-ADMISSION-STANDARD.md`
- `operations/reports/workbench-mcp-provider-admission-decision-2026-07-16.md`

## Files changed

- `projects/brain-core/src/adapters/infinite-brain-typed-capability-worker.ts`
- `projects/brain-core/src/tests/infinite-brain-typed-capability-worker.test.ts`
- `operations/reports/bs0-18-typed-capability-workers-2026-07-16.md`
- `operations/specs/mcp-provider-admissions.json`
- `operations/reports/workbench-mcp-provider-admission-decision-2026-07-16.md`
- canonical implementation plan, roadmap, and status runbook

Historical blocker evidence is retained at:

- `operations/reports/workbench-mcp-provider-approval-contract-blocker-2026-07-16.md`

It is superseded by the explicit admission decision.

## Fixture results

Focused suite: 14 passed, 0 failed.

Positive coverage:

- bounded report-only pilot definition;
- valid typed input;
- deterministic output and receipt;
- idempotent retry without duplicate execution;
- bounded retry success;
- explicit kill-switch reporting;
- retry-exhaustion failure receipt;
- timeout receipt.

Negative coverage:

- unknown capability;
- invalid input;
- privilege or scope expansion;
- missing owner or contract;
- model-supplied authority;
- unsupported write or external-mutation request;
- changed request under a reused idempotency key.

One bounded repair corrected a test-only TypeScript cast. Worker behavior was unchanged.

## Provider-admission decision

The guarded commit confirmation contract was explicitly reviewed and approved. Brain now admits Workbench revision:

```text
8b8d896c807075eece1d596cfadbe23486b9e444
```

Approved `packages/shared/src/workbench-command-contract.ts` SHA-256:

```text
83403828101e5a1a16b6b92d600eb090a87976da98d43cf3a938726c439c0e1b
```

The decision confirms:

- Brain's admitted tools and suboperations are unchanged;
- `git_commit` remains outside Brain's admitted surface;
- two-phase `n8n_workflow_migration` approval remains unchanged;
- no authentication, lease, rollback, audit, receipt, or mutation authority relevant to Brain was broadened;
- later changes after the approved contract revision were telemetry-only and changed no pinned provider artifact;
- generated registration metadata did not require regeneration.

## Validation evidence

- Provider-admission validator: pass, one provider verified.
- Provider-admission focused tests: 2/2 pass.
- Focused typed-worker tests: 14/14 pass.
- Brain Core TypeScript check: pass.
- Capability-state validator: pass, 17 capabilities, schema `1.0.0`, evidence chain bound.
- Typed scheduler validator: pass, 17 jobs.
- Infinite Brain conformance: pass, 6 layers and 11 commands.
- Relevant JSON and schema parsing: pass.
- Changed Markdown links and repository-relative paths: pass.
- Changed-path security scans: no findings.
- `git diff --check`: pass.
- Scoped diff inspection: intended BS0.18 and provider-admission paths only.
- Known unrelated warning retained: Mind `MS0.9` plan/evidence drift.

## Unrelated-worktree proof

Workbench writes used exact paths. Existing unrelated Brain dirty paths were preserved. Mind and Workbench Private were not modified.

## Safety evidence

No Mind write, external write, n8n call, webhook, credential access, deployment, restart, grant, schedule, activation, B1.0a, B1.1, BS0.19, commit, or push occurred.

## Remaining blockers

None for BS0.18. BS0.10 remains blocked by Mind M1.4. B1.0a remains separately incomplete and authorization-gated.

## Exact next task

`BS0.19 — Implement the cross-repository deletion-readiness gate`

## Final verdict

`BS0_18_COMPLETE_NEXT_BS0_19`
