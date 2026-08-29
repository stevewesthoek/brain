# Brain Scheduler Current-State Audit

Audit date: 2026-08-29

Scope: read-only inspection of the live launchd definition, the canonical 17-job registry, scheduler runtime evidence, Brain Core, and Brain Console. No jobs were deleted or activated. No launchd reload, kickstart, force-run, production deployment, or runtime mutation was performed.

## Live launchd

The loaded LaunchAgent is present but not running:

| Evidence | Observed value |
| --- | --- |
| Label | `com.office.nightly-scheduler` |
| `launchctl list` | `- 0 com.office.nightly-scheduler` |
| `launchctl print gui/502/...` | `active count = 0`; `state = not running`; last exit code `0`; runs `4` |
| Loaded program | `/bin/zsh -lc /Users/Office/Repos/stevewesthoek/brain/tools/scripts/office-nightly-scheduler.sh` |
| Working directory | `/Users/Office/Repos/stevewesthoek/brain` |
| Calendar | `Minute 0, Hour 3`; `RunAtLoad=true`; Lisbon schedule is represented by the script guard |
| Repository plist | `/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist` |
| Installed plist | `/Users/Office/Library/LaunchAgents/com.office.nightly-scheduler.plist` |
| Installed/source relationship | Installed plist is a symlink to the repository plist; realpaths match |
| Plist SHA-256 | `edee38ed195dfa7cd04078f4f5f13e9f9e9b69ca7c57393ef14e8957461b4998` for both source and installed target |

The plist itself is not the current-main drift. It points to the shared checkout, whose loaded `office-nightly-scheduler.sh` is the old 542-line monolith at shared HEAD `5eca4acf44ca7cb7a0a4a2701b1e9e2cbd30ffe9`. The pushed-main scheduler source at `8abe6ad6c36a3f064e73933e7db7195cd58f1d9a` has a thin 11-line bootstrap that delegates to `brain-scheduler-runner.mjs`. The live target has not been reconciled to that source.

## Execution chain

The actual live chain is:

```text
launchd
  -> shared-checkout tools/scripts/office-nightly-scheduler.sh (old monolith)
  -> hard-coded historical skips and active function calls
  -> legacy .last files and runtime/local/office-scheduler/latest-run.md
```

The old script invokes the typed validator as a validation step, but its dispatch remains hard-coded. It does not reach `brain-scheduler-runner.mjs` or canonical registry-backed dispatch.

The intended pushed-main chain is:

```text
launchd
  -> tools/scripts/office-nightly-scheduler.sh (thin bootstrap)
  -> tools/scripts/brain-scheduler-runner.mjs
  -> operations/specs/typed-scheduler-jobs.json
  -> lifecycle-gated job entrypoints
  -> ~/.local/state/office-scheduler/receipts, history, and report
  -> Brain Core getInfraOfficeScheduler()
  -> /infra/scheduler
  -> Brain Console /scheduler
```

The running Brain Core and Console are from `/Users/Office/Repos/stevewesthoek/brain-console-launcher`, branch `codex/brain-console-launcher`, HEAD `6ad9fedb66a4e06c77d72aa0c0809aec6fd2d3d6`, not from the pushed-main source under review.

## Job totals

The canonical registry in pushed main contains exactly 17 jobs:

| Canonical lifecycle | Count |
| --- | ---: |
| active | 4 |
| manual-only | 0 |
| policy-blocked | 4 |
| disabled | 8 |
| deprecated | 1 |
| Total | 17 |

The human review classification is deliberately separate from canonical lifecycle:

| Human category | Count |
| --- | ---: |
| ACTIVE | 4 |
| BLOCKED | 7 |
| NEEDS REVIEW | 4 |
| OBSOLETE | 2 |
| Total | 17 |

`Runnable now` below means eligible under the canonical registry runner, not proven runnable through the currently loaded live monolith. Only the four canonical active report jobs are eligible; nothing was activated.

## Full 17-job classification

Legacy results are labeled explicitly because the live state has no canonical receipts. A legacy result is historical evidence, not proof of current canonical execution.

