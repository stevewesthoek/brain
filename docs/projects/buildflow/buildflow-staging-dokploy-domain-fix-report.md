# BuildFlow Staging Domain Fix — Deployment & Routing Report

**Status:** BLOCKED — DNS CNAME NOT ROUTING THROUGH ARGO TUNNEL

**Date:** 2026-04-28  
**Action:** Attempted to fix Dokploy domain/reverse-proxy binding. Discovered DNS CNAME routing issue with Cloudflare Argo Tunnel.

---

## Summary

**Progress Made:**
- ✓ Verified staging app container is deployed and running (container ID: 456d5962b9a4, uptime 30+ min)
- ✓ Verified Dokploy database has correct domain binding (`buildflow-staging.prochat.tools` → app `enij_FshYINrDID8QGpZX`)
- ✓ Verified Traefik routing is configured correctly (router enabled, service UP, pointing to app on port 3054)
- ✓ Redeployed staging app to refresh Traefik configuration
- ✓ Removed unnecessary middleware configuration
- ✗ DNS CNAME not routing through Cloudflare Argo Tunnel

**Critical Blocker:**
- Requests to `buildflow-staging.prochat.tools` return HTTP 404 with server: Cloudflare (not Dokploy/Traefik)
- This indicates the request never reaches Dokploy - it's rejected at Cloudflare edge
- DNS CNAME to `dokploy.prochat.tools` is not being properly routed through the Argo Tunnel

---

## Deployment Verification

### Staging App Container ✓

**Container Status:**
```
Container ID: 456d5962b9a4
Image: ghcr.io/stevewesthoek/buildflow:latest
Status: Up 30+ minutes (healthy)
Service: app-transmit-online-hard-drive-of1m9k
```

**Services Running:**
```
✓ Relay on port 3053 (internal)
✓ Web on port 3055 (internal)
✓ Proxy on port 3054 (public)
✓ Data directory: /var/lib/buildflow (mounted volume: buildflow-data-staging)
```

### Dokploy Database Configuration ✓

**App Configuration:**
```
applicationId: enij_FshYINrDID8QGpZX
name: BuildFlow Staging
sourceType: docker
dockerImage: ghcr.io/stevewesthoek/buildflow:latest
```

**Domain Binding:**
```
host: buildflow-staging.prochat.tools
port: 3054
applicationId: enij_FshYINrDID8QGpZX
certificateType: none
middlewares: [] (removed redirect-to-https)
```

### Traefik Routing Configuration ✓

**Router Status:**
```
entryPoints: [web, websecure]
rule: Host(`buildflow-staging.prochat.tools`)
service: app-transmit-online-hard-drive-of1m9k-service-52
status: enabled
```

**Service Status:**
```
loadBalancer servers: [http://app-transmit-online-hard-drive-of1m9k:3054]
serverStatus: UP
strategy: wrr (weighted round-robin)
```

---

## DNS & Routing Analysis

### DNS CNAME Configuration ✓

**Current DNS Setup:**
```
buildflow-staging.prochat.tools CNAME → dokploy.prochat.tools
dokploy.prochat.tools CNAME → dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b.cfargotunnel.com
```

**DNS Status:**
```
DNS resolves: ✓ 
Cloudflare IPs returned: 104.21.60.98, 172.67.195.132
```

### HTTP Routing Analysis ✗

**Request Path:**
```
1. Client: curl https://buildflow-staging.prochat.tools/
2. DNS: buildflow-staging.prochat.tools → Cloudflare IPs
3. Cloudflare: receives request
4. ✗ BLOCKED: Cloudflare returns HTTP 404 (server: cloudflare)
   NOT routed to Argo Tunnel
   NOT reaching Dokploy/Traefik
```

**Evidence:**
```bash
$ curl -i https://buildflow-staging.prochat.tools/
HTTP/2 404
server: cloudflare
cf-ray: 9f34c1e609c0a986-MAD
```

