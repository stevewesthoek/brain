# BuildFlow Dokploy Phase 3 Staging Runbook

**Status:** DRAFT — DO NOT RUN MUTATION STEPS WITHOUT STEVE APPROVAL

**Date:** 2026-04-27  
**Phase:** 3 (Staging preparation and validation)  
**Target:** buildflow-staging.prochat.tools (staging only)

---

## Purpose

This runbook prepares Phase 3 staging deployment of BuildFlow on Dokploy at buildflow-staging.prochat.tools. 

**This does not authorize production cutover. Production buildflow.prochat.tools cutover is Phase 4 only and requires explicit approval.**

---

## Absolute Safety Boundaries

**Protected Always:**

- ✋ Do not touch buildflow.prochat.tools (Phase 4 only)
- ✋ Do not touch Steve's local BuildFlow runtime
- ✋ Do not read or edit BuildFlow apps/web/.env.local
- ✋ Do not use Steve's local BUILDFLOW_ACTION_TOKEN
- ✋ Do not pull, clone, fetch, build, install, or run BuildFlow locally
- ✋ Do not run Docker or OrbStack locally
- ✋ Do not change Cloudflare or production DNS
- ✋ Do not decommission local BuildFlow
- ✋ Build/deploy must happen through Dokploy/GitHub Actions only

---

## Current Plan Source

**Staging Plan:**  
`docs/projects/buildflow/dokploy-staging-plan.md`

**Commit Reference:**  
Planning completed 2026-04-27 (hardened 2026-04-27)

---

## Read-Only Checks Performed

**Dokploy API Discovery (Safe Read-Only):**

| Check | Endpoint | Result |
|-------|----------|--------|
| List projects | `GET /api/project.all` | ✓ Success |
| Web project found | Project list query | ✓ Found: `SPX-3TSitP84hxmp51gDT` |
| Web project app count | Project detail query | ✓ 0 apps (empty) |
| Search BuildFlow apps | Application filter | ✓ None found |
| Search buildflow domains | Domain filter | ✓ None found |

**Key Discoveries:**

1. ✓ Web project exists: `SPX-3TSitP84hxmp51gDT`
2. ✓ Web project is empty (0 existing apps)
3. ✓ No BuildFlow app currently exists on Dokploy
4. ✓ No buildflow.prochat.tools or buildflow-staging.prochat.tools domains currently in use
5. ⏳ GHCR image availability: not verified (requires BuildFlow repo inspection or image metadata query)
6. ⏳ GitHub Actions workflow: not verified (requires BuildFlow repo inspection)
7. ⏳ Staging domain DNS: not verified (requires Cloudflare confirmation)

---

## Required Staging Target

**Staging Deployment Configuration:**

| Property | Value |
|----------|-------|
| Staging Domain | buildflow-staging.prochat.tools |
| Dokploy Project | Web (ID: `SPX-3TSitP84hxmp51gDT`) |
| Application Name | BuildFlow (staging) |
| Docker Image | `ghcr.io/stevewesthoek/buildflow:latest` |
| Public Container Port | 3054 (HTTPS) |
| Internal Relay Port | 3053 (internal only) |
| Internal Web App Port | 3055 (internal only) |
| Volume Name | buildflow-data-staging |
| Volume Mount Path | /var/lib/buildflow |
| Source Type | Docker Image (GHCR pull-only) |

**GHCR Authentication (Critical):**

- Username: `stevewesthoek`
- Password: `<GitHub PAT with read:packages scope>`
- Registry URL: `ghcr.io`
- Registry ID: `null` (NOT set — avoids Swarm mode permission errors)

---

## Required Environment Variables

**Names Only (Placeholder Values):**

```
NODE_ENV=production
BUILDFLOW_BACKEND_MODE=relay-agent
RELAY_ENABLE_DEFAULT_TOKENS=false
BRIDGE_PORT=3053
RELAY_DATA_DIR=/var/lib/buildflow
RELAY_ADMIN_TOKEN=<new-staging-secret-not-printed>
```

**Do not include real secret values in any git-tracked file.**

---

## Staging-Only Mutation Plan — NOT YET RUN

**CRITICAL: No mutation command runs until Steve explicitly approves Phase 3 staging execution.**

### Step 1: Create Staging Application

**NOT YET RUN — requires Steve approval**

```bash
# Load API credentials without printing
set -a
source ~/.config/dokploy/.env
set +a

# Create staging app
# NOTE: Exact payload fields may vary — verify from Dokploy API docs
# This is template pseudocode only
curl -X POST "https://dokploy.prochat.tools/api/application.create" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BuildFlow (staging)",
    "projectId": "SPX-3TSitP84hxmp51gDT",
    "sourceType": "docker_image",
    "dockerImage": "ghcr.io/stevewesthoek/buildflow:latest"
  }'
```

**Uncertainty:** Exact `/api/application.create` payload fields not proven from Brain docs. Brain docs show manual Dokploy dashboard steps, not exact API payload schema. **Do not run until verified.**

### Step 2: Configure GHCR Pull Credentials

**NOT YET RUN — requires Steve approval**

```bash
# Set GHCR authentication on the staging app
# This prevents "Registry Swarm mode" permission errors
# NOTE: Exact field names and endpoint may vary
curl -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id-from-step-1>",
    "username": "stevewesthoek",
    "password": "<GitHub-PAT-with-read-packages>",
    "registryUrl": "ghcr.io",
    "registryId": null
  }'
```

**Uncertainty:** Exact field names and API endpoint not proven from Brain docs. **Do not run until verified.**

### Step 3: Configure Ports and Volume

**NOT YET RUN — requires Steve approval**

