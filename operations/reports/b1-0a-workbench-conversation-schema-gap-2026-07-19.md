# B1.0a — Workbench Conversation Schema Gap

**Date:** 2026-07-19  
**Task:** B1.0a — Deploy and verify Save-to-Mind target paths  
**Status:** incomplete; no live mutation occurred

## Current continuation rule, 2026-07-21

Authenticated Workbench action status is sufficient for the B1.0a runtime
health gate when all of the following are true:

- `connected: true`;
- `runtime.service.gitCommit` exactly matches the required live revision for
  the attempt;
- `runtime.service.packageVersion` is `1.3.1-beta`;
- `runtime.service.role` is `web`;
- `runtime.health.health` is `healthy` or `degraded`;
- `runtime.health.overloadedMetrics` is empty;
- `runtime.health.degradedMetrics`, if present, contains warnings only and is
  recorded as observed provenance rather than treated as a blocker.

The authenticated Workbench action projection is not required to explicitly
return `allHealthy=true`, `agent=healthy`, `relay=healthy`, or `web=healthy`.
If those fields are absent, record them as absent from the action projection;
do not infer they are unhealthy and do not stop solely because they are absent.

B1.0a still must stop before mutation if the live revision differs from the
required revision, if overloaded metrics are present, if Workbench is
disconnected, if the guarded migration schema is unavailable, if provider
validation or Infinite Brain conformance fails, if prepare lacks a fresh
`operation.operationId` and confirmation token, or if any guarded precondition
readback fails.

Current fixed live revision for the next Workbench-conversation retry:

```text
f548be12fe7c36ab72c7dec773575846f3f36bb7
```

Use this corrected resume prompt in the Workbench conversation:

```text
Resume Brain B1.0a from the authenticated Workbench action status already
observed in this conversation.

Do not require explicit allHealthy=true, agent=healthy, relay=healthy, or
web=healthy fields when the authenticated Workbench action does not project
those fields. Treat those fields as absent, not unhealthy.

The runtime health gate passes if:
- connected=true;
- runtime.service.gitCommit exactly equals f548be12fe7c36ab72c7dec773575846f3f36bb7;
- runtime.service.packageVersion is 1.3.1-beta;
- runtime.service.role is web;
- runtime.health.health is healthy or degraded;
- runtime.health.overloadedMetrics is empty;
- runtime.health.degradedMetrics, if present, is recorded as degraded-only SLO
  warning provenance and is not a blocker while overloadedMetrics is empty.

Record the missing allHealthy/agent/relay/web fields as projection omissions.
Do not stop solely because they are absent.
Record degraded metrics such as actionLatencyP95Ms,
memorySlopeBytesPerMinute, and telemetryStoreBytes as observed warnings; do
not stop solely because they are present when overloadedMetrics is empty.

Then continue with the provider-delta review and Brain provider admission for
revision f548be12fe7c36ab72c7dec773575846f3f36bb7, both required Brain-local
validations, and at most one fresh guarded B1.0a prepare through
runWorkbenchCommand.n8n_workflow_migration. Require a fresh confirmationToken
and canonical operation.operationId. Require operation.operationId !=
activity.operationId. Continue through the guarded precondition-readback
sequence only as already authorized. Do not retry ambiguous outcomes. Do not
bypass any mutation or rollback gate. Preserve Brain's dirty worktree. Do not
modify Workbench or Mind. Do not commit or push.
```

## Provider and runtime readiness

Brain admits Workbench revision:

`7782cc0fff64976664296cfc78d102ca0227d2a0`

The restarted Workbench runtime reported the same Git revision and build timestamp `2026-07-19T16:36:53Z`. Brain provider-admission validation and Infinite Brain conformance both passed before the retry.

The admitted surface remains exactly:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand.n8n_workflow_migration` with two-phase approval.

## Fresh prepare attempt

The historical failed operation `cap-op-0cd499585a1046ec20385e0677aaa0ab` was not reused.

A fresh prepare request was constructed with the reviewed values:

- source: `brain`;
- command: `n8n_workflow_migration`;
- phase: `prepare`;
- mode: `apply`;
- workflow ID: `FwP5INe9qoo1OwGC`;
- candidate path: `operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json`;
- rollback path: `operations/reports/artifacts/b1-0a-live-workflow-rollback.json`;
- manifest path: `operations/automations/n8n/save-to-mind-controlled-topology-migration-v1.json`;
- network access: required.

The call was rejected by this ChatGPT Workbench action projection before reaching Workbench:

```text
UnrecognizedKwargsError: migration
```

## Boundary determination

The live Workbench MCP runtime and Codex projection expose the nested migration request contract, but the Workbench action imported into this ChatGPT conversation does not currently accept the `migration` object. This is a conversation/tool-projection mismatch, not a provider-admission or runtime-provenance failure.

No prepare operation was created. No confirmation token was issued. No execute, precondition readback, candidate mutation, fixture invocation, or rollback occurred.

## Continuation preflight, 2026-07-19

The later continuation request locked Workbench source `brain` through the live MCP server. Runtime provenance again reported Workbench package version `1.3.1-beta`, Git revision `7782cc0fff64976664296cfc78d102ca0227d2a0`, and build timestamp `2026-07-19T16:36:53Z`. Active-run state was `null`.

The exposed Workbench tool surface in the Codex session contained:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand`.

