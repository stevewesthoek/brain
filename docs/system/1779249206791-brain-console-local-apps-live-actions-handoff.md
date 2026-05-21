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

## Continuation update — ProBot registry wiring resolved

ProBot lifecycle scripts were wired into the canonical local-app registry after the previous commit left the scripts unused. The registry now points ProBot at fixed repo-local lifecycle adapters:

- `start`: `bash scripts/dev/start-local.sh`
- `stop`: `bash scripts/dev/stop-local.sh`
- `restart`: `bash scripts/dev/restart-local.sh`

The scripts were hardened to use repo-local runtime state under `projects/probot/runtime/local/` and only target the PID recorded by the ProBot start script. No `.env` values, tokens, cookies, passwords, or arbitrary command arguments are read or exposed.

Exact newly executable actions from this phase:

- `probot:start`
- `probot:stop`
- `probot:restart`

Exact executable counts:

- Before this ProBot wiring: `29`
- After this ProBot wiring: `32`

Exact disabled counts:

- Before this ProBot wiring: `19`
- After this ProBot wiring: `16`

Current still-disabled actions and reasons:

- `prochat:stop` - no Brain Core-managed npm process is recorded for this app.
- `prochat:restart` - no canonical restart command is defined for this app.
- `jpv-bootcamp:stop` - no canonical stop command is defined for this app.
- `jpv-bootcamp:restart` - no canonical restart command is defined for this app.
- `google-ads-api:stop` - no canonical stop command is defined for this app.
- `google-ads-api:restart` - no canonical restart command is defined for this app.
- `family-finance:stop` - no canonical stop command is defined for this app.
- `family-finance:restart` - no canonical restart command is defined for this app.
- `fala:start` - repo lifecycle script is registered but missing or outside allowlisted roots.
- `fala:stop` - no canonical stop command is defined for this app.
- `fala:restart` - no canonical restart command is defined for this app.
- `tradebot:stop` - no canonical stop command is defined for this app.
- `tradebot:restart` - no canonical restart command is defined for this app.
- `model-router:start` - no canonical start command is defined for this app.
- `model-router:stop` - no canonical stop command is defined for this app.
- `model-router:restart` - no canonical restart command is defined for this app.

Validation results after the ProBot fix:

- `npm run --prefix projects/brain-core ci` passed.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed with:
  - `appCount: 16`
  - `executableActions.length: 32`
  - `disabledActionCount: 16`
  - `backlogDisabledActionCount: 16`
  - `newlyExecutableActions` included the ProBot lifecycle actions above
- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed.
- `npm run --prefix projects/brain-console-obsidian find:installed` passed.

Live verifier proof:

- `POST /local-apps/probot/restart` returned `200`.
- `POST /local-apps/video-orchestrator/restart` returned `200`.
- `POST /local-apps/prochat/start` returned `200`.
- `/local-apps/actions/status` returned recent result and managed-process status after POST probes.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
- Both contain only `brain-console-local-apps-live-actions-2026-05-19-01`.
- Both report `staleMarkers: []`.

Safety notes:

- ProBot uses fixed repo-local lifecycle scripts only.
- The stop script only targets the PID recorded by the start script.
- No shell metacharacters, env dumps, or arbitrary command overrides were introduced.

Unrelated dirty files left unstaged:

- `operations/system-configs/claude/model-tracking.json`
- `operations/system-configs/codex/skills/.system/plugin-creator/SKILL.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/agents/openai.yaml`
- `operations/system-configs/codex/skills/.system/plugin-creator/references/plugin-json-spec.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/validate_plugin.py`


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


## Continuation update — Safe repo-local lifecycle adapters

Date: 2026-05-20

What changed:

- Replaced shell-heavy local-app registry entries with fixed repo-local lifecycle scripts.
- Added new repo-local `scripts/dev/start-local.sh` wrappers for:
  - `projects/probot`
  - `projects/probot` stop/restart helpers
  - `prochattools/clients/via-di-eden`
  - `prochattools/clients/oliveto-organizing`
  - `prochattools/saas/xgrow`
  - `family-finance`
  - `tradebot`
  - `jc-citadel/jpv-bootcamp`
- Added restart wrappers for the apps that already have fixed local start/stop scripts.
- Brain Core still executes only the allowlisted fixed-script strategy; no arbitrary command strings were added.
- Brain Console did not need a UI change for the new coverage because it already reflects dashboard action support flags.

Exact newly executable actions:

- `via-di-eden:start`
- `via-di-eden:restart`
- `oliveto-organizing:start`
- `oliveto-organizing:restart`
- `jpv-bootcamp:start`
- `xgrow:start`
- `xgrow:restart`
- `family-finance:start`
- `tradebot:start`

Counts:

- Before: `22` executable, `26` disabled
- After: `29` executable, `19` disabled

Still-disabled actions and reasons:

- `probot:start` - canonical command remains not yet allowlisted in the current Brain Core strategy.
- `probot:stop` - no canonical stop command is defined.
- `probot:restart` - no canonical restart command is defined.
- `prochat:stop` - no Brain Core-managed npm process is recorded for this app.
- `prochat:restart` - no canonical restart command is defined.
- `jpv-bootcamp:stop` - no canonical stop command is defined.
- `jpv-bootcamp:restart` - no canonical restart command is defined.
- `google-ads-api:stop` - no canonical stop command is defined.
- `google-ads-api:restart` - no canonical restart command is defined.
- `family-finance:stop` - no canonical stop command is defined.
- `family-finance:restart` - no canonical restart command is defined.
- `fala:start` - repo lifecycle script is registered but missing or outside allowlisted roots.
- `fala:stop` - no canonical stop command is defined.
- `fala:restart` - no canonical restart command is defined.
- `tradebot:stop` - no canonical stop command is defined.
- `tradebot:restart` - no canonical restart command is defined.
- `model-router:start` - no canonical start command is defined.
- `model-router:stop` - no canonical stop command is defined.
- `model-router:restart` - no canonical restart command is defined.

