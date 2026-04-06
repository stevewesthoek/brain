# Email Account Inventory

Central reference for all email accounts across identities and brands.
Maintained in `brain/operations/accounts/email-inventory.md`.

CLI access:
- **Google Workspace accounts** → `gws-provisioner` / `gws-destroyer` (service account, domain-wide)
- **Microsoft/Hotmail** → `m365 outlook mail list` (uses CLI for Microsoft 365)

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

### Deprecated: per-user OAuth (gwsa)

`gwsa` and `gwsa-login` are deprecated for org accounts. The service account covers all current
and future users without per-account browser logins.

`~/.config/gws-accounts/` and `~/.config/gws/client_secret.json` are kept in place for the
`gws` CLI tool (non-org personal use only) but no longer required for org operations.

---

## Microsoft / Personal Accounts

| Email | Type | Auth Status | Notes |
|-------|------|-------------|-------|
| westhoek@hotmail.com | Microsoft Personal (Hotmail/Live) | ⚠ Browser access only | CLI blocked — see below |

### CLI access status: deferred

Two blockers encountered (2026-04-06):

1. **`az` CLI bug** — Azure CLI 2.84.0 crashes with `NoneType.get` when a personal account has no Azure subscriptions. Known upstream bug, unfixed as of this date.
2. **`m365` CLI** — requires a custom Microsoft Entra app registration. Attempted but app ended up in wrong tenant ("Microsoft Services" instead of personal account tenant). Requires signing into `portal.azure.com` specifically as `westhoek@hotmail.com` to register the app correctly.

To unblock later:
1. Open `portal.azure.com` in a private window, sign in as `westhoek@hotmail.com`
2. App registrations → New registration → "Personal Microsoft accounts only" → Redirect URI: `http://localhost`
3. Copy the App ID → run: `m365 login --appId <id> --authType browser`
4. Save App ID: `m365 cli config set --key appId --value <id>`

For now: access `westhoek@hotmail.com` via browser/webmail at outlook.live.com.

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
| Read Hotmail inbox | `m365 outlook mail list` |
