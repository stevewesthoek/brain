# Graphify Quick Reference

**Last updated:** 2026-06-04  
**Status:** Live  

---

## What Graphify Does

Turns any folder (code, docs, PDFs, images, videos) into a **queryable knowledge graph** with three outputs:

1. **graph.html** — Interactive visualization (open in browser, click nodes, filter, search)
2. **GRAPH_REPORT.md** — Audit report with god nodes, surprising connections, design rationale
3. **graph.json** — Raw graph data for re-querying without re-reading files

---

## How to Use It

Just describe what you want in natural language. No commands to remember.

### Natural Language Examples

| What you want | Just say... |
|---------------|-----------|
| Map your codebase for the first time | "Map my codebase" / "Create a knowledge graph of my project" / "Turn this folder into a graph" |
| Query an existing graph | "Query my graph for the relationship between X and Y" / "What's connected to Z?" |
| Find a path between concepts | "Find the path from AuthModule to Database" / "How does X reach Y?" |
| Explain a concept | "Explain X" / "What is Y?" / "Tell me about Z" |
| Update after adding files | "Update the graph" / "Rebuild" / "I added new files, refresh the graph" |
| Understand god nodes | "What are the main components?" / "What's the architecture?" |
| Find surprising connections | "Are there unexpected dependencies?" / "Show me surprising connections" |

---

## Five Core Workflows

**1. MAP (First-time codebase graphing)**
- Detects corpus, runs AST + semantic extraction in parallel
- Identifies communities, labels them, generates outputs
- Shows god nodes, surprising connections, suggested questions
- Result: `/graphify .` → full graph in `graphify-out/`

**2. QUERY (Ask existing graph)**
- Two modes: BFS (broad neighbors) or DFS (trace a specific path)
- Example: "What's the data flow from API to Database?"
- Returns graph edges with source locations and confidence levels

**3. PATH (Shortest path between concepts)**
- Example: "Find the path from AuthModule to Database"
- Returns each hop, explains why each connection matters

**4. EXPLAIN (Understand a node)**
- Example: "Explain ValidateUserToken"
- Returns: what it is, what connects to it, why those connections matter

**5. UPDATE (Incremental re-extraction)**
- Detects new/modified files since last run
- Code-only changes: fast (AST only, no LLM)
- Mixed changes (docs/images/video added): semantic extraction needed

---

## Key Features

### Confidence Levels

Every edge has a confidence label:

| Label | Meaning | Examples |
|-------|---------|----------|
| **EXTRACTED** | Explicit in source (import, function call, citation) | `import X from Y`, `function A calls B()` |
| **INFERRED** | Reasonable deduction | Shared data structure, indirect dependency, co-occurrence |
| **AMBIGUOUS** | Uncertain; flagged for review | Weak thematic link, might be false positive |

### God Nodes

Most-connected concepts in your project. Everything flows through these. Examples:
- API router (called by many endpoints)
- Authentication middleware (used by many handlers)
- Database layer (referenced by many services)

### Surprising Connections

Cross-module relationships you wouldn't think to ask about. Ranked by how unexpected they are. Useful for finding hidden coupling or design debt.

### Design Rationale Extraction

Comments (`# WHY:`, `# NOTE:`, `# HACK:`) and docstrings are extracted as rationale nodes linked to the concepts they explain. Your design decisions are preserved and queryable.

---

## Output Files

```
graphify-out/
├── graph.html              Interactive visualization (open in browser)
├── GRAPH_REPORT.md         Audit report with god nodes + connections + Q&A
├── graph.json              Raw graph data (query-able, re-usable)
├── cost.json               Token cost tracker (cumulative across runs)
├── .graphify_python        Python interpreter path (auto-detected)
└── .graphify_root          Scan root path (for --update)
```

**Persistent:** All outputs in `graphify-out/` survive between runs. Cache is checked automatically on re-runs.

---

## Nightly Automation

The Office nightly scheduler runs Graphify through:

```text
tools/scripts/graphify-nightly.sh
```

The scheduler job name is:

```text
graphify-nightly
```

The job discovers Git repositories under:

```text
/Users/Office/Repos
```

Per repository behavior:

| Repo state | Action |
|---|---|
| `graphify-out/graph.json` exists | Run `graphify update <repo>` |
| No graph exists | Ask AI Model Selector for `codebase_semantic_graph` with `local_only=true`; run `graphify extract <repo> --backend ollama --model <selected-model> --out <repo>` only when a safe local model is selected |

Default safety limits:

| Setting | Default |
|---|---|
| First-time semantic builds per night | `1` |
| Existing graph updates per night | `12` |
| Per-repo timeout | `7200` seconds |
| Whole scheduler job timeout | `21600` seconds |

The AI Model Selector owns local model admission. Graphify does not choose `qwen2.5:32b` directly. The selector only returns 32B when local load, macOS memory pressure, loaded Ollama models, model availability, circuit state, and rate-limit state pass the `codebase_semantic_graph` burst policy. If no safe local model is available, the repo is skipped for that night. After a first-time extraction attempt, the runner calls `ollama stop <model>` so the selected model does not remain loaded for the rest of the day.

---

## Performance & Cost

