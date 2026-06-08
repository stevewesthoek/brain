# Graphify Executable Update Guide

This document explains how to manually run controlled Graphify update operations on Brain and Mind repositories.

## Key Safety Rules

- **Guarded execution:** All update operations require the `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` environment variable
- **Incremental only:** Only `--operation update` can execute. Full and critical-rebuild remain blocked.
- **Feature-flagged:** The environment variable is a kill switch. Never set it globally; only for specific commands.
- **Manual only:** Do not automate these commands until the scheduler candidates are explicitly enabled by the user.

## Manual Commands

### Brain Repository Update

Preview the update plan (no execution):

```bash
npm run graphify:preflight:brain
```

Execute the update (requires environment variable):

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true npm run graphify:update:brain:execute
```

The `blocked` variant shows what WOULD run (for safety verification):

```bash
npm run graphify:update:brain:blocked
```

### Mind Repository Update

Preview the update plan (no execution):

```bash
npm run graphify:preflight:mind
```

Execute the update (requires environment variable):

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true npm run graphify:update:mind:execute
```

The `blocked` variant shows what WOULD run (for safety verification):

```bash
npm run graphify:update:mind:blocked
```

## After Execution

1. **Inspect runtime reports:**
   - Brain: `runtime/local/graphify/brain-runtime-latest.json` and `.md`
   - Mind: `runtime/local/graphify/mind-knowledge-latest.json` and `.md`

2. **Verify safety fields:**
   ```json
   {
     "execution": {
       "operation": "update",
       "runsGraphify": true,
       "targetRepo": ".",
       "status": "ok"
     },
     "safety": {
       "writesTargetRepo": true,
       "callsAiModelSelector": false,
       "callsExternalApiWithoutAuth": false,
       "modifiesSourceFiles": false,
       "modifiesConfigFiles": false
     },
     "outputValidation": {
       "status": "ok",
       "requiredCount": 3,
       "availableCount": 3
     }
   }
   ```

3. **Check git status:**
   - Only `.graphify-out/` artifacts should be modified
   - No source files should change
   - No config files should change

4. **Commit decision:**
   - Generated `.graphify-out/` files are tracked by default (per profile)
   - If tracking is disabled, generated files are intentionally not committed
   - Source orchestrator or docs changes are committed separately

## Workflow

For most runs, you will:

1. Run preflight to plan
2. Run blocked update to verify
3. Run execute update with the environment variable
4. Inspect reports
5. Decide whether to commit artifacts
6. Move to scheduler candidates if stable

## Future: Scheduler Candidates

Once manual execution is stable and tested, scheduler candidates will become available:

```bash
npm run graphify:update:brain:scheduled   # Requires approval
npm run graphify:update:mind:scheduled    # Requires approval
```

These will require:

- Approval through the Brain Core scheduler UI
- The same `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` environment variable
- Explicit opt-in through the AI Model Selector

## Troubleshooting

**"command not found: graphify"**

The `graphify` CLI must be installed and available on `$PATH`. Install it with:

```bash
npm install -g @khulnasoft/graphify
# or
brew install khulnasoft/graphify/graphify
```

**"GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION is not set"**

The update was blocked because the environment variable was not provided. This is intentional—run with:

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true npm run graphify:update:brain:execute
```

**"profile validation failed"**

The orchestrator could not find or validate the profile. Check:

```bash
# Brain: should find brain-runtime example profile
npm run graphify:preflight:brain

# Mind: should find mind-knowledge example profile
npm run graphify:preflight:mind
```

If profiles are missing, update `operations/specs/graphify-profile.examples.json`.

## References

- `operations/specs/graphify-execution-guardrails.md` — Execution safety boundary
- `operations/specs/graphify-standard.md` — Graphify operating standard
- `tools/graphify/run-graphify-orchestrator.mjs` — Orchestrator implementation
