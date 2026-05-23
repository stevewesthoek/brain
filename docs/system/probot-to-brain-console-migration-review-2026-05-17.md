# ProBot Dashboard Feature Inventory & Migration to Brain Console

**Date:** 2026-05-17  
**Purpose:** Analyze ProBot dashboard features, classify them for migration to Obsidian Brain Console, identify Brain Core API gaps, and plan phased rollout.

---

## Executive Summary

ProBot dashboard is a web-based control plane with mixed concerns: local app management, video orchestrator credentials and workflows, production pipelines, Viral Flow account management, system updates, Stripe billing, and session history. Most of these features should migrate to Brain Console through Brain Core APIs.

**Key findings:**
- **Local app controls**: ~40% of ProBot dashboard value. Mostly doable, already partially in Brain Core.
- **Video orchestrator**: Complex, best served as read-only status + safe approval-gated actions.
- **Viral Flow**: Content strategy engine, useful as read-only reference, not primary dashboard focus.
- **Stripe/billing**: Out of scope for Obsidian plugin (financial data sensitivity).
- **Session history**: Useful, depends on Brain Core sessions adapter.
- **Production pipeline**: ProBot-specific, low priority for initial migration.
- **System updates**: Useful but risky, approval-gated only.

**Target outcome:** Brain Console becomes primary cockpit through Brain Core API layer. ProBot remains secondary/legacy. No direct shell execution from Obsidian. All app/orchestrator controls approval-gated.

---

## 1. ProBot Dashboard Feature Inventory

### 1.1 UI Structure

**Main tabs:**
1. **Overview** — status indicators, health summary, active alerts
2. **Local Apps** — app start/stop, status cards, health polling
3. **Production Pipeline** — workflow queue, orchestrator status (ProBot-specific)
4. **Video Orchestrator Studio** — YouTube credentials, account health, OAuth
5. **Viral Flow** — content strategy accounts, topics, performance tracking
6. **Stripe** — billing overview, plan info, recent charges
7. **Session History** — recent AI sessions, tool usage summaries

### 1.2 Feature Breakdown

#### **Local Apps Management** (HIGH VALUE)

**Current ProBot capability:**
- `/api/local-apps` endpoint returns: name, status (running/stopped/starting/stopping/restarting), health, port, description
- Start/stop buttons with real-time status polling (1.5s auto-refresh)
- Auto-restart on crash detection
- Progress indication (spinning loader during state transitions)
- BuildFlow rebuild + verification workflow

**Current Brain Core support:**
- ✅ `GET /local-apps` already exists
- ✅ Type: `BrainCoreLocalAppSummary` with status, category, health, port, url
- ✅ Already being consumed by Brain Console

**Decision:** **KEEP** — high value, brain-core route exists, safe to expand

---

#### **Video Orchestrator Dashboard** (MEDIUM VALUE)

**Current ProBot capability:**
- Local account registry (YouTube credentials, OAuth tokens)
- Account health monitoring (upload success rate, quota usage)
- OAuth callback handling for new accounts
- Video upload lifecycle tracking
- Runtime scheduler status
- Credential validation and refresh

**Concerns:**
- Handles secrets/OAuth tokens (credential sensitivity)
- Complex OAuth state machine
- Tight coupling to video orchestrator scripts
- Not suitable for Obsidian (credential exposure risk)

**Decision:** **REDESIGN** — keep as read-only status only. Credentials stay in ProBot. Read-only summary in Brain Core. Advanced controls remain in ProBot or via approval-gated action requests.

---

#### **Viral Flow Integration** (LOW-MEDIUM VALUE)

**Current ProBot capability:**
- Account list/add/remove
- Topic discovery and trending topics
- Content performance analytics
- Batch video posting orchestration
- Hook into video orchestrator runtime

**Concerns:**
- Complex orchestration logic
- Performance data best served from Viral Flow API directly
- Not primary dashboard focus

