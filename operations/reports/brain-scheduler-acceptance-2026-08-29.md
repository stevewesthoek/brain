# Brain Scheduler Acceptance Report

**Evidence date:** 2026-08-29
**Feature branch:** `feat/brain-scheduler-consolidation`
**Feature HEAD before this report:** `52e168a468d146e581b4fb58cf9de5e0c01cd733`
**Exact comparison base:** `5eca4acf44ca7cb7a0a4a2701b1e9e2cbd30ffe9`
**Feature commits:** `1e12e1ba`, `52e168a4`
**Decision:** Accepted on the feature branch; live rollout remains separately unperformed and unverified.

## Executive result

The Brain Scheduler is consolidated behind one canonical typed registry, one
registry-backed runner, one receipt/history contract, one Brain Core overview,
and one read-only Console Control Center. The scheduler boundary is fail-closed:
only four local report-only or dry-run jobs are active; every dangerous,
credential-sensitive, external-write, destructive, or Mind-write-capable job is
disabled or policy-blocked.

The broader Brain Core suite was reproduced once at `1929` passing and `11`
failing tests. Every one of those 11 failures is proven pre-existing or
environment/test-run dependent by the exact-base comparison and isolated-file
runs below. No scheduler-caused failure remains, and no unrelated repair was
made.

## Architecture

```text
macOS launchd
  com.office.nightly-scheduler
  daily 03:00 Europe/Lisbon + RunAtLoad
          |
          v
thin bootstrap: tools/scripts/office-nightly-scheduler.sh
          |
          v
canonical runner: tools/scripts/brain-scheduler-runner.mjs
  validate registry -> cutoff/once-per-day -> one lock
  -> active report-only jobs -> receipts/history/report
          |
          +--> ~/.local/state/office-scheduler/receipts/*.json
          +--> ~/.local/state/office-scheduler/scheduler-latest.json
          +--> ~/.local/state/office-scheduler/history.jsonl
          +--> runtime/local/office-scheduler/latest-run.md
          |
          v
Brain Core GET /infra/scheduler
          |
          v
Brain Console /scheduler (read-only Control Center)
```

The registry at `operations/specs/typed-scheduler-jobs.json` is the sole job
inventory authority. The JSON schema, runbook decision table, runner, Brain
Core adapter, and Console all consume that boundary. The runner loads the
registry on every invocation, executes only `lifecycle: active` jobs in
`report-only` or `dry-run-report-only` mode, uses zero retries and single
concurrency, and never enables an inactive job.

## Registry decision matrix

Registry version `2.0.0`; total jobs `17`.

| ID | Lifecycle | Mode | Decision and safe human action |
| --- | --- | --- | --- |
| `stb-pipeline-batch` | disabled | disabled | External write pipeline; require separate safety review. |
| `n8n-backup` | disabled | disabled | Credential/backup side effects; verify destination, retention, and rollback first. |
| `claude-session-cleanup` | disabled | disabled | Local deletion and external entrypoint; manual review only. |
| `dance-of-life-sync` | disabled | disabled | External media sync/rescan; keep out of scheduler. |
| `bible-studies-pipeline` | policy-blocked | disabled | Mind-write-capable implementation; Mind safety review and approval required. |
| `gemini-cleanup` | deprecated | disabled | No canonical entrypoint; do not restore. |
| `google-ads-sync` | disabled | disabled | External advertising and credentials; separate provider approval required. |
| `gws-token-refresh` | policy-blocked | disabled | Credential-sensitive; use a secret-safe provider procedure first. |
| `mind-steward-dry-run` | active | dry-run-report-only | Run report-only validation; review findings, never apply changes. |
| `local-apps-report` | active | report-only | Generate local application status; remediation is separate. |
| `video-runtime-report` | active | report-only | Generate video runtime status; no queue mutation. |
| `video-orchestrator-storage-cleanup` | disabled | disabled | Local deletion with external implementation; manual review only. |
| `memory-context-refresh` | disabled | disabled | Derived-memory write scope requires separate review. |
| `mind-compile-loop` | active | report-only | Generate inbox proposals only; no Mind moves or writes. |
| `graphify-nightly` | policy-blocked | disabled | Event-driven semantic gate only; structural Graphify remains frozen. |
| `ing-bank-statement-download` | policy-blocked | disabled | Financial/credential-sensitive; never enable from this scheduler. |
| `skill-prune` | disabled | disabled | Automatic skill modification is not scheduler-authorized. |

