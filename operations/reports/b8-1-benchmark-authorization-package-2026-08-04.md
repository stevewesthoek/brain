# B8.1 Benchmark Authorization Package — 2026-08-04

> **v4 CONTRACT NOW ACTIVE (feature/b8-1-final-readiness-v2)**
> The v4 plan contract (`planVersion: '4.0.0'`) is implemented on branch `feature/b8-1-final-readiness-v2`.
> v1, v2, and v3 digests are now **INVALID** and rejected by the v4 harness and executor.
> A new v4 digest must be computed at actual preflight time using the v4 contract.
> See `operations/reports/b8-1-canonical-plan-v4-2026-08-04.json` for the v4 structure.

> **v3 DIGEST NOW STALE**: v3 digests from `feature/b8-1-executor-v3` are rejected by the v4 contract.
> Recompute against v4 (`planVersion: '4.0.0'`) using the updated preflight harness.

> **SOURCE ROOT CORRECTION**: An earlier version of this document implied source roots were cleaned up after the v2 dry-run. This was **incorrect**. Persistent source worktrees exist at `/Users/Office/.brain/benchmark/b8-1/source-roots/` and should be preserved. Source roots are persistent benchmark inputs, not ephemeral artifacts. See `operations/specs/b8-1-source-root-hardening.md`.

> ~~**SUPERSEDED DIGEST (INVALID — v1)**~~: ~~`dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`~~
> This digest was computed with ephemeral `/tmp/` source root paths.

> ~~**SUPERSEDED DIGEST (INVALID — v2)**~~: ~~`1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`~~
> This digest was computed with absolute brain-b8-1-authorization worktree paths. Both v1 and v2 digests are path-dependent and **rejected by the v3 contract**.

## Status

**v4 contract ready — v4 digest not yet computed.** The bounded executor (v4.0.0) and v4 plan harness are on `feature/b8-1-final-readiness-v2`. A new preflight run is required to compute the v4 digest before any execution or approval. No materialization, benchmark execution, or approval has occurred.

v4 changes from v3: dual-subject execution (all selectedSubjects run per fixture), real CBM subprocess adapter, exact-source full verification scoring, aggregate evidence.json, timer leak fix, contract version bump to 4.0.0, evidence validator v4 plan layout support.

## 1. Brain Main SHA

```
57b2bd3cca7bd31412cbb55a4911f7e53047a9d7
```

## 2. Manifest and Schema Hashes

| Artifact | SHA-256 |
|----------|---------|
| Manifest (`b8-1-context-memory-benchmark-manifest.json`) | `91805c0a67d923e42ee090119140ad2591e0ed179d16e9f7ee2e3e03d1edd6f7` |
| Manifest Schema (`b8-1-context-memory-benchmark-manifest.schema.json`) | `b2c10030cbc7e937f92a03db4245b7b65132bfa1621d83fbba27fa667c4a6ecc` |
| Evidence Schema (`b8-1-context-memory-benchmark-evidence.schema.json`) | `62fa2b034037b391be094564475f4d9f079a95fae78d602db0092c22a94128a1` |

## 3. Source Repository Pins

| Repository | Pinned Commit | Deterministic Source Root (v2) |
|------------|---------------|-----------------------|
| brain | `257fd72c3f47a53afb23778ed860976fd2429c71` | `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/257fd72c3f47a53afb23778ed860976fd2429c71` |
| workbench | `f482851457c4505bcbf98dd02c469728f61ab427` | `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/f482851457c4505bcbf98dd02c469728f61ab427` |
| prochat | `e404821bfeef0868fef9f42a14ede4926aabe6ef` | `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/e404821bfeef0868fef9f42a14ede4926aabe6ef` |

