# Mind Workspace Isolation Runbook

## Purpose

Document how to isolate the unrelated dirty state in the `mind` repo without staging or mutating it blindly.

## Current known dirty categories

- `.obsidian` churn
- deleted `04-tasks/**`
- untracked `03-projects/04-tasks/`
- untracked `06-resources/research/notes/bible/denominations/`
- unrelated `05-areas/theological-studies/dance-of-life/README.md` change

See also:

- `operations/reports/mind-dirty-state-inventory-2026-05-18.md`
- `operations/reports/mind-cleanup-decision-matrix-2026-05-18.md`
- `operations/reports/mind-obsidian-churn-review-2026-05-18.md`
- `operations/reports/mind-legacy-task-deletion-review-2026-05-18.md`
- `operations/reports/mind-project-task-mirror-review-2026-05-18.md`
- `operations/reports/mind-research-import-review-2026-05-18.md`

## Rules for future cleanup

- Inspect one category at a time.
- Never use `git add .` or `git add -A`.
- Never stage legacy task deletions without explicit review.
- Never stage `.obsidian` plugin/config churn without explicit review.
- Keep Mind OS safe docs separate from unrelated churn.
- Prefer one commit per category when the user approves cleanup.

## Safe diagnostic commands

```bash
git status --short
git diff --stat
git diff --name-only
git diff -- <specific-safe-path>
```

## Suggested cleanup commits

- Obsidian config cleanup
- Legacy task deletion review
- Inbox base-file review
- Research folder import review

## Rollback commands

```bash
git restore --staged <path>
git restore -- <path>
git clean -n <path>
git clean -fd <path>
```

Only use `git clean -fd <path>` after explicit approval for the exact path.
