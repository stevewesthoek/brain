# B8.1 Context-memory benchmark plan

**Status:** plan only — NOT complete, NOT authorized for execution
**Date:** 2026-08-02
**Dependency:** This plan does NOT authorize activation of any context-memory service.
**Next step:** Execution requires the prerequisites in the "Execution prerequisites" section below.

---

## Purpose

Establish a reproducible, bounded benchmark comparing three context-retrieval approaches across three representative repositories. This plan does NOT authorize activation of any context-memory service. It defines the conditions, fixtures, metrics, and acceptance thresholds for B8.2 evaluation.

B8.1 is the first canonical task in Priority 8 (context-memory efficiency and freshness). It is not the current approved execution phase. No task in P8 is accepted as complete.

---

## Comparison subjects

### A: Codebase Memory MCP v0.9.0
- **Binary:** `~/.local/bin/codebase-memory-mcp`
- **Admission:** `codebase-memory-mcp-brain` (status: candidate)
- **Cache model:** per-repo isolated caches under `~/Library/Caches/brain/codebase-memory-mcp/<repo>/`
- **Freshness model:** snapshot-only; no persistent watcher during benchmark
- **Key constraints:** `auto_watch=false` must be set in each cache before benchmarking; `--persistence false` (default) prevents repo-local writes

### B: Bounded Graphify code-only retrieval
- **Profile source:** `operations/specs/graphify-operational-profiles.json`
- **Scope:** code-only profile; no semantic synthesis
- **Nightly job:** must be stopped before benchmarking
- **Key constraints:** no embedding, no LLM enrichment, no nightly re-run during benchmark

### C: Exact-source exploration (baseline)
- **Method:** agent reads specific files using Read + Grep + Bash tools
- **No index:** pure file-system traversal
- **Purpose:** precision baseline; establishes the floor for F1 comparison

---

## Repositories

| Repo | Path | Description | Tech stack |
|------|------|-------------|------------|
| Brain | `/Users/Office/Repos/stevewesthoek/brain` | AI infrastructure, skills, runbooks | TypeScript + shell |
| Workbench Private | `/Users/Office/Repos/prochattools/saas/workbench-private` | Full-stack TypeScript application | TypeScript, Next.js, Prisma |
| ProChat | `/Users/Office/Repos/prochattools/web/prochat` | Normal application repository | TypeScript, Next.js |

---

## Fixtures

Each fixture has: a natural-language question, the expected answer (file path + line number), a caller accuracy check, and a callee accuracy check.

### Brain fixtures (5)

**brain_F1** — "Find the canonical Mind inbox path definition"
- Expected file: `brain-core/src/paths/mind-path-contract.ts`
- Expected answer: the line where `MIND_INBOX_PATH` is exported
- Caller accuracy: which files import `MIND_INBOX_PATH` from this module?
- Callee accuracy: what does the export resolve to (literal path value)?

**brain_F2** — "Which function classifies a Mind task for routing?"
- Expected file: `projects/mind-steward/src/classifier.ts` (or equivalent)
- Expected answer: the main classification function signature
- Caller accuracy: which modules call the classification function?
- Callee accuracy: what sub-classifiers or schemas does it invoke?

**brain_F3** — "What MCP tools does the Workbench admission allow?"
- Expected file: `operations/specs/mcp-provider-admissions.json` (or `scope.ts` if the question targets the Workbench MCP server scope)
- Expected answer: `getWorkbenchStatus`, `readWorkbenchContext`, `runWorkbenchCommand`
- Caller accuracy: which validators read the tool allowlist?
- Callee accuracy: what environment variable enforces the allowlist?

**brain_F4** — "Where is auto_watch disabled for Codebase Memory?"
- Expected: the `config set auto_watch false` command in the admission evidence or runbook
- Expected file: `operations/specs/mcp-provider-admissions.json` or `operations/system-configs/mcp/codebase-memory-mcp/README.md`
- Caller accuracy: which scripts or runbooks reference this config command?
- Callee accuracy: does `CBM_AUTO_WATCH` env var also disable it? (Answer: no — documented in admission)

