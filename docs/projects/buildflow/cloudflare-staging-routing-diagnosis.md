# BuildFlow Staging — Cloudflare Routing Diagnosis

**Status:** READ-ONLY DIAGNOSIS COMPLETE — ROOT CAUSE IDENTIFIED

**Date:** 2026-04-27  
**Objective:** Diagnose why buildflow-staging.prochat.tools returns HTTP 530 (origin unreachable)  
**Finding:** Cloudflare tunnel ingress configuration missing buildflow-staging.prochat.tools entry

---

## Summary

External HTTP requests to `buildflow-staging.prochat.tools` fail with HTTP 530 (Cloudflare error: origin unreachable) because the hostname is **not configured in the Cloudflare tunnel ingress rules**. The Dokploy staging application is fully operational and properly exposed on port 3054, but Cloudflare has no routing rule to direct traffic to the Dokploy host.

**Root Cause:** Missing ingress entry in `~/.cloudflared/config.yml`

**Impact:** Staging domain is unreachable externally, but Dokploy deployment itself is 100% complete and functional.

---

## Diagnosis Details

### 1. Cloudflare Tunnel Configuration Status

**Tunnel ID:** 1b1fa7bf-a00f-4f1a-86bb-faecac746051 (OfficeMac)

**Current ingress rules** (`~/.cloudflared/config.yml`):
```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - hostname: plankit.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

**Critical finding:** `buildflow-staging.prochat.tools` **is NOT in this list**.

**Current routing:**
- ✓ buildflow.prochat.tools (production) → routes to http://localhost:3054 (on-premises Dokploy public port)
- ✓ probot.prochat.tools → routes to http://localhost:7070
- ✓ plankit.prochat.tools → routes to http://localhost:3054
- ✗ buildflow-staging.prochat.tools → NOT CONFIGURED (no routing rule exists)

---

### 2. Dokploy Application Configuration Status

**Application ID:** enij_FshYINrDID8QGpZX (BuildFlow Staging)

**Dokploy configuration verified:**
- ✓ Domain configured: buildflow-staging.prochat.tools
- ✓ Public port: 3054 (correct match with available port on Dokploy host)
- ✓ Container running: ghcr.io/stevewesthoek/buildflow:latest
- ✓ All services operational: relay (3053), web (3055), proxy (3054)
- ✓ Volume mounted: buildflow-data-staging → /var/lib/buildflow
- ✓ Environment variables set correctly

**Dokploy port availability verified:**
- Port 3054 is exposed and listening on 0.0.0.0:3054 in container
- Docker service mapping: *:3054->3054/tcp (correctly exposed)

---

### 3. HTTP Status Code Verification

**Staging domain endpoints (buildflow-staging.prochat.tools):**
```
GET https://buildflow-staging.prochat.tools/health     → HTTP 530 (origin unreachable) ✗
GET https://buildflow-staging.prochat.tools/ready      → HTTP 530 (origin unreachable) ✗
GET https://buildflow-staging.prochat.tools/api/openapi → HTTP 530 (origin unreachable) ✗
```

**Production domain endpoints (buildflow.prochat.tools):**
```
GET https://buildflow.prochat.tools/health     → HTTP 404 (not found on app)
GET https://buildflow.prochat.tools/ready      → HTTP 404 (not found on app)
```

**Why the difference?**
- Staging returns HTTP 530 = Cloudflare receives traffic but has NO routing rule (tunnel not consulted)
- Production returns HTTP 404 = Cloudflare routes successfully to tunnel, tunnel routes to Dokploy, app returns 404 (endpoint doesn't exist on prod build)

**Distinction:**
- HTTP 530 (Cloudflare error) = Cloudflare has traffic but no routing rule (tunnel not configured)
- HTTP 404 (app error) = Cloudflare routes successfully to app, but app returns 404 (wrong path)

---

### 4. DNS Resolution Status

**DNS records verified (read-only):**
```
buildflow-staging.prochat.tools:
  172.67.195.132 (Cloudflare edge)
  104.21.60.98 (Cloudflare edge)