**Decision:** **REDESIGN** — read-only Viral Flow status summary in Brain Core. Orchestrator status card. Deep management remains in Viral Flow CLI or ProBot.

---

#### **Stripe Billing Dashboard** (LOW VALUE, HIGH RISK)

**Current ProBot capability:**
- Plan overview
- Recent invoices and charges
- Payment method info
- Usage metrics

**Concerns:**
- Financial data sensitivity
- PCI/compliance implications
- Does not belong in read-only Obsidian plugin
- Should stay in ProBot only or dedicated admin panel

**Decision:** **DROP** — Do not expose in Brain Console. Keep in ProBot admin-only surface.

---

#### **System Updates** (MEDIUM VALUE, HIGH RISK)

**Current ProBot capability:**
- Check for updates (Node, deps, app versions)
- Pre-update snapshot (running services, git state)
- Execute update (npm install, npm rebuild)
- Post-update restoration (restart services, health check)
- Rollback capability

**Concerns:**
- Mutation, needs approval and strong control
- Not reversible during rush hour
- Affects all services

**Decision:** **REDESIGN** — Make read-only (show available updates). Approval-request-only for actual execution. Move logic to Brain Core safer update service.

---

#### **Session History & AI Integration Stats** (MEDIUM VALUE)

**Current ProBot capability:**
- Recent session cards (title, tool, repo, timestamp)
- Tool usage breakdown (Codex, Gemini, Claude)
- Integration status (which AI engines active)

**Current Brain Core support:**
- ✅ `GET /sessions` endpoint already exists
- ✅ Type: `BrainCoreSessionSummary`
- ✅ Already being consumed by Brain Console

**Decision:** **KEEP** — useful context, safe read-only data, already in Brain Core

---

#### **Production Pipeline & Workflow Queue** (LOW VALUE)

**Current ProBot capability:**
- ProBot-specific task/job queue
- Build step tracking
- Video rendering queue
- Orchestrator task status

**Concerns:**
- Very ProBot-specific, not universally useful
- Complex state machine
- Overlaps with scheduler/mind-steward

**Decision:** **DROP for now** — Defer to Phase 2. Focus on local apps + orchestrator status first.

---

#### **Buildflow Verification & Restart** (LOW-MEDIUM VALUE)

**Current ProBot capability:**
- Buildflow project detection
- Verification script execution
- Restart with health check
- Full rebuild option

**Concerns:**
- Tied to ProBot's buildflow scripts
- Not well-documented as general API
- Might be safe for approval-request

**Decision:** **LATER** — useful but not critical. If Brain Core has build orchestrator, create approval-gated endpoint. For now, keep in ProBot.

---

### 1.3 Summary Table

| Feature | ProBot Value | Brain Core Ready | Safety | Decision | Priority |
|---------|-------------|------------------|--------|----------|----------|
| Local app status | HIGH | YES | read-only | KEEP | Phase 2 (API done, UI) |
| Local app start/stop | HIGH | PARTIAL | approval-gated | KEEP | Phase 5 (actions) |
| Orchestrator status | HIGH | NO | read-only | REDESIGN | Phase 3 (new API) |
| Orchestrator run | MEDIUM | NO | approval-gated | REDESIGN | Phase 5 (actions) |
| Session history | MEDIUM | YES | read-only | KEEP | Phase 2 (UI) |
| Domain/project overview | MEDIUM | NO | read-only | REDESIGN | Phase 4 (new API) |
| Video credential mgmt | MEDIUM | NO | credentials | DROP | ProBot only |
| Viral Flow accounts | MEDIUM | NO | read-only | REDESIGN | Phase 3 (summary API) |
| Billing/Stripe | LOW | N/A | payment | DROP | Admin only |
| System updates | MEDIUM | NO | approval-gated | REDESIGN | Phase 5 (safe action) |
| Buildflow verify | LOW | PARTIAL | approval-gated | LATER | Phase 5+ |
| Production pipeline | LOW | NO | complex | DROP for now | Phase 6 |

