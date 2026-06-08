# Plan: Fix Jobs UX and Data Behavior

## Context
The Jobs panel in `aws-video-dashboard.tsx` has several compounding problems:
1. `/api/video-orchestrator/jobs/recent` always returns 20 jobs (default limit), but the backend already hydrates 100. The frontend only searches over those 20.
2. The search box only filters the 20 locally loaded jobs — "box" never finds a job created 21st+ in the list.
3. The direct job ID input is a broken hybrid: `value={directJobIdError ? '' : ''}` pins it to `''` forever, and the Go button reads the DOM via `document.querySelector` instead of React state.
4. The first search box can't be used to open a job by pasting its full ID — the user naturally types "box" expecting to find the box job, but it's not in the 20 fetched.

## Changes

### 1. Backend — `brain-core/src/providers/video-orchestrator-provider.ts`

Change the default `limit` from 20 to 100:

```ts
// Line 1057 — change signature:
export async function getRecentVideoJobsResult(limit: number = 100, q?: string): Promise<RecentVideoJobsResult>
```

After the hydration sort (before `.slice(0, limit)`), add a client-side filter when `q` is provided:

```ts
// After: const sortedJobs = [...jobs].sort(...);
// Add before the .slice():
const filteredJobs = q
  ? sortedJobs.filter((job) => {
      const term = q.toLowerCase();
      return (job.jobId ?? '').toLowerCase().includes(term)
        || (job.title ?? '').toLowerCase().includes(term)
        || (job.channelId ?? '').toLowerCase().includes(term)
        || (job.status ?? '').toLowerCase().includes(term);
    })
  : sortedJobs;
const jobs = filteredJobs.slice(0, limit);
```

(The exact line where `.slice(0, limit)` is called is around line 1109. Adapt the local variable name used there.)

### 2. Backend — `brain-core/src/api/routes.ts`

In the `/api/video-orchestrator/jobs/recent` handler (line 2274), read query params before calling the provider:

```ts
const limitParam = url.searchParams.get('limit');
const parsedLimit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10))) : 100;
const q = url.searchParams.get('q') ?? undefined;
```

Pass them to `getRecentVideoJobsResult(parsedLimit, q)` in both the race winner and the timeout fallback.

**Cache strategy**: Only save to `lastGoodRecentVideoJobsResult` when no `q` filter was applied (so the full unfiltered job list is cached for timeout recovery). When `q` is present, apply the filter to the cached result on timeout.

```ts
// Apply q-filter to cached result when returning from timeout:
if (q && lastGoodRecentVideoJobsResult) {
  const filtered = { ...lastGoodRecentVideoJobsResult, jobs: lastGoodRecentVideoJobsResult.jobs.filter(...) };
  resolve(withRecentJobsTimeoutWarning(filtered, timeoutWarning));
} else {
  resolve(lastGoodRecentVideoJobsResult ? withRecentJobsTimeoutWarning(lastGoodRecentVideoJobsResult, timeoutWarning) : /* empty fallback */);
}
```

And only update the cache when no `q` was used:
```ts
if (result.ok && result.jobs.length > 0 && !q) {
  lastGoodRecentVideoJobsResult = result;
}
```

### 3. Frontend — `brain-console-center/components/aws-video-dashboard.tsx`

#### A. Add `directJobIdValue` state (near line 875)

```ts
const [directJobIdValue, setDirectJobIdValue] = useState('');
```

#### B. Fix `openDirectJobId` to clear `directJobIdValue` on success

In the `onSuccess` path (after `setSelectedJobId`), add:
```ts
setDirectJobIdValue('');
```

#### C. Fix the `jobs` query to request 100 jobs (line 916)

```ts
queryFn: () => brainCoreRequest('/api/video-orchestrator/jobs/recent?limit=100', recentVideoJobsSchema),
```

#### D. Fix the direct job ID input (lines 1767-1791)

Replace the broken input and Go button:

```tsx
<input
  className="input"
  placeholder="Or paste a job ID to open directly"
  value={directJobIdValue}
  onChange={(e) => { setDirectJobIdValue(e.target.value); setDirectJobIdError(null); }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && directJobIdValue.trim()) {
      openDirectJobId(directJobIdValue.trim());
    }
  }}
/>
<button
  className="button secondary"
  disabled={!directJobIdValue.trim()}
  onClick={() => { if (directJobIdValue.trim()) openDirectJobId(directJobIdValue.trim()); }}
>
  Go
</button>
```

#### E. Add "Open this job ID" affordance in the job list (lines 1806-1808)

When `jobSearchQuery` is non-empty, `filteredJobList` is empty, and the query is at least 10 chars (looks like a real job ID or meaningful substring):

```tsx
{jobList.length > 0 && filteredJobList.length === 0 ? (
  <div className="stack" style={{ padding: '0.75rem' }}>
    <p>No jobs match the search filter.</p>
    {jobSearchQuery.trim().length >= 10 ? (
      <button
        className="button secondary"
        onClick={() => openDirectJobId(jobSearchQuery.trim())}
      >
        Open "{jobSearchQuery.trim().slice(0, 48)}" as job ID
      </button>
    ) : null}
  </div>
) : null}
```

## Files to modify

- `brain-core/src/providers/video-orchestrator-provider.ts` (~line 1057)
- `brain-core/src/api/routes.ts` (~line 2274)
- `brain-console-center/components/aws-video-dashboard.tsx` (lines 875, 914-920, 1006-1026, 1760-1808)

## Verification

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core && npm run typecheck
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-center && npm run typecheck
```

Manual acceptance:
- Restart with `tools/scripts/brain-console-center-dev-reset.sh hybrid_image_slideshow`
- Open `/aws-video` → Jobs
- Type "box" → box job appears
- Paste full job ID into second input → Go button or Enter opens it
- No re-render clears the typed text in the direct-open input
