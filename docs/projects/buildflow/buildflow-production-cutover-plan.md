# BuildFlow Production Cutover Plan: Local Tunnel → Dokploy Relay

**Date:** 2026-04-28  
**Status:** PLANNING PHASE — Ready for review before execution  
**Scope:** Cutover from local Cloudflare tunnel to Dokploy-hosted production relay  
**Owner:** Machine-Brain / BuildFlow Team

---

## ⚠️ CRITICAL PREREQUISITES

**Phases 1–3 are PRE-CUTOVER ONLY.** Production `buildflow.prochat.tools` remains served by the local Cloudflare tunnel until explicit approval in Phase 4. 

**⚠️ IMPORTANT:** Successful staging relay testing proves the architecture is sound but does NOT guarantee production readiness. Each phase must complete all success criteria before proceeding.

---

## Executive Summary

This plan outlines the controlled cutover of `buildflow.prochat.tools` from the current local Cloudflare tunnel architecture to a Dokploy-hosted production relay, validated by successful staging integration tests.

**Current State (Proven):**
- Production via local tunnel: `buildflow.prochat.tools` → localhost:3054 (Cloudflare tunnel)
- Staging via Dokploy: `buildflow-staging.prochat.tools` working with device tokens and WebSocket
- Local components: agent (3052), relay (3053), web (3054) all running
- Non-staging Dokploy app: standby with zero domains

**Target State:**
- Production via Dokploy: `buildflow.prochat.tools` → Dokploy BuildFlow relay/web stack
- Local agent connects outward to production relay using DEVICE_TOKEN and BRIDGE_URL
- Rollback capability maintained until production relay verified
- Local tunnel decommissioned only after cutover proven

---

## Current State: Proven Facts vs Assumptions

### ✅ Proven Facts

| Fact | Evidence | Source |
|------|----------|--------|
| Local tunnel exists | `~/.cloudflared/config.yml` ingress rule | Cloudflare config |
| Local tunnel routes to localhost:3054 | Config shows `service: http://localhost:3054` | Cloudflare config |
| buildflow.prochat.tools responds HTTP 200 | curl test successful | Live endpoint test |
| Staging relay on Dokploy works | Integration test: device connected | Integration test report |
| Device token auth works | Bearer token validated at /api/actions/status | Integration test |
| Non-staging BuildFlow app exists | App ID BaxAt-F3ieLzkECClGjiE in Dokploy | Dokploy API |
| Non-staging app has no domains | domains: [] from /api/application.one | Dokploy API |
| Staging app has buildflow-staging domain | domains: ["buildflow-staging.prochat.tools"] | Dokploy API |
| Both apps use same image | ghcr.io/stevewesthoek/buildflow:latest | Dokploy API |
| Local agent can connect to staging relay | Integration test proved offline→online | Integration test |
| /api/actions/status reached connected agent | Error changed from "not connected" to "command failed" | Integration test |
| Production remains unaffected by staging test | buildflow.prochat.tools HTTP 200 throughout | Integration test |

### ⚠️ Assumptions (Not Yet Proven)

| Assumption | Risk | Mitigation |
|-----------|------|-----------|
| **Dockerfile builds relay+web+proxy as required** | **CRITICAL** | **MUST verify in Phase 1.1 preflight: check commit 3473303, build GHCR image locally, verify all three services start** |
| Dokploy non-staging app can be reconfigured for production | Low | App exists, was previously tested; reconfiguring is low-risk |
| Production relay will handle all local agent connections | Medium | Test with production device tokens in Phase 2 |
| GPT actions will work through production relay | Medium | Test with real CustomGPT integration in Phase 3 |
| Local tunnel can be safely decommissioned after cutover | Low | Keep tunnel config until production proven; easy to re-enable |
| DEVICE_TOKEN env var will work for local agent → production relay | Low | Already proven with staging relay |
| Persistent volume at `/var/lib/buildflow` will be mounted correctly | Low | Can be verified during Dokploy app config; matches Dockerfile contract |

---

## Current-State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT PRODUCTION                        │
└─────────────────────────────────────────────────────────────┘

Internet
   ↓
Cloudflare DNS (buildflow.prochat.tools)
   ↓
Cloudflare Tunnel (warp.prochat.tools/buildflow)
   ↓
Local Mac Tunnel Client
   ↓
localhost:3054 (Next.js Web + Actions Proxy)
   ↓
   ├─→ localhost:3052 (Local Agent — CONNECTED TO STAGING RELAY)
   ├─→ localhost:3053 (Local Relay Bridge — NOT CONNECTED TO PRODUCTION YET)
   └─→ localhost:3055 (Web App Internal)

