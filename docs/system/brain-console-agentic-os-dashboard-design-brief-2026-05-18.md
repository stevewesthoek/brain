# Brain Console Agentic OS Dashboard Design Brief
**Date:** 2026-05-18  
**Status:** Design specification for Phase 1 implementation  
**Scope:** Dashboard redesign + scaffold improvement + QA instrumentation completion

---

## 1. Design Goal

Transform Brain Console from a basic, childish-looking functional dashboard into an **operator-grade command center** with professional appearance, proper information hierarchy, and minimal visual noise. The visual language should evoke a dark cockpit aesthetic—sparse, dense with meaning, monospace system data, warm accent colors, and clear action boundaries.

**Success measure:** Dashboard feels like mission control for an autonomous system, not a toy. Every pixel serves a purpose. Safety comes first (approval-gated, read-only).

---

## 2. Design Principles

### Information Hierarchy
- **First glance:** System status (green/yellow/red pills)
- **Second glance:** Burn bar (attention needed, yes/no)
- **Third glance:** Top 3-5 actionable cards (wiki health, maintenance queue, approvals)
- **Deep dive:** Activity panel, latest previews, detail modals (future)
- **Never shown:** Raw JSON, full file trees, secrets, internal node IDs

### Progressive Disclosure
- Summary cards by default (1-3 key metrics per card)
- Click → detail modal (future) or linked Obsidian doc
- No horizontal scroll; cards stack/grid responsively
- Tab-based navigation keeps scope bounded

### Minimal Visual Noise
- Remove concatenated labels like "Model Routermissing"
- Increase card margins and text breathing room
- Use typography (size, weight, monospace vs. sans) to separate concerns
- Status colors only: green (ok), yellow (warning), red (error), orange (accent), gray (neutral)
- No decorative elements; every border, shadow, and spacing has intent

### Safety-First Action Model
- ✅ **Allowed:** Refresh, Request approval, View preview
- ❌ **Forbidden:** Publish, Schedule, Execute, Decommission, Export, Clipboard
- All state changes require approval gate (Brain Core endpoint)
- No broad command runner or arbitrary execution

