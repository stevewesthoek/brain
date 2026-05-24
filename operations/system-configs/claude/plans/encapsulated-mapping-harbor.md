# Plan: Phase 8 — Analytics & Metrics

## Context

Phases 5–7 built webhook registration, event emission, and inbound webhook routing. All those operations now produce data (deliveries, events, routing decisions) but nothing aggregates or reports on them. Phase 8 adds four analytics read functions that aggregate delivery rates, event latency, routing statistics, and overall pipeline health. These are pure read stubs that follow the exact pattern already in `vo-studio-read.ts` — no new file needed.

---

## What changes

### 1. Extend `projects/brain-core/src/adapters/vo-studio-read.ts`

Add 4 new exported interfaces and 4 new exported functions at the end of the file. All follow the exact patterns already in the file:
- Singular-metrics functions (like `readPublishingMetrics`): validate `projectId`, return `{ ok, metrics?: XxxMetrics, projectId? }`
- Array-metrics functions (like `readPerformanceMetrics`): validate `projectId`, return `{ ok, <collection>: [], projectId? }`

**New interfaces:**

```typescript
export interface WebhookDeliveryRates {
  successCount: number;
  failureCount: number;
  pendingCount: number;
  successRate: number;
  byPlatform: Record<string, { success: number; failure: number; pending: number }>;
}
export interface WebhookDeliveryRatesResponse {
  ok: boolean;
  metrics?: WebhookDeliveryRates;
  projectId?: string;
  error?: string;
}

export interface EventLatencyEntry {
  eventType: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  sampleCount: number;
}
export interface EventLatencyMetricsResponse {
  ok: boolean;
  entries: EventLatencyEntry[];
  projectId?: string;
  error?: string;
}

export interface RoutingStatEntry {
  platform: string;
  mappingCount: number;
  eventTypes: string[];
  lastRoutedAt: string;
}
export interface RoutingStatisticsResponse {
  ok: boolean;
  stats: RoutingStatEntry[];
  projectId?: string;
  error?: string;
}

export interface PipelineHealthComponent {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
}
export interface PipelineHealth {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: Record<string, PipelineHealthComponent>;
}
export interface PipelineHealthResponse {
  ok: boolean;
  health?: PipelineHealth;
  projectId?: string;
  error?: string;
}
```

**New functions:**

```typescript
export function readWebhookDeliveryRates(projectId: string): WebhookDeliveryRatesResponse
// validates projectId; returns { ok: true, metrics: { successCount:0, failureCount:0, pendingCount:0, successRate:0, byPlatform:{} }, projectId }

export function readEventLatencyMetrics(projectId: string): EventLatencyMetricsResponse
// validates projectId; returns { ok: true, entries: [], projectId }

export function readRoutingStatistics(projectId: string): RoutingStatisticsResponse
// validates projectId; returns { ok: true, stats: [], projectId }

export function readPipelineHealth(projectId: string): PipelineHealthResponse
// validates projectId; returns { ok: true, health: { score:100, status:'healthy', components:{} }, projectId }
```

Each follows the identical validation pattern already in the file:
```typescript
if (!projectId?.trim()) {
  return { ok: false, error: 'projectId is required', ... };
}
```

---

### 2. Routes in `projects/brain-core/src/api/routes.ts`

Add 1 import line after the existing vo-studio-read imports (line ~104):
```typescript
import { ..., readWebhookDeliveryRates, readEventLatencyMetrics, readRoutingStatistics, readPipelineHealth } from '../adapters/vo-studio-read.js';
```
(Extend the existing import line, don't add a new one — the 4 new functions join the existing `readApprovalQueue, readWorkflowState, ...` import.)

Add 4 GET routes after the last `platform-mapping` route, before `/research/video-analyze`:

```
GET /api/video-orchestrator/analytics/webhook-delivery-rates?projectId=X
GET /api/video-orchestrator/analytics/event-latency?projectId=X
GET /api/video-orchestrator/analytics/routing-statistics?projectId=X
GET /api/video-orchestrator/analytics/pipeline-health?projectId=X
```

All use `.startsWith()` match, `url.searchParams.get('projectId') ?? ''`, `sendJson(response, result.ok ? 200 : 400, result)`.

---

### 3. New test file: `projects/brain-core/src/tests/vo-studio-analytics.test.ts`

~20 tests, `node:test` + `node:assert/strict`, flat `test()` blocks:

**`readWebhookDeliveryRates`** (3 tests):
- Valid: `ok === true`, `metrics` exists, `metrics.successCount === 0`, `metrics.byPlatform` is object, `projectId` echoed
- Missing projectId: `ok === false`, `/projectId is required/`
- Empty string projectId: same failure

**`readEventLatencyMetrics`** (3 tests):
- Valid: `ok === true`, `entries` is empty array, `projectId` echoed
- Missing projectId: `ok === false`, `/projectId is required/`
- entries is an array (deepEqual `[]`)

**`readRoutingStatistics`** (3 tests):
- Valid: `ok === true`, `stats` is empty array, `projectId` echoed
- Missing projectId: `ok === false`, `/projectId is required/`
- stats deepEqual `[]`

**`readPipelineHealth`** (4 tests):
- Valid: `ok === true`, `health` exists, `health.score === 100`, `health.status === 'healthy'`, `projectId` echoed
- Missing projectId: `ok === false`, `/projectId is required/`
- `health.components` is object
- `health.status` is one of valid literal values

**Cross-function** (2 tests):
- All four functions echo back the same projectId passed in
- All four return `ok: true` with non-null response objects for a valid projectId

---

### 4. UI: Add analytics tab to EventLogPanel — NO (out of scope for Phase 8)

Phase 8 is server-side only. No UI changes needed — the OverviewPanel in the console already calls `readPublishingMetrics` and `readApprovalStatistics`; the new analytics endpoints can be wired into an existing or future panel without any blocking work here.

---

## Verification

```bash
# From projects/brain-core/
npm test             # all tests must pass including new vo-studio-analytics suite
npx tsc --noEmit     # no TypeScript errors
```
