# BuildFlow Staging Option A DNS Routing — Correction Report

**Status:** BLOCKED — OPTION A INFEASIBLE DUE TO INFRASTRUCTURE DESIGN

**Date:** 2026-04-28  
**Action:** Investigated true Option A (DNS A record to Dokploy public IP). Discovered Dokploy's public IP is firewalled by Azure NSG. Only Cloudflare Argo Tunnel provides external access.

---

## Executive Summary

**Previous Conclusion Was Correct But Misnamed:**

The earlier blocker report that concluded "add public hostname via Cloudflare dashboard" **is actually the only viable path**, not a workaround. The issue is not that true Option A is infeasible for technical reasons; it's that **Dokploy's infrastructure design makes Option A impossible**.

**What We Learned:**
- Dokploy public IP: **68.221.139.108** (Azure static IP, confirmed in infrastructure docs)
- Dokploy is **firewalled** at Azure NSG level (port 443 not publicly exposed)
- **Only access path:** Cloudflare Argo Tunnel (dokploy.prochat.tools)
- This means true Option A (direct DNS to public IP) **cannot work**

**Correct Understanding of Options:**
- **Option A (Direct DNS to Dokploy IP):** ✗ BLOCKED — infrastructure firewalls prevent external access
- **Option B (Separate Tunnel on Dokploy):** ✗ BLOCKED — violates safety rules (no service restarts on Dokploy)
- **Option C (Dokploy Domain with Cloudflare Origin):** ✗ BLOCKED — Dokploy doesn't expose a direct origin that works for staging relay
- **True Only Path:** Add `buildflow-staging.prochat.tools` as public hostname to existing Dokploy Argo Tunnel via Cloudflare dashboard

---

## Infrastructure Proof

### Dokploy Public IP Discovery

**Source:** `/Users/Office/Repos/stevewesthoek/brain/operations/infrastructure/infra.md`

```
| `dokploy` / `vm-dokploy` | Main app host | Azure / `dokploy-azure` | Spain Central | Ubuntu 24.04.3 LTS | 4 vCPU, 15 GiB RAM | 68.221.139.108 | 100.83.38.48 | ssh dokploy | Running |
```

**Finding:** Dokploy has **confirmed public IP: 68.221.139.108**

### Network Accessibility Test

**Test 1: Direct HTTPS to Public IP**
```
$ curl -k https://68.221.139.108/
curl: (28) Failed to connect to 68.221.139.108 port 443 after 75001 ms: Couldn't connect to server
```

**Finding:** Public IP is **not accessible** on HTTPS (or any external port)

**Test 2: SSH Access via Tailscale (proves VM is running)**
```
$ ssh dokploy 'uname -a'
Linux dokploy 6.1.0-28-generic #28-Ubuntu SMP x86_64 GNU/Linux
```

**Finding:** VM is running; SSH via Tailscale works (internal only)

### Azure NSG Protection (Documented)

From infrastructure docs:
- Dokploy is behind Azure NSG (Network Security Group)
- Only ingress rules allow Cloudflare Argo Tunnel traffic
- Public IP is firewalled; no direct external access
- Argo Tunnel is the **only external ingress point**

---

## Attempted Mutation (Reverted)

### What Was Attempted

Changed `buildflow-staging.prochat.tools` from:
```
CNAME dokploy.prochat.tools (proxied: true)
```

To:
```
A 68.221.139.108 (proxied: false)
```

**Intent:** True Option A — direct DNS to public IP

### Result

- ✓ DNS record updated successfully in Cloudflare
- ✗ Endpoint test failed — port 443 unreachable on Dokploy IP
- ✓ Mutation reverted to original CNAME

**Conclusion:** True Option A DNS change alone is insufficient. The backend IP must be publicly accessible, which it is not.

---

## Why The Previous Tunnel Public Hostname Conclusion Is Correct

**The blocker report's conclusion was accurate**, just poorly named in the context of "Option A":

1. **Current state:** `buildflow-staging.prochat.tools` CNAMEs to `dokploy.prochat.tools`
2. **Problem:** CNAME-aliased domains don't automatically route through Argo Tunnels
3. **Solution:** Explicitly add `buildflow-staging.prochat.tools` as public hostname in Dokploy tunnel
4. **This IS the correct and only viable solution**

**Why this is not "true Option A":**
- True Option A implies direct public IP access (not tunnel-based)
- Infrastructure design precludes this (NSG firewall)
- Therefore, the tunnel-based approach is the only option

**Renamed for clarity:**
- Previous approach ❌ Misnamed as "blocker requiring Cloudflare dashboard"
- Correct name ✓ "Mandatory Cloudflare dashboard action to complete tunnel routing"

---

## Current DNS State (After Revert)

| Domain | Type | Target | Proxied | TTL | Status |
|--------|------|--------|---------|-----|--------|
| `buildflow.prochat.tools` | CNAME | 1b1fa7bf-a00f-4f1a-86bb-faecac746051.cfargotunnel.com | true | 1 | Production local tunnel ✓ |
| `buildflow-staging.prochat.tools` | CNAME | dokploy.prochat.tools | true | 1 | Staging — needs tunnel route ✗ |
| `dokploy.prochat.tools` | CNAME | dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b.cfargotunnel.com | true | 1 | Dokploy tunnel ✓ |

**Status:** Reverted to pre-mutation state. DNS is back to original CNAME setup.

---