### Dark Cockpit Aesthetic
- Deep navy background (#0a0e27) evokes terminal/command center
- Warm orange accent (#ff6b3d) signals alerts and actions (10-20% opacity variants for secondary states)
- Monospace typography for system data (counts, timestamps, IDs, risk levels)
- Sans-serif for human-readable descriptions
- High contrast for readability: light gray text (#e5e7eb) on dark background

---

## 3. Primary Panes & Tabs

### Top-Level Tab Structure (9 tabs)

| Tab | Icon | Purpose | Phase | Status |
|-----|------|---------|-------|--------|
| **Overview** | 🔧 | System health, maintenance, approvals | Phase 1 | ✅ MVP |
| **Apps** | 📱 | Local app lifecycle, ProBot legacy | Phase 2A | Extended |
| **Orchestrators** | 🎻 | Skills, pipelines, system services registry | Phase 2B | Extended |
| **Pipelines** | ⚙️ | STB operational, Video migration, STB→Video | Phase 2A+3 | Extended |
| **Projects** | 📂 | Active projects, domains, platforms | Phase 3 | Extended |
| **Reports** | 📊 | Model-router reports, analytics | Phase 2B | Extended |
| **Posts** | 📝 | Social content, post orchestration (read-only) | Phase Post-1 | QA only |
| **Agents** | 🤖 | Active runs, queue, plans, approvals | Phase 2C | Extended |
| **Recovery** | 🔄 | Emergency ops, rollback, admin tools | Phase 4+ | Future |

**Tab styling:**
- Orange active indicator (left border, 3-4px)
- Monospace tab labels, uppercase
- Hidden on screens <600px width (icon-only fallback)
- Dark background (#1a1f3a surface color)

---

## 4. Dashboard Frame

### Command Bar (Top, 100% width)
```
┌───────────────────────────────────────────────────────────────┐
│ 🧠 COMMAND CENTER  [status pill]  Last: 19:30  [🔄 Refresh]  │
└───────────────────────────────────────────────────────────────┘
```
- Logo + title (left)
- System status pill (center-left): LIVE/OFFLINE/DEGRADED
- Last refresh timestamp (center)
- Refresh button (right, always visible)
- Sticky to top; 60px height

### Status Strip (Below command bar, 100% width)
```
┌───────────────────────────────────────────────────────────────┐
│ Brain Core: ✓  Model-Router: ✓  Wiki: ⚠  Maint: ◆  Approv: ◇ │
└───────────────────────────────────────────────────────────────┘
```
- 6 status pills in a single row
- Icons + text labels (monospace)
- Color-coded: green (ok), yellow (warning), orange (pending/data), red (error), gray (unknown)
- Pill height: 32px, padding: 6px 12px

### Tab Rail (Left or top-below status strip)
- Horizontal scroll on small screens (with icon-only fallback under 600px)
- Tab height: 44px, min-width: 120px
- Orange active left border (3px)
- No tab label backgrounds (blend with main background)
- Monospace, uppercase labels

### Hero Section (Card-style, below tabs)
```
┌─────────────────────────────────────────────────────────┐
│ SYSTEM BURN / ATTENTION WINDOW                          │
│ ████░░░░░░░░░░░░░░░░░░░░░░  42% (5 findings, 2 pending)│
└─────────────────────────────────────────────────────────┘
```
- Progress bar: 0-25% green, 25-50% amber, 50-100% red
- Label + percentage, findings count, approval-required count
- Click: (future) drill to findings list modal

### Content Grid (Main area)
- **Overview tab:** 5 sections, each with 1-3 cards
  - Section 1: Wiki Health, Maintenance Previews (2-column grid)
  - Section 2: Approvals, Scheduler (2-column grid)
  - Section 3: Captures, Brain Core (2-column grid)
  - Section 4: Next Safe Action (full-width panel)
  - Section 5: Latest Maintenance Preview (full-width panel)
- **Card width:** Auto-fit grid (minmax 240px, 1fr) on desktop; single column on mobile
- **Card height:** ~280-320px (natural height, no forced min-height)
- **Card padding:** 16px
- **Card gap:** 12px (between cards), 20px (between sections)

### Activity Panel (Bottom, optional expand/collapse)
```
┌─────────────────────────────────────────────────────────┐
│ ACTIVITY / RECENT EVENTS                          [⊕]   │
├─────────────────────────────────────────────────────────┤
│ 2026-05-17 19:30:00 scheduler-run-model-router ok      │
│ 2026-05-17 18:15:00 approval pending: review changes   │
│ 2026-05-17 17:45:00 capture inbox: 3 new items        │
└─────────────────────────────────────────────────────────┘
```
- Monospace font, 0.75rem size
- Max height: 200px, overflow: auto
- Dark background (#000a14)
- Green text for "ok", red for "error", orange for "pending"
- Last 10-20 events only (avoid scroll wall)

---

## 5. Status Model

### Six Operational States

| State | Color | Icon | Meaning | Example |
|-------|-------|------|---------|---------|
| **online** | Green (#4ade80) | ✓ | System working normally | Brain Core LIVE, model-router ready |
| **degraded** | Yellow (#facc15) | ⚠ | Partial functionality | Model-router stale, wiki has warnings |
| **review** | Amber (#f59e0b) | ◆ | Maintenance pending, no blocker | 8 maintenance actions queued |
| **blocked** | Red (#ef4444) | ✗ | Action required, system affected | Approvals needed, publishing disabled |
| **preview-only** | Orange (#ff6b3d) | ◇ | Feature available but gated | Posts section (read-only) |
| **disabled** | Gray (#9ca3af) | ⛔ | Feature not available | Decommissioned pipeline, future feature |

### Visual Indicators
- **Pills (32px height, 6px 12px padding):** Status at a glance
- **Progress bars:** System burn percentage, migration progress %
- **Cards:** Border-left (3px) in status color for emphasis
- **Badges:** Counts (e.g., "8 pending", "2 high-risk")
- **Icons:** Unicode symbols for instant recognition

---

## 6. Button & Action Model

### Allowed Actions (Safe, Approval-Gated)
- ✅ **Refresh:** Re-fetch latest data from Brain Core (side-effect free)
- ✅ **Request Approval:** POST to `/approvals` with action details (creates audit trail)
- ✅ **View Preview:** Navigate to modal or linked doc (read-only)
- ✅ **Open Mind/Wiki:** Deep link to Obsidian (user-controlled)

### Forbidden Actions (Blocked, Safety Gated)
- ❌ **Publish:** No direct social platform publishing
- ❌ **Schedule:** No calendar/queue manipulation
- ❌ **Execute:** No arbitrary command runner
- ❌ **Decommission:** No delete/purge operations
- ❌ **Export:** No clipboard/download (future: approve first)

### Button Styling
- **Primary (Refresh, Request Approval):** Orange background (#ff6b3d), white text, 32px height
- **Secondary (View Preview, Open Doc):** Dark background (#1a1f3a), light text (#e5e7eb), 32px height
- **Disabled (Forbidden actions):** Striped or faded, cursor: not-allowed, tooltip: "Disabled: approval pending"
- **State feedback:** :hover, :active, :disabled (visual + haptic if platform allows)

### Button Placement
- **Command bar:** Refresh button (right side, always visible)
- **Hero section:** Not applicable
- **Content sections:** Approve/Reject buttons in approval cards (future, Phase 5)
- **Activity panel:** No buttons

---

## 7. Post Orchestrator Layout (Read-Only QA Instrumentation)

### Posts Tab Structure (5 named groups + 1 status row = 22 cards total)

#### Group 1: Status & Overview (2 cards)
1. **Post Orchestrator Status**
   - Brain Post Orchestrator: planned/partial/operational
   - Publishing: ⛔ DISABLED (approval-gated, security review)
   - Last inventory refresh: timestamp
   - Visual: 1 card, single column

2. **Platform Readiness**
   - Twitter: connected / rate-limited / offline (pill)
   - LinkedIn: connected / rate-limited / offline (pill)
   - Facebook: connected / rate-limited / offline (pill)
   - YouTube: connected / rate-limited / offline (pill)
   - Visual: 1 card, 4 pills in grid

#### Group 2: Flow Preview (5 cards)
3. **Social Proof Asset Flow**
   - Integration status: planned / integrating / ready (pill)
   - Recent requests: count (this week)
   - Avg turnaround: duration
   - Last sync: timestamp

4. **Growth Optimization Flow**
   - Integration status: planned / integrating / ready (pill)
   - Requests this week: count
   - Avg hook score: number
   - Platform recommendations: top 3

5. **X Post Flow**
   - Status: planned / partial / ready
   - Template coverage: X/Y (progress)
   - Recent posts: count

6. **GitHub Post Flow**
   - Status: planned / partial / ready
   - Template coverage: X/Y
   - Recent posts: count

7. **LinkedIn Post Flow**
   - Status: planned / partial / ready
   - Template coverage: X/Y
   - Recent posts: count

#### Group 3: Review & Schedule (3 cards)
8. **Post Pipeline Summary**
   - Posts pending: count
   - Awaiting approval: count (red if >0)
   - Scheduled (7 days): count
   - Recent failures: count

9. **Content Review Queue**
   - Items pending: count
   - Average wait: duration
   - High-priority: count
   - Status: ok / backlog / blocked

10. **Scheduled Posts**
    - Total scheduled: count
    - Next publish: timestamp + platform
    - By platform: breakdown (Twitter, LinkedIn, YouTube, etc.)

#### Group 4: Safety & Policy (5 cards)
11. **Publishing Disabled**
    - Status: ⛔ DISABLED (large, prominent)
    - Reason: "Approval policy & Playwright security review in progress"
    - When enabled: "After explicit user approval, dry-run validation complete"
    - Current mode: "Preview-only, no platform calls"
    - Timeline: "See Post Orchestrator roadmap in docs"
    - **Visual:** Prominent red/orange border, center card in group

12. **Safety Policy Compliance**
    - Approval policy: ✓ approved / ⚠ review / ✗ missing
    - Playwright security: ✓ audit / ⚠ review / ✗ pending
    - Rate limiting: ✓ enforced
    - Audit trail: ✓ enabled

13. **Approval History (7 days)**
    - Total approvals: count
    - Approved: count
    - Rejected: count
    - Pending: count

14. **Platform Terms Compliance**
    - Twitter/X: compliant / pending / needs review
    - LinkedIn: compliant / pending / needs review
    - Facebook: compliant / pending / needs review
    - YouTube: compliant / pending / needs review

15. **Content Quality Metrics**
    - Average engagement: metric
    - Flagged for review: count
    - Passed validation: count
    - Failed validation: count

#### Group 5: Migration & Checkpoint (7 cards)
16. **Proofly → Post Orchestrator Migration**
    - Status: planning / mapping / building / validating / complete
    - Progress: X% modules, X/Y flows implemented
    - Parity: X% feature coverage
    - Blockers: count (if any)

17. **Xgrow → Post Orchestrator Migration**
    - Status: planning / mapping / building / validating / complete
    - Progress: X% modules
    - Parity: X% feature coverage
    - Next task: description

18. **QA Instrumentation Status**
    - Endpoint coverage: X/21 endpoints
    - Checklist items: X/10 items
    - Test suite: X/Y tests passing
    - Safety flags: ✓ read-only, ✓ no writes

19. **Preview Mode Readiness**
    - Dry-run capability: ✓ ready
    - Mock publishing: ✓ ready
    - Approval gates: ✓ ready
    - Rollback procedure: ✓ documented

20. **Acceptance Parity Report**
    - Acceptance criteria: X/Y checked
    - Design spec: ✓ aligned
    - Orchestrator roadmap: ✓ updated
    - Documentation: ✓ current

21. **Roadmap Checkpoint**
    - Phase 1 (Preview Mode): ✓ complete
    - Phase 2 (Acceptance): ⚠ 80% complete
    - Phase 3 (Publishing): ◇ pending approval
    - Phase 4 (Multi-account): ◇ future
    - Approval gate: ⛔ pending

22. **Recovery & Blockers**
    - Failed events: count
    - Failed asset requests: count
    - Failed optimizations: count
    - Top blocker: description
    - Next safe step: action

#### Single Status Row (Prominent)
- **Publishing Disabled Notice** (full-width banner, optional)
  ```
  ┌──────────────────────────────────────────────────────────┐
  │ ⛔ PUBLISHING DISABLED                                    │
  │ Reason: Approval policy & Playwright security review     │
  │ Current mode: Preview-only, no platform calls            │
  │ Timeline: See Post Orchestrator roadmap                  │
  └──────────────────────────────────────────────────────────┘
  ```

### Safety Labels (Visible on Every Card)
- **[Read-Only]** badge (gray) on all cards in Posts tab
- **[No Writes]** subtitle in safety-gated cards
- **[Safety Gated]** label on approval-required actions
- Forbidden actions marked with ❌ or striped appearance

### No Execution Buttons
- ❌ No "Publish Now"
- ❌ No "Skip Approval"
- ❌ No "Retry Failed"
- ❌ No "Force Sync"
- ❌ No "Download/Export"
- All state changes require Brain Core approval endpoint

---

## 8. Visual Tokens

### Color Palette
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Background** | Deep navy | #0a0e27 | Main canvas |
| **Surface** | Navy | #1a1f3a | Cards, panels, secondary |
| **Border** | Navy light | #2d3354 | Card borders, dividers |
| **Text primary** | Light gray | #e5e7eb | Main body text |
| **Text secondary** | Medium gray | #9ca3af | Labels, hints |
| **Accent** | Warm orange | #ff6b3d | Actions, alerts, highlights |
| **Accent hover** | Orange dark | #e55a2c | Button :hover state |
| **Accent faded** | Orange 20% | rgba(255,107,61,0.2) | Subtle backgrounds |
| **Success** | Green | #4ade80 | Online, ok status |
| **Warning** | Amber | #facc15 | Caution, review needed |
| **Error** | Red | #ef4444 | Offline, critical |
| **Preview** | Orange | #ff6b3d | Preview-only mode |
| **Disabled** | Gray | #9ca3af | Unavailable features |

### Typography
| Purpose | Font | Size | Weight | Line-height | Case |
|---------|------|------|--------|-------------|------|
| **Command bar** | Sans-serif | 0.95rem | Bold | 1.4 | Mixed |
| **Section headers** | Monospace | 0.75rem | Normal | 1.2 | UPPERCASE |
| **Card titles** | Sans-serif | 0.9rem | Semi-bold | 1.4 | Title Case |
| **Card body** | Sans-serif | 0.85rem | Normal | 1.5 | Mixed |
| **System data** | Monospace | 0.85rem | Normal | 1.4 | Mixed |
| **Labels** | Monospace | 0.72rem | Normal | 1.2 | UPPERCASE |
| **Status pills** | Monospace | 0.75rem | Normal | 1.2 | UPPERCASE |
| **Activity log** | Monospace | 0.75rem | Normal | 1.4 | Mixed |

### Spacing Scale (4px base unit)
| Use | Size | Pixels |
|-----|------|--------|
| **Minimal gap** | 1x | 4px |
| **Small gap** | 2x | 8px |
| **Medium gap** | 3x | 12px |
| **Section gap** | 5x | 20px |
| **Shell gap** | 5x | 20px |
| **Card padding** | 4x | 16px |
| **Pill padding** | px-12/py-6 | 12px × 6px |

### Visual Elements
- **Card borders:** 1px solid #2d3354
- **Card shadow:** 0 2px 8px rgba(0,0,0,0.3)
- **Border-radius:** 4px (subtle, not rounded)
- **Status pill height:** 32px
- **Pill border-radius:** 4px
- **Progress bar height:** 8px
- **Section divider:** 1px solid #2d3354, 20px margin-top/bottom

### Responsive Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Mobile** | <600px | Single column, icon-only tabs |
| **Tablet** | 600px-1024px | 2-column card grid |
| **Desktop** | >1024px | 3-column card grid |

---

## 9. Implementation Plan

### Phase 1: Dashboard Shell & Header (Sprint 1)
**Goal:** Professional command bar, status strip, tab rail, hero section  
**Tasks:**
1. Update top shell with logo, status pill, refresh button
2. Implement status strip (6 pills: Brain Core, Model-Router, Wiki, Maintenance, Approvals, Scheduler)
3. Add tab rail with 9 tabs (Unicode icons, orange active indicator, monospace labels)
4. Build hero section (burn bar, percentage, findings count)
5. Apply visual tokens: color palette, typography, spacing
6. **File changes:** `view.ts`, `styles.css`
7. **Tests:** Render output, pill visibility, tab switching, responsive under 600px

### Phase 2: Tab Navigation & Content Grid (Sprint 1-2)
**Goal:** Tab switching, card grid layout, base card styling  
**Tasks:**
1. Implement tab state management (active tab, route updates)
2. Create auto-fit card grid layout (minmax 240px)
3. Style card containers: border, shadow, padding, gap
4. Add section grouping CSS (20px gaps between sections)
5. Implement responsive grid: 3-col (>1024px), 2-col (600-1024px), 1-col (<600px)
6. **File changes:** `view.ts`, `dashboard.ts`, `styles.css`
7. **Tests:** Grid rendering, column count at breakpoints, section visibility

### Phase 3: Status Strip & Pills (Sprint 1)
**Goal:** Colorful, accurate status indicators  
**Tasks:**
1. Extend `dashboard.ts` to compute 6 status states (online, degraded, review, blocked, preview-only, disabled)
2. Map Brain Core endpoints to status colors
3. Render 6 pills with icons + text labels
4. Add tooltips (future) for status details
5. **File changes:** `dashboard.ts`, `view.ts`, `styles.css`
6. **Tests:** Pill rendering, color correctness, state mapping

### Phase 4: Core Cards (Sprint 2)
**Goal:** Implement 5-6 core cards in Overview tab  
**Tasks:**
1. Wiki Health card: status, error count, warning count, latest finding
2. Maintenance Previews card: count, risk breakdown, latest action
3. Approvals card: pending/approved/rejected counts
4. Scheduler card: last run, status, active jobs
5. Brain Core card: LIVE/OFFLINE status, uptime, mode
6. Next Safe Action card (full-width panel)
7. **File changes:** `view.ts`, `dashboard.ts`
8. **Tests:** Card rendering, data binding, empty state handling

### Phase 5: Card Density & Safety Labels (Sprint 2)
**Goal:** Improved spacing, clear visual hierarchy, safety indicators  
**Tasks:**
1. Tighten card spacing: reduce concatenation ("Model Routermissing" → "Model Router" + "missing" on next line)
2. Add [Read-Only], [No Writes], [Safety Gated] labels to appropriate cards
3. Implement card border-left in status color (3px)
4. Add badge styling for counts and risk levels
5. Polish typography: increase readable contrast, fix monospace/sans balance
6. **File changes:** `view.ts`, `styles.css`
7. **Tests:** Text readability, label visibility, visual hierarchy

### Phase 6: Empty/Offline States & Polish (Sprint 2-3)
**Goal:** Graceful degradation, error handling, final polish  
**Tasks:**
1. Design "unavailable" state for each card (gray, empty message)
2. Implement offline fallback: show status strip but disable refresh
3. Add error handling for API timeouts
4. Activity panel: render last 10-20 events, overflow: auto
5. Refresh button feedback: disable during fetch, show spinner
6. Final CSS polish: line-heights, shadows, hover states
7. **File changes:** `view.ts`, `styles.css`, `client.ts`
8. **Tests:** Offline rendering, error boundary, refresh UX

### Phase 7: Posts Tab QA Instrumentation (Sprint 3)
**Goal:** Complete QA cards for Posts section  
**Tasks:**
1. Add `readBrainCorePostQaStatus()` to client (21-endpoint coverage, 10-item checklist)
2. Render 22 Post cards across 5 groups (Status, Flow Preview, Review/Schedule, Safety, Migration)
3. Add Brain Console QA Status card (endpoint/checklist coverage)
4. Add Visual QA Checklist card (read-only, manual steps)
5. Mark all cards [Read-Only], [No Writes], ❌ forbidden actions
6. **File changes:** `client.ts`, `view.ts`, `dashboard.ts`
7. **Tests:** Card rendering, data binding, safety label visibility

### Phase 8: Typecheck, Build & Validation (Sprint 3)
**Goal:** Production-ready code, no errors, full test suite  
**Tasks:**
1. Run `npm run typecheck` → all green
2. Run `npm run build` → dist/ folder generated
3. Run test suite: `npm test` → 160/160 passing
4. Search for forbidden labels (Publish, Schedule, Execute, Decommission, Export)
5. Secret scan: no API keys, tokens in output
6. Manual Obsidian test: install plugin, verify all cards render
7. Commit and push to GitHub
8. **Files:** All TypeScript, CSS, tests pass validation

---

## 10. Acceptance Criteria

### Functional Requirements
- [ ] **Dashboard frame:** Command bar (logo, status, refresh) is sticky and 60px tall
- [ ] **Status strip:** 6 pills (Brain Core, Model-Router, Wiki, Maint, Approv, Scheduler) render with correct icons and colors
- [ ] **Tab navigation:** 9 tabs visible, orange active indicator, click switches content, labels hidden <600px (icon-only)
- [ ] **Hero section:** Burn bar updates based on Brain Core data, percentage + findings count displayed
- [ ] **Content grid:** Auto-fit grid (minmax 240px), responsive 3-col/2-col/1-col, card gap 12px, section gap 20px
- [ ] **Core cards (5-6):** Wiki Health, Maintenance Previews, Approvals, Scheduler, Brain Core, Next Safe Action render with data
- [ ] **Card styling:** Border-left 3px in status color, padding 16px, shadow 0 2px 8px, border 1px #2d3354
- [ ] **Overview tab:** All 6 cards visible with real Brain Core data (or "unavailable" gracefully)
- [ ] **Posts tab:** 22 cards across 5 groups + publishing disabled notice, all [Read-Only] labeled
- [ ] **No execution buttons:** Search codebase, find zero "Publish", "Schedule", "Execute", "Decommission", "Export", "Clipboard" buttons
- [ ] **Refresh button:** Fetches latest data, disables during fetch, re-renders cards
- [ ] **Offline graceful:** Shows status strip but disables refresh; cards show "unavailable"
- [ ] **Activity panel:** Monospace font, last 10-20 events, overflow: auto, 200px max-height

### Visual Requirements
- [ ] **Color palette:** Background #0a0e27, surface #1a1f3a, accent #ff6b3d, text #e5e7eb, success #4ade80, warning #facc15, error #ef4444
- [ ] **Typography:** Monospace 0.85rem body, 0.72rem uppercase labels, 0.9rem card titles, sans-serif body text
- [ ] **Spacing:** 4px-12px small gaps, 20px section/shell gaps, 16px card padding
- [ ] **Dark cockpit aesthetic:** No rounded corners (max 4px), high contrast, warm accent, terminal-like feel
- [ ] **No visual noise:** Clean lines, consistent borders (#2d3354), strategic shadows, status colors only

### Safety Requirements
- [ ] **Read-only guarantee:** No Brain Core mutations, no Mind vault writes, no Obsidian config changes
- [ ] **Safety labels:** [Read-Only], [No Writes], [Safety Gated] visible on Post cards
- [ ] **Forbidden actions:** Zero "Publish", "Schedule", "Execute", "Decommission", "Export", "Download", "Clipboard" actions in Posts section
- [ ] **Approval gates:** All state changes require Brain Core approval endpoint (future, Phase 5)
- [ ] **No secrets:** No API keys, tokens, credentials in dashboard output or logs
- [ ] **Error handling:** Graceful "unavailable" states, no JSON dumps, no 4xx/5xx crashes

### Code Quality Requirements
- [ ] **TypeScript:** `npm run typecheck` passes, zero errors
- [ ] **Build:** `npm run build` succeeds, `dist/` contains main.js, manifest.json, styles.css
- [ ] **Tests:** `npm test` passes, 160/160 tests (includes new QA cards, Posts rendering, Posts safety labels)
- [ ] **No regressions:** All existing Brain Console features work (Overview tab, status pills, card rendering)
- [ ] **Documentation:** Runbook updated with visual QA steps, design brief documented, handoff updated

### Validation Checklist
- [ ] Build succeeds: `npm run build`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Tests pass: `npm test` → 160/160
- [ ] Manual test in Obsidian: plugin renders, all cards visible, Refresh button works
- [ ] Search for forbidden labels: grep -r "Publish\|Schedule\|Execute\|Decommission\|Export\|Clipboard" → zero matches in Posts section
- [ ] Secret scan: no .env, tokens, credentials in output
- [ ] Commit: `git add -A && git commit -m "Design & implementation: Brain Console Agentic OS dashboard"`
- [ ] Push to GitHub: `git push origin main`

---

## Glossary

| Term | Definition |
|------|-----------|
| **Black box** | User doesn't need to understand internal details; dashboard abstracts complexity |
| **Sparse** | Show only what matters; no raw JSON, logs, or generic UI |
| **Cockpit** | Central operating station; dashboard is the primary interface for system oversight |
| **Preview-only** | Feature available but data/actions are read-only (no execution) |
| **Approval-gated** | Actions require formal request + decision record; no direct execution |
| **Brain Core** | HTTP API providing read-only machine truth and operational state |
| **Status pill** | 32px color-coded badge showing system state (online, degraded, blocked, etc.) |
| **Burn bar** | Progress indicator (0-100%) showing system attention needed (errors, warnings, approvals) |
| **Card** | Self-contained information unit answering one question (e.g., "Wiki Health: ok") |
| **Progressive disclosure** | Summary by default; click → detail modal or linked doc (future) |
| **Safety label** | [Read-Only], [No Writes], [Safety Gated] badges indicating action boundaries |
| **Monospace data** | Timestamps, IDs, counts, paths in monospace font (system readability) |
| **Terminal aesthetic** | Dark theme, high contrast, warm accent, minimal decoration (cockpit-like) |

---

**Design Brief Status:** ✅ Complete — Ready for Phase 1 implementation sprint (2-3 weeks)  
**Next Steps:** Begin Phase 1 (shell & header) in Sprint 1; use this brief as reference document.
