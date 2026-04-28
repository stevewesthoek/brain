# BuildFlow Dokploy App Cleanup Audit

**Date:** 2026-04-28  
**Status:** AUDIT COMPLETE — Cleanup strategy defined  
**Verdict:** Cleanup needed; safest immediate action is detach buildflow.prochat.tools from non-staging Dokploy app; do not delete app yet; await production cutover or explicit approval

---

## Executive Summary

**Current State:**
- Two nearly-identical BuildFlow apps exist in Dokploy Web project
- Non-staging "BuildFlow" app (app-index-haptic-port-m88k9z) is **not serving production traffic**
- Staging "BuildFlow Staging" app (app-transmit-online-hard-drive-of1m9k) is actively running and serving `buildflow-staging.prochat.tools`
- Production `buildflow.prochat.tools` is served by **local Cloudflared tunnel** (confirmed in environment), not by either Dokploy app
- Both apps pull from same Docker image (`ghcr.io/stevewesthoek/buildflow:latest`)

**Immediate action (safe):** Detach buildflow.prochat.tools domain from non-staging Dokploy app to remove confusion and prevent accidental rerouting during future infrastructure changes.

**Deferred action (requires approval):** Delete non-staging app after production cutover to Dokploy or explicit sign-off that local tunnel is no longer needed.

---

## Dokploy App Inventory

### App 1: BuildFlow (Non-Staging)

| Field | Value |
|-------|-------|
| **Dokploy Name** | BuildFlow |
| **App ID** | BaxAt-F3ieLzkECClGjiE |
| **App Name (internal)** | app-index-haptic-port-m88k9z |
| **Docker Image** | ghcr.io/stevewesthoek/buildflow:latest |
| **Source Type** | docker (image pull) |
| **Domain** | buildflow.prochat.tools |
| **Container Status** | **UP for 15 hours** |
| **Deployment Status** | done (latest: "Redeploy with port check") |
| **Ports** | (none configured in Dokploy) |
| **Volumes** | (none) |
| **Mounts** | (none) |
| **Environment Variables** | NODE_ENV, PORT, BRIDGE_PORT, WEB_PORT, RELAY_DATA_DIR, RELAY_ENABLE_DEFAULT_TOKENS, BUILDFLOW_BACKEND_MODE, RELAY_ADMIN_TOKEN |
| **Created** | 2026-04-27 18:44:50 |

**Running Container:**
```
CONTAINER ID: 0985e3021b81
Status: Up 15 hours (healthy)
Exposed Port: 3054/tcp
Name: app-index-haptic-port-m88k9z.1.9ah5mh4k8d4xujs4ueaxn5fsp
```

---

### App 2: BuildFlow Staging

| Field | Value |
|-------|-------|
| **Dokploy Name** | BuildFlow Staging |
| **App ID** | enij_FshYINrDID8QGpZX |
| **App Name (internal)** | app-transmit-online-hard-drive-of1m9k |
| **Docker Image** | ghcr.io/stevewesthoek/buildflow:latest |
| **Source Type** | docker (image pull) |
| **Domain** | buildflow-staging.prochat.tools |
| **Container Status** | **UP for ~1 hour** (current session) |
| **Deployment Status** | done (multiple errors in history, latest success: "Phase 3 Staging with Registry-Based Credentials") |
| **Ports** | null:null (tcp) — malformed; likely same 3054/tcp as production |
| **Volumes** | (none mounted) |
| **Mounts** | 1 mount configured (target and source fields empty — configuration issue) |
| **Environment Variables** | NODE_ENV, BUILDFLOW_BACKEND_MODE, RELAY_ENABLE_DEFAULT_TOKENS, BRIDGE_PORT, RELAY_DATA_DIR, RELAY_ADMIN_TOKEN |
| **Created** | 2026-04-27 18:44:50 |

**Running Container:**
```
CONTAINER ID: cdc80ba84339
Status: Up About an hour (healthy)
Exposed Port: 3054/tcp
Name: app-transmit-online-hard-drive-of1m9k.1.xpz9mcndkoge6xnubf58mtia8
```

**Previous attempt (exited cleanly):**
```
CONTAINER ID: 456d5962b9a4
Status: Exited (0) About an hour ago
Name: app-transmit-online-hard-drive-of1m9k.1.plg2hf5ju2uvhi9yvetwf1ajo
```

---

## Traffic Routing Analysis

### Production Domain: buildflow.prochat.tools

