# Obsidian Command Center Dashboard Specification

**Date:** 2026-05-17  
**Status:** Architecture & Design Specification (not yet implemented)  
**Scope:** Visual dashboard design + Brain Console plugin implementation roadmap  
**Safety:** Read-only, no Mind mutations, no broad execution, preview-only governance  

## 1. Purpose

The Obsidian Command Center dashboard transforms the Brain Console plugin into the user's single operating cockpit. It provides:

- **System health at a glance**: Brain Core status, model-router health, wiki maintenance needs, approval queue status
- **Black-box automation visibility**: What changed, what failed, what needs approval
- **Sparse, actionable design**: No raw JSON, logs, or noise—only what requires attention
- **Clear governance boundaries**: All actions are preview-first, approval-gated, reversible

### Component Ownership

| Component | Owner | Role | Mutates Mind |
|-----------|-------|------|--------------|
| Obsidian vault | Human user | Durable memory, daily work surface | Yes (human only) |
| `live/machine.md` | Brain Core + Human | Brain visibility dashboard, entry point | No (read-only surface) |
| `wiki/log.md` | Human (append-only) | Maintenance ledger | No (human-written only) |
| Brain Core API | Brain Console plugin | Runtime truth, approval gates, execution boundaries | No (read-only) |
| Model-router dry-run | Brain (scheduler) | Report-only maintenance proposals | No (preview-only) |
| Command Center dashboard | Brain Console plugin | Visual cockpit (rendered HTML, not Markdown) | No (read-only plugin) |

### Black-Box Promise

The user should **never need to browse raw Markdown files** to understand:

- ✅ System health → Command Center overview tab
- ✅ What changed → Maintenance preview card
- ✅ What failed → Scheduler & runtime reports card
- ✅ What needs approval → Approvals card
- ✅ Model-router proposals → Maintenance preview detail modal (future)
- ✅ Wiki health → Wiki health card
- ✅ Next safe action → "Next Safe Action" card
- ✅ Capture health → Capture inbox/failed count cards

---

## 2. Dashboard Principles

### Visual Principles

1. **Dark Cyber Cockpit Aesthetic**: Terminal-like interface with warm red/orange accent colors, monospaced system data labels, clear hierarchy
2. **Sparse & Dense**: Show only what matters. No fluff, no generic UI, no scrolling wall of text
3. **Cards Over Files**: Information chunked into discrete cards, each answering one question
4. **Badges and Pills**: Use color-coded pills for status (LIVE/OFFLINE/DEGRADED), risk levels (LOW/MEDIUM/HIGH), counts
5. **Monospace System Data**: Metrics, counts, timestamps, paths in monospace font; human text in sans-serif
6. **Progressive Disclosure**: Summary view by default; detail modal on click (implement later)
7. **No Secrets, Logs, or JSON**: All raw data stays in Brain Core runtime; dashboard shows summaries only

### Interaction Principles

1. **Request-Only Actions**: Buttons never directly execute; they request approval through Brain Core
2. **No Broad Execution**: No "run arbitrary commands" button; only safe, pre-approved actions
3. **Local-Only**: Plugin connects to localhost Brain Core only; no external internet
4. **Read-Only**: Plugin is read-only; all writes must go through human-authored Markdown or Brain Core approval gates
5. **No Mutation of Mind**: Plugin never writes to Mind vault, even indirectly
6. **Graceful Degradation**: Dashboard works with partial data; cards show "unavailable" if upstream fails

### Data Principles

1. **Truth-Source Clarity**: Each card explicitly indicates data source (Brain Core endpoint, Mind file link)
2. **No Duplication**: Dashboard summarizes; it does not duplicate long content from Mind
3. **Sparse Links, Not Embeds**: Links to Mind files, not imported content
4. **Real-Time Status Only**: Dashboard reflects latest Brain Core snapshot; not a historical view
5. **Refresh Cadence**: Manual refresh button; no auto-polling (respects local resource budget)

---

## 3. Visual Style Direction

### Color Palette

- **Background**: Deep gray-black (`#0a0e27` or similar—dark terminal)
- **Primary accent**: Warm red-orange (`#ff6b3d` or `#ff5722`—cyber glow, alerts)
- **Secondary accent**: Cool cyan/blue (`#00d9ff` or similar—info, "live" status)
- **Success**: Green (`#10b981`—ok, healthy)
- **Warning**: Amber/yellow (`#f59e0b`—caution, review needed)
- **Error**: Red (`#ef4444`—critical, failures)
- **Neutral text**: Light gray (`#e5e7eb`—readable contrast)
- **Muted text**: Medium gray (`#9ca3af`—secondary info)

