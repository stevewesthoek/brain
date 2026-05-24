# Codex Prompt — Next Session Pickup

**Session:** VO Studio Implementation — Phase Next Steps (Steps 1–5)  
**Date Started:** 2026-05-24  
**Status:** Ready for pickup  

---

## Quick Context

You are resuming a VO Studio implementation session. The system is a production-grade multi-platform video orchestration framework with approval workflows, resilience patterns, and operator visibility. All prior phases (11 complete) have been implemented and tested. Five implementation steps remain to close the loop.

---

## Where We Are

**Completed (994 tests passing):**
- Read framework (Phase 0.8): Projects, Accounts, Pipelines, Content, Packages, Analytics APIs
- Brain Console UI (Phase 0.9): 5 panels (Overview, Studio, Pipelines, Accounts, History) + Admin
- Approval workflow (Phase 1W–2W): Full gating, audit trail, escalation, bulk actions
- Multi-platform publishing (Phase 6): YouTube OAuth2, TikTok API v2 (3-step), Instagram Graph API v18, n8n fallback
- Agent Orchestrator (Phase 0.7 partial): Task decomposition, DAG execution, approval gates (providers are stubs)
- Production hardening: Circuit breakers, retry logic, error recovery, metrics, alerts, health checks
- Admin features: Analytics, audit logs, operator dashboard

