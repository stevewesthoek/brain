# AWS Lightsail Backup Evidence — 2026-08-30

## Scope

This is a read-only evidence capture for the canonical production hosts
`dokploy-aws` and `cloudpanel-aws` in AWS Lightsail region `eu-west-2`. The
checks queried instance metadata and automatic-snapshot history only. No
snapshot was created or deleted, no restore was requested, and no AWS backup
configuration was changed.

Evidence capture time: `2026-08-30T10:49:44Z`.

## Provider evidence

Both instances were `running` and both reported the Lightsail `AutoSnapshot`
add-on as `Enabled` with provider schedule `03:00`. Each instance has exactly
one attached disk, its system disk; no separate attached data disk was
reported.

| Host | System disk | Successful automatic snapshots | Observed completion times | Binding |
| --- | ---: | ---: | --- | --- |
| `dokploy-aws` | 320 GiB `/dev/sda1` | 7 | 2026-08-24 through 2026-08-30 at 04:44:16–04:44:17 +01:00 | queried with resource `dokploy-aws` |
| `cloudpanel-aws` | 160 GiB `/dev/sda1` | 7 | 2026-08-24 through 2026-08-30 at 04:36:14–04:36:15 +01:00 | queried with resource `cloudpanel-aws` |

Every returned automatic-snapshot record for both resources had status
`Success`. The provider response reported `fromAttachedDisks: []`; the
instance metadata independently reported no non-system attached disks. The
host-side persistence inventory is therefore covered by the system disk:
Dokploy's Docker/containerd and application data paths are on `/`, and
CloudPanel reported only its root disk.

Lightsail automatic snapshots retain the seven most recent snapshots. The
observed seven-day sequence is fresh through the capture date. This proves
provider-level system-disk protection and current successful artifacts; it
does not prove application-consistent database capture or an isolated restore.

## Classification

- `DOKPLOY_BACKUP_CLASSIFICATION`: `PROVEN_PROTECTED`
- `CLOUDPANEL_BACKUP_CLASSIFICATION`: `PROVEN_PROTECTED`
- `RESTOREABILITY`: `PARTIAL` — the documented snapshot-restore procedure and
  prior Dokploy logical restore evidence exist, but no restore from these
  current automatic snapshots was executed in this read-only capture.

AWS Backup, DLM, and S3 inventory calls remain IAM-unverified in this account;
that limitation does not negate the directly observed Lightsail automatic
snapshot artifacts above, and no absence claim is made for those services.