Live verifier results:

- `npm run --prefix projects/brain-core ci` passed.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed with:
  - `appCount: 16`
  - `executableActions.length: 29`
  - `disabledActionCount: 19`
  - `backlogDisabledActionCount: 19`
  - `newlyExecutableActions` matching the fixed-script set above
- Safe live POSTs still proved:
  - `video-orchestrator:restart` success
  - `says-the-bible:restart` success

Safety notes:

- The new scripts are fixed, repo-local lifecycle adapters only.
- No `.env` values, tokens, cookies, passwords, or raw env values were exposed.
- No new arbitrary shell execution path was added.

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

---

## Continuation 8: ProBot lifecycle verification hardening

Date: 2026-05-20

### Changes

**ProBot live verifier safety (opt-in env var):**

- Live verifier no longer auto-POSTs `probot:start`, `probot:stop`, or `probot:restart` by default.
- ProBot excluded from composite restart candidate selection unless `BRAIN_CORE_LIVE_TEST_PROBOT_LIFECYCLE=1`.
- ProBot excluded from `selectExecutableAction()` fallback unless opt-in is set.
- Live summary reports: `probot lifecycle actions enabled but not POST-tested by default`.
- Reason: avoids starting or restarting the ProBot control-plane process during routine verification.

**ProBot port correctness:**

- `projects/probot/scripts/dev/start-local.sh` now sets `CANONICAL_PORT=7070` and exports `PROBOT_DASHBOARD_PORT="$CANONICAL_PORT"` before launching.
- Port is fixed and repo-local. Script does not read or source `.env`.
- Test added: `ProBot start uses canonical port 7070`.

**ProBot PID safety:**

- `projects/probot/scripts/dev/stop-local.sh` now validates PID ownership before killing.
- Uses `ps -p "$PID" -o args=` to check the process matches ProBot markers (`ProBot`, `probot`, `tsx...src/index.ts`, `node...dist/index.js`).
- Stale PID (process dead): removes PID file, returns harmless success.
- Wrong PID (alive but not ProBot): removes PID file, returns harmless success with clear message.
- Does not use `pkill`, `killall`, `lsof`, or kill-by-port.
- Does not print raw command lines that may contain secrets.
- Tests added: `ProBot stop script does not kill arbitrary PIDs`, `ProBot stop treats stale/wrong PID as harmless and removes PID file`.

**Managed npm lifecycle for ProChat:**

- Start returns 200 (accepted) but managed process exits before status poll.
- Root cause: ProChat's `npm run dev` requires env configuration not available in live test context.
- Live verifier now reports: `prochat managed lifecycle skipped: start accepted (200) but managed process exited before status poll. Process likely requires env configuration not available in live test context.`
- No false `managedProcessCount` claim.
- Added 500ms delay between start and status poll for fair chance.

**Live verifier accuracy:**

- Reports separate `probotLifecycle` section with status and reason.
- Reports `probotPostTestStatus` field.
- Reports `managedLifecycle` with explicit skip reason.
- All skipped behavior labeled as skipped, not as proof.

**Tests added (routes.test.ts):**

- ProBot actions are executable in dashboard.
- ProBot actions are absent from `/local-apps/action-enablement-backlog`.
- ProBot start command is fixed and repo-local.
- ProBot start uses or guarantees canonical port 7070.
- ProBot stop script does not kill arbitrary PIDs.
- ProBot stop treats stale/wrong PID as harmless and removes PID file.
- Backlog disabled count equals dashboard disabled action count.
- Responses do not include `.env`, `TOKEN=`, `SECRET=`, `PASSWORD=`, `COOKIE=`.
- Fixed stale test: `GET /local-apps returns placeholder local app list` (now checks >= 16 apps with some actions supported).

### Validation results

- Brain Core CI: 480/480 pass
- Live verifier: status=passed, appCount=16, executableActions=32, disabledActionCount=16, backlogDisabledActionCount=16
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass (marker present, staleMarkers=[])
- Brain Console find:installed: both locations verified with correct marker

### ProBot POST lifecycle

- **Opt-in only.** Not POST-tested by default.
- Set `BRAIN_CORE_LIVE_TEST_PROBOT_LIFECYCLE=1` to enable.

### Managed npm lifecycle result

- ProChat managed lifecycle: **skipped**.
- Reason: start accepted but managed process exited before status poll (requires ProChat env config).

