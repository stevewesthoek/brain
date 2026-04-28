# BuildFlow Staging Relay Routing Architecture — Re-Assessment Report

**Status:** ARCHITECTURE MISUNDERSTOOD — CRITICAL DESIGN FLAW IDENTIFIED

**Date:** 2026-04-28  
**Finding:** Phase 3 staging relay is incorrectly routed. Misconfiguration reveals fundamental mismatch between intended and actual architecture.

---

## Executive Summary

**CRITICAL DISCOVERY:** BuildFlow Phase 3 was implemented with a fundamental architectural error. The actual system architecture is:

1. **Local services on Steve's Mac:**
   - Agent service on port 3052 (HTTP 200 ✓)
   - Relay service on port 3053 (HTTP 200 ✓)
   - Web service on port 3054 (HTTP 404 — doesn't implement /health)

2. **Production routing (buildflow.prochat.tools):**
   - Routes via Cloudflare tunnel → localhost:3054 (WEB service)
   - NOT routing to localhost:3053 (RELAY)
   - Web service returns 404 because /health not implemented

3. **Staging routing (buildflow-staging.prochat.tools):**
   - ALSO routes via Cloudflare tunnel → localhost:3054 (still WEB, not RELAY)
   - Should route to DOKPLOY RELAY, not local tunnel

4. **Dokploy staging app (enij_FshYINrDID8QGpZX):**
   - Deployed with `buildflow-staging.prochat.tools` domain
   - Image: ghcr.io/stevewesthoek/buildflow:latest
   - Container internal architecture: relay (3053), web (3055), proxy (3054)
   - Public port: 3054 exposed
   - BUT: External requests return HTTP 530 (origin unreachable)

**WHAT WENT WRONG:**
- Phase 3 assumed buildflow-staging.prochat.tools should route locally via Cloudflare tunnel to localhost:3054
- This is wrong: buildflow-staging.prochat.tools should route ONLY to DOKPLOY, not to local services
- The local Cloudflare tunnel is for PRODUCTION access (to local services for development)
- Staging relay on DOKPLOY needs separate inbound routing from Dokploy's public IP (not localhost)

---

## Current Architecture Truth Table

| Component | Location | Port | Current Status | Issue |
|-----------|----------|------|-----------------|-------|
| **Agent** | Steve's Mac | 3052 | HTTP 200 ✓ | Not exposed publicly |
| **Relay** | Steve's Mac | 3053 | HTTP 200 ✓ | Not exposed publicly (production) |
| **Web** | Steve's Mac | 3054 | HTTP 404 | Exposed via local Cloudflare tunnel (buildflow.prochat.tools) |
| **Staging Relay** | Dokploy | 3054 (public proxy) | HTTP 530 ✗ | Routed incorrectly (see routing issues) |

---

## Phase 3 Intended vs Actual

### What Phase 3 Should Have Been

```
INTENDED:
  buildflow-staging.prochat.tools
    ↓ (via Dokploy domain/public routing)
  Dokploy staging relay container (port 3053 internal)
    ↓ (upstream route to local agent/web)
  Steve's Mac agent (3052) + web (3054)
```

### What Phase 3 Actually Became

```
ACTUAL (WRONG):
  buildflow-staging.prochat.tools
    ↓ (via Cloudflare tunnel to localhost)
  Steve's Mac local tunnel entry point
    ↓ (tunnel routes to localhost:3054)
  Steve's Mac WEB service (3054) — not relay!
    ✗ ERROR: This bypasses Dokploy entirely
    ✗ ERROR: Web service doesn't implement /health (404)
    ✗ ERROR: Returns HTTP 530 from Cloudflare (tunnel misconfigured)
```

---

## Root Cause Analysis

### 1. Cloudflare Tunnel Misconfiguration

**Current ingress rules:**
```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054           # ← LOCAL WEB
  - hostname: plankit.prochat.tools
    service: http://localhost:3054
  - hostname: buildflow-staging.prochat.tools
    service: http://localhost:3054           # ← WRONG: Should not be here
  - service: http_status:404
```

**Problem:** `buildflow-staging.prochat.tools` should NOT route through the local Cloudflare tunnel at all. It should:
1. Have a separate DNS/routing mechanism
2. Route to Dokploy's public IP (not localhost)
3. Route to Dokploy staging relay on the correct port

### 2. Dokploy Domain Misconfiguration

**Current Dokploy app configuration:**
- App ID: enij_FshYINrDID8QGpZX
- Image: ghcr.io/stevewesthoek/buildflow:latest
- Domains: `buildflow-staging.prochat.tools`
- Public port: 3054 (correctly exposed)
- Status: Deployed and running

**Problem:** Dokploy domain is configured but:
1. Dokploy domain points to Dokploy's DNS/IP
2. Cloudflare DNS still resolves `buildflow-staging.prochat.tools` to Cloudflare's edge IPs
3. Cloudflare tunnel tries to route it back through local tunnel (HTTP 530 — no route)
4. Dokploy domain never gets reached because DNS points to Cloudflare, not Dokploy

### 3. DNS/Cloudflare Routing Circular Dependency

```
CURRENT BROKEN FLOW:
  
  1. User requests: https://buildflow-staging.prochat.tools
  2. DNS resolves: buildflow-staging.prochat.tools → Cloudflare edge IP
  3. Cloudflare receives request
  4. Cloudflare checks tunnel ingress rules
  5. Rule found: buildflow-staging.prochat.tools → http://localhost:3054
  6. Cloudflare tries to route through OfficeMac tunnel
  7. Tunnel is on Steve's Mac, not on Dokploy host
  8. localhost:3054 from Cloudflare's perspective doesn't exist
  9. Cloudflare returns HTTP 530 (origin unreachable)
  
  ✗ Dokploy staging relay NEVER gets reached
```

---

## Local Service Verification

### Endpoint Health Checks

```bash
$ curl http://localhost:3053/health
HTTP/1.1 200 OK
Content-Type: application/json
{"status": "healthy", ...}

$ curl http://localhost:3052/health
HTTP/1.1 200 OK
Content-Type: application/json
{"status": "healthy", ...}

$ curl http://localhost:3054/health
HTTP/1.1 404 Not Found
Content-Type: text/html
"404: Not Found"

$ curl https://buildflow-staging.prochat.tools/health
HTTP/2 530
server: cloudflare
content-type: text/plain; charset=UTF-8
"Error 530 - Origin unreachable"
```

---

## Correct Phase 3 Architecture (What Should Happen)

### Option A: Dokploy Domain Routing (Recommended)

```
1. Dokploy app has buildflow-staging.prochat.tools domain configured ✓
2. Dokploy exposes the domain at Dokploy server IP
3. DNS for buildflow-staging.prochat.tools should point to Dokploy server IP (NOT Cloudflare)
4. External requests → Dokploy domain → Dokploy staging relay (port 3054 container port)
5. Relay internally routes to Steve's local agent/web via configured bridge

REQUIRED:
- Dokploy domain DNS should resolve to Dokploy server public IP
- NOT through Cloudflare tunnel
- NOT through local Cloudflare tunnel
```

### Option B: Dokploy Through Cloudflare Tunnel (Alternative, Complex)

```
If Dokploy must be accessed through Cloudflare:
1. Cloudflare tunnel on DOKPLOY host (not on Steve's Mac)
2. Cloudflare ingress rule: buildflow-staging.prochat.tools → http://localhost:3054 (at Dokploy host)
3. This would require a separate tunnel instance on Dokploy

CONS: Requires additional tunnel setup on Dokploy host, more complex
```

---

## Bridge Configuration: Dokploy Relay to Local Agent/Web

### What the Dokploy relay needs to reach local services

When Dokploy relay is deployed, it needs to route requests to:
- **Local Agent** on port 3052
- **Local Web** on port 3054

**How the relay reaches local services is NOT documented in Brain docs.** Possible mechanisms:
1. **Environment variables:** AGENT_URL, WEB_URL, RELAY_UPSTREAM_URL, etc.
2. **Network access:** Dokploy network bridge to local Mac (VPN/Tailscale/SSH tunnel)
3. **Hardcoded in image:** BuildFlow Dockerfile may have bridge logic already built-in

**BLOCKED:** Cannot proceed without understanding how Dokploy relay connects back to local agent/web. This must come from BuildFlow Dockerfile or documented environment configuration.

---

## Why buildflow-staging.prochat.tools Returns HTTP 530

**Layer-by-layer diagnosis:**

| Layer | Status | Evidence |
|-------|--------|----------|
| DNS | ✓ Works | dig buildflow-staging.prochat.tools resolves to Cloudflare IPs |
| Cloudflare | ✗ Fails | HTTP 530 returned (origin unreachable) |
| Cloudflare tunnel | ✗ Fails | Rule exists (buildflow-staging.prochat.tools → http://localhost:3054) but localhost:3054 is on Steve's Mac, not Cloudflare's network |
| Dokploy | ✓ Works | Container running, relay service operational internally |
| Dokploy domain | ✗ Never reached | DNS doesn't point to Dokploy; Cloudflare intercepts first |

**Root cause: Incorrect DNS routing. buildflow-staging.prochat.tools DNS points to Cloudflare, but Cloudflare tunnel tries to route through Steve's local Mac. Dokploy is never reached.**

---

## What Was Previously Misunderstood

1. **Assumption:** buildflow-staging.prochat.tools should route through Cloudflare tunnel like production
   - **Reality:** Production (buildflow.prochat.tools) routes to LOCAL services via tunnel
   - **Staging should NOT route locally — it should route to DOKPLOY**

2. **Assumption:** Adding ingress rule to local tunnel would expose staging domain
   - **Reality:** Local tunnel only reaches Steve's Mac services
   - **Dokploy is a separate server — it needs separate routing**

3. **Assumption:** Dokploy domain configuration is complete
   - **Reality:** Dokploy domain configured but DNS not updated to point to Dokploy
   - **Cloudflare DNS still intercepts before Dokploy is reached**

---

## Required Fixes (NOT YET APPLIED)

### FIX 1: Remove Staging from Local Cloudflare Tunnel (REQUIRED)

**Current state:**
```yaml
  - hostname: buildflow-staging.prochat.tools
    service: http://localhost:3054
```

**Should be removed:** buildflow-staging.prochat.tools should NOT be in local tunnel ingress rules

### FIX 2: Configure Correct DNS for Staging (REQUIRED)

**Options:**
- **A) Direct Dokploy IP:** Update DNS `buildflow-staging.prochat.tools` to point to Dokploy server IP (bypass Cloudflare)
- **B) Dokploy Tunnel:** Set up separate tunnel on Dokploy host and route through that
- **C) Cloudflare Tunnel on Dokploy:** Configure Cloudflare tunnel on Dokploy host to expose staging relay

