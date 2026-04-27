# BuildFlow Deployment Runbook

## Overview

BuildFlow is a managed relay service that routes ChatGPT Custom Actions to local devices. It is deployed on Dokploy following the same image-based pattern as prochattools apps: GitHub Actions builds the image, pushes to GHCR, and Dokploy pulls and restarts.

**Key characteristics:**
- **Single public domain:** `buildflow.prochat.tools`
- **One Dokploy application** containing both relay (3053) and web (3054) services
- **Internal routing:** nginx/Traefik proxy routes paths to correct backend
- **Persistent state:** relay data (tokens, audit logs) stored in Docker volume
- **Multi-user:** token-scoped routing via `RELAY_ADMIN_TOKEN` and per-device tokens
- **Managed relay:** `BUILDFLOW_BACKEND_MODE=relay-agent` with device token authentication

---

## Architecture

### External Surface (Public HTTPS)

```
https://buildflow.prochat.tools/
├── /api/openapi              → web (3054)      [GET, no auth]
├── /api/actions/search       → web (3054)      [POST, Bearer: BUILDFLOW_ACTION_TOKEN]
├── /api/actions/read         → web (3054)      [POST, Bearer: BUILDFLOW_ACTION_TOKEN]
├── /api/actions/search-and-read → web (3054)   [POST, Bearer: BUILDFLOW_ACTION_TOKEN]
├── /dashboard                → web (3054)      [GET, local-only assumption]
├── /api/register             → relay (3053)    [POST, no auth]
├── wss://api/bridge/ws       → relay (3053)    [WebSocket, device token]
├── /health                   → relay (3053)    [GET, no auth; no device IDs]
├── /ready                    → relay (3053)    [GET, no auth; readiness probe]
├── /api/admin/devices        → relay (3053)    [GET, Bearer: RELAY_ADMIN_TOKEN]
├── /api/admin/requests       → relay (3053)    [GET, Bearer: RELAY_ADMIN_TOKEN]
└── /api/admin/...            → relay (3053)    [POST/DELETE, Bearer: RELAY_ADMIN_TOKEN]
```

### Internal Container Architecture

**Planned architecture (requires BuildFlow Dockerfile verification):**

```
Container (ghcr.io/stevewesthoek/buildflow:latest)
├── Internal proxy (nginx or Traefik Lite) listening on port 3054
│   └── Routes paths to correct internal backend (relay vs web)
├── Relay server (port 3053, internal only)
│   ├── POST /api/register       → device token generation
│   ├── WebSocket /api/bridge/ws → connected devices
│   ├── GET /health              → aggregate operational status only
│   ├── GET /ready               → startup validation
│   └── GET/POST /api/admin/*    → admin endpoints (auth required)
├── Web app (port 3054, internal only)
│   ├── GET /api/openapi         → ChatGPT schema
│   ├── POST /api/actions/*      → ChatGPT action proxy
│   └── GET /dashboard           → dashboard UI
└── Persistent volume: /var/lib/buildflow/ (mounted from Dokploy)
    ├── relay-tokens.json
    ├── relay-devices.json
    ├── relay-requests.json
    ├── relay-sessions.log
    └── relay.audit.log
```

**Routing model:**
- Dokploy reverse proxy routes ALL traffic to container port 3054
- Internal container proxy (`nginx.conf` or equivalent) splits paths to relay (3053) and web (3054)
- Relay and web servers do NOT listen on public ports; only internal communication

**Assumption: BuildFlow Dockerfile includes internal routing**
- This architecture assumes BuildFlow image contains nginx or lightweight proxy configuration
- Phase 1 provisioning will verify Dockerfile actually builds this topology
- If not, alternative: two separate Dokploy apps (requires path-based routing or two domains)

---

## Product Boundary & Architecture Principle

**Critical distinction: What is smart, what is dumb, where the logic lives.**