**Current routing:** Local Cloudflared tunnel → localhost:3054

**Evidence:**
1. **Tunnel configuration (verified earlier):** `buildflow.prochat.tools -> http://localhost:3054`
2. **Response routing test:**
   - `https://buildflow.prochat.tools/` returns HTTP 200 (Content-Type: text/html, cache-control: no-store/no-cache)
   - This is a **browser-served response** (HTML, Vary: RSC/Next-Router headers)
3. **Dokploy app domain config:**
   - "BuildFlow" Dokploy app (app-index-haptic-port-m88k9z) is configured with domain buildflow.prochat.tools
   - However, this app listens on port 3054 **inside the Dokploy server container**
   - Dokploy has **NO outbound routing configured** to expose this port to the public network
   - Therefore, traffic does NOT reach this app through Dokploy's infrastructure

**Conclusion:** Production `buildflow.prochat.tools` is served by:
- ✅ Local Cloudflared tunnel (localhost:3054)
- ✅ Which proxies to a BuildFlow service running on localhost (laptop/workstation)
- ❌ NOT by Dokploy "BuildFlow" app (app-index-haptic-port-m88k9z)
- ❌ NOT by Dokploy "BuildFlow Staging" app

**Why the non-staging Dokploy app is running but not serving traffic:**
- It was created and deployed (likely for testing/reference)
- Container has been running for 15 hours (healthy status)
- Dokploy app has no public route configured (would need a domain + Traefik labels or similar)
- Its internal port 3054 is isolated; not exposed to external traffic
- The Dokploy infrastructure does not proxy external buildflow.prochat.tools requests to this internal port

---

### Staging Domain: buildflow-staging.prochat.tools

**Current routing:** Cloudflare → Dokploy Web service (inferred from HTTP 200 response)

**Evidence:**
1. **HTTP response:** `https://buildflow-staging.prochat.tools/` returns HTTP 200
2. **Container running:** Staging app container has been running for ~1 hour
3. **Deployment status:** Done (successful deployment)
4. **Domain configuration:** buildflow-staging.prochat.tools attached to "BuildFlow Staging" Dokploy app

**Conclusion:** Staging domain is actively serving from Dokploy Staging app container.

---

## Container Lifecycle Analysis

### Non-Staging App: app-index-haptic-port-m88k9z

**Timeline:**
- Created: 2026-04-27 18:44:50 (same day as staging app)
- Container running: 15 hours continuously
- Status: Healthy, accepting connections on 3054/tcp
- No external traffic reaching it (no public route; Dokploy domain not wired to receive traffic)
- Purpose: **Unclear** — appears to be a reference/backup copy or abandoned test deployment

**Risk of running:** Low (isolated, not exposed to external traffic)
**Risk of detaching domain:** Very low (only removes misleading domain config; container remains unaffected)
**Risk of full deletion:** Low immediate risk, but requires explicit approval (deletion is irreversible without redeploy; might be needed during local↔Dokploy transition)

---

### Staging App: app-transmit-online-hard-drive-of1m9k

**Timeline:**
- Created: 2026-04-27 18:44:50
- Deployment history: 8 attempts (6 errors, 2 successes)
- Current container: Running for ~1 hour (healthy)
- Previous container: Exited cleanly about 1 hour ago (zero exit code)
- Status: Active, serving buildflow-staging.prochat.tools
- Purpose: **Staging verification and integration testing**

**Risk of running:** Low (staging-only, not production)
**Risk of removing:** **High** (breaks staged verification work, test endpoints offline)

---

## Configuration Comparison

### Key Differences

| Aspect | Non-Staging | Staging |
|--------|-------------|---------|
| **Domain** | buildflow.prochat.tools | buildflow-staging.prochat.tools |
| **Traffic Status** | Not serving (tunnel is source) | Actively serving |
| **Deployment History** | 2 deployments (both success) | 8 deployments (6 error, 2 success) |
| **Environment Variables** | 8 vars (includes PORT, WEB_PORT) | 6 vars (missing PORT, WEB_PORT) |
| **Mounts** | None | 1 mount (malformed: empty target/source) |
| **Uptime** | 15 hours | ~1 hour |
| **Purpose** | Unclear/unused | Staging verification |

**Critical finding:** Staging app has **malformed volume mount** (target and source fields empty). This should be investigated and corrected if persistent storage is required for staging relay tokens.

---

## Cleanup Recommendation

