# I-8.3c Plan: AWS Video Operational Console

## Context

The AWS Video tab is currently a static topic/channel dashboard (AwsVideoPipelinePanel). I-8.3c upgrades it into an operational control tower: real job list, job detail, generate trigger, and status polling. Brain Core gets 4 new read endpoints. Brain Console gets a redesigned panel.

---

## Phase A — Brain Core: Operational Job API

### File: `projects/brain-core/src/providers/video-orchestrator-provider.ts`

**New interfaces to add** (after existing interfaces, before `generateApprovedScript`):

```typescript
export interface NormalizedJobStatus =
  'draft' | 'awaiting_approval' | 'approved' | 'generating' |
  'generated' | 'ready_to_publish' | 'publishing' | 'published' | 'failed';

export interface VideoJobSummary {
  jobId: string;
  channelId: string;
  title: string;
  status: NormalizedJobStatus;
  currentStep: string | null;
  progress: number; // 0-100
  createdAt: string | null;
  updatedAt: string | null;
  approval: { status: string; required: boolean };
  generation: { status: string; executionArn: string | null; startedAt: string | null; completedAt: string | null };
  publishing: { status: string; videoId: string | null; url: string | null };
  error: { step: string | null; message: string | null };
  artifacts: { script: string | null; narration: string | null; finalVideo: string | null; thumbnail: string | null };
}

export interface VideoJobTimelineEvent {
  step: string;
  status: 'complete' | 'in_progress' | 'pending' | 'failed';
  timestamp: string | null;
  message: string;
}

export interface VideoJobTimeline {
  jobId: string;
  events: VideoJobTimelineEvent[];
}
```

**Status normalization logic** (private helper `normalizeJobStatus`):
```
publishStatus = "uploaded"              → "published"
publishStatus = "publishing"            → "publishing"
statusJson.status = "complete" OR
  completedSteps has "thumbnail_generated" → "ready_to_publish"
statusJson.status = "generating"        → "generating"
approval.status = "approved" (no gen)   → "approved"
approval.status = "pending" + source = interactive-prompt + wordCount=0 → "draft"
approval.status = "pending"             → "awaiting_approval"
statusJson.failedStep exists            → "failed"
default                                 → "draft"
```

**Progress mapping** (private helper `statusToProgress`):
```
draft:0 | awaiting_approval:20 | approved:30 | generating:50 |
generated:70 | ready_to_publish:80 | publishing:90 | published:100 | failed:0
```

**New exported functions** (add after `getScriptsByChannel`):

1. **`getRecentVideoJobs(limit?: number): Promise<VideoJobSummary[]>`**
   - `readdir(jobsPath)` (same dynamic import pattern as `getScriptsByChannel`)
   - For each dir: `Promise.all([readOptionalJson(script), readOptionalJson(topic), readOptionalJson(status), readOptionalJson(publish)])` — all use `getJobMetadataPath` or `getJobPublishingPath`
   - Skip dirs where script.json not readable (test fixtures, non-job dirs)
   - Build `VideoJobSummary` via `normalizeJobStatus` 
   - Sort by `updatedAt ?? createdAt` descending
   - Return top `limit` (default 20)

2. **`getVideoJob(jobId: string): Promise<VideoJobSummary | null>`**
   - Same pattern as `getRecentVideoJobs` but for single job
   - Returns null if script.json missing or jobId invalid

3. **`getVideoJobTimeline(jobId: string): Promise<VideoJobTimeline | null>`**
   - Load all metadata files for the job
   - Infer timeline events from metadata existence/fields:
     - topic.json exists → `draft_created` at `topic.createdAt`
     - script.approval.status = "approved" → `script_approved` at `approval.approvedAt`
     - completedSteps includes "narration_generated" OR assets.narration → `narration_created`
     - completedSteps includes "video_assembled" OR assets.finalVideo → `video_generated`
     - completedSteps includes "thumbnail_generated" OR assets.thumbnail → `thumbnail_generated`
     - publish.publishStatus = "pending" + status.status = "complete" → `ready_to_publish`
     - publish.platforms.youtube.status = "uploaded" → `published`
   - Each event: `{ step, status: "complete"|"in_progress"|"pending"|"failed", timestamp, message }`

