# Obsidian Mind + Model Router Handoff

**Date:** 2026-05-17
**Agent job:** `agent-fd864bb2-04fc-420c-981b-171862072913`
**Primary source:** `brain`
**Matching source:** `mind`

## Current conclusion

The roadmap is not safe to advance into broad Mind mutation or legacy-folder archival in this pass. The verified state shows the safe implementation slices are already complete through report-only model-router execution and Brain Core status surfaces. The remaining roadmap items that would mutate Mind are intentionally blocked by current policy until a separate write/apply policy is approved and tested.

## Files read for this continuation

Brain:

```text
docs/system/obsidian-mind-model-router-roadmap.md
docs/system/obsidian-mind-model-router-implementation-plan.md
docs/system/brain-mind-roadmap-handoff-2026-05-17.md
docs/system/brain-mind-roadmap-agent-handoff-2026-05-17.md
operations/specs/brain-core-first-action-feature-flag.md
operations/runbooks/brain-core-approval-gates.md
operations/runbooks/brain-core-first-action-incident-response.md
```

Mind:

```text
MIND-OS-HANDOFF-2026-05-17-CONTINUATION.md
MIND-OS-ROADMAP.md
MIND-OS-IMPLEMENTATION-PLAN.md
HOME.md
TODAY.md
```

## Verified roadmap status

### 1. Document new mind architecture in Brain

Status: complete.

Evidence:

```text
docs/system/obsidian-mind-model-router-roadmap.md
docs/system/obsidian-mind-model-router-implementation-plan.md
```

### 2. Create matching migration plan in Mind

Status: complete.

Evidence:

```text
MIND-OS-ROADMAP.md
MIND-OS-IMPLEMENTATION-PLAN.md
MIND-OS-HANDOFF-2026-05-17-CONTINUATION.md
```

### 3. Update Save-to-Mind docs to target `capture/inbox/`

Status: complete per handoff evidence.

Current documented behavior:

```text
/webhook/mind-inbox remains stable
successful captures -> capture/inbox/
failure buffer -> capture/failed/
legacy 01-inbox/ remains historical/reference
```

### 4. Create new folders in Mind beside old ones

Status: complete.

Verified root structure includes:

```text
capture/
live/
router/
wiki/
sources/
archive/
```

Legacy numbered folders remain present and must not be mass-deleted or archived without a new approval/validation plan.

### 5. Create router contract files

Status: complete.

Verified files include:

```text
router/current.md
router/map.md
router/rules.md
router/taxonomy.md
router/maintenance.md
router/model-router.md
```

### 6. Build model-router project in Brain

Status: complete for report-only/dry-run scope.

Verified project:

```text
projects/model-router/
```

Validation in this continuation:

```text
npm run --prefix projects/model-router ci
result: passed, 8 tests
```

### 7. Update n8n Save-to-Mind target path

Status: complete per handoff evidence, not re-executed in this pass.

Handoff states:

```text
Save-to-Mind target is capture/inbox/
public webhook remains /webhook/mind-inbox
n8n workflow was sanitized to avoid hardcoded Gemini key material
```

### 8. Add capture failure buffer

Status: complete per handoff evidence, not re-executed in this pass.

Handoff states:

```text
test-only failure buffering now writes to capture/failed/
failed captures are recoverable
```

### 9. Build daily maintenance loops in Office nightly scheduler

Status: complete for report-only dry-run/status surfaces; no write/apply loop is approved.

Verified Brain Core exposes scheduler/model-router state and the first controlled report-only execution path:

```text
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
POST /scheduler/jobs/:id/request-run
scheduler-run-model-router-dry-run
```

Safety invariant:

```text
No broad scheduler execution
No broad shell runner
No model-router writes to Mind
```

### 10. Compile old PARA content into wiki/live

Status: partially complete by safe manual/previous migration outputs only.

Evidence:

- `HOME.md` points to `live/`, `capture/inbox/`, and Brain runtime status surfaces.
- `TODAY.md` points to `live/` and `capture/inbox/`.
- `live/`, `wiki/`, and `sources/` exist.

