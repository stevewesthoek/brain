# B1.0 — Align Repository Save-to-Mind Path Configuration

**Date:** 2026-07-10  
**Task:** `B1.0 — Align repository Save-to-Mind path configuration`  
**Verdict:** **COMPLETE**

## Scope

Edits were limited to the Brain repository. Mind was inspected read-only and remained unchanged.

B1.0 changed repository-owned workflow configuration only. It did not deploy or update the live n8n workflow, activate schedules, invoke webhooks, access credentials, perform external writes, execute downstream scheduler scripts, modify Mind, start B1.1, commit, or push.

## Files inspected

### Brain

- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `operations/runbooks/infinite-brain-roadmap-status.md`
- `projects/brain-core/src/mind-paths.ts`
- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
- `operations/runbooks/n8n-mind-inbox.md`

### Mind — read-only

- `system/reports/m1-2-folder-bridge-contracts-2026-07-10.md`
- `system/folder-contract.md`
- `system/brain-mind-bridge.md`

No credential file, `.env` file, secret store, or credential value was read.

## Files changed

- `operations/specs/infinite-brain-runtime-implementation-plan.md`
  - added B1.0 immediately before B1.1 and marked it complete with this report;
  - recorded its scope, validation, stop conditions, and no-deployment boundary;
  - added pending explicit-approval task B1.0a for live deployment and verification before B1.1.
- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
  - changed `MIND_INBOX_PATH` repository defaults from `capture/inbox` to `inbox/new`;
  - changed `MIND_FAILED_PATH` repository defaults from `capture/failed` to `inbox/failed`;
  - aligned both the top-level workflow definition and recorded active-version definition;
  - preserved environment-variable overrides;
  - added explicit failure detection and conditional failed-path routing to the recorded active-version definition.
- `operations/runbooks/n8n-mind-inbox.md`
  - documented canonical repository targets `inbox/new/` and `inbox/failed/`;
  - separated repository configuration from unverified live deployment state;
  - replaced live-action verification instructions with repository-only validation;
  - required a separate explicitly approved deployment and live-verification task.
- `operations/automations/n8n/validate-mind-inbox-paths.mjs`
  - added deterministic validation for JSON parsing, both workflow definitions, canonical defaults, retired-path absence, and the runbook live-state boundary.
- `operations/reports/b1-0-save-to-mind-path-configuration-2026-07-10.md`
  - created this evidence report.

## Unrelated dirty-file findings

Before B1.0 edits, Brain already contained unrelated changes in:

- `.graphifyignore`;
- `operations/system-configs/claude/**`;
- `operations/system-configs/codex/**`, including mutable logs, databases, application bundles, locks, and local configuration artifacts.

No allowed B1.0 file had an overlapping pre-existing change. Those unrelated files were not read for task content, modified, staged, committed, or reverted.

The Mind worktree already contained M1.1/M1.2 documentation changes and the pre-existing `wiki/log.md` change. Its final status matched the pre-edit baseline exactly.

## Exact commands and operations

### Worktree checks

```text
git status --short
```

Run separately in Brain and Mind before editing and again after validation.

### Bounded workflow routing extraction

```text
node -e <read-only JSON parser that printed only Build Processed Note routing, defaults, failure state, and node names>
```

Initial evidence:

```text
[nodes[3]]
const inboxPrefix = ($env.MIND_INBOX_PATH || 'capture/inbox') ...
const failedPrefix = ($env.MIND_FAILED_PATH || 'capture/failed') ...
[activeVersion.nodes[3]]
const file = `capture/inbox/${date}-${slug}.md`;
```

No credential or unrelated workflow value was printed.

### Focused repository validation

```bash
node operations/automations/n8n/validate-mind-inbox-paths.mjs
```

Output:

```text
workflow_json=valid
nodes.Build Processed Note=canonical_paths_verified
activeVersion.nodes.Build Processed Note=canonical_paths_verified
inbox/new=4
inbox/failed=4
capture/inbox=0
capture/failed=0
runbook=canonical_paths_and_live_boundary_verified
credential_values_read=false
external_actions_performed=false
result=pass
```

### Independent JSON validation

Workbench command kind:

```text
validate_json_files
```

Path:

```text
operations/automations/n8n/workflows/mind-inbox-fixed.json
```

Output:

```json
{
  "results": [
    {
      "path": "operations/automations/n8n/workflows/mind-inbox-fixed.json",
      "ok": true
    }
  ]
}
```

### Secret-material scan

Workbench command kind:

```text
security_scan_paths
```

Pattern set:

```text
forbidden_secret_material
```

Output:

```json
{
  "findings": []
}
```

### Non-blocking policy limitation

An attempted syntax-only dynamic compilation of embedded n8n code was rejected before execution:

```text
inline Node source rejected: dynamic code generation is not allowed
```

This did not block B1.0 because the required workflow JSON validation and deterministic path-contract validation both passed without executing workflow code.

## Verification results

1. **Workflow JSON validity:** passed.
2. **Every required path token extracted:** passed.
   - `inbox/new`: 4 repository workflow occurrences.
   - `inbox/failed`: 4 repository workflow occurrences.
   - `capture/inbox`: 0 repository workflow occurrences.
   - `capture/failed`: 0 repository workflow occurrences.
3. **Active defaults:** both repository workflow definitions default success to `inbox/new` and failure to `inbox/failed`.
4. **Environment overrides:** `MIND_INBOX_PATH` and `MIND_FAILED_PATH` remain supported in both definitions.
5. **Retired active defaults:** none remain in the workflow JSON or canonical runbook.
6. **Runbook boundary:** repository configuration and unverified live deployment state are explicitly separated.
7. **Focused deterministic test:** passed with exit code `0`.
8. **Credential safety:** no credential value was printed; secret scan returned no findings.
9. **External actions:** none occurred. No webhook, scheduler, deployment, live n8n, or external write command was run.
10. **Mind integrity:** final Mind worktree status matched its initial status; no Mind file changed.
11. **Unrelated Brain changes:** preserved without overlap.

## Unresolved blockers

Repository configuration is aligned, but live external routing is not verified. B1.0 does not prove that the deployed n8n workflow, environment overrides, downstream sync/classification consumers, or live failure behavior use the new targets.

A separate explicitly approved deployment and live-verification task is required before describing `inbox/new/` and `inbox/failed/` as verified active external routing.

## Verdict

**COMPLETE.** Every bounded B1.0 repository validation passed. B1.1 was not executed or marked complete.

## Exact next documented task

`B1.0a — Deploy and verify Save-to-Mind target paths` should run only with explicit approval for live n8n deployment and verification. It must verify live success routing to `inbox/new/`, live failed-processing routing to `inbox/failed/`, environment configuration, downstream consumer compatibility, rollback readiness, and absence of writes outside approved test fixtures. B1.1 remains blocked until that active routing verification is complete.