Dokploy Infrastructure (Standby)
   ├─ BuildFlow Staging (enij_FshYINrDID8QGpZX)
   │  └─ buildflow-staging.prochat.tools ✅ WORKING
   │
   └─ BuildFlow Non-Staging (BaxAt-F3ieLzkECClGjiE)
      └─ No domains attached (Standby for production)
```

---

## Target-State Architecture (Post-Cutover)

```
┌─────────────────────────────────────────────────────────────┐
│                    TARGET PRODUCTION                         │
└─────────────────────────────────────────────────────────────┘

Internet
   ↓
Cloudflare DNS (buildflow.prochat.tools)
   ↓
Dokploy Ingress / Cloudflare Tunnel to Dokploy Server
   ↓
Dokploy / OrbStack Container
   ├─→ localhost:3054 (Public Proxy Port)
   │    ├─→ localhost:3053 (Production Relay Bridge — INTERNAL)
   │    │    ├─ /api/register
   │    │    ├─ /api/bridge/ws (WebSocket)
   │    │    └─ /api/admin/*
   │    │
   │    └─→ localhost:3055 (Production Web App — INTERNAL)
   │         ├─ /api/actions/*
   │         ├─ /api/openapi
   │         └─ /
   │
   └─→ /var/lib/buildflow (Persistent Volume)

Local Mac (Remote Agent Mode — Optional)
   ├─ localhost:3052 (Local Agent)
   │  └─ BRIDGE_URL=https://buildflow.prochat.tools
   │     DEVICE_TOKEN=<production-device-token>
   │     ↓ WebSocket to production relay
   │
   └─ localhost:3053 (Local Relay) — DEPRECATED
```

---

## Cutover Phases

### Phase 1: Production Dokploy App Preparation

**Duration:** 1–2 hours  
**Risk Level:** LOW (no domain attachment yet)

#### 1.1 Prerequisites Checklist

**Preflight Verification (Execute before proceeding to 1.2):**

- [ ] **DOCKERFILE BUILD VERIFICATION (CRITICAL):**
  - [ ] Inspect commit 3473303: `git show 3473303:Dockerfile`
  - [ ] Verify Dockerfile includes relay service build and startup
  - [ ] Verify Dockerfile includes web service build and startup
  - [ ] Verify EXPOSE statements for ports 3053 (relay), 3054 (public proxy), 3055 (web)
  - [ ] Build GHCR image locally: `docker build -t buildflow:test .`
  - [ ] Verify image builds without errors
  - [ ] Run container locally and verify all three services start:
    - [ ] Relay listening on :3053
    - [ ] Proxy listening on :3054
    - [ ] Web listening on :3055

**Infrastructure Verification:**

- [ ] GHCR image `ghcr.io/stevewesthoek/buildflow:latest` is present and healthy
- [ ] Dokploy Web project exists (already exists)
- [ ] GHCR pull credentials configured in Dokploy (already configured)
- [ ] Production app non-staging BuildFlow (BaxAt-F3ieLzkECClGjiE) is in "done" status

#### 1.2 Configure Non-Staging BuildFlow Dokploy App for Production

**Actions (Read-only inspection then apply only if all checks pass):**

1. **Verify current state:**
   ```bash
   source ~/.config/dokploy/.env
   curl -s -X GET "https://dokploy.prochat.tools/api/application.one?applicationId=BaxAt-F3ieLzkECClGjiE" \
     -H "x-api-key: $DOKPLOY_API_KEY" | jq .
   ```

2. **Generate production environment variables:**
   ```
   NODE_ENV=production
   PORT=3054
   BRIDGE_PORT=3053
   WEB_PORT=3055
   RELAY_DATA_DIR=/var/lib/buildflow
   RELAY_ENABLE_DEFAULT_TOKENS=false
   BUILDFLOW_BACKEND_MODE=relay-agent
   RELAY_ADMIN_TOKEN=<generate-cryptographically-secure-64-char-token>
   ```

3. **Set environment variables in Dokploy app** (via dashboard or API):
   - `NODE_ENV=production`
   - `PORT=3054`
   - `BRIDGE_PORT=3053`
   - `WEB_PORT=3055`
   - `RELAY_DATA_DIR=/var/lib/buildflow`
   - `RELAY_ENABLE_DEFAULT_TOKENS=false`
   - `BUILDFLOW_BACKEND_MODE=relay-agent`
   - `RELAY_ADMIN_TOKEN=<generated-token>`

4. **Verify mount/volume:**
   - Ensure `/var/lib/buildflow` is mounted as persistent volume in Dokploy
   - Volume should survive container restarts

5. **Trigger redeploy** (if env vars changed):
   ```bash
   curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
     -H "x-api-key: $DOKPLOY_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"applicationId": "BaxAt-F3ieLzkECClGjiE"}'
   ```

#### 1.3 Verify Production App Health (Before Domain Attachment)

```bash
# Check container is running
ssh dokploy "docker ps | grep app-index-haptic-port-m88k9z"

# Check health endpoint
curl -I https://buildflow-staging.prochat.tools/health || \
  curl -I http://localhost:3054/health  # If accessible from local tunnel

# Check /ready
curl -I http://localhost:3054/ready

# Check relay is accessible internally
curl -I http://localhost:3053/api/admin/devices \
  -H "Authorization: Bearer $RELAY_ADMIN_TOKEN"
```

#### 1.4 Phase 1 Success Criteria

- [ ] Production app (non-staging BuildFlow) is in "done" status
- [ ] Environment variables set correctly
- [ ] Container is running and healthy
- [ ] /health endpoint returns 200
- [ ] /ready endpoint returns 200
- [ ] Relay is accessible at localhost:3053 with admin token
- [ ] **Production app still has NO domains attached** (crucial for safety)

---

### Phase 2: Register Production Device Tokens

**Duration:** 30 minutes  
**Risk Level:** LOW (no DNS changes yet)

#### 2.1 Register Production Device Tokens

Device tokens are client-provided (not server-generated). Generate them for production:

```bash
# Generate production device token (cryptographically secure, 64 hex chars)
PROD_DEVICE_TOKEN=$(openssl rand -hex 32)
echo "Production device token: $PROD_DEVICE_TOKEN"
# Store this securely (password manager, encrypted file, etc.)
# Do NOT commit to git or add to shell profile
```

#### 2.2 Register Token with Production Relay

```bash
# Register the token (requires relay to be accessible)
# Two options:

# Option A: Via local tunnel (if production not yet live)
curl -X POST https://buildflow.prochat.tools/api/register \
  -H "Content-Type: application/json" \
  -d "{\"deviceToken\":\"$PROD_DEVICE_TOKEN\"}"

# Option B: Via local container (if tunnel not available)
curl -X POST http://localhost:3054/api/register \
  -H "Content-Type: application/json" \
  -d "{\"deviceToken\":\"$PROD_DEVICE_TOKEN\"}"
```

**Response (expected):**
```json
{
  "status": "ok",
  "deviceId": "device-<timestamp>",
  "message": "Device registered successfully."
}
```

#### 2.3 Save Production Device Configuration

Create `~/.buildflow/production-device-config.json` (local, encrypted if possible):
```json
{
  "deviceId": "device-<timestamp>",
  "deviceToken": "STORED_SECURELY",
  "bridgeUrl": "https://buildflow.prochat.tools",
  "createdAt": "2026-04-28T...",
  "environment": "production",
  "status": "registered"
}
```

---

### Phase 3: Pre-Cutover Testing (Parallel Testing with Staging)

**Duration:** 2–4 hours  
**Risk Level:** LOW (Staging and production tested in parallel; no cutover yet)

#### 3.1 Test Production Device Token

```bash
# Before cutover, test the production token works
curl -X GET https://buildflow.prochat.tools/api/actions/status \
  -H "Authorization: Bearer $PROD_DEVICE_TOKEN"

# Expected: "Your device is not connected to the relay"
# (Device is registered but no agent connected yet)
```

#### 3.2 Test Local Agent Connection to Production Relay (Optional, Early Testing)

Can optionally test local agent connecting to production relay before DNS cutover:

```bash
# In a staging test session (not affecting production)
export BRIDGE_URL="https://buildflow.prochat.tools"
export DEVICE_TOKEN="$PROD_DEVICE_TOKEN"
export HOME="/tmp/buildflow-prod-test-$$"

# Create temp config with production device
mkdir -p "$HOME/.buildflow"
cat > "$HOME/.buildflow/config.json" << EOF
{
  "userId": "production-test",
  "deviceId": "device-<from-registration>",
  "deviceToken": "$PROD_DEVICE_TOKEN",
  "localPort": 3556,
  "vaultPath": "/Users/Office/Repos/stevewesthoek/buildflow"
}
EOF

# Start agent (will connect to production relay)
cd /Users/Office/Repos/stevewesthoek/buildflow/packages/cli
npx tsx src/index.ts serve

# In another terminal, verify device goes online
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | \
  jq '.devices[] | select(.deviceId == "device-<your-id>")'

# Expected: "isConnected": true, "status": "online"
```

#### 3.3 Phase 3 Success Criteria

- [ ] Production device token registered successfully
- [ ] Token validates at /api/actions/status endpoint
- [ ] Local agent can connect to production relay (offline→online transition) — **OPTIONAL EARLY TEST**
- [ ] Production relay health checks passing
- [ ] Local tunnel still serving buildflow.prochat.tools (unchanged)
- [ ] Staging relay still working (buildflow-staging.prochat.tools)

---

### Phase 4: DNS Cutover — Attach Production Domain to Dokploy App

**Duration:** 5–10 minutes  
**Risk Level:** MEDIUM (DNS change; PRODUCTION GOES LIVE; must be reversible within seconds)

#### 4.0 ⚠️ APPROVAL GATE (REQUIRED BEFORE PROCEEDING)

**DO NOT PROCEED to 4.1 unless ALL of the following are true:**

- [ ] **EXPLICIT TEAM APPROVAL:** BuildFlow team has reviewed this plan and explicitly approved Phase 4 cutover
- [ ] **Phase 3 Complete:** All Phase 3 tests passed and all success criteria met
- [ ] **Monitoring Ready:** Monitoring dashboard open and actively watched during Phase 4 and 5
- [ ] **Rollback Tested:** Rollback procedure (4.5 below) has been dry-run and verified to work
- [ ] **Communication Plan:** Team members notified and standing by for potential issues
- [ ] **Off-Peak Window:** Cutover scheduled during low-traffic time (document time and date)

**Who approves:** [Designate approver — e.g., "Steve Westhoek"]

#### 4.1 Pre-Cutover Checklist

- [ ] All Phase 3 tests passed
- [ ] Local tunnel is still running and operational
- [ ] Rollback procedure documented and tested
- [ ] Team is aware cutover is happening
- [ ] Monitoring is set up to catch immediate issues
- [ ] **Production buildflow.prochat.tools currently routing via local tunnel (CONFIRM before proceeding)**

#### 4.2 Cutover Steps

**OPTION A: Dokploy Dashboard (GUI)**
1. Open Dokploy dashboard
2. Navigate to BuildFlow non-staging app (BaxAt-F3ieLzkECClGjiE)
3. Add domain: `buildflow.prochat.tools`
4. Set path: `/`
5. Port: `3054` (container exposes this)
6. Save and deploy

**OPTION B: Dokploy API**
```bash
source ~/.config/dokploy/.env

# Add domain to production app
curl -s -X POST "https://dokploy.prochat.tools/api/domain.create" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "BaxAt-F3ieLzkECClGjiE",
    "host": "buildflow.prochat.tools",
    "path": "/",
    "https": true,
    "port": 3054,
    "domainType": "application"
  }' | jq .
```

#### 4.3 Cutover Verification (Immediate)

```bash
# Test 1: Domain still responds
curl -sS -I https://buildflow.prochat.tools/ | head -1
# Expected: HTTP/2 200 or HTTP/1.1 200

# Test 2: OpenAPI endpoint
curl -sS -I https://buildflow.prochat.tools/api/openapi | head -1
# Expected: HTTP/2 200

# Test 3: Production device token still works
curl -s -X GET https://buildflow.prochat.tools/api/actions/status \
  -H "Authorization: Bearer $PROD_DEVICE_TOKEN" | jq .
# Expected: "Device command failed" (agent may not be connected, but auth works)

# Test 4: Admin endpoint
curl -s -X GET https://buildflow.prochat.tools/api/admin/devices \
  -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" | jq . | head -20
# Expected: 200 OK with device registry
```

#### 4.4 Phase 4 Success Criteria

- [ ] buildflow.prochat.tools returns HTTP 200 (Dokploy route, not tunnel)
- [ ] /api/openapi responds HTTP 200
- [ ] Production device token still validates
- [ ] Admin token authentication working
- [ ] All responses under 1 second latency
- [ ] No errors in Dokploy app logs

---

### Phase 5: Verification and Stabilization

**Duration:** 30 minutes to 2 hours  
**Risk Level:** MEDIUM (Production live, but rollback available)

#### 5.1 Full Production Verification

```bash
# 1. Test read-only action endpoints
curl -s -X GET https://buildflow.prochat.tools/api/actions/sources \
  -H "Authorization: Bearer $PROD_DEVICE_TOKEN" | jq .

# 2. Test context endpoint
curl -s -X GET https://buildflow.prochat.tools/api/actions/context/active \
  -H "Authorization: Bearer $PROD_DEVICE_TOKEN" | jq .

# 3. Monitor logs for errors
ssh dokploy "docker logs app-index-haptic-port-m88k9z.1 | tail -50"

# 4. Check relay device registry
curl -s -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | jq .

# 5. Load test (optional, if monitoring permits)
for i in {1..10}; do
  curl -s -I https://buildflow.prochat.tools/ &
done; wait
```

#### 5.2 Monitor Key Metrics

- Response latency (should be <500ms)
- Error rate (should be 0% for successful requests)
- Device connection status (should remain stable)
- No restart loops

#### 5.3 Phase 5 Success Criteria

- [ ] All read-only endpoints responding correctly
- [ ] No errors in Dokploy app logs
- [ ] Device registry shows connected devices (if agents connected)
- [ ] Response times acceptable (<1s)
- [ ] No crashes or restarts observed

---

### Phase 6: Decommission Local Tunnel (Optional, After Stabilization)

**Duration:** Varies  
**Risk Level:** LOW (only after production proven stable for 24–48 hours)

#### 6.1 Stabilization Window

Wait 24–48 hours after cutover before decommissioning local tunnel:
- Observe production relay behavior
- Confirm no issues arise over time
- Monitor error rates and latency

#### 6.2 Decommission Procedure

```bash
# BACKUP: Save tunnel configuration first
cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup-2026-04-28

# Stop tunnel
pkill cloudflared

# Verify buildflow.prochat.tools still works (should use Dokploy now)
curl -I https://buildflow.prochat.tools/
# Expected: HTTP 200 (from Dokploy, not tunnel)

# If everything still works after 5–10 minutes, tunnel is no longer needed
# Remove from shell profile or cron if it was being auto-started
```

#### 6.3 Decommission Success Criteria

- [ ] buildflow.prochat.tools still responds HTTP 200 (after tunnel stopped)
- [ ] All endpoints still working
- [ ] No errors observed in Dokploy logs
- [ ] No manual intervention required

---

## Rollback Plan

### Rollback Trigger (When to Roll Back)

Initiate rollback **immediately** if **any** of these occur:
- Production endpoint returns HTTP 5xx consistently (>1% error rate)
- Response latency >2 seconds for >5 consecutive requests (after allowing 30 seconds warm-up)
- Device connection drops unexpectedly or fails to restore within 5 minutes
- Relay logs show repeated errors (sync to CloudWatch or equivalent)
- CustomGPT actions fail to reach agents
- Dokploy app enters restart loop
- Domain cutover causes DNS failures for users

### Rollback Procedure

#### Decision Point: Why Did Rollback Trigger?

**Scenario A: Dokploy App Won't Start (Pre-Domain Cutover)**
- If triggered during Phase 4 cutover before domain attachment completes:
  - Restart app: `curl -s -X POST "https://dokploy.prochat.tools/api/application.restart" ...`
  - If restart fails, roll back to Phase 1 and troubleshoot in staging environment
  - **Do NOT attach domain until app is stable**

**Scenario B: Production Relay Misbehaving (Post-Domain Cutover)**
- If triggered immediately after domain attachment:
  - Keep app running (investigate issue)
  - Execute quick rollback (see below)
  - Move to troubleshooting (see end of section)

**Scenario C: DNS Propagation Issues**
- If users report buildflow.prochat.tools timeouts or mixed responses (some via tunnel, some via Dokploy):
  - Domain cutover succeeded but DNS not fully propagated
  - Execute quick rollback to restore tunnel uniformity
  - Wait 30 minutes and retry with DNS verification

#### Quick Rollback (Within 5 minutes) — Remove Domain Only

**If Dokploy domain is attached and causing issues:**

```bash
source ~/.config/dokploy/.env

# 1. Get domain ID for buildflow.prochat.tools on the production app
curl -s -X GET "https://dokploy.prochat.tools/api/application.one?applicationId=BaxAt-F3ieLzkECClGjiE" \
  -H "x-api-key: $DOKPLOY_API_KEY" | jq '.domains[] | select(.host == "buildflow.prochat.tools") | .domainId'

# 2. Remove the domain (replace <domain-id> with result from above)
curl -s -X POST "https://dokploy.prochat.tools/api/domain.delete" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domainId": "<domain-id-from-above>"}' | jq .

# 3. Restart local tunnel (if stopped)
/opt/homebrew/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run &

# 4. Verify tunnel is now serving (wait 10 seconds for DNS to stabilize)
sleep 10
curl -I https://buildflow.prochat.tools/
# Expected: HTTP 200 from local tunnel (confirm you're not hitting cached DNS)
```

#### Production Relay Keep Running (Troubleshooting Path)

If rollback is triggered but production relay is otherwise stable (logs show specific, fixable errors):
1. **Execute quick rollback** (remove domain) — this restores user traffic to tunnel
2. **Keep Dokploy production app running** (investigate issue offline)
3. **Keep device tokens registered** (they're still valid for next attempt)
4. **Keep persistent volume** (data is safe, use for analysis)
5. **Troubleshoot in staging environment** (mirror production config to staging app, test fix)
6. **Re-attempt cutover** only after fix is verified in staging

#### If Rollback Fails (Emergency Recovery)

**If domain deletion doesn't immediately restore tunnel:**

1. Stop any background processes that might be interfering:
   ```bash
   pkill -f "cloudflared"
   sleep 2
   ```

2. Manually restart tunnel with full verbosity:
   ```bash
   /opt/homebrew/bin/cloudflared tunnel --config ~/.cloudflared/config.yml run --loglevel debug
   ```

3. In another terminal, verify tunnel is active:
   ```bash
   curl -v https://buildflow.prochat.tools/ 2>&1 | head -20
   ```

4. If tunnel still not responding:
   - Check local services are running: `curl -I http://localhost:3054/`
   - Check network: `ping prochat.tools`
   - Escalate to infrastructure team with exact error

#### Post-Rollback Steps

**After rollback is executed and verified (tunnel restored):**

1. **Document what went wrong** — add entry to this rollback section for future reference
2. **Preserve logs** — save Dokploy app logs before restarting or inspecting
3. **Notify team** — communicate rollback to stakeholders with brief explanation
4. **Schedule retry** — only after root cause identified and fix verified in staging
5. **Keep app running** — production app remains in Dokploy for quick re-cutover attempt

---

## Infrastructure Changes Required

### Changes to Dokploy Non-Staging BuildFlow App

| Change | Current | Target | Method |
|--------|---------|--------|--------|
| **Domains** | [] | ["buildflow.prochat.tools"] | Add domain via API or dashboard |
| **Environment variables** | 0 set | 8 set (NODE_ENV, BRIDGE_PORT, etc.) | Set via Dokploy app settings |
| **Port** | 3054 (already) | 3054 (unchanged) | No change needed |
| **Image** | ghcr.io/stevewesthoek/buildflow:latest | ghcr.io/stevewesthoek/buildflow:latest | No change (auto-updated) |
| **Volume** | None mounted | /var/lib/buildflow mounted | Create and mount persistent volume |

### Changes to Local Agent

| Change | Current | Target | Method |
|--------|---------|--------|--------|
| **BRIDGE_URL** | Optional (points to localhost:3053) | Required (points to https://buildflow.prochat.tools) | Set env var before agent start |
| **DEVICE_TOKEN** | Production token from config | Production token from secure storage | Env var or new config entry |
| **Port** | 3052 | 3052 (unchanged) | No change |

### Changes to Cloudflare / DNS

| Change | Current | Target | Method |
|--------|---------|--------|--------|
| **buildflow.prochat.tools DNS** | A → Cloudflare Tunnel → localhost:3054 | CNAME → Dokploy.prochat.tools (or similar) | DNS update (managed by Dokploy) |
| **Local Tunnel** | Active and routing traffic | Deactivated (after stabilization) | Stop cloudflared process |

---

## Device Token Management

### Production Device Token Generation

Device tokens are **client-provided**, not server-generated:

```bash
# Generate a production device token (64 hex characters, cryptographically secure)
PROD_DEVICE_TOKEN=$(openssl rand -hex 32)

# Register it with the production relay
curl -X POST https://buildflow.prochat.tools/api/register \
  -H "Content-Type: application/json" \
  -d "{\"deviceToken\":\"$PROD_DEVICE_TOKEN\"}"

# Response: { "deviceId": "device-<timestamp>", ... }
```

### Local Agent Configuration

For local agent to connect to production relay:

```bash
# Set environment variables before starting agent
export BRIDGE_URL="https://buildflow.prochat.tools"
export DEVICE_TOKEN="<production-device-token>"

# Start agent (will connect to production relay)
cd ~/Repos/stevewesthoek/buildflow/packages/cli
npx tsx src/index.ts serve
```

The agent will:
1. Read the env vars
2. Start local HTTP server on port 3052
3. Connect WebSocket to `https://buildflow.prochat.tools/api/bridge/ws`
4. Send DEVICE_TOKEN in WebSocket upgrade handshake
5. Relay will authenticate and mark device as "online"

---

## Verification Procedures

### Pre-Cutover Verification

```bash
# 1. Dokploy app is healthy
curl -I http://localhost:3054/ready

# 2. Local tunnel still works
curl -I https://buildflow.prochat.tools/
# Expected: HTTP 200

# 3. Staging relay still works
curl -I https://buildflow-staging.prochat.tools/
# Expected: HTTP 200

# 4. Production device token validates
curl -I https://buildflow.prochat.tools/api/actions/status \
  -H "Authorization: Bearer $PROD_DEVICE_TOKEN"
# Expected: HTTP 200 or operational error (not 401)
```

### Post-Cutover Verification

```bash
# 1. DNS cutover successful
curl -I https://buildflow.prochat.tools/
# Expected: HTTP 200 from Dokploy (not tunnel)

# 2. All endpoints working
for endpoint in / /api/openapi /health /ready /api/admin/devices; do
  curl -sI "https://buildflow.prochat.tools$endpoint" | head -1
done

# 3. Local agent can connect to production relay
# (Run test from local terminal)
export BRIDGE_URL="https://buildflow.prochat.tools"
export DEVICE_TOKEN="$PROD_DEVICE_TOKEN"
# Start agent in temp config (as described in Phase 3.2)
# Verify device goes online in /api/admin/devices

# 4. GPT actions reach agent
# (Manual test: run a BuildFlow action from CustomGPT)
```

### Ongoing Monitoring

```bash
# Relay health
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | jq .

# Connected devices
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | \
  jq '.devices[] | select(.isConnected == true)'

# Error logs
ssh dokploy "docker logs <container-name> | grep -i error | tail -20"
```

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **DNS propagation delay** | 5–10% of users may hit old tunnel briefly | Medium | Keep tunnel running for 24h after cutover; test DNS before cutover |
| **Dokploy app crashes** | Production offline; GPT actions fail | Low | Redeploy immediately; rollback to tunnel within <1 min |
| **WebSocket connection fails** | Agents can't connect to relay | Low | Verify WebSocket in Phase 2; test with staging relay first |
| **Device token registration fails** | Can't onboard new agents | Low | Test token registration in Phase 2 |
| **Persistent volume unmounted** | Relay data lost on restart; tokens ephemeral | Low | Verify volume mount before cutover; monitor for lost devices |
| **Latency increase** | User experience degrades | Low | Monitor response times during Phase 5 |
| **Routing errors in proxy** | Some endpoints unreachable | Low | Test all endpoints in Phase 3; verify proxy routing |

---

## Go/No-Go Checklist

### ⚠️ REMINDER: Phase 1-3 Do NOT Cutover Production

**Important:** Completing Phase 1, 2, or 3 does NOT cutover production traffic. Production remains served by the local Cloudflare tunnel throughout Phases 1–3. Phase 4 is where production traffic is switched to Dokploy. Phase 4 requires explicit team approval before proceeding.

### Go Criteria (All must be true to proceed to next phase)

**Before Phase 1:**
- [ ] Dockerfile build proven (commit 3473303)
- [ ] GHCR image exists and is healthy
- [ ] Dokploy non-staging app exists and is in "done" status

**Before Phase 2:**
- [ ] Production app health checks passing (/ready, /health)
- [ ] Relay accessible via admin token
- [ ] Container logs show no errors

**Before Phase 3:**
- [ ] Device token successfully registered
- [ ] Token validates at /api/actions/status
- [ ] Staging relay still working as baseline

**Before Phase 4 (DNS Cutover):**
- [ ] All Phase 3 tests passed
- [ ] Local tunnel still operational
- [ ] Rollback procedure tested and documented
- [ ] Team is ready and monitoring

**Before Phase 5:**
- [ ] buildflow.prochat.tools returns HTTP 200
- [ ] No errors in Dokploy logs immediately after cutover
- [ ] All endpoints responding

**Before Phase 6 (Decommission Tunnel):**
- [ ] 24–48 hours of stable production operation
- [ ] Zero unexpected restarts or errors
- [ ] Device connections stable

### No-Go Criteria (Any trigger immediate rollback to Phase 1)

- [ ] Dokploy app fails to start
- [ ] Health checks return HTTP 5xx
- [ ] Relay logs show repeated errors
- [ ] Device connection drops unexpectedly
- [ ] Response latency >2 seconds
- [ ] CustomGPT actions failing

---

## Important Guidance

### ⚠️ CRITICAL: Infrastructure Preservation

**DO NOT DELETE, STOP, OR DISABLE:**

1. **Local Cloudflare tunnel** 
   - Status: Active throughout Phase 1–5
   - Purpose: Rollback option for any production issues
   - Decommission: Only after 48 hours post-Phase-5 stabilization with explicit approval
   - Reason: If Dokploy production relay fails, tunnel provides immediate fallback

2. **Non-staging Dokploy BuildFlow app (BaxAt-F3ieLzkECClGjiE)**
   - Status: Production app (after Phase 4)
   - Purpose: Serves production traffic after cutover
   - Keep indefinitely: This app is now production
   - Reason: This is the production service; do not delete

3. **Staging Dokploy BuildFlow app (enij_FshYINrDID8QGpZX)**
   - Status: Staging environment
   - Purpose: Testing and validation
   - Keep indefinitely: Used for future staging tests and rollback validation
   - Reason: Separate staging environment remains valuable

4. **Local relay (port 3053)**
   - Status: Optional (can run locally for development)
   - Purpose: Local testing and debugging
   - Keep running if: You plan to test local agent changes
   - Disable only if: Explicitly no longer needed for local development

5. **Local agent setup**
   - Status: Keep ability to run locally
   - Purpose: Agent debugging, custom token testing, local development
   - Keep maintained: Local agent remains part of development toolkit

### ✅ DO PROCEED TO NEXT PHASE ONLY IF

- Current phase all go-criteria met
- Previous phase testing validated
- No unexpected errors observed
- Team approval obtained

---

## Timeline

| Phase | Duration | Risk | Status |
|-------|----------|------|--------|
| Phase 1: Dokploy App Prep | 1–2 hours | LOW | Ready |
| Phase 2: Device Tokens | 30 min | LOW | Ready |
| Phase 3: Pre-Cutover Testing | 2–4 hours | LOW | Ready |
| Phase 4: DNS Cutover | 5–10 min | MEDIUM | Requires approval |
| Phase 5: Verification | 30 min–2 hours | MEDIUM | Requires approval |
| Phase 6: Decommission Tunnel | 1–2 days | LOW | Deferred 48+ hours |
| **Total Time to Production** | **~6–10 hours** | | |
| **Total Time to Full Decommission** | **2–3 days** | | |

---

## What Staging Success Means (And Doesn't Mean)

### ✅ Staging Relay Tests Proved

- Local agent can successfully connect to a Dokploy-hosted relay via WebSocket
- Device token authentication works end-to-end
- Bearer token validation is enforced at API endpoints
- Relay request routing to connected agents works
- Device state management (offline↔online transitions) works
- Production infrastructure remained unaffected during staging tests

### ⚠️ Staging Success Does NOT Guarantee

- That production relay will handle 100% of traffic (stress testing not completed)
- That GPT actions will work correctly (not tested with CustomGPT yet)
- That persistent volume will survive production workload (tested with empty state only)
- That latency will be acceptable (staging latency != production latency)
- That all edge cases are handled (staging tests basic happy path)
- That production is "ready to go" (Phase 1-3 are prerequisites; Phase 4 is the actual cutover)

### Production Readiness Requires

- Phase 1 complete: Dockerfile verified, app configured, health checks passing
- Phase 2 complete: Production device tokens registered and validated
- Phase 3 complete: Pre-cutover tests all passing, local tunnel still operational
- Phase 4 approval: Explicit team approval before DNS cutover
- Phase 5 stabilization: 30+ minutes of monitoring after cutover

---

## Next Actions (After Plan Review)

1. **Review this plan:** BuildFlow team reviews all phases, risks, and rollback procedures
2. **Get approval:** Team sign-off on risk profile, timeline, and infrastructure preservation
3. **Execute Phase 1 preflight:** Run Dockerfile build verification checklist (section 1.1)
   - Do NOT proceed to 1.2 until Dockerfile verification is complete
   - Verify commit 3473303 builds correctly
   - Verify all three services start (relay, web, proxy)
4. **Schedule Phase 1–3 window:** Plan 6–10 hours for Phases 1–3 (preparatory work)
5. **Schedule Phase 4 approval meeting:** 30 minutes before Phase 4 cutover window
   - Confirm all Phase 3 criteria met
   - Get final team approval to proceed to DNS cutover
   - Confirm monitoring is ready
6. **Prepare Phase 4 cutover window:** Off-peak hours preferred (document exact time)
   - Schedule monitoring team standby
   - Have rollback procedure open and rehearsed
   - Set 2-hour Phase 5 stabilization window after cutover

---

## Report Metadata

- **Document Status:** PLANNING PHASE — Ready for review
- **Last Updated:** 2026-04-28
- **Related Documents:** 
  - `buildflow-staging-agent-relay-integration-test-report.md` (proven facts)
  - `buildflow-dockerfile-contract.md` (Dockerfile requirements)
  - `buildflow-migration-plan.md` (high-level phases)
- **Files Modified:** None (documentation only)
- **Infrastructure Changes:** None yet (planning only)
- **Secrets Exposed:** None
