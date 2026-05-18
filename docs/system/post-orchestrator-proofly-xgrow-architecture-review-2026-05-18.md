# Post Orchestrator / Proofly / Xgrow Architecture Review

**Date:** 2026-05-18  
**Status:** Architecture review and strategic consolidation planning  
**Decision:** Brain owns canonical Post Orchestrator. Proofly and Xgrow remain operational as specialized modules.  
**Safety:** No physical merge, no decommission, no code changes to Proofly/Xgrow yet.

---

## 1. Executive Summary

### Strategic Direction

The Brain repo will become the canonical orchestration engine for all post (content/social) operations. Proofly and Xgrow will remain operational but will shift from independent orchestration systems to specialized, stateless modules that Brain calls upon.

- **Brain** = Post Orchestrator, scheduling, publishing coordination, approval gates, analytics feedback, dashboard visibility
- **Proofly** = Social proof asset generation, product UI, milestone visuals, branded templates
- **Xgrow** = Growth strategy, optimization logic, post copy refinement, virality scoring, timing intelligence

### Rationale

1. **Consolidate scattered orchestration** — Currently Proofly, Xgrow, and Brain all have scheduler/publishing/approval logic. Duplicates lead to:
   - Inconsistent approval gates
   - Conflicting scheduling decisions
   - Fragmented audit trails
   - Silent failures in one system while another succeeds
   - Impossible to see the full post lifecycle in one place

2. **Preserve specialized expertise** — Proofly excels at visual/social-proof surfaces. Xgrow excels at growth strategy. Don't delete them; make them focused service providers.

3. **Enable Brain Console visibility** — Unified dashboard requires unified orchestration. Can't show a coherent post pipeline if logic is scattered across repos.

4. **Reduce operational friction** — New post events only target Brain Post Orchestrator. Proofly and Xgrow are called by Brain, not bootstrapped independently.

### What This Is NOT

- ❌ Not a physical repo merge (Proofly and Xgrow remain separate)
- ❌ Not a decommission of Proofly/Xgrow (both stay operational)
- ❌ Not an immediate code rewrite (prove architecture first)
- ❌ Not a breaking change to Proofly/Xgrow APIs (adapt via contracts)

### What This IS

- ✅ Architectural consolidation (Brain owns orchestration)
- ✅ Service boundary definition (Proofly/Xgrow as modules)
- ✅ Dual-run strategy (old and new systems run in parallel)
- ✅ Parity gates (only decommission after proof)
- ✅ Phased rollout (read-only status first, execution later)

---

## 2. Current Repo Inventory

### Brain Current State

**Orchestration assets:**
- Brain Core API: Local-only HTTP service with typed endpoints (4877)
- Brain Console: Obsidian plugin dashboard (read-only, approval-request-only)
- Scheduler: Cron-based task execution (Brain Core scheduler jobs)
- Approval gates: Approval request/approval store/approval detail workflow
- Runtime reports: Status reports for major systems (model-router, Brain Core, scheduler)
- Agent View: Read-only agent execution ledger
- Recovery/Blockers: Error tracking and recovery guidance
- Dashboard sections: Overview, Apps, Orchestrators, Pipelines, Projects, Reports, Agents, Recovery

**What Brain does NOT currently own:**
- Post event ingestion from external sources
- Content/asset generation workflows
- Social platform publishing (Twitter/Facebook/YouTube/etc.)
- Post timing/optimization logic
- Virality/engagement analysis

### Proofly Current Role (Verified Safe Repo Inspection)

Safe files inspected: `README.md`, `DESIGN.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/overview.md`, `docs/manual-mrr-override.md`, `docs/workspace-switcher.md`, `package.json`, and `prisma/system.prisma`. No real `.env` or secret files were opened.

