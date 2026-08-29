# Supabase Recovery-Copy Logical Backup

Canonical Phase 3X design for the self-hosted Supabase/PostgreSQL production
VM `vm-supabase`. The implementation is deliberately separate from the retired
live-production `pgdump-upload` path.

## Architecture

```text
Azure VM Backup recovery point
  -> Azure AlternateLocation temporary VM in an isolated private VNet
  -> PostgreSQL crash recovery and PG15 validation
  -> globals plus the exact 27-database sequential logical dumps
  -> local pg_restore --list, SHA-256 manifest, and fidelity checks
  -> existing Azure Blob container through the approved SAS
  -> remote object/name/size verification
  -> exact temporary resource-group cleanup
```

The runner is `tools/scripts/supabase-recovery-copy-backup.sh`. It defaults to
read-only dry-run mode; `--run` is required for temporary Azure resources and
Blob writes. `--scheduled` is reserved for the prepared scheduler artifact.
The scheduler artifact is enabled only after the complete Phase 3X cutover
gate is proven. The current accepted run is `20260829T213246Z`, with remote
prefix `phase3x/20260829T213246Z/`, 30 objects, and 150983181 bytes.

## Safety contract

- Production health is checked before any temporary resource is created.
- No production `pg_dump` or `pg_dumpall` is executed.
- No production database, schema, role, ACL, migration, Supavisor, Docker,
  Traefik, Cloudflare, DNS, or Azure Backup policy is changed.
- Restore mode is explicitly `AlternateLocation`; `ReplaceDisks` and
  `OriginalLocation` are not used.
- The temporary VNet has no peering and denied inbound traffic. Azure Backup
  may attach a generated public IP while materializing the alternate-location
  VM; the runner detaches that IP from the temporary NIC before the private-copy
  gate and then requires no public IP, AzureCloud-only management egress, and
  denied Internet egress. The generated IP remains inside the exact temporary
  resource group and is removed by the final group cleanup.
- The restore resource group name, VM, VNet, NSG, storage account, NIC, and
  disks are unique to the run and are removed only after an exact inventory
  check.
- Blob prefixes are unique per run and must be empty before upload. Every
  object upload uses REST `If-None-Match: *`; the runner never deletes or
  overwrites Blob objects.
- The SAS is read from the approved production host path only for the duration
  of the isolated copy command. It is placed in mode-restricted ephemeral
  files and supplied to curl through config stdin; the Azure Run Command sees
  only script-file paths. It is never placed in process argv, logged, printed,
  committed, or written to runtime state.
- If the approved SAS is ever observed in a process table, scheduler log, or
  other persistent channel, cutover is blocked until the storage owner issues a
  replacement through a working least-privilege credential authority. Do not
  substitute an account key or pass any replacement secret through argv.

## Runtime and idempotency

The runner writes an atomic, ignored receipt at
`runtime/local/infrastructure/backup-runtime-state.json`. It records the
selected recovery point, run ID, Blob prefix, object count/bytes, local
validation, remote verification, temporary cleanup, and production-touch
booleans. Brain Core reads this generated receipt before the older tracked
fallback and fails closed if the generated receipt is malformed.

When a successful receipt already contains the selected recovery-point ID, a
second invocation is a no-op. It creates no temporary VM, backup set, or Blob
prefix and performs no overwrite.

## Manual validation

```bash
tools/scripts/supabase-recovery-copy-backup.sh --dry-run
tools/scripts/supabase-recovery-copy-backup.sh --run
```

The real run is accepted only when the production/Azure preflight, isolated
restore, PG15 checks, exact 27/27 dump and `pg_restore --list` validation,
manifest/checksum, remote verification, and exact cleanup all pass. A remote
Content-MD5 omission is reported as `PARTIAL` cryptographic verification, not
silently promoted to full cryptographic proof.

The recurring schedule is `05:30` Europe/Lisbon, after the normal Azure VM
Backup window. The LaunchAgent is
`com.office.supabase-recovery-copy-backup`, targets the preserved Phase 3X
feature worktree, has `TimeOut=14400`, and keeps `RunAtLoad=false`. Its live
installation and enabled state are verified separately with:

```bash
launchctl print gui/$(id -u)/com.office.supabase-recovery-copy-backup
launchctl print-disabled gui/$(id -u) | grep com.office.supabase-recovery-copy-backup
```

The receipt is
`runtime/local/infrastructure/backup-runtime-state.json`; failures write a
`FAILED` receipt and the runner performs exact temporary-resource cleanup.
The job has no retry and does not trigger an immediate catch-up. To disable
the recurring job, use `launchctl disable` and unload the named LaunchAgent;
never invoke the runner manually as a scheduler test. Production `pg_dump`
remains prohibited.

`pgdump-upload.timer` remains disabled and inactive until a separately
authorized legacy-retirement phase.
