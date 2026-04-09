# ING Bank Statement Automation — Runbook

**Purpose:** Automated monthly download of CSV bank statements from ING Business Banking (mijnzakelijk.ing.nl).

**Status:** ✅ Active  
**Deployed:** n8n (self-hosted on Dokploy)  
**Frequency:** 1st of each month, 9:00 AM Lisbon time  
**Contact:** Steve Westhoek (steve@prochat.tools)

---

## What This Does

1. **Monthly trigger** — n8n wakes up on the 1st at 9 AM Lisbon time
2. **Logs in** — Playwright script logs into ING Business Banking
3. **Handles 2FA** — Sends you iOS push notification to approve on your phone
4. **Downloads statements** — Retrieves CSV files (semicolon-separated) for:
   - Checking Account 1
   - Checking Account 2
   - Savings Account
5. **Stores locally** — Files saved to `~/Downloads/` with original filenames
6. **Retry logic** — If you don't respond:
   - Retry 3x (every 10 minutes)
   - Then retry 6x (once per hour)
   - After 6 failures: email fallback link to info@prochat.tools

---

## Architecture

```
n8n scheduled trigger (1st of month, 9 AM Lisbon)
  ↓
n8n Execute Command node
  ↓
Playwright script (~/Downloads/bank-statement-login.js)
  ├─ Login to mijnzakelijk.ing.nl
  ├─ Detect 2FA screen
  ├─ Send iOS notification (ntfy.sh)
  ├─ Poll for approval (max 10 min)
  └─ Download statements OR timeout
  ↓
n8n workflow continues
  ├─ If success: log, store filenames
  ├─ If timeout: increment retry counter
  └─ If 6 failures: send email with fallback link
```

---

## Setup

### 1. Create Credentials File

Store your ING Business Banking credentials securely:

```bash
mkdir -p ~/.config/ing
```

Create `~/.config/ing/.env`:

```env
ING_USERNAME=your_username_here
ING_PASSWORD=your_password_here
ING_NTFY_TOPIC=stevewesthoek-bank-approval
```

**Never commit this file.** It's already in `.gitignore`.

### 2. Install Playwright Script

Copy the script to a permanent location (not Downloads):

```bash
cp ~/Downloads/bank-statement-login.js ~/tools/scripts/bank-statement-login.js
chmod +x ~/tools/scripts/bank-statement-login.js
```

Verify it runs locally first:

```bash
source ~/.config/ing/.env
TIMEOUT_SECONDS=120 POLL_INTERVAL_MS=5000 NTFY_TOPIC=$ING_NTFY_TOPIC \
  node ~/tools/scripts/bank-statement-login.js
```

### 3. Set Up iOS Notifications (ntfy.sh)

ntfy.sh is a free, no-account-needed notification service with native iOS support.

