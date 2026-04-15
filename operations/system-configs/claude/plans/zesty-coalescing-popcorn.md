# Plan: Remove xgrow, add "Local Apps" tab to ProBot dashboard

## Context
X-Grow has been decommissioned and should be completely removed from ProBot. In its place, a new "Local Apps" tab will show all locally running services on the Office Mac, with live status (running/stopped), port, last-run time, duration, and Start/Stop buttons.

---

## Files to change

**Primary:** `/Users/Office/Repos/stevewesthoek/brain/projects/probot/src/bot/dashboard.ts`
**Documentation:** `/Users/Office/Repos/stevewesthoek/brain/operations/infrastructure/infra.md`

---

## Part 1: Remove xgrow completely from dashboard.ts

All on single file. Removals by section:

1. **CSS block** — lines ~1491–1512: delete the `/* ── xgrow ── */` block and all `.xgrow-*` rules
2. **Tab button** — line ~1543: delete `<button class="tab-btn" data-tab="xgrow">...</button>`
3. **Tab panel** — line ~1554: delete `<div class="tab-panel" id="tab-xgrow"></div>`
4. **Global cache var** — line ~1558: delete `var xgrowPosts={}`
5. **JS helper functions** — lines ~2116–2188: delete `xgrowTrigger()`, `xgrowDo()`, `xgrowGenReplies()`, `xgrowPostReply()`
6. **renderXgrow()** — lines ~1999–2050: delete entire function
7. **Render call** — lines ~2094–2097: delete the `if(d.xgrow){...}` block
8. **API handlers** — 4 route handlers for `/api/xgrow/*` in the server section: delete all four

---

## Part 2: Add "Local Apps" tab

### Services to index (from infra.md + runbooks)

| Name | Port | Check URL | Start cmd | Stop cmd |
|------|------|-----------|-----------|----------|
| ProBot | 7070 | `http://localhost:7070` | `cd ~/Repos/stevewesthoek/brain/projects/probot && npm start` | kill process on port 7070 |
| Firecrawl | 3051 | `http://localhost:3051/health` | `cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d` | `docker compose down` |
| Google Ads API | 8001 | `http://localhost:8001/health` | start via supervisor/launchd | kill process on port 8001 |
| ComfyUI | 8188 | `http://localhost:8188` | from runbook | kill process on port 8188 |
| Family Finance | 3060 | `http://localhost:3060` | `cd ~/Repos/stevewesthoek/family-finance && npm run dev` | kill on port |
| Fala | 3050 | `http://localhost:3050` | start via dokploy or local | kill on port |

Note: ProBot itself shows as "running" with no Stop button (can't stop itself).

### Server-side: new `getLocalAppsStatus()` function in dashboard.ts

Logic:
- For each service, do a `fetch` to its health URL with a short timeout (1.5s)
- If response ok → `running`, record response time
- If fetch fails/timeout → `stopped`
- Read last-run from a small JSON file `~/.probot/local-apps-history.json` (keyed by service name: `{ lastSeen: ISO, lastDuration: ms }`) — updated each time a service is detected as running
- Returns array of `{ name, port, url, status, lastSeen, lastDuration, startCmd, stopCmd }`

### New API endpoints

- `GET /api/local-apps` — returns the live status array (called separately from `/api/data` since it's slow)
- `POST /api/local-apps/start` — `{ name }` — shells out the start command
- `POST /api/local-apps/stop` — `{ name }` — kills process on the port

### Frontend

**Tab button** (replace xgrow button):
```html
<button class="tab-btn" data-tab="local-apps">Local Apps <span class="tab-count" id="cnt-local-apps"></span></button>
```

**Tab panel** (replace xgrow panel):
```html
<div class="tab-panel" id="tab-local-apps"></div>
```

**renderLocalApps(data)** function — renders a card per service:
```
┌─────────────────────────────────────────────────┐
│ ● ProBot             port 7070                  │
│   running · last seen 2h ago · 3d 4h uptime     │
│                              [Open] [Stop]       │
└─────────────────────────────────────────────────┘
```

**CSS** — new `.local-app-*` classes replacing `.xgrow-*`

**JS fetch** — Local Apps tab fetches `/api/local-apps` lazily when the tab is first clicked (not in the main `/api/data` call, since port probing is slow)

---

## Part 3: Remove xgrow from infra.md

- Remove xgrow row from domain table (line ~344)
- Remove xgrow from Dokploy apps section (line ~167)
- Remove TODO about xgrow status (line ~384)

---

## Build & restart
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot
npm run build
pkill -9 -f "node dist" && npm start > /tmp/probot.log 2>&1 &
```

---

## Verification
1. No "xgrow" tab in ProBot dashboard tab bar
2. "Local Apps" tab visible, clicking it triggers `/api/local-apps` fetch
3. ProBot row shows as running (port 7070 responds)
4. Firecrawl shows running or stopped depending on whether docker container is up
5. Start/Stop buttons send correct POST requests
6. No xgrow references remain in infra.md