Source roots are deterministic clean detached worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/`.
Created by `tools/lib/b8-1-prepare-source-roots.mjs` — idempotent, uses local git object stores only, no network clones.

Source-state hash (v2, path-independent): `sha256:90175b96d5c8a9fbf182a3db2703a3a09ab7b2b94bbeb0849b05ce62a12a4207`

Tree SHA-256 by repository:
| Repository | exportedTreeSha256 |
|------------|-------------------|
| brain | `700af12c676d56869e410fbfbdd635163b02b4e51e3386f0e4ea83b8f9d99163` |
| prochat | `fe2ea1b584153d5b8eeb7c17e858789807c6cabff483a0049eaf9ecfc72e8562` |
| workbench | `067c28d2216cc4b21c29e6233122d7ca201ce7eade7fcf56729a371335a407bb` |

## 4. Fixture Validation Results

Manifest validator: **PASS** — 10 fixtures across 3 repos validated against clean detached source roots at exact pinned commits.

Test results (v2, with new T52–T59 tests):
- `validate-b8-1-benchmark-manifest.test.mjs`: 38 pass, 0 fail
- `prepare-b8-1-context-memory-benchmark.test.mjs`: 59 pass, 0 fail
- `validate-b8-1-benchmark-evidence.test.mjs`: 36 pass, 0 fail

## 5. Selected and Excluded Subjects

| Subject | Status |
|---------|--------|
| `cbm` | Selected |
| `exact-source` | Selected |
| `graphify` | **Excluded** — bounded code-only invocation remains blocked |

`partialEvidence`: **true** (Graphify excluded)

## 6. Graphify Disposition

**Graphify remains blocked.** See `operations/reports/b8-1-graphify-benchmark-disposition-2026-08-04.md`.

No P8-specific Graphify executable contract exists on main. The M7.1 one-shot baseline does not grant ongoing authority. This run yields partial B8.1 evidence only.

## 7. Plan SHA-256

> **v2 and v1 digests are now INVALID — rejected by v3 contract.** Recompute using the v3 preflight harness on `feature/b8-1-executor-v3`.

~~**v2 (INVALID — path-dependent, rejected by v3 contract):**~~
~~`1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`~~

~~Run ID: `b8-1-canonical-authorization-20260804-v2`~~

~~Canonical plan artifact: `operations/reports/b8-1-canonical-plan-v2-2026-08-04.json`~~

~~v1 (INVALID — path-dependent, do not use): `dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`~~

~~**v3 (INVALID — stale, rejected by v4 contract):**~~
~~`COMPUTED_AT_PREFLIGHT`~~

~~Run ID: `b8-1-canonical-authorization-20260804-v3`~~

~~v3 plan structure: `operations/reports/b8-1-canonical-plan-v3-2026-08-04.json`~~

**v4 (pending — compute at next preflight run):**
```
COMPUTED_AT_PREFLIGHT
```

Run ID: `b8-1-canonical-authorization-20260804-final-v4`

v4 plan structure: `operations/reports/b8-1-canonical-plan-v4-2026-08-04.json`

## 8. Execution-Readiness Result

> Updated for v3: executionReady status applies to v3 preflight only. v2 status below is superseded.

~~v2 result (superseded):~~
```json
{
  "executionReady": true,
  "materialized": false,
  "blockingChecks": [],
  "runId": "b8-1-canonical-authorization-20260804-v2"
}
```

All 12 preflight checks passed in v2 run. 1 subject excluded (Graphify). v3 execution-readiness must be re-verified.

## 9. Resource and Disk Gates

- Disk budget: minimum 2000 MB available (verified via `df`)
- Planned write containment: 21 paths confined to `/Users/Office/.brain`
- Run directory: `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260804-v2`

## 10. Network-Isolation Proof

| Component | Identity |
|-----------|----------|
| Adapter | `/usr/bin/sandbox-exec` (sha256: `8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16`) |
| Runtime | Node.js v25.9.0 (`/opt/homebrew/Cellar/node/25.9.0_1/bin/node`, sha256: `a46ed02589ca3af795237111ff854262064f8ff5c5b58d75c1509f37311eb15e`) |
| Child script | `tools/lib/b8-1-network-isolation-child.mjs` (sha256: `207a19ce264c25b3944264879d15b96dca46bfe4397468df956248f41fbd06db`) |
| Profile | `operations/specs/b8-1-network-deny.sb` (sha256: `bd1de96bd9906950492a3d919ada1dfc6dfefd60780c7b242f87e6689c4f675a`) |

Self-test result:
- Control (unsandboxed) connection: **succeeded**
- Sandboxed child: **started**
- Sandboxed connection: **denied with EPERM**

## 11. Privacy and No-Mutation Guarantees

- All writes confined to `/Users/Office/.brain/benchmark/` (user-owned, non-shared)
- Source repositories are read-only during benchmark
- No network access from benchmark child processes (sandbox-exec enforced)
- No Mind content modification
- No user configuration modification
- No provider binary or cache modification
- No scheduler or Graphify runtime state modification
- Source-state fingerprints verified before and after (hash binding)

## 12. Materialization Layout

```
/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260804-v2/
├── _archive_brain.tar
├── _archive_prochat.tar
├── _archive_workbench.tar
├── cleanup-manifest.json
├── evidence/
├── logs/
├── preflight-receipt.json
├── run-plan.json
├── source-state-after.json
├── source-state-before.json
├── sources/
│   ├── brain/
│   ├── prochat/
│   └── workbench/
└── subjects/
    ├── cbm/
    │   ├── cache/
    │   └── config/
    └── exact-source/
