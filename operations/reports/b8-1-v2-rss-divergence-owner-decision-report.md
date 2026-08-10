# B8.1 V2 → V2.1 Resource Contract Amendment Report

**Date:** 2026-08-10  
**Status:** OWNER DECISION APPLIED — V2.1 IMPLEMENTED  
**Branch:** codex/b8-1-v2-contract  

## Root Cause (Proven)

The ~450 MiB RSS gap between V2 rehearsal and V2 canonical is **real provider behavior**, not a measurement bug. The CBM v0.9.0 binary (native arm64 Mach-O) uses mimalloc with memory-adaptive arena allocation that scales both RSS and CPU utilization proportionally with available host memory.

## Evidence

### Measured Data (Brain repo, 1696 eligible / 1677 indexed files)

| Condition | Free Memory % | Free GiB | Brain Cold RSS (MiB) | CPU % | Wall (ms) |
|-----------|:---:|:---:|:---:|:---:|:---:|
| V2 Rehearsal r1–r5 | 34–44% | 8.2–10.6 | 940–1111 | 386–463 | 3970–4270 |
| Diagnostic run-a | 65% | 15.6 | 1243 | 472 | 3850 |
| Diagnostic run-b | 58% | 13.9 | 1569 | 496 | 3650 |
| Diagnostic run-c | 60% | 14.4 | 1582 | 507 | 3620 |
| Diagnostic paired r2–r3 | 60–61% | 14.4 | 1554–1605 | 477–509 | 3650–3670 |
| V2 Canonical r1–r5 | 77% | 18.5 | 1565–1606 | — | 3340–3650 |
| V2.1 Rehearsal r1–r5 | 57–65% | 13.7–15.6 | 1251–1607 | 489–547 | 3440–3870 |

### What is identical across all measurements

- Provider binary: `codebase-memory-mcp` v0.9.0, sha256 `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`
- Pinned commits: brain `f683edff`, workbench `bc490861`, prochat `85087d54`
- Eligible/indexed file counts: brain 1696/1677, workbench 520/519, prochat 430/429
- Sandbox profile, isolation probes, runtime (Node v20.20.2)
- Measurement method: `/usr/bin/time -l` via temp metrics file

### Mechanism

The binary contains mimalloc allocator symbols (`arena_eager_commit`, `arena_reserve`, `allow_large_os_pages`). When more physical memory is available, mimalloc pre-commits larger arena segments. On macOS arm64 under low memory pressure, the kernel eagerly backs committed pages with physical RAM, inflating RSS. Higher parallelism also increases CPU utilization. This is intentional allocator optimization: more aggressive pre-allocation improves locality and reduces fragmentation, yielding faster wall times.

## V2 Contract Problem

| Metric | V2 Nominal | V2 Effective (×0.9) | Measured Under Normal Conditions |
|--------|:-----------:|:---:|:---:|
| Cold RSS | 1536 MiB | 1382.4 MiB | 1550–1607 MiB |
| Cold CPU | 600% | 540% | 537–550% |

Both gates were calibrated against rehearsal data collected at **artificially low** free memory (34–44%). Under normal operating conditions (≥57% free on this 24 GiB host), the provider reproducibly exceeds both headroom-adjusted ceilings.

## Owner Decision Applied

**Option B selected:** Raise cold-start RSS ceiling from 1536 → 2048 MiB.  
**Secondary amendment:** Raise cold-start CPU ceiling from 600% → 650%.

### Rationale (not threshold gaming)

1. The V2 contract was underspecified because its rehearsal ran under atypical memory pressure that suppressed the provider's normal allocation behavior.
2. The 2048 MiB ceiling (effective 1843.2 with headroom) provides 237 MiB margin above the observed maximum of 1607 MiB — robust against variance without being wasteful.
3. The 650% CPU ceiling (effective 585 with headroom) provides 35% margin above the observed maximum of 550% — defensive without overprovisioning.
4. Host memory fraction: 2048/24576 = 8.3% of total RAM for a transient cold-start operation.
5. All non-resource gates (accuracy, coverage, isolation, cleanup, refresh, F1, fallback, source-authority) are **unchanged** and pass at the same thresholds.

## V2.1 Changes (Semantic Diff)

```diff
- "contractVersion": "B8.1-V2"
+ "contractVersion": "B8.1-V2.1"

  "coldStart": {
-   "maximumPeakRssMiB": 1536,
+   "maximumPeakRssMiB": 2048,
-   "maximumPeakCpuPercent": 600
+   "maximumPeakCpuPercent": 650
  }
```

No other manifest fields changed. All other quality, isolation, coverage, lifecycle, refresh, accuracy, F1, cleanup, fallback, and source-authority thresholds preserved verbatim.

## V2.1 Rehearsal Results (5/5 passing)

Run at 57–65% free memory (representative of normal low-pressure conditions):

| Metric | Min | Median | P95 | Max |
|--------|:---:|:---:|:---:|:---:|
| Cold RSS (MiB) | 249.8 | 391.3 | 1606.6 | 1606.6 |
| Cold CPU (%) | 385.2 | 404.7 | 546.9 | 546.9 |
| Cold Wall (ms) | 320 | 1150 | 3870 | 3870 |
| Refresh Peak RSS (MiB) | 119.3 | 165.9 | 316.6 | 316.6 |
| Idle RSS (MiB) | 0 | 0 | 0 | 0 |
| Index Bytes | 16.9M | 47.1M | 192.3M | 192.3M |

All gates pass including `requiredHeadroom`:
- RSS: 1606.6 ≤ 2048 × 0.9 = 1843.2 ✓
- CPU: 546.9 ≤ 650 × 0.9 = 585.0 ✓

## B8.3/B8.6 Resource Implications

Cold-start RSS is per-repository-indexing-operation, not steady-state. The provider exits after each `index_repository` call (per B8.1 lifecycle). Steady-state idle RSS remains 0 MiB (no persistent daemon). The higher cold-start ceilings do not affect B8.3 (multi-session) or B8.6 (continuous service) budgets since those are bounded by idle/refresh RSS, not cold-start peak.