**Verified product/runtime surface:**
- Standalone Next.js application with dedicated Postgres provisioning and runtime migration gates.
- Product surface layer with marketing routes, authenticated app routes, legal pages, waiting list, blog, dashboard, and workflow UI.
- Design system layer with tokenized fonts, colors, layout primitives, and a terminal/data-first social-proof aesthetic.
- Proof card generation context centered on founder metrics, MRR values, growth percentages, branded templates, and X-native proof-card output.
- Manual MRR override flow via `POST /api/v1/cards`, with manual snapshots and audit metadata.
- Workspace switcher and workspace-scoped product surfaces.
- Prisma schema includes subscriptions, projects, Stripe webhook events, rate limits, card generation, card engagement, API keys, webhooks, audit logs, usage quotas, workspaces, templates, and brand kits.

**Verified orchestration-like logic to avoid duplicating:**
- Runtime provisioning and deploy gates.
- Webhook delivery/retry tables.
- Rate limit buckets.
- Audit logging and usage tracking.
- API key/request tracking.
- Project/workspace scoping.
- Optional provider plumbing for Clerk, Stripe, Resend, WordPress, and n8n.

**Post Orchestrator implication:** Proofly should become the visual asset/social-proof provider. Brain should call Proofly through `ProoflyAssetRequest/Result` contracts instead of duplicating templates, brand kits, card rendering, workspace scoping, or Proofly-specific product UI.

### Xgrow Current Role (Verified Safe Repo Inspection)

Safe files inspected: `README.md`, `ROADMAP.md`, `RESEARCH_FINDINGS.md`, `PLAYWRIGHT_POSTING_STRATEGY.md`, `PLAYWRIGHT_POSTING_STRATEGY_V2.md`, `PROBOT_INTEGRATION_GUIDE.md`, `SMOKE_TEST_GUIDE.md`, `package.json`, and `scripts/scheduler.ts`. Real cookie/session/database files under `data/` were not opened.

**Verified product/runtime surface:**
- Internal X growth assistant for finding reply opportunities, generating contextual replies, reviewing them, and posting replies through a browser workflow.
- Next.js app on port `7080`, with Engage UI, dashboard APIs, scraper/discovery support, queue/original-post legacy paths, and automation logs.
- Current roadmap states xGrow is Playwright-first for Engage reply posting, while the X API client remains legacy/supporting.
- Dashboard integration guide documents stats, logs, posts, action commands, scan/scheduler triggers, pause/resume, clear pending, and ProBot xgrow tab integration.
- Scheduler script runs a cron tick against `/api/scheduler/tick` using an environment secret.
- Research docs include a strong policy/security warning: X explicitly disallows non-API website scripting, and browser-based posting is fragile/risky.

**Verified orchestration-like logic to centralize in Brain over time:**
- Posting scheduler.
- Reply queue processing.
- Posting action controls (`pause`, `resume`, `clear-pending`, `skip-post`, `reset-failed`).
- Scan/scheduler triggers.
- Automation logs and failure tracking.
- Playwright browser posting runtime.
- Rate limits and posting-mode state.

**Post Orchestrator implication:** Xgrow should become the growth intelligence/optimization provider. Brain should not blindly inherit Xgrow's Playwright posting runtime. Any future publishing path needs a separate security review, approval policy, and platform-compliance decision before execution is exposed.

### What Must Move to Brain Over Time

1. **Ingestion**: Event sources (GitHub, product events, video renders) → Brain Post Orchestrator
2. **Orchestration**: Workflow sequencing (draft → asset → optimize → approve → schedule → publish)
3. **Scheduling**: Canonical scheduler for all posts (not Xgrow, not Proofly)
4. **Approval gates**: Unified approval workflow
5. **Publishing coordination**: Manage platform delivery (rate limits, fallbacks, error handling)
6. **Analytics feedback**: Collect results and route to Xgrow for learning
7. **Audit trail**: Unified ledger of all post operations

### What Must Remain in Proofly/Xgrow

1. **Proofly**:
   - Asset template libraries
   - Visual rendering engines
   - Product UI dashboards
   - Brand/theme systems
   - Asset preview/export flows
   - Milestone/achievement visuals

2. **Xgrow**:
   - Growth strategy logic
   - Optimization algorithms
   - Hook/copy analysis
   - Virality scoring models
   - Audience segmentation
   - Engagement prediction

