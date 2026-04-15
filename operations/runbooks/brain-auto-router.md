# Brain Auto-Router Runbook

**Status:** ✓ PRODUCTION (Replaced n8n scheduled workflows 2026-04-10)

## Post-Reboot / After OS Reinstall

**Everything auto-resumes — no action needed.** But verify it's working:

```bash
# Comprehensive health check (run after reboot or any time)
bash ~/Repos/stevewesthoek/brain/tools/scripts/brain-automate-verify.sh

# Check recent activity
tail -20 ~/.local/share/brain/logs/auto-router.log
```

**What persists automatically:**
- ✓ Cron job (stored in OS, not filesystem)
- ✓ GitHub PAT token (`~/.config/github/.env`)
- ✓ Python script (`~/Repos/stevewesthoek/brain/tools/scripts/`)
- ✓ Logs and state

**If you reinstall macOS:**
- Keep your home directory path the same → Everything works
- Move the brain repo → Update crontab path (see "Cron Job Management" below)
- Change GitHub PAT → Update `~/.config/github/.env`

---

## Overview

The Auto-Router is a Python script that automatically routes inbox notes through the Brain GTD system. It runs every 1 minute via OS-level cron and intelligently categorizes notes based on confidence and signal_quality scores.

**What it does:**
1. Scans `vault/01-inbox/` for files with `status: unrouted`
2. Extracts `confidence` and `signal_quality` scores from frontmatter
3. Routes based on decision tree (see below)
4. Updates file status and moves to destination folder via git
5. Logs all actions for debugging

**Why it exists:**
Previously, Auto-Router was a scheduled n8n workflow. The n8n scheduler has reliability issues (triggers not firing, webhook registration failures). This Python + cron approach is simpler, more debuggable, and has no external dependencies.

---

## Installation & Configuration

### Prerequisites
- Python 3.7+
- Git installed and authenticated
- GitHub PAT token stored in `~/.config/github/.env`

### Verify Installation

Run the verification script to confirm everything is set up:

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

The system is already installed. But if you need to reinstall:

```bash
# Check cron job is installed
crontab -l | grep brain-auto-router

# Check script is executable
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py

# Check logs directory exists
ls -la ~/.local/share/brain/logs/
```

If not installed, run:
```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py

# Install cron job
(crontab -l 2>/dev/null | grep -v "brain-auto-router"; echo "*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py >> /dev/null 2>&1") | crontab -
```

---

## How It Works

### Decision Tree Routing Logic

When a note in inbox has both `confidence` and `signal_quality` scores, the router applies this logic:

```
IF signal_quality >= 0.8 AND confidence >= 0.8:
    route = "03-projects" (if para_type == "project") else "02-strategy/brainstorm"
    status = "ready-for-review"
    
ELSE IF signal_quality >= 0.5 AND confidence >= 0.5:
    route = "01-inbox"  (stays in inbox)
    status = "review-queue"
    
ELSE IF signal_quality < 0.5:
    route = "08-archive"
    status = "archived-low-signal"
    
ELSE:
    route = "08-archive"
    status = "archived-vague"
```

**Example flows:**
- `confidence: 0.85, signal_quality: 0.92, para_type: project` → Moves to `03-projects/`, status → `ready-for-review`
- `confidence: 0.6, signal_quality: 0.6` → Stays in inbox, status → `review-queue`
- `confidence: 0.3, signal_quality: 0.2` → Moves to archive, status → `archived-low-signal`

### File Processing

For each unrouted file:
1. Extract frontmatter (YAML between `---` markers)
2. Read `confidence`, `signal_quality`, `status`, `para_type` fields
3. Apply decision tree to determine route and new status
4. Update file: replace `status: unrouted` with new status
5. Stage file in new location via `git add`
6. If moving: `git rm` old file
7. Commit with message: `brain: auto-route {route} — {new_status}`
8. `git pull --rebase` (handle remote conflicts)
9. `git push` to origin/main

### Frontmatter Format

Files must have YAML frontmatter with these fields:

```yaml
---
type: capture
source: gemini | claude-code | shortcut | ...
title: "Your Title"
para_type: project | area | resource | inbox
confidence: 0.85          # 0.0-1.0
signal_quality: 0.92      # 0.0-1.0
created: 2026-04-10
status: unrouted          # Will be updated to: ready-for-review, review-queue, archived-*
---

# Your content here
```

---

## Logging

### Log Files
- **Success log:** `~/.local/share/brain/logs/auto-router.log`
- **Error log:** `~/.local/share/brain/logs/auto-router-error.log`

### View Logs
```bash
# Recent successes
tail -20 ~/.local/share/brain/logs/auto-router.log

# Recent errors
tail -20 ~/.local/share/brain/logs/auto-router-error.log

# Follow live (tail -f)
tail -f ~/.local/share/brain/logs/auto-router.log
```