The exposed `runWorkbenchCommand` schema included `commandKind: "n8n_workflow_migration"` and migration phases `prepare`, `execute`, and `status`. Non-migration command kinds were rejected by admission, so repository preflight commands remained local read-only checks while Workbench remained the sole live migration authority.

Before prepare, the mandatory Brain-side validation gate failed:

```text
node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/Users/Office/Repos/prochattools/saas/workbench-private
-> workbench-for-brain: provider revision mismatch

node tools/scripts/validate-infinite-brain-conformance.mjs
-> conformance=fail
-> error=mcp:workbench-for-brain: provider revision mismatch
-> error=command:node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/Users/Office/Repos/prochattools/saas/workbench-private
```

The mismatch was between Brain's admitted provider revision `7782cc0fff64976664296cfc78d102ca0227d2a0` and the local Workbench Private checkout revision `9fbba6d02f5ba7de1cf3a9239b69a5cdb2c3b90f`. The live Workbench runtime still reported the admitted revision, but the validation command was explicitly required against the local provider root and therefore failed closed.

Other preflight evidence:

- fixture adapter tests passed: `node --test tools/n8n-save-to-mind-fixture-adapter.test.mjs`;
- JSON parsing passed for candidate, manifest, rollback artifact, and fixture contract;
- `git diff --check` passed;
- candidate hash matched `194ff9b6799709e3c7f649e9fcf875dcb067229973b42560fd1ad3a3060f82e1`;
- manifest hash matched `60a07682ea5b30e1e04e991010ecf041c75cfd48116c6389e2285d480d54fc96`;
- rollback hash matched `703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd`;
- fixture contract hash matched `0df0528635e923fa6eb9ff80da9c85a8403b8142fcd41b2b3ff2f745e6bbc75c`;
- fixture Markdown hash matched `474fb38fdd6800eaf10a276011389ce0e76acb95c2eefb1e49e9f9a0dfd01465`.

Because the required validation gate failed, no fresh prepare call was made. No operation ID or confirmation token was created. No execute, status poll, precondition readback, candidate mutation, fixture invocation, live readback, downstream verification, rollback-readiness proof, or rollback execution occurred.

Continuation verdict:

`B1_0A_BLOCKED_BEFORE_PREPARE_PROVIDER_REVISION_MISMATCH`

## Narrow provider repin and runtime stop, 2026-07-19

Brain reconciled the narrow provider delta from Workbench revision `7782cc0fff64976664296cfc78d102ca0227d2a0` to `9fbba6d02f5ba7de1cf3a9239b69a5cdb2c3b90f`.

Read-only delta review showed the changed provider files were limited to:

- migration prepare-response transport tests;
- MCP client and protocol tests;
- CLI adapter verification;
- MRP handoff and planning documentation.

All 24 artifacts already listed in `operations/specs/mcp-provider-admissions.json` had unchanged SHA-256 digests at Workbench Private HEAD `9fbba6d02f5ba7de1cf3a9239b69a5cdb2c3b90f`. Brain updated only the admitted provider revision and a dated evidence note. No artifact digest was changed and no artifact was added.

Validation after the narrow repin:

```text
node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/Users/Office/Repos/prochattools/saas/workbench-private
-> mcp-provider-admissions-valid admissions=1 providers_verified=1

node tools/scripts/validate-infinite-brain-conformance.mjs
-> conformance=pass
-> brain_tasks=67
-> warning=mind-task-status-drift:MS0.9:plan=pending:evidence=blocked

git diff --check
-> pass
```

B1.0a preflight then stopped before prepare because the live Workbench runtime still reported Git revision `7782cc0fff64976664296cfc78d102ca0227d2a0`, not the newly admitted revision `9fbba6d02f5ba7de1cf3a9239b69a5cdb2c3b90f`. Active-run state was `null`.

Additional preflight evidence before stop:

- fixture adapter tests passed;
- JSON parsing passed for candidate, manifest, rollback artifact, and fixture contract;
- all five canonical hashes matched expected values;
- `git diff --check` still passed.

