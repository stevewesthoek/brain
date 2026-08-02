# B8.5A — Provider-Independent Workbench Structural-Context Contract

> **RECONCILIATION NOTICE (2026-08-01)**
>
> This artifact uses the historical label "B8.5A" from a preliminary,
> out-of-sequence P8 numbering scheme. That label collides with no exact task
> in the current canonical plan, and the historical "B8.5" label (Workbench
> CBM adapter) collides with the current canonical `B8.5 — Convert Graphify to
> bounded semantic synthesis`, which is a different task. This document is a
> Brain-only design spec only.
>
> - **Historical label:** B8.5A (Provider-independent Workbench contract design)
> - **Canonical B8.5:** Convert Graphify to bounded event-driven semantic synthesis
> - **Status:** Design spec artifact; no current execution authority
> - **Canonical P8 accepted complete:** 0/6
> - **Further P8 execution:** intentionally deferred; requires separate authorization
> - **Authoritative task definitions:** `operations/specs/infinite-brain-runtime-implementation-plan.md`

**Date:** 2026-07-29
**Task:** B8.5A (Brain-only design/spec)
**Status:** Design document — no implementation
**Authority:** Brain operations
**Evidence:** `operations/reports/codebase-memory-mcp-canary-b8-4-2026-07-29.md`

> B8.5A is a Brain-only design task. It does NOT modify Workbench Private.
> Implementation is B8.5 (separate approved task).

---

## Purpose

Define the provider-independent contract for Workbench's structural-context endpoint (`/api/graph-context`). This contract enables switching between backends (Graphify, CBM, disabled) without breaking callers or telemetry.

---

## Contract: `GraphContextResult` (Provider-Independent)

The response shape returned by any backend adapter must satisfy:

```typescript
interface GraphContextResult {
  statusCode: 200;
  payload: {
    mode: 'graph_context';
    sourceId: string;
    graphAvailable: boolean;
    freshness: {
      status: 'fresh' | 'stale' | 'unknown';
      basis: string;
      indexedAtSha?: string;
    };
    communityHubs: string[];
    godNodes: string[];
    suggestedFiles: string[];
    suggestedSymbols: string[];
    matches: string[];
    nextActions: SuggestedAction[];
    artifacts: GraphArtifact[];
    warning?: string;
    diagnostics: {
      durationMs: number;
      backend: 'graphify' | 'cbm' | 'disabled';
      operations?: string[];
    };
  };
}
```

### Field semantics (provider-independent)

| Field | Semantics | Graphify source | CBM source | Disabled source |
|-------|-----------|-----------------|-----------|----------------|
| `mode` | Always `'graph_context'` | hardcoded | hardcoded | hardcoded |
| `sourceId` | Caller-provided identifier | passthrough | passthrough | passthrough |
| `graphAvailable` | Whether structural data is available | `graphify-out/` exists | `index_status.status === 'ready'` | `false` |
| `freshness.status` | Index currency vs HEAD | mtime vs latest commit | `head_sha` vs current HEAD | `'unknown'` |
| `freshness.basis` | How freshness was determined | `'mtime_vs_latest_commit'` | `'git_head_sha'` | `'disabled'` |
| `freshness.indexedAtSha` | SHA index was built from | from GRAPH_REPORT header | from `index_status.git.head_sha` | omitted |
| `communityHubs` | Top structural cluster representatives | GRAPH_REPORT section lines (wikilink format stripped) | `get_architecture.clusters[].top_nodes[0]` | `[]` |
| `godNodes` | Highest-connectivity nodes | GRAPH_REPORT section lines | `get_architecture.hotspots[].name` | `[]` |
| `suggestedFiles` | Files relevant to query | report + ranked nodes | `search_graph.results[].file_path` | `[]` |
| `suggestedSymbols` | Symbols relevant to query | backtick symbols + node labels | `search_graph.results[].name` | `[]` |
| `matches` | Query-matching entities | GRAPH_REPORT lines | `search_graph.results.map(r => r.file_path \|\| r.name)` | `[]` |
| `nextActions` | Navigation suggestions | ranked nodes → SuggestedAction[] | trace_path + search_graph → SuggestedAction[] | `[]` |
| `artifacts` | File-system artifact metadata | 3 file stat objects | `[]` (no file artifacts in CBM) | `[]` |
| `warning` | Freshness/availability warning | freshness-based string | freshness-based string | `'Structural context disabled'` |
| `diagnostics.durationMs` | Wall-clock time | Date.now() delta | Date.now() delta | 0 |
| `diagnostics.backend` | Which backend was used | `'graphify'` | `'cbm'` | `'disabled'` |
| `diagnostics.operations` | Backend calls made | `['read_report', 'read_graph']` | `['index_status', 'get_architecture', 'search_graph']` | `[]` |