### Installed plugin verification

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]
- `/Users/Office/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Unrelated dirty files left unstaged

- `operations/system-configs/claude/model-tracking.json`
- `operations/system-configs/codex/skills/.system/plugin-creator/SKILL.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/agents/openai.yaml`
- `operations/system-configs/codex/skills/.system/plugin-creator/references/plugin-json-spec.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/validate_plugin.py`
- `projects/probot/runtime/`

---

## Continuation 9: ProBot runtime process metadata hardening

Date: 2026-05-20

### Changes

**Generated runtime ignore/cleanup:**

- Added `runtime/` to `projects/probot/.gitignore`.
- Removed generated `projects/probot/runtime/` from working tree.
- `git status --short` no longer shows `projects/probot/runtime/` after live verifier runs.

**ProBot process metadata file:**

- Start script now writes `runtime/local/probot-process.json` containing:
  - `appId`: always `"probot"`
  - `pid`: spawned child PID
  - `startedAt`: UTC ISO timestamp
  - `processStartSignature`: output of `ps -p PID -o lstart=` (unique per-process-start, survives PID reuse)
  - `canonicalPort`: 7070
  - `commandLabel`: `"npm run dev"`
  - `scriptVersion`: incremented version number
- Metadata does NOT contain env vars, secrets, `.env` contents, tokens, or full command lines.

**ProBot PID reuse hardening (stop script):**

- Stop validates 6 conditions before killing:
  1. PID file exists
  2. Metadata file exists
  3. Metadata `appId` is `"probot"`
  4. Metadata `pid` matches PID file
  5. Process is alive
  6. Current `lstart` signature matches stored `processStartSignature`
- Additionally checks process command matches ProBot dev/start markers (without echoing raw command).
- If ANY validation fails: removes stale PID/metadata, returns harmless success with reason, does NOT kill.
- Does not use `pkill`, `killall`, `lsof`, or kill-by-port.
- Does not echo raw process command lines.

**Start script existing-process validation:**

- Before starting fresh, validates existing PID using the same `processStartSignature` check.
- If PID is alive AND metadata matches AND start signature matches: reports already running.
- If any check fails: cleans stale files and starts fresh.

**ProBot live verifier default/opt-in behavior:**

- Default: ProBot POST lifecycle is NOT tested. Summary says `probot lifecycle actions enabled but not POST-tested by default`.
- Opt-in: Set `BRAIN_CORE_LIVE_TEST_PROBOT_LIFECYCLE=1` to enable ProBot restart POST.
- Live verifier does NOT leave generated `projects/probot/runtime/` untracked (gitignored).

### Validation results

- Brain Core CI: 482/482 pass
- Live verifier: status=passed, appCount=16, executableActions=32, disabledActionCount=16, backlogDisabledActionCount=16
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass (marker present, staleMarkers=[])
- Brain Console find:installed: both locations verified with correct marker

### Installed plugin verification

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]
- `/Users/Office/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Unrelated dirty files left unstaged

- `operations/system-configs/claude/model-tracking.json`
- `operations/system-configs/codex/skills/.system/plugin-creator/SKILL.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/agents/openai.yaml`
- `operations/system-configs/codex/skills/.system/plugin-creator/references/plugin-json-spec.md`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py`
- `operations/system-configs/codex/skills/.system/plugin-creator/scripts/validate_plugin.py`

---

## Continuation 10: Enable remaining safe local app lifecycle actions

Date: 2026-05-20
Model: Claude Sonnet 4.6

### Newly enabled actions (6 actions enabled, from 32 → 38 executable)

| Action | Method | Notes |
|--------|--------|-------|
| `google-ads-api:stop` | `supervisorctl stop google-ads-http-server` | Executor already allowlisted supervisor pattern; action-match validation enforced |
| `google-ads-api:restart` | composite (stop && start) | Executor composes via existing stop+start when both are executable |
| `family-finance:stop` | `bash scripts/dev/stop-local.sh` | Script already existed in external repo |
| `family-finance:restart` | composite (stop && start) | Created `restart-local.sh` in family-finance repo |
| `tradebot:stop` | `bash scripts/dev/stop-local.sh` | Script already existed in tradebot repo |
| `tradebot:restart` | composite (stop && start) | `restart-local.sh` already existed in tradebot repo |

### Registry fields changed

- `google-ads-api`: added `stop`/`stopCommand`/`restart`/`restartCommand` with canonical `supervisorctl` commands
- `family-finance`: added `stop`/`stopCommand`/`restart`/`restartCommand` with repo-local script paths
- `tradebot`: added `stop`/`stopCommand`/`restart`/`restartCommand` with repo-local script paths

### Scripts added

- `family-finance/scripts/dev/restart-local.sh` — delegates to stop-local.sh then start-local.sh; no new logic

### Actions still disabled and reasons

| Action | Reason |
|--------|--------|
| `prochat:stop` | Managed-process lifecycle only; no static stop script |
| `prochat:restart` | No canonical restart command defined |
| `jpv-bootcamp:stop` | No stop script exists in jpv-bootcamp repo |
| `jpv-bootcamp:restart` | No stop script exists, so composite restart unavailable |
| `fala:start` | Script missing or outside allowlisted roots; Fala app not present in brain repo |
| `fala:stop` | No canonical stop command |
| `fala:restart` | No canonical restart command |
| `model-router:start` | No canonical shell lifecycle contract for Model Router |
| `model-router:stop` | No canonical shell lifecycle contract for Model Router |
| `model-router:restart` | No canonical shell lifecycle contract for Model Router |

### Executable count

- Before: 32 executable, 16 disabled
- After: 38 executable, 10 disabled

### Safety notes

- Supervisor command action-match enforcement was pre-existing in executor; no new allowlist broadening.
- Family Finance restart script is fixed/no-arg delegate; no env access.
- No external repos modified except adding the restart script to family-finance.
- Model Router, Fala, JPV Bootcamp stop remain intentionally disabled.
- Brain Console unchanged; UI picks up new support flags from dashboard response automatically.

### Validation results

- Brain Core CI: 489/489 pass
- Live verifier: status=passed, appCount=16, executableActions=38, disabledActionCount=10, backlogDisabledActionCount=10
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass (marker present, staleMarkers=[])
- Brain Console find:installed: both locations verified with correct marker

### Installed plugin verification

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]
- `/Users/Office/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Unrelated dirty files left unstaged

