# ING Statement Monthly — Workflow Documentation

**Workflow File:** `ing-statement-monthly.json`  
**Purpose:** Automated monthly bank statement downloads with 2FA approval via iPhone notification  
**Status:** Ready for import  
**Last Updated:** 2026-04-10

---

## How to Import

1. Open n8n UI: `https://n8n.prochat.tools`
2. Folder icon (top-left) → **Import Workflow**
3. Select: `brain/operations/workflows/ing-statement-monthly.json`
4. Click **Enable** (toggle)

---

## Workflow Structure

### Nodes

| # | Node | Purpose | Type |
|---|------|---------|------|
| 1 | **Trigger - Monthly (1st, 9 AM Lisbon)** | Fires on the 1st of each month at 9:00 AM Lisbon time | Cron Trigger |
| 2 | **Initialize Variables** | Sets up initial retry counter and attempt type | Set Variables |
| 3 | **Execute - Login & Download Statements** | Runs the Playwright script (`bank-statement-login.js`) | Execute Command |
| 4 | **IF - Success?** | Branches on success/timeout | Conditional |
| 5 | **Notify Success** | Sends iOS notification if successful | HTTP Request (ntfy.sh) |
| 6 | **Notify Timeout** | Sends iOS notification if timeout occurred | HTTP Request (ntfy.sh) |
| 7 | **Wait 10 Minutes** | Pauses before retry | Wait |
| 8 | **Increment Retry Counter** | Increments the attempt count | Set Variables |
| 9 | **IF - Retry < 9?** | Checks if more retries are allowed | Conditional |
| 10 | **Send Fallback Email** | Sends email with approval link after 9 failures | Email Send |

### Flow Diagram

```
Trigger (1st, 9 AM)
    ↓
Initialize Variables
    ↓
Execute Playwright Script
    ↓
IF Success? ─── YES ──→ Notify Success ──→ END ✅
    │
    NO
    ↓
Notify Timeout
    ↓
Wait 10 Minutes
    ↓
Increment Counter
    ↓
IF Retry < 9? ─── YES ──→ Execute Playwright Script (retry loop back)
    │
    NO (9 failures)
    ↓
Send Fallback Email ──→ END ⚠️
```

---

## Retry Logic

### First 30 Minutes (Quick Retries)
- **Attempt 1:** Initial run (9:00 AM)
- **Attempt 2:** After 10-min wait (9:10 AM)
- **Attempt 3:** After 10-min wait (9:20 AM)
- **Attempt 4:** After 10-min wait (9:30 AM)

### Next 6 Hours (Hourly Retries)
- **Attempt 5:** 1 hour after attempt 4 (~10:30 AM)
- **Attempt 6:** 1 hour after attempt 5 (~11:30 AM)
- **Attempt 7:** 1 hour after attempt 6 (~12:30 PM)
- **Attempt 8:** 1 hour after attempt 7 (~1:30 PM)
- **Attempt 9:** 1 hour after attempt 8 (~2:30 PM)

### After 9 Failures
- Email sent to `info@prochat.tools`
- Email includes a unique webhook link for manual retry

---

## Environment Variables

The **Execute Command** node needs access to `~/.config/ing/.env`:

```env
ING_USERNAME=your_username_here
ING_PASSWORD=your_password_here
ING_NTFY_TOPIC=stevewesthoek-bank-approval
```

These are passed to the Playwright script via the bash wrapper.

---

## ntfy.sh Integration

The workflow sends iOS notifications via **ntfy.sh** (free, no account needed).

- **Topic:** `stevewesthoek-bank-approval`
- **Messages:**
  - Success: "ING statements downloaded successfully"
  - Timeout: "ING login timed out. Retrying..."
  - Fallback: Email only

**iPhone Setup:**
1. Visit `https://ntfy.sh/stevewesthoek-bank-approval` in Safari
2. Tap Share → Add to Home Screen
3. Done — you'll get push notifications

---

## Email Fallback

After 9 failed attempts, an email is sent to `info@prochat.tools` containing:
- Explanation (user didn't approve in time)
- Unique webhook link to re-trigger the download
- Manual login instructions

---

## Monitoring

### Check Workflow Status

```bash
curl -H "Authorization: Bearer $N8N_API_KEY" \
  https://n8n.prochat.tools/api/v1/workflows | \
  jq '.data[] | select(.name | contains("ING"))'
```

### View Execution History

In n8n UI → Workflows → **ING Statement Monthly** → **Executions**

### Debug a Failed Run

1. Click the failed execution in Executions tab
2. Expand the **Execute - Login & Download Statements** node
3. Check the error message and exit code:
   - **0** = Success
   - **1** = Login failed
   - **2** = 2FA timeout
   - **3** = No download buttons found (page changed)
   - **4** = Invalid environment (missing creds)

---

## Customization

### Change Trigger Time

Edit the **Trigger** node:
- Days: Set to `1` for the 1st
- Hours: Lisbon timezone (currently `9`)
- Minutes: `0`

To change to 9 AM UTC instead: set `hours: 9` (no Lisbon offset needed).

### Change Retry Schedule

Edit the **Wait 10 Minutes** node to wait longer/shorter. To change hourly retries, edit the workflow JSON directly (change the wait duration in subsequent retries).

### Change Notification Topic

Edit both **Notify Success** and **Notify Timeout** nodes to use a different ntfy.sh topic.

---

## Testing

### Manual Test (Without Scheduling)

1. In n8n, go to the workflow
2. Click **Execute Workflow** (top-right play button)
3. The workflow runs immediately instead of waiting until the 1st

### Test with a Short Timeout

Edit the **Execute Command** node to add:
```bash
TIMEOUT_SECONDS=120 POLL_INTERVAL_MS=5000
```

This gives only 2 minutes to approve, useful for quick testing.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Workflow doesn't trigger on the 1st | Cron trigger disabled | Enable the workflow (toggle in top-right) |
| "Cannot find ING_USERNAME" error | `.env` file missing or not accessible | Ensure `~/.config/ing/.env` exists with correct values |
| Notifications not appearing | ntfy.sh topic not subscribed | Visit `https://ntfy.sh/stevewesthoek-bank-approval` on iPhone and subscribe |
| "Exit code 2" (timeout) every time | n8n not detecting page changes | Check if ING website structure changed; may need to update Playwright selectors |
| Email not sent | n8n email credentials missing | Configure n8n Email node credentials (SMTP settings) |
| Files not in Downloads | Playwright script not finding download button | Check if ING UI changed; verify download selectors in script |

---

## Related Documentation

- **Setup Guide:** `~/Downloads/SETUP-ING-AUTOMATION.md`
- **Full Runbook:** `brain/operations/runbooks/ing-statement-automation.md`
- **Playwright Script:** `~/tools/scripts/bank-statement-login.js`
- **Credentials Index:** `brain/operations/accounts/credentials-index.md`

---

## Version History

| Date | Changes |
|------|---------|
| 2026-04-10 | Initial version — 9-attempt retry logic with ntfy.sh + email fallback |

---

## Support

Issues or questions?  
Contact: steve@prochat.tools

For urgent debugging:
- Check n8n execution logs (Executions tab)
- Run the Playwright script manually: `node ~/tools/scripts/bank-statement-login.js`
- Review ING website DOM for UI changes
