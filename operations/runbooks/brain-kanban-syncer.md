# Brain Kanban Syncer Runbook

**Status:** ✓ PRODUCTION (Python + Cron)

## Post-Reboot / After OS Reinstall

**Everything auto-resumes — no action needed.** But verify it's working:

```bash
# Comprehensive health check (run after reboot or any time)
bash ~/Repos/stevewesthoek/brain/tools/scripts/brain-automate-verify.sh

# Check recent activity
tail -20 ~/.local/share/brain/logs/kanban-syncer.log
```

**What persists automatically:**
- ✓ Cron job (stored in OS, not filesystem)
- ✓ GitHub PAT token (`~/.config/github/.env`)
- ✓ Python script (`~/Repos/stevewesthoek/brain/tools/scripts/`)
- ✓ Logs and state

---

## Overview

The Kanban Syncer is a Python script that automatically synchronizes task data from `notes/04-tasks/` into the Obsidian canvas at `notes/kanban.canvas` every 10 minutes.

**What it does:**
1. Scans `notes/04-tasks/` for all task files with `type: task`
2. Parses task metadata (status, priority, title, project)
3. Loads the existing `kanban.canvas` (Obsidian JSON canvas)
4. Removes all task card nodes (preserves column headers, instructions, blocked section)
5. Rebuilds task card nodes mapped to the correct column by status:
   - `status: ready` → BACKLOG column (left)
   - `status: in-progress` → DOING column (middle)
   - `status: done` → DONE column (right)
6. Sorts tasks within each column by priority (1=highest, appears at top)
7. Writes updated canvas to disk
8. Only commits to git if canvas actually changed
9. Logs all actions for debugging

**Why it exists:**
The Project Decomposer creates task files automatically. Those files live as `.md` files with full metadata in frontmatter. But Obsidian's UI is the human workspace — people interact with the Kanban board. The Kanban Syncer keeps the canvas synchronized with the source-of-truth task files without manual copy-paste.

---

## Installation & Configuration

### Prerequisites
- Python 3.7+
- Git installed and authenticated
- GitHub PAT token stored in `~/.config/github/.env`

### Verify Installation

Run the verification script:

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/brain-automate-verify.sh
```

This checks:
- ✓ Cron job is installed
- ✓ Python script is executable
- ✓ GitHub credentials are valid
- ✓ Git repo is accessible
- ✓ Logs directory exists

### Setup (Manual, only if verification fails)

```bash
# Check script is executable
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

# Check cron job is installed
crontab -l | grep brain-kanban-syncer
```

If not installed, run:
```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

