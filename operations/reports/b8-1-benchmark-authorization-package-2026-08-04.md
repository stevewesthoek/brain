# B8.1 Benchmark Authorization Package — 2026-08-04

> **v6 CONTRACT READY (2026-08-06)**
> The v6 plan contract corrects two harness defects identified in the v5s execution and upgrades the evidence schema to 2.0.0 with per-subject typed metrics.
> v5s was executed (17/20 pass) but rejected as insufficient for B8.1 completion.
> Digests v1, v2, v4, v4r, v5, v5r, and v5s are **INVALID** for new runs and rejected by the harness and executor.
> The exact emitted v6 plan is at `operations/reports/b8-1-canonical-plan-v6-2026-08-06.json`.
> Verified independently: `node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v6-2026-08-06.json`
>
> **v6 digest:** `ac5b3c79a9cce3e2463dceac8097dada7bb883f313ebef5e696078296a1359dc`

> ~~**INVALID — v1**~~: ~~`dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`~~ — ephemeral /tmp/ paths.
> ~~**INVALID — v2**~~: ~~`1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`~~ — absolute brain-b8-1-authorization worktree paths.
> ~~**INVALID — v4**~~: ~~`40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0`~~ — wrong env/sandbox/one-index contract (see v4r for corrections).
> ~~**INVALID — v4r**~~: ~~`c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4`~~ — stale pins brain 257fd72c/workbench f482851/prochat e404821; v5 supersedes.
> ~~**INVALID — v5**~~: ~~`d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42`~~ — path-dependent source-root-overrides check detail leaked physical paths; v5r supersedes.
> ~~**INVALID — v5r**~~: ~~`87c0569a3b643cf628684b10b95ee76f0f2edc6fc2aa2261904075bec3b6ce3f`~~ — Brain-worktree-local paths (networkDenyProfilePath, networkChildPath, graphifyProfilePath, graphifyGovernancePath) remained in plan file and digest fields; v5s supersedes.
> ~~**INVALID — v5s**~~: ~~`47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0`~~ — executed 2026-08-05 (17/20 pass), rejected as insufficient: missing per-subject metrics, harness defects (brain_f3 itemProperty, prochat_f2 null count); v6 supersedes.

## Status

**v6 ready — digest computed, executionReady=true, zero blockers, plan written and independently verified.** The v5s contract was executed on 2026-08-05 (17/20 pass) but rejected by the owner as insufficient for B8.1 completion. The v5s run is preserved as immutable infrastructure evidence. The v6 contract corrects the identified defects and is ready for approval.