Blocked boundary:

The model-router is currently report-only. It must not compile, rewrite, move, delete, compact, split, or archive Mind content until a separate write/apply policy is approved and tested.

### 11. Archive old numbered folders after validation

Status: not executed; blocked by safety boundary.

Reason:

Archiving old numbered folders is destructive/high-impact and the latest Mind handoff explicitly says not to move/delete/archive additional legacy folders without a new explicit plan. This requires separate review and confirmation.

## Validation completed in this continuation

### Brain git status

Command:

```bash
git status --short
```

Result: completed, exit 0.

Observed unrelated dirty state remains and was not touched:

```text
 M operations/system-configs/claude/.last-cleanup
 D operations/system-configs/claude/plans/*.md
 M operations/system-configs/codex/skills/.system/openai-docs/SKILL.md
 M tools/firecrawl/logs/firecrawl.log
```

### Mind git status

Command:

```bash
git status --short
```

Result: completed, exit 0.

Observed local Obsidian state remains and was not touched:

```text
 M .obsidian/community-plugins.json
?? .obsidian/plugins/custom-sort/
?? .obsidian/plugins/ghostty-terminal/
?? .obsidian/plugins/obsidian-icon-folder/
```

### Brain Core CI

Command:

```bash
npm run --prefix projects/brain-core ci
```

Result:

```text
passed, 52 tests
```

### Model-router CI

Command:

```bash
npm run --prefix projects/model-router ci
```

Result:

```text
passed, 8 tests
```

### ProBot typecheck

Command:

```bash
npm run --prefix projects/probot typecheck
```

Result:

```text
passed
```

### Brain Console typecheck

Command:

```bash
npm run --prefix projects/brain-console-obsidian typecheck
```

Result:

```text
passed
```

### Brain Console build

Command:

```bash
npm run --prefix projects/brain-console-obsidian build
```

Result:

```text
passed
```

## Safety boundaries preserved

Do not proceed past these boundaries without a new explicit plan and approval:

- Do not enable broad execution.
- Do not add a broad Brain Core shell runner.
- Do not let model-router mutate Mind.
- Do not archive/delete/move legacy numbered folders.
- Do not install Brain Console into `mind/.obsidian/plugins/`.
- Do not stage Mind `.obsidian` plugin/config state without path-by-path review.
- Do not stage unrelated Brain Claude cleanup, Codex skill state, or Firecrawl log churn.
- Do not store runtime logs, approval/audit JSONL, or model-router runtime output in Mind.
- Do not commit or push without explicit confirmation.

## Resume point

The next safe task is to design the separate model-router Mind write/apply policy, not to execute Mind mutation.

Recommended next implementation slice:

```text
Create a write/apply policy spec for model-router Mind mutations that defines:
- allowed operations
- allowed roots
- blocked roots
- dry-run preview format
- approval gates
- rollback plan
- tests
- first allowed write action, if any
```

Only after that policy is approved and validated should roadmap steps 10 and 11 advance.

## Agent Mode progress state

Active task completed in this continuation:

```text
task-1-requirements-roadmap
```

Completed/verified continuation work:

```text
- read roadmap and implementation docs
- read Brain and Mind handoffs
- verified active repo state
- ran current validation suite
- preserved safety boundaries
- wrote this handoff
```

Next active task:

```text
task-2-implement-next-slice
```

Suggested task-2 scope:

```text
Draft the model-router Mind write/apply policy as documentation only, then validate docs/security scan. Do not implement mutation yet.
```


## Continuation update — task-2 safe implementation slice

Created the draft write/apply policy for future model-router Mind mutations:

```text
operations/specs/1779034874780-model-router-mind-write-apply-policy.md
```

Status:

- documentation only;
- no execution path enabled;
- no model-router Mind writes implemented;
- destructive/archive behavior remains out of scope;
- first future apply action is constrained to a reversible `router/current.md` update proposal.

Validation:

```text
security_scan_paths forbidden_secret_material docs/system/1779034841996-obsidian-mind-model-router-handoff.md operations/specs/1779034874780-model-router-mind-write-apply-policy.md
result: passed, findings: []
```

Agent task status:

```text
task-2-implement-next-slice: complete for documentation-only policy slice
task-3-repair-and-continue: no repair needed
task-4-final-validation: run final git status and report
```


## Continuation update — preview scaffolding implemented

Implemented a safe Brain-side model-router preview scaffold. This does not write to Mind and does not enable any apply route.

Changed files:

```text
projects/model-router/src/preview.ts
projects/model-router/src/tests/preview.test.ts
projects/model-router/src/index.ts
```

Capabilities added:

- evaluate whether a proposed Mind target is in the allowed preview list;
- reject blocked roots such as `.obsidian/`, legacy numbered folders, runtime/build/log folders, and env files;
- create a non-writing preview object with target path, operation, hashes, line counts, simple diff, policy reasons, and safety flags;
- enforce the first proposed target line limit for `router/current.md`;
- flag live-looking secret material without writing;
- export preview helpers for future Brain Core integration.

Validation:

```text
npm run --prefix projects/model-router ci
result: passed, 14 tests

security_scan_paths forbidden_secret_material projects/model-router/src/preview.ts projects/model-router/src/tests/preview.test.ts projects/model-router/src/index.ts
result: passed, findings: []
```

Safety status:

```text
writesToMind=false
externalSideEffects=false
no apply route added
no Brain Core execution route added
no Mind files changed
legacy archival remains blocked
```


## Continuation update — Brain Core preview metadata surfaced

Added read-only Mind preview policy metadata to the Brain Core execution plan surface. This makes the future write/apply boundary visible to operator clients while keeping execution and apply disabled.

Changed files:

```text
projects/brain-core/src/adapters/execution-plans.ts
projects/brain-core/src/types/api.ts
projects/brain-core/src/tests/routes.test.ts
```

Behavior added:

- `/execution/plans` now includes `mindPreviewPolicy` metadata for the model-router dry-run candidate;
- the metadata names the first proposed future action, `model-router-update-current-context`;
- the first proposed target is `router/current.md`;
- `applyRouteEnabled=false`;
- `writesToMind=false`;
- `externalSideEffects=false`;
- allowed preview targets and blocked prefixes are visible;
- required gates include preview hash approval, safe runtime approval/audit paths, post-apply validation, and rollback instructions.

Validation:

```text
npm run --prefix projects/brain-core ci
result: passed, 52 tests

security_scan_paths forbidden_secret_material projects/brain-core/src/adapters/execution-plans.ts projects/brain-core/src/types/api.ts projects/brain-core/src/tests/routes.test.ts
result: passed, findings: []
```

Safety status:

```text
no apply endpoint added
no broad execution added
no Mind mutation added
Brain Core remains local/read-only except the previously approved exact dry-run report action
```


## Continuation update — Brain Core preview metadata surfaced

Added read-only Brain Core execution-plan metadata for the model-router Mind preview policy. This exposes the policy state to operators without creating any apply route or Mind mutation capability.

Changed files:

```text
projects/brain-core/src/types/api.ts
projects/brain-core/src/adapters/execution-plans.ts
```

Capabilities surfaced:

- preview policy status: `preview-only`;
- first proposed future action: `model-router-update-current-context`;
- first proposed future target: `router/current.md`;
- allowed preview targets;
- blocked prefixes including `.obsidian/` and legacy numbered folders;
- required gates for any future apply action;
- explicit `writesToMind=false`, `externalSideEffects=false`, and `applyRouteEnabled=false`.

Validation:

```text
npm run --prefix projects/brain-core ci
result: passed, 52 tests

security_scan_paths forbidden_secret_material projects/brain-core/src/types/api.ts projects/brain-core/src/adapters/execution-plans.ts projects/model-router/src/preview.ts projects/model-router/src/tests/preview.test.ts projects/model-router/src/index.ts
result: passed, findings: []
```

