# BuildFlow Dokploy Staging Plan

**Date:** 2026-04-27  
**Status:** Phase 2 / Phase 3 planning (staging preparation only)  
**Approval Gate:** Before any Dokploy staging create/update/deploy command is run, Steve must review this plan and explicitly approve Phase 3 staging execution.

---

## Status

This is Phase 2 / Phase 3 planning for BuildFlow Dokploy staging. **It does not authorize production cutover.**

**Current State (Phase 0):**
- Local BuildFlow runs on localhost:3054 through Steve's local setup (per Brain docs, not touched in this phase)
- buildflow.prochat.tools currently points to Steve's local BuildFlow through Cloudflare tunnel (per Brain docs, protected)
- ⏳ Production relay does NOT exist yet on Dokploy

**Next Steps (This Phase):**
- Create staging deployment plan and runbook
- Prepare safe Dokploy staging commands (read-only first, then create/deploy if approved)
- Use buildflow-staging.prochat.tools for all staging tests
- Verify staging topology and endpoints
- Do NOT touch production domain or local BuildFlow

---

## Safety Boundaries

**Protected (Do Not Touch):**

- Do not touch Steve's current local BuildFlow runtime
- Do not edit or read BuildFlow apps/web/.env.local
- Do not change Steve's current local BUILDFLOW_ACTION_TOKEN
- Do not switch buildflow.prochat.tools
- Do not change production DNS or Cloudflare routes
- Do not decommission local BuildFlow
- Do not commit changes without explicit approval
- **Do not pull, clone, fetch, build, install, or run BuildFlow locally for this staging deployment.** Build/deploy happens through Dokploy/GitHub Actions only. No `git pull`, `git clone`, `docker pull`, `docker build`, `pnpm install`, or `pnpm build` commands in this phase.

**Allowed (Staging Only):**

- Use buildflow-staging.prochat.tools first
- Create staging-only Dokploy secrets (separate from production)
- Create/update Dokploy staging app only
- Read Dokploy CLI status and list commands
- Prepare staging deployment scripts and runbooks

---

## Canonical Sequence

1. **Phase 0 (Current):** Local buildflow.prochat.tools points to Steve's local BuildFlow through Cloudflare tunnel
2. **Phase 2/3 (This):** Build/test Dokploy BuildFlow at buildflow-staging.prochat.tools
3. **Phase 4:** Switch buildflow.prochat.tools only after staging is proven and Steve explicitly approves
4. **Phase 5:** Clean up local only after production is proven stable and Steve explicitly approves

---

## Target Dokploy Topology

**Container Image:** `ghcr.io/stevewesthoek/buildflow:latest` (built by GitHub Actions)

**Internal Container Architecture:**

```
Container (one Docker image)
├── Internal proxy (nginx, express, or fastify) listening on port 3054 (public container port)
│   └── Routes paths to correct internal backend (relay vs web)
├── Relay server (port 3053, internal only)
│   ├── POST /api/register       → device token generation
│   ├── WebSocket /api/bridge/ws → connected devices
│   ├── GET /health              → aggregate operational status (no device IDs exposed)
│   ├── GET /ready               → startup validation
│   └── GET/POST /api/admin/*    → admin endpoints (RELAY_ADMIN_TOKEN auth)
├── Web app (port 3055, internal only)
│   ├── GET /api/openapi         → ChatGPT schema
│   ├── POST /api/actions/*      → forwards user device token to relay
│   └── GET /dashboard           → dashboard UI
└── Persistent volume: /var/lib/buildflow/ (mounted from Dokploy)
    ├── relay-tokens.json
    ├── relay-devices.json
    ├── relay-requests.json
    ├── relay-sessions.log
    └── relay.audit.log
```

**Dokploy Configuration:**

- **Project:** Web
- **Application Name:** BuildFlow (staging)
- **Source Type:** Docker Image
- **Docker Image:** `ghcr.io/stevewesthoek/buildflow:latest`
- **Public staging domain:** buildflow-staging.prochat.tools
- **Public container port:** 3054 (HTTPS)
- **Persistent volume:** buildflow-data-staging
- **Volume mount point:** /var/lib/buildflow

---

## Token Model

**Admin Operations:**
- `RELAY_ADMIN_TOKEN` — only for admin endpoints (`/api/admin/*`), never shared with users

**User Authentication:**
- Users register devices via `POST /api/register` (no token required)
- Each device gets a unique device token
- Subsequent requests use user's device token in Bearer header
- Relay maps token → deviceId and enforces permissions
- Web app forwards user's Bearer token to relay for validation

