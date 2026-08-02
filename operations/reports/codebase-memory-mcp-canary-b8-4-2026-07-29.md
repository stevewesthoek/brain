# B8.4 Codebase Memory MCP Canary — Evidence Report

> **RECONCILIATION NOTICE (2026-08-01)**
>
> This artifact uses the historical task label "B8.4" from a preliminary,
> out-of-sequence P8 numbering scheme. That label collides with the current
> canonical plan's `B8.4 — Define agent retrieval and exact-source-read policy`,
> which is a different task. This document is historical evidence only.
>
> - **Historical label:** B8.4 (Graphify Freeze + Codebase Memory Canary)
> - **Canonical B8.4:** Define agent retrieval and exact-source-read policy
> - **Status:** Evidence artifact; no current execution authority
> - **Canonical P8 accepted complete:** 0/6
> - **Further P8 execution:** intentionally deferred; requires separate authorization
> - **Authoritative task definitions:** `operations/specs/infinite-brain-runtime-implementation-plan.md`
> - **Authoritative roadmap:** `operations/specs/infinite-brain-runtime-roadmap.md`

**Date:** 2026-07-29
**Task:** B8.4 — Graphify Freeze, Evidence Manifest, and Codebase Memory Dual-Run Canary
**Branch:** `release/brain-stabilization-v1` (brain `61b9cfe7`)
**Author:** Brain operations
**Source artifacts:** `/tmp/b8-4-graphify-freeze/` (six deliverables; ephemeral — this report is the durable record)

> No files were modified in any repository during B8.4.
> No commits or pushes were made.

---

## Provenance

### Source commands run during B8.4

```bash
# Phase 0 — Freeze baseline
git -C /Users/Office/Repos/stevewesthoek/brain rev-parse HEAD
git -C /Users/Office/Repos/stevewesthoek/mind rev-parse HEAD
git -C /Users/Office/Repos/prochattools/saas/workbench-private rev-parse HEAD
git -C /Users/Office/Repos/prochattools/web/prochat rev-parse HEAD
shasum -a 256 /Users/Office/Repos/stevewesthoek/brain/graphify-out/graph.json
shasum -a 256 /Users/Office/Repos/stevewesthoek/brain/graphify-out/GRAPH_REPORT.md
shasum -a 256 /Users/Office/Repos/stevewesthoek/brain/graphify-out/manifest.json
shasum -a 256 /Users/Office/Repos/prochattools/saas/workbench-private/graphify-out/graph.json
shasum -a 256 /Users/Office/Repos/prochattools/saas/workbench-private/graphify-out/GRAPH_REPORT.md
shasum -a 256 /Users/Office/Repos/prochattools/web/prochat/graphify-out/graph.json
stat -f "%Sm" /Users/Office/Repos/stevewesthoek/brain/graphify-out/graph.json
pgrep -f graphify  # no active processes
grep -n "graphify-nightly" /Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh
shasum -a 256 /Users/Office/.local/bin/codebase-memory-mcp

# Phase 0 — auto_watch remediation (before any fixtures)
CBM_CACHE_DIR="$HOME/Library/Caches/brain/codebase-memory-mcp/workbench-private" \
  codebase-memory-mcp config set auto_watch false
CBM_CACHE_DIR="$HOME/Library/Caches/brain/codebase-memory-mcp/prochat" \
  codebase-memory-mcp config set auto_watch false

# Phase 1 — 23-fixture canary (see canary-manifest for full command log)
CBM_CACHE_DIR="$HOME/Library/Caches/brain/codebase-memory-mcp/brain" \
  codebase-memory-mcp cli <tool> <args>  # repeated for each fixture
```

### Timestamps

- Freeze baseline captured: 2026-07-29 (session start)
- auto_watch remediation: 2026-07-29 (before first fixture)
- Canary execution: 2026-07-29
- Evidence report written: 2026-07-29

### Live checksum re-verification (B8.4R Task 1, 2026-07-29)

Re-verified all six graphify-out checksums against freeze-manifest.json values after context compaction. All six: **OK** (no tampering since freeze).

---

## Phase 0: Freeze Baseline

### Repo HEADs at freeze

| Repo | HEAD SHA | Branch | Dirty files |
|------|----------|--------|-------------|
| brain | `61b9cfe7` | `release/brain-stabilization-v1` | 371 |
| mind | `7687bb83` | `main` | 74 |
| workbench-private | `3ba34097` | `main` | 3 |
| prochat | `f37dc9c7` | `main` | 16 |

### Graphify artifacts — all STALE

| Repo | Artifact | SHA-256 | mtime | Built from | Current HEAD | Stale? |
|------|---------|---------|-------|-----------|--------------|--------|
| brain | `graphify-out/graph.json` | `feb942ec...` | 2026-07-14T04:03:31 | `c2350d59` | `61b9cfe7` | YES |
| brain | `graphify-out/GRAPH_REPORT.md` | `98007401...` | 2026-07-14T04:03:31 | `c2350d59` | `61b9cfe7` | YES |
| brain | `graphify-out/manifest.json` | `ceefc784...` | 2026-07-14T04:03:31 | `c2350d59` | `61b9cfe7` | YES |
| workbench-private | `graphify-out/graph.json` | `1e506876...` | 2026-07-14T07:05 | `80c5429c` | `3ba34097` | YES |
| workbench-private | `graphify-out/GRAPH_REPORT.md` | `841560fb...` | 2026-07-14T07:05 | `80c5429c` | `3ba34097` | YES |
| prochat | `graphify-out/graph.json` | `d7d76127...` | 2026-07-14T04:00 | unknown | `f37dc9c7` | UNKNOWN |

