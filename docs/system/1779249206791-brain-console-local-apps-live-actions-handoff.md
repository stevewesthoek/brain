# Brain Console Local Apps Live Actions Handoff

Date: 2026-05-20
Marker: `brain-console-local-apps-live-actions-2026-05-19-01`

## Implemented

- Hardened Brain Core local app action execution in `projects/brain-core/src/adapters/local-app-action-executor.ts`.
- Kept Obsidian shell-free: Brain Console only POSTs canonical app/action requests to Brain Core.
- Made canonical inventory primary for `/local-apps`; runtime reports can augment status but cannot replace inventory.
- Added per-action disabled reasons through `actionDisabledReasons` and exact app-level summary text.
- Fixed source diagnostics so 15 registry apps plus 1 Brain Core Model Router augmentation is expected.
- Added live HTTP verifier `projects/brain-core/scripts/test-local-app-actions-live.mjs` and package script `test:local-app-actions-live`.
- Updated Brain Console marker and Online/Degraded/Offline semantics.
- Hardened release packaging/install checks to scrub and reject stale build markers.

## Live route evidence

`npm run --prefix projects/brain-core test:local-app-actions-live` passed against a temporary Brain Core server.

- Dashboard app count: 16.
- Source diagnostics: canonical count 15, displayed count 16, mismatches empty.
- Unknown app POST returned 404.
- Unsupported action POST returned 404.
- Model Router start returned structured `not_executable`.
- Safe executable action live-tested: `video-orchestrator:restart` returned `success`, `ok: true`.
- Brain Core `/status` still returned OK after POST probes.

## Validation

- `npm run --prefix projects/brain-core ci` passed: typecheck plus 459/459 route tests.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed.
- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed and installed both discovered plugin copies.
- `npm run --prefix projects/brain-console-obsidian find:installed` passed with both plugin folders showing only `brain-console-local-apps-live-actions-2026-05-19-01` and no stale markers.

## Remaining limitations

Not all actions are executable. Disabled buttons now carry exact reasons from Brain Core, including missing canonical stop/restart commands, non-allowlisted multi-step strategies, and inline environment command definitions requiring repo-local scripts.

## Safety notes

- No `.env` files were read or modified.
- No secrets/tokens/credentials are displayed.
- `operations/system-configs/**` was not modified by this work and remains unstaged if dirty.
- Brain Console still does not execute shell commands.

## Continuation update — Safe lifecycle expansion

Date: 2026-05-20

Implemented safe lifecycle expansion for Brain Core-managed local apps without broadening to arbitrary commands.

What changed:

- Composite restart is now executable when an app has safe start and stop paths, even if no canonical restart command exists.
- Brain Core now records safe runtime metadata for detached npm lifecycle starts using a repo-local managed-process registry under `projects/brain-core/runtime/local/local-apps/managed-processes.json`.
- Stop can now act on a Brain Core-owned managed npm process only when the PID record is present and alive.
- `/local-apps/actions/status` now exposes current managed process records for read-only visibility.
- Dashboard/backlog evaluation now uses the same dynamic action evaluator so restart and stop availability reflect live managed-process state.
- Backlog categories now include `dynamic-stop-after-brain-core-start` for apps that only become stoppable after Brain Core launches them.
- POST local-app routes now await action completion before sending the JSON response, eliminating empty-body race conditions in tests.

Lifecycle coverage added:

- `says-the-bible:restart`
- `firecrawl:restart`
- `comfyui:restart`
- Dynamic stop path for Brain Core-managed npm apps such as `prochat:start` / `prochat:stop` when a managed PID record exists

Executable action count:

- Before: 19 executable actions, 29 disabled actions.
- After: 22 executable actions, 26 disabled actions.

Newly executable actions:

- `says-the-bible:restart`
- `firecrawl:restart`
- `comfyui:restart`

Still-disabled action categories:

- `missing-command`
- `not-yet-allowlisted`
- `dynamic-stop-after-brain-core-start`
- `missing-repo-local-script`

Live test results:

- `/status` stayed OK after POST probes.
- `/local-apps/action-enablement-backlog` matched dashboard disabled action counts.
- `video-orchestrator:restart` still returned `success`, `ok: true`.
- Composite restart for `says-the-bible` returned `success`, `ok: true`.
- Managed npm lifecycle test was attempted for `prochat`; the verifier skipped reporting success unless a Brain Core-managed PID record and successful stop were both observed.

Audit/process registry safety notes:

- Managed process records contain only app id, action, pid, startedAt, cwd summary, strategy, and command label.
- No env vars, secrets, tokens, or raw command strings are written to the managed-process registry.
- Stop only targets recorded Brain Core-owned PIDs and clears stale records when the PID is already gone.

