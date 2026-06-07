# Plan: AWS Video Timeout-Safe Action Model

## Context

AWS Video UI has recurring timeout failures that surface as red error toasts even when the underlying operation succeeds:
- `POST create-from-prompt` times out after 10s (backend completes fast but UI shows red "Action failed")
- `GET /jobs/recent` hangs when S3 fallback is slow, blocking the whole poll cycle
- `createDraft` double-click can create duplicate jobs (no dedup)
- ReviewCard shows red "Cannot approve: missing fields" while finalization is still possible
- All polling errors (refresh-safe) surface as red fatal toasts

**Goal:** Separate terminal failures (red) from accepted/running operations (neutral) and make read endpoints return bounded-time partial data.

---

## Changes Required

### 1. Backend: `createJobFromPrompt` idempotency (video-orchestrator-provider.ts ~line 4702)

Add in-memory dedup map with 30s TTL. Key = `channelId:normalizedPrompt`. If same key hit within 30s, return existing job with `duplicateSuppressed: true`. Also accept optional `clientActionId` in the request shape.

```ts
// Add near top of file (module-level):
const _recentCreateRequests = new Map<string, { jobId: string; createdAt: number; result: CreateJobFromPromptResponse }>();
const CREATE_DEDUP_WINDOW_MS = 30_000;

// At start of createJobFromPrompt, before timestamp/dir creation:
const dedupeKey = `${input.channelId}:${input.prompt.trim().toLowerCase()}`;
const cached = _recentCreateRequests.get(dedupeKey);
if (cached && (Date.now() - cached.createdAt) < CREATE_DEDUP_WINDOW_MS) {
  return { ...cached.result, duplicateSuppressed: true };
}
// After successful creation: store in map
_recentCreateRequests.set(dedupeKey, { jobId, createdAt: Date.now(), result: successResponse });
// Prune stale entries periodically (simple: delete on miss only)
```

Add `clientActionId?: string` to `CreateJobFromPromptRequest`. Add `duplicateSuppressed?: true` to `CreateJobFromPromptResponse`.

### 2. Backend: `GET /jobs/recent` bounded response (routes.ts ~line 2252)

Wrap `getRecentVideoJobsResult()` in a 7s `Promise.race`. On timeout, return `{ ok: true, jobs: [], partial: true, warning: 'Recent jobs fetch timed out; retrying…' }` so frontend gets a fast 200 instead of a hanging request:

```ts
const RECENT_JOBS_HANDLER_TIMEOUT_MS = 7_000;
const result = await Promise.race([
  getRecentVideoJobsResult(),
  new Promise<RecentVideoJobsResult>((resolve) =>
    setTimeout(() => resolve({
      ok: true, jobs: [],
      diagnostics: { ...emptyDiagnostics, error: null, warnings: ['Recent jobs fetch timed out; partial data.'] }
    }), RECENT_JOBS_HANDLER_TIMEOUT_MS)
  ),
]);
```

Note: `resolve` not `reject` so the handler always returns 200 with partial data.

### 3. Backend: review finalization state signal (video-orchestrator-provider.ts, getVideoReview ~line 2988)

Extend the return to include `finalization.attempted` and `finalization.ok` so frontend can distinguish "finalization possible but incomplete" from "finalization not applicable":

```ts
// VideoReviewResponse type:
finalization?: {
  attempted: boolean;
  ok: boolean;
  missing: string[];
  repaired: string[];
};
```

In `getVideoReview`:
```ts
return finalized?.ok
  ? { ok: true, review, finalization: { attempted: true, ok: true, missing: finalized.missing, repaired: finalized.repaired } }
  : { ok: true, review, finalization: { attempted: Boolean(finalized), ok: false, missing: finalized?.missing ?? [], repaired: [] } };
```

### 4. Frontend: `createDraft` timeout → neutral (aws-video-dashboard.tsx)

Increase `createDraft` timeout to 15s and add `onError` handling that neutralizes timeout:

```ts
const createDraft = useMutation({
  mutationFn: () => postBrainCoreAction(
    '/api/video-orchestrator/jobs/create-from-prompt',
    videoActionResultSchema,
    { channelId, prompt, requestedBy: 'brain-console-center' },
    15_000 // increase from default 10s
  ),
  onSuccess: ..., // unchanged
  onError: (error) => {
    if (isTimeoutError(error)) {
      addActivity('Draft creation accepted or still running. Refreshing job list…');
      invalidateVideo();
      return; // suppress red toast
    }
    // real errors still surface
  },
});
```

### 5. Frontend: `jobs.isError` → amber status only, not red toast (aws-video-dashboard.tsx)

Currently `queryErrorMessage` includes the jobs polling error which feeds the red toast. Fix by separating polling errors from action errors:

**Before:** `const showErrorToast = Boolean(!quotaExceeded && visibleErrorMessage && visibleErrorMessage !== dismissedError);`

**Change:** Only derive `queryErrorMessage` from job/review queries that are not polling-safe. Add a `pollingWarningMessage` for the jobs list error:

```ts
// Don't include jobs.error in queryErrorMessage (it's refresh-safe polling):
const queryErrorMessage = status.error ? errorMessage(status.error) : null;

// Show amber warning badge on the jobs list header when jobs.isError:
// (already has a StatusBadge, keep using it, just don't feed into the red toast)
```

The `StatusBadge` with `status={jobs.isError ? 'error' : 'fresh'}` remains, but `jobs.error` is removed from the `queryErrorMessage` derivation that drives the red toast.

### 6. Frontend: ReviewCard `finalizationState` prop (aws-video-dashboard.tsx)

Add prop `finalizationState?: 'pending' | 'failed' | 'complete' | null` to `ReviewCard`. Derive it from the review response's `finalization` field:

```ts
// In the parent:
const finalizationState: 'pending' | 'failed' | 'complete' | null =
  selectedReview?.finalization == null ? null
  : selectedReview.finalization.ok ? 'complete'
  : selectedReview.finalization.attempted ? 'failed'
  : 'pending';
```

In `ReviewCard`, when `missingReviewMediaFields.length > 0`:
- `finalizationState === 'pending'` → show amber "Finalizing publish package…" (spinner, no Approve button blocked)
- `finalizationState === 'failed'` → show amber "Finalization incomplete: missing {list}" (no red, Approve disabled)
- `finalizationState === null` or `'complete'` → existing red error (finalization ran and still missing = real failure)

### 7. Frontend: `videoReviewSchema` update (braincore-schemas.ts)

Extend `videoReviewSchema` to accept the new `finalization` field:

```ts
export const videoReviewSchema = z.object({
  ok: z.boolean().optional(),
  review: z.object({ ... }), // unchanged
  finalization: z.object({
    attempted: z.boolean(),
    ok: z.boolean(),
    missing: z.array(z.string()),
    repaired: z.array(z.string()),
  }).optional(),
}).passthrough();
```

### 8. Tests (video-orchestrator-finalization.test.ts)

Add 3 focused tests:
1. **Dedup test:** Call `createJobFromPrompt` twice with same channelId+prompt within 1s; assert second returns `duplicateSuppressed: true` and same `jobId`.
2. **Review finalization signal:** Scaffold a generated-media job at ready_to_publish with stale null media; call `getVideoReview`; assert response includes `finalization.attempted: true` and review has media or `finalization.ok: false`.
3. **Already-approved dedup:** Call finalize on an approved job; assert `reviewStatus` stays `approved`.

---

## Critical Files

| File | Change |
|------|--------|
| `projects/brain-core/src/providers/video-orchestrator-provider.ts` | createJobFromPrompt dedup, VideoReviewResponse type extension |
| `projects/brain-core/src/api/routes.ts` | GET /jobs/recent timeout wrapper |
| `projects/brain-core/src/tests/video-orchestrator-finalization.test.ts` | New dedup + finalization state tests |
| `projects/brain-console-center/components/aws-video-dashboard.tsx` | createDraft timeout neutral, jobs.isError routing, ReviewCard props |
| `projects/brain-console-center/lib/braincore-schemas.ts` | videoReviewSchema finalization field |

---

## Reuse Notes

- `isTimeoutError()` already exists in aws-video-dashboard.tsx — use it in `createDraft.onError`
- `addActivity()` already exists — use for neutral messages
- `invalidateVideo()` already exists — use after timeout-treated-as-accepted
- `StatusBadge` component already exists — leave amber badge on jobs list header as-is
- `GENERATE_TIMEOUT_MS`, `approveReview` timeout already handled gracefully — match that pattern for createDraft
- `Promise.race` already used in routes.ts for review endpoint — reuse same pattern for /jobs/recent

---

## Verification

```bash
# Type checks
cd projects/brain-core && npm run typecheck
cd projects/brain-console-center && npm run typecheck

# Shell script syntax
bash -n tools/scripts/verify-aws-video-generation-mode.sh

# Focused tests
cd projects/brain-core && npx vitest run src/tests/video-orchestrator-finalization.test.ts

# Live smoke (if a ready_to_publish job exists)
curl -sS http://127.0.0.1:4877/api/video-orchestrator/jobs/<jobId>/review | jq '.ok,.review.reviewStatus,.review.media,.finalization'
# Should return: all media fields populated, finalization.ok: true (or attempted with explanation)
```

**Do not commit:** `.next/`, `tsbuildinfo`, `graphify-out/`, runtime job folders, ops-dashboard files.
