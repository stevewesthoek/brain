# B1.0a — Deploy and Verify Save-to-Mind Target Paths

**Date:** 2026-07-10
**Task:** `B1.0a — Deploy and verify Save-to-Mind target paths`
**Verdict:** **BLOCKED — GUARDED LIVE UPDATE OPERATION UNAVAILABLE**

## Approval scope

The user explicitly approved a bounded live deployment and two fixture invocations for workflow `FwP5INe9qoo1OwGC`, subject to mandatory preconditions: exact deployment and rollback mechanisms, canonical active path configuration, downstream compatibility, no credential exposure, no unrelated writes, and no Mind changes except approved fixtures.

No live deployment, webhook invocation, schedule activation, credential access, external write, or Mind modification occurred because the mandatory downstream and rollback preconditions did not pass.

## Repository status before live-action review

### Brain

The Brain worktree contained the expected uncommitted B1.0 files:

- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `operations/automations/n8n/workflows/mind-inbox-fixed.json`
- `operations/runbooks/n8n-mind-inbox.md`
- `operations/automations/n8n/validate-mind-inbox-paths.mjs`
- `operations/reports/b1-0-save-to-mind-path-configuration-2026-07-10.md`

It also contained unrelated pre-existing changes under `.graphifyignore` and `operations/system-configs/**`. Those files were preserved and not used as task inputs.

### Mind — read-only

The Mind worktree contained the existing M1.1/M1.2 documentation changes and the pre-existing `wiki/log.md` change. No Mind file was modified.

## Files and resources inspected

### Brain

1. `operations/specs/infinite-brain-runtime-implementation-plan.md`
2. `operations/reports/b1-0-save-to-mind-path-configuration-2026-07-10.md`
3. `operations/automations/n8n/workflows/mind-inbox-fixed.json`
4. `operations/automations/n8n/validate-mind-inbox-paths.mjs`
5. `operations/runbooks/n8n-mind-inbox.md`
6. `operations/runbooks/infinite-brain-roadmap-status.md`
7. `projects/mind-steward/src/cli/classify-captures.ts`
8. `projects/mind-steward/src/classifier.ts`
9. `tools/scripts/mind-steward-classify-captures.sh`
10. `tools/scripts/mind-steward-sync-inbox.sh` — exact documented path checked; file does not exist.
11. `docs/system/1778967920555-codex-prompt-save-to-mind-failure-buffer-and-secret-cleanup-2026-05-16.md` — historical evidence only, used to identify the previously reported Public API deployment pattern and prior live workflow ID.

### Mind — read-only

7. `system/folder-contract.md`
8. `system/brain-mind-bridge.md`
9. `system/reports/m1-2-folder-bridge-contracts-2026-07-10.md`

No `.env` file, credential store, private key, token file, decrypted backup, browser session, or secret value was read.

## Repository validation

Exact command:

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

Repository configuration is ready for deployment, but B1.0a requires more than repository readiness.

## Live read-only export evidence

The confirmation-gated Workbench operation `n8n_workflow_export` successfully executed the fixed read-only command:

```text
executable=tools/n8n-api.sh
args=["get-workflow","FwP5INe9qoo1OwGC"]
shell=false
```

Validated result:

```text
artifactPath=operations/reports/artifacts/b1-0a-live-workflow-rollback.json
artifactSha256=703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd
workflowId=FwP5INe9qoo1OwGC
workflowVersion=0e932e2f-a884-4703-bc7e-b085abfefb8a
workflowUpdatedAt=2026-07-09T17:51:47.992Z
exitCode=0
durationMs=297
networkWriteRequested=false
protectedPathsChanged=[]
```

The operation returned only bounded metadata, surfaced no credential material, and performed no workflow mutation, deployment, activation, webhook invocation, schedule change, or network write.

## Active environment-path configuration findings

The repository workflow defaults are verified as:

```text
MIND_INBOX_PATH fallback -> inbox/new
MIND_FAILED_PATH fallback -> inbox/failed
```

Safe token extraction from the live rollback artifact found:

```text
inbox/new=4
inbox/failed=0
capture/inbox=0
capture/failed=0
MIND_INBOX_PATH=0
MIND_FAILED_PATH=0
```

The deployed workflow contains `inbox/new` routing but no failed-path target and no environment-variable path references. Therefore live success routing is partially evidenced, while live failed-processing routing to `inbox/failed` is not present in the exported workflow and remains unverified.

## Downstream compatibility findings

### Missing documented sync consumer

The canonical runbook names:

```text
tools/scripts/mind-steward-sync-inbox.sh
```

The exact file does not exist in the Brain repository.

### Classifier still uses the retired intake path

`projects/mind-steward/src/cli/classify-captures.ts` delegates to `classifyMindCaptureInbox`.

`projects/mind-steward/src/classifier.ts` currently contains:

B1.0b resolved the downstream intake blocker. The current classifier now uses:

```ts
const inboxDir = path.join(mindRoot, 'inbox/new');
```

Focused tests prove that only `inbox/new` is classified and retired `capture/inbox` content is ignored.

### Failed-path consumer

B1.0b added deterministic, sorted, read-only discovery for Markdown files under `inbox/failed`. Focused tests prove that discovery is limited to that path and does not mutate Mind.

## Rollback and planner findings

A real live rollback artifact now exists at:

```text
operations/reports/artifacts/b1-0a-live-workflow-rollback.json
SHA-256: 703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd
```

The bounded planner comparison was executed:

```bash
node tools/n8n-save-to-mind-plan.mjs deploy-plan \
  operations/reports/artifacts/b1-0a-live-workflow-rollback.json \
  operations/automations/n8n/workflows/mind-inbox-fixed.json
```

B1.0c changed only the top-level candidate workflow name:

```text
Mind Inbox — Capture & Classify with Signal Scoring
-> Save to Mind — Capture for Mind Steward
```

Validation after that one-field change passed:

```text
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
planner tests: 6 passed, 0 failed
candidate workflow JSON: valid
rollback artifact JSON: valid
```

The identical planner comparison was rerun and the workflow-name boundary passed. The next result was:

```text
FAIL: workflow sharing changed
```

Safe sharing comparison found:

```text
live.shared.count=1
candidate.shared.count=1
createdAt=same
projectId=same
role=same
updatedAt=same
workflowId=same
shared[0].project=different
```

No deployment, live query, webhook, schedule action, credential access, external write, Mind write, commit, or push occurred. The planner was not weakened or bypassed.

B1.0d then copied only the validated live `shared[0].project` object into the candidate. Post-write comparison returned:

```text
projectEqual=true
createdAtEqual=true
projectIdEqual=true
roleEqual=true
updatedAtEqual=true
workflowIdEqual=true
```

Focused validation after B1.0d passed:

```text
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
planner tests: 6 passed, 0 failed
candidate workflow JSON: valid
rollback artifact JSON: valid
focused secret scan: no findings
```

The identical deploy-plan comparison then advanced past name and sharing boundaries and stopped on:

```text
FAIL: workflow removed node resolve-inbox-path
```

Safe node identity comparison found:

```text
live-only node: resolve-inbox-path | Resolve Inbox Path | n8n-nodes-base.set
candidate-only nodes:
  build-gemini-body | Build Gemini Body | n8n-nodes-base.code
  gemini-classify | Gemini Classify | n8n-nodes-base.httpRequest
  build-processed-note | Build Processed Note | n8n-nodes-base.code
live-only processing nodes:
  prepare-capture | Prepare Capture | n8n-nodes-base.code
  build-inbox-note | Build Inbox Note | n8n-nodes-base.code
```

The planner was not weakened or bypassed. No node reconciliation or deployment was attempted.

## B1.0e topology outcome

**Selected outcome: B — controlled topology migration required.**

Safe structural comparison proves the candidate cannot be mapped onto the existing live node identities without semantic loss:

- Live processing graph: `Webhook -> Resolve Inbox Path -> Prepare Capture -> Build Inbox Note -> Check Existing GitHub File`.
- Candidate processing graph: `Webhook -> Build Gemini Body -> Gemini Classify -> Build Processed Note -> Check Existing GitHub File`.
- The candidate introduces an HTTP classification step (`gemini-classify`) that has no live-node identity equivalent.
- The live graph contains a Set node plus two Code nodes; the candidate graph contains two Code nodes plus one HTTP Request node.
- Differing node parameter shapes are not interchangeable:
  - live `resolve-inbox-path`: `jsonOutput`, `mode`, and `options`;
  - candidate `gemini-classify`: request body, headers, method, URL, content type, and request options;
  - remaining differing nodes contain distinct code bodies under different node identities.
- Neither workflow nor the differing nodes expose credential objects in the inspected metadata, but semantic equivalence cannot be established from identity and parameter-shape evidence alone.
- Live routing tokens: `inbox/new=4`, `inbox/failed=0`, no path environment variables.
- Candidate routing tokens: `inbox/new=4`, `inbox/failed=4`, `MIND_INBOX_PATH=2`, `MIND_FAILED_PATH=2`.

An identity-preserving ordinary update would either remove live nodes, introduce new nodes, or replace live node types and connection semantics. That exceeds the current planner's bounded-update contract. Weakening the planner to allow this candidate would erase the distinction between a safe routing update and a workflow topology migration.

Validation completed for B1.0e:

```text
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
planner tests: 6 passed, 0 failed
candidate workflow JSON: valid
rollback artifact JSON: valid
focused secret scan: no findings
```

No workflow topology file change was made during B1.0e.

## Fixture and receipt findings

No success or forced-failure fixture was invoked because deployment preconditions failed.

Consequently:

- no file was created under `inbox/new/`;
- no file was created under `inbox/failed/`;
- no file was created under `capture/inbox/` or `capture/failed/`;
- no receipt was generated;
- no external write occurred.

## Credential and external-action confirmation

```text
credential_values_printed=false
credential_files_read=false
live_deployment_performed=false
webhook_invocations=0
schedule_changes=0
external_writes=0
mind_files_changed=0
```

## Current preflight validation

The following no-network validations were rerun successfully on 2026-07-10:

```text
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
planner tests: 6 passed, 0 failed
status plan: workflow FwP5INe9qoo1OwGC, network_access=false, credentials_read=false
```

No live command, webhook, schedule action, credential load, external write, or fixture invocation occurred.

## Mind legacy-root cleanup audit

The user-provided Obsidian view shows both legacy and target roots. Read-only inventory confirmed that the visible legacy roots are not empty:

```text
capture: files=7, directories=3
live: files=10, directories=0
sources: files=1, directories=0
wiki: files=52, directories=12
archive: files=846, directories=35
graphify-out: files=216, directories=39
```

Examples include failure-buffer records under `capture/failed/`, active-looking documents under `live/`, durable content under `wiki/`, a large historical corpus under `archive/`, and generated graph artifacts under `graphify-out/`.

Deletion was not attempted because:

1. this task permits only read-only Mind inspection except approved live fixtures;
2. the roots contain substantive data and generated artifacts;
3. no complete dependency/link/automation migration proof exists for every root;
4. deleting them would require a separate Mind-owned migration and explicit destructive confirmation.

The presence of both structures therefore cannot yet be treated as safe-to-delete residue.

## B1.0f controlled topology migration design

The controlled topology migration contract is now machine-checkable at:

```text
operations/automations/n8n/save-to-mind-topology-migration.json
```

It binds:

- workflow ID `FwP5INe9qoo1OwGC`;
- workflow name `Save to Mind — Capture for Mind Steward`;
- rollback artifact `operations/reports/artifacts/b1-0a-live-workflow-rollback.json`;
- rollback SHA-256 `703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd`;
- 7 retained nodes;
- 3 removed live nodes;
- 3 added candidate nodes;
- exact removed, added, retained, and expected post-deployment connections;
- preserved activation, settings, tags, sharing, credentials, webhook identity, schedules, and GitHub write boundaries;
- canonical success path `inbox/new` and failure path `inbox/failed`;
- `MIND_INBOX_PATH` and `MIND_FAILED_PATH` override behavior;
- exact fingerprints for the two approved retained-node parameter changes.

