# BuildFlow Staging Option A Routing — Blocker Report

**Status:** BLOCKED — DNS CONFIGURED, BUT STAGING CONTAINER NOT RUNNING

**Date:** 2026-04-28  
**Action:** Completed DNS configuration for Option A (CNAME routing). Discovered critical blocker: Dokploy staging app container is not deployed/running.

---

## Summary

Option A DNS configuration was successfully implemented:
- ✓ Created `buildflow-staging.prochat.tools` DNS record (CNAME to `dokploy.prochat.tools`)
- ✓ DNS propagated and resolves to Cloudflare IPs
- ✓ Production `buildflow.prochat.tools` unaffected (HTTP 200, still works)

**Critical blocker discovered:**
- ✗ Dokploy staging app container (app ID `enij_FshYINrDID8QGpZX`) is NOT deployed/running
- ✗ Volume `buildflow-data-staging` exists but container is not running
- ✗ Endpoints return HTTP 404 because the app doesn't exist on Dokploy
- ✗ Unable to proceed with endpoint verification until container is deployed

---

## DNS Configuration (Completed Successfully)

### Record Created

| Field | Value |
|-------|-------|
| **Domain** | buildflow-staging.prochat.tools |
| **Record Type** | CNAME |
| **Target** | dokploy.prochat.tools |
| **TTL** | 3600 |
| **Proxied** | true (via Cloudflare) |
| **Record ID** | 606293bd5e254fe72852e403eb19a93e |
| **Zone ID** | f631c147ed11f27c23c237b52b21f43b (prochat.tools) |

### DNS Verification

```bash
$ dig +short buildflow-staging.prochat.tools
104.21.60.98
172.67.195.132
```

**Status:** ✓ DNS resolves correctly to Cloudflare IPs (via CNAME chain)

### Routing Model Details

**Option A Implementation (DNS + Cloudflare Tunnel):**

```
buildflow-staging.prochat.tools
  ↓ (DNS CNAME)
dokploy.prochat.tools
  ↓ (DNS CNAME)
dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b.cfargotunnel.com (Cloudflare Argo Tunnel)
  ↓ (Tunnel routes via Host header)
Dokploy server (100.83.38.48 on Tailscale)
  ↓ (Host-based routing)
Dokploy staging app container (enij_FshYINrDID8QGpZX) — NOT RUNNING ✗
```

---

## Dokploy Staging App Status (Blocker)

### Container Status

**Finding:** The Dokploy staging app container is not deployed.

```bash
# SSH check:
$ ssh dokploy 'docker ps -a | grep buildflow-staging'
# Result: No matching containers found
```

### Volume Status

**Finding:** The volume exists but container is not attached.

```bash
$ ssh dokploy 'docker volume ls | grep buildflow'
local     buildflow-data-staging  # ← Volume exists but unused
```

### Why This Is a Blocker

1. **No running container** = No ports listening on Dokploy
2. **No ports = No inbound traffic** = Requests get HTTP 404 from Dokploy reverse proxy
3. **Cannot verify routing** until container is deployed and responding

---

## Endpoint Verification (Blocked)

### Staging Endpoints (HTTP 404 — Container Not Running)

```bash
$ curl -I https://buildflow-staging.prochat.tools/
HTTP/2 404
server: cloudflare
```

**Status:** ✗ Blocked — container not running

### Production Endpoint (HTTP 200 — Still Working)

```bash
$ curl -I https://buildflow.prochat.tools/
HTTP/2 200
Content-Type: text/html; charset=utf-8
```

**Status:** ✓ Production unaffected, still reachable

---

## Why Container Is Not Running

### Possible Causes (Investigation Needed)

1. **Dokploy app deployment failed silently**
   - App configuration exists but deployment was never triggered
   - Need to check Dokploy UI or app logs

2. **App is paused/stopped**
   - Dokploy allows stopping apps from dashboard
   - Need to check Dokploy app status page

3. **Deployment in progress**
   - App may be re-deploying after the earlier configuration
   - Check Dokploy deployment logs

4. **Broken configuration**
   - Environment variables, volume mount, or image pull issue
   - Need to check app deployment history and error logs

### How to Investigate

**Option 1: Via Dokploy UI (Recommended)**
1. Open https://dokploy.prochat.tools/
2. Navigate to Web project → BuildFlow Staging app (ID: enij_FshYINrDID8QGpZX)
3. Check app status: is it "Running", "Paused", or "Error"?
4. Check deployment logs for error messages
5. If paused, click "Resume" to start the container
6. If showing errors, debug from there

