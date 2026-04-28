# BuildFlow Dual-Relay Staging Architecture — Corrected Design Report

**Status:** ARCHITECTURE CLARIFIED — PHASE 3 MISUNDERSTOOD, PHASE 0 MIGRATION PLAN DISCOVERED

**Date:** 2026-04-28  
**Finding:** Phase 3 staging was implemented with wrong routing model. Correct architecture found in operations/standards/buildflow-migration-plan.md. This document is Phase 1 (Staging Relay), not Phase 3 production migration.

---

## Executive Summary

**KEY DISCOVERY:** BuildFlow migration has a detailed phased plan in operations/standards/buildflow-migration-plan.md that clarifies the correct architecture:

- **Phase 0:** Local BuildFlow only (CURRENT STATE)
  - Agent: localhost:3052 ✓
  - Relay: localhost:3053 ✓
  - Web: localhost:3054 ✓

- **Phase 1:** Deploy production relay to Dokploy (STARTING NOW)
  - Production buildflow.prochat.tools → Dokploy relay (production)
  - Local buildflow.prochat.tools via tunnel → stays local (Phase 0/development)
  - But: DNS/routing transition only happens in Phase 4 (switch)

- **Phase 3 staging (what we're doing):**
  - Should be: Deploy SECOND relay to Dokploy for testing
  - Domain: buildflow-staging.prochat.tools (new, separate domain)
  - NOT a replacement of Phase 1; rather a TEMPORARY testing environment
  - Allows testing new relay WITHOUT disrupting local production relay

**WHAT WENT WRONG:**
- Phase 3 added `buildflow-staging.prochat.tools` to LOCAL Cloudflare tunnel
- This routes staging to localhost:3054 (local web), bypassing Dokploy entirely
- Should instead route `buildflow-staging.prochat.tools` only to Dokploy relay
- Production `buildflow.prochat.tools` should remain local during this testing phase (Phase 1)
- Only in Phase 4 does production cut over to Dokploy

---

## Current Actual State

### Local Services (All Running ✓)

| Service | Port | Status | Exposure |
|---------|------|--------|----------|
| Agent | 3052 | HTTP 200 ✓ | Not publicly exposed |
| Relay | 3053 | HTTP 200 ✓ | Not publicly exposed (production/dev) |
| Web | 3054 | HTTP 200 ✓ | Via local Cloudflare tunnel |

**Verification:**
```bash
$ curl http://localhost:3052/health
HTTP/1.1 200 OK

$ curl http://localhost:3053/health
HTTP/1.1 200 OK

$ curl http://localhost:3054/
HTTP/1.1 200 OK
```

### Current Public Routing (Cloudflare Local Tunnel)

| Hostname | Target | Current Role |
|----------|--------|-------------|
| buildflow.prochat.tools | http://localhost:3054 | Development/Phase 0 (local web) |
| buildflow-staging.prochat.tools | http://localhost:3054 | **WRONG** — Should be Dokploy only |
| plankit.prochat.tools | http://localhost:3054 | (Unknown purpose — may be removable) |
| probot.prochat.tools | http://localhost:7070 | ProBot (unrelated) |
| (catch-all) | http_status:404 | Default |

### Current Dokploy State

**Staging Relay App:** enij_FshYINrDID8QGpZX
- Name: BuildFlow Staging
- Image: ghcr.io/stevewesthoek/buildflow:latest
- Domain: buildflow-staging.prochat.tools (configured)
- Public port: 3054 (exposed)
- Mounts: 1 (buildflow-data-staging)
- Environment variables: 6 (names only, not values)
- Status: Deployed and running internally

**Production App:** NOT YET DEPLOYED (Phase 1 in progress)
- Will have domain: buildflow.prochat.tools
- Currently, buildflow.prochat.tools still points to local tunnel (Phase 0 setup)

---

## Corrected Phase 3 Staging Architecture

### What Phase 3 Should Be

```
CORRECT TEMPORARY TOPOLOGY (During Phase 3 staging/testing):

  buildflow.prochat.tools
    ↓ (remains local during Phase 0→1 testing)
  Local Cloudflare tunnel → localhost:3054 (local web)
    
  buildflow-staging.prochat.tools
    ↓ (separate staging domain for Dokploy relay testing)
  Dokploy domain/routing → Dokploy relay (port 3053 internal, 3054 public proxy)
    ↓ (relay needs to reach local agent/web for full flow test)
  Bridge to local services (3052 agent, 3054 web)

CLIENTS:
  - Local app: Uses local relay (localhost:3053) for production dev testing
  - Staging tester: Uses buildflow-staging.prochat.tools for Dokploy relay testing
  - Both relays can coexist during testing phase
```

### Why buildflow-staging Should NOT Be in Local Tunnel

**WRONG (current):**
```
buildflow-staging.prochat.tools
  ↓ (via Cloudflare tunnel ingress rule)
localhost:3054 (from Cloudflare's perspective = off-network, returns 530)
  ✗ Dokploy app never reached
  ✗ HTTP 530 error
  ✗ Testing Dokploy relay impossible
```

**CORRECT (what's needed):**
```
buildflow-staging.prochat.tools
  ↓ (via Dokploy domain/DNS or separate Cloudflare tunnel on Dokploy host)
Dokploy staging relay (directly, not through local tunnel)
  ✓ Dokploy relay receives traffic
  ✓ Can test new relay independently
  ✓ Doesn't affect local production relay
```

---

## Bridge: Dokploy Staging Relay to Local Agent/Web

### What the Dokploy relay needs to reach local services

From the migration plan and Dockerfile contract, Dokploy relay must reach:
1. **Local agent** (port 3052) for device communication
2. **Local web** (port 3054) for search/action handling

### How the bridge might work (UNPROVEN)

**Option A: Network access from Dokploy host to Steve's Mac**
- Dokploy host has direct network access to 3052/3054 (unlikely on different networks)
- Environment variables configure upstream URLs

**Option B: VPN/Tailscale tunnel**
- Dokploy connects to Steve's Mac via VPN
- Relay configured with Tailscale IP or hostname instead of localhost
- This is the most probable model for remote Dokploy

**Option C: SSH tunnel or port forward**
- Dokploy creates tunnel to Steve's Mac ports 3052/3054
- Less likely but possible

**Option D: Completely isolated staging relay (no bridge needed)**
- Dokploy relay runs standalone without reaching local services
- Only tests relay functionality, not full integration
- Useful for smoke testing new relay code

### BLOCKED: Proven bridge mechanism unknown

**Current state:** The bridge mechanism is NOT documented in Brain docs. Must come from:
1. BuildFlow Dockerfile startup logic
2. Dokploy app environment variables (names not documented)
3. Communication pattern in BuildFlow code

**Required to proceed:** Understand how Dokploy relay will connect to local agent (3052) and web (3054)

---

## Previous Haiku Analysis: What Was Correct, What Was Incomplete

### What Was Correct
✓ Correctly identified that buildflow-staging.prochat.tools returns HTTP 530
✓ Correctly identified it was added to local Cloudflare tunnel
✓ Correctly identified that localhost:3054 doesn't exist in Cloudflare's network context
✓ Correctly identified this is wrong for reaching Dokploy

### What Was Incomplete
✗ Did not discover the migration plan document (phase structure)
✗ Did not clarify that this is Phase 1 testing, not Phase 3 production migration
✗ Did not clarify that buildflow.prochat.tools should STAY local during Phase 3 staging
✗ Did not clarify the bridge mechanism issue (unknown)
✗ Did not identify that `plankit.prochat.tools` and possibly other domains need review
✗ Did not clarify whether local app can/should support dual relay URLs during testing

### Why Incomplete Was OK
The analysis was pragmatically correct: "don't route staging through local tunnel; use Dokploy routing instead." The incompleteness was about understanding the phase structure and bridge mechanism, which are architectural clarifications needed before implementing the fix.

---

## Should buildflow-staging Use Local Cloudflare Tunnel?

**ANSWER: NO**

buildflow-staging.prochat.tools should:
- ❌ NOT be in local Cloudflare tunnel ingress rules
- ❌ NOT route to localhost:3054
- ✓ Route directly to Dokploy (via Dokploy domain, or separate Cloudflare tunnel on Dokploy host)
- ✓ Have independent routing from buildflow.prochat.tools

**Why:**
1. Dokploy is a separate server/network; local tunnel can't reach it
2. Staging should test Dokploy relay independently
3. Local tunnel is for local development (Phase 0/Phase 1 pre-cutover)
4. Production cutover happens in Phase 4, not Phase 3

---

## Do Two Relay URLs/Ports Need Temporary Support?

**ANSWER: PROBABLY YES, BUT UNPROVEN**

### The Question
During Phase 3 testing, should the local agent/web app support:
- **Current relay:** localhost:3053 (local production relay via tunnel to buildflow.prochat.tools)
- **Staging relay:** buildflow-staging.prochat.tools (Dokploy relay via separate routing)

### Why It Might Be Needed
- Local app is unchanged during staging test
- Staging tester needs to point app to buildflow-staging.prochat.tools (Dokploy relay) without breaking local dev
- This might require:
  1. Runtime config switch (pick relay A or relay B)
  2. Environment variable for alternate relay URL
  3. Separate build/deployment for staging
  4. Or: Relay app code already supports multiple relay endpoints

### What We Don't Know
- Whether local app has built-in support for relay endpoint config
- Whether Dockerfile/env vars allow configuring the relay URL
- Whether staging test requires full local app changes or just relay swap

**BLOCKED: Cannot determine without reviewing BuildFlow app code or environment configuration**

---

## Safe Hostnames and Deletion Candidates

### Current Local Tunnel Hostnames

| Hostname | Target | Purpose | Safe to Remove? |
|----------|--------|---------|-----------------|
| probot.prochat.tools | http://localhost:7070 | ProBot dashboard | ✓ Yes (unrelated to BuildFlow) |
| buildflow.prochat.tools | http://localhost:3054 | Local dev (Phase 0 → Phase 1 transition) | ❌ **NO** — Keep during Phase 3 testing |
| plankit.prochat.tools | http://localhost:3054 | **UNKNOWN PURPOSE** | ❓ Investigate before removing |
| buildflow-staging.prochat.tools | http://localhost:3054 | Staging (currently wrong) | ❌ **NO** — But must be removed from local tunnel and added to Dokploy routing |

### Hostnames to Explicitly Keep
- **buildflow.prochat.tools** — Must remain local during Phase 3 staging (Phase 1 production cutover doesn't happen until Phase 4)

### Hostnames Marked for Review
- **plankit.prochat.tools** — Unknown purpose; document and request explicit Steve approval before removal
- **probot.prochat.tools** — Separate service; may be safely removed but ask for confirmation

---

## Exact Recommended Next Mutations (NOT YET EXECUTED)

### MUTATION 1: Remove buildflow-staging from Local Tunnel (SAFE)
**Scope:** Local tunnel only, staging-only change
**Action:** Remove lines from ~/.cloudflared/config.yml:
```yaml
  - hostname: buildflow-staging.prochat.tools
    service: http://localhost:3054
```
**Reason:** Staging should route to Dokploy, not local tunnel
**Impact:** buildflow-staging.prochat.tools will return 404 from Cloudflare until Dokploy DNS is configured
**Risk:** LOW — Doesn't affect other hostnames or local services
**Approval:** Can proceed after this report is approved by Steve

### MUTATION 2: Configure buildflow-staging Routing to Dokploy (BLOCKED)
**Scope:** DNS/Dokploy domain routing
**Options:**
- A) Update DNS buildflow-staging.prochat.tools to point to Dokploy server IP
- B) Set up separate Cloudflare tunnel on Dokploy host for buildflow-staging.prochat.tools
- C) Use Dokploy domain and configure Cloudflare accordingly
**Current state:** Dokploy app is configured with buildflow-staging.prochat.tools domain, but DNS routing not proven
**Blocker:** Need Steve decision on routing model (A, B, or C)
**Risk:** HIGH if wrong model chosen — could cause HTTP 530 or fail to reach Dokploy

