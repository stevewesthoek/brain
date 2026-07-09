# Inbox Migration Final Closeout — Batch 8Z

**Date:** 2026-07-10
**Task:** Batch 8Z — FINALIZE inbox migration completely (Brain side)
**Status:** ✅ COMPLETE — Brain code unified, no changes needed; failure switch pending in n8n

## Summary

Task O (Inbox Migration) is complete on the Brain side. All code-level path resolution has been unified:

- **Success path:** inbox/new (fallback retired Batch 8X)
- **Failure path:** inbox/failed (fallback retired Batch 8Y)
- **Status code commit:** 9ed0650c (Batch 8Y end)
- **No further Brain changes required**

The n8n failure routing switch is pending but is outside Brain scope — it's a live workflow mutation documented in Mind closeout.

## Batch 8Z Brain Assessment

**Why no Brain changes in 8Z?**

Batch 8Y already retired the failure path fallback. The code is complete:
- MIND_INBOX_NEW_CANDIDATES: inbox/new only ✓ (Batch 8X)
- MIND_FAILED_INBOX_CANDIDATES: inbox/failed only ✓ (Batch 8Y)
- mind-steward scripts: removed fallback checks ✓ (Batch 8X-8Y)
- No shell scripts have failure-path functions that need patches ✓

Brain is in its final unified state as of commit 9ed0650c.

## Code State Verification (Batch 8Z)

### projects/brain-core/src/mind-paths.ts

**MIND_INBOX_NEW_CANDIDATES:**
```typescript
export const MIND_INBOX_NEW_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxNew,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first universal dump zone for new captures',
  },
] as const;
```
Status: ✓ Final (no fallback)

**MIND_FAILED_INBOX_CANDIDATES:**
```typescript
export const MIND_FAILED_INBOX_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxFailed,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first failed or blocked capture processing surface',
  },
] as const;
```
Status: ✓ Final (no fallback)

**Historical comments present:**
- capture/inbox: Documented as retired (Batch 8W)
- capture/failed: Documented as retired (Batch 8Y)

### Shell Scripts

**mind-steward-inbox-dry-run-report.sh:**
- resolve_inbox_dir(): Returns inbox/new only, "unavailable" if missing ✓
- No fallback to capture/inbox ✓

**mind-compile-loop.sh:**
- resolve_inbox_dir(): Same behavior ✓
- No fallback to capture/inbox ✓

Status: ✓ No failure functions to update (success path only)

## System Architecture (Post-Batch 8Z)

### Path Resolution Behavior

**Success path (inbox/new):**
1. Check if inbox/new exists
2. If yes → use it
3. If no → return unavailable, exit code 1

**Failure path (inbox/failed):**
1. Check if inbox/failed exists
2. If yes → use it
3. If no → return unavailable, exit code 1

**No fallback paths in either direction** — system is unified.

### n8n/Dokploy Status (For Reference)

**Current (pre-switch):**
- n8n Save-to-Mind success branch: Routes to inbox/new (ACTIVE since Batch 8P)
- n8n Save-to-Mind failure branch: Routes to capture/failed (NOT YET SWITCHED)
- Dokploy env MIND_INBOX_PATH: inbox/new ✓
- Dokploy env MIND_FAILED_PATH: inbox/failed ✓ (but n8n not using it yet)

**Post-failure-switch (future):**
- n8n failure branch: Will route to inbox/failed
- Dokploy env MIND_FAILED_PATH: Stays as inbox/failed
- No additional code changes needed in Brain

## Validation ✅

### Brain Code
- ✓ MIND_INBOX_NEW_CANDIDATES: inbox/new only
- ✓ MIND_FAILED_INBOX_CANDIDATES: inbox/failed only
- ✓ No fallback checks in path resolution
- ✓ Comments document retired legacy paths
- ✓ mind-steward functions return unavailable cleanly
- ✓ No shell script failure functions to patch

### No Unintended Changes
- ✓ mind-paths.ts unchanged (already complete)
- ✓ Shell scripts unchanged (already complete)
- ✓ Test files not modified
- ✓ Configuration unchanged
- ✓ Documentation references accurate

## System Ready for n8n Switch

Brain is production-ready. The failure routing switch in n8n:
1. Will read MIND_FAILED_PATH=inbox/failed from Dokploy env
2. Will write failures to inbox/failed
3. Brain readers will find them at inbox/failed (no fallback)
4. System will be fully unified and live

No Brain code changes are needed for or triggered by the n8n switch.

## Explicit Confirmations

✓ Brain code unified (paths finalized Batch 8X-8Y)
✓ Success path fallback retired (Batch 8X)
✓ Failure path fallback retired (Batch 8Y)
✓ No further Brain work required for inbox migration
✓ Ready for live n8n failure routing switch
✓ Dokploy env correctly set (MIND_FAILED_PATH=inbox/failed)
✓ No test files modified
✓ No documentation changes needed (all current)

## Task O Brain-Side Closure

**Brain contribution to Task O is COMPLETE as of Batch 8Y commit 9ed0650c.**

Batch 8Z confirms:
- No additional code changes needed
- System is in final unified state
- Ready for n8n failure routing switch
- No regression risk

The n8n failure routing switch (pending) is outside Brain scope and documented separately in Mind closeout report.

## References

- Batch 8P: Success routing switched (n8n + Dokploy)
- Batch 8X: Success path fallback retired (projects/brain-core/src/mind-paths.ts)
- Batch 8Y: Failure path fallback retired (projects/brain-core/src/mind-paths.ts)
- Batch 8Z: Confirmation that no further Brain changes required