**Staging Tokens (NEW, Not Reused):**
- Generate new staging-only `RELAY_ADMIN_TOKEN` for staging environment
- Do NOT reuse Steve's local BUILDFLOW_ACTION_TOKEN
- Staging device tokens are independent from production

**Token Lifecycle:**
- `RELAY_PROXY_TOKEN` is deprecated/historical and must not be used as current guidance
- `BUILDFLOW_ACTION_TOKEN` was for local direct-mode testing; hosted relay-agent mode uses device tokens instead

---

## Brain Repo Dokploy Tooling Found

### Files & Documentation

✅ **Runbooks (comprehensive):**
- `operations/runbooks/dokploy.md` — General Dokploy workflow (CI/CD, GHCR pull, deployment)
- `operations/runbooks/buildflow-deployment.md` — BuildFlow-specific deployment runbook (85+ pages)

✅ **Standards & Migration:**
- `operations/standards/buildflow-dockerfile-contract.md` — Dockerfile topology requirements
- `operations/standards/buildflow-migration-plan.md` — 5-phase migration plan (local → production)
- `operations/standards/buildflow-relay-privacy.md` — Privacy guidelines for relay

✅ **Deployment Config Templates:**
- `operations/deploy/dokploy-image-deploy.yml` — Canonical GitHub Actions workflow template
- `operations/deploy/dokploy-deploy.yml` — Minimal trigger workflow (for apps that build on Dokploy)
- `operations/deploy/dockerfile-standard.md` — Standard Dockerfile template

✅ **Dokploy CLI:**
- `dokploy` is aliased to `ssh dokploy` (SSH access to Dokploy VM)
- No local `dokploy` CLI tool installed (Dokploy is accessed via API or SSH)
- **Safe commands:** `curl` with `x-api-key` to `https://dokploy.prochat.tools/api/*`

### Key Discoveries

1. **Dokploy Architecture:** Uses GitHub Actions to build images (not Dokploy), pushes to GHCR, then Dokploy pulls and deploys
2. **GHCR Authentication:** Must use `username/password/registryUrl` fields, NOT `registryId` (which triggers Swarm mode and permission errors)
3. **API Access:** Requires `~/.config/dokploy/.env` with `DOKPLOY_API_KEY`
4. **Deployment Metadata:** Commit subject, author, date, SHA are passed to Dokploy so deployments show real commit messages
5. **Staging Pattern:** No pre-built staging app pattern yet; this plan establishes staging conventions

---

## Proposed Staging Implementation Steps

**Pre-Deployment Verification (Not Yet Run in This Plan):**

1. ⏳ Confirm Dokploy CLI authentication via `curl` with `x-api-key` (read-only: list apps) — requires Steve approval to execute
2. ⏳ Verify GHCR image exists: `ghcr.io/stevewesthoek/buildflow:latest` — requires BuildFlow repo inspection or Dokploy metadata check (cannot verify by pulling locally)
3. ⏳ Verify GitHub Actions workflow builds and pushes the BuildFlow image on every push to main — requires BuildFlow repo inspection

**Dokploy Staging App Creation (Requires Approval):**

4. Create staging app in Dokploy Web project named "BuildFlow (staging)"
5. Configure Docker image: `ghcr.io/stevewesthoek/buildflow:latest`
6. Configure public staging domain: `buildflow-staging.prochat.tools`
7. Set public container port: 3054 (HTTPS via Dokploy)
8. Set internal relay port: 3053 (internal only)
9. Set internal web app port: 3055 (internal only)
10. Create persistent volume: `buildflow-data-staging`
11. Mount volume to container path: `/var/lib/buildflow`

**Environment Configuration (Requires Approval):**

12. Set environment variables (staging-only secrets):
    - `NODE_ENV=production`
    - `BUILDFLOW_BACKEND_MODE=relay-agent`
    - `RELAY_ENABLE_DEFAULT_TOKENS=false` (for production-grade setup)
    - `BRIDGE_PORT=3053` (internal relay port)
    - `RELAY_DATA_DIR=/var/lib/buildflow`
    - `RELAY_ADMIN_TOKEN=<new-staging-secret>` (generate: `openssl rand -hex 32`)
13. Set GHCR pull credentials:
    - `username: stevewesthoek`
    - `password: <GitHub PAT with read:packages scope>`
    - `registryUrl: ghcr.io`
    - `registryId: null` (critical: NOT set)

**Staging Deployment (Requires Approval):**

14. Trigger initial Dokploy deployment
15. Wait for container startup (30-60 seconds)
16. Monitor startup logs for errors

**Staging Verification (Requires Approval):**