### Sample Log Output
```
2026-04-10 22:50:42,000 - brain-auto-router - INFO - ✓ Routed 2026-04-10-x-playbook-becoming-a-full-time-creator.md → 03-projects (ready-for-review)
2026-04-10 22:50:42,000 - brain-auto-router - INFO - Routed 1 file(s)
2026-04-10 22:51:12,523 - brain-auto-router - INFO - No inbox files found
```

---

## Manual Execution

Run the router manually (outside cron) for testing or debugging:

```bash
# Direct execution
~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py

# With verbose output
python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py
```

---

## Cron Job Management

### View Current Job
```bash
crontab -l
```

### Edit Cron Expression
To change frequency (e.g., every 5 minutes instead of 1):

```bash
crontab -e
# Change: */1 * * * * → */5 * * * *
# Save and exit
```

**Common frequencies:**
- Every 1 minute: `*/1 * * * *` (current)
- Every 5 minutes: `*/5 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Hourly: `0 * * * *`

### Disable Temporarily
```bash
# Remove from crontab
crontab -r

# Reinstall later
(crontab -l 2>/dev/null; echo "*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py >> /dev/null 2>&1") | crontab -
```

---

## Troubleshooting

### Script Not Running

**Check if cron job exists:**
```bash
crontab -l | grep brain-auto-router
# Should output: */1 * * * * /Users/Office/...
```

**Check if script is executable:**
```bash
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py
# Should show: -rwxr-xr-x (executable)
```

**Check if macOS is blocking cron:**
- System Preferences → Security & Privacy → Full Disk Access
- Make sure cron/Terminal have access (may need to add `/usr/sbin/cron`)

### GitHub Token Not Found

**Error:** `GITHUB_TOKEN/GITHUB_PAT not found in env or ~/.config/github/.env`

**Fix:**
```bash
cat ~/.config/github/.env
# Should show: GITHUB_PAT=github_pat_11BQLFYZQ05AJr...

# If missing, create it
mkdir -p ~/.config/github
echo "GITHUB_PAT=<your-token>" > ~/.config/github/.env
chmod 600 ~/.config/github/.env
```

### Files Not Moving

**Check logs:**
```bash
tail -20 ~/.local/share/brain/logs/auto-router-error.log
```

**Common issues:**
- File doesn't have `confidence` or `signal_quality` fields (must be numeric)
- File `status` is not exactly `unrouted`
- Destination folder doesn't exist (router creates `vault/{route}/` automatically)
- Git authentication failing

**Manual test:**
```bash
# Run script and capture errors
~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py 2>&1 | tee /tmp/router-debug.log
cat /tmp/router-debug.log
```

### Git Push Failures

**Error:** `! [rejected] main -> main (fetch first)`

**Fix:** The script already handles this with `git pull --rebase`, but if it persists:
```bash
cd ~/Repos/stevewesthoek/brain
git pull --rebase
git push
```

---

## Testing

### Create a Test Note

```bash
cd ~/Repos/stevewesthoek/brain

cat > vault/01-inbox/2026-04-10-test-high-value.md << 'EOF'
---
type: capture
source: test
title: "High Value Project"
para_type: project
confidence: 0.85
signal_quality: 0.92
created: 2026-04-10
status: unrouted
---

# High Value Project

This is a high-confidence, high-signal note that should route to 03-projects.
EOF

# Run router
~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py

# Check result
ls vault/03-projects/ | grep test-high-value
cat vault/03-projects/2026-04-10-test-high-value.md | head -15
```

Expected: File moves to `03-projects/`, status becomes `ready-for-review`.

---

## History & Deprecation

### Replaced (2026-04-10)
- **n8n Auto-Router (ID: mTJ5BZhUp9rZEuqn)** — Scheduler not triggering, webhook issues
- **n8n Project Decomposer (ID: PX1h917Ub1j5LTgl)** — Not tested yet, kept for future use
- **n8n Kanban Syncer (ID: Glh7LOOAH0WCkTcQ)** — Not tested yet, kept for future use

**Reason:** n8n's scheduled triggers are unreliable. This Python + cron approach is:
- ✓ Simpler (no external UI needed)
- ✓ More debuggable (local logs, easy to test)
- ✓ More reliable (OS cron is battle-tested)
- ✓ Easier to monitor (standard Unix logging)

### Future Work
- Implement Project Decomposer as Python script + cron
- Implement Kanban Syncer as Python script + cron
- Unify all three scripts into a single `brain-automation` suite

---

## Quick Reference

| Action | Command |
|--------|---------|
| View logs | `tail -f ~/.local/share/brain/logs/auto-router.log` |
| Run manually | `~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py` |
| Edit cron | `crontab -e` |
| Check cron | `crontab -l` |
| Test routing | Create file in `01-inbox/` with `status: unrouted`, run script manually |
| Disable | `crontab -r` |

---

## Support

For issues:
1. Check logs: `tail -20 ~/.local/share/brain/logs/auto-router*.log`
2. Run manually: `~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py`
3. Check GitHub config: `cat ~/.config/github/.env`
4. Test git access: `cd ~/Repos/stevewesthoek/brain && git pull && git push`

Last updated: 2026-04-10
