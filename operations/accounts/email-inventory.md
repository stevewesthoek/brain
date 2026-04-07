# Email Account Inventory

Central reference for all email accounts across identities and brands.
Maintained in `brain/operations/accounts/email-inventory.md`.

CLI access:
- **Google Workspace accounts** → `gws-provisioner` / `gws-destroyer` (service account, domain-wide)
- **westhoek@hotmail.com** → `himalaya` (IMAP + app password) — setup pending

---

## Google Workspace (service account, domain-wide)

All 17 domains and 20 users are accessed via a single service account with domain-wide delegation.
Full inventory: `brain/operations/accounts/gws-org-inventory.md`

```bash
# List all users
gws-provisioner users list

# Read inbox for any org user
gws-provisioner gmail list <email> [--query Q] [--max N]

# Create a user
gws-provisioner users create --first F --last L --email E

# Suspend / delete (non-client only)
gws-destroyer users suspend <email>
gws-destroyer users delete <email>

# Purge emails (--query required)
gws-destroyer gmail purge <email> --query "older_than:1y"
```

Service account key: `~/.config/gws/service-account.json`
Admin subject: `info@prochat.tools`
Entrypoints: `~/.local/bin/gws-provisioner`, `~/.local/bin/gws-destroyer`

---

## Microsoft / Personal Accounts

| Email | Type | Auth Status | Notes |
|-------|------|-------------|-------|
| westhoek@hotmail.com | Microsoft Personal (Hotmail/Live) | ⚠ Pending setup | Himalaya + app password |

### Setup (one-time)

Free personal Hotmail accounts support standard IMAP — no app registration needed.
Uses `himalaya` (terminal email client) with a Microsoft app password.

1. Enable 2-step verification at `account.microsoft.com/security` (if not already on)
2. Generate an app password: Security → Advanced security → App passwords
3. Install himalaya: `brew install himalaya`
4. Configure: `himalaya account configure` → IMAP host `outlook.office365.com:993`, login `westhoek@hotmail.com`, password: app password

### Commands (once set up)

```bash
# List inbox
himalaya list

# Read a message
himalaya read <id>

# Send email
himalaya send
```

---

## Quick reference

| I want to… | Command |
|------------|---------|
| List all org users | `gws-provisioner users list` |
| Read inbox of info@arkware.solutions | `gws-provisioner gmail list info@arkware.solutions --max 10` |
| Search emails | `gws-provisioner gmail list <email> --query "from:someone@example.com"` |
| Create a new user | `gws-provisioner users create --first F --last L --email E` |
| Suspend a user | `gws-destroyer users suspend <email>` |
| Delete a user (non-client) | `gws-destroyer users delete <email>` |
| Purge old emails | `gws-destroyer gmail purge <email> --query "older_than:1y"` |
| List all domains | `gws-provisioner domains list` |
| Read Hotmail inbox | `himalaya list` (setup pending — see above) |
