# Mind Project Task Mirror Review

**Date:** 2026-05-18

## Summary

- Count: 743 files
- Approximate size: 3.0 MB
- Representative paths:
  - `03-projects/04-tasks/family-tasks/0374-aangifte-omzetbelasting-einde-maand.md`
  - `03-projects/04-tasks/family-tasks/0001-aangifte-omzetbelasting-einde-maand.md`
  - `03-projects/04-tasks/business-tasks/0241-read-book-the-one-things-by-gary-keller.md`

## Classification

Duplicate/mirror of the deleted `04-tasks/**` tree.

Signals:

- identical task-style naming patterns
- same business/family/church task groupings
- overlapping task titles with the deleted legacy tree

## Risk

High. This is a large task tree mirror and should not be staged together with legacy deletions unless the user explicitly approves a task-tree migration commit.

## Relationship to deleted `04-tasks/**`

The mirror appears to contain the same content family as the deleted legacy task tree, so it should be treated as related but not authoritative until the user confirms which tree should remain.

## Recommended decision

- Keep untracked pending review.
- Do not commit in this cleanup pass.
- If this tree is authoritative, it should be committed in a dedicated task-tree migration commit.
- If it is duplicate, delete only after user approval and after confirming the source of truth.

## Safe future commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git diff --name-only -- '03-projects/04-tasks/**'
git diff --stat -- '03-projects/04-tasks/**'
git add -- '03-projects/04-tasks/**'
git clean -n -- '03-projects/04-tasks/**'
rm -rf -- '03-projects/04-tasks'
```

## Rollback

```bash
git restore --staged -- '03-projects/04-tasks/**'
git restore -- '03-projects/04-tasks/**'
```

## Warning

Do not commit this alongside `04-tasks/**` deletions unless the user approves a task-tree migration commit.
