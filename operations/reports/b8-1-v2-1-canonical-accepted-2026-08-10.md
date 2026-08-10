# B8.1 Contract V2.1 canonical acceptance — 2026-08-10

## Canonical identity

- Run ID: `b8-1-v2-1-validation-fixed-20260810`
- Approved plan: `operations/reports/b8-1-v2-1-validation-fixed-plan-2026-08-10.json`
- Plan digest: `412bc36e81797f5069ba76de835ab52035befb1bbd14e591af052f2e91a76e9b`
- Runtime: Node `v20.20.2`
- Provider: `codebase-memory-mcp 0.9.0`, full mode, persistence false, auto-watch false
- Graphify: excluded from B8.1

## Result

`ACCEPTED`.

All five canonical repetitions completed. Canonical evidence validates against the V2.1 evidence schema and semantic validator after deterministic post-acceptance cleanup metadata recovery; the benchmark itself was not rerun during recovery.

Key canonical results:

- passing runs: `5/5`
- aggregate structural coverage: `2625/2646` eligible files (`99.2063%`), zero unknown files
- CBM file accuracy: `90%`
- CBM applicable line accuracy: `87.5%`
- mean reciprocal rank: `0.4944`
- set outcome accuracy: `100%`
- caller/callee F1: `100%`
- exact-source file/line accuracy: `100% / 100%`
- fallback accuracy: `100%`
- representative CBM initial indexing time: `3710 ms`
- representative CBM incremental refresh latency: `2380 ms`
- peak CBM CPU: `542.42%`
- peak CBM RSS: `1305.64 MiB`
- index disk: `250,679,296` bytes
- headroom gate: passed
- isolation controls: passed
- source restoration: passed
- process cleanup: passed

Canonical evidence:

- `operations/reports/b8-1-v2-evidence/b8-1-v2-canonical-evidence.json`
- `operations/reports/b8-1-v2-evidence/preflight-receipt.json`
- `operations/reports/b8-1-v2-evidence/disposition.json`

## Finalization recovery

The canonical executor completed all five repetitions and `buildGates()` returned `ACCEPTED`, but its first post-acceptance finalization attempt omitted schema-required `cleanupStatus.removedAt`. No benchmark metric or gate failed. The accepted raw evidence was preserved, the executor cleanup metadata path was repaired, and a finalize-only recovery tool validated the same accepted evidence, copied the final canonical evidence/receipt, removed the canonical run directory, and revalidated with filesystem cleanup enabled. `benchmarkRerun=false` is recorded in the canonical disposition recovery metadata.

The executor now also treats an accepted/rejected canonical disposition as a durable single-use receipt, preventing an accepted plan from being rerun after its temporary run directory is removed.

## Decision

B8.1 is complete and accepted. The measured structural default candidate for B8.2 is the unchanged installed `codebase-memory-mcp 0.9.0` in full mode with deterministic exact-source fallback. B8.2 may proceed to formal admission; B8.3–B8.6 remain dependency-gated.
