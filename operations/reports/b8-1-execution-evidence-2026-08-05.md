# B8.1 Context-Memory Benchmark — Execution Evidence

**Run ID:** `b8-1-canonical-authorization-20260805-final-v5s`
**Executed:** 2026-08-05T21:40:11Z – 2026-08-05T21:40:16Z (4.5s total)
**Outcome:** partial (17/20 passed, 3 failed)
**Status:** executed-awaiting-owner-disposition

## Plan Verification

| Check | Result |
|-------|--------|
| Plan digest | `47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0` ✅ |
| Plan version | 5.1.0 ✅ |
| origin/main | `9a6a6c60f17d0b63e6184981f305da657cdabe00` ✅ |
| CBM binary sha256 | `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6` ✅ |
| Node runtime sha256 | `a46ed02589ca3af795237111ff854262064f8ff5c5b58d75c1509f37311eb15e` ✅ |
| sandbox-exec sha256 | `8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16` ✅ |
| Network deny profile sha256 | `bd1de96bd9906950492a3d919ada1dfc6dfefd60780c7b242f87e6689c4f675a` ✅ |

## Subjects

| Subject | Status |
|---------|--------|
| cbm (v0.9.0) | Executed |
| exact-source | Executed |
| graphify | Excluded (approved) |

## Aggregate Metrics

| Metric | Value |
|--------|-------|
| File accuracy | 0.90 (18/20) |
| Line accuracy | 0.75 (15/20) |
| Set accuracy | 0.00 (1 fixture uses json-pointer-set, failed) |

## CBM vs Exact-Source Comparison

| Metric | CBM | exact-source |
|--------|-----|--------------|
| Pass rate | 8/10 | 9/10 |
| File correct | 8/10 | 10/10 |
| Line correct | 7/10 | 8/10 |
| Avg latency | ~411ms | ~39ms |

## Per-Fixture Results

| Fixture | CBM | ES | Notes |
|---------|-----|-----|-------|
| brain_f1 | ✅ file+line 2165ms | ✅ file+line 27ms | Mind-paths.ts lookup |
| brain_f2 | ✅ file+line 263ms | ✅ file+line 114ms | Classifier.ts lookup |
| brain_f3 | ✅ file (no line) 229ms | ❌ file (set fail) 119ms | json-pointer-set: string vs object array |
| brain_f4 | ❌ file miss 84ms | ✅ file+line 94ms | CBM missed validate-deletion-readiness.mjs |
| prochat_f1 | ✅ file+line 273ms | ✅ file+line 6ms | |
| prochat_f2 | ❌ file miss 91ms | ✅ file (no line) 5ms | CBM missed file-name-count fixture |
| prochat_f3 | ✅ file+line 73ms | ✅ file+line 18ms | Stripe webhook route |
| prochat_f4 | ✅ file+line 74ms | ✅ file+line 6ms | Prisma lib lookup |
| workbench_f1 | ✅ file+line 800ms | ✅ file+line 0ms | First CBM index for workbench |
| workbench_f2 | ✅ file+line 54ms | ✅ file+line 0ms | |

## Failed Fixtures Detail

### brain_f3 (exact-source)
- **Algorithm:** json-pointer-set
- **Error:** Set mismatch — expected string values `[getWorkbenchStatus, readWorkbenchContext, runWorkbenchCommand]` but json-pointer resolved to object array `[[object Object],...]`
- **Root cause:** The JSON pointer resolves to an array of objects (not strings); the fixture's `verification.expected` lists string tool names but the actual JSON structure contains tool-definition objects with nested properties
- **File was found:** Yes (fileCorrect=true)

### brain_f4 (cbm)
- **Error:** CBM search did not return expected file `tools/validate-deletion-readiness.mjs`
- **Root cause:** CBM index did not surface this file for the search pattern used
- **exact-source:** Passed (file exists and line verification succeeded)

### prochat_f2 (cbm)
- **Error:** CBM search did not return the expected file for file-name-count algorithm
- **Root cause:** file-name-count doesn't map cleanly to CBM's search_code API — CBM returned results but none matching the expected count
- **exact-source:** Passed (counted 27 files correctly)

