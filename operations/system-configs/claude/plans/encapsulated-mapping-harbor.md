# Plan: Phase 6 — Event Processing & Real-time Updates

## Context

Phases 1–5 of the VO Studio framework established write operations (approval-gated mutations), read operations (analytics and queue reads), and workflow automation (rules, scheduling, webhooks). Phase 6 closes the feedback loop: events that fire from those operations need to be captured, read back, acknowledged, and displayed in the UI. This phase adds event emission, event history reads, subscription management, an EventLogPanel UI component, and test coverage — all following the established patterns exactly.

---

## What changes

### 1. New adapter: `projects/brain-core/src/adapters/vo-studio-events.ts`

**Write functions:**

- `emitEventRequest({ projectId, type, payload, actor })` — emits a custom event for a project. Validates all 4 fields required. Routes through `custom-event-emit`. Preview returns `{ event: { id, projectId, type, payload, actor, at, status: 'queued' } }`.
- `acknowledgeEventRequest({ eventId, projectId })` — marks an event acknowledged. Validates both fields. Routes through `custom-event-acknowledge`. Preview returns `{ event: { id, projectId, acknowledgedAt, status: 'acknowledged' } }`.
- `subscribeToEventsRequest({ projectId, eventTypes, webhookId? })` — creates an event subscription. Validates projectId and non-empty eventTypes array. Routes through `custom-event-subscribe`. Generates unique `subscriptionId`. Preview returns `{ subscription: { id, projectId, eventTypes, webhookId?, status: 'active', createdAt } }`.

**Read functions:**

- `readEventStream(projectId, limit = 50, since?)` — list recent events. Validates projectId, limit 1–500. Returns `{ ok, events: [], count: 0, projectId }`.
- `readEventHistory(projectId, eventType?, limit = 50)` — filtered history. Validates projectId, limit 1–500. Returns `{ ok, events: [], count: 0, projectId }`.
- `readActiveSubscriptions(projectId)` — list subscriptions. Validates projectId. Returns `{ ok, subscriptions: [], count: 0, projectId }`.

**Inline types** (same self-contained pattern as `vo-studio-orchestration.ts` — no external type imports):
```typescript
type EmitEventRequest = { projectId: string; type: string; payload: Record<string,unknown>; actor: string }
type AcknowledgeEventRequest = { eventId: string; projectId: string }
type SubscribeToEventsRequest = { projectId: string; eventTypes: string[]; webhookId?: string }
// Response types: { ok, approval?, preview?, error? } for writes; { ok, events/subscriptions, count, projectId?, error? } for reads
```

Only import: `import { requestAction } from './actions.js';`

---

### 2. New routes in `projects/brain-core/src/api/routes.ts`

Add two import lines (alongside existing orchestration imports):
```typescript
import { emitEventRequest, acknowledgeEventRequest, subscribeToEventsRequest } from '../adapters/vo-studio-events.js';
import { readEventStream, readEventHistory, readActiveSubscriptions } from '../adapters/vo-studio-events.js';
```

Add 6 routes (3 POST, 3 GET) following exact existing patterns:

**POST (exact `===` match, 202 on success / 400 on error):**
- `/api/video-orchestrator/events/emit` — body: `{ projectId, type, payload, actor }`
- `/api/video-orchestrator/events/acknowledge` — body: `{ eventId, projectId }`
- `/api/video-orchestrator/events/subscribe` — body: `{ projectId, eventTypes[], webhookId? }` — use conditional assignment for optional `webhookId`

**GET (`.startsWith()` match, 200 on success / 400 on error):**
- `/api/video-orchestrator/events/stream?projectId=X&limit=N&since=Y` — clamp limit inline, pass `since ?? undefined`
- `/api/video-orchestrator/events/history?projectId=X&eventType=Z&limit=N` — clamp limit, pass `eventType ?? undefined`
- `/api/video-orchestrator/events/subscriptions?projectId=X`

---

### 3. New test file: `projects/brain-core/src/tests/vo-studio-events.test.ts`

~30 tests using `node:test` + `node:assert/strict`, flat `test()` blocks:

**Write tests (~18):**
- `emitEventRequest`: valid case (ok, approval, preview.event.status === 'queued'), each required field empty rejection, payload shape echoed
- `acknowledgeEventRequest`: valid case (ok, preview.event.status === 'acknowledged'), missing eventId, missing projectId
- `subscribeToEventsRequest`: valid case (ok, preview.subscription.status === 'active'), missing projectId, empty eventTypes, with webhookId echoed, unique subscriptionId across 2 calls