**Cloudflare Response Headers:**
- Server: cloudflare (not Dokploy/Traefik)
- CF-Ray: Cloudflare edge location identifier
- Content: Empty body (Cloudflare 404)

### Root Cause

**Issue:** Cloudflare's Argo Tunnel is not accepting the CNAME-aliased domain

**Why This Happens:**
1. `dokploy.prochat.tools` has an Argo Tunnel configured with Cloudflare
2. `buildflow-staging.prochat.tools` is a CNAME to `dokploy.prochat.tools`
3. **Cloudflare does NOT automatically route CNAME-aliased domains through the same tunnel**
4. CNAME-based routing requires explicit Cloudflare configuration or a different setup

**Comparison - What Works:**
```
buildflow.prochat.tools → Local Cloudflare tunnel (explicit tunnel route) → Works ✓
buildflow-staging.prochat.tools → CNAME alias through Argo Tunnel → Fails ✗
```

---

## Mutations Made

### 1. Staging App Redeploy ✓
- Service: `app-transmit-online-hard-drive-of1m9k`
- Action: `docker service update --force`
- Result: Container restarted, Traefik config regenerated
- Status: ✓ Successful

### 2. Domain Configuration Update ✓
- Database update: Removed `redirect-to-https` middleware from staging domain
- Action: Database mutation (PostgreSQL)
- Result: Middleware array cleared `middlewares: []`
- Status: ✓ Applied to Dokploy DB

### 3. Traefik Restart ✓
- Service: `dokploy-traefik`
- Action: `docker service update --force`
- Result: Traefik reloaded configuration
- Status: ✓ Successful

---

## Endpoint Verification Results

### Staging Domain (buildflow-staging.prochat.tools)

| Endpoint | HTTP | HTTPS | Source | Issue |
|----------|------|-------|--------|-------|
| / | 301 → redirect | 404 | Cloudflare | DNS/Tunnel routing failure |
| /health | 301 → redirect | 404 | Cloudflare | DNS/Tunnel routing failure |
| /ready | 301 → redirect | 404 | Cloudflare | DNS/Tunnel routing failure |
| /api/openapi | 301 → redirect | 404 | Cloudflare | DNS/Tunnel routing failure |

**Status:** ✗ Not reachable from external clients

### Production Domain (buildflow.prochat.tools)

| Endpoint | Status | Source |
|----------|--------|--------|
| / | 200 | Local tunnel (working) |
| /health | 404 | Local tunnel (app responds, endpoint not implemented) |

**Status:** ✓ Still working, unaffected by staging changes

---

## Why CNAME Routing Failed

### Argo Tunnel Architecture

Cloudflare Argo Tunnels work by:
1. **Named domain:** `dokploy.prochat.tools` is explicitly registered with Cloudflare as an Argo Tunnel entry point
2. **Tunnel configuration:** Cloudflare routes requests to that named domain through the tunnel to the backend
3. **CNAME behavior:** When a CNAME points to `dokploy.prochat.tools`, Cloudflare doesn't automatically include it in the tunnel routing

### Why Direct A-Record Option A Would Fail

