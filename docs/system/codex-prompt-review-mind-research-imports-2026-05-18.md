# Codex Prompt — Review Mind Research Imports

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- `06-resources/research/notes/bible/denominations/**`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not stage without explicit review
- Do not inspect secrets, logs, or runtime files

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git ls-files --others --exclude-standard -- 06-resources/research/notes/bible/denominations
git diff --name-only -- 06-resources/research/notes/bible/denominations
git diff --stat -- 06-resources/research/notes/bible/denominations
```

Preview / review commands:

```bash
git diff -- 06-resources/research/notes/bible/denominations/<exact-path>
```

Decision rules:

- Commit only if the import is intentionally curated.
- Restore or delete if the material is accidental or duplicated.
- Treat this as source-ingestion work, not housekeeping.

Explicit staging pathspecs only:

```bash
git add -- 06-resources/research/notes/bible/denominations/<exact-path>
```

Rollback:

```bash
git restore --staged -- 06-resources/research/notes/bible/denominations
git restore -- 06-resources/research/notes/bible/denominations
```

Final report format:

1. Category reviewed.
2. Import source reviewed.
3. Decision.
4. Files staged or restored.
5. Remaining risk.
