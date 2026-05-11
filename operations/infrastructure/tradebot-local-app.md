# TradeBot Local App

TradeBot is the local read-only Crypto.com cockpit and staged trading lab.

## Canonical runtime

- Repo: `/Users/Office/Repos/stevewesthoek/tradebot`
- Fixed local app port: `3061`
- App URL: `http://localhost:3061/dashboard`
- Health check: `http://localhost:3061/api/health`
- Log file: `/tmp/tradebot.log`
- Reserved future PostgreSQL host port: `5454`
- Database name: `tradebot`
- Database user: `tradebot`

## Phase boundary

TradeBot is currently Phase 1 only.

Allowed:
- read-only cockpit
- local dashboard
- health endpoint
- future read-only Crypto.com account and market views

Blocked:
- live trading
- withdrawals
- margin
- leverage
- derivatives
- Freqtrade execution integration
- LLM trade authority

## ProBot registry entry

TradeBot must be registered in `operations/infrastructure/local-apps.json` with:

```json
{
  "name": "TradeBot",
  "repoPath": "/Users/Office/Repos/stevewesthoek/tradebot",
  "port": 3061,
  "appPort": 3061,
  "url": "http://localhost:3061/dashboard",
  "appUrl": "http://localhost:3061/dashboard",
  "check": "http://localhost:3061/api/health",
  "healthCheck": "http://localhost:3061/api/health",
  "start": "cd ~/Repos/stevewesthoek/tradebot && PORT=3061 NEXT_PUBLIC_APP_URL=http://localhost:3061 npm run dev > /tmp/tradebot.log 2>&1 &",
  "startCommand": "cd ~/Repos/stevewesthoek/tradebot && PORT=3061 NEXT_PUBLIC_APP_URL=http://localhost:3061 npm run dev > /tmp/tradebot.log 2>&1 &",
  "stop": null,
  "stopCommand": null,
  "restart": null,
  "restartCommand": null,
  "description": "TradeBot read-only Crypto.com cockpit and staged trading lab",
  "databaseEngine": "PostgreSQL",
  "databaseServiceName": "tradebot",
  "databasePort": 5454,
  "databaseName": "tradebot",
  "databaseUser": "tradebot",
  "startupTimeoutMs": 120000,
  "notes": "Phase 1 only: read-only cockpit. Fixed local app port is 3061. Health check is /api/health. ProBot owns lifecycle orchestration and injects/uses the fixed port. Future local Postgres should use reserved host port 5454; TradeBot must not reuse ProChat DB port 5434."
}
```

## Manual stop/start prompt

Use this after pulling the brain registry update and stopping the temporary `3000` dev session:

```bash
cd ~/Repos/stevewesthoek/tradebot

# Stop the temporary 3000 dev server if it is still running.
lsof -ti tcp:3000 | xargs kill 2>/dev/null || true

# Start TradeBot on its reserved fixed port.
PORT=3061 NEXT_PUBLIC_APP_URL=http://localhost:3061 npm run dev
```

Open `http://localhost:3061/dashboard`.
