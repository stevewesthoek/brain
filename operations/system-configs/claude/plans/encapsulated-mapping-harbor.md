# Plan: Phase 10 — Dashboard & Summary

## Context

Phases 5–9 built the complete VO Studio server-side framework (writes, reads, events, webhooks, analytics, security). Phase 10 surfaces all of it in the UI: a new `StudioDashboardPanel` that consolidates pipeline health, routing stats, webhook status, and recent events into a single at-a-glance view. This is the capstone UI panel that ties together the work from all prior phases.

---

## What changes

### 1. New UI component: `projects/brain-console-obsidian/src/components/VO/StudioDashboardPanel.ts`

**Pattern:** Two-phase `PublishingDashboardPanel` — constructor + `async initialize()`. Constructor takes `(container: HTMLElement, projectId: string)`. VOShell calls `.initialize()` after `new`.

**Fields:**
```typescript
private refreshInterval: number | null = null;
private projectId: string;
```

**Lifecycle:**
```typescript
async initialize(): Promise<void> {
  this.render();           // skeleton HTML with placeholder dashes
  await this.loadAll();    // 4 parallel fetches, patch results in-place
  this.startAutoRefresh(); // 60-second interval
}

destroy(): void {
  if (this.refreshInterval) clearInterval(this.refreshInterval);
  this.container.innerHTML = '';
}
```

**`render()` — skeleton HTML structure:**
```
.vo-dashboard-panel
  .vo-panel-header
    h2 "VO Studio Dashboard"
    button#dashboard-refresh "Refresh"

  .vo-overview-card                          ← Health
    .vo-overview-title "Pipeline Health"
    .vo-health-grid#dashboard-health-grid

  .vo-overview-card                          ← Routing Stats
    .vo-overview-title "Routing Statistics"
    .vo-activity-grid#dashboard-routing-grid

  .vo-overview-card                          ← Webhook Summary
    .vo-overview-title "Webhook Summary"
    .vo-stats-table#dashboard-webhook-table

  .vo-overview-card                          ← Recent Events
    .vo-overview-title "Recent Events"
    #dashboard-events-list

  .vo-overview-card                          ← Quick Actions
    .vo-overview-title "Quick Actions"
    .vo-quick-actions
      buttons: Approvals | Packages | Publishing | Events | Webhooks
```

**`loadAll()` — 4 parallel native fetch calls:**
```typescript
private async loadAll(): Promise<void> {
  await Promise.allSettled([
    this.loadHealth(),
    this.loadRoutingStats(),
    this.loadWebhookSummary(),
    this.loadRecentEvents(),
  ]);
}
```

Each loader fetches from the Phase 8/9 endpoints and patches `querySelector` targets in-place:

- `loadHealth()` → `GET /api/video-orchestrator/analytics/pipeline-health?projectId=X`
  - Shows score (big number), status badge (`healthy`/`degraded`/`critical`)
  - Uses `.vo-health-badge` color classes already in CSS

- `loadRoutingStats()` → `GET /api/video-orchestrator/analytics/routing-statistics?projectId=X`
  - Shows 3 stats: total platforms, total mapped events, last routed timestamp
  - Uses `.vo-activity-grid` + `.vo-activity-stat` already in CSS

- `loadWebhookSummary()` → `GET /api/video-orchestrator/analytics/webhook-delivery-rates?projectId=X`
  - Shows success count, failure count, success rate
  - Uses `.vo-stats-table` rows already in CSS

- `loadRecentEvents()` → `GET /api/video-orchestrator/events/stream?projectId=X&limit=5`
  - Shows 5 most recent events: type badge + actor + time
  - Uses `.vo-event-type-badge` and `.vo-badge-*` classes from Phase 6

**Quick Actions** — simple buttons using existing `.vo-btn-secondary` class. No navigation logic needed; just labelled for context (display only in this phase).

**`startAutoRefresh()`:**
```typescript
private startAutoRefresh(): void {
  if (this.refreshInterval) clearInterval(this.refreshInterval);
  this.refreshInterval = window.setInterval(() => { this.loadAll(); }, 60000);
}
```

---

### 2. Modify `projects/brain-console-obsidian/src/components/VO/VOShell.ts`

4 changes, all following identical patterns to existing panels:

1. Import: `import { StudioDashboardPanel } from './StudioDashboardPanel.js';`
2. Field: `private studioDashboardPanel: StudioDashboardPanel | null = null;`
3. Tab button added after `events` in the HTML string: `<button class="vo-tab" data-tab="dashboard">Dashboard</button>`
4. In `renderCurrentTab()`:
   - Add teardown guard in the cleanup block: `if (this.studioDashboardPanel) { this.studioDashboardPanel.destroy(); this.studioDashboardPanel = null; }`
   - Add `case 'dashboard':` in switch — requires `state.projectId`, instantiates and calls `.initialize()`
5. In `destroy()`: add null-guard: `if (this.studioDashboardPanel) { this.studioDashboardPanel.destroy(); }`

---

### 3. Export from `projects/brain-console-obsidian/src/components/VO/index.ts`

Add: `export { StudioDashboardPanel } from './StudioDashboardPanel.js';`

---

### 4. CSS additions in `projects/brain-console-obsidian/styles.css`

Minimal — most classes already exist. Append ~40 lines after the closing `.vo-error` rule:

- `.vo-dashboard-panel` — flex column, gap 12px, padding 16px (same as `.vo-event-log`)
- `.vo-quick-actions` — flex row, gap 8px, flex-wrap wrap
- `.vo-health-score` — large number display (font-size 48px, font-weight 700, line-height 1)
- `.vo-health-score-healthy` / `.vo-health-score-degraded` / `.vo-health-score-critical` — color variants (green/amber/red)

---

## Verification

```bash
# From projects/brain-console-obsidian/
npm run build && npm run package && npm run install:active-vault
pkill -x "Obsidian" && sleep 2 && open -a Obsidian
# → Open Brain Console → VO Studio → select project → click "Dashboard" tab
# → Should show: Pipeline Health, Routing Stats, Webhook Summary, Recent Events, Quick Actions
# → Auto-refreshes every 60s
```

No brain-core changes — Phase 10 is UI-only, consuming the Phase 8/9 endpoints already live.