---

## 2. Keep / Drop / Redesign / Later Classification

### KEEP (Migrate as-is or with minimal changes)

1. **Local apps status cards** — High value, safe read-only, Brain Core ready, Obsidian-friendly
2. **Session history** — Useful context, safe read-only, Brain Core ready
3. **Wiki health / runtime reports** — Already in Brain Console
4. **Next safe action** — Already in Brain Console
5. **Approvals & audit trail** — Already in Brain Console

### REDESIGN (Keep value, expose differently)

1. **Local app controls** — Safe to add approval-gated start/stop actions
2. **Orchestrator registry** — New Brain Core adapter for readonly + approval-gated actions
3. **Video orchestrator status** — Read-only account health + runqueue only
4. **Viral Flow status** — Account count + performance summary only
5. **System updates** — Readonly available updates + approval-gated execution
6. **Domains/projects** — New Brain Core adapter with Mind path references

### DROP (Not suitable for Brain Console)

1. **Stripe billing** — Financial data, PCI concerns, admin-only
2. **OAuth credential management** — Secret exposure risk, stays in ProBot
3. **Production pipeline queue** — ProBot-specific, low priority, defer Phase 6+
4. **Direct buildflow execution** — Too risky, keep approval-gated or ProBot-only

### LATER (Useful but not Phase 1-2)

1. **Buildflow verification** — Low priority, defer Phase 5+
2. **Advanced video orchestrator controls** — Complex, Phase 5+
3. **Customizable dashboard tabs** — UI polish, Phase 6+

---

## 3. Brain Core API Gap Analysis

### 3.1 Existing Brain Core Endpoints (Already Consuming)

✅ `GET /status` — system ready, execution gate status
✅ `GET /capabilities` — feature flags, installed components
✅ `GET /runtime/reports` — mind-steward wiki health, runtime state
✅ `GET /scheduler/status` — nightly job queue health
✅ `GET /scheduler/jobs` — individual job list
✅ `GET /approvals` — pending approval requests
✅ `GET /approvals/store` — approval audit trail
✅ `GET /execution/readiness` — execution candidates, blockers
✅ `GET /execution/plans` — maintenance + capture plans  
✅ `GET /execution/mind-preview-policy` — safe paths, blocked roots  
✅ `GET /execution/mind-previews` — queued maintenance actions  
✅ `GET /sessions` — recent AI sessions  
✅ `GET /repos` — repo inventory  
✅ `GET /local-apps` — app status, health, port  
✅ `GET /video/status` — video queue depth (partial)  
✅ `GET /video/queue` — video job items (partial)  

### 3.2 Missing Brain Core Endpoints (Phase 2-4)

❌ **`GET /orchestrators`** — Phase 3  
   - Need: registry of orchestrators (mind-steward, video, design, code, research, Bible research, scheduler, capture)
   - Status: available/partial/planned/blocked
   - Health: ok/warning/error
   - Data: summary only, no execution details

❌ **`GET /domains`** (or `/projects`) — Phase 4  
   - Need: domain/project registry
   - Status: active/paused/planned/archived
   - Links: Mind path, orchestrator assignments
   - Data: high-level only

❌ **`GET /apps/available-update-summary`** — Phase 5  
   - Need: Node version, npm deps, app version availability
   - Read-only: no execution

❌ **`POST /actions/request`** (approval-gated) — Phase 5  
   - Kind: "app-start" | "app-stop" | "app-restart" | "buildflow-verify" | "update-check" | "update-execute" | ...
   - Payload: app name, orchestrator id, verification flags
   - Returns: approval request ID
   - Does NOT execute, only requests approval

### 3.3 Endpoints to Avoid Adding

