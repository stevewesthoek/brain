# Brain Scheduler Google Ads Sync Review — 2026-08-30

## Scope and safety boundary

This is a read-only review of the single Brain Scheduler NEEDS REVIEW job
google-ads-sync. The review did not call the Google Ads API, run a sync,
mutate campaigns, budgets, bids, keywords, or recommendations, approve or
reject a mutation, export or rotate credentials, modify the Ads SQLite
database, activate the scheduler, change the LaunchAgent, install
dependencies, or modify the registry.

The review used an isolated worktree at the accepted source SHA
3465d5aeb8d171f95c6b6e5a7d2fb75671579c38, which equals origin/main at review
time. The shared Brain checkout remains on
codex/cloudflare-tooling-normalization at
e7f807642ec76fef7536e4a057b02713464dc7f with 79 pre-existing dirty entries;
it was not changed. The clean brain-runtime checkout remains detached at the
accepted SHA and was inspected only through read-only checks.

No Google Ads secret values were read or displayed. Credential conclusions
below are based on source, configuration metadata, and historical status
artifacts only.

## Executive disposition

Final disposition: BLOCKED — REPLACE / HARDEN.

Keep google-ads-sync disabled and do not activate it from Brain Scheduler.
The exact command behind the entrypoint performs external Google Ads reads and
writes derived data locally; it does not invoke the API mutation methods on
that path. However, the implementation cannot safely feed the current Core
consumer:

- the CLI writes to top-level config/data/report paths while the committed
  state and Core adapter use operations/google-ads;
- the wrapper installs an unpinned Python environment at execution time;
- API client construction silently falls back to synthetic mock data, after
  which sync can write that data as if it were a successful sync;
- the documented ADC credential precedence is not implemented by the CLI
  client path;
- the local state is stale and the Core consumer currently returns
  status=error with require is not defined;
- the same package and credential model contain independently callable live
  mutation paths.

This is not classified OBSOLETE because the current Core route and the
documented Brain Console Analytics mapping establish a real intended
consumer. It is not an Active Candidate because the source-to-deployment,
freshness, dependency, identity, and fail-closed gates are not met.

## 1. Source, registry, and deployment identity

The canonical registry entry is operations/specs/typed-scheduler-jobs.json:12:

- id: google-ads-sync
- entrypoint: tools/scripts/google-ads-sync-schedule.sh
- lifecycle: disabled
- mode: disabled
- scheduleType: disabled
- schedule: not scheduled
- authority: external-review-required
- networkAccess: external-write-capable
- credentialSensitive: true
- destructive: false
- timeoutSeconds: 600
- retries: 0
- idempotency: once-per-lisbon-day
- reviewCategory: NEEDS REVIEW
- evidenceState: repository-configured
- externalActivation: unknown

The scheduler itself is recorded as macOS launchd label
com.office.nightly-scheduler, daily at 03:00 Europe/Lisbon with RunAtLoad
guarding. The registry and scheduler runbook were not changed in this review.

The source/deployment identity is split. The live Core scheduler response
reported a valid 17-job manifest at
/Users/Office/Repos/stevewesthoek/brain-runtime/operations/specs/typed-scheduler-jobs.json,
while the installed LaunchAgent points at
/Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh.
The latter is the shared dirty checkout, not the clean accepted runtime
checkout. launchctl reported the installed scheduler as state=not running at
the time of inspection. This review did not repair or activate that mismatch.

Evidence: operations/specs/typed-scheduler-jobs.json:4,12;
operations/system-configs/launchagents/com.office.nightly-scheduler.plist:8-29;
tools/scripts/office-nightly-scheduler.sh:4-12;
tools/scripts/brain-scheduler-runner.mjs:297-337.

## 2. Exact execution chain

The intended chain is:

1. macOS launchd invokes the installed LaunchAgent.
2. The LaunchAgent invokes tools/scripts/office-nightly-scheduler.sh.
3. That thin bootstrap execs Node with
   tools/scripts/brain-scheduler-runner.mjs.
