---
name: newrelic-eu-region-install
description: Use when installing New Relic CLI, infra agents, or APM on an EU-region NR account — three separate places require EU region config; missing any causes silent auth failures.
---

# New Relic EU Region Install

## The insight
NR EU accounts require EU region configuration in three separate places that don't automatically cascade from each other. Missing any one causes auth failures or silent data loss, often with misleading error messages ("authentication required" or "401 Invalid credentials").

## When this applies
- License key starts with `eu01x` (confirms EU account)
- `newrelic profile add` returns 401 even with a valid-looking key
- NerdGraph queries return `{"errors":[{"message":"authentication required"}]}`
- Infra agent installs but no data appears in NR UI

## The approach
Check all three layers independently — CLI profile, infra agent config, and direct API calls. Each one is independent of the others.

## The fix

**1. NR CLI profile** — must pass ALL flags or it goes interactive (fails in non-TTY):
```bash
source ~/.config/newrelic/.env
newrelic profile add \
  --profile brain \
  --accountId "$NEW_RELIC_ACCOUNT_ID" \
  --apiKey "$NEW_RELIC_USER_API_KEY" \
  --licenseKey "$NEW_RELIC_LICENSE_KEY" \
  --region "$NEW_RELIC_REGION"   # EU
```
`--licenseKey` is the commonly missed flag. Without it, the CLI prompts interactively for a license key and hangs in non-TTY sessions.

**2. Infra agent** — `/etc/newrelic-infra.yml` on each server:
```yaml
license_key: eu01xea4496324cb45ca2e824102d2719c2eNRAL
display_name: <hostname>
```
The `eu01x` prefix in the license key is sufficient for auto-routing. No additional EU config needed here.

Install on Ubuntu 24.04 (noble):
```bash
curl -fsSL https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg \
  | gpg --dearmor -o /etc/apt/trusted.gpg.d/newrelic-infra.gpg
echo "deb https://download.newrelic.com/infrastructure_agent/linux/apt noble main" \
  > /etc/apt/sources.list.d/newrelic-infra.list
apt-get update && apt-get install -y newrelic-infra
```

**3. Direct API / NerdGraph** — must use EU endpoint:
```bash
# NerdGraph (User API key)
curl -X POST https://api.eu.newrelic.com/graphql \
  -H "API-Key: NRAK-..." \
  -d '{"query":"{ actor { user { name } } }"}'

# Metric ingest (License key) — test
curl -X POST https://metric-api.eu.newrelic.com/metric/v1 \
  -H "Api-Key: eu01x..." \
  -d '[{"metrics":[{"name":"test","type":"gauge","value":1,"timestamp":1234567890}]}]'
```

**4. APM (Node.js)** — set via env vars in Dokploy, no EU endpoint config needed:
```
NEW_RELIC_LICENSE_KEY=eu01x...NRAL
NEW_RELIC_APP_NAME=AppName
NODE_OPTIONS=--require newrelic   # append to existing value if NODE_OPTIONS already set
```

## Gotchas
- **User API key shown only once** — copy immediately when creating in NR UI. The key listing page only shows a truncated version; if you copy that, the key will fail auth silently.
- **`NRAK-` prefix required** — the User API key must include the `NRAK-` prefix. The hex string alone is not valid.
- **BROWSER entities cannot be deleted** via `entityDelete` NerdGraph mutation — error: "Entities of this domain-type: BROWSER-APPLICATION cannot be deleted with this mutation". They auto-expire when data stops flowing. Don't retry.
- **dokploy server**: `master` user requires sudo password — use `root` SSH directly (`ssh root@100.83.38.48`) for infra agent install and `/etc/newrelic-infra.yml` changes.
- **Credentials file:** `~/.config/newrelic/.env` — local only, off-git, chmod 600.

## Context
Repo: brain (infra ops)  
Discovered: 2026-04-05  
Area: `~/.config/newrelic/.env`, `/etc/newrelic-infra.yml`, NR CLI profile `brain`
