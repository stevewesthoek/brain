# Mind Dirty-State Inventory

**Date:** 2026-05-18

## Executive Summary

Current Mind repo state is heavily dirty and must be isolated category by category.

- Modified tracked files: 1
- Deleted tracked files: 742
- Untracked files/directories: 9
- Known dirty categories:
  - `.obsidian` churn
  - migrated `04-tasks/**` into `03-projects/04-tasks/`
  - untracked `06-resources/research/notes/bible/denominations/`
  - unrelated `05-areas/theological-studies/dance-of-life/README.md`
- Low-risk cleanup result:
  - `01-inbox/*.base` editor artifacts were reviewed and deleted

## Category Inventory

### 1. `.obsidian` churn

- Risk: high
- Likely source/cause: Obsidian plugin/config drift or local vault settings changes
- Recommended decision: ignore until manual review
- Review report: `operations/reports/mind-obsidian-churn-review-2026-05-18.md`
- Exact-path review: `operations/reports/mind-obsidian-exact-path-review-2026-05-18.md`
- Safe diagnostic commands:
  - `git diff -- .obsidian`
  - `git diff --stat -- .obsidian`
  - `git diff --name-only -- .obsidian`
- Safe staging commands if approved later:
  - `git add -- .obsidian/community-plugins.json`
  - `git add -- .obsidian/bookmarks.json`
- Rollback commands:
  - `git restore --staged -- .obsidian`
  - `git restore -- .obsidian`

### 2. Deleted `04-tasks/**`

- Risk: resolved via migration commit
- Likely source/cause: bulk legacy task removal or rename/move activity
- Recommended decision: migration completed; preserve tag and export as rollback evidence
- Review report: `operations/reports/mind-legacy-task-deletion-review-2026-05-18.md`
- Preservation report: `operations/reports/mind-legacy-task-preservation-2026-05-18.md`
- Safe diagnostic commands:
  - `git show --stat --summary 12495d4`
  - `git diff --name-only HEAD~1..HEAD -- 04-tasks 03-projects/04-tasks`
- Rollback commands:
  - `git revert 12495d4`
  - `git restore --staged -- 04-tasks`
  - `git restore --staged -- 03-projects/04-tasks`

### 3. Untracked `01-inbox/*.base`

- Risk: medium
- Likely source/cause: editor-generated base files or capture artifacts
- Recommended decision: review individually; likely ignore or delete after review
- Safe diagnostic commands:
  - `git ls-files --others --exclude-standard -- 01-inbox`
  - `git diff --name-only -- 01-inbox`
- Safe staging commands if approved later:
  - `git add -- 01-inbox/Untitled.base`
- Rollback commands:
  - `git restore --staged -- 01-inbox`
  - `git restore -- 01-inbox`

### 4. Untracked `03-projects/04-tasks/`

- Risk: migrated into the project task mirror
- Likely source/cause: mirror/import tree or duplicated task structure
- Recommended decision: migration completed; no further action unless a reverse migration is required
- Review report: `operations/reports/mind-project-task-mirror-review-2026-05-18.md`
- Safe diagnostic commands:
  - `git show --stat --summary 12495d4`
  - `git diff --name-only HEAD~1..HEAD -- 04-tasks 03-projects/04-tasks`
- Rollback commands:
  - `git revert 12495d4`

### 5. Untracked `06-resources/research/notes/bible/denominations/`

- Risk: medium
- Likely source/cause: research import or bulk note creation
- Recommended decision: move to source import review
- Review report: `operations/reports/mind-research-import-review-2026-05-18.md`
- Safe diagnostic commands:
  - `git ls-files --others --exclude-standard -- 06-resources/research/notes/bible/denominations`
  - `git diff --name-only -- 06-resources/research/notes/bible/denominations`
- Safe staging commands if approved later:
  - `git add -- 06-resources/research/notes/bible/denominations/<exact-path>`
- Rollback commands:
  - `git restore --staged -- 06-resources/research/notes/bible/denominations`
  - `git restore -- 06-resources/research/notes/bible/denominations`

### 6. Unrelated `05-areas/theological-studies/dance-of-life/README.md`

- Risk: low to medium
- Likely source/cause: intentional note edit or unrelated content drift
- Recommended decision: review separately, then commit or restore
- Review report: `operations/reports/mind-area-note-review-2026-05-18.md`
- Safe diagnostic commands:
  - `git diff -- 05-areas/theological-studies/dance-of-life/README.md`
- Safe staging commands if approved later:
  - `git add -- 05-areas/theological-studies/dance-of-life/README.md`
- Rollback commands:
  - `git restore --staged -- 05-areas/theological-studies/dance-of-life/README.md`
  - `git restore -- 05-areas/theological-studies/dance-of-life/README.md`

### 7. Other category found

- Risk: unknown until reviewed
- Likely source/cause: miscellaneous unrelated workspace drift
- Recommended decision: inspect before staging
- Safe diagnostic commands:
  - `git diff --name-only`
  - `git diff --stat`
- Safe staging commands if approved later:
  - `git add -- <exact-path>`
- Rollback commands:
  - `git restore --staged -- <exact-path>`
  - `git restore -- <exact-path>`

## Explicit Warnings

- Do not run `git add .`
- Do not run `git add -A`
- Do not run `git clean -fd` broadly
- Do not stage legacy task deletions without explicit review
- Do not stage `.obsidian` churn without explicit review