### Typography & Spacing

- **Header font**: Sans-serif, bold, uppercase (e.g., "COMMAND CENTER")
- **Section titles**: Sans-serif, semi-bold, title case (e.g., "Wiki Health", "Approvals")
- **System data**: Monospace (for counts, timestamps, paths, risk levels)
- **Body text**: Sans-serif, regular (descriptions, card titles)
- **Line height**: 1.5 for readability
- **Spacing**: 16px base unit; cards have 12px padding, 8px gaps between

### Layout Patterns

- **Top status strip**: Horizontal bar showing system status pills (Brain Core, model-router, wiki, maintenance, approvals, scheduler)
- **Cards**: Fixed width (280-320px), stack vertically on small screens, grid on wide
- **Tabs**: Horizontal tab bar (Overview, Mind, Automation, Research, Approvals) with active indicator
- **Hero burn bar**: Progress bar showing system attention (based on error/warning/approval counts)
- **Action row**: Horizontal button group (Refresh, Request Dry-Run, View Latest Preview, Open Mind, Open Wiki Log)
- **Activity panel**: Scrollable, monospace, terminal-style text area showing recent events
- **Modals**: Dark overlay with centered card (for future detail views)

### Responsive Fallback

- **Narrow (<600px)**: Single-column layout, stacked cards, full-width buttons
- **Wide (>1200px)**: Two-column grid, more compact cards
- **Mobile/degraded**: Show text-only fallback if CSS fails; ensure readability

---

## 4. Target Dashboard Sections (MVP)

### Overview Tab (Primary Focus)

