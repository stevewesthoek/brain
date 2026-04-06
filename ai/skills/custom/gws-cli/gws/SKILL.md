---
name: gws
description: Use when the user asks to work with Google Workspace services via the CLI — reading email, managing Drive files, Sheets, Calendar, Docs, Tasks, Contacts, and more. Supports multiple authenticated Google accounts via `gwsa`. Assumes gws is installed globally via Homebrew.
---

# Google Workspace CLI (gws)

## What this skill is for
Help Claude use `gwsa` (multi-account wrapper) or `gws` to interact with Google Workspace services (Gmail, Drive, Calendar, Sheets, Docs, Tasks, etc.) safely and consistently from the command line.

## Use this skill when
- Reading, searching, or sending Gmail messages
- Listing or reading Google Drive files and folders
- Reading or writing Google Sheets
- Managing Google Calendar events
- Reading or writing Google Docs
- Managing Tasks, Contacts, or Keep notes
- Running cross-service workflows via `gws workflow`

## Do not use this skill for
- Operations on production or shared org data without explicit user confirmation
- Sending emails or creating calendar events without stating the action and waiting for confirmation
- Destructive operations (delete emails, delete files) without explicit user confirmation

## Safety rules
1. **Auth before anything.** Always verify auth before issuing commands. If unauthenticated, run `gwsa-login <email>`.
2. **Read before write.** For any mutation (send, create, delete, update), show the user what will happen and wait for confirmation.
3. **Never expose tokens or credentials.** Do not log, print, or commit OAuth tokens, client IDs, or secrets.
4. **Scope requests tightly.** Use filters and `--params` to limit results — avoid pulling large datasets unnecessarily.

---

## Multi-account usage (always use `gwsa`)

All Google Workspace accounts are accessed via the `gwsa` wrapper, which selects the right credentials automatically.

```bash
gwsa <email> <service> <resource> [sub-resource] <method> [flags]
```

### Check which accounts are authenticated
```bash
gwsa
# Prints all accounts with ✓ (ready) or ✗ (needs login)
```

### Authenticate a new account (one-time, browser flow)
```bash
gwsa-login info@arkware.solutions
# Opens browser — user signs in as that account — done
```

### Examples with multiple accounts
```bash
# Read gmail for a specific account
gwsa info@arkware.solutions gmail users messages list --params '{"userId":"me","maxResults":10}'

# Add calendar event to a specific account
gwsa steve@yeshua.academy calendar events insert --params '{"calendarId":"primary"}' --json '{...}'

# List Drive files for a specific account
gwsa info@vilasolidaria.pt drive files list --params '{"pageSize":10}'
```

### Account inventory
Full account list with auth status: `brain/operations/accounts/email-inventory.md`

Accounts:
- info@prochat.tools (✓ authenticated)
- info@arkware.solutions
- steve@yeshua.academy
- info@yeshua.academy
- maintain@lean.diet
- info@vilasolidaria.pt
- what@saysthe.bible
- most@wanted.house
- just@onestatus.link

---

## Single-account usage (for info@prochat.tools only)

The bare `gws` command uses `~/.config/gws/` and defaults to `info@prochat.tools`.

```bash
gws <service> <resource> [sub-resource] <method> [flags]
```

**Prefer `gwsa info@prochat.tools ...` over bare `gws ...`** — it's explicit and consistent.

---

## Command structure

```
gwsa <email> <service> <resource> [sub-resource] <method> [flags]
```

Common flags:
- `--params '<JSON>'` — URL/query parameters
- `--json '<JSON>'` — request body (POST/PATCH/PUT)
- `--format table|json|yaml|csv` — output format (default: json)
- `--page-all` — auto-paginate through all results
- `--page-limit <N>` — max pages when paginating (default: 10)

## Example commands

### Gmail
```bash
# List recent messages
gwsa <email> gmail users messages list --params '{"userId": "me", "maxResults": 10}'

# Read a specific message
gwsa <email> gmail users messages get --params '{"userId": "me", "id": "<messageId>"}'

# Search messages
gwsa <email> gmail users messages list --params '{"userId": "me", "q": "from:someone@example.com"}'

# Send an email (confirm first)
gwsa <email> gmail users messages send --params '{"userId": "me"}' --json '{"raw": "<base64-encoded-email>"}'
```

### Calendar
```bash
# List upcoming events
gwsa <email> calendar events list --params '{"calendarId": "primary", "maxResults": 10, "orderBy": "startTime", "singleEvents": true}'

# Create an event (confirm first)
gwsa <email> calendar events insert --params '{"calendarId": "primary"}' --json '{...}'
```

### Drive
```bash
# List files
gwsa <email> drive files list --params '{"pageSize": 10}'

# Search files
gwsa <email> drive files list --params '{"q": "name contains \"report\""}'
```

### Sheets
```bash
# Read cell values
gwsa <email> sheets spreadsheets values get --params '{"spreadsheetId": "...", "range": "Sheet1!A1:D10"}'
```

### Tasks
```bash
gwsa <email> tasks tasks list --params '{"tasklist": "@default"}'
```

### Schema inspection
```bash
gws schema gmail.users.messages.list
gws schema drive.files.list
```

## Services reference
| Service | Description |
|---------|-------------|
| `gmail` | Email — send, read, manage |
| `drive` | Files and folders |
| `sheets` | Spreadsheets |
| `calendar` | Events and calendars |
| `docs` | Google Docs |
| `slides` | Presentations |
| `tasks` | Task lists |
| `people` | Contacts and profiles |
| `keep` | Google Keep notes |
| `chat` | Google Chat spaces |
| `workflow` / `wf` | Cross-service productivity workflows |
| `forms` | Google Forms |
| `script` | Google Apps Script |

## Auth architecture

- Shared OAuth2 client: `~/.config/gws/client_secret.json`
- Per-account credentials: `~/.config/gws-accounts/<email>/credentials.enc`
- Env var: `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` — `gwsa` sets this automatically
- Login flow: `gwsa-login <email>` → browser OAuth → tokens saved

## Notes
- gws installed at: `/opt/homebrew/bin/gws` (version 0.22.3)
- gwsa wrapper: `brain/tools/scripts/gwsa.sh`
- Install/upgrade: `brew install googleworkspace-cli` / `brew upgrade googleworkspace-cli`
