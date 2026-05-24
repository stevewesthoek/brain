# Local Application Onboarding Standard

One way of onboarding. One way of orchestrating. Every application follows this standard.

## Onboarding Checklist

1. Reserve a port from fixed ranges (3000–3099 for web, 5400–5499 for database)
2. Add entry to `local-apps.json` with required fields
3. Implement lifecycle scripts: `scripts/dev/start-local.sh`, `stop-local.sh`, `restart-local.sh`
4. Implement health endpoint (returns 200 when app is ready)
5. Add to `local-apps.md` Current Inventory table
6. Test: `npm run --prefix projects/brain-core test:local-app-actions-live`

Any missing step results in disabled actions in Brain Console with diagnostic reason.

## Port Reservation

**Fixed ranges (never reuse):**
- `3000–3099` — Web applications
- `5400–5499` — PostgreSQL databases
- `6300–6399` — Redis
- `7000–7099` — Internal dashboards
- `8000–8099` — Supporting services

One permanent port per app, one per database. Never recycle.

## Registry: local-apps.json

Required fields:

```json
{
  "name": "MyApp",
  "repoPath": "/Users/Office/Repos/stevewesthoek/myapp",
  "appPort": 3061,
  "appUrl": "http://localhost:3061",
  "healthCheck": "http://localhost:3061/api/health",
  "startCommand": "bash scripts/dev/start-local.sh",
  "stopCommand": "bash scripts/dev/stop-local.sh",
  "description": "MyApp dashboard"
}
```

Optional fields (if applicable):

```json
{
  "restartCommand": "bash scripts/dev/restart-local.sh",
  "startupTimeoutMs": 120000,
  "databaseEngine": "PostgreSQL",
  "databaseServiceName": "myapp",
  "dockerContainerName": "myapp-postgres-1",
  "databasePort": 5461,
  "databaseName": "myapp",
  "databaseUser": "postgres",
  "servicePorts": [3061, 3062, 3063],
  "notes": "Special requirements if any"
}
```

## Lifecycle Scripts

Location: `your-repo/scripts/dev/`

### start-local.sh (required)

```bash
#!/bin/bash
set -euo pipefail

PORT="${PORT:-3061}"
PID_FILE="/tmp/myapp.pid"

# If already running, return success
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    exit 0
  fi
fi

# Start app in background
cd "$(dirname "$0")/../.."
npm run dev > /tmp/myapp.log 2>&1 &
echo $! > "$PID_FILE"
exit 0
```

### stop-local.sh (required)

```bash
#!/bin/bash
set -euo pipefail

PID_FILE="/tmp/myapp.pid"

if [ ! -f "$PID_FILE" ]; then
  exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
  if ps -p "$PID" -o args= | grep -q "myapp\|node\|npm"; then
    kill -TERM "$PID" 2>/dev/null || true
    sleep 2
    kill -KILL "$PID" 2>/dev/null || true
  fi
fi

rm -f "$PID_FILE"
exit 0
```

### restart-local.sh (optional, only if special logic needed)

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
./stop-local.sh
sleep 1
./start-local.sh
exit 0
```

## Script Requirements

**DO:**
- Use fixed PID file at `/tmp/{app-name}.pid`
- Validate PID before killing (use `ps -p $PID`)
- Use `kill -TERM` before `kill -KILL`
- Exit with 0 (success) even if already stopped
- Log to `/tmp/{app-name}.log`

**DO NOT:**
- Read or source `.env` files
- Use `pkill`, `killall`, `lsof`, or shell globs
- Print secrets or environment variables
- Hardcode ports (use PORT environment variable)

## Health Endpoint

Implement a single endpoint that returns 200 when your app is ready:

```typescript
// Express
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Next.js
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

**For apps with multiple internal services:**
Implement one unified endpoint that validates all services are healthy, returns 200 only if all are ready.

## Application-Specific Configuration

If your app requires special handling:

1. Document in the registry `notes` field
2. Document requirements in your repo
3. Still follow the standard lifecycle path (same start/stop/restart scripts)
4. Brain Core will handle your app through the unified orchestrator

## Brain Core Integration

Brain Core reads the registry and orchestrates all apps through one path:

1. Stop app gracefully (SIGTERM → SIGKILL)
2. Free all registered ports
3. Verify ports are actually free
4. Start app with PORT injected
5. Verify health endpoint returns 200
6. Record action in audit log

No app bypasses this path.