4. **`getVideoJobArtifacts(jobId: string): Promise<Record<string, unknown> | null>`**
   - Read `metadata/assets.json` via `readOptionalJson`
   - Fall back to inferring from `status.json` `finalVideoKey`/`thumbnailKey` if assets.json missing
   - Returns parsed JSON or null

### File: `projects/brain-core/src/api/routes.ts`

Add imports for new functions. Add 4 route blocks using regex pattern:

```
GET /api/video-orchestrator/jobs/recent          → exact match
GET /api/video-orchestrator/jobs/{jobId}         → regex
GET /api/video-orchestrator/jobs/{jobId}/timeline → regex  
GET /api/video-orchestrator/jobs/{jobId}/artifacts → regex
```

**Critical ordering**: Place `recent` exact match BEFORE the `{jobId}` regex, otherwise "recent" is treated as a jobId.

Import additions to `routes.ts`:
```typescript
import { ..., getRecentVideoJobs, getVideoJob, getVideoJobTimeline, getVideoJobArtifacts } from '../providers/video-orchestrator-provider.js';
```

### New file: `projects/video-orchestrator/cloud/scripts/validate-operational-job-api.sh`

Tests:
1. `GET /api/video-orchestrator/jobs/recent` returns array
2. `prochat-console-gen-001` appears in recent jobs
3. `prochat-real-001` appears with status "published" (has youtube videoId)
4. `GET /api/video-orchestrator/jobs/prochat-real-001` returns full normalized job
5. Timeline endpoint returns events array with at least draft_created
6. Artifacts endpoint returns non-null for prochat-real-001
7. Missing job returns null/404 without crash
8. No secrets (tokens/credentials) in any response

### New doc: `docs/releases/i-8.3c-operational-job-api.md`

---

## Phase B — Brain Console: Operational Dashboard Redesign

### File: `projects/brain-console-obsidian/src/components/VO/AwsVideoPipelinePanel.ts`

Complete redesign of the render loop. Keep class structure, constructor, `initialize()`/`destroy()` patterns. Replace all `render...()` methods with operational layout.

**New state added to class:**
```typescript
private selectedJobId: string | null = null;
private selectedJob: NormalizedJobSummary | null = null;
private recentJobs: NormalizedJobSummary[] = [];
private pollingInterval: ReturnType<typeof setInterval> | null = null;
```

**New layout order** (inside `render()` → `innerHTML` replacement):
1. Refresh bar (keep existing)
2. Pipeline health + counters (compact, keep existing data)
3. **[NEW] Recent Jobs panel** — job list from `/api/video-orchestrator/jobs/recent`
4. **[NEW] Selected Job Detail panel** — full detail + actions for selectedJobId
5. **[NEW] Create Draft compact card** — single "Create Draft Video" button, opens modal on click
6. Topic Candidates section (moved below, keep existing)
7. Channel cards (keep existing, compact)

