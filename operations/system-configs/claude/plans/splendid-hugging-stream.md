# Plan: Harden AWS Video Timeout-Safe UI State

## Context

The previous implementation added `pendingActionByJobId` / `createDraftTimedOut` timeout monitor state but stored it only in React memory. A page refresh loses all pending state, dropping the overlay and re-enabling buttons while the backend job is still running. Additionally, the create-draft recovery heuristic ("first new job not in preTimeoutJobIds") is fragile — it can select the wrong job if multiple drafts arrive simultaneously.

This plan adds:
1. `sessionStorage` persistence for all timeout monitor state (survives tab refresh within the same browser session)
2. Deterministic create-draft recovery via `clientActionId` — written to `topic.json` by the backend and exposed in the recent-jobs response
3. Fallback-locked overlay (no arbitrary job selection) when `clientActionId` hasn't appeared in the list yet

---

## Files to Modify

| File | Change |
|------|--------|
| `projects/brain-core/src/providers/video-orchestrator-provider.ts` | Write `clientActionId` to `topic.json`; surface it in `VideoJobSummary` |
| `projects/brain-console-center/lib/braincore-schemas.ts` | Add `clientActionId` to `videoJobSchema` |
| `projects/brain-console-center/components/aws-video-dashboard.tsx` | sessionStorage rehydration, improved recovery, write/clear effect |

---

## Implementation

### 1. brain-core: persist `clientActionId` in `topic.json`

**File:** `projects/brain-core/src/providers/video-orchestrator-provider.ts`

**A. `topicMetadata` write (line 4858):** append `clientActionId` conditionally:

```typescript
const topicMetadata = {
  jobId,
  channelId: input.channelId,
  topicId,
  title: input.prompt.slice(0, 80),
  description: input.prompt,
  source: 'interactive-prompt',
  createdAt: now_iso,
  ...(input.clientActionId ? { clientActionId: input.clientActionId } : {}),
};
```

**B. `VideoJobSummary` interface (line 3264, after `audioSourceKey`) — add one optional field:**

```typescript
clientActionId?: string | null;
```

**C. `buildVideoJobSummary` return value (line 935, after `audioSourceKey:`) — read from `topic`:**

The `topic` variable is typed as `unknown` (line 870). Cast it:
```typescript
const topicData = topic as Record<string, unknown> | null;
```
(Add this near line 882 alongside `pubData`, `assetsData` etc.)

Then in the return object (after `audioSourceKey:`):
```typescript
clientActionId: (topicData?.clientActionId as string) || null,
```

---

### 2. brain-console-center: add `clientActionId` to job schema

**File:** `projects/brain-console-center/lib/braincore-schemas.ts`

In `videoJobSchema` (line ~266), add:

```typescript
clientActionId: z.string().optional().nullable(),
```

`VideoJob` type is derived via `z.infer<typeof videoJobSchema>`, so it updates automatically. No other type changes needed.

---

### 3. brain-console-center: sessionStorage persistence + improved recovery

**File:** `projects/brain-console-center/components/aws-video-dashboard.tsx`

#### A. Add `TimeoutMonitorSnapshot` interface and `readTimeoutMonitor()` helper (before `AwsVideoDashboard`)

```typescript
interface TimeoutMonitorSnapshot {
  pendingActionByJobId: Record<string, PendingAction>;
  createDraftTimedOut: boolean;
  currentCreateActionId: string | null;
  preTimeoutJobIds: string[];
  selectedJobId: string | null;
}

const TIMEOUT_MONITOR_KEY = 'aws-video-timeout-monitor';

function readTimeoutMonitor(): TimeoutMonitorSnapshot {
  try {
    const raw = sessionStorage.getItem(TIMEOUT_MONITOR_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TimeoutMonitorSnapshot>;
      return {
        pendingActionByJobId: p.pendingActionByJobId ?? {},
        createDraftTimedOut: p.createDraftTimedOut ?? false,
        currentCreateActionId: p.currentCreateActionId ?? null,
        preTimeoutJobIds: p.preTimeoutJobIds ?? [],
        selectedJobId: p.selectedJobId ?? null,
      };
    }
  } catch { /* ignore parse/storage errors */ }
  return { pendingActionByJobId: {}, createDraftTimedOut: false, currentCreateActionId: null, preTimeoutJobIds: [], selectedJobId: null };
}
```

#### B. Update `useState` initializers for timeout monitor state (lines ~867–879)

Replace the 5 relevant `useState` calls with lazy initializers:

