# Old Inbox Cleanup Readiness — Batch 8U

**Date:** 2026-07-09
**Task:** Batch 8U — Brain reader report correction and old-inbox cleanup gate
**Status:** ✅ COMPLETE — Policy clarified, cleanup direction documented

## Starting State

**Brain:**
- Latest commit: `5cde80da docs: validate Brain inbox dual-path support`
- Dirty status: Known unrelated/generated paths only

**Mind (read-only reference):**
- Latest commit: `75b359e docs: correct Save-to-Mind routing counts`
- Dirty status: M wiki/log.md, ?? Untitled.canvas, ?? wiki/organisations/prochat/pitch-decks/

## Current Local Mind Folder Counts

| Folder | Count | Status | Notes |
|--------|-------|--------|-------|
| capture/inbox | 28 | Historical + test captures | 19 original + 9 test from Batch 8G/8P |
| inbox/new | 3 | Active target system | README.md + 2 test captures |
| capture/failed | 3 | Historical | Not yet switched |
| inbox/failed | 1 | Scaffolding | Not yet active |

## Policy Clarification

### The Operator Decision

- **Single target system:** inbox/new/
- **Legacy residue:** capture/inbox/ is old-system state, not permanent dual architecture
- **Temporary compatibility only:** Dual-path support exists as a safety net during migration, not as final operating model
- **Historical content handling:** Controlled cleanup batch required before old capture/inbox path can be decommissioned

### What "Dual-Path Support" Actually Means

Brain readers use **first-existing** path resolution:

1. Check if `inbox/new/` exists → use it exclusively
2. Only check `capture/inbox/` if `inbox/new/` is absent → use it as fallback
3. Do NOT simultaneously consume both paths when both exist

This is a **compatibility fallback**, not a permanent simultaneous-read architecture.

## Verified Active Routing

**Save-to-Mind webhook (Batch 8P):**
- Posts to `POST /webhook/mind-inbox`
- n8n workflow hardcoded to write to `inbox/new/`
- New captures land in `inbox/new/` only
- `capture/inbox/` receives NO new saves as of 2026-07-09

**Brain reader behavior (Batch 8T):**
- Queue resolution in mind-steward-inbox-queue.ts line 257-269: first-existing, returns after first match
- Shell scripts (mind-steward-inbox-dry-run-report.sh): prefer inbox/new, fall back to capture/inbox
- When both paths exist: inbox/new is selected exclusively, capture/inbox ignored

**Failure routing:**
- Not yet switched (Batch 8P focused on success path only)
- Remains in legacy capture/failed path
- Future batch will switch to inbox/failed separately

## Cleanup Goal

Remove the legacy `capture/inbox/` path from active operating systems by explicitly handling the historical content.

**End state after cleanup:**
- `capture/inbox/` contains NO active inbox items
- Historical content either migrated to `inbox/new/`, archived to `history/`, or explicitly removed
- Brain readers no longer need fallback logic for capture/inbox
- Single active system: `inbox/new/` only

## Candidate Cleanup Options

Each of the 19 original `capture/inbox/` files should be classified as:

### Option A: Move to inbox/new/

**Files that are still unprocessed inbox items** should be moved to `inbox/new/` to consolidate into the active system.

Decision criteria:
- File status indicates "pending" or "new" in frontmatter
- File has no "processed", "compiled", or "archived" marker
- Content is still actively relevant

### Option B: Archive to history/

**Files that are already processed or historical evidence** should be moved to a dated archive under `history/capture-inbox-historical/`.

Decision criteria:
- File frontmatter indicates already "processed" or "completed"
- File has "compiled", "approved", or archive marker
- Content is preserved for reference but not active work

### Option C: Delete

**Files that are duplicates, test artifacts, or explicitly marked for removal** may be deleted if inventory review confirms redundancy.

Decision criteria:
- Clear duplicate of content now in inbox/new
- Test capture artifact from migration process
- Explicit "delete-after-migration" marker
- User explicitly approves deletion

## Recommended Next Action (Batch 8V)

