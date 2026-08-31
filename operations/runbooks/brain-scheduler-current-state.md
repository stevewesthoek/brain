# Brain Scheduler — Current Production State

**Status:** accepted and operational
**Last verified:** 2026-08-31
**Current source/runtime/main SHA:** `720cbd1ed858a5eb03a4329d2993efb3615b0284`

This is the concise current-state authority for the live Brain Scheduler. The
operator procedure, typed contract, historical evidence, lessons, and future
change gate are linked below. Dated reports remain historical evidence and are
not rewritten when the live state changes.

## Read next

- [Canonical runbook](brain-scheduler.md)
- [Typed job registry](../specs/typed-scheduler-jobs.json)
- [Troubleshooting matrix](brain-scheduler-troubleshooting.md)
- [Future change checklist](brain-scheduler-change-checklist.md)
- [Lessons learned](brain-scheduler-lessons-learned.md)
- [Historical report index](brain-scheduler-report-index.md)

## Identity and launch contract

| Field | Current truth |
|---|---|
| Display name | Brain Scheduler |
| LaunchAgent label | `com.office.nightly-scheduler` |
| Launch mechanism | macOS `launchd` LaunchAgent |
| Production runner | `tools/scripts/brain-scheduler-runner.mjs` |
| Deployed runtime | `/Users/Office/Repos/stevewesthoek/brain-runtime` |
| Installed plist | `~/Library/LaunchAgents/com.office.nightly-scheduler.plist`, symlinked to the runtime plist |
| Working directory | `/Users/Office/Repos/stevewesthoek/brain-runtime` |
| Schedule | Daily at `03:00` in `Europe/Lisbon` |
| `RunAtLoad` | `false` |
| State | `~/.local/state/office-scheduler/` |
| Logs | `~/Library/Logs/office-scheduler/` |
| Latest report | `runtime/local/office-scheduler/latest-run.md` |
| Core read surface | `GET http://127.0.0.1:4877/infra/scheduler` |
| Console read surface | `/scheduler`, backed by Brain Core |

The repository registry, not launchd, proves the intended job contract. The
detached runtime and Core source/deployment identity were reconciled before
acceptance. Repository state alone must never be treated as proof of live
activation.

## Canonical inventory

The registry contains **16 jobs**:

| Review category | Count | Job IDs |
|---|---:|---|
| `ACTIVE` | 4 | `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `mind-compile-loop` |
| `BLOCKED` | 10 | `stb-pipeline-batch`, `n8n-backup`, `claude-session-cleanup`, `dance-of-life-sync`, `bible-studies-pipeline`, `google-ads-sync`, `gws-token-refresh`, `memory-context-refresh`, `graphify-nightly`, `ing-bank-statement-download` |
| `NEEDS REVIEW` | 0 | none |
| `OBSOLETE` | 2 | `gemini-cleanup`, `video-orchestrator-storage-cleanup` |

Only the four `ACTIVE` jobs can reach child execution. They are all local,
read-only report surfaces. No blocked, disabled, deprecated, obsolete,
credential-sensitive, destructive, external-write-capable, or Mind-mutating
job is automatically enabled by this scheduler.

## Ownership and evidence

| Concern | Authority / owner |
|---|---|
| Inventory and safety metadata | `operations/specs/typed-scheduler-jobs.json` and its schema |
| Runtime admission, timing, lock, receipts, and history | `tools/scripts/brain-scheduler-runner.mjs` |
| Overall receipt | `~/.local/state/office-scheduler/scheduler-latest.json` |
| Per-job receipts | `~/.local/state/office-scheduler/receipts/<job-id>.json` |
| Generated job artifacts | Each job's declared `outputArtifacts`; these are distinct from receipts |
| Bounded history | `~/.local/state/office-scheduler/history.jsonl` |
| Read-only API | Brain Core `GET /infra/scheduler` |
| Read-only UI | Brain Console `/scheduler`; it has no run, force-run, enable, or mutation control |
| Historical evidence | Dated files listed in [the report index](brain-scheduler-report-index.md) |
| Compatibility report renderer | `tools/scripts/render-office-scheduler-report.sh`; explicit report rendering only, not LaunchAgent authority |
| Legacy compatibility | `tools/scripts/office-nightly-scheduler.sh`; retained for reference/rollback and not the installed LaunchAgent target |

The `mind-compile-loop` job intentionally declares no output artifact. Its
stdout is captured in the scheduler-owned receipt; the receipt is not a job
artifact. A missing artifact declaration is therefore not evidence of a
failed job.

## Accepted natural run

The first natural 03:00 run was accepted on 2026-08-31:

- trigger: natural launchd calendar event, not manual and not dry-run;
- executed SHA: `981780540981c15e02095044a5b74bcd5ccd3fe0`;
- result: overall success; all four Active jobs succeeded;
- containment: blocked/obsolete jobs started `0` processes;
- state: valid completion date `2026-08-31`, released lock, no orphan child;
- provenance: `dryRun=false`, `trigger=launchd`, canonical registry, no temporary-worktree provenance;
- safety: no `FORCE_RUN`, kickstart, manual rerun, scheduler reload, or Mind mutation.

The source/runtime/main SHA is now `720cbd1e...` because the later
`mind-compile-loop` receipt-contract correction was documentation/metadata
only and did not require a scheduler rerun. See the [historical acceptance
report](../reports/brain-scheduler-first-natural-run-acceptance-2026-08-31.md)
and the [historical report index](brain-scheduler-report-index.md) for the
evidence chain.

## Scheduler boundaries

- Brain Core is the read-only observability adapter; it does not own the
  inventory, execute jobs, or silently repair state.
- Brain Console is a read-only consumer of Core; it is not an independent
  scheduler authority.
- `memory-context-refresh` is disabled and must not be treated as an automatic
  startup-context generator. If the derived file is absent or stale, use the
  documented memory procedure or `mem-search`.
- Graphify's retained registry entry is policy-blocked/event-driven; the daily
  scheduler does not run structural Graphify or a model-backed parallel path.
- NotebookLM, ING, n8n backup, skill pruning, and other historical job paths are
  not hidden scheduler lanes. Their current status is defined by the registry.

For any future modification, use the [change checklist](brain-scheduler-change-checklist.md)
and obtain a separately approved deployment step before touching launchd.
