# ING Bank Statement Automation — Runbook

**Status:** Policy-blocked; manual human-approved procedure only
**Deployed:** Not deployed as an active Brain Scheduler job
**Frequency:** No automatic frequency
**Scripts:** 
- `brain/tools/scripts/bank-statement-login.js` (Playwright automation)
- `brain/tools/scripts/run-ing-bank-statement-download.sh` (Scheduler wrapper)
- `brain/tools/scripts/brain-scheduler-runner.mjs` (canonical runner; this job is blocked)

---

## Overview

**Purpose:** Provide a manual procedure for downloading monthly bank statements from ING Business Banking. This financial/credential-sensitive workflow is not an unattended Brain Scheduler job.

**Accounts downloaded:**
1. **Yeshua Academy** (Current Account) — NL89 INGB 0006 3699 60
2. **Yeshua Academy** (Current Account) — NL21 INGB 0113 0903 90
3. **Savings Account** (Savings) — [configured via UI]

**Output format:**
- File type: CSV
- Delimiter: Semicolon-separated values
- Period: Last calendar month
- Location: `~/Downloads/`

**Flow:**
1. A human explicitly starts the reviewed wrapper, observes the credential and 2FA boundary, verifies the downloaded files, and logs out.
2. The typed registry entry `ing-bank-statement-download` remains `policy-blocked`/`disabled`; the Brain Scheduler never launches it.
3. The wrapper validates local prerequisites and launches the Playwright script.
4. The script logs in and waits for explicit 2FA approval.
5. The human verifies the downloaded statements.
6. The script logs out and exits; no scheduler receipt is created.

---

## Architecture

```
Human-approved manual session
    ↓
run-ing-bank-statement-download.sh
    ├─ validates local prerequisites
    ├─ waits for explicit human approval
    │         ├─ validates credentials and script
    │         └─ calls bank-statement-login.js
    │             ├─ Chromium browser (headless=false)
    │             ├─ logs in to mijnzakelijk.ing.nl
    │             ├─ waits for 2FA approval on phone
    │             ├─ downloads statements after verification
    │             └─ logs out
    └─ no scheduler receipt is created
```

---

## Setup

### 1. Credentials File

Create `~/.config/ing/.env`:

```bash
mkdir -p ~/.config/ing
```

**File:** `~/.config/ing/.env`
```env
ING_USERNAME=your_username_here
ING_PASSWORD=your_password_here
ING_NTFY_TOPIC=stevewesthoek-bank-approval
```

**Security:**
- Local file only (not in git, in `.gitignore`)
- Never commit credentials
- File permissions: `600` (read/write owner only)

### 2. iOS Notifications (ntfy.sh)

Subscribe on your iPhone:

1. Open **Safari**
2. Visit: `https://ntfy.sh/stevewesthoek-bank-approval`
3. Tap **Share** → **Add to Home Screen** (or use ntfy iOS app)
4. When automation runs, you'll get a push notification to approve 2FA

**No account needed** — ntfy.sh is free and public.

### 3. Playwright Script

Already in place: `brain/tools/scripts/bank-statement-login.js`

Playwright is installed via n8n dependencies.

### 4. Brain Scheduler boundary

Already integrated:
- Brain Scheduler: `com.office.nightly-scheduler` is not a caller of this job
- No automatic nightly run
- Use only the reviewed manual wrapper
- Any future unattended proposal requires separate financial/credential approval

---

## Logs & Monitoring

### Manual-run logs

```bash
tail -f ~/Library/Logs/office-scheduler/nightly.log
```

Shows:
- Which jobs ran, which skipped
- Exit codes and durations
- Errors and warnings

### ING Download-Specific Logs

```bash
tail -f ~/Library/Logs/office-scheduler/ing-bank-statement-download.log
```

Shows:
- Login status
- 2FA approval detection
- Downloaded filenames
- Exit codes (0=success, 1=login failed, 2=2FA timeout, 3=no downloads, 4=config error)