---

## 3. Target Architecture

### Post Orchestrator Inside Brain

The Post Orchestrator is a new Brain Core subsystem that:

1. **Ingests** post events from external sources (GitHub, product events, video renders, blog, manual request)
2. **Normalizes** events into a canonical PostEvent structure
3. **Routes** to content generation, asset generation, and optimization as needed
4. **Sequences** workflows (draft → asset → optimize → approve → schedule → publish)
5. **Gates** approvals (read-only preview, explicit approval required for execution)
6. **Publishes** to platforms (sequentially, with rate limiting and fallback)
7. **Collects** analytics results
8. **Provides** read-only status via Brain Core API
9. **Displays** in Brain Console as unified post pipeline dashboard

### Data Flow

```
External Source (GitHub event, video render, product event)
    ↓
Brain Post Orchestrator (ingestion)
    ↓ Normalize to PostEvent
    ↓
Decision: What's needed?
    ├─→ Content generation? (AI)
    ├─→ Proofly asset? (request via contract)
    ├─→ Xgrow optimization? (request via contract)
    └─→ Manual draft provided
    ↓ Combine results into PostDraft
    ↓
Brain Core Approval Gate
    ├─→ Preview-only (Brain Console shows draft)
    ├─→ Request user approval
    └─→ Wait for decision
    ↓ After approval
    ↓
Schedule / Publish
    ├─→ Create PostScheduleItem
    ├─→ Sequence platform delivery (rate limiting)
    └─→ Track results
    ↓
Analytics Collection
    ├─→ Collect metrics from platforms
    ├─→ Feed to Xgrow for learning
    └─→ Update dashboard
```

### Service Contracts (Preliminary)

**PostEvent** (input)
```
{
  id: string
  source: 'github' | 'product' | 'video-render' | 'blog-publish' | 'manual' | ...
  sourceType: 'commit' | 'release' | 'milestone' | 'content' | ...
  eventType: 'feature' | 'fix' | 'achievement' | 'launch' | ...
  occurredAt: ISO8601
  payloadSummary: { title, description, url, metadata }
  projectId: string
  priority: 'low' | 'medium' | 'high'
  suggestedPostTypes: ['twitter' | 'linkedin' | 'facebook' | ...]
}
```

**PostDraft** (workflow state)
```
{
  id: string
  eventId: string
  platform: string
  format: 'tweet' | 'thread' | 'carousel' | 'story' | ...
  copy: string
  threadItems?: string[]
  assetRequests?: ProoflyAssetRequest[]
  optimizationRequests?: XgrowOptimizationRequest[]
  status: 'draft' | 'awaiting-approval' | 'approved' | 'scheduled' | 'published'
  approvalRequired: boolean
  approvalId?: string
}
```

**ProoflyAssetRequest** (outbound to Proofly)
```
{
  id: string
  projectId: string
  assetType: 'screenshot' | 'milestone-card' | 'mrr-visual' | 'achievement' | ...
  templateId: string
  data: { ... }
  brand: { colors, fonts, logo }
  outputFormat: 'png' | 'jpg' | 'mp4'
}
```

**ProoflyAssetResult** (response from Proofly)
```
{
  id: string
  requestId: string
  status: 'ready' | 'failed' | 'pending'
  previewPath?: string
  assetPath?: string
  metadata: { width, height, mimeType, checksum }
}
```

**XgrowOptimizationRequest** (outbound to Xgrow)
```
{
  id: string
  platform: string
  draft: PostDraft
  audience?: { segment, interest, geography }
  objective: 'engagement' | 'reach' | 'conversion' | 'virality'
  constraints?: { characterLimit, platform-specific }
}
```

**XgrowOptimizationResult** (response from Xgrow)
```
{
  id: string
  requestId: string
  optimizedCopy: string
  hookScore: number
  hookAnalysis: string
  timingRecommendation: ISO8601
  hashtags: string[]
  riskFlags: string[]
  rationale: string
}
```

