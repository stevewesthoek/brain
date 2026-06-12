# Graphify Nightly — Phased Knowledge Graph Maintenance

**Status:** Active six-phase workflow; Phases 1–5 validated, Phase 6 bounded for validation  
**Last updated:** 2026-06-12  
**Coordinator:** `tools/scripts/office-nightly-scheduler.sh`  
**Canonical entry point:** `tools/scripts/graphify-nightly.sh`

Graphify has one supported operating model in this repo: use the phased nightly scheduler. Do not run ad-hoc full-repo Graphify crawls as the normal workflow. The phased system keeps each pass bounded, preserves existing graph outputs between overlay phases, and lets the nightly cutoff decide how far the maintenance window gets.

Graphify also has one supported consumption model: use `docs/system/graphify-context-standard.md`. LLMs, IDE assistants, terminal CLIs, and agent runners should treat Graphify artifacts as the low-token repo map for broad context, then verify with exact source reads before patching.

---

## One Way of Working

Run Graphify through `tools/scripts/graphify-nightly.sh`, either directly for testing or indirectly through `tools/scripts/office-nightly-scheduler.sh`.

The Office scheduler invokes the Graphify scheduler with the default phase set:

```bash
GRAPHIFY_PHASES="1 2 3 4 5 6"
```

The Graphify scheduler then runs **phase-major across repositories**:

```text
Phase 1 for every discovered repo
Phase 2 for every discovered repo
Phase 3 for every discovered repo
Phase 4 for every discovered repo
Phase 5 for every discovered repo
Phase 6 for every discovered repo
```

This is intentional. It prevents one large repo from consuming every refinement phase before smaller repos get a baseline graph.

---

## Validated Phase Model

The old `2a` / `2b` names are retired. The validated numeric phases are:

| Phase | Name | Purpose | Validated status |
|---|---|---|---|
| 1 | Code baseline | Clean code graph; excludes docs/config/generated/vendor/runtime noise | Validated |
| 2 | README overlay | Root README-only overlay merged into the existing graph | Validated |
| 3 | Limited docs overlay | Bounded first-level docs overlay merged into the existing graph | Validated |
| 4 | Focused refinement | Generic high-signal docs overlay: README plus first-level architecture/design/standard/runbook/spec/ADR/decision-style Markdown | Validated |
| 5 | Community naming/readability | Recluster current graph, apply deterministic community names, inject names into interactive `graph.html` | Validated |
| 6 | Bounded final validation | Recluster/validate the current graph by default. Extraction is disabled unless `GRAPHIFY_PHASE6_EXTRACT=1`; expensive `--mode deep` additionally requires `GRAPHIFY_PHASE6_DEEP_MODE=1` | Active, bounded |

Validated means the phase has been run successfully on `brain` with bounded runtime and non-destructive graph preservation.

---

## Phase Budgets and Defaults

`tools/scripts/graphify-nightly.sh` owns the defaults:

```bash
GRAPHIFY_PHASES="${GRAPHIFY_PHASES:-1 2 3 4 5 6}"
GRAPHIFY_REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-1800}"
```

Each repository phase is capped at about 30 minutes by default. Phase 5 is expected to finish quickly because it does not extract, scan docs, or call an LLM.

Model defaults:

```text
Phase 1: fast model
Phase 2: docs fast model
Phase 3: docs fast model
Phase 4: refined model
Phase 5: refined model, but only for cluster-only/readability work
Phase 6: deep model
```

---

## Graph Preservation Rules

Overlay phases must preserve existing graph outputs. Before overlay/refinement work, the scheduler snapshots:

```text
graphify-out/graph.json
graphify-out/graph.html
graphify-out/GRAPH_REPORT.md
graphify-out/.graphify_analysis.json
```

If extraction, clustering, output validation, unsafe overwrite detection, or suspicious shrink detection fails, the scheduler restores the snapshot.

Phase 5 must preserve Graphify's interactive `graph.html`. It may inject community names into the existing interactive HTML, but it must not replace it with the static readable fallback unless `graph.html` is missing.

---

## Phase 5 Readability Policy

Phase 5 is the only normal readability phase. Do not add `5a` / `5b` variants.

Phase 5 does the following:

```text
1. Load the current graph.
2. Run `graphify cluster-only`.
3. Build deterministic community names from representative node labels and source files.
4. Write names into `graph.json` as `graph.community_names` and node-level `community_name`.
5. Inject those names into the interactive `graph.html`.
6. Validate that `graph.json`, `graph.html`, and `GRAPH_REPORT.md` still exist.
```

This makes the graph readable without another extraction pass.

---

## Standard Commands

Single-repo phase test:

```bash
cd /Users/Office/Repos/stevewesthoek/brain && \
GRAPHIFY_REPO_ROOTS="/Users/Office/Repos/stevewesthoek/brain" \
GRAPHIFY_PHASES="5" \
GRAPHIFY_REPO_TIMEOUT_SECONDS="1800" \
SCHEDULER_CUTOFF_HOUR="24" \
GRAPHIFY_BACKEND="ollama" \
GRAPHIFY_FAST_MODEL="gemma4:e4b-mlx" \
GRAPHIFY_DOCS_FAST_MODEL="gemma4:e4b-mlx" \
GRAPHIFY_REFINED_MODEL="gemma4:12b-mlx" \
GRAPHIFY_DEEP_MODEL="gemma4:12b-mlx" \
GRAPHIFY_PHASE1_VIZ_NODE_LIMIT="2500" \
OLLAMA_API_KEY="ollama" \
GRAPHIFY_OLLAMA_NUM_CTX="8192" \
GRAPHIFY_OLLAMA_KEEP_ALIVE="30" \
GRAPHIFY_VIZ_NODE_LIMIT="30000" \
GRAPHIFY_MAX_CONCURRENCY="1" \
GRAPHIFY_API_TIMEOUT="900" \
tools/scripts/graphify-nightly.sh
```

Normal Office scheduler run:

```bash
FORCE_RUN=1 /Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh
```

Logs:

```bash
tail -f ~/Library/Logs/office-scheduler/graphify-nightly.log
```

---

## Expected Success Signals

Phase 4 success should look bounded:

```text
phase4-focused-refinement
0 code
small docs count
merged phase overlay graph ...
phase ok
```

Phase 5 success should look fast:

```text
Loading existing graph...
Re-clustering...
applied deterministic community names communities=...
injected community names into graph.html communities=...
phase ok
```

A fast Phase 5 is correct. It is not supposed to do extraction.

---

## Scheduling and Integration

Graphify does not have its own LaunchAgent. It runs through:

```text
Service: com.office.nightly-scheduler
Script: tools/scripts/office-nightly-scheduler.sh
Graphify step: run_graphify_nightly
Canonical Graphify script: tools/scripts/graphify-nightly.sh
```

The Office scheduler must not embed old phase names. Its Graphify command must default to:

```bash
GRAPHIFY_PHASES="${GRAPHIFY_PHASES:-1 2 3 4 5 6}"
```

---

## Troubleshooting

### Graph is structurally good but labels are generic
Run Phase 5. It reclusters and injects deterministic labels into both `graph.json` and the interactive `graph.html`.

### Graph HTML looks mangled
Do not use the static readable fallback unless `graph.html` is missing. Rerun Phase 5 with the current scheduler; it preserves the interactive HTML and only injects names.

### Phase 4 returns invalid JSON for a chunk
Graphify may keep a partial result and continue. This is acceptable if the phase merges safely, validates required outputs, and finishes `phase ok`.

### A phase fails or suspiciously shrinks the graph
The scheduler should restore the pre-phase snapshot and fail the phase rather than losing the previous graph.
