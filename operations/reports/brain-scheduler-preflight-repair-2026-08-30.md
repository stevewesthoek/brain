# Brain Scheduler Preflight Repair — 2026-08-30

## Source

- Before: `281a9fcf6179f28a5071e67db69defeb200658e4`
- After: `d460256ac542ec1722cba34156a6c29171da8b19`
- Origin `main`: `d460256ac542ec1722cba34156a6c29171da8b19`
- Runtime: `/Users/Office/Repos/stevewesthoek/brain-runtime` at the exact after SHA, clean.

## Repaired blockers

1. Mind Steward now classifies `tsx` as a runtime `dependency`; the lockfile remains authoritative and the wrapper invokes only `projects/mind-steward/node_modules/.bin/tsx`. Missing local `tsx` fails closed. `npx --yes`, global discovery, and automatic package download are not used.
2. `last_completed_lisbon_date` is parsed as one strict possible `YYYY-MM-DD` Lisbon date. Malformed, empty, impossible, multiline, and future values return `invalid-last-completed-state` before child execution; the original state remains untouched.
3. Dry-runs require explicit isolated state, log, and report paths. They cannot write production latest state, history, completion markers, or receipts. Production manifest identity is repository-relative (`operations/specs/typed-scheduler-jobs.json`).
4. Registry metadata now matches production: `runAtLoad:false`, bootstrap/runner `tools/scripts/brain-scheduler-runner.mjs`. The schema and Brain Core adapter enforce this contract.

## Stale runtime evidence

The original live latest file was retained at:
`runtime/local/brain-scheduler/preflight-evidence/scheduler-latest-stale-2026-08-30.json`.
Its SHA-256 is `3058660726212fcd7723b1ce86713b18099532baf7c13696b9e789f167535ba3`.
The record referenced the stale `/Users/Office/.config/workbench/brain-scheduler-consolidation` worktree and was removed only from the live latest-production slot. No successful production run was fabricated. The existing `last_completed_lisbon_date` was not modified.

## Validation

- Scheduler registry validation: passed; 16 jobs, lifecycle counts active 4 / policy-blocked 4 / disabled 7 / deprecated 1.
- Focused scheduler, source-contract, and registry tests: 18 passed.
- Invalid-state fixtures: 5 invalid cases, each blocked with `executedJobIds:[]` and zero child starts.
- Mind Steward: `npm run typecheck` passed; `npm test` passed, 66 tests.
- Brain Core: `npm run typecheck`, build, and focused scheduler tests passed, 3 tests.
- LaunchAgent plist: `plutil -lint` passed.
- Safe isolated dry-run: `executedJobIds:[]`; no production latest/history/completion/receipt path was used.
- `git diff --check`: passed.

## Runtime and live state

- Locked runtime provisioning: `npm ci --omit=dev --ignore-scripts` in `projects/mind-steward`; local `tsx v4.22.1` present.
- Future scheduler execution requires no package download.
- Core `GET http://127.0.0.1:4877/infra/scheduler`: HTTP 200, status `ok`, health `warning` because no production run/report exists yet, 16 jobs, review categories 4 / 10 / 0 / 2, `matchesSource:true`, latest production result absent.
- LaunchAgent remains canonical runner, `RunAtLoad=false`, 03:00 Lisbon, idle with active count 0, runs 0, and no lock.

## Safety

- Scheduler jobs manually executed: 0.
- `FORCE_RUN`: NO.
- kickstart: NO.
- Mind writes: NO.
- Blocked jobs run: 0.
- Obsolete jobs run: 0.
- Production natural runs since migration: 0.

## Final preflight

Brain Scheduler pre-flight acceptance is complete. Production configuration is ready for the first natural 03:00 Lisbon run.

FIRST NATURAL RUN OBSERVED: NO

NEXT NATURAL RUN: 2026-08-31 03:00 Europe/Lisbon

REMAINING ACCEPTANCE:

Read-only observation of the first natural scheduler run.
