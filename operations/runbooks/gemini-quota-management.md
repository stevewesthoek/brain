# Gemini API Quota Management

**Status:** Active. Free tier quota safeguarded at 15-minute polling interval.

---

## Quick Reference

| Item | Value |
|------|-------|
| **API Key Account** | Personal Google (stevewesthoek) |
| **Tier** | Free tier |
| **Daily Quota** | 1,500 requests/day |
| **Reset Schedule** | Midnight UTC (00:00 UTC) |
| **Current Polling** | 15 minutes (96 cycles/day) |
| **Max Safe Usage** | ~1,000 calls/day |

---

## Quota Reset Times

**Gemini API Free Tier resets at:**
- **00:00 UTC** (midnight Coordinated Universal Time)
- **Your local time:** 8 PM ET / 7 PM CT / 5 PM PT (previous day)

**Example:**
- If you exhaust quota at 2 PM PT on May 30
- Credits reset at 5 PM PT on May 30 (3 hours later)
- New quota available immediately

---

## Current Setup

### Polling Schedule

| Service | Frequency | Purpose | Gemini Calls |
|---------|-----------|---------|-------------|
| `mind-auto-router.py` | Every 1 min | Route inbox captures | ❌ None |
| **`mind-project-decomposer.py`** | **Every 15 min** | Decompose projects | ✅ **1 per stuck project** |
| `mind-kanban-syncer.py` | Every 10 min | Sync kanban board | ❌ None |

### Daily Quota Impact

**Best case (no stuck projects):**
- Decomposer: 0 calls
- Video Analyzer: ~5-10 calls (on-demand)
- **Total: 5-10 calls (0.3-0.7% of quota)** ✅

**Worst case (10 stuck projects + heavy video use):**
- Decomposer: 960 calls (10 projects × 96 cycles/day)
- Video Analyzer: 100 calls (50 videos analyzed)
- **Total: 1,060 calls (70.7% of quota)** ✅
- **Buffer: 440 calls remaining (29.3%)**

---

## Why 15-Minute Interval?

### The Problem (5-Minute Polling)

With 5-minute polling:
- 288 cycles per day
- If 5 projects stuck in `ready-for-review`: **1,440 calls/day (96% of quota exhausted)**
- Video analyzer gets no margin
- Free tier quota insufficient

### The Solution (15-Minute Polling)

- **96 cycles per day** (3× reduction from 5-min)
- If 5 projects stuck: **480 calls/day (32% of quota, safe)**
- Video analyzer gets **1,000+ calls buffer**
- Free tier quota sufficient even in worst case
- Projects still decomposed 4× per hour (responsive enough)

### Why Not 1-Hour Polling?

| Metric | 15 min | 1 hour |
|--------|--------|--------|
| Responsiveness | 4× per hour | 1× per hour |
| Project decomp speed | 6× faster | 4× slower |
| Safety with 10 stuck | 970 calls | 250 calls |
| Video analyzer buffer | 530 calls | 1,250 calls |

15 minutes provides better balance: responsive decomposition + safe quota margin + video analyzer buffer.

---

## Quota Consumers

### 1. Mind Project Decomposer (Polling)

**File:** `/Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py`

**Schedule:** Every 15 minutes (cron: `*/15 * * * * ...`)

**How It Works:**
1. Scans `03-projects/` for files with `status: ready-for-review` AND `type: capture`
2. For each project found, calls Gemini to decompose into tasks
3. Logs result to `~/.local/share/brain/logs/project-decomposer.log`

**Quota Cost:**
- 0 calls if no projects ready
- 1 call per project per polling cycle
- 96 projects maximum per day (96 cycles × 1 project)

**Monitor:**
```bash
tail -f ~/.local/share/brain/logs/project-decomposer.log
# Look for "No project files ready for decomposition" (quota safe)
# or "Decomposed N project(s)" (shows actual usage)
```

### 2. Video Analyzer (On-Demand)

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-core/services/video-analyzer/analyze.py`

**How It Works:**
- Called manually via Research Orchestrator in Obsidian
- Analyzes YouTube videos: structured metadata + transcript
- 2 Gemini calls per video (one for each output)
- Local rate limiting enforced (1,500 RPD, 15 RPM, 8h/day video)

**Quota Cost:**
- 0 calls if you don't use it
- ~2 calls per YouTube video analyzed
- Typical usage: 5-10 calls/day

**Monitor:**
```bash
cat ~/.local/video-orchestrator/state/gemini-rate-limits.json
# Shows today's video analyzer usage
```

### 3. n8n Workflow: Mind Inbox Classification

**Name:** "Mind Inbox — Capture & Classify with Signal Scoring"

**Status:** Active (webhook-triggered, NOT polling)

**How It Works:**
- Triggers only on incoming captures (manual or automated)
- Calls Gemini to classify capture into PARA system
- Saves result to `~/mind/capture/inbox/`

**Quota Cost:**
- 0 calls if no captures incoming
- 1 call per capture/email processed
- Typically low volume (0-10 calls/day)

**Note:** This is NOT the polling culprit. It only runs when triggered.

---

## Quota Safeguards (Implemented)

✅ **Decomposer polling reduced from 5 min → 15 min**
- Cuts quota burn by 66%
- Maintains project responsiveness
- Leaves buffer for video analyzer

✅ **Video analyzer has local rate limiting**
- Enforced limits: 1,500 RPD, 15 RPM, 8h video/day
- Prevents runaway quota consumption

✅ **n8n classification is webhook-triggered (not polling)**
- Only calls Gemini when captures arrive
- No quota burn from idle polling

✅ **Documentation tracks quota impact**
- This file maintains runbook for quota decisions
- Decision log records why 15-min was chosen
- Clear monitoring commands for quota usage

---

## How to Monitor Quota Usage

### Check Current Decomposer Activity

```bash
# Last 10 decomposer runs
tail -20 ~/.local/share/brain/logs/project-decomposer.log

