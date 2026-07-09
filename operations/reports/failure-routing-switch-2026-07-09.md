# Failure Routing Switch — Batch 8Y

**Date:** 2026-07-09
**Task:** Batch 8Y — Retire failure-path fallback from Brain code
**Status:** ✅ COMPLETE — Legacy failure fallback removed, inbox/failed is sole failure target

## Starting State

**Brain:**
- Latest commit: `9c4f44ad refactor: retire legacy success inbox fallback`
- Dirty status: Known unrelated/generated paths only

**Mind Reference:**
- Latest commit: `b2fb445 docs: finalize success inbox single system`
- capture/failed folder count: 3 files (historical verification tests)
- inbox/failed folder count: 1 file (README.md only, scaffolding)

## Code Changes

### File: projects/brain-core/src/mind-paths.ts

**Change:** Removed capture/failed from MIND_FAILED_INBOX_CANDIDATES

**Before:**
```typescript
export const MIND_FAILED_INBOX_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxFailed,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first failed or blocked capture processing surface',
  },
  {
    path: MIND_LEGACY_PATHS.captureFailed,
    kind: 'directory',
    era: 'legacy-fallback',
    purpose: 'legacy failed capture routing target',
  },
] as const;
```

**After:**
```typescript
export const MIND_FAILED_INBOX_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxFailed,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first failed or blocked capture processing surface',
  },
] as const;

// Historical note: capture/failed was retired after Batch 8Y cleanup (2026-07-09).
// Legacy path MIND_LEGACY_PATHS.captureFailed remains available for historical reference only.
// Do not re-add as fallback; failure routing will migrate to inbox/failed in future batch.
```

**Impact:** Removes fallback check from failure path resolution; now only inbox/failed is considered for active failure intake.

## Behavior Changes

**Before (Batch 8P-8X):**
- If inbox/failed exists, use it
- Else if capture/failed exists, use it (fallback)
- Else return unavailable

**After (Batch 8Y):**
- If inbox/failed exists, use it
- Else return unavailable (fail cleanly)
- No fallback to capture/failed

## Path Resolution Order After Batch 8Y

| Step | Action | Result |
|------|--------|--------|
| 1 | Check if inbox/failed exists | If yes → use inbox/failed; if no → proceed to step 2 |
| 2 | No fallback check | Return unavailable; fail cleanly |

**Final active failure intake:** inbox/failed only

## Success Path Status

**Unchanged in this batch:**
- Success path: inbox/new only (no fallback, retired in Batch 8X)
- No changes to MIND_INBOX_NEW_CANDIDATES
- No changes to success intake functions

## Validation

✅ Mind-paths.ts: MIND_FAILED_INBOX_CANDIDATES has only inbox/failed
✅ No shell script failure functions exist to patch
✅ Comments updated: capture/failed references changed to historical notes
✅ Success path constants: Unchanged (already retired in Batch 8X)
✅ No workflow JSON changed
✅ No roadmap or implementation plan files changed

## Explicit Statements

✓ capture/failed is retired as active fallback
✓ capture/failed remains as historical path constant (MIND_LEGACY_PATHS.captureFailed)
✓ capture/failed is not included in active failure intake resolution
✓ inbox/failed is the sole active failure intake path target
✓ No fallback; missing inbox/failed returns unavailable (fail-clean)
✓ Success path unchanged (already retired inbox/new in Batch 8X)
✓ No Mind files moved/deleted/changed
✓ No n8n triggered, no webhook sent, no Dokploy env change
✓ Failure routing not yet switched in n8n (requires separate batch)

## Next: n8n Failure Routing Switch

**Status:** Not executed in this batch.

The code-side fallback is now retired. The actual n8n failure routing switch (from capture/failed to inbox/failed) is a separate execution batch that requires:

1. Update n8n Save-to-Mind workflow: change failure capture target from capture/failed to inbox/failed
2. Test failure workflow with safe test payload
3. Verify failures now land in inbox/failed, not capture/failed
4. Migrate existing capture/failed content (3 files) per inventory decision
5. Document execution results

**Recommendation:** Execute in separate batch (Batch 8Z or later) after team confirms system is stable.

## References

- Brain Batch 8X: `9c4f44ad refactor: retire legacy success inbox fallback` (success path)
- Mind Batch 8W: Cleaned success intake (capture/inbox → inbox/new)
- Save-to-Mind Routing: Batch 8P switched success to inbox/new (still active)