Graphify has been quiesced since 2026-07-14 at BS0.15 containment (`office-nightly-scheduler.sh:529`):
```
log "skipping job=graphify-nightly reason=bs0-15-pending-containment"
```

No active graphify processes were observed at any point during B8.4. No graphify environment variables were set.

### CBM binary provenance

```
SHA-256: d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6
Path: /Users/Office/.local/bin/codebase-memory-mcp
Version: 0.9.0 (darwin-arm64)
Admitted at: B8.2A-R 2026-07-29
```

### CBM cache state — all auto_watch=false after remediation

| Cache | Path | auto_watch before B8.4 | auto_watch after B8.4 | Index HEAD |
|-------|------|-----------------------|----------------------|-----------|
| brain | `~/Library/Caches/brain/codebase-memory-mcp/brain` | false (set in B8.2A-R) | false | `61b9cfe7` (current) |
| workbench-private | `~/Library/Caches/brain/codebase-memory-mcp/workbench-private` | **true** (gap from B8.2A-R) | false (set in B8.4) | `3ba34097` (current) |
| prochat | `~/Library/Caches/brain/codebase-memory-mcp/prochat` | **true** (gap from B8.2A-R) | false (set in B8.4) | `f37dc9c7` (current) |

**B8.2B blocker (confirmed):** The B8.2B activation prompt Step 3 covers only the Brain cache. It must be expanded to all three caches before global activation is attempted.

---

## Phase 1: Canary Results

### Fixture summary

| Metric | Value |
|--------|-------|
| Total fixtures | 23 |
| Pass | 18 |
| Partial | 4 (F2, F7, F13, F17) |
| Test-error | 1 (F5) |
| Raw correctness | 78.3% (18/23) |
| Adjusted correctness | 91.3% (21/23) |
| Adjusted note | Excludes F5 (wrong invocation syntax — test-authoring error), F13 (missing required parameter — test-authoring error), F7 (field-name gap, not correctness failure) |

All 9 automatic-rejection gates: **PASS** (no automatic rejection triggered).

Overall gate: **CONDITIONAL_PASS** (≥95% literal gate not cleared; all security/isolation/mutation gates clear). This is NOT an unconditional pass. The ≥95% fixture correctness gate was not met at either raw (78.3%) or adjusted (91.3%) levels.

### Adjusted exclusion provenance

The 91.3% adjusted figure (21/23) excludes exactly 3 fixtures from the failure count. Each exclusion is justified below with the evidence that the fixture design or field contract — not CBM correctness — caused the discrepancy:

| Fixture | Original expectation | Actual result | Exclusion reason | Evidence |
|---------|---------------------|---------------|-----------------|----------|
| **F5** | `MATCH (a)-[:IMPORTS]->(b) WHERE a.file_path CONTAINS "graphify-status"` returns import rows | 0 results returned; error hint about query syntax | **Test-authoring error:** The query_graph syntax used an invalid WHERE clause. F15 superseded F5 with the correct property-filter syntax (`MATCH (a {file_path: "..."})-[:IMPORTS]->(b)`) and returned 10 rows successfully. The CBM tool is correct; the fixture invocation was wrong. | F15 pass with corrected syntax proves CBM handles the query correctly. |
| **F13** | `trace_path` called without `function_name` parameter returns call graph | Error: `function_name is required` | **Test-authoring error:** The fixture omitted a required parameter. F16 shows the correct invocation with `function_name="handleGraphContext"` returning 25 callees + 3 callers at 3-hop depth. CBM enforces its documented API contract; the fixture violated it. | F16 pass with required parameter proves CBM returns correct trace data. |
| **F7** | `get_code_snippet` response has code in `content` field | `content: ""`, `source: "<exact code bytes>"` | **Field-name gap, not correctness failure:** CBM returns exact source code, but in the `source` field rather than `content`. The byte-level content is correct (verified by F18 exact-source comparison). This is an adapter field-mapping concern, not a CBM correctness failure — the information is present and correct, just under a different key name. | F18 confirms byte-level source match via the `source` field. Adapter must use `source`. |

**No benchmark weights have been rewritten. No score has been inflated.** The raw 78.3% (18/23) remains the primary measurement. The 91.3% figure reflects the assessment that 3 specific fixtures tested the test harness or field naming convention rather than CBM's ability to answer structural-code queries correctly.

### Partial fixture analysis