🚫 Shell execution (`POST /shell` or similar)  
🚫 Arbitrary file mutation (`POST /fs/write`)  
🚫 Secrets/env access (`GET /secrets` or `/env`)  
🚫 Direct app start/stop (goes through approval layer first)  

---

## 4. Brain Console UI Mapping

### 4.1 Dashboard Sections (Phased Rollout)

**Phase 1 (Current MVP):**
- Overview: status, attention, next action
- Health summary: wiki health, maintenance, approvals, scheduler

**Phase 2 (Local Apps + Sessions):**
- Apps tab/section: running/stopped/unknown counts, app cards, start/stop buttons (approval-gated UI)
- Recent sessions: activity panel improved

**Phase 3 (Orchestrators):**
- Orchestrators section: cards for each known orchestrator, status badges
- Viral Flow account count, top topics (read-only summary)

**Phase 4 (Domains/Projects):**
- Projects section: domain cards, Says the Bible prominence
- Orchestrator associations

**Phase 5 (Safe Actions):**
- Approval-gated buttons: app start/stop, orchestrator run request, update check/apply
- All mutations go through Brain Core approval-request-only path

**Phase 6 (Refinement):**
- Visual polish
- ProBot deprecation timeline
- Customizable card visibility

### 4.2 UI Layout (Concept)

```
┌─ Brain Console ────────────────────────────────┐
│ [Overview Tab] [Apps] [Orchestrators] [Projects]│
├───────────────────────────────────────────────┤
│ Status pills (6x): Brain Core | Mind Steward │ Scheduler | ...
│ Attention panel: 0-100 burn bar               │
├───────────────────────────────────────────────┤
│ WIKI HEALTH          MAINTENANCE    APPROVALS │
│ ✓ OK, 0 warns       Queue: 3       Pending: 1 │
├───────────────────────────────────────────────┤
│ APPS (Phase 2)        ORCHESTRATORS (Phase 3) │
│ Running: 2/5          Model-Router: ✓ ok      │
│ Obsidian: ●           Video: ✓ ready         │
│ Brain Core: ●         Code: ◐ partial        │
│ [Start] [Logs]        Research: ◐ planned    │
├───────────────────────────────────────────────┤
│ PROJECTS (Phase 4)    RECENT ACTIVITY        │
│ Brain/Mind: active    Session: ...15m ago    │
│ Says the Bible: active  Reports: 3 available │
└───────────────────────────────────────────────┘
```

---

## 5. Safety & Approval Model

### 5.1 Action Classifications

**READ-ONLY** (safe, no approval needed):
- View status (all)
- View history (sessions, approvals, reports)
- View project overview
- View orchestrator availability
- Refresh dashboard

**APPROVAL-GATED REQUEST** (creates approval request, user must approve):
- App start/stop/restart
- Orchestrator dry run
- Orchestrator execution request
- System update apply
- Buildflow rebuild

**NEVER ALLOWED** (not exposed):
- Arbitrary shell execution
- Credential display/modification
- Billing/payment mutation
- Mind vault direct mutation (use mind-steward instead)

### 5.2 Approval Request Flow

```
User clicks "Start app" button in Brain Console
  ↓
Brain Console calls: POST /actions/request
  { kind: "app-start", appName: "brain-core", target: "localhost:4877" }
  ↓
Brain Core creates approval request
  ↓
Brain Console shows: "Requesting approval..."
  ↓
User navigates to Approvals panel
  ↓
User approves request
  ↓
Brain Core executes action
  ↓
Brain Console shows: "Started successfully"
```

**Key principle:** Plugin never executes. Plugin only requests. Brain Core approval layer executes.

---

## 6. Target Feature Parity Roadmap

### Phase 1: Feature Inventory (Done)
- ✅ Analyze ProBot dashboard
- ✅ Classify features
- ✅ Map to Brain Core
- ✅ Design UI layout

