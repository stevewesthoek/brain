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
