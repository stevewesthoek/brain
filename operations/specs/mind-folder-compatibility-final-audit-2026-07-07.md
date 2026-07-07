# Mind Folder Compatibility Final Audit — 2026-07-07

**Task:** Task O — Phase 2 Brain compatibility final audit  
**Status:** completed for Brain Core active-source compatibility  
**Scope:** Brain active source under `projects/brain-core/src` plus focused roadmap handoff.  
**Boundary:** no Mind folders moved; Save-to-Mind destination unchanged; continuous processing remains disabled; no unrelated Brain or Mind local dirt touched.

## Inputs

Earlier Phase 2 compatibility commits:

- `66e4635c feat: add Mind folder compatibility paths`
- `f5446ce3 feat: add Mind durable path compatibility`
- `23ca7d7b feat: add Mind task project compatibility`
- `f6b734ec feat: add Mind route maintenance compatibility`

## Final audit method

A bounded active-source scan searched Brain Core source for remaining old Mind path tokens:

```text
capture/inbox
capture/failed
capture/
live/
wiki/
sources/
archive/
kanban.md
router/
graphify-out
.graphify-out
```

The scan was limited to `projects/brain-core/src` to avoid generated/runtime and local system-config noise.

## Scan result after final compatibility fixes

```text
total matches: 601
compatibility fallback intentionally retained: 104 matches across 20 files
unrelated non-Mind-domain string: 9 matches across 2 files
historical docs/runbooks: 1 match across 1 file
test fixtures: 487 matches across 46 files
still-active dependency needing review: 0 matches
```

## Compatibility fixes applied during final audit

The final audit found a few remaining old-only assumptions and patched them:

- Task proposal source links now accept target `inbox/new/<file>.md` and legacy `capture/inbox/<file>.md`.
- Task proposal decision links now accept target `knowledge/decisions.md` and legacy `live/decisions.md`.
- Task proposal review surfaces are target-first: `inbox/processed`, with legacy `wiki/log.md` retained as a candidate.
- Task proposal protected task path is target-first: `tasks.md`, with legacy `kanban.md` retained as a candidate.
- Reviewed capture outcomes are target-first: `inbox/processed` for review and `inbox/new` for rejected captures that stay in inbox.
- Source-gap maintenance findings treat target `knowledge/` and legacy `wiki/` as durable knowledge.
- Completed-active maintenance findings treat target `projects/` and legacy `live/projects/` as project scope.
- Wiki-writing proposal previews now use target `knowledge/<title>.md` instead of creating preview paths under nested legacy `wiki/` locations.
- Continuous-processing UI text now names target `inbox/new` with legacy `capture/inbox` fallback.
- Writer comments now describe target/legacy path families instead of old-only folders.

## Remaining old-path references by classification

### Intentional compatibility fallback

These are expected while Mind has not moved yet:

- central compatibility constants in `mind-paths.ts`;
- preview allowed targets in `execution-plans.ts`;
- maintenance pilot target/fallback groups;
- graph output target/fallback checks;
- task/project/history target/fallback logic;
- approved-write and report-only path guards that accept both target and legacy paths.

### Test fixtures

Tests still contain old paths so compatibility behavior remains covered. These are intentional until the actual Mind migration removes fallback requirements.

### Historical or non-Mind-domain strings

Some remaining strings are unrelated to Mind folder migration, such as video-orchestrator archive/logging labels and VO Studio sample asset paths containing `/sources/`.

### No remaining active old-only blocker found

After the final audit patches, no still-active Brain Core source dependency remains that appears to require the old folder layout only before Mind files move.

## Validation evidence

```text
Brain Core build: passed
focused final-audit tests: passed 36/36
targeted security scan: passed, no findings
```

Focused test set:

```text
mind-steward-task-proposal.test.js
mind-steward-reviewed-outcome.test.js
mind-maintenance-source-gap.test.js
mind-maintenance-completed-active.test.js
infinite-brain-proposal-application-planner.test.js
```

## Phase 2 conclusion

Brain is ready for the next migration phase: Mind documentation and structure preparation, followed by controlled Mind folder moves in small commits.

Do not remove legacy fallback support yet. It should remain until:

- Mind files have been moved;
- Obsidian links and docs have been updated;
- Save-to-Mind writes to `inbox/new/`;
- Brain validators pass against the migrated Mind structure;
- Mind Steward and relevant reports validate target paths;
- Steve approves removal of old empty folders and fallback support.
