# Brain Scheduler Google Ads Sync Closeout — 2026-08-30

## Decision

`google-ads-sync` is reconciled as `BLOCKED`, with `lifecycle=disabled`,
`mode=disabled`, and `runnable=NO`. The disposition is `REPLACE / HARDEN`.
The current implementation is retained as historical source evidence; no
replacement has been implemented and no Google Ads API call or Ads mutation
was performed.

The accepted review report is integrated at
`operations/reports/brain-scheduler-google-ads-sync-review-2026-08-30.md`.
The source/deployment identity record for this closeout is:

| Evidence | SHA/state |
| --- | --- |
| `origin/main` before integration | `3465d5aeb8d171f95c6b6e5a7d2fb75671579c38` |
| Review branch before integration | `2577018c4a73188f537c87645bf57767d7f42902` |
| Review commit contained in `origin/main` before this closeout | No |
| Accepted main after report integration and classification change | `1c2ff91ab5c4572c31dfab7539b59485c4861508` |
| Clean `brain-runtime` at live acceptance | `1c2ff91ab5c4572c31dfab7539b59485c4861508` |
| Review branch | Preserved at `origin/codex/google-ads-review-20260830` |

The final report commit is documentation-only; the deployed runtime was
verified at the accepted executable source SHA above.

## Canonical inventory

The typed registry validator passed with all 17 jobs represented. Review
categories are exactly `ACTIVE=4`, `BLOCKED=9`, `NEEDS REVIEW=2`, and
`OBSOLETE=2`:

| Category | Jobs |
| --- | --- |
| ACTIVE (4) | `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `mind-compile-loop` |
| BLOCKED (9) | `stb-pipeline-batch`, `n8n-backup`, `claude-session-cleanup`, `dance-of-life-sync`, `bible-studies-pipeline`, `google-ads-sync`, `gws-token-refresh`, `graphify-nightly`, `ing-bank-statement-download` |
| NEEDS REVIEW (2) | `memory-context-refresh`, `skill-prune` |
| OBSOLETE (2) | `gemini-cleanup`, `video-orchestrator-storage-cleanup` |

The only remaining `NEEDS REVIEW` jobs are `memory-context-refresh` and
`skill-prune`. They were not reviewed or changed by this closeout.

The Ads registry entry deliberately retains `networkAccess=external-write-capable`
and `credentialSensitive=true`. Those are conservative privilege facts about
the broader package, not a claim that the disabled scheduler path is safe.

## Execution-path reconciliation

The audit fields are: exists, automatic, enabled, reachable, blocked, and API
capability. “Reachable” means reachable through an automatic execution path,
not whether a human could invoke a retained script directly.

| Path | Exists | Automatic | Enabled | Reachable | Blocked | API capability |
| --- | --- | --- | --- | --- | --- | --- |
| A. Canonical Brain Scheduler | Yes: typed registry and runner | Yes, through the generic LaunchAgent contract | No for Ads: registry lifecycle is disabled | No for Ads: runner skips disabled jobs | Yes | Exact `sync` path reads Google Ads and writes local SQLite; it does not call Ads mutation services. The broader package remains mutation-capable. |
| B. Legacy `office-nightly-scheduler.sh` | Yes in the installed/shared dirty checkout; current `origin/main` is the thin runner wrapper and has no `run_google_ads_sync` function | Generic LaunchAgent only | No for Ads | No: active main logs `skipping job=google-ads-sync reason=bs0-11-unsafe-quiesced` | Yes | Same retained Ads wrapper capability as the historical path; it is not reached by the active main path. |
| C. Standalone Ads LaunchAgent | No Ads-specific plist found | No | No | No | No independent path exists | None observed. |
| D. cron/at/other local scheduler | No: `crontab -l` and `atq` were empty | No | No | No | No | None observed. |
| E. n8n | Historical Google Ads workflow files exist in the repository; live n8n is up, but no live Google Ads-named workflow was listed | No independent Ads path observed | No | No | Yes: repository artifacts are not live activation | Backup artifacts contain an HTTP approve/apply mutation path, but the live n8n inventory had six active workflows and no Google Ads-named active workflow. |
| F. CI/GitHub | No Google Ads workflow reference found under `.github/workflows` | No | No | No | No | None observed. |
| G. Manual invocation | Yes: retained wrapper/CLI source | No | N/A as automation | Yes, only for an explicit operator invocation | Scheduler block does not prevent direct manual execution | Exact `sync` is external-read/local-write; broader CLI exposes mutation commands. Manual invocation is outside this scheduler closeout and was not performed. |

The generic LaunchAgent is loaded as `com.office.nightly-scheduler`, but
`launchctl` reports `state = not running`; it points to the shared Brain
checkout, whose current dirty legacy source remains untouched. There is no
separate Ads LaunchAgent, no local Ads listener on ports 8001 or 3001, and no
matching Ads process. The n8n check used the read-only official CLI listing
inside the live container; no credential or workflow payload was exported.

## Old monolith and source/deployment identity

The historical shared-checkout monolith still defines
`run_google_ads_sync()` and can construct the historical wrapper command.
Its active main path first validates the typed registry and then logs the
explicit `bs0-11-unsafe-quiesced` skip for `google-ads-sync`; it does not call
that function. The current `origin/main` version of
`tools/scripts/office-nightly-scheduler.sh` is a thin LaunchAgent-compatible
bootstrap into `brain-scheduler-runner.mjs` and contains neither the function
nor the historical skip string.

The installed LaunchAgent plist remains unchanged and still points at the
shared dirty checkout. Core truthfully reports this as a source/deployment
mismatch (`matchesSource=false`) and keeps scheduler health failed. This
closeout does not modify or activate the LaunchAgent, rewrite the installed
plist, or claim that the mismatch is repaired.

The historical/global `03:00 Europe/Lisbon` scheduler contract is preserved
for the inventory. No Ads-specific future schedule was assigned; `google-ads-sync`
remains disabled and not scheduled.

## Minimum replacement / hardening criteria

These are acceptance criteria for future work, not implementation in this
closeout:

- dedicated sync-only entrypoint with no mutation commands reachable;
- read-only external Google Ads boundary and local-derived-write-only output;
- deployment-time dependencies, pinned versions, and no pip installation in a scheduler run;
- bounded timeout and retry policy, with SQLite retention controls;
- secret redaction and no credential persistence;
- no auto-apply, mutation queue writes, campaign/budget/bid/recommendation changes;
- durable receipts and an explicit consumer, value, and schedule justification;
- safe tests proving no production mutation and fail-closed behavior.

## Validation and live acceptance

Passed:

- typed registry validation: 17 jobs, valid schema/invariants;
- typed registry tests: 4 passing, including Ads `BLOCKED`/disabled and exact category totals;
- scheduler runner compatibility tests: 4 passing, including 17-job dry-run and four active spawns;
- focused Brain Core scheduler tests: 3 passing, including Ads status and fail-closed cases;
- `git diff --check` and explicit four-file source staging passed.

The TypeScript compiler was not available in the clean runtime dependency
tree, so a separate `tsc --noEmit` run was unavailable. Native Node type
stripping executed the focused TypeScript Core test successfully; no Core
implementation source changed.

Live Brain Core `GET /infra/scheduler` returned HTTP 200 with:

- manifest path `/Users/Office/Repos/stevewesthoek/brain-runtime/operations/specs/typed-scheduler-jobs.json`;
- valid canonical manifest, 17 jobs, and category totals `4/9/2/2`;
- `google-ads-sync`: `BLOCKED`, `lifecycle=disabled`, `mode=disabled`, `enabled=false`, `status=disabled`, `skippedReason=disabled`;
- `n8n-backup` remained blocked/disabled and video storage cleanup remained obsolete/disabled;
- overall Core scheduler `status=error`, `health=failed` only because the pre-existing LaunchAgent mismatch and missing runtime report remain truthful evidence.

Live Console `http://127.0.0.1:4881/scheduler` returned HTTP 200. The
rendered page contained 17 table rows, category totals `ACTIVE=4`,
`BLOCKED=9`, `NEEDS REVIEW=2`, `OBSOLETE=2`, and a visible Google Ads row with
`BLOCKED`, disabled lifecycle, disabled mode, and the replacement/hardening
human action. No `Run`, `Sync Now`, `Apply Recommendation`, `Change Budget`,
or `Mutate Campaign` control was present.

No Google Ads API call, scheduler activation, LaunchAgent modification,
campaign/budget/bid/recommendation mutation, Ads SQLite write, credential
change, live-scheduler dependency installation, or dirty-checkout change was
performed during this closeout.

Google Ads closeout is complete; the sync remains blocked pending a hardened
read-only replacement.
