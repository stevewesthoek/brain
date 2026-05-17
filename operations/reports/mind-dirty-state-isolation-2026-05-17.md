# Mind Dirty-State Isolation Report

## Purpose

Document the unrelated dirty-state categories in `mind` so future cleanup can be reviewed one category at a time instead of staged broadly.

## Safe rule

- Never use `git add .` or `git add -A`.
- Stage only one reviewed category at a time with an explicit pathspec.
- Keep the Mind OS safe docs separate from unrelated churn.

## Current categories

### 1. Obsidian config and plugin churn

- Risk: high
- Scope: `.obsidian/**`
- Diagnostic commands:
  - `git diff -- .obsidian`
  - `git diff --stat -- .obsidian`
- Safe staging rule: do not stage without explicit review
- Rollback: `git restore --staged -- .obsidian && git restore -- .obsidian`
- Outcome: ignore until manually reviewed

### 2. Legacy `04-tasks/**` deletions

- Risk: high
- Scope: deleted legacy task files
- Diagnostic commands:
  - `git diff --name-only --diff-filter=D -- 04-tasks`
  - `git diff --stat -- 04-tasks`
- Safe staging rule: do not stage deletions without explicit user approval
- Rollback: `git restore --staged -- 04-tasks && git restore -- 04-tasks`
- Outcome: review before any commit

### 3. Inbox base files

- Risk: medium
- Scope: `01-inbox/*.base`
- Diagnostic commands:
  - `git diff --name-only -- 01-inbox`
  - `git diff --stat -- 01-inbox`
- Safe staging rule: only stage if the files are explicitly intended capture artifacts
- Rollback: `git restore --staged -- 01-inbox && git restore -- 01-inbox`
- Outcome: review before commit, otherwise ignore

### 4. `03-projects/04-tasks/` mirror

- Risk: medium
- Scope: `03-projects/04-tasks/**`
- Diagnostic commands:
  - `git diff --name-only -- 03-projects/04-tasks`
  - `git diff --stat -- 03-projects/04-tasks`
- Safe staging rule: do not stage without confirming whether it is a mirror or an import target
- Rollback: `git restore --staged -- 03-projects/04-tasks && git restore -- 03-projects/04-tasks`
- Outcome: review before commit

### 5. Research folder import

- Risk: medium
- Scope: `06-resources/research/notes/bible/denominations/**`
- Diagnostic commands:
  - `git diff --name-only -- 06-resources/research/notes/bible/denominations`
  - `git diff --stat -- 06-resources/research/notes/bible/denominations`
- Safe staging rule: only stage after the research import has been intentionally reviewed
- Rollback: `git restore --staged -- 06-resources/research/notes/bible/denominations && git restore -- 06-resources/research/notes/bible/denominations`
- Outcome: review before commit

### 6. Theological-studies note change

- Risk: low to medium
- Scope: `05-areas/theological-studies/dance-of-life/README.md`
- Diagnostic commands:
  - `git diff -- 05-areas/theological-studies/dance-of-life/README.md`
- Safe staging rule: only stage if the change was explicitly intended
- Rollback: `git restore --staged -- 05-areas/theological-studies/dance-of-life/README.md && git restore -- 05-areas/theological-studies/dance-of-life/README.md`
- Outcome: review before commit

## Suggested future review order

1. Obsidian config and plugin churn
2. Inbox base files in `01-inbox`
3. `03-projects/04-tasks` mirror
4. Legacy `04-tasks` deletions
5. Research folder import
6. Unrelated theological-studies note

## Staging pattern

Use explicit pathspecs only, for example:

```bash
git add -- <exact-path>
git diff --cached --name-only
git diff --cached --stat
```

## Cleanup policy

- Commit only one reviewed category per commit.
- Do not delete anything blindly.
- Do not clean unrelated workspace noise automatically.
- Preserve the Mind OS safe docs as a separate concern.
