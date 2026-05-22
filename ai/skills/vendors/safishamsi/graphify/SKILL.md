---
name: graphify
description: Codebase knowledge graph orchestrator. Single entry point for turning any folder (code, docs, PDFs, images, videos) into a queryable, interactive knowledge graph. Automatically detects content, extracts entities and relationships, identifies god nodes (most-connected concepts), spots surprising cross-module connections, and generates HTML visualization + markdown report + JSON graph. Use when asking questions about project structure, architecture, dependencies, data flow, or design rationale. AI-agnostic, IDE-agnostic. Works with Claude Code, Codex, Gemini CLI, Cursor, Kiro, Antigravity, and all IDEs via natural language.
---

# Graphify — Codebase Knowledge Graph Orchestrator

You are the **single entry point** for turning any project—code, documentation, papers, images, videos—into a navigable, queryable knowledge graph. When the user says anything about understanding their codebase, architecture, dependencies, or design decisions, this skill runs.

The user does not need to know that:
- The underlying tool is `graphifyy` CLI
- Different export formats exist (HTML, JSON, SVG, Neo4j, GraphML)
- AST vs. semantic extraction happens
- Community detection, god nodes, and surprising connections are separate operations

Your job is to:
1. Classify their intent (map codebase / query existing graph / explore relationships)
2. Route to the correct command and parameters
3. Execute the pipeline step-by-step with clear progress
4. Present findings in natural language, not raw JSON or tool output

**Natural language triggers (non-exhaustive):**
- "Map my codebase" / "Create a graph of my project"
- "What are the main components in my code?"
- "How does X connect to Y?"
- "What's the data flow in my system?"
- "Which modules are most critical?" (god nodes)
- "Are there surprising dependencies I'm missing?"
- "Help me understand the architecture"
- "Query my knowledge graph for..."
- "What explains [concept]?"
- "Find the path from [module A] to [module B]"
- "I just added new files, rebuild the graph"
- "Turn this folder into a queryable graph"

---

## Standing Graphify Laws (Always Active)

Apply these silently — never explain them to the user.

### Detection & Preparation
- **Detect first, ask later.** Before running extraction, always run detection (Step 2) to show the corpus stats and warn if >200 files or >2M words.
- **Install silently.** If graphify is not installed, detect this and install with `uv tool install graphifyy` (most reliable) or fallback to `pipx` or `pip`. No "installing now" message—handle it transparently.
- **Check cache first.** Before running semantic extraction on a large corpus, check the cache for previously-extracted files. Skip them and only process new/changed files.

### Extraction Ethics
- **Never invent edges.** If unsure whether two concepts are related, mark the edge AMBIGUOUS rather than omitting it. Ambiguity is honest.
- **Honor confidence levels.** EXTRACTED edges must have confidence_score = 1.0. INFERRED edges use discrete values (0.95, 0.85, 0.75, 0.65, 0.55) based on evidence strength, never 0.5.
- **Extract design rationale.** Code comments (`# WHY:`, `# NOTE:`, `# HACK:`), docstrings, and design decisions from docs are just as important as structural edges. Preserve them as rationale nodes linked to the concepts they explain.

### Querying & Navigation
- **Progressive discovery.** After the first map, offer to trace paths, explain concepts, and suggest questions. The graph is the map; your job is to be the guide.
- **Three output formats.** Always generate: `graph.html` (interactive visualization), `GRAPH_REPORT.md` (audit report with god nodes and surprising connections), `graph.json` (queryable data for future sessions).
- **Obsidian only if asked.** Obsidian vault export (`--obsidian`) is opt-in — skip unless the user explicitly requests it.

### Incremental Updates
- **--update is fast.** When the user has modified files since the last run, use `--update` to re-extract only changed files. Code-only changes skip semantic extraction entirely (no LLM calls).
- **Preserve existing graph.** Merging respects what was there before — new nodes and edges are added, old ones are kept (unless files were deleted).

### Token Transparency
- **Always report token cost.** At the end of every run, show how many input/output tokens were used. Cumulative cost is tracked in `graphify-out/cost.json`.
- **Budget awareness.** For very large corpora, ask about constraints before dispatching semantic subagents. If the user is on free tier or limited budget, suggest `--mode shallow` or running on a subfolder first.

---

## Step 0: Classify Intent

Parse the user's message and route to one of five workflows:

| User says | Intent | Workflow |
|-----------|--------|----------|
| "map my codebase", "create a graph", "turn X into a graph", "graph my project" | MAP (first time) | A: Full Pipeline |
| "query the graph for...", "what do we know about X", existing graph exists | QUERY | B: Query Existing Graph |
| "find the path from X to Y", "how does X reach Y" | PATH | C: Find Shortest Path |
| "explain X" (where X is a concept in the graph) | EXPLAIN | D: Explain Node |
| "I added new files", "update the graph", "rebuild" | UPDATE | E: Incremental Update |

**No intake question needed.** Classify directly from the message and proceed.

---

## Workflow A: MAP (First-Time Codebase Graphing)

### A0: Check graphify installation

```bash
if ! command -v graphify &> /dev/null; then
  echo "Installing graphify..."
  if command -v uv &> /dev/null; then
    uv tool install graphifyy
  elif command -v pipx &> /dev/null; then
    pipx install graphifyy
  else
    python3 -m pip install graphifyy -q
  fi
fi
```

### A1: Detect corpus

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from graphify.detect import detect
from pathlib import Path

result = detect(Path('.'))
print(json.dumps(result, indent=2))
" > graphify-out/.graphify_detect.json
```

**Present to user (clean summary, not JSON):**

```
Corpus analysis:
  X files · ~Y words
  • Code: N files (Python, TypeScript, Go, ...)
  • Docs: N files (Markdown, PDF, ...)
  • Images: N
  • Video: N
```

**Check for warnings:**
- If `total_files` > 200 OR `total_words` > 2M: show top 5 subdirectories by file count and ask which to focus on. Wait for user's answer before proceeding.
- If `skipped_sensitive` > 0: mention "N sensitive files skipped (e.g., .env, keys)" — no need to list them.

### A2-A9: Run full pipeline

Follow the step-by-step instructions in the original `graphify/skill.md` file (Steps 1–9):
- Install
- Detect
- Extract (AST + semantic, parallel)
- Build graph, cluster, analyze
- Label communities
- Generate outputs (HTML always; Obsidian/Neo4j/SVG only if explicitly requested)
- Benchmark (if >5k words)
- Cleanup and report

**Key implementation notes:**
- Dispatch semantic subagents using `Agent(subagent_type="general-purpose")` — NOT Explore (read-only)
- All subagents in one message (parallel)
- After each Agent completes, read `usage` field and write real token counts back into chunk files
- Merge all chunks, build graph, cluster, analyze

### A10: Present findings

After Step 9 completes, paste these three sections from `GRAPH_REPORT.md` directly into chat:

**God Nodes** — most-connected concepts in the project
**Surprising Connections** — cross-module relationships that aren't obvious
**Suggested Questions** — 4–5 queries the graph can answer

Then offer to explore:

> "The most interesting thing this graph reveals: **[pick the most striking suggested question]**. Want me to trace it?"

---

## Workflow B: Query Existing Graph

**Triggers:** "query the graph for...", "what's the relationship between...", existing `graphify-out/graph.json` present

### B1: Verify graph exists

```bash
if [ ! -f graphify-out/graph.json ]; then
  echo "No graph found. Run /graphify . first to build one."
  exit 0
