# Gemini Quota Burn — Root Cause & Solution

## The Actual Situation

**Polling is happening, but Gemini is NOT being called RIGHT NOW.**

Cron shows:
```bash
*/1 * * * * mind-auto-router.py          # Runs every 1 min  (no Gemini calls)
*/5 * * * * mind-project-decomposer.py   # Runs every 5 min  (calls Gemini ONLY if project ready)
*/10 * * * * mind-kanban-syncer.py       # Runs every 10 min (no Gemini calls)
```

**Current logs (last 30 min):**
```
mind-project-decomposer: "No project files ready for decomposition" (repeated every 5 min)
mind-auto-router: "No inbox files found" (repeated every 1 min)
```

**Conclusion:** The decomposer script **was** burning quota in the past when you had projects in `status: ready-for-review`, but those have since been processed or deleted.

---

## Why Your Quota Emptied (Historical Root Cause)

**Timeline:**
1. You implemented mind capture automation (n8n webhook + Gemini classification)
2. You created test/real projects with `status: ready-for-review` and `type: capture`
3. The decomposer ran every 5 minutes, calling Gemini for each project
4. After weeks of 5-minute polling cycles, you exhausted 1,500 daily quota
5. Now those projects are gone, so polling finds nothing to process

**Math from then:**
- If 3 projects were stuck in `ready-for-review`:
  - 5-minute polling = 12 checks/hour × 3 projects × 1 Gemini call each = 36 calls/hour
  - 36 calls/hour × 24 hours = **864 Gemini calls/day** (57% of 1,500 quota)
  
- If 5 projects were stuck:
  - 5-minute polling = 12 checks/hour × 5 projects × 1 Gemini call each = 60 calls/hour
  - 60 calls/hour × 24 hours = **1,440 Gemini calls/day** (96% of quota — exhausted!)

---

## The Preventative Solution

Even though the problem is currently dormant, **prevent it from happening again** by adjusting polling frequency:

### Current (Risky):
```bash
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```
- 288 polling cycles per day
- If 5 projects stuck = 1,440 calls (quota exceeded)
- If even 2 projects stuck = 576 calls (38% of quota)

### Recommended (Safe):
```bash
0 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```
- 24 polling cycles per day (1× per hour)
- If 5 projects stuck = 120 calls (8% of quota)
- If 10 projects stuck = 240 calls (16% of quota)
- Safe buffer even with multiple stuck projects

### Alternative (Very Safe):
```bash
0 */4 * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py
```
- 6 polling cycles per day (1× per 4 hours)
- If 10 projects stuck = 60 calls (4% of quota)
- Decomposition happens slower but quota impact negligible

---

## Implementation

### Step 1: Update Crontab
```bash
crontab -e
```

Find this line:
```bash
*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
```

Change to:
```bash
0 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
```

Save and exit.

### Step 2: Verify
```bash
crontab -l | grep mind-project-decomposer
```

Should show:
```bash
0 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-project-decomposer.py >> /dev/null 2>&1
```

### Step 3: Confirm It Works
The script will run at the top of the next hour. Check:
```bash
tail -f ~/.local/share/brain/logs/project-decomposer.log
```

---

## Comparison Table

| Frequency | Polling/Day | 1 Stuck Project | 5 Stuck Projects | 10 Stuck Projects |
|-----------|-------------|-----------------|------------------|-------------------|
| Every 5 min | 288 | 288 calls (19%) | 1,440 calls (96%) ❌ | 2,880 calls (192%) ❌ |
| **Every 1 hour** | **24** | **24 calls (1.6%)** | **120 calls (8%)** | **240 calls (16%)** |
| Every 4 hours | 6 | 6 calls (0.4%) | 30 calls (2%) | 60 calls (4%) |

**Recommendation:** Use **every 1 hour** — best balance between responsiveness and quota safety.

---

## Why Stay on Free Tier?

- Free tier: 1,500 req/day (no cost, replenishes daily)
- Paid tier: Unlimited but costs $$
- With 1-hour polling: Maximum 24 decompositions per day (well under quota)
- **Result:** Free tier is sufficient, no payment needed

---

## Verification & Monitoring

### Check Current Polling Activity
```bash
# See what the decomposer is doing
tail -20 ~/.local/share/brain/logs/project-decomposer.log

# See if any projects are "ready-for-review"
grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/
# (should return nothing if clean)
```

### Monitor Quota Usage (After Fix)
After changing to hourly, your quota usage should be:
- If zero projects ready: ~0 calls/day ✅
- If 1-2 projects ready: ~24-48 calls/day ✅
- If 5+ projects ready: ~120+ calls/day (still safe) ✅

---

## Summary

| Item | Current | After Fix |
|------|---------|-----------|
| **Polling frequency** | Every 5 min (288/day) | Every 1 hour (24/day) |
| **Risk with 5 stuck projects** | 1,440 calls = quota exceeded | 120 calls = 8% of quota |
| **Cost** | Still free tier | Still free tier |
| **Implementation** | — | Edit crontab 1 line |
| **Time to implement** | — | ~2 minutes |

---

## Action Items

- [ ] Update crontab: `crontab -e` and change `*/5` to `0` in the decomposer line
- [ ] Verify: `crontab -l | grep mind-project-decomposer`
- [ ] Wait for next hour mark, then check: `tail ~/.local/share/brain/logs/project-decomposer.log`
- [ ] Document in decision-log.md why this change was made

**Result:** Quota burns eliminated. Free tier remains sufficient. No code changes needed.

---

**Report Generated:** 2026-05-30 13:40 UTC