4. The runner loads and validates the typed registry.
5. For google-ads-sync, statusForLifecycle sees lifecycle=disabled.
6. The runner writes a disabled receipt and continues without calling runChild.
7. Therefore the current disabled job does not reach its shell entrypoint.
8. If a future registry revision made it runnable, the entrypoint would invoke
   tools/google-ads/run.sh sync.
9. run.sh would create or reuse tools/google-ads/.venv, install dependencies
   when absent, and invoke tools/google-ads/cli.py sync.

The current scheduler behavior is therefore safe with respect to this job:
the disabled lifecycle gate precedes dependency checks and child spawning.
That does not make the underlying entrypoint safe to activate.

Evidence: tools/scripts/brain-scheduler-runner.mjs:268-337;
tools/scripts/office-nightly-scheduler.sh:10-12;
tools/scripts/google-ads-sync-schedule.sh:1-20;
tools/google-ads/run.sh:1-23.

## 3. Exact sync behavior and external mutation analysis

The implementation of cli.py sync is not a placeholder despite the stale
parser help text. cmd_sync does the following:

1. Collects doctor state and checks the six required Google Ads variables.
2. If variables appear missing, records a local blocked run and exits 2.
3. Loads credential values from the shell environment or the local env file.
4. Constructs GoogleAdsAPI.
5. Calls test_connectivity.
6. Reads campaigns, today's aggregate metrics, seven days of search terms,
   and pending recommendations.
7. Writes campaign, daily metric, search-term, recommendation, change-event,
   and run records to SQLite.

On the exact sync path, api.py uses GoogleAdsService search/search_stream
operations for the connectivity check and four reads. It does not call
CampaignCriterionService.mutate_campaign_criteria or
RecommendationService.apply_recommendation. cmd_sync also does not call the
notifications module, queue recommendation mutations, run apply, run
batch-apply, invoke rollback, or invoke the HTTP callback server.

The exact sync-path verdict is:

| Surface | Result | Assessment |
| --- | --- | --- |
| Google Ads API reads | YES | Connectivity, campaign, metric, search-term, and recommendation queries. |
| Google Ads API mutations | NO on cmd_sync | No mutate service is reached by this command. |
| Local SQLite writes | YES | Schema creation, run logging, upserts, append-only records, and change events. |
| External notifications | NO on cmd_sync | Notification functions exist elsewhere but are not called here. |
| Runtime package/network writes | YES on first wrapper use | run.sh creates a venv and installs packages during execution. |
| Credential access | YES | Shell environment and local env values are read; values were not inspected in this review. |
| Broader package mutation capability | YES | Separate CLI and callback paths can perform live Ads mutations. |

The broader package must not be confused with the exact sync command. The
same API client exposes live negative-keyword and recommendation mutation
methods. cli.py also has apply and batch-apply commands, guarded only by the
explicit --live flag and a mock-mode check. That check does not prove account,
customer, scope, or operator identity. The HTTP callback server exposes POST
approve, reject, status, and apply; its apply handler runs
tools/google-ads/run.sh apply --id <id> --live. These are separate automation
and mutation surfaces that make the package-level registry label
external-write-capable understandable, but they are not executed by
google-ads-sync.

The most serious sync-specific fail-closed defect is api.py's constructor:
any client-library load/configuration exception sets use_mock=true. Mock
connectivity returns true and the mock fetch methods return sample campaigns,
metrics, search terms, and recommendations. cmd_sync then persists those
values and records a successful run. A scheduler must fail closed on missing,
invalid, or unavailable API access; it must never turn an API setup failure
into successful-looking business data.

Evidence: tools/google-ads/cli.py:412-639, 2480-2493, 2700-2851;
tools/google-ads/api.py:176-225, 227-540, 542-705;
tools/google-ads/http_server.py:65-244.

## 4. Local state, data handling, and consumers

The committed canonical database is
operations/google-ads/data/google_ads.sqlite3. Metadata-only, read-only
inspection found:

