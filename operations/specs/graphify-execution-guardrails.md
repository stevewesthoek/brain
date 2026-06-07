# Graphify Execution Guardrails

**Purpose:** Define the safety boundary for allowing the Brain Graphify Orchestrator to execute Graphify commands against repositories. This specification ensures that graph generation, indexing, and caching operations are safe, auditable, and respect the AI Model Selector routing layer.

**Status:** Living specification (updated as execution capabilities expand).

**Effective Date:** 2026-06-07

---

## References

- `operations/specs/graphify-standard.md` — Core Graphify command semantics and output formats
- `operations/specs/graphify-profile-contract.md` — Profile validation, metadata, and reconciliation
- `operations/specs/graphify-orchestrator-implementation-plan.md` — Orchestrator architecture and phases
- `operations/specs/ai-model-selector-preference-policy.md` — Model routing policy and fallback rules

---

## Current State

The Graphify Orchestrator supports four operations across three execution modes:

| Operation | Mode | Purpose |
|-----------|------|---------|
| `preflight` | Read-only | Verify profile, check repo, validate environment |
| `full` | Report-only | Full semantic build (planning stage) |
| `update` | **Executable** | Incremental graph refresh (Phase 1) |
| `critical-rebuild` | Report-only | Emergency full rebuild with AI validation (Phase 2+) |

**Current baseline:** Operations execute only in **preflight** or **report-only** modes unless an explicit guarded execution path is implemented.

**First executable operation:** `--operation update`

---

## Orchestrator Operations

### 1. Preflight

**Mode:** Read-only inspection (always enabled).

**Purpose:** Verify profile contract, check repository state, validate environment prerequisites.

**Execution:** Always runs without flags.

**Safety:** No writes, no semantic analysis, no model calls.

**Output:** JSON report with validation status.

### 2. Full

**Mode:** Report-only (planning stage).

**Purpose:** Generate complete semantic build plan with AI model selection and caching strategy.

**Execution:** Requires `--full` flag. Report only unless future execution guard is implemented.

**Safety:** No execution without dedicated feature flag (`GRAPHIFY_ORCHESTRATOR_ENABLE_FULL`). Model selection deferred to runtime.

**Rationale:** Full semantic builds may consume premium models (Opus, expensive APIs). Requires AI Model Selector integration before execution.

### 3. Update

**Mode:** Executable (Phase 1, guarded).

**Purpose:** Incremental graph refresh—reindex changed files, update cache, sync reports.

**Execution:** Requires `--operation update --execute` and `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true`.

**Safety:** Lightweight operation on local cache. No semantic re-analysis. Profile validation required.

**Rationale:** Safe entry point for execution. Minimal model calls. Incremental nature reduces risk.

### 4. Critical Rebuild

**Mode:** Report-only (Phase 2+).

**Purpose:** Emergency full rebuild with AI semantic validation and integrity checks.

**Execution:** Report-only, planning stage only. Requires future `GRAPHIFY_ORCHESTRATOR_ENABLE_CRITICAL_REBUILD` feature flag.

**Safety:** Triggers AI Model Selector for semantic re-analysis. Requires explicit async approval flow.

**Rationale:** Too heavyweight for automatic execution. Requires human decision + AI routing layer.

---

## Execution Conditions (Update Operation)

The `--operation update --execute` command executes **only when ALL conditions are met:**

1. **Feature flag set:** `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` (environment variable)
2. **Explicit flag passed:** `--execute` flag present in CLI invocation
3. **Operation is update:** `--operation update` (not `full`, `critical-rebuild`, `hook`, or `watch`)
4. **Profile validation passes:** Profile contract verified against `graphify-profile-contract.md`
5. **Target repository exists:** Repo path is accessible and contains `.git/`
6. **Graphify command available:** `graphify --version` succeeds in `$PATH`

If any condition fails, the command **stops** and returns a structured error report with:
- Which condition failed
- Why (missing env var, file not found, command not available)
- Remediation steps

---

## Blocked Operations (Remain Report-Only)

The following operations **remain blocked from execution** even with `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true`:

### 1. Full

**Reason:** Semantic model selection must route through AI Model Selector.

- Full builds determine model tier (Haiku vs Sonnet vs Opus vs external APIs)
- Model fallback logic must remain in `brain/ai/policy/routing.md`, not Graphify
- Premium model usage requires cost awareness and routing policy enforcement
- Execution requires integration with AI Model Selector preferences

