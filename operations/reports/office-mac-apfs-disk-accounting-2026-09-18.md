# Office Mac APFS Disk Accounting and Safe Reclaim Investigation

Date: 2026-09-18  
Scope: read-only APFS/disk accounting and safe reclaim investigation on the Office Mac  
Repository: `/Users/Office/Repos/stevewesthoek/brain`

## Status

Complete. No destructive filesystem action was taken in this investigation.

The current storage state is reconciled at the volume/container level. The
historical difference between the earlier approximately 31 GiB free reading
and the current approximately 82 GiB free reading is not attributable to one
specific cause from the available read-only evidence. APFS purgeable state,
snapshot retention, delayed block release, and normal concurrent disk activity
are all possible contributors. No current tens-of-gigabytes deleted-open file
was found.

## Starting state

- Repository HEAD: `76e9b5e5 ops(mac): reclaim stale Hugging Face cache`
- Protected unrelated worktree paths were preserved:
  - `operations/accounts/credentials-index.md` (user modification)
  - `tools/firecrawl/logs/firecrawl.log` (user modification)
  - `operations/specs/mindcontrol-product-roadmap.md` (untracked)
  - `operations/specs/nevermind-release-pipeline-roadmap.md` (untracked)
- No repository files were modified before this report.

The first Phase 0 volume reading recorded:

| Surface | Total | Used | Free | Capacity |
| --- | ---: | ---: | ---: | ---: |
| `/System/Volumes/Data` | 926 GiB | 785 GiB | 87 GiB | 91% |

The reading varied during the investigation, which is itself relevant to the
accounting result. APFS usage was not static while the checks were running.

## Final disk accounting

Final readings at report time:

| Surface | Total | Used | Free | Capacity |
| --- | ---: | ---: | ---: | ---: |
| `/System/Volumes/Data` | 926 GiB | 789 GiB | 82 GiB | 91% |
| APFS container `disk3` | 994.7 GB | 906.6 GB in volumes | 88.0 GB unallocated | 91.1% volume use |

The Data volume and APFS container readings are consistent after converting
decimal GB and binary GiB. The several-GiB movement between the initial and
final readings means the machine was not a static accounting sample.

The separate OrbStack mounted filesystem was not treated as ordinary Data
volume content. Its observed accounting was approximately 102 GiB total,
19 GiB used, and 83 GiB free; it is not an immediate reclaim candidate.

## APFS snapshots

Snapshot inventory was read with `diskutil` and `tmutil`:

- Data volume: one Arq snapshot.
  - Name: `com_haystacksoftware_arqagent_49C029AC-B99B-4CA3-A94D-3649B3A5C705_1`
  - Purgeable: `Yes`
  - It limits the minimum APFS container size.
- System volume: three Apple update snapshots.
  - Purgeable: `No`
  - Two report that they limit the minimum APFS container size.
- Time Machine: no destination configured; `BackupNotRunning`.
- Arq Agent and Arq Monitor are active.

`diskutil` did not provide a reliable per-snapshot byte size in the inspected
output. Snapshot reclaim is therefore reported as **unknown**, not as zero.
The Arq snapshot is an active-backup-chain item and was not deleted. Apple
update snapshots were also left untouched.

## Deleted-open files

`lsof +L1` was used to inspect unlinked files still held open.

- Brain Core PID `72595`: no material deleted-open file.
- Brain Console PID `75201`: no material deleted-open file.
- The largest unrelated unlinked file observed was approximately 182 MB in a
  temporary WhatsApp framework. This is not a material explanation for the
  historical tens-of-gigabytes difference and was not acted upon.

No process restart was performed.

## Trash

The current terminal session cannot enumerate `/Users/Office/.Trash` because
macOS privacy controls return `Operation not permitted` even for size
measurement. Trash total is therefore **unknown/not measurable** from this
session.

The previous bounded cache cleanup moved approximately 0.89 GiB of rebuildable
caches and approximately 0.919 GiB of old Brain temporary roots to Trash. The
exact items cannot currently be positively distinguished from the rest of the
user Trash under this privacy boundary.

- Cleanup-generated Trash: **unknown/not enumerable**
- Permanently deleted from Trash in this investigation: **0 GiB**

No Trash item was permanently deleted.

## Purgeable space and reclaim candidates

The Arq Data-volume snapshot is explicitly purgeable, but its owner is active
Arq backup software. It is not a safe generic deletion target. No reliable
aggregate purgeable-byte estimate was exposed by the read-only APFS commands
used here.

The bounded file scan found two large ordinary model files:

- Hugging Face Stable Audio model: approximately 9.2 GB
- ComfyUI SDXL base checkpoint: approximately 6.9 GB

Neither was sparse, and neither was deleted because ownership/retention intent
was not established by this investigation. They are owner decisions, not safe
automatic reclaim targets.

## Clone/shared-block and sparse-file findings

The inspected large files and known high-volume directories did not show a
material logical-versus-allocated discrepancy indicating a large sparse-file
reclaim opportunity. The Hugging Face cache and ComfyUI model storage were
approximately fully allocated relative to their logical sizes.

No reliable per-file APFS clone/shared-block attribution was available from the
bounded standard tools. No clone estimate is claimed. A directory-level `du`
number must not be interpreted as independently reclaimable APFS blocks when
clone sharing is unknown.

## Brain health after investigation

No Brain service, StateStore, snapshot, or runtime mutation was performed.

- Brain Core and Brain Console remained launchd-owned RC.6 processes.
- Health routes continued to return HTTP 200, including status, Agent Mode
  observer/console, scheduler status, and `/agents`.
- Canonical Agent Mode StateStore schema remained version 10.
- SQLite `PRAGMA integrity_check` returned `ok`.
- SQLite foreign-key check returned no violations.
- Brain Core and Console had no material deleted-open handles.

## Safe next decisions

1. If additional reclaim is needed, inspect Trash in Finder or a terminal with
   explicit Full Disk Access and identify the exact cleanup-generated items
   before any permanent deletion.
2. Ask the Arq owner/operator to verify backup-chain health and retention before
   considering any snapshot action. Do not delete the active Arq snapshot as a
   generic cleanup step.
3. Decide explicitly whether the Stable Audio and SDXL model files are still
   needed before removing either through its owning tool or documented cache
   policy.
4. Keep Apple update snapshots under macOS ownership unless a later, separate
   maintenance procedure establishes they are stale and removable.

## Exact next task

No further automatic cleanup is authorized by this investigation. The next
task is an owner decision: either grant a separately scoped Trash review with
Full Disk Access, or approve an explicitly named model/cache removal. No
production Brain change is required.

