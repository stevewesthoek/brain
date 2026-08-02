# Workbench MCP Provider Approval-Contract Blocker

**Date:** 2026-07-16  
**Scope:** Brain provider-admission review; Workbench Private read-only  
**Previous admitted revision:** `4f8217059f6f3a681f150ca4145b8a5793f11616`  
**Observed committed revision:** `cfc1cd2a0c94e76dd99db091b720263a4359cf08`

## Repository evidence

Workbench Private was inspected read-only on branch `main`.

Committed changes after the admitted revision:

```text
e740f09 feat: add phase 11 telemetry contract
cfc1cd2 fix(workbench): forward guarded commit confirmation
```

The relevant committed change modifies:

- `packages/shared/src/workbench-command-contract.ts`
- `scripts/verify-run-command-contract.ts`

The contract now accepts `confirmedByUser` and `confirmationToken` for guarded `git_commit` requests. This is a provider approval-contract behavior change.

## Brain-admitted surface review

Brain currently admits only:

- `getWorkbenchStatus` — read, no approval;
- `readWorkbenchContext` — read, no approval;
- `runWorkbenchCommand` — external mutation, only `n8n_workflow_migration`, two-phase approval.

The committed change does not add a Brain-admitted tool or suboperation. It does not alter the `n8n_workflow_migration` prepare/execute/status schema observed in the shared contract, and it does not broaden Brain's nested suboperation allowlist.

However, `packages/shared/src/workbench-command-contract.ts` is itself a pinned provider artifact. Brain's canonical validator reports:

```text
workbench-for-brain: provider revision mismatch
workbench-for-brain: provider artifact digest mismatch packages/shared/src/workbench-command-contract.ts
```

Therefore the provider no longer matches the admitted immutable artifact set.

## Authority determination

- **Brain-admitted tool scope changed:** no.
- **Brain-admitted suboperation scope changed:** no.
- **Two-phase `n8n_workflow_migration` approval changed:** no evidence of change.
- **Authentication, lease, rollback, audit, or receipt authority relevant to Brain changed:** no evidence of change in the inspected committed delta.
- **Global provider approval behavior changed:** yes, guarded `git_commit` confirmation forwarding changed.
- **Pinned artifact digest changed:** yes.
- **Mutation scope broadened for Brain:** no.
- **Automatic revision repin permitted:** no.

Because the change modifies a pinned approval contract, Brain's admission standard requires a deliberate replacement decision rather than a revision-only repin. The current review is insufficient to approve that replacement automatically.

## Worktree observation

Workbench Private also contained unrelated dirty paths, including telemetry and local configuration files. They were not modified. Content inspection was limited to the committed approval-contract change and admitted MCP artifacts required for this review.

## Non-events

No Brain provider revision or digest was changed. No generated registration metadata was changed. No credential or private runtime material was read. No Mind or Workbench file was modified. No n8n, webhook, fixture, deployment, restart, grant, schedule, activation, external write, commit, or push occurred.

## Required next decision

A separate explicit provider-admission decision must review and approve or reject the new `workbench-command-contract.ts` digest and the guarded commit confirmation behavior before Brain may repin Workbench to `cfc1cd2a0c94e76dd99db091b720263a4359cf08` or any later revision.

## Verdict

```text
PROVIDER_ADMISSION_BLOCKED_APPROVAL_CONTRACT_CHANGE_REQUIRES_EXPLICIT_DECISION
```