### MUTATION 3: Verify/Configure Bridge to Local Agent/Web (BLOCKED)
**Scope:** Dokploy app environment variables
**Required:** Prove how Dokploy relay reaches local 3052/3054
**Action:**
  1. Review BuildFlow app code for relay URL configuration
  2. Document proven environment variable names
  3. Set env vars in Dokploy staging app if needed
**Blocker:** Bridge mechanism not yet understood
**Risk:** HIGH — Wrong bridge config means Dokploy relay can't reach local services

### MUTATION 4: Verify Dual-Relay Support in Local App (BLOCKED)
**Scope:** Local BuildFlow app configuration
**Question:** Can local app temporarily support both relays during testing?
**Action:**
  1. Review local app config/env for relay endpoint override
  2. Determine whether staging test requires local app changes
  3. Document the process for switching between relays
**Blocker:** App code review needed
**Risk:** MEDIUM — If not supported, may need separate build or manual config

---

## Proof of Architecture from Documentation

### BuildFlow Migration Plan (operations/standards/buildflow-migration-plan.md)

**Phase 0 (Current Local):**
```
Local BuildFlow running on localhost:3054
  - Agent: 3052
  - Relay: 3053
  - Web: 3054
```

**Phase 1 (Parallel Deployment — what Phase 3 staging IS):**
```
Local BuildFlow continues as PRIMARY service
Production relay deployable but not active in CustomGPT yet
Domain buildflow.prochat.tools resolves to production relay
Local relay isolated at localhost:3053 (unchanged)

During Phase 1:
- Local relay at localhost:3053 continues to work
- New production relay deployed to Dokploy
- Both relays operational simultaneously
- No cutover yet (happens in Phase 4)
```

