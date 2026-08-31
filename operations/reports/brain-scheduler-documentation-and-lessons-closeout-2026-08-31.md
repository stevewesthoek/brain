# Brain Scheduler Documentation, Operational Knowledge, and Lessons Closeout

**Date:** 2026-08-31
**Status:** complete
**Scope:** documentation, knowledge consolidation, stale-reference audit, and focused validation only
**Current source/runtime/main SHA:** `720cbd1ed858a5eb03a4329d2993efb3615b0284`

## Decision

The accepted production scheduler was not rerun, force-run, kickstarted, reloaded,
or otherwise mutated during this closeout. No launchd state, production receipt,
Mind content, credential, external system, or job classification was changed.

The current operating authority is [`brain-scheduler-current-state.md`](../runbooks/brain-scheduler-current-state.md), backed by the typed registry, the canonical runbook, and the accepted 2026-08-31 natural-run evidence.

## Current truth consolidated

- Label: `com.office.nightly-scheduler`.
- Runner: `tools/scripts/brain-scheduler-runner.mjs`.
- Runtime: `/Users/Office/Repos/stevewesthoek/brain-runtime`, clean and detached at the current SHA.
- Schedule: daily at `03:00` Europe/Lisbon.
- `RunAtLoad=false`; bootstrap/reload is not an execution shortcut.
- Inventory: 16 total; 4 Active, 10 Blocked, 0 Needs Review, 2 Obsolete.
- Active set: `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `mind-compile-loop`.
- Brain Core `GET /infra/scheduler` is the read-only adapter; Brain Console `/scheduler` is its read-only consumer.
- Overall receipt, per-job receipts, bounded history, and generated job artifacts have separate ownership.
- Graphify is policy-blocked/event-driven, memory refresh is disabled/manual-only, and no parallel hidden scheduler lane is current.

The first natural run was already accepted on 2026-08-31 with executed SHA
`981780540981c15e02095044a5b74bcd5ccd3fe0`. The later `720cbd1e` correction
separated the stdout-only `mind-compile-loop` receipt from job artifacts and did
not require a rerun.

## Documentation added or corrected

- [`brain-scheduler-current-state.md`](../runbooks/brain-scheduler-current-state.md) — stable current identity, inventory, ownership, accepted natural run, and Brain consumption boundaries.
- [`brain-scheduler-lessons-learned.md`](../runbooks/brain-scheduler-lessons-learned.md) — durable lessons from reconciliation, deployment, preflight, acceptance, and closeout.
- [`brain-scheduler-report-index.md`](../runbooks/brain-scheduler-report-index.md) — dated scheduler evidence index with historical/current separation.
- [`brain-scheduler-troubleshooting.md`](../runbooks/brain-scheduler-troubleshooting.md) — concise read-only diagnostic matrix.
- [`brain-scheduler-change-checklist.md`](../runbooks/brain-scheduler-change-checklist.md) — future registry/source/deployment review gate.
- [`validate-brain-scheduler-documentation.mjs`](../../tools/validate-brain-scheduler-documentation.mjs) and its focused test — contract/count/link validation.
- Updated canonical runbook, infrastructure pointer, tools README, runbook index, Brain startup/memory-map pointers, Core/Console consumer guidance, Graphify boundaries, Mind guidance, n8n/ING/STB boundaries, and retained historical labels.

## Documentation classification

| Class | Current audited surfaces | Result |
|---|---|---|
| A — current authority | Current-state runbook, canonical runbook, typed registry/schema, canonical plist, runner/source-contract tests | Current truth is explicit and internally consistent. |
| B — operator guidance | Troubleshooting matrix, change checklist, infrastructure pointer, runbook index, Mind/n8n/ING/Graphify procedures | Current paths are bounded; blocked/manual-only workflows are explicit. |
| C — developer contract | Runner, registry validator/tests, Brain Core adapter/routes/tests, Brain Console scheduler page/component/schema | Core owns read-only projection; Console consumes Core and exposes no execution control. |
| D — Brain consumption | `00-start-here.md`, `00-memory-map.md`, `operations/README.md`, runbook README, Codex/Gemini startup configs, shared-memory runbook, `CLAUDE.md` | Scheduler is discoverable; memory context has an explicit missing/stale fallback. |
| E — historical evidence | Dated scheduler reports, decision-log entries, MTPLX report, old implementation prompts/plans, video roadmap/plan | Facts were preserved and marked historical where scheduler references remain. |
| F — legacy/compatibility | `tools/scripts/office-nightly-scheduler.sh`, `tools/scripts/graphify-nightly.sh`, old backup/manual wrappers, compatibility report renderer | Retained paths are labeled non-production and cannot be mistaken for the installed target. |
| G — stale/incorrect | Infrastructure 17-job snapshot, old RunAtLoad/catch-up claims, direct scheduler wiring in blocked job docs, old Graphify test expectation | Corrected or explicitly superseded; no unresolved current-doc contradiction remains. |
| H — generated evidence | `operations/reports/`, runtime `latest-run.md`, scheduler receipts/history, legacy `.last` markers | Evidence is linked and its authority is bounded; generated artifacts do not define policy. |
| I — unknown | Current scheduler documentation/reference set | None after bounded audit. |

## No-loose-ends matrix

| # | Question | Answer and exact path/follow-up |
|---:|---|---|
| 1 | Any current docs say 17 jobs? | **NO.** Current count is 16 in [`brain-scheduler-current-state.md`](../runbooks/brain-scheduler-current-state.md) and [`scheduler-inventory.md`](../infrastructure/scheduler-inventory.md). Historical reports that preserve 17 are indexed as historical only. |
| 2 | Current docs describe skill-prune as current? | **NO.** It is absent from the Active set and retained only in historical report entries in [`brain-scheduler-report-index.md`](../runbooks/brain-scheduler-report-index.md). |
| 3 | Old monolith described as production? | **NO.** The wrapper is labeled compatibility/rollback only in the current state, runbook, tools README, and affected operator docs. |
| 4 | `RunAtLoad=true` for Brain Scheduler? | **NO.** The canonical plist and current docs require `RunAtLoad=false`. The unrelated `RunAtLoad=true` in `docs/platform-architecture.md` documents `com.office.ai-model-selector`, not Brain Scheduler. |
| 5 | Temporary scheduler worktrees? | **NO.** Current state and runbook require the clean detached `brain-runtime`; dry-runs require isolated state and cannot become production provenance. |
| 6 | `npx --yes` scheduled runtime? | **NO.** The runbook requires the locked repository-local `tsx` and explicitly rejects `npx --yes`, global lookup, and automatic download. |
| 7 | Receipts conflated with job artifacts? | **NO.** Ownership is separated in the current-state document; `mind-compile-loop` explicitly declares no job artifact and uses its scheduler receipt. |
| 8 | Fail-closed state omitted? | **NO.** Strict malformed/impossible/future/multiline state blocking is documented in the runbook and troubleshooting matrix. |
| 9 | Natural-run acceptance omitted? | **NO.** Accepted natural-run evidence and the no-manual-substitute rule are in current state, lessons, checklist, and the dated acceptance report. |
| 10 | Console implied as independent authority? | **NO.** Current state says Core is the adapter authority and Console is read-only; source contract is checked by the documentation validator. |
| 11 | Undocumented scheduler paths? | **NO.** Identity, registry, runner, plist, runtime state/log/report, Core, Console, compatibility wrapper, and report renderer are documented. |
| 12 | Automatic parallel scheduler path? | **NO.** Graphify is blocked/event-driven, memory refresh is disabled/manual-only, NotebookLM is separate proposal-only, and blocked job wrappers are not automatic lanes. |
| 13 | Undocumented Active job? | **NO.** The exact four Active IDs are repeated in the current-state document, canonical runbook, registry, and validator. |
| 14 | Undocumented retained legacy job? | **NO.** The 10 Blocked and 2 Obsolete IDs are listed with lifecycle, mode, human action, and historical report links. |
| 15 | Unresolved scheduler TODO/FIXME? | **NO.** Bounded scheduler-specific TODO/FIXME review found no unresolved current consolidation item; future work is governed by the change checklist. |
| 16 | Obsolete observer automation? | **NO.** The observer is recorded as a non-blocking historical defect and not a current service or authority in the natural-run report/current state. |
| 17 | Stale launchd migration instructions? | **NO.** Current migration guidance requires `RunAtLoad=false`, detached-runtime identity, bounded rollback evidence, and no kickstart/force-run; old reports are historical. |
| 18 | Broken documentation references? | **NO.** Link validation passed for the current-state/runbook/index/checklist/troubleshooting/infrastructure surfaces. |
| 19 | Brain startup/context missing scheduler link? | **NO.** Links now exist in `00-start-here.md`, `00-memory-map.md`, `operations/README.md`, and `operations/runbooks/README.md`. |
| 20 | Known lesson not captured? | **NO.** Eighteen durable lessons are recorded in [`brain-scheduler-lessons-learned.md`](../runbooks/brain-scheduler-lessons-learned.md). |

## Validation

Passed:

- `node tools/validate-brain-scheduler-documentation.mjs`.
- `node --test tools/validate-brain-scheduler-documentation.test.mjs`.
- `git diff --check`.
- Scheduler/registry/source-contract/compile-loop tests: 21/21 passed in the clean current runtime at SHA `720cbd1e`.
- Graphify operational validator and focused B8.5 tests after the scheduler-boundary correction: 12/12 passed.
- Brain Core typecheck in the clean current runtime: passed.
- Brain Console typecheck in the clean current runtime: passed.
- Brain Console contract test: 3/3 passed.
- No scheduler execution, `FORCE_RUN`, kickstart, reload, launchd mutation, Mind mutation, credential operation, or external write was performed.

## Remaining follow-up

None. Future scheduler changes should use the change checklist and a separately
approved live deployment step. Historical reports should remain immutable.

## Final verdict

Brain Scheduler documentation, operational knowledge, and lessons learned are fully consolidated. No scheduler loose ends remain.

Brain Scheduler is complete operationally, documented canonically, discoverable by Brain, and ready for future maintenance.