**brain_F5** — "What validator runs the deletion-readiness check?"
- Expected file: `tools/validate-deletion-readiness.mjs`
- Expected answer: the `node tools/validate-deletion-readiness.mjs` invocation
- Caller accuracy: which CI or verification steps invoke this validator?
- Callee accuracy: what prerequisite schemas does the validator read?

### Workbench Private fixtures (5)

**wb_F1** — "Where is the runWorkbenchCommand POST handler?"
- Expected: the Next.js API route file handling POST `/api/actions/run-command`
- Expected file: `apps/web/src/app/api/actions/run-command/route.ts`
- Caller accuracy: which MCP handler calls this route?
- Callee accuracy: what schema validates the request body?

**wb_F2** — "Where is the session-aware request schema defined?"
- Expected: `packages/shared/src/workbench-command-contract.ts`, `sessionAwareRunWorkbenchCommandRequestSchema`
- Caller accuracy: which files import this schema?
- Callee accuracy: what fields does the schema require?

**wb_F3** — "Where is the n8n workflow migration executor?"
- Expected file: `packages/cli/src/agent/n8n-workflow-migration-executor.ts`
- Expected answer: the `execute` function signature
- Caller accuracy: what calls the executor?
- Callee accuracy: what does the executor call for protected domain check?

**wb_F4** — "Where is the request audit stored?"
- Expected file: `packages/bridge/src/storage/request-audit.ts`
- Caller accuracy: which modules write audit records?
- Callee accuracy: what storage backend does it use?

**wb_F5** — "Where is the Workbench credential file environment variable read?"
- Expected file: a config or auth file that reads `WORKBENCH_MCP_CREDENTIAL_FILE`
- Caller accuracy: which startup code reads this variable?
- Callee accuracy: what happens if the file is missing?

### ProChat fixtures (5)

**pc_F1** — "Where is the RootLayout component defined?"
- Expected file: `apps/web/src/app/layout.tsx` (or equivalent)
- Expected answer: line where `export default function RootLayout` appears
- Caller accuracy: which pages or components import RootLayout?
- Callee accuracy: what providers does RootLayout wrap?

**pc_F2** — "How many API route files exist?"
- Expected answer: exact count of `route.ts` files under `app/api/`
- Caller accuracy: which routes handle POST requests?
- Callee accuracy: which routes require authentication?

**pc_F3** — "Where is the middleware auth check?"
- Expected file: `middleware.ts` or `src/middleware.ts`
- Expected answer: the line where authentication is enforced
- Caller accuracy: which routes does the middleware protect?
- Callee accuracy: what session validation does the middleware use?

**pc_F4** — "Where is the Stripe webhook handler?"
- Expected file: `app/api/stripe/webhook/route.ts` (or equivalent)
- Caller accuracy: is this route protected by middleware?
- Callee accuracy: what event types does it handle?

**pc_F5** — "Where is the database connection initialized?"
- Expected: the Prisma client singleton or database connection module
- Caller accuracy: which modules import the database client?
- Callee accuracy: what environment variable provides the connection string?

---

## Required metrics

---

### Part A — Deterministic offline retrieval benchmark (no remote model required)

Part A may be measured without any AI model connection. All metrics are computed from the outputs of the retrieval subject against pinned commit exports. No model input/output tokens are consumed or required.

**Part A is the primary benchmark.** B8.2 acceptance is evaluated using Part A results only.

#### Indexing and structural metrics

| Metric | Unit | How to measure |
|--------|------|----------------|
| Initial indexing time (cold start) | milliseconds (wall clock) | Time from invocation to "ready" signal |
| Incremental refresh latency | milliseconds | Modify one file in disposable copy, measure time until reflected in results |
| Peak CPU during indexing | % | `top` or `Activity Monitor` sampling |
| Peak memory RSS during indexing | MB | `/usr/bin/time -l` or `ps` sampling |
| Disk use for index artifacts | MB | `du -sh` on cache directory after indexing |
| Serialized token estimate | integer (rough estimate) | Run a pinned local tokenizer (e.g. tiktoken with `cl100k_base`) on index serialization output; record result alongside tokenizer version and model name |

