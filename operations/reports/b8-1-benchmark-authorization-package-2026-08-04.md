# B8.1 Benchmark Authorization Package — v7r

**Status:** authorization-ready; not materialized; not executed
**Verified:** 2026-08-07
**Owner:** Brain operations

## Canonical approvable contract

The sole approvable B8.1 contract is **v7r / 7.1.0**.

- Plan: `operations/reports/b8-1-canonical-plan-v7r-2026-08-07.json`
- Dry-run receipt: `operations/reports/b8-1-dry-run-receipt-v7r-2026-08-07.json`
- Run ID: `b8-1-canonical-authorization-20260806-final-v7r`
- Plan version: `7.1.0`
- Executor version: `7.1.0`
- Evidence schema: `3.0.0`
- Manifest schema: `1.1.0` contract
- Plan SHA-256: `0eec69c1befd7ce11f359fe53aef4f033dbb38a5f767f73bad2800b8db37efa0`
- Selected subjects: `cbm`, `exact-source`
- Excluded subject: `graphify`
- `partialEvidence=true`
- `executionReady=true`
- Blocking checks: none

Independent verification:

```bash
node tools/verify-b8-1-plan-digest.mjs operations/reports/b8-1-canonical-plan-v7r-2026-08-07.json
```

Expected result:

```text
PASS  planSha256: 0eec69c1befd7ce11f359fe53aef4f033dbb38a5f767f73bad2800b8db37efa0
```

## Source bindings

The dry-run used only the approved persistent clean source roots:

| Repository | Pinned commit | Source root |
|---|---|---|
| brain | `f683edff753937944018dd00bf5494c85f62e881` | `/Users/Office/.brain/benchmark/b8-1/source-roots/brain/f683edff753937944018dd00bf5494c85f62e881` |
| workbench | `bc4908613f23f6d818b60fe9a4b4945efa537ec2` | `/Users/Office/.brain/benchmark/b8-1/source-roots/workbench/bc4908613f23f6d818b60fe9a4b4945efa537ec2` |
| prochat | `85087d54f712b1333be7c620f23b6bcac9cde90b` | `/Users/Office/.brain/benchmark/b8-1/source-roots/prochat/85087d54f712b1333be7c620f23b6bcac9cde90b` |

All three source roots passed exact-commit, clean-state, and exported-tree binding.

## Preflight result

The canonical v7r dry-run completed with 12 passing checks, one excluded-subject check, and zero blockers:

- source-root-overrides: PASS
- manifest-validation: PASS — 10 fixtures / 3 repositories
- pinned-commit:brain: PASS
- pinned-commit:workbench: PASS
- pinned-commit:prochat: PASS
- run-id-valid: PASS
- cbm-binary-identity: PASS
- network-isolation: PASS
- graphify-subject: EXCLUDED-SUBJECT
- exact-source-ready: PASS
- disk-budget: PASS — minimum 2000 MB available
- planned-write-containment: PASS — confined to `/Users/Office/.brain`
- source-state-binding: PASS

No benchmark run directory was created.

## Measurement contract

v7r removes the invalid v6r/v7 measurement shortcuts.

- Exact-source fixtures execute in bounded child processes through `runChildWithTimeMetrics`.
- Exact-source CPU and peak RSS come from measured child samples, not the parent executor.
- CBM initial index, incremental re-index, and marker-query CPU/RSS/provenance come from `runIncrementalReindex` child measurements.
- Required measurements fail closed on invalid exit, timeout, truncation, orphaned process group, missing provenance, invalid CPU/RSS, visibility failure, cache failure, or restoration failure.
- Exact-source uses typed N/A only for initial index time, refresh latency, and index disk bytes.
- No `_resourceMeasurements`, `_cbmIndexTimes`, `cbmRefreshTimes`, zero fallback, or fabricated resource evidence is approvable.

`implementationIdentity` binds the executor, evidence validator, scorer, metric collector, process sampler, incremental-reindex module, exact-source worker, plan-digest module, evidence schema, and manifest schema by SHA-256.

## Validation

The exact v7r implementation passed all six focused B8.1 suites:

- executor: 63
- process metrics: 18
- CBM incremental re-index: 29
- evidence validator: 46
- preflight/plan: 74
- manifest: 38
- **Total: 268 pass, 0 fail**

The emitted plan independently verifies with the shared digest contract. The plan and dry-run receipt carry the same run ID and digest.

## CBM identity and network isolation

- CBM stable path: `/Users/Office/.local/bin/codebase-memory-mcp`
- CBM resolved path: `/Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp`
- CBM version: `v0.9.0`
- CBM SHA-256: `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`
- Network adapter: `/usr/bin/sandbox-exec`
- Adapter SHA-256: `8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16`
- Network deny profile SHA-256: `bd1de96bd9906950492a3d919ada1dfc6dfefd60780c7b242f87e6689c4f675a`
- Self-test: control connection succeeded; sandboxed child started; connection denied with `EPERM`.

## Graphify disposition

Graphify remains excluded. The contained M7.1 baseline does not grant a B8.1 production benchmark contract. No Graphify process was invoked by this authorization dry-run. Evidence remains partial by design.

## Historical and stale approvals

Only the v7r digest above is approvable. All earlier approval digests are historical and invalid for a new run:

- v1 `dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4`
- v2 `1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda`
- v4 `40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0`
- v4r `c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4`
- v5 `d9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42`
- v5r `87c0569a3b643cf628684b10b95ee76f0f2edc6fc2aa2261904075bec3b6ce3f`
- v5s `47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0`
- v6 `ac5b3c79a9cce3e2463dceac8097dada7bb883f313ebef5e696078296a1359dc`
- v6r `44ebf1c49863d4cacaa6d26af348781473440f43b774ea69f52ae0aab6cc100d`
- claimed but never established incomplete-plan digest `331695165eb9dd91b061efc414d7a4e9711828d581c4c46511dea1c5812038e2`

The v5s execution from 2026-08-05 remains immutable infrastructure evidence: run `b8-1-canonical-authorization-20260805-final-v5s`, 17/20 passed, but the owner rejected it as insufficient for B8.1 completion.

## Current roadmap truth

B8.1 is **authorization-ready but incomplete**. P8 remains **0/6 accepted**. B8.2 remains blocked pending one owner-approved v7r materialization/execution, evidence validation, and owner disposition. Graphify remains excluded.

## No approval or execution has occurred

This package records dry-run authorization artifacts only:

- no `--materialize` invocation;
- no benchmark execution;
- no B8.1 run directory;
- no CBM benchmark indexing run;
- no Graphify invocation;
- no Mind mutation;
- no owner approval consumed;
- no P8 task accepted complete.

## Required owner approval wording

To authorize the exact v7r benchmark, the owner must provide:

```text
I approve B8.1 benchmark execution with plan digest
0eec69c1befd7ce11f359fe53aef4f033dbb38a5f767f73bad2800b8db37efa0
for run-id b8-1-canonical-authorization-20260806-final-v7r.
Subjects: cbm, exact-source. Graphify excluded.
Partial evidence accepted.
```

After receiving that exact approval, independently reverify the plan digest and materialize only with the same source-root overrides and exact approved digest. Execution and evidence disposition remain separate subsequent steps.