## Evidence Integrity

| Artifact | SHA-256 |
|----------|---------|
| evidence.json | `5066be356c7396355d443f198d55fb65644f283cf6736c45c7930b8a0da25cf4` |
| execution-receipt.json | `0934cd6516df6f0f615ae512593d1357dcee67cf23a3d2ea6af6d2d29463d85c` |
| cleanup-receipt.json | `3e34b8e6fa98a3e76a091e0e21bb32b6edee37d9dee69726a49cae5cf74393f3` |
| source-state-before.json | `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` |
| source-state-after.json | `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` |

## Proofs

### Source-State Equality
- source-state-before.json SHA = source-state-after.json SHA = `0fe72e6f...` ✅
- All three source-roots unchanged (HEAD and status verified independently post-execution)
- No modifications to mind, workbench, prochat, user config, approvals, registrations, or Brain worktrees

### Network Isolation
- sandbox-exec self-test passed at preflight: control connection succeeded; sandboxed child started; connection denied with EPERM
- All CBM fixture invocations wrapped in sandbox-exec with network-deny profile
- Profile SHA: `bd1de96bd9906950492a3d919ada1dfc6dfefd60780c7b242f87e6689c4f675a`

### Process Exit
- 0 orphaned CBM processes after execution
- 0 sandbox-exec processes after execution
- 0 benchmark-related processes after execution
- cleanup-receipt confirms `terminatedPids: []`, `orphanedProcesses: 0`

## Evidence Schema Validation

The canonical evidence schema validator reports 2 categories of errors:

1. **networkIsolationProof schema mismatch** — v5s plan contract deliberately removed `profilePath` and `childIdentity.path` for path-independence. The evidence schema (v1.0.0) still requires these fields. This is a known schema-contract divergence introduced in v5s.

2. **sourceStateHash binding mismatch** — The plan's `sourceStateHash` is computed using `computeLogicalSourceIdentity()` (which strips `path` fields for path-independence), but the validator computes the hash over the full source-state array (including local filesystem paths). This is inherent to the v5s path-independence design.

**Mitigation:** Both errors are structural mismatches between the evidence schema (written for v4) and the v5s plan contract (which prioritizes path-independence). The actual source-state equality and network isolation are independently proven by SHA comparison and preflight self-test. Resolving this requires a schema version bump to v1.1.0 that accepts the v5s proof format.

## Execution Environment

| Property | Value |
|----------|-------|
| Executor version | 5.1.0 |
| CBM version | v0.9.0 |
| Node | v25.9.0 |
| Platform | darwin (macOS) |
| Sandbox | sandbox-exec (network-deny) |
| auto_watch | false (verified) |
| Isolated HOME | per-run synthetic (subjects/cbm/config) |
| Run directory | `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260805-final-v5s` |

## Limitations

1. **Graphify excluded** — Not executed per approved plan. B8.1 covers only cbm + exact-source.
2. **Partial evidence** — 3/20 fixtures failed. CBM missed 2 fixtures; exact-source json-pointer-set had type mismatch.
3. **Evidence schema v1.0.0 incompatible with v5s plan** — Path-independent proof fields not recognized by current schema. Requires schema bump.
4. **setAccuracy metric = 0.0** — Dragged down by single json-pointer-set fixture that failed due to object-vs-string type mismatch in verification.expected.

## P8 Status

- **B8.1:** executed-awaiting-owner-disposition
- **P8 progress:** 0/6 (no milestones accepted until evidence is reviewed)
- **B8.2:** Not started. Awaiting B8.1 disposition.

## Owner Disposition Request

Please review this evidence and choose one:

1. **Accept B8.1** — Evidence is sufficient despite 3 fixture failures and schema validation gap. Advance P8 to 1/6.
2. **Accept with caveats** — Accept the 17 passing fixtures as valid evidence; flag the 3 failures and schema gap as known issues to resolve in B8.2 planning.
3. **Reject B8.1** — Evidence is insufficient; re-execution required after fixing the schema divergence and/or fixture definitions.
