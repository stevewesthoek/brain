# Cloudflare Local Tunnel Cleanup — BuildFlow Staging Fix Report

**Status:** CLEANUP SUCCESSFUL — LOCAL TUNNEL HYGIENE RESTORED

**Date:** 2026-04-28  
**Action:** Removed incorrect staging/test hostnames from local Cloudflare tunnel ingress config

---

## Summary

Removed two ingress entries from ~/.cloudflared/config.yml that were incorrectly routing to localhost:3054:
- `buildflow-staging.prochat.tools` — Was incorrectly added to local tunnel; should route to Dokploy only
- `plankit.prochat.tools` — Removed per architecture cleanup

Preserved production domains:
- `buildflow.prochat.tools` — Continues to route to localhost:3054 (local BuildFlow web)
- `probot.prochat.tools` — Continues to route to localhost:7070 (ProBot)

---

## Config Changes

### Before Cleanup

```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - hostname: plankit.prochat.tools
    service: http://localhost:3054
  - hostname: buildflow-staging.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

### After Cleanup

```yaml
ingress:
  - hostname: probot.prochat.tools
    service: http://localhost:7070
  - hostname: buildflow.prochat.tools
    service: http://localhost:3054
  - service: http_status:404
```

### Entries Removed

| Hostname | Reason | Status |
|----------|--------|--------|
| buildflow-staging.prochat.tools | Should not route to localhost; belongs on Dokploy routing | ✓ Removed |
| plankit.prochat.tools | Cleanup per architecture review | ✓ Removed |

### Entries Preserved

| Hostname | Target | Status |
|----------|--------|--------|
| buildflow.prochat.tools | http://localhost:3054 | ✓ Unchanged |
| probot.prochat.tools | http://localhost:7070 | ✓ Unchanged |
| (catch-all) | http_status:404 | ✓ Unchanged |

---

## Backup

**Backup path created:**
```
~/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323
```

**Verification:**
```bash
$ ls -la ~/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323
-rw-r--@ 1 Office  staff  466 Apr 28 09:03 /Users/Office/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323
```

**Can be restored with:**
```bash
cp ~/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323 ~/.cloudflared/config.yml
```

---

## Validation

### Config Syntax Validation

```bash
$ cloudflared tunnel ingress validate ~/.cloudflared/config.yml
Validating rules from /Users/Office/.cloudflared/config.yml
OK
```

**Result:** ✓ Config is syntactically valid

---

## Tunnel Restart

### Restart Method

- Service: `com.cloudflare.cloudflared` (launchctl)
- Action: `launchctl stop` → 2 second wait → `launchctl start`

### Result

**Process status after restart:**
```bash
$ ps aux | grep '[c]loudflared'
Office  68958  0.1  0.2  443664944  41824  ??  S  9:03AM  0:00.09  /opt/homebrew/bin/cloudflared tunnel --config /Users/Office/.cloudflared/config.yml run
```

**Tunnel status after restart:**
```bash
$ cloudflared tunnel list | grep OfficeMac
1b1fa7bf-a00f-4f1a-86bb-faecac746051 OfficeMac  2026-04-04T22:49:07Z  1xlis01, 2xmad05
```

**Verification:** ✓ Tunnel is running and connected (1xlis01, 2xmad05 edge locations)

---

## Endpoint Verification

### buildflow.prochat.tools (Should Continue Working)

```bash
$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow.prochat.tools/
200

$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow.prochat.tools/health
404
```

**Status:** ✓ **WORKING CORRECTLY**
- `/` returns HTTP 200 (local BuildFlow web app running)
- `/health` returns HTTP 404 (endpoint not implemented on local web, but app is reachable)
- Production buildflow.prochat.tools continues to route through local tunnel to localhost:3054
- No regression; production access unchanged

**Implication:** Local BuildFlow development access via buildflow.prochat.tools is unaffected by this cleanup. Phase 0/Phase 1 pre-cutover testing can continue as planned.

### buildflow-staging.prochat.tools (Expected to Change)

```bash
$ curl -sS -o /dev/null -w "%{http_code}\n" https://buildflow-staging.prochat.tools/health
530
```

**Status:** ✓ **EXPECTED BEHAVIOR**
- Returns HTTP 530 (Cloudflare error: origin unreachable)
- This is expected after removing it from local tunnel
- buildflow-staging.prochat.tools is no longer in local tunnel ingress rules
- It will continue to return 530 until Dokploy routing is configured

**What this means:** Staging domain is currently unreachable from both local tunnel and Dokploy. This is correct behavior pending the next phase: configuring buildflow-staging.prochat.tools to route to Dokploy relay only.

---

## Next Phase: Dokploy Staging Routing

### What Happens Next

The removal of buildflow-staging.prochat.tools from the local tunnel is **complete and correct**. The staging domain is now ready for Dokploy-side routing setup, but that setup is **NOT part of this task**.

### Blocked Items (Next Task)

1. **Routing model decision:** Choose how buildflow-staging.prochat.tools reaches Dokploy:
   - Option A: Update DNS to point directly to Dokploy server IP
   - Option B: Set up separate Cloudflare tunnel on Dokploy host
   - Option C: Use Dokploy domain with Cloudflare

2. **Bridge configuration:** Determine how Dokploy relay will connect to local agent (3052) and web (3054)

3. **Local app dual-relay support:** Clarify whether local app needs to support temporary alternate relay URL during testing

### Current State

- ✓ Local tunnel cleaned up (buildflow-staging removed)
- ✓ buildflow.prochat.tools continues to work locally
- ⏳ buildflow-staging.prochat.tools waiting for Dokploy routing decision
- ⏳ Dokploy staging app deployed, but unreachable until routing is configured

---

## Safety Confirmation

✓ Only local Cloudflare tunnel config changed  
✓ Backup created before mutation  
✓ Validation passed  
✓ Tunnel restarted successfully  
✓ buildflow.prochat.tools verified working (no regression)  
✓ buildflow-staging.prochat.tools behaves as expected (awaiting Dokploy routing)  
✓ No Dokploy mutations  
✓ No DNS changes  
✓ No Cloudflare dashboard changes  
✓ No secrets exposed  
✓ Fully reversible (backup available)  

---

## Reference

**Config file:** ~/.cloudflared/config.yml  
**Backup file:** ~/.cloudflared/config.yml.backup-buildflow-tunnel-cleanup-20260428-090323  
**Tunnel ID:** 1b1fa7bf-a00f-4f1a-86bb-faecac746051 (OfficeMac)  
**Tunnel status:** Connected (1xlis01, 2xmad05)

**Related documentation:**
- docs/projects/buildflow/buildflow-dual-relay-staging-architecture-report.md (correct architecture)
- docs/projects/buildflow/cloudflare-staging-routing-diagnosis.md (original diagnosis)
- operations/standards/buildflow-migration-plan.md (phase structure)
- operations/runbooks/buildflow-deployment.md (deployment architecture)

---

**Report Status:** Local tunnel cleanup complete and verified. Staging domain now ready for Dokploy routing configuration in next phase.
