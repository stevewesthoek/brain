# Plan: Phase 7 — Webhook Handler & Event Routing

## Context

Phase 6 added event emission and subscription management. Phase 7 completes the inbound side: processing webhook deliveries, validating signatures, and routing platform-specific event types to internal VO Studio event types. This closes the loop between outbound webhook registration (Phase 5) and the event stream (Phase 6). All operations follow the same approval-gated adapter pattern as previous phases — no public endpoint exposure needed.

---

## What changes

### 1. New adapter: `projects/brain-core/src/adapters/vo-studio-webhook-handler.ts`

**Self-contained types** (inline, no external imports). Only imports: `import { requestAction } from './actions.js'`.

**Write functions (3):**

- `processWebhookEventRequest({ webhookId, projectId, platform, eventType, payload, signature? })`
  - Validates `webhookId`, `projectId`, `platform`, `eventType`, `payload` (must be non-null object)
  - Routes: `'custom-webhook-receive'`
  - Generates unique `deliveryId` (`delivery-${Date.now().toString(36)}-${random}`)
  - Preview: `{ delivery: { id, webhookId, projectId, platform, eventType, payload, receivedAt, status: 'received' } }`
  - Optional `signature` — only added to preview when provided

- `verifyWebhookSignatureRequest({ webhookId, projectId, secret, signature, rawBody })`
  - Validates all 5 fields required (non-empty strings)
  - Routes: `'custom-webhook-verify'`
  - Preview: `{ verification: { webhookId, projectId, status: 'verified', verifiedAt } }`

- `routeEventRequest({ projectId, platform, platformEventType })`
  - Validates `projectId`, `platform`, `platformEventType`
  - Routes: `'custom-event-route'`
  - Generates deterministic `internalEventType` by mapping platform prefixes:
    - `youtube.*` → `publish.*`
    - `tiktok.*` → `publish.*`
    - `approval.*` → `approval.*`
    - Any other → `package.*` (fallback)
  - Preview: `{ routing: { projectId, platform, platformEventType, internalEventType, status: 'mapped', mappedAt } }`

**Read functions (2):**

- `readWebhookDeliveries(webhookId, projectId, limit = 50)`
  - Validates `webhookId`, `projectId`; limit 1–500
  - Returns: `{ ok, deliveries: [], count: 0, webhookId, projectId }`

- `readPlatformEventMapping(platform)`
  - Validates `platform` (non-empty)
  - Returns: `{ ok, mappings: [], count: 0, platform }`

---

### 2. Routes in `projects/brain-core/src/api/routes.ts`

Add import lines after the event imports (lines 106-107):
```typescript
import { processWebhookEventRequest, verifyWebhookSignatureRequest, routeEventRequest } from '../adapters/vo-studio-webhook-handler.js';
import { readWebhookDeliveries, readPlatformEventMapping } from '../adapters/vo-studio-webhook-handler.js';
```

Add 5 routes between the last event route and `/research/video-analyze`:

**POST (exact `===` match, 202/400):**
- `/api/video-orchestrator/webhooks/process` — body: `{ webhookId, projectId, platform, eventType, payload, signature? }` — conditional `signature`
- `/api/video-orchestrator/webhooks/verify` — body: `{ webhookId, projectId, secret, signature, rawBody }`
- `/api/video-orchestrator/events/route` — body: `{ projectId, platform, platformEventType }`

**GET (`.startsWith()` match, 200/400):**
- `/api/video-orchestrator/webhooks/deliveries?webhookId=X&projectId=Y&limit=N`
- `/api/video-orchestrator/events/platform-mapping?platform=X`

---

### 3. Test file: `projects/brain-core/src/tests/vo-studio-webhook-handler.test.ts`

~35 tests, `node:test` + `node:assert/strict`, flat `test()` blocks:

**Write tests (~22):**

`processWebhookEventRequest` (7 tests):
- Valid case: `ok`, `approval.status === 'pending'`, `preview.delivery.status === 'received'`, `preview.delivery.webhookId`/`.platform`/`.eventType` echoed
- Missing `webhookId`, `projectId`, `platform`, `eventType` → error regex
- Missing `payload` (null) → `/payload is required/`
- Unique delivery IDs (two calls)

`verifyWebhookSignatureRequest` (6 tests):
- Valid case: `ok`, `preview.verification.status === 'verified'`
- Missing each of: `webhookId`, `projectId`, `secret`, `signature`, `rawBody` → error regex

`routeEventRequest` (4 tests):
- Valid case with youtube platform: `ok`, `preview.routing.internalEventType` contains `publish`
- Missing `projectId`, `platform`, `platformEventType` → error regex

Uniqueness (2 tests):
- `processWebhookEventRequest` generates unique delivery IDs
- `routeEventRequest` maps `tiktok.*` → `publish.*` variant

**Read tests (~13):**

`readWebhookDeliveries` (5 tests):
- Valid case: `ok`, `count === 0`, `deliveries === []`, both IDs echoed
- Missing `webhookId`, missing `projectId`
- Limit below 1, limit above 500

`readPlatformEventMapping` (3 tests):
- Valid case: `ok`, `mappings` is array, `platform` echoed
- Missing platform → error regex

---

## Verification

```bash
# From projects/brain-core/
npm test             # all tests must pass including new webhook-handler suite
npx tsc --noEmit     # no TypeScript errors
```

No UI changes needed for Phase 7 — this is a pure server-side adapter/routing layer. The EventLogPanel from Phase 6 will surface routed events naturally when the event stream is populated.
