# Gemini Quota — Quick Reference Card

**Keep this in your tab bar. Check when quota seems high or low.**

---

## Reset Schedule

**Gemini API free-tier resets at:**
- 🕐 **00:00 UTC** (Coordinated Universal Time)
- 🇺🇸 **8 PM ET** (previous day) | **7 PM CT** | **5 PM PT**

If quota exhausted at 2 PM PT on May 30 → resets at 5 PM PT (3 hours later).

---

## Current Setup

| Component | Frequency | Gemini Calls |
|-----------|-----------|-------------|
| Project Decomposer | Every **15 min** | 1 per stuck project |
| Video Analyzer | On-demand | 2 per video |
| n8n Classification | When triggered | 1 per capture |

---

## Daily Quota Safe Zones

| Scenario | Calls/Day | % of 1,500 | Status |
|----------|-----------|-----------|--------|
| No projects, no videos | ~0-10 | <1% | ✅ Safe |
| 1 stuck project, normal video use | ~100-110 | ~7% | ✅ Safe |
| 5 stuck projects + heavy video | ~490 | ~33% | ✅ Safe |
| 10 stuck projects + heavy video | ~970 | ~65% | ✅ Safe (35% buffer) |
| 15+ stuck projects | ~1,400+ | >90% | ⚠️ Risk zone |

---

## Check Quota Status Right Now

```bash
# 1. Decomposer activity (should be "No project files ready")
tail -5 ~/.local/share/brain/logs/project-decomposer.log

# 2. Any stuck projects?
grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/
# (should return nothing)

# 3. Video analyzer usage today
cat ~/.local/video-orchestrator/state/gemini-rate-limits.json
# Look at: "calls_today" and "calls_remaining"
```

---

## If Quota Exhausted

**Before Reset (Same Day):**
1. Find stuck projects: `grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/`
2. Fix them: delete, change status, or manually decompose
3. Wait for reset at midnight UTC

**Prevent Future Exhaustion:**
- Never leave projects in `status: ready-for-review` indefinitely
- Weekly audit: `find ~/Repos/stevewesthoek/mind/03-projects -name "*.md" -exec grep -l "status: ready-for-review" {} \;`
- Keep crontab at `*/15` (don't revert to `*/5`)

---

## Full Documentation

👉 **See:** `operations/runbooks/gemini-quota-management.md`

---

## Why 15-Minute Polling?

- **5 min:** 288 cycles/day → quota exhausted if 5+ projects stuck ❌
- **15 min:** 96 cycles/day → safe even with 10 stuck projects ✅
- **1 hour:** 24 cycles/day → too slow for project responsiveness

**15 minutes = sweet spot** (responsive + safe + free tier sufficient)

---

**Last Updated:** 2026-05-30  
**Crontab Status:** ✅ Updated to `*/15`  
**Quota Status:** ✅ Safeguarded
