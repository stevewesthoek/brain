# ProBot Safe Update Procedure

## Overview

ProBot now manages **controlled, safe updates** with automatic service restoration. Updates are:
- **Always manual** — initiated by user clicking "Update Now" in the dashboard
- **Never silent** — clear notification shows what's being updated
- **Service-aware** — all dependent services stop before update, restart after
- **Self-healing** — health checks confirm all services restored successfully
- **Automatic** — ProBot restarts itself and services automatically after update

## What triggers an update notification?

An "Update Available" banner appears in the ProBot dashboard when:
- **Node.js version changed** (detected by npm rebuild pre-flight check)
- **Native modules need rebuilding** (e.g., `better-sqlite3`, MODULE_VERSION mismatch)
- **npm packages have updates** (npm outdated shows new versions)
- **ProBot source code changed** (checked on dashboard startup)

The notification shows exactly what needs updating and why.

## Safe Update Sequence

### Phase 1: Pre-Update (User Initiated)

1. User opens ProBot dashboard at http://localhost:7070
2. Sees "Update Available" banner in top-right corner (red background)
3. Banner shows summary: "Node.js version changed. 2 package updates."
4. User clicks "Update Now" button

### Phase 2: Shutdown (Automatic)

1. **Capture running state** — ProBot records which services are running:
   ```
   - BuildFlow
   - Firecrawl
   - Says the Bible
   - (etc.)
   ```

2. **Stop all services** in **reverse dependency order**:
   ```
   Stop Order (reverse of startup):
   1. Google Ads API
   2. Family Finance
   3. JPV Bootcamp (+ database)
   4. xGrow (+ database)
   5. Says the Bible
   6. ProChat
   7. Firecrawl
   ```

3. **Graceful ProBot shutdown**:
   - Finish active dashboard requests (5 second timeout)
   - Close database connections
   - Exit process cleanly

### Phase 3: Update (Subprocess, Automatic)

1. **Separate subprocess spawns** (independent of main ProBot process):
   ```bash
   npm install     # Fetch new packages
   npm rebuild     # Rebuild native modules for current Node.js
   ```

2. **Verify update succeeded**:
   - Both `npm install` and `npm rebuild` must exit with code 0
   - If either fails, update aborts and subprocess exits

3. **Restart ProBot**:
   ```bash
   npm start       # Start ProBot again
   ```

### Phase 4: Restoration (Automatic Post-Restart)

1. **ProBot restarts automatically**
2. **Dashboard startup hook** calls `/api/system/restore-after-update`
3. **Restore services** in **startup dependency order**:
   ```
   Start Order (dependencies first):
   1. Firecrawl (no dependencies)
   2. ProChat (can use Firecrawl)
   3. Says the Bible (may use ProChat API)
   4. xGrow (independent + database)
   5. JPV Bootcamp (independent + database)
   6. Family Finance (independent)
   7. Google Ads API (independent)
   8. BuildFlow (can depend on others)
   ```

