# Mind Legacy Task Migration Options

**Date:** 2026-05-18

## Known facts

- Deleted tracked legacy tree: `04-tasks/**`
  - Count: 742 files
  - Risk: high
  - Current state: deleted in the Mind working tree
- Untracked project mirror: `03-projects/04-tasks/**`
  - Count: 742 files
  - Approximate size: 3.0 MB
  - Risk: high
  - Current state: untracked and likely mirrors the deleted legacy tree

## Decision options

### Option A: Restore legacy task tree, discard mirror

Use when the deleted `04-tasks/**` tree should remain authoritative.

Future commands only:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git restore -- '04-tasks/**'
git clean -n -- '03-projects/04-tasks/'
git clean -fd -- '03-projects/04-tasks/'
```

Risk:

- Lower risk to history.
- Does not adopt the mirror as the new location.

Commit strategy:

- Usually no commit for the restore itself unless other staged state exists.

### Option B: Commit migration from `04-tasks/**` to `03-projects/04-tasks/**`

Use when the mirror is the intended new location.

Future commands only:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git add -- '04-tasks/**'
git add -- '03-projects/04-tasks/**'
git diff --cached --stat
git commit -m "Migrate legacy tasks into project task mirror"
```

Risk:

- High.
- Bulk delete/add change.
- Requires manual diff review and explicit user approval.
- Must not be mixed with `.obsidian` or research changes.

### Option C: Archive/export before deletion

Use when the user wants to preserve legacy tasks before removing the old tree.

Future workflow only:

- Create an archive branch or tag.
- Export the file list.
- Optionally copy the old tree to an approved archive path.
- Then commit deletion or migration separately.

Risk:

- Medium to high.
- Requires explicit archive destination and rollback plan.

## Recommended default

- No action until the user chooses A, B, or C.
- The preservation tag and export should be retained as rollback evidence before any future migration.

## Questions to ask the user

1. Should `04-tasks/**` be restored?
2. Is `03-projects/04-tasks/**` the intended replacement?
3. Do you want an archive or tag before migration?
4. Should this be one commit or split by subfolder?

## Warning

Do not commit this alongside `04-tasks/**` deletions unless the user approves a task-tree migration commit.
