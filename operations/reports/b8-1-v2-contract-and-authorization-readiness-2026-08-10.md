# B8.1 Contract V2 and authorization readiness

**Date:** 2026-08-10

**Status:** `B8.1 V2 READY — AWAITING OWNER APPROVAL`

**Scope:** dry-run authorization package only; no canonical materialization or execution

## 1. Status

The architecture-derived B8.1 Contract V2 is implemented, adversarially reviewed,
validated against five independent disposable runs, and ready for an exact owner
authorization decision. B8.1 is not accepted complete. B8.2–B8.6 remain blocked,
and P8 remains 0/6 accepted.

## 2. Architecture decision

The structural-memory design is one deterministic index/service per active
repository, or equivalent repository isolation, with incremental freshness and no
LLM in routine structural-graph construction. Structural memory is a navigation
aid. Exact source remains authoritative before edits and authoritative claims.

## 3. Contract replacement

Contract V2 (`B8.1-V2`, plan version `8.0.0`) supersedes the v7-series benchmark
contracts for any new authorization. Every prior plan digest and approval is stale
or consumed and cannot authorize Contract V2.

## 4. Subjects and exclusions

The selected subjects are `cbm` and `exact-source`. Graphify is excluded and is
outside the B8.1 Contract V2 architecture. Partial evidence is not accepted.

## 5. Repository scope and pins

The benchmark scope is the pinned Brain, Workbench, and ProChat repositories in
the Contract V2 manifest. Mind is not a benchmark subject or implementation path.
Each source pin must resolve exactly before materialization or execution.

## 6. Manifest and schemas

The authoritative contract artifacts are:

- `operations/specs/b8-1-v2-context-memory-benchmark-manifest.json`
- `operations/specs/b8-1-v2-context-memory-benchmark-manifest.schema.json`
- `operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json`
- `operations/specs/b8-1-v2-context-memory-benchmark-plan.md`
- `operations/specs/b8-1-v2-network-isolation.sb`

The implementation commit is
`25a66f1472c81780a629380270d6cce3ef4b2014`.

## 7. Coverage contract and result

Full indexing mode is mandatory. Minimum coverage is 95% per repository and 97%
aggregate, with zero unknown files. The definitive rehearsal measured:

| Repository | Indexed / eligible | Coverage | Unindexed | Unknown |
| --- | ---: | ---: | ---: | ---: |
| Brain | 1,677 / 1,696 | 98.8797% | 19 | 0 |
| Workbench | 519 / 520 | 99.8077% | 1 | 0 |
| ProChat | 429 / 430 | 99.7674% | 1 | 0 |
| Aggregate | 2,625 / 2,646 | 99.2063% | 21 | 0 |

Every unindexed eligible file must use the deterministic exact-source fallback and
receives no CBM structural credit.

## 8. Retrieval contract

Questions contain the observable retrieval patterns verbatim; the evaluator may
not use hidden oracle terms. Search is bounded to the first 20 results. Mean
reciprocal rank must be at least 0.10; the definitive rehearsal measured 0.4944.

## 9. Structural truth and scoring

Caller truth is evaluated as import consumers, call sites, or an explicit
no-caller outcome. Callee truth is evaluated as initializer dependencies,
body-code targets, or an explicit no-callee outcome. Set scoring uses one-to-one
matching. Required caller/callee F1 is at least 0.80; the rehearsal measured 1.0.

## 10. Exact-source and fallback authority

Exact-source validation first locates the target by the question-visible pattern
and then verifies its content. Both exact-source and unindexed fallback accuracy
must be 1.0; both gates passed. Generated trees are excluded; tests remain in
scope.

## 11. Resource contract

On the 24 GiB / 12-core M1 Pro, every repetition requires at least 20% free memory
and 20 GiB free disk at start. Cold indexing is limited to 30 seconds, 1,536 MiB
RSS, and 600% CPU. Refresh is limited to 5 seconds p95, 7.5 seconds maximum,
768 MiB RSS, and 300% CPU. Idle service limits are 256 MiB and 5% CPU; projected
simultaneous service RSS is 1,536 MiB. Each index is limited to 512 MiB. All five
runs must pass every gate with the contract's required 10% headroom.

## 12. Isolation contract

Seatbelt defaults deny IPv4, IPv6, and Unix sockets. The only admitted socket is
the provider's real, root-owned/current-UID, mode-0700, non-symlink directory at
`/private/tmp/cbm-daemon-<uid>`. Four controls prove IPv4 denial, IPv6 denial,
declared Unix admission, and outside-path Unix denial. This explicitly documents
the provider's same-UID owner-local trust boundary.