---

## Feature Flag

```
WORKBENCH_GRAPH_BACKEND = 'graphify' | 'cbm' | 'disabled'
Default: 'disabled'
```

- `disabled` **(default)**: Returns exact-source navigation fallback without calling any structural backend. This is the safe default because Graphify is frozen/stale and CBM is not yet verified in Workbench.
- `cbm`: New CBM adapter (`handleGraphContextCbm`). Requires verified CBM cache with `auto_watch=false`.
- `graphify`: Legacy Graphify adapter (unchanged `handleGraphContext`). Requires explicit configuration. Must refuse to return results when `freshness.status === 'stale'` — stale Graphify results must NEVER be returned as current.

### Compatibility implications of `disabled` default

1. **Callers receive `graphAvailable: false`** — the same response they already receive when `graphify-out/` is missing. No new error surface.
2. **No automatic fallback from `cbm` to stale Graphify.** If CBM fails, the adapter degrades to exact-source navigation (same as `disabled`), never to stale Graphify.
3. **`graphify` requires explicit opt-in.** Operators who set `WORKBENCH_GRAPH_BACKEND=graphify` accept responsibility for staleness — the adapter must still report `freshness.status: 'stale'` honestly.
4. **Existing CI/tests that don't set the env var** will use `disabled` and pass — no Graphify dependency for tests.
5. **Migration path:** `disabled` → `cbm` (after B8.5 verification) → remove `graphify` path (after retention gate).

---

## Freshness Contract

Each backend must:
1. Report freshness status accurately (never return `'fresh'` if stale)
2. Provide `indexedAtSha` when available (callers may display it)
3. Report `'unknown'` rather than guessing when freshness cannot be determined