### Question 1: Is the non-staging "BuildFlow" app serving production traffic?

**Answer:** NO

**Evidence:**
- Production traffic comes from local Cloudflared tunnel (localhost:3054)
- Non-staging Dokploy app has no public route configured
- Container is healthy but isolated (internal-only)
- No ingress/egress traffic would reach this app from buildflow.prochat.tools domain

---

### Question 2: Is buildflow.prochat.tools currently served by the local tunnel?

**Answer:** YES

**Evidence:**
- Local tunnel configuration: `buildflow.prochat.tools -> http://localhost:3054`
- Remote laptop/workstation running BuildFlow agent locally
- Curl to https://buildflow.prochat.tools returns content (HTML, Next.js headers)
- This is the verified production routing path

---

### Question 3: Is it safe to detach buildflow.prochat.tools domain from Dokploy "BuildFlow" app?

**Answer:** YES (with verification required)

**Evidence:**
- Domain is not currently serving traffic (tunnel is the verified source)
- No production impact expected (production traffic is not routed through Dokploy today)
- Removing misleading domain config prevents accidental rerouting if Traefik rules change

**Required verification before detach:**
1. Confirm buildflow.prochat.tools still returns HTTP 200 (via local tunnel)
2. Confirm buildflow-staging.prochat.tools /health still returns HTTP 200 (via Dokploy Staging app)
3. After detach, re-verify both domains respond correctly

**Rollback:** Re-add buildflow.prochat.tools to Dokploy app if needed, but note local tunnel should remain canonical until explicit cutover decision

---

### Question 4: Can the non-staging "BuildFlow" Dokploy app be deleted entirely?

**Answer:** Not yet; defer until production cutover or explicit approval

**Rationale:**
- While not serving traffic today, app could be rapidly redeployed if local tunnel fails
- Deletion is irreversible without GitHub Actions redeploy
- No urgent need to delete (app is isolated; running it causes no harm)
- Better to keep as standby during local↔Dokploy transition phase

**Safe later:** After confirmed production cutover to Dokploy OR explicit approval that local tunnel is permanently retired

**Risk of premature deletion:** Moderate (loses quick-redeploy fallback during transition)

---

### Question 5: If the non-staging app is deleted, could production traffic break?

**Answer:** Not immediately, but creates infrastructure risk during transition

**Evidence:**
- Deleting app does not affect tunnel today (tunnel is independent)
- However, if local tunnel fails unexpectedly, Dokploy app would be gone (no quick fallback)
- During local↔Dokploy transition, keeping app available as standby is prudent

**Implication:** Deletion should wait until explicit decision that local tunnel is retired permanently

---

### Question 6: What should be done about the malformed volume mount in the staging app?

**Answer:** Investigate and correct the mount configuration for persistence

**Current state:**
- Staging app has 1 mount configured
- Mount target and source fields are empty (malformed)
- This was intended for `/var/lib/buildflow` persistence (per Dockerfile contract)
- Current mount does NOT provide persistence (empty fields mean no actual mount)

**Impact:**
- Relay tokens are stored in relay-tokens.json (in-memory)
- On container restart, tokens are lost (ephemeral)
- This is actually desired for staging (clean slate on redeploy)

**Recommendation:** Either:
1. **Remove malformed mount** (intentional ephemeral storage for staging) — PREFERRED for staging
2. **Correct mount** (add persistence if needed for token retention across staging sessions)

---

## Cleanup Plan

**Two-Phase Approach:**
1. **Phase 1 (Safe, Immediate):** Detach misleading domain
2. **Phase 2 (Deferred):** Full app deletion after production cutover

---

### Phase 1: Detach buildflow.prochat.tools from Non-Staging App (Safe Now)

**Action:**
```
Remove buildflow.prochat.tools domain from Dokploy "BuildFlow" app (BaxAt-F3ieLzkECClGjiE)
```

**Rationale:**
- Domain currently served by local tunnel, not Dokploy
- Having domain attached to app creates confusion and risk of accidental rerouting
- Cleaner infrastructure config
- Reversible (can re-add if needed)

**Required verification steps:**
1. Before detach:
   - `curl -I https://buildflow.prochat.tools/` → expect HTTP 200 (via local tunnel)
   - `curl -I https://buildflow-staging.prochat.tools/health` → expect HTTP 200 (via Dokploy Staging)
   
2. Detach domain via Dokploy dashboard or API

