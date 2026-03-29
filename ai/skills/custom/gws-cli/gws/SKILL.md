---
name: gws
description: Use when the user asks to work with Google Workspace services via the CLI — reading email, managing Drive files, Sheets, Calendar, Docs, Tasks, Contacts, and more. Assumes Google Workspace CLI is installed globally via Homebrew and authenticated.
---

# Google Workspace CLI (gws)

## What this skill is for
Help Claude use `gws` to interact with Google Workspace services (Gmail, Drive, Calendar, Sheets, Docs, Tasks, etc.) safely and consistently from the command line.

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
1. **Auth before anything.** Always verify auth is working before issuing commands. If unauthenticated, guide through `gws auth login`.
2. **Read before write.** For any mutation (send, create, delete, update), show the user what will happen and wait for confirmation.
3. **Never expose tokens or credentials.** Do not log, print, or commit OAuth tokens, client IDs, or secrets.
4. **Scope requests tightly.** Use filters and `--params` to limit results — avoid pulling large datasets unnecessarily.

## Auth setup

The CLI uses OAuth2. Credentials are configured via environment variables or a credentials JSON file:

```bash
# Required env vars for auth
GOOGLE_WORKSPACE_CLI_CLIENT_ID=<your-client-id>
GOOGLE_WORKSPACE_CLI_CLIENT_SECRET=<your-client-secret>

# Then login (opens browser for OAuth consent)
gws auth login

# Or use a pre-obtained token
GOOGLE_WORKSPACE_CLI_TOKEN=<token>
```

Credentials file alternative:
```bash
GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/credentials.json
```

## Command structure

```
gws <service> <resource> [sub-resource] <method> [flags]
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
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'

# Read a specific message
gws gmail users messages get --params '{"userId": "me", "id": "<messageId>"}'

# Search messages
gws gmail users messages list --params '{"userId": "me", "q": "from:someone@example.com"}'

# Send an email
gws gmail users messages send --params '{"userId": "me"}' --json '{"raw": "<base64-encoded-email>"}'
```

### Drive
```bash
# List files
gws drive files list --params '{"pageSize": 10}'

# Get a specific file
gws drive files get --params '{"fileId": "abc123"}'

# Search files
gws drive files list --params '{"q": "name contains \"report\""}'
```

### Calendar
```bash
# List calendars
gws calendar calendarList list

# List upcoming events
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "orderBy": "startTime", "singleEvents": true}'

# Create an event (confirm first)
gws calendar events insert --params '{"calendarId": "primary"}' --json '{...}'
```

### Sheets
```bash
# Get spreadsheet metadata
gws sheets spreadsheets get --params '{"spreadsheetId": "..."}'

# Read cell values
gws sheets spreadsheets values get --params '{"spreadsheetId": "...", "range": "Sheet1!A1:D10"}'
```

### Tasks
```bash
# List task lists
gws tasks tasklists list

# List tasks
gws tasks tasks list --params '{"tasklist": "@default"}'
```

### Schema inspection
```bash
# Inspect available params for any command
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

## Notes
- Installed at: `/opt/homebrew/bin/gws` (version 0.22.3, as of 2026-03-30)
- Install/upgrade: `brew install googleworkspace-cli` / `brew upgrade googleworkspace-cli`
- Source: https://github.com/googleworkspace/cli
