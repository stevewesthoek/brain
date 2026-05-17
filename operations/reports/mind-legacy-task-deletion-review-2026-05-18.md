# Mind Legacy Task Deletion Review

**Date:** 2026-05-18

## Summary

- Deleted tracked files: 744
- Top-level grouping: `04-tasks/business-tasks/**` and `04-tasks/personal-tasks/**`

## Risk

High. This is a bulk deletion of legacy task history and should not be auto-committed.

## Recommendation

Do not commit the deletions in this pass until the user confirms whether this is a deliberate archive/removal phase, a restore-all phase, or a partial migration.

Possible outcomes after review:

1. Restore all deleted legacy tasks.
2. Commit deletions as an intentional legacy cleanup.
3. Archive or migrate a reviewed subset first.

## Safe future commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git diff --name-only -- '04-tasks/**'
git diff --stat -- '04-tasks/**'
git restore -- '04-tasks/**'
git add -- '04-tasks/**'
```

## Rollback

```bash
git restore --staged -- '04-tasks/**'
git restore -- '04-tasks/**'
```
