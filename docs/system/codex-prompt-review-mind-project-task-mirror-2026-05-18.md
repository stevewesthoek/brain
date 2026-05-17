# Codex Prompt — Review Mind Project Task Mirror

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- `03-projects/04-tasks/**`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not stage a mirror tree without explicit review
- Do not mutate unrelated Mind files

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git ls-files --others --exclude-standard -- 03-projects/04-tasks
git diff --name-only -- 03-projects/04-tasks
git diff --stat -- 03-projects/04-tasks
```

Preview / review commands:

```bash
git diff -- 03-projects/04-tasks/<exact-path>
```

Decision rules:

- Commit only if the mirror is intentionally maintained.
- Restore or delete after review if it is accidental duplication.
- Treat it as a separate review from `04-tasks`.

Explicit staging pathspecs only:

```bash
git add -- 03-projects/04-tasks/<exact-path>
```

Rollback:

```bash
git restore --staged -- 03-projects/04-tasks
git restore -- 03-projects/04-tasks
```

Final report format:

1. Category reviewed.
2. Mirror contents reviewed.
3. Decision.
4. Files staged or restored.
5. Remaining risk.
