# Brain Scheduler — Future Change Checklist

Use this checklist for any proposed scheduler registry, runner, launchd,
Brain Core, Console, or active-job change. It is a review gate, not automatic
authorization to mutate the live machine.

## Before editing

- [ ] Read [current production state](brain-scheduler-current-state.md), the
      [canonical runbook](brain-scheduler.md), and the relevant historical
      evidence.
- [ ] Fetch `origin/main`; record the source SHA and check whether the detached
      production runtime is clean and at the intended SHA.
- [ ] Define whether the change is repository-only, dry-run-only, or a live
      deployment. Obtain separate approval before launchd, credentials,
      external systems, Mind, or production state are touched.
- [ ] Confirm the proposed job is not a hidden duplicate or parallel scheduler
      path.

## Registry and code contract

- [ ] Update `typed-scheduler-jobs.json` and its schema together.
- [ ] Declare lifecycle, schedule type, mode, authority, network,
      credential, destructive, Mind-write, timeout, retries, concurrency,
      idempotency, receipt, output artifacts, evidence, and human action.
- [ ] Keep `externalActivation: unknown` until separately observed.
- [ ] Permit active admission only for local read-only `report-only` or
      `dry-run-report-only` work; keep sensitive, destructive, external-write,
      and Mind-mutating work blocked or disabled.
- [ ] Keep receipt paths separate from job-produced artifact paths.
- [ ] Update the runbook decision table, current-state inventory, and any
      affected operator/consumer documentation.

## Validation

- [ ] Run `node tools/validate-typed-scheduler-jobs.mjs` and `node tools/validate-brain-scheduler-documentation.mjs`.
- [ ] Run focused registry, runner, source-contract, Core, and documentation tests, including `node --test tools/validate-brain-scheduler-documentation.test.mjs`.
- [ ] Run a dry-run with isolated temporary state, log, and report paths.
- [ ] Verify no production completion marker, receipts, history, latest report,
      Mind files, external system, credential, or launchd state was changed.
- [ ] Run relevant Brain Core and Brain Console typechecks/tests.
- [ ] Run link/reference validation and inspect the stale-reference report.

## Deployment and acceptance

- [ ] Reconcile a clean detached runtime and source SHA.
- [ ] Verify the installed plist label, realpath, runner arguments, working
      directory, calendar, `RunAtLoad=false`, and log paths.
- [ ] Capture bounded rollback evidence for the label only.
- [ ] For a live change, perform only the separately approved bootstrap/reload;
      never add an implicit kickstart or force-run.
- [ ] For a first-natural-run acceptance, wait for the calendar event and
      require `trigger=launchd`, `dryRun=false`, the expected SHA/provenance,
      successful Active jobs, zero non-active starts, valid state, and a free
      lock.
- [ ] Do not claim acceptance from repository configuration, old `.last` files,
      temporary worktrees, old reports, or Console rendering alone.

## Closeout

- [ ] Update the current-state document and troubleshooting guidance.
- [ ] Add the lesson if the change exposed a durable operational rule.
- [ ] Add the dated report to the report index; preserve old reports unchanged.
- [ ] Re-run no scheduler job merely because documentation or metadata changed.
- [ ] Record the exact commit/runtime SHA and remaining follow-up in the final
      report.