**Partially done (stubs, need implementation):**
- Agent Orchestrator real provider calls (Gemini, Claude, Codex)
- Job progress UI (operator can't see composition/subtitle/thumbnail progress)
- Approval previews (thumbnail variants, metadata suggestions not shown)
- Phase 4 (metadata generation) — not started
- Phase 5 (analytics feedback) — not started

---

## Five Steps: Start Here

### Step 1: Wire Real AI Providers to Agent Orchestrator (45–60 min)

**File:** `projects/brain-core/src/adapters/agent-orchestrator-executor.ts`

**What to do:**
1. Replace all `case 'provider': return { status: 'stub' };` with real API calls
2. Wire Gemini → call `POST http://localhost:4890/api/v1/route` (AI Model Selector)
3. Wire Claude → use Anthropic SDK, call `messages.create()` with task prompt
4. Wire Codex → call existing `execCodexTask()` function
5. Chain fallback: Gemini → Claude → Codex (each only if previous fails)
6. Record outcome: `{ status: 'success', provider, result, latency }`

**Why first:** Everything else depends on the orchestrator actually executing tasks.

**Success:** Run `npm test -- agent-orchestrator-executor.test.ts` — should pass, see real provider calls in output.

---

### Step 2: Add UI Panels for Job Progress (60–90 min)

**Files:**
- New: `projects/brain-console-obsidian/src/components/VO/JobProgressPanel.ts`
- Modify: `projects/brain-console-obsidian/src/components/VO/VOShell.ts`

**What to do:**
1. Create `JobProgressPanel` (2-phase init: constructor + `async initialize()`)
2. Fetch: `GET /api/video-orchestrator/jobs?projectId=X`
3. Render job cards with: stage, progress bar, status, errors
4. Show approval gate indicator if awaiting decision
5. Auto-refresh every 30 seconds
6. Add "Jobs" tab to VOShell (follow existing tab pattern)

**Why second:** Operator needs visibility into what's running.

**Success:** Click "Jobs" tab → see job cards with progress bars → auto-refresh works.

---

### Step 3: Wire Approval UI for Thumbnail & Metadata Previews (45–60 min)

**File:** `projects/brain-console-obsidian/src/components/VO/ApprovalQueuePanel.ts` (enhance)

**What to do:**
1. For thumbnail approvals: fetch variant images, show side-by-side comparison
2. For metadata approvals: show generated title/description/tags/hashtags
3. Allow operator to select variant or edit before approving
4. Pass selection/edits in approval decision

**Why third:** Makes approval decisions informed, not blind.

**Success:** Click approval item → see preview → approve with variant selection.

---

### Step 4: Implement Phase 4 (SEO Metadata Generation) (90–120 min)

**Files:**
- New: `projects/brain-core/src/adapters/video-orchestrator-metadata-generator.ts`
- New: `projects/brain-console-obsidian/src/components/VO/MetadataGeneratorPanel.ts`
- New: `projects/brain-core/src/tests/video-orchestrator-metadata-generator.test.ts`
- Modify: `projects/brain-core/src/api/routes.ts` (add endpoint)

**What to do:**
1. Function `generateMetadataForPackage(packageId, contentContext)`
2. Call Gemini/Claude: "Generate SEO metadata for this video"
3. Receive: YouTube/TikTok/Instagram-specific titles, descriptions, tags, hashtags
4. Create approval record (type: 'metadata'), store in PostgreSQL
5. Add UI panel: "Metadata Generator" tab → form → generate → approve
6. 8–10 tests covering generation, approval, formatting

**Why fourth:** Completes the content creation pipeline.

**Success:** Click "Metadata Generator" → select package → click generate → see suggestions → approve.

---

### Step 5: Implement Phase 5 (Analytics Feedback Loop) (90–120 min)

**Files:**
- New: `projects/brain-core/src/adapters/video-orchestrator-analytics-feedback.ts`
- New: `projects/brain-console-obsidian/src/components/VO/FeedbackLoopPanel.ts`
- New: `projects/brain-core/src/tests/video-orchestrator-analytics-feedback.test.ts`
- Modify: `projects/brain-core/src/api/routes.ts` (add endpoints)

**What to do:**
1. Endpoint: `POST /api/video-orchestrator/analytics/publish-outcome` — record success/failure
2. Endpoint: `POST /api/video-orchestrator/analytics/video-metrics` — record 24h views, engagement, CTR
3. Analysis: Compare variant performance (thumbnail A vs B, metadata titles vs titles)
4. Suggestion: "Next video should use Variant A approach" (2.3% CTR vs 1.8%)
5. Add admin panel: "Feedback Loop" → show variant performance, suggestions
6. Optional: A/B test toggle to auto-select best variant
7. 8–10 tests covering outcome recording, metric analysis, suggestions

**Why fifth:** Closes the feedback loop — operator learns what works.

**Success:** Publish video → 24h later → see performance comparison → get suggestion.

---

## Implementation Notes

### Before Starting

1. **Read these docs in order:**
   - `SESSION-HANDOFF-2026-05-24.md` (current state snapshot)
   - `IMPLEMENTATION-PLAN-NEXT-PHASE.md` (detailed breakdown of all 5 steps)
   - This file (quick reference)

2. **Verify environment:**
   ```bash
   cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
   npm run typecheck    # Should pass
   npm test             # Should pass (994 tests)
   ```

3. **Verify Brain Console builds:**
   ```bash
   cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian
   npm run build && npm run package
   ```

### Execution Strategy

**All 5 steps are independent.** You can:
- Implement sequentially (1 → 2 → 3 → 4 → 5) for learning flow
- Delegate to parallel agents (one per step) for speed

**Recommended:** Sequential for code quality and reduced merge conflicts.

### Git Workflow

```bash
# Start
git checkout -b phase-next-implementation

# After each step
git commit -m "Step N: [description]"

# After all 5 complete
npm test             # Should pass (1100+ tests)
npm run typecheck    # Should pass
git commit -m "Phase next: Steps 1–5 complete"

# Review and merge
git push origin phase-next-implementation
# Open PR, review, merge to main
```

### Key Files to Know

- Orchestrator: `projects/brain-core/src/adapters/agent-orchestrator-executor.ts`
- VO Shell tabs: `projects/brain-console-obsidian/src/components/VO/VOShell.ts`
- Approval panel: `projects/brain-console-obsidian/src/components/VO/ApprovalQueuePanel.ts`
- Routes: `projects/brain-core/src/api/routes.ts`
- Database: `projects/brain-core/src/adapters/vo-studio-approval-store.ts`
- Tests: `projects/brain-core/src/tests/*.test.ts`

### Tests

- Unit tests use Jest fixtures and mocks
- Database tests use real PostgreSQL (set `DATABASE_URL` env var)
- UI tests are manual (Obsidian plugin integration)
- Target: 1100+ passing tests, 0 failures

### Common Patterns

**2-phase UI component initialization:**
```typescript
export class MyPanel {
  constructor(container: HTMLElement, projectId: string) { /* store */ }
  async initialize(): Promise<void> {
    this.render();          // skeleton HTML
    await this.loadData();  // fetch from API
    this.startAutoRefresh(); // set interval
  }
  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.container.innerHTML = '';
  }
}
```

**VOShell tab integration pattern:**
```typescript
case 'my-tab':
  if (this.myPanel) {
    this.myPanel.destroy();
    this.myPanel = null;
  }
  const container = this.contentArea.createDiv();
  this.myPanel = new MyPanel(container, this.state.projectId);
  await this.myPanel.initialize();
  break;
```

**Approval record creation:**
```typescript
{
  id: `approval-${type}-${timestamp}-${random}`,
  type: 'content' | 'metadata' | 'thumbnail' | 'package' | 'publish',
  projectId,
  actor: 'browser-user',
  requestPayload: { ...validated },
  status: 'pending',
  expiresAt: now + 24h,
}
```

### Performance Targets

- Job progress panel: refresh <500ms
- Metadata generation: AI call <5s (Gemini/Claude)
- Analytics query: <1s
- UI panel load: <2s

### Deployment

After completing all 5 steps:
1. All tests passing (1100+, 0 failures)
2. TypeScript typecheck passes
3. Brain Console plugin builds successfully
4. Brain Core starts at localhost:4877
5. End-to-end test: create → approve → publish → see feedback
6. No regressions in existing tabs

---

## References

- **Handoff:** `SESSION-HANDOFF-2026-05-24.md`
- **Implementation Plan:** `IMPLEMENTATION-PLAN-NEXT-PHASE.md`
- **Roadmap:** `video-orchestrator-roadmap.md`
- **Git history:** 11 commits (latest: Admin dashboard phase)
- **Test coverage:** 994 tests passing

---

## Success Criteria

✅ Step 1 complete: Real AI providers wired, orchestrator executes actual tasks  
✅ Step 2 complete: Job progress visible to operator in UI  
✅ Step 3 complete: Operator sees preview before approving  
✅ Step 4 complete: Metadata generation integrated end-to-end  
✅ Step 5 complete: Analytics feedback loop learning and suggesting  
✅ All tests passing (1100+)  
✅ No regressions  
✅ Ready for production deployment  

---

## Quick Start

```bash
# Navigate to project
cd /Users/Office/Repos/stevewesthoek/brain

# Read handoff
cat projects/brain-core/docs/SESSION-HANDOFF-2026-05-24.md

# Read implementation plan
cat projects/brain-core/docs/IMPLEMENTATION-PLAN-NEXT-PHASE.md

# Verify environment
cd projects/brain-core
npm run typecheck && npm test

# Start implementation
git checkout -b phase-next-implementation

# Implement Step 1
# (edit agent-orchestrator-executor.ts)

# Continue with Steps 2–5
```

---

**Ready to begin. Start with Step 1.**