| Component | Role | Logic | Constraint |
|-----------|------|-------|-----------|
| **Custom GPT** | User interface | None (dumb) | Routes requests to web app. No business logic, no AI, no routing decisions. |
| **Web App** (apps/web) | API surface | Proxy only | Forwards ChatGPT requests to relay or local agent. No search, no file read, no vault access. |
| **Relay** (packages/bridge) | Router + auth | Metadata only | Authenticates devices, routes requests, enforces limits, logs metadata. No payloads, no tokens, no content. |
| **Local BuildFlow App** | Orchestrator | All logic | Search, file read, vault access, encryption, user features. The "smart" part. |

**Where does feature work go?**
- ✅ New features → local BuildFlow app (Phase 5 and beyond)
- ❌ New features → relay (relay stays dumb, only metadata)
- ❌ New features → CustomGPT (CustomGPT stays dumb, only surface)
- ✅ Monitoring features → relay metadata only (operational dashboard, not product features)

**Admin Dashboard (Future)**
- May show: connected device count, request rate, error categories, latency, uptime
- Must NOT show: request bodies, response bodies, tokens, raw errors, file paths, user activity

This boundary ensures the relay remains replaceable, stateless, and future-proof.

---

## Deployment Configuration

### 1. Dokploy Application Setup

**Project:** Web  
**Application Name:** BuildFlow  
**Source Type:** Docker Image  
**Docker Image:** `ghcr.io/stevewesthoek/buildflow:latest`

**Domain Configuration:**
- Host: `buildflow.prochat.tools`
- Path: `/`
- Port: `3054` (container-exposed port)
- HTTPS: enabled (via Dokploy/Cloudflare)
- Certificate: auto (Dokploy manages)

### 2. Environment Variables

**Critical for production:**

```bash
# Relay authentication
RELAY_ADMIN_TOKEN=<strong-32-byte-hex-token>     # Generate: openssl rand -hex 32
RELAY_ENABLE_DEFAULT_TOKENS=false                  # Disable dev tokens in production

# Web app authentication
BUILDFLOW_ACTION_TOKEN=<strong-32-byte-hex-token> # Generate: openssl rand -hex 32

# Runtime
NODE_ENV=production
BRIDGE_PORT=3053
RELAY_DATA_DIR=/var/lib/buildflow

# Web app backend mode
BUILDFLOW_BACKEND_MODE=relay-agent

# Phase 5C (optional relay proxy auth)
RELAY_PROXY_TOKEN=<token-if-needed>
```

**Do NOT set these unless needed:**
- `LOCAL_AGENT_URL` (only for local dev mode; production uses relay)
- `RELAY_ENABLE_DEFAULT_TOKENS` (must be `false` for production)

### 3. Persistent Volume

**Docker Volume:** `buildflow-data`  
**Container Mount Point:** `/var/lib/buildflow`  
**Retention:** Persistent across restarts and deployments

**Contains:**
- `relay-tokens.json` — Device tokens
- `relay-devices.json` — Connected device registry
- `relay-requests.json` — Request audit log
- `relay-sessions.log` — Session audit log
- `relay.audit.log` — Startup and runtime events

### 4. GHCR Pull Credentials

**Critical: use username/password method, NOT registryId**

In Dokploy app → Settings → Registries:
```bash
Username: stevewesthoek
Password: <GitHub PAT with read:packages scope>
Registry URL: ghcr.io
registryId: (leave empty or null)
```

See `dokploy-ghcr-pull-auth` skill for details.

---

## Migration Path: Local → Production

### Phase 0: Current State
- Local BuildFlow runs on localhost:3054 (agent 3052, relay 3053, web 3054)
- Local orchestrator manages all three services
- ProBot dashboard shows unified health check
- No production relay service

### Phase 1: Deploy Production Relay (Parallel)
- BuildFlow image pushed to GHCR
- Dokploy app created in Web project
- Production domain resolves to buildflow.prochat.tools
- **Local BuildFlow unchanged** — continues as primary
- **Dashboard:** May show both local and production in future

### Phase 2: Test Production Relay
- Maintainer local agent connects to production relay
- Verify device registration endpoint works
- Verify WebSocket connection works
- Verify token-scoped routing works
- Verify /health and /ready endpoints return expected values

