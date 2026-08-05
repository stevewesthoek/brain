# B8.1 Context-Memory Benchmark — Canonical Execution Evidence

**Run ID:** `b8-1-canonical-authorization-20260805-final-v5s`
**Executed:** 2026-08-05T21:40:11Z – 2026-08-05T21:40:16Z (4.5s total)
**Outcome:** partial (17/20 passed, 3 failed)
**Status:** executed-awaiting-owner-disposition
**Branch:** `fix/b8-1-v5s-evidence-validation` (from canonical `main` at `9a6a6c60`)
**Schema:** 1.1.0 (backward-compatible extension of 1.0.0 for v5s path-independence)
**Validator:** PASS (all checks)

## Plan Verification

| Check | Result |
|-------|--------|
| Plan digest | `47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0` |
| Plan version | 5.1.0 |
| origin/main at execution | `9a6a6c60f17d0b63e6184981f305da657cdabe00` |
| CBM binary sha256 | `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6` |
| Node runtime sha256 | `a46ed02589ca3af795237111ff854262064f8ff5c5b58d75c1509f37311eb15e` |
| sandbox-exec sha256 | `8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16` |
| Network deny profile sha256 | `bd1de96bd9906950492a3d919ada1dfc6dfefd60780c7b242f87e6689c4f675a` |
| Child isolation script sha256 | `207a19ce264c25b3944264879d15b96dca46bfe4397468df956248f41fbd06db` |

## Subjects

| Subject | Status |
|---------|--------|
| cbm (v0.9.0) | Executed — 8/10 pass |
| exact-source | Executed — 9/10 pass |
| graphify | Excluded (per approved plan) |

## Aggregate Metrics

| Metric | Value |
|--------|-------|
| File accuracy | 0.90 (18/20) |
| Line accuracy | 0.75 (15/20) |
| Set accuracy | 0.00 (single json-pointer-set fixture, type mismatch) |

## Per-Fixture Results

| Fixture | Repo | CBM | exact-source |
|---------|------|-----|--------------|
| brain_f1 | brain | PASS (file+line, 2165ms) | PASS (file+line, 27ms) |
| brain_f2 | brain | PASS (file+line, 263ms) | PASS (file+line, 114ms) |
| brain_f3 | brain | PASS (file only, 229ms) | FAIL (set mismatch, 119ms) |
| brain_f4 | brain | FAIL (file miss, 84ms) | PASS (file+line, 94ms) |
| workbench_f1 | workbench | PASS (file+line, 800ms) | PASS (file+line, 0ms) |
| workbench_f2 | workbench | PASS (file+line, 54ms) | PASS (file+line, 0ms) |
| prochat_f1 | prochat | PASS (file+line, 273ms) | PASS (file+line, 6ms) |
| prochat_f2 | prochat | FAIL (file miss, 91ms) | PASS (file only, 5ms) |
| prochat_f3 | prochat | PASS (file+line, 73ms) | PASS (file+line, 18ms) |
| prochat_f4 | prochat | PASS (file+line, 74ms) | PASS (file+line, 6ms) |

## Failed Fixture Classification

All 3 failures are **benchmark-quality failures** — the infrastructure (isolation, execution, cleanup) succeeded completely; only the subject's search quality did not meet the fixture expectations.

### 1. brain_f3 / exact-source — Set Algorithm Type Mismatch

- **Algorithm:** json-pointer-set
- **Error:** Expected string values `[getWorkbenchStatus, readWorkbenchContext, runWorkbenchCommand]` but JSON pointer resolved to object array
- **Root cause:** Fixture `verification.expected` declares string tool names; the actual JSON structure at that pointer contains tool-definition objects with nested properties
- **Classification:** Fixture definition mismatch (not a subject failure)

### 2. brain_f4 / cbm — File Not Found by CBM Index

- **Error:** CBM search did not return expected file `tools/validate-deletion-readiness.mjs`
- **Classification:** CBM retrieval quality — index did not surface this file for the query pattern
- **exact-source passed** — file exists and was correctly located

### 3. prochat_f2 / cbm — File-Count Algorithm Mismatch

- **Error:** CBM returned file count 4, expected null (file-name-count algorithm)
- **Classification:** CBM retrieval quality — CBM returned results but count did not match expected
- **exact-source passed** — counted 27 files (file exists, line not applicable)

## Evidence Integrity

| Artifact | SHA-256 |
|----------|---------|
| evidence.json | `5066be356c7396355d443f198d55fb65644f283cf6736c45c7930b8a0da25cf4` |
| execution-receipt.json | `0934cd6516df6f0f615ae512593d1357dcee67cf23a3d2ea6af6d2d29463d85c` |
| cleanup-receipt.json | `3e34b8e6fa98a3e76a091e0e21bb32b6edee37d9dee69726a49cae5cf74393f3` |
| source-state before/after | `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` |

## Proofs

### Source-State Equality
- source-state-before.json SHA = source-state-after.json SHA (file-level identity)
- Logical source-state hash: `sha256:a0af2027907af240ffc93f12ff8fe842a5405e9b0b894055acd9ac9bc64bb643`
- All 3 source-roots unchanged: HEAD, porcelain status, exported tree SHA verified

### Network Isolation
- sandbox-exec self-test: control succeeded; sandboxed child started; connection denied with EPERM
- All CBM invocations wrapped in sandbox-exec network-deny profile
- Profile SHA verified at preflight and in evidence

### Process Cleanup
- 0 orphaned processes
- 0 terminated PIDs
- cleanup-receipt confirms clean exit

## Canonical Validation Result

```
$ node tools/validate-b8-1-benchmark-evidence.mjs \
    --evidence=<run>/evidence.json \
    --manifest=operations/specs/b8-1-context-memory-benchmark-manifest.json \
    --run-dir=<run>
OK: evidence is valid
```

All binding checks pass:
- JSON Schema validation (1.1.0 — v5s path-independent proof)
- Plan digest independently recomputes to approved value
- 20 unique fixture results present (10 fixtures × 2 subjects)
- Source-state before/after equality verified
- Source logical identity hash matches approved sourceStateHash
- Network isolation proof passes (all required fields present and valid)
- Preflight receipt hash matches
- Cleanup manifest matches
- Run directory basename matches runId
- All subject/fixture/excluded partitions consistent

## Noncanonical Historical Note

Commit `67194307` on branch `release/brain-stabilization-v1` contains a prior version of this report authored before the evidence schema was corrected. That report correctly identified the schema incompatibility but could not produce a passing validation. It is superseded by this canonical report. The divergent branch must not be merged.

## P8 Status

| Milestone | Status |
|-----------|--------|
| B8.1 | executed-awaiting-owner-disposition |
| P8 progress | 0/6 |
| B8.2 | Not started |
| Graphify | Excluded |
| Evidence | Partial (graphify excluded) |

## Owner Disposition Request

The evidence demonstrates:
- Infrastructure fully operational (network isolation, source integrity, process cleanup all verified)
- 17/20 fixture results pass
- 3 failures are benchmark-quality issues (not security or infrastructure failures)
- All security invariants maintained without weakening

Please select one:

1. **Accept** — Advance P8 to 1/6
2. **Accept with caveats** — Accept 17/20 as valid; flag 3 failures for B8.2 fixture refinement
3. **Reject and rerun** — Specify which failures require re-execution