## 13. Provider-version comparison

| Provider | Identity | Disposable result | Decision |
| --- | --- | --- | --- |
| Installed stable | `codebase-memory-mcp 0.9.0`; SHA-256 `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6` | Five of five full-mode Contract V2 rehearsals passed | Retain and select |
| Newer candidate | `v0.9.1-rc.1`; archive SHA-256 `5a93a7a02a5de4f91d6d5ce4bc9a8dc471a0b141fdb9062dc1d5779205266996`; binary SHA-256 `e4fe1cf4f764308f19a65e98b6cc2fcad5d8996b0745af321e75aacfd0c9bb1b` | Full-Brain refresh was 8.25 seconds, above the 7.5-second maximum; per-command temporary-daemon lifecycle made child-only resource attribution invalid | Reject for B8.1 |

The release candidate was evaluated only in disposable diagnostic state. It was
not rescored after its hard lifecycle and provenance rejection. The installed
v0.9.0 binary and stable symlink were not replaced.

## 14. Selected provider identity

The authorization package binds
`/Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp`
in full mode, persistence disabled, and auto-watch disabled. Its SHA-256 is
`d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`.

## 15. Definitive disposable rehearsal

The identity-bound five-run report is:

`/Users/Office/.brain/benchmark/b8-1/diagnostics/b8-1-v2-rehearsal-v090-full-final-identity-v2-20260810/evaluation-report.json`

Its SHA-256 is
`6b2f4e6138229364f4eb8f1c8766e8c53da1e596560d2e163234cb6098bfd490`.
The diagnostic semantic validator returned valid with zero errors. This evidence is
diagnostic only and is not canonical B8.1 evidence.

## 16. Definitive metrics

Five of five runs passed. File accuracy was 0.90, applicable-line accuracy 0.875,
set-outcome accuracy 1.0, caller/callee F1 1.0, and aggregate coverage 0.9921.
Cold wall time was 0.42 / 1.25 / 4.27 / 4.27 seconds
(minimum/median/p95/maximum); peak cold RSS was 252.1 / 394.5 / 1,111.2 /
1,111.2 MiB. Refresh maxima were 2.71 seconds for Brain, 0.94 seconds for
Workbench, and 0.32 seconds for ProChat. Maximum refresh RSS was 334.0 MiB and
maximum index size was 218,345,472 bytes. All acceptance gates passed.

## 17. Evidence integrity

Each repetition has an independently hashed raw receipt. The semantic validator
recomputes gates rather than trusting aggregate claims, enforces exact repository
and fixture cardinalities, prevents failed-run masking, and binds manifest,
runtime, provider, evaluator, contract-validator, isolation, cleanup, and source
restoration identities.

## 18. Dry-run authorization package

The fresh dry-run-only package is:

`operations/reports/b8-1-v2-canonical-dry-run-plan-2026-08-10.json`

- Run ID: `b8-1-v2-canonical-authorization-20260810-final-v1`
- Plan digest: `d95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284`
- Node: `v20.20.2`; SHA-256 `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`
- Preflight: 15/15 checks pass
- Canonical materialization authorized: false
- Canonical execution authorized: false
- Planned canonical run directory: absent

## 19. Approval freshness

All v7w, v7x, v7y, and v7z approvals and digests are inapplicable to Contract V2.
Only an exact approval naming the run ID, plan digest, runtime, provider identity,
subjects, Graphify exclusion, and full-evidence requirement can authorize the next
materialization and execution.

## 20. Preserved boundaries

No canonical benchmark was materialized or executed. Graphify was not invoked.
Mind was not modified. The installed provider was not replaced. No branch was
pushed. The candidate evaluation used only disposable diagnostic state.

## Required 21-point owner handoff

1. **Architecture decision:** one deterministic structural index/service per active
   repository, or equivalent repository isolation, for navigation only; exact
   pinned source remains authoritative.
2. **Old-contract retirement:** v7 conflated lifecycle phases, relied on fast mode
   despite material omissions, used historical rather than host-derived resource
   limits, blocked required local IPC, and scored incomplete structural truth.
   Its immutable evidence remains rejected and cannot authorize V2.
3. **Revised coverage:** full mode; at least 95% per repository and 97% aggregate;
   zero unknown files; every declared unindexed eligible file gets observable,
   deterministic exact-source fallback and zero structural credit.
4. **Cold-start semantics:** from no usable cache through a full pinned-repository
   index becoming queryable, including provider initialization; measured once per
   repository in each independent repetition.
