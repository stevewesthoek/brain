---
name: m365
description: Use when the user asks to work with Microsoft personal accounts (Hotmail, Live, Outlook.com) or Microsoft 365 services — reading email, calendar, OneDrive, To-Do, Teams, and more. Uses CLI for Microsoft 365 (m365).
---

# CLI for Microsoft 365 (m365)

## What this skill is for
Help Claude use `m365` to interact with Microsoft personal account services (Outlook mail, calendar, OneDrive, To-Do) and Microsoft 365 services safely and consistently from the command line.

## Accounts managed via this skill
- westhoek@hotmail.com (Microsoft Personal / Hotmail)

Full account inventory: `brain/operations/accounts/email-inventory.md`

## Use this skill when
- Reading, searching, or sending Outlook/Hotmail emails
- Managing calendar events in Outlook
- Accessing OneDrive files
- Managing To-Do tasks
- Any interaction with westhoek@hotmail.com

## Do not use this skill for
- Sending emails or creating events without stating the action and waiting for confirmation
- Destructive operations without explicit user confirmation

## Safety rules
1. **Auth before anything.** Run `m365 status` first. If not logged in, run `m365 login`.
2. **Read before write.** For mutations (send, create, delete), confirm with the user first.
3. **Never expose tokens.** Do not log or commit access tokens or secrets.

---

## Auth setup (one-time)

```bash
# Check current login status
m365 status

# Login (device code — no browser needed)
m365 login

# OR browser-based login
m365 login --authType browser
# Sign in as westhoek@hotmail.com
```

---

## Common commands

### Outlook Mail
```bash
# List recent emails
m365 outlook mail list

# List with subject filter
m365 outlook mail list --subject "invoice"

# Send an email (confirm first)
m365 outlook mail send --to "someone@example.com" --subject "Hello" --bodyContents "Message body"
```

### Calendar
```bash
# List upcoming events
m365 outlook event list

# Add calendar event (confirm first)
m365 outlook event add --subject "Meeting" --startTime "2026-04-10T10:00:00" --endTime "2026-04-10T11:00:00"
```

### OneDrive
```bash
# List OneDrive files
m365 onedrive list

# List items in a folder
m365 onedrive item list --folderUrl "/Documents"
```

### To-Do
```bash
# List task lists
m365 todo list list

# List tasks in a list
m365 todo task list --listName "Tasks"

# Add a task (confirm first)
m365 todo task add --listName "Tasks" --title "New task"
```

### Search across Microsoft 365
```bash
m365 search --scopes "message" --query "invoice"
```

---

## Services reference
| Service | CLI group | Description |
|---------|-----------|-------------|
| Outlook Mail | `m365 outlook mail` | Email — read, send, manage |
| Outlook Calendar | `m365 outlook event` | Events and calendars |
| OneDrive | `m365 onedrive` | Files and folders |
| To-Do | `m365 todo` | Task lists |
| Teams | `m365 teams` | Teams chats and channels |
| Planner | `m365 planner` | Planner tasks and buckets |
| Graph API | `m365 graph` | Raw Microsoft Graph requests |

## Notes
- Installed at: `~/.nvm/versions/node/v24.12.0/bin/m365` (version 11.6.0)
- Install/upgrade: `npm install -g @pnp/cli-microsoft365`
- Docs: https://pnp.github.io/cli-microsoft365/
- Only personal Microsoft account managed here: westhoek@hotmail.com
