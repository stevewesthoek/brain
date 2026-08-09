# B8.1 Failed-Run Disposition — v7w (2026-08-09)

**Decision:** REJECTED as insufficient for B8.1 completion
**Run ID:** `b8-1-canonical-authorization-20260809-final-v7w`
**Plan SHA-256:** `86859184919a029c9a3aaa989c55240ad07aff368c09e6895d9564577dfadf30`
**Plan version:** `7.1.0`
**Node:** `v20.20.2` (`38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`)
**Sandbox adapter:** `/usr/bin/sandbox-exec` (`e3d7a792c58a5d3783d2f7274c82d70062393830d8cb1ded713ca554a470bd2f`)
**Evidence location:** `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260809-final-v7w/`

## Authority and execution

The owner supplied the exact approval wording recorded in the v7w authorization package. Immediately before materialization, the plan digest, Node identity, sandbox identity, CBM identity, network-isolation self-test, pinned source roots, source-state hash, subject partition, and write containment were reverified. The recomputed plan digest remained exactly the approved digest.

The approved plan was materialized once and executed once. The approval is consumed and must not be reused. The run directory is immutable evidence and must not be deleted, overwritten, repaired in place, or re-executed.

Graphify remained excluded and no Graphify process was invoked. No model-mediated evaluation, default client registration, scheduler activation, Mind source, or credential was used.

## Execution result

| Subject | Pass | Error | Timeout | Result |
|---|---:|---:|---:|---|
| `exact-source` | 10/10 | 0 | 0 | PASS |
| `cbm` | 0/10 | 10 | 0 | ERROR |
| **Total** | **10/20** | **10** | **0** | **PARTIAL / REJECTED** |

All CBM fixtures failed closed with the same observed condition:

```text
marker not visible after reindex: unknown
```

The executor also recorded that required CBM measurements were missing for all three repositories and that child resource measurements were incomplete or invalid. Exact-source achieved file accuracy `1.0`, line accuracy `0.8`, set accuracy `1.0`, caller recall `1.0`, callee recall `1.0`, and caller/callee F1 `1.0`.

This disposition does not claim an exact provider root cause. The immutable evidence proves a post-reindex marker-visibility failure across every CBM fixture; it does not distinguish whether the defect is in provider indexing, the query path, or marker validation. Any investigation or repair requires a separate task and a new canonical authorization cycle before another run.

## Evidence validation

Canonical command:

```bash
/Users/Office/.nvm/versions/node/v20.20.2/bin/node \
  tools/validate-b8-1-benchmark-evidence.mjs \
  --evidence=/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260809-final-v7w/evidence.json \
  --manifest=operations/specs/b8-1-context-memory-benchmark-manifest.json \
  --run-dir=/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260809-final-v7w
```

**Result:** INVALID (exit 1).

Validation failed because CBM CPU/RSS values were null, `resourceProvenance` was absent, and `repositoryMetrics` had no entries for `brain`, `workbench`, or `prochat`. The evidence also contains schema-disallowed properties emitted on the failed aggregate paths. Required evidence is therefore structurally incomplete and cannot support B8.1 acceptance.

## Acceptance and stop-gate disposition

| Requirement | Evidence | Result |
|---|---|---|
| Valid schema-bound evidence | Canonical validator exit 1 | FAIL |
| CBM file accuracy ≥ 90% | `0.0` | FAIL |
| CBM line accuracy ≥ 80% | `0.0` | FAIL |
| Caller/callee F1 ≥ 0.75 | unavailable for CBM | FAIL |
| Initial indexing ≤ 10 seconds/repository | required CBM repository metrics absent | FAIL |
| Incremental refresh ≤ 500 ms | required CBM repository metrics absent | FAIL |
| Peak RSS ≤ 512 MB | required CBM measurement absent | FAIL |
| Source mutations | before/after source-state files byte-identical | PASS |
| Persistent processes | cleanup: zero orphans; no CBM process remains | PASS |
| Graphify disposition | excluded; not invoked | PASS |

Owner acceptance of `partialEvidence=true` authorized the two-subject execution with Graphify excluded. It did not waive the selected CBM subject's evidence requirements, and the benchmark plan independently states that partial evidence does not complete B8.1 or authorize B8.2.

## Safety and rollback verification

- Source-state before/after SHA-256: `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` (exact equality).
- All three persistent pinned source roots remain at their approved commits with clean worktrees.
- No `.codebase-memory/` directory appeared in any persistent source root.
- Cleanup receipt: `outcome=clean`, `orphanedProcesses=0`, no terminated PID required.
- No CBM process remains after execution.
- No default provider activation, client registration, watcher, or scheduler was created.
- Mind Context remains healthy, read-only, mutation-free, and at the expected Mind commit with zero working changes in admitted scopes.
- Cross-repository bridge contract validation remains `pass`.

Rollback requires no mutation: preserve the run, keep Codebase Memory in candidate/non-default state, keep ordinary exact-source reads as the fallback, and do not advance B8.2.

## Immutable artifact hashes

| Artifact | SHA-256 |
|---|---|
| `run-plan.json` | `e3e9120eeb40ce71b1b36e90d40f15ca6ce702dac77020061131234d33901e48` |
| `preflight-receipt.json` | `e3e9120eeb40ce71b1b36e90d40f15ca6ce702dac77020061131234d33901e48` |
| `source-state-before.json` | `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` |
| `source-state-after.json` | `0fe72e6f348e63401003e414f073133ab5ad3eac2daaad2b48ac8940105537e8` |
| `cleanup-manifest.json` | `d1bbb36ddd60c93984615390c69d252fa8dc91c0c2b2712d5600b4081b174771` |
| `evidence.json` | `ff36efca08deb8e38fa126c07cb29f70112328c6f718801266e0b2fdfdd88e85` |
| `execution-receipt.json` | `5a7160c292564c7aa667b4f83731f3c9d871ff8f002daf1e817b908cbed8d588` |
| `cleanup-receipt.json` | `c85ba9e96cdb49aeff598e1ce873279719ce90320a0f9f418328ed4fd2c71e2c` |
| 20 fixture-evidence files (sorted relative-path checksum set) | `f4a0d4d00c29dfaa314ad2d73494a8d6e25dd19111e64db68ae633995a8cfac7` |

## Canonical status

- B8.1: incomplete after rejected v7w run.
- P8: `0/6` accepted.
- B8.2–B8.6: blocked by the failed B8.1 evidence gate.
- Codebase Memory MCP: remains candidate/non-default.
- Exact-source: remains the ordinary bounded fallback.
- Graphify: remains excluded and separately blocked.
- Current execution authority: none.

No retry, provider repair, altered subject set, threshold change, or new plan is authorized by this disposition.
