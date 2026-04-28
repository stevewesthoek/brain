# Plan: Harden multi-user relay routing for Dokploy deployment

## Context

The previous task implemented token-scoped relay routing in `packages/bridge/src/server.ts`. Before Dokploy deployment, we need to harden several public-endpoint issues discovered during code review. This is a pre-deployment hardening pass, not a feature change.

## Resolved: Endpoint topology (Requirement 1)

**Answer: Option A.** `apps/web` (port 3054) is the public endpoint. Bridge (port 3053) is internal-only.

Call chain: Custom GPT → `https://buildflow.prochat.tools/api/actions/*` (apps/web, port 3054) → `http://127.0.0.1:3053/api/actions/proxy/*` (bridge, localhost) → WebSocket → local CLI device.

This is unambiguous and matches the existing OpenAPI schema. No schema changes needed.

**One latent bug to document but not fix now:** `status/route.ts` and `list-sources/route.ts` hardcode `LOCAL_AGENT_URL` and bypass `relay-agent` mode. In a hosted deployment, these will fail silently. This is a known limitation to document.

---

## Changes

### 1. `packages/bridge/src/server.ts` — 6 hardening changes

#### 1a. CORS: add Authorization to allowed headers (line 149)

```
- res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
+ res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
```

#### 1b. /health: strip raw device IDs from public response (lines 207-226)

Current: exposes `{ id: deviceId, status, lastSeen, lastHeartbeat }` for every device.

New: public /health returns only count and status (no device IDs). Device details require admin auth via `/api/admin/devices`.

```typescript
// Public health — no device IDs
const status = {
  status: 'ok',
  bridgeRunning: true,
  port: runtimeConfig?.config.bridgePort,
  connectedDevices: connectedDevices.length
}
res.writeHead(200)
res.end(JSON.stringify(status, null, 2))
```

#### 1c. /api/register: body size limit + token/deviceId format validation (lines 251-336)

Add before `req.on('data')`:
- `MAX_REGISTER_BODY = 4096` (4 KB — plenty for a token + deviceId JSON payload)
- Body accumulation check: if `body.length > MAX_REGISTER_BODY` → destroy request + 413

Add inside `req.on('end')`:
- `deviceToken` validation: must be a string, length between 16 and 256 characters, only printable ASCII (no control chars). Reject with 400.
- `requestedDeviceId` validation (if provided): must be a string, match `/^[a-zA-Z0-9_-]{1,64}$/`. Reject with 400.

#### 1d. Body size limits for action proxy + command endpoints (lines 345, 530, 674)

Add `MAX_PROXY_BODY = 65536` (64 KB — generous for action requests) guard to `/api/actions/proxy/*`, `/api/commands/session`, and `/api/commands`.

Pattern:
```typescript
const MAX_BODY = 65536
let body = ''
req.on('data', chunk => {
  body += chunk.toString()
  if (body.length > MAX_BODY) {
    req.destroy()
    if (!res.headersSent) {
      res.writeHead(413)
      res.end(JSON.stringify({ error: 'Request body too large' }))
    }
  }
})
```

#### 1e. /api/register response: strip token from connectionInfo (line 319)

The `token: deviceToken` field in the registration response is a security concern for any logging proxy. The token was provided by the client who is registering — they already have it. Remove it from the response. Replace with a usage instruction that references the token they already possess.

```typescript
connectionInfo: {
  wsUrl: `wss://<relay-hostname>`,
  deviceId,
  usage: 'Connect your local agent to the relay using the token you registered with.'
}
```

(Exact wsUrl field may be dropped or simplified — it currently gives `ws://127.0.0.1:...` which is wrong for production anyway.)

#### 1f. Error strings: sanitize relay_command logToFile (lines 813-820)

At line 819: `reason: String(error)` passes device-originated error text. Change to use a fixed category string when the error looks like a device response, instead of the raw string. The device could return any error message including user content from the command result.

```typescript
// Instead of: reason: String(error)
reason: 'device_command_error'
```

