# Codex Prompt — Review Mind Unrelated Area Note

Repo: `/Users/Office/Repos/stevewesthoek/mind`

Scope:

- `05-areas/theological-studies/dance-of-life/README.md`

Safety rules:

- Do not use `git add .` or `git add -A`
- Do not stage without explicit review
- Do not touch other area notes

Diagnostic commands:

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git diff -- 05-areas/theological-studies/dance-of-life/README.md
git diff --stat -- 05-areas/theological-studies/dance-of-life/README.md
```

Preview / review commands:

```bash
git diff -- 05-areas/theological-studies/dance-of-life/README.md
```

Decision rules:

- Commit only if the note edit is explicitly intended.
- Restore if the change is accidental.
- Keep the review limited to this exact file.

Explicit staging pathspecs only:

```bash
git add -- 05-areas/theological-studies/dance-of-life/README.md
```

Rollback:

```bash
git restore --staged -- 05-areas/theological-studies/dance-of-life/README.md
git restore -- 05-areas/theological-studies/dance-of-life/README.md
```

Final report format:

1. File reviewed.
2. Decision.
3. Files staged or restored.
4. Remaining risk.