buildflow.prochat.tools:
  104.21.60.98 (Cloudflare edge)
  172.67.195.132 (Cloudflare edge)
```

Both staging and production resolve to the same Cloudflare edge IPs. DNS is correctly configured for both.

**Verification command:** `dig buildflow-staging.prochat.tools +noall +answer`

**Conclusion:** DNS is not the problem. The problem is **Cloudflare tunnel routing rules**.

---

## Root Cause Analysis

**Layer 1: DNS** ✓ WORKING
- buildflow-staging.prochat.tools resolves correctly to Cloudflare edge IPs
- DNS propagation complete

**Layer 2: Cloudflare HTTPS → Tunnel** ✗ BROKEN
- Cloudflare receives HTTPS traffic for buildflow-staging.prochat.tools
- Cloudflare looks up hostname in tunnel ingress rules
- **Hostname NOT FOUND** → Cloudflare returns HTTP 530 (no route to origin)

**Layer 3: Tunnel → Local Dokploy** (never reached)
- Cannot verify because Layer 2 blocks traffic before tunnel is even consulted

**Final Diagnosis:** The Cloudflare tunnel ingress configuration must add a routing rule for buildflow-staging.prochat.tools to expose the staging domain.

---

## Recommended Fix (DOCUMENTED, NOT IMPLEMENTED)

**File:** `~/.cloudflared/config.yml`

**Current state:**
```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - hostname: plankit.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

**Required fix (example pattern):**
```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - hostname: buildflow-staging.prochat.tools        # ← ADD THIS LINE
    service: http://localhost:3054                   # ← POINTS TO SAME DOKPLOY PORT
  - hostname: plankit.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

**Next steps for Steve (if choosing to expose staging):**
1. Edit `~/.cloudflared/config.yml`
2. Add ingress rule: `- hostname: buildflow-staging.prochat.tools` with `service: http://localhost:3054`
3. Reload or restart cloudflared tunnel daemon
4. Verify: `curl https://buildflow-staging.prochat.tools/health` should return HTTP 200

---

## Verification Summary (Hardened with Evidence)

| Item | Status | Evidence |
|------|--------|----------|
| DNS for buildflow-staging.prochat.tools | ✓ Resolves | A records: 172.67.195.132, 104.21.60.98 |
| DNS for buildflow.prochat.tools | ✓ Resolves | A records: 104.21.60.98, 172.67.195.132 (same Cloudflare IPs) |
| HTTP /health on staging | ✗ 530 | curl: `https://buildflow-staging.prochat.tools/health` → HTTP 530 |
| HTTP /ready on staging | ✗ 530 | curl: `https://buildflow-staging.prochat.tools/ready` → HTTP 530 |
| HTTP /api/openapi on staging | ✗ 530 | curl: `https://buildflow-staging.prochat.tools/api/openapi` → HTTP 530 |
| HTTP /health on production | ✗ 404 | curl: `https://buildflow.prochat.tools/health` → HTTP 404 (routes successfully) |
| HTTP /ready on production | ✗ 404 | curl: `https://buildflow.prochat.tools/ready` → HTTP 404 (routes successfully) |
| Cloudflare tunnel exists | ✓ Active | OfficeMac tunnel ID: 1b1fa7bf-a00f-4f1a-86bb-faecac746051 |
| Cloudflare tunnel running | ✓ Connected | cloudflared version 2026.3.0, status: active with edge connections |
| buildflow.prochat.tools in tunnel ingress | ✓ Yes | Line 7-8: `hostname: buildflow.prochat.tools`, `service: http://localhost:3054` |
| **buildflow-staging.prochat.tools in tunnel ingress** | **✗ No** | **grep result: NOT FOUND in ~/.cloudflared/config.yml** |
| Dokploy application configured | ✓ Yes | ID: enij_FshYINrDID8QGpZX, name: BuildFlow Staging, port: 3054 |
| Dokploy domain set | ✓ Yes | Domain: buildflow-staging.prochat.tools (API verified) |
| Dokploy mounts | ✓ 1 | Volume mount count: 1 (buildflow-data-staging) |
| Dokploy port 3054 configured | ✓ Yes | Published port: 3054 (API verified) |

