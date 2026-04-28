# BuildFlow Dockerfile Contract for Dokploy Deployment

**Status:** ✅ IMPLEMENTED AND VERIFIED (commit 3473303)  
**Date:** 2026-04-27  
**Resolved:** 2026-04-27 (BuildFlow commit 3473303 verified locally)  
**Scope:** BuildFlow repo (stevewesthoek/buildflow)

---

## Issue

The BuildFlow Dockerfile does not yet support the production topology required for Dokploy deployment.

**Current Dockerfile state:**
- ✗ Builds relay only (`packages/bridge`)
- ✗ Exposes port 3053 (relay-only)
- ✗ Does not build web app (`apps/web`)
- ✗ Does not include internal routing proxy
- ✗ Cannot be deployed as single Dokploy app on port 3054

**Expected production topology for Phase 1:**
- ✓ Single container image from GitHub Actions → GHCR
- ✓ Internal proxy (nginx, express, or fastify) listens on port 3054 (public container port)
- ✓ Relay runs on internal port 3053 (not exposed publicly)
- ✓ Web app runs on internal port 3055 (not exposed publicly)
- ✓ Public domain buildflow.prochat.tools routes to container port 3054
- ✓ Internal proxy routes paths to correct backends:
  - `/api/openapi` → web (3055)
  - `/api/actions/*` → web (3055)
  - `/dashboard` → web (3055)
  - `/api/register` → relay (3053)
  - `/api/bridge/ws` → relay (3053)
  - `/health` → relay (3053)
  - `/ready` → relay (3053)
  - `/api/admin/*` → relay (3053)
- ✓ Persistent data volume `/var/lib/buildflow` mounted from Dokploy

---

## Required Changes

### 1. Multi-Process Container Architecture

**Option A: Docker Compose internally**
- Dockerfile includes a docker-compose.yml and docker entrypoint
- Entrypoint starts: nginx → relay (background) → web app (background)
- All three managed by a lightweight supervisor (supervisord or similar)

**Option B: Multi-stage build with init system**
- Build relay and web app in separate stages
- Use a lightweight init system (dumb-init, tini) as entrypoint
- Start both services and proxy in container

**Option C: Single Node.js process with internal routing**
- Start a single Node.js server that:
  1. Starts relay on internal port 3053
  2. Starts web on internal port 3055
  3. Creates express/fastify proxy listening on port 3054 (public container port)
  4. Routes requests to correct backend (relay vs web)

**Recommendation:** Option C (simplest, most portable). Use Node.js with express or fastify for internal routing.

### 2. Proxy Routing Implementation

The proxy must route based on incoming request path:

```javascript
// Pseudo-code
const router = express.Router();

// Relay routes (all go to internal :3053)
router.use('/api/register', proxyTo('localhost:3053'));
router.use('/api/bridge/ws', proxyTo('localhost:3053'));  // WebSocket upgrade support
router.use('/health', proxyTo('localhost:3053'));
router.use('/ready', proxyTo('localhost:3053'));
router.use('/api/admin', proxyTo('localhost:3053'));

// Web app routes (all go to internal :3055)
router.use('/api/openapi', proxyTo('localhost:3055'));
router.use('/api/actions', proxyTo('localhost:3055'));
router.use('/dashboard', proxyTo('localhost:3055'));

// Default to web app (for root path)
router.use('/', proxyTo('localhost:3055'));

// Public proxy listens on :3054 (container-exposed port)
app.listen(3054);
```

**WebSocket Support:** Must forward `Upgrade` header and connection parameters.

### 3. Updated Dockerfile Structure

**Multi-stage build example:**

