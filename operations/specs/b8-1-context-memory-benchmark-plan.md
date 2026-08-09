# B8.1 Context-memory benchmark plan

**Status:** B8.1 incomplete — owner-approved v7w executed once and rejected as insufficient; exact-source passed 10/10, CBM errored 10/10, and canonical evidence validation failed
**Date:** 2026-08-09 (v7w disposition); 2026-08-06 (v6 historical); 2026-08-04 (v5s historical)
**Dependency:** This plan does NOT authorize activation of any context-memory service.
**Next step:** No execution is currently authorized. Any investigation, repair, or new run requires a separate task, a new run ID and canonical plan, and fresh exact owner approval.
**v7w disposition:** Run `b8-1-canonical-authorization-20260809-final-v7w` executed 2026-08-09 under digest `86859184919a029c9a3aaa989c55240ad07aff368c09e6895d9564577dfadf30`; exact-source passed 10/10, CBM errored 10/10, evidence validation failed, and the run was rejected as insufficient. The approval is consumed and the immutable evidence is preserved.
**v5s disposition:** Executed 2026-08-05; preserved as infrastructure evidence; rejected as insufficient for B8.1 completion (missing per-subject metrics, two harness defects, one genuine CBM miss).
**v6 changes from v5s:** (1) evidence schema 2.0.0 requires `subjectMetrics` per-subject with typed not-applicable states; (2) `json-pointer-set` algorithm extended with generic `itemProperty` projection; (3) `file-name-count` rejects null `expectedCount`; (4) negative tests for malformed projections, null counts, duplicate metrics, fabricated N/A values.

---

## Purpose

Establish a reproducible, bounded benchmark comparing context-retrieval approaches across three representative repositories. This plan does NOT authorize activation of any context-memory service. It defines the conditions, metrics, and acceptance thresholds for B8.2 evaluation.

B8.1 is the first canonical task in Priority 8 (context-memory efficiency and freshness). It remains incomplete after the rejected v7w execution. No task in P8 is accepted as complete.

---

## Fixture authority

**The JSON manifest is the sole fixture authority.**

- Path: `operations/specs/b8-1-context-memory-benchmark-manifest.json`
- Schema: `operations/specs/b8-1-context-memory-benchmark-manifest.schema.json`
- Validation: `node tools/validate-b8-1-benchmark-manifest.mjs`

The manifest contains 10 fixtures across 3 repositories (brain: 4, workbench: 2, prochat: 4). Each fixture specifies an exact question, expected answer, scoring type, and structured verification algorithm.

Do not duplicate fixture definitions in prose. The manifest is machine-validated and is the only authoritative record of fixture content.

---

## Evidence authority

**The evidence schema is the sole evidence authority.**

- Schema: `operations/specs/b8-1-context-memory-benchmark-evidence.schema.json`
- Validation: `node tools/validate-b8-1-benchmark-evidence.mjs`

Evidence records must conform to this schema. Offline-only evidence must NOT contain model input/output token fields. Model-mediated metrics are outside this offline schema and remain separately unauthorized.

Evidence validation for a materialized run must supply both `--manifest` and `--run-dir`. The validator hashes the actual manifest and `preflight-receipt.json` bytes, recomputes the approved run-plan digest, and requires the run plan, receipt, and evidence to agree on the digest, subject partition, pinned commits, CBM identity/isolation proof, and fixture coverage. Evidence for an excluded subject is invalid.

---

## Comparison subjects

### A: Codebase Memory MCP v0.9.0 (subject ID: `cbm`)
- **Binary:** `~/.local/bin/codebase-memory-mcp` (symlink to versioned provider root)
- **Admission:** `codebase-memory-mcp-brain` (status: candidate)
- **Cache model:** per-run isolated cache under `~/.brain/benchmark/b8-1/runs/<run-id>/subjects/cbm/cache/`
- **Freshness model:** snapshot-only; no persistent watcher during benchmark
- **Key constraints:** `auto_watch=false` must be set per-run; `--persistence false` (default)

