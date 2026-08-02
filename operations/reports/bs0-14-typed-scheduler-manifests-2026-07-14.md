# BS0.14 Typed Scheduler Job Manifests — 2026-07-14

**Status:** complete — all current repository-defined jobs represented.

`operations/specs/typed-scheduler-jobs.json` is a versioned manifest for all
17 jobs in the BS0.11 inventory. Each declares capability ID, entrypoint,
fixed arguments, root, dependencies, read/write scopes, privilege, mode,
timeout, retry count, concurrency, idempotency, receipt, failure status, kill
switch, activation, and evidence state.

`tools/validate-typed-scheduler-jobs.mjs` cross-checks all IDs against the
canonical inventory and rejects unknown jobs, injection-like arguments,
activation claims, unsafe Mind modes, privilege masquerading, missing required
metadata, missing inventory jobs, and dependency cycles. The Office Scheduler
validates this manifest before entering its already-contained sequence; it does
not activate a scheduler or enable any job.

```text
node tools/validate-typed-scheduler-jobs.mjs -> jobs=17, pass
node --test tools/validate-typed-scheduler-jobs.test.mjs -> 2 passed
bash -n tools/scripts/office-nightly-scheduler.sh -> pass
git diff --check -> pass
```

Mind status hash remained
`4a865c3c81a14ca9319df2d67a10aa98edcc245baf41bb32a4941e1aaaf1f0dc`.
No scheduler, deployment, credential, n8n, or external action ran.

## Continuation decision

**Continue to BS0.15.** Graphify remains explicitly disabled until its
separate capacity and publication containment checkpoint completes.
