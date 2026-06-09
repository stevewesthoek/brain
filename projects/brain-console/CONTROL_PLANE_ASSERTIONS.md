# AWS Video Control-Plane Refactor: Validation Assertions

This document describes the required behavior and assertions for the control-plane refactor in `aws-video-dashboard.tsx`.

## Refactor Requirements

### 1. ReviewCard: Use Control-Plane Media When Available

**Requirement:**
- ReviewCard accepts `controlPlaneData` as a prop
- When `controlPlaneData.review.media` exists, use it directly (do NOT reconstruct from `reviewData` + `artifactData`)
- When control-plane media is unavailable, fall back to legacy reconstruction

**Assertion in Code:**
```typescript
const controlPlaneReviewMedia = controlPlaneData ? asRecord(asRecord(controlPlaneData).review)?.media : null;
const usingControlPlaneMedia = Boolean(controlPlaneReviewMedia);
const reviewMedia = (usingControlPlaneMedia && controlPlaneReviewMedia ? controlPlaneReviewMedia : reviewRecord?.media ?? artifactReviewMedia) ?? null;
```

**Dev Mode Check:**
Logs `[AwsVideo] ✓ ReviewCard using control-plane media (not legacy review.data)` when conditions are met.

---

### 2. Execution & Artifacts Panels: Never Show Empty Objects

**Requirement:**
- Execution panel renders `controlPlaneData.execution` (structured state, not legacy query)
- Artifacts panel renders `controlPlaneData.artifacts` (structured state, not legacy query)
- If status is null/unavailable, show `unavailableReason` or "pending"
- Never render `{}`  for a selected job

**Implementation:**
```typescript
{controlPlaneData ? (
  <div className="aws-facts">
    <div><span>Status</span><strong>{controlPlaneData.execution?.status ?? 'pending'}</strong></div>
    {controlPlaneData.execution?.unavailableReason ? (
      <div><span>Reason</span><strong>{controlPlaneData.execution.unavailableReason}</strong></div>
    ) : null}
  </div>
) : (
  <p>Execution pending</p>
)}
```

**Dev Mode Check:**
Logs `[AwsVideo] ✓ Execution shows unavailableReason (structured, not empty {})` when unavailableReason is present.

---

### 3. Finalization Pending: Show Amber, Not Red

**Requirement:**
- When `controlPlaneData.finalization.status === 'pending'`, ReviewCard shows amber warning ("Finalizing publish package…")
- Does NOT show red error ("Cannot approve: Missing fields")
- User can still save review notes but cannot approve until finalization completes

**Implementation:**
ReviewCard logic checks `finalizationState === 'pending'` before rendering the red error block.

**Dev Mode Check:**
Logs `[AwsVideo] ✓ Finalization pending state detected` when finalization is pending.

---

### 4. Approve Review Button: Enabled from Control-Plane

**Requirement:**
- When `controlPlaneData.allowedActions` is available, the approve_review button is enabled/disabled based on `controlPlaneData.allowedActions.find(a => a.action === 'approve_review').enabled`
- Fallback to legacy local rules when control-plane data is unavailable

**Implementation:**
```typescript
const approveReviewAction = cpActions.find((a: any) => a.action === 'approve_review');
const shouldHighlight = approveReviewAction?.enabled && isRecommended;
<button
  disabled={!jobId || approvePending || !approveReviewAction?.enabled}
  ...
>
```

**Dev Mode Check:**
Logs `[AwsVideo] ✓ approve_review action enabled=true|false (from control-plane)` when the button is rendered.

---

### 5. Old Endpoints: Debug Panels Only

**Requirement:**
- `/api/video-orchestrator/jobs/{id}/execution` endpoint remains but data NOT used by ReviewCard, main panels, or action gating
- `/api/video-orchestrator/jobs/{id}/artifacts` endpoint remains but data NOT used by ReviewCard, main panels, or action gating
- `/api/video-orchestrator/jobs/{id}/review` endpoint remains but media NOT used when control-plane is available
- Old fragment data is available in `<details>` collapsible debug sections only

**Implementation:**
```typescript
{/* DEBUG: Old fragments kept for inspection only */}
<details>
  <summary>Debug: legacy execution data</summary>
  <pre>{JSON.stringify(execution.data?.data ?? {}, null, 2).slice(0, 1600)}</pre>
</details>
```

---

## Testing Checklist

When validating the refactor:

1. **Control-Plane Data Available:**
   - [ ] Open a job with generated assets
   - [ ] Verify browser console shows `[AwsVideo] ✓` assertions
   - [ ] ReviewCard shows review media (no "missing" fields)
   - [ ] Execution/Artifacts panels show structured state, not `{}`
   - [ ] Approve review button enables/disables per control-plane

2. **Finalization Pending:**
   - [ ] Trigger a job approval that requires finalization
   - [ ] Verify amber warning "Finalizing publish package…"
   - [ ] Verify NO red error "Cannot approve: Missing fields"

3. **Old Fragments Don't Drive UI:**
   - [ ] Edit `/execution` endpoint response to return intentionally wrong status
   - [ ] Dashboard behavior unchanged (only debug panel affected)
   - [ ] Edit `/review` endpoint to return intentionally wrong media
   - [ ] Dashboard behavior unchanged (only debug panel affected)

4. **Typecheck & Build:**
   - [ ] `npm run typecheck` in both brain-console and brain-core passes
   - [ ] No TypeScript errors related to control-plane data access

---

## Future Work

- Consider removing old fragment endpoints entirely once control-plane is proven stable in production (phase 2)
- Migrate workflow step logic to use `controlPlaneData.canonicalPhase` (phase 2)
- Add schema validation tests for control-plane responses (phase 2)