**Phase 3 (Validation):**
```
Custom GPT integration testing with production relay
Real user requests routed through production
Monitoring for errors
```

**Phase 4 (Switch):**
```
Update CustomGPT to use production buildflow.prochat.tools
Update ProBot dashboard to show production relay status
Local relay continues as warm standby
Maintain dual-relay status for 48 hours
```

**Implication:** Phase 3 staging (building/testing a second relay) is WITHIN Phase 1's parallel deployment. Both relays should be able to coexist.

---

## Current Blockers Before Proceeding

1. **Bridge mechanism unclear:** How will Dokploy relay reach local agent/web (3052/3054)?
   - Needs BuildFlow app code review
   - Needs environment configuration documentation

2. **Routing model for buildflow-staging undecided:** Which approach?
   - A) Direct DNS to Dokploy server IP
   - B) Separate Cloudflare tunnel on Dokploy host
   - C) Dokploy domain with Cloudflare

3. **Dual-relay local support unproven:** Can local app swap relays temporarily?
   - Needs BuildFlow app configuration review
   - May require env var override or config file change

4. **plankit.prochat.tools purpose unknown:** Safe to remove?
   - Needs documentation or Steve confirmation

---

## Safety Confirmation

✓ No changes made (read-only assessment)  
✓ No BuildFlow repo touched  
✓ No local services stopped/restarted  
✓ No Dokploy mutations  
✓ No Cloudflare tunnel mutations  
✓ No DNS changes  
✓ No secrets exposed  
✓ Fully reversible state  
✓ No production risk  