The main operational view. Shows system health, pending actions, and next steps.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Command Center    [LIVE]    Last refresh: 2026-05-17 19:30  │
├─────────────────────────────────────────────────────────────┤
│ Status Strip: [Brain Core ✓] [Model-Router ✓] [Wiki ⚠]      │
│              [Maintenance ◆] [Approvals ○] [Scheduler ✓]    │
├─────────────────────────────────────────────────────────────┤
│                   System Burn / Attention Window            │
│  ████░░░░░░░░░░░░░░░░░░░░░░  42% (5 findings, 2 pending)   │
├──────────────────────┬──────────────────────────────────────┤
│ Wiki Health          │ Maintenance Previews                 │
│ ✓ OK                 │ ◆ 8 actions pending                  │
│ 0 errors             │ 1 approval required                  │
│ 1 warning            │ 2 low-risk, 5 medium, 1 high        │
├──────────────────────┼──────────────────────────────────────┤
│ Approvals            │ Scheduler                            │
│ ○ 0 pending          │ Last run: 1h ago                     │
│ ✓ 2 approved today   │ Status: OK                           │
│ ✗ 1 rejected         │ 4 jobs active                        │
├──────────────────────┼──────────────────────────────────────┤
│ Captures             │ Brain Core                           │
│ 📦 3 in inbox        │ ✓ LIVE (uptime 47d)                 │
│ ✗ 1 failed (retry)   │ Mode: read-only                     │
├─────────────────────────────────────────────────────────────┤
│ [ Refresh ] [ Request Dry-Run ] [ View Latest ] [ Mind Doc] │
├─────────────────────────────────────────────────────────────┤
│ NEXT SAFE ACTION                                             │
│ › Review stale capture: capture/inbox/2026-05-10-email.md  │
│   Age: 7 days (max threshold)                               │
│   Action: Review, route, or archive                         │
├─────────────────────────────────────────────────────────────┤
│ LATEST MAINTENANCE PREVIEW                                   │
│ › Wiki log missing from index                               │
│   Target: wiki/index.md                                     │
│   Operation: update wiki index link                         │
│   Risk: low                                                 │
├─────────────────────────────────────────────────────────────┤
│ ACTIVITY / RECENT EVENTS (monospace panel)                   │
│ 2026-05-17 19:30:00 scheduler-run-model-router-dry-run ok  │
│ 2026-05-17 18:15:00 approval pending: review wiki changes  │
│ 2026-05-17 17:45:00 capture inbox routine: 3 new items     │
│ 2026-05-17 15:22:00 wiki health check: 1 stale found       │
├─────────────────────────────────────────────────────────────┤
│ Brain owns runtime. Mind owns durable memory.               │
│ Writes require explicit approval.                           │
└─────────────────────────────────────────────────────────────┘
```

**Cards in Overview:**

1. **Status Strip** (top, horizontal)
   - Brain Core: LIVE / OFFLINE / DEGRADED (pill color)
   - Model Router: OK / STALE / ERROR (pill)
   - Wiki Health: OK / WARNINGS / ERRORS (pill)
   - Maintenance Previews: count badge
   - Approvals: count badge (red if >0 pending)
   - Scheduler: OK / FAILED / UNKNOWN (pill)

2. **System Burn / Attention Window** (hero panel)
   - Progress bar: 0-25% green, 25-50% amber, 50-100% red
   - Calculated from: error_count + (warning_count * 0.5) + (approval_required_count * 0.75)
   - Shows: percentage, total findings, approval-required count
   - Click: (future) drill down to findings list

3. **Wiki Health** (card)
   - Status: OK / WARNINGS / ERRORS
   - Errors: count (e.g., "0 errors")
   - Warnings: count (e.g., "2 warnings")
   - Latest finding: one-liner (e.g., "missing source trace in wiki/business.md")
   - Click: (future) link to wiki-health detail

4. **Maintenance Previews** (card)
   - Total actions: count (e.g., "8 actions pending")
   - Risk breakdown: "2 low, 5 medium, 1 high"
   - Approvals required: count (e.g., "1 approval required")
   - Latest action: one-liner title (e.g., "Create missing wiki/log.md")
   - Status pill: LOW / MEDIUM / HIGH (color-coded)

5. **Approvals** (card)
   - Pending: count (pill, red if > 0)
   - Approved today: count
   - Rejected: count
   - Pending detail: (future) expandable list

6. **Scheduler** (card)
   - Latest run: timestamp + age (e.g., "1h ago")
   - Status: OK / FAILED / UNKNOWN (pill)
   - Active jobs: count (e.g., "4 jobs")
   - Last job: one-liner (e.g., "model-router-dry-run")

7. **Captures** (card)
   - Inbox count: badge (e.g., "3 in inbox")
   - Failed count: badge with alert if any (e.g., "1 failed ✗")
   - Age of oldest: (e.g., "oldest: 2d")
   - Status: OK if all < 7 days, WARNING if approaching, ERROR if stale

8. **Brain Core** (card)
   - Status: LIVE / OFFLINE / DEGRADED (large pill)
   - Uptime: (e.g., "47 days")
   - Mode: "read-only"
   - URL: host only, no credentials (e.g., "localhost:3000")

9. **Next Safe Action** (panel)
   - Icon: target / arrow / flag
   - Title: concise action name (e.g., "Review stale capture")
   - Path: one-liner (e.g., "capture/inbox/2026-05-10-email.md")
   - Details: age, reason, recommended action
   - Source: data source (Brain Core endpoint)

10. **Latest Maintenance Preview** (panel)
    - Icon: ◆ (diamond)
    - Title: maintenance action title (e.g., "Update wiki index link")
    - Target: path (e.g., "wiki/index.md")
    - Operation: type (create / patch / review / none)
    - Risk: LOW / MEDIUM / HIGH (color-coded)

11. **Activity Panel** (monospace, scrollable, bottom)
    - Rows: `TIMESTAMP source event_type status`
    - Example: `2026-05-17 19:30:00 scheduler-run-model-router-dry-run ok`
    - Limit: last 10-20 events (avoid scroll)
    - Format: monospace, gray background, green text for ok, red for error

### Action Row (below hero)

Buttons for safe, request-only actions:

- **[ Refresh ]**: Fetch latest data from Brain Core (no arguments)
- **[ Request Model-Router Dry-Run ]**: POST to `/scheduler/jobs/scheduler-run-model-router-dry-run/request-run` (safe, already approved endpoint)
- **[ View Latest Preview ]**: Navigate to `/execution/maintenance-previews/latest` (future modal)
- **[ Open Mind Dashboard ]**: Deep link to `HOME.md` in Obsidian
- **[ Open Wiki Log ]**: Deep link to `wiki/log.md`

### Placeholder Tabs (not implemented yet, visual only)

- **Mind tab**: (disabled) Future: Today summary, live tasks, live projects
- **Automation tab**: (disabled) Future: scheduler jobs detail, dry-run status, approval queues
- **Research tab**: (disabled) Future: wiki health detail, sources inventory, stale claims
- **Approvals tab**: (disabled) Future: pending approvals with preview/reject flow (only if safe route exists)

---

## 5. Data Sources & API Mapping

Each card is fed by Brain Core endpoints or direct Mind file links:

| Card | Primary Source | Fallback | Update Frequency |
|------|---|---|---|
| **Status Strip** | `/status` | offline if unreachable | manual refresh |
| **System Burn** | `/runtime/reports` + `/execution/maintenance-previews` | empty/0 if missing | manual refresh |
| **Wiki Health** | `/runtime/reports` (model-router.wikiHealth) | "unavailable" | manual refresh |
| **Maintenance Previews** | `/execution/maintenance-previews/latest` | "unavailable" | manual refresh |
| **Approvals** | `/approvals` + `/approvals/store` | empty list | manual refresh |
| **Scheduler** | `/scheduler/latest-run` + `/scheduler/jobs` | "unavailable" | manual refresh |
| **Captures** | Mind file scan (future: Brain Core endpoint if added) | fallback to n/a | manual refresh |
| **Brain Core** | `/status` | show offline | manual refresh |
| **Next Safe Action** | `/execution/maintenance-previews` + `/runtime/reports` | "none found" | manual refresh |
| **Latest Maintenance Preview** | `/execution/maintenance-previews/latest` | "none" | manual refresh |
| **Activity Panel** | `/runtime/reports` (events) + `/scheduler/latest-run` | empty | manual refresh |

---

## 6. What NOT to Show

**Explicitly Excluded:**

- ❌ Raw runtime JSON or JSONL
- ❌ Full audit trail (only summary)
- ❌ Terminal logs or stack traces
- ❌ Full diff bodies (only path + operation type)
- ❌ Giant file lists or vault tree
- ❌ Credentials, secrets, or tokens
- ❌ Internal node IDs or UUIDs (unless user-relevant)
- ❌ Implementation details (how the plugin fetches data, internal state)
- ❌ Full Markdown file contents (link instead, let user choose to read)
- ❌ Real-time polling updates (manual refresh only)

**Reasons:**

- User experience: too much noise
- Security: avoid exposing raw secrets or internal IDs
- Performance: reduce requests, respect local resources
- Intent: dashboard is a cockpit, not a debugger

---

## 7. MVP (Minimum Viable Product)

**Scope for first implementation:**

### Must Have

- Overview tab (only active tab)
- Status strip (6 pills)
- Top 3 metric cards (Wiki Health, Maintenance Previews, Approvals)
- Scheduler card
- Brain Core card
- Next Safe Action card
- Action row (Refresh button + open Mind/Wiki links)
- Activity panel (read-only event list)
- Dark cockpit CSS styling
- Graceful error states (show "unavailable" if endpoint fails)

### Nice-to-Have (Phase 2)

- Captures card
- Latest Maintenance Preview panel
- System Burn progress bar
- Modal for preview detail
- Tab headers for Mind/Automation/Research/Approvals (visual, not clickable)

### Out-of-Scope for MVP

- Approval UI (request/approve/reject flow)—blocked until approval policy is safe
- Full maintenance preview list
- Interactive command execution
- Real-time auto-refresh
- Custom theming / settings UI
- Mobile layout optimization (focus on desktop Obsidian)

**Success Criteria:**

- Plugin builds and typechecks with no errors
- Renders Overview tab in Obsidian
- All Brain Core endpoints return data (or show unavailable gracefully)
- CSS is polished, dark cockpit aesthetic
- No raw JSON or secrets shown
- No writes to Mind or Obsidian config
- No broad command execution
- Manual testing shows readable, sparse, black-box dashboard

---

## 8. Later Phases

### Phase 2: Richer Dashboard

- Implement remaining cards (Captures, Latest Preview detail)
- Add System Burn progress bar
- Add modal for maintenance preview detail (show full action list)
- Add modal for wiki health findings
- Add modal for scheduler job detail

### Phase 3: Tabs

- Implement clickable Mind tab (today summary, live tasks, live projects, stale captures)
- Implement Automation tab (scheduler jobs, dry-run status, approval queues)
- Implement Research tab (wiki findings, sources, stale claims)
- Implement Approvals tab (pending + approved history, if approval policy is safe)

### Phase 4: Interactivity

- Approve/reject actions from Obsidian (only if Brain Core approval route is available and safe)
- Request custom scheduler job runs (only safe, pre-approved actions)
- Filter and search (approvals, jobs, findings)

### Phase 5: Polish

- Theming: user-selectable dark/light/auto, accent color picker
- Keyboard shortcuts
- Accessibility: ARIA labels, screen reader support, color-blind-friendly palette
- Mobile layout fallback
- Export dashboard as markdown (static snapshot for sharing)

---

## 9. Technology & Implementation Notes

### Architecture

- **Language**: TypeScript (existing plugin uses TS)
- **DOM**: Vanilla HTML + CSS (no React unless plugin already uses it; keep dependencies minimal)
- **Data flow**: Brain Core client → types → view render → DOM
- **Error handling**: Graceful "unavailable" states, no 4xx/5xx crashes
- **State**: Minimal; fetch fresh data on refresh button (no complex state tree)

### Key Files to Modify

```
projects/brain-console-obsidian/src/
  ├── main.ts         (entry point, register command/view)
  ├── client.ts       (extend with new data types for dashboard)
  ├── view.ts         (implement Dashboard view + render methods)
  └── styles.css      (cockpit dark theme, cards, grid, responsive)

