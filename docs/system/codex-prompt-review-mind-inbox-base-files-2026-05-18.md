# Codex Prompt — Review Mind Inbox Base Files

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- `01-inbox/*.base`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not stage without explicit review
- Do not inspect secrets or logs
- Do not clean the directory blindly

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git ls-files --others --exclude-standard -- 01-inbox
git diff --name-only -- 01-inbox
git diff --stat -- 01-inbox
```

Preview / review commands:

```bash
git status --short -- 01-inbox
```

Decision rules:

- Commit only if the files are intentionally generated capture artifacts.
- Ignore if they are editor junk.
- Delete only after explicit review if they are accidental.

Explicit staging pathspecs only:

```bash
git add -- 01-inbox/Untitled.base
git add -- "01-inbox/Untitled 1.base"
git add -- "01-inbox/Untitled 2.base"
```

Rollback:

```bash
git restore --staged -- 01-inbox
git restore -- 01-inbox
```

Final report format:

1. Category reviewed.
2. Files reviewed.
3. Decision.
4. Files staged, deleted, or restored.
5. Remaining risk.