The dedicated controlled planner is:

```text
tools/n8n-save-to-mind-topology-plan.mjs
```

The ordinary planner was not modified or weakened. It still rejects the topology migration with:

```text
FAIL: workflow removed node resolve-inbox-path
```

The controlled planner dry-run passed:

```text
mode=dry-run-controlled-topology
workflow_id=FwP5INe9qoo1OwGC
retained_nodes=check-github-file,file-exists-check,handle-file-check,respond-webhook,save-to-github-create,save-to-github-update,webhook-trigger
removed_nodes=build-inbox-note,prepare-capture,resolve-inbox-path
added_nodes=build-gemini-body,build-processed-note,gemini-classify
expected_success_path=inbox/new
expected_failure_path=inbox/failed
network_access=false
credentials_read=false
result=pass
```

Exact graph and routing validation returned:

```text
nodeSetEqual=true
nodeCount=10
connectionGraphEqual=true
connectionCount=10
inbox/new=4
inbox/failed=4
capture/inbox=0
capture/failed=0
MIND_INBOX_PATH=2
MIND_FAILED_PATH=2
```

B1.0f validation evidence:

```text
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
ordinary planner tests: 6 passed, 0 failed
controlled topology tests: 16 passed, 0 failed
candidate workflow JSON: valid
rollback artifact JSON: valid
topology manifest JSON: valid
focused secret scan: no findings
```

No live n8n query, deployment, webhook invocation, schedule action, credential access, network write, Mind write, commit, or push occurred. The temporary fingerprint helper was deleted after use.

## Final approved-execution preflight

The user explicitly approved the controlled topology deployment, one bounded success fixture, one bounded forced-failure fixture, exact post-deployment graph/routing verification, and immediate rollback on any mismatch.

The complete pre-deployment validation was rerun after approval:

```text
rollback, candidate, and manifest JSON: valid
repository workflow validation: pass
Mind Steward tests: 55 passed, 0 failed
sync tests: 2 passed, 0 failed
ordinary planner tests: 6 passed, 0 failed
controlled topology tests: 16 passed, 0 failed
controlled dry-run topology plan: pass
rollback SHA-256: 703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd
```

The controlled plan emitted the exact approved logical operations:

```text
planned_deploy_command=tools/n8n-api.sh update-workflow FwP5INe9qoo1OwGC operations/automations/n8n/workflows/mind-inbox-fixed.json
planned_rollback_command=tools/n8n-api.sh update-workflow FwP5INe9qoo1OwGC operations/reports/artifacts/b1-0a-live-workflow-rollback.json
```

## Unresolved blocker

Workbench currently exposes the confirmation-gated `n8n_workflow_export` read operation, but no allowlisted, confirmation-aware workflow update operation. The available command runner cannot execute `tools/n8n-api.sh update-workflow ...` safely because arbitrary shell/script execution and nested process execution remain prohibited.

The approved deployment therefore could not be executed through the available guarded action surface. No direct shell invocation, bypass, credential access, workflow mutation, webhook call, fixture write, or rollback attempt was made.

## Verdict

**BLOCKED — GUARDED LIVE UPDATE OPERATION UNAVAILABLE.** B1.0f remains complete and every B1.0a pre-deployment check passes. The user approval is present. B1.0a remains incomplete solely because the guarded executor required to perform the exact approved update and rollback is unavailable.

B1.1 must not start.

## Exact next documented step

Provide a narrowly allowlisted, confirmation-gated Workbench operation that can update only workflow `FwP5INe9qoo1OwGC` from the exact reviewed candidate and can roll back only from the exact validated rollback artifact. Resume B1.0a immediately after that capability is available; rerun the same preflight and perform no additional design work.

## 2026-07-14 final-approval execution-gate recheck

