# BS0.4 — Credential and backup safety audit

**Execution date:** 2026-07-14  
**Status:** complete  
**Verdict:** PASS — approved rollback evidence is bounded and integrity-checked; credential-bearing and unknown-provenance paths are excluded rather than inferred or opened.

## Scope and safety boundary

This was a metadata-only repository audit. It did not open `.env` files,
credential stores, private keys, token files, browser sessions, raw environment
exports, n8n backup payloads, or secret-bearing runtime configuration. It did
not invoke the API wrapper, n8n, a webhook, a deployment, a schedule, or any
external system.

The approved rollback artifact was read only by the new bounded validator. Its
only emitted fields are artifact class, size, SHA-256, workflow ID, JSON status,
credential-surface finding count, and a `raw_artifact_emitted=false` marker.

## Inventory and classifications

| Inventory surface | Classification | Decision |
|---|---|---|
| B1.0a rollback report artifact | rollback artifact; approved non-secret evidence | validator allowlists its report-artifact location, limits size, parses JSON, checks ID and exact SHA-256, and rejects credential-like surface |
| Save-to-Mind candidate workflow and topology manifest | approved non-secret evidence | static review/configuration evidence only; candidate remains paused and not deployed |
| Save-to-Mind planner inputs and static validator | approved non-secret evidence | no network, credential read, or live command is emitted by the candidate planners |
| Repository n8n API wrapper | approved non-secret deployment wrapper | metadata-only inspection found credential abstraction references but no literal private-key, bearer-value, or assignment-like secret value; it was not invoked |
| Repository n8n backup-export wrapper | approved non-secret deployment wrapper | static test confirms timeout/bounded behavior and no HTTP write-method literal; it was not invoked |
| Credential index, `.env` locations, private-key/token/session stores | credential-bearing prohibited path | excluded from this audit, reports, validators, and command output; never opened |
| n8n backup-payload location and backup files outside the approved artifact | unknown provenance | blocked from inspection; no encryption, plaintext, or restore-safety inference is made |
| Runtime/generated-output locations | generated runtime artifact | excluded from audit inputs and output destinations |
| Report-artifact output location | approved non-secret evidence | validator accepts only the approved report-artifact directory and rejects system-config, infrastructure, backup, runtime, and `.env`-class outputs |
| Redaction utility and ignore/exclusion rules | approved non-secret evidence | metadata-only inspection confirms redaction/rejection surface and exclusion-rule presence; no values were read or emitted |

## Approved rollback artifact

| Field | Verified value |
|---|---|
| Artifact path | `operations/reports/artifacts/b1-0a-live-workflow-rollback.json` |
| SHA-256 | `703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd` |
| Size | 26,683 bytes |
| JSON | valid |
| Workflow ID | `FwP5INe9qoo1OwGC` |
| Credential-like surface findings | 0 |
| Raw artifact emitted | false |

## Implementation

- Added `tools/n8n-save-to-mind-artifact-safety.mjs`, a metadata-only
  validator with an exact approved artifact, size bound, SHA-256, JSON,
  workflow-ID, credential-like-surface, and output-location checks.
- Added `tools/n8n-save-to-mind-artifact-safety.test.mjs`, covering approved
  metadata, wrong hash, malformed JSON, wrong ID, oversized data,
  credential-like fields/values, authorization-header-like values,
  environment-style dumps, prohibited output paths, safe CLI output, and a
  static bounded/read-only export-wrapper check.
- Updated only BS0.4 status/evidence and P0 containment wording in the
  implementation plan and capability status page.

## Validation

All commands below passed on 2026-07-14. No command uses network access or
credential input.

```text
node --test tools/n8n-save-to-mind-artifact-safety.test.mjs
# 6 pass

node tools/n8n-save-to-mind-artifact-safety.mjs
# approved artifact: hash/size/JSON/workflow-ID pass;
# credential_like_surface_findings=0; raw_artifact_emitted=false

node --check tools/n8n-save-to-mind-artifact-safety.mjs
node --check tools/n8n-save-to-mind-artifact-safety.test.mjs
# pass

(cd projects/brain-core && ./node_modules/.bin/tsx --test src/tests/mutable-capability-containment.test.ts src/tests/video-orchestrator-thumbnail-route.test.ts)
# 27 pass

npm --prefix projects/mind-steward run typecheck
# pass

node --test tools/scripts/mind-steward-sync-inbox.test.mjs tools/scripts/mind-compile-loop.test.mjs
# 6 pass

./projects/mind-steward/node_modules/.bin/tsx --test projects/mind-steward/src/tests/classifier-paths.test.ts projects/mind-steward/src/tests/classify-captures-cli.test.ts
# 6 pass

git diff --check
# pass
```

The artifact-safety CLI accepts no user-supplied artifact argument. It therefore
cannot be redirected to a credential-bearing or unknown-provenance path. Its
test fixtures are temporary synthetic data and are removed after each test.

## Blockers and follow-up mapping

1. **Unknown backup provenance (Medium):** Non-approved backup material was
   intentionally not opened. Its encryption, plaintext risk, and restore
   safety are unknown. This remains a blocked evidence boundary, not a
   Critical/High defect in the approved artifact path.
2. **Live deployment evidence (Medium):** B1.0a remains incomplete; the
   repository candidate remains paused and does not establish a live workflow,
   schedule, or failure route.
3. **Capability-state generation (Low):** Status remains manually maintained
   until BS0.12–BS0.13; this task preserves the uncertainty rather than
   promoting it.

No unresolved Critical/High credential, rollback-artifact, or evidence-output
risk remains inside the approved BS0.4 scope.

## Completion and next task

P0 containment (`BS0.1`–`BS0.4`) is complete. No Mind file was written, no
credential value or credential-source path was printed, and no live action
occurred. The exact next documented task is **BS0.5 — Create the contract
registry**; it is deliberately not started by this task.
