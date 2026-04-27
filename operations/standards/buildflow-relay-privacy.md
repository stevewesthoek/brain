# BuildFlow Relay Privacy & Security Guidelines

**Status:** Production rules  
**Scope:** Relay deployment on Dokploy  
**Applies To:** Steve (maintainer) + future team members  
**Last Updated:** 2026-04-27

---

## Privacy Principle

**Relay is dumb. Relay knows nothing about what you're searching.**

The relay routes requests between ChatGPT Custom GPT and your local BuildFlow device. It does NOT:
- Store request bodies (searches, file contents, prompts)
- Store response bodies (search results, file content)
- Store bearer tokens in logs
- Decrypt or inspect request payloads
- Know device details beyond connection state

All business logic (search, file read, encryption, vault access) happens on your local device. The relay is transport only.

---

## What the Relay DOES Store

### 1. Token Registry (Encrypted at Rest / Secrets)
**File:** `relay-tokens.json`  
**Contains:** Device IDs, device tokens (for auth)  
**Lifetime:** Persists until manually deleted  
**Privacy:** Tokens are opaque, never logged, never exposed in logs or responses

**NEVER print or share:**
```bash
# ❌ Bad
cat /var/lib/buildflow/relay-tokens.json

# ❌ Bad
docker exec buildflow-relay cat /var/lib/buildflow/relay-tokens.json
```

### 2. Device Registry (Metadata Only)
**File:** `relay-devices.json`  
**Contains:** 
```json
{
  "deviceId": "...",
  "status": "active",
  "lastSeen": "2026-04-27T10:30:00Z",
  "lastHeartbeat": "2026-04-27T10:30:15Z",
  "connectedCount": 1
}
```
**NOT Included:**
- Device name
- Vault path
- User identity
- IP address

**Privacy:** Safe for monitoring/admin dashboard in future

### 3. Request Audit Log (Metadata Only)
**File:** `relay-requests.json` (JSON array, grows indefinitely)  
**Contains Per-Request:**
```json
{
  "timestamp": "2026-04-27T10:30:00Z",
  "deviceId": "device-123",
  "endpoint": "/api/actions/search",
  "statusCode": 200,
  "errorCategory": null,
  "latencyMs": 45,
  "requestBodySize": 128,
  "responseBodySize": 1024
}
```
**NOT Included:**
- Query text (request body)
- Response content
- User search terms
- Request headers (except content-length)
- Bearer token or auth details

**Privacy:** Safe for monitoring/performance tracking

### 4. Session Audit Log (Metadata Only)
**File:** `relay-sessions.log` (newline-delimited JSON)  
**Example Entry:**
```json
{"timestamp":"2026-04-27T10:30:00Z","event":"device_connected","deviceId":"device-123","duration":300}
{"timestamp":"2026-04-27T10:30:30Z","event":"device_heartbeat","deviceId":"device-123"}
{"timestamp":"2026-04-27T10:30:45Z","event":"request_received","deviceId":"device-123","endpoint":"/api/actions/search","status":200}
```
**NOT Included:**
- Search query content
- Response data
- Prompts or file content
- Auth tokens

**Privacy:** Safe for forensics and audit trail

### 5. Startup & Runtime Events
**File:** `relay.audit.log`  
**Contains:** Service startup, configuration load, errors  
**Example:**
```
[Startup] Loading configuration...
[Startup] Configuration loaded:
  • bridgePort: 3053
  • dataDir: /var/lib/buildflow
  • relayAdminToken: [REDACTED]
  • enableDefaultTokens: false
  • nodeEnv: production
[Startup] Testing data directory writability...
[Startup] ✓ Data directory ready: /var/lib/buildflow
```
**NOT Included:**
- Plaintext token values (shown as `[REDACTED]`)
- Request bodies
- Response bodies

**Privacy:** Safe for operational debugging

---

## What MUST NOT be Stored

❌ Request bodies (searches, file paths, prompts)  
❌ Response bodies (search results, file content)  
❌ Bearer tokens in plaintext  
❌ Device names or user identifiers beyond device ID  
❌ Vault paths or file names  
❌ Request/response headers (except content-length)  
❌ Query parameters  
❌ Encryption keys or credentials  
❌ Raw error messages from local device

---

## Health Endpoint Security

### /health Response

**✅ SAFE to return (aggregate operational status only):**
```json
{
  "status": "ok",
  "bridgeRunning": true,
  "port": 3053,
  "connectedDevices": 2
}
```

**Optional: Device list with MAXIMUM aggregation** (if exposing per-device status):
```json
{
  "status": "ok",
  "bridgeRunning": true,
  "connectedDevices": 2,
  "devices": [
    {
      "status": "active"
    },
    {
      "status": "active"
    }
  ]
}
```

**CONSTRAINT:** If exposing per-device list, NEVER include:
- device IDs (even opaque UUIDs create identifiability)
- lastSeen timestamps (ties events to specific devices)
- lastHeartbeat timestamps (same)
- device names or metadata
- connection duration (can fingerprint devices)

