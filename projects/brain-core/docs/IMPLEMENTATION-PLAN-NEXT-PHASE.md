# Implementation Plan — Next Phase (Steps 1–5)

**Date:** 2026-05-24 (Prepared for next session)  
**Scope:** 5 independent implementation steps to complete VO Studio framework  
**Estimated effort:** 3–4 hours total (can run in parallel)  
**Blockers:** None identified  

---

## Overview

This phase closes the loop on the partial implementations and enables end-to-end operator workflows:

1. **Step 1** — Wire real AI providers to Agent Orchestrator (unblock task execution)
2. **Step 2** — Add UI panels for job progress visibility (operator workflow)
3. **Step 3** — Wire approval previews (informed decisions)
4. **Step 4** — Implement Phase 4: SEO metadata generation (complete pipeline)
5. **Step 5** — Implement Phase 5: Analytics feedback loop (learning loop)

Each step is **independent** and can be implemented in parallel by separate agents if desired.

---

## Step 1: Wire Real AI Providers to Agent Orchestrator

**Effort:** 45–60 min  
**File:** `projects/brain-core/src/adapters/agent-orchestrator-executor.ts`  
**Why first:** Everything else depends on the orchestrator being able to execute tasks.

### Current State
All provider calls return mock `{ status: 'stub' }` responses:

```typescript
case 'gemini':
  return { status: 'stub', message: 'Gemini provider not yet wired' };
case 'claude':
  return { status: 'stub', message: 'Claude provider not yet wired' };
case 'codex':
  return { status: 'stub', message: 'Codex provider not yet wired' };
```

### Required Changes

1. **Gemini Provider**
   - File: `projects/brain-core/src/adapters/ai-model-selector-client.ts` (new)
   - Calls: `POST http://localhost:4890/api/v1/route` with task prompt
   - Returns: AI response text
   - Error handling: Retry on 429 (rate limit), fall through to next provider

2. **Claude Provider**
   - File: `projects/brain-core/src/adapters/anthropic-client.ts` (new)
   - Library: Anthropic SDK (already in package.json)
   - Calls: `messages.create()` with task prompt
   - Returns: AI response text
   - Env var: `ANTHROPIC_API_KEY` (optional, needed for real requests)

3. **Codex Provider**
   - File: Already integrated at `projects/brain-core/src/adapters/codex-client.ts`
   - Integration: Call existing `execCodexTask(prompt)` function
   - Returns: Execution result or stdout

4. **Update Orchestrator Executor**
   - Replace case statements with real provider calls
   - Chain: Gemini → Claude → Codex → bash (each fallback only if previous fails)
   - Record outcome: `{ status: 'success', provider, result, latency }`
   - Error handling: Catch, log, escalate to next provider

### Success Criteria
- ✅ All 39 orchestrator tests pass
- ✅ `executeTask()` calls real Gemini/Claude/Codex APIs (not mocks)
- ✅ Fallback routing works (if Gemini fails, tries Claude, then Codex)
- ✅ Approval gates still pause execution until operator decides

### Testing
```bash
cd projects/brain-core
npm test -- agent-orchestrator-executor.test.ts
# Should see: real API calls in test output (or skip if env vars missing)
```

---

## Step 2: Add UI Panels for Job Progress (Composition, Subtitles, Thumbnails)

**Effort:** 60–90 min  
**Files:**
- `projects/brain-console-obsidian/src/components/VO/JobProgressPanel.ts` (new)
- `projects/brain-console-obsidian/src/components/VO/VOShell.ts` (integrate)

**Why second:** Operator needs to see what's running while waiting for approval decisions.

### Architecture

**JobProgressPanel** — 2-phase init (constructor + `async initialize()`)

```typescript
export class JobProgressPanel {
  constructor(container: HTMLElement, projectId: string)
  async initialize(): Promise<void>
  
  private render()           // skeleton: job cards, progress bars
  private loadJobStatus()    // GET /api/video-orchestrator/jobs?projectId=X
  private startAutoRefresh() // 30-second interval
  private renderJobCard()    // per-job: stage, progress%, status, errors
}
```