**Inventory the 19 original capture/inbox files:**

For each file, determine:
1. **Filename:** exact name
2. **Frontmatter status:** pending, processed, archived, etc.
3. **Content summary:** one-line brief
4. **Classification:** Option A (move to inbox/new), B (archive), or C (delete)
5. **Reason:** why this classification
6. **Review status:** needs user review or clear to execute

**Do NOT move files in Batch 8V.** Only complete the inventory and choose exact destination per file.

**Output:** inventory document listing all 19 files with decisions.

**Execution:** Only after inventory is complete and execution plan is explicitly approved, move files in controlled fashion (separate batch, one operation per commit if large).

## Explicit Non-Actions (Batch 8U)

✓ No Mind files moved
✓ No Mind files changed
✓ No .obsidian/app.json changed (Obsidian newFileFolderPath still set to capture/inbox; updated in future batch)
✓ No n8n triggered
✓ No webhook sent
✓ No Dokploy env changed
✓ No workflow JSON changed (mind-inbox.json remains hardcoded to inbox/new/)
✓ No roadmap updated
✓ No implementation plan updated
✓ Brain dual-path support NOT removed (kept as temporary fallback)
✓ capture/inbox files NOT moved (marked for future cleanup batch only)
✓ No change to active routing (inbox/new remains the only write target)

## Dual-Path Support: Temporary Bridge

**Purpose:** Safety net during capture/inbox → inbox/new migration

**Duration:** Until cleanup batch (Batch 8V+) explicitly handles all historical content

**Removal timeline:**
- Batch 8V: Inventory 19 files and classify each
- After 8V approval: Execute cleanup migration
- After cleanup complete: Remove fallback logic from brain-reader path resolution (separate future batch if needed)

**Rationale:** Keeps old system accessible during transition, prevents data loss if new system has unexpected issues

## Brain State Changes (Batch 8U)

**Files modified in Brain:**
- `operations/reports/brain-reader-dual-path-compatibility-2026-07-09.md` — corrected inaccuracies about simultaneous reading, updated policy statements
- `operations/reports/old-inbox-cleanup-readiness-2026-07-09.md` — NEW report, cleanup gate and inventory plan

**Files NOT modified in Brain:**
- operations/automations/n8n/workflows/mind-inbox.json — remains hardcoded to inbox/new
- operations/automations/n8n/workflows/mind-inbox-fixed.json — remains unchanged
- projects/brain-core/src/mind-paths.ts — remains unchanged
- projects/brain-core/src/adapters/mind-steward-inbox-queue.ts — remains unchanged
- Any code that implements path resolution

**Mind status:** Verified read-only, not changed

## Validation Summary

✅ Brain reader behavior corrected in report (first-existing, not simultaneous)
✅ Operator policy clarified (no permanent dual system)
✅ Temporary dual-path purpose articulated (compatibility safety net)
✅ Cleanup goal stated (remove capture/inbox from active systems)
✅ Inventory plan documented (classify 19 files, decide per-file destination)
✅ Explicit next action for Batch 8V provided (inventory only, no moves)
✅ All non-actions confirmed (no workflows, no Dokploy, no Mind changes)
✅ JSON workflow files unchanged
✅ Mind read-only verified
✅ No webhook sent
✅ No n8n triggered
✅ No roadmap or implementation plan files changed

## Next: Batch 8V Direction

**Batch 8V — Inventory old capture/inbox files for cleanup (NO MOVES, INVENTORY ONLY)**

Tasks:
1. Verify Brain latest commit from Batch 8U
2. Read each of 19 original capture/inbox files
3. Extract: filename, status/frontmatter, content brief
4. Classify each: Option A (move to inbox/new), B (archive to history), or C (delete)
5. Document classification rationale for each file
6. Create cleanup-inventory-2026-07-09.md with all 19 files documented
7. Do NOT move any files
8. Do NOT delete any files
9. Commit only the inventory document
10. Wait for user approval before executing moves

Expected outcome: Complete inventory enabling explicit execution plan for cleanup migrations.
