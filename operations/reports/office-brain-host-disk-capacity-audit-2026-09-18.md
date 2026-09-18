# Office Brain host disk-capacity audit — 2026-09-18

## Status

**READ-ONLY AUDIT COMPLETE.** No files were deleted, moved, pruned, vacuumed,
truncated, restored, or modified outside the documentation commit for this
audit. Agent Mode production remains RC.6 `PRODUCTION_ACTIVE`; the normalized
baseline remains `ROLLBACK_SUPPORTED`.

## Filesystem capacity

The bounded capacity snapshot for `/Users/Office` reported:

- filesystem: `/dev/disk3s5` mounted at `/System/Volumes/Data`;
- total: `926 GiB`;
- used: `830 GiB`;
- free: `42 GiB`;
- utilization: `96%`;
- inode utilization: `2%`.

The percentage crosses the critical threshold below, but absolute free space
remains slightly above the 40 GiB critical floor. This is a high-priority
capacity action item, not evidence of an immediate storage outage.

## Largest bounded consumers

These are size/path summaries only; no private file contents were read.

| Area | Size | Classification |
| --- | ---: | --- |
| `~/Documents` | 39 GiB | unrelated/user data; owner decision |
| `~/.cache/huggingface/hub` | 32 GiB | model cache; rebuildable but owner-dependent |
| `~/Repos/prochattools/clients` | 27 GiB | unrelated project trees; owner decision |
| `~/Repos/prochattools/web` | 12 GiB | unrelated project trees; owner decision |
| `~/Repos/prochattools/saas` | 10 GiB | unrelated project trees; owner decision |
| `~/.local/share/comfyui` | 8.4 GiB | unrelated/local media tooling; owner decision |
| `/private/tmp/brain-*` | 8.4 GiB | temporary Brain test/build/release roots |
| `~/Downloads` | 5.7 GiB | unrelated/user data; owner decision |
| `~/Repos/stevewesthoek` | 18 GiB | active repositories/worktrees; keep unless owner-authorized |
| `~/.local/share/claude` | 1.0 GiB | tool runtime/cache; owner decision |
| `~/.local/brain/runtimes` | 1.9 GiB | Brain tooling runtimes; needs owner review |
| `~/.local/video-orchestrator` | 2.0 GiB | unrelated/local tooling; owner decision |
| `~/.cache/uv` | 2.1 GiB | rebuildable package cache |
| `~/.cache/codex-runtimes` | 1.6 GiB | active tool runtime cache; needs owner review |
| `~/Library/Application Support` | 62 GiB | mixed application data; not safe to bulk-clean |
| `~/Library/Caches` | 11 GiB | mixed application caches; per-app review required |

The bounded `prochattools` submeasurements total at least `50.5 GiB`
(`clients`, `web`, `saas`, `waas`, and `boilerplates`); the root walk was not
expanded into a private-content dump. The Brain repository's measured major
components are approximately `.git` 1.0 GiB, `projects` 949 MiB,
`operations` 96 MiB, and `tools` 53 MiB. These are active repository data and
are not cleanup targets in this goal.

## Brain-specific retention classification

| Path | Size | Classification | Retention decision |
| --- | ---: | --- | --- |
| `/Users/Office/Library/Application Support/Brain/agent-mode-rc6` | 71 MiB | `REQUIRED_ACTIVE` | `KEEP`; current immutable RC.6 runtime |
| `/Users/Office/Library/Application Support/Brain/agent-mode` | 140 MiB | `REQUIRED_ROLLBACK` plus support state | `KEEP`; normalized baseline, descriptors, Store, config, and logs |
| `/Users/Office/Library/Application Support/Brain/agent-mode/releases` | 136 MiB | `REQUIRED_ROLLBACK`/artifact retention | `KEEP`; active and baseline package roots |
| `/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc6-production-activation-20260918-072024` | 752 KiB | `REQUIRED_BACKUP` | `KEEP` through the documented rollback window |
| RC.6 public metadata, manifests, receipts, support/evidence docs | bounded | `REQUIRED_EVIDENCE` | `KEEP`; release verification and support proof |
| `/Users/Office/Repos/stevewesthoek/brain` | approximately 2.1 GiB in measured major paths | `REQUIRED_ACTIVE` | `KEEP`; active repository/worktree |
| `/private/tmp/brain-*` | 8.4 GiB across 90 directories | `TEMPORARY`/`REBUILDABLE` | later review only; no active Core/Console handles found |
| `~/.cache/huggingface/hub` | 32 GiB | `UNKNOWN`/rebuildable model cache | `NEEDS_OWNER_DECISION`; do not remove wholesale |
| `~/.cache/uv` | 2.1 GiB | `REBUILDABLE` | later cache cleanup candidate after process check |
| `~/.cache/codex-runtimes` | 1.6 GiB | `REBUILDABLE` but tool-owned | `NEEDS_OWNER_DECISION` |
| `~/.local/share/comfyui/models` | 6.5 GiB | `UNKNOWN`/rebuildable model assets | `NEEDS_OWNER_DECISION`; preserve active models |

