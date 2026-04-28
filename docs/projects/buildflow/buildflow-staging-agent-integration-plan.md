# BuildFlow Staging: Local Agent-to-Staging-Relay Integration Plan

**Date:** 2026-04-28  
**Status:** READY TO TEST — Agent can point to staging relay with environment override  
**Verdict:** Safe to test without disrupting production relay

---

## Current State Summary

**Staging relay verification (commit b1539e0b):**
- ✅ Staging public routing works: `buildflow-staging.prochat.tools` → HTTP 200
- ✅ Device registration works: `POST /api/register` returns HTTP 201 with deviceId
- ✅ Bearer token validation works: Registered tokens pass authentication
- ✅ `/api/actions/status` returns operational error: `"Your device is not connected to the relay"`
  - This means: **authentication succeeded; relay is waiting for connected agent**

**Current blocker:**
- Staging relay has 2 registered test devices (device-1777369829790, device-1777369847899)
- Both show `status: "offline"` in `/api/admin/devices`
- No local agent currently connected to staging

**Production state (unchanged):**
- Local BuildFlow agent continues running against `localhost:3053` (production relay)
- `buildflow.prochat.tools` production domain remains operational
- Web app (`localhost:3054`) routes through production relay by default

---

## Local Agent Architecture

**Key finding from packages/cli/src/commands/serve.ts (lines 26-29):**

```typescript
const bridgeUrl = process.env.BRIDGE_URL
const deviceToken = process.env.DEVICE_TOKEN || config.deviceToken

if (bridgeUrl && deviceToken) {
  log('Connecting to bridge relay...')
  const bridgeClient = new BridgeClient(bridgeUrl, deviceToken)
  await bridgeClient.connect()
}
```

**Agent connection logic (proven in source):**
1. If `BRIDGE_URL` env var is set → use that relay endpoint
2. If `DEVICE_TOKEN` env var is set → use that token
3. Otherwise fall back to `config.deviceToken` (from local config file)
4. If both URL and token provided → BridgeClient connects via WebSocket

**Priority order (from source):**
1. Environment variables `BRIDGE_URL` + `DEVICE_TOKEN` (highest priority)
2. Local config file `config.deviceToken` + default API base URL
3. Standalone mode (no relay)

---

## Safe Integration Model: Parallel Testing

**Best approach (minimal risk):**
- Keep existing local agent running against `localhost:3053` (production relay)
- Start a **second terminal session** with overridden env vars pointing to staging
- Both can run simultaneously without conflict

**Why this is safe:**
- Each agent instance has its own process and WebSocket connection
- Device IDs are separate (test devices vs production device)
- Port 3052 (local agent HTTP server) is shared, but only one agent instance per session
- Can test staging relay independently from production

---

## Test Command (Ready to Execute)

**Prerequisites:**
1. ✅ Staging relay is accessible at `buildflow-staging.prochat.tools`
2. ✅ Device token registered and ready (from earlier test: `device-1777369847899`)
3. ✅ Local BuildFlow agent source available
4. BuildFlow local agent is currently running (for comparison)

**Terminal 1 (Keep production running):**
```bash
# Current production agent (should already be running)
cd ~/Repos/stevewesthoek/buildflow/packages/cli
npm run dev  # or: npx tsx src/index.ts serve
# This connects to localhost:3053 (production relay)
```

**Terminal 2 (Test staging):**
```bash
# New terminal: staging-only agent
cd ~/Repos/stevewesthoek/buildflow/packages/cli

# Use staging relay with test device token
# IMPORTANT: Replace DEVICE_TOKEN with actual token from earlier registration
export BRIDGE_URL="wss://buildflow-staging.prochat.tools/api/bridge/ws"
export DEVICE_TOKEN="<staging-test-device-token>"

npx tsx src/index.ts serve
# This connects to buildflow-staging.prochat.tools
```

**Expected output (if successful):**
```
Starting local agent server...
Connecting to bridge relay...
Connected to bridge relay
BuildFlow agent is running!
Local server: http://127.0.0.1:3052
Press Ctrl+C to stop.
```

**If connection succeeds:**
- `/api/admin/devices` on staging should show device as `"status": "online"` (or "connected": true)
- `/api/actions/status` should return actual status (not "device not connected" error)

---

## Rollback/Recovery

**If staging connection fails:**
1. Agent logs "Could not connect to bridge relay" but continues in standalone mode
2. Local vault access still works
3. Ctrl+C to stop staging agent process
4. Existing production agent in Terminal 1 unaffected

**If staging connection works but causes issues:**
1. Ctrl+C in staging terminal (Terminal 2)
2. Production agent in Terminal 1 continues
3. Revert by not running staging agent