```bash
# Configure public port, internal relay/web ports, and persistent volume
curl -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id>",
    "ports": [
      {
        "published": 3054,
        "target": 3054,
        "protocol": "tcp"
      }
    ],
    "volumes": [
      {
        "name": "buildflow-data-staging",
        "mountPath": "/var/lib/buildflow"
      }
    ]
  }'
```

**Uncertainty:** Port and volume configuration payload not proven from Brain docs. **Do not run until verified.**

### Step 4: Configure Environment Variables

**NOT YET RUN — requires Steve approval**

```bash
# Set environment variables for staging
curl -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id>",
    "environmentVariables": {
      "NODE_ENV": "production",
      "BUILDFLOW_BACKEND_MODE": "relay-agent",
      "RELAY_ENABLE_DEFAULT_TOKENS": "false",
      "BRIDGE_PORT": "3053",
      "RELAY_DATA_DIR": "/var/lib/buildflow",
      "RELAY_ADMIN_TOKEN": "<new-staging-secret>"
    }
  }'
```

**Uncertainty:** Environment variable field names and payload structure not proven from Brain docs. **Do not run until verified.**

### Step 5: Configure Staging Domain

**NOT YET RUN — requires Steve approval**

```bash
# Configure the public staging domain
# NOTE: Assumes buildflow-staging.prochat.tools already exists in Cloudflare DNS
curl -X POST "https://dokploy.prochat.tools/api/domain.create" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id>",
    "domain": "buildflow-staging.prochat.tools",
    "path": "/",
    "port": 3054,
    "https": true
  }'
```

**Uncertainty:** Domain configuration API endpoint and payload not proven from Brain docs. **Do not run until verified.**

### Step 6: Trigger Initial Deployment

**NOT YET RUN — requires Steve approval**

```bash
# Trigger the first deployment
curl -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id>",
    "title": "Staging deployment initialization",
    "description": "Initial Phase 3 staging deployment"
  }'
```

**Expected:** Container starts, GHCR image pulls, ports expose internally (3053, 3055) and publicly (3054).

---

## Staging Verification Checklist

**After deployment only. All endpoints use staging domain only.**

**NOT YET RUN — requires Steve approval**

```bash
# Health/readiness checks
curl https://buildflow-staging.prochat.tools/ready
# Expected: 200 OK {"ready": true, ...}

curl https://buildflow-staging.prochat.tools/health
# Expected: 200 OK {status: "ok", bridgeRunning: true, ...}
# CRITICAL: No device IDs exposed

# API schema
curl https://buildflow-staging.prochat.tools/api/openapi
# Expected: 200 OK {openapi: "3.1.0", ...}

# Device registration (no auth required)
curl -X POST https://buildflow-staging.prochat.tools/api/register \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 200 OK with device token

# Admin endpoints (requires RELAY_ADMIN_TOKEN)
curl -H "Authorization: Bearer $STAGING_RELAY_ADMIN_TOKEN" \
  https://buildflow-staging.prochat.tools/api/admin/devices
# Expected: 200 OK with device list (empty initially)

# WebSocket upgrade (staging only)
curl -i -N -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  https://buildflow-staging.prochat.tools/api/bridge/ws
# Expected: 101 Switching Protocols (or 401 if auth required)
```

---

## Monitoring & Stability (After Deployment)

**NOT YET RUN — requires Steve approval**

```bash
# Monitor startup logs for 5 minutes
# (via Dokploy dashboard or SSH access)

# Check for errors or warnings in relay startup logs

# Verify no device IDs leak in /health response

# Verify persistent volume has write access

# Document any unexpected behavior
```

**Minimum 24-hour observation period before proceeding to next phase.**

---

## Explicit Non-Goals

❌ **Do not attempt Phase 4 production cutover**  
❌ **Do not switch buildflow.prochat.tools**  
❌ **Do not make Cloudflare/DNS production changes**  
❌ **Do not clean up local BuildFlow**  
❌ **Do not modify local BuildFlow configuration**  
❌ **Do not reuse Steve's local BUILDFLOW_ACTION_TOKEN**

This phase is **staging only** until explicitly approved for Phase 4.

---

## Approval Gate

**CRITICAL APPROVAL REQUIRED BEFORE PROCEEDING:**

Steve must explicitly approve Phase 3 staging mutation before any Dokploy create/update/deploy command is run.

**Approval should confirm:**

1. ✓ Staging plan reviewed and understood
2. ✓ Safety boundaries are clear
3. ✓ buildflow-staging.prochat.tools DNS is ready
4. ✓ Staging-only RELAY_ADMIN_TOKEN has been generated
5. ✓ GHCR PAT with read:packages scope is available
6. ✓ Any unproven API payload fields have been verified

**Once approved, follow steps 1–6 in sequence, then verify checklist.**

---

## References

**Brain Documentation:**
- `docs/projects/buildflow/dokploy-staging-plan.md` — staging plan
- `operations/runbooks/dokploy.md` — Dokploy general workflow
- `operations/runbooks/buildflow-deployment.md` — BuildFlow deployment details
- `operations/standards/buildflow-dockerfile-contract.md` — container topology
- `operations/standards/buildflow-migration-plan.md` — 5-phase migration plan
- `operations/deploy/dokploy-image-deploy.yml` — GitHub Actions template

**External:**
- BuildFlow repo: `.github/workflows/deploy.yml` (verify workflow exists)
- BuildFlow repo: `Dockerfile` (verify proxy + relay + web topology)
- Dokploy server: `https://dokploy.prochat.tools` (API and dashboard)

---

**Status:** Runbook draft complete. Awaiting explicit Steve approval before Phase 3 mutation execution.
