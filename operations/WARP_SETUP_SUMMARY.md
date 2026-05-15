# Warp Agent Environment - Complete Setup Guide

## What You're About to Create

A **Warp Agent environment** that runs a comprehensive health audit of your brain repo **once per month**.

**Cost:** 2-4 of your 150 free Warp messages  
**Benefit:** Automated verification that your infrastructure is healthy  
**Setup time:** 5 minutes

---

## Why This Makes Sense

✓ You have 150 free Warp messages/month (lots unused)  
✓ Your brain repo is critical infrastructure  
✓ Monthly audits catch problems early  
✓ Completely automated — just ask Warp to run it  
✓ Clear pass/fail/warning status  
✓ Costs ~2% of your free budget

---

## Step-by-Step Setup

### Step 1: Open Warp
Open your Warp account and go to **Environments**

### Step 2: Click "Create Environment"

### Step 3: Fill In These 5 Fields

| # | Field | Value |
|---|-------|-------|
| 1 | **Name** | `brain-health-audit` |
| 2 | **Description** | `Monthly infrastructure health check for brain repo - verifies skill sync, symlinks, documentation, git status, and reports issues` |
| 3 | **Repo(s)** | `stevewesthoek/brain` |
| 4 | **Docker image reference** | `node:24-alpine` |
| 5 | **Setup command(s)** | `apk add --no-cache python3 bash git curl && cd /workspace && npm install` |

### Step 4: Click "Create"

✅ **Done!** Your environment is ready.

---

## Using It (Monthly)

### Once per month in Warp Agent Mode:

**Copy-paste this prompt:**
```
Run the health audit in the brain-health-audit environment. 
Execute: bash operations/scripts/warp-health-audit.sh

Report findings on skill sync, symlinks, documentation, secrets, git status, and node health.
```

**Expected output:**
- ✓ 10 comprehensive checks
- ✓ Clear PASS/WARN/FAIL status
- ✓ Summary of overall health
- ✓ 30-second runtime

**Messages used:** 2-4 (you have 150/month)

---

## What Gets Checked

The audit runs these 10 checks automatically:

```
1. ✓ Skill Sync        → Are all skills synced to all consumers?
2. ✓ Symlinks         → Are all critical symlinks intact?
3. ✓ Critical Files   → Does all required documentation exist?
4. ✓ Documentation    → Are docs present and substantive?
5. ✓ Secret Scan      → Are there accidentally committed secrets?
6. ✓ Git Status       → Any uncommitted changes or unpushed commits?
7. ✓ Node/NPM Health  → Are Node and npm working?
8. ✓ CLI Tools        → Are git, bash, node, spark-cli available?
9. ✓ Directory Structure → Do all key directories exist?
10. ✓ Recent Commits  → What's the latest activity?
```

---

## What Happens If Issues Are Found

### Red (✗ Errors)
Critical problems detected (broken symlinks, failed skill sync)  
→ Fix before next deploy

### Yellow (⚠ Warnings)
Minor issues (uncommitted changes, missing optional file)  
→ Address when convenient

### Green (✓ Passes)
Everything is healthy  
→ No action needed

---

## Example Output

```
🏥 BRAIN REPO HEALTH AUDIT
============================

1. Skill Sync Verification ✓
2. Symlink Integrity Check ✓
3. Critical Files ✓
4. Documentation ✓
5. Secret Scan ✓
6. Git Status ✓
7. Node/NPM Health ✓
8. CLI Tools ✓
9. Directory Structure ✓
10. Recent Commits ✓

════════════════════════════════════════
HEALTH AUDIT SUMMARY
════════════════════════════════════════
Passed:  33
Warnings: 0
Errors:   0

✓ BRAIN REPO HEALTH: EXCELLENT
All critical systems operational.
```

---

## Files Created for You

| File | Purpose |
|------|---------|
| `operations/scripts/warp-health-audit.sh` | The audit script (runs the checks) |
| `operations/runbooks/warp-agent-setup.md` | Full documentation |
| `operations/WARP_ENVIRONMENT_FILL_IN.md` | Copy/paste values |
| `operations/WARP_SETUP_SUMMARY.md` | This file |

---

## Cost Analysis

| Item | Count |
|------|-------|
| Free Warp messages/month | 150 |
| Health audit runs/month | 1 |
| Messages per audit | 2-4 |
| **Messages used** | **2-4** |
| **Messages remaining** | **~140+** |
| **Percentage of budget** | **~3%** |

**Conclusion:** Excellent use of your free credits with room to spare.

---

## Next Steps

1. ✅ Fill in the 5 fields in Warp (see table above)
2. ✅ Click "Create"
3. ✅ Save the prompt (see "Using It" section above)
4. ✅ Once per month, run the audit in Warp Agent Mode
5. ✅ Review the results and fix any issues

---

## Questions?

**Full documentation:** `operations/runbooks/warp-agent-setup.md`  
**Quick reference:** `operations/WARP_ENVIRONMENT_FILL_IN.md`  
**Script location:** `operations/scripts/warp-health-audit.sh`

---

## Ready?

Grab the values from the table above and create the environment in Warp now!

**You have everything you need. The script is tested and ready to go.**

---

**Last updated:** 2026-05-15  
**Status:** Ready to use  
**Cost per run:** 2-4 messages  
**Frequency:** Monthly  
**Estimated setup time:** 5 minutes
