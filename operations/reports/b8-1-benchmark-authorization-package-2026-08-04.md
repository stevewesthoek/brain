# B8.1 Benchmark Authorization Package — 2026-08-04

> **v6r CONTRACT READY (2026-08-06)**
> The v6r plan contract upgrades the evidence schema to 2.1.0 with measured per-subject metrics (CPU, RSS, payload, tokenizer, operation count, repository metrics).
> It adds `implementationIdentity` to the plan digest, bounding all execution components by SHA-256.
> v5s was executed (17/20 pass) but rejected as insufficient for B8.1 completion.
> All prior digests (v1, v2, v4, v4r, v5, v5r, v5s, v6) are **INVALID** for new runs and rejected by the harness and executor.
> The v6r plan file will be at `operations/reports/b8-1-canonical-plan-v6r-2026-08-06.json` after dry-run execution.
>
> **v6 (STALE — superseded by v6r):** `ac5b3c79a9cce3e2463dceac8097dada7bb883f313ebef5e696078296a1359dc`
> Stale reason: missing `implementationIdentity`, missing `subjectMetrics`, uses deprecated `offlineMetrics`.

> ~~**INVALID — v1**~~: ~~`dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`~~ — ephemeral /tmp/ paths.
> ~~**INVALID — v2**~~: ~~`1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`~~ — absolute brain-b8-1-authorization worktree paths.
> ~~**INVALID — v4**~~: ~~`40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0`~~ — wrong env/sandbox/one-index contract (see v4r for corrections).
> ~~**INVALID — v4r**~~: ~~`c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4`~~ — stale pins brain 257fd72c/workbench f482851/prochat e404821; v5 supersedes.
> ~~**INVALID — v5**~~: ~~`d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42`~~ — path-dependent source-root-overrides check detail leaked physical paths; v5r supersedes.
> ~~**INVALID — v5r**~~: ~~`87c0569a3b643cf628684b10b95ee76f0f2edc6fc2aa2261904075bec3b6ce3f`~~ — Brain-worktree-local paths (networkDenyProfilePath, networkChildPath, graphifyProfilePath, graphifyGovernancePath) remained in plan file and digest fields; v5s supersedes.
> ~~**INVALID — v5s**~~: ~~`47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0`~~ — executed 2026-08-05 (17/20 pass), rejected as insufficient: missing per-subject metrics, harness defects (brain_f3 itemProperty, prochat_f2 null count); v6 supersedes.
> ~~**INVALID — v6**~~: ~~`ac5b3c79a9cce3e2463dceac8097dada7bb883f313ebef5e696078296a1359dc`~~ — missing `implementationIdentity`, missing `subjectMetrics`, uses deprecated `offlineMetrics`; v6r supersedes.

## Status

**v6r ready — executionReady=true, zero blockers, all tests pass.** The v5s contract was executed on 2026-08-05 (17/20 pass) but rejected by the owner as insufficient for B8.1 completion. The v5s run is preserved as immutable infrastructure evidence. The v6r contract corrects the identified defects and adds measured per-subject evidence.

**Contract versions for v6r:**
- Plan version: `6.0.0`
- Executor version: `6.0.0`
- Evidence schema version: `2.1.0`
- Manifest schema version: `1.1.0` (allows `1.0.0` and `1.1.0`)

**P8 status: 0/6 — B8.1 is incomplete, B8.2 blocked.**