fi
```

### B2: Execute query

Ask one clarifying question **only if the user's question is ambiguous:**

> "BFS (broad context, nearest neighbors) or DFS (trace a specific path)?"

Default to BFS if unclear.

```bash
graphify query "USER_QUESTION"
# or: graphify query "USER_QUESTION" --dfs
```

### B3: Answer using graph output

Write a 3–5 sentence answer citing what the graph shows. Quote `source_location` when available. **Do not hallucinate edges not in the graph.**

After answering, save the result back into the graph:

```bash
graphify save-result --question "USER_QUESTION" --answer "YOUR_ANSWER" --type query --nodes NODE1 NODE2
```

---

## Workflow C: Find Shortest Path

**Triggers:** "path from X to Y", "how does X reach Y", "what connects X and Y"

### C1: Execute path query

```bash
graphify path "CONCEPT_A" "CONCEPT_B"
```

### C2: Explain the path

Write 3–5 sentences explaining each hop and why it's significant. Quote source locations.

Save the result:

```bash
graphify save-result --question "Path from CONCEPT_A to CONCEPT_B" --answer "YOUR_EXPLANATION" --type path_query --nodes CONCEPT_A CONCEPT_B
```

---

## Workflow D: Explain Node

**Triggers:** "explain X", "what is X", "tell me about [concept]"

### D1: Execute explain

```bash
graphify explain "CONCEPT_NAME"
```

### D2: Write explanation

3–5 sentences about what this node is, what it connects to, and why those connections matter. Use source locations as citations.

Save the result:

```bash
graphify save-result --question "Explain CONCEPT_NAME" --answer "YOUR_EXPLANATION" --type explain --nodes CONCEPT_NAME
```

---

## Workflow E: Incremental Update

**Triggers:** "update the graph", "rebuild", "I added new files", last run was >1 hour ago and user mentions changes

### E1: Check for changes

```bash
graphify --update .
```

This detects new/modified files since last run.

### E2: Smart re-extraction

- **Code-only changes:** Skips semantic extraction (no LLM calls). AST extracts new code, merges with existing graph.
- **Docs/images/videos added:** Runs full pipeline (semantic extraction needed).

### E3: Merge and report

After merge, show the graph diff:

```
Updated: +X new nodes, +Y new edges
[List top 3 new concepts]
```

Then offer to explore what's new:

> "Your graph grew by X concepts. The most interesting new connection: [interesting edge]. Want to explore?"

---

## Natural Language Routes (25+)

| User says | Workflow | Action |
|-----------|----------|--------|
| "map my codebase" | A | Full pipeline on `.` |
| "turn this folder into a graph" | A | Full pipeline on specified folder |
| "create a knowledge graph of my project" | A | Full pipeline |
| "graph my code" | A | Full pipeline on `.` |
| "clone and graph this GitHub repo" | A | Pass GitHub URL; full pipeline |
| "what are the main components?" | A→B | Map first if no graph; then query god nodes |
| "what's the architecture?" | A→B | Map; present god nodes + communities |
| "query my graph for..." | B | Query existing graph |
| "what's the relationship between X and Y?" | B | Query existing graph |
| "how does X connect to Y?" | B | Query or path (user chooses) |
| "find the path from X to Y" | C | Path query |
| "what's the shortest path from X to Y?" | C | Path query |
| "explain X" | D | Explain node |
| "what is X?" | D | Explain node |
| "tell me about [concept]" | D | Explain node |
| "I just added new files, update the graph" | E | Run `--update` |
| "rebuild the graph" | E | Run `--update` or full pipeline if corrupt |
| "the graph is out of date" | E | Run `--update` |
| "I've been working on the code, refresh the graph" | E | Run `--update` |
| "what are god nodes?" | B | Query graph or run analysis |
| "show me surprising connections" | B | Query or full pipeline if new |
| "what surprised you about the graph?" | B | Present from GRAPH_REPORT.md |
| "I want to understand my data flow" | A→B | Map; query for data-related edges |
| "where's the coupling?" | B | Query for high-degree nodes and tight clusters |
| "are there circular dependencies?" | B | Query for cycles (special graph analysis) |

---

## AI-Agnostic & IDE-Agnostic Operation

This skill is pure Markdown + natural language routing. Works identically on:
- **Claude Code** — `/graphify` or natural language (hook auto-triggers)
- **Codex CLI** — `/graphify`
- **Gemini CLI** — `/graphify` via `run_shell_command`
- **Cursor** — via `.cursor/rules.md` or command palette
- **Kiro IDE/CLI** — via `/graphify`
- **Antigravity** — via `@graphify` or `/graphify`
- **VS Code Copilot** — via chat

**Tool wrappers (CLI-based):**
- `graphify` CLI → `graphifyy` Python package on PyPI (installed once, reused across all IDEs)
- Outputs stored in local `graphify-out/` directory (portable, inspectable, cacheable)
- No cloud sync, no vendor lock-in, no authentication required

**Source of truth:**
- This SKILL.md file (routing logic)
- `graphifyy` Python library (extraction, clustering, visualization)
- Storage: local `graphify-out/` (graph.json, graph.html, GRAPH_REPORT.md, cost.json)

**Zero dependencies:** All tools are plain bash. No MCP servers, no IDE-specific plugins, no cloud services. Backup is `tar -cz graphify-out/`.

---

## Underlying Tool Remains Independent

**Important:** The `/graphify` orchestrator is a **routing layer only**. The underlying tool remains fully independent and directly callable.

- Users can still run `graphify .` directly via CLI
- Users can still invoke `graphify query`, `graphify path`, `graphify explain` directly
- Each CLI command has its own documentation and remains fully independent
- The orchestrator is a convenience layer for natural language routing; power users can skip it

**Decision tree for users:**
- "I don't know which graphify command to use" → Use `/graphify` orchestrator (natural language routing)
- "I know exactly which command I want" → Call it directly (skip the orchestrator)
- Both paths are equally valid and coexist.

---

## Standing Implementation Checklist

Before presenting findings to the user, verify:

- [ ] Detection ran and corpus stats were shown
- [ ] No files were skipped without mentioning why
- [ ] Token cost was tracked and reported
- [ ] Graph has >0 nodes (failed extractions are caught)
- [ ] Three outputs exist: `graph.html`, `GRAPH_REPORT.md`, `graph.json`
- [ ] God nodes, surprising connections, and suggested questions were extracted
- [ ] Confidence labels (EXTRACTED/INFERRED/AMBIGUOUS) are accurate
- [ ] Community labels are human-readable, not auto-generated
- [ ] User was offered next steps (explore, query, drill deeper)

---

## Integration with Other Skills

**Graphify complements these existing skills:**

| Skill | Relationship |
|-------|--------------|
| `/investigate` | Graphify maps structure; `/investigate` diagnoses specific issues in structure |
| `/learner` | Graphify extracts design rationale from comments; `/learner` captures patterns post-hoc |
| `/web` | Graphify handles local files; `/web` fetches external docs (can be added to corpus via `/graphify add <url>`) |
| `/code` (if built) | Graphify would feed into a potential code orchestrator as structured graph data |

**Do NOT use together:** Don't invoke other skills mid-graphify run. Let graphify finish, then use other tools to act on findings.

---

## Performance & Cost

| Corpus Size | Typical Time | Token Cost (Gemini) | Notes |
|------------|-----|---------|-------|
| <100 files, <100k words | 30–60s | Minimal | Code-only: free (AST only). Mixed: ~500k tokens. |
| 100–500 files, 100k–500k words | 2–5 min | ~2M tokens | Dispatch 5–10 semantic subagents in parallel. |
| 500–2k files, 500k–2M words | 5–15 min | ~10M tokens | Large corpus; may need `--mode shallow` or focus on subfolder. |
| 2k+ files, 2M+ words | 15+ min | Expensive | Ask user to focus on core modules first. |

Caching saves 70–80% on re-runs: only changed files re-extract.

---

## Debugging

**No graph output?**
```bash
graphify-out/GRAPH_REPORT.md
```
Should exist and be non-empty. If missing, re-run with `graphify .` and check for errors.

**Graph has only a few nodes?**

---

## Persistence Convention

After generating a graph, persist the output for future sessions:

### Cache location

Store graph output at `.brain/graph.json` in the target repo root.

### Save after generation

```bash
cp graphify-out/graph.json .brain/graph.json
```

### Reload at session start

At the beginning of any coding session, check for a cached graph:

```bash
if [ -f .brain/graph.json ]; then
  echo "Cached graph available — loading structural context"
  # Use cached graph for dependency queries
fi
```

### Incremental update rule

Regenerate the graph when:
- More than 10 files changed since last generation (check via `git diff --stat`)
- A new dependency was added (package.json changed)
- User explicitly requests "refresh the graph"

Otherwise, use the cached version.

### Gitignore

Add `.brain/graph.json` to the repo's `.gitignore` — it is a local cache, not committed.
Check detection: `graphify-out/.graphify_detect.json` — if most files were skipped, that's the issue. Re-run with `--mode deep` or add specific file patterns.

**Token cost is high?**
- For code-only corpora: should be minimal (AST only, no LLM). If high, docs/images were added.
- For mixed corpora: expected to be high. Cache subsequent runs to save 70–80%.

**Query returns nothing?**
The graph may not have the concept. Try similar names or run `graphify explain [broader_concept]` to explore what's available.

---

## References

- **PyPI:** https://pypi.org/project/graphifyy/
- **GitHub:** https://github.com/safishamsi/graphify
- **Docs:** https://github.com/safishamsi/graphify/blob/v7/README.md
- **License:** MIT
