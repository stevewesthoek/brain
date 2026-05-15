# Complete Warp Setup: Manual + Automated

## TL;DR - Three Simple Steps

### 1. Create Warp Environment (One-time)

Fill in these 5 fields in Warp:
- **Name:** `brain-health-audit`
- **Description:** `Monthly infrastructure health check for brain repo - verifies skill sync, symlinks, documentation, git status, and reports issues`
- **Repo(s):** `stevewesthoek/brain`
- **Docker image:** `node:24-alpine`
- **Setup command:** `apk add --no-cache python3 bash git curl && cd /workspace && npm install`

Click Create. Done.

### 2. Automation is Active (Now)

GitHub Actions automatically triggers on the **1st of every month at 6:00 AM UTC**.  
You don't need to do anything else.

### 3. Monthly: Check Your Notifications

When you see the trigger on the 1st, run in Warp Agent Mode:
```
bash operations/scripts/warp-health-audit.sh
```

**That's it. Set and forget.**

---

## Understanding the Setup

### What This Is

A **fully automated monthly infrastructure health check** for your brain repo that:
- ✅ Triggers automatically on the 1st of every month
- ✅ Runs 10 comprehensive checks
- ✅ Uses 2-4 of your 60 free Warp messages
- ✅ Requires zero manual intervention after setup

### Two Components

| Component | Purpose | When |
|-----------|---------|------|
| **Manual Setup** | Create Warp environment once | Today (5 min) |
| **Automation** | GitHub Actions triggers audit | Monthly (automatic) |

---

## Part 1: Manual Setup (One-Time - 5 Minutes)

### In Warp - Create Environment

**Go to:** Warp → Environments → Create environment

**Fill in these exact values:**

```
Name:
brain-health-audit

Description:
Monthly infrastructure health check for brain repo - verifies skill sync, 
symlinks, documentation, git status, and reports issues

Repo(s):
stevewesthoek/brain

Docker image reference:
node:24-alpine

Setup command(s):
apk add --no-cache python3 bash git curl && cd /workspace && npm install
```

**Click:** Create

**Result:** ✅ Environment created and ready

---

## Part 2: Automation (Already Active)

### GitHub Actions Workflow

**File:** `.github/workflows/warp-monthly-health-audit.yml`

**Status:** ✅ Already committed and active

**Trigger:** 1st of every month at 6:00 AM UTC

**What it does:**
1. Verifies audit script exists
2. Creates trigger instructions
3. Logs the trigger
4. Notifies you

**Result:** ✅ You get notified on the 1st of each month

---

## Part 3: Monthly Execution (What You Do)

### On the 1st of Each Month

When you see the GitHub Actions notification:

**In Warp Agent Mode, run:**
```bash
bash operations/scripts/warp-health-audit.sh
```

**The audit will:**
- ✓ Run 10 health checks (30 seconds)
- ✓ Report PASS/WARN/FAIL for each check
- ✓ Provide summary and recommendations
- ✓ Use 2-4 of your 60 messages

**You then:**
- Review the results
- Fix any issues if needed
- Move on with your month

---

## Billing Breakdown

**Hard Cap:** 60 messages/month (after 2-month promo)

| Usage | Count |
|-------|-------|
| Monthly audit | 1 |
| Messages per audit | 2-4 |
| **Messages used** | **2-4** |
| **Percentage of budget** | **~7%** |
| **Messages remaining** | **~56** |

**Conclusion:** You have plenty of budget for other work.

---

## What Gets Checked (10 Checks)

1. **Skill Sync** — All skills synced to all consumers?
2. **Symlinks** — All critical symlinks intact?
3. **Critical Files** — All required docs exist?
4. **Documentation** — Docs present and substantive?
5. **Secrets Scan** — Any accidentally committed secrets?
6. **Git Status** — Uncommitted or unpushed changes?
7. **Node/NPM Health** — Node and npm working?
8. **CLI Tools** — git, bash, node, spark-cli available?
9. **Directory Structure** — Key directories exist?
10. **Recent Commits** — Latest activity overview?