**PostScheduleItem** (output to scheduler)
```
{
  id: string
  draftId: string
  platform: string
  scheduledAt: ISO8601
  status: 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed'
  approvalId: string
  publishedUrl?: string
}
```

**PostAnalyticsResult** (feedback from platforms)
```
{
  id: string
  postId: string
  platform: string
  metrics: { impressions, engagements, clicks, shares, ... }
  capturedAt: ISO8601
  interpretation: string
  feedbackForXgrow: { whatWorked, whatDidntWork, patterns }
}
```

---

## 4. Responsibilities by Repo

### Brain Core Post Orchestrator

**Owns:**
- PostEvent ingestion pipeline
- Event normalization and routing
- Workflow sequencing and state machine
- Approval gates and audit trail
- Schedule management (canonical scheduler)
- Publishing coordination (rate limiting, fallbacks, retry logic)
- Analytics collection and aggregation
- Recovery and error handling
- Dashboard/API visibility
- Audit logging

**Does NOT own:**
- Proofly asset template logic
- Xgrow optimization algorithms
- Platform-specific auth (delegated)
- Content/script generation (delegated to AI orchestrators)

### Proofly

**Owns:**
- Visual/social proof asset templates
- Asset rendering engines
- Brand/theme systems
- Asset preview and export
- Milestone/MRR/achievement visuals
- Product UI dashboards
- Asset approval by designer/marketer

**Does NOT own:**
- Event ingestion
- Scheduling
- Publishing
- Post approval workflow
- Multi-platform coordination

### Xgrow

**Owns:**
- Growth strategy and optimization logic
- Hook/copy analysis
- Virality scoring
- Timing recommendations
- Audience segmentation
- Engagement prediction
- Analytics interpretation
- Feedback learning loop

**Does NOT own:**
- Event ingestion
- Scheduling
- Publishing
- Approval workflow
- Asset generation
- Multi-platform coordination

---

## 5. Brain Console Dashboard Requirements

### New Post Orchestrator Section

**Cards to display:**

1. **Post Orchestrator Status**
   - Brain Post Orchestrator: operational/partial/planned
   - Proofly integration: ready/integrating/not-ready
   - Xgrow integration: ready/integrating/not-ready
   - Publishing: disabled (approval-gated, no execution yet)

2. **Post Queue Summary**
   - Total pending posts: count
   - Awaiting approval: count
   - Scheduled for next 7 days: count
   - Recent failures: count

3. **Asset Pipeline (Proofly)**
   - Active requests: count
   - Completed this week: count
   - Failed: count
   - Average turnaround time

4. **Optimization Pipeline (Xgrow)**
   - Requests this week: count
   - Avg hook score: number
   - Platform recommendations: list
   - Timing insights: summary

5. **Approval Queue**
   - Posts awaiting approval: list
   - Approval timeout: show urgency
   - Proofly asset previews: pending/ready
   - Xgrow optimization: pending/ready

6. **Platform Readiness**
   - Twitter: connected / rate limit status
   - LinkedIn: connected / rate limit status
   - Facebook: connected / rate limit status
   - YouTube: connected / rate limit status
   - (etc. for each platform)

7. **Publishing Disabled State**
   - Clear indicator: "Publishing is disabled and approval-gated"
   - Reason: Approval policy and Playwright security review in progress
   - When enabled: After explicit approval, dry-run validation complete
   - Current mode: Preview-only, no platform calls

8. **Analytics Feedback (Read-Only)**
   - Posts published this month: count
   - Avg engagement rate: metric
   - Top performing post type: category
   - Engagement trends: sparkline
   - Xgrow learning status: active/paused

9. **Recovery/Blockers**
   - Failed post events: list
   - Failed asset requests: list
   - Failed optimization requests: list
   - Next safe steps: actionable

### No Execution Buttons (Phase 1-2)

- ❌ No "Publish Now" button
- ❌ No "Skip Approval" button
- ❌ No "Retry Failed Post" button
- ❌ No "Force Platform Sync" button
- ❌ No direct Playwright/posting triggers

