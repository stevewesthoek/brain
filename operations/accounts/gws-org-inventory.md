# Google Workspace Org Inventory

Canonical reference for the GWS organization managed via domain-wide delegation.
Last scanned: 2026-04-07 | Domains: 16 (messaggerocristiano.it deleted 2026-04-07)

## Access

All programmatic access goes through the service account, not per-user OAuth.

```bash
# Service account key
~/.config/gws/service-account.json
# Admin subject (impersonated for Admin SDK calls)
info@prochat.tools

# Safe default — read, list, create, update
gws-provisioner <command> [args...]

# Destructive — suspend, delete, purge (requires explicit intent)
gws-destroyer <command> [args...]
```

Stable entrypoints: `~/.local/bin/gws-provisioner`, `~/.local/bin/gws-destroyer`
Wrapper source: `operations/system-configs/bin/gws-provisioner`, `gws-destroyer`, `gws-org-wrapper`

---

## Domains (17)

| Domain | Primary | Verified | Type | Notes |
|--------|---------|----------|------|-------|
| yeshua.academy | yes | yes | own | PRIMARY domain of the org |
| prochat.tools | no | yes | own | Main ops domain |
| arkware.solutions | no | yes | own | Arkware brand |
| onefleshinchrist.com | no | yes | own | Ministry domain |
| lean.diet | no | yes | own | Lean Diet project |
| zoetree.ventures | no | yes | client | CLIENT — protected |
| feelgoodwithana.com | no | yes | client | CLIENT — protected |
| microgreens.market | no | yes | client | CLIENT — protected |
| thedutchperformance.nl | no | yes | client | CLIENT — protected |
| vilasolidaria.pt | no | yes | own | Vila Solidária project |
| viadieden.it | no | yes | client | CLIENT — protected |
| saysthe.bible | no | yes | own | Says the Bible |
| olivetoorganizing.com | no | yes | client | CLIENT — protected |
| wanted.house | no | yes | own | Wanted House project |
| onestatus.link | no | yes | own | StatusLink / OneStatus |
| casaqr.pt | no | yes | own | CasaQR project |
| ~~messaggerocristiano.it~~ | — | — | — | Deleted 2026-04-07 — no users, no longer needed |

---

## Users (20)

| Email | Admin | Protected | Notes |
|-------|-------|-----------|-------|
| info@prochat.tools | yes | no | Primary admin, DWD subject |
| info@yeshua.academy | yes | no | Org admin |
| steve@yeshua.academy | yes | no | Personal admin |
| steve@prochat.tools | no | no | Personal ops account |
| demo@prochat.tools | no | no | Demo/test account |
| ana@yeshua.academy | no | no | Ana Westhoek |
| info@arkware.solutions | no | no | Arkware inbox |
| info@casaqr.pt | no | no | CasaQR inbox (alias: asua@casaqr.pt) |
| info@vilasolidaria.pt | no | no | Vila Solidária inbox |
| info@zoetree.ventures | no | **yes** | CLIENT — hard-protected |
| info@feelgoodwithana.com | no | **yes** | CLIENT — hard-protected |
| info@microgreens.market | no | **yes** | CLIENT — hard-protected |
| info@thedutchperformance.nl | no | **yes** | CLIENT — hard-protected |
| info@viadieden.it | no | **yes** | CLIENT — hard-protected |
| info@zoetree.ventures | no | **yes** | CLIENT — hard-protected |
| hello@olivetoorganizing.com | no | **yes** | CLIENT — hard-protected (alias: info@olivetoorganizing.com) |
| just@onestatus.link | no | no | StatusLink inbox |
| maintain@lean.diet | no | no | Lean Diet inbox |
| most@wanted.house | no | no | Wanted House inbox |
| weare@onefleshinchrist.com | no | no | OneFleshinChrist inbox |
| what@saysthe.bible | no | no | Says the Bible inbox |

---

## Protected accounts

Six domains are tagged as client-owned. The `gws-org-wrapper` enforces this at code level:

```
zoetree.ventures, feelgoodwithana.com, microgreens.market,
thedutchperformance.nl, viadieden.it, olivetoorganizing.com
```

**Rule:** Any `users suspend` or `users delete` targeting an account on these domains exits with code 3
and prints a hard block message. This cannot be bypassed by using the destroyer wrapper alone —
it requires the owner to manually run the underlying Admin SDK call directly.

---

## Authorized DWD scopes

These scopes are authorized in Admin Console → Security → API Controls → Domain-wide Delegation:

```
https://www.googleapis.com/auth/admin.directory.user
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.domain.readonly
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/drive
```

Note: domain deletion requires `admin.directory.domain` (without `readonly`). Add this scope
to DWD in Admin Console if automated domain removal is needed.

---

## Common commands

```bash
# Inventory
gws-provisioner users list
gws-provisioner domains list
gws-provisioner groups list

# Inspect a user
gws-provisioner users get steve@prochat.tools

# Create a user
gws-provisioner users create --first Jane --last Doe --email jane@prochat.tools

# Read inbox (headers + snippet only)
gws-provisioner gmail list info@prochat.tools --query "label:inbox" --max 20

# Suspend a user (non-client only)
gws-destroyer users suspend demo@prochat.tools

# Delete a user (non-client only)
gws-destroyer users delete demo@prochat.tools

# Purge emails (query required)
gws-destroyer gmail purge demo@prochat.tools --query "older_than:1y"
```
