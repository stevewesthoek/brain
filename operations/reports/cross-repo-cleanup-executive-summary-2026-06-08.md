# Cross-Repo Cleanup — Executive Summary

**Analysis Date:** 2026-06-08  
**Status:** ✅ Complete (Analysis only, no changes made)

---

## Feasibility & Risk Assessment

### ✅ InfiniteBrainWriteTest.md Relocation: FEASIBLE
- **Current location:** `/mind/00_System/InfiniteBrainWriteTest.md`
- **Desired location:** `/mind/system/InfiniteBrainWriteTest.md`
- **Files affected:** 23 (12 code, 6 docs, 5 auto-generated state)
- **Risk:** 🟡 Medium (code change required, but well-isolated and testable)
- **Reversible:** Yes (simple revert of TypeScript constant)

### ✅ Graphify Output Path Hidden: SAFE
- **Current path:** `graphify-out/` (visible)
- **Desired path:** `.graphify-out/` (hidden via dot convention)
- **Reason:** Cleaner repo roots; machine-internal output shouldn't clutter top level
- **Files affected:** 29 (2 code, 7 docs, 14 auto-generated state, 2 gitignore)
- **Risk:** 🟡 Medium (path rename affects filesystem, but logic unchanged)
- **Reversible:** Yes (rename back, regenerate output)

### ✅ Remove `/mind/00_System/` Folder: FEASIBLE
- **Why:** Folder was created only as Infinite Brain write-test sink
- **Safe after:** Phase 2 (test file moved)
- **Risk:** ✅ Very Low (only after test file relocates)

### ⚠️ Archive Brain Root Markdown: OPTIONAL
- **Files:** 6 historical analysis reports (59KB total)
- **Location:** Move to `docs/archive/reports/`
- **Risk:** ✅ Very Low (cosmetic, non-operational files)
- **Priority:** Lowest (can defer)

---

## Recommended Phases

| Phase | Action | Risk | Time | Approval |
|-------|--------|------|------|----------|
| **1** | 📄 Docs + gitignore updates only | ✅ Very Low | 15 min | Not needed |
| **2** | 🔧 Update Infinite Brain code + move test file | 🟡 Medium | 45 min | **Required** |
| **3** | 📁 Rename graphify-out/ → .graphify-out/ | 🟡 Medium | 30 min | **Required** |
| **4** | 🗂️ Archive Brain markdown reports | ✅ Very Low | 10 min | Not needed |
| **5** | 🗑️ Delete empty 00_System/ folder | ✅ Very Low | 5 min | Not needed |
| **6** | ✔️ Final validation + commit | ✅ Very Low | 20 min | Not needed |

**Total estimated time:** 2–3 hours with testing

---

## Files Changing

### Phase 1 (Docs Only) — 10 Files Updated, 0 Moved
- 8 markdown documentation files
- 2 `.gitignore` files
- **No code changes**

### Phase 2 (Infinite Brain Relocation) — 4 Source Files, 1 Test File Moved
- 1 TypeScript constant update (allowlist path)
- 3 test files updated (temp setup fixtures)
- 1 file moved: `/mind/00_System/InfiniteBrainWriteTest.md` → `/mind/system/InfiniteBrainWriteTest.md`
- Compile with `npm run build`
- Auto-regenerates 5 runtime state JSON files

### Phase 3 (Graphify Hidden) — 2 Directories Renamed, 1 Script Updated
- Rename `graphify-out/` → `.graphify-out/` in both repos
- Update `tools/scripts/graphify-nightly.sh` (1 line)
- Auto-regenerates 14 runtime state files

### Phases 4–6 (Cleanup + Validation)
- Archive 6 markdown files (optional)
- Delete 00_System/ folder (after Phase 2)
- Run validation suite

---

## Validation Checklist

**All these must pass before and after each phase:**

```bash
✓ Brain Core starts: npm run brain-core:clean-start
✓ Brain health:     curl http://127.0.0.1:4877/status
✓ IBR verify:       npm run ibr:verify (11/11 passed)
✓ Typecheck:        npm run typecheck
✓ Tests pass:       npm run test
✓ Git clean:        git status --short
```

---

## What NOT to Do Yet

❌ Do not move files — wait for Phase 2  
❌ Do not update code — wait for Phase 2  
❌ Do not delete 00_System/ — wait for Phase 5  
❌ Do not manually edit runtime JSON — auto-regenerate  
❌ Do not rename graphify-out/ — wait for Phase 3  
❌ Do not push to git — wait for review + phase approval  

---

## Next Steps

1. **Review** detailed analysis in `ANALYSIS-CROSS-REPO-CLEANUP-2026-06-08.md`
2. **Approve** Phase 1 (docs only, zero risk) to proceed immediately
3. **Decide** timing for Phase 2 (requires code recompile + testing)
4. **Plan** Phase 3–6 based on scheduler availability and release window

---

**Detailed Report:** See `ANALYSIS-CROSS-REPO-CLEANUP-2026-06-08.md`  
**Analysis Status:** ✅ Complete, ready for review