**New fetch calls added:**
```typescript
const recentJobsRes = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/recent`);
// after job selected:
const jobDetailRes = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/${jobId}`);
const timelineRes = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/${jobId}/timeline`);
```

**Recent Jobs panel** (`renderRecentJobs()`):
- Table/list with columns: status badge, jobId (truncated), channel, title, step, age, nextAction
- Click row → set `selectedJobId`, call `loadJobDetail(jobId)`, re-render
- Empty state: "No jobs yet. Create a draft to get started."

**Selected Job Detail** (`renderSelectedJobDetail()`):
- Show all normalized fields
- Approval section: status badge + "Approve" / "Request Changes" buttons (if pending)
- Generation section: status, executionArn (if any), step
- Publishing section: status, videoId/url (if any)
- Artifacts section: script, narration, finalVideo, thumbnail (key paths)
- Timeline: event list with status icons
- Error box: red, shows `error.step` + `error.message`, persists
- **Generate button**: visible only if `approval.status === 'approved'` AND status NOT in ['generating','generated','ready_to_publish','publishing','published']
  - On click: `confirm("Generate video artifacts only. This will not publish to YouTube.")` → POST `/api/video-orchestrator/scripts/${jobId}/generate` → reload selected job + set polling

**Create Draft modal** (`renderCreateDraftCard()`):
- Single "Create Draft Video" button in compact card
- On click: renders modal overlay with channel dropdown + prompt textarea + Create/Cancel
- On success: add job to recentJobs, auto-select the new job, show "next: Approve Script"
- Uses same `createBrainCoreVideoJobFromPrompt` call as PromptDraftForm

**Status polling** (`startPolling()` / `stopPolling()`):
- Condition: `selectedJob.status === 'generating' || selectedJob.status === 'publishing'`
- `setInterval(10000)` → calls `loadJobDetail(selectedJobId)`
- Always `stopPolling()` before `startPolling()` to avoid stacking intervals
- Stop polling when status changes to terminal state (generated/ready_to_publish/published/failed)
- Show "ETA: usually 1–5 minutes" when polling

**PromptDraftForm.ts**: Keep the file, no changes needed. The create draft modal reuses the same POST endpoint directly without needing the full PromptDraftForm class.

### File: `projects/brain-console-obsidian/src/client.ts`

Add TypeScript interfaces and API functions matching Brain Core's new response shapes:
```typescript
interface BrainCoreVideoJobSummary { jobId, channelId, title, status, ... }
interface BrainCoreVideoJobTimeline { jobId, events: [...] }
async function getBrainCoreRecentVideoJobs(baseUrl): Promise<HttpResult<{jobs: BrainCoreVideoJobSummary[]}>>
async function getBrainCoreVideoJob(baseUrl, jobId): Promise<HttpResult<BrainCoreVideoJobSummary>>
async function getBrainCoreVideoJobTimeline(baseUrl, jobId): Promise<HttpResult<BrainCoreVideoJobTimeline>>
```

**Note**: `AwsVideoPipelinePanel` currently uses direct `fetch()` + `res.json()` pattern, NOT `client.ts`. For consistency with that panel's pattern, new API calls can be raw fetch too. Client.ts interfaces can be added for type safety without being required.

### New validation: `projects/video-orchestrator/cloud/scripts/validate-brain-console-operational-dashboard.sh`

Static checks only (in brain repo scripts dir, per CLAUDE.md convention):
- `AwsVideoPipelinePanel.ts` contains `recentJobs`/`selectedJobId` state fields
- `renderRecentJobs` function exists
- `renderSelectedJobDetail` function exists
- Create Draft modal pattern exists (confirm/create)
- Generate button found
- No `aws` imports in AwsVideoPipelinePanel.ts
- No S3 direct reads
- `npm run typecheck` passes (or build passes)

### Build + deploy (always in this order):
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian
npm run build && npm run package && npm run install:active-vault
```

---

## Phase C — Proof

Create `docs/releases/i-8.3c-operational-console-proof.md` in brain repo showing:
- Screenshot-equivalent textual proof of each Phase C step
- API responses from curl commands
- No YouTube publishing occurred

---

## Key reuse

- `getVideoOrchestratorRoot()` — existing, line 6
- `getJobMetadataPath(jobId, file)` — existing, line 253
- `getJobPublishingPath(jobId)` — existing, line 257
- `readOptionalJson(path)` — existing, line 261
- `isValidJobId(jobId)` — existing, line 249
- Dynamic `fs.readdir` pattern — from `getScriptsByChannel`, line 224
- `BASE_URL` / `baseUrl` pattern — existing in all VO panels
- POST `/api/video-orchestrator/scripts/{jobId}/generate` — existing from I-8.3A

---

## Verification

Phase A:
1. `curl /api/video-orchestrator/jobs/recent` → array with all jobs
2. `curl /api/video-orchestrator/jobs/prochat-real-001` → normalized full detail
3. `curl /api/video-orchestrator/jobs/prochat-real-001/timeline` → event list
4. `bash validate-operational-job-api.sh` — all tests pass

Phase B:
1. `npm run build` succeeds
2. `bash validate-brain-console-operational-dashboard.sh` — all checks pass
3. Open Brain Console → AWS Video tab
4. See Recent Jobs list with jobs visible
5. Click a job → see detail panel
6. Create Draft → appears in list → auto-selected
7. Generate button visible only for approved jobs
8. Polling visible when generating

Phase C:
1. Full proof run via curl + console walkthrough