### Data Flow

1. **Fetch endpoint** — `GET /api/video-orchestrator/jobs?projectId=X`
   - Returns: `{ jobs: [{ id, stage, status, progress, error }] }`
   - Stages: composition, subtitle, thumbnail, metadata
   - Status: pending, processing, awaiting-approval, completed, failed

2. **Render job card** for each job:
   ```
   [Job ID] — Composition — 45% ▓▓▓▓░░░░░░
   Status: processing
   Started: 2:05 PM
   ```

3. **Approval gate indicator:**
   - If status = "awaiting-approval": highlight red, show "⚠ Awaiting Operator Decision"
   - If status = "processing": show progress bar + spinner
   - If status = "completed": show checkmark + timestamp

4. **Error display:**
   - If error: show error message in red, retry button

### Integration into VOShell

1. Add import at top
2. Add field: `private jobProgressPanel: JobProgressPanel | null = null;`
3. Add tab button: `<button class="vo-tab" data-tab="jobs">Jobs</button>`
4. In `renderCurrentTab()`, add case for 'jobs':
   ```typescript
   case 'jobs':
     if (this.jobProgressPanel) {
       this.jobProgressPanel.destroy();
       this.jobProgressPanel = null;
     }
     const jobContainer = this.contentArea.createDiv();
     this.jobProgressPanel = new JobProgressPanel(jobContainer, this.state.projectId);
     await this.jobProgressPanel.initialize();
     break;
   ```

### CSS
- Reuse `.vo-progress-bar`, `.vo-status-badge`, `.vo-job-card` (already exist)
- New: `.vo-stage-label`, `.vo-job-error` (minimal, ~10 lines)

### Success Criteria
- ✅ "Jobs" tab appears in VO Studio navigation
- ✅ Job cards render with progress bars
- ✅ Approval gate status shows "⚠ Awaiting Operator Decision"
- ✅ Auto-refreshes every 30 seconds
- ✅ Errors display clearly

---

## Step 3: Wire Approval UI for Thumbnail & Metadata Previews

**Effort:** 45–60 min  
**File:** `projects/brain-console-obsidian/src/components/VO/ApprovalQueuePanel.ts` (enhance)

**Why third:** Makes approval decisions more informed.

### Current State
Operator can approve/reject, but doesn't see what they're approving.

### Required Changes

1. **Thumbnail variant preview**
   - When approval type = 'thumbnail': fetch variant images
   - Show side-by-side comparison (Variant A | Variant B)
   - Allow selection: radio button or click to select
   - Selection persists in approval decision

2. **Metadata preview**
   - When approval type = 'metadata': show generated content:
     ```
     Title: "Why AI Will Change Your Life"
     Description: "Discover how AI is reshaping..."
     Tags: ai, technology, education
     Hashtags: #AI #Tech #Learning
     ```
   - Allow inline editing before approval
   - Send edited values in approval decision

3. **Enhanced approval detail view**
   - Show preview immediately when item is clicked
   - Expand to show full details
   - "Approve Selected" button stays active
   - Show variant selection or edit form

### Implementation

```typescript
private showDetail(item: ApprovalItem): void {
  // existing code...
  
  if (item.type === 'thumbnail') {
    this.renderThumbnailPreview(item);
  } else if (item.type === 'metadata') {
    this.renderMetadataPreview(item);
  }
  
  // Show approve button after preview loads
  this.approveButton.disabled = false;
}

private renderThumbnailPreview(item): void {
  // For each variant: fetch image, render <img> side-by-side
  // Add radio buttons or click-to-select
}

private renderMetadataPreview(item): void {
  // Show title, description, tags, hashtags
  // Make fields contentEditable if operator wants to tweak
}
```

### Success Criteria
- ✅ Thumbnail approvals show image previews
- ✅ Metadata approvals show title/description/tags
- ✅ Operator can select variant or edit before approving
- ✅ Approval decision includes selection/edits
- ✅ No TypeScript errors

---

## Step 4: Implement Phase 4 (SEO Metadata Generation)

