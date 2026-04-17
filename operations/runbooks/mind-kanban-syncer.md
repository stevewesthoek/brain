# Mind Kanban Syncer Runbook

**Status:** ✓ PRODUCTION (Python + Cron, Obsidian Kanban Plugin)

## Overview

The Kanban Syncer is a Python script that automatically populates `mind/kanban.md` every 10 minutes from task files in `mind/04-tasks/`. The Obsidian Kanban plugin renders this markdown as a beautiful, interactive drag-and-drop Kanban board.

**What it does:**
1. Scans `mind/04-tasks/` for all task files with `type: task`
2. Parses task metadata (title, status, priority, assigned_to)
3. Loads existing `mind/kanban.md` (if it exists) to preserve user drags
4. Generates 4 columns:
   - **Backlog** — tasks with `status: ready` (auto-populated)
   - **To Do** — user-dragged tasks (preserved each sync)
   - **Doing** — tasks with `status: in-progress` (auto-populated)
   - **Done** — tasks with `status: done` (auto-populated)
5. Color-codes cards by priority (red=p1, orange=p2, yellow=p3, green=p4, gray=p5) and assigned_to (blue=you, purple=ai)
6. Writes `mind/kanban.md` in Obsidian Kanban plugin markdown format
7. Only commits if file changed
8. Logs all actions for debugging

**Why it exists:**
Task files are the source of truth with full metadata in frontmatter. The Kanban board is the interactive UI where you work. The syncer keeps them in sync: automated columns populate from task status, while the To Do column preserves your manual drag-and-drop selections.

---

## Post-Reboot / After OS Reinstall

**Everything auto-resumes — no action needed.** But verify it's working:

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/mind-automate-verify.sh
tail -20 ~/.local/share/brain/logs/kanban-syncer.log
```

What persists automatically:
- ✓ Cron job (stored in OS)
- ✓ GitHub PAT token (`~/.config/github/.env`)
- ✓ Python script (`~/Repos/stevewesthoek/brain/tools/scripts/`)
- ✓ Kanban board markdown (`mind/kanban.md`)
- ✓ Logs

---

## Installation & Configuration

### Prerequisites
- Python 3.7+
- Git installed and authenticated
- GitHub PAT token stored in `~/.config/github/.env`
- **Obsidian Kanban plugin installed** (version 2.0.51+)

### Verify Installation

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/mind-automate-verify.sh
```

Checks:
- ✓ Cron job installed
- ✓ Python script executable
- ✓ GitHub credentials valid
- ✓ Git repo accessible
- ✓ Logs directory exists

### Manual Setup (if needed)

```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py

# Install cron job
(crontab -l 2>/dev/null | grep -v "mind-kanban-syncer"; echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1") | crontab -
```

---

## How It Works

### Path Types (Important)

The runbook uses three different path formats:

| Format | Example | Usage |
|--------|---------|-------|
| **Filesystem** | `~/Repos/stevewesthoek/mind/04-tasks/` | For commands in terminal |
| **Repo-relative** | `04-tasks/` | For file operations inside the mind repo |
| **Obsidian wikilinks** | `[[04-tasks/...]]` | Inside Obsidian vault (no `mind/` prefix) |

**Important:** Obsidian wikilinks inside the `mind` vault use repo-relative paths. Do NOT use `[[mind/04-tasks/...]]` in kanban.md — wikilinks are relative to the vault root.

### Kanban Markdown Format

The `mind/kanban.md` file uses Obsidian Kanban plugin format:

```markdown
---

kanban-plugin: board

---

## Backlog

- [ ] [[04-tasks/project/001-task.md|Task Title]] #p3 #you

## To Do

- [ ] [[04-tasks/project/002-another.md|Another Task]] #p1 #ai

## Doing

- [ ] [[04-tasks/project/003-in-flight.md|Working On]] #p2 #you

## Done

**Complete**
- [x] [[04-tasks/project/004-done.md|Done Task]] #p4 #ai

%% kanban:settings
```
{"tag-colors": [...], "date-format": "YYYY-MM-DD", ...}
```
%%
```

