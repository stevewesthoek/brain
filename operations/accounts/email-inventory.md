# Email Account Inventory

Central reference for all email accounts across identities and brands.
Maintained in `brain/operations/accounts/email-inventory.md`.

CLI access:
- **Google Workspace accounts** → `gws-provisioner` / `gws-destroyer` (service account, domain-wide)
- **westhoek@hotmail.com** → browser only at outlook.live.com (no CLI access)

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