**On iOS:**
1. Open Safari
2. Visit: `https://ntfy.sh/stevewesthoek-bank-approval`
3. Tap the share button → Add to Home Screen (or bookmark)
4. Or: Install the [ntfy iOS app](https://apps.apple.com/us/app/ntfy/id1625396347)
5. Subscribe to: `stevewesthoek-bank-approval`

From now on, when the automation sends a notification to this topic, you'll get an iOS push.

### 4. Add Credentials to n8n

In n8n, create a new **Credentials** entry:

1. Go to n8n UI: `https://n8n.prochat.tools`
2. Settings → Credentials → New → Generic Credentials
3. Fill in:
   - **Name:** `ING Business (Personal)`
   - **Username:** (same as `ING_USERNAME` in `.env`)
   - **Password:** (same as `ING_PASSWORD` in `.env`)
4. Save

This keeps credentials encrypted within n8n, not in git.

### 5. Import n8n Workflow

See: `brain/operations/workflows/ing-statement-monthly.json`

Steps:
1. In n8n, click the folder icon in the top-left
2. Select "Import Workflow"
3. Paste the JSON from `ing-statement-monthly.json`
4. Update the **ING Business (Personal)** credential reference if needed
5. Enable the workflow

---

## How to Test Locally

**Manual test (without scheduling):**

```bash
# 1. Load credentials
source ~/.config/ing/.env

# 2. Run the script with a short timeout (2 minutes)
TIMEOUT_SECONDS=120 POLL_INTERVAL_MS=5000 NTFY_TOPIC=$ING_NTFY_TOPIC \
  node ~/tools/scripts/bank-statement-login.js

# 3. Immediately go to your phone and approve the login in the ING app
# You should see the iOS notification within 10 seconds
```

**If you get exit code 2:** Timeout — the script didn't detect your phone approval. Check:
- Is the notification reaching your phone?
- Did you tap the ING app link in time?
- Is your network stable?

**If you get exit code 3:** No download buttons found. The ING website structure may have changed — contact Steve.

---

## Retry Logic (n8n Workflow)

If the Playwright script exits with code 2 (timeout):

1. **Wait 10 minutes** → Attempt 1 of 3
2. **Wait 10 minutes** → Attempt 2 of 3
3. **Wait 10 minutes** → Attempt 3 of 3
4. **Wait 1 hour** → Attempt 1 of 6 (hourly, until 6 AM next day)
5. ... (continue hourly)
6. **After 6 hourly attempts:** Email to `info@prochat.tools` with approval link

The email includes a unique webhook link. Click it to re-trigger the workflow without waiting.

---

## File Storage

Downloaded statements are saved to: `~/Downloads/`

**Filename format:** Unchanged from ING (e.g., `statement_20260401_20260430.csv`)

After download, you can:
- Move them to a Cloud Drive (Dropbox, OneDrive, etc.)
- Archive them in a local folder structure
- Import them into accounting software

---

## Monitoring

### Check if workflow is enabled:
```bash
curl -H "Authorization: Bearer $N8N_API_KEY" \
  https://n8n.prochat.tools/api/v1/workflows | jq '.data[] | select(.name | contains("ING"))'
```

### View recent executions:
In n8n UI → Workflows → ING Statement Monthly → Executions tab

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Notification sent but no iOS alert" | Check if Safari tab/app is active; notifications only work in background. Try the ntfy app instead. |
| "2FA times out even though I approved" | Playwright may not detect the page change. ING's DOM structure may have changed — check the script's selectors. |
| "Downloads don't appear in ~/Downloads" | Check file permissions on Downloads folder: `chmod 755 ~/Downloads` |
| "Script works locally but fails in n8n" | n8n may run in a sandboxed environment. Check n8n's working directory and environment variables. |
| "Wrong filename format in downloads" | ING's filename format changes sometimes. Adjust the script's download handler if needed. |

---

## Credentials Index

This automation uses credentials tracked in:
- **File:** `~/.config/ing/.env`
- **Index:** `brain/operations/accounts/credentials-index.md` (ING entry)
- **Rotation:** Manual (change password in ING UI, then update `~/.config/ing/.env`)

To rotate ING credentials:
1. Change password in mijnzakelijk.ing.nl
2. Update `~/.config/ing/.env`
3. Update n8n credentials (Settings → Credentials → ING Business)
4. Run a manual test

---

## Decision Log

See: `brain/operations/decision-log.md`

Key decisions:
- **ntfy.sh over Telegram/Slack:** Free, no account needed, native iOS support, iOS deep link capability
- **Playwright over Puppeteer:** Better cross-browser support, built-in 2FA handling
- **Session persistence rejected:** 2FA defeats session caching; polling is the only reliable option
- **n8n over standalone cron:** Centralized visibility, built-in retry logic, webhook fallback

---

## Related

- Decision Log: `brain/operations/decision-log.md`
- n8n workflow: `brain/operations/workflows/ing-statement-monthly.json`
- Credentials index: `brain/operations/accounts/credentials-index.md`
- Playwright script: `~/tools/scripts/bank-statement-login.js`
