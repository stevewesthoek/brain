# Plan: Phase 9 — Webhook Authorization & Security

## Context

Phases 5–8 built webhook registration, event routing, and analytics. The security lifecycle of a webhook (rotating its secret when compromised, disabling it when no longer needed, auditing security events) is currently missing. Phase 9 closes that gap by extending `vo-studio-orchestration.ts` with two write operations (rotate secret, disable webhook) and two read operations (security audit log, operational status), following exactly the same patterns already in that file.

---

## What changes

### 1. Extend `projects/brain-core/src/adapters/vo-studio-orchestration.ts`

Add 4 new `export interface` types and 4 new exported functions at the end of the file. All use `export interface` (matching the existing convention in this file — not unexported `type`).

**New interfaces:**

```typescript
export interface RotateWebhookSecretRequest {
  webhookId: string;
  projectId: string;
}
export interface RotateWebhookSecretResponse {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    webhook?: {
      id: string;
      projectId: string;
      newSecret: string;
      rotatedAt: string;
      status: string;
    };
  };
  error?: string;
}

export interface DisableWebhookRequest {
  webhookId: string;
  projectId: string;
  reason: string;
}
export interface DisableWebhookResponse {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    webhook?: {
      id: string;
      projectId: string;
      reason: string;
      disabledAt: string;
      status: string;
    };
  };
  error?: string;
}

export interface WebhookSecurityAuditEntry {
  id: string;
  webhookId: string;
  event: string;
  actor: string;
  at: string;
  detail?: string;
}
export interface WebhookSecurityAuditResponse {
  ok: boolean;
  entries: WebhookSecurityAuditEntry[];
  count: number;
  webhookId?: string;
  projectId?: string;
  error?: string;
}

export interface WebhookStatus {
  webhookId: string;
  status: 'active' | 'disabled' | 'rate-limited';
  lastDeliveryAt?: string;
  deliveryCount: number;
  failureCount: number;
  secretRotatedAt?: string;
}
export interface WebhookStatusResponse {
  ok: boolean;
  status?: WebhookStatus;
  webhookId?: string;
  error?: string;
}
```

**New write functions:**

- `rotateWebhookSecretRequest(request: RotateWebhookSecretRequest): RotateWebhookSecretResponse`
  - Validates `webhookId`, `projectId`
  - Calls `requestAction('custom-webhook-rotate-secret')`
  - Generates new secret: `Math.random().toString(36).slice(2, 32)` (exact same as `registerWebhookRequest`)
  - Preview: `{ webhook: { id: webhookId, projectId, newSecret, rotatedAt: now, status: 'active' } }`

- `disableWebhookRequest(request: DisableWebhookRequest): DisableWebhookResponse`
  - Validates `webhookId`, `projectId`, `reason`
  - Calls `requestAction('custom-webhook-disable')`
  - Preview: `{ webhook: { id: webhookId, projectId, reason, disabledAt: now, status: 'disabled' } }`

**New read functions:**

- `readWebhookSecurityAudit(webhookId: string, projectId: string, limit = 50): WebhookSecurityAuditResponse`
  - Validates `webhookId`, `projectId`; limit 1–500
  - Returns: `{ ok: true, entries: [], count: 0, webhookId, projectId }`

- `readWebhookStatus(webhookId: string): WebhookStatusResponse`
  - Validates `webhookId`
  - Returns: `{ ok: true, status: { webhookId, status: 'active', deliveryCount: 0, failureCount: 0 }, webhookId }`

---

### 2. Routes in `projects/brain-core/src/api/routes.ts`

Extend the existing `vo-studio-orchestration.js` import lines (lines 103 and 105):

```typescript
// Line 103 — extend write imports:
import { createAutomationRuleRequest, bulkApproveRequest, scheduleWorkflowRequest,
  registerWebhookRequest, rotateWebhookSecretRequest, disableWebhookRequest }
  from '../adapters/vo-studio-orchestration.js';

// Line 105 — extend read imports:
import { readAutomationRules, readSchedules, readWebhooks, readExecutionAudit,
  readWebhookSecurityAudit, readWebhookStatus }
  from '../adapters/vo-studio-orchestration.js';
```

Add 2 POST routes (after `/webhooks/verify`, before `/events/route`):
- `/api/video-orchestrator/webhooks/rotate-secret` — body: `{ webhookId, projectId }` — 202/400
- `/api/video-orchestrator/webhooks/disable` — body: `{ webhookId, projectId, reason }` — 202/400

Add 2 GET routes (after `/webhooks/deliveries`, before `/events/platform-mapping`):
- `/api/video-orchestrator/webhooks/security-audit?webhookId=X&projectId=Y&limit=N` — clamp limit inline — 200/400
- `/api/video-orchestrator/webhooks/status?webhookId=X` — 200/400

---

### 3. New test file: `projects/brain-core/src/tests/vo-studio-webhook-security.test.ts`

~25 tests, `node:test` + `node:assert/strict`, flat `test()` blocks. Two import blocks (writes first, then reads) following the established pattern.

**`rotateWebhookSecretRequest`** (5 tests):
- Valid: `ok`, `approval.status === 'pending'`, `preview.webhook.status === 'active'`, `preview.webhook.newSecret` is truthy, `webhookId` echoed
- Missing `webhookId` → `/webhookId is required/`
- Missing `projectId` → `/projectId is required/`
- Generates unique secrets (two calls, `assert.notEqual`)
- Secret is a non-empty string

**`disableWebhookRequest`** (4 tests):
- Valid: `ok`, `approval.status === 'pending'`, `preview.webhook.status === 'disabled'`, `reason` echoed
- Missing `webhookId`, `projectId`, `reason` → error regex each

**`readWebhookSecurityAudit`** (5 tests):
- Valid: `ok`, `entries === []`, `count === 0`, both IDs echoed
- Missing `webhookId` → `/webhookId is required/`
- Missing `projectId` → `/projectId is required/`
- Limit below 1 → `/limit must be between 1 and 500/`
- Limit above 500 → same

**`readWebhookStatus`** (4 tests):
- Valid: `ok`, `status.webhookId` echoed, `status.status === 'active'`, `status.deliveryCount === 0`
- Missing `webhookId` → `/webhookId is required/`
- `status.status` is a valid literal (`'active' | 'disabled' | 'rate-limited'`)
- `webhookId` echoed at top level

---

## Verification

```bash
# From projects/brain-core/
npm test             # all 840 + ~18 new tests must pass
npx tsc --noEmit     # no TypeScript errors
```

No UI changes needed for Phase 9.
