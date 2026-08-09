# B8.1 Failed Run Disposition — v7x

**Date:** 2026-08-09
**Run ID:** `b8-1-canonical-authorization-20260809-final-v7x`
**Plan SHA-256:** `c037d9e2dbf67431ee8df0958a4cbe3d95e93dddefeef019a801661aeb939588`
**Evidence SHA-256:** `5453867cb7e7b46475842e6fd6de72bdb4d3ba97ff589811cc99238b57fde869`
**Execution receipt SHA-256:** `73df491add20127e5d04c46a204ae8f023c585a6b0cbe0dabf04ffd6907f730c`
**Preflight receipt SHA-256:** `50ca46457dec1f72632defa671310ce4720234bcab7e32d666d99996b2152911`
**Decision:** REJECTED — insufficient and invalid B8.1 evidence

## Canonical execution

The owner approved the exact v7x plan, Node `v20.20.2` identity, selected
subjects `cbm,exact-source`, Graphify exclusion, and partial-evidence state.
Preflight reverified the digest and every bound prerequisite. The plan was
materialized once and executed once. No retry occurred.

The executor completed 20 fixture-subject cases in 9.494 seconds:

- exact-source: 10 passed, 0 failed, 0 errors;
- CBM: 3 passed, 1 failed, 6 errors;
- total: 13 passed, 1 failed, 6 errors, 0 timeouts;
- executor outcome: `partial`.

All six CBM errors occurred before ordinary retrieval scoring because the
post-reindex marker was not found in the exact target file for the Brain and
Workbench repository snapshots. The three ProChat CBM fixtures that passed
returned the expected files; `prochat_f2` failed its expected route-file count.
This disposition does not claim a provider or harness root cause beyond the
preserved evidence.

## Measurements and thresholds

| Metric | v7x result | Required | Disposition |
|---|---:|---:|---|
| CBM file accuracy | 30% | at least 90% | fail |
| CBM line accuracy | 30% | at least 80% | fail |
| CBM initial index time | ProChat only: 220 ms | at most 10 s per repository | incomplete |
| CBM incremental refresh | ProChat only: 110 ms | at most 500 ms per repository | incomplete |
| CBM disk bytes | ProChat only: 8,028,160 | measured per repository | incomplete |
| CBM peak CPU / RSS | absent | valid bounded measurement | fail |
| exact-source file accuracy | 100% | comparison baseline | pass |
| exact-source line accuracy | 80% | comparison baseline | pass |
| exact-source caller/callee F1 | 1.0 | comparison baseline | pass |

The partial ProChat resource measurements cannot substitute for the missing
Brain and Workbench measurements.

## Canonical evidence validation

The evidence validator returned `INVALID`. It rejected:

- invalid/null CBM peak CPU and peak RSS fields;
- missing CBM resource provenance;
- missing CBM repository metrics for Brain and Workbench;
- schema-invalid additional properties in both subject metric records.

The selected CBM subject therefore lacks complete schema-valid evidence and
does not meet the acceptance thresholds. Partial-evidence approval did not
waive selected-subject requirements.

## Safety and cleanup

- source-state before/after files are byte-identical;
- no benchmark marker remains in the disposable sources;
- cleanup receipt records zero terminated or orphaned processes;
- no CBM process remained after execution;
- Graphify was excluded and not invoked;
- no client registration, provider activation, watcher, scheduler, credential,
  network mutation, canonical source mutation, or Mind mutation occurred.

The immutable run remains at:

`/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260809-final-v7x/`

## Roadmap disposition

The v7x approval is consumed and its digest is stale for future execution.
B8.1 remains incomplete after a rejected canonical run. B8.2–B8.6 remain
blocked, P8 remains 0/6 accepted, Codebase Memory remains a non-default
candidate, and Graphify remains excluded/frozen.

No repair or rerun is authorized. Any future attempt requires a separately
approved investigation, a new implementation identity and run ID, a fresh
canonical dry-run plan and receipt, and fresh exact owner approval.