# Expected output (safe):
# "No project files ready for decomposition"
# or
# "Decomposed 1 project(s)"

# Dangerous output (quota risk):
# "Decomposed 5 project(s)" (repeated every 15 min means 5 stuck projects)
```

### Check Video Analyzer Usage

```bash
# Today's usage
cat ~/.local/video-orchestrator/state/gemini-rate-limits.json

# Shows: calls_today, video_minutes_today, calls_remaining
```

### Manual Quota Check (Google Console)

Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

Select personal Google project → View "Requests per day" quota usage.

---

## What to Do If Quota Exhausted Before Daily Reset

### Immediate Action (Same Day)

1. **Find stuck projects:**
   ```bash
   grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/
   ```

2. **Fix them (choose one):**
   - Delete the stuck project (if it's a test)
   - Change status to something other than `ready-for-review`
   - Manually decompose and update the project file

3. **Verify decomposer stopped calling Gemini:**
   ```bash
   # Should show "No project files ready" in logs
   tail ~/.local/share/brain/logs/project-decomposer.log
   ```

4. **Wait for quota reset (UTC midnight):**
   - Reset happens at 00:00 UTC
   - Your time: 8 PM ET / 7 PM CT / 5 PM PT (previous day)

### Prevention

- **Weekly audit:** Check for stuck projects
  ```bash
  find ~/Repos/stevewesthoek/mind/03-projects -name "*.md" -exec grep -l "status: ready-for-review" {} \;
  ```

- **Never let projects sit in `ready-for-review`:**
  - Decompose them manually, or
  - Delete them, or
  - Change their status

---

## Implementation Details

### Crontab Entry

```bash
*/15 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
```

**Breakdown:**
- `*/15` = every 15 minutes
- `* * * *` = every hour, every day, every month, every weekday
- Script path = full path to decomposer
- `>> /dev/null 2>&1` = suppress output (logs go to dedicated log file)

### Verify Current Setup

```bash
# Check crontab entry
crontab -l | grep mind-project-decomposer
# Should show: */15 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# Check logs directory
ls -la ~/.local/share/brain/logs/
# Should have: project-decomposer.log, project-decomposer-error.log
```

---

## Related Files

- **Credentials:** `operations/accounts/credentials-index.md` (API key metadata)
- **Decision Log:** `operations/decision-log.md` (records why 15-min was chosen)
- **Audit Reports:** `operations/accounts/gemini-polling-*.md` (historical analysis)
- **Script Source:** `tools/scripts/mind-project-decomposer.py` (decomposer logic)

---

## FAQ

**Q: When exactly does quota reset?**  
A: 00:00 UTC (8 PM ET / 5 PM PT previous day). See "Quota Reset Times" section above.

**Q: Why not move to paid tier?**  
A: Unnecessary. With 15-minute polling, free tier is sufficient. Paid tier adds cost with no benefit at current usage levels.

**Q: What if I need faster project decomposition?**  
A: 15 minutes decomposes projects ~4× per hour. If you need faster, keep 5-minute polling BUT actively manage stuck projects to prevent quota exhaustion.

**Q: How do I temporarily pause quota consumption?**  
A: Find and fix stuck projects (see "What to Do If Quota Exhausted" section). Once cleared, decomposer uses ~0 calls until new projects arrive.

**Q: Can I schedule decomposer differently on weekends?**  
A: Yes. Cron supports complex schedules. Example: `*/15 * * * 1-5` = 15 min weekdays only. Modify if needed.

---

## Decision Record

**Decision:** Use 15-minute polling interval for mind-project-decomposer.py  
**Date:** 2026-05-30  
**Reason:** Balances project responsiveness (4× decomposition per hour) with quota safety (96 cycles/day vs 288 at 5-min)  
**Quota Impact:** Worst case 1,060 calls/day (70% quota) leaves 35% buffer for video analyzer  
**Alternatives Considered:**  
- 5 minutes (current): Too risky, exhausts quota with 5 stuck projects  
- 1 hour: Too slow, only 1× decomposition per hour  
- 15 minutes: **Chosen** — best balance  

**Implementation:** 2026-05-30 13:45 UTC  
**Verification:** Crontab updated, logs monitored, no quota-burned projects found  

---

**Last Updated:** 2026-05-30  
**Maintainer:** Claude Code  
**Status:** Active, safeguarded free tier