No uncertain path was classified as deletable. Protected Agent Mode assets,
the signing identity, current descriptors, Store, rollback baseline, backup,
release artifacts, and evidence are mandatory retention items.

## Release and backup retention confirmation

The current support record and runbook require a minimum 30-day rollback
window from 2026-09-18 and extension until a successor release has completed
observation, fresh backup, and rollback-compatibility evidence. They also
require longer retention for incidents, uncertainty, contract/schema changes,
or failed successor activation/rollback.

The active RC.6 package, signed manifest, public verification metadata,
verification receipt, baseline package/manifest binding, and pre-activation
backup all exist under application-support paths outside Git and web roots.
No release artifact was rebuilt, re-signed, or removed.

## Temporary/cache review and open-file safety

The Brain-named temporary inventory contained 90 directories and approximately
8.4 GiB. Approximately 0.92 GiB was older than one day at audit time. Large
examples included old RC5 recovery, RC6 isolated install/source, baseline
smoke, normalization-source, and D0 package roots. No open-file results matched
the selected temporary candidates, and active Core/Console processes held only
the RC.6 runtime working directories and production log descriptors in the
Brain paths inspected.

The largest cache/model candidates were:

- `~/.cache/huggingface/hub`: 32 GiB;
- `~/.local/share/comfyui/models`: 6.5 GiB;
- `~/.cache/uv`: 2.1 GiB;
- `~/.cache/codex-runtimes/codex-primary-runtime`: 1.6 GiB;
- `~/Library/Caches/Codex`: 862 MiB.

These are not Agent Mode release assets. Their rebuildability and ownership
vary, so none is safe for unattended deletion.

## Reclaim estimates

These are upper-bound planning estimates, not authorization to delete:

| Scenario | Potential reclaim | Preserves required release/worktree assets | Interpretation |
| --- | ---: | --- | --- |
| Conservative | up to `0.92 GiB` | yes | review only Brain-named temp roots older than one day, after a fresh open-file check |
| Moderate | up to `3.9 GiB` | yes | conservative set plus `~/.cache/uv` and `~/Library/Caches/Codex`, only after owner/process review |
| Aggressive | up to `42.4 GiB` | yes if carefully scoped | adds Hugging Face model cache and ComfyUI model assets; not recommended without explicit owner decisions and model inventory |

The moderate/aggressive figures are intentionally conservative sums of
measured candidate roots and do not assume that every byte is removable.
Hard-link, sparse-file, active-process, and application-specific retention
behavior must be rechecked before any cleanup.

## Capacity thresholds and immediate risk

The maintenance runbook defines:

- **Warning:** `>=85%` used or `<100 GiB` free.
- **Action required:** `>=90%` used or `<75 GiB` free.
- **Critical:** `>=95%` used or `<40 GiB` free.

Current state is **HIGH capacity risk / action required**: it exceeds the
percentage critical trigger at 96%, while 42 GiB free remains just above the
absolute critical floor and inode usage is only 2%.

Near-term risk assessment:

- SQLite WAL growth: LOW for the currently empty Store, but monitor as work
  begins;
- future release staging/build: MODERATE because package/build operations need
  temporary headroom;
- future backup creation: LOW for the current empty Store, higher with data;
- Node/npm and Console builds: MODERATE due temporary and dependency output;
- logs: LOW at current observed Agent Mode log size, but retain rotation policy;
- temporary release staging: MODERATE because old staging roots already consume
  8.4 GiB.

## Safe candidates for a later authorized cleanup

No cleanup occurred. The exact review candidates/actions are:

1. Recheck open handles, age, and retained-copy verification, then review
   `/private/tmp/brain-*` directories older than one day. A later authorized
   cleanup may remove only explicitly approved stale directories, never the
   application-support release vault or production Store.
2. After confirming no active package/build process, review
   `/Users/Office/.cache/uv` and
   `/Users/Office/Library/Caches/Codex` as rebuildable cache candidates.
3. With the owner of local model tooling, inventory unused revisions under
   `/Users/Office/.cache/huggingface/hub` and
   `/Users/Office/.local/share/comfyui/models`; archive or remove only exact
   unused model paths under a separate authorization.
4. Review unrelated Documents, Downloads, ProChat repositories, and local
   media/tooling only with their owners. Brain does not authorize cleanup of
   those paths.

Items that must not be removed: current RC.6 runtime, normalized rollback
baseline, production Store, signing identity, manifests/public metadata,
support and activation/closeout evidence, current service descriptors, active
runtime files, the retained production backup, active repositories/worktrees,
and the four protected unrelated worktree paths.

## Mutation ledger and next task

Production mutations: `0`.

Files deleted: `0`.

No service stop/start, StateStore write, backup/restore, provider/model/AWS,
network, SSH, BrainNode, Workcell, Docker prune, cache prune, Git cleanup, or
publication occurred.

Exact next maintenance task: a separately authorized, path-specific cleanup
review beginning with stale `/private/tmp/brain-*` roots older than one day,
subject to a fresh open-file check and preservation of all RC.6/rollback/
backup/evidence assets. No cleanup is authorized by this audit itself.
