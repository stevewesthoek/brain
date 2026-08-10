# B8.1 Contract V2 — Formal Blocker Report

## Final Status

**BRAIN ROADMAP P8: BLOCKED AT B8.1**

B8.1 Contract V2 canonical execution completed truthfully and was REJECTED.
Downstream milestones B8.2–B8.6 are blocked. The Brain roadmap cannot close.

## Disposition

| Field | Value |
|-------|-------|
| Run ID | `b8-1-v2-canonical-authorization-20260810-final-v1` |
| Contract Version | B8.1-V2 |
| Disposition | **REJECTED** |
| Executed At | 2026-08-10T11:39:42.302Z |
| Duration | 176s (5 repetitions × 3 repositories) |
| Run ID Status | **Consumed — cannot be rerun** |

## Failed Gates

| Gate | Threshold | Measured | Status |
|------|-----------|----------|--------|
| `coldRss` | ≤ 1536 MiB | 1565–1610 MiB (brain) | FAIL |
| `requiredHeadroom` | ≤ 1382.4 MiB (1536 × 0.9) | 1565–1610 MiB (brain) | FAIL |
| `requiredPassingRuns` | 5/5 | 0/5 | FAIL (consequence) |

## Passing Gates (all other gates)

All accuracy, coverage, structural, isolation, lifecycle, and cleanup gates passed:
- Aggregate coverage: ≥ 97%
- File accuracy: brain=1.0, workbench=1.0, prochat=0.75
- Caller/callee F1: 1.0
- Set outcome accuracy: 1.0
- Exact-source accuracy: 1.0
- Fallback accuracy: 1.0
- Network isolation: 4/4 self-tests passed
- Repository isolation: passed
- Process cleanup: passed

## Root Cause

The `codebase-memory-mcp` v0.9.0 provider cold-start indexing of the brain
repository (`f683edff`) consistently uses 1565–1610 MiB peak RSS. This exceeds
the V2 manifest budget of 1536 MiB (maximumPeakRssMiB).

The rehearsal from earlier the same day measured peak 1111 MiB — suggesting the
measurements are sensitive to system memory pressure, OS page cache state, or
concurrent processes. The canonical execution ran under higher load.

## Resolution Options

To unblock B8.1, one of:

1. **Raise the budget** — update `operations/specs/b8-1-v2-context-memory-benchmark-manifest.json`
   to increase `resourceBudget.coldStart.maximumPeakRssMiB` (e.g. to 2048 MiB).
   Requires a new plan, new plan digest, and new owner authorization.

2. **Reduce provider memory** — investigate why the brain repository indexing
   sometimes peaks above 1536 MiB and fix upstream in codebase-memory-mcp.

3. **Retry under lower system load** — issue a new run ID and authorization.
   The current run ID (`b8-1-v2-canonical-authorization-20260810-final-v1`) is
   permanently consumed per V2 single-use semantics.

## Evidence Artifacts

- Disposition: `operations/reports/b8-1-v2-evidence/disposition.json`
- Raw evidence: `operations/reports/b8-1-v2-evidence/b8-1-v2-canonical-evidence-REJECTED.json`
- Preflight receipt: `operations/reports/b8-1-v2-evidence/preflight-receipt.json`
- Canonical executor: `tools/execute-b8-1-v2-canonical.mjs`
- Tests: `tools/execute-b8-1-v2-canonical.test.mjs` (15/15 pass)

## Validation Summary

| Test Suite | Result |
|-----------|--------|
| V2 contract tests | 11/11 pass |
| Canonical executor tests | 15/15 pass |
| Infinite-brain conformance | 68/68 pass |
| Infinite-brain contract layers | 11/11 pass |
| Combined V2 + executor | 26/26 pass |

## Conclusion

**The exact new blocker is:** Brain repository cold-start peak RSS (1565–1610 MiB)
exceeds the V2 manifest budget cap (1536 MiB). B8.1 cannot pass until the budget
is raised, the provider memory usage is reduced, or a new authorization is issued
for a retry under favorable conditions.