**❌ UNSAFE — Do NOT return:**
```json
{
  "devices": [
    {
      "id": "device-abc123",
      "name": "Steve's MacBook",        // ❌ Device name
      "vaultPath": "/Users/Steve/...", // ❌ Vault path exposed
      "lastCommand": "search brain",   // ❌ Command history
      "lastErrorMessage": "..."        // ❌ Raw error
    }
  ]
}
```

**Production Constraint:** `/health` must not expose device names, vault paths, or user commands.

---

## Admin Endpoint Security

### Protected Endpoints
```
GET /api/admin/devices       (Bearer: RELAY_ADMIN_TOKEN)
GET /api/admin/requests      (Bearer: RELAY_ADMIN_TOKEN)
POST /api/admin/...          (Bearer: RELAY_ADMIN_TOKEN)
```

### ✅ SAFE to expose (with admin auth):
- Connected device count
- Device connection duration
- Request timestamp + endpoint
- Status codes (success/error category)
- Latency metrics
- Volume size

### ❌ UNSAFE — Never expose (even to admin):
- Request body content
- Response body content
- Bearer tokens
- Encryption keys
- Raw error messages
- Local device IP addresses
- Local device system info

---

## Token Security Rules

### RELAY_ADMIN_TOKEN
**Purpose:** Admin dashboard (future), manual device management  
**How to Generate:**
```bash
openssl rand -hex 32
```
**Constraints:**
- Generated locally, never shared
- Stored in Dokploy env only (not in logs, not in code)
- Required for all `/api/admin/*` operations
- DO NOT print in logs

**In Code:**
```typescript
// ✅ OK: Compare tokens
if (request.headers.authorization !== `Bearer ${process.env.RELAY_ADMIN_TOKEN}`) {
  throw new Error('401: Unauthorized');
}

// ❌ WRONG: Log the token
console.log(`Token received: ${token}`);

// ❌ WRONG: Return token in response
res.json({ adminToken: process.env.RELAY_ADMIN_TOKEN });
```

### Device Tokens
**Purpose:** Device authentication for WebSocket connection  
**Generated By:** `/api/register` endpoint (one-time use)  
**Stored In:** `relay-tokens.json` (in persistent volume)  
**Constraints:**
- Never logged or printed
- Never exposed in HTTP responses
- Never sent in plain HTTP (only WebSocket auth)
- Unique per device
- DO NOT use same token for multiple devices

**In Code:**
```typescript
// ✅ OK: Use token in auth check
const device = getDeviceByToken(token);
if (!device) throw new Error('403: Invalid token');

// ❌ WRONG: Log the token
console.log(`Device connected with token: ${token}`);

// ❌ WRONG: Return token in response body
res.json({ device, token: registrationToken });
```

### BUILDFLOW_ACTION_TOKEN (Web App)
**Purpose:** ChatGPT Custom GPT authentication  
**How to Generate:**
```bash
openssl rand -hex 32
```
**Stored In:** Dokploy app environment only (not in BuildFlow repo)  
**Constraints:**
- Never committed to repo
- Never printed in logs
- Required for `/api/actions/*` endpoints
- Used by ChatGPT Custom GPT to call web app

**In Code:**
```typescript
// ✅ OK: Check token
if (request.headers.authorization !== `Bearer ${process.env.BUILDFLOW_ACTION_TOKEN}`) {
  return new Response('401: Unauthorized', { status: 401 });
}

// ❌ WRONG: Log or expose token
console.log(`Received action token: ${token}`);
res.json({ token: process.env.BUILDFLOW_ACTION_TOKEN });
```

---

## Logging Rules

### ✅ SAFE to log:
```typescript
// Operational events
console.log('[Startup] Relay starting on port 3053');
console.log('[Device] Device connected', { deviceId: 'abc123' });
console.log('[Request] Status 200', { endpoint: '/api/actions/search', latencyMs: 45 });

// Error categories (not raw errors)
console.error('[Error] Device timeout', { deviceId: 'abc123', errorType: 'connection_timeout' });
console.error('[Error] Invalid token', { errorType: 'auth_failed' });

// Metrics
console.log('[Metric] Connected devices: 2, Total requests: 1523, Avg latency: 42ms');
```

### ❌ NEVER log:
```typescript
// ❌ Request/response content
console.log('[Request] Body:', request.body);  // Contains search query!
console.log('[Response] Result:', response);   // Contains search results!

// ❌ Tokens
console.log('[Auth] Token:', token);
console.log('[Admin] Admin token is:', process.env.RELAY_ADMIN_TOKEN);

// ❌ Raw errors
console.error('[Error] Full stack:', error.stack);
console.error('[Error] Message:', error.message);  // May contain sensitive details

// ❌ User details
console.log('[Device] Name:', device.name);
console.log('[Device] Vault path:', device.vaultPath);
```

