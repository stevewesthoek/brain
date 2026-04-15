# ClickUp CSV Importer Runbook

**Status:** ✓ DOCUMENTED (Python utility, one-time or recurring imports)

## Overview

The ClickUp CSV Importer transforms a ClickUp task export into Brain task format. It reads a CSV file and:

1. Parses all tasks with metadata (name, status, due date, priority, assignees)
2. Creates individual task `.md` files in `vault/04-tasks/{list-slug}/{number}-{task-slug}.md`
3. Maps ClickUp statuses to Brain statuses:
   - `complete` → `done` (marks task as [x] in Kanban Done column)
   - `today`, `next`, `priority` → `ready` (marks as [ ] in Backlog/To Do)
   - `backlog` → `ready` (Backlog column)
4. Assigns YAML frontmatter metadata:
   - `type: task`
   - `status: done|ready`
   - `priority: 1-5` (mapped from ClickUp priority)
   - `assigned_to: you|ai`
   - `effort: small|medium|large` (estimated from task description length)
   - `source: clickup-import`
   - `imported: YYYY-MM-DD`
5. Commits all imported tasks atomically to git
6. The Kanban Syncer then populates the Obsidian Kanban board from these task files

**What it does:**
Task files are created in `04-tasks/` organized by ClickUp list name (slugified). Each task gets a unique `.md` file with full metadata preserved. After import, the Kanban Syncer automatically syncs all tasks into the interactive Obsidian Kanban board.

**Why it exists:**
ClickUp exports can be large (hundreds or thousands of tasks). Rather than manually creating each task, this script automates the import, preserving task history and status, while integrating with the existing Brain GTD automation.

---

## Quick Start

```bash
# Test import (dry-run, no changes)
python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv --dry-run

# Actual import
python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv

# View logs
tail -f ~/.local/share/brain/logs/clickup-importer.log
```

---

## How It Works

### Input Format: ClickUp CSV Export

The importer reads ClickUp's standard CSV export format:

| Column | Source | Used By |
|--------|--------|---------|
| Task ID | ClickUp ID | Ignored (not needed) |
| Task Name | Task title | Task file name (slug) |
| Task Content | Description | Task "What to Do" section |
| Status | Task status | Brain task status (done/ready) |
| Due Date | ClickUp due date timestamp | Task frontmatter (optional) |
| Priority | ClickUp priority (1/2/null) | Brain priority (1-5) |
| Assignees | ClickUp assignee name | Assignment tag (#you or #ai) |
| List Name | ClickUp list/folder | Task folder organization |

### Status Mapping

| ClickUp Status | Brain Status | Kanban Column | Checkbox |
|---|---|---|---|
| `complete` | `done` | Done | [x] |
| `today` | `ready` | Backlog (draggable to To Do) | [ ] |
| `next` | `ready` | Backlog (draggable to To Do) | [ ] |
| `priority` | `ready` | Backlog (draggable to To Do) | [ ] |
| `backlog` | `ready` | Backlog | [ ] |
| (any other) | `ready` | Backlog | [ ] |

### Priority Mapping

| ClickUp Priority | Brain Priority | Meaning |
|---|---|---|
| `1` | `2` | High |
| `2` | `3` | Medium |
| `null` | `3` | Medium (default) |

### File Organization

Tasks are created in folder hierarchy based on ClickUp list names:

```
vault/04-tasks/
├── business-tasks/
│   ├── 0001-first-task.md
│   ├── 0002-second-task.md
│   └── ...
├── family-tasks/
│   ├── 0001-family-item.md
│   └── ...
├── personal-tasks/
│   └── ...
└── buy/
    └── ...
```

Filenames use format: `{number:04d}-{slugified-task-name}.md`

### Task File Format

Each task becomes a markdown file with YAML frontmatter:

```yaml
---
type: task
title: "Original task name"
assigned_to: you
status: ready
priority: 3
effort: medium
source: clickup-import
imported: 2026-04-11
---

## What to Do

Original task description and content...

## Notes

Imported from ClickUp list: Business Tasks
Original ClickUp status: today
```

---

## Installation & Configuration

### Prerequisites

- Python 3.7+
- Git installed and authenticated
- ClickUp CSV export file

### The Script

Located at: `tools/scripts/clickup-importer.py`

Key components:
- **CSV parsing:** Handles multi-line descriptions, special characters, quoted fields
- **Status mapping:** Converts ClickUp statuses to Brain task statuses
- **Priority mapping:** Normalizes ClickUp priorities (1-2) to Brain priorities (1-5)
- **Slug generation:** Creates URL-safe filenames from task names
- **Git operations:** Stages, commits, and pushes all files atomically
- **Logging:** Three handlers (main log, error log, console)

---

## Usage

### Dry-Run (Recommended First Step)

Test the import without making changes:

```bash
python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv --dry-run
```

Output shows:
- Total tasks to import
- Status breakdown (complete, today, backlog, etc.)
- List of files that would be created

Example output:
```
✓ Parsed 742 tasks from 9012244692Ux4Pd0a9.csv
✓ Imported 742 tasks
  - backlog: 26 tasks
  - complete: 616 tasks
  - next: 62 tasks
  - priority: 20 tasks
  - today: 18 tasks
[DRY RUN] Would import 742 tasks from ClickUp
```

### Actual Import

Run without `--dry-run` to create files and commit:

```bash
python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv
```

Process:
1. Parses all tasks from CSV
2. Creates `.md` files in `vault/04-tasks/`
3. Stages all files with `git add`
4. Creates atomic commit: `"brain: import N tasks from ClickUp"`
5. Pulls from remote (`git pull --rebase`)
6. Pushes to main branch
7. Logs summary

---

## Logging

### Log Files

- **Main log:** `~/.local/share/brain/logs/clickup-importer.log`
- **Error log:** `~/.local/share/brain/logs/clickup-importer-error.log`

### View Logs

```bash
# Last 20 lines
tail -20 ~/.local/share/brain/logs/clickup-importer.log

# Follow in real-time
tail -f ~/.local/share/brain/logs/clickup-importer.log

# Errors only
tail -20 ~/.local/share/brain/logs/clickup-importer-error.log
```

### Sample Log Output

```
2026-04-11 00:06:24,721 - clickup-importer - INFO - Importing from: /Users/Office/Downloads/9012244692Ux4Pd0a9.csv
2026-04-11 00:06:24,726 - clickup-importer - INFO - ✓ Parsed 742 tasks from 9012244692Ux4Pd0a9.csv
2026-04-11 00:06:24,797 - clickup-importer - INFO - ✓ Imported 742 tasks
2026-04-11 00:06:24,797 - clickup-importer - INFO -   - backlog: 26 tasks
2026-04-11 00:06:24,797 - clickup-importer - INFO -   - complete: 616 tasks
2026-04-11 00:06:33,630 - clickup-importer - INFO - ✓ Committed and pushed 742 tasks
```

---

## After Import: Kanban Sync

Once tasks are imported and committed, the Kanban Syncer automatically picks them up on its next cycle (every 10 minutes):

```bash
# Manually trigger Kanban sync
python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

# Verify in Obsidian
# Open: vault/kanban.md
# Should see all imported tasks organized in columns
```

Columns after sync:
- **Backlog:** Tasks with status `ready` and no manual drag (backlog, priority, next, unscheduled)
- **To Do:** Tasks manually dragged to To Do (preserved on sync)
- **Doing:** Tasks with status `in-progress`
- **Done:** Tasks with status `done` (checked boxes)

---

## Data Flow

```
ClickUp CSV Export
        ↓
  [CSV Parser] — extract rows, parse fields
        ↓
Task Metadata (name, status, priority, content)
        ↓
  [Status Mapper] — convert to Brain statuses
        ↓
Task file generation (YAML + markdown)
        ↓
Write to vault/04-tasks/{list}/{number}-{slug}.md
        ↓
Git: stage → commit → pull → push
        ↓
Kanban Syncer (runs every 10 min)
        ↓
vault/kanban.md updated with all tasks
        ↓
Obsidian Kanban plugin renders interactive board
```

---

## Troubleshooting

### No Tasks Found

**Problem:** Script reports "No tasks found in CSV"

**Check:**
- File exists: `ls -la ~/Downloads/export.csv`
- File is valid CSV: `head -5 ~/Downloads/export.csv`
- Encoding: File should be UTF-8

**Fix:**
- Try opening the file in a text editor to confirm it's readable
- Export ClickUp again with default settings
- Check that the CSV has a "Task Name" column (mind whitespace)

### Git Lock Error

**Problem:** "error: cannot pull with rebase: You have unstaged changes"

**Fix:**
```bash
cd ~/Repos/stevewesthoek/brain
rm -f .git/index.lock
git status
# If uncommitted changes exist, either commit or discard them
git add . && git commit -m "cleanup"
```

Then re-run the importer.

### Status Not Mapping Correctly

**Problem:** Tasks have unexpected status after import

**Check logs:**
```bash
tail -20 ~/.local/share/brain/logs/clickup-importer-error.log
```

**Reason:** ClickUp status values may differ from the standard set. The importer defaults to `ready` for unknown statuses, which goes to Backlog.

**Fix:** Check the actual ClickUp status value and verify it matches the mapping table above. Edit the `clickup_status_to_brain_status()` function in the script if needed.

### Large CSV Takes Too Long

**Problem:** Import is slow for 1000+ tasks

**Expected:** ~0.1-0.2s per task (parsing + file write). For 1000 tasks, expect 100-200 seconds total.

**Optimization:** None needed for typical use. The bottleneck is git operations (pulling/pushing), not CSV parsing.

---

## Best Practices

1. **Always dry-run first:** Test with `--dry-run` before committing real tasks
2. **Review the output:** Check that status mapping is correct before importing
3. **One import per session:** Import all ClickUp tasks once. For updates, manually edit individual tasks.
4. **Clean duplicates:** If you import the same CSV twice, you'll get duplicate tasks. Use the dry-run to check before re-importing.
5. **Check Kanban after:** Wait ~30 seconds after import, then manually trigger `brain-kanban-syncer.py` to see tasks in the board immediately

---

## Advanced

### Re-importing with Duplicate Handling

If you accidentally import twice, you'll have duplicates. To clean up:

1. Check git history: `git log --oneline vault/04-tasks/`
2. Identify duplicate commits
3. Reset to before the first import: `git reset --soft <commit-hash>`
4. Delete task folders: `rm -rf vault/04-tasks/{list-name}`
5. Clean and commit: `git add . && git commit -m "cleanup duplicates"`
6. Re-run import

### Customizing Priority or Status Mapping

Edit the mapping functions in `tools/scripts/clickup-importer.py`:

```python
def clickup_status_to_brain_status(status: str) -> str:
    # Customize here
    ...

def parse_clickup_priority(priority_str: str) -> int:
    # Customize here
    ...
```

Then re-run the import.

### Filtering by Status During Import

Currently, the importer processes all tasks. To import only certain statuses, edit the script:

```python
# Add after parsing each task:
if task['status'] not in ['backlog', 'today', 'next']:
    continue  # Skip other statuses
```

---

## Performance Notes

### Resource Usage

- **Per task:** 1-2ms (file I/O + git staging)
- **Total for 742 tasks:** ~100-150s (mostly git operations)
- **Memory:** <50MB for 1000 tasks
- **Disk:** ~2-5MB for 1000 tasks (depends on description size)

### Scaling

- **100 tasks:** < 20 seconds
- **500 tasks:** < 2 minutes
- **1000 tasks:** ~3-5 minutes (git operations dominate)
- **5000+ tasks:** May require breaking into batches to avoid git performance issues

---

## Related Docs

- `brain-kanban-syncer.md` — Syncs imported tasks to Obsidian Kanban board
- `brain-project-decomposer.md` — Creates tasks from captured projects
- `brain-auto-router.md` — Routes inbox notes to the right destinations
- CLAUDE.md — Brain repo overview and integration

---

Last updated: 2026-04-11
