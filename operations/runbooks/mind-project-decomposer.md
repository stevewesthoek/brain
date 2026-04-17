# Mind Project Decomposer Runbook

**Status:** ✓ PRODUCTION (Python + Cron, replacing n8n)

## Post-Reboot / After OS Reinstall

**Everything auto-resumes — no action needed.** But verify it's working:

```bash
# Comprehensive health check (run after reboot or any time)
bash ~/Repos/stevewesthoek/brain/tools/scripts/mind-automate-verify.sh

# Check recent activity
tail -20 ~/.local/share/brain/logs/project-decomposer.log
```

**What persists automatically:**
- ✓ Cron job (stored in OS, not filesystem)
- ✓ GitHub PAT token (`~/.config/github/.env`)
- ✓ Python script (`~/Repos/stevewesthoek/brain/tools/scripts/`)
- ✓ Logs and state

**If you reinstall macOS:**
- Keep your home directory path the same → Everything works
- Move the mind repo → Update paths in cron job (see "Cron Job Management" below)
- Change GitHub PAT → Update `~/.config/github/.env`

---

## Overview

The Project Decomposer is a Python script that automatically breaks down high-quality projects into atomic tasks. It runs every 5 minutes via OS-level cron and uses Gemini AI to decompose projects intelligently.

**What it does:**
1. Scans `03-projects/` for files with `type: capture` and `status: ready-for-review` (placed there by the Auto-Router)
2. Sends each project to Gemini CLI for intelligent decomposition
3. Receives structured JSON back with project metadata and task breakdown
4. Replaces the capture file with a proper project file (using `project.md` template)
5. Creates N task files in `04-tasks/{project-slug}/` (using `task.md` template)
6. Commits all changes atomically via git
7. Logs all actions for debugging

**Why it exists:**
The Auto-Router places raw capture notes into `03-projects/` when they meet quality thresholds. But they're still in capture format — just scored and routed. The decomposer reads the project content, uses Gemini to understand it deeply, and expands it into a structured work plan with clearly defined tasks ready for execution.

---

## Installation & Configuration

### Prerequisites
- Python 3.7+
- Gemini CLI (for `gemini --model gemini-2.5-flash` command)
- Git installed and authenticated
- GitHub PAT token stored in `~/.config/github/.env`

### Verify Installation

Run the verification script to confirm everything is set up:

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/mind-automate-verify.sh
```

This checks:
- ✓ Cron job is installed
- ✓ Python script is executable
- ✓ GitHub credentials are valid
- ✓ Git repo is accessible
- ✓ Logs directory exists

### Gemini CLI Verification

Verify that Gemini CLI is available and authenticated:

```bash
# Test Gemini CLI
echo "Say 'hello'" | gemini --model gemini-2.5-flash

# If this fails, set up Gemini CLI authentication
gemini auth login
```

### Setup (Manual, only if verification fails)

The system is already installed. But if you need to reinstall:

```bash
# Check cron job is installed
crontab -l | grep mind-project-decomposer