**Option 2: Via SSH commands**
```bash
# Check Dokploy app database (if accessible)
ssh dokploy 'ls -la /var/lib/dokploy/apps/' | grep buildflow

# Check recent Docker logs
ssh dokploy 'docker logs <container-id> 2>&1 | tail -50'

# Check Dokploy internal status
ssh dokploy 'curl -s http://localhost:3000/health' # (if port exposed locally)
```

---

## Production Safety Confirmation

✓ `buildflow.prochat.tools` HTTP 200 (production unaffected)  
✓ Local Cloudflare tunnel unchanged (buildflow.prochat.tools still routes to localhost:3054)  
✓ `buildflow-staging.prochat.tools` DNS created but container not running (staging-only issue)  
✓ No production downtime  
✓ No buildflow.prochat.tools traffic affected  
✓ Fully reversible if DNS change needs to be rolled back  

---

## Files Changed

### Created
- `docs/projects/buildflow/buildflow-staging-option-a-routing-blocker-report.md` (this document)

### Modified (DNS)
- Cloudflare zone `prochat.tools`: Added CNAME record `buildflow-staging.prochat.tools` → `dokploy.prochat.tools`

### Not Changed
- `~/.cloudflared/config.yml` (local Cloudflare tunnel unchanged)
- `buildflow.prochat.tools` DNS (unchanged)
- Dokploy staging app configuration (not touched)

---

## Next Steps Required

### Blocker Resolution (Manual Action Required)

1. **Check Dokploy staging app status:**
   - Log into https://dokploy.prochat.tools/
   - Find BuildFlow Staging app (ID: `enij_FshYINrDID8QGpZX`)
   - Determine why container is not running

2. **If app is paused/stopped:**
   - Click "Resume" or "Redeploy" button
   - Wait for container to start (~30-60 seconds)
   - Verify health checks pass

3. **If app shows errors:**
   - Read error messages from deployment logs
   - Fix configuration issue (env vars, volume, image, etc.)
   - Redeploy

4. **If app status is unknown:**
   - SSH to Dokploy host and manually check container
   - Review Dokploy internal logs

### After Container Is Running

Once the Dokploy staging app container is confirmed running:

1. **Verify endpoints respond:**
   ```bash
   curl -I https://buildflow-staging.prochat.tools/health
   curl -I https://buildflow-staging.prochat.tools/ready
   curl -I https://buildflow-staging.prochat.tools/api/openapi
   ```

2. **Verify bridge to local agent/web:**
   - Confirm Dokploy relay can reach local agent (3052) and web (3054)
   - May require environment variable configuration in Dokploy app
   - Check Dokploy app logs for bridge-related errors

3. **Test full staging workflow:**
   - Register device via buildflow-staging.prochat.tools
   - Verify relay receives heartbeats from local agent
   - Test web app search functionality

4. **Complete phase transition:**
   - Once staging relay is verified working, mark Phase 1 complete
   - Document routing model for future reference
   - Plan Phase 4 production cutover

---

## Safety Confirmation

✓ DNS record created successfully (CNAME, not destructive)  
✓ Production buildflow.prochat.tools unaffected (HTTP 200)  
✓ Local tunnel unchanged (buildflow.prochat.tools routes unchanged)  
✓ No secrets exposed  
✓ Fully reversible (can delete DNS record if needed)  
✓ No Dokploy mutations attempted (container status verified read-only)  
✓ No local services affected  

**DNS can be safely rolled back if needed:**
```bash
# If DNS change needs to be reverted:
cloudflare-cli prochat-provisioner dns delete prochat.tools 606293bd5e254fe72852e403eb19a93e
```

---

## Decision Log Entry

**Decision:** Implement Option A (Direct DNS/Cloudflare Tunnel routing)

**Rationale:**
- DNS + Cloudflare Tunnel provides clean separation of concerns
- CNAME to `dokploy.prochat.tools` allows Dokploy host-based routing
- No local tunnel mutation required
- Minimal DNS configuration

**Blocker:** Dokploy staging container not deployed — requires manual investigation and likely container restart/redeploy

**Future considerations:**
- Option B (separate Cloudflare tunnel on Dokploy host) becomes relevant if Dokploy removes Argo Tunnel support
- Plan Phase 5 migration to local tunnel decommission and permanent Cloudflare Tunnel at Dokploy host

---

## Reference

**DNS Record ID:** 606293bd5e254fe72852e403eb19a93e  
**Zone ID:** f631c147ed11f27c23c237b52b21f43b (prochat.tools)  
**Dokploy App ID:** enij_FshYINrDID8QGpZX  
**Dokploy Volume:** buildflow-data-staging (exists but unmounted)  
**Related:** docs/projects/buildflow/buildflow-staging-routing-next-step-report.md  

---

**Report Status:** DNS configuration complete. Staging container deployment issue blocks endpoint verification. Manual Dokploy investigation required.