All state changes require approval gate.

---

## 6. Decommission Strategy

### What Will NOT Happen Yet

- ❌ Proofly deleted or disabled
- ❌ Xgrow deleted or disabled
- ❌ Duplicate schedulers removed
- ❌ Existing Proofly/Xgrow APIs changed
- ❌ Publishing toggled to Brain-only

### Conditions for Decommissioning Old Orchestration

Decommission Proofly or Xgrow orchestration logic ONLY when ALL of:

1. **Brain Post Orchestrator has equivalent functionality**
   - Event ingestion works
   - Drafting works
   - Scheduling works
   - Publishing works
   - Analytics collection works

2. **Service contracts proven**
   - Proofly responds correctly to AssetRequest
   - Xgrow responds correctly to OptimizationRequest
   - Response latency is acceptable
   - Error handling is robust

3. **Dashboard visibility complete**
   - Brain Console shows full post pipeline
   - Post status is tracked end-to-end
   - Approval workflow is visible
   - Recovery/blockers are surfaced

4. **Dual-run validation succeeds**
   - Old system and Brain system run on same events
   - Outputs are compared for quality/correctness
   - No silent failures in either system
   - User explicitly validates parity

5. **User approves decommission**
   - Explicit approval required in writing
   - Rollback plan documented
   - Existing posts not affected

### Rollback Plan

Until decommission approval:

- Keep old Proofly/Xgrow orchestration operational
- Run Brain Post Orchestrator in parallel (read-only/dry-run)
- Log all divergences for analysis
- If Brain fails, old system continues (no user impact)

---

## 7. Risks and Mitigations

### Risk: Duplicated Schedulers

**Problem:** Two schedulers = conflicting publish times, double publishing, missed posts.

**Mitigation:** Brain canonical scheduler gates all publishing. Old schedulers become read-only/passive until decommissioned.

### Risk: Secret/Session Leakage from Xgrow

**Problem:** Xgrow contains `data/auth.json` and `data/twitter-cookies.json`. Moving to Brain exposes secrets.

**Mitigation:** Never move secrets. Brain calls Xgrow via API/contract. Xgrow retains all credentials. Brain only sees optimization results, never raw auth.

### Risk: Playwright Posting Fragility

**Problem:** Xgrow's Playwright posting is fragile (cookies expire, Twitter API changes, rate limits hit).

**Mitigation:** Delay Playwright posting to Brain. Prove HTTP API contracts first (Proofly asset, Xgrow optimization). Only integrate Playwright after security review and dry-run validation.

### Risk: Premature Repo Merge

**Problem:** Merging repos before architecture is proven leads to massive revert.

**Mitigation:** No merge. Keep repos separate. Use HTTP contracts. Prove service boundaries first.

### Risk: Unclear Ownership Boundaries

**Problem:** During transition, it's unclear who owns what (approval? scheduling? publishing?).

**Mitigation:** Explicit service contracts define boundaries. Brain owns orchestration. Proofly/Xgrow are called modules. Audit logs track decisions.

### Risk: Overbuilding Before Proving Contracts

**Problem:** Build Brain Post Orchestrator fully before knowing Proofly/Xgrow response times, error modes, etc.

**Mitigation:** Start with read-only status. Prove contracts with simple stubs/mocks. Iterate. Build publishing only after contracts validate.

---

## 8. Recommended First Implementation Slice

### Phase P1: Post Orchestrator Read-Only Status Scaffold

**Scope:** Read-only status endpoints and dashboard, no publishing execution, no Proofly/Xgrow code changes.

**Brain Core additions:**
- GET /post-orchestrator/status (operational state)
- GET /post-orchestrator/contracts (service contract versions)
- GET /post-orchestrator/integrations (Proofly/Xgrow readiness)
- GET /post-orchestrator/recovery (blockers and next steps)

**Brain Console additions:**
- New "Posts" or "Post Orchestrator" dashboard section
- Post Orchestrator status card
- Pipeline module cards (Proofly, Xgrow)
- Publishing disabled state (clear indicator)
- Recovery/blockers panel

