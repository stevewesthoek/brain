# B8.5 — Workbench CBM Adapter Implementation Prompt

> **RECONCILIATION NOTICE (2026-08-01)**
>
> This artifact uses the historical label "B8.5" from a preliminary,
> out-of-sequence P8 numbering scheme. That label collides with the current
> canonical plan's `B8.5 — Convert Graphify to bounded event-driven semantic
> synthesis`, which is a different task targeting Brain, not Workbench.
> This document is an implementation prompt for a future Workbench session
> and must not be confused with the current canonical B8.5 task.
>
> - **Historical label:** B8.5 (Workbench Private CBM adapter implementation)
> - **Canonical B8.5:** Convert Graphify to bounded event-driven semantic synthesis (Brain)
> - **Status:** Implementation prompt artifact; not yet executed; no current execution authority
> - **Canonical P8 accepted complete:** 0/6
> - **Further P8 execution:** intentionally deferred; requires separate authorization
> - **Authoritative task definitions:** `operations/specs/infinite-brain-runtime-implementation-plan.md`

**Date:** 2026-07-29
**Target repo:** Workbench Private (`/Users/Office/Repos/prochattools/saas/workbench-private`)
**Target branch:** `main` (or feature branch as appropriate)
**Design spec:** `brain/operations/specs/b8-5a-workbench-structural-context-contract.md`
**Evidence:** `brain/operations/reports/codebase-memory-mcp-canary-b8-4-2026-07-29.md`

> Do not implement this prompt in Brain. This prompt is executed in Workbench Private only.

---

## Brain Advisory (deliver at session start)

```text
--- Brain Advisory: B8.4R Communication (2026-07-29) ---

CONTEXT FOR THIS SESSION:

1. graphify-out/ in this repo is STALE (built 2026-07-14 from 80c5429c; HEAD is 3ba34097+).
   Do not treat graphify-out/ as current architecture truth.

2. Codebase Memory MCP v0.9.0 is a Brain CANDIDATE (admission status: candidate).
   It completed a 23-fixture canary (91.3% adjusted correctness, all security gates clear).
   It is NOT globally active. It is NOT installed in this repo context.

3. graph-context.ts (handleGraphContext) remains the existing structural-context adapter.
   CBM is implemented as a parallel adapter (cbm-graph-context.ts) behind a feature flag.
   The existing Graphify adapter must NOT be modified.

4. WORKBENCH_GRAPH_BACKEND defaults to 'disabled' (exact-source navigation).
   Stale Graphify must never be returned as current.
   CBM failure degrades to exact-source, never to stale Graphify.

5. No local changes to graphify-out/, CBM caches, schedulers, or indexes are authorized
   without an explicit Brain operations task.

--- End Advisory ---
```

---

## Hard Constraints

- Do not replace or modify `graph-context.ts` — write a parallel `cbm-graph-context.ts`
- Feature flag: `WORKBENCH_GRAPH_BACKEND=cbm|graphify|disabled` (env var, **default `disabled`**)
- Do not activate CBM backend by default — default is `disabled` (exact-source navigation)
- Do not modify `handleGraphContext` signature or callers beyond the flag routing
- Do not modify the OpenAPI spec
- No commits or pushes without explicit user authorization
- No changes to `~/.claude.json`, `~/.codex/config.toml`, or any live client config
- CBM_CACHE_DIR must use `~/Library/Caches/brain/codebase-memory-mcp/workbench-private`
- auto_watch must remain `false` for all CBM caches (already disabled in B8.4)
- Do not modify graphify-out/ artifacts — they remain frozen
- Never fall back from CBM to stale Graphify
- Use exact-source navigation as the degradation path for all failure modes

---

## Pre-Implementation Verification

Before making any edits, verify these exact files exist and read their current content:

```bash
# Confirm graph-context.ts exists and get current signature
cat packages/cli/src/agent/graph-context.ts | head -30

# Confirm server.ts call site
grep -n "handleGraphContext" packages/cli/src/agent/server.ts

