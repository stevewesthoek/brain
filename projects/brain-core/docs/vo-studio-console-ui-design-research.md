# VO Studio Console UI Design — Research Findings

**Date:** 2026-05-24  
**Status:** Research complete, findings synthesized  
**Research scope:** Nested dashboard UI patterns from Airflow, Dagster, n8n; dark UI best practices; TypeScript state management; Obsidian plugin constraints  

---

## Key Research Findings

### 1. Nested Navigation Pattern (Proven by Airflow, Dagster, n8n)

**Finding:** All three orchestration tools use **progressive disclosure through tabbed hierarchies** rather than nested sidebars or collapsed panels.

**Pattern Details:**
- **Top level:** Resource overview (e.g., DAGs, Assets, Workflows)
- **Middle level:** Execution context (e.g., Run, Job Instance)
- **Bottom level:** Detailed diagnostics (e.g., Task Logs, Events, XCom)

**Why it works:**
- Users maintain mental model: each tab set is local to its scope
- No loss of parent context: clicking back/up is always possible
- Predictable: same tab structure repeats at each level (Overview, Details, Logs, Metadata, etc.)

**Implication for VO Studio:** The Brain Console top-level tabs should NOT include Studio/Orchestrators/Pipelines. Instead, a single "Video Orchestrator" tab should contain a self-contained dashboard with its own internal tabs. This mirrors how Dagster embeds asset/job management within a unified webserver.

### 2. Dark UI Implementation (Verified by web.dev + industry practice)