### B: Bounded Graphify code-only retrieval (subject ID: `graphify`)
- **Profile source:** `operations/specs/graphify-operational-profiles.json`
- **Scope:** code-only profile; no semantic synthesis
- **Current status:** BLOCKED — no proven bounded code-only invocation exists
- **Key constraints:** no embedding, no LLM enrichment, no nightly re-run during benchmark

### C: Exact-source exploration baseline (subject ID: `exact-source`)
- **Method:** deterministic local algorithms (grep, find, file reads, JSON pointer extraction)
- **No index:** pure file-system traversal against pinned commit exports
- **Purpose:** precision baseline; establishes the floor for F1 comparison
- **No agent mediation:** exact-source uses deterministic algorithms only, not agent-mediated execution

---

## Subject selection rules

Subjects are explicitly selected via `--subjects` flag:

| Selection | Meaning |
|-----------|---------|
| `--subjects cbm,exact-source` | Partial evidence (CBM vs baseline only) |
| `--subjects cbm,graphify,exact-source` | Full B8.1 comparison |
| `--subjects exact-source` | Baseline only (validation/smoke test) |

**Rules:**
- A selected blocked subject prevents readiness and materialization (exit 1)
- An unselected blocked subject is recorded as `excluded-subject`
- CBM + exact-source only = partial evidence; does NOT complete B8.1
- A successful dry-run emits the complete canonical plan and its digest for review. It is a preflight observation only, neither B8.1 execution authorization nor approval to materialize a run.
- Materialization requires `--approved-plan-sha256` to equal the exact digest emitted by the matching dry-run. Missing or changed approval creates no run directory.
- Partial evidence does NOT authorize B8.2
- Full B8.1 requires the canonical three-way comparison OR a separate explicit decision that Graphify is ineligible
- Graphify remains blocked or excluded until a bounded code-only invocation is proven
- Never silently omit Graphify while reporting B8.1 complete
- `partialEvidence` must be true whenever any canonical subject is excluded. In particular, Graphify exclusion can never be represented as full B8.1 evidence.

---

## Repositories

| Repo | Subject ID | Path | Description |
|------|-----------|------|-------------|
| Brain | `brain` | `../../../brain-next` from the manifest | AI infrastructure, skills, runbooks (TypeScript + shell) |
| Workbench Private | `workbench` | `../../../../prochattools/saas/workbench-private` from the manifest | Full-stack TypeScript application |
| ProChat | `prochat` | `../../../../prochattools/web/prochat` from the manifest | Next.js TypeScript application |

The manifest paths are the fail-closed defaults. When a live checkout is dirty, preflight may instead receive one complete explicit mapping of repository IDs to independent clean Git checkout roots:

```text
--source-root brain=/absolute/clean/brain \
--source-root workbench=/absolute/clean/workbench \
--source-root prochat=/absolute/clean/prochat
```

If any override is supplied, every manifest repository ID must be mapped exactly once. Each root must be an absolute, existing, non-symlink Git top level with empty `git status --porcelain` and `HEAD` exactly equal to the manifest pin. Unknown or missing IDs, traversal, a missing root, a dirty root, or a wrong commit fails preflight. The effective roots are captured in the digest-bound check records and source-state hash; no override mutates a checkout.

Physical override paths are NOT digest inputs. The digest is path-independent: an approved plan and its digest are valid regardless of which physical path the Brain worktree occupies. Source-root override paths are captured in `runContext` (audit record only). An approved materialization must use source roots whose content-state SHA-256 matches the plan's `sourceStateHash`. If source roots were removed, recreate clean detached checkouts at the pinned commits; the same logical content produces the same hash regardless of physical path.

---

## Per-run isolation

Every benchmark run is fully isolated under a single run directory:

```
~/.brain/benchmark/b8-1/runs/<run-id>/
  run-plan.json
  preflight-receipt.json
  source-state-before.json
  source-state-after.json
  sources/brain/
  sources/workbench/
  sources/prochat/
  subjects/cbm/cache/
  subjects/cbm/config/
  subjects/exact-source/
  subjects/graphify/          # only if selected and ready
  evidence/
  logs/
  cleanup-manifest.json
```

