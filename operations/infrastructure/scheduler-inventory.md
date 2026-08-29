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

The registry contains 17 jobs: 4 active report-only jobs, 4 policy-blocked
jobs, 8 disabled jobs, and 1 deprecated job. No dangerous, external-write,
financial, credential-sensitive, destructive, or Mind-mutating job is active.

The launchd compatibility label remains
`com.office.nightly-scheduler`, with a daily 03:00 Europe/Lisbon trigger and a
RunAtLoad guard. The shell entrypoint is only a bootstrap to the
registry-backed Node runner. Runtime truth comes from per-job receipts,
`scheduler-latest.json`, bounded history, and the generated report; repository
configuration does not prove external activation or deployed state.
