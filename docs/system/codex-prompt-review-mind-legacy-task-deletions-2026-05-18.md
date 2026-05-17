# Codex Prompt — Review Mind Legacy Task Deletions

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- deleted `04-tasks/**`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not delete anything automatically
- Do not move legacy numbered folders
- Do not stage deletions without explicit review

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git status --short -- 04-tasks
git diff --name-only --diff-filter=D -- 04-tasks
git diff --stat -- 04-tasks
```

Preview / review commands:

```bash
git diff -- 04-tasks/<exact-path>
```

Decision rules:

- Commit only if the deletion is clearly intended and reviewed.
- Restore if the deletion is accidental.
- Do not auto-approve a bulk delete.

Explicit staging pathspecs only:

```bash
git add -- 04-tasks/<exact-path>
```

Rollback:

```bash
git restore --staged -- 04-tasks
git restore -- 04-tasks
```

Final report format:

1. Category reviewed.
2. Deletion count reviewed.
3. Decision.
4. Files staged or restored.
5. Remaining risk.
