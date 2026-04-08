# New Relic Runbook

## Overview

New Relic Standard plan (nonprofit tier) monitoring the full infra stack: 3 servers, 20+ apps, PostgreSQL, Docker logs, and synthetic uptime checks.

- **Account:** info@prochat.tools — Account ID `7019441`
- **Region:** EU (`api.eu.newrelic.com`, `metric-api.eu.newrelic.com`)
- **Credentials:** `~/.config/newrelic/.env` (local only, off-git, 600 perms)
- **NR CLI profile:** `brain` (EU region)

---

## Credential file

```
~/.config/newrelic/.env

NEW_RELIC_ACCOUNT_ID=7019441
NEW_RELIC_LICENSE_KEY=eu01x...NRAL       # INGEST key (Brain-infra)
NEW_RELIC_USER_API_KEY=NRAK-...           # User API key (Brain-CLI)
NEW_RELIC_REGION=EU
```

---

## What is monitored

### Infrastructure agents (hosts)
| Host | Server | Status |
|------|--------|--------|
| `dokploy` | Azure vm-dokploy (100.83.38.48) | Active |
| `supabase` | Azure vm-supabase (100.71.31.88) | Active |
| `cloudpanel` | Hetzner (91.99.71.221) | Active (legacy) |

**Docker container monitoring** is enabled on `dokploy` via `nri-docker`.  
**PostgreSQL monitoring** (`nri-postgresql`) runs on `dokploy` targeting Supabase at `10.0.2.4:5433` via the read-only `newrelic_monitor` role.  
**Docker log forwarding** is enabled via fluent-bit (`/etc/newrelic-infra/logging.d/docker.yml`).

### APM (Node.js / Next.js apps)
All 12 Dokploy apps have:
- `newrelic` npm package (`^13.x`) installed
- `newrelic.js` config file at repo root (env-var driven)
- `NODE_OPTIONS=--require newrelic` set in Dokploy env
- `NEW_RELIC_APP_NAME` and `NEW_RELIC_LICENSE_KEY` set in Dokploy env

Apps: ProChat, Says the Bible, Cedula, Yeshua Academy, Open Fund, Olive to Organizing, JPV Bootcamp, JCCP Holdings, Via di Eden, Status Link, Proofly, xGrow.

APM data appears after first deploy of each app.

### Synthetic monitors (uptime checks, every 5 min, AWS_EU_WEST_1)
| Monitor | URL |
|---------|-----|
| ProChat | https://prochat.tools |
| Says the Bible | https://saysthe.bible |
| Cedula | https://cedula.prochat.tools |
| Yeshua Academy | https://yeshua.academy |
| Open Fund | https://openfund.yeshua.academy |
| Olive to Organizing | https://olivetoorganizing.com |
| JPV Bootcamp | https://jpvbootcamp.com |
| Status Link | https://onestatus.link |
| Proofly | https://proofly.xyz |
| n8n | https://n8n.prochat.tools |
| Dokploy | https://dokploy.prochat.tools |

### ProBot dashboard widget
The ProBot dashboard (`brain/projects/probot`) shows a **New Relic** section with:
- Server health cards (dokploy, supabase, cloudpanel) with alert severity dots
- Synthetic monitor status cards

Credentials for the widget: `NEW_RELIC_USER_API_KEY` and `NEW_RELIC_ACCOUNT_ID` in `~/.config/probot/.env`.

---

## Installing the infrastructure agent (new server)

For Ubuntu 24.04 (noble), EU region:

```bash
# As root
curl -fsSL https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg \
  | gpg --dearmor -o /etc/apt/trusted.gpg.d/newrelic-infra.gpg
echo "deb https://download.newrelic.com/infrastructure_agent/linux/apt noble main" \
  > /etc/apt/sources.list.d/newrelic-infra.list
apt-get update && apt-get install -y newrelic-infra

cat > /etc/newrelic-infra.yml << EOF
license_key: eu01xea4496324cb45ca2e824102d2719c2eNRAL
display_name: <hostname>
custom_attributes:
  role: <role>
  cloud: <azure|hetzner>
  env: production
EOF

systemctl restart newrelic-infra
```

---

## Adding APM to a new Node.js app

**Prerequisites:** Node.js >=20 required. New Relic APM does not support Node 18 or below — upgrade the app's Dockerfile base image to `node:20-bullseye` before adding APM.

1. `npm install newrelic --save` in the repo
2. Create `newrelic.js` at repo root:
```js
'use strict'
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'AppName'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  distributed_tracing: { enabled: true },
  logging: { level: 'info' },
  allow_all_headers: true,
  attributes: {
    exclude: ['request.headers.cookie', 'request.headers.authorization', 'response.headers.set-cookie'],
  },
}
```
3. In Dokploy env for the app, add:
```
NODE_OPTIONS=--require newrelic   # merge with existing NODE_OPTIONS if present
NEW_RELIC_APP_NAME=<App Name>
NEW_RELIC_LICENSE_KEY=eu01xea4496324cb45ca2e824102d2719c2eNRAL
```
4. Redeploy the app.

---

## NR CLI common commands

```bash
# Profile
newrelic profile list --profile brain

# Query account entities
newrelic nerdgraph query '{ actor { entitySearch(query: "accountId = 7019441") { results { entities { name type reporting } } } } }' --profile brain

# Delete entity
newrelic nerdgraph query 'mutation { entityDelete(guids: ["<GUID>"]) { deletedEntities failures { message } } }' --profile brain

# Create synthetic monitor
# See: brain/operations/scripts/nr-create-synthetic.sh
```

---

## Gotchas

- **EU region matters:** License key starts with `eu01x` — agents and ingest must use EU endpoints. NR CLI needs `--region EU` on profile add.
- **BROWSER entities cannot be deleted** via `entityDelete` mutation — they auto-expire when data stops flowing.
- **NODE_OPTIONS merge:** If an app already has `NODE_OPTIONS` (e.g., `--max-old-space-size=3072`), append `--require newrelic` to the existing value rather than replacing it.
- **ProChat env corruption:** The Dokploy `saveEnvironment` API returns 200 even for `TEST=1` — always use the Python script in `/tmp/nr_env_update2.py` pattern to preserve existing env vars. Never use a bare curl test write against a production app.
- **Infra agent sudo:** The `master` user on dokploy requires a password for sudo. Use `root` SSH directly (`ssh root@100.83.38.48`) for infra agent install and config changes.
- **NR CLI `profile add` is interactive** unless you pass all flags: `--accountId`, `--apiKey`, `--licenseKey`, `--region`. Missing any triggers an interactive prompt that fails in non-TTY environments.
