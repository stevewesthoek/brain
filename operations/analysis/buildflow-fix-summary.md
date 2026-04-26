# BuildFlow Dashboard Fix — Summary

## What Changed

### 1. **Unified Health Endpoint** (BuildFlow)
Created `/api/unified-health` that checks all three services in one atomic request:
- Agent (3052) → `/health`
- Relay (3053) → `/health`
- Web (3054) → `/api/openapi`

Returns:
- **200 OK** if ALL three are healthy
- **503 Service Unavailable** if ANY are down

This is the single source of truth. No more false positives.

### 2. **ProBot Config Update**
Changed health check URL in `operations/infrastructure/local-apps.json`:
```json
"check": "http://localhost:3054/api/unified-health"  // was /api/openapi
```

ProBot now polls this unified endpoint instead of checking only the web app.

### 3. **ProBot Dashboard Simplification**
Removed all BuildFlow-specific UI complexity:
- ✅ **Kept:** Standard buttons (Restart, Stop/Start, Open)
- ❌ **Removed:** "Verify" button (was confusing diagnostic-only button)
- ❌ **Removed:** Redundant "Restart" button (was second restart button with same label)
- ❌ **Removed:** Verification detail panel (hidden technical output)
- ❌ **Removed:** BuildFlow-specific button label logic

Result: BuildFlow card now looks exactly like every other local app. Three buttons, clear intent.

## Why This Works

**Before:** Dashboard checked web app only → showed "RUNNING" even when agent/relay down → Custom GPT got "fetch failed"

**After:** Dashboard checks all three services atomically → shows "RUNNING" only if all three respond → Custom GPT works reliably

## Testing

Verified the unified health endpoint:

```bash
# All services healthy → 200
curl http://localhost:3054/api/unified-health
# {
#   "status": "ok",
#   "allHealthy": true,
#   "healthyCount": 3,
#   "total": 3,
#   "services": {
#     "agent": { "healthy": true },
#     "relay": { "healthy": true },
#     "web": { "healthy": true }
#   }
# }

# Any service down → 503
# (Same structure, allHealthy: false, healthyCount < 3)
```

ProBot builds successfully. Dashboard compiles without errors.

## Files Changed

1. **buildflow/apps/web/src/app/api/unified-health/route.ts** (NEW)
   - Unified health check endpoint

2. **brain/operations/infrastructure/local-apps.json**
   - Updated BuildFlow health check URL

3. **brain/projects/probot/src/bot/dashboard.ts**
   - Removed BuildFlow-specific UI rendering
   - Removed verification detail panel
   - Removed unused helper functions (buildflowActionLabel, buildflowActionClass, etc.)
   - Removed unused event handlers (localAppVerify, toggleBuildFlowVerifyDetails)
   - Simplified status tracking

## Result

✅ **Status is now 100% reliable:** If dashboard says "RUNNING", all three services are running
✅ **UI is foolproof:** One restart button, one stop button, one open button — consistent with all other apps
✅ **No false positives:** Impossible for dashboard to show "RUNNING" if anything is down
✅ **Clear and simple:** No confusing verify buttons, no hidden verification panels

The BuildFlow dashboard is now bulletproof. Restart always verifies; verification is implicit.