| Item | Observation |
| --- | --- |
| File size | 102,400 bytes |
| Review-time SHA-256 | 25e014be5cdb15e0449e4b7773a26491747769e1dfca46d1f2eacf3a9afb67cf |
| Tables | campaigns, change_events, daily_metrics_detail, metrics_snapshots, mutation_analysis, mutation_rollbacks, negative_keywords, pending_mutations, policy_snapshots, recommendations, runs, search_terms |
| runs | 28 total; 4 sync ok, 7 sync error, 1 sync blocked |
| Current pending mutations | 1 pending, 1 approved, 1 applied, 1 rejected |
| Latest sync run | 2026-04-13T02:17:45+00:00 |
| Latest daily metrics | metrics_date=2026-04-13 |
| Latest search-term fetch | 2026-04-13 |
| Latest recommendation record | 2026-04-13T02:17:45+00:00 |
| Latest policy snapshot | 2026-04-11T10:39:13+00:00 |
| Sync completion events | 1, latest 2026-04-13T02:17:45+00:00 |

The file mtime was 2026-08-30, but its business timestamps remain from April;
mtime is not freshness evidence. The latest meaningful sync is more than four
months old, approximately 139 days at review date. The review reopened the
database read-only and the before/after SHA-256 remained unchanged.

The CLI path constants resolve to top-level config/google-ads,
data/google-ads, and reports/google-ads. The current repository stores the
corresponding committed assets under operations/google-ads/config,
operations/google-ads/data, and operations/google-ads/reports. The scheduler
wrapper would therefore write to a different database and report directory
than the canonical Core consumer. The HTTP callback server and dashboard
server repeat the top-level data/google-ads assumption.

The current Core consumer is projects/brain-core/src/adapters/infra-google-ads.ts.
It opens the operations/google-ads database with better-sqlite3 in readonly
mode and reads daily_metrics_detail and pending_mutations. It also queries a
sync_log table for lastSync, but the CLI schema has runs and no sync_log table.
Consequently, even after the path is corrected, lastSync would remain null
unless the producer/consumer contract is reconciled.

Brain Core exposes this adapter through GET /infra/google-ads, and its
contract tests explicitly reject POST. The decision log maps Google Ads to
the Brain Console Analytics tab at /infra/google-ads. The scheduler page
itself is a registry view; it is not the Ads metrics consumer.

Other local consumers are the manual CLI commands pace, status, health,
report, analytics, mutation review, and rollback analysis. They inherit the
same top-level path constants and are therefore not reliable consumers of
the committed operations/google-ads database without hardening.

Evidence: tools/google-ads/cli.py:71-78,152-288,542-627;
tools/google-ads/http_server.py:28-50;
tools/google-ads/dashboard-server.js:28-50;
projects/brain-core/src/adapters/infra-google-ads.ts:19-109;
projects/brain-core/src/api/routes.ts:2450-2452;
projects/brain-core/src/tests/infra-endpoints.test.ts:283-313;
operations/decision-log.md:411-435.

## 5. Credential model and identity

The documented account boundary is:

- approved Google account: steve@yeshua.academy
- canonical gcloud configuration: google-ads-nonprofit
- nonprofit Ad Grants operating mode

The six required runtime variable names are:

- GOOGLE_ADS_DEVELOPER_TOKEN
- GOOGLE_ADS_LOGIN_CUSTOMER_ID
- GOOGLE_ADS_CUSTOMER_ID
- GOOGLE_ADS_OAUTH_CLIENT_ID
- GOOGLE_ADS_OAUTH_CLIENT_SECRET
- GOOGLE_ADS_REFRESH_TOKEN

The intended local-only locations are
~/.config/google-ads/brain-google-ads.env for account/runtime values and
~/.config/gcloud/application_default_credentials.json for ADC OAuth state.
No values were read.

The documentation says shell variables override ADC OAuth values, with local
env fallback. The actual cmd_sync and get_api_client path loads all six values
from shell environment or brain-google-ads.env. It checks ADC presence for
doctor metadata but does not use ADC to populate the API client in this path.
That is a source/documentation identity mismatch.

