# B8.1 Benchmark Authorization Package — 2026-08-04

> **v5 CONTRACT ACTIVE (feature/b8-1-v5-current-head-readiness)**
> The v5 plan contract (`planVersion: '5.0.0'`, run-id suffix `final-v5`) is implemented on branch `feature/b8-1-v5-current-head-readiness`.
> Digests v1, v2, v4, v4r are **INVALID** and rejected by the harness and executor.
> See `operations/reports/b8-1-canonical-plan-v5-2026-08-04.json` for the v5 plan structure.

> ~~**INVALID — v1**~~: ~~`dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`~~ — ephemeral /tmp/ paths.
> ~~**INVALID — v2**~~: ~~`1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`~~ — absolute brain-b8-1-authorization worktree paths.
> ~~**INVALID — v4**~~: ~~`40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0`~~ — wrong env/sandbox/one-index contract (see v4r for corrections).
> ~~**INVALID — v4r**~~: ~~`c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4`~~ — run-id `b8-1-canonical-authorization-20260804-final-v4r`; stale pins brain 257fd72c/workbench f482851/prochat e404821; v5 supersedes.

## Status

**v5 ready — digest computed, executionReady=true.** The v5 executor and plan harness are on `feature/b8-1-v5-current-head-readiness`. No materialization, benchmark execution, or approval has occurred.

**Source roots**: Persistent clean worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/` exist and are preserved. They are benchmark inputs, not ephemeral. Previous docs that implied cleanup were wrong.

**v4r changes from v4**: CBM env uses `CBM_CACHE_DIR` (not `CODEBASE_MEMORY_HOME`); `auto_watch=false` set via `config set` then verified via `config get` (not via `CODEBASE_MEMORY_AUTO_WATCH` env which binary ignores); every CBM invocation sandbox-wrapped; one `index_repository` per repository per run (not per fixture); search limit raised to 50; unknown exact-source algorithms rejected; `file-name-count` root containment; RFC 6901 pointer unescaping; outcome vs lineCorrect semantics separated; caller/callee precision/recall implemented.

## 1. Brain Main SHA

```
f683edff753937944018dd00bf5494c85f62e881
```

## 2. Manifest and Schema Hashes

| Artifact | SHA-256 |
|----------|---------|
| Manifest (`b8-1-context-memory-benchmark-manifest.json`) | `4c90a1f38383c16cbb058d88273c32e73144211b6319b77b92764d71a49d4763` |
| Manifest Schema (`b8-1-context-memory-benchmark-manifest.schema.json`) | `b2c10030cbc7e937f92a03db4245b7b65132bfa1621d83fbba27fa667c4a6ecc` |
| Evidence Schema (`b8-1-context-memory-benchmark-evidence.schema.json`) | `62fa2b034037b391be094564475f4d9f079a95fae78d602db0092c22a94128a1` |

## 3. Source Repository Pins

| Repository | Pinned Commit | Deterministic Source Root (v2) |
|------------|---------------|-----------------------|
| brain | `f683edff753937944018dd00bf5494c85f62e881` | `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/f683edff753937944018dd00bf5494c85f62e881` |
| workbench | `bc4908613f23f6d818b60fe9a4b4945efa537ec2` | `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/bc4908613f23f6d818b60fe9a4b4945efa537ec2` |
| prochat | `85087d54f712b1333be7c620f23b6bcac9cde90b` | `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/85087d54f712b1333be7c620f23b6bcac9cde90b` |

Source roots are deterministic clean detached worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/`.
Created by `tools/lib/b8-1-prepare-source-roots.mjs` — idempotent, uses local git object stores only, no network clones.

Source-state hash (v5, path-independent): `sha256:a0af2027907af240ffc93f12ff8fe842a5405e9b0b894055acd9ac9bc64bb643`

Tree SHA-256 by repository (ls-files -s hash):
| Repository | exportedTreeSha256 |
|------------|-------------------|
| brain | `f81b67330848c94e33cd46a904c4417a2a01b85fd7bcc04c32eab921c6bd68f1` |
| prochat | `dabceaa1c4686927daf95c759c10c93df82f9f878252ac65d2cd645fb4037373` |
| workbench | `28ab4ae6b730d5117ccb9d423d95b3d2d85258605d8e030dda76fca71357b14d` |

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

All prior digests are INVALID. See header for the full stale-digest list.

**v5 (computed 2026-08-04 — feature/b8-1-v5-current-head-readiness):**
```
d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42
```

Run ID: `b8-1-canonical-authorization-20260804-final-v5`

v5 plan structure: `operations/reports/b8-1-canonical-plan-v5-2026-08-04.json`

Source roots used:
- brain: `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/f683edff753937944018dd00bf5494c85f62e881`
- workbench: `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/bc4908613f23f6d818b60fe9a4b4945efa537ec2`
- prochat: `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/85087d54f712b1333be7c620f23b6bcac9cde90b`

## 8. Execution-Readiness Result

**v5 result (2026-08-04, feature/b8-1-v5-current-head-readiness):**
```json
{
  "executionReady": true,
  "materialized": false,
  "selectedSubjects": ["cbm", "exact-source"],
  "excludedSubjects": ["graphify"],
  "blockingChecks": [],
  "runId": "b8-1-canonical-authorization-20260804-final-v5",
  "planSha256": "d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42"
}
```

All preflight checks passed. 1 subject excluded (Graphify). No run directory created (dry-run only).

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

All prior approval wording is invalid (digests v1/v2/v4/v4r are stale, rejected by v5 contract).

To authorize execution of this benchmark plan with the **v5 contract**, Steve must provide:

```
I approve B8.1 benchmark execution with plan digest
d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42
for run-id b8-1-canonical-authorization-20260804-final-v5.
Subjects: cbm, exact-source. Graphify excluded.
Partial evidence accepted.
```

Upon receiving this approval:
1. Run `--materialize` with the same source-root overrides (paths under `/Users/Office/.brain/benchmark/b8-1/source-roots/`).
2. Execute the benchmark within the materialized run directory.
3. Validate evidence against the evidence schema.
4. Update B8.1 status to reflect partial completion.

The canonical v5 plan structure is at `operations/reports/b8-1-canonical-plan-v5-2026-08-04.json`.

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