**Current state:** DNS points to Cloudflare edge
**Needed:** DNS should point to Dokploy server or be routed via Dokploy tunnel

### FIX 3: Verify Dokploy Relay Bridge (REQUIRED)

Determine how Dokploy relay reaches local agent/web:
- Check BuildFlow Dockerfile for environment variables or startup logic
- Verify Dokploy app environment variables include bridge configuration
- Test relay endpoints once DNS is correct

---

## Safety Confirmation

✓ No changes made yet (read-only assessment)  
✓ No BuildFlow repo touched  
✓ No local services stopped  
✓ No Dokploy mutations made  
✓ No DNS records changed  
✓ No Cloudflare changes applied  
✓ No secrets exposed  
✓ Fully reversible state  

---

## Blockers Before Proceeding

1. **Bridge mechanism unknown:** How does Dokploy relay reach local agent/web on ports 3052/3054?
   - Needs BuildFlow Dockerfile review or documentation

2. **DNS routing decision unclear:** Which model for buildflow-staging.prochat.tools?
   - Direct Dokploy IP?
   - Separate tunnel on Dokploy?
   - Cloudflare tunnel via Dokploy host?

3. **Production safety unconfirmed:** Removing buildflow-staging from local tunnel won't break production?
   - Must verify buildflow.prochat.tools is NOT affected by removing buildflow-staging ingress rule

