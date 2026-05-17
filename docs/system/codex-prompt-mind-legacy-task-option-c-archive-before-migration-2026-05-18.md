# Codex Prompt - Mind Legacy Task Option C Archive Before Migration

## Repos

- brain: /Users/Office/Repos/stevewesthoek/brain
- mind: /Users/Office/Repos/stevewesthoek/mind

## Goal

Prepare an archive or export of the legacy task tree before any restore or migration decision.

## Safety rules

- Do not delete or move any legacy numbered folder yet.
- Do not use `git add .` or `git add -A`.
- Do not force-push.
- Do not touch `.obsidian/**`, research imports, or unrelated area notes.

## Preview commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git status --short -- '04-tasks/**' '03-projects/04-tasks/**'
git diff --name-only -- '04-tasks/**' '03-projects/04-tasks/**'
git diff --stat -- '04-tasks/**' '03-projects/04-tasks/**'
```

## Archive preparation steps

- Create a tag or branch before any migration.
- Export the file list.
- Optionally copy the old tree to an approved archive path.
- Verify the archive before deciding restore or migrate.

## Recommended commands

```bash
git tag mind-legacy-task-archive-prep-2026-05-18
git branch mind-legacy-task-archive-prep-2026-05-18
git diff --name-only -- '04-tasks/**' > /tmp/mind-04-tasks-files.txt
```

## Validation

- Confirm the archive destination is approved.
- Confirm the export file exists.
- Do not delete or migrate until the archive is verified.

## Final report format

1. Commands run
2. Archive/tag created
3. Export file path
4. Verified archive destination
5. Whether migration is still pending
6. Blockers
