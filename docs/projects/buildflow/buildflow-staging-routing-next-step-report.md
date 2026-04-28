# BuildFlow Staging Relay Routing — Next Step Decision Report

**Status:** READY FOR ROUTING MODEL DECISION

**Date:** 2026-04-28  
**Action:** Verified local tunnel cleanup, Dokploy staging app state, and production safety. Identified routing model decision as critical blocker. Report recommends not executing further mutations until decision is made.

---

## Executive Summary

**VERIFICATION COMPLETE: All preconditions are met for Dokploy staging relay routing.**

Current state after local tunnel cleanup:
- ✓ Local Cloudflare tunnel is clean (buildflow-staging and plankit removed)
- ✓ buildflow.prochat.tools continues working (HTTP 200, production unaffected)
- ✓ Dokploy staging app exists and is correctly configured with buildflow-staging.prochat.tools domain only
- ✓ buildflow-staging.prochat.tools is NOT attached to any other Dokploy app (staging-only)
- ✓ No secrets exposed, no production risk

**Critical blocker identified:** buildflow-staging.prochat.tools currently returns HTTP 530 because DNS still points to Cloudflare but Cloudflare has no route to Dokploy.

**Next required decision:** Choose one of three routing models (A, B, C) to connect buildflow-staging.prochat.tools to Dokploy staging relay.

---

## Current Architecture Truth

### Phase 1 Parallel Deployment Model

```
LOCAL SERVICES (Steve's Mac)
  - Agent: localhost:3052 ✓ (HTTP 200)
  - Relay: localhost:3053 ✓ (HTTP 200) — production, tested locally
  - Web: localhost:3054 ✓ (HTTP 404 /health, app is responding)

PRODUCTION DOMAIN (buildflow.prochat.tools)
  - Routes via: Local Cloudflare tunnel
  - Target: http://localhost:3054 (local web service)
  - Access: Public via https://buildflow.prochat.tools/
  - Status: WORKING — Phase 0/1 development access

STAGING DOMAIN (buildflow-staging.prochat.tools)
  - Routes via: [NOT YET CONFIGURED] ← BLOCKER
  - Target: Dokploy staging relay (port 3054 container)
  - Purpose: Test Dokploy relay independently while keeping local relay operational
  - Status: AWAITING ROUTING MODEL DECISION
  - Current HTTP status: 530 (origin unreachable — expected until routing configured)
```

### Phase Structure (Confirmed from buildflow-migration-plan.md)

| Phase | Name | Local State | Dokploy State | Role |
|-------|------|------------|----------------|------|
| **0** | Local only | Agent/Relay/Web running | N/A | Current starting point ✓ |
| **1** | Parallel deployment (THIS PHASE) | Agent/Relay/Web stay local | Staging relay deployed, NOT ACTIVE | Test Dokploy relay |
| **4** | Switch | Agent/Relay/Web still local | Production relay active, testing complete | Production cutover |
| **5** | Cleanup | Optional migration or stay local | Old resources cleanup | End state |

**Key insight:** Phase 1 explicitly allows both relays to coexist. This is a **testing phase**, not a production replacement yet.

---

## Local Tunnel State (After Cleanup)

### Current Configuration

**File:** `~/.cloudflared/config.yml`

```yaml
tunnel: 1b1fa7bf-a00f-4f1a-86bb-faecac746051
credentials-file: /Users/Office/.cloudflared/1b1fa7bf-a00f-4f1a-86bb-faecac746051.json

ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

**Backup:** `~/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323` (safe to restore if needed)

### Verification

- ✓ Config is syntactically valid (validated via `cloudflared tunnel ingress validate`)
- ✓ Tunnel is connected (OfficeMac tunnel shows 1xlis01, 2xmad05 edge locations)
- ✓ buildflow-staging.prochat.tools removed (no longer in ingress rules)
- ✓ plankit.prochat.tools removed (cleanup from Phase 0)
- ✓ probot.prochat.tools unchanged (independent service)
- ✓ buildflow.prochat.tools unchanged (routes to localhost:3054)

---

## Dokploy Staging App State

### App Configuration

| Field | Value | Status |
|-------|-------|--------|
| **App ID** | enij_FshYINrDID8QGpZX | Correct |
| **Name** | BuildFlow Staging | Correct |
| **Image** | ghcr.io/stevewesthoek/buildflow:latest | Correct |
| **Domain attached** | buildflow-staging.prochat.tools | Correct ← **Staging only** |
| **Public port** | 3054 (exposed) | Correct |
| **Mounts** | 1 (buildflow-data-staging) | Correct |
| **Environment variables** | 6 configured | Present (names not printed) |
| **Container status** | Deployed and running | Correct |

### Domain Attachment Safety

**VERIFIED:** buildflow-staging.prochat.tools is attached **ONLY** to the staging app (enij_FshYINrDID8QGpZX).

- ✓ NOT attached to production app
- ✓ NOT attached to local services
- ✓ NOT shared with any other domain
- ✓ Staging-only, low risk to modify

---

## Is buildflow.prochat.tools Safe and Untouched?

**ANSWER: YES, FULLY SAFE AND VERIFIED**

### Production Domain Verification

```bash
$ curl https://buildflow.prochat.tools/
HTTP/1.1 200 OK
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Title: BuildFlow