**Implementation:** Use error categories instead:
```typescript
// ✅ Good: Log category, not details
try {
  await callLocalDevice(request);
} catch (error) {
  const errorCategory = error.code === 'ECONNREFUSED' ? 'connection_refused' : 'unknown_error';
  console.error('[Error] Device call failed', { deviceId, errorCategory });
  // error details stay internal
}
```

---

## Data Retention & Cleanup

### Audit Logs (Grow Indefinitely in Phase 2)
**Current Status:** No automatic rotation  
**Interim Solution:** Manual cleanup if volume fills  
**Phase 2E Solution:** Structured logging with rotation (future)

**How to Clean:**
```bash
# View current sizes
ssh dokploy "docker exec buildflow-relay du -sh /var/lib/buildflow/*"

# OPTIONAL: Clear request audit (keeps latest 10)
ssh dokploy "docker exec buildflow-relay bash -c 'tail -10 /var/lib/buildflow/relay-requests.json > /tmp/last10.json && mv /tmp/last10.json /var/lib/buildflow/relay-requests.json'"

# Or if volume is full, safely delete (relay will recreate)
ssh dokploy "docker exec buildflow-relay rm /var/lib/buildflow/relay-requests.json"
```

### Device Data (Persists Unless Deleted)
**Tokens:** Keep indefinitely (or delete manually if device removed)  
**Device Registry:** Keep indefinitely (cleanup when device decommissioned)  
**Sessions:** Keep indefinitely (forensics, auditing)

**Manual Cleanup:**
```bash
# Remove a device and its tokens
ssh dokploy "docker exec buildflow-relay bash -c 'jq 'del(.[] | select(.deviceId == \"old-device-id\"))' /var/lib/buildflow/relay-devices.json > /tmp/new.json && mv /tmp/new.json /var/lib/buildflow/relay-devices.json'"
```

---

## Future: Admin Dashboard (Planned)

**Constraint:** Dashboard may ONLY show metadata. No request bodies, no content, no tokens.

**Safe Dashboard Views:**
- Device connection timeline
- Request count per hour
- Latency histogram (p50, p95, p99)
- Error rate by category
- Volume size over time

**Unsafe Dashboard Views (NOT ALLOWED):**
- Search queries
- Search results
- File content accessed
- Bearer tokens
- Request headers

---

## Compliance & Audit

### For Compliance Reviews
- Relay stores NO request bodies ✓
- Relay stores NO response bodies ✓
- Relay stores NO tokens in plaintext ✓
- Relay stores NO user PII (only device IDs) ✓
- Relay uses Bearer auth for admin operations ✓
- Relay logs exclude sensitive data ✓

### Data Subject Access Request (GDPR)
If a device owner requests their data:
- Copy `/var/lib/buildflow/relay-requests.json` (metadata only, no content)
- Copy relevant entries from `/var/lib/buildflow/relay-sessions.log`
- Include `/var/lib/buildflow/relay-devices.json` for that device only
- Explain: No request bodies, no search content, no file content stored

### Incident Response
If relay is compromised:
1. **Immediate:** Stop relay (preserves volume for forensics)
2. **Assess:** Check for plaintext tokens in logs or files
3. **Rotate:** Generate new RELAY_ADMIN_TOKEN and device tokens
4. **Review:** Audit logs for unauthorized access patterns
5. **Restore:** Restart relay with new tokens

---

## Checklist: Before Production Launch

- [ ] `/health` endpoint tested — no device names, no vault paths
- [ ] No request/response bodies logged
- [ ] No tokens in plaintext anywhere in logs
- [ ] RELAY_ADMIN_TOKEN generated and stored in Dokploy secret only
- [ ] BUILDFLOW_ACTION_TOKEN generated and stored in Dokploy secret only
- [ ] Admin endpoints require Bearer token
- [ ] Error messages in code use categories (not raw error text)
- [ ] Device tokens unique per registration
- [ ] Volume permissions correct (rwx for buildflow user only)
- [ ] Log files readable by admin, no world-readable secrets
- [ ] Runbook documents rollback plan
- [ ] Team trained on what data is stored and what isn't

---

## Questions / Ambiguities

**Q: What if local device sends sensitive data in request body?**  
A: Relay does NOT store or forward request bodies. Web app receives request, local agent handles business logic. Relay only sees headers and metadata.

**Q: Can admin dashboard show which files were searched?**  
A: No. Dashboard can show "request received on /api/actions/search" + latency + status. It cannot show the search query or results.

**Q: What if there's an error in the device?**  
A: Log the error category (e.g., "device_timeout", "vault_permission_denied"), not the raw error message which might expose paths.

**Q: Is the relay PII-compliant?**  
A: Relay stores zero personal information. Device IDs are not PII (they're technical identifiers). No names, emails, content stored. ✓

---

**Prepared by:** Brain infrastructure team  
**Status:** Production rules effective immediately  
**Next Review:** After Phase 2 launch  
**Questions?** See `operations/runbooks/buildflow-deployment.md`