- Every cache and configuration path is per-run
- `run-plan.json` and `preflight-receipt.json` bind the same deterministic inputs: subject partition, manifest and schema hashes, pinned commits, declared escaping-symlink exclusions, CBM verification, network adapter/runtime/helper/profile identity, Graphify status/reason/profile hash, disk gate result, every benchmark-directory/run-artifact write path, the physical run-directory target, source-state hash, and complete preflight check records.
- The evidence validator binds the receipt bytes, cleanup manifest, and both source-state proof files to the approved plan. Timestamps remain observational and outside digest inputs.
- Planned-write checks resolve existing ancestors physically, reject symlink escapes and protected-path overlap, and create the approved run directory exclusively; no unchecked sibling staging directory is used.
- `createdAt` timestamps are observational metadata and are not plan-digest inputs.
- No shared cache or configuration directory exists outside the run root
- Cleanup targets one exact run ID only: `~/.brain/benchmark/b8-1/runs/<run-id>`
- Never permit automatic deletion of the parent `~/.brain/benchmark/b8-1/`

---

## Required metrics

### Part A — Deterministic offline retrieval benchmark (no remote model required)

Part A may be measured without any AI model connection. All metrics are computed from retrieval subject outputs against pinned commit exports. No model input/output tokens are consumed or required.

**Part A is the primary benchmark.** B8.2 acceptance is evaluated using Part A results only.

#### Indexing and structural metrics

| Metric | Unit |
|--------|------|
| Initial indexing time (cold start) | milliseconds |
| Incremental refresh latency | milliseconds |
| Peak CPU during indexing | % |
| Peak memory RSS during indexing | MB |
| Disk use for index artifacts | MB |
| Serialized payload bytes | integer |
| Pinned-tokenizer estimate | integer (with tokenizer name and version recorded) |
| Retrieval operation count | integer |

#### Retrieval accuracy metrics (computed against pinned fixtures)

| Metric | Calculation |
|--------|-------------|
| File accuracy | Correct file path returned? (per fixture) |
| Line accuracy | Within ±5 lines of expected? (per fixture) |
| Set accuracy | Correct set returned? (for set-match fixtures) |
| Caller/callee F1 | `2 * (precision * recall) / (precision + recall)` |

### Part B — Optional model-mediated evaluation (requires separate authorization)

**Part B is NOT required for B8.2 acceptance. It is not authorized in this plan. Model-mediated Part B remains unauthorized.**

Part B would involve feeding retrieval subject outputs as context into an AI model session. Part B metrics (modelInputTokens, modelOutputTokens, timeToAnswerMs) require a separate authorized evidence contract and must NOT appear in offline evidence.

---

## Safety boundaries

1. **Proven network isolation is mandatory only for CBM** — Benchmark processes run with external network blocked via a fixed committed `sandbox-exec` profile (`operations/specs/b8-1-network-deny.sb`). The preflight harness runs a disposable self-test proving a sandboxed child started and received `EPERM`/`EACCES`; timeout, refusal, or launch failure never count as proof. Exact-source-only evidence must record exactly `{required:false,status:"not-required"}` and must not fabricate adapter or self-test data. The Codebase Memory startup update request to `api.github.com` will fail non-fatally under isolation; this is expected behavior.
2. **No Mind content** — No file from `~/Repos/stevewesthoek/mind/` may be used as a benchmark source or fixture.
3. **No source repository mutation** — Never modify the three live source repositories. Create independent clean detached checkouts when source-root overrides are needed, then create disposable per-run copies via `git archive` of pinned commits. Never use dirty working-tree files as benchmark inputs — use only Git objects from pinned commits.
4. **Disposable copies required for freshness tests** — Effective source-root invariants (HEAD, status porcelain, status SHA-256) are captured before and after materialization. Exact equality is required.
5. **No persistent watcher** — `auto_watch=false` set per-run in per-run cache directories.
6. **No scheduler** — Do not activate or start the nightly scheduler during benchmarking.
7. **Ephemeral benchmark configuration only** — Use direct CLI invocation with per-run configuration. Do not add any MCP server to user-level configuration during benchmarking.
8. **No Graphify semantic synthesis** — Use code-only profile only; disable embedding and semantic ranking.
9. **Stop conditions** — Abort run if: any source repository dirty state after run; `.codebase-memory/` directory appears in source repo; disk exceeds 500MB per repo; peak memory exceeds 1GB; external network connection succeeds.
10. **Per-run cleanup only** — All artifacts stored under `~/.brain/benchmark/b8-1/runs/<run-id>/` only. Cleanup must specify the exact run ID. Never delete the parent directory.