4. **Health verification** for each service:
   - Wait up to 60 seconds per service for `/health` or API endpoint to respond
   - If service responds with 200 OK, mark as "running"
   - If timeout, mark as "failed" but continue (don't block other services)

5. **Report status** to dashboard:
   - ✅ Success: "Update complete. All 7 services restored."
   - ⚠️ Partial: "Update complete. Service X failed to restore: [error]"
   - ❌ Failure: "Update failed: [error]. See runbook for recovery."

### Phase 5: Notification

Dashboard banner updates automatically with result.

## Dependency Chain (Reference)

**Why this order matters:**

```
Database Layer (independent):
  - xGrow database (5445)
  - JPV Bootcamp database (5444)

Service Layer (built on databases):
  - Firecrawl (3055) — base research service
  - ProChat (3056) — marketing site
  - Says the Bible (3058) — web app
  - xGrow (7080) — depends on database
  - JPV Bootcamp (3000) — depends on database
  - Family Finance (3060) — independent
  - Google Ads API (8001) — independent
  - BuildFlow (3054) — can integrate with others
```

**Stopping**: Reverse order (critical apps first, then dependencies)  
**Starting**: Forward order (dependencies first, then apps that depend on them)

## State File

ProBot stores pre-update state here:

```
~/.probot/update-restore-state.json
```

**Contents:**
```json
{
  "capturedAt": "2026-04-26T18:55:00.123Z",
  "runningApps": ["BuildFlow", "Firecrawl", "Says the Bible"],
  "probot": {
    "pid": 52524,
    "port": 7070
  }
}
```

**Lifecycle:**
- Created just before update starts
- Consumed by restoration endpoint after ProBot restarts
- Deleted after successful restoration
- Kept if restoration fails (for manual recovery)

## Manual Rollback (If Update Fails)

### Check which services failed to restore:

```bash
# See dashboard notification or check logs
tail /tmp/probot.log | grep "\[Updates\]"

# Or check state file still exists (only if restoration failed)
cat ~/.probot/update-restore-state.json
```

### Manually restart a single service:

```bash
# BuildFlow example
cd ~/Repos/stevewesthoek/buildflow && ./start-all.sh

# Or any app from local-apps registry
cd <app-repo> && bash start-all.sh  # or similar
```

### Check logs for specific errors:

```bash
# ProBot logs
tail -100 /tmp/probot.log

# Service-specific logs
tail -100 /tmp/buildflow-cli.log
tail -100 /tmp/buildflow-web.log
tail -100 /tmp/firecrawl.log
```

### Revert ProBot code (if update broke something):

```bash
cd ~/Repos/stevewesthoek/brain/projects/probot

# Find last good commit
git log --oneline | head

# Revert to working state
git reset --hard <commit-hash>

# Rebuild and restart
npm rebuild
npm start
```

## Troubleshooting

### "Update appears stuck"

Check background process:
```bash
ps aux | grep -E "npm|node|update" | grep -v grep
```

If hung, force-kill the update subprocess:
```bash
pkill -9 -f "npm install"
pkill -9 -f "npm rebuild"
```

Then manually check ProBot:
```bash
curl http://localhost:7070 2>/dev/null && echo "Running" || echo "Offline"
```

### "Services not restoring after update"

Check state file:
```bash
cat ~/.probot/update-restore-state.json
```

Check individual service health:
```bash
curl http://localhost:3054/api/openapi      # BuildFlow web
curl http://localhost:3052/health           # BuildFlow agent
curl http://localhost:3055/v0/health/liveness  # Firecrawl
```

Check service logs:
```bash
tail -50 /tmp/buildflow-cli.log
tail -50 /tmp/buildflow-web.log
tail -50 /tmp/firecrawl.log
```

Manually restore one service:
```bash
# Go to service directory
cd ~/Repos/stevewesthoek/buildflow

# Run the start script directly
./start-all.sh

# Watch output for errors
```

### "ProBot dashboard still offline after update"

ProBot may have crashed during startup. Restart manually:

```bash
cd ~/Repos/stevewesthoek/brain/projects/probot

# Check for build errors
npm run build

# If build fails, check error log
tail /tmp/probot.log

# If build passes, start manually
npm start

# Dashboard should be available at http://localhost:7070
```

### "Update subprocess failed"

Check the update subprocess logs:

```bash
# The update subprocess logs to parent ProBot's stdout/stderr
tail /tmp/probot.log | grep "\[Update"

# Or manually check what `npm rebuild` would say
cd ~/Repos/stevewesthoek/brain/projects/probot
npm rebuild --verbose  # see detailed rebuild output
```

Common failures:
- **MODULE_VERSION mismatch**: Node.js version incompatible with native modules
  - Solution: `npm rebuild` should fix this
- **Network error during `npm install`**: npm registry unreachable
  - Solution: Check internet connection, retry update
- **Disk space**: Not enough space for install/rebuild
  - Solution: Free disk space, retry update

## System Hooks & Automation

**Updates are NEVER automatic.** The update is triggered by:

1. ✅ User sees "Update Available" notification
2. ✅ User clicks "Update Now" button
3. ✅ Dashboard shows "Updating..." spinner
4. ✅ ProBot restarts and restores services
5. ✅ Dashboard shows "Update complete"

Updates are **NOT** triggered by:
- ❌ systemd/launchd automatic restarts
- ❌ ProBot process crashes and restarts
- ❌ Node.js system updates
- ❌ Time-based schedules
- ❌ Git pull or branch changes

**All updates are explicit and user-controlled.**

## API Endpoints (For Developers)

### GET /api/system/updates
Returns what updates are available (cached for 5 minutes):

```json
{
  "hasUpdates": true,
  "nodeVersion": {
    "current": "v25.9.0",
    "required": "node (any)",
    "compatible": true
  },
  "packageUpdates": [
    {
      "name": "better-sqlite3",
      "current": "9.0.0",
      "available": "9.2.0"
    }
  ],
  "nativeModuleIssues": [],
  "details": "2 package update(s) available.",
  "inProgress": false
}
```

### POST /api/system/perform-update
Initiates the safe update sequence. **localhost only**.

Request:
```json
{}
```

Response:
```json
{
  "ok": true,
  "message": "Update initiated. ProBot will restart automatically.",
  "runningAppsCount": 7
}
```

### GET /api/system/restore-after-update
**Called automatically by ProBot on startup** if a pre-update state file exists.

Returns restoration results:

```json
{
  "success": true,
  "updateApplied": true,
  "restored": [
    {
      "name": "Firecrawl",
      "status": "running"
    },
    {
      "name": "BuildFlow",
      "status": "timeout",
      "error": "Health check timed out after 60000ms"
    }
  ],
  "errors": []
}
```

## Testing Updates (Development)

To test the update flow **without actually updating**:

### Check what updates are available:
```bash
curl http://localhost:7070/api/system/updates | jq .
```

### Simulate update detection:
```bash
cd ~/Repos/stevewesthoek/brain/projects/probot
npm outdated
npm rebuild --dry-run
```

### Simulate the pre-update state capture:
```bash
# This happens automatically during update, but you can inspect:
cat ~/.probot/update-restore-state.json 2>/dev/null || echo "No pre-update state"
```

## Complete Example Flow

**User perspective:**

1. Open dashboard: http://localhost:7070
2. See banner: "Update Available — Node.js version changed. 2 package updates."
3. Click "Update Now" button
4. See spinner: "Updating... (stopping services, updating, restoring)"
5. After ~30 seconds, see: "✅ Update complete. All 7 services restored."
6. All services back online and healthy

**Behind the scenes:**

1. `buildflow/start-all.sh` stops BuildFlow (port 3052, 3053, 3054)
2. `firecrawl/stop-firecrawl.sh` stops Firecrawl (port 3055)
3. ProBot shuts down gracefully
4. Update subprocess runs: `npm install && npm rebuild && npm start`
5. ProBot starts, calls `/api/system/restore-after-update`
6. Services start in order: Firecrawl → ProChat → Says the Bible → ...
7. Each service health-checked
8. State file deleted
9. Dashboard shows results

---

## Reference

**Last Updated:** 2026-04-26  
**ProBot Version:** 0.1.0+  
**Applies to:** All environments (local dev, staging, production)  
**Runbook Version:** 1.0

**Related:**
- [ProBot Dashboard](./probot-dashboard.md)
- [Local App Registry](../infrastructure/local-apps.json)
- [ProBot Architecture](../architecture/probot.md)

**Questions?** Check `/tmp/probot.log` and `/tmp/[service-name].log` for detailed error messages.