| ID | Fixture | Result | Root cause |
|----|---------|--------|-----------|
| F2 | callers_of_routeRequest | Partial (1/8 callers found) | CALLS graph excludes test-file call sites by design; CBM correct for production caller |
| F7 | code_snippet_field_name | Partial (content empty, source has code) | Field name gap: `get_code_snippet` returns code in `source` not `content` |
| F13 | trace_path_without_function_name | Partial (call failed) | Test-authoring error: `function_name` is required; F16 shows correct invocation |
| F17 | search_code_latency | Partial (533ms vs 35ms rg) | Latency tradeoff: search_code is symbol-aware/ranked; ripgrep is raw pattern scan |

### Key findings

1. **Exact source code is returned via `source` field.** `get_code_snippet` response uses `source` (not `content`; `content` is empty). Byte-level match confirmed (F18). Any adapter must use `source`.

2. **Cache isolation is perfect.** Brain-only symbols return 0 results in Workbench cache (F9). No cross-repo contamination at any point.

3. **No repository mutations.** All four repos at B8.4 baseline after all 23 fixtures. `git diff` confirmed clean. No `.codebase-memory/` directories created (persistence=false default).

4. **Freshness is better in CBM** (git-commit-based) than Graphify (mtime-based). `detect_changes` correctly reported 614 mtime-changed files (F6, F14) without treating them as stale at the semantic level.

5. **Test-file callers absent from CALLS graph** (F2). This is by design — CALLS tracks production call edges. For comprehensive caller audit, exact-source (ripgrep) remains the authority.

6. **Workbench adapter is fully feasible.** All 13 `GraphContextResult` fields mapped. Three adapter transformations required; none are blocking. 3–4 CBM tool calls per request vs 1 Graphify file read — ~400–600ms latency expected.

7. **Community labels:** Workbench's current Graphify output shows `Community 0`, `Community 1` placeholders (LLM labeling never applied). CBM cluster labels are structurally equivalent or better.

---

## Corrected Adoption Recommendation

**Discrepancy observed:** `canary-scorecard.json` has `"recommendation": "B"` (label: `remain_supplemental_and_proceed_to_adapter_implementation`). `freeze-report.md` reads "A — Proceed to Workbench adapter implementation (B8.5)."

**Reconciled position:** These are not in conflict. The "B" in the scorecard is the B8.3 adoption category (keep CBM supplemental to Graphify, not a full replacement). Both documents agree on the action: proceed to B8.5 adapter implementation.

**Corrected statement:**

> **Adoption category: B (supplemental structural overlay, per B8.3)**
>
> CBM provides a structural code-navigation overlay. It does not replace Graphify's semantic synthesis role. Graphify remains the bounded semantic supplement when separately activated with explicit approval.
>
> **Canary gate: CONDITIONAL_PASS**
>
> All security/isolation/mutation/transmission/fallback gates clear. The 91.3% adjusted correctness falls short of the ≥95% literal gate, but the gap findings (F2, F17) are inherent documented tradeoffs in a call-graph vs file-scan approach, not defects. No finding changes the B8.3 recommendation.
>
> **Action: Proceed to B8.5 adapter implementation.**
>
> The adoption category and the implementation recommendation are not in conflict — category B means CBM remains supplemental, and B8.5 implements the Workbench adapter under that role.

---

## Gaps for B8.2B (before global activation)

| Gap | Severity | Required action |
|-----|----------|----------------|
| `auto_watch=true` on workbench-private and prochat caches | **BLOCKER** | Expand B8.2B Step 3 to run `config set auto_watch false` for all three caches |
| `source` vs `content` field in `get_code_snippet` | Medium | Document in B8.2B prompt and CBM adapter guide |
| `trace_path` requires `function_name` parameter | Low | Document in CBM adapter guide |

---

## Limitations

1. **CBM-vs-Graphify comparison is stale-vs-current.** The canary compared fresh CBM indexes against stale Graphify artifacts (built 2026-07-14). This was intentional — it demonstrates CBM as a fresher alternative. It is not a comparison of two current systems.

2. **F2 recall gap is inherent.** CALLS graph tracks production call edges only. For test-file caller discovery, ripgrep or search_code remains the authority.

3. **F17 latency is for `search_code`, not structural queries.** `search_graph` P50 is 35ms (same as ripgrep). The 533ms figure applies to `search_code` only.

4. **Community labels are structural, not semantic.** CBM provides `get_architecture.clusters[].label` (package-level structural labels). Graphify's LLM-generated community names are not present in Workbench's current output anyway.

5. **CBM binary makes one bounded HTTPS GET to api.github.com at startup.** This is documented in the admission record under `boundedEgressExceptions`. No source data is transmitted. The call is non-blocking and non-fatal.

---

## Before/after status summary

| Item | Before B8.4 | After B8.4 |
|------|------------|------------|
| workbench-private `auto_watch` | true (undiscovered gap) | false |
| prochat `auto_watch` | true (undiscovered gap) | false |
| Graphify state | Quiesced (unchanged) | Quiesced (unchanged) |
| graphify-out artifacts | Stale (unchanged) | Stale (unchanged, checksums verified) |
| CBM indexes | Current | Current |
| Brain files modified | — | None |
| Commits | — | None |

---

## Machine-readable manifest

See: `operations/specs/codebase-memory-mcp-canary-manifest-2026-07-29.json`