Because the runtime revision did not match the admitted revision, no fresh prepare call was made. No operation ID or confirmation token was created. No execute, migration status query, precondition readback, candidate mutation, fixture invocation, live readback, rollback-readiness proof, or rollback execution occurred.

Runtime-stop verdict:

`B1_0A_BLOCKED_BEFORE_PREPARE_WORKBENCH_RUNTIME_REVISION_STALE`

## Verdict

`B1_0A_INCOMPLETE_CHATGPT_WORKBENCH_ACTION_SCHEMA_REJECTS_MIGRATION_OBJECT`




## 2026-07-20 stabilized-runtime retry

Brain provider admission was reconciled to the exact stabilized Workbench runtime revision:

`a476e90616918f8bc9dd1045ca0f90217dcd2b75`

Validation passed:

- provider admission: `mcp-provider-admissions-valid admissions=1 providers_verified=1`;
- Infinite Brain conformance: pass, with the existing `MS0.9` warning only;
- live Workbench runtime provenance: revision `a476e90616918f8bc9dd1045ca0f90217dcd2b75`, package `1.3.1-beta`, build timestamp `2026-07-20T13:21:49Z`.

A fresh B1.0a prepare request was constructed with the canonical workflow ID and reviewed candidate, rollback, and manifest paths. The request did not reach Workbench because the ChatGPT-imported `runWorkbenchCommand` action rejected the nested migration request locally:

```text
UnrecognizedKwargsError: migration
```

No operation ID or confirmation token was created. No execute, precondition readback, candidate mutation, fixture invocation, or rollback occurred.

Current verdict:

`B1_0A_INCOMPLETE_CHATGPT_ACTION_PROJECTION_STILL_REJECTS_MIGRATION_OBJECT`

## 2026-07-20 Codex MCP projection retry

The Codex session exposed the required Workbench MCP tools:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand`.

The `runWorkbenchCommand` schema exposed `commandKind:
"n8n_workflow_migration"` and a nested `migration` object with `phase:
"prepare" | "execute" | "status"`, `mode: "apply" | "rollback"`,
`workflowId`, `candidatePath`, `rollbackPath`, `manifestPath`,
`networkAccess`, `operationId`, and `confirmationToken`.

Provider reconciliation:

- Brain's provider admission was already pinned to Workbench revision
  `a476e90616918f8bc9dd1045ca0f90217dcd2b75`;
- Workbench Private HEAD was
  `a476e90616918f8bc9dd1045ca0f90217dcd2b75`;
- the admitted-artifact delta from the admitted revision to HEAD was empty;
- no artifact digest changed;
- no artifact was added;
- no authority, command scope, confirmation behavior, rollback authority,
  executor, or production migration capability was broadened.

Validation passed:

```text
node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/Users/Office/Repos/prochattools/saas/workbench-private
-> mcp-provider-admissions-valid admissions=1 providers_verified=1

node tools/scripts/validate-infinite-brain-conformance.mjs
-> conformance=pass
-> layers=6
-> commands=11
-> brain_tasks=67
-> warning=mind-task-status-drift:MS0.9:plan=pending:evidence=blocked

node --test tools/n8n-save-to-mind-fixture-adapter.test.mjs
-> pass 6

JSON parsing for candidate, manifest, rollback artifact, and fixture contract
-> pass

git diff --check
-> pass
```

Canonical hash recomputation matched all expected values:

```text
194ff9b6799709e3c7f649e9fcf875dcb067229973b42560fd1ad3a3060f82e1  operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json
60a07682ea5b30e1e04e991010ecf041c75cfd48116c6389e2285d480d54fc96  operations/automations/n8n/save-to-mind-controlled-topology-migration-v1.json
703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd  operations/reports/artifacts/b1-0a-live-workflow-rollback.json
0df0528635e923fa6eb9ff80da9c85a8403b8142fcd41b2b3ff2f745e6bbc75c  docs/contracts/save-to-mind-fixture-adapter-v1.json
474fb38fdd6800eaf10a276011389ce0e76acb95c2eefb1e49e9f9a0dfd01465  docs/contracts/save-to-mind-fixture-adapter-v1.md
```

The live Workbench runtime did not report the exact required metadata:

```text
expected revision:        a476e90616918f8bc9dd1045ca0f90217dcd2b75
actual revision:          a476e90616918f8bc9dd1045ca0f90217dcd2b75
expected package version: 1.3.1-beta
actual package version:   1.3.1-beta
expected build timestamp: 2026-07-20T12:52:19Z
actual build timestamp:   2026-07-20T13:21:49Z
expected health:          web healthy, agent healthy, relay healthy, allHealthy true
actual health:            web role reported overloaded; agent, relay, and allHealthy were not present in the MCP status response
```

Active-run readback for source `brain` returned `null`.

Because the required live runtime metadata did not match exactly, no fresh
prepare call was made. No operation ID or confirmation token was created. No
execute, migration status query, precondition readback, candidate mutation,
fixture invocation, live readback, rollback-readiness proof, or rollback
execution occurred.

Current verdict:

`B1_0A_BLOCKED_BEFORE_PREPARE_WORKBENCH_RUNTIME_METADATA_MISMATCH`

## 2026-07-20 corrected-runtime-gate prepare stop

The corrected runtime gate requires the exact Workbench Git revision as provider
identity, and records package version, build timestamp, and returned health
fields as observed provenance. A different build timestamp at the same exact
Git revision is not provider drift, and absent `agent`, `relay`, or
`allHealthy` fields are not inferred unhealthy.

Brain-side gates passed:

```text
node tools/validate-mcp-provider-admissions.mjs
-> mcp-provider-admissions-valid admissions=1 providers_verified=0