17. Verify health endpoint: `curl https://buildflow-staging.prochat.tools/ready`
18. Verify readiness: `curl https://buildflow-staging.prochat.tools/health`
19. Verify OpenAPI schema: `curl https://buildflow-staging.prochat.tools/api/openapi`
20. Verify device registration: `curl -X POST https://buildflow-staging.prochat.tools/api/register -H "Content-Type: application/json" -d '{}'`
21. Verify admin auth: `curl -H "Authorization: Bearer $STAGING_RELAY_ADMIN_TOKEN" https://buildflow-staging.prochat.tools/api/admin/devices`
22. Verify WebSocket upgrade: `curl -i -N -H "Upgrade: websocket" -H "Connection: Upgrade" https://buildflow-staging.prochat.tools/api/bridge/ws`

**Stability & Monitoring (Requires Approval):**

23. Monitor staging logs for 24 hours (no critical errors)
24. Verify no device IDs are exposed in `/health` response
25. Document any issues or unexpected behavior
26. Confirm staging is ready for Phase 3 validation testing

---

## Open Questions (Unverified, Require BuildFlow Repo Inspection or Steve Confirmation)

- **Dockerfile Status:** BuildFlow Dockerfile must implement one container with proxy + relay + web (per `operations/standards/buildflow-dockerfile-contract.md`). Is this already implemented in the approved BuildFlow branch/tag/commit selected for staging?
- **GHCR Image Availability:** Does `ghcr.io/stevewesthoek/buildflow:latest` exist? (Verification requires BuildFlow repo inspection or Dokploy metadata, not local docker pull.)
- **GitHub Workflow:** Is `.github/workflows/deploy.yml` already present in BuildFlow repo with `DOKPLOY_API_KEY` and `DOKPLOY_APP_ID` secrets? (Requires BuildFlow repo inspection.)
- **Staging Domain:** Is `buildflow-staging.prochat.tools` already configured in Cloudflare DNS to point to Dokploy VM? (Requires Cloudflare/DNS confirmation.)
- **Existing App ID:** Does a BuildFlow staging app already exist in Dokploy, or does this plan need to create it from scratch? (Can be verified via read-only Dokploy API call once approved.)
- **Volume Permissions:** Will the staging app have write access to the persistent volume at `/var/lib/buildflow`? (Typical Dokploy default, but confirm on deployment.)

---

## Commands Reviewed

**Read-Only Commands (Safe, Non-Destructive):**

```bash
# List all Dokploy projects and apps (safe read)
curl -s "https://dokploy.prochat.tools/api/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | jq '.[] | {name, applicationId, applicationStatus}'

# Check specific app status
curl -s "https://dokploy.prochat.tools/api/application.one?applicationId=<app-id>" \
  -H "x-api-key: $DOKPLOY_API_KEY" | jq '.applicationStatus'
```

**Proposed Create/Update Commands (NOT YET RUN — requires Steve approval):**

```bash
# CRITICAL: No Dokploy create/update/deploy command may run until Steve explicitly approves Phase 3 staging execution.
# These are template examples only.

# 1. Create staging app (pseudo-code)
curl -X POST "https://dokploy.prochat.tools/api/application.create" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BuildFlow (staging)",
    "projectId": "<web-project-id>",
    "sourceType": "docker_image",
    "dockerImage": "ghcr.io/stevewesthoek/buildflow:latest"
  }'

# 2. Configure environment (pseudo-code)
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
      "RELAY_ADMIN_TOKEN": "<staging-token>"
    }
  }'

# 3. Trigger deployment (pseudo-code)
curl -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<staging-app-id>",
    "title": "Staging deployment initialization"
  }'
```

---

## Next Approval Gate

**Before any create/update/deploy command is run against Dokploy staging, Steve must:**

1. Review this staging plan
2. Verify all safety boundaries are understood
3. Confirm buildflow-staging.prochat.tools DNS is ready
4. Explicitly approve Phase 3 staging execution
5. Provide staging-specific secrets (RELAY_ADMIN_TOKEN)

**Once approved, Brain-side staging runbook** (`dokploy-staging-runbook.md`) **will contain exact command steps.**

---

## References

- `operations/runbooks/dokploy.md` — Dokploy general workflow
- `operations/runbooks/buildflow-deployment.md` — BuildFlow deployment details (85+ pages)
- `operations/standards/buildflow-dockerfile-contract.md` — Container topology requirements
- `operations/standards/buildflow-migration-plan.md` — Full 5-phase migration plan
- `operations/deploy/dokploy-image-deploy.yml` — GitHub Actions deployment template
- BuildFlow repo: `.github/workflows/deploy.yml` (should match template)
- BuildFlow repo: `Dockerfile` (must implement topology in this plan)

---

**Status:** Planning complete. Awaiting explicit approval for Phase 3 staging execution.