**Effort:** 90–120 min  
**Files:**
- `projects/brain-core/src/adapters/video-orchestrator-metadata-generator.ts` (new)
- `projects/brain-core/src/api/routes.ts` (add endpoint)
- `projects/brain-console-obsidian/src/components/VO/MetadataGeneratorPanel.ts` (new)
- Tests: `projects/brain-core/src/tests/video-orchestrator-metadata-generator.test.ts` (new)

**Why fourth:** Completes the content creation pipeline.

### Backend Implementation

**Function: `generateMetadataForPackage(packageId, contentContext)`**

```typescript
// Input
{
  packageId: string;
  projectId: string;
  videoTitle?: string;
  videoDescription?: string;
  targetPlatforms: ('youtube' | 'tiktok' | 'instagram')[];
}

// Process
1. Fetch video content from package (title, script, duration)
2. Call Gemini/Claude via AI Model Selector: "Generate SEO metadata for this video"
3. Receive: { youtubeTitle, youtubeDesc, youtubeTags, tiktokCaption, instagramCaption, hashtagsPerPlatform }
4. Create approval record (type: 'metadata')
5. Store in PostgreSQL with status 'pending'
6. Return approval ID + preview

// Output
{
  approvalId: string;
  metadata: {
    youtube: { title, description, tags };
    tiktok: { caption, hashtags };
    instagram: { caption, hashtags };
  };
  preview: string; // formatted display
}
```

### API Endpoint

```typescript
if (url === '/api/video-orchestrator/metadata/generate') {
  const body = JSON.parse(requestBody);
  const result = await generateMetadataForPackage(body);
  sendJson(response, 200, result);
  return;
}
```

### UI Component: MetadataGeneratorPanel

- New tab in VO Studio: "Metadata Generator"
- Form: Select package → Click "Generate" → Shows approval record
- Approval appears in ApprovalQueuePanel (Step 3)
- Operator reviews suggestions → edits if needed → approves
- Approved metadata attached to package, ready for publish

### Tests (8–10 tests)
- Generate metadata: success case
- Provider fallback (Gemini → Claude)
- Approval record creation
- Platform-specific formatting (YouTube vs TikTok vs Instagram)
- Error handling (if generation fails)

### Success Criteria
- ✅ `generateMetadataForPackage()` calls real AI provider
- ✅ Approval record created (type: 'metadata')
- ✅ MetadataGeneratorPanel renders in VOShell
- ✅ Operator can edit and approve
- ✅ Approved metadata persists to database
- ✅ All new tests passing

---

## Step 5: Implement Phase 5 (Analytics Feedback Loop)

**Effort:** 90–120 min  
**Files:**
- `projects/brain-core/src/adapters/video-orchestrator-analytics-feedback.ts` (new)
- `projects/brain-core/src/api/routes.ts` (add endpoints)
- `projects/brain-console-obsidian/src/components/VO/FeedbackLoopPanel.ts` (new)
- Tests: `projects/brain-core/src/tests/video-orchestrator-analytics-feedback.test.ts` (new)

**Why fifth:** Closes the loop — operator learns what works.

### Backend Implementation

**Endpoint 1: Record publishing outcome**

```typescript
POST /api/video-orchestrator/analytics/publish-outcome
{
  packageId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  publishedAt: string;
  outcome: 'success' | 'failed';
  error?: string;
  publishUrl?: string;
}
```

**Endpoint 2: Record 24-hour metrics**

```typescript
POST /api/video-orchestrator/analytics/video-metrics
{
  packageId: string;
  platform: string;
  metric_24h_views?: number;
  metric_24h_engagement?: number;  // likes + shares + comments
  metric_ctr?: number;              // click-through rate (for thumbnails)
  metricThumbnailVariant?: string;  // which variant was used
  metricMetadataVariant?: string;   // which metadata version
}
```

**Analysis: Compare variants**