npm run infinite-brain:conformance
-> conformance=pass
-> layers=6
-> commands=11
-> brain_tasks=67
-> mind_tasks=36
-> warnings=1
-> warning=mind-task-status-drift:MS0.9:plan=pending:evidence=blocked
```

Canonical hash recomputation matched the required inputs:

```text
194ff9b6799709e3c7f649e9fcf875dcb067229973b42560fd1ad3a3060f82e1  operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json
60a07682ea5b30e1e04e991010ecf041c75cfd48116c6389e2285d480d54fc96  operations/automations/n8n/save-to-mind-controlled-topology-migration-v1.json
703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd  operations/reports/artifacts/b1-0a-live-workflow-rollback.json
```

`git diff --check` passed before prepare.

Workbench MCP status was connected and source `brain` was active. The admitted
and live Workbench revision matched exactly:

```text
admitted revision:       a476e90616918f8bc9dd1045ca0f90217dcd2b75
live revision:           a476e90616918f8bc9dd1045ca0f90217dcd2b75
package version:         1.3.1-beta
build timestamp:         2026-07-20T13:21:49Z
process started at:      2026-07-20T13:22:20.496Z
web build ID:            yBt7Te8BnOpsM0PGuH3iw
health.health:           overloaded
health.evaluatedAt:      2026-07-20T13:56:47.813Z
health.degradedMetrics:  telemetryStoreBytes
health.overloadedMetrics: actionLatencyP95Ms, actionLatencyP99Ms
health.unknownMetrics:   queueWaitMs, gitLockWaitMs, eventLoopDelayMs, diskBudgetBytes
```

`getWorkbenchStatus`, `readWorkbenchContext`, and `runWorkbenchCommand` were
callable. `readWorkbenchContext` active-run readback returned `activeRun: null`.
The exposed `runWorkbenchCommand` schema included
`commandKind: "n8n_workflow_migration"` and migration phases `prepare`,
`execute`, and `status`.

A fresh prepare call was made with:

```text
sourceId: brain
commandKind: n8n_workflow_migration
phase: prepare
mode: apply
workflowId: FwP5INe9qoo1OwGC
candidatePath: operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json
rollbackPath: operations/reports/artifacts/b1-0a-live-workflow-rollback.json
manifestPath: operations/automations/n8n/save-to-mind-controlled-topology-migration-v1.json
networkAccess: true
```

Workbench returned this bounded response shape:

```json
{
  "ok": false,
  "status": "needs_confirmation",
  "sourceId": "brain",
  "commandKind": "n8n_workflow_migration",
  "stderr": "",
  "exitCode": null,
  "signal": null,
  "confirmationToken": "present",
  "terminationReason": null,
  "activity": {
    "version": "1.2.13-beta",
    "operationId": "runWorkbenchCommand",
    "phase": "waiting_for_confirmation",
    "actionLabel": "Ran safe validation command",
    "userMessage": "Workbench ran n8n_workflow_migration in brain and finished with needs_confirmation.",
    "sourceId": "brain",
    "riskLevel": "medium",
    "requiresConfirmation": true,
    "verified": false,
    "nextStep": "Request explicit confirmation, then submit only the returned operation ID and confirmation token."
  }
}
```

The top-level status was `needs_confirmation`, and a confirmation token was
present. The response did not include `operation.operationId`. The only returned
operation-looking value was `activity.operationId: "runWorkbenchCommand"`, which
is the tool activity identifier, not the required fresh migration operation ID.

Because the required `operation.operationId` was missing, the run stopped before
execute. No confirmation was submitted. No precondition readback, candidate
mutation, status poll, fixture invocation, live readback, rollback-readiness
proof, or rollback execution occurred.

Current verdict:

`B1_0A_INCOMPLETE_PREPARE_MISSING_OPERATION_OPERATION_ID`