**Source roots**: Persistent clean worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/` exist and are preserved. They are benchmark inputs, not ephemeral. No run directory was created.

**Canonical main SHA vs benchmark Brain pin**: The canonical `brain-next` `main` SHA at the time of v5s is `daa2537f86250e221ecc1ed92bca12be23ba26c6`. The benchmark Brain **pin** is `f683edff753937944018dd00bf5494c85f62e881` — an earlier commit that the manifest fixtures were written against and have been validated against. These are two different things. The manifest pin does not need to match `main`; fixtures are validated against the pinned commit only.

**v5s changes from v5r**: Three remaining defects fixed — (1) shared authoritative digest module `tools/lib/b8-1-plan-digest.mjs` created; all five B8.1 tools (preflight, executor, evidence validator, verifier, tests) import the same `computePlanDigest`, `canonicalize`, `KNOWN_STALE_DIGESTS`, and `projectForDigest`; (2) Brain-worktree-local paths (`childIdentity.path`, `profilePath` in `networkIsolationProof`; `profilePath`, `governancePath` in `graphifyStatus`) removed from the plan file and digest — content-addressable SHAs remain in the digest, paths moved to `runContext` for audit only; (3) explicit top-level field allowlist (`DIGEST_ALLOWED_TOP_LEVEL`) added to the shared module; the standalone verifier rejects unknown fields; test T72 verifies allowlist rejection. `planVersion` bumped to `5.1.0`.

**v5r changes from v5**: Five canonical-plan integrity defects fixed — (1) plan file is now an exact emitted plan produced by `--write-plan`, with no `BOUND_AT_PREFLIGHT` placeholders; (2) `computePlanDigest` correctly excludes `planSha256`, `createdAt`, `runContext`, and `_annotation` fields so independent recomputation is possible; (3) `source-root-overrides` check detail uses logical identity only (`repositoryId@pinnedCommit`), preventing physical path leakage into the digest; (4) docs updated to reference `main` instead of the feature branch; (5) digest `d9c524...` marked stale. New independent verifier `tools/verify-b8-1-plan-digest.mjs` added. `--write-plan <path>` flag added to CLI for atomic plan persistence.

**v4r changes from v4**: CBM env uses `CBM_CACHE_DIR` (not `CODEBASE_MEMORY_HOME`); `auto_watch=false` set via `config set` then verified via `config get`; every CBM invocation sandbox-wrapped; one `index_repository` per repository per run; search limit raised to 50; unknown exact-source algorithms rejected; `file-name-count` root containment; RFC 6901 pointer unescaping; outcome vs lineCorrect semantics separated; caller/callee precision/recall implemented.

## 1. Brain Main SHA vs Benchmark Brain Pin

**Canonical `brain-next` `main` HEAD (2026-08-05):**
```
daa2537f86250e221ecc1ed92bca12be23ba26c6
```

**Benchmark Brain pin (manifest fixture target — distinct from main HEAD):**
```
f683edff753937944018dd00bf5494c85f62e881
```

The benchmark pin is the commit against which the 10 manifest fixtures were written and validated. It is intentionally held fixed until there is a reason to update fixture targets.

## 2. Manifest and Schema Hashes

| Artifact | SHA-256 |
|----------|---------|
| Manifest (`b8-1-context-memory-benchmark-manifest.json`) | `4c90a1f38383c16cbb058d88273c32e73144211b6319b77b92764d71a49d4763` |
| Manifest Schema (`b8-1-context-memory-benchmark-manifest.schema.json`) | `b2c10030cbc7e937f92a03db4245b7b65132bfa1621d83fbba27fa667c4a6ecc` |
| Evidence Schema (`b8-1-context-memory-benchmark-evidence.schema.json`) | `62fa2b034037b391be094564475f4d9f079a95fae78d602db0092c22a94128a1` |

## 3. Source Repository Pins

| Repository | Pinned Commit | Persistent Source Root |
|------------|---------------|------------------------|
| brain | `f683edff753937944018dd00bf5494c85f62e881` | `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/f683edff753937944018dd00bf5494c85f62e881` |
| workbench | `bc4908613f23f6d818b60fe9a4b4945efa537ec2` | `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/bc4908613f23f6d818b60fe9a4b4945efa537ec2` |
| prochat | `85087d54f712b1333be7c620f23b6bcac9cde90b` | `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/85087d54f712b1333be7c620f23b6bcac9cde90b` |

Source roots are persistent clean detached worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/`. They were not cleaned up. Created by `tools/lib/b8-1-prepare-source-roots.mjs` — idempotent, uses local git object stores only, no network clones.

Source-state hash (v5s, path-independent): `sha256:a0af2027907af240ffc93f12ff8fe842a5405e9b0b894055acd9ac9bc64bb643`

Exported tree SHA-256 by repository (authoritative from v5s plan `sourceLogicalIdentity`):
| Repository | exportedTreeSha256 |
|------------|-------------------|
| brain | `dd66e105ae6311cb2d5081f8e0a44023248fed360546ee375329028d8f5e0b75` |
| prochat | `227e1360d09b674c93809cca4a9404e1fcf7bf7022b846f4fd758833e61c0907` |
| workbench | `abbb177d894374534d12a3625d0fa4f46c1ad6e20647de1121e90a14a402bc8c` |

These values are computed by the preflight harness (`git ls-files -s` hash) and recorded in the v5s `sourceLogicalIdentity` field. They differ from the earlier table in v5r, which was computed by a different algorithm.

## 4. Fixture Validation Results

Manifest validator: **PASS** — 10 fixtures across 3 repos validated against clean detached source roots at exact pinned commits.

Test results (v5s):
- `validate-b8-1-benchmark-manifest.test.mjs`: 38 pass, 0 fail
- `prepare-b8-1-context-memory-benchmark.test.mjs`: 72 pass, 0 fail
- `validate-b8-1-benchmark-evidence.test.mjs`: 36 pass, 0 fail
- `execute-b8-1-benchmark.test.mjs`: 46 pass, 0 fail (E36/E37 verified after plan generated)
- `validate-brain-document-consistency.test.mjs`: 39 pass, 0 fail
- `validate-mcp-runtime-truth.test.mjs`: 46 pass, 0 fail
- `validate-graphify-operational-profiles.test.mjs`: 6 pass, 0 fail
- `validate-deletion-readiness.test.mjs`: 63 pass, 0 fail
- **Total: 346 pass, 0 fail**

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

~~**v5 (STALE — path-dependent check detail; must not be approved):**~~
~~`d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42`~~

