# B8.1 Failed-Run Disposition — v7r (2026-08-06)

**Date:** 2026-08-07  
**Run ID:** `b8-1-canonical-authorization-20260806-final-v7r`  
**Status:** FAILED — Exact Root Cause Identified and Repaired  
**Evidence Location:** `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260806-final-v7r/`

---

## Root Cause

**Issue:** CBM v0.9.0 returns `{ results: [...] }` (object with results property) instead of bare array `[...]`

**Affected Code:** `tools/lib/b8-1-cbm-incremental-reindex.mjs`, line 457-459

**Original Code:**
```javascript
const output = JSON.parse(result.stdout);
if (!Array.isArray(output)) {
  return { visible: false, reason: 'query output not array' };
}
```

**Problem:** No fallback to `output?.results`; executor correctly handles both formats but this module did not.

---

## Impact: All 10 CBM Fixtures Failed Across All 3 Repositories

**Brain Repository (4 fixtures):**
- `brain_f1_cbm.json`: marker not visible after reindex — query output not array (5490ms)
- `brain_f2_cbm.json`: marker not visible after reindex — query output not array (1601ms)
- `brain_f3_cbm.json`: marker not visible after reindex — query output not array (1502ms)
- `brain_f4_cbm.json`: marker not visible after reindex — query output not array (1359ms)

**Workbench Repository (2 fixtures):**
- `workbench_f1_cbm.json`: marker not visible after reindex — query output not array (1171ms)
- `workbench_f2_cbm.json`: marker not visible after reindex — query output not array (387ms)

**Prochat Repository (4 fixtures):**
- `prochat_f1_cbm.json`: marker not visible after reindex — query output not array (744ms)
- `prochat_f2_cbm.json`: marker not visible after reindex — query output not array (856ms)
- `prochat_f3_cbm.json`: marker not visible after reindex — query output not array (597ms)
- `prochat_f4_cbm.json`: marker not visible after reindex — query output not array (567ms)

**Result:** Empty `repositoryMetrics` for all 3 repositories; evidence validation failed.

**Contrast:** Exact-source fixtures all passed (10/10) — demonstrates harness/executor functional, issue isolated to CBM marker-query code path.

---

## Repair Applied

**Commit:** `2ca2b9ec`  
**Date:** 2026-08-07  
**File:** `tools/lib/b8-1-cbm-incremental-reindex.mjs`

**Fixed Code:**
```javascript
const output = JSON.parse(result.stdout);
// CBM may return either bare array or { results: [...] }
const results = Array.isArray(output) ? output : (Array.isArray(output?.results) ? output.results : []);
```

**Change Size:** 4 insertions, 5 deletions (net -1 line)

**Fail-Closed:** Returns `visible: false` if results array unparseable or missing.

---

## Validation

**Regression Test:** Added to `tools/lib/b8-1-cbm-incremental-reindex.test.mjs`
- Reproduces exact v7r condition: fake CBM returns `{ results: [...] }`
- Proves fix handles both formats
- Status: ✅ PASS

**Test Suite Results:**
- ✅ 30/30 CBM incremental-reindex tests pass
- ✅ 18/18 process-metrics tests pass
- ✅ 63/63 executor tests pass
- ✅ 46/46 evidence validator tests pass
- ✅ 324/324 total tests pass
- ✅ 0 regressions

---

## B8.1 Status

**v7r Plan:** Historical, non-reusable (failed run with known cause)  
**Digest:** `0eec69c1befd7ce11f359fe53aef4f033dbb38a5f767f73bad2800b8db37efa0` (stale, marked obsolete)  
**Implementation Hash (incremental-reindex):** `2b15855fff59e0e2c9b6354542befe5649bee4738b3f822cee8a2b9168ca9461` (obsolete)

**v7s Plan:** New corrected contract  
**Implementation Hash (incremental-reindex):** `438a154b0232a36191683ab503fb6941cd90e37408c6b9dc7764b1db9b36fd98` (current)  
**Status:** Awaiting owner approval

**B8.1 Completion:** Remains incomplete pending execution of v7s plan.

---

## Archive Reference

**Full evidence preserved immutably at:**
```
/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260806-final-v7r/
├── evidence.json                          (10 CBM failures, empty repositoryMetrics)
├── execution-receipt.json                 (complete fixture log)
├── brain_f1_cbm.json through brain_f4_cbm.json
├── workbench_f1_cbm.json, workbench_f2_cbm.json
├── prochat_f1_cbm.json through prochat_f4_cbm.json
├── run-plan.json
├── preflight-receipt.json
└── [exact-source evidence: all 10 passed]
```

---

**Status:** Closed. Repair committed. v7s awaiting authorization.