**Data is static/derived from inventory:**
- Post Orchestrator: "planned/partial"
- Proofly integration: "planned"
- Xgrow integration: "planned"
- Publishing: "disabled (approval-gated)"

**Safety:**
- ✅ No Proofly code changes
- ✅ No Xgrow code changes
- ✅ No actual Proofly asset requests
- ✅ No actual Xgrow optimization requests
- ✅ No publishing to platforms
- ✅ No scheduler changes
- ✅ Read-only visibility only

**Exit criteria:**
- Brain Console shows Post Orchestrator section
- Proofly and Xgrow visible as modules
- Dashboard shows "planning" / "disabled" state
- All tests pass
- No Proofly/Xgrow repo changes

---

## 9. Timeline and Sequencing

### Phase 0: Consolidation Architecture (CURRENT — 2026-05-18)
- ✅ Strategic direction documented
- ✅ Repo responsibilities defined
- ✅ Service contracts sketched
- ✅ Dashboard requirements defined
- ✅ Risks identified and mitigated

### Phase 1: Read-Only Status Scaffold (NEXT — 2026-05-19+)
- Brain Core endpoints for Post Orchestrator status
- Brain Console section for Posts/Post Orchestrator
- Static inventory-based data
- No execution, no Proofly/Xgrow changes

### Phase 2: Service Contract Validation (2026-05-26+)
- Stub/mock Proofly and Xgrow contracts
- Test request/response cycle
- Measure latency, error modes
- Refine contracts based on real behavior

### Phase 3: Dry-Run Post Pipeline (2026-06-02+)
- Brain Post Orchestrator draft generation (preview-only)
- Proofly asset request/response (no persistence)
- Xgrow optimization request/response (no persistence)
- No publishing to platforms

### Phase 4: Approval-Gated Scheduling (2026-06-09+)
- User approves post in Brain Console
- Creates PostScheduleItem (no publication yet)
- Displays scheduled list
- Still no platform publishing

### Phase 5: Platform Publishing Integration (2026-06-16+)
- ONLY after explicit user approval
- ONLY after Playwright security review
- Rate limiting and fallback logic
- Platform-specific auth isolation

### Phase 6-10: Dual-Run, Parity, Decommission (2026-07+)
- Run Brain and old systems in parallel
- Compare outputs and audit trails
- Validate quality and reliability
- Only after validation: explicit user approval for decommission

---

## 10. Decision Log

**Decision:** Brain owns Post Orchestrator  
**Rationale:** Unified dashboard requires unified orchestration. Scattered logic across repos is unmanageable.  
**Alternative:** Keep Proofly/Xgrow as independent silos (rejected: creates duplicate approval/scheduling/publishing).  
**Approved:** Yes (per strategic direction provided).

**Decision:** No physical repo merge yet  
**Rationale:** Prove architecture and service contracts first. Physical merge before validation is high-risk reversal.  
**Approved:** Yes.

**Decision:** Proofly and Xgrow remain operational  
**Rationale:** No reason to break them. Use them as modules via contracts. Decommission only after parity.  
**Approved:** Yes.

**Decision:** Publishing remains disabled (approval-gated) in Phase 1-4  
**Rationale:** Need time to review Playwright security, prove contracts, validate outputs before enabling execution.  
**Approved:** Yes.

---

## 11. Related Documents

- `docs/system/obsidian-mind-model-router-roadmap.md` — Brain Core and Brain Console strategy
- `docs/system/unified-orchestrator-command-center-implementation-plan-2026-05-17.md` — Brain Console phases
- `docs/system/obsidian-command-center-dashboard-spec-2026-05-17.md` — Dashboard design
- `docs/system/stb-to-video-orchestrator-migration-plan-2026-05-17.md` — Video Orchestrator migration (similar consolidation pattern)
- `docs/system/1779034841996-obsidian-mind-model-router-handoff.md` — Current Brain Core phase status
