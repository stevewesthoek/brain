# Graphify Orchestrator Implementation Plan

This plan defines the next Brain-owned implementation phase for standardized Graphify execution across repositories.

It follows:

- `operations/specs/graphify-standard.md`
- `operations/specs/ai-model-selector-preference-policy.md`

## Goal

Create a reusable Brain Graphify Orchestrator that runs Graphify for any configured repository through one standard path.

The orchestrator must be modular, repo-agnostic, and AI Model Selector aware.

## Non-goals

- Do not hardcode model/provider fallback logic in Graphify scripts.
- Do not create custom per-repo Graphify workflows.
- Do not bypass AI Model Selector when semantic AI is needed.
- Do not enable continuous watchers before manual and scheduled execution are stable.
- Do not write generated files to repository roots.

## Required modules

### 1. Repo profile reader

Reads a small declarative repo profile, for example:

```text
.graphify-profile.json
```

The profile declares repo type, outputs, model policy labels, and exclusions. It does not contain procedural logic.

### 2. Selector policy adapter

Converts repo/profile/build intent into AI Model Selector metadata.

Examples:

```text
semantic full build       → highest quality ordered premium policy
critical semantic rebuild → highest quality ordered premium policy
incremental update        → efficient selector/default/local-safe policy
code AST update           → AST/update path without premium semantic model unless required
```

### 3. Graphify command runner

Runs standard Graphify commands for:

- full build;
- update;
- optional hook install;
- optional watch mode;
- optional callflow/architecture export where supported.

### 4. Output validator

Validates required outputs:

```text
graphify-out/GRAPH_REPORT.md
graphify-out/graph.json
graphify-out/graph.html
graphify-out/cache/
```

Optional code outputs may include callflow/architecture HTML.

### 5. Refresh reporter

Writes a structured report per repo run.

Required report fields:

- repo path;
- repo profile;
- command run;
- started/ended timestamps;
- status;
- model/provider/backend selected;
- fallback decisions;
- outputs produced;
- skipped files;
- errors;
- staleness status;
- root-write check.

### 6. Brain Core status surface

Expose read-only status through Brain Core for Brain Console Center.

Do not add run buttons until approval/action policy exists.

## Suggested implementation order

### Phase O1 — Profile schema and examples

Add a schema and example profiles for:

- `mind-knowledge`;
- `brain-runtime`;
- `code-app`;
- `research`;
- `mixed`.

### Phase O2 — Manual orchestrator command

Add a manual command that can run against one repo path and profile.

It should run in report-only/validated mode first.

### Phase O3 — AI Model Selector integration

Wire selector metadata into full/critical semantic build paths.

Use the generic preference/fallback policy, not Graphify-specific fallback code.

### Phase O4 — Output validation and reports

Produce standard refresh reports and status files.

### Phase O5 — Brain Core read-only status endpoint

Expose report summaries through Brain Core.

### Phase O6 — Brain Console Center visibility

Add read-only dashboard cards for repo graph freshness and last run status.

### Phase O7 — Scheduled execution

Add scheduler/approval integration only after manual runs are stable.

### Phase O8 — Hook/watch support

Enable hook/watch only after update behavior, exclusions, and CPU/load impact are validated.

## First implementation slice

Start with Phase O1:

```text
Create a repo-agnostic Graphify profile schema and sample profiles.
```

Do not run Graphify yet.

Do not modify consuming repos yet.

## Acceptance criteria for Phase O1

- Profile schema exists in Brain.
- Sample profiles exist in Brain.
- Graphify standard links the profile schema.
- No consuming repo is modified yet.
- No Graphify commands are run.
