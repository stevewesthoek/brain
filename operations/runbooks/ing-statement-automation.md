# ING Bank Statement Automation — Runbook

**Status:** ✅ Active  
**Deployed:** Nightly Scheduler (LaunchAgent)  
**Frequency:** 1st of each month (runs at 3:00 AM Lisbon time via nightly scheduler)  
**Scripts:** 
- `brain/tools/scripts/bank-statement-login.js` (Playwright automation)
- `brain/tools/scripts/run-ing-bank-statement-download.sh` (Scheduler wrapper)
- `brain/tools/scripts/office-nightly-scheduler.sh` (Main nightly scheduler)

---

## Overview

**Purpose:** Automatically download monthly bank statements from ING Business Banking.

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
1. Nightly scheduler runs at 3 AM Lisbon time (every night)
2. Checks if today is the 1st of the month
3. If yes: launches Playwright script
4. Script logs in, handles 2FA via iOS notification
5. Downloads statements from all 3 accounts
6. Logs out and exits

---

## Architecture

```
LaunchAgent (macOS)
    ↓
office-nightly-scheduler.sh (every night, 3 AM Lisbon)
    ├─ Checks: Is it the 1st of the month?
    ├─ YES → run-ing-bank-statement-download.sh
    │         ├─ Validates credentials and script
    │         └─ Calls bank-statement-login.js
    │             ├─ Chromium browser (headless=false)
    │             ├─ Logs in to mijnzakelijk.ing.nl
    │             ├─ Waits for 2FA approval on phone
    │             ├─ Downloads statements (CSV, last month, all 3 accounts)
    │             └─ Logs out
    └─ NO → skips (logs: "not first of month")
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

### 4. Nightly Scheduler

Already integrated:
- LaunchAgent: `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` (symlink → brain)
- Runs nightly at 3 AM Lisbon time
- Executes `brain/tools/scripts/office-nightly-scheduler.sh`
- ING download runs **only on the 1st of the month**

---

## Logs & Monitoring

### Nightly Scheduler Logs

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

### Test the Full Nightly Scheduler

Force the nightly scheduler to run:

```bash
FORCE_RUN=1 bash ~/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh
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
| Nightly scheduler doesn't run | LaunchAgent not loaded | Check: `launchctl list \| grep nightly` |
| Nightly scheduler runs but skips ING | Not the 1st of month | Job only runs on the 1st; check logs |
| Files not in Downloads | Script error or wrong path | Check logs and Playwright output |

---

## File Locations

### Scripts
- `brain/tools/scripts/bank-statement-login.js` — Main Playwright automation
- `brain/tools/scripts/run-ing-bank-statement-download.sh` — Scheduler wrapper
- `brain/tools/scripts/office-nightly-scheduler.sh` — Main nightly scheduler

### Configuration
- `~/.config/ing/.env` — Credentials (local, not in git)

### Credentials Index
- `brain/operations/accounts/credentials-index.md` — Reference

### Logs
- `~/Library/Logs/office-scheduler/nightly.log` — Main scheduler log
- `~/Library/Logs/office-scheduler/ing-bank-statement-download.log` — ING-specific log

### State
- `~/.local/state/office-scheduler/ing-bank-statement-download.last` — Last run status

### Downloads
- `~/Downloads/*.csv` — Downloaded statements (semicolon-separated, last month)

---

## Decision Log

Key decisions made:
1. **Nightly scheduler vs. n8n:** Using nightly scheduler because it's lightweight, runs locally, and handles monthly scheduling elegantly via simple date check
2. **No n8n workflow:** ING automation is too simple (single script) and too frequent-per-month-specific (1st only) for n8n overhead
3. **Playwright over RPA:** Playwright handles modern web components, JavaScript rendering, and shadow DOM better than older tools
4. **JavaScript evaluation for form interaction:** ING uses web components with shadow DOM; can't use Locator API; JavaScript evaluation is the fallback
5. **headless=false:** Headless browsers are easier to detect as bots; showing the browser window makes automation more human-like
6. **Hard timeout:** 10 minutes per login attempt prevents infinite loops and resource waste

---

## Related

- Credentials Index: `brain/operations/accounts/credentials-index.md`
- Nightly Scheduler: `brain/tools/scripts/office-nightly-scheduler.sh`
- LaunchAgent Config: `brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist`
- Decision Log: `brain/operations/decision-log.md`