```typescript
// Was: useState<string | null>(null)
const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
  const m = readTimeoutMonitor();
  const hasActive = m.createDraftTimedOut || Object.keys(m.pendingActionByJobId).length > 0;
  return hasActive ? m.selectedJobId : null;
});

// Was: useState<string | null>(null)
const [currentCreateActionId, setCurrentCreateActionId] = useState<string | null>(
  () => readTimeoutMonitor().currentCreateActionId
);

// Was: useState<Record<string, PendingAction>>({})
const [pendingActionByJobId, setPendingActionByJobId] = useState<Record<string, PendingAction>>(
  () => readTimeoutMonitor().pendingActionByJobId
);

// Was: useState(false)
const [createDraftTimedOut, setCreateDraftTimedOut] = useState<boolean>(
  () => readTimeoutMonitor().createDraftTimedOut
);

// Was: useState<string[]>([])
const [preTimeoutJobIds, setPreTimeoutJobIds] = useState<string[]>(
  () => readTimeoutMonitor().preTimeoutJobIds
);
```

**Note:** `readTimeoutMonitor()` is called 5 times (once per lazy initializer). Each runs synchronously during mount — one `JSON.parse` of sessionStorage per call, cheap and correct.

#### C. Add a `useEffect` to write/clear sessionStorage (add after the existing "clear error toast" effect)

```typescript
useEffect(() => {
  const hasActive = createDraftTimedOut || Object.keys(pendingActionByJobId).length > 0;
  try {
    if (hasActive) {
      const snapshot: TimeoutMonitorSnapshot = {
        pendingActionByJobId,
        createDraftTimedOut,
        currentCreateActionId,
        preTimeoutJobIds,
        selectedJobId,
      };
      sessionStorage.setItem(TIMEOUT_MONITOR_KEY, JSON.stringify(snapshot));
    } else {
      sessionStorage.removeItem(TIMEOUT_MONITOR_KEY);
    }
  } catch { /* storage quota or private-mode errors: ignore */ }
}, [pendingActionByJobId, createDraftTimedOut, currentCreateActionId, preTimeoutJobIds, selectedJobId]);
```

#### D. Update the create-draft poll `useEffect` to use `clientActionId` matching first

Replace the existing create_draft poll useEffect (near line 1318):

```typescript
useEffect(() => {
  if (!createDraftTimedOut || createDraft.isPending) return;

  // Primary: deterministic match by clientActionId (post-backend-change jobs have this)
  if (currentCreateActionId) {
    const matched = jobList.find(j => j.clientActionId === currentCreateActionId);
    if (matched) {
      setSelectedJobId(matched.jobId);
      setCreateDraftTimedOut(false);
      setCurrentCreateActionId(null);
      addActivity(`Draft created: ${matched.jobId}`);
      setActiveView('overview');
    }
    // clientActionId known but not yet visible in list — keep overlay locked
    return;
  }

  // Fallback: first new job not in preTimeoutJobIds (jobs predating the backend change)
  const newJob = jobList.find(j => !preTimeoutJobIds.includes(j.jobId));
  if (newJob) {
    setSelectedJobId(newJob.jobId);
    setCreateDraftTimedOut(false);
    setCurrentCreateActionId(null);
    addActivity(`Draft created: ${newJob.jobId}`);
    setActiveView('overview');
  }
}, [createDraftTimedOut, jobList, preTimeoutJobIds, createDraft.isPending, currentCreateActionId]);
```

**Logic:**
- When `currentCreateActionId` is set (post-backend-change): only matches deterministically. If not found yet, the overlay stays locked and this returns without selecting anything.
- When `currentCreateActionId` is null (pre-change fallback): uses the original heuristic.
- `j.clientActionId` works without a cast once `braincore-schemas.ts` is updated — `VideoJob` is `z.infer<typeof videoJobSchema>` so adding the field to the schema automatically adds it to the type.

---

## Verification

1. **brain-core typecheck:**
   ```bash
   cd projects/brain-core && npx tsc --noEmit
   ```

2. **brain-console-center typecheck:**
   ```bash
   cd projects/brain-console-center && npx tsc --noEmit
   ```

3. **Manual flow — create-draft timeout recovery:**
   - Submit a draft, hard-refresh tab during the "Still creating draft…" overlay
   - Verify overlay re-appears after refresh
   - Verify it clears and selects the correct job when polling finds the new job
   - Verify it matches by clientActionId (check Network tab that brain-core returns clientActionId in the job list)

4. **Manual flow — generate timeout recovery:**
   - Trigger a generate timeout, refresh the page
   - Verify the job is re-selected and the "Still processing in Brain Core" overlay re-appears
   - Verify the overlay clears when polling sees `ready_to_publish` or `failed`

5. **Manual flow — normal operation unchanged:**
   - Complete a normal (non-timeout) flow end-to-end
   - Verify no sessionStorage entry is written for non-timeout operations
   - Verify red toasts still show for real (non-timeout) failures

## Commit scope

- `projects/brain-core/src/providers/video-orchestrator-provider.ts`
- `projects/brain-console-center/lib/braincore-schemas.ts`
- `projects/brain-console-center/components/aws-video-dashboard.tsx`
