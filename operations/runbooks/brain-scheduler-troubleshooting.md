# Brain Scheduler — Troubleshooting Matrix

Use this read-only matrix with the [canonical runbook](brain-scheduler.md).
Preserve evidence before any approved repair. Do not force-run, kickstart,
reload, enable a blocked job, or delete a lock as a first diagnostic step.

| Symptom | Check | Meaning / bounded action |
|---|---|---|
| Core returns `status=error` | Registry path, validator, source/runtime identity | Treat scheduler health as failed; repair the typed contract or deployment identity before any run. |
| Core returns `health=warning` | Overall receipt, report path, per-job receipts | Missing/stale evidence is not success; inspect paths and use an isolated dry-run. |
| Core reports a held lock | Lock owner and timestamp; do not remove it automatically | A run may still be active. Preserve evidence and use an explicitly approved bounded lock repair only after confirming ownership. |
| Core reports a stale lock | Lock metadata, launchd state, latest receipt | Health failure; identify the interrupted owner before any removal. |
| Completion date is malformed/future | `last_completed_lisbon_date` and latest receipt | Runner must fail closed before children. Repair state explicitly; never bypass with `FORCE_RUN` as a fix. |
| Active job has no expected file | Per-job receipt, declared `outputArtifacts`, captured stdout | Receipt and artifact contracts are separate. A stdout-only job can succeed with no artifact. |
| Blocked/obsolete job appears in history | Lifecycle and receipt `startedAt` | It must not have started. Investigate runner/registry drift; do not enable it from the scheduler. |
| Console differs from Core | Query `/infra/scheduler`, then inspect Console schema/source | Core is the read-only adapter authority; Console must not invent inventory or controls. |
| Launch target differs from source | Installed plist realpath, arguments, working directory, runtime SHA | Source/deployment mismatch; reconcile the detached runtime under a separately approved launchd change. |
| Natural run proof is requested | Accepted receipt `trigger=launchd`, timestamp, `dryRun=false` | Do not substitute manual invocation, kickstart, reload, or `FORCE_RUN`. |

For a proposed change, use the [future change checklist](brain-scheduler-change-checklist.md).