# Confirm telemetry file exists
ls packages/cli/src/agent/index-graph-telemetry.ts 2>/dev/null || echo "telemetry file not found — locate correct path"

# Confirm CBM binary is accessible
~/.local/bin/codebase-memory-mcp --version

# Confirm CBM cache state
CBM_CACHE_DIR="$HOME/Library/Caches/brain/codebase-memory-mcp/workbench-private" \
  ~/.local/bin/codebase-memory-mcp cli index_status

# Confirm no .codebase-memory/ exists
find . -name ".codebase-memory" -type d 2>/dev/null

# Record baseline dirty count
git status --porcelain | wc -l
```

If any verification fails, stop and report — do not proceed with assumptions.

---

## Tasks

### Task 1 — Write `cbm-graph-context.ts`

Create `/packages/cli/src/agent/cbm-graph-context.ts`.

Function signature MUST match exactly:
```typescript
export async function handleGraphContextCbm(body: GraphContextBody): Promise<GraphContextResult>
```

Implementation:
1. Spawn `codebase-memory-mcp` binary as stdio subprocess using `CBM_CACHE_DIR` env
2. Send JSON-RPC requests for required tools (parallel where possible):
   - `index_status` → derive `graphAvailable`, `freshness`
   - `get_architecture` → derive `communityHubs` (clusters[].top_nodes[0]), `godNodes` (hotspots[].name)
   - `search_graph` → derive `matches`, `suggestedFiles`, `suggestedSymbols`
   - `trace_path` (optional, for nextActions) — only if `body.query` resolves to a known function name
3. Use `source` field from `get_code_snippet` responses (not `content` — `content` is empty)
4. Return `artifacts: []` (no file artifacts in CBM)
5. Map `communityHubs` from `get_architecture.clusters[].top_nodes[0]` as plain string[]
6. Map `godNodes` from `hotspots[].name` as string[]
7. Map `matches` as `search_graph.results.map(r => r.file_path || r.name)` (string[])
8. Build `nextActions` from search_graph results — same `SuggestedAction` union type
9. Telemetry: use `recordGraphifyTelemetry` with `reasonCode: 'cbm_completed'` on success
10. Graceful degradation to exact-source: if CBM subprocess fails or cache unavailable, return:
    ```typescript
    { statusCode: 200, payload: { graphAvailable: false, freshness: { status: 'unknown', basis: 'cbm_unavailable' }, communityHubs: [], godNodes: [], suggestedFiles: [], suggestedSymbols: [], matches: [], nextActions: [...exact-source suggestions...], artifacts: [], warning: 'Structural context unavailable; using exact-source fallback', diagnostics: { durationMs: elapsed, backend: 'disabled', operations: [] } } }
    ```

**CBM process management:**
- Start a fresh subprocess per call (same pattern as `execFile` for git)
- Timeout: 10s
- Binary path: resolve via `which codebase-memory-mcp` or use `/Users/Office/.local/bin/codebase-memory-mcp`
- Project name: derive from `source.path` basename or use `workbench-private`

### Task 2 — Write exact-source fallback helper

Create a helper function `buildExactSourceFallback(body: GraphContextBody): GraphContextResult` that:
1. Returns `graphAvailable: false`
2. Returns `freshness: { status: 'unknown', basis: 'disabled' }`
3. Provides basic `nextActions` (e.g. "Search codebase with ripgrep", "Read file directly")
4. Sets `diagnostics.backend: 'disabled'`
5. This is the response for `WORKBENCH_GRAPH_BACKEND=disabled` AND all degradation paths

### Task 3 — Wire the feature flag in `server.ts`

In `packages/cli/src/agent/server.ts`, update the `handleGraphContext` call:

```typescript
import { handleGraphContextCbm } from './cbm-graph-context'