**Source roots**: Persistent clean worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/` exist and are preserved. They are benchmark inputs, not ephemeral. No run directory was created.

**Canonical main SHA vs benchmark Brain pin**: The canonical `brain-next` `main` SHA at the time of v5s is `daa2537f86250e221ecc1ed92bca12be23ba26c6`. The benchmark Brain **pin** is `f683edff753937944018dd00bf5494c85f62e881` — an earlier commit that the manifest fixtures were written against and have been validated against. These are two different things. The manifest pin does not need to match `main`; fixtures are validated against the pinned commit only.

**v6r changes from v6**: Three upgrades — (1) `implementationIdentity` added to plan digest, bounding executor, evidence validator, scorer, metric collector, plan digest, evidence schema, and manifest schema by SHA-256; (2) evidence schema upgraded to `2.1.0` requiring `subjectMetrics` with all required fields (peakCpuPercent, peakRssMb, serializedPayloadBytes, tokenizer, retrievalOperationCount, repositoryMetrics) and forbidding `offlineMetrics`; (3) shared modules `tools/lib/b8-1-scoring.mjs` and `tools/lib/b8-1-metrics.mjs` created for subject-neutral scoring and metric collection.

**v6 changes from v5s**: Two harness defects fixed — (1) brain_f3 `json-pointer-set` fixture now has `itemProperty: "name"` (was missing); (2) prochat_f2 `file-name-count` fixture now has `expectedCount: 1` (was null). Executor version bumped to `6.0.0`. Plan version bumped to `6.0.0`. Evidence schema `2.0.0` added with `subjectMetrics` and per-subject typed metrics.

**v5s changes from v5r**: Three remaining defects fixed — (1) shared authoritative digest module `tools/lib/b8-1-plan-digest.mjs` created; all five B8.1 tools (preflight, executor, evidence validator, verifier, tests) import the same `computePlanDigest`, `canonicalize`, `KNOWN_STALE_DIGESTS`, and `projectForDigest`; (2) Brain-worktree-local paths (`childIdentity.path`, `profilePath` in `networkIsolationProof`; `profilePath`, `governancePath` in `graphifyStatus`) removed from the plan file and digest — content-addressable SHAs remain in the digest, paths moved to `runContext` for audit only; (3) explicit top-level field allowlist (`DIGEST_ALLOWED_TOP_LEVEL`) added to the shared module; the standalone verifier rejects unknown fields; test T72 verifies allowlist rejection. `planVersion` bumped to `5.1.0`.

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

Hashes are updated when schemas or manifest change. Current values for v6r:

| Artifact | Notes |
|----------|-------|
| Manifest (`b8-1-context-memory-benchmark-manifest.json`) | Compute via `sha256 operations/specs/b8-1-context-memory-benchmark-manifest.json` |
| Manifest Schema (`b8-1-context-memory-benchmark-manifest.schema.json`) | Now accepts `1.0.0` and `1.1.0` |
| Evidence Schema (`b8-1-context-memory-benchmark-evidence.schema.json`) | Now accepts `1.0.0`, `1.1.0`, `2.0.0`, `2.1.0` |

The exact hashes are computed by the preflight and bound into the plan digest.

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

## 4. Fixture Validation Results

Manifest validator: **PASS** — 10 fixtures across 3 repos validated against clean detached source roots at exact pinned commits.

Test results (v6r):
- `validate-b8-1-benchmark-manifest.test.mjs`: 38 pass, 0 fail
- `prepare-b8-1-context-memory-benchmark.test.mjs`: 72 pass, 0 fail
- `validate-b8-1-benchmark-evidence.test.mjs`: 46 pass, 0 fail
- `execute-b8-1-benchmark.test.mjs`: 58 pass, 0 fail
- **Total: 214 pass, 0 fail**

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

**v6r:** `44ebf1c49863d4cacaa6d26af348781473440f43b774ea69f52ae0aab6cc100d`

Run ID: `b8-1-canonical-authorization-20260806-final-v6r`

Independent verification: `node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v6r-2026-08-06.json`

## 8. Execution-Readiness Result

**v6r ready:**
```json
{
  "executionReady": true,
  "selectedSubjects": ["cbm", "exact-source"],
  "excludedSubjects": ["graphify"],
  "blockingChecks": [],
  "runId": "b8-1-canonical-authorization-20260806-final-v6r"
}
```

All preflight checks pass. 1 subject excluded (Graphify). No run directory created (dry-run only).

## 9. Resource and Disk Gates

- Disk budget: minimum 2000 MB available (verified via `df`)
- Planned write containment: confined to `/Users/Office/.brain`
- Run directory: `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260806-final-v6r`

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
/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-authorization-20260806-final-v6r/
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
6. **P8 0/6** — P8 has not advanced. B8.1 is incomplete (graphify excluded). B8.2 is blocked pending B8.1 completion.

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

All prior approval wording is invalid (digests v1/v2/v4/v4r/v5/v5r/v5s/v6 are stale, rejected by v6r contract).

To authorize execution of this benchmark plan with the **v6r contract**, Steve must provide:

```
I approve B8.1 benchmark execution with plan digest
44ebf1c49863d4cacaa6d26af348781473440f43b774ea69f52ae0aab6cc100d
for run-id b8-1-canonical-authorization-20260806-final-v6r.
Subjects: cbm, exact-source. Graphify excluded.
Partial evidence accepted.
```

Upon receiving this approval:
1. Verify independently: `node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v6r-2026-08-06.json`
2. Run `--materialize --approved-plan-sha256 44ebf1c49863d4cacaa6d26af348781473440f43b774ea69f52ae0aab6cc100d` with the same source-root overrides (paths under `/Users/Office/.brain/benchmark/b8-1/source-roots/`).
3. Execute the benchmark within the materialized run directory.
4. Validate evidence against the evidence schema (expects `schemaVersion: "2.1.0"` with `subjectMetrics`).
5. Update B8.1 status to reflect partial completion.

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

---

## Historical Runs

### v5s Execution — 2026-08-05 (Superseded)

The v5s contract was executed on 2026-08-05. Result: **17/20 pass**. Rejected as insufficient for B8.1 completion by the owner.

Rejection reasons:
1. Missing per-subject metrics (`subjectMetrics` absent, only `offlineMetrics`)
2. brain_f3 `json-pointer-set` missing `itemProperty: "name"` (fixture defect, caused false miss)
3. prochat_f2 `file-name-count` missing `expectedCount` (treated null as success, wrong)

v5s plan digest: `47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0` (STALE)
v5s run ID: `b8-1-canonical-authorization-20260805-final-v5s`
v5s plan file: `operations/reports/b8-1-canonical-plan-v5s-2026-08-05.json`

The v5s evidence (17/20 pass) is preserved as immutable infrastructure evidence and may be referenced in audits, but it does not satisfy B8.1 completion criteria.
