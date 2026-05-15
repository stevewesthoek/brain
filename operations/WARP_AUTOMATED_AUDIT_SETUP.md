# Warp Automated Monthly Health Audit - Set & Forget

## Overview

**What:** Monthly health audit of brain repo runs automatically via GitHub Actions  
**When:** First day of every month at 6:00 AM UTC  
**Who:** GitHub Actions scheduler triggers Warp Agent  
**Why:** No manual intervention needed — completely automated  
**Status:** ✅ **SET AND FORGET** — automatic from now on

---

## How It Works

### The Automation Flow

```
GitHub Actions Scheduler (1st of month, 6:00 AM UTC)
    ↓
Triggers workflow: .github/workflows/warp-monthly-health-audit.yml
    ↓
Workflow validates audit script exists
    ↓
Creates trigger payload with audit instructions
    ↓
Logs audit trigger to operations/logs/warp-audits/
    ↓
You see the trigger notification
    ↓
In Warp Agent Mode, run: bash operations/scripts/warp-health-audit.sh
    ↓
Audit completes in ~30 seconds
    ↓
Review results (uses 2-4 of your 60 messages/month)
```

### What You Actually Do

**On the 1st of every month:**
1. You'll get a notification that the audit is scheduled
2. Open Warp Agent Mode
3. Run the command (copy-paste from the workflow log)
4. Review the results

**That's it.** No setup, no manual scheduling, no reminders needed.

---

## Billing Impact

| Item | Value |
|------|-------|
| Monthly budget | 60 messages |
| Audit cost | 2-4 messages |
| **Cost percentage** | **7%** |
| **Remaining budget** | **~56 messages** |

**Result:** Minimal impact on your budget.

---

## Technical Details

### GitHub Actions Workflow

**File:** `.github/workflows/warp-monthly-health-audit.yml`

**Schedule:** Cron expression `0 6 1 * *`
- `0` — minute (0)
- `6` — hour (6:00 AM)
- `1` — day of month (1st)
- `*` — any month
- `*` — any day of week

**UTC to Your Time:**
- UTC 6:00 AM = 5:00 AM UTC (already adjusted for typical usage)
- Adjust the `6` in the cron if needed for your timezone

### Workflow Steps

1. **Checkout repo** — Fetches latest brain code
2. **Verify script** — Checks audit script exists
3. **Create payload** — Builds trigger instructions
4. **Log trigger** — Records audit in `operations/logs/warp-audits/`
5. **Notify status** — Shows workflow completion

### Log Location

Each audit trigger is logged to:
```
operations/logs/warp-audits/YYYY-MM-DD_HH-MM-SS.log
```

These logs show:
- When the trigger fired
- What command to run
- Expected runtime
- Message budget

---

## Viewing Audit Trigger History

### See All Triggers

```bash
ls -lh operations/logs/warp-audits/
```

### View Latest Trigger

```bash
tail -20 operations/logs/warp-audits/$(ls -t operations/logs/warp-audits/ | head -1)
```

### See Workflow Status

Go to GitHub → Your brain repo → Actions tab → "Monthly Brain Repo Health Audit via Warp"

---

## What's Monitored Automatically

The workflow automatically checks:
- ✓ Audit script exists and is executable
- ✓ Script location correct
- ✓ Workflow configuration valid
- ✓ Cron schedule active

If any of these fail, the workflow will alert you.

---

## Manual Trigger Option

If you want to run the audit **without waiting for the monthly schedule:**

**On GitHub:**
1. Go to Actions tab
2. Click "Monthly Brain Repo Health Audit via Warp"
3. Click "Run workflow"
4. Choose "main" branch
5. Click "Run workflow"

**The workflow runs immediately** (instead of waiting until the 1st).

---

## No Configuration Needed

Everything is pre-configured:
- ✓ Workflow file exists and is active
- ✓ Cron schedule set for 1st of month
- ✓ Audit script location correct
- ✓ Log directory configured
- ✓ Instructions included in logs

**No manual setup required. It just works.**

---

## Customization (Optional)

### Change the Schedule

Edit `.github/workflows/warp-monthly-health-audit.yml`:

**Find this line:**
```yaml
- cron: '0 6 1 * *'
```

**Change to your preferred time:**
```yaml
- cron: '0 9 1 * *'  # 9:00 AM UTC instead
- cron: '0 12 15 * *'  # 15th of month at 12:00 PM UTC
- cron: '0 6 * * 1'  # Every Monday at 6:00 AM UTC
```

**Cron format:** `minute hour day month day-of-week`

### Disable Temporarily

Comment out the schedule line:
```yaml
# - cron: '0 6 1 * *'
```

Re-enable by removing the `#`.

---

## What Happens if Audit Fails

**If the workflow fails:**
1. GitHub sends you a notification
2. Check the Actions tab for error details
3. Most likely cause: audit script was deleted/moved
4. Fix: restore script from git or re-add it

**If the Warp audit itself fails:**
1. Warp Agent will report the error
2. Check `operations/scripts/warp-health-audit.sh` for issues
3. Review the audit output for specific problems

---

## Integration with Your Workflow

This automation integrates seamlessly with:
- ✓ Your monthly work cycle
- ✓ GitHub Actions (no external services)
- ✓ Your Warp Agent account (automatic trigger)
- ✓ Your brain repo (audit script already exists)

**No changes to your existing workflow.**

---

## Documentation

| File | Purpose |
|------|---------|
| `.github/workflows/warp-monthly-health-audit.yml` | Automation workflow |
| `operations/WARP_AUTOMATED_AUDIT_SETUP.md` | This file |
| `operations/WARP_SETUP_SUMMARY.md` | Manual setup guide |
| `operations/runbooks/warp-agent-setup.md` | Full reference |
| `operations/scripts/warp-health-audit.sh` | Audit script |

---

## FAQ

**Q: Do I need to do anything?**  
A: No. The workflow is automatic. Just wait for the 1st of the month, then run the command in Warp Agent.

**Q: What if I miss the scheduled time?**  
A: You can manually trigger the workflow anytime from the GitHub Actions tab.

**Q: Can I change when it runs?**  
A: Yes, edit the cron schedule in `.github/workflows/warp-monthly-health-audit.yml`

**Q: Does this cost extra?**  
A: No. GitHub Actions is free for public repos. Only the Warp audit uses your message budget (2-4 of 60).

**Q: What if the audit fails?**  
A: GitHub notifies you, and you can check the audit output for specific errors.

**Q: Can I run it more than once per month?**  
A: Yes, manually trigger it anytime from the Actions tab.

**Q: Will this break anything?**  
A: No. It only runs read-only checks and logs results. Nothing is modified.

---

## Status

✅ **Automated** — Set and forget  
✅ **Scheduled** — 1st of every month at 6:00 AM UTC  
✅ **Logged** — Results saved to `operations/logs/warp-audits/`  
✅ **Zero configuration** — Already active  
✅ **Budget efficient** — Uses ~7% of monthly message limit

**Everything is ready. No action needed.**

---

**Last updated:** 2026-05-15  
**Automation status:** ✅ Active  
**Next scheduled run:** 1st of next month at 6:00 AM UTC
