# Codex Prompt - Mind Legacy Task Option A Restore Old Tree

## Repos

- brain: /Users/Office/Repos/stevewesthoek/brain
- mind: /Users/Office/Repos/stevewesthoek/mind

## Goal

Restore `04-tasks/**` and discard the `03-projects/04-tasks/**` mirror only after explicit confirmation inside this prompt.

## Safety rules

- Do not use `git add .` or `git add -A`.
- Do not touch `.obsidian/**`, `06-resources/**`, or unrelated area notes.
- Do not force-push.
- Do not use broad destructive cleanup.

## Preview commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git status --short -- '04-tasks/**' '03-projects/04-tasks/**'
git diff --name-only -- '04-tasks/**'
git diff --name-only -- '03-projects/04-tasks/**'
git diff --stat -- '04-tasks/**' '03-projects/04-tasks/**'
```

## Restore flow

```bash
git restore -- '04-tasks/**'
git clean -n -- '03-projects/04-tasks/'
```

Only delete the mirror if the user explicitly confirms:

```bash
git clean -fd -- '03-projects/04-tasks/'
```

## Validation

- Re-run `git status --short`.
- Confirm the chosen category is clean.
- Do not create a commit unless tracked state changes require it.

## Final report format

1. Commands run
2. Files restored
3. Mirror previewed
4. Whether the mirror was deleted
5. Remaining dirty state
6. Blockers
