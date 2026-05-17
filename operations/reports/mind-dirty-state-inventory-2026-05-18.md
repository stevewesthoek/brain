# Mind Dirty-State Inventory

**Date:** 2026-05-18

## Executive Summary

Current Mind repo state is now limited to `.obsidian` plugin/config churn after the legacy task migration and empty placeholder cleanup.

- Modified tracked files: 1
- Deleted tracked files: 0
- Untracked files/directories: 4
- Known dirty categories:
  - `.obsidian/community-plugins.json` modified
  - `.obsidian/plugins/custom-sort/`
  - `.obsidian/plugins/ghostty-terminal/`
  - `.obsidian/plugins/obsidian-icon-folder/`
- Cleanups already completed:
  - `01-inbox/*.base` editor artifacts were reviewed and deleted
  - `04-tasks/**` legacy tree was migrated into `03-projects/04-tasks/**`
  - empty `06-resources/research/notes/bible/denominations/catholism.md` placeholder was deleted

## Category Inventory

### 1. `.obsidian` churn

- Risk: high
- Likely source/cause: Obsidian plugin/config drift or local vault settings changes
- Recommended decision: manual review by exact path; commit only reviewed plugin enablement if explicitly approved
- Review report: `operations/reports/mind-obsidian-churn-review-2026-05-18.md`
- Exact-path review: `operations/reports/mind-obsidian-exact-path-review-2026-05-18.md`
- Resolution report: `operations/reports/mind-obsidian-resolution-2026-05-18.md`
- Safe diagnostic commands:
  - `git diff -- .obsidian`
  - `git diff --stat -- .obsidian`
  - `git diff --name-only -- .obsidian`
- Safe staging commands if approved later:
  - `git add -- .obsidian/community-plugins.json`
  - `git add -- .obsidian/plugins/custom-sort/main.js`
  - `git add -- .obsidian/plugins/custom-sort/manifest.json`
  - `git add -- .obsidian/plugins/ghostty-terminal/main.js`
  - `git add -- .obsidian/plugins/ghostty-terminal/manifest.json`
  - `git add -- .obsidian/plugins/ghostty-terminal/styles.css`
  - `git add -- .obsidian/plugins/obsidian-icon-folder/main.js`
  - `git add -- .obsidian/plugins/obsidian-icon-folder/manifest.json`
  - `git add -- .obsidian/plugins/obsidian-icon-folder/styles.css`
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

- Risk: resolved via migration commit
- Likely source/cause: mirror/import tree or duplicated task structure
- Recommended decision: migration completed; no further action unless a reverse migration is required
- Review report: `operations/reports/mind-project-task-mirror-review-2026-05-18.md`
- Safe diagnostic commands:
  - `git show --stat --summary 12495d4`
  - `git diff --name-only HEAD~1..HEAD -- 04-tasks 03-projects/04-tasks`
- Rollback commands:
  - `git revert 12495d4`

### 5. Untracked `06-resources/research/notes/bible/denominations/`

- Risk: low after empty placeholder deletion
- Likely source/cause: empty placeholder or abandoned import stub
- Recommended decision: no action unless real content is later added
- Review report: `operations/reports/mind-research-import-review-2026-05-18.md`
- Resolution report: `operations/reports/mind-research-placeholder-resolution-2026-05-18.md`
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
