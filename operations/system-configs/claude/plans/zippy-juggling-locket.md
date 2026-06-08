# Plan: Fix Control-Plane Backend Contract

## Context

The AWS Video dashboard regression fix (commit fedaf398) made the UI control-plane driven, but the backend contract the adapter exports doesn't match what the UI or the dist `.d.ts` target declares. Specifically:

- `allowedActions` is returned as an **array** but the UI does `allowedActions.approve_review.enabled` (record access)
- `phase` field is missing (only `canonicalPhase` exists)
- `selectedJob` object is entirely absent
- `artifacts` only has `{ status, unavailableReason }` — no media keys
- `review.media` can be null even when artifacts are complete (stale review.json scenario)
- `ControlPlaneExecutionView` is missing `awsStatus`, `localStatus`, `localStep`, `executionArn`, `startedAt`, `stoppedAt`, `checkedAt`
- `ControlPlaneFinalizationView` missing `attempted`, `ok`, `repaired`, `missingFields`, `error`, `updatedAt`
- `ControlPlanePublishView` missing `dryRunStatus`, `uploadStatus`, `quotaStatus`, `videoId`, `url`, `downloadableVideoUrl`
- `reviewData` extraction is wrong: `review.ok ? review` should be `review.ok ? review.review` (the metadata is nested)
- `missingRequirements` uses raw artifacts, not the repaired review.media

## Files to Change

1. `projects/brain-core/src/adapters/video-orchestrator-control-plane.ts` — full rewrite of interfaces + logic
2. `projects/brain-core/src/tests/video-orchestrator-control-plane.test.ts` — update tests to cover new shape + repair scenario
3. `projects/brain-console-center/lib/braincore-schemas.ts` — update `VideoControlPlaneData` type to new contract
4. `projects/brain-console-center/components/aws-video-dashboard.tsx` — minor: `allowedActions` is now a record not array (already coded for record access, but the cast needs to handle actual record shape)

## Implementation Plan

### Step 1: Rewrite `video-orchestrator-control-plane.ts`

**New interfaces** (matching dist target):

```ts
export interface ControlPlaneSelectedJob {
  jobId: string; title: string; status: string; approvalStatus: string;
  mediaSource: string | null; generationMode: string | null; updatedAt: string | null;
}

export interface ControlPlaneExecutionView {
  status: string | null; awsStatus: string | null; localStatus: string | null;
  localStep: string | null; executionArn: string | null;
  startedAt: string | null; stoppedAt: string | null; checkedAt: string | null;
  unavailableReason: string | undefined;
}

export interface ControlPlaneArtifactsView {
  status: string | null; mediaSource: string | null; generationMode: string | null;
  scenePlanKey: string | null; narrationScriptKey: string | null;
  audioKey: string | null; sceneImageKeys: string[];
  videoKey: string | null; finalVideoKey: string | null; thumbnailKey: string | null;
  publishKey: string | null; youtubePackageKey: string | null;
  overlayPlanKey: string | null; motionPlanKey: string | null;
  downloadableVideoUrl: string | null; unavailableReason: string | undefined;
}

export interface ControlPlaneReviewView {
  status: string | null; reviewStatus: string | null;
  media: VideoReviewMedia | null;  // typed, not Record<string,unknown>
  createdAt: string | null; updatedAt: string | null;
  reviewedAt: string | null; notes: string | null;
}

export interface ControlPlaneFinalizationView {
  status: 'not_required' | 'pending' | 'complete' | 'failed' | null;
  attempted: boolean; ok: boolean; repaired: string[];
  missingFields: string[]; error: string | undefined; updatedAt: string | null;
}

export interface ControlPlanePublishView {
  status: string | null; dryRunStatus: string | null; uploadStatus: string | null;
  quotaStatus: string | null; videoId: string | null;
  url: string | null; downloadableVideoUrl: string | null;
}

export interface VideoOrchestratorControlPlane {
  jobId: string; channelId: string; prompt: string | null; title: string | null;
  phase: string; canonicalPhase: string; phaseStatus: string; progress: number | null;
  selectedJob: ControlPlaneSelectedJob;
  execution: ControlPlaneExecutionView;
  artifacts: ControlPlaneArtifactsView;
  review: ControlPlaneReviewView;
  finalization: ControlPlaneFinalizationView;
  publish: ControlPlanePublishView;
  allowedActions: Record<string, { enabled: boolean; reason: string | undefined }>;
  missingRequirements: ControlPlaneMissingRequirement[];
  warnings: string[]; errors: string[]; updatedAt: string;
}
```

**Critical logic fixes:**

1. **Fix reviewData extraction** (currently broken):
   ```ts
   // WRONG (current):
   const reviewData = (review?.ok ? (review as Record<string,any>) : null) ?? null;
   // RIGHT:
   const reviewData = review?.ok ? (review as VideoReviewResponse).review : null;
   ```

