---
name: gws
description: Use when the user asks to work with Google Workspace — reading email, managing users, provisioning accounts, org administration, Drive, Calendar, Gmail. Uses service account with domain-wide delegation. Provisioner is the safe default; destroyer is opt-in for destructive ops.
---

# Google Workspace CLI

## What this skill is for
Help Claude use `gws-provisioner` and `gws-destroyer` to interact with the Google Workspace org
via a service account with domain-wide delegation. Covers all 17 domains and 20 users in the
`prochat.tools` / `yeshua.academy` org without per-account logins.

## Use this skill when
- Reading or searching Gmail for any org user
- Listing or managing org users (create, suspend, delete)
- Listing org domains
- Managing groups
- Provisioning new accounts across any domain in the org
- Running org-wide email operations

## Do not use this skill for
- Operations on client-protected accounts without explicit owner instruction
- Sending emails or creating calendar events without confirming the action first
- Bulk destructive operations without a scoped query or explicit user confirmation
- Personal non-org Gmail (use browser)

## Safety rules
1. **Provisioner is the default.** All read, list, inspect, create, and update ops use `gws-provisioner`.
2. **Destroyer is opt-in.** Suspension, deletion, and purge require `gws-destroyer` plus explicit user confirmation.
3. **Client accounts are hard-protected.** The wrapper blocks deletion/suspension of accounts in: `zoetree.ventures`, `feelgoodwithana.com`, `microgreens.market`, `thedutchperformance.nl`, `viadieden.it`, `olivetoorganizing.com`. Only the owner can remove these manually.
4. **Email purge always requires --query.** Never run purge without a scoped query — the wrapper enforces this.
5. **Never expose email body content.** Return headers and snippet only unless the user explicitly asks for full body.
6. **User creation always requires confirmation.** State the email, org, and password plan before creating.

---

## Stable entrypoints

```bash
~/.local/bin/gws-provisioner   # safe default
~/.local/bin/gws-destroyer     # destructive ops only
```

Wrapper source: `operations/system-configs/bin/gws-provisioner`, `gws-destroyer`, `gws-org-wrapper`

---

## Commands

### Users

```bash
# List all users with admin/protected/suspended status
gws-provisioner users list

# Get details for a specific user
gws-provisioner users get steve@prochat.tools

# Create a user (requires confirmation before running)
gws-provisioner users create --first Jane --last Doe --email jane@prochat.tools

# Suspend a user (non-client only)
gws-destroyer users suspend demo@prochat.tools

# Delete a user (non-client only, requires explicit user confirmation first)
gws-destroyer users delete demo@prochat.tools
```

### Domains

```bash
# List all org domains
gws-provisioner domains list
```

### Gmail

```bash
# List recent messages (headers + IDs)
gws-provisioner gmail list info@prochat.tools --max 10

# Search messages
gws-provisioner gmail list steve@prochat.tools --query "from:someone@example.com" --max 20

# Get a single message (headers + snippet)
gws-provisioner gmail get info@prochat.tools <message-id>

# Trash a single message
gws-destroyer gmail delete info@prochat.tools <message-id>

# Bulk purge (--query required)
gws-destroyer gmail purge demo@prochat.tools --query "older_than:1y" --max 500
```

### Groups

```bash
gws-provisioner groups list
```

---

## Org inventory

Full inventory of all 17 domains and 20 users: `operations/accounts/gws-org-inventory.md`
Quick reference: `operations/accounts/email-inventory.md`

---

## Deprecated: per-user OAuth (gwsa)

`gwsa` and `gwsa-login` are deprecated for org accounts. The service account covers all current
and future users without browser logins.

```bash
# OLD — deprecated, do not use for org accounts
gwsa info@arkware.solutions gmail users messages list ...

# NEW
gws-provisioner gmail list info@arkware.solutions --max 10
```

`gwsa` may still be used for non-org personal Google accounts not part of the GWS org.

---

## Notes
- Service account key: `~/.config/gws/service-account.json`
- Admin subject (DWD impersonation): `info@prochat.tools`
- gws CLI (underlying tool): `/opt/homebrew/bin/gws` v0.22.3 — kept for schema inspection only
- Wrapper verified working: 2026-04-07