### State Files

```bash
cat ~/.local/state/office-scheduler/ing-bank-statement-download.last
```

Shows:
- Last run status (success/failed/timeout)
- Exit code and duration
- Timestamp

---

## Manual Testing

### Test the Playwright Script

Run locally with a short timeout:

```bash
source ~/.config/ing/.env
TIMEOUT_SECONDS=120 node brain/tools/scripts/bank-statement-login.js
```

Expected behavior:
1. Chromium window opens
2. Logs into ING
3. Prompts for 2FA (you see iOS notification)
4. You approve on phone
5. Downloads statements
6. Closes browser

Exit codes:
- **0** = Success
- **1** = Login failed
- **2** = 2FA timeout
- **3** = Download failed
- **4** = Config error

### Test the Wrapper Script

```bash
bash ~/Repos/stevewesthoek/brain/tools/scripts/run-ing-bank-statement-download.sh
```

### Scheduler boundary

There is no supported full-scheduler test for this blocked financial job. Do not use `FORCE_RUN`, kickstart, or the legacy scheduler wrapper to invoke it.

```bash
# No scheduler invocation is supported for this blocked job.
```

Check logs:
```bash
tail -f ~/Library/Logs/office-scheduler/nightly.log
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "Credentials file not found" | `~/.config/ing/.env` missing | Create credentials file (see Setup section) |
| "2FA timeout" | You didn't approve in time | Check iOS notifications, try manual run |
| "Exit code 1: Login failed" | Wrong credentials or network issue | Verify username/password, check internet |
| "No download buttons found" | ING UI changed | Update Playwright selectors in script |
| The scheduler does not run ING | Intentional policy state | Confirm the registry entry remains `policy-blocked`/`disabled`; use an approved manual procedure only |
| An old monthly marker exists | Legacy evidence only | Do not treat it as a canonical receipt or activation proof |
| Files not in Downloads | Script error or wrong path | Check logs and Playwright output |

---

## File Locations

### Scripts
- `brain/tools/scripts/bank-statement-login.js` — Main Playwright automation
- `brain/tools/scripts/run-ing-bank-statement-download.sh` — manual/approved wrapper; not called by the scheduler
- `brain/tools/scripts/office-nightly-scheduler.sh` — retained compatibility wrapper; not the production launch target

### Configuration
- `~/.config/ing/.env` — Credentials (local, not in git)

### Credentials Index
- `brain/operations/accounts/credentials-index.md` — Reference

### Logs
- `~/Library/Logs/office-scheduler/nightly.log` — Main scheduler log
- `~/Library/Logs/office-scheduler/ing-bank-statement-download.log` — ING-specific log

### State
- `~/.local/state/office-scheduler/ing-bank-statement-download.last` — legacy marker; not canonical scheduler evidence

### Downloads
- `~/Downloads/*.csv` — Downloaded statements (semicolon-separated, last month)

---

## Decision Log

Key decisions made:
1. **Current boundary:** The older nightly-scheduler design is historical; the current typed registry keeps this financial workflow blocked and manual-only.
2. **No n8n workflow:** ING automation is too simple (single script) and too frequent-per-month-specific (1st only) for n8n overhead
3. **Playwright over RPA:** Playwright handles modern web components, JavaScript rendering, and shadow DOM better than older tools
4. **JavaScript evaluation for form interaction:** ING uses web components with shadow DOM; can't use Locator API; JavaScript evaluation is the fallback
5. **headless=false:** Headless browsers are easier to detect as bots; showing the browser window makes automation more human-like
6. **Hard timeout:** 10 minutes per login attempt prevents infinite loops and resource waste

---

## Related

- Credentials Index: `brain/operations/accounts/credentials-index.md`
- Brain Scheduler status: `brain/operations/runbooks/brain-scheduler-current-state.md`
- LaunchAgent Config: `brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist`
- Decision Log: `brain/operations/decision-log.md`