The LaunchAgent provides a PATH but does not source the local env file. The
CLI can read that file itself, but launchd does not establish the documented
gcloud configuration or prove the account boundary. No authenticated
credential probe was run in this review. The repository account metadata says
credential statuses are present_local_only, while the last historical status
report recorded the API credential readiness as blocked with missing required
values. Current readiness is therefore unknown, not confirmed.

Credential risk is HIGH potential, not tested live: the same credential
construction is used by an API client with external mutation methods, and the
code does not enforce a read-only scope or a separate mutation identity. A
future read collector must prove the canonical account and read-only authority
without performing a mutation.

Evidence: tools/google-ads/cli.py:81-134,347-378,412-457;
tools/google-ads/docs/AUTHENTICATION.md:12-84;
tools/google-ads/docs/ACCOUNTS.md:3-14,70-78;
operations/google-ads/config/account.toml:1-18;
operations/google-ads/reports/2026-04-11-status.md:1-17.

## 6. Dependency bootstrap and runtime reproducibility

tools/google-ads/run.sh creates tools/google-ads/.venv when absent, runs
python3 -m venv, upgrades pip/setuptools/wheel, and installs
tools/google-ads/requirements.txt before invoking the CLI. This is a
scheduler-time network and repository-adjacent mutation. It is not a
deployment-managed runtime.

requirements.txt uses version ranges rather than a resolved lock or hashes:
setuptools<70, protobuf>=4.21.0,<5.0.0, grpcio>=1.50.0,<2.0.0, and
google-ads>=19.0.0,<21.0.0. It does not establish a Python version contract,
dependency artifact provenance, or an offline scheduler execution guarantee.
The isolated review worktree did not acquire a .venv.

Required hardening is a prebuilt, deployment-managed environment with pinned
and hash-checked dependencies, validated before deployment. The scheduled
process should never install packages, and dependency or API-library failure
must produce a blocked/error receipt rather than mock business data.

Evidence: tools/google-ads/run.sh:6-23; tools/google-ads/requirements.txt:1-4;
tools/google-ads/api.py:1-28,176-225.

## 7. Independent automation and callback paths

The following paths were found by read-only source and process inspection:

| Path | Current evidence | Risk or conclusion |
| --- | --- | --- |
| Canonical Brain Scheduler | Registry entry is disabled; runner skips it before child spawn. | No current sync execution through the canonical lifecycle. |
| Generic nightly LaunchAgent | Installed plist points at the shared dirty Brain checkout; launchctl reported not running. | Source/deployment identity is not cleanly aligned; no change made. |
| Ads-specific LaunchAgent | No Ads-specific LaunchAgent was found in the configured repository or installed LaunchAgents inventory. | No separate launchd sync schedule evidenced. |
| Manual report wrapper | tools/scripts/run-google-ads-report.sh calls cli.py report. | Manual path; inherits path and DB issues. |
| Manual policy watcher | tools/scripts/run-google-ads-policy-watch.sh calls cli.py policy-watch. | External HTTP reads plus local policy-state writes; not the scheduled sync. |
| Supervisor HTTP callback | Configuration exists with autostart=true for localhost:8001, but supervisorctl was unavailable and no listener/process was observed. | If installed separately, POST /apply can invoke live mutation; activation is not proven. |
| Mutation dashboard | dashboard-server.js/.ts exposes local mutation listing, approval, rejection, and preview endpoints; default DB path is also top-level data/google-ads. | Independent local mutation-lifecycle surface; not a sync scheduler. |
| n8n workflow artifacts | Three checked-in backups cover compliance, auto-approve, and escalation flows; they contain HTTP approve/apply/reject nodes. | Backup artifacts are not proof of imported or active workflows; no activation was attempted. |
| Other scheduled sync callers | No additional checked-in Google Ads sync scheduler caller was found. | externalActivation remains unknown, not proven absent globally. |

The callback server is especially important to keep separate from sync review:
its /apply handler executes the CLI with --live, while the exact sync command
does not call it. No HTTP POST or mutation endpoint was invoked.