| Corpus Size | Time | Token Cost (Gemini Flash) | Notes |
|------------|------|---------|-------|
| <100 files, <100k words | 30–60s | Minimal (~500k if mixed) | Code-only: free (AST) |
| 100–500 files | 2–5 min | ~2M tokens | Dispatch 5–10 subagents in parallel |
| 500–2k files | 5–15 min | ~10M tokens | May need focus on core modules |
| 2k+ files | 15+ min | Expensive | Consider --mode shallow first |

**Caching saves 70–80% on re-runs:** Only changed files re-extract.

---

## Orchestrator vs. Direct CLI

### Use the Orchestrator (`/graphify`)

When you want natural language routing. Just describe what you need:

```
/graphify (natural language)
User: "Map my codebase"
      → Orchestrator classifies as MAP
      → Runs full pipeline
      → Presents findings
```

### Use the CLI Directly

When you know exactly which command to run:

```bash
graphify .                          # Full pipeline
graphify query "my question"        # Query existing graph
graphify path "NodeA" "NodeB"       # Shortest path
graphify explain "NodeName"         # Explain a concept
graphify --update                   # Incremental update
```

**Both paths coexist:** Orchestrator is a convenience layer; underlying tool is always accessible.

---

## Installation & Setup

### Graphify is Pre-Installed

The skill installs the `graphifyy` Python package automatically on first use:

```bash
# First run: auto-installs via uv (preferred) or pipx or pip
/graphify .

# Python interpreter and cache paths are auto-detected and saved
# Subsequent runs reuse the same interpreter
```

### Verify Installation

```bash
which graphify           # Check if CLI is in PATH
graphify --version      # Check version
graphify --help         # CLI help
```

---

## Common Tasks

### Map a new project

```
User: "Map my codebase"
→ Detects files
→ Runs AST + semantic extraction (parallel)
→ Builds graph, clusters, analyzes
→ Shows god nodes + surprising connections + questions
```

**Time:** 30s–5 min depending on size  
**Output:** Three files in `graphify-out/`

### Understand architecture after mapping

```
User: "The most interesting question this graph can answer is [Q]. Want me to trace it?"
→ Runs /graphify query with that question
→ Walks through answer using graph structure
→ Offers follow-up: "This connects to X — want to go deeper?"
```

### Find unexpected dependencies

From GRAPH_REPORT.md, look at "Surprising Connections" section:

```
Surprising Connection: AuthModule → PaymentProcessor
  └─ Why surprising: These modules live in different folders
     and have no import link, but share database write patterns
     (co-occurrence in transaction logs)
```

### Query after adding files

```
User: "I added database migration code, update the graph"
→ Detects new/changed files
→ Runs --update (incremental)
→ Code-only changes: skips semantic extraction (fast)
→ Shows: "+5 new nodes, +12 new edges"
→ Offers: "Most interesting new concept: DatabaseMigrationOrchestrator — want to explore?"
```

---

## Integration with Other Skills

| Skill | Complementary Use |
|-------|------------------|
| `/design` | Graphify maps code structure; `/design` maps visual/UX patterns |
| `/investigate` | Graphify maps relationships; `/investigate` diagnoses specific issues |
| `/learner` | Graphify extracts design rationale automatically; `/learner` captures patterns post-hoc |
| `/web` | Graphify handles local files; `/web` fetches external docs (add to corpus via `/graphify add <url>`) |

Don't invoke other skills mid-graphify. Let graphify finish, then use other tools to act on findings.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No graph found" | Run `/graphify .` first to build one |
| Query returns nothing | The concept may not be in the graph. Try: (1) different name, (2) broader concept, (3) full pipeline re-run if files changed |
| Graph has few nodes | Check `graphify-out/.graphify_detect.json`: were files skipped? Try `--mode deep` or add specific file patterns. |
| Token cost is high | For code-only: should be minimal. If high, docs/images were added. Cache future runs to save 70–80%. |
| Python interpreter not found | Graphify auto-detects on first run. If stuck: `uv tool install graphifyy` or `pipx install graphifyy` |

---

## References

- **PyPI package:** `graphifyy` (double-y)
- **GitHub:** https://github.com/safishamsi/graphify
- **CLI installed at:** `~/.local/bin/graphify` or `~/.nix-profile/bin/graphify` (depending on installer)
- **Skill location:** `brain/ai/skills/vendors/safishamsi/graphify/SKILL.md`
- **This reference:** `brain/operations/runbooks/graphify-quick-reference.md`

---

## Natural Language is All You Need

Remember: **You never need to know or use graphify CLI commands.** Just describe what you want in natural language:

| Intent | Just say it |
|--------|-----------|
| Map | "Map my codebase" |
| Query | "What connects X and Y?" |
| Path | "Find the path from X to Y" |
| Explain | "Explain X" |
| Update | "Update the graph" |

The orchestrator detects your intent and runs the right workflow automatically.

---

## For Power Users

If you know which graphify command to use, call it directly via CLI:

```bash
cd ~/Repos/my-project
graphify .                                # Full pipeline
graphify --update                         # Incremental update
graphify query "What is the auth flow?"   # Query
graphify path "API" "Database"            # Shortest path
graphify explain "ValidateUser"           # Explain
```

Output goes to `graphify-out/` automatically. The skill orchestrator and direct CLI are fully compatible.
