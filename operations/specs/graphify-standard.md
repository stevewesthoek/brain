# Graphify Operating Standard

This is the canonical Brain-owned operating standard for Graphify across all repositories.

Mind owns the strategic reason for Graphify. Brain owns this operational standard, the execution path, scheduler/API integration, AI Model Selector integration, and dashboard visibility.

## Repository roles

```text
mind  = strategy and natural-language memory
brain = execution layer and operational standard
other repos = consumers: products, applications, codebases, research/project repositories
```

No project repository should invent its own Graphify workflow. Repositories consume this standard through a small declarative profile defined in `operations/specs/graphify-profile-contract.md`.

## Goals

Graphify must provide:

1. human sense-making for repository structure and file relationships;
2. cheap AI context through graph-first retrieval;
3. code architecture understanding for application repos;
4. knowledge/research mapping for Mind-like repos;
5. freshness, observability, and repeatable refresh automation.

## Canonical outputs

Required default outputs:

```text
.graphify-out/GRAPH_REPORT.md
.graphify-out/graph.json
.graphify-out/graph.html
.graphify-out/cache/
```

Optional code-repo outputs:

```text
.graphify-out/callflow.html
.graphify-out/architecture.html
```

Names may change only if this standard is updated.

## Graph modes

### Mode 1 — Human File Relationship Mode

Purpose:

```text
Give a human a clickable, natural-language view of how files relate.
```

Required behavior:

- files are visible as first-class nodes;
- folder/module/domain hubs may be used for navigation;
- relationships must be explainable in natural language;
- clicking a file should show why related files are related;
- the view may be a generated projection from canonical Graphify outputs.

Relationship reasons may include:

- direct Markdown/wiki link;
- import/call/reference;
- shared concept;
- same workflow/module/domain;
- referenced by a decision/report/task;
- Graphify direct edge with relation/confidence/source location.

### Mode 2 — AI Context Mode

Purpose:

```text
Give AI fast, low-token relational context before reading source files.
```

Required AI workflow:

```text
1. read .graphify-out/GRAPH_REPORT.md;
2. query/traverse .graphify-out/graph.json or Graphify query/path/explain commands;
3. inspect only targeted files;
4. report which graph path or community informed the answer when useful.
```

AI assistants should not broadly scan a repo first when Graphify outputs are fresh and available.

### Mode 3 — Code Architecture Mode

Purpose:

```text
Understand application/code repositories.
```

Required focus:

- modules;
- imports;
- classes;
- functions;
- API routes;
- call flows;
- database/schema relationships;
- infrastructure/runtime boundaries.

Do not collapse code graphs to only files when function/class/import/call relationships are needed.

### Mode 4 — Knowledge / Research Mode

Purpose:

```text
Understand Mind-like repositories, research notes, sources, concepts, decisions, and strategy.
```

Required focus:

- concepts;
- claims;
- sources;
- decisions;
- questions;
- communities;
- durable notes;
- source/capture relationships.

### Mode 5 — Operations / Freshness Mode

Purpose:

```text
Keep graph artifacts fresh, observable, and repeatable.
```

Required reporting:

- last full build;
- last incremental update;
- model/backend used;
- graph output paths;
- skipped files;
- errors;
- staleness status;
- dashboard visibility.

## Model selection policy

Graphify must use AI Model Selector for model/provider/backend decisions whenever semantic AI is needed.

Do not hardcode model fallback logic in per-repo scripts.

### Selector dependency

AI Model Selector now provides the repo-agnostic preference and fallback policy required by this standard.

See:

```text
operations/specs/ai-model-selector-preference-policy.md
```

The selector supports:

- task-type specific routing;
- quality tiers;
- ordered preferred models;
- ordered preferred providers;
- allowed/disallowed models;
- allowed/disallowed providers;
- fallback policies such as `selector_default`, `ordered`, `ordered_strict`, and `ordered_then_selector_default`;
- existing local/private/offline constraints;
- structured selector behavior without application-specific fallback logic.

Existing local-only behavior remains a hard constraint and must not be overridden by model preferences.

### Required Graphify task types

Define selector task types such as:

```text
graphify_semantic_full_build
graphify_semantic_critical_rebuild
graphify_incremental_update
graphify_code_ast_update
graphify_human_relationship_projection
```

### Full semantic build policy

Initial full semantic graph builds must request the highest-quality approved policy:

```yaml
task_type: graphify_semantic_full_build
quality_tier: highest
preferred_models:
  - codex-5.5-xhigh
  - bedrock-opus
fallback_policy: ordered
local_only: false
```

The names above are policy labels. The AI Model Selector must map them to current concrete providers/models.

### Critical semantic rebuild policy

Use the same model policy as the initial full semantic build.

### Incremental update policy

Incremental updates should prefer Graphify update/hook/watch and efficient/local paths when safe:

```yaml
task_type: graphify_incremental_update
quality_tier: efficient
allow_ast_only: true
prefer_local_when_safe: true
```

### Code-only AST update policy

Code-only AST changes should not use premium semantic models unless semantic extraction is required:

```yaml
task_type: graphify_code_ast_update
allow_ast_only: true
premium_model_required: false
```

## Graphify Orchestrator

Brain should provide a modular Graphify Orchestrator.

Responsibilities:

- read repo profile;
- verify Graphify is installed and versioned;
- ask AI Model Selector for semantic model/backend policy;
- run Graphify full/update/export commands;
- regenerate visual outputs;
- write refresh reports;
- expose status to Brain Core and Brain Console Center;
- never write generated artifacts to repo root;
- never mutate source files unless an explicit approved migration requires it.

The orchestrator must be reusable across repos.

## Repo profile contract

Every consuming repo should define a small declarative profile, not custom procedural logic.

Suggested file:

```text
.graphify-profile.json
```

Suggested schema:

```json
{
  "profile": "code-app | mind-knowledge | brain-runtime | research | mixed",
  "graphifyStandardVersion": "1",
  "outputs": ["report", "json", "html"],
  "optionalOutputs": ["callflow"],
  "initialBuildPolicy": "highest-quality",
  "incrementalPolicy": "efficient-update",
  "humanView": true,
  "aiContextMode": true,
  "exclude": ["node_modules/**", ".git/**", "dist/**", "build/**"]
}
```

Profiles may select a mode. Profiles may not hardcode model-provider fallback logic.

## Standard workflows

### Initial full build

```text
Graphify Orchestrator
→ read repo profile
→ request AI Model Selector policy: graphify_semantic_full_build
→ run Graphify full build
→ generate GRAPH_REPORT.md, graph.json, graph.html
→ generate optional code architecture/callflow outputs
→ write refresh report
→ expose status
```

### Incremental update

```text
Graphify Orchestrator
→ detect changed files or run explicit update
→ prefer Graphify update/hook/watch path
→ use local/efficient semantic path only when selector approves
→ update graph outputs
→ write refresh report
```

### AI assistant usage

```text
If .graphify-out/GRAPH_REPORT.md and .graphify-out/graph.json exist:
  read report first
  query graph before broad file reads
  inspect source files only after graph traversal
else:
  fall back to normal repo reading and recommend graph generation
```

### Human usage

```text
open GRAPH_REPORT.md first
open graph.html for visual navigation
use human file relationship view for file-to-file explanations
use code architecture view for application repos
```

## Acceptance criteria

A repo is Graphify-ready when:

- required outputs exist;
- refresh report exists;
- repo profile exists;
- AI can locate the graph standard and repo profile;
- AI can answer where to start without broad repo scanning;
- human can open a readable graph/report;
- refresh command is documented;
- model/backend used is recorded;
- generated outputs do not pollute repo root.

## Rollout order

1. Document strategy in Mind.
2. Document this Brain standard.
3. Verify or extend AI Model Selector preference/fallback capabilities.
4. Build Brain Graphify Orchestrator.
5. Define profile schema and starter profiles.
6. Apply profiles to Mind and Brain.
7. Validate on one code-app repo.
8. Roll out to other project/application repos.
9. Add Brain Console Center status.
10. Add scheduled refresh only after manual refresh is stable.

## Safety rules

- Do not bypass AI Model Selector for semantic model decisions.
- Do not create per-repo Graphify hacks.
- Do not treat custom visual renderers as canonical truth.
- Do not commit noisy generated outputs unless the standard says they are tracked.
- Do not overwrite existing repo files except generated Graphify outputs and refresh reports.
- Do not enable continuous graph rebuilds until update/hook/watch behavior is validated.

## Current decision

The standard architecture is:

```text
Mind strategy
→ Brain Graphify standard
→ AI Model Selector policy
→ Brain Graphify Orchestrator
→ repo profile
→ Graphify outputs
→ AI/human consumption modes
```