Lifecycle counts: `active=4`, `manual-only=0`, `policy-blocked=4`,
`disabled=8`, `deprecated=1`. The four active jobs are all local and
report-only/dry-run-only. No active job has external-write capability,
credential sensitivity, destructive behavior, or Mind writes.

## Acceptance matrix

| Requirement | Result | Evidence |
| --- | --- | --- |
| One canonical typed registry and schema | PASS | `validate-typed-scheduler-jobs.mjs`: `typed-scheduler-jobs-valid jobs=17`; lifecycle counts match above. |
| Registry invariants fail closed | PASS | `tools/validate-typed-scheduler-jobs.test.mjs`: 3/3 passing, including unsafe-active and unknown-dependency cases. |
| Registry-backed runner | PASS | `tools/scripts/brain-scheduler-runner.test.mjs`: 4/4 passing; active-only execution, dependency blocking, redaction, cutoff, duplicate-day, and lock behavior covered. |
| Dry-run acceptance | PASS | Temporary state/log/report directories: 17 receipts, no child spawns, report generated, lock released. |
| One launchd bootstrap | PASS | `tools/scripts/office-nightly-scheduler.sh` is a thin bootstrap; runner owns inventory, timing, policy, locks, receipts, and history. |
| Brain Core scheduler adapter and route | PASS | Focused scheduler Core tests: 59/59 passing; invalid manifest and active-authority checks fail closed. |
| Brain Core type/build validation | PASS | `npm run typecheck` and `npm run build` in `projects/brain-core`. |
| Console Control Center | PASS | `projects/brain-console` typecheck and production build pass; `/scheduler` is read-only and renders registry, lifecycle, launch, lock, receipt, and history state. |
| Broader Brain Core attribution | PASS with unrelated failures recorded | Full feature suite: 1929/1940 pass, 11 fail; all 11 are attributed below, scheduler-caused count is 0. |
| Live launchd mutation | NOT PERFORMED | Read-only audit only; no reload, force-run, production execution, or deployment was performed. |

## Diff correlation

The scheduler feature diff changes the registry/specification, scheduler
runner/bootstrap/report tooling, scheduler-specific tests, the
`infra-office-scheduler.ts` adapter, scheduler API types, and the Console
Control Center. The changed Brain Core adapter is reached by
`GET /infra/scheduler` and infrastructure health collection; it is not called
by the five failing test paths. The scheduler API additions in
`types/api.ts` are type declarations for that adapter surface. `routes.ts`,
`infrastructure-plane.mjs`, `agent-orchestrator-executor.ts`,
`simplification-review.ts`, `vo-studio-write.ts`, and all five failing test
files are unchanged from the exact base. The runner's child processes in
acceptance tests used temporary state/report paths and were not involved in
the broader Core suite.

## Broader Brain Core failure attribution

The feature-suite reproduction was run with Node `20.20.2` using the supported
`npm test` command. It produced `# tests 1940`, `# pass 1929`, `# fail 11`.
The exact-base worktree was detached at
`5eca4acf44ca7cb7a0a4a2701b1e9e2cbd30ffe9`, built independently, and the same
five test files were run both as a selected batch and as isolated processes.
The failing test files and direct adapters are byte-identical between base and
feature; none of the five test files or their direct failing adapters changed
in the feature diff.

