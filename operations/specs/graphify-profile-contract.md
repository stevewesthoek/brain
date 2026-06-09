# Graphify Profile Contract

This contract defines the declarative profile each repository uses to consume the Brain-owned Graphify operating standard.

It is repo-agnostic and contains no procedural logic.

See also:

- `operations/specs/graphify-standard.md`
- `operations/specs/graphify-orchestrator-implementation-plan.md`
- `operations/specs/ai-model-selector-preference-policy.md`
- `operations/specs/graphify-profile.schema.json`
- `operations/specs/graphify-profile.examples.json`

## Purpose

A Graphify profile tells the future Brain Graphify Orchestrator how a repository should be treated.

It should answer:

- what kind of repo is this;
- which Graphify modes apply;
- which outputs are required;
- which model-selection policy should be requested from AI Model Selector;
- which files/folders should be excluded;
- whether human and AI graph consumption are expected.

A profile must not hardcode model-provider fallback logic or custom scripts.

## Suggested repo-local file

Each consuming repo should eventually contain:

```text
.graphify-profile.json
```

No consuming repo should add this file until the orchestrator can validate it.

## JSON shape

```json
{
  "graphifyStandardVersion": "1",
  "profile": "code-app",
  "repoRole": "consumer",
  "modes": ["ai-context", "code-architecture", "human-file-relationship", "operations-freshness"],
  "outputs": ["report", "json", "html"],
  "optionalOutputs": ["callflow-html"],
  "initialBuildPolicy": {
    "taskType": "graphify_semantic_full_build",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "criticalRebuildPolicy": {
    "taskType": "graphify_semantic_critical_rebuild",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "incrementalPolicy": {
    "taskType": "graphify_incremental_update",
    "qualityTier": "efficient",
    "selectionPolicy": "selector_default",
    "preferLocalWhenSafe": true,
    "allowAstOnly": true
  },
  "exclude": [".git/**", "node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**"],
  "trackGeneratedArtifacts": [".graphify-out/GRAPH_REPORT.md", ".graphify-out/graph.json", ".graphify-out/graph.html"],
  "dashboardVisibility": true,
  "humanReadableFileGraph": true,
  "aiContextMode": true
}
```

## Required fields

- `graphifyStandardVersion`
- `profile`
- `repoRole`
- `modes`
- `outputs`
- `initialBuildPolicy`
- `criticalRebuildPolicy`
- `incrementalPolicy`
- `exclude`

## Supported profiles

### mind-knowledge

For the Mind repo.

Focus:

- natural-language memory;
- strategy;
- sources;
- captures;
- wiki knowledge;
- decisions;
- tasks and system contracts.

Primary modes:

- `knowledge-research`;
- `human-file-relationship`;
- `ai-context`;
- `operations-freshness`.

### brain-runtime

For the Brain repo.

Focus:

- execution layer;
- Brain Core;
- AI Model Selector;
- schedulers;
- console;
- operational specs;
- automation scripts.

Primary modes:

- `code-architecture`;
- `operations-freshness`;
- `ai-context`;
- `human-file-relationship`.

### code-app

For application/product/codebase repos.

Focus:

- modules;
- functions/classes;
- imports;
- API routes;
- call flow;
- runtime boundaries.

Primary modes:

- `code-architecture`;
- `ai-context`;
- `human-file-relationship`;
- `operations-freshness`.

### research

For research-heavy repos.

Focus:

- papers;
- sources;
- evidence;
- claims;
- concepts;
- questions.

Primary modes:

- `knowledge-research`;
- `ai-context`;
- `human-file-relationship`.

### mixed

For repos that combine code, docs, strategy, and research.

The orchestrator should validate the chosen outputs carefully because mixed repos can become noisy.

## Example: Mind profile

```json
{
  "graphifyStandardVersion": "1",
  "profile": "mind-knowledge",
  "repoRole": "strategy-memory",
  "modes": ["knowledge-research", "human-file-relationship", "ai-context", "operations-freshness"],
  "outputs": ["report", "json", "html"],
  "optionalOutputs": [],
  "initialBuildPolicy": {
    "taskType": "graphify_semantic_full_build",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "criticalRebuildPolicy": {
    "taskType": "graphify_semantic_critical_rebuild",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "incrementalPolicy": {
    "taskType": "graphify_incremental_update",
    "qualityTier": "efficient",
    "selectionPolicy": "selector_default",
    "preferLocalWhenSafe": true,
    "allowAstOnly": true
  },
  "exclude": [".git/**", ".obsidian/**", ".graphify-out/cache/**"],
  "trackGeneratedArtifacts": [".graphify-out/GRAPH_REPORT.md", ".graphify-out/graph.json", ".graphify-out/graph.html"],
  "dashboardVisibility": true,
  "humanReadableFileGraph": true,
  "aiContextMode": true
}
```