5. **Steady-state refresh semantics:** modify one admitted source in a disposable
   export, start the timer before refreshing the same project, stop only when the
   changed marker is queryable from the exact file, then restore byte-for-byte,
   refresh again, and prove marker absence. Idle service state is measured before
   provider shutdown.
6. **IPC/network isolation:** default-deny IPv4, IPv6, and Unix sockets, admitting
   only the validated mode-0700 current-UID `/private/tmp/cbm-daemon-<uid>` root;
   all four positive/negative controls passed, with the same-UID trust boundary
   explicit.
7. **Resource derivation:** the 24 GiB / 12-core host permits at most 1,536 MiB and
   600% CPU for bounded cold work, 768 MiB and 300% CPU for refresh, 256 MiB and 5%
   CPU idle, 1,536 MiB projected simultaneous service RSS, and 512 MiB per index;
   five of five runs require 10% headroom.
8. **Structural truth:** exact pinned symbol identities use exhaustive caller sets
   of import consumers/call sites/no-caller and callee sets of initializer
   dependencies/body-code targets/no-callee, with tests admitted, generated trees
   excluded, and one-to-one scoring for precision, recall, and F1.
9. **Provider comparison:** installed v0.9.0 passed five of five; official
   v0.9.1-rc.1 failed the refresh maximum and lifecycle-provenance contract. No
   newer official stable candidate superseded v0.9.0 during the bounded review.
10. **Selection:** unchanged installed `codebase-memory-mcp 0.9.0`, full mode,
    persistence false, auto-watch false; exact-source is the mandatory fallback.
11. **Repeated metrics:** aggregate coverage 0.9921, indexed file accuracy 0.90,
    applicable-line accuracy 0.875, MRR 0.4944, set outcome 1.0,
    caller/callee F1 1.0; cold p95 4.27 seconds / 1,111.2 MiB; refresh maxima
    Brain 2.71 seconds, Workbench 0.94 seconds, ProChat 0.32 seconds.
12. **Acceptance gates:** all five repetitions and every coverage, retrieval,
    structural, exact-source/fallback, capacity, isolation, restoration, cleanup,
    provenance, and headroom gate passed; partial evidence is rejected.
13. **New contract files:** the five spec artifacts listed in section 6 plus the
    evaluator, authorization preparer, digest helper, isolation helper, contract
    validator/tests, and future canonical-evidence validator in `tools/`.
14. **New Brain commits:** implementation `25a66f1472c81780a629380270d6cce3ef4b2014`;
    authorization documentation `419cb154`; formatting/readiness follow-up
    `0f0505b1`. All remain local on `codex/b8-1-v2-contract`.
15. **Plan filename:**
    `operations/reports/b8-1-v2-canonical-dry-run-plan-2026-08-10.json`.
16. **Run ID:** `b8-1-v2-canonical-authorization-20260810-final-v1`.
17. **Plan SHA:**
    `d95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284`.
18. **Provider SHA:**
    `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`.
19. **Runtime/sandbox identities:** Node v20.20.2 SHA-256
    `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`;
    `/usr/bin/sandbox-exec` SHA-256
    `e3d7a792c58a5d3783d2f7274c82d70062393830d8cb1ded713ca554a470bd2f`;
    isolation profile SHA-256
    `87899ef5c1aed8573034beda57d0e51278417d86b2e7cb4ebac3fe89ecab8d9b`.
20. **Semantic diff from v7:** implicit fast-mode scope becomes measured full-mode
    coverage plus explicit fallback; cold and refresh lifecycles are separated;
    blanket IPC denial becomes minimum local-IPC admission with four controls;
    historical thresholds become host/topology-derived budgets; incomplete
    structural labels become exhaustive pinned truth; five-of-five full evidence
    replaces acceptance of partial results.
21. **Boundary confirmation:** no canonical materialization or execution; no
    B8.2–B8.6 work; no Graphify invocation; no Mind modification; no provider
    replacement; no push. The planned run directory is absent and execution
    authority remains none.

## Exact owner approval statement

The next authorized action is limited to one materialization and one execution of
the exact dry-run plan above after the owner provides this exact statement:

```text
I approve B8.1 Contract V2 benchmark materialization and execution with plan digest
d95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284
for run-id b8-1-v2-canonical-authorization-20260810-final-v1.
Node runtime: v20.20.2 (SHA-256: 38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6).
Provider: codebase-memory-mcp 0.9.0 (SHA-256: d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6), mode full, persistence false, auto-watch false.
Subjects: cbm, exact-source. Graphify excluded.
Full Contract V2 evidence required; partial evidence is not accepted.
```