**Zero impact on production because:**
- Production relay (`localhost:3053`) never touched
- No DNS/Cloudflare changes made
- No Docker container restarts
- No Dokploy configuration changes

---

## WebSocket URL Format

**Critical detail from source inspection:**
- Production local relay: `ws://localhost:3053/api/bridge/ws` (unencrypted, localhost only)
- Staging public relay: `wss://buildflow-staging.prochat.tools/api/bridge/ws` (encrypted, HTTPS tunnel)
- Note: `wss://` is WebSocket Secure (TLS); required for remote relay

**Why this works:**
- Cloudflare tunnel already handles TLS termination for `buildflow-staging.prochat.tools`
- Browser/client can safely use `wss://` to remote relay
- Proxy routes `/api/bridge/ws` → relay bridge port 3053 (verified in dockerfile-contract)

---

## Device Token Handling

**Security posture (verified from source):**
- Device tokens are client-provided (not server-generated)
- Agent sends token in WebSocket upgrade handshake
- Token is never logged or printed in agent code
- Token stored in local `~/.buildflow/config.json` or env var (user's responsibility)

**For this test:**
- Use staging test device token (already generated and registered)
- Store in `DEVICE_TOKEN` env var (temporary, not committed)
- Do NOT add to shell profile or config files
- Do NOT commit to git

**Production token remains unchanged:**
- Existing local agent uses `config.deviceToken` from local config
- No production token exposure

---

## What Happens When Agent Connects

**If connection succeeds:**

1. **Agent WebSocket connects to staging relay**
   - `buildflow-staging.prochat.tools/api/bridge/ws`
   - Device token used for authentication
   - Relay confirms device is "online"

2. **Staging relay registers connection**
   - `/api/admin/devices` shows device as "connected": true
   - Last activity timestamp updates

3. **Actions become available**
   - `/api/actions/status` returns actual agent status (not "device not connected")
   - `/api/actions/search`, `/api/actions/read`, etc. can proxy through relay

4. **Web app can route through relay**
   - If custom GPT pointed at `buildflow-staging.prochat.tools`
   - Could execute actions against connected agent

---

## Production Safety Confirmation

**What cannot happen:**
- ✅ Production relay (`localhost:3053`) is never touched
- ✅ Production buildflow.prochat.tools domain never changed
- ✅ Existing local agent connection unaffected
- ✅ No Dokploy/Docker/DNS changes
- ✅ Web app can still use production relay independently

**Isolation mechanism:**
- Staging relay (`buildflow-staging.prochat.tools`) is completely separate infrastructure
- Different Docker container, different domain, different token store
- No shared state with production

---

## Files and Configuration Summary

**Files that need to remain unchanged:**
- `/Users/Office/Repos/stevewesthoek/buildflow` — Read-only inspection only
- No source code modifications
- No configuration file changes
- No Docker/Dokploy changes

**Files/commands for testing:**
- Terminal environment only: `BRIDGE_URL`, `DEVICE_TOKEN` (temp env vars)
- No persistent config changes needed
- Test is fully reversible

---

## Known Limitations (By Design)

**What we're NOT testing (out of scope for this phase):**
- ✗ Multi-device routing through relay
- ✗ Custom GPT action execution through relay
- ✗ End-to-end vault sync through relay
- ✗ Agent failover or reconnection behavior

**What we ARE testing:**
- ✅ Agent can connect to remote staging relay
- ✅ Device token authentication works
- ✅ Relay recognizes connected device
- ✅ Actions endpoint behavior changes when device is connected

---

## Next Steps (If Test Succeeds)

1. **Verify device appears online in staging:**
   ```bash
   curl -s -H "Authorization: Bearer <RELAY_ADMIN_TOKEN>" \
     https://buildflow-staging.prochat.tools/api/admin/devices | jq '.devices[] | select(.deviceId == "device-1777369847899")'
   ```

2. **Test read-only action through relay:**
   ```bash
   curl -s -X POST https://buildflow-staging.prochat.tools/api/actions/status \
     -H "Authorization: Bearer <DEVICE_TOKEN>"
   ```

3. **Document findings in new report**

---

## Report Metadata

- **Source verified:** packages/cli/src/commands/serve.ts (bridgeUrl and deviceToken handling)
- **Safe to test:** Yes — agent supports BRIDGE_URL env var override
- **Production impact:** None — separate relay, separate domain
- **Rollback:** Simple — Ctrl+C terminates staging agent, production unaffected
- **Timeline:** Ready to test immediately
- **Risk level:** Low — read-only connection test, reversible

