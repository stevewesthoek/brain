# Mind Automation Cron Jobs Registry

**Purpose:** Central documentation and registry for all recurring Mind automation jobs running via OS-level cron.

**Last verified:** 2026-04-17  
**Status:** ✅ Active and verified

**Re-enabled (2026-04-17 after cleanup):**
- ✅ mind-auto-router.py active
- ✅ mind-project-decomposer.py active
- ✅ mind-kanban-syncer.py active

**Recent changes:**
- Mind repo conflict resolution complete: merged conflicts, accepted remote deletions, preserved valid captures
- Obsidian workspace.json removed from tracking (was causing git pull failures)
- Gemini CLI absolute path fix deployed in automation scripts
- All cron jobs re-enabled and monitoring

**Reason:** Mind repo is now clean, synchronized with origin/main, and workspace tracking issue resolved.

---

## Current Cron Jobs (Desired State)

All jobs run on the local machine via `crontab` (macOS). The automation scripts are located at `~/Repos/stevewesthoek/brain/tools/scripts/`. All jobs operate on the Mind vault at `~/Repos/stevewesthoek/mind/`.

| Job | Script | Frequency | What It Does | Target Repo | Log |
|-----|--------|-----------|--------------|-------------|-----|
| **Mind Auto-Router** | `mind-auto-router.py` | Every 1 minute | Routes inbox notes (01-inbox/) to projects, areas, resources based on confidence/signal_quality scores | mind | `~/.local/share/brain/logs/auto-router.log` |
| **Mind Project Decomposer** | `mind-project-decomposer.py` | Every 5 minutes | Decomposes high-quality projects (03-projects/) into atomic tasks via Gemini AI | mind | `~/.local/share/brain/logs/project-decomposer.log` |
| **Mind Kanban Syncer** | `mind-kanban-syncer.py` | Every 10 minutes | Syncs task files (04-tasks/) to Obsidian Kanban board (mind/kanban.md) | mind | `~/.local/share/brain/logs/kanban-syncer.log` |

---

## Exact Desired Crontab Entries

These are the exact crontab entries that should be installed. Use these as the source of truth:

```bash
*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py >> /dev/null 2>&1
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1
```

---

## Check Current Crontab

View all installed cron jobs:

```bash
crontab -l
```

Expected output should include the three mind-* entries above, plus any other unrelated jobs (e.g., google-ads-rollback-check).

---

## Update from Old brain-* Names to mind-*

**Obsolete script names (do NOT use):**
- ❌ `brain-auto-router.py`
- ❌ `brain-project-decomposer.py`
- ❌ `brain-kanban-syncer.py`

**Safe update command** (removes old brain-* entries, installs new mind-* entries, preserves unrelated jobs):

```bash
(
  crontab -l 2>/dev/null \
    | grep -v "brain-auto-router\|brain-project-decomposer\|brain-kanban-syncer" \
    | grep -v "mind-auto-router\|mind-project-decomposer\|mind-kanban-syncer"
  echo "*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py >> /dev/null 2>&1"
  echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1"
  echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1"
) | crontab -
```

**What this command does:**
1. Get current crontab
2. Remove old brain-* entries
3. Remove any existing mind-* entries (avoid duplicates)
4. Add three new mind-* entries
5. Install updated crontab

**This preserves unrelated cron jobs** like google-ads-rollback-check.

---

## Verify Update Success

After running the update command, verify the results:

**Check for Mind automation jobs:**
```bash
crontab -l | grep "mind-auto-router\|mind-project-decomposer\|mind-kanban-syncer"
```

Expected (3 entries with mind-* names):
```
*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py >> /dev/null 2>&1
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1
```

**Check that unrelated jobs were preserved:**
```bash
crontab -l | grep google-ads-rollback-check
```

Expected (the google-ads rollback job should still exist):
```
0 */4 * * * /tmp/google-ads-rollback-check.sh >> /tmp/google-ads-rollback-cron.log 2>&1
```

**If google-ads job is missing, restoration failed. Do NOT proceed without investigating.**

---

## Manual Installation (if needed)

If cron jobs are not installed, or if update command fails:

```bash
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
chmod +x ~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py

(
  crontab -l 2>/dev/null
  echo "*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py >> /dev/null 2>&1"
  echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1"
  echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1"
) | crontab -
```

**This command preserves existing crontab and adds the three new entries.**

---

## Safely Disable Mind Automation Jobs (Without Deleting Other Jobs)

**⚠️ WARNING:** Never use `crontab -r` unless you intend to delete EVERY cron job on the machine, including unrelated jobs like google-ads-rollback-check.

