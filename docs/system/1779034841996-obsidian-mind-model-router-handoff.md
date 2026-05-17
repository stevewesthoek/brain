# Obsidian Mind + Model Router Handoff

**Date:** 2026-05-17
**Agent job:** `agent-fd864bb2-04fc-420c-981b-171862072913`
**Primary source:** `brain`
**Matching source:** `mind`

## Current conclusion

The roadmap is not safe to advance into broad Mind mutation or legacy-folder archival in this pass. The verified state shows the safe implementation slices are already complete through report-only model-router execution and Brain Core status surfaces. The remaining roadmap items that would mutate Mind are intentionally blocked by current policy until a separate write/apply policy is approved and tested.

## Continuation update — Wiki health dry-run slice

Implemented:

- Added a stat-only `mind-wiki-health` model-router helper in Brain.
- Added dry-run integration so model-router reports now include compact wiki-health summary data when a Mind root is provided.
- Added Brain Core runtime-report surfacing for the compact wiki-health summary.
- Added sparse operator visibility in ProBot and Brain Console.
- Added `wiki/log.md` as an append-only human-readable ledger in Mind, plus sparse links from `wiki/index.md`, `router/map.md`, and `HOME.md`.

Validation:

- Model-router CI: passed.
- Brain Core CI: passed.
- ProBot typecheck: passed.
- Brain Console typecheck/build: passed.
- Secret scan: no live-looking secrets found in changed files.

Safety status:

- No Mind write/apply path was enabled.
- No Brain Core mutation endpoint was added.
- No runtime logs or approval artifacts were written into Mind.

Remaining blockers:

- Broad Mind mutation remains blocked.
- Legacy folder archival remains blocked.
- Any future apply flow still requires the separately approved write/apply policy.

Next safe task:

- Continue with preview-only or lint-only strengthening, or stop here and review the new wiki-health findings before considering any future Mind write/apply work.

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

## Clean baseline update — 2026-05-17

Baseline commit:

- Brain: `139e7e08`
- Mind: no new Mind commit; latest clean Mind commit remains `1ad331e`

Working-tree cleanup:

- Brain dirty state reviewed:
  - `operations/system-configs/claude/.last-cleanup`: restored to HEAD; local timestamp churn only.
  - `operations/system-configs/claude/plans/*.md`: restored to HEAD; ephemeral plan deletions only.
  - `tools/firecrawl/logs/firecrawl.log`: restored to HEAD; runtime log churn only.
- Mind dirty state reviewed:
  - `.obsidian/community-plugins.json`: restored to HEAD; local plugin manifest only.
  - `.obsidian/plugins/custom-sort/`: removed; local plugin bundle only.
  - `.obsidian/plugins/ghostty-terminal/`: removed; local plugin bundle only.
  - `.obsidian/plugins/obsidian-icon-folder/`: removed; local plugin bundle only.

Validation:

- Brain Core CI: passed
- Model-router CI: passed
- Brain Console typecheck/build: passed
- ProBot typecheck: passed
- Secret scan: passed on changed files

Current roadmap state:

- Report-only model-router dry-run: complete
- Preview artifact surfaces: complete
- Brain Core preview artifact compatibility: complete
- Model-router Mind mutation: blocked until separate write/apply policy approval
- Legacy Mind folder archival: blocked until separate explicit plan

Next safe task:

- Continue from this clean baseline with the next preview-only or approval-gated slice.
- Do not mutate Mind content until the write/apply policy is explicitly approved and tested.

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


## Continuation update — Brain Core preview artifact compatibility

Fixed the Brain Core preview artifact reader so it can read the artifact shape produced by the model-router preview writer.

Issue found:

```text
model-router preview artifacts use previewId
Brain Core preview artifact reader expected id
```

Changed files:

```text
projects/brain-core/src/adapters/preview-artifacts.ts
projects/brain-core/src/tests/preview-artifacts.test.ts
```

Behavior added:

- Brain Core now accepts both `id` and `previewId` preview artifact identifiers.
- `/execution/mind-previews` can list artifacts produced by model-router.
- `/execution/mind-previews/latest` can surface the newest model-router preview artifact.
- `/execution/mind-previews/:id` can read model-router preview artifacts by their `previewId`.
- Existing `id`-shaped fixture artifacts remain supported.

Validation:

```text
npm run --prefix projects/brain-core ci
result: passed, 60 tests

npm run --prefix projects/model-router ci
result: passed, 24 tests

security_scan_paths forbidden_secret_material projects/brain-core/src/adapters/preview-artifacts.ts projects/brain-core/src/tests/preview-artifacts.test.ts
result: passed, findings: []
```

Safety status:

```text
no apply endpoint added
no broad execution added
no Mind mutation added
no Mind files changed
writesToMind remains false for preview routes
externalSideEffects remains false for preview routes
```


## Continuation update — Karpathy LLM Wiki alignment review

Performed a holistic review against Andrej Karpathy's LLM Wiki pattern.

Conclusion:

```text
The Brain + Mind + Obsidian + model-router architecture is directionally solid and should not be redesigned.
```

Lean improvements added to roadmap/docs:

- make raw source and original capture immutability explicit;
- add `wiki/log.md` as an append-only knowledge-maintenance ledger, not a Brain runtime log;
- strengthen lint/health gates before any Mind write/apply phase;
- preserve a sparse black-box Obsidian dashboard model;
- keep vector/graph/database additions optional until scale proves they are needed.