```

## 13. Rollback and Cleanup Process

1. If materialization fails: `cleanup-manifest.json` lists every created path; recursive delete of the run directory removes all artifacts.
2. If benchmark fails mid-execution: same cleanup manifest; source repositories are never modified (read-only mounts via tar archive extraction).
3. The run directory is entirely within `/Users/Office/.brain/benchmark/` — deleting it is safe and complete cleanup.
4. Source-state-after fingerprint must match source-state-before; mismatch indicates a bug requiring investigation.

## 14. Known Limitations

1. **Partial evidence only** — Graphify excluded; B8.1 cannot be marked complete without separate authorization.
2. **Brain pin is behind main** — Manifest pins Brain at `257fd72c` (older than current main `57b2bd3c`). This reflects the manifest's original fixture targets and is intentional.
3. **Workbench and ProChat pins may be stale** — These pins are not refreshed unless fixtures fail. They represent the validated snapshot for this benchmark.
4. **No warm cache** — CBM starts cold against the source archives. This is intentional for reproducibility.
5. **macOS sandbox-exec only** — Network isolation uses `sandbox-exec` which is macOS-specific. Not portable.

## 15. No Approval or Execution Occurred

This document records a dry-run plan and digest only. The following have NOT happened:

- No benchmark materialization (`--materialize` was not invoked)
- No benchmark execution
- No CBM indexing or provider process startup
- No Graphify invocation
- No source checkout beyond disposable read-only worktrees (cleaned up)
- No writes to `/Users/Office/.brain/benchmark/`
- No approval of the plan digest
- No update to P8 status (remains 0/6)

## 16. Required Approval Wording

To authorize execution of this benchmark plan, Steve must provide:

```
I approve B8.1 benchmark execution with plan digest
1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda
for run-id b8-1-canonical-authorization-20260804-v2.
Subjects: cbm, exact-source. Graphify excluded.
Partial evidence accepted.
```

Upon receiving this approval:
1. Run `--materialize` with the same source-root overrides (deterministic paths under `/Users/Office/.brain/benchmark/b8-1/source-roots/`).
2. Execute the benchmark within the materialized run directory.
3. Validate evidence against the evidence schema.
4. Update B8.1 status to reflect partial completion.

The canonical plan artifact is committed at `operations/reports/b8-1-canonical-plan-v2-2026-08-04.json`.

---

## CBM Binary Identity

| Field | Value |
|-------|-------|
| Stable path | `/Users/Office/.local/bin/codebase-memory-mcp` |
| Resolved path | `/Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp` |
| Version | `v0.9.0` |
| SHA-256 | `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6` |

## Graphify Governance

| Field | Value |
|-------|-------|
| Governance path | `operations/specs/graphify-transition-governance.json` |
| Governance SHA-256 | `25b5af6579f4e6d6bf062c7ca3d501aeef4f548aa03fad9710880eba25b73086` |
| Profile path | `operations/specs/graphify-operational-profiles.json` |
| Profile SHA-256 | `8a9f1b142c005ae1cc9a1196e3339ef681ed663fb039c1ccf41eb51002e1f202` |