~~**v5r (STALE — Brain-worktree paths in plan file and digest fields; must not be approved):**~~
~~`87c0569a3b643cf628684b10b95ee76f0f2edc6fc2aa2261904075bec3b6ce3f`~~

**v5s (computed 2026-08-05 — main, fully path-independent, Brain-worktree paths absent, independently verified):**
```
47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0
```

Run ID: `b8-1-canonical-authorization-20260805-final-v5s`

Exact emitted plan: `operations/reports/b8-1-canonical-plan-v5s-2026-08-05.json`

Independent verification: `node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v5s-2026-08-05.json`

Source roots used:
- brain: `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/f683edff753937944018dd00bf5494c85f62e881`
- workbench: `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/bc4908613f23f6d818b60fe9a4b4945efa537ec2`
- prochat: `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/85087d54f712b1333be7c620f23b6bcac9cde90b`

## 8. Execution-Readiness Result

**v5s result (2026-08-05, main):**
```json
{
  "executionReady": true,
  "materialized": false,
  "selectedSubjects": ["cbm", "exact-source"],
  "excludedSubjects": ["graphify"],
  "blockingChecks": [],
  "runId": "b8-1-canonical-authorization-20260805-final-v5s",
  "planSha256": "47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0"
}
```

All preflight checks passed. 1 subject excluded (Graphify). No run directory created (dry-run only).

## 9. Resource and Disk Gates

- Disk budget: minimum 2000 MB available (verified via `df`)
- Planned write containment: 21 paths confined to `/Users/Office/.brain`
- Run directory: `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260805-final-v5s`

## 10. Network-Isolation Proof

| Component | Identity |
|-----------|----------|
| Adapter | `/usr/bin/sandbox-exec` (sha256: `8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16`) |
| Runtime | Node.js v25.9.0 (`/opt/homebrew/Cellar/node/25.9.0_1/bin/node`, sha256: `a46ed02589ca3af795237111ff854262064f8ff5c5b58d75c1509f37311eb15e`) |
| Child script | `tools/lib/b8-1-network-isolation-child.mjs` (sha256 in plan; path moved to `runContext`) |
| Profile | `operations/specs/b8-1-network-deny.sb` (sha256 in plan; path moved to `runContext`) |

Self-test result:
- Control (unsandboxed) connection: **succeeded**
- Sandboxed child: **started**
- Sandboxed connection: **denied with EPERM**

Note: the network child script path and sandbox profile path are Brain-worktree-local and are stored in `runContext` only (excluded from the digest). Their SHA-256 hashes remain in the digest fields and are content-addressable.

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
/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260805-final-v5s/
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
2. **Brain pin is behind main** — Manifest pins Brain at `f683edff` (older than current main `daa2537f`). This reflects the manifest's original fixture targets and is intentional.
3. **Workbench and ProChat pins may be stale** — These pins are not refreshed unless fixtures fail. They represent the validated snapshot for this benchmark.
4. **No warm cache** — CBM starts cold against the source archives. This is intentional for reproducibility.
5. **macOS sandbox-exec only** — Network isolation uses `sandbox-exec` which is macOS-specific. Not portable.

## 15. No Approval or Execution Occurred

This document records a dry-run plan and digest only. The following have NOT happened:

- No benchmark materialization (`--materialize` was not invoked)
- No benchmark execution
- No CBM indexing or provider process startup
- No Graphify invocation
- No source checkout beyond disposable read-only worktrees
- No run directory created (`~/.brain/benchmark/b8-1/runs/` not written)
- No approval of the plan digest
- No update to P8 status (remains 0/6)

## 16. Required Approval Wording

All prior approval wording is invalid (digests v1/v2/v4/v4r/v5/v5r are stale, rejected by v5s contract).

To authorize execution of this benchmark plan with the **v5s contract**, Steve must provide:

```
I approve B8.1 benchmark execution with plan digest
47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0
for run-id b8-1-canonical-authorization-20260805-final-v5s.
Subjects: cbm, exact-source. Graphify excluded.
Partial evidence accepted.
```

Upon receiving this approval:
1. Verify independently: `node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v5s-2026-08-05.json`
2. Run `--materialize --approved-plan-sha256 47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0` with the same source-root overrides (paths under `/Users/Office/.brain/benchmark/b8-1/source-roots/`).
3. Execute the benchmark within the materialized run directory.
4. Validate evidence against the evidence schema.
5. Update B8.1 status to reflect partial completion.

The exact emitted v5s plan (placeholder-free, Brain-worktree-paths absent) is at `operations/reports/b8-1-canonical-plan-v5s-2026-08-05.json`.

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