To disable ONLY Mind automation jobs while preserving others:

```bash
(crontab -l 2>/dev/null | grep -v "mind-auto-router\|mind-project-decomposer\|mind-kanban-syncer") | crontab -
```

This removes only the three Mind automation entries and keeps everything else.

**Verify the disable worked:**
```bash
crontab -l | grep "mind-auto-router\|mind-project-decomposer\|mind-kanban-syncer"
# Should return nothing

crontab -l | grep google-ads-rollback-check
# Should still return the google-ads job
```

---

## Safely Reinstall After Disable

To reinstall the three Mind jobs:

```bash
(
  crontab -l 2>/dev/null
  echo "*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py >> /dev/null 2>&1"
  echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1"
  echo "*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py >> /dev/null 2>&1"
) | crontab -
```

---

## Post-Reboot Verification

After macOS reboot or system restart, verify all jobs are still running:

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/mind-automate-verify.sh
```

This comprehensive health check confirms:
- ✓ Cron jobs are installed
- ✓ Scripts are executable
- ✓ GitHub credentials are valid
- ✓ Git repos are accessible
- ✓ Logs directory exists
- ✓ Recent activity in logs

---

## Troubleshooting

### Jobs Not Running

**Check if cron jobs are installed:**
```bash
crontab -l | grep "mind-auto-router\|mind-project-decomposer\|mind-kanban-syncer"
```

**Check if scripts are executable:**
```bash
ls -la ~/Repos/stevewesthoek/brain/tools/scripts/mind-*.py
# Should show: -rwxr-xr-x (executable)
```

**Check macOS security permissions:**
- System Preferences → Security & Privacy → Full Disk Access
- Ensure cron (or Terminal app) has Full Disk Access

**Check recent logs:**
```bash
tail -20 ~/.local/share/brain/logs/auto-router.log
tail -20 ~/.local/share/brain/logs/project-decomposer.log
tail -20 ~/.local/share/brain/logs/kanban-syncer.log
```

### High CPU Usage

If cron jobs are consuming excessive CPU:

1. Check logs for errors:
   ```bash
   tail -f ~/.local/share/brain/logs/*-error.log
   ```

2. Identify which job is causing the issue

3. Temporarily disable that job:
   ```bash
   # For example, to disable mind-auto-router only:
   (crontab -l 2>/dev/null | grep -v "mind-auto-router") | crontab -
   ```

4. Debug manually:
   ```bash
   ~/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py 2>&1 | tee /tmp/debug.log
   cat /tmp/debug.log
   ```

### Git Lock Errors

If a script reports "Git lock error":

```bash
cd ~/Repos/stevewesthoek/mind
rm -f .git/index.lock
git status
```

---

## Runtime Verification Expectations

Every cron execution should produce an INFO-level heartbeat or no-op log line. This ensures consistent telemetry for operational health checks.

**Expected log frequency:**
- **Auto-Router:** At least one INFO-level line every 1 minute
  - "Run started" at execution
  - "No inbox files found" if inbox is empty (no-op case)
  - "Routed N file(s)" if files were routed
  - "Run complete" at finish
  
- **Project-Decomposer:** At least one INFO-level line every 5 minutes
  - "Run started" at execution
  - "No project files ready for decomposition" if no eligible projects (no-op case)
  - "Decomposed N project(s)" if projects were decomposed
  - "Run complete" at finish
  
- **Kanban-Syncer:** At least one INFO-level line every 10 minutes
  - "Run started" at execution
  - "Kanban unchanged, skipping commit" if no task changes (no-op case)
  - "✓ Synced Kanban board" if changes were committed
  - "Run complete" at finish

**Production readiness verification:**
Fresh log timestamps (within the last cron interval) are required before calling automation production-ready. Use:
```bash
tail -50 ~/.local/share/brain/logs/auto-router.log
tail -50 ~/.local/share/brain/logs/project-decomposer.log
tail -50 ~/.local/share/brain/logs/kanban-syncer.log
```

---

## Related Runbooks

For detailed documentation of each automation job:
- `mind-auto-router.md` — Auto-Router full documentation
- `mind-project-decomposer.md` — Project Decomposer full documentation
- `mind-kanban-syncer.md` — Kanban Syncer full documentation
- `mind-automate-verify.sh` — Health check script

---

## History

- **2026-04-17:** Central cron registry created. Migrated from distributed cron docs in individual runbooks. All brain-* script names obsolete; migrated to mind-* naming. Safe crontab commands use grep filters to preserve unrelated jobs.
- **2026-04-10:** Initial Python + cron automation deployed (replaced n8n scheduled workflows)