### Phase 3: Production Validation
- Custom GPT test with production BuildFlow
- Load test with realistic request volume
- Monitor relay logs for errors
- Confirm no device IDs exposed in /health

### Phase 4: Switch (After Validation)
- Update ProBot dashboard to prefer production relay
- Update CustomGPT to use production buildflow.prochat.tools
- Local BuildFlow remains as fallback
- **Gradual transition** — monitor both for 48 hours

### Phase 5: Cleanup (After 7 Days)
- Remove local relay from ProBot if stable
- Archive local relay data
- Keep local web app for dashboard access

---

## Rollback Plan

If production relay becomes unhealthy:

### Quick Rollback (Same Session)

```bash
# 1. Stop Dokploy application (preserves volume)
curl -s -X POST https://dokploy.prochat.tools/api/application.stop \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>"}'

# 2. Restore ProBot to local BuildFlow
# (Update dashboard to show local 3054 only)

# 3. Verify local BuildFlow still responsive
curl http://localhost:3054/api/unified-health
```

### Full Rollback (Data Preserved)

```bash
# 1. Stop Dokploy app
# (see Quick Rollback above)

# 2. Keep volume intact for data recovery
# (Dokploy Docker volume buildflow-data is NOT deleted)

# 3. Optional: export relay data for audit
docker volume inspect buildflow-data
# (shows mount point for manual inspection)
```

### Data Recovery

Relay state persists in the Docker volume even if the application is stopped or deleted:

```bash
# List available volumes
docker volume ls | grep buildflow

# Inspect volume mount point
docker volume inspect buildflow-data

# If needed: manually back up relay data before volume deletion
docker run --rm -v buildflow-data:/data -v /tmp:/backup \
  alpine tar czf /backup/buildflow-data-backup.tar.gz -C /data .
```

---

## Verification Checklist

After deployment, verify each item:

### Pre-Deploy Checklist

- [ ] GitHub repo has `.github/workflows/deploy.yml` with `DOKPLOY_API_KEY` and `DOKPLOY_APP_ID` secrets
- [ ] BuildFlow image builds and pushes to GHCR successfully
- [ ] Dockerfile builds both relay and web in one image
- [ ] Internal routing config (nginx.conf or equivalent) is included
- [ ] Persistent volume mount is configured in Dockerfile and docker-compose

### Post-Deploy Checklist

- [ ] Dokploy app exists in Web project
- [ ] Domain `buildflow.prochat.tools` resolves and returns 200
- [ ] `GET https://buildflow.prochat.tools/ready` returns `200 OK`
- [ ] `GET https://buildflow.prochat.tools/health` returns 200 with status (no device IDs exposed)
- [ ] `GET https://buildflow.prochat.tools/api/openapi` returns OpenAPI 3.1.0 schema
- [ ] `POST https://buildflow.prochat.tools/api/register` (no token) returns device registration
- [ ] `wss://buildflow.prochat.tools/api/bridge/ws` WebSocket upgrade works
- [ ] `POST /api/actions/search` without token returns 401
- [ ] `POST /api/actions/search` with valid token returns 200 (if local device connected)
- [ ] `GET /api/admin/devices` without token returns 401
- [ ] `GET /api/admin/devices` with `RELAY_ADMIN_TOKEN` returns device list
- [ ] Local BuildFlow still responsive on localhost:3054
- [ ] ProBot dashboard still functional
- [ ] Production relay logs show no token exposure

### Health Endpoint Verification

```bash
# /health — should show device count, not IDs
curl -s https://buildflow.prochat.tools/health | jq .
# Expected: {"status":"ok","bridgeRunning":true,"connectedDevices":N,...}
# NOT: [{"id":"device-123","status":"active",...}]

# /ready — should confirm startup complete
curl -s https://buildflow.prochat.tools/ready | jq .
# Expected: {"ready":true,"dataDir":"/var/lib/buildflow"}
```

---

## Admin Operations

### Monitoring