**Format rules:**
- Frontmatter: `kanban-plugin: board`
- Columns: `## Column Name`
- Done column has `**Complete**` header after the `## Done` line
- Cards: `- [ ]` (incomplete) or `- [x]` (complete)
- Card format: `- [ ] [[path/to/file.md|Display Title]] #tag1 #tag2`
- Wikilinks embed the actual task file path for clickable links
- Color tags inline: `#p1` through `#p5` for priority, `#you` or `#ai` for assignment
- Settings block at end with tag-color definitions

### Column Behavior

| Column | Source | Persistence |
|---|---|---|
| **Backlog** | Auto from `status: ready` tasks | Re-generated each sync |
| **To Do** | Preserved from existing kanban.md | User drags are preserved |
| **Doing** | Auto from `status: in-progress` tasks | Re-generated each sync |
| **Done** | Auto from `status: done` tasks | Re-generated each sync |

**Key insight:** When you drag a task to the **To Do** column, the syncer preserves it there on next run. Dragging from other columns triggers auto-moves based on status changes in the task file.

### Color Coding

Cards are tagged with priority and assignment for color-coding:

| Tag | Meaning | Color |
|-----|---------|-------|
| `#p1` | Priority 1 (critical) | Red |
| `#p2` | Priority 2 (high) | Orange |
| `#p3` | Priority 3 (medium) | Yellow |
| `#p4` | Priority 4 (low) | Green |
| `#p5` | Priority 5 (someday) | Gray |
| `#you` | Assigned to you | Blue |
| `#ai` | Assigned to AI | Purple |

These are defined in the `kanban:settings` block and apply automatically.

---

## Task File Format

Tasks are markdown files with YAML frontmatter:

```yaml
---
type: task
title: "Task Title"
assigned_to: you|ai
status: ready|in-progress|done
priority: 1-5
effort: small|medium|large
project: [[03-projects/project-name]]
---
```

The syncer reads:
- `type: task` — must be present to include in Kanban
- `status` — determines column placement
- `priority` — sorts tasks within column
- `assigned_to` — used for color tag

---

## Logging

### Log Files
- **Success log:** `~/.local/share/brain/logs/kanban-syncer.log`
- **Error log:** `~/.local/share/brain/logs/kanban-syncer-error.log`

### View Logs
```bash
tail -20 ~/.local/share/brain/logs/kanban-syncer.log
tail -f ~/.local/share/brain/logs/kanban-syncer.log
```

### Sample Output
```
2026-04-10 23:46:06,000 - mind-kanban-syncer - INFO - ✓ Synced Kanban board
2026-04-10 23:56:00,000 - mind-kanban-syncer - DEBUG - Kanban unchanged, skipping commit
```

---

## Manual Execution

Run the syncer outside cron for immediate sync:

```bash
~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py
```

---

## Cron Job Management

### View Current Job
```bash
crontab -l | grep mind-kanban-syncer
```

### Edit Frequency
```bash
crontab -e
# Change: */10 * * * * (every 10 min)
# To:     */5 * * * *  (every 5 min)
```

Common frequencies:
- Every 5 minutes: `*/5 * * * *` (more responsive)
- Every 10 minutes: `*/10 * * * *` (current, balanced)
- Every 15 minutes: `*/15 * * * *` (less responsive)

### Disable Temporarily
```bash
crontab -r
# Reinstall later
(crontab -l 2>/dev/null; echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1") | crontab -
```

---

## Using the Kanban Board

### In Obsidian

1. Open `mind/kanban.md` → the Obsidian Kanban plugin automatically renders it as an interactive board
2. **Drag tasks between columns:**
   - Backlog → To Do (persists)
   - To Do → Doing (syncer updates task file status to in-progress)
   - Doing → Done (syncer updates task file status to done)
3. **Click task title** → opens the actual `.md` file in a new pane
4. **Color-coded cards** → see priority and assignment at a glance

### Interaction Model

**What the automation owns:**
- Backlog, Doing, Done columns are re-generated from task status
- If a task's `.md` file status changes, it automatically moves on next sync

**What you own:**
- To Do column — drag tasks here manually
- Inside task files — edit metadata (priority, assigned_to, effort, etc.)
- Checkbox state — mark tasks done by clicking the Obsidian checkbox