The user supplied final approval for the bounded B1.0a live-verification lane.
The complete offline preflight passed again: repository path validation, Mind
Steward typecheck and focused path tests, sync fixture tests, ordinary and
controlled-topology planner tests, capability-state/contract/path/layer
validators, JSON validation, secret-material scan, rollback SHA-256 and
workflow-ID checks, and `git diff --check`.

Before any network operation, the current runtime's named-tool inventory was
checked. It contains no guarded n8n export, update, rollback, or fixture
operation. In particular, no confirmation-aware operation is available that
accepts only the approved workflow ID, candidate, rollback artifact, and
topology manifest, or that can prove a fixed-argv rollback is immediately
available. The existing repository documentation at line 462 remains accurate:
the only documented Workbench capability is the read-only export operation;
the required guarded update and rollback capability is absent.

No network operation was attempted. No export artifact, workflow update,
fixture, rollback, or Mind write was created. B1.0a remains incomplete for the
same single blocker: **the fixed-scope, confirmation-aware guarded update and
rollback operation is unavailable in this runtime.**

### Exact bounded capability repair prompt

```text
Implement and register two confirmation-required Workbench/Codex operations for
B1.0a only: a guarded Save-to-Mind workflow update and a guarded rollback.
Both must hard-code workflow ID FwP5INe9qoo1OwGC; use shell=false and fixed argv
internally; never expose credential values or sources; and reject caller-supplied
workflow IDs, paths, environment overrides, activation changes, schedule changes,
webhook changes, credentials, settings, tags, sharing, or unrelated-node changes.

The update operation may accept only these repository paths:
- operations/automations/n8n/workflows/mind-inbox-fixed.json
- operations/reports/artifacts/b1-0a-live-workflow-rollback.json
- operations/automations/n8n/save-to-mind-topology-migration.json

It must validate the exact rollback SHA-256
703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd,
run the existing topology validator, emit bounded metadata only, and issue at
most one update. The rollback operation must accept no caller-controlled values
and restore only the exact approved rollback artifact. Add tests for confirmation
required, fixed argv, shell=false, exact-input rejection, topology/hash checks,
bounded output, and rollback availability before the update operation can run.
Do not deploy as part of this capability work. Resume B1.0a only after those
operations are registered and their tests pass.
```

## 2026-07-14 fresh Codex MCP runtime Gate 0 recheck

**Verdict: BLOCKED — fresh Codex MCP runtime integration is unavailable.**

The repository registration is present locally: `codex mcp list` recognizes
`b1_0a_guarded_save_to_mind` as enabled, and the registered server source
defines the two fixed-scope tools with `shell: false` process options. This is
only static registration evidence; it does not establish that the current
Codex desktop runtime has initialized or exposed the server.

The current session's actual MCP tool catalog contains neither
`b1_0a_guarded_save_to_mind_update` nor
`b1_0a_guarded_save_to_mind_rollback`. It also contains no guarded read-only
workflow-export operation. Consequently, this session cannot establish the
required runtime credential abstraction without attempting an operation, which
is prohibited once the required tools are absent.

Pre-network local checks completed without printing workflow JSON or credential
material:

```text
Brain worktree fingerprint: 8758e5ac878a251bd314a5f5aaee8ef8f366476230c50efcde93f5c8a4b63af5 (235 status entries)
Mind worktree fingerprint:  a524e5b1f2db441bf19af26cd8a215f0401bc5daefe2fe7da48f6db0f7a001d9 (69 status entries; read-only)
rollback artifact SHA-256:  703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd
rollback workflow ID:       FwP5INe9qoo1OwGC
candidate JSON parse:       pass
topology manifest parse:    pass
```

No network action occurred. No workflow export, update, fixture, rollback,
Mind write, schedule action, activation change, credential read, commit, or
push occurred. B1.0a remains incomplete; the implementation plan and
capability-state evidence remain unchanged.

**Exact runtime-integration blocker:** Restart or reload the current Codex
desktop MCP runtime so that it exposes the registered guarded update and
rollback tools *and* the required guarded read-only workflow-export tool in the
same credential-abstracted runtime. Resume from Gate 0 only after the live tool
catalog proves those exact operations are available.