- `operations/system-configs/claude/.last-cleanup`
- `operations/system-configs/claude/plans/noble-roaming-dawn.md` (deleted)
- `operations/system-configs/codex/skills/.system/plugin-creator/` (multiple modified)

---

## Continuation 11: Harden local app lifecycle verification

Date: 2026-05-20
Model: Claude Sonnet 4.6

### Live verifier newlyExecutableActions proof list fixed

Updated `fixedLifecycleCandidates` in `test-local-app-actions-live.mjs` to include all six newly enabled actions from d1353496:

- `family-finance:stop`
- `family-finance:restart`
- `tradebot:stop`
- `tradebot:restart`
- `google-ads-api:stop`
- `google-ads-api:restart`

The live verifier now correctly reports these as `newlyExecutableActions` when they appear in the dashboard executable list.

### External repo script verification: family-finance

Scripts were directly inspected at `/Users/Office/Repos/stevewesthoek/family-finance/scripts/dev/`:

- `stop-local.sh`: Uses `/tmp/family-finance.pid`, kills by PID, removes PID file. No `pkill`, `killall`, `lsof`. Does not reference `.env`.
- `restart-local.sh` (created in d1353496): Delegates to `stop-local.sh` then `start-local.sh`. No logic. Does not reference `.env`.

**Safety caveat:** stop script trusts the PID without process ownership validation (uses `/tmp/family-finance.pid` global path). This is consistent with existing external repo pattern but weaker than the hardened ProBot pattern. No changes made to external repo; this is documented as a known limitation.

### External repo script verification: tradebot

Scripts were directly inspected at `/Users/Office/Repos/stevewesthoek/tradebot/scripts/dev/`:

- `stop-local.sh`: Uses `/tmp/tradebot.pid`, kills by PID, removes PID file. No `pkill`, `killall`, `lsof`. Does not reference `.env`.
- `restart-local.sh`: Delegates to `stop-local.sh` then `start-local.sh`. Does not reference `.env`.

**Safety caveat:** Same as family-finance — no process ownership/start-signature validation. Consistent with external repo pattern.

### Google Ads API supervisor safety

Confirmed in `local-app-action-executor.ts`:

- Supervisor command pattern: `/^supervisorctl\s+(start|stop|restart)\s+[a-z0-9-]+$/i`
- Action-match enforcement: `if (parts[1] !== action) return disabled(...)`
- `google-ads-api:stop` registered as `supervisorctl stop google-ads-http-server` — executor validates action matches `stop`.
- `google-ads-api:restart` uses composite (stop && start) — both supervisor commands are validated independently.
- Arbitrary supervisor service names cannot be injected through request body or query parameters (executor reads only canonical registry values).

### Tests added

- `all six latest lifecycle actions are absent from action-enablement-backlog`
- `exact ten still-disabled actions are in backlog` (asserts disabledCount=10, exact keys)
- `family-finance stop script is safe: no pkill/killall/lsof/port-killing`
- `family-finance restart script delegates to stop then start`
- `tradebot stop script is safe: no pkill/killall/lsof/port-killing`
- `tradebot restart script delegates to stop then start`

### Validation results

- Brain Core CI: 495/495 pass
- Live verifier: status=passed, executableActions=38, disabledActionCount=10, backlogDisabledActionCount=10
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass (marker present, staleMarkers=[])
- Brain Console find:installed: both locations verified with correct marker

### Installed plugin verification

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]
- `/Users/Office/mind/.obsidian/plugins/brain-console`: marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Safety notes

- No new allowlist broadening.
- No external repo mutations beyond the already-committed restart-local.sh.
- Brain Console unchanged.
- Google Ads supervisor command action-match enforcement pre-existing and confirmed sufficient.

### Unrelated dirty files left unstaged

- `operations/system-configs/claude/.last-cleanup`
- `operations/system-configs/claude/plans/noble-roaming-dawn.md` (deleted)
- `operations/system-configs/codex/skills/.system/plugin-creator/` (multiple modified + 1 untracked)

---

## Continuation 12 — Local App Operational Readiness (2026-05-20)

### Commit: d2ed28e7

### What was added

**Brain Core: `GET /local-apps/operational-readiness`**
- New adapter: `projects/brain-core/src/adapters/local-app-operational-readiness.ts`
- Parallel HTTP health probes for all canonical apps in the inventory
- Per-app 1.5s timeout, total 8s cap; skipped apps get `stale` status
- Per-app result: `reachabilityStatus` (reachable/unreachable/not-configured/stale), `healthUrl`, `checkedAt`, `responseTimeMs`, `httpStatus`, `note`
- Safety object: `readOnly: true`, `pluginExecutesShell: false`, `executesShell: false`, `exposesSecrets: false`, `exposesEnv: false`, `writesFiles: false`
- Error messages sanitized through `safeErrorMessage()` (no paths, no credential fragments)

**Brain Core types: `projects/brain-core/src/types/api.ts`**
- Added `BrainCoreLocalAppReachabilityStatus`, `BrainCoreLocalAppReachabilityEntry`, `BrainCoreLocalAppsOperationalReadinessResponse`