---

## Documentation Reference

| Document | Purpose |
|----------|---------|
| `operations/WARP_SETUP_SUMMARY.md` | Quick start guide |
| `operations/WARP_ENVIRONMENT_FILL_IN.md` | Copy-paste config values |
| `operations/WARP_AUTOMATED_AUDIT_SETUP.md` | Automation details |
| `operations/runbooks/warp-agent-setup.md` | Full reference |
| `operations/scripts/warp-health-audit.sh` | Audit script (8.2KB) |
| `.github/workflows/warp-monthly-health-audit.yml` | GitHub Actions workflow |

---

## FAQ

### Q: Do I need to do anything after initial setup?

A: No. GitHub Actions handles the monthly trigger automatically. Just run the command when you see the notification.

### Q: What if I want to run the audit outside of the schedule?

A: Manually trigger it anytime from GitHub Actions tab → "Monthly Brain Repo Health Audit via Warp" → Run workflow

### Q: Can I change when the audit runs?

A: Yes, edit the cron schedule in `.github/workflows/warp-monthly-health-audit.yml`

### Q: What if I'm traveling or unavailable on the 1st?

A: The automation still triggers (logs the trigger). You can run the audit anytime that month or wait for the next month.

### Q: Does the workflow cost anything?

A: No. GitHub Actions is free for public repos. Only the Warp audit uses your message budget.

### Q: What if the audit fails?

A: GitHub notifies you. Check the audit output for specific errors and fix them.

### Q: Can I run it weekly or daily instead?

A: Yes, change the cron schedule. Examples:
- Every Monday: `cron: '0 6 * * 1'`
- Every 15th: `cron: '0 6 15 * *'`
- Weekly: `cron: '0 6 * * 0'`

### Q: Does this modify anything in my repo?

A: No. It only runs read-only checks and logs results. Nothing is changed.

### Q: Where are the audit logs stored?

A: `operations/logs/warp-audits/YYYY-MM-DD_HH-MM-SS.log`

---

## Implementation Checklist

- ✅ Audit script created and tested
- ✅ GitHub Actions workflow configured
- ✅ Documentation written (3 guides)
- ✅ Automation active (no user action needed)
- ✅ Budget optimized (7% of 60 messages)
- ✅ Set and forget ready

**Status: READY TO USE**

---

## Next Actions

### For You (Today)

1. Copy the 5 field values from "Manual Setup" section
2. Go to Warp and create the environment
3. Done ✅

### Automatic (1st of Next Month)

1. GitHub Actions triggers automatically
2. You get notified
3. Run the audit in Warp Agent Mode
4. Review results
5. Done ✅

---

## File Locations

**Workflow:**
```
.github/workflows/warp-monthly-health-audit.yml
```

**Audit Script:**
```
operations/scripts/warp-health-audit.sh
```

**Audit Logs:**
```
operations/logs/warp-audits/
```

**Documentation:**
```
operations/WARP_*.md files
operations/runbooks/warp-agent-setup.md
```

---

## Support

All documentation is in the repo:
- Questions about setup? → `operations/WARP_SETUP_SUMMARY.md`
- Questions about automation? → `operations/WARP_AUTOMATED_AUDIT_SETUP.md`
- Full reference? → `operations/runbooks/warp-agent-setup.md`
- Quick values? → `operations/WARP_ENVIRONMENT_FILL_IN.md`

---

**Status:** ✅ Complete and ready to use  
**Setup time:** 5 minutes (one-time)  
**Monthly effort:** ~5 minutes (review results)  
**Automation:** ✅ Active (set and forget)  
**Budget:** 2-4 messages/month (7% of 60)  
**Next trigger:** 1st of next month at 6:00 AM UTC