## Example: code-app profile

```json
{
  "graphifyStandardVersion": "1",
  "profile": "code-app",
  "repoRole": "application-codebase",
  "modes": ["code-architecture", "ai-context", "human-file-relationship", "operations-freshness"],
  "outputs": ["report", "json", "html"],
  "optionalOutputs": ["callflow-html"],
  "initialBuildPolicy": {
    "taskType": "graphify_semantic_full_build",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "criticalRebuildPolicy": {
    "taskType": "graphify_semantic_critical_rebuild",
    "qualityTier": "highest",
    "selectionPolicy": "ordered_premium",
    "preferredModels": ["gpt-5.5", "us.anthropic.claude-opus-4-6-v1"],
    "fallbackPolicy": "ordered_then_selector_default"
  },
  "incrementalPolicy": {
    "taskType": "graphify_incremental_update",
    "qualityTier": "efficient",
    "selectionPolicy": "selector_default",
    "preferLocalWhenSafe": true,
    "allowAstOnly": true
  },
  "exclude": [".git/**", "node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**", ".cache/**"],
  "trackGeneratedArtifacts": [".graphify-out/GRAPH_REPORT.md", ".graphify-out/graph.json", ".graphify-out/graph.html"],
  "dashboardVisibility": true,
  "humanReadableFileGraph": true,
  "aiContextMode": true
}
```

## How exclude patterns are applied

The `exclude` array in a profile is **declarative metadata only**. It is validated by the orchestrator
but is NOT automatically passed to the Graphify CLI as command-line flags (Graphify CLI does not expose
`--exclude` flags as of v0.8.36).

### Actual scan scoping: `.graphifyignore`

Graphify reads a `.graphifyignore` file at the repo root (gitignore syntax). If absent, it falls
back to `.gitignore`. The `.graphifyignore` file is the authoritative scan scope control.

Each consuming repo SHOULD maintain a `.graphifyignore` that:
1. Explicitly excludes runtime/generated/cache directories that are large or irrelevant
2. Excludes embedded third-party codebases (e.g. `tools/firecrawl/` in Brain)
3. Excludes large data files that cause semantic chunk overflow
4. Mirrors the declarative `exclude` list from the profile for traceability

Why `.graphifyignore` instead of relying on `.gitignore`:
- `.gitignore` only covers git-tracked exclusions; large disk-only paths may not be in `.gitignore`
- `.graphifyignore` makes Graphify scope explicit and independent of git workflow
- Graphify gives `.graphifyignore` priority over `.gitignore` (per their spec)

### Chunk overflow root cause

Graphify packs files into semantic chunks with a default 60k token budget per chunk. If individual
files exceed this budget (or the prompt overhead + file content exceeds the LLM context window),
Graphify bisects the chunk recursively to depth 3. If a chunk of 1 file still overflows, it is
dropped with a warning.

The most common causes in Brain/Mind repos:
- Large data files (model-prices.ts: 22k lines, n8n backup JSON: 17k lines/export × many copies)
- AI session JSONL files leaking through gitignore if Graphify's pattern matching differs
- Embedded vendored codebases not excluded from the graph scope

The fix is a comprehensive `.graphifyignore` that scopes the scan to authored content only.

## Chunk size control: `tokenBudget`

The `tokenBudget` field (optional integer) is passed to Graphify CLI as `--token-budget <N>`.
It controls the maximum token size of each semantic extraction chunk.

Default (when absent): 60,000 tokens per chunk. This is suitable for most repos but may
cause context overflow for repos with large individual files (skill SKILL.md at 22k+ tokens,
large TypeScript source files at 50-76k tokens).

For Brain repo: `tokenBudget: 30000` is recommended. With ~2000 average file tokens:
- ~15 files per chunk on average
- ~137 total chunks for 2055 files
- Each chunk ≤ 30k tokens + single oversized files get their own chunk
- Total extraction time: ~685s (fits in 1800s orchestrator timeout)

The Brain repo uses Opus 4.6 (200k context). Single-file chunks of up to 76k tokens fit
comfortably (76k + 297 system + 16384 output = ~93k, well under 200k).

## Validation rules

The future orchestrator must reject a profile when:

- required fields are missing;
- `profile` is unknown;
- `modes` contains unsupported values;
- `preferredModels` are present outside a selector policy object;
- a profile tries to define custom procedural commands;
- output paths point to the repository root;
- excluded paths are missing known generated/vendor folders for a code repo.

## O1 status

This file starts O1 by defining the profile contract and examples.

No consuming repo has been modified yet.
No Graphify commands are run by this contract.