**Unblocked when:** Dedicated feature flag + AI Model Selector integration implemented (Phase 2)

### 2. Critical Rebuild

**Reason:** Requires AI validation and human decision flow.

- Rebuilds trigger semantic analysis across entire codebase
- Requires AI Model Selector routing for model selection
- Results must be approved before cache mutation
- Affects all downstream queries and cache invalidation

**Unblocked when:** Async approval flow + AI Model Selector + integrity checks (Phase 3)

### 3. Hook

**Reason:** Continuous execution on local machine.

- Can run indefinitely or on git events
- Affects local machine load and model quota
- Must be scheduled via cron or supervisor, not ad-hoc
- Requires separate rate-limiting and telemetry

**Unblocked when:** Dedicated scheduler + quota management (Phase 4)

### 4. Watch

**Reason:** Real-time file monitoring and re-indexing.

- Can consume continuous CPU and model quota
- Requires debouncing and batch logic
- Affects interactive development experience
- Must be managed by supervisor (systemd, launchd)

**Unblocked when:** Supervisor integration + debounce logic (Phase 4)

---

## Update Operation Execution Requirements

When `--operation update --execute` runs with all conditions met, the following behavior is **required:**

### Execution Context

1. **Run location:** Execute from target repository root (where `.git/` is located)
2. **Command:** Execute only `graphify . --update`
3. **No preprocessing:** Do not modify `.graphifyrc`, profiles, or repo structure before command runs
4. **Capture all output:** Capture both stdout and stderr with tail limits (last 2,000 chars each)

### Validation After Run

5. **Validate expected outputs:**
   - Check exit code (must be 0 for success, non-zero for failure)
   - Verify `graph.json` is valid JSON (file must exist and parse)
   - Verify `GRAPH_REPORT.md` exists and is valid markdown
   - Check timestamps: `updated_at` in graph.json is recent (within last 60 seconds)

### Report Writing

6. **Write Brain runtime reports:**
   - Write to `brain/operations/runtime/graphify-execution/{profile}/{timestamp}.json`
   - Profile-specific directory prevents report overwrites
   - Do not write any files to target repository root
   - Do not overwrite existing reports (use timestamp for uniqueness)

7. **Record execution metadata:**
   - Document whether `--execute` was requested
   - Document whether `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true` was set
   - Record which feature flags were active
   - Timestamp when execution was approved vs. when command started

### Safety Constraints

8. **Never write to target repo root:** Generated files (`graph.html`, `graph.json`, `GRAPH_REPORT.md`) remain in target repo. Brain runtime reports stay in `brain/operations/runtime/graphify-execution/`.

9. **Never hardcode model fallback logic:** If a model call is needed in future phases, route through AI Model Selector. No direct Claude/Codex model calls in Graphify scripts.

10. **Respect AI Model Selector:** All semantic operations (full, critical-rebuild phases) must consult `brain/ai/policy/routing.md` and AI Model Selector preferences before selecting a model.

---

## Execution Report Format

Each execution run produces a structured report at:

```
brain/operations/runtime/graphify-execution/{profile}/{ISO8601-timestamp}.json
```

### Required Report Fields

```json
{
  "metadata": {
    "operation": "update",
    "timestamp_requested": "2026-06-07T14:23:45Z",
    "timestamp_started": "2026-06-07T14:23:46Z",
    "timestamp_ended": "2026-06-07T14:24:12Z",
    "duration_ms": 26000,
    "profile": "default",
    "profile_validated": true,
    "target_repo": "/Users/Office/Repos/stevewesthoek/myproject"
  },
  
  "execution": {
    "execute_requested": true,
    "execution_enabled_by_environment": true,
    "command": "graphify . --update",
    "exit_code": 0,
    "status": "success"
  },
  
  "output": {
    "stdout_tail": "... last 2000 chars of stdout ...",
    "stderr_tail": "... last 2000 chars of stderr ...",
    "stdout_lines_total": 147,
    "stderr_lines_total": 0
  },
  
  "validation": {
    "graph_json_exists": true,
    "graph_json_valid": true,
    "graph_report_exists": true,
    "graph_report_valid": true,
    "updated_at_recent": true,
    "updated_at_timestamp": "2026-06-07T14:24:10Z"
  },
  
  "safety": {
    "runsGraphify": true,
    "callsAiModelSelector": false,
    "writesTargetRepo": true,
    "hardcodesModelFallback": false,
    "writesToBrainRuntime": true,
    "all_safe": true
  },
  
  "environment": {
    "graphify_version": "1.2.3",
    "graphify_orchestrator_enable_execution": true,
    "node_version": "v20.11.0",
    "platform": "darwin"
  }
}
```

