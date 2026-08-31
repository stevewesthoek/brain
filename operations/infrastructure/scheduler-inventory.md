# Brain Scheduler Inventory

This document is a navigation pointer, not a second inventory authority.

The canonical job inventory is:

- `operations/specs/typed-scheduler-jobs.json`
- `operations/specs/typed-scheduler-jobs.schema.json`
- `tools/scheduler/registry.mjs`

The canonical operator procedure and complete per-job decision table are in
`operations/runbooks/brain-scheduler.md`. Validate it with:

```bash
node tools/validate-typed-scheduler-jobs.mjs
node --test tools/validate-typed-scheduler-jobs.test.mjs tools/scripts/brain-scheduler-runner.test.mjs
```

The compatibility command
`tools/validate-infinite-brain-scheduler-inventory.mjs` delegates to the typed
registry. The former duplicate
`operations/specs/infinite-brain-scheduler-inventory.json` is retired and must
not be recreated.

## Current posture

The registry contains 16 jobs: 4 Active, 10 Blocked, 0 Needs Review, and 2
Obsolete. The exact IDs and safety metadata live in the typed registry and the
[canonical runbook](../runbooks/brain-scheduler.md#job-decisions). No
dangerous, external-write, financial, credential-sensitive, destructive, or
Mind-mutating job is active.

The production LaunchAgent label remains `com.office.nightly-scheduler`, with a
daily `03:00` Europe/Lisbon trigger and `RunAtLoad=false`. Its installed target
is the canonical `brain-scheduler-runner.mjs` in the clean detached
`brain-runtime` checkout. `tools/scripts/office-nightly-scheduler.sh` is a
retained compatibility/rollback wrapper, not the installed launch target.

Runtime truth comes from the canonical overall receipt, per-job receipts,
bounded history, and generated report. Brain Core exposes that state at
`GET /infra/scheduler`; Brain Console `/scheduler` is a read-only consumer and
does not own inventory or execution. Repository configuration alone does not
prove external activation or deployed state. See the [current production
state](../runbooks/brain-scheduler-current-state.md) for the accepted natural
run and source/deployment identity.