Evidence: operations/system-configs/supervisor/google-ads-http-server.conf:1-12;
tools/google-ads/http_server.py:167-213;
tools/google-ads/dashboard-server.js:57-357;
tools/scripts/run-google-ads-report.sh:1-5;
tools/scripts/run-google-ads-policy-watch.sh:1-5;
operations/backups/n8n-workflows/google-ads-auto-approve-workflow.json;
operations/backups/n8n-workflows/google-ads-compliance-gatekeeper.json;
operations/backups/n8n-workflows/google-ads-escalation-workflow.json.

## 8. Value, freshness, and schedule justification

There is credible value in a read-only Ads data feed:

- the Google Ads Core adapter is explicitly designed to surface current
  pacing/budget and mutation counts;
- the Brain Console product decision maps Google Ads to Analytics;
- the local CLI has pacing, reporting, policy-awareness, and historical
  mutation-analysis consumers;
- the Ad Grants configuration defines a monthly target and pacing bands.

That value is not currently realized. The committed database has no sync
completion newer than 2026-04-13, and the live Core route is currently
unhealthy. The database contains historical rows, but the path that the
scheduled CLI would use is not the path Core reads.

The 03:00 Europe/Lisbon schedule is a global Brain Scheduler convention.
The Google Ads runbook documents a daily operator sequence of doctor,
policy-watch, pace, and report, plus weekly policy review and monthly budget
review. It does not establish a business or provider requirement that an Ads
API sync must run at 03:00. There is also no repository evidence defining
data-finality, freshness SLA, alerting, or acceptable lag for the current
consumer.

Recommendation: do not preserve or activate 03:00 for Ads until the consumer
contract defines required freshness, the provider-read timing is justified,
and the collector produces a verifiable lastSync. A future read collector
could run daily, but the cadence should follow the freshness need and
provider data availability rather than inherit the global time by default.

## 9. Registry accuracy

No registry change is made in this review.

The classification is partially accurate but conflates the exact entrypoint
with the broader package:

| Registry field | Assessment |
| --- | --- |
| lifecycle=disabled / reviewCategory=NEEDS REVIEW | Accurate and should remain. |
| credentialSensitive=true | Accurate. |
| externalActivation=unknown | Accurate; no live activation was proven. |
| destructive=false | Accurate for the exact sync path; separate mutation commands are a different capability. |
| networkAccess=external-write-capable | Too broad for exact cmd_sync, which performs external reads and local-derived writes; accurate as a package-level warning because the same package exposes live mutation and callback paths. |
| evidenceState=repository-configured | Only partial operational evidence; the live Core consumer is broken and the data is stale. |

For a future typed capability model, the exact read collector should be
represented with external read scope, local-derived write scope, and a
separate privilege/identity contract. Mutation commands should remain
separate, manually or approval-gated capabilities with independent evidence.

## 10. Options

### Option 1 — Retain the historical disabled entry only

Keep the current registry state and make no implementation investment.
This minimizes immediate risk but leaves a misleading, stale, broken path and
does not serve the Core consumer. It is acceptable only as a temporary
quiescent state, not as a completed disposition.

### Option 2 — Harden as a manual read-only collector

Correct the operations/google-ads paths, reconcile runs versus sync_log,
remove mock-success behavior, use a deployment-managed pinned environment,
add idempotency and retention for search terms/recommendations, and expose a
read-only report/health contract. Keep it manual until a real authenticated
read-only proof and current Core acceptance receipt exist.

This is the recommended near-term path because it preserves the demonstrated
Analytics value without granting the scheduler mutation authority.

### Option 3 — Replace with a separately admitted scheduled read collector

Build or adopt a dedicated provider-read capability with explicit account
identity, read-only credential scope, deployment provenance, locked
dependencies, freshness/alerting, bounded local storage, and a Core
consumer-compatible schema. Re-admit it only as an Active Candidate after
source/deployment identity and live read-only acceptance are proven.

This is the appropriate long-term path if daily automated pacing is still
required. It is not authorized by this review.

