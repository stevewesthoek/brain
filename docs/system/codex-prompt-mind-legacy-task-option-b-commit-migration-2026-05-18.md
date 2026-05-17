# Codex Prompt - Mind Legacy Task Option B Commit Migration

## Repos

- brain: /Users/Office/Repos/stevewesthoek/brain
- mind: /Users/Office/Repos/stevewesthoek/mind

## Goal

Commit the migration from `04-tasks/**` to `03-projects/04-tasks/**` only if the user explicitly approves the high-risk bulk change.

## Safety rules

- Do not use `git add .` or `git add -A`.
- Do not mix with `.obsidian/**`, research imports, or area-note changes.
- Do not force-push.
- Do not delete any file outside the exact task-tree paths.

## Preview commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git status --short -- '04-tasks/**' '03-projects/04-tasks/**'
git diff --stat -- '04-tasks/**' '03-projects/04-tasks/**'
git diff --name-only -- '04-tasks/**' '03-projects/04-tasks/**'
```

## Explicit stage commands

```bash
git add -- '04-tasks/**'
git add -- '03-projects/04-tasks/**'
git diff --cached --stat
git diff --cached --name-only
```

## Confirmation gate

Do not commit until the cached diff is reviewed and the user explicitly confirms the migration.

## Commit and push

```bash
git commit -m "Migrate legacy tasks into project task mirror"
git push origin main
```

## Validation

- Confirm the cached diff contains only the two task-tree paths.
- Re-run `git status --short`.

## Final report format

1. Commands run
2. Files staged
3. Commit hash
4. Push status
5. Remaining dirty state
6. Blockers