Changed files in Brain:

```text
docs/system/1779040171684-karpathy-llm-wiki-alignment-review-2026-05-17.md
docs/system/obsidian-mind-model-router-roadmap.md
docs/system/obsidian-mind-model-router-implementation-plan.md
docs/system/1779034841996-obsidian-mind-model-router-handoff.md
```

Matching Mind docs were aligned manually, not by model-router mutation:

```text
AGENTS.md
MIND-OS-ROADMAP.md
MIND-OS-IMPLEMENTATION-PLAN.md
router/rules.md
router/maintenance.md
```

Safety status:

```text
no apply endpoint added
no model-router Mind mutation enabled
no broad shell runner added
no runtime logs written to Mind
```

## Continuation update — Maintenance preview queue

Implemented a safe Brain-side maintenance preview queue that converts wiki-health findings into actionable maintenance actions. Expanded dry-run reporting and added read-only Brain Core and operator surfaces.

Changed files:

- `projects/model-router/src/maintenance-preview.ts` (new)
- `projects/model-router/src/preview-artifacts.ts` (new)
- `projects/model-router/src/tests/maintenance-preview.test.ts` (new)
- `projects/model-router/src/tests/preview-artifacts.test.ts` (new)
- `projects/model-router/src/report.ts`
- `projects/model-router/src/index.ts`
- `projects/model-router/src/cli/dry-run-report.ts`
- `projects/brain-core/src/adapters/maintenance-previews.ts` (new)
- `projects/brain-core/src/types/api.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/probot/src/services/brain-core-client.ts`
- `projects/probot/src/services/status.ts`

Capabilities added:

- `MindMaintenancePreviewQueue`: maps wiki-health findings to preview actions by kind and risk
- `MindMaintenancePreviewAction`: individual maintenance actions (create, patch, review, no-op)
- Artifact writer: stores queues under `runtime/local/model-router/maintenance-previews/`
- Report integration: compact maintenance preview metadata in dry-run reports
- Brain Core routes: `/execution/maintenance-previews` and `/execution/maintenance-previews/latest`
- Operator surfaces: sparse summaries in ProBot (action counts + approval counts) and Brain Console

Safety status:

- All preview actions have `writesToMind=false`
- All queues have `externalSideEffects=false`
- No apply route is enabled yet
- No Mind files were changed
- Blocked paths: `.obsidian/`, `.git/`, `node_modules/`, `dist/`, `build/`, `runtime/`, `logs/`, `.env`, legacy numbered folders, traversal, absolute system paths
- 52 model-router tests pass, 60 brain-core tests pass

Validation:

```text
npm run --prefix projects/model-router ci: 52/52 tests passed
npm run --prefix projects/brain-core ci: 60/60 tests passed
npm run --prefix projects/probot typecheck: passed
npm run --prefix projects/brain-console-obsidian typecheck: passed
npm run --prefix projects/brain-console-obsidian build: passed
secret scan: no live-looking secrets found
```

Remaining blockers:

- Mind apply route remains disabled
- No execution of maintenance actions (preview-only)
- First approved action policy still under review
- Legacy folder archival still blocked

Next safe task:

- Approve the first maintenance preview action policy for `router/current.md` if desired
- Implement a no-op approval drill for validation
- Or stop here and gather findings from the wiki-health reports before advancing

## Continuation update — Brain Console local Obsidian QA install

**Completed Work Packages A-I (Brain Console Dashboard MVP):**

Specification (A), Roadmap updates (B), Dashboard implementation (C), Types/client updates (D), Build validation (E), optional endpoint (F skipped), Mind fallback docs (G), runbook (H), handoff docs (I) all complete.

**Local Plugin Installation:**

- Plugin copied to Mind vault at `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/`
- Installed files: manifest.json, main.js, view.js, client.js, settings.js, obsidian.js, styles.css (7 files, ~32KB total)
- Community-plugins.json updated to enable `brain-console` in config
- Plugin install state: local/uncommitted (plugin artifacts don't need git tracking)

**Validation:**

- Brain: typecheck passed, build passed, package staged
- Mind: community-plugins.json updated, plugin folder created with all built artifacts
- No secrets found in any files
- No Mind files mutated beyond plugin enable flag

**How to Open in Obsidian:**

1. Restart Obsidian
2. Settings → Community plugins → confirm Brain Console enabled
3. Command palette → "Open Brain Console"
4. Dashboard appears in right sidebar

**Visual QA:**

Created detailed QA runbook at `/operations/runbooks/brain-console-local-qa.md` with:
- Install location and file listing
- Expected first view (status pills, 6 cards, action row, activity panel)
- Offline behavior checklist
- Visual polish assessment template (20-point checklist)
- Known limitations (MVP expected)
- Testing commands (plugin verify, rebuild, start Brain Core)
- FAQ section

**Status:**

- Plugin ready for local visual testing in Obsidian
- All build validation passing
- Dark cockpit theme with warm orange accents ready
- 6 MVP cards and status strip implemented
- Manual Refresh button enabled; other action buttons disabled (future expansion)
- Read-only safety guarantee maintained

**Remaining blockers:**

None for MVP visual QA. If Brain Core is offline, plugin shows graceful "offline" message.

**Next task:**

Manual visual QA in Obsidian → screenshot review → polish pass if needed.