---

## Feature Flag Specification

### Environment Variable

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true
```

**Default:** `false` (execution disabled by default)

**Scope:** Process-wide (checked at orchestrator startup)

**Validation:**
- Must be exactly `"true"` (string), not `true` (boolean) or `1`
- Case-sensitive
- If not set or set to any other value, execution is disabled

**Setting in local development:**

```bash
# Terminal session
export GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true
graphify-orchestrator --operation update --execute --repo .

# Via .env file (if supported)
echo "GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true" >> .env

# Via settings.json (future)
# (Documented in phase 2)
```

### How the Flag Works

1. **Preflight operations:** Always run (flag ignored)
2. **Report-only operations (`full`, `critical-rebuild`):** Always report-only (flag ignored)
3. **Executable operations (`update`):** Check flag
   - If flag is `true` AND `--execute` is passed → execute
   - If flag is not `true` OR `--execute` is not passed → report-only

### Future Multi-tier Flags

When additional operations unlock:

```bash
GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true              # Phase 1 (update only)
GRAPHIFY_ORCHESTRATOR_ENABLE_FULL=true                  # Phase 2 (full builds)
GRAPHIFY_ORCHESTRATOR_ENABLE_CRITICAL_REBUILD=true      # Phase 3 (emergency rebuilds)
GRAPHIFY_ORCHESTRATOR_ENABLE_HOOK=true                  # Phase 4 (git hooks)
GRAPHIFY_ORCHESTRATOR_ENABLE_WATCH=true                 # Phase 4 (file watching)
```

---

## Acceptance Criteria

**Definition of done for this specification:**

### Blocking Conditions

- [ ] `--execute --operation update` **blocks** execution if `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION` is not set to `"true"`
- [ ] `--execute --operation full` **blocks** execution even if the feature flag is true
- [ ] `--execute --operation critical-rebuild` **blocks** execution even if the feature flag is true
- [ ] `--execute` without `--operation update` **blocks** execution
- [ ] Target repo validation **blocks** if `.git/` does not exist
- [ ] Profile validation **blocks** if profile contract fails

### Execution Success

- [ ] `--operation update --execute` with flag enabled runs `graphify . --update` from target repo root
- [ ] Report is written to profile-specific directory with ISO8601 timestamp
- [ ] All 10 report fields (metadata, execution, output, validation, safety, environment) are populated
- [ ] Exit code, stdout tail, and stderr tail are captured correctly
- [ ] Validation checks (graph.json valid, GRAPH_REPORT.md exists, updated_at recent) pass for successful runs

### No Regressions

- [ ] Preflight mode output is **unchanged**
- [ ] Report-only operations (`full`, `critical-rebuild`) still work without `--execute`
- [ ] Mind and Brain preflight smoke test scripts still pass
- [ ] Profile-specific report directories do not overwrite each other
- [ ] No execution reports are written during preflight or report-only operations

### Integration

- [ ] AI Model Selector is **not** called during `update` operation
- [ ] No hardcoded model fallback logic is present in Graphify scripts
- [ ] Future semantic operations will route through `brain/ai/policy/routing.md`

---

## Decision Log

**Why execution is guarded:**
- Prevents accidental graph mutations without intent
- Allows safe report generation without side effects
- Provides audit trail of when execution was requested vs. enabled
- Preserves ability to add approval flows in future phases

**Why feature flag is process-wide:**
- Prevents accidental execution if environment is misconfigured
- Makes safety intent explicit at container/session level
- Simplifies testing: flag off = always report-only

**Why update is first executable operation:**
- Incremental updates are lowest-risk (no semantic re-analysis)
- Common use case: keep graph fresh without full rebuild
- Safe to make executable without AI Model Selector integration

**Why full/critical-rebuild remain blocked:**
- Semantic operations require model routing decisions
- AI Model Selector is the canonical routing layer
- Cost awareness and quota management must be enforced before execution

---

## See Also

- `operations/runbooks/graphify-orchestrator.md` — User guide and common commands
- `operations/decision-log.md` — Architecture decisions
- `ai/skills/custom/graphify/SKILL.md` — Graphify skill documentation
