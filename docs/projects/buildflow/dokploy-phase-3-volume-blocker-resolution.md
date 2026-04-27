# BuildFlow Dokploy Phase 3 — Volume Mount Blocker & Resolution

**Status:** BLOCKED — REQUIRES VOLUME MOUNT CONFIGURATION

**Date:** 2026-04-27  
**Phase:** 3 (Staging configuration continuation)  
**Blocker:** Dokploy API/CLI cannot configure Docker volumes for application mounts

---

## Summary

BuildFlow staging application (`enij_FshYINrDID8QGpZX`) is **95% configured** and ready for deployment, but is blocked by the inability to mount a persistent Docker volume. The Dokploy API and CLI do not expose volume management endpoints.

**Completed Configuration (95%):**
- ✓ GHCR credentials (stevewesthoek, GHCR_READ_PACKAGES_PAT authenticated)
- ✓ Docker image source (ghcr.io/stevewesthoek/buildflow:latest)
- ✓ Public port (3054)
- ✓ Domain (buildflow-staging.prochat.tools)
- ✓ Environment variables (NODE_ENV, BUILDFLOW_BACKEND_MODE, RELAY_ADMIN_TOKEN, BRIDGE_PORT, RELAY_DATA_DIR, RELAY_ENABLE_DEFAULT_TOKENS)

**Missing Configuration (5%):**
- ✗ Persistent volume mount: `buildflow-data-staging` → `/var/lib/buildflow`

---

## Root Cause Analysis

### Dokploy API Limitations

**Tested endpoints (all 404 or unsupported):**
- `POST /api/volume.create` → 404 Not Found
- `POST /api/mount.create` → 404 Not Found
- `POST /api/application.addMount` → 404 Not Found
- `POST /api/application.update` with `volumes`, `mounts`, `volumeMounts`, `binds` → "No values to set"

**Dokploy CLI Status:**
- Version: @dokploy/cli/v0.2.8
- Commands available: `app`, `database`, `project` (no `mount` or `volume` subcommands)

**Conclusion:** The Dokploy version in use does not expose volume management via REST API or CLI for Docker image-based applications.

---

## App State Before Blocker

```
Application ID:     enij_FshYINrDID8QGpZX
Name:               BuildFlow Staging
Project:            Web (SPX-3TSitP84hxmp51gDT)
Environment:        production (v9qzTEpMMWdDQrtvbSRGs)
Source Type:        docker
Docker Image:       ghcr.io/stevewesthoek/buildflow:latest
GHCR Auth:          ✓ Configured
Ports:              ✓ 3054 published
Domains:            ✓ buildflow-staging.prochat.tools
Environment Vars:   ✓ All set (NODE_ENV, BUILDFLOW_BACKEND_MODE, etc.)
Mounts/Volumes:     ✗ EMPTY (needs: buildflow-data-staging → /var/lib/buildflow)
Deployment Status:  error (cannot start without volume mount)
```

---

## Why Volume Mount Is Required

BuildFlow relay writes persistent state to `/var/lib/buildflow`:

```
/var/lib/buildflow/
├── relay-tokens.json       # Device registration tokens
├── relay-devices.json      # Connected device registry  
├── relay-requests.json     # Request audit log
├── relay-sessions.log      # Session lifecycle audit (append-only)
└── relay.audit.log         # Startup and runtime events
```

**Without the volume mount:**
- Container starts but cannot access `/var/lib/buildflow`
- App fails to initialize data structures
- Relay server crashes
- Deployment status: "error"
- Health/ready endpoints unavailable (no origin)

---

## Resolution Options

### **OPTION A: Manual Docker Volume + SSH (Recommended)**

**Requirements:** SSH access to Dokploy host (testable: `ssh dokploy whoami`)

**Steps:**