Validation:

- `npm run --prefix projects/brain-core ci` passed.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed.
- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed.
- `npm run --prefix projects/brain-console-obsidian find:installed` passed.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
- Both contain only `brain-console-local-apps-live-actions-2026-05-19-01`.
- Both report `staleMarkers: []`.


## Continuation update — Local app action audit persistence

Date: 2026-05-20

Implemented the next phase after live local app actions: persistent audit metadata for Brain Core local app action results.

What changed:

- `executeLocalAppActionRequest` now records every structured local app action result to a safe JSONL audit file.
- Default audit path is repo-local runtime: `runtime/local/local-apps/actions-audit.jsonl`.
- Optional override `BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH` is accepted only when the path does not include unsafe segments such as `.env`, `.git`, `node_modules`, `operations`, or `mind`.
- `/local-apps/actions/status` now includes an `audit` object with status, summarized path, persisted result count, last persisted timestamp, last error if any, and safety flags.
- Audit entries contain only structured result metadata: app id, action, status, error code, message, timestamps, duration, next state, step ids/statuses/types, and safety flags.
- Audit entries do not include raw command output, raw shell command overrides, env values, secrets, Mind writes, or operations config writes.

Validation:

- `npm run --prefix projects/brain-core typecheck` passed.
- `npm run --prefix projects/brain-core test` passed: 459/459 tests.
- `npm run --prefix projects/brain-core ci` passed.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed; live `video-orchestrator:restart` still returned success.

Safety notes:

- Brain Console remains shell-free.
- No `.env` files were read or modified.
- No secrets/tokens/credentials are exposed.
- `operations/system-configs/**` remains untouched and unstaged.


## Continuation update — Brain Console audit visibility

Date: 2026-05-20

Implemented read-only Brain Console visibility for local app action audit persistence.

What changed:

- Brain Console client now mirrors the `audit` object returned by `/local-apps/actions/status`.
- Brain Console now loads `/local-apps/actions/status` with the Apps dashboard state.
- Apps section now includes a `Local App Action Audit` card showing audit status, summarized audit path, persisted result count, recent result count, in-flight action count, last persisted time, and last audit warning if present.
- The audit card is read-only and explicitly states that Brain Console reads status from Brain Core and does not execute shell commands or write audit files.
- Removed a stale hard-coded build marker from `view.ts` and switched it to the current `BRAIN_CONSOLE_BUILD_ID` fallback.

Validation:

- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed and installed both discovered plugin copies.
- Installed plugin scan shows only `brain-console-local-apps-live-actions-2026-05-19-01` and `staleMarkers: []` in both plugin folders.

Safety notes:

- No new mutation controls were added.
- Brain Console still does not execute shell commands.
- No secrets, env files, Mind writes, or operations config writes are exposed by the audit card.


## Continuation update — Managed-process state isolation fix

Date: 2026-05-20

Root cause of the failing CI:

- `managed npm stop remains disabled before Brain Core records a process` was failing because managed-process state was being read from a shared persistent runtime file.
- A previous live run or test could leave a valid-looking `managed-processes.json` behind, so later tests observed `prochat:stop` as enabled before the test had recorded any Brain Core-owned process.

What changed:

- The managed-process registry now supports `BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH`.
- Tests use a unique temporary registry path and clean it before and after each managed-process assertion.
- Live verification uses a temporary managed-process registry path too, so it cannot contaminate repo-local runtime state.
- Stale or invalid records are ignored and cleaned on read.
- Unsafe override paths containing `.env`, `.git`, `node_modules`, `operations`, or `mind` are rejected safely and return empty managed-process state.

Validation:

- `npm run --prefix projects/brain-core ci` passed.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed.
- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed.
- `npm run --prefix projects/brain-console-obsidian find:installed` passed.

Live proof:

- `/status` returned `200`.
- `/local-apps/dashboard` returned `200` with `appCount: 16`.
- `/local-apps/action-enablement-backlog` returned `200` with `disabledActionCount: 26`.
- `/local-apps/actions/status` returned `200` and exposed `managedProcessCount: 0` after cleanup.
- `video-orchestrator:restart` still returned `success`, `ok: true`.
- `says-the-bible:restart` still returned `success`, `ok: true`.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
- Both contain only `brain-console-local-apps-live-actions-2026-05-19-01`.
- Both report `staleMarkers: []`.

Unrelated dirty files left unstaged:

- `operations/system-configs/claude/model-tracking.json`
- `operations/system-configs/codex/skills/.system/plugin-creator/SKILL.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/agents/openai.yaml`
- `operations/system-configs/codex/skills/.system/plugin-creator/references/plugin-json-spec.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/validate_plugin.py`
