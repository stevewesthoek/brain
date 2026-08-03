# B8.1 Context-memory benchmark plan

**Status:** plan only — NOT complete, NOT authorized for execution
**Date:** 2026-08-03
**Dependency:** This plan does NOT authorize activation of any context-memory service.
**Next step:** Execution requires the prerequisites in the "Execution prerequisites" section below.

---

## Purpose

Establish a reproducible, bounded benchmark comparing context-retrieval approaches across three representative repositories. This plan does NOT authorize activation of any context-memory service. It defines the conditions, metrics, and acceptance thresholds for B8.2 evaluation.

B8.1 is the first canonical task in Priority 8 (context-memory efficiency and freshness). It is not the current approved execution phase. No task in P8 is accepted as complete.

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

Evidence records must conform to this schema. Offline-only evidence must NOT contain model input/output token fields. Those belong exclusively to the separately-unauthorized `optionalModelMediatedMetrics` section.

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
- Partial evidence does NOT authorize B8.2
- Full B8.1 requires the canonical three-way comparison OR a separate explicit decision that Graphify is ineligible
- Graphify remains blocked or excluded until a bounded code-only invocation is proven
- Never silently omit Graphify while reporting B8.1 complete

---

## Repositories

| Repo | Subject ID | Path | Description |
|------|-----------|------|-------------|
| Brain | `brain` | `/Users/Office/Repos/stevewesthoek/brain` | AI infrastructure, skills, runbooks (TypeScript + shell) |
| Workbench Private | `workbench` | `/Users/Office/Repos/prochattools/saas/workbench-private` | Full-stack TypeScript application |
| ProChat | `prochat` | `/Users/Office/Repos/prochattools/web/prochat` | Next.js TypeScript application |

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

Part B would involve feeding retrieval subject outputs as context into an AI model session. Part B metrics (modelInputTokens, modelOutputTokens, timeToAnswerMs) belong exclusively in the `optionalModelMediatedMetrics` section of the evidence schema and must NOT appear in offline evidence.

---

## Safety boundaries

1. **Proven network isolation is mandatory for CBM** — Benchmark processes run with external network blocked via a fixed committed `sandbox-exec` profile (`operations/specs/b8-1-network-deny.sb`). The preflight harness runs a disposable self-test proving network denial before materialization proceeds. The Codebase Memory startup update request to `api.github.com` will fail non-fatally under isolation; this is expected behavior.
2. **No Mind content** — No file from `~/Repos/stevewesthoek/mind/` may be used as a benchmark source or fixture.
3. **No source repository mutation** — Never modify the three source repositories. Create disposable per-run copies via `git archive` of pinned commits. Never use working-tree files as benchmark inputs — use only Git objects from pinned commits.
4. **Disposable copies required for freshness tests** — Source-state invariants (HEAD, status porcelain, status SHA-256) are captured before and after materialization. Exact equality is required.
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
3. All three source repositories at a known clean commit
4. Proven network isolation (self-test passes)
5. Valid explicit run ID supplied

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

This document defines the benchmark plan. **B8.1 is NOT complete.** Execution requires the prerequisites above to be satisfied and a separate authorization decision.

P8 (B8.1–B8.6) is intentionally deferred and is not the current approved execution phase. This plan is filed as a preparatory artifact only.