**Read tests (~12):**
- `readEventStream`: valid case (ok, count 0, empty events, projectId echoed), missing projectId, limit below 1, limit above 500, accepts valid limit
- `readEventHistory`: valid case, missing projectId, optional eventType accepted when provided
- `readActiveSubscriptions`: valid case, missing projectId

---

### 4. New UI component: `projects/brain-console-obsidian/src/components/VO/EventLogPanel.ts`

Constructor: `(container: HTMLElement, projectId: string)`

**Fields:**
```typescript
private refreshInterval: number | null = null;
private eventTypeFilter: string = '';
```

**Lifecycle** (`initialize()` / `destroy()`):
```typescript
async initialize(): Promise<void> {
  this.render();
  await this.loadEvents();
  this.startAutoRefresh();        // 15-second interval
}
destroy(): void {
  if (this.refreshInterval) clearInterval(this.refreshInterval);
  this.container.innerHTML = '';
}
```

**Render layout:**
- Header: "Event Log" + filter dropdown (All / package.* / approval.* / publish.* / webhook.*) + Refresh button
- Metrics row: total events, last event timestamp, active subscriptions count
- Events table: columns `Type | Actor | Timestamp | Status | Payload preview`
- Empty state: "No events recorded yet"
- Loading/error states

**Fetch pattern** — native `fetch` with relative URLs (same as `ApprovalQueuePanel`/`PublishingDashboardPanel`):
```typescript
const res = await fetch(`/api/video-orchestrator/events/stream?projectId=${this.projectId}&limit=50${filter}`);
const data = await res.json() as { ok: boolean; events?: EventEntry[]; error?: string };
```

---

### 5. Modify VOShell: `projects/brain-console-obsidian/src/components/VO/VOShell.ts`

1. Add import: `import { EventLogPanel } from './EventLogPanel.js';`
2. Add field: `private eventLogPanel: EventLogPanel | null = null;`
3. Add tab button to HTML string: `<button class="vo-tab" data-tab="events">Events</button>`
4. Add teardown guard in `renderCurrentTab()` (before the switch):
   ```typescript
   if (this.eventLogPanel) { this.eventLogPanel.destroy(); this.eventLogPanel = null; }
   ```
5. Add switch case:
   ```typescript
   case 'events':
     if (state.projectId) {
       this.eventLogPanel = new EventLogPanel(this.contentContainer, state.projectId);
       this.eventLogPanel.initialize();
     } else {
       this.contentContainer.innerHTML = `<div class="vo-empty-state"><p>Select a project to view event log</p></div>`;
     }
     break;
   ```
6. Add null-guard in `destroy()`:
   ```typescript
   if (this.eventLogPanel) { this.eventLogPanel.destroy(); }
   ```

---

### 6. Export from index: `projects/brain-console-obsidian/src/components/VO/index.ts`

Add: `export { EventLogPanel } from './EventLogPanel.js';`

---

### 7. CSS additions in `projects/brain-console-obsidian/styles.css`

~100 lines for EventLogPanel:
- `.vo-event-log` container
- `.vo-event-filter-bar` with dropdown + refresh button
- `.vo-event-table` — standard table with `border-collapse`, alternating row tints
- `.vo-event-type-badge` with color variants per event category (package/approval/publish/webhook)
- `.vo-event-payload-preview` — truncated monospace, expands on click
- `.vo-event-status-queued`, `.vo-event-status-acknowledged` badges
- Reuse existing `.vo-empty-state`, `.vo-loading`, `.vo-error` classes

---

## Verification

```bash
# From projects/brain-core/
npm test                          # all tests must pass including new vo-studio-events suite
npx tsc --noEmit                  # no TypeScript errors

# From projects/brain-console-obsidian/
npm run build && npm run package && npm run install:active-vault
pkill -x "Obsidian" && sleep 2 && open -a Obsidian
# → Open Brain Console → VO Studio → select a project → click "Events" tab → see EventLogPanel
```

**Promise/destructuring alignment check** (run after any view.ts change):
If `EventLogPanel` is wired into the main snapshot load in `view.ts`, run the alignment check. If the panel only uses independent `fetch` calls (preferred), no snapshot change is needed and the alignment check is not required.