#### Retrieval accuracy metrics (computed against pinned fixtures)

For each fixture, the retrieval subject is invoked deterministically against its exported tree. Outputs are compared to pinned expected values from `b8-1-context-memory-benchmark-manifest.json`.

| Metric | Calculation |
|--------|-------------|
| File accuracy | Correct file path returned? (yes/no per fixture) |
| Line accuracy | Within ±5 lines of expected? (yes/no per fixture) |
| Caller accuracy (precision) | `|correct_callers_returned| / |total_callers_returned|` |
| Caller accuracy (recall) | `|correct_callers_returned| / |total_known_callers|` |
| Callee accuracy (precision) | `|correct_callees_returned| / |total_callees_returned|` |
| Callee accuracy (recall) | `|correct_callees_returned| / |total_known_callees|` |
| Architecture navigation | Correct 3-hop traversal? (yes/no) |
| Overall F1 per fixture set | `2 * (precision * recall) / (precision + recall)` |

#### Operator burden metrics

| Phase | Steps to document |
|-------|------------------|
| Installation | Number of manual steps required from zero |
| Per-session startup | Steps required before each benchmark session |
| Cleanup and rollback | Steps to fully remove index and restore repo to pre-benchmark state |

#### Failure behavior metrics

| Scenario | Expected behavior to document |
|----------|------------------------------|
| Index is out of date (file changed after indexing) | Does the result reflect stale data? Is the staleness surfaced? |
| Service unavailable (binary not found) | Does the agent fall back gracefully to exact-source reads? |
| Index missing (first run, no cache) | Does the binary exit cleanly or block? |

---

### Part B — Optional model-mediated evaluation (requires separate authorization)

**Part B is NOT required for B8.2 acceptance. It is not authorized in this plan.**

Part B involves feeding retrieval subject outputs as context into an actual AI model session and measuring end-to-end task performance (time-to-correct-answer, token usage, etc.). Part B requires:
- Explicit separate authorization before execution
- A recorded model version and session configuration
- All token costs pre-approved

Part B metrics (for reference only — do not collect without authorization):

| Metric | Unit |
|--------|------|
| Tool call count per query | integer |
| Model input tokens per query | integer (requires live model session) |
| Model output tokens per query | integer (requires live model session) |
| Total tokens for full fixture set | integer |
| Time to correct answer | seconds (end-to-end, model-included) |

**Do not record or infer model input/output token counts from Part A runs.** Part A serialized token estimate (above) is a rough structural size indicator only — it does not represent actual model billing tokens.

---

---

## Safety boundaries

These rules apply to ALL benchmark runs without exception.

1. **Network isolation** — Benchmark processes run with external network blocked. The Codebase Memory startup update request to `api.github.com` will fail non-fatally; this is expected and recorded as bounded behavior. No external connection may succeed. If network isolation cannot be proven on the host, the benchmark must stop rather than claim no-network execution.
2. **No Mind content** — Do not use any file from `~/Repos/stevewesthoek/mind/` as a benchmark source or fixture
3. **No source repository mutation** — Never modify the three source repositories to measure incremental refresh. Create disposable benchmark copies under `~/.brain/benchmark/b8-1/worktrees/<run-id>/` from pinned commits. Freshness tests may modify only those disposable copies. `--persistence false` (default) prevents repo-local writes for Codebase Memory.
4. **Disposable copies required for mutation tests** — Before each freshness run: verify source repository HEAD and status are unchanged. After each run: verify source repository HEAD and status are still unchanged; verify the disposable copy (not the source) contains the intentional mutation; verify no `.codebase-memory/` directory appears in source repositories. Cleanup must use the exact benchmark run directory `~/.brain/benchmark/b8-1/worktrees/<run-id>/`, not a parent path without a recorded run ID.
5. **No persistent watcher** — `auto_watch=false` must be set in each benchmark cache before benchmarking via `CBM_CACHE_DIR=<path> codebase-memory-mcp config set auto_watch false`; no background re-indexing; verify no persistent watcher remains after each run; verify no scheduler starts
6. **No scheduler** — Do not activate or start the nightly scheduler during benchmarking
7. **Ephemeral benchmark configuration only** — Use direct CLI invocation, direct bounded stdio MCP harness, or ephemeral benchmark-only configuration located under `~/.brain/benchmark/b8-1/config/`. Do not add any MCP server to `~/.claude.json`, `~/.codex/config.toml`, `~/.cursor/`, or `~/.gemini/` during benchmarking. The runtime-truth validator distinguishes ephemeral benchmark invocation from persistent client registration.
8. **No Graphify semantic synthesis** — Use code-only profile; disable embedding and semantic ranking
9. **Stop conditions** — Abort run if:
   - any source repository has dirty state after a run
   - any `.codebase-memory/` directory appears in a source repo
   - disk use exceeds 500MB per repo
   - peak memory exceeds 1GB
   - external network connection succeeds (expected to be blocked)