### Option 4 — Treat the current package as a provider mutation workflow

Keep all mutation commands outside Brain Scheduler and operate them through a
separately reviewed provider workflow with explicit approvals. This matches
the current registry warning but does not solve the read-only Core feed.

## 11. Required gates before any re-admission

No activation or registry reclassification should occur until all of the
following are evidenced:

1. One exact source SHA, clean deployment checkout, and runtime/LaunchAgent
   identity match.
2. Correct canonical operations/google-ads paths across producer, Core
   adapter, HTTP server, dashboard, and reports.
3. A reconciled producer/consumer schema with a real lastSync field,
   idempotent daily ingestion, and bounded retention for search terms and
   recommendations.
4. A deployment-managed pinned Python environment with no scheduler-time
   installs.
5. Fail-closed behavior for missing, invalid, expired, or unavailable API
   dependencies; mock data must never be persisted by an operational sync.
6. Secret-safe proof of the approved account boundary and an explicitly
   read-only provider capability. Mutation authority must be separated from
   the read collector.
7. A current live Core GET /infra/google-ads acceptance response containing
   real lastSync and metrics, plus a Console-visible consumer check.
8. A documented freshness SLA, schedule rationale, failure alert, timeout,
   retry policy, and operator owner.
9. A dry-run/canary evidence packet showing no campaign, budget, bid,
   keyword, recommendation, queue, or credential mutation.

## 12. Decision card

| Field | Decision |
| --- | --- |
| Job | google-ads-sync |
| Disposition | BLOCKED — REPLACE / HARDEN |
| Keep disabled | YES |
| Registry change in this review | NO |
| Exact cmd_sync Ads mutation verdict | NO |
| Broader package mutation capability | YES |
| Credential risk | HIGH potential; live authorization not tested |
| Current data freshness | STALE; latest sync 2026-04-13 |
| Current Core consumer | Present but broken at live check |
| Current Console visibility | Scheduler row visible as disabled / NEEDS REVIEW |
| Schedule preserved | NO activation or schedule change authorized |
| Recommended next step | Manual read-only hardening, then separately gate any scheduled replacement |

## 13. Live Core and Console visibility

Read-only local HTTP checks on 2026-08-30 returned:

- GET http://127.0.0.1:4877/infra/scheduler: HTTP 200. The response reported
  a valid 17-job manifest and the Google Ads row as
  lifecycle=disabled, mode=disabled, schedule=not scheduled,
  reviewCategory=NEEDS REVIEW, and skippedReason=disabled. Overall scheduler
  health was failed because launch/latest-run evidence was not healthy.
- GET http://127.0.0.1:4877/infra/google-ads: HTTP 200. The response
  reported status=error and error=require is not defined, with no usable
  Ads metrics. This is a Core adapter/runtime defect, not evidence of a
  successful Ads read.
- GET http://127.0.0.1:4881/scheduler: HTTP 200. The loaded Brain Console
  DOM visibly showed Google Ads Sync with not scheduled, disabled,
  NEEDS REVIEW, disabled mode, and the human action
  Keep disabled; use a separately approved provider workflow if this
  integration is needed. No scheduler activation, mutation, or Ads control
  was exposed.

The Console page also showed 17 jobs, lock=free, and report=missing. The
browser check was limited to the local scheduler page and was read-only.

## 14. Safety and Git closeout

Safety result:

- Google Ads API calls: none.
- Ads sync execution: none.
- External Ads mutations: none.
- Credential values: not read or displayed.
- Credential export/rotation: none.
- Local Ads database writes: none.
- Scheduler or LaunchAgent activation: none.
- Registry reclassification: none.
- Shared dirty checkout: preserved.
- Clean runtime checkout: preserved.
- Review worktree venv: absent after review.
- Database SHA-256: unchanged across read-only inspection.

The report is the only intended source change on the dedicated branch
codex/google-ads-review-20260830. No merge is included.

Google Ads scheduler review is complete; no Ads sync, mutation, credential change, or scheduler activation was performed.
