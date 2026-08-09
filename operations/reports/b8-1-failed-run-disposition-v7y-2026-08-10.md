# B8.1 Failed Run Disposition — v7y

**Date:** 2026-08-10
**Run ID:** `b8-1-canonical-authorization-20260809-final-v7y`
**Plan SHA-256:** `57156d49e4f3ab273efb791dc3e4e128a839ba10552b860ab3219ae58e8bd1d1`
**Evidence SHA-256:** `bc6406e4f15d7c0e81d69168395a23acb9c5b062f89db10c23629ae38afc0f78`
**Execution receipt SHA-256:** `564da2eebc2595ebb9c318410e74fbd2c6abac92c33900199d3fb34fd4d62932`
**Preflight receipt SHA-256:** `b3d6e6fff0abe15b19fe0c5d5809b2ce1ce4a6cc85119f74587a40edfc33d8c9`
**Cleanup receipt SHA-256:** `ccd61dad1286e94590cecdbc578bfff1801fadb30a4945d7669142e19cf2ef02`
**Decision:** REJECTED — valid evidence fails B8.1 acceptance thresholds and is partial

## Canonical execution

The owner approved the exact v7y plan, Node `v20.20.2` identity, selected
subjects `cbm,exact-source`, Graphify exclusion, and partial-evidence state.
Preflight reverified the digest and every bound prerequisite. The plan was
materialized once and executed once. No retry occurred.

The executor completed 20 fixture-subject cases in 10.573 seconds:

- exact-source: 10 passed, 0 failed, 0 errors;
- CBM: 8 passed, 2 failed, 0 errors;
- total: 18 passed, 2 failed, 0 errors, 0 timeouts;
- executor outcome: `partial`.

The CBM failures were:

- `brain_f4`: CBM did not return the expected
  `tools/validate-deletion-readiness.mjs` file;
- `prochat_f2`: CBM returned 4 matching route files where exact-source returned
  the expected count of 27.

## Measurements and thresholds

| Metric | v7y result | Required | Disposition |
|---|---:|---:|---|
| CBM file accuracy | 80% | at least 90% | fail |
| CBM line accuracy | 70% | at least 80% | fail |
| CBM initial index time | Brain 1,990 ms; Workbench 730 ms; ProChat 220 ms | at most 10 s per repository | pass |
| CBM incremental refresh | Brain 1,150 ms; Workbench 530 ms; ProChat 110 ms | at most 500 ms per repository | fail |
| CBM peak RSS | 572.75 MB | at most 512 MB | fail |
| CBM index disk | Brain 90,472,448 bytes; Workbench 30,048,256 bytes; ProChat 8,028,160 bytes | at most 500 MB per repository | pass |
| exact-source file accuracy | 100% | comparison baseline | pass |
| exact-source line accuracy | 80% | comparison baseline | pass |
| exact-source caller/callee F1 | 1.0 | comparison baseline | pass |

CBM therefore fails four required acceptance checks: file accuracy, line
accuracy, Brain and Workbench refresh latency, and peak RSS. The two-subject
partition is also partial evidence by contract and cannot complete B8.1 or
authorize B8.2 even if its selected subjects had met every threshold.

## Canonical evidence validation

The evidence validator returned `OK: evidence is valid` against the committed
manifest and exact materialized run directory. The evidence includes complete
typed metrics for both selected subjects, manifest-bound refresh targets,
truthful resource provenance, and plan/run bindings. Schema validity does not
override the failed acceptance thresholds.

## Safety and cleanup

- source-state before/after files are byte-identical, both with SHA-256
  `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8`;
- no benchmark marker or `.codebase-memory/` directory remains in the
  disposable sources;
- cleanup receipt records zero terminated or orphaned processes;
- no CBM or Graphify process remained after execution;
- Graphify was excluded and not invoked;
- no client registration, provider activation, watcher, scheduler, credential,
  network mutation, canonical source mutation, or Mind mutation occurred.

The immutable run remains at:

`/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260809-final-v7y/`

## Roadmap disposition

The v7y approval is consumed and its digest is stale for future execution.
B8.1 remains incomplete after a rejected canonical run. B8.2–B8.6 remain
blocked, P8 remains 0/6 accepted, Codebase Memory remains a non-default
candidate, and Graphify remains excluded/frozen.

No repair, investigation, or rerun is authorized. Any future attempt requires
a separately approved investigation, a new implementation identity and run ID,
a fresh canonical dry-run plan and receipt, and fresh exact owner approval.