# Install cron job
(crontab -l 2>/dev/null | grep -v "brain-kanban-syncer"; echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py >> /dev/null 2>&1") | crontab -
```

---

## How It Works

### Canvas Structure

The `kanban.canvas` file is JSON with two top-level keys: `nodes` (task cards and headers) and `edges` (connections, always empty for this workflow).

**Static nodes** (always preserved):
1. **Column headers** (never deleted):
   - `backlog-header`: "BACKLOG — Ready tasks not yet started" (x=-540, y=-300)
   - `todo-header`: "TO DO — Pick 1-3 for today" (x=-180, y=-300)
   - `doing-header`: "DOING — In progress (keep < 2)" (x=180, y=-300)
   - `done-header`: "DONE — Completed today" (x=540, y=-300)

2. **Helper sections** (never deleted):
   - `instructions`: Usage guide (x=-180, y=420)
   - `blocked-section`: Blocked tasks sidebar (x=-540, y=100)

**Dynamic nodes** (replaced each sync):
- Task card nodes with `id: "task-*"` and `type: "file"`
- Each links to the actual task file in the vault
- Positioned under column headers, sorted by priority

### Task Node Structure

Each task is represented as a file-link node:

```json
{
  "id": "task-001-select-creator-niche",
  "type": "file",
  "file": "notes/04-tasks/project-slug/001-select-creator-niche.md",
  "x": -540,
  "y": -160,
  "width": 200,
  "height": 80
}
```

- `id`: Unique identifier derived from filename
- `type: "file"`: Tells Obsidian to render this as a file link
- `file`: Vault-relative path to the actual task `.md` file (clicking it opens the task)
- `x, y`: Canvas position (column and row)
- `width, height`: Card dimensions (200x80 fits column width)

### Column Mapping

| Status Value | Kanban Column | X Coordinate |
|---|---|---|
| `ready` | BACKLOG | -540 |
| `in-progress` | DOING | 180 |
| `done` | DONE | 540 |
| (other) | BACKLOG (default) | -540 |

**TO DO column (x=-180)** is **never touched by automation** — it's for manual drag-and-drop. Users pick 1-3 tasks from BACKLOG to work on each day.

### Positioning and Layout

**Horizontal layout:**
- Column centers at x = -540, -180, 180, 540 (360px apart)
- Column width = 200px
- Headers at y = -300

**Vertical layout within columns:**
- First task card: y = -160 (just below the header)
- Each subsequent card: y += 100 (100px vertical spacing)
- Cards stack downward if more than ~15 tasks

**Priority sorting:**
- Within each column, tasks sorted by `priority` field (ascending)
- Priority 1 at the top, higher numbers below
- Same-priority tasks keep insertion order

### Idempotency

The syncer only commits if the canvas actually changed:
1. Before writing, compare new canvas JSON with existing
2. If identical (same nodes, same positions): skip commit
3. If different: write, commit, push

This prevents empty commits every 10 minutes.

---

## Task File Format

Tasks are standard `.md` files created by the Project Decomposer:

```yaml
---
type: task
title: "Task Title"
assigned_to: you|ai
status: ready|in-progress|done
priority: 1-5
effort: small|medium|large
project: [[notes/03-projects/project-name]]
---

## What to Do
Description...

## Acceptance Criteria
- [ ] Criterion 1
```

Only the frontmatter fields are used by the syncer. The `type`, `status`, and `priority` fields are critical:
- `type: task` — must be present for the syncer to include it
- `status` — maps to column (ready→BACKLOG, in-progress→DOING, done→DONE)
- `priority` — sorts tasks within column (1=highest)

---

## Logging

### Log Files
- **Success log:** `~/.local/share/brain/logs/kanban-syncer.log`
- **Error log:** `~/.local/share/brain/logs/kanban-syncer-error.log`

### View Logs
```bash
# Recent syncs
tail -20 ~/.local/share/brain/logs/kanban-syncer.log

# Recent errors
tail -20 ~/.local/share/brain/logs/kanban-syncer-error.log

# Follow live
tail -f ~/.local/share/brain/logs/kanban-syncer.log
```

### Sample Log Output
```
2026-04-10 23:35:42,000 - brain-kanban-syncer - INFO - ✓ Synced kanban canvas
2026-04-10 23:45:00,000 - brain-kanban-syncer - DEBUG - Canvas unchanged, skipping commit
2026-04-10 23:55:15,000 - brain-kanban-syncer - DEBUG - No task files found
```

---

## Manual Execution

Run the syncer manually (outside cron) for testing or immediate sync:

```bash
# Direct execution
~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

# With verbose output
python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py
```

---

## Cron Job Management

### View Current Job
```bash
crontab -l
```

### Edit Cron Expression
To change frequency (e.g., every 5 minutes instead of 10):

```bash
crontab -e
# Change: */10 * * * * → */5 * * * *
# Save and exit
```

**Common frequencies:**
- Every 5 minutes: `*/5 * * * *` (more responsive)
- Every 10 minutes: `*/10 * * * *` (current, balanced)
- Every 15 minutes: `*/15 * * * *` (less responsive)

### Disable Temporarily
```bash
# Remove from crontab
crontab -r

# Reinstall later
(crontab -l 2>/dev/null; echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py >> /dev/null 2>&1") | crontab -
```

---

## Troubleshooting

### Script Not Running

**Check if cron job exists:**
```bash
crontab -l | grep brain-kanban-syncer
```

**Check if script is executable:**
```bash
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py
# Should show: -rwxr-xr-x
```

### No Tasks Appearing on Board

**Check if task files exist:**
```bash
ls ~/Repos/stevewesthoek/brain/notes/04-tasks/
```

If no files exist, they need to be created by the Project Decomposer. Check that workflow first.

**Check task file format:**
```bash
head -15 ~/Repos/stevewesthoek/brain/notes/04-tasks/project-slug/001-task-name.md
# Should have: type: task, status, priority in frontmatter
```

**Check logs:**
```bash
tail -20 ~/.local/share/brain/logs/kanban-syncer-error.log
```

### Canvas Not Updating in Obsidian

Canvas changes are written to disk and committed to git. Obsidian must reload the file:
- Close and re-open the Kanban canvas
- Or: swipe right on the tab in Obsidian mobile to refresh
- Or: use Cmd+R on desktop to reload

**Check if canvas was actually synced:**
```bash
cd ~/Repos/stevewesthoek/brain
git log --oneline -5 -- notes/kanban.canvas
# Should show recent "brain: sync kanban canvas" commits
```

### Git Push Failures

**Error:** `! [rejected] main -> main (fetch first)`

**Fix:** The script handles this with `git pull --rebase`, but if it persists:
```bash
cd ~/Repos/stevewesthoek/brain
git pull --rebase
git push
```

---

## Testing

### Create a Test Task

```bash
cd ~/Repos/stevewesthoek/brain

# Create test task folder
mkdir -p notes/04-tasks/test-project

# Create test task file
cat > notes/04-tasks/test-project/001-test-task.md << 'EOF'
---
type: task
title: "Test Task"
assigned_to: you
status: ready
priority: 3
effort: small
project: [[notes/03-projects/test-project]]
---

## What to Do
This is a test task for the Kanban Syncer.

## Acceptance Criteria
- [ ] Test that task appears on board
- [ ] Verify correct column (BACKLOG for status: ready)
EOF

# Commit and push
git add notes/04-tasks/test-project/001-test-task.md
git commit -m "test: add test task"
git push
```

### Run Syncer

```bash
# Run script
~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

# Check logs
tail -20 ~/.local/share/brain/logs/kanban-syncer.log
```

### Verify in Canvas

```bash
# Check canvas was updated
cat notes/kanban.canvas | jq '.nodes[] | select(.id == "task-001-test-task")'
# Should output the task node with x=-540 (BACKLOG column)
```

**Expected results:**
- Task card node appears in kanban.canvas
- ID is `task-001-test-task`
- Positioned in BACKLOG column (x=-540, y=-160)
- File link points to `notes/04-tasks/test-project/001-test-task.md`
- All 6 static nodes preserved (headers, instructions, blocked section)
- Git commit pushed with message: `brain: sync kanban canvas from tasks`

---

## Performance Notes

### Resource Usage
- **Per sync:** 50-200ms (JSON parsing, file I/O)
- **Per cycle (every 10 min):** 50-200ms active, rest idle
- **Memory:** ~5-8MB baseline
- **CPU:** Negligible, <1% active time

### Frequency Tuning

The current frequency (every 10 minutes) is appropriate for:
- Tasks changing status manually (user updates task file status in Obsidian)
- Project Decomposer running every 5 minutes (new tasks added)
- Reasonable git commit frequency (not every minute)

If you want **more responsive** canvas updates:
- Change to `*/5 * * * *` (every 5 minutes)
- Still minimal resource impact
- Better aligned with Project Decomposer frequency

---

## Data Flow Diagram

```
Task Files (04-tasks/)
        ↓
    [Parser]
        ↓
Task Metadata (status, priority, title)
        ↓
    [Grouper] — organize by status
        ↓
Nodes by Column (BACKLOG, DOING, DONE)
        ↓
Load existing kanban.canvas
        ↓
Preserve static nodes (headers, instructions, blocked)
        ↓
Build canvas (static + task nodes)
        ↓
Write to kanban.canvas
        ↓
Git commit (if changed) → GitHub
```

---

## Integration with Other Automations

**Upstream:** Project Decomposer → creates tasks in `04-tasks/`  
**Downstream:** Kanban Syncer reads those tasks, updates canvas

**Workflow:**
1. Auto-Router routes high-quality note to `03-projects/` (every 1 min)
2. Project Decomposer decomposes project, creates tasks in `04-tasks/` (every 5 min)
3. **Kanban Syncer reads tasks, updates canvas** (every 10 min)
4. User sees new tasks appear on Kanban board in Obsidian

The three work independently but in sequence.

---

## Quick Reference

| Action | Command |
|--------|---------|
| View logs | `tail -f ~/.local/share/brain/logs/kanban-syncer.log` |
| Run manually | `~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py` |
| Edit cron | `crontab -e` |
| Check cron | `crontab -l` |
| List tasks | `ls notes/04-tasks/` |
| View canvas | `cat notes/kanban.canvas \| jq` |
| Check recent commits | `git log --oneline -5 -- notes/kanban.canvas` |
| Disable | `crontab -r` |

---

## Support

For issues:
1. Check logs: `tail -20 ~/.local/share/brain/logs/kanban-syncer*.log`
2. Run manually: `~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py`
3. Check canvas exists: `ls -la notes/kanban.canvas`
4. Check task files: `ls -la notes/04-tasks/`
5. Test git access: `cd ~/Repos/stevewesthoek/brain && git pull && git push`

Last updated: 2026-04-10
