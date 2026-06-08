# Graphify Tools

Brain-owned Graphify orchestration tools live here.

These tools implement the Brain Graphify standard:

```text
operations/specs/graphify-standard.md
operations/specs/graphify-profile-contract.md
operations/specs/ai-model-selector-preference-policy.md
```

## Manual orchestrator preflight

`run-graphify-orchestrator.mjs` is the first O2 implementation slice.

Current behavior:

- reads a target repo path;
- reads a repo-local `.graphify-profile.json` when present;
- can fall back to a named profile example from `operations/specs/graphify-profile.examples.json`;
- validates the profile shape with a small built-in validator;
- reports expected Graphify output paths;
- writes a Brain runtime report;
- does not run Graphify yet;
- does not call AI Model Selector yet;
- does not modify the target repo.

Example:

```bash
node tools/graphify/run-graphify-orchestrator.mjs --repo /Users/Office/Repos/stevewesthoek/mind --profile mind-knowledge
```

Default report output:

```text
runtime/local/graphify/orchestrator-latest.json
runtime/local/graphify/orchestrator-latest.md
```

## Safety

The first implementation slice is report-only. It must not:

- run Graphify;
- write to consuming repos;
- modify `.graphify-profile.json`;
- modify `.graphify-out/`;
- hardcode model fallback logic;
- bypass AI Model Selector.



## Guarded execution

As of Phase O2.1, the orchestrator supports guarded `--operation update --execute` mode:

**When to execute:**
```bash
# Plan only (report-only)
node tools/graphify/run-graphify-orchestrator.mjs --repo . --operation update

# Execute (with guard flag enabled)
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true node tools/graphify/run-graphify-orchestrator.mjs --repo . --operation update --execute
```

**Execution conditions:**
- `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` environment variable must be set
- `--execute` flag must be passed
- `--operation update` (not `full`, `critical-rebuild`)
- Profile validation must pass
- `graphify` command must be available on PATH

**Blocked operations:**
- `full` — remains report-only (requires AI Model Selector integration)
- `critical-rebuild` — remains report-only (requires AI Model Selector integration)
- Any operation without `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` and `--execute`

**Report outputs:**
- JSON report includes execution metadata (timestamps, exit code, stdout/stderr tail)
- Markdown report includes execution result when run
- Safety flags confirm: no AI Model Selector calls, no hardcoded model logic

**Planned Graphify CLI syntax**

The orchestrator plans commands using the official terminal CLI shape:

```text
graphify .
graphify . --update
```