**Findings:**
- CSS custom properties (`--color-name`) for theme variables
- Semantic color names (`--accent-color`, `--text-primary`, `--surface-secondary`) beat specific names (`--yellow`, `--blue`)
- Avoid pure white text on dark backgrounds; use `#e5e7eb` (light gray) or off-white
- Contrast ratio: aim for **WCAG AA minimum (4.5:1 for normal text, 3:1 for large text)**
- Warm accents (#ff6b3d, #ff5722) work well on dark backgrounds without eye strain

**CSS Strategy:**
```css
:root {
  color-scheme: light dark;
  --bg-primary: #0a0e27;
  --bg-secondary: #1a1f3a;
  --text-primary: #e5e7eb;
  --text-secondary: #9ca3af;
  --accent-warm: #ff6b3d;
  --accent-cool: #00d9ff;
  --status-success: #10b981;
  --status-warn: #f59e0b;
  --status-error: #ef4444;
}
```

**Implication for VO Studio:** The existing Brain Console CSS dark theme is sound. VO Studio inherits it. Use CSS variables consistently; no inline colors.

### 3. Viewport Constraint Handling (From Airflow, Dagster)

**Findings:**
- Sortable/filterable tables reduce scrolling; users prefer filtering over horizontal scroll
- Collapsible sections and progressive disclosure (click for detail) conserve space
- Tooltips on hover provide context without consuming real estate
- Sidebar is space-inefficient in constrained viewports; top tabs + main content area is preferred

**Implication for VO Studio:** 
- Use horizontal tabs for internal VO navigation (mirroring existing Brain Console pattern)
- Avoid sidebar; keep content area maximum width
- Use collapsible cards for secondary info (not always visible)
- Implement progressive disclosure: summary by default, click for detail

### 4. Tab State Management (WAI-ARIA + TypeScript)

**Findings:**
- Active tab state should use `aria-selected="true"` + `aria-controls` for accessibility
- State should live in URL or component state (not localStorage) for tab-switching predictability
- Cleanup: Always unsubscribe from observables and clear intervals on tab destroy (prevent memory leaks)
- EventListener cleanup: Tab components must call `removeEventListener` before unmounting

**Implication for VO Studio:** 
- VOShell already follows this pattern (uses component.destroy() and clears intervals)
- Continue current approach: component-owned state, explicit cleanup, no global state

### 5. Operational Dashboard Patterns (Airflow + Dagster)

**Findings:**
- **Operational vs. Configuration tabs:** Separate tabs for "what is happening" (Runs, Logs, Events) from "what is configured" (Code, Details, Settings)
- **Status indicators:** Use pills/badges for state (LIVE, DEGRADED, FAILED). Color-code by severity
- **Time-series:** Show recent activity (last 10-20 items), not full history. Link to full history view if needed
- **Drill-down pattern:** Click a pill or row to expand detail; breadcrumbs or "back" button restore overview

**Implication for VO Studio:** 
- Separate "Studio" (creation/approval workflow) from "Pipelines" (execution/history)
- Dashboard tab (Phase 10) should show operational status only (health pills, recent activity)
- Both tabs validate the existing design: separate concerns, clear purpose

---

## Refinements to Existing Design Spec

### Issue 1: Top-Level Tab Bloat (Current State)

**Current:** Studio, Orchestrators, Pipelines are top-level Brain Console tabs  
**Problem:** Compete for space with system infrastructure tabs (Infra, Monitoring, Apps, etc.); confusing taxonomy  
**Refined approach:** Single top-level "Video Orchestrator" tab containing internal tabs (Overview, Studio, Pipelines, Accounts, History, Dashboard)

### Issue 2: Navigation Clarity

**Current spec (lines 254-340):** Defines Tabs 2-9 (Apps, Orchestrators, Pipelines, Projects, Posts, Research, Agents, System) but doesn't clarify where they live relative to Brain Console root tabs  
**Refined approach:** Clarify that Tabs 2-9 are **second-level organizational tabs** within their respective top-level sections (Apps, VO Studio, Posts, Agents, System), not root tabs

### Issue 3: Viewport Responsiveness

**Current spec:** Mentions responsive fallback but doesn't prescribe collapsible patterns  
**Refined approach:** For VO Studio, use collapsible cards for secondary info (pipeline details, account config). Show summaries by default.

### Issue 4: Operational vs. Configuration

**Current spec:** Doesn't distinguish between operational views (what's running) and configuration views (what's set up)  
**Refined approach:** 
- Studio tab = configuration + approval (creation workflow)
- Pipelines tab = execution + history (operational workflow)
- Dashboard tab = operational summary (health, active jobs, blockers)
- Accounts tab = credential/adapter status (configuration)

---

## Implications for Implementation

### Phase 10 Dashboard Implementation

**Current:** StudioDashboardPanel displays health, routing stats, webhooks, recent events  
**Validated:** Pattern is sound. Operational summary with auto-refresh (60s) matches industry practice  
**Refinement:** 
- No changes needed to Phase 10 implementation
- Dashboard tab is correctly positioned as operational summary
- Keep current polling frequency and data refresh pattern

### VOShell Tab Integration

**Current:** VOShell manages 10 tabs (Overview, Pipelines, Accounts, Content, Approvals, Packages, Publishing, History, Events, Dashboard)  
**Validated:** Tab structure mirrors Airflow/Dagster operational/configuration split  
**Refinement:** 
- Keep current tab set
- Rename for clarity: "Studio" → represents creation workflow (Content, Approval, etc.)
- "Pipelines" → represents execution workflow
- "Dashboard" → represents operational summary

### Brain Console Integration

**Current:** SECTION_TABS has 15 entries; Studio, Orchestrators, Pipelines are mixed with system tabs  
**Refined approach:**
1. Remove Studio, Orchestrators, Pipelines from SECTION_TABS
2. Add single "Video Orchestrator" entry (or "VO Studio") to SECTION_TABS
3. On click, launch VOShell in a dedicated container
4. VOShell manages its own tabs and state

---

## Recommended CSS Strategy for VO Studio

**Inheritance:** Use existing Brain Console dark theme CSS variables (--bg-primary, --accent-warm, etc.)  
**Container strategy:** VO Studio gets its own `.vo-studio-container` with:
- Full-height flexbox layout
- Horizontal tab bar at top (reusing .vo-tabs pattern from VOShell)
- Content area below with vertical scroll
- Responsive fallback: single-column on narrow viewports (CSS media queries)

**Spacing:** 
- Tab bar: 44px height (Airflow/Dagster standard), 8px gaps
- Card padding: 12px (existing Brain Console standard)
- Gap between cards: 8px

---

## Summary: Design is Sound, Execution Needs Clarification

**Verdict on existing spec:** The foundation is correct (dark cockpit aesthetic, progressive disclosure, operational vs. configuration split). The implementation challenge is **not a design flaw but an integration bug:** VO concepts are flattened into Brain Console root navigation instead of scoped under a unified "Video Orchestrator" entry.

**This is an implementation fix, not a design rethink.**

---

## Next Steps

1. Update `obsidian-command-center-dashboard-spec-2026-05-17.md` to clarify second-level tab organization
2. Update `video-orchestrator-strategy.md` to reflect console UI topology
3. Create executable implementation plan for Brain Console integration
4. Execute Phase 10 Dashboard + Brain Console integration in sequence