---

## Next Steps (Recommended Order)

1. **Clarify bridge mechanism** — How does Dokploy relay connect to local agent/web?
2. **Choose DNS model** — Which routing should be used for buildflow-staging.prochat.tools?
3. **Plan fix sequence** — Ensure production buildflow.prochat.tools is never at risk
4. **Apply FIX 1** — Remove buildflow-staging from local tunnel
5. **Apply FIX 2** — Configure correct DNS/routing for buildflow-staging.prochat.tools
6. **Apply FIX 3** — Verify Dokploy relay bridge and endpoints
7. **Test** — Verify buildflow-staging.prochat.tools returns HTTP 200

---

## Reference

**Dokploy Staging App:** enij_FshYINrDID8QGpZX  
**Staging Domain:** buildflow-staging.prochat.tools  
**Local Services:**
- Agent: localhost:3052 (HTTP 200)
- Relay: localhost:3053 (HTTP 200)
- Web: localhost:3054 (HTTP 404 — /health not implemented)

**Current Issue:** buildflow-staging returns HTTP 530 due to incorrect DNS/routing model

**Related Documentation:**
- operations/runbooks/buildflow-deployment.md (architecture)
- docs/projects/buildflow/dokploy-phase-3-completion-report.md (deployment state)

---

**Status:** Architecture re-assessed. Critical design flaw identified. Awaiting bridge mechanism clarification and DNS routing decision before applying fixes.