projects/brain-console-obsidian/
  ├── manifest.json   (update description, if needed)
  └── package.json    (update version, ensure build script works)
```

### Build & Validation

```bash
cd projects/brain-console-obsidian
npm install
npm run typecheck
npm run build
ls dist/  # should contain main.js, manifest.json, styles.css
```

### Install Testing

Manual test in Obsidian (not auto-deployed):
1. Build plugin locally
2. Copy `dist/` to `mind/.obsidian/plugins/brain-console-obsidian/` (temporary, for testing only)
3. Restart Obsidian
4. Open Command Palette, search "Command Center"
5. Click to open dashboard
6. Verify all cards render with real data from Brain Core
7. Test Refresh button (should re-fetch from localhost Brain Core)
8. Do NOT commit plugin files to Mind repo

---

## 10. Safety Checklist

- [ ] Dashboard is read-only: no writes to Mind, Obsidian config, or filesystem
- [ ] Brain Core is local-only (localhost): no external internet
- [ ] All action buttons are request-only: no direct execution of commands
- [ ] No broad shell runner or arbitrary command execution
- [ ] No secrets, tokens, or credentials shown (even in logs)
- [ ] No raw runtime JSON or internal audit JSONL exposed
- [ ] Error states are graceful: "unavailable" instead of crashes
- [ ] Markdown links in dashboard, not embedded content
- [ ] Plugin build/typecheck validates on every change
- [ ] No plugin bundle copied into Mind repo automatically

---

## 11. User Experience Flow

### Daily Workflow

1. **Open Obsidian**
   - Default view: `HOME.md` (user's entry point)

2. **Switch to Command Center**
   - Open Obsidian Command Palette (Cmd+P)
   - Search "Brain Command Center"
   - Opens dashboard tab

3. **Glance at Overview**
   - Check status pills: "all green?" → no action needed
   - Check System Burn: "low percentage?" → stable
   - Check Maintenance Previews: "0 actions?" → vault is clean
   - Check Approvals: "0 pending?" → no decisions needed

4. **Spot an Alert**
   - Status pill shows ⚠️ on Wiki Health
   - Click card to see finding
   - May decide to review or dismiss

5. **Check Next Safe Action**
   - "Review stale capture: capture/inbox/2026-05-10-email.md"
   - Decide: archive, route to live, or delete
   - Switch to Mind dashboard to manage capture

6. **Request Dry-Run (if desired)**
   - Click "[ Request Model-Router Dry-Run ]"
   - Brain Core queues the request in scheduler
   - Comes back with preview artifacts
   - Next refresh shows updated maintenance preview queue

7. **Activity Panel (optional)**
   - Glance at monospace activity log
   - "scheduler-run-model-router-dry-run ok" ← executed automatically at night

### No Direct Execution

The user **never** runs commands from the dashboard. All actions are requests:
- Request dry-run → scheduler picks up in queue
- Request approval → audit trail recorded
- Open Mind doc → user edits in Obsidian, not automated

---

## Acceptance Criteria

Dashboard is "done" when:

1. ✅ Plugin compiles with `npm run build`
2. ✅ TypeScript typechecks with no errors
3. ✅ Overview tab renders with all 8 core cards
4. ✅ All Brain Core endpoints are called and display data (or "unavailable")
5. ✅ CSS is dark cockpit style with warm accent (not default Obsidian theme)
6. ✅ Refresh button re-fetches data and updates cards
7. ✅ Action buttons are visible and labeled (request-only, no execution)
8. ✅ No raw JSON or secrets are shown in any card
9. ✅ Error states show "unavailable" gracefully
10. ✅ Manual testing in Obsidian shows readable, sparse, polished dashboard
11. ✅ Plugin bundle NOT committed to Mind repo
12. ✅ Documentation and runbook are written

---

## Glossary

- **Black box**: User doesn't need to understand internal details
- **Sparse**: Show only what matters; no noise or scrolling lists
- **Cockpit**: Central operating station; dashboard is the user's primary interface
- **Preview-only**: No execution yet, just proposals and previews
- **Approval-gated**: Actions require formal request + decision record
- **Brain Core**: HTTP API providing read-only machine truth
- **Model-router**: AI steward that maintains vault quality via reports and previews
- **Maintenance preview**: Proposed maintenance action (create, patch, review, no-op)
- **Burn bar**: Progress indicator showing system attention needed (0-100% based on findings)
