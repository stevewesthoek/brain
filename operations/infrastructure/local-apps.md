# Local Applications Inventory

**Canonical source:** `operations/infrastructure/local-apps.json`

`local-apps.json` is the canonical local runtime registry for the Office Mac. The ProBot dashboard reads it at runtime, and this markdown file mirrors the same data for humans.

During the migration window, registry entries are intentionally dual-compatible: the richer fields are preferred for new consumers, but the legacy aliases remain present so older readers keep working.

## Reserved port policy

- `3000-3099` is reserved for local web app ports.
- `5400-5499` is reserved for local PostgreSQL ports.
- `6300-6399` is reserved for Redis ports.
- `7000-7099` is reserved for internal dashboards and control-plane tools.
- `8000-8099` is reserved for APIs and supporting services when needed.
- Every app gets one permanent reserved app port.
- Every local PostgreSQL database gets one permanent reserved database port.
- A port, once assigned, must never be reused by a different app or database, even if the original service is retired later.
- Do not leave project-local databases on ad hoc defaults like `5432` unless the registry explicitly documents that as intentional.

## Schema

Each entry in `local-apps.json` is a JSON object with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name shown in the ProBot dashboard |
| `repoPath` | string | yes | Absolute repo path on the Office Mac |
| `appPort` | number | yes | Reserved local app port |
| `appUrl` | string | yes | Browser URL for the running app |
| `healthCheck` | string | yes | URL ProBot pings to determine running/stopped |
| `startCommand` | string | yes | Shell command to start the app |
| `stopCommand` | string \| null | no | Shell command to stop the app, if one exists |
| `description` | string | yes | One-line description shown in the dashboard card |
| `databaseEngine` | string \| null | no | Database engine used locally, if any |
| `databaseServiceName` | string \| null | no | Database container or service name, if any |
| `databasePort` | number \| null | no | Reserved local database port, if any |
| `databaseName` | string \| null | no | Local database name, if any |
| `databaseUser` | string \| null | no | Local database user, if any |
| `notes` | string \| null | no | Extra local-dev notes or caveats |

### Compatibility window

For every entry, the following aliases are kept in sync:

- `port` mirrors `appPort`
- `url` mirrors `appUrl`
- `check` mirrors `healthCheck`
- `start` mirrors `startCommand`
- `stop` mirrors `stopCommand`

New code should prefer the expanded fields. Legacy readers may keep using the old names until they are fully migrated.

## Current inventory

| Name | App Port | DB Port | Description | Start Command |
|------|----------|---------|-------------|---------------|
| ProBot | 7070 | - | ProBot dashboard and automation daemon | `cd ~/Repos/stevewesthoek/brain/projects/probot && npm start > /tmp/probot.log 2>&1 &` |
| Firecrawl | 3055 | 5443 | Web scraping and research API | `cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d` |
| ProChat | 3056 | 5434 | ProChat marketing and conversion site | `cd ~/Repos/prochattools/web/prochat && npm run dev` |
| JPV Bootcamp | 3000 | 5444 | JPV Bootcamp landing page, Stripe provisioning, and WordPress sync | `cd ~/Repos/prochattools/clients/jc-citadel/jpv-bootcamp && npm run dev` |
| xGrow | 7080 | 5445 | X (Twitter) growth automation | `cd ~/Repos/prochattools/saas/xgrow && docker compose -f docker-compose.postgres.yml up -d postgres && npm run dev > /tmp/xgrow.log 2>&1 &` |
| Google Ads API | 8001 | - | Google Ads webhook and API server | `supervisorctl start google-ads-http-server` |
| ComfyUI | 8188 | - | Stable Diffusion image generation UI | `echo 'Manual start required'` |
| Family Finance | 3060 | - | Multi-account family finance tracker | `cd ~/Repos/stevewesthoek/family-finance && npm run dev > /tmp/family-finance.log 2>&1 &` |
| Fala | 3050 | - | Portuguese language learning app | `echo 'Manual start required'` |
| BuildFlow | 3054 | - | Unified lifecycle for agent, web, and relay | `bash ~/Repos/stevewesthoek/buildflow/start-all.sh` |

## OrbStack database inventory

The standalone Postgres stacks under `operations/database/standalone/` use these reserved ports:

| App | Host Port | Database |
|-----|-----------|----------|
| Says the Bible | 5441 | `saysthebible` |
| ProChat | 5442 | `prochat` |
| Cedula | 5443 | `cedula` |
| JPV Bootcamp | 5444 | `jpvbootcamp` |
| Oliveto Organizing | 5445 | `olivetoorganizing` |
| StatusLink | 5446 | `statuslink` |
| Via di Eden | 5447 | `viadieden` |
| Resend | 5448 | `resend` |
| ProKit Studio | 5449 | `prokitstudio` |
| SaaSKit Studio | 5450 | `saaskitstudio` |
| OpenFund | 5451 | `openfund` |
| ProKit | 5455 | `prokit` |
| SaaSKit | 5457 | `saaskit` |

Only JPV Bootcamp is currently running in OrbStack in this session. The other entries are reserved stacks that remain documented for consistency.

## How ProBot loads this file

ProBot reads `local-apps.json` on every `/api/local-apps` request, so changes are live immediately.

File path hardcoded in `projects/probot/src/bot/dashboard.ts`:

```text
~/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.json
```

For each app, ProBot makes a GET request to `healthCheck` with a 1-second timeout. If it gets a 2xx response the app is **running**; otherwise **stopped**.

## Editing rules

1. Edit `operations/infrastructure/local-apps.json` first.
2. Keep this markdown table aligned with the JSON registry.
3. Update repo-local config/docs at the same time if a reserved port changes.
4. Never recycle a retired port for a different local app or database.