$ curl https://buildflow.prochat.tools/health
HTTP/1.1 404 Not Found
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Title: BuildFlow
```

### Safety Proof

| Check | Result | Evidence |
|-------|--------|----------|
| **Still in local tunnel** | ✓ Yes | Config shows `buildflow.prochat.tools → http://localhost:3054` |
| **Routes to local web** | ✓ Yes | HTTP 200 on `/` (app responds) |
| **Attached to Dokploy app** | ✗ No | Production app does not exist yet (Phase 4 only) |
| **Reachable publicly** | ✓ Yes | curl returns 200 via https://buildflow.prochat.tools |
| **No regression** | ✓ Verified | Endpoint responds identically before/after staging cleanup |

**Conclusion:** buildflow.prochat.tools is **UNCHANGED, SAFE, AND FULLY OPERATIONAL.** Production development access continues uninterrupted through Phase 1.

---

## Is buildflow-staging.prochat.tools Correctly Attached to Staging Only?

**ANSWER: YES, CORRECTLY AND SAFELY ATTACHED**

### Staging Domain Configuration

| Check | Result | Evidence |
|-------|--------|----------|
| **Domain configured in Dokploy app** | ✓ Yes | Dokploy staging app has buildflow-staging.prochat.tools |
| **Staging app only** | ✓ Yes | Domain attached to app ID enij_FshYINrDID8QGpZX (staging) only |
| **Not attached to production** | ✓ Correct | Production app does not exist; no production domain attached |
| **Not in local tunnel** | ✓ Correct | Removed from ~/.cloudflared/config.yml in cleanup |
| **Not shared with other services** | ✓ Verified | Staging domain is staging-app-only |

**Conclusion:** buildflow-staging.prochat.tools is **CORRECTLY ATTACHED TO STAGING APP ONLY.** No production risk, staging-scoped, safe to modify routing.

---

## Exact Cause of Current HTTP 530

### Root Cause Diagnosis

**Current flow (BROKEN):**
```
User request → https://buildflow-staging.prochat.tools
              ↓
DNS resolution → Cloudflare edge IP (104.21.60.98, 172.67.195.132)
              ↓
Cloudflare edge receives request
              ↓
Cloudflare checks ingress rules
              ↓
No rule found for buildflow-staging.prochat.tools (removed from local tunnel)
              ↓
Cloudflare checks Dokploy domain routing
              ↓
No Cloudflare tunnel on Dokploy host (not yet configured)
              ↓
Cloudflare returns HTTP 530 (origin unreachable)
              ✗ Dokploy staging relay NEVER REACHED
```

### Why HTTP 530 (Not 404 or 502)

| Status | Meaning | Current Context |
|--------|---------|-----------------|
| **404** | Endpoint not found | Would mean Cloudflare reached an origin successfully but endpoint didn't exist |
| **502** | Bad gateway | Would mean Cloudflare reached an origin but got a bad response |
| **530** | Origin unreachable | Cloudflare cannot reach any configured origin for this domain |

HTTP 530 confirms: **Dokploy is not reachable from Cloudflare's perspective.** This is expected — we removed buildflow-staging from the local tunnel and haven't configured Dokploy routing yet.

### Required Condition to Fix

DNS for buildflow-staging.prochat.tools must resolve to **a route that Cloudflare can reach**:
- Either: Dokploy server's public IP address (option A)
- Or: A Cloudflare tunnel running on Dokploy host (option B)
- Or: A Cloudflare origin configured for Dokploy domain (option C)

Currently, DNS points to Cloudflare's edge, but Cloudflare has no configured origin or tunnel to reach Dokploy. **This is the blocker.**

---

## Recommended Next Mutation (NOT RUN YET)

### Decision Required First: Choose Routing Model

Three options exist to route buildflow-staging.prochat.tools to Dokploy staging relay:

#### **Option A: Direct DNS to Dokploy IP** (Simplest)
```
buildflow-staging.prochat.tools DNS A record → Dokploy server public IP
External requests → Dokploy domain (directly)
Dokploy exposes relay on port 3054
Status: HTTP 200 when Dokploy relay bridge is configured
```
- ✓ Simple DNS change
- ✓ No tunnel overhead
- ✓ Direct network path
- ✗ Requires Dokploy server to handle domain termination (HTTPS cert, etc.)

#### **Option B: Separate Cloudflare Tunnel on Dokploy Host** (Most Complex)
```
buildflow-staging.prochat.tools DNS → Cloudflare edge (unchanged)
Cloudflare ingress rule → Tunnel on Dokploy host
Tunnel on Dokploy → http://localhost:3054 (Dokploy relay)
Status: HTTP 200 when tunnel is running and bridge configured
```
- ✓ Reuses Cloudflare tunnel pattern (familiar)
- ✓ Can co-exist with local tunnel
- ✗ Requires cloudflared process on Dokploy host
- ✗ Additional tunnel credential management

#### **Option C: Dokploy Domain with Cloudflare Origin** (Enterprise)
```
buildflow-staging.prochat.tools DNS → Cloudflare edge (unchanged)
Cloudflare origin configured → Dokploy domain endpoint
Cloudflare proxies → Dokploy relay domain
Status: HTTP 200 when Dokploy domain is HTTPS-enabled
```
- ✓ Reuses Cloudflare dashboard configuration
- ✓ No tunnel needed
- ✗ Requires Dokploy to expose relay with proper domain HTTPS
- ✗ Depends on Dokploy's domain/certificate setup

### Recommended Decision Process

1. **Check Dokploy capabilities:**
   - Does Dokploy host have public IP? (Required for option A)
   - Does Dokploy support running cloudflared service? (Required for option B)
   - Does Dokploy have HTTPS/domain termination? (Required for option C)

2. **Evaluate operational overhead:**
   - Option A: Minimal (one DNS change) — but requires direct IP routing
   - Option B: Moderate (tunnel on Dokploy, credential management)
   - Option C: Depends on Dokploy's domain/TLS setup

3. **Make decision and communicate:**
   - Choose A, B, or C
   - Document in decision-log.md or this report

### Next Mutations (After Decision)

**Once routing model is decided, mutations will be (in order):**

1. **Configure DNS or Cloudflare based on chosen model** (Option A/B/C decision point)
   - Option A: Update buildflow-staging.prochat.tools DNS to Dokploy IP
   - Option B: Set up cloudflared on Dokploy host, add ingress rule to this session
   - Option C: Add Dokploy domain as Cloudflare origin

2. **Verify DNS propagation**
   - `dig buildflow-staging.prochat.tools +short`
   - Should resolve to chosen endpoint (Dokploy IP, Cloudflare, or origin)

3. **Test endpoint reachability**
   - `curl https://buildflow-staging.prochat.tools/health`
   - Should return HTTP 200 or 404 (not 530)

4. **Determine and configure bridge**
   - How does Dokploy relay reach local agent (3052) and web (3054)?
   - Set environment variables in Dokploy staging app if needed
   - Verify relay can upstream to local services

5. **Verify staging relay endpoints**
   - `curl https://buildflow-staging.prochat.tools/relay/health`
   - `curl https://buildflow-staging.prochat.tools/api/openapi`
   - Should return valid responses from Dokploy relay

---

## Safety Confirmation

✓ No mutations executed (read-only verification only)  
✓ No config files changed  
✓ No DNS changes  
✓ No Dokploy app changes  
✓ No Cloudflare changes  
✓ No local services stopped  
✓ No secrets exposed  
✓ No production impact  
✓ Fully reversible state  
✓ All preconditions verified for routing model decision  

---

## Files Changed

- Created: `docs/projects/buildflow/buildflow-staging-routing-next-step-report.md` (this document)

---

## Next Action

**AWAIT STEVE DECISION:**

Which routing model should buildflow-staging.prochat.tools use to reach Dokploy staging relay?

- **Option A:** Direct DNS to Dokploy server IP (simplest)
- **Option B:** Separate Cloudflare tunnel on Dokploy host (familiar pattern)
- **Option C:** Dokploy domain with Cloudflare origin (enterprise)

Once decided, mutations can proceed safely with zero production risk (buildflow.prochat.tools remains fully protected and unchanged).

---

**Report Status:** Verification complete. Routing model decision required before proceeding. All preconditions met. Ready to execute mutations once decision is made.