If we tried to use an A-record pointing to Dokploy's server IP:
- Dokploy might not be publicly accessible on the internet (it's likely behind NAT or on a private network)
- Dokploy uses Argo Tunnel precisely because it can't be directly accessed

### Why CNAME Option A Doesn't Work with Argo Tunnel

1. Cloudflare sees: `buildflow-staging.prochat.tools CNAME → dokploy.prochat.tools`
2. Cloudflare resolves CNAME
3. **Cloudflare checks if `dokploy.prochat.tools` is in Argo Tunnel routes**
4. Issue: Argo Tunnel routes are likely **explicit domain lists**, not wildcard or alias-based
5. Result: Cloudflare doesn't route it and returns 404

---

## Required Fix: Add Domain to Argo Tunnel Configuration

### Option 1: Add Explicit Argo Tunnel Route (Recommended)

**What needs to happen:**
1. In Cloudflare dashboard or API: Add `buildflow-staging.prochat.tools` as an explicit route in the Argo Tunnel configuration
2. Configure it to route to Dokploy (same tunnel as `dokploy.prochat.tools`)
3. Let Cloudflare manage HTTPS certificate via Let's Encrypt

**Note:** This is NOT a DNS-only change; it's an **Argo Tunnel configuration** change in Cloudflare's dashboard.

### Option 2: Use Separate Argo Tunnel on Dokploy Host (Better for Production)

This was mentioned as "Option B" in earlier reports. After Phase 1 testing, deploy a separate Cloudflare Tunnel agent on the Dokploy host specifically for staging domain routing. This allows independent management and doesn't require dashboard changes.

### Option 3: Use Cloudflare Zones / Page Rules

Less likely to work with Argo Tunnels, but could potentially use Cloudflare's zone configuration to route the domain. Requires investigation of Cloudflare's Argo Tunnel API.

---

## Production Safety Confirmation

✓ `buildflow.prochat.tools` still returns HTTP 200  
✓ Local tunnel unchanged (no mutations to ~/.cloudflared/config.yml)  
✓ Production relay unaffected by staging changes  
✓ No production domain removals or modifications  
✓ Staging-only mutations only  

---

## Mutations Summary

| Mutation | Type | Status | Reversible |
|----------|------|--------|-----------|
| App redeploy | Service restart | ✓ Done | ✓ Yes (normal operation) |
| Middleware removal | Database | ✓ Done | ✓ Yes (can re-add) |
| Traefik restart | Service restart | ✓ Done | ✓ Yes (normal operation) |
| DNS CNAME creation | DNS | Done earlier | ✓ Yes (can delete record) |

---

## Files Changed

### Created
- `docs/projects/buildflow/buildflow-staging-dokploy-domain-fix-report.md` (this document)

### Modified
- Dokploy database: domain middlewares cleared (non-Git, local state)

### Not Modified
- Local Cloudflare tunnel (~/.cloudflared/config.yml)
- Production DNS records
- BuildFlow container state (just redeployed)

---

## Next Required Action

**BLOCKER: Add `buildflow-staging.prochat.tools` to Cloudflare Argo Tunnel Configuration**

This is a Cloudflare dashboard/API operation, NOT a Dokploy or DNS-only change.

### Manual Steps (via Cloudflare Dashboard):

1. Log in to Cloudflare dashboard
2. Select domain: prochat.tools
3. Navigate to: Tunnels → [Argo Tunnel for dokploy] → Public hostname
4. Add new route:
   - Domain: `buildflow-staging.prochat.tools`
   - Service: Point to same tunnel backend as `dokploy.prochat.tools`
   - Protocol: HTTPS

### Or via Cloudflare API:

Equivalent API call to add the domain route to the existing Argo Tunnel.

---

## Decision: Option A DNS CNAME Routing Blocked

**Verdict:** Option A (direct DNS CNAME to existing Argo Tunnel) requires explicit Argo Tunnel route configuration in Cloudflare, which is **not a simple DNS change**.

**Recommendation:**
- **For immediate testing:** Add the domain to Argo Tunnel config via Cloudflare dashboard (manual, 5 min)
- **For production:** Implement Option B (separate Cloudflare Tunnel on Dokploy host) for independent management and scalability

---

## Reference

**DNS Record:**
- Type: CNAME
- Name: buildflow-staging.prochat.tools
- Target: dokploy.prochat.tools
- Record ID: 606293bd5e254fe72852e403eb19a93e

**Dokploy App:**
- App ID: enij_FshYINrDID8QGpZX
- Container: 456d5962b9a4
- Service: app-transmit-online-hard-drive-of1m9k
- Port: 3054

**Traefik Configuration:**
- Router: app-transmit-online-hard-drive-of1m9k-router-websecure-52@file
- Status: Enabled, service UP

---

**Report Status:** Staging app deployed and Traefik configured correctly. DNS CNAME not routing through Argo Tunnel (Cloudflare limitation). Requires explicit Argo Tunnel route addition via Cloudflare dashboard to proceed.