Safety status:

```text
Brain Core still does not expose a model-router Mind apply route.
The only execution path remains the exact report-only model-router dry-run action.
Mind remains unchanged.
```


## Continuation update — Codex apply-helper review and bug fix

Reviewed Codex's first controlled apply-helper implementation directly in the repo.

Codex claim check:

- `applyApprovedMindWritePreview(...)` exists in `projects/model-router/src/preview.ts`.
- It remains a local helper only; no Brain Core HTTP apply route was added.
- No Mind file was changed.
- `mind/router/current.md` was not changed.
- No broad archival, delete, move, or rewrite path was added.

Bug found and fixed:

- Rejected apply attempts returned an audit payload shaped like a successful `applied` event with `status: ok` and `writesToMind: true`.
- Fixed rejected attempts to return blocked audit metadata:
  - `event: blocked`
  - `status: blocked`
  - `writesToMind: false`
  - `appliedAt: null`
- Added test coverage for the blocked audit metadata path.

Validation after fix:

```text
npm run --prefix projects/model-router ci
result: passed, 19 tests

npm run --prefix projects/brain-core ci
result: passed, 52 tests

npm run --prefix projects/probot typecheck
result: passed

npm run --prefix projects/brain-console-obsidian typecheck
result: passed

npm run --prefix projects/brain-console-obsidian build
result: passed

security_scan_paths forbidden_secret_material on changed roadmap/code/docs
result: passed, findings: []
```

Safety status after review:

```text
No Mind files changed.
No apply route exposed through Brain Core.
No broad execution added.
No legacy archive/delete/move path added.
Unrelated dirty Claude/Firecrawl state preserved and not staged.
```

## 2026-05-17 read-only preview policy surfaces

Implemented in this continuation:

- Added `GET /execution/mind-preview-policy` as a read-only Brain Core metadata surface.
- Extended the model-router helper tests to cover traversal and absolute-path rejection plus blocked audit metadata.
- Surfaced the preview-only policy in ProBot and Brain Console text output.

Changed files:

- `projects/model-router/src/preview.ts`
- `projects/model-router/src/tests/preview.test.ts`
- `projects/brain-core/src/adapters/execution-plans.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/routes.test.ts`
- `projects/brain-core/src/types/api.ts`
- `projects/probot/src/services/brain-core-client.ts`
- `projects/probot/src/services/brain-core-commands.ts`
- `projects/probot/src/services/status.ts`
- `projects/brain-console-obsidian/src/client.ts`
- `projects/brain-console-obsidian/src/view.ts`

Safety boundaries preserved:

- No Mind mutation route was added.
- No Mind files were changed.
- No archive/delete/move behavior was added.
- No `.obsidian/` write path was introduced.

Blocked state remains:

- Mind apply remains metadata-only and not executable through Brain Core.
- Broad shell execution remains disabled.
- Any future Mind write still requires a separate approval-backed route and validation drill.

## 2026-05-17 preview artifact continuation

Implemented in this continuation:

- Added Brain-owned preview artifact serialization and read helpers under `projects/model-router`.
- Exposed read-only Brain Core preview artifact endpoints:
  - `GET /execution/mind-previews`
  - `GET /execution/mind-previews/latest`
  - `GET /execution/mind-previews/:id`
- Surfaced preview count and latest target in Brain Console and ProBot status text.

Storage path:

- Default runtime root: `runtime/local/model-router/previews/`
- The writer/reader reject unsafe paths and never target Mind.

Preview identity:

- `previewId` is derived from safe preview fields and is suitable for approval references.
- Previews expire separately from approvals; expired previews are reported as expired but remain readable.

Validation:

- Model-router preview tests cover safe write path, unsafe path rejection, expiry, and non-writing metadata.
- Brain Core route tests cover empty state, listing, latest/detail lookup, and unsafe configuration handling.

Still blocked:

- No Mind mutation route is enabled.
- No apply route is enabled.
- No preview artifact is written to Mind.