### Phase 2A: Local Apps Read-Only (Next)
- Add Brain Console Apps section
- Consume `GET /local-apps` properly
- Display cards: name, status, port, actions (disabled with tooltip)
- No actual start/stop yet (just UI)
- Add tests

### Phase 2B: Session History
- Improve activity panel
- Show recent sessions, tools, repos
- Link to Mind session notes if available
- Add tests

### Phase 3: Orchestrator Registry
- Create Brain Core `/orchestrators` endpoint
- Registry: mind-steward, video, design, code, research, Bible research, scheduler, capture
- Status: available/partial/planned/blocked
- Add Brain Console Orchestrators section
- Cards + status badges
- Add tests

### Phase 4: Domains/Projects
- Create Brain Core `/domains` endpoint
- Include: Brain/Mind, Says the Bible, key projects
- Link to Mind wiki paths
- Add Brain Console Projects section
- High-level overview cards
- Add tests

### Phase 5: Approval-Gated Actions
- Implement `POST /actions/request` in Brain Core
- UI for app start/stop buttons (formerly disabled)
- UI for orchestrator run requests
- Approval flow in Approvals panel
- No actual execution from plugin
- Add tests

### Phase 6: Polish & ProBot Transition
- Visual refinement of Brain Console
- ProBot deprecation documentation
- Legacy dashboard notice
- Final feature parity checks
- Performance optimization

---

## 7. Implementation Strategy

### Phase 2A Implementation (Recommended for Next Sprint)

**Work:**
1. Verify Brain Console already consumes `/local-apps`
2. Add Apps section/tab to dashboard
3. Render local app cards with status, port, actions (locked UI)
4. Add tooltip: "App controls require approval-gated request (planned)"
5. Add simple tests

**Files to change:**
- `projects/brain-console-obsidian/src/view.ts` — add Apps section rendering
- `projects/brain-console-obsidian/src/dashboard.ts` — add apps layout
- `projects/brain-console-obsidian/styles.css` — add apps card styles
- New test file for apps section

**Files to create (Phase 3):**
- `projects/brain-core/src/adapters/orchestrators.ts` — registry summary
- Tests

---

## 8. Risk Assessment & Mitigation

### Risk: Credentials Leaking in Brain Console
**Mitigation:** Never expose secrets in Brain Core endpoints. Video credentials stay in ProBot. Brain Core returns status summaries only.

### Risk: Accidental App Mutations Without Approval
**Mitigation:** Approval-gated flow from day 1. Plugin never executes. Only requests.

### Risk: Overwhelming Brain Console with Too Many Features at Once
**Mitigation:** Phased rollout. One section at a time. Validate each phase before proceeding.

### Risk: ProBot Dashboard Breaking During Migration
**Mitigation:** Do NOT remove ProBot code during Phase 1-4. Phase 6 is transition/documentation only.

### Risk: Brain Core API Inconsistency
**Mitigation:** Add types for all new endpoints. Test exhaustively. Document API contracts.

---

## 9. Open Questions & Next Steps

**To answer:**
1. Does Brain Core have a safe update service we can expose (readonly)?
2. What is the Says the Bible project structure? Where does it live?
3. Can orchestrators be discovered dynamically or should we use allowlisted config?
4. Should Brain Console show Viral Flow account list or just flow status?
5. Are there other local apps or domains Steve wants on dashboard?

**Next immediate task:**
Implement Phase 2A (local apps UI) and Phase 3 (orchestrator registry API).

---

## References

- ProBot dashboard source: `projects/probot/src/bot/dashboard.ts` (232KB)
- Brain Console: `projects/brain-console-obsidian/src/`
- Brain Core routes: `projects/brain-core/src/api/routes.ts`
- Brain Core adapters: `projects/brain-core/src/adapters/`
- Mind vault structure: `/Users/Office/Repos/stevewesthoek/mind/`
- Roadmap: `docs/system/obsidian-mind-steward-roadmap.md`
