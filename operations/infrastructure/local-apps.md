# Local Applications Inventory

**Canonical source:** `local-apps.json`  
**Onboarding standard:** `LOCAL_APP_ONBOARDING_STANDARD.md`

Brain Core reads this registry to manage application lifecycle. Brain Console displays app status and controls based on registry entries.

## Adding a New Application

Follow: `LOCAL_APP_ONBOARDING_STANDARD.md`

## Port Reservation Policy

**Reserved ranges (never reuse):**
- `3000–3099` — Web applications
- `5400–5499` — PostgreSQL databases
- `6300–6399` — Redis
- `7000–7099` — Internal dashboards
- `8000–8099` — Supporting services

One permanent port per app, one per database.

## Current Inventory

| Name | App Port | DB Port | Description |
|------|----------|---------|-------------|
| Says the Bible | 3058 | 5441 | Main app and admin panel |
| Firecrawl | 3055 | 5443 | Web scraping and research API |
| ProChat | 3056 | 5434 | Marketing and conversion site |
| Via di Eden | 3057 | 5447 | Client website with TinaCloud CMS |
| Oliveto Organizing | 3059 | 5453 | Client website with TinaCloud CMS |
| JPV Bootcamp | 3000 | 5444 | Landing page and Stripe provisioning |
| xGrow | 7080 | 5445 | Twitter growth automation |
| Google Ads API | 8001 | - | Webhook and API server |
| ComfyUI | 8188 | - | Image generation UI |
| Family Finance | 3060 | 5452 | Household finance tracker |
| Fala | 3050 | 5432 | Portuguese language learning app |
| Workbench | 3054 | - | Agent (3052), relay (3053), web (3054) |
| TradeBot | 3061 | 5454 | Crypto trading cockpit |
| Video Orchestrator | - | 5450 | Video production pipeline |

## OrbStack Database Ports

| App | Port | Database |
|-----|------|----------|
| Says the Bible | 5441 | saysthebible |
| ProChat | 5434 | postgres |
| Firecrawl | 5443 | postgres |
| JPV Bootcamp | 5444 | jpvbootcamp |
| xGrow | 5445 | xgrow_dev |
| Via di Eden | 5447 | viadieden |
| Family Finance | 5452 | family_finance |
| Oliveto Organizing | 5453 | olivetoorganizing |
| TradeBot | 5454 | tradebot |
| Video Orchestrator | 5450 | video_orchestrator |

## TinaCloud Local Port Reservations

Via di Eden and Oliveto Organizing use separate local Tina ports:

| Repo | App Port | Tina Server | Tina Datalayer |
|------|----------|-------------|---|
| Via di Eden | 3057 | 4011 | 9002 |
| Oliveto Organizing | 3059 | 4012 | 9003 |

Never point one repo at the other's Tina ports.

## Editing Rules

1. Edit `local-apps.json` first
2. Keep this table aligned with JSON registry
3. Follow `LOCAL_APP_ONBOARDING_STANDARD.md` for new apps
4. Keep lifecycle helpers repo-local
5. Update repo-local config if ports change
6. Never recycle retired ports
