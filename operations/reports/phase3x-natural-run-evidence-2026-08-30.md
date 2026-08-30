# Phase 3X Natural Run Evidence — 2026-08-30

## Scope

This is a read-only closeout reconciliation of the first scheduled Phase 3X
run. No Phase 3X command was invoked manually, no new backup was created, and
no production database, Azure Backup policy, credential, scheduler, or
service was changed by this evidence capture.

Evidence capture time: `2026-08-30T11:34:06Z`.

## Scheduler execution

The installed LaunchAgent
`com.office.supabase-recovery-copy-backup` is enabled, has the `05:30` calendar
interval, is not running, reports `runs = 1`, and reports `last exit code = 0`.
Its log contains the scheduled execution and the following preflight/result
evidence:

- Production preflight passed: JPV `1/1`, Proofly HTTP `200`, Supabase
  PostgreSQL 15 readiness passed, legacy timer disabled/inactive, and no
  competing backup processes.
- Azure preflight passed with recovery point
  `8016713176182211506` at `2026-08-30T03:04:51.387746+00:00` and
  `active_jobs=0`.
- Blob preflight passed against the prior Phase 3V prefix.
- Scheduled run `20260830T043005Z` reported `BACKUP_RESULT=PASS`, with
  `dumps=27`, `validations=27`, `objects=30`, and `bytes=151018087`.

The generated receipt at
`/Users/Office/.config/workbench/phase3x-supabase-recovery-copy-automation/runtime/local/infrastructure/backup-runtime-state.json`
records:

| Field | Value |
| --- | --- |
| Status | `SUCCESS` |
| State | `HEALTHY` |
| Last attempt | `2026-08-30T04:30:17Z` |
| Last success | `2026-08-30T04:45:57Z` |
| Run ID | `20260830T043005Z` |
| Recovery point | `8016713176182211506` |
| Blob prefix | `phase3x/20260830T043005Z/` |
| Object count | `30` |
| Total bytes | `151018087` |
| Local validation | `PASS` |
| Remote verification | `PARTIAL` |
| Temporary resources cleaned | `true` |
| Production logical dump used | `false` |
| Production touched | `false` |

`PARTIAL` is retained exactly as reported: the remote object/name/size
verification completed, but remote cryptographic verification was partial
because Content-MD5 was unavailable. It is not converted to `PASS`.

## Source-precedence reconciliation

Before this closeout, Brain Core read the launcher’s tracked
`backup-runtime-state.v1.json`, whose Supabase entry reflected the retired
`pgdump-upload.service` failure (`Tenant or user not found`, last attempted
`2026-08-26T02:20:00Z`). That service remains failed, while its timer is
intentionally disabled and inactive. The stale failure therefore explained
the prior current `FAILED/CRITICAL` presentation; it did not contradict the
successful Phase 3X receipt.

The canonical launcher state now records the authoritative Phase 3X receipt
as current `HEALTHY`, preserves the retired failure as historical context in
the reason, and retains the explicit `PARTIAL` remote-verification boundary.
Brain Core’s bounded receipt parser gives a generated Phase 3X receipt
precedence over the tracked fallback and fails closed when a generated
receipt is malformed. Brain Console’s contract now carries the receipt
metadata without changing the backup execution path.