### 2. `packages/bridge/src/config.ts` — No changes needed

The existing config is correct. `RELAY_PROXY_TOKEN` remains in the config structure but is no longer used for user-routing. We add a comment to clarify it is reserved for future internal-only use and must not be described as the Custom GPT auth mechanism.

### 3. `docs/product/dokploy-relay-deployment-plan.md` — Topology section

Add a clear **Deployment Topology** section near the top explaining:
- `apps/web` is the public-facing service (reverse-proxied to `buildflow.prochat.tools`)
- `packages/bridge` runs as a sidecar service, internal-only (not publicly exposed)
- Dokploy must run both services in the same container or in the same VPS/network where `apps/web` can reach `http://127.0.0.1:3053`
- `BUILDFLOW_BACKEND_MODE=relay-agent` must be set in `apps/web` environment
- Rate limiting: not implemented in relay code; must be handled at reverse proxy layer (Dokploy/nginx). Document as deploy-level requirement.

Also fix the known bug note: `status` and `list-sources` routes hardcode direct-agent mode. These endpoints in `apps/web` will not work through the relay. Document this as a known v1.2.0-beta limitation.

### 4. `docs/product/custom-gpt-self-hosting-model.md` — Update recommended setup

Update to reflect:
- Managed relay primary path: `https://buildflow.prochat.tools` (apps/web public proxy, NOT bridge directly)
- Bridge is an internal component, not accessible by Custom GPT
- Privacy statement: payloads transit relay memory; not persisted; relay operator has in-memory access during transit; no E2E encryption

### 5. Remove/quarantine stale RELAY_PROXY_TOKEN docs (Requirement 9)

Search and fix any remaining mention of `RELAY_PROXY_TOKEN` as Custom GPT auth. It is only valid for internal-only operations. Update:
- `docs/product/dokploy-relay-deployment-plan.md` — already partially done; review remainder
- Any mention in `custom-gpt-connection-architecture.md`

---

## What does NOT change

- `docs/openapi.chatgpt.json` — correct as-is, paths are `/api/actions/*` on `apps/web`
- `apps/web/src/app/api/openapi/route.ts` — correct as-is
- `apps/web/src/lib/actionAuth.ts` — unchanged
- Dashboard UI — out of scope

---

## Verification sequence

```bash
# 1. Build
pnpm --dir packages/bridge build

# 2. Type check
pnpm --dir apps/web type-check

# 3. Start relay with fresh data dir
rm -rf /tmp/buildflow-relay-routing-test
RELAY_DATA_DIR=/tmp/buildflow-relay-routing-test \
RELAY_ENABLE_DEFAULT_TOKENS=false \
BRIDGE_PORT=3053 \
node packages/bridge/dist/server.js &
RELAY_PID=$!
sleep 1

# 4. Run two-token routing test
node scripts/verify-relay-routing.js

# 5. Check CORS
curl -i -X OPTIONS http://127.0.0.1:3053/api/actions/proxy/api/status \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -H "Access-Control-Request-Method: POST"
# Must include: Access-Control-Allow-Headers: Content-Type, Authorization

# 6. Check health privacy
curl -s http://127.0.0.1:3053/health
# Must NOT include device IDs array, only count

# 7. Check oversized body rejection
python3 -c "import sys; sys.stdout.buffer.write(b'{\"deviceToken\":\"' + b'x'*100000 + b'\"}')" | \
  curl -s -X POST http://127.0.0.1:3053/api/register \
  -H 'Content-Type: application/json' \
  --data-binary @-
# Must return 413

# 8. Cleanup
kill $RELAY_PID

# 9. Check removed phrases
rg -n "Multiple connected devices not supported|single connected device|only connected device|RELAY_PROXY_TOKEN.*Custom GPT|relay can't read|production-ready|Phase 5B" packages/bridge docs/product

# 10. Confirm schema files unchanged
git diff --name-only -- docs/CUSTOM_GPT_INSTRUCTIONS.md docs/openapi.chatgpt.json apps/web/src/app/api/openapi/route.ts
```
