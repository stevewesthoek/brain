# Mind Legacy Task Tree Decision Packet

**Date:** 2026-05-18

## Current counts

- Deleted tracked `04-tasks/**`: 742 files
- Untracked `03-projects/04-tasks/**`: 742 files
- Known mismatch: none after path normalization

## Summary by category

- `business-tasks`: present in both trees
- `buy`: likely present in the deleted legacy tree or its mirror family
- `church-tasks`: present in both trees
- `family-tasks`: present in both trees
- `personal-tasks`: present in both trees
- Other observed families: the trees appear to share the same task naming patterns and numbering style

## Likely reason for mismatch

The latest path-only preservation export shows no remaining path mismatch. The earlier one-file discrepancy appears to have been a stale snapshot rather than a live tree difference.

## Option A - Restore old tree and discard mirror

- Restores tracked `04-tasks/**`
- Removes untracked `03-projects/04-tasks/**` mirror
- Lowest history risk
- Keeps old structure authoritative

## Option B - Commit migration

- Commits deletion of `04-tasks/**` and addition of `03-projects/04-tasks/**`
- High-risk bulk commit
- Makes the new structure authoritative
- Should be reviewed and probably tagged before commit

## Option C - Archive/export first

- Safest preservation route
- Requires explicit archive path, branch, or tag
- Then decide restore or migrate

## Recommended default if user is unsure

- Choose Option A to restore, or Option C to archive first
- Do not choose Option B without explicit approval

## Preservation update

- A preservation tag was created and pushed before any migration decision.
- A metadata-only export of both trees was produced.
- The current live path comparison shows equality between deleted and mirror path sets.

## Decision impact

- Option A: safest if the legacy tree should remain the source of truth
- Option B: highest blast radius, best only when the mirror is clearly the intended replacement
- Option C: best when the user wants preservation before any structural decision

## Questions to ask the user

1. Should `04-tasks/**` be restored?
2. Is `03-projects/04-tasks/**` the intended replacement?
3. Do you want an archive or tag before migration?
4. Should this be one commit or split by subfolder?

## Safe future references

- Migration options report: `operations/reports/mind-legacy-task-migration-options-2026-05-18.md`
- Workspace isolation runbook: `operations/runbooks/mind-workspace-isolation.md`
