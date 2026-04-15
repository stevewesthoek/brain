# Local Applications Inventory

**Canonical source:** `operations/infrastructure/local-apps.json`

This file is the single source of truth for all locally-running applications on the Office Mac. The ProBot dashboard reads it at runtime — add or remove an entry here and the **Local Apps tab updates immediately** with no ProBot rebuild required.

## Schema

Each entry in `local-apps.json` is a JSON object with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name shown in ProBot dashboard |
| `port` | number | yes | Local port the app listens on |
| `url` | string | yes | URL to open in browser (`http://localhost:PORT`) |
| `check` | string | yes | Health-check URL ProBot pings to determine running/stopped |
| `start` | string | yes | Shell command to start the app |
| `description` | string | no | One-line description shown in the dashboard card |

## Current Inventory

| Name | Port | Description | Start Command |
|------|------|-------------|---------------|
| ProBot | 7070 | ProBot dashboard and automation daemon | `cd ~/Repos/stevewesthoek/brain/projects/probot && npm start` |
| Firecrawl | 3051 | Web scraping and research API | `cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d` |
| xGrow | 7080 | X (Twitter) growth automation | `cd ~/Repos/prochattools/saas/xgrow && npm run dev` |
| Google Ads API | 8001 | Google Ads webhook and API server | `supervisorctl start google-ads-http-server` |
| ComfyUI | 8188 | Stable Diffusion image generation UI | Manual start required |
| Family Finance | 3060 | Multi-account family finance tracker | `cd ~/Repos/stevewesthoek/family-finance && npm run dev` |
| Fala | 3050 | Portuguese language learning app | Manual start required |

## How ProBot loads this file

ProBot reads `local-apps.json` on every `/api/local-apps` request (no caching). Changes are live immediately — no restart or rebuild needed.

File path hardcoded in `projects/probot/src/bot/dashboard.ts`:
```
~/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.json
```

For each app, ProBot makes a GET request to `check` with a 1-second timeout. If it gets a 2xx response the app is **running**; otherwise **stopped**.

## Adding a new app

1. Edit `operations/infrastructure/local-apps.json`
2. Add a new JSON object following the schema above
3. Save the file — the ProBot Local Apps tab picks it up on next refresh

## Removing an app

1. Edit `operations/infrastructure/local-apps.json`
2. Delete the entry
3. Save — the app disappears from ProBot on next refresh
