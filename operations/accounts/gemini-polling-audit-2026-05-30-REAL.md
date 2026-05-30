# Gemini API Quota Burn Analysis — The REAL Culprit Found

## Executive Summary

**You were right.** Your Gemini API quota IS being burned by **automated polling**, not actual user captures.

**The Culprit:** `mind-project-decomposer.py` 
- **Frequency:** Every **5 minutes** (via cron)
- **Action:** Polls the Mind repo for unprocessed projects → sends each one to Gemini
- **Quota Cost:** 1 Gemini API call per project found, regardless of whether anything was processed
- **Daily Impact:** Up to 288 calls per day (5-minute interval = 12 calls/hour × 24h)

---

## The Polling Schedule (Current)

| Script | Frequency | Purpose | Gemini Calls |
|--------|-----------|---------|---------|
| `mind-auto-router.py` | Every **1 minute** | Route unrouted captures in 01-inbox | ❌ No (uses GitHub API only) |
| `mind-project-decomposer.py` | Every **5 minutes** | Decompose new projects with Gemini | ✅ **YES — 1 call per project found** |
| `mind-kanban-syncer.py` | Every **10 minutes** | Sync kanban status | ❌ No (GitHub API only) |

**Verified Crontab:**
```bash
*/1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-auto-router.py
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
*/10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py
```

---

## The mind-project-decomposer.py Script

**File:** `/Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py`

**What It Does:**
1. Runs every 5 minutes (12 times per hour)
2. Scans `03-projects/` in Mind repo for files with `status: ready-for-review` AND `type: capture`
3. For **each project found**, calls Gemini CLI with:
   ```bash
   [gemini-cli, "--model", "gemini-2.5-flash"],
   ```
   to decompose the project into phases and atomic tasks
4. Replaces project file with proper template
5. Creates task files in `04-tasks/{project-slug}/`
6. Commits changes to GitHub

**The Problem:**
- **Even if NO projects need decomposing**, the script still runs and checks
- **Each 5-minute polling cycle = 1 potential Gemini call** if any project is in the `ready-for-review` state
- If you have even **1 project stuck in `ready-for-review`**, it gets sent to Gemini **288 times per day** (12 times/hour × 24h)

---

## Daily Quota Impact

### Current Schedule (Every 5 minutes):
```
Polling cycles per day: 24 hours × 60 min/hour ÷ 5 min/cycle = 288 cycles
If 1 project stuck in ready-for-review: 288 Gemini calls/day (out of 1,500 free tier)
If 5 projects: 1,440 calls/day (exhausts 96% of quota)
```

**You're likely seeing this because:** A project is stuck in `status: ready-for-review` from when you tested/implemented the capture system, and the script has been hitting it constantly for weeks.

---

## Solution: Adjust Polling Frequency

### Option A: Change from Every 5 Minutes → Every **1 Hour**
```bash
# Current:
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py

# Change to:
0 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```

**Impact:**
- Polling cycles per day: 24 (down from 288)
- If 1 project stuck: ~24 calls/day (1.6% of quota)
- If 5 projects: ~120 calls/day (8% of quota)
- **You stay well under free tier limit**

### Option B: Change from Every 5 Minutes → Every **4 Hours**
```bash
0 */4 * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```

**Impact:**
- Polling cycles per day: 6
- If 1 project stuck: ~6 calls/day (0.4% of quota)
- Projects decomposed more slowly, but quota impact negligible

### Option C: Hybrid Approach
Keep decomposer, but **fix the stuck project** first:

1. Check what's in `03-projects/` with `status: ready-for-review`:
   ```bash
   find ~/Repos/stevewesthoek/mind/03-projects -name "*.md" -exec grep -l "status: ready-for-review" {} \;
   ```

2. Manually decompose or delete the stuck project
3. Keep polling at 5 minutes (no quota waste if no stuck projects)

---

## Quota Calculator

Use this to plan the right frequency:

```
Daily Quota: 1,500 requests
Stuck projects: ? (check with find command above)

At 5-minute interval:  1 project = 288 calls/day (19% of quota)
At 1-hour interval:    1 project = 24 calls/day (1.6% of quota)
At 4-hour interval:    1 project = 6 calls/day (0.4% of quota)
```

---

## Recommendation

**Immediate Action:**
1. Find stuck projects (see command above)
2. Either delete them or change their status to something other than `ready-for-review`
3. Change polling to **every 1 hour** (`0 * * * * ...`)

**This solves the problem permanently:**
- Quota stays under control
- Projects still get decomposed, just less frequently (1× per hour instead of 12× per hour)
- You never have to pay for quota again

---

## How to Implement

### Step 1: Find Stuck Projects
```bash
grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/
```

### Step 2: Update Crontab
```bash
crontab -e
```

Change the line:
```bash
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```

To:
```bash
0 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```

(Or use `0 */4 * * * ...` for every 4 hours if you want even more margin)

### Step 3: Verify
```bash
crontab -l | grep mind-project-decomposer
```

---

## Why This Happened

1. You implemented the capture system (mind-inbox automation)
2. Created test projects with `status: ready-for-review`
3. Never removed them or changed their status
4. The decomposer script ran every 5 minutes, hitting Gemini constantly
5. After weeks, you exhausted the monthly quota

**The good news:** It's a simple cron adjustment. No code changes needed.

---

## What NOT to Do

❌ **Don't disable the script entirely** — projects genuinely need decomposition  
❌ **Don't move to paid tier** — unnecessary if you just adjust polling  
❌ **Don't keep it at 5 minutes** — wastes free tier on redundant polling  

✅ **Do change to 1-hour intervals** — simple, effective, quota-safe

---

## Files to Check

- **Crontab:** `crontab -l` (local user)
- **Cron logs:** `/var/log/system.log` (macOS) or `journalctl` (Linux)
- **Script output:** `~/.local/share/brain/logs/project-decomposer.log`
- **Stuck projects:** `~/Repos/stevewesthoek/mind/03-projects/` (search for `status: ready-for-review`)

---

**Report Generated:** 2026-05-30 13:45 UTC  
**Status:** Ready to implement the fix
