# BuildFlow Dokploy Phase 3 — Credential Blocker Report

**Status:** CONFIGURATION BLOCKED — GHCR CREDENTIAL MISSING

**Date:** 2026-04-27  
**Phase:** 3 (Staging configuration continuation)

---

## Summary

The BuildFlow staging application was successfully created in Phase 3a:
- **Application ID:** `enij_FshYINrDID8QGpZX`
- **Application Name:** BuildFlow Staging
- **Project:** Web (ID: `SPX-3TSitP84hxmp51gDT`)
- **Image:** ghcr.io/stevewesthoek/buildflow:latest

However, the application cannot proceed to configuration/deployment until the missing GHCR credential is provided.

---

## Current Application State

| Property | Value | Status |
|----------|-------|--------|
| Application ID | enij_FshYINrDID8QGpZX | Confirmed |
| Project ID | SPX-3TSitP84hxmp51gDT | Confirmed |
| App Name | BuildFlow Staging | Confirmed |
| Image | ghcr.io/stevewesthoek/buildflow:latest | Set at create |
| Domain | buildflow-staging.prochat.tools | **Not yet configured** |
| GHCR Credentials | username: stevewesthoek, password: MISSING | **Blocks configuration** |
| Ports | 3054 public, 3053/3055 internal | **Not yet configured** |
| Volume | /var/lib/buildflow | **Not yet configured** |
| Environment Variables | NODE_ENV, BUILDFLOW_BACKEND_MODE, etc. | **Not yet configured** |
| Deployment Status | Not yet triggered | **Blocked** |

---

## Missing Credential Details

**Required for configuration:**
- GitHub PAT with `read:packages` scope (used for GHCR image pull authentication)
- Must be provided by Steve (cannot be auto-generated or assumed)

**Why it's needed:**
- Dokploy must authenticate to GHCR to pull `ghcr.io/stevewesthoek/buildflow:latest`
- Without credentials, the container image pull will fail with 401 Unauthorized
- This is a critical blocker — all subsequent configuration depends on successful image pull

**Environment variable check (completed 2026-04-27):**
- Checked for: `GHCR_READ_PACKAGES_PAT`, `GITHUB_PAT`, `BUILDFLOW_GHCR_PAT`, and similar patterns
- Result: No credential variables found in environment
- Status: Not available via safe environment variable

---

## Configuration Blocked

The following Phase 3 configuration steps are **NOT YET RUN** and blocked until the GHCR credential is provided:

1. ⏳ Configure GHCR pull credentials (username: stevewesthoek, password: MISSING)
2. ⏳ Configure ports (3054 public, 3053/3055 internal)
3. ⏳ Configure volume (/var/lib/buildflow)
4. ⏳ Configure environment variables (NODE_ENV, BUILDFLOW_BACKEND_MODE, RELAY_ENABLE_DEFAULT_TOKENS, BRIDGE_PORT, RELAY_DATA_DIR, RELAY_ADMIN_TOKEN)
5. ⏳ Configure staging domain (buildflow-staging.prochat.tools)
6. ⏳ Trigger deployment
7. ⏳ Verify health endpoints

---

## Safe Application State

The staging app is in a safe, inert state:
- ✓ App created but not configured
- ✓ No GHCR credentials set (image pull will fail if deployment is attempted without auth)
- ✓ No ports configured (no traffic can reach it)
- ✓ No volume mounted (startup will fail without data directory)
- ✓ No environment variables set
- ✓ No domain configured
- ✓ Not deployed
- ✓ Fully reversible — can be deleted or reconfigured once credential is provided

---

## Next Action for Steve

**Provide the missing GitHub PAT credential:**

1. Generate or retrieve a GitHub PAT with `read:packages` scope:
   - https://github.com/settings/tokens
   - Scope: `read:packages` (for GHCR image pulls)
   - Do NOT commit or email the PAT — provide it through secure channel only

2. Provide the PAT to the next Phase 3 continuation prompt

3. Once provided, Phase 3 configuration will proceed:
   - Set GHCR credentials (username: stevewesthoek, password: your-PAT)
   - Configure ports (3054 public, 3053/3055 internal)
   - Configure volume (/var/lib/buildflow → buildflow-data-staging)
   - Set environment variables (NODE_ENV=production, BUILDFLOW_BACKEND_MODE=relay-agent, RELAY_ADMIN_TOKEN=new-staging-secret, BRIDGE_PORT=3053, RELAY_DATA_DIR=/var/lib/buildflow, RELAY_ENABLE_DEFAULT_TOKENS=false)
   - Configure domain (buildflow-staging.prochat.tools)
   - Trigger deployment
   - Verify health endpoints

---

## Reference

**Application ID for CLI/API reference:** `enij_FshYINrDID8QGpZX`

**Dokploy project:** Web (SPX-3TSitP84hxmp51gDT)

**Related documentation:**
- `docs/projects/buildflow/dokploy-staging-plan.md`
- `docs/projects/buildflow/dokploy-staging-runbook.md`
- `docs/projects/buildflow/dokploy-phase-3-execution-report.md`
- `operations/runbooks/buildflow-deployment.md`

---

## Safety Confirmation

✓ No BuildFlow repo files were edited.  
✓ No Brain-external files were edited.  
✓ No credentials were printed.  
✓ No git commands were run.  
✓ No Docker commands were run locally.  
✓ No Cloudflare changes were made.  
✓ No buildflow.prochat.tools production changes were made.  
✓ No local BuildFlow runtime was touched.  
✓ No commit was made.  

---

**Status:** Blocker documented. Awaiting Steve's GitHub PAT credential to resume Phase 3 configuration.