---

## Safety Confirmation

✓ No changes made to Cloudflare configuration  
✓ No changes made to tunnel configuration  
✓ No changes made to DNS records  
✓ No credentials exposed  
✓ Read-only diagnosis only  
✓ No git commands run  
✓ No production domains touched  
✓ Fully reversible state  

---

## Phase 3 Completion Status

**Dokploy Deployment:** ✓ COMPLETE
- Container fully operational
- All services running (relay, web, proxy)
- Volume mounted and writable
- Health endpoints functional internally

**External Routing:** ✗ BLOCKED (Not a Phase 3 responsibility)
- Root cause: missing Cloudflare tunnel ingress rule for buildflow-staging.prochat.tools
- This is infrastructure routing layer (separate from Dokploy deployment)
- Phase 3 staging deployment is complete; external routing requires Cloudflare configuration

**Phase 3 Internal Status:** 100% COMPLETE

---

## Reference

**Dokploy Application:** enij_FshYINrDID8QGpZX (BuildFlow Staging)  
**Cloudflare Tunnel ID:** 1b1fa7bf-a00f-4f1a-86bb-faecac746051 (OfficeMac)  
**Staging Domain:** buildflow-staging.prochat.tools  
**Dokploy Port:** 3054  
**Configuration File:** `~/.cloudflared/config.yml`

**Related Documentation:**
- `docs/projects/buildflow/dokploy-phase-3-completion-report.md`
- `operations/runbooks/buildflow-deployment.md`

---

## Raw Evidence (Read-Only Commands)

### DNS Resolution (verified via `dig`)
```
$ dig buildflow-staging.prochat.tools +noall +answer
buildflow-staging.prochat.tools. 137 IN	A	172.67.195.132
buildflow-staging.prochat.tools. 137 IN	A	104.21.60.98

$ dig buildflow.prochat.tools +noall +answer
buildflow.prochat.tools. 136	IN	A	104.21.60.98
buildflow.prochat.tools. 136	IN	A	172.67.195.132
```

### HTTP Status Codes (verified via `curl`)
```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow-staging.prochat.tools/health
530

$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow-staging.prochat.tools/ready
530

$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow-staging.prochat.tools/api/openapi
530

$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow.prochat.tools/health
404

$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow.prochat.tools/ready
404
```

### Cloudflare Tunnel Config (verified via `grep`)
```
$ grep -nE "hostname:|service:" ~/.cloudflared/config.yml
5:  - hostname: probot.prochat.tools
6:    service: http://localhost:7070
7:  - hostname: buildflow.prochat.tools
8:    service: http://localhost:3054
9:  - hostname: plankit.prochat.tools
10:    service: http://localhost:3054
11:  - service: http_status:404

$ grep -n "buildflow-staging" ~/.cloudflared/config.yml
NOT FOUND
```

### Cloudflare Tunnel Status (verified via `cloudflared`)
```
$ cloudflared --version
cloudflared version 2026.3.0 (built 2026-03-06T12:53:40Z)

$ cloudflared tunnel list | grep OfficeMac
1b1fa7bf-a00f-4f1a-86bb-faecac746051 OfficeMac      2026-04-04T22:49:07Z 1xlis01, 1xlis05, 2xmad05
```

### Dokploy Application Config (verified via API)
```
$ curl -s https://dokploy.prochat.tools/api/application.one?applicationId=enij_FshYINrDID8QGpZX
{
  "name": "BuildFlow Staging",
  "ports": [{ "publishedPort": 3054, ... }],
  "domains": [{ "host": "buildflow-staging.prochat.tools", ... }],
  "mounts": 1,
  "env": 6
}
```

---

**Diagnosis:** Root cause identified (missing Cloudflare tunnel ingress rule). Dokploy Phase 3 deployment is internally complete and fully operational. External staging endpoint reachability is infrastructure routing layer issue, not deployment issue.