# Check script is executable
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# Check logs directory exists
ls -la ~/.local/share/brain/logs/
```

If not installed, run:
```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# Install cron job
(crontab -l 2>/dev/null | grep -v "mind-project-decomposer"; echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1") | crontab -
```

---

## How It Works

### Decision Tree

The decomposer only processes files matching:
1. **Location:** `03-projects/`
2. **Type:** `type: capture` (not yet converted to proper project format)
3. **Status:** `status: ready-for-review` (placed there by Auto-Router)

If a file has `type: project`, it's skipped (already decomposed).

### Decomposition Flow

For each eligible file:

1. **Extract content** — Read frontmatter and body from markdown file via git
2. **Build Gemini prompt** — Include project title, full content, and JSON schema
3. **Call Gemini CLI** — Send prompt to `gemini-2.5-flash` (free tier, OAuth auth)
4. **Parse response** — Extract JSON with project metadata and task list
5. **Build project file** — Create proper `project.md` template with:
   - Type: `project` (converted from `capture`)
   - Status: `in-progress` (ready for execution)
   - Priority: from Gemini (1-5)
   - Target end date: from Gemini or empty
   - Goal: one-sentence goal from Gemini
   - Related tasks: list of links to new task files
6. **Build task files** — One file per task in `04-tasks/{project-slug}/`:
   - Type: `task`
   - Assigned to: `you` or `ai` (from Gemini)
   - Priority: from Gemini (1-5)
   - Effort: `small`, `medium`, or `large` (from Gemini)
   - Project: backlink to the project file
7. **Atomic commit** — All files staged, committed, rebased, and pushed in one sequence

### Gemini Prompt Design

The decomposer sends a structured prompt that includes:
- Instruction to return ONLY valid JSON
- JSON schema with exact field names and types
- Project title and full content
- No markdown formatting in the response

Example response:

```json
{
  "project": {
    "title": "Build a Creator Playbook",
    "goal": "Create a comprehensive guide for transitioning to full-time content creation",
    "priority": 4,
    "target_end_date": "2026-05-31",
    "tags": ["career", "content-creation"]
  },
  "tasks": [
    {
      "title": "Research income streams",
      "what_to_do": "Research 5-10 sustainable income streams for creators",
      "acceptance_criteria": ["List created", "Analyzed pros/cons"],
      "assigned_to": "you",
      "priority": 4,
      "effort": "medium"
    }
  ]
}
```

### File Formats

**Project file** (`03-projects/project-name.md` after decomposition):

```yaml
---
type: project
title: "Project Title"
status: in-progress
priority: 3
start_date: 2026-04-10
target_end_date: 2026-05-31
tags: ["tag1", "tag2"]
decomposed: true
source_capture: 2026-04-10-x-original-filename.md
---

## Goal
One sentence goal statement

## What Needs to Happen
Original project note content here...

## Related Tasks
- [[04-tasks/project-slug/001-task-name]]
- [[04-tasks/project-slug/002-another-task]]
```

**Task file** (`04-tasks/{project-slug}/{number}-{task-name}.md`):

```yaml
---
type: task
title: "Task Title"
assigned_to: you | ai
status: ready
priority: 3
effort: small | medium | large
project: [[03-projects/project-name]]
---

## What to Do
Clear action description

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

---

## Logging

### Log Files
- **Success log:** `~/.local/share/brain/logs/project-decomposer.log`
- **Error log:** `~/.local/share/brain/logs/project-decomposer-error.log`

### View Logs
```bash
# Recent successes
tail -20 ~/.local/share/brain/logs/project-decomposer.log

# Recent errors
tail -20 ~/.local/share/brain/logs/project-decomposer-error.log

# Follow live (tail -f)
tail -f ~/.local/share/brain/logs/project-decomposer.log
```

### Sample Log Output
```
2026-04-10 12:15:42,000 - mind-project-decomposer - INFO - ✓ Decomposed X Playbook: Becoming a Full-Time Creator → project + 5 tasks
2026-04-10 12:20:15,000 - mind-project-decomposer - DEBUG - No project files found
2026-04-10 12:25:42,000 - mind-project-decomposer - ERROR - Gemini call timed out for Some Project Title
```

---

## Manual Execution

Run the decomposer manually (outside cron) for testing or debugging:

```bash
# Direct execution
~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# With verbose output
python3 ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```

---

## Cron Job Management

### View Current Job
```bash
crontab -l
```

### Edit Cron Expression
To change frequency (e.g., every 15 minutes instead of 5):

```bash
crontab -e
# Change: */5 * * * * → */15 * * * *
# Save and exit
```

**Common frequencies:**
- Every 5 minutes: `*/5 * * * *` (current)
- Every 15 minutes: `*/15 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Hourly: `0 * * * *`

### Disable Temporarily
```bash
# Remove from crontab
crontab -r

# Reinstall later
(crontab -l 2>/dev/null; echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1") | crontab -
```

---

## Troubleshooting

### Script Not Running

**Check if cron job exists:**
```bash
crontab -l | grep mind-project-decomposer
# Should output: */5 * * * * /Users/Office/...
```

**Check if script is executable:**
```bash
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
# Should show: -rwxr-xr-x (executable)
```

**Check if macOS is blocking cron:**
- System Preferences → Security & Privacy → Full Disk Access
- Make sure cron/Terminal have access

### Gemini Not Available

**Error:** `Failed to parse Gemini JSON response` or `Gemini call failed`

**Check Gemini CLI:**
```bash
# Test Gemini CLI
echo "Say 'hello'" | gemini --model gemini-2.5-flash

# If it fails, authenticate
gemini auth login
```

**Check for rate limiting:**
- Gemini free tier: ~1500 requests/day
- If you hit the limit, wait until the next day or use `gemini-2.5-pro` model

### GitHub Token Not Found

**Error:** `GITHUB_TOKEN/GITHUB_PAT not found in env or ~/.config/github/.env`

**Fix:**
```bash
cat ~/.config/github/.env
# Should show: GITHUB_PAT=<your-token>

# If missing, create it
mkdir -p ~/.config/github
echo "GITHUB_PAT=<your-token>" > ~/.config/github/.env
chmod 600 ~/.config/github/.env
```

### No Projects Being Decomposed

**Check logs:**
```bash
tail -20 ~/.local/share/brain/logs/project-decomposer-error.log
```

**Verify project files exist:**
```bash
ls ~/Repos/stevewesthoek/mind/03-projects/
# Should see .md files with status: ready-for-review, type: capture
```

**Test manually:**
```bash
# Run script and capture output
~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py 2>&1 | tee /tmp/decomposer-debug.log
cat /tmp/decomposer-debug.log
```

### Git Push Failures

**Error:** `! [rejected] main -> main (fetch first)`

**Fix:** The script already handles this with `git pull --rebase`, but if it persists:
```bash
cd ~/Repos/stevewesthoek/mind
git pull --rebase
git push
```

---

## Testing

### Create a Test Project

Create a test capture file in `03-projects/`:

```bash
cd ~/Repos/stevewesthoek/mind

cat > 03-projects/2026-04-10-test-decomposer.md << 'EOF'
---
type: capture
source: test
title: "Learn Rust Programming"
para_type: project
confidence: 0.85
signal_quality: 0.92
created: 2026-04-10
status: ready-for-review
---

# Learn Rust Programming

I want to learn Rust to write fast, reliable systems. This project involves:
- Understanding ownership and borrowing
- Building a CLI tool
- Exploring web frameworks
- Reading the Rust Book and doing exercises
- Contributing to an open source project

Timeline: 3-4 months, working 1-2 hours daily.
EOF
```

### Run Decomposer

```bash
# Run script manually
~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# Check logs
tail -20 ~/.local/share/brain/logs/project-decomposer.log
```

### Verify Results

```bash
# Check project file was converted
ls 03-projects/ | grep test-decomposer
cat 03-projects/2026-04-10-test-decomposer.md | head -20

# Check task files were created
ls 04-tasks/learn-rust-programming/
cat 04-tasks/learn-rust-programming/001-*.md
```

**Expected:**
- Project file has `type: project`, `status: in-progress`, `decomposed: true`
- Project file has `## Goal`, `## What Needs to Happen`, `## Related Tasks` sections
- 3-7 task files created in `04-tasks/learn-rust-programming/`
- Each task has `type: task`, `assigned_to: you|ai`, priority, effort fields
- Git commit pushed with message: `mind: decompose Learn Rust Programming`

---

## Performance Notes

### Resource Usage
- **Per decomposition:** 2-5 seconds (Gemini API latency, ~200ms average)
- **Per cycle (every 5 min):** 50ms-100ms idle time (checking for files)
- **Memory:** ~10-15MB baseline
- **CPU:** Negligible when idle

### Frequency Tuning

If you have many projects in the inbox:
- **Every 5 minutes (current):** Balances responsiveness with Gemini API limits
- **Every 15 minutes:** Lower API usage, slower decomposition
- **Every 1 minute:** Higher latency, may hit rate limits

Recommended: Keep at **every 5 minutes** unless you hit Gemini rate limits.

---

## History & Deprecation

### Replaced (2026-04-10)
- **n8n Project Decomposer (ID: PX1h917Ub1j5LTgl)** — Scheduler not triggering, too heavyweight

**Reason:** n8n's scheduled triggers are unreliable. This Python + cron approach is:
- ✓ Simpler (no external UI needed)
- ✓ More debuggable (local logs, easy to test)
- ✓ More reliable (OS cron is battle-tested)
- ✓ Easier to monitor (standard Unix logging)

### Future Work
- Monitor Gemini rate limits and implement backoff if needed
- Add configurable task count (currently generates as many as Gemini returns)
- Implement project prioritization logic (decompose high-priority projects first)

---

## Quick Reference

| Action | Command |
|--------|---------|
| View logs | `tail -f ~/.local/share/brain/logs/project-decomposer.log` |
| Run manually | `~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py` |
| Edit cron | `crontab -e` |
| Check cron | `crontab -l` |
| Test Gemini | `echo "Say hello" \| gemini --model gemini-2.5-flash` |
| List projects | `ls 03-projects/` |
| List tasks | `ls 04-tasks/` |
| Disable | `crontab -r` |

---

## Support

For issues:
1. Check logs: `tail -20 ~/.local/share/brain/logs/project-decomposer*.log`
2. Run manually: `~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py`
3. Test Gemini: `echo "Say hello" | gemini --model gemini-2.5-flash`
4. Test git access: `cd ~/Repos/stevewesthoek/brain && git pull && git push`

Last updated: 2026-04-10
