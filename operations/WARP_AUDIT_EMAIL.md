# Warp Audit Email Delivery

## Overview

**Feature:** Monthly health audit results are automatically emailed to **info@prochat.tools**

**Why:** You'll never have to check log files — results come directly to your inbox

**Delivery:** After each audit run (1st of every month)

**Format:** Complete audit output with PASS/WARN/FAIL status

---

## Email Details

### Recipient
```
info@prochat.tools
```

### Email Subject Line
```
Brain Repo Health Audit - YYYY-MM-DD - [STATUS]
```

Where `[STATUS]` is one of:
- `EXCELLENT ✓` — All checks passed
- `GOOD (minor issues)` — Warnings but no errors
- `NEEDS ATTENTION (errors found)` — Critical issues detected

### Email Content

The email includes:
- ✓ Full audit output with all 10 checks
- ✓ Pass/Warn/Fail status for each check
- ✓ Summary statistics
- ✓ Overall health status
- ✓ Timestamp of audit run

### Example Email Subject
```
Brain Repo Health Audit - 2026-06-01 - EXCELLENT ✓
```

### Example Email Body (excerpt)
```
🏥 BRAIN REPO HEALTH AUDIT
============================

Started: Sat Jun 01 06:00:00 UTC 2026
Working directory: /workspace

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
Results emailed to: info@prochat.tools
```

---

## How It Works

### The Email Flow

```
GitHub Actions Trigger (1st of month)
    ↓
Warp Agent runs audit script
    ↓
Script captures all output
    ↓
Email sending function attempts delivery
    ↓
Email sent to info@prochat.tools
    ↓
Script completes with status
```

### Email Sending Methods (Automatic Fallback)

The script tries multiple email methods in order:

1. **sendmail** (Linux default)
2. **mail** (macOS/Linux alternative)
3. **mailx** (Alpine Linux, Warp container)
4. **ssmtp** (Lightweight option)

If any method is available, email is sent. If none available, audit still completes but email fails (logged with warning).

---

## Technical Setup

### Dependencies

**In Warp environment setup command:**
```bash
apk add --no-cache python3 bash git curl mailx && cd /workspace && npm install
```

**In GitHub Actions workflow:**
```bash
apt-get update -qq && apt-get install -y -qq mailutils
```

### Script Configuration

**Email recipient (in audit script):**
```bash
EMAIL_RECIPIENT="info@prochat.tools"
```

To change recipient:
1. Edit `operations/scripts/warp-health-audit.sh`
2. Find line: `EMAIL_RECIPIENT="info@prochat.tools"`
3. Change to new email address
4. Commit and push

---

## When Emails Are Sent

### Automatic Delivery
- ✅ Monthly on 1st of every month at 6:00 AM UTC
- ✅ One email per audit run
- ✅ Regardless of audit results (EXCELLENT or NEEDS ATTENTION)

### Manual Trigger
- ✅ When you manually trigger the workflow from GitHub Actions
- ✅ Testing/development runs also send emails

### Test Delivery

To test email delivery:

1. Go to GitHub → brain repo → Actions tab
2. Click "Monthly Brain Repo Health Audit via Warp"
3. Click "Run workflow" → "Run workflow"
4. Email sent within seconds after workflow completes

---

## Troubleshooting

### "Email send failed" Message

**Cause:** Mail utilities not installed in environment

**Solution:** 
- If using Warp: Update setup command to include `mailx`
- If running locally: Install mail utilities (`brew install mailutils` on Mac)

### Email Not Received

**Check:**
1. Verify `info@prochat.tools` is the intended recipient
2. Check Gmail spam folder (sometimes flagged as spam)
3. Verify the audit script ran successfully (check exit status)
4. Look for "Email sent successfully" message in audit output

**If still not received:**
1. Manually check the log: `operations/logs/warp-audits/`
2. Search for "Email" in the log file
3. If email failed silently, check mail utility availability

### Want to Change Email Recipient?

Edit the script:
```bash
# File: operations/scripts/warp-health-audit.sh
# Line: EMAIL_RECIPIENT="info@prochat.tools"

# Change to:
EMAIL_RECIPIENT="your-email@example.com"
```

Then commit and push.

---

## Email Sending Code

The email function in the audit script (`warp-health-audit.sh`):

```bash
send_email() {
    local recipient="$1"
    local subject="$2"
    local body="$3"

    # Try sendmail first (Linux in container)
    if command -v sendmail &> /dev/null; then
        echo "$body" | sendmail -t <<EOF
To: $recipient
Subject: $subject
Content-Type: text/plain; charset=UTF-8

$body
EOF
        return 0
    fi

    # Try mail command (macOS/Linux)
    if command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$recipient"
        return 0
    fi

    # Try mailx (Alpine Linux)
    if command -v mailx &> /dev/null; then
        echo "$body" | mailx -s "$subject" "$recipient"
        return 0
    fi

    # Try ssmtp (lightweight)
    if command -v ssmtp &> /dev/null; then
        printf "To: $recipient\nSubject: $subject\n\n$body" | ssmtp "$recipient"
        return 0
    fi

    return 1
}
```

---

## Security Notes

- ✅ Email sent over standard channels (no special encryption)
- ✅ Content is plain text (no sensitive credentials)
- ✅ Recipient is hardcoded (no environment variables needed)
- ✅ Script has no network access except mail send

---

## Future Enhancements

Optional improvements (not currently implemented):

- [ ] Attach full log file as PDF
- [ ] HTML formatted email with colors
- [ ] Conditional email (only on errors)
- [ ] Multiple recipients
- [ ] Digest mode (weekly summary email)

---

## Reference

**Script:** `operations/scripts/warp-health-audit.sh`  
**Workflow:** `.github/workflows/warp-monthly-health-audit.yml`  
**Setup guides:** `operations/WARP_*.md`

---

**Status:** ✅ Email delivery active  
**Recipient:** info@prochat.tools  
**Frequency:** Monthly (1st of month)  
**Cost:** Included (no additional charge)

