# Codex Prompt — Review Mind `.obsidian` Churn

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- `.obsidian/**`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not stage without explicit review
- Do not delete anything
- Do not inspect secrets or runtime stores

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git status --short -- .obsidian
git diff --stat -- .obsidian
git diff --name-only -- .obsidian
git diff -- .obsidian/community-plugins.json
```

Preview / review commands:

```bash
git diff -- .obsidian/community-plugins.json
git diff -- .obsidian/bookmarks.json
```

Decision rules:

- Commit only if the change is explicitly intended and safe.
- Restore if the change is accidental or policy churn.
- Ignore if it is environment-specific plugin noise.

Explicit staging pathspecs only:

```bash
git add -- .obsidian/community-plugins.json
git add -- .obsidian/bookmarks.json
```

Rollback:

```bash
git restore --staged -- .obsidian
git restore -- .obsidian
```

Final report format:

1. Category reviewed.
2. Files inspected.
3. Decision.
4. Files staged or restored.
5. Remaining risk.