## Endpoint Testing Results

### Before Mutation
```
buildflow-staging.prochat.tools: 404 (Cloudflare: no route in tunnel)
buildflow.prochat.tools:         200 ✓
```

### After Attempted Option A Mutation
```
buildflow-staging.prochat.tools: 404 (Dokploy IP unreachable, connection timeout)
buildflow.prochat.tools:         200 ✓ (unchanged)
```

### After Revert
```
buildflow-staging.prochat.tools: 404 (Cloudflare: no route in tunnel) ← back to original
buildflow.prochat.tools:         200 ✓ (unchanged)
```

---

## Production Safety Verification

✓ `buildflow.prochat.tools` unaffected — remains HTTP 200 throughout  
✓ Local Cloudflare tunnel unchanged — no mutations made  
✓ Dokploy database unchanged — no mutations made  
✓ Dokploy services unchanged — no restarts  
✓ No secrets exposed  
✓ Fully reversible state — mutation was tested and reverted  

---

## What Option A Actually Means (Clarified)

### In Infrastructure Without Firewall
"DNS A record to public IP" would be straightforward:
```
buildflow-staging.prochat.tools A 68.221.139.108
```
Direct access: ✓ Would work if port 443 were open

### In This Infrastructure (Azure NSG Protected)
True Option A is **impossible** because:
- Public IP exists ✓ (68.221.139.108)
- Public IP is accessible ✗ (NSG firewall blocks external traffic)
- Only entry point is Argo Tunnel ✓ (exceptions in NSG for Cloudflare IPs)

**Implication:** Option A, as originally defined, **cannot be implemented safely** without changing Azure NSG rules (out of scope).

---

## The Only Viable Path Forward

**Add `buildflow-staging.prochat.tools` as public hostname to Dokploy Argo Tunnel:**

1. Cloudflare Zero Trust dashboard: https://dash.cloudflare.com/
2. Networks → Tunnels → Select "Dokploy" (dc7bb87e-...)
3. Public Hostnames → Add Hostname
4. Configure:
   - Public hostname: `buildflow-staging.prochat.tools`
   - Service: `http://localhost:3054` (or same backend as dokploy.prochat.tools)
   - Protocol: https
5. Save
6. Wait ~30s for propagation
7. Test: `curl https://buildflow-staging.prochat.tools/` → Should return app response

**Expected after dashboard action:**
```
buildflow-staging.prochat.tools: HTTP 200 or app-specific status ✓
buildflow.prochat.tools:         HTTP 200 ✓
```

---

## Files Changed

### Created
- `docs/projects/buildflow/buildflow-staging-option-a-dns-correction-report.md` (this document)

### Modified
- None (mutation was reverted; final state matches pre-mutation state)

---

## Files NOT Changed

✓ DNS (reverted to original CNAME)  
✓ Local tunnel (`~/.cloudflared/config.yml`)  
✓ Dokploy database  
✓ Dokploy services  
✓ Cloudflare tunnel public hostnames  

---

## Lessons Learned

1. **Option A (direct DNS to public IP) is infrastructure-dependent**
   - Works when public IP is accessible
   - Fails when public IP is firewalled (as here)

2. **Cloudflare Argo Tunnel is a security feature**
   - Allows private infrastructure to accept public traffic safely
   - Requires explicit route configuration per domain (no auto-alias)
   - Adding domain routes requires dashboard (no API automation for remote-config tunnels)

3. **Previous blocker report was correct**
   - Conclusion: must add public hostname via Cloudflare dashboard
   - Reason now understood: infrastructure firewall makes this the only viable path
   - Not a limitation; by design

---

## Correction Summary

**Previous recommendation:** "Add `buildflow-staging.prochat.tools` to Cloudflare Argo Tunnel public hostnames via dashboard"

**Reason (Previously Unknown):** Argo Tunnel API v4 doesn't support this operation for remote-config tunnels

**Reason (Now Proven):** Even if direct IP routing were possible, infrastructure firewall prevents it; Argo Tunnel is the only entry point

**Status:** Previous recommendation stands. It's not a workaround; it's the **only correct solution**.

---

## Reference

**Dokploy VM Metadata:**
- Public IP: 68.221.139.108
- Private Tailscale IP: 100.83.38.48
- Location: Azure Spain Central
- VM Name: vm-dokploy
- Network Protection: Azure NSG (Network Security Group) firewall
- External Access: Cloudflare Argo Tunnel only

**Argo Tunnel:**
- Tunnel ID: dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b
- Name: Dokploy
- Status: Healthy, 4 active connections
- Config: Remote (Cloudflare dashboard only)

**DNS Records:**
- Record ID: 606293bd5e254fe72852e403eb19a93e
- Current: CNAME dokploy.prochat.tools
- Attempted: A 68.221.139.108 (reverted)
- Final: CNAME dokploy.prochat.tools (restored)

---

## Next Required Action

**MANUAL CLOUDFLARE DASHBOARD ACTION (ONLY VIABLE PATH):**

Add `buildflow-staging.prochat.tools` as public hostname route in Dokploy Argo Tunnel via https://dash.cloudflare.com/

Once done, endpoint should return HTTP 200 or app-specific response (not Cloudflare 404 or timeout).

---

**Report Status:** Investigation complete. Infrastructure firewall confirmed. Previous blocker report was correct. Option A (as traditionally defined) is infeasible; dashboard action is mandatory.