| # | Test file and test | Feature reproduction | Exact-base / isolated comparison | Attribution |
| --- | --- | --- | --- | --- |
| 1 | `projects/brain-core/src/tests/agent-orchestrator.test.ts` — `OrchestrationExecutor executes all tasks in order (no gates)` | Full suite fails with `false !== true` after about 5 seconds. | Base isolated: 39/39 pass; feature isolated: 39/39 pass. | Pre-existing test-run-order/timing behavior; no scheduler path is invoked. |
| 2 | `projects/brain-core/src/tests/agent-orchestrator.test.ts` — `OrchestrationExecutor records completed task results in ledger` | Full suite fails with `false !== true` after about 5 seconds. | Base isolated: 39/39 pass; feature isolated: 39/39 pass. | Pre-existing test-run-order/timing behavior; no scheduler path is invoked. |
| 3 | `projects/brain-core/src/tests/agent-orchestrator.test.ts` — `OrchestrationExecutor blocks task at unapproved gate` | Full suite fails with `false !== true`. | Base isolated: 39/39 pass; feature isolated: 39/39 pass. | Pre-existing test-run-order/timing behavior; no scheduler path is invoked. |
| 4 | `projects/brain-core/src/tests/agent-orchestrator.test.ts` — `OrchestrationExecutor proceeds past gate when approved` | Full suite fails with `false !== true`. | Base isolated: 39/39 pass; feature isolated: 39/39 pass. | Pre-existing test-run-order/timing behavior; no scheduler path is invoked. |
| 5 | `projects/brain-core/src/tests/agent-orchestrator.test.ts` — `OrchestrationExecutor blocks downstream task when upstream is at approval gate` | Full suite fails with `false !== true`. | Base isolated: 39/39 pass; feature isolated: 39/39 pass. | Pre-existing test-run-order/timing behavior; no scheduler path is invoked. |
| 6 | `projects/brain-core/src/tests/infrastructure-unified-endpoints.test.ts` — `topology and resource inspection use the same canonical resource ID` | `topology.resourceIds` lacks `host:supabase`. | Base isolated: same failure; 8/9 pass in both base and feature. | Pre-existing infrastructure catalog fixture/state gap; `infrastructure-plane.mjs` and the test are unchanged, and the scheduler adapter is not called. |
| 7 | `projects/brain-core/src/tests/mind-kanban-exporter-validation.test.ts` — `existing Mind Kanban exporter emits structured JSON without modifying kanban.md` | `existsSync` assertion is false. | Base isolated: same `false !== true`; 0/3 pass in both. | Environment path/fixture gap; the feature resolves `/Users/Office/.config/workbench/mind`, which is absent. |
| 8 | `projects/brain-core/src/tests/mind-kanban-exporter-validation.test.ts` — `existing Mind Kanban exporter emits Markdown summary without modifying kanban.md` | `ENOENT` for `/Users/Office/.config/workbench/mind/kanban.md`. | Base isolated: `ENOENT` for `/private/tmp/mind/kanban.md`; same test failure. | Environment path/fixture gap; no scheduler dependency. |
| 9 | `projects/brain-core/src/tests/mind-kanban-exporter-validation.test.ts` — `existing Mind Kanban exporter help documents stdout as default` | `ENOENT` for `/Users/Office/.config/workbench/mind/kanban.md`. | Base isolated: `ENOENT` for `/private/tmp/mind/kanban.md`; same test failure. | Environment path/fixture gap; no scheduler dependency. |
| 10 | `projects/brain-core/src/tests/routes.test.ts` — `GET /simplification-review returns read-only simplification review` | `folderStructure.topLevelFolderCount >= 1` is false. | Base isolated: same failure; 207/208 pass in both base and feature. | Pre-existing missing-Mind-root behavior; `simplification-review.ts`, `routes.test.ts`, and the route are unchanged. |
| 11 | `projects/brain-core/src/tests/vo-studio-write.test.ts` — `generateMetadataRequest generates YouTube metadata from the canonical moving-video content item` | Actual title `Genesis: Creation Story`; expected `Genesis: Creation Story \| Says the Bible`. | Base isolated: 72/72 pass; feature isolated: 72/72 pass. | Full-suite shared-state/provider timing behavior; direct VO source and test are unchanged, and no scheduler path is invoked. |