2. **Review.media repair** — fill from artifacts when stale:
   ```ts
   const reviewMediaFromReview = reviewData?.media ?? null;
   const reviewMedia: VideoReviewMedia | null = reviewMediaFromReview ?? (
     // Repair: if artifacts are complete but review.json is stale
     artifactsData?.videoKey ? {
       scenePlanKey: (artifactsData.scenePlanKey as string | null) ?? null,
       narrationScriptKey: (artifactsData.narrationScriptKey as string | null) ?? null,
       audioKey: (artifactsData.audioKey as string | null) ?? null,
       sceneImageKeys: Array.isArray(artifactsData.sceneImageKeys) ? artifactsData.sceneImageKeys as string[] : [],
       videoKey: (artifactsData.videoKey as string | null) ?? null,
       thumbnailKey: (artifactsData.thumbnailKey as string | null) ?? null,
       publishKey: (artifactsData.publishKey as string | null) ?? null,
       youtubePackageKey: (artifactsData.youtubePackageKey as string | null) ?? null,
       overlayPlanKey: (artifactsData.overlayPlanKey as string | null) ?? null,
     } : null
   );
   ```

3. **allowedActions as Record** — change `computeAllowedActions` to return `Record<string, { enabled, reason }>`, pass `reviewMedia` (repaired) instead of `artifacts`:
   ```ts
   function computeAllowedActions(
     job, reviewMedia, jobStatus, approvalStatus
   ): Record<string, { enabled: boolean; reason: string | undefined }> {
     const mediaComplete = !!(reviewMedia?.videoKey && reviewMedia?.thumbnailKey && 
       reviewMedia?.scenePlanKey && reviewMedia?.narrationScriptKey && reviewMedia?.audioKey);
     return {
       approve_script: { enabled: approvalStatus === 'pending', reason: ... },
       generate: { enabled: ..., reason: ... },
       approve_review: { enabled: reviewStatus !== 'approved' && mediaComplete, reason: ... },
       dry_run: { enabled: ..., reason: ... },
       publish_private: { enabled: ..., reason: ... },
       download_video: { enabled: !!(artifacts?.finalVideoKey || artifacts?.videoKey), reason: ... },
     };
   }
   ```

4. **missingRequirements** — check repaired `reviewMedia`, return `[]` when media is complete:
   ```ts
   const missingRequirements = computeMissingRequirements(reviewMedia);
   // Returns [] when reviewMedia has all required fields
   ```

5. **finalization** — pull from `artifactsData.finalization` when available, else derive:
   ```ts
   function computeFinalizationState(job, artifactsData, reviewMedia) {
     const finInfo = artifactsData?.finalization as Record<string,any> | null;
     // Use finInfo.attempted, finInfo.ok, finInfo.missing, finInfo.repaired when present
     // Status: 'complete' when mediaComplete, 'pending' when generating, else null
   }
   ```

### Step 2: Update `video-orchestrator-control-plane.test.ts`

Tests must assert:
- `allowedActions` is a Record with `approve_review.enabled === true` when media complete
- `allowedActions.approve_review` shape is `{ enabled: boolean, reason }` not an array item
- `artifacts.youtubePackageKey` and `artifacts.finalVideoKey` present when ready_to_publish
- `selectedJob.status` matches job status
- `phase` equals `canonicalPhase` (they alias)
- Stale review.json scenario: `artifacts` complete but `review.media` null → control-plane returns `review.media` filled from artifacts
- `missingRequirements` is `[]` when `review.media` is complete (not filled with 5 entries)
- `finalization.status === 'complete'` implies `review.media !== null`

Tests use `node:test` + `node:assert/strict`. No mocking needed — tests construct fixture data and call logic functions directly (not the async provider functions).

### Step 3: Update `braincore-schemas.ts`

Update the `VideoControlPlaneData` type export to match the new contract shape so the dashboard has proper TypeScript types.

### Step 4: Update `aws-video-dashboard.tsx`

The previous fix already accesses `allowedActions` as a record (`cpActionsRecord?.approve_review`). However the type cast used `as Record<string, { enabled: boolean; reason?: string }>` — the `controlPlaneData` shape also needs updating so `.allowedActions` is now typed correctly.

Minor: the dashboard casts `controlPlaneData as any`, so no structural changes needed in the UI component itself — the types will flow from the schema update. Verify the approve button logic still works.

### Step 5: Graphify contamination check

`routes.ts` line 80 imports `getGraphifyStatus` from `graphify-status.js`. Commit `90884b55` added "Graphify output validation summary" — this appears intentional (separate from the video fix). No revert needed unless a git diff shows it was mixed into the video control-plane commit `fedaf398`. Check: `git show fedaf398 -- src/api/routes.ts` — if graphify routes appear there, create a cleanup commit.

## Verification

```bash
# 1. Type check both projects
cd projects/brain-core && npm run typecheck
cd projects/brain-console-center && npm run build

# 2. Run control-plane tests
cd projects/brain-core && npm test -- --test-name-pattern "control-plane"

# 3. Validate butterfly job response
export JOB_ID="prochat-prompt-1780844790820-make-a-video-of-a-butterfly-"
curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" \
  | jq '.ok, .data.phase, .data.selectedJob.status, .data.finalization.status, .data.review.reviewStatus, .data.review.media.youtubePackageKey, .data.missingRequirements, .data.allowedActions.approve_review'
# Expected: true / "ready_to_publish" / "ready_to_publish" / "complete" / "pending" / "jobs/.../..." / [] / { enabled: true, ... }
```

## Commit scope

Only commit:
- `src/adapters/video-orchestrator-control-plane.ts`
- `src/tests/video-orchestrator-control-plane.test.ts`
- `../brain-console-center/lib/braincore-schemas.ts`
- `../brain-console-center/components/aws-video-dashboard.tsx` (if changed)

Do NOT commit `.next/`, runtime jobs, generated media, graphify files, or logs.