CBM freshness is inherently more accurate (git-commit-based vs Graphify's mtime-heuristic).

---

## Fallback/Degradation Contract

1. If the configured backend is unavailable (binary missing, cache missing, timeout), degrade to exact-source navigation:
   ```json
   { "statusCode": 200, "payload": { "graphAvailable": false, "freshness": { "status": "unknown", "basis": "<backend>_unavailable" }, "nextActions": [...exact-source navigation suggestions...], "warning": "Structural context unavailable; using exact-source fallback", "diagnostics": { "durationMs": 0, "backend": "disabled", "operations": [] } } }
   ```
2. Never throw or return 500 — the graph-context endpoint must always degrade gracefully.
3. Telemetry must record the degradation reason.
4. **No automatic fallback from `cbm` to `graphify` is permitted.** If CBM is configured and fails, the response must degrade to exact-source navigation (equivalent to `disabled`), never to stale Graphify.
5. **Stale Graphify results must never be returned as current.** If `WORKBENCH_GRAPH_BACKEND=graphify` and `freshness.status === 'stale'`, the adapter must include an explicit `warning` field stating the data is stale and set `graphAvailable: true` only with the stale freshness clearly reported.
6. **`disabled` and all degradation paths** provide the same exact-source navigation suggestions (file paths from git, symbol names from source) without calling any structural backend.

---

## Telemetry Contract

```typescript
recordGraphifyTelemetry({
  sourceId?: string;
  durationMs: number;
  outcome: 'success' | 'degraded' | 'rejected' | 'failure';
  reasonCode: 'graphify_completed' | 'cbm_completed' | 'missing_graph_artifacts' | 'source_not_found' | 'invalid_source' | 'graphify_failed';
  backend: 'graphify' | 'cbm' | 'disabled';
})
```

- `cbm_completed`: new reasonCode for successful CBM response
- `backend`: new field distinguishing source (allows analyzing performance by backend)
- All other fields and values unchanged from current telemetry

---

## Network/Cache Boundaries

### CBM adapter constraints

- CBM binary spawned as stdio subprocess; no network calls during tool operations
- One bounded startup egress (api.github.com update-check; non-blocking, non-fatal)
- Cache path: `~/Library/Caches/brain/codebase-memory-mcp/<repo>` (per-repo isolated)
- `auto_watch` must be `false` for all caches before adapter activation
- Binary path: `/Users/Office/.local/bin/codebase-memory-mcp`
- Timeout: 10s per backend call (same as current Graphify timeout)

### Graphify adapter constraints (unchanged)

- File reads only (graphify-out/GRAPH_REPORT.md, graph.json)
- No network calls
- Max file sizes: GRAPH_REPORT.md 220 lines, graph.json 2MB/5000 nodes

---

## Rollout Plan

1. **B8.5A** (this document): Brain-only design spec — done
2. **B8.5**: Workbench Private implementation (parallel CBM adapter + feature flag defaulting to `disabled` + tests)
3. **Manual verification**: Start Workbench with `WORKBENCH_GRAPH_BACKEND=cbm`, send ChatGPT graph-context action, verify response completeness and correctness
4. **Switch default to `cbm`**: If verified, change default from `disabled` to `cbm`
5. **Stability period**: 7 days with `cbm` as default
6. **Graphify path removal**: After stability period, remove Graphify adapter code path (requires retention-gate approval from `graphify-transition-governance.json`)

---

## Rollback Plan

At any point during rollout:
1. Set `WORKBENCH_GRAPH_BACKEND=disabled` or remove the env var (instant rollback to exact-source navigation)
2. No code changes required for rollback
3. CBM adapter code remains inert when flag is not `'cbm'`
4. Setting `WORKBENCH_GRAPH_BACKEND=graphify` is NOT the recommended rollback path because Graphify artifacts are stale. Use `disabled` instead.

If CBM binary is removed or broken:
1. CBM adapter returns graceful degradation to exact-source (graphAvailable=false)
2. No crash, no 500, no broken telemetry
3. No fallback to stale Graphify

---

## Acceptance Criteria for B8.5

- [ ] `cbm-graph-context.ts` compiles without type errors
- [ ] All 10+ test cases pass
- [ ] `WORKBENCH_GRAPH_BACKEND=disabled` (default, no env var set) returns exact-source navigation
- [ ] `WORKBENCH_GRAPH_BACKEND=cbm` calls new `handleGraphContextCbm`
- [ ] `WORKBENCH_GRAPH_BACKEND=graphify` calls original `handleGraphContext` (explicit opt-in only)
- [ ] `graph-context.ts` is unchanged (no modifications to Graphify adapter)
- [ ] CBM failure degrades to exact-source, never to stale Graphify
- [ ] Telemetry adapter accepts `cbm_completed` reason code and `backend` field
- [ ] No new `.codebase-memory/` directories in the Workbench repo
- [ ] Workbench Private repo dirty count ≤ baseline + new files only
- [ ] Feature flag default is `'disabled'` (neither CBM nor Graphify active by default)

---

## What B8.5A Does NOT Authorize

- No Workbench Private file modifications
- No CBM cache creation or re-indexing
- No Graphify process or scheduler changes
- No live AI config changes
- No commits or pushes
- No global CBM activation