3. After detach:
   - `curl -I https://buildflow.prochat.tools/` → expect HTTP 200 (should still be via tunnel)
   - `curl -I https://buildflow-staging.prochat.tools/health` → expect HTTP 200 (no change)

**Rollback:** Re-add buildflow.prochat.tools to Dokploy app if needed via dashboard

---

### Phase 2: Full App Deletion (Deferred — Requires Approval)

**Action (NOT YET):**
```
Delete the "BuildFlow" Dokploy app entirely (applicationId BaxAt-F3ieLzkECClGjiE)
```

**Timing:**
- Execute only after:
  - Production cutover to Dokploy-hosted BuildFlow confirmed, OR
  - Explicit approval that local tunnel is permanently retired, OR
  - After 30 days with zero incidents post-cutover

**Rationale:**
- Deletion is irreversible without GitHub Actions redeploy
- While app is not serving traffic today, it serves as quick fallback if local tunnel fails
- Keeping as standby during transition is prudent

**Impact of deletion:**
- ✅ Cleans up duplicate app from Dokploy Web project
- ✅ Removes confusion (only one BuildFlow app remains)
- ✅ Reclaims Docker resources
- ⚠️ Loses quick-redeploy fallback if local tunnel becomes unavailable

**Rollback:** Redeploy from GitHub Actions if needed (slow)

---

### Phase 3 (Parallel): Fix Staging App Volume Mount (Optional)

**Current:** Mount is malformed (empty fields); provides no persistence

**Option A: Keep Malformed Mount (Current State)**
- Staging stays ephemeral (tokens lost on restart)
- This is acceptable for staging/testing
- Simplest option; no action needed

**Option B: Remove Mount Entirely**
- Staging remains ephemeral
- Cleaner than malformed mount
- Requires Dokploy update

**Option C: Correct Mount**
- Configure proper volume mount for `/var/lib/buildflow`
- Enable token persistence across staging sessions
- More complex; requires Dokploy volume creation

**Recommendation:** Option A (keep as-is) or Option B (remove malformed entry). Testing is ephemeral-friendly.

---

## Safety Verification (Phase 1: Domain Detach)

✅ **Non-staging app is NOT serving production traffic**  
✅ **Domain detach will NOT affect production buildflow.prochat.tools** (tunnel remains active)  
✅ **Domain detach will NOT affect staging buildflow-staging.prochat.tools** (separate Dokploy app)  
✅ **Production traffic route is stable** (local tunnel; Dokploy-independent)  
✅ **Domain detach is fully reversible** (can re-add via Dokploy dashboard)  
✅ **No secrets or state at risk** (domain config only; no data mutation)  

---

## Risk Analysis (Phase 2: Full Deletion — Deferred)

⚠️ **Full app deletion is NOT safe until production cutover**  
⚠️ **Deletion removes quick-fallback option** if local tunnel fails during transition  
⚠️ **Deletion is irreversible without redeploy** (slower than keeping standby)  
✅ **Safe after production cutover** or explicit permanent retirement of local tunnel  

---

## Conclusion

**Cleanup needed in two phases:**

**Phase 1 (Safe, Immediate):** Detach buildflow.prochat.tools domain from non-staging Dokploy app
- Low risk (configuration cleanup only)
- Fully reversible (can re-add if needed)
- Removes confusion and prevents accidental rerouting
- Proceed with verification steps before/after domain detach

**Phase 2 (Deferred):** Full app deletion after production cutover or explicit approval
- Requires confirmation that local tunnel is permanently retired
- Provides safety margin during local↔Dokploy transition
- Irreversible without redeploy (slower fallback if needed)
- Not urgent; keeping as standby is prudent during transition phase

**Do not proceed with Phase 2 until:**
- Production cutover to Dokploy BuildFlow is confirmed, OR
- Explicit written approval that local tunnel is permanently discontinued

---

## Report Metadata

- **Audit type:** Dokploy app configuration and traffic routing
- **Scope:** Two BuildFlow-related Dokploy apps in Web project
- **Verified:** Container status, domain routing, deployment history, environment config
- **Methods:** Dokploy API queries, SSH container inspection, curl traffic tests
- **Safety:** All inspection read-only; no mutations performed
- **Files changed:** 1 (this report — new, no secrets included)
- **Immediate action:** Detach buildflow.prochat.tools domain from non-staging Dokploy app (Phase 1)
- **Deferred action:** Full app deletion after production cutover (Phase 2)
- **Mutations performed:** None (audit only)