10. **Reversibility** — All benchmark artifacts are stored in `~/.brain/benchmark/b8-1/` only; clean removal: `rm -rf ~/.brain/benchmark/b8-1/`

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

If any threshold is not met, the approach is not eligible for B8.2 default admission. Evidence of the failure must be recorded before any alternative approach is evaluated.

---

## Evidence format

Each benchmark run must produce a JSON evidence file at `~/.brain/benchmark/b8-1/<approach>-<repo>-<timestamp>.json`:

```json
{
  "approach": "codebase-memory-mcp|graphify-code|exact-source",
  "repository": "brain|workbench-private|prochat",
  "runAt": "ISO-8601",
  "gitRef": "SHA",
  "fixtures": [
    {
      "id": "brain_F1",
      "question": "Find the canonical Mind inbox path definition",
      "expectedFile": "brain-core/src/paths/mind-path-contract.ts",
      "expectedLine": 42,
      "result": {
        "file": "brain-core/src/paths/mind-path-contract.ts",
        "line": 40,
        "fileCorrect": true,
        "lineCorrect": true
      }
    }
  ],
  "performance": {
    "indexingMs": 2000,
    "incrementalRefreshMs": 350,
    "peakCpuPercent": 85,
    "peakMemoryMb": 350,
    "diskMb": 58
  },
  "tokenCost": {
    "inputTokens": 1200,
    "outputTokens": 300
  },
  "violations": []
}
```

The `violations` array must be empty for the run to be eligible for B8.2 consideration. Any stop-condition trigger must be recorded as a violation entry with a `reason` field.

---

## Execution prerequisites

Before executing the benchmark (NOT authorized in this plan):

1. Human approval for local benchmark run (B8.1 authorization)
2. Graphify bounded profile confirmed operational
3. All three source repositories at a known clean commit
4. Disposable benchmark worktree root `~/.brain/benchmark/b8-1/worktrees/` created and empty
5. Network isolation confirmed for the host (or stop condition acknowledged)

**Correct dependency order:**

```
B8.1 authorization
→ bounded benchmark execution
→ B8.1 evidence and decision recorded
→ B8.2 formal admission / default-activation decision
```

B8.2 acceptance is the *output* of B8.1, not a *prerequisite* for it. B8.2 cannot be required before B8.1 runs.

Workbench MCP client registration is not required. The benchmark subjects (Codebase Memory MCP, Graphify, exact-source) do not use Workbench. Do not register Workbench as a benchmark prerequisite.

Codebase Memory persistent client registration is not required. Use direct CLI invocation or ephemeral benchmark-only configuration. Do not add any persistent MCP server entry to user-level configuration before B8.2 acceptance.

---

## Status

This document defines the benchmark plan. **B8.1 is NOT complete.** Execution requires the prerequisites above to be satisfied and a separate authorization decision.

P8 (B8.1–B8.6) is intentionally deferred and is not the current approved execution phase. This plan is filed as a preparatory artifact only.
