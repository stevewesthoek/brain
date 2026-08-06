# B8.1 Context-Memory Benchmark — Canonical Execution Evidence

**Run ID:** `b8-1-canonical-authorization-20260805-final-v5s`
**Executed:** 2026-08-05T21:40:11Z – 2026-08-05T21:40:16Z (4.5s total)
**Outcome:** partial (17/20 passed, 3 failed)
**Status:** executed-partial-needs-corrected-run
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

Infrastructure (isolation, execution, cleanup) succeeded completely. Of the 3 failures, two are harness defects and one is a genuine CBM retrieval miss.

### 1. brain_f3 / exact-source — HARNESS DEFECT (json-pointer-set object projection)

- **Algorithm:** json-pointer-set
- **Error:** Expected string values `[getWorkbenchStatus, readWorkbenchContext, runWorkbenchCommand]` but JSON pointer `/admissions/1/scope/tools` resolves to an array of objects (each with `name`, `risk`, `approval`, etc.)
- **Root cause:** The fixture's `verification.expected` declares string tool names but the evaluator compared raw objects against strings. The fixture lacked an `itemProperty` directive to project objects to their `.name` field.
- **Classification:** Harness defect — evaluator does not support object-to-property projection. Fixed in v6 contract with generic `itemProperty` extension.
- **Not a subject failure** — exact-source correctly located the file and pointer.

### 2. brain_f4 / cbm — GENUINE CBM RETRIEVAL MISS

- **Error:** CBM search did not return expected file `tools/validate-deletion-readiness.mjs`
- **Classification:** Genuine CBM retrieval quality failure — the index did not surface this file for the query pattern
- **exact-source passed** — file exists and was correctly located deterministically

### 3. prochat_f2 / cbm — CBM COUNT MISMATCH (with harness defect context)

- **Error:** CBM returned file count 4, expected null (file-name-count algorithm). The manifest declares `expectedCount: 27`, but the evaluator recorded `assertion.expected=null` because it pulled from `verification.expectedCount` via the CBM adapter path which does not bind manifest-level `expectedFileCount`.
- **Root cause:** The exact-source evaluator correctly bound `expectedCount: 27` from `verification.expectedCount` in the manifest and passed (27 found = 27 expected). The CBM adapter path does not execute file-name-count verification (CBM returns search results, not file counts), so the assertion recorded `expected=null`. The evaluator incorrectly auto-passes when `expectedCount` is null.
- **Classification:** Compound — CBM genuinely returned only 4 matching files (retrieval quality), AND the harness had a null-expected-count pass-through defect. Fixed in v6 contract by rejecting null expected counts.
- **exact-source passed** — counted exactly 27 files as expected.

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
| B8.1 | executed-partial-needs-corrected-run |
| P8 progress | 0/6 |
| B8.2 | Blocked (awaiting B8.1 completion) |
| Graphify | Excluded |
| Evidence | Partial (graphify excluded, metrics incomplete) |

## Owner Disposition (2026-08-06)

**Decision:** REJECTED as insufficient for B8.1 completion.

The v5s run is preserved as valid infrastructure evidence demonstrating:
- Infrastructure fully operational (network isolation, source integrity, process cleanup all verified)
- 17/20 fixture results pass
- All security invariants maintained without weakening

**Rejection reasons:**
1. Evidence records only aggregate accuracy and per-fixture latency — not the per-subject indexing time, refresh latency, peak CPU/RSS, index disk use, payload bytes, tokenizer estimate, and operation count required by the benchmark plan
2. Two harness defects identified (brain_f3 itemProperty missing; prochat_f2 null expectedCount pass-through)
3. One genuine CBM retrieval miss (brain_f4) — legitimate subject quality failure
4. Metrics are not partitioned per subject as required
5. The run does not establish a preferred structural default for context-memory

**Next step:** v6 corrected contract with typed per-subject metrics, fixed evaluator, and re-execution.

## Immutable Run Reference

The v5s run directory at `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260805-final-v5s` is immutable and must not be modified or deleted. It serves as historical infrastructure validation evidence.
