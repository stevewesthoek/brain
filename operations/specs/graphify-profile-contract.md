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
