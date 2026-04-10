# Plan: Brain Kanban Syncer (Step 4 of GTD Automation)

## Context
Step 4 of the 4-step GTD automation:
- Step 1: Capture + Classify — DONE
- Step 2: Auto-Router — DONE
- Step 3: Project Decomposer — DONE
- Step 4: Kanban Syncer — THIS PLAN

The Project Decomposer creates task files in `notes/04-tasks/{project-slug}/{n}-{task-name}.md`. The Kanban Syncer reads all those task files, maps them to the correct column based on `status`, and writes `notes/kanban.canvas` with proper Obsidian file-link nodes.

---

## Canvas Format

The existing `kanban.canvas` has 6 static nodes to always preserve:

| Node ID | Purpose | Position |
|---|---|---|
| `backlog-header` | BACKLOG column header | x=-540, y=-300 |
| `todo-header` | TO DO column header | x=-180, y=-300 |
| `doing-header` | DOING column header | x=180, y=-300 |
| `done-header` | DONE column header | x=540, y=-300 |
| `instructions` | Usage instructions | x=-180, y=420 |
| `blocked-section` | Blocked sidebar | x=-540, y=100 |

Task card nodes use `type: "file"` with a `file` property pointing to the vault-relative path. ID scheme: `task-{sanitized-filename}` for idempotent sync.

**Column x-positions:** BACKLOG=-540, DOING=180, DONE=540  
**TO DO (-180) is MANUAL** — automation never writes to it  
**Card size:** 200x80px  
**First card y:** -160 (just below headers which end at y=-180)  
**Vertical spacing:** 100px between cards

**Status-to-column mapping:**
- `status: ready` → BACKLOG (x=-540)
- `status: in-progress` → DOING (x=180)
- `status: done` → DONE (x=540)
- Any other status → BACKLOG (default)

---

## Files to Create

### 1. `tools/scripts/brain-kanban-syncer.py`

Same patterns as `brain-auto-router.py` and `brain-project-decomposer.py`:
- Logging: three handlers (main, error, console)
- Git: subprocess `git -C <repo_path>` pattern
- Cron: every 10 minutes (`*/10 * * * *`)

**Logic flow:**
1. Get all task `.md` files from `notes/04-tasks/` via `git ls-tree -r main notes/04-tasks`
2. For each file: read content via `git show main:<filepath>`, parse frontmatter
3. Only process files with `type: task`
4. Group tasks by `status` (ready → backlog, in-progress → doing, done → done)
5. Load existing `notes/kanban.canvas` JSON from disk
6. Remove all existing task nodes (ID starts with `task-`) from the nodes array
7. Build new task nodes for each task file (type: "file", file: filepath, id: "task-{slug}")
8. Stack them vertically in each column, sorted by priority (1=highest first)
9. Write updated JSON to `notes/kanban.canvas`
10. If canvas changed: `git add`, `git commit`, `git pull --rebase`, `git push`

**Task node structure:**
```json
{
  "id": "task-001-select-creator-niche",
  "type": "file",
  "file": "notes/04-tasks/project-slug/001-task-name.md",
  "x": -540,
  "y": -160,
  "width": 200,
  "height": 80
}
```

**Idempotency:** Track current canvas state and only commit if it changed (compare JSON before/after). Prevents empty commits every 10 minutes.

**Sorting:** Within each column, sort tasks by `priority` ascending (1=highest priority shown at top).

**Overflow:** If more than ~15 tasks in a column, cards still stack — they just go below the instructions box. No truncation.

### 2. `operations/runbooks/brain-kanban-syncer.md`

Same structure as other runbooks:
- TL;DR post-reboot
- What it does / why
- Installation
- Canvas structure explanation
- Cron management
- Troubleshooting

---

## Cron Schedule
Every 10 minutes: `*/10 * * * *`

Rationale: Kanban sync is fast (no AI call), but the canvas doesn't need to update more frequently than tasks change. 10 minutes gives a good balance.

---

## Critical Files

| File | Purpose |
|---|---|
| `tools/scripts/brain-auto-router.py` | Pattern source |
| `notes/kanban.canvas` | Target file to update |
| `notes/07-templates/task.md` | Task frontmatter schema |

---

## Verification
1. Create a test task file manually in `04-tasks/`
2. Run script: `python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py`
3. Open `notes/kanban.canvas` and confirm task card appears in correct column
4. Open in Obsidian to verify file link opens correctly
5. Check logs: `tail -20 ~/.local/share/brain/logs/kanban-syncer.log`