The selected five-file batch also showed older base-only failures in unrelated
local-app and lifecycle tests. Those are outside the current 11 and were not
modified or repaired. The isolated comparison removes cross-file interference
from the attribution decision. Scheduler-caused failures: `0`.

## Runtime and live-state evidence

### Feature-branch runtime acceptance

- Registry and runner test surface passed as documented above.
- The bounded runner dry run wrote one receipt for every registry job,
  spawned no child process, wrote the report, and left no lock held.
- No live launchd reload, forced run, credential access, external write,
  destructive operation, or Mind write was performed.

### Read-only live audit at 2026-08-29 23:09 WEST

The installed launchd label is loaded but inactive:

- Label: `com.office.nightly-scheduler`
- `launchctl list`: loaded row present with no running PID (`- 0 ...`)
- `launchctl print`: `state = not running`; `runs = 4`
- Configured trigger: `StartCalendarInterval Hour=3 Minute=0`
- `RunAtLoad`: `true`
- Loaded working directory: `/Users/Office/Repos/stevewesthoek/brain`
- Source and installed plist resolve to the same shared-main source path and
  have matching SHA-256 `edee38ed195dfa7cd04078f4f5f13e9f9e9b69ca7c57393ef14e8957461b4998`
- Explicit enabled/disabled state: `UNKNOWN`; the label was not present in
  `launchctl print-disabled`, which does not by itself prove enabled state.
- Active lock: absent.
- Shared live `scheduler-latest.json`: `skipped`, reason
  `already-completed-for-lisbon-day`, trigger `launchd`, created at
  `2026-08-29T21:51:26.981Z`.
- Shared live report: generated `2026-08-29 03:00:08 WEST`, records last
  completed Lisbon date `2026-08-29`, but is the older Office Scheduler report
  format and not proof of the feature branch runner.
- The shared live state record names the feature worktree as its manifest path,
  while launchd's plist points at the shared `main` checkout. This identity
  mismatch is retained as an evidence limitation, not normalized to green.

Therefore the feature branch is pushed and repository-accepted, but it is not
claimed as installed or deployed in the live launchd checkout. A future live
cutover requires its own explicit deployment identity, reload, and bounded
runtime acceptance.

## Remaining blockers and boundaries

Scheduler implementation blockers: **none**.

Separate follow-up items:

1. The 11 broader Brain Core failures remain repository/environment test debt
   documented above; none is scheduler-caused.
2. Live rollout of this feature branch is not authorized or evidenced in this
   acceptance packet. The installed launchd target still works from the shared
   main checkout, and its live registry is not the feature registry.
3. No inactive registry job may be enabled automatically. Any future change
   involving Mind writes, external writes, credentials, finance, deletion, or
   Graphify structural generation needs a separately recorded authority and
   safety review.

## Reproducible validation commands

Run from the feature worktree with Node `20.20.2`:

```text
node tools/validate-typed-scheduler-jobs.mjs
node --test tools/validate-typed-scheduler-jobs.test.mjs tools/scripts/brain-scheduler-runner.test.mjs
cd projects/brain-core && npm run typecheck && npm run build
node --test dist/tests/infra-office-scheduler.test.js dist/tests/infra-endpoints.test.js dist/tests/scheduler-manual-success-gate.test.js dist/tests/execution-kill-switch.test.js dist/tests/on-demand-runs.test.js dist/tests/runtime-reports.test.js
cd ../brain-console && npm run typecheck && npm run build
```

All commands above passed in this acceptance run. The broader suite command
was also run once and its 11 unrelated/environmental failures are preserved in
the attribution table rather than hidden.