**Brain Core routes: `projects/brain-core/src/api/routes.ts`**
- Wired `GET /local-apps/operational-readiness` → `readLocalAppsOperationalReadiness()`

**Brain Core tests: 9 new tests (504 total)**
- `GET /local-apps/operational-readiness returns 200 with well-formed payload`
- `GET /local-apps/operational-readiness apps have correct shape`
- `GET /local-apps/operational-readiness not-configured apps have null healthUrl`
- `GET /local-apps/operational-readiness apps with healthUrl have non-null response fields`
- `GET /local-apps/operational-readiness does not execute shell or expose secrets`
- `readLocalAppsOperationalReadiness adapter: mock fetch — reachable apps`
- `readLocalAppsOperationalReadiness adapter: mock fetch — unreachable apps`
- `readLocalAppsOperationalReadiness adapter: mock fetch — non-ok response is unreachable`
- `readLocalAppsOperationalReadiness adapter: status counts sum to appCount`
- Added `/local-apps/operational-readiness` to the existing "responses do not include secrets" test

**Live verifier: `projects/brain-core/scripts/test-local-app-actions-live.mjs`**
- Added operational readiness probe between diagnostics and action status checks
- Asserts id, appCount >= 16, apps array, count sum, safety fields, totalCheckDurationMs
- Added `operationalReadiness` section to summary JSON output (reachableCount, unreachableCount, notConfiguredCount, staleCount, totalCheckDurationMs, reachableApps with responseTimeMs)

**Brain Console: `projects/brain-console-obsidian/src/client.ts`**
- Added `BrainCoreLocalAppReachabilityStatus`, `BrainCoreLocalAppReachabilityEntry`, `BrainCoreLocalAppsOperationalReadinessResponse` types
- Added `readBrainCoreLocalAppsOperationalReadiness()` function

**Brain Console: `projects/brain-console-obsidian/src/view.ts`**
- Added `localAppsOperationalReadiness` to `BrainConsoleViewState`
- Wired `readBrainCoreLocalAppsOperationalReadiness(baseUrl)` into `Promise.allSettled`
- Added Operational Readiness card inside `renderLocalAppsCard`: reachable/unreachable/not-configured counts, check duration, generated-at timestamp
- Padding updated: 160 → 161

### Validation results