```dockerfile
# Build stage 1: relay
FROM node:20-alpine AS relay-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/packages/bridge
RUN pnpm build

# Build stage 2: web
FROM node:20-alpine AS web-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ ./apps/
COPY packages/shared ./packages/shared
RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/web
RUN pnpm build

# Build stage 3: proxy
FROM node:20-alpine AS proxy-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Create lightweight proxy package or copy existing proxy config
RUN mkdir -p /app/proxy && echo 'express proxy code here' > /app/proxy/index.js

# Runtime stage
FROM node:20-alpine
WORKDIR /app

RUN addgroup -S buildflow && adduser -S buildflow -G buildflow -s /sbin/nologin
RUN mkdir -p /var/lib/buildflow && chown -R buildflow:buildflow /var/lib/buildflow

# Copy built artifacts
COPY --from=relay-builder /app/packages/bridge/dist ./packages/bridge/dist
COPY --from=relay-builder /app/packages/bridge/package.json ./packages/bridge/package.json
COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=proxy-builder /app/proxy ./proxy

# Copy shared dependencies
COPY --from=relay-builder /app/node_modules ./node_modules

WORKDIR /app
USER buildflow

EXPOSE 3054

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3054/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Entrypoint: Start relay, web, and proxy
ENV RELAY_DATA_DIR=/var/lib/buildflow
ENV BRIDGE_PORT=3053
ENV NODE_ENV=production

CMD ["node", "proxy/index.js"]
```

### 4. Environment Variables

Dockerfile should set or pass through:
- `NODE_ENV` (default: production)
- `BRIDGE_PORT` (default: 3053, for internal relay)
- `RELAY_DATA_DIR` (default: /var/lib/buildflow)
- `RELAY_ADMIN_TOKEN` (required for admin endpoints; set via Dokploy env)
- `RELAY_ENABLE_DEFAULT_TOKENS` (default: false for production)
- `BUILDFLOW_ACTION_TOKEN` (optional; only if local/direct mode testing is needed; NOT used in hosted relay-agent mode)

Dokploy will override sensitive values (RELAY_ADMIN_TOKEN, etc.) via app configuration. Web app should NOT require a separate global action token in production; user device tokens are sufficient.

### 5. Health Check

Both endpoints must remain functional:

```bash
# Readiness: Check if relay and web are both running
curl http://localhost:3054/ready

# Health: Check aggregate status
curl http://localhost:3054/health
```

Both should return 200 with proper JSON responses.

### 6. Persistent Volume

- Mount `/var/lib/buildflow` from Dokploy
- Relay creates and manages files in this directory
- Permissions must be readable/writable by buildflow user

---

## Implementation Checklist

- [ ] Update Dockerfile to build relay + web + proxy
- [ ] Implement internal proxy (express/fastify) with routing rules
- [ ] Ensure WebSocket upgrade support in proxy
- [ ] Update docker-compose.yml (local dev) to match new topology
- [ ] Test locally:
  ```bash
  docker build -t buildflow:test .
  docker run -p 3054:3054 -e RELAY_ADMIN_TOKEN=test -e BUILDFLOW_ACTION_TOKEN=test buildflow:test
  curl http://localhost:3054/ready
  curl http://localhost:3054/health
  curl http://localhost:3054/api/openapi
  ```
- [ ] Verify all endpoints respond correctly
- [ ] Test WebSocket upgrade: `curl -i -N -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:3054/api/bridge/ws`
- [ ] Commit and push to main
- [ ] GitHub Actions builds image and pushes to GHCR
- [ ] Dokploy can pull image and deploy

---

## Brain Deployment Impact

**Phase 1 Provisioning Status:** PAUSED

Once Dockerfile is updated:
1. Update Brain docs to remove BLOCKER note
2. Provision BuildFlow in Dokploy Web project
3. Configure GHCR pull credentials
4. Set environment variables
5. Create persistent volume
6. Deploy and verify Phase 1 validation endpoints
7. Proceed to Phase 2 (maintainer testing)

---

## Reference

- Brain deployment runbook: `operations/runbooks/buildflow-deployment.md`
- Migration plan: `operations/standards/buildflow-migration-plan.md`
- Privacy guidelines: `operations/standards/buildflow-relay-privacy.md`
- Dokploy pattern: `operations/deploy/dokploy-image-deploy.yml`

---

**Next Action:** Update BuildFlow Dockerfile per this contract, then return to Phase 1 provisioning.
