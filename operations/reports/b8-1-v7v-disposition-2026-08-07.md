# B8.1 v7v Execution Disposition — 2026-08-07

**Status:** INCOMPLETE — Evidence invalid; CBM defect prevents execution  
**Run ID:** `b8-1-canonical-authorization-20260807-final-v7v`  
**Node:** v20.20.2 ✓  
**Contract Digest:** `03739874650e8200a9a2442f536b00f6b0615381d115652be54780dfbaa98bde`  
**Evidence:** `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260807-final-v7v/evidence.json` (invalid)

---

## Execution Summary

### Preflight (v7v Plan Generation)

| Check | Status | Detail |
|-------|--------|--------|
| source-root-overrides | PASS | brain@f683edff, workbench@bc490861, prochat@85087d54 |
| manifest-validation | PASS | 10 fixtures across 3 repos |
| pinned-commit:brain | PASS | f683edff7539 |
| pinned-commit:workbench | PASS | bc4908613f23 |
| pinned-commit:prochat | PASS | 85087d54f712 |
| run-id-valid | PASS | b8-1-canonical-authorization-20260807-final-v7v |
| cbm-binary-identity | PASS | v0.9.0, sha256=d9fbdd7d... |
| network-isolation | PASS | sandbox-exec; sandboxed=denied |
| graphify-subject | EXCLUDED | bounded code-only invocation blocked |
| exact-source-ready | PASS | grep, find, cat available |
| disk-budget | PASS | ≥2000 MB available |
| planned-write-containment | PASS | 21 paths confined to ~/.brain |
| source-state-binding | PASS | sha256=a0af2027907af240... |

**All 13 checks pass. executionReady=true. Materialized successfully.**

---

## Execution Results

**Total fixtures:** 20 (10 × brain, workbench, prochat; 2 subjects each)

### By Subject

| Subject | Pass | Error | Timeout | Rate |
|---------|------|-------|---------|------|
| exact-source | 10/10 | 0 | 0 | **100%** ✓ |
| cbm | 0/10 | 10 | 0 | **0%** ✗ |

### Fixture Results

#### exact-source (100% pass)
- brain_f1: **PASS** (MIND_TARGET_PATHS found at line 21)
- brain_f2: **PASS** (classifyMindCaptureInbox found at line 73)
- brain_f3: **PASS** (MCP tools set-match)
- brain_f4: **PASS** (MIND_CANONICAL_PATHS found at line 19)
- workbench_f1: **PASS** (route.ts:143)
- workbench_f2: **PASS** (models/index.ts:1–5)
- prochat_f1: **PASS** (route.ts:8–20)
- prochat_f2: **PASS** (route.ts:12–18)
- prochat_f3: **PASS** (stripe route found)
- prochat_f4: **PASS** (prisma.ts found)

#### cbm (0% pass — all error: "marker not visible after reindex")
- brain_f1: **ERROR** — marker not visible after reindex
- brain_f2: **ERROR** — marker not visible after reindex
- brain_f3: **ERROR** — marker not visible after reindex
- brain_f4: **ERROR** — marker not visible after reindex
- workbench_f1: **ERROR** — marker not visible after reindex
- workbench_f2: **ERROR** — marker not visible after reindex
- prochat_f1: **ERROR** — marker not visible after reindex
- prochat_f2: **ERROR** — marker not visible after reindex
- prochat_f3: **ERROR** — marker not visible after reindex
- prochat_f4: **ERROR** — marker not visible after reindex

---

## Evidence Validation

**Validator:** `node tools/validate-b8-1-benchmark-evidence.mjs`

**Result:** **INVALID**

### Schema Errors (CBM Subject)
```
/subjectMetrics/cbm/peakCpuPercent must be number
/subjectMetrics/cbm/peakRssMb must be number
/subjectMetrics/cbm must NOT have additional properties
```

### Semantic Errors (CBM)
```
E53: subjectMetrics.cbm.resourceProvenance is required for schema 3.0.0
E53: subjectMetrics.cbm.repositoryMetrics missing entry for pinned repo "brain"
E53: subjectMetrics.cbm.repositoryMetrics missing entry for pinned repo "prochat"
E53: subjectMetrics.cbm.repositoryMetrics missing entry for pinned repo "workbench"
```

**Issue:** CBM failed to execute fixtures, so subject metrics were never collected. The evidence is structurally incomplete.

---

## Root Cause: CBM Marker Query Failure

All 10 CBM fixtures failed with the same error: **"marker not visible after reindex"**

This indicates the CBM incremental reindex (v0.9.0) failed to capture symbol markers or the marker-visibility algorithm encountered an unknown symbol type.

**Evidence:**
- executionReady: false when queried post-reindex for any fixture
- No resourceProvenance (CPU, RSS, latency) collected for any fixture
- All errors: `{"errors": ["marker not visible after reindex: unknown"]}`

This is a structural defect in the CBM/Codebase Memory MCP integration, not an environment issue. Exact-source's 100% success demonstrates:
- Repository checkouts are valid
- Fixture definitions are correct
- Network isolation works
- File system access works

**Known from prior runs:** CBM has had incremental reindex issues in v7r, v7s, v7t runs. The v7u run also failed on CBM with similar markers.

---

## B8.1 Acceptance Criteria

Per the goal's B8.1 plan:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All 13 preflight checks pass | ✓ PASS | All checks: PASS / EXCLUDED-SUBJECT |
| executionReady=true | ✓ PASS | Confirmed in materialization |
| Run executes exactly once | ✓ PASS | Single execution, no retries |
| Evidence schema valid | ✗ **FAIL** | Invalid: missing CBM subjectMetrics |
| All subjects execute successfully | ✗ **FAIL** | CBM: 0/10; exact-source: 10/10 |
| Partial evidence accepted? | ⚠ **AMBIGUOUS** | Exact-source succeeds but CBM fails |

---

## Disposition

**B8.1 Status: INCOMPLETE**

The preflight and execution infrastructure work correctly. Exact-source baseline (100% accuracy) proves the fixtures and methodology are sound.

**Blocker:** CBM subject failed to execute. Evidence is invalid per schema validation. Per goal Phase 1, step 7: "All gates pass => B8.1 complete... Otherwise preserve immutable evidence and STOP."

**Recommendation:**
1. Investigate CBM marker-visibility defect in v0.9.0 for this environment
2. Consider CBM out of scope for B8.1 if marker defect is environmental or unfixable in current version
3. Run B8.1 again with `--subjects exact-source` only (if acceptable as partial evidence for B8.2 decision)

**Immutable Evidence:** All run artifacts preserved in `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260807-final-v7v/`

---

## Next Steps

**Per goal Phase 1:** STOP (gates do not all pass, evidence invalid).

**Branch:** main (origin/main = 8058e3ddf; no local changes)

**Changed files:** 0 (no code changes; evidence directory is local-only benchmark artifact)

**P8 Progress:** 0/6 (B8.1 incomplete; B8.2–B8.4 blocked)