- Brain Core CI: 504/504 pass
- Brain Core build: clean
- Brain Console build: 184.9kb (clean)
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass (marker `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[])

### Safety notes

- No shell execution in the new adapter; only outbound HTTP GET to each app's healthUrl
- No secrets, no env exposure, no file writes
- Brain Console still never executes shell — calls Brain Core HTTP only
- `safeErrorMessage()` strips credential fragments and local paths from error notes

---

## Continuation 13 — Operational Readiness Hardening (2026-05-20)

### What changed

Hardening pass on the `GET /local-apps/operational-readiness` endpoint introduced in Continuation 12. Reshaped the response to a richer per-item contract, fixed field names, added action-support flags, freshness semantics, and corrected safety flags.

### Response contract changes

**`items` array (was `apps`)**
Each item now carries:
- `status` (was `reachabilityStatus`) — `reachable | unreachable | unknown | not-configured | stale`
- `durationMs` (was `responseTimeMs`) — milliseconds for the probe round-trip
- `message` (was `note`) — human-readable probe result
- `appUrl?`, `port?` — from app definition
- `healthUrl?` — now optional (absent for not-configured)
- `httpStatus?` — optional (absent on errors/not-configured)
- `checkedAt?` — optional (absent for not-configured)
- `actionEnabled`, `startSupported`, `stopSupported`, `restartSupported` — derived from `app.actionPolicy.safeActions`
- `lastAction?` — most recent action result from `readLocalAppActionStatus()` (`action`, `status`, `ok`, `endedAt`, `message`)
- `freshness` — `{ source: 'live-check' | 'not-checked', maxAgeMs: 1500, ageMs?: number, fresh: boolean }`
  - live-checked reachable: `fresh: true, ageMs: 0`
  - live-checked unreachable/error: `fresh: false, ageMs: durationMs`
  - not-configured: `source: 'not-checked', fresh: false` (no ageMs)
- `safety` — per-item safety object (same shape as top-level)

**Safety flags corrected**
Old: `readOnly, pluginExecutesShell, executesShell, exposesSecrets, exposesEnv, writesFiles`
New: `readOnly, pluginExecutesShell, arbitraryCommandAllowed, exposesSecrets, writesToMind, performsLifecycleAction`
Spurious fields `executesShell`, `exposesEnv`, `writesFiles` removed.

**Total cap semantics**
The `TOTAL_CAP_MS = 8_000` constant was removed. Each probe independently runs with `PER_APP_TIMEOUT_MS = 1_500`. `Promise.all` runs probes in parallel — total wall-clock time is approximately the slowest probe, not a hard 8s enforced cap. `totalCheckDurationMs` accurately reflects actual elapsed time.

### Files changed

**`projects/brain-core/src/types/api.ts`**
- Replaced `BrainCoreLocalAppReachabilityEntry` and `BrainCoreLocalAppsOperationalReadinessResponse` with new types
- Added `BrainCoreLocalAppOperationalReadinessFreshness`, `BrainCoreLocalAppOperationalReadinessSafety`, `BrainCoreLocalAppOperationalReadinessLastAction`, `BrainCoreLocalAppOperationalReadinessItem`

**`projects/brain-core/src/adapters/local-app-operational-readiness.ts`**
- Rewrote to use enriched per-item shape
- `probeApp()` now accepts full `BrainCoreLocalAppDefinition` (for action flags, appUrl, port)
- Calls `readLocalAppActionStatus()` once per request; passes `recentResults` and `lastErrorByApp` to each probe
- Implements freshness semantics correctly per status
- `ITEM_SAFETY` constant shared between top-level and per-item safety objects
- Removed `TOTAL_CAP_MS`; each probe uses `PER_APP_TIMEOUT_MS = 1_500` independently
- `httpStatus` is absent (not null) on error/not-configured — optional field

**`projects/brain-core/src/tests/routes.test.ts`**
- Replaced 9 operational readiness tests with 13 tests (508 total, all pass)
- New tests cover: per-item shape, action flags, freshness semantics (live-check vs not-checked), per-item safety completeness, POST rejected, adapter not-configured freshness, adapter per-item safety

**`projects/brain-core/scripts/test-local-app-actions-live.mjs`**
- Updated to use `items` (was `apps`), `item.status` (was `reachabilityStatus`), `item.durationMs` (was `responseTimeMs`)
- Added per-item assertions: freshness, safety flags
- Updated safety assertions: `arbitraryCommandAllowed`, `writesToMind`, `performsLifecycleAction` (removed `executesShell`)
- Summary now reports `reachableApps` with `durationMs`

**`projects/brain-console-obsidian/src/client.ts`**
- Replaced old operational readiness types with new `BrainCoreLocalAppOperationalReadinessFreshness`, `BrainCoreLocalAppOperationalReadinessSafety`, `BrainCoreLocalAppOperationalReadinessLastAction`, `BrainCoreLocalAppOperationalReadinessItem`, updated `BrainCoreLocalAppsOperationalReadinessResponse`

**`projects/brain-console-obsidian/src/view.ts`**
- Operational Readiness card now iterates `operationalReadiness.items` (was `.apps`)
- Added per-item lines: reachable items (appName + durationMs), unreachable items (appName + message)

### Validation results

- Brain Core CI: 508/508 pass
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass
- Plugin marker: `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Safety notes

- No shell execution; only outbound HTTP GET per healthUrl
- No lifecycle actions triggered by operational-readiness endpoint
- `lastAction` read from in-memory state only — no disk I/O
- Per-item safety object on every item makes safety guarantees explicit at every response level

---

## Continuation 14 — Local Apps Operator Summary (2026-05-20)

### Main goal

Unified operator clarity surface: one read-only endpoint and one compact Brain Console card combining lifecycle support, operational readiness, last action result, and disabled-action blockers.

### New endpoint

`GET /local-apps/operator-summary`

Response shape:
- `id: 'local-apps-operator-summary'`
- `appCount`, `executableActionCount`, `disabledActionCount`
- `reachableCount`, `unreachableCount`, `notConfiguredCount`, `staleCount`, `attentionCount`
- `items[]` — per-app operator view
- `topAttentionItems[]` — top 5 attention/blocked items for the card
- `safety` — complete safety flags

### Data sources

- `readLocalAppsOperationalReadiness()` — reachability status and freshness per app
- `evaluateLocalAppActionDefinition()` — supported vs disabled actions per app
- `readLocalAppActionStatus()` — last action result per app
- `listLocalAppDefinitions()` — canonical inventory

No duplicate health checks: operational readiness is called once per operator summary request.

### Per-item semantics

**status:**
- `ok` — reachable or not-configured, no recent failures, no critical gap
- `attention` — unreachable, stale, recent failed action, or managed app missing health URL
- `blocked` — no executable actions and disabled blockers remain for a managed app
- `unknown` — insufficient data

**nextRecommendedAction.kind:**
- `start` — unreachable and start is supported
- `restart` — reachable with recent failed action and restart supported
- `configure-health-url` — no healthUrl configured
- `add-lifecycle-script` — missing-command or missing-repo-local-script disabled action
- `inspect-health` — unreachable but no automated action available
- `manual-review` — disabled actions requiring review
- `none` — operating normally

### Files changed

**`projects/brain-core/src/types/api.ts`**
- Added `BrainCoreLocalAppOperatorSummaryItemStatus`, `BrainCoreLocalAppOperatorSummaryDisabledAction`, `BrainCoreLocalAppOperatorSummaryNextAction`, `BrainCoreLocalAppOperatorSummaryFreshness`, `BrainCoreLocalAppOperatorSummaryLastAction`, `BrainCoreLocalAppOperatorSummaryItem`, `BrainCoreLocalAppOperatorTopAttentionItem`, `BrainCoreLocalAppOperatorSummarySafety`, `BrainCoreLocalAppsOperatorSummaryResponse`

**`projects/brain-core/src/adapters/local-app-operator-summary.ts`** (NEW)
- `readLocalAppsOperatorSummary(fetchImpl)` — async, injectable fetch for test isolation
- Calls `readLocalAppsOperationalReadiness()` once; merges with backlog evaluation
- `deriveItemStatus()` and `deriveNextAction()` encapsulate operator reasoning
- `categorizeReason()` mirrors backlog logic (no duplication of category data)

**`projects/brain-core/src/api/routes.ts`**
- Import `readLocalAppsOperatorSummary`
- Added `case '/local-apps/operator-summary'`

**`projects/brain-core/src/tests/routes.test.ts`**
- Added 14 tests (522 total, all pass)
- Covers: shape, appCount, count math, disabledActionCount vs backlog, action flags, next action kinds, safety completeness, POST rejected, mock fetch count assertions, unreachable → attention, not-configured → appropriate recommendation

**`projects/brain-core/scripts/test-local-app-actions-live.mjs`**
- Added operator summary probe with full shape/count/safety assertions
- Cross-asserts `disabledActionCount` and `executableActionCount` against backlog
- Summary now includes `operatorSummary` section (counts, topAttentionItems, recommendedActionCounts by kind)

**`projects/brain-console-obsidian/src/client.ts`**
- Added all operator summary types and `readBrainCoreLocalAppsOperatorSummary()` function

**`projects/brain-console-obsidian/src/view.ts`**
- Import added
- `localAppsOperatorSummary` added to state, allSettled array, destructuring
- Padding: 161 → 162
- "Operator Summary" card added: attention badge, stat grid (apps/executable/disabled/reachable/unreachable/not-configured), topAttentionItems list with recommended action labels

### Console card behavior

- If operator summary endpoint fails while /status and dashboard work: Console shows degraded, not offline (Promise.allSettled pattern)
- No mutation buttons; read-only clarity surface only
- Attention badge: `warn` tone when attentionCount > 0, `ok` otherwise

### Validation results

- Brain Core CI: 522/522 pass
- Brain Console typecheck: pass
- Brain Console check:dashboard-source: pass
- Brain Console release:install: pass
- Plugin marker: `brain-console-local-apps-live-actions-2026-05-19-01`, staleMarkers=[]

### Safety notes

- No shell execution
- No lifecycle actions triggered
- No secrets exposed
- Complete safety flags on both top-level and response (no per-item safety on operator summary — top-level is sufficient for a summary endpoint)

### Unrelated dirty files left unstaged

- `operations/system-configs/claude/model-tracking.json`
- `operations/system-configs/codex/skills/.system/plugin-creator/` (multiple files)


## Continuation update — Operator summary recommendation hardening

Date: 2026-05-20

Implemented operator summary hardening after reviewing commit `6352221a` directly in the repo.

What changed:

- Recent failed lifecycle actions now outrank generic unreachable/start recommendations.
- When a failed action exists and restart is supported, the summary recommends restart.
- When a failed action exists and restart is not supported, the summary falls back to non-mutating inspect-health or manual-review guidance.
- `topAttentionItems` now uses deterministic severity ranking before selecting the top five items.
- Exposed last-action and recommendation text is sanitized for secret-like assignments and local absolute paths.

Severity order for top attention items:

1. Recent failed action.
2. Blocked app/action state.
3. Unreachable app with an executable next action.
4. Stale readiness.
5. Missing/not-configured health URL.
6. Lifecycle gaps.
7. Stable app name/app id tie-breaker.

Exact files changed:

- `projects/brain-core/src/adapters/local-app-operator-summary.ts`
- `projects/brain-core/src/tests/local-app-operator-summary-hardening.test.ts`
- `docs/system/1779249206791-brain-console-local-apps-live-actions-handoff.md`

Validation:

- Targeted Brain Core operator summary marker: passed, 526/526 tests.
- Brain Core CI: passed, 526/526 tests.
- Brain Console typecheck: passed.
- Brain Console `check:dashboard-source`: passed.
- Live verifier `test:local-app-actions-live`: attempted twice, but BuildFlow returned Cloudflare 504 gateway timeouts before command output was available, so no verified result was captured for this continuation.

Safety notes:

- No `.env` files were read or modified.
- No shell execution path was added to Brain Console.
- No mutation buttons were added.
- Unrelated dirty `operations/system-configs/**` files were left unstaged and untouched by this continuation.


---

## Continuation update — Brain Console managed-process contract alignment

Date: 2026-05-21

Continued from the local apps live actions handoff after reactivating the `brain` and `mind` sources.

What changed:

- Brain Console client types now include the Brain Core `managedProcesses` array returned by `/local-apps/actions/status`.
- Brain Console now has an explicit `BrainCoreLocalAppManagedProcessRecord` type for read-only managed process metadata.
- Brain Console local app action backlog category typing now includes `dynamic-stop-after-brain-core-start`, matching Brain Core's dynamic stop category for managed npm processes.
- Dashboard snapshot derivation now carries `localAppManagedProcessCount` from the read-only Brain Core action status payload.

Validation:

- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.

Safety notes:

- No mutation controls were added.
- Brain Console still does not execute shell commands.
- No `.env` files, secrets, tokens, Mind writes, or operations config writes were touched.
- Existing unrelated dirty files in `operations/system-configs/**` and local Mind/Obsidian state were left untouched.


---

## Continuation update — Managed-process next-action visibility

Date: 2026-05-21

Continued the Brain Console managed-process visibility phase.

What changed:

- Dashboard next-action derivation now surfaces active Brain Core-managed local app processes when `/local-apps/actions/status` reports them.
- The summary remains read-only and does not add mutation buttons or shell execution.
- If no higher-priority blocker, approval, or maintenance item exists, the Console can now show: `N Brain Core-managed local app process(es) active`.

Validation:

- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.

Safety notes:

- No `.env` files, secrets, tokens, operations config writes, or Mind writes were touched.
- Existing unrelated dirty operations-system and local Obsidian state remained untouched.


---

## Continuation update — Brain Console plugin deployment verification

Date: 2026-05-21

Completed the deployment verification phase after surfacing managed-process status in the Console summary.

What changed:

- Rebuilt the Brain Console Obsidian plugin package.
- Installed the current bundle into both discovered Brain Console plugin folders.
- Verified the installed plugin copies contain the current marker and no stale Brain Console bundle markers.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
  - `mainSize: 193341`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
  - `mainSize: 193341`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`

Validation:

- `npm run --prefix projects/brain-console-obsidian release:install` passed.
- Release install internally passed typecheck, build, package, install, and installed-plugin scan.

Safety notes:

- Brain Console remains shell-free.
- No mutation controls were added.
- No `.env` files, secrets, tokens, operations config writes, or Mind note writes were touched.
- Existing unrelated operations-system dirty files were left unstaged.


---

## Continuation update — Managed-process Apps visibility

Date: 2026-05-21

Carried on from the plugin deployment verification phase by making active Brain Core-managed local app processes visible in the Apps section itself.

What changed:

- Local App Action Audit now shows a `Managed processes` count from `/local-apps/actions/status`.
- When Brain Core reports active managed processes, the card lists up to five process rows with app id, PID, safe command label, and relative start time.
- Added focused dashboard derivation coverage for managed-process count and next-action priority.
- Kept managed-process visibility read-only; no mutation buttons or shell execution paths were added.

Files changed:

- `projects/brain-console-obsidian/src/view.ts`
- `projects/brain-console-obsidian/styles.css`
- `projects/brain-console-obsidian/tests/dashboard-managed-process.test.ts`
- `docs/system/1779249206791-brain-console-local-apps-live-actions-handoff.md`

Validation:

- `npm run --prefix projects/brain-console-obsidian typecheck` passed.
- `npm --prefix projects/brain-console-obsidian exec -- vitest run tests/dashboard-managed-process.test.ts` passed: 1 file, 2 tests.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed and installed both discovered plugin copies.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
  - `mainSize: 194502`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
  - `mainSize: 194502`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`

Safety notes:

- Brain Console still does not execute shell commands.
- No lifecycle action is triggered by rendering managed-process rows.
- No `.env` files, secrets, tokens, operations config writes, or Mind note writes were touched.
- Existing unrelated operations-system dirty files were left unstaged.


---

## Continuation update — Install marker and live verifier cleanup

Date: 2026-05-21

Verified the older BuildFlow handoff against the current repo state. The live-actions work was already implemented and extended beyond commit `54028040`; the current roadmap position is the Brain Console local-apps hardening tail, not the original "make buttons live" starting point.

What changed in this continuation:

- Fixed the Brain Console install verification card so its expected marker is `brain-console-local-apps-live-actions-2026-05-19-01`, not the stale `brain-console-local-apps-functional-2026-05-19-01`.
- Hardened `check:dashboard-source` to fail if `view.ts` contains the stale functional marker.
- Hardened `projects/brain-core/scripts/test-local-app-actions-live.mjs` cleanup so temporary live-test requests use closed connections and the temporary server closes active connections.
- Hardened the Brain Core local app action executor so finished detached actions destroy stdout/stderr pipes; this prevents long-running accepted app starts from keeping verifier Node processes open after JSON success output.

Files changed:

- `projects/brain-console-obsidian/src/view.ts`
- `projects/brain-console-obsidian/styles.css`
- `projects/brain-console-obsidian/scripts/check-dashboard-source.mjs`
- `projects/brain-console-obsidian/tests/dashboard-managed-process.test.ts`
- `projects/brain-core/scripts/test-local-app-actions-live.mjs`
- `projects/brain-core/src/adapters/local-app-action-executor.ts`
- `docs/system/1779249206791-brain-console-local-apps-live-actions-handoff.md`

Validation:

- `npm run --prefix projects/brain-core ci` passed: 526/526 tests.
- `npm run --prefix projects/brain-core test:local-app-actions-live` passed and exited cleanly with code 0.
- `npm run --prefix projects/brain-console-obsidian typecheck` passed through `release:install`.
- `npm --prefix projects/brain-console-obsidian exec -- vitest run tests/dashboard-managed-process.test.ts` passed: 1 file, 2 tests.
- `npm run --prefix projects/brain-console-obsidian check:dashboard-source` passed.
- `npm run --prefix projects/brain-console-obsidian release:install` passed.
- `npm run --prefix projects/brain-console-obsidian find:installed` passed.

Live verifier evidence:

- Dashboard app count: 16.
- Source diagnostics: canonical app count 15, displayed app count 16, mismatches empty.
- Unknown app POST returned 404.
- Unsupported action POST returned 404.
- `model-router:start` returned structured `not_executable`.
- Real live action: `video-orchestrator:restart` returned `success`, `ok: true`.
- Composite restart: `says-the-bible:restart` returned `success`, `ok: true`.
- Brain Core `/status` remained 200/OK after POST probes.
- Executable actions: 38.
- Disabled actions: 10.
- Disabled backlog count: 10, matching dashboard disabled action count.
- ProChat managed lifecycle remains environment-dependent in live test: start accepted, but process exited before status poll.

Installed plugin verification:

- `/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console`
  - `mainSize: 194517`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`
- `/Users/Office/mind/.obsidian/plugins/brain-console`
  - `mainSize: 194517`
  - marker: `brain-console-local-apps-live-actions-2026-05-19-01`
  - `staleMarkers: []`

Safety notes:

- Brain Console still does not execute shell commands.
- Brain Core executes only canonical allowlisted local-app lifecycle commands.
- No command overrides are accepted.
- No `.env` files, secrets, tokens, operations config writes, or Mind note writes were touched.
- Existing unrelated operations-system dirty files and Mind Obsidian state were left unstaged.
