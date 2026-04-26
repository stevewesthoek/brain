# BuildFlow Dashboard Reliability Assessment

## Executive Summary

The BuildFlow dashboard status display is **fundamentally broken** because it only checks ONE service (the web app on port 3054) while BuildFlow requires THREE interdependent services to function:

1. **Agent** (port 3052) — BuildFlow CLI/local agent
2. **Relay** (port 3053) — Docker-based relay bridge
3. **Web** (port 3054) — Next.js frontend

When only the web app is running, the dashboard shows "RUNNING" even though external integrations cannot reach BuildFlow. The UI is also confusing with two redundant restart buttons that do different things.

---

## Root Cause Analysis

### 1. Health Check is Incomplete

**File:** `operations/infrastructure/local-apps.json` (line 222)

```json
"check": "http://localhost:3054/api/openapi",
"healthCheck": "http://localhost:3054/api/openapi",
```

**Problem:** ProBot only checks the web app's health endpoint (`/api/openapi`). It doesn't verify the agent (3052) or relay (3053) are running.

**Impact:** 
- Web app UP, Agent DOWN, Relay DOWN → Dashboard says "RUNNING" (FALSE)
- Custom GPT cannot connect → User sees confusing "fetch failed" error

### 2. The Verification System Exists But is Optional

**File:** `projects/probot/src/bot/buildflow-verify.ts` (lines 333-334)

The verification system DOES check all three services correctly:
```typescript
const agentHealthy = await ensureHealthy("http://127.0.0.1:3052/health", healthTimeoutMs);
const webHealthy = await ensureHealthy("http://127.0.0.1:3054/api/openapi", healthTimeoutMs);
```

**Problem:** This verification only runs when the user manually clicks "Verify" or "Restart" buttons. It's not part of the automatic status check that happens every poll cycle.

### 3. Dashboard Status Never Reflects All Three Services

**File:** `projects/probot/src/bot/local-apps.ts` (lines 201-214)

The status determination logic:
- Makes one HTTP request to the health check URL
- Sets status to "running" if response is OK
- Sets status to "stopped" otherwise

**Problem:** There is NO mechanism to check multiple ports and require ALL to be healthy.

### 4. The UI Has Two Confusing Restart Buttons

**File:** `projects/probot/src/bot/dashboard.ts` (lines 2281-2296)

For BuildFlow specifically:
1. **"Verify"** button → Runs health checks, shows detailed results
2. **"Restart"** button → Kills all ports, rebuilds, restarts all three services

**Problem:**
- Users don't understand the difference
- "Verify" is a diagnostic tool, not a fix
- Two buttons for essentially the same action (restart)
- Visual confusion: both labeled "Restart" after they run

---

## What the Current Code Does vs. Should Do

### Current Behavior

1. ProBot dashboard checks: `http://localhost:3054/api/openapi` once every ~5 seconds
2. If web app responds with 2xx → shows "RUNNING"
3. User sees the card is running → assumes BuildFlow works
4. Custom GPT hits relay (3053) or agent (3052) → gets connection refused
5. User is confused: "Dashboard says it's running!"

### What Actually Happens

From your investigation: web app was running, but agent and relay were NOT. Dashboard showed "RUNNING". Custom GPT got "TypeError: fetch failed" because the relay couldn't connect to the agent.

---

## The UI Problem: Two Restart Buttons

The current UI shows:

```
[Verify] [Restart] [Restart] [Stop] [Open]
```

This is confusing because:

1. **"Verify"** = Health diagnostic (doesn't fix anything)
2. **First "Restart"** = Full restart (rebuild + restart all three services)
3. **Second "Restart"** = Generic restart (from local-apps.json fallback)

The rendering logic (dashboard.ts:2281-2296):

```typescript
// BuildFlow-specific buttons
const verifyLabel = buildflowActionLabel('Verify', verifyRunning, verify);
html += '<button ... data-action="verify"...>'+esc(verifyLabel)+'</button>';

const restartLabel = buildflowRestartLabel(restartRunning, restartResult);
html += '<button ... data-action="restart" ...>'+esc(restartLabel)+'</button>';

// Generic restart (if app.restartable is true)
if (app.restartable) {
  html += '<button ... data-action="restart" ...>Restart</button>';
}
```

Result: Two buttons with the same label doing different things. Users click the wrong one or don't understand what they do.

---

## The Solution (One Robust Approach)

### Core Principle

**The BuildFlow status must be the AND of all three services: Status = Agent AND Relay AND Web**

If ANY service is down, BuildFlow status is FAILED. No exceptions.

### Implementation

#### 1. Replace the Single Health Check with a Comprehensive One

**Change:** `operations/infrastructure/local-apps.json`

Add a new health check endpoint to the BuildFlow web app that validates all three services at once. This endpoint should:
- Check if the agent responds to `/health` on 3052
- Check if the relay responds to `/health` on 3053
- Check if the web app itself is healthy on 3054
- Return 200 only if ALL three are healthy; return 503 if ANY are down

**Why:** Single HTTP request, atomic result, no race conditions.

**Implementation location:** `buildflow/apps/web/src/app/api/unified-health/route.ts`

```typescript
export async function GET() {
  const checks = await Promise.all([
    fetch("http://127.0.0.1:3052/health").then(r => r.ok),
    fetch("http://127.0.0.1:3053/health").then(r => r.ok),
    fetch("http://127.0.0.1:3054/api/openapi").then(r => r.ok),
  ]);
  
  const allHealthy = checks.every(c => c === true);
  return NextResponse.json(
    { status: allHealthy ? 'ok' : 'unhealthy', details: checks },
    { status: allHealthy ? 200 : 503 }
  );
}
```

**Update config:** Change the health check URL:
```json
"check": "http://localhost:3054/api/unified-health"
```

#### 2. Simplify the UI: One Clear Button

**Change:** `projects/probot/src/bot/dashboard.ts`

Replace the confusing two-button UI with a single, clear action:

```
BuildFlow: RUNNING (3/3 services healthy)
[Restart & Verify] [Open]

BuildFlow: FAILED (2/3 services down)
[Restart & Verify] [View Details] [Open]
```

**Logic:**
- Status shows service count: "2/3 services healthy"
- One button does both actions: "Restart & Verify" (kills ports, rebuilds, restarts, verifies)
- "View Details" button only shows if last verification failed
- "Verify" is removed from the normal flow (only available in details panel)

#### 3. Make the Restart Action Bulletproof

The `restart-and-verify` already does the right thing:
1. Kill all three ports (3052, 3053, 3054)
2. Rebuild packages
3. Start services in the correct order
4. Wait for health checks on all three ports
5. Report success/failure with detailed step output

**No changes needed here** — it's already robust. Just expose it through the simplified UI.

#### 4. Remove the Confusing "Verify" Button

The "Verify" button only runs health checks without restarting. This is confusing because:
- Users think clicking it will fix problems
- It doesn't restart anything
- It conflicts with the "Restart & Verify" action

**Solution:** Remove the standalone "Verify" button. Make verification part of the restart flow or hide it in an "advanced" details panel.

---

## Specific Code Changes Required

### File 1: `operations/infrastructure/local-apps.json`

**Change (line 222):**
```diff
- "check": "http://localhost:3054/api/openapi",
+ "check": "http://localhost:3054/api/unified-health",
```

### File 2: `buildflow/apps/web/src/app/api/unified-health/route.ts` (NEW)

Create this file with the comprehensive health check that validates all three services.

### File 3: `projects/probot/src/bot/dashboard.ts`

**Remove BuildFlow-specific render logic (lines 2281-2291)** and replace with:

```typescript
// For BuildFlow: single restart button, no verify
if (app.name === 'BuildFlow') {
  const isHealthy = app.status === 'running';
  const restartRunning = buildflowBusy; // simplified
  
  html += '<button class="local-app-btn" data-action="restart" onclick="localAppRestart(this,&quot;'+esc(app.name)+'&quot;)"'+(restartRunning?' disabled':'')+'>Restart & Verify</button>';
  
  if (!isHealthy) {
    html += '<button class="local-app-btn" data-action="details" onclick="toggleBuildFlowDetails()">View Details</button>';
  }
}
```

**Simplify status display (line 1337-1345):** Remove `buildflowVerify`, `buildflowVerifyRunning` since they're no longer shown in the main UI.

---

## Benefits of This Approach

1. **Single source of truth:** BuildFlow is "running" IFF all three services respond to health checks
2. **No false positives:** Dashboard cannot lie about service status
3. **Simple UI:** One button, clear intent: "Restart & Verify" fixes everything
4. **Atomic health check:** No race conditions; single request returns definitive status
5. **Maintains verification:** Detailed verification logs still available in "View Details"
6. **Backward compatible:** Existing verification logic stays the same; just integrated into the UI flow

---

## Why This is the Best Solution

**Alternatives considered and rejected:**

1. **Check all three ports in ProBot:** Would require 3 HTTP requests per poll cycle, more latency, possible race conditions during startup. ❌

2. **Change local-apps.ts to support multiple checks:** Over-engineered for a one-off case; adds complexity to the generic local app framework. ❌

3. **Keep two buttons, just label them clearly:** Users still get confused; doesn't solve the fundamental status reliability problem. ❌

4. **Always run verify before showing status:** Too slow (verify takes 2+ minutes on rebuild). ❌

**This solution is best because:**
- ✅ BuildFlow validates all three services in a single atomic request
- ✅ ProBot doesn't need to know about BuildFlow's internal structure
- ✅ UI is dramatically simpler and less confusing
- ✅ Status display is always 100% accurate
- ✅ No performance impact (one extra health endpoint in BuildFlow)
- ✅ Reusable pattern (other multi-service apps can use the same approach)

---

## Implementation Order

1. **Create BuildFlow unified health endpoint** (`buildflow/apps/web/src/app/api/unified-health/route.ts`)
2. **Update health check URL** in `local-apps.json`
3. **Simplify ProBot UI** in `dashboard.ts`
4. **Test thoroughly** — verify false positive is impossible

**Estimated effort:** 2-3 hours of coding + thorough testing

