# Success Inbox Fallback Retirement — Batch 8X

**Date:** 2026-07-09
**Task:** Batch 8X — Retire capture/inbox fallback from active success intake
**Status:** ✅ COMPLETE — Legacy fallback removed, inbox/new is sole success intake

## Starting State

**Brain:**
- Latest commit: `547ab784 docs: record legacy capture inbox cleanup`
- Dirty status: Known unrelated/generated paths only

**Mind Reference:**
- Latest commit: `c2d418b docs: clean legacy capture inbox`
- capture/inbox folder count: 0 files (empty after Batch 8W)
- inbox/new folder count: 12 files (active)

## Rationale

After Batch 8W cleanup, `capture/inbox/` is now empty with all active content migrated to `inbox/new/`. The fallback logic that checked `capture/inbox` as a legacy-fallback if `inbox/new` was missing is no longer needed. Removing it:

1. Eliminates confusion about which folder is active
2. Prevents accidental reads from empty legacy folder
3. Makes the system fail cleanly if `inbox/new` is unavailable
4. Aligns code with the deployed reality (inbox/new only)

## Code Changes

### File: projects/brain-core/src/mind-paths.ts

**Change:** Removed capture/inbox from MIND_INBOX_NEW_CANDIDATES

**Before:**
```typescript
export const MIND_INBOX_NEW_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxNew,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first universal dump zone for new captures',
  },
  {
    path: MIND_LEGACY_PATHS.captureInbox,
    kind: 'directory',
    era: 'legacy-fallback',
    purpose: 'legacy Save-to-Mind unprocessed capture inbox',
  },
] as const;
```

**After:**
```typescript
export const MIND_INBOX_NEW_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxNew,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first universal dump zone for new captures',
  },
] as const;

// Historical note: capture/inbox was retired after Batch 8W cleanup (2026-07-09).
// Legacy path MIND_LEGACY_PATHS.captureInbox remains available for historical reference only.
// Do not re-add as fallback; all active content has been migrated to inbox/new.
```

**Impact:** Removes fallback check from path resolution; now only inbox/new is considered for active success intake.

### File: tools/scripts/mind-steward-inbox-dry-run-report.sh

**Change:** Updated resolve_inbox_source() and resolve_inbox_dir() to remove fallback logic

**Before:**
```bash
resolve_inbox_source() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf 'target'
  elif [[ -d "${mind_root}/capture/inbox" ]]; then
    printf 'legacy-fallback'
  else
    printf 'unavailable'
  fi
}

resolve_inbox_dir() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf '%s\n' "${mind_root}/inbox/new"
    return 0
  fi
  if [[ -d "${mind_root}/capture/inbox" ]]; then
    printf '%s\n' "${mind_root}/capture/inbox"
    return 0
  fi
  printf '%s\n' "${mind_root}/capture/inbox"
  return 0
}
```

**After:**
```bash
resolve_inbox_source() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf 'target'
  else
    printf 'unavailable'
  fi
}

resolve_inbox_dir() {
  local mind_root="$1"
  if [[ -d "${mind_root}/inbox/new" ]]; then
    printf '%s\n' "${mind_root}/inbox/new"
    return 0
  fi
  # No fallback to capture/inbox; retired after Batch 8W cleanup (2026-07-09)
  printf '%s\n' "unavailable"
  return 1
}
```

**Impact:** No fallback; returns unavailable instead of checking capture/inbox.

### File: tools/scripts/mind-compile-loop.sh

**Changes:**
1. Updated comment: "Reads capture/inbox/" → "Reads inbox/new/"
2. Updated resolve_inbox_dir() to remove fallback
3. Updated error message: "tried inbox/new and capture/inbox" → "expected inbox/new"

**Before:**
```bash
# Reads capture/inbox/, classifies each file...

resolve_inbox_dir() {
  local mind_dir="$1"
  if [[ -d "${mind_dir}/inbox/new" ]]; then
    printf '%s\n' "${mind_dir}/inbox/new"
    return 0
  fi
  if [[ -d "${mind_dir}/capture/inbox" ]]; then
    printf '%s\n' "${mind_dir}/capture/inbox"
    return 0
  fi
  printf '%s\n' "${mind_dir}/capture/inbox"
  return 0
}

if [[ ! -d "$INBOX_DIR" ]]; then
  echo "Inbox not found (tried inbox/new and capture/inbox): $MIND_DIR"
  exit 0
fi
```

**After:**
```bash
# Reads inbox/new/, classifies each file...

resolve_inbox_dir() {
  local mind_dir="$1"
  if [[ -d "${mind_dir}/inbox/new" ]]; then
    printf '%s\n' "${mind_dir}/inbox/new"
    return 0
  fi
  # No fallback to capture/inbox; retired after Batch 8W cleanup (2026-07-09)
  printf '%s\n' "unavailable"
  return 1
}

if [[ ! -d "$INBOX_DIR" ]] || [[ "$INBOX_DIR" == "unavailable" ]]; then
  echo "Inbox not found (expected inbox/new): $MIND_DIR"
  exit 0
fi
```

**Impact:** No fallback logic; clear error if inbox/new is missing.

## Behavior Changes

**Before (Batch 8P-8W):**
- If inbox/new exists, use it
- Else if capture/inbox exists, use it (fallback)
- Else default to capture/inbox (legacy default)

**After (Batch 8X):**
- If inbox/new exists, use it
- Else return unavailable (fail cleanly)
- No fallback to capture/inbox

## Path Resolution Order After Batch 8X

| Step | Action | Result |
|------|--------|--------|
| 1 | Check if inbox/new exists | If yes → use inbox/new; if no → proceed to step 2 |
| 2 | No fallback check | Return unavailable; fail cleanly |

**Final active success intake:** inbox/new only

## Failure Path Status

**Unchanged in this batch:**
- capture/failed remains active legacy failure path
- inbox/failed remains future target for failure routing
- No failure routing code changed
- MIND_FAILED_INBOX_CANDIDATES still includes both paths for future switch

## Validation

✅ Mind-paths.ts: MIND_INBOX_NEW_CANDIDATES has only inbox/new
✅ Shell scripts: No fallback logic; return unavailable if inbox/new missing
✅ Comments updated: capture/inbox references changed to historical notes
✅ Error messages updated: Clearer expectations (inbox/new only)
✅ Failure path constants: Unchanged (future work)
✅ Test expectations: Queue will only resolve inbox/new; missing inbox/new will fail
✅ No workflow JSON changed
✅ No roadmap or implementation plan files changed

## Explicit Statements

✓ capture/inbox is retired as active fallback
✓ capture/inbox remains as historical path constant (MIND_LEGACY_PATHS.captureInbox)
✓ capture/inbox is not included in active success intake resolution
✓ inbox/new is the sole active success intake path
✓ No fallback; missing inbox/new returns unavailable (fail-clean)
✓ capture/failed unchanged (failure routing is separate batch)
✓ inbox/failed unchanged (future target only)
✓ No Mind files moved/deleted/changed
✓ No n8n triggered, no webhook sent, no Dokploy env change

## References

- Mind Batch 8W: `c2d418b docs: clean legacy capture inbox`
- Brain Batch 8P: Switched routing to inbox/new
- Brain Batch 8T: Documented dual-path (now retired)
- Brain Batch 8U: Clarified no permanent dual system
- Brain Batch 8V: Inventoried cleanup
- Brain Batch 8W: Recorded cleanup execution
