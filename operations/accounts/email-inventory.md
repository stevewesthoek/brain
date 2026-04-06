# Email Account Inventory

Central reference for all email accounts across identities and brands.
Maintained in `brain/operations/accounts/email-inventory.md`.

CLI access:
- **Google Workspace accounts** → `gwsa <email> <command>` (uses `gws` under the hood)
- **Microsoft/Hotmail** → `m365 outlook mail list` (uses CLI for Microsoft 365)

---

## Google Workspace Accounts

All Google accounts use the same shared OAuth2 client (`~/.config/gws/client_secret.json`).
Per-account credentials live in `~/.config/gws-accounts/<email>/`.

| Email | Brand / Project | Repo | Auth Status | Notes |
|-------|----------------|------|-------------|-------|
| info@prochat.tools | ProChat Tools | `prochattools/` | ✓ Authenticated | Primary ops account |
| info@arkware.solutions | Arkware Solutions | — | ✗ Pending login | — |
| steve@yeshua.academy | Yeshua Academy | `yeshuaacademy/` | ✗ Pending login | Personal/ministry |
| info@yeshua.academy | Yeshua Academy | `yeshuaacademy/` | ✗ Pending login | Org inbox |
| maintain@lean.diet | Lean Diet | — | ✗ Pending login | — |
| info@vilasolidaria.pt | Vila Solidária | — | ✗ Pending login | — |
| what@saysthe.bible | Says the Bible | `prochattools/web/says-the-bible` | ✗ Pending login | STB project email |
| most@wanted.house | Wanted House | — | ✗ Pending login | — |
| just@onestatus.link | OneStatus Link | `prochattools/saas/statuslink` | ✗ Pending login | — |

### Authenticate a pending account

```bash
gwsa-login <email>
# Browser opens → sign in as <email> → done
```

### Use an authenticated account

```bash
# Gmail
gwsa <email> gmail users messages list --params '{"userId":"me","maxResults":10}'

# Calendar
gwsa <email> calendar events list --params '{"calendarId":"primary","maxResults":10,"singleEvents":true,"orderBy":"startTime"}'

# Drive
gwsa <email> drive files list --params '{"pageSize":10}'
```

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

### Check status

```bash
m365 status
```

### Common commands

```bash
# List recent emails
m365 outlook mail list --mailbox westhoek@hotmail.com

# List calendar events
m365 outlook event list

# OneDrive files
m365 onedrive list
```

---

## Auth setup notes

**For Google accounts:** All 9 GWS accounts share one GCP OAuth2 project (one `client_secret.json`).
If a new GWS domain blocks the consent screen, check the Google Admin Console for that domain → Security → API Controls → and allow the OAuth2 client ID `891024122587-...`.

**For Microsoft:** `m365 login` uses device code flow by default (no browser needed) or browser OAuth via `m365 login --authType browser`.

---

## Quick reference

| I want to… | Command |
|------------|---------|
| Read inbox of info@arkware.solutions | `gwsa info@arkware.solutions gmail users messages list --params '{"userId":"me","maxResults":10}'` |
| Add calendar event to steve@yeshua.academy | `gwsa steve@yeshua.academy calendar events insert --params '{"calendarId":"primary"}' --json '{...}'` |
| Read Hotmail inbox | `m365 outlook mail list` |
| Check which GWS accounts are authenticated | `gwsa` (no args — lists all with status) |
| Add a new GWS account | `gwsa-login <email>` |