// At the call site:
const backend = process.env.WORKBENCH_GRAPH_BACKEND ?? 'disabled'
let result: GraphContextResult
if (backend === 'cbm') {
  result = await handleGraphContextCbm(body)
} else if (backend === 'graphify') {
  result = await handleGraphContext(body)
} else {
  result = buildExactSourceFallback(body)
}
```

Keep `handleGraphContext` (Graphify version) completely untouched. Only modify the call site in `startLocalServer`.

### Task 4 — Port the telemetry adapter

Update `recordGraphifyTelemetry` to accept:
- `reasonCode: 'cbm_completed'` (new value in the union type)
- `backend: 'graphify' | 'cbm' | 'disabled'` (new optional field)
- No other changes to existing telemetry

### Task 5 — Write tests for `cbm-graph-context.ts`

Create `/packages/cli/src/agent/cbm-graph-context.test.ts` covering:
1. `WORKBENCH_GRAPH_BACKEND=disabled` (or unset): returns exact-source fallback
2. `WORKBENCH_GRAPH_BACKEND=cbm` with healthy CBM: returns `graphAvailable: true`
3. `WORKBENCH_GRAPH_BACKEND=cbm` with unavailable CBM: degrades to exact-source (not Graphify)
4. `communityHubs` returned as plain `string[]` (not wikilinks)
5. `godNodes` from hotspots
6. `suggestedFiles` from search_graph results
7. `freshness.status` reflects index_status
8. `artifacts: []` always
9. Telemetry called with `cbm_completed` on success
10. Telemetry called with `graphify_failed` on CBM error (backward-compat)
11. CBM failure NEVER falls back to Graphify (assert `handleGraphContext` is not called)
12. `WORKBENCH_GRAPH_BACKEND=graphify` calls original handleGraphContext (explicit opt-in test)

### Task 6 — Validate and verify

Run these before reporting success:
```bash
# TypeScript compile (no type errors)
npx tsc --noEmit

# Tests (all pass)
npx jest packages/cli/src/agent/cbm-graph-context

# Verify no changes to graph-context.ts (Graphify version unchanged)
git diff packages/cli/src/agent/graph-context.ts  # must be empty

# Verify feature flag default is 'disabled'
grep -n "WORKBENCH_GRAPH_BACKEND" packages/ -r | head -10

# Verify no .codebase-memory/ directories
find . -name ".codebase-memory" -type d

# Verify dirty count (should be baseline + new files only)
git status --porcelain | wc -l
```

---

## Acceptance Criteria

All tasks complete when:
- [ ] `cbm-graph-context.ts` compiles without type errors
- [ ] All 12 test cases pass
- [ ] `WORKBENCH_GRAPH_BACKEND` unset or `disabled`: returns exact-source fallback
- [ ] `WORKBENCH_GRAPH_BACKEND=cbm`: calls `handleGraphContextCbm`
- [ ] `WORKBENCH_GRAPH_BACKEND=graphify`: calls original `handleGraphContext` (explicit opt-in)
- [ ] `graph-context.ts` is unchanged (zero diff)
- [ ] CBM failure degrades to exact-source, never to stale Graphify
- [ ] Telemetry adapter accepts `cbm_completed` reason code and `backend` field
- [ ] No new `.codebase-memory/` directories in the repo
- [ ] Workbench Private repo dirty count ≤ baseline + new files only (no unexpected mutations)
- [ ] No commits, no pushes
- [ ] No changes to caches, indexes, schedulers, or live user configs

---

## Rollback

```bash
# Remove new files
rm packages/cli/src/agent/cbm-graph-context.ts
rm packages/cli/src/agent/cbm-graph-context.test.ts

# Revert server.ts change
git checkout packages/cli/src/agent/server.ts

# Revert telemetry adapter change
git checkout packages/cli/src/agent/index-graph-telemetry.ts

# Verify: WORKBENCH_GRAPH_BACKEND env var has no effect (no reference in codebase)
grep -r "WORKBENCH_GRAPH_BACKEND" packages/  # should be empty
```

---

## What This Prompt Does NOT Authorize

- No Graphify artifacts modified
- No CBM cache creation or re-indexing
- No scheduler, hook, or process changes
- No live AI config changes (~/.claude.json, ~/.codex/config.toml)
- No commits or pushes without explicit user authorization
- No global CBM activation
- No Mind, Brain, ProChat, or connected-repo modifications
- No fallback from CBM to stale Graphify under any circumstance