---

## Troubleshooting

### Script Not Running

**Check if cron exists:**
```bash
crontab -l | grep mind-kanban-syncer
```

**Check if script is executable:**
```bash
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py
# Should show: -rwxr-xr-x
```

### Kanban Not Updating in Obsidian

The plugin reads the file from disk. After a sync, reload the file:
- Close and re-open `mind/kanban.md`
- Or: Command Palette → "Reload app without saving"

**Check if sync ran:**
```bash
git log --oneline -10 -- mind/kanban.md
# Should show recent "mind: sync kanban" commits
```

### No Tasks on Board

**Check if task files exist:**
```bash
ls ~/Repos/stevewesthoek/mind/04-tasks/
# Should show directories like: business-tasks/, personal-tasks/, etc.
```

**Check task file format:**
```bash
head -15 ~/Repos/stevewesthoek/mind/04-tasks/project/001-task.md
# Should have: type: task, status, priority
```

**Check logs:**
```bash
tail -20 ~/.local/share/brain/logs/kanban-syncer-error.log
```

### Git Push Failures

If syncer reports push failure, check git status:

```bash
cd ~/Repos/stevewesthoek/mind
git pull --rebase
git push
```

---

## Testing

### Create a Test Task

```bash
cd ~/Repos/stevewesthoek/mind

# Create test task
mkdir -p 04-tasks/test-project
cat > 04-tasks/test-project/001-test-task.md << 'EOF'
---
type: task
title: "Test Kanban Task"
assigned_to: you
status: ready
priority: 3
effort: small
project: [[03-projects/test]]
---

## What to Do
This is a test task.

## Acceptance Criteria
- [ ] Verify task appears on Kanban board
EOF

# Commit
git add 04-tasks/test-project/001-test-task.md
git commit -m "test: add test task"
git push
```

### Run Syncer

```bash
~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py
tail -10 ~/.local/share/brain/logs/kanban-syncer.log
```

### Verify in Obsidian

1. Open Obsidian → `mind/kanban.md`
2. Look for "Test Kanban Task" in the Backlog column
3. Verify color tags appear (`#p3 #you`)
4. Click the task → should open `001-test-task.md`
5. Drag to To Do → should persist
6. Edit task file `status: in-progress` → should move to Doing on next sync (10 min)

---

## Performance Notes

### Resource Usage
- **Per sync:** 50-200ms (file I/O, git operations)
- **Per cycle (every 10 min):** 50-200ms active, rest idle
- **Memory:** <8MB baseline
- **CPU:** <1% active time

### Frequency Tuning

Current (every 10 minutes) balances:
- Responsive board updates (< 10 min after task change)
- Reasonable git commit frequency (not too spammy)
- Minimal resource impact

Can change to `*/5 * * * *` for more responsive if desired.

---

## Data Flow

```
Task Files (04-tasks/)
        ↓
    [Parser] — extract status, priority, title
        ↓
Task Metadata by Status
        ↓
    [Grouper] — organize by status
        ↓
Backlog | To Do (preserved) | Doing | Done
        ↓
Build markdown (Kanban plugin format)
        ↓
Write to mind/kanban.md
        ↓
Git commit (if changed) → GitHub
        ↓
Obsidian plugin renders as interactive board
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| View Kanban board | Open `mind/kanban.md` in Obsidian |
| View logs | `tail -f ~/.local/share/brain/logs/kanban-syncer.log` |
| Run manually | `~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py` |
| Edit cron | `crontab -e` |
| Check cron | `crontab -l \| grep mind-kanban` |
| List tasks | `ls mind/04-tasks/` |
| Check recent syncs | `git log --oneline -5 -- mind/kanban.md` |

---

## Support

For issues:
1. Check logs: `tail -20 ~/.local/share/brain/logs/kanban-syncer*.log`
2. Run manually: `~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py`
3. Check kanban.md exists: `ls -la mind/kanban.md`
4. Check task files: `ls -la mind/04-tasks/`
5. Verify git access: `cd ~/Repos/stevewesthoek/brain && git pull && git push`

Last updated: 2026-04-10