| Job | Purpose | Canonical lifecycle | Human category | Schedule | Runnable now | Last result | Risk | Recommendation | Next decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mind-steward-dry-run` | Report-only Mind validation | active | ACTIVE | daily 03:00 Europe/Lisbon | Yes, canonical only | legacy success, exit 0, 3s, 2026-08-29 | Low; no Mind write | Retain report-only; review generated report | Confirm active report acceptance after canonical deployment |
| `local-apps-report` | Read-only local app status | active | ACTIVE | daily 03:00 Europe/Lisbon | Yes, canonical only | legacy success, exit 0, 0s, 2026-06-06; stale | Low; read-only | Retain; refresh only through canonical runner | Confirm fresh receipt after deployment |
| `video-runtime-report` | Read-only video runtime status | active | ACTIVE | daily 03:00 Europe/Lisbon | Yes, canonical only | legacy success, exit 0, 0s, 2026-08-29 | Low; read-only | Retain report-only | Confirm fresh receipt and report visibility |
| `mind-compile-loop` | Report-only Mind proposals | active | ACTIVE | daily 03:00 Europe/Lisbon | Yes, canonical only | legacy success, exit 0, 0s, 2026-08-29 | Low; no Mind write | Retain report-only; review proposals manually | Confirm dependency and receipt behavior |
| `stb-pipeline-batch` | Historical external pipeline batch | disabled | BLOCKED | not scheduled | No | legacy failed, exit 1, 1s, 2026-05-25 | External writes; authority not approved | Keep disabled | Separate external-authority and safety decision |
| `claude-session-cleanup` | Delete old local Claude sessions | disabled | BLOCKED | not scheduled | No | legacy success, exit 0, 1s, 2026-07-14 | Destructive delete; external entrypoint | Never enable in scheduler | Decide whether any manual cleanup remains warranted |
| `dance-of-life-sync` | Historical external media sync | disabled | BLOCKED | not scheduled | No | legacy failed, exit 1, 5s, 2026-07-14 | External rescan/write; source link issue | Keep disabled | Review source, destination, credentials, and idempotency |
| `bible-studies-pipeline` | Mind-related processing pipeline | policy-blocked | BLOCKED | not scheduled | No | legacy failed, exit 1, 1s, 2026-07-13 | Implementation can write Mind | Keep blocked; report-only argument is insufficient | Complete separate Mind write-safety review |
| `gws-token-refresh` | Google Workspace profile probe | policy-blocked | BLOCKED | not scheduled | No | legacy failed, exit 2, 0s, 2026-07-14 | Credential-sensitive; auth failed | Do not invoke from scheduler | Prove ownership and secret-safe authenticated access |
| `graphify-nightly` | Bounded semantic Graphify event gate | policy-blocked | BLOCKED | event-driven only; no daily execution | No | legacy failed, exit 1, 14,696s, 2026-07-14 | Structural nightly generation frozen | Keep daily scheduler blocked | Use event-specific admission only if its gates pass |
| `ing-bank-statement-download` | Financial statement download | policy-blocked | BLOCKED | not scheduled | No | legacy failed, exit 1, 0s, 2026-07-01 | Financial and credential-sensitive external automation | Never enable from scheduler | Use finance runbook with explicit human-approved session |
| `n8n-backup` | Credential-bearing n8n backup | disabled | NEEDS REVIEW | not scheduled | No | legacy success, exit 0, 11s, 2026-07-14 | Decrypted/encrypted credentials; retention and restore unverified | Keep disabled | Verify destination, retention, restore, and rollback |
| `google-ads-sync` | External advertising synchronization | disabled | NEEDS REVIEW | not scheduled | No | legacy failed, exit 1, 0s, 2026-07-14 | External write and OAuth credential risk | Keep disabled | Decide whether a separately approved provider workflow is needed |
| `memory-context-refresh` | Write derived local context | disabled | NEEDS REVIEW | not scheduled | No | legacy success, exit 0, 0s, 2026-07-14 | Derived-memory write scope and freshness | Keep disabled | Review generated-context authority and freshness |
| `skill-prune` | Historical skill maintenance report | disabled | NEEDS REVIEW | not scheduled | No | legacy success, exit 0, 1s, 2026-05-07 | Destructive lifecycle; report entrypoint missing | Do not restore automatic pruning | Decide future report-only ownership and entrypoint |
| `gemini-cleanup` | Retired local Gemini cleanup | deprecated | OBSOLETE | retired | No | legacy success, exit 0, 0s, 2026-07-14 | No canonical entrypoint; local deletion | Retain only for historical reporting; do not delete in this audit | Remove in a future registry revision when history no longer needs it |
| `video-orchestrator-storage-cleanup` | Historical video storage deletion | disabled | OBSOLETE | not scheduled | No | legacy failed, exit 1, 0s, 2026-07-14 | External destructive cleanup could delete canonical artifacts | Keep disabled; never run here | Resolve through the Video Orchestrator procedure, separately |

The table is sorted by human category in the review order: ACTIVE, BLOCKED, NEEDS REVIEW, and OBSOLETE. The two obsolete candidates remain present so historical jobs are not silently deleted.

## Runtime evidence

The bounded live state under `/Users/Office/.local/state/office-scheduler` is not canonical current-main evidence:

- `scheduler-latest.json` reports `skipped` with reason `already-completed-for-lisbon-day`, but its `manifestPath` is `/Users/Office/.config/workbench/brain-scheduler-consolidation/operations/specs/typed-scheduler-jobs.json`, a feature worktree rather than the live shared checkout.
- There is no live `receipts` directory and therefore no canonical receipt for any of the 17 jobs.
- All 17 legacy `.last` files exist. Their bounded status/timestamp values are listed in the table above; they are not canonical receipt evidence.
- `runtime/local/office-scheduler/latest-run.md` is the old report format, generated at `2026-08-29 03:00:08 WEST`, and lists only the old nine-job view.
- The latest `nightly.log` evidence is a start/skip line; it does not prove canonical runner dispatch.
- `last_completed_lisbon_date` is `2026-08-29`.

The live runtime should therefore be classified as mixed legacy/stale state, not as a successful activation of the 17-job canonical runner.

## Brain Console

### Live services

Brain Core at `http://127.0.0.1:4877/infra/scheduler` returned HTTP 200 and `status=ok`, but exposed only 9 legacy jobs with the old fields (`key`, `label`, `planned`, `executed`, `status`, and timing/error fields). It did not expose the canonical `id`, `lifecycle`, `mode`, or human review category. The nine live jobs were:

`stb-pipeline-batch`, `n8n-backup`, `claude-session-cleanup`, `ing-bank-statement-download`, `dance-of-life-sync`, `bible-studies-pipeline`, `gemini-cleanup`, `graphify-nightly`, and `skill-prune`.

The eight canonical jobs missing from live Core/Console data were:

`google-ads-sync`, `gws-token-refresh`, `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `video-orchestrator-storage-cleanup`, `memory-context-refresh`, and `mind-compile-loop`.

The live Console at `http://127.0.0.1:4881/scheduler` returned HTTP 200, but its checked-out component uses the old nine-job Core shape and has no lifecycle/mode/human-category detail contract. Full 17-job visibility is not proven live: **No**.

### Pushed-main source

The pushed-main Core adapter maps every registry job without filtering, and its validated response contains 17 jobs. The Console maps every returned job without filtering and now exposes the human review category in both the table and selected-job detail. Its schema accepts exactly `ACTIVE`, `BLOCKED`, `NEEDS REVIEW`, and `OBSOLETE`, alongside lifecycle, mode, human action, artifacts, and bounded history. Source-level 17-job visibility and human-category visibility are therefore: **Yes, after this review correction; not live until the Core/Console source is deployed and restarted**.

## Activation readiness

1. **Is launchd already using the canonical runner?** No. The loaded target is the old shared-checkout monolith, even though the plist source and installed symlink match.
2. **What bounded activation would be required?** First reconcile the shared checkout or another immutable deployment identity to pushed main `8abe6ad6`; then re-read the exact source/plist relationship and obtain a separately approved launchd reload. Core and Console also need their own source/deployment reconciliation and restart before live visibility can be claimed.
3. **Is changing the plist alone sufficient?** No. The wrapper source, runner, manifest, Core adapter, Console source, deployment identity, and loaded process all matter. The current plist has no content drift to correct; its target code is the drift.
4. **Would a reload be required?** Yes, after source/deployment reconciliation. Changing source files does not reload an already-loaded LaunchAgent.
5. **Could reload cause execution?** Potentially yes because `RunAtLoad=true`. The canonical runner has Lisbon cutoff, duplicate-day, lock, dependency, and lifecycle gates, but those safeguards are not authorization to reload now. No reload or force-run was performed.
6. **Rollback path:** restore the prior approved shared source/deployment identity or revert the corresponding deployment commit, then use a separately approved bounded launchd unload/reload procedure. No rollback was executed.

## Changes made

One narrow metadata/UI correction was required because the pushed-main Console did not explicitly expose the requested human review classification:

- Added required `reviewCategory` metadata to all 17 canonical registry entries and its JSON schema enum.
- Propagated the field through Brain Core types, validation, and `/infra/scheduler` output.
- Added a named Human review column and selected-job detail field in Brain Console.
- Added focused Core assertions for the exact 17-job category contract.
- Added this report.

No runner dispatch behavior, lifecycle, activation state, launchd definition, production state, or historical job files were changed.

## Git

- Review branch: `codex/brain-scheduler-live-review`, based on pushed main `8abe6ad6c36a3f064e73933e7db7195cd58f1d9a`.
- Shared checkout remains on `main` at `5eca4acf44ca7cb7a0a4a2701b1e9e2cbd30ffe9`, behind remote main with its pre-existing dirty paths preserved.
- This report and the narrow correction are isolated to the review worktree. No shared-checkout files were staged, reset, cleaned, or overwritten.
- Commit and push status are recorded in the task handoff after validation. No force-push is permitted or required.

## Next human review order

**A — OBSOLETE candidates:** `gemini-cleanup`, `video-orchestrator-storage-cleanup`. Decide when historical reporting no longer requires them; do not delete as part of this audit.

**B — NEEDS REVIEW:** `n8n-backup`, `google-ads-sync`, `memory-context-refresh`, `skill-prune`. Resolve credential/retention, provider, derived-context, and report-entrypoint questions separately.

**C — BLOCKED:** `stb-pipeline-batch`, `claude-session-cleanup`, `dance-of-life-sync`, `bible-studies-pipeline`, `gws-token-refresh`, `graphify-nightly`, `ing-bank-statement-download`. Keep blocked until their specific authority, safety, policy, event, credential, or financial gates pass.

**D — ACTIVE verification:** `mind-steward-dry-run`, `local-apps-report`, `video-runtime-report`, `mind-compile-loop`. After a separately approved source/deployment reconciliation, verify one bounded canonical run and its receipts/report visibility; do not infer success from legacy `.last` files.