---

## Acceptance thresholds

B8.2 acceptance requires ALL of the following:

| Metric | Threshold |
|--------|-----------|
| File accuracy | ≥ 90% across all fixtures |
| Line accuracy | ≥ 80% across all fixtures |
| Caller/callee F1 | ≥ 0.75 |
| Initial indexing time | ≤ 10 seconds per repository |
| Incremental refresh latency | ≤ 500ms |
| Peak memory RSS | ≤ 512MB |
| Source repository mutations | zero |
| Persistent background processes after benchmark | zero |
| Default client registration | requires explicit human approval |

---

## Execution prerequisites

Before executing the benchmark (NOT authorized in this plan):

1. Human approval for local benchmark run (B8.1 authorization)
2. All selected subjects pass preflight gates (exit 0)
3. All three effective source roots clean with `HEAD` exactly equal to their manifest-pinned commits, using either the default manifest paths or one complete explicit `--source-root` mapping
4. Proven network isolation when CBM is selected (self-test passes); exact-source needs only the exact `not-required` record
5. Valid explicit run ID supplied
6. Explicit approval of the exact `planSha256` emitted for those deterministic inputs

**Correct dependency order:**

```
B8.1 authorization
→ bounded benchmark execution (with proven network isolation)
→ B8.1 evidence and decision recorded
→ B8.2 formal admission / default-activation decision
```

B8.2 acceptance is the *output* of B8.1, not a *prerequisite* for it.

Workbench MCP client registration is not required. The benchmark subjects do not use Workbench.

Codebase Memory persistent client registration is not required. Use direct CLI invocation or ephemeral per-run configuration.

---

## Status

This document defines the benchmark and its execution gate. **B8.1 is NOT complete, B8.2 is NOT complete, and a passing dry-run does not authorize either task.** Execution requires the prerequisites above, an approved matching plan digest, and a separate authorization decision.

**v5s execution (2026-08-05):** Run `b8-1-canonical-authorization-20260805-final-v5s` produced 17/20 pass results. The owner rejected the run as insufficient for B8.1 completion. The run is preserved as immutable infrastructure evidence. Digest `47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0` is now stale for new execution (valid only for the historical v5s run).

**v6 contract (2026-08-06):** Corrects two harness defects (`json-pointer-set` object projection, `file-name-count` null expectedCount), upgrades evidence schema to 2.0.0 with per-subject typed metrics, and prepares a fresh dry-run authorization cycle. The v5s run does not establish a preferred structural default for context-memory.

**v7w execution (2026-08-09):** Owner-approved run `b8-1-canonical-authorization-20260809-final-v7w` used Node `v20.20.2`, selected `cbm,exact-source`, and excluded Graphify with `partialEvidence=true`. Exact-source passed 10/10. All 10 CBM fixtures failed closed with `marker not visible after reindex: unknown`; required CBM metrics were absent and the canonical evidence validator returned INVALID. The run is rejected as insufficient, its authorization is consumed, and the immutable evidence is preserved. Partial-evidence approval did not waive the selected CBM evidence requirements or authorize B8.2.

Graphify remains blocked because no exact bounded code-only executable contract and passing self-test exist. P8 (B8.1–B8.6) remains 0/6 accepted, B8.2–B8.6 remain blocked, and current benchmark execution authority is `none`.