---

## Files Changed

- Created: `docs/projects/buildflow/buildflow-dual-relay-staging-architecture-report.md` (this document)

---

## Next Safe Changes (In Order, Requires Explicit Approval)

**STEP 1:** Get Steve confirmation on these answers:
1. What is `plankit.prochat.tools` for? (Safe to remove or keep?)
2. Which routing model for buildflow-staging.prochat.tools? (A: DNS IP, B: Separate tunnel, C: Dokploy domain)
3. Does local app support relay config/override?

**STEP 2:** Once clarified, execute in order:
1. Remove buildflow-staging.prochat.tools from local tunnel (SAFE, low-risk)
2. Configure buildflow-staging.prochat.tools routing to Dokploy
3. Verify/configure bridge from Dokploy relay to local 3052/3054
4. Test staging relay endpoints and bridge connectivity

---

## Exact Next Action

**DO NOT MUTATE YET.** Report architecture clarified. Blockers identified:

1. **Architecture is now clear:** This is Phase 1 (parallel deployment of staging relay), not Phase 3 production migration. Local relay and Dokploy staging relay should coexist during testing.

2. **Haiku's prior analysis was correct:** buildflow-staging should NOT be in local tunnel. But the "why" is subtler: it should route to Dokploy only, and local routing is for Phase 0/1 pre-cutover testing of the local production setup.

3. **Staging should point to Dokploy:** Yes, buildflow-staging.prochat.tools should route to Dokploy relay, not to localhost:3054.

4. **Two relay URLs probably needed temporarily:** Local app likely needs to support both relays during testing phase, but this is unproven without app code review.

5. **Safe immediate action:** Remove buildflow-staging from local tunnel (can't hurt, buildflow.prochat.tools stays local and working).

6. **Blocked on:** Bridge mechanism, routing model decision, local app config review.

---

**Report Status:** READY FOR STEVE REVIEW AND APPROVAL

- [x] Architecture clarified
- [x] Previous misunderstandings documented
- [x] Blockers explicitly listed
- [x] Proposed mutations identified (safe ones first)
- [ ] Steve decision on routing model and bridge mechanism
- [ ] Execute MUTATION 1 (remove staging from local tunnel)
- [ ] Execute MUTATION 2-4 after blockers resolved