```typescript
function analyzeVariantPerformance(projectId: string) {
  // Query: which thumbnail variants were used + their performance
  // Group by thumbnail variant → avg CTR, avg views, conversion
  // Return: "Variant A: 2.3% CTR vs Variant B: 1.8% CTR"
  
  // Same for metadata: "Title A got 2K views, Title B got 1.5K"
  
  // Suggest: "Next video should use Variant A approach"
}
```

### UI Component: FeedbackLoopPanel

- New admin panel in VO Studio
- Show performance by variant:
  ```
  Thumbnail Variants:
  ├─ Bold Text (12 videos, avg CTR 2.3%)
  ├─ Minimal Curiosity (8 videos, avg CTR 1.8%)
  
  Metadata Titles:
  ├─ "Why..." (15K total views)
  ├─ "How to..." (12K total views)
  ```
- Suggestions card: "Next video should use Bold Text approach"
- Optional: Enable A/B testing toggle → auto-select best variant for next publish

### Tests (8–10 tests)
- Record publish outcome (success)
- Record publish outcome (failure)
- Record 24-hour metrics
- Analyze variant performance
- Suggestion generation
- Error handling

### Success Criteria
- ✅ Publish outcomes recorded to database
- ✅ 24-hour metrics captured and analyzed
- ✅ Variant performance compared
- ✅ Suggestions generated and displayed
- ✅ FeedbackLoopPanel renders in admin
- ✅ All new tests passing
- ✅ Operator can see "Variant A outperformed Variant B"

---

## Parallel Execution Strategy

All 5 steps are **independent**. Suggested agent assignments:

| Step | Agent | Est. Time |
|------|-------|-----------|
| 1 | coder-default (or sonnet if complex) | 45–60 min |
| 2 | cheap-prep (UI work) | 60–90 min |
| 3 | cheap-prep (UI enhancement) | 45–60 min |
| 4 | coder-default (backend + UI) | 90–120 min |
| 5 | coder-default (backend + UI) | 90–120 min |

**Sequential alternative:** Implement in order 1 → 2 → 3 → 4 → 5 (allows learning from prior step, ~3–4 hours total).

---

## Git Workflow

1. Create feature branch: `git checkout -b phase-next-implementation`
2. Implement steps (parallel or sequential)
3. Run full test suite: `npm test` (target: 1100+ tests passing, 0 failures)
4. Typecheck: `npm run typecheck` (must pass)
5. Commit per step: `git commit -m "Step N: ..."`
6. Final commit: `git commit -m "Phase next complete: Steps 1–5"`
7. Open PR for review

---

## Deployment Checklist

- [ ] All 5 steps implemented
- [ ] Tests passing (1100+, 0 failures)
- [ ] TypeScript typecheck passes
- [ ] Brain Console plugin builds: `npm run build && npm run package`
- [ ] Plugin installed to vault: `npm run install:active-vault`
- [ ] Brain Core starts: `npm start` at localhost:4877
- [ ] Manual test: End-to-end workflow (create → approve → publish → see feedback)
- [ ] No regressions in existing tabs (Overview, Studio, Pipelines, Accounts, History, Admin)
- [ ] Performance: UI panels load <2s, auto-refresh works

---

## Success Criteria for Entire Phase

After all 5 steps:

- ✅ Agent Orchestrator calls real Gemini/Claude/Codex APIs (not mocks)
- ✅ Operator sees job progress in Brain Console UI
- ✅ Operator sees thumbnail/metadata previews in approval workflow
- ✅ Phase 4 (metadata generation) fully integrated
- ✅ Phase 5 (feedback loop) capturing publishing success + suggesting improvements
- ✅ All tests passing (target: 1100+)
- ✅ No regressions in existing functionality
- ✅ End-to-end workflow: content creation → approvals → publishing → feedback

---

## Continuation

After completing all 5 steps:
1. Update this document with completion timestamps
2. Update `video-orchestrator-roadmap.md` (all 16 phases marked ✅)
3. Create final session handoff documenting lessons learned
4. Prepare for production deployment (Dokploy configuration, monitoring setup)

---

**Next session:** Start with Step 1 (wire real AI providers). All prerequisites are met. No blockers identified.
