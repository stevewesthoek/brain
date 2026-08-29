# BS0.14 Typed Scheduler Job Manifests — 2026-07-14

**Status:** historical report — superseded by Brain Scheduler registry v2.0.0.

The original report described the predecessor manifest and duplicate BS0.11
inventory. The current authority is `operations/specs/typed-scheduler-jobs.json`
plus `operations/specs/typed-scheduler-jobs.schema.json`; see
`operations/runbooks/brain-scheduler.md` for the current registry and job
decisions. Historical claims in this report do not prove current deployment or
external activation.

`tools/validate-typed-scheduler-jobs.mjs` validates the sole typed registry,
including safety invariants and dependency cycles. The compatibility validator
delegates to it; no duplicate inventory is authoritative.

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