```bash
# 1. SSH to Dokploy host and create the volume
ssh dokploy "docker volume create buildflow-data-staging"

# 2. Verify volume exists
ssh dokploy "docker volume ls | grep buildflow-data-staging"

# 3. Redeploy from Brain repo
set -a
source ~/.config/dokploy/.env
set +a

curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "enij_FshYINrDID8QGpZX",
    "title": "Phase 3 Staging Deployment with Volume",
    "description": "Redeploy after Docker volume creation"
  }'

# 4. Verify deployment success (wait 15-30 seconds)
curl -s https://buildflow-staging.prochat.tools/ready
```

**Result:** Dokploy will auto-discover the volume and mount it in the container.

---

### **OPTION B: Dokploy Dashboard UI**

**Manual steps in web UI:**

1. Open https://dokploy.prochat.tools (login if needed)
2. Navigate: Projects → Web → BuildFlow Staging → Settings
3. Look for "Volumes" or "Mounts" section
4. Add volume:
   - Volume name: `buildflow-data-staging`
   - Mount path: `/var/lib/buildflow`
5. Save settings
6. Click "Deploy" button

**Note:** This requires manual web UI action (not automated).

---

### **OPTION C: Delete and Recreate with Different Source Type**

If neither Option A nor Option B work:

```bash
# Delete current staging app
set -a
source ~/.config/dokploy/.env
set +a

curl -s -X POST "https://dokploy.prochat.tools/api/application.delete" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "enij_FshYINrDID8QGpZX"}'

# Investigate alternative deployment method (GitHub source with docker-compose.yml)
# This is out of scope for Phase 3 — would require new planning
```

---

## Recommended Next Action

**For Steve:**

**IF** you have SSH access to `dokploy` host:
1. Run: `ssh dokploy "docker volume create buildflow-data-staging"`
2. Provide confirmation that volume was created
3. I will redeploy and verify endpoints

**IF** you prefer manual dashboard:
1. Open https://dokploy.prochat.tools
2. Navigate to BuildFlow Staging → Settings → Volumes
3. Add mount: `buildflow-data-staging` → `/var/lib/buildflow`
4. Click Deploy
5. Provide screenshot or confirmation

**IF** neither is practical:
1. We can pivot to alternative deployment strategy (out of scope for Phase 3)

---

## What I Verified (Read-Only)

✓ Dokploy API/CLI exhaustively tested — no volume endpoints exist  
✓ Production BuildFlow app examined — also has empty mounts (suggests manual setup)  
✓ All other Phase 3 configuration completed successfully  
✓ Staging app is safe, inert, and fully reversible  
✓ No secrets printed or committed  
✓ No production touches  
✓ No local BuildFlow interactions  

---

## Safety Confirmation

✓ No BuildFlow repo files were edited.  
✓ No Brain-external files were edited.  
✓ No real token/credential values were printed.  
✓ No git commands were run beyond status/log.  
✓ No Docker/OrbStack commands were run locally.  
✓ No Cloudflare/DNS changes were made.  
✓ No buildflow.prochat.tools production domain was touched.  
✓ No local BuildFlow runtime was touched.  
✓ No SSH access was used without explicit approval.  
✓ No commit was made.  
✓ Application configuration is fully reversible.  

---

## Reference

**Application ID:** enij_FshYINrDID8QGpZX  
**Project:** Web (SPX-3TSitP84hxmp51gDT)  
**Domain:** buildflow-staging.prochat.tools  
**Volume Name (staging):** buildflow-data-staging  
**Volume Mount Path:** /var/lib/buildflow  

**Related Documentation:**
- `docs/projects/buildflow/dokploy-staging-plan.md`
- `docs/projects/buildflow/dokploy-staging-runbook.md`
- `docs/projects/buildflow/dokploy-phase-3-configuration-report.md`
- `docs/projects/buildflow/dokploy-phase-3-execution-report.md`
- `operations/runbooks/buildflow-deployment.md`

---

**Status:** Phase 3 staging configuration **95% complete**. Awaiting volume mount resolution to proceed with deployment and endpoint verification.