```bash
# View relay logs (via Docker on Dokploy VM)
ssh dokploy "docker logs -f buildflow-relay --tail 100"

# View request audit log (inside container)
ssh dokploy "docker exec buildflow-relay cat /var/lib/buildflow/relay-requests.json | tail -20"

# View session audit log (inside container, NDJSON format)
ssh dokploy "docker exec buildflow-relay tail -20 /var/lib/buildflow/relay-sessions.log"
```

### Device Management

```bash
# List connected devices (requires RELAY_ADMIN_TOKEN)
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/devices | jq .

# View request audit (requires token)
curl -H "Authorization: Bearer $RELAY_ADMIN_TOKEN" \
  https://buildflow.prochat.tools/api/admin/requests | jq .
```

### Manual Restart

```bash
# Via Dokploy API
curl -s -X POST https://dokploy.prochat.tools/api/application.deploy \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<buildflow-app-id>", "title": "Manual restart"}'

# Or via Docker on Dokploy VM
ssh dokploy "docker restart buildflow-relay"
```

---

## Troubleshooting

### Issue: "Connection refused" on /api/register

**Likely cause:** Relay not started or health check failing.

**Fix:**
```bash
# Check if container is running
ssh dokploy "docker ps | grep buildflow-relay"

# Check startup logs for errors
ssh dokploy "docker logs buildflow-relay | head -50"

# Verify data directory permissions
ssh dokploy "docker exec buildflow-relay ls -la /var/lib/buildflow"
```

### Issue: WebSocket upgrade fails

**Likely cause:** Traefik (Dokploy's router) not forwarding `Upgrade` header.

**Fix:**
```bash
# Verify WebSocket route works
curl -i -N -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  https://buildflow.prochat.tools/api/bridge/ws

# If it fails, check Dokploy domain config for middleware blocking upgrades
# (current config should not block WebSocket)
```

### Issue: Admin endpoints return 403

**Likely cause:** Missing or wrong `RELAY_ADMIN_TOKEN` in env.

**Fix:**
```bash
# Verify token is set in Dokploy app
ssh dokploy "docker exec buildflow-relay env | grep RELAY_ADMIN_TOKEN"

# Verify you're passing the correct token
curl -v -H "Authorization: Bearer $(your-token-here)" \
  https://buildflow.prochat.tools/api/admin/devices
```

### Issue: Disk space filling up

**Likely cause:** Relay audit logs growing without rotation.

**Interim fix:**
```bash
# View log sizes
ssh dokploy "docker exec buildflow-relay du -sh /var/lib/buildflow/*"

# Optional: clear request log (will lose request history, but relay continues)
ssh dokploy "docker exec buildflow-relay rm /var/lib/buildflow/relay-requests.json"
# Relay will recreate it on next write
```

**Permanent fix:** Phase 2E will add structured logging with rotation.

---

## Reference

### App Inventory

| Property | Value |
|----------|-------|
| **Dokploy Project** | Web |
| **App Name** | BuildFlow |
| **App ID** | (see Dokploy dashboard) |
| **GitHub Repo** | stevewesthoek/buildflow |
| **Image** | ghcr.io/stevewesthoek/buildflow:latest |
| **Public Domain** | buildflow.prochat.tools |
| **Public Port** | 3054 (HTTPS) |
| **Relay Port** | 3053 (internal) |
| **Web Port** | 3054 (internal) |
| **Volume** | buildflow-data |
| **Volume Mount** | /var/lib/buildflow |
| **Deployment Workflow** | .github/workflows/deploy.yml |

### Security Notes

- **RELAY_ADMIN_TOKEN:** Never commit; store in Dokploy secret only
- **BUILDFLOW_ACTION_TOKEN:** Never commit; store in Dokploy secret only
- **/health endpoint:** Does NOT expose device IDs (production constraint)
- **Token logging:** Relay does not log bearer tokens in plaintext
- **Local agent:** Never directly exposed to internet (only via relay routing)

### Related Documentation

- `operations/runbooks/dokploy.md` — General Dokploy workflow
- `operations/infrastructure/infra.md` — Infrastructure inventory
- `buildflow` repo: `DEPLOYMENT.md` — BuildFlow Phase 2 deployment contract
- `buildflow` repo: `docker-compose.yml` — Local development setup

