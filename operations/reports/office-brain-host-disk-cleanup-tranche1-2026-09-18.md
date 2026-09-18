# Office Brain host disk cleanup — tranche 1 — 2026-09-18

## Status

**Complete.** This bounded cleanup reclaimed `1,875,939,438` bytes (`1.747
GiB`) using recoverable Trash moves and a supported uv cache-prune command. No
Brain production runtime, Agent Mode StateStore, release asset, worktree, or
protected unrelated path was modified. The disk remains above the percentage
critical threshold and below the absolute-free-space critical floor, so a
separate owner-reviewed tranche is still required before treating capacity as
healthy.

## Reconciliation and scope

The requested audit baseline was `abd6856f`. At execution start the repository
was at later valid commit `f4d6368b` (`chore: retire Workbench public
hostname`); that later commit only touched the unrelated Cloudflare runbook and
was preserved. The pre-existing worktree changes were preserved. No Agent Mode
roadmap or release-status change was made.

The cleanup was limited to:

1. stale `/private/tmp/brain-*` roots older than 24 hours, after open-file and
   production-reference checks; and
2. two exact GoogleUpdater CRX cache blobs identified by Mole as rebuildable,
   after confirming no active GoogleUpdater process and no open handles.

The following were intentionally not touched: the current RC6 runtime root,
the baseline runtime root, releases, backups, StateStore/WAL/SHM files,
signing material, descriptors, support metadata, logs, worktrees, model
assets, Codex's active cache, Puppeteer, Hugging Face, ComfyUI assets, browser
profiles, and the protected unrelated worktree paths.

## Pre/post capacity

The fresh pre-delete snapshot at `2026-09-18T08:48:30Z` was:

| Snapshot | Filesystem | Total | Used | Free | Utilization | Inodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Before cleanup | `/dev/disk3s5` | 926 GiB | 834 GiB | 36 GiB | 96% | 3% |
| After cleanup | `/dev/disk3s5` | 926 GiB | 835 GiB | 37 GiB | 96% | 3% |

The apparent used/free rounding is macOS `df` output; the exact reclaimed byte
count is recorded below. The maintenance thresholds remain: warning at
`>=85%` or `<100 GiB` free, action required at `>=90%` or `<75 GiB` free, and
critical at `>=95%` or `<40 GiB` free. The final state therefore remains a
critical/high-capacity-risk state despite the successful bounded reclaim.

## Production Brain health and integrity

Before and after cleanup:

- Brain Core PID remained `57428`.
- Brain Console PID remained `57784`.
- `GET /status` returned `200`.
- `GET /agent-mode/observer` returned `200`.
- `GET /agent-mode/console` returned `200`.
- `GET /scheduler/status` returned `200`.
- Brain Console `/agents` returned `200`.
- canonical Agent Mode SQLite `PRAGMA integrity_check` returned `ok`.
- the production service remained read-only/fixture mode; no stop, restart, or
  launchd mutation was performed.
- RC6 and baseline roots remained present, including the RC6 releases and the
  baseline backup/recovery metadata.

The canonical Store checked was:

`/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`

## Mole review

Mole was detected at `/opt/homebrew/bin/mole` and
`/opt/homebrew/bin/Mole`, version `1.54.0`. Its dry run was invoked as:

`mole clean --dry-run --debug`

The dry run reported broad categories and timed out/cancelled before completing
its scan (`15.13GB` potential, `725` items, exit `124`). It also includes broad
application-support and developer-cache patterns, so destructive `mole clean`
was explicitly **not** run. Mole reclaimed `0` bytes. The two GoogleUpdater
CRX blobs removed below were selected individually from its review output; no
Mole bulk operation was used. OrbStack daemon-managed data was also left
untouched.

## Stale Brain temporary roots

The inventory found 62 old, non-open candidates totaling approximately
`986,849,280` bytes. One root with live-test provenance was conservatively
excluded:

`/private/tmp/brain-h0-c-live-oVasvx`

The 61 exact roots below were moved to Trash with exact-path arguments. The
recorded reclaim was `986,832,896` bytes (`0.919 GiB`). No wildcard or broad
temporary-directory deletion was used.

```text
/private/tmp/brain-core-i7-9-qI6hGy
/private/tmp/brain-d0-d-bad-1789497461639-94bf2210ed2518
/private/tmp/brain-core-script-approval-JPWECA
/private/tmp/brain-d0-d-bad-1789497091389-9a222f02739f68
/private/tmp/brain-core-i7-9-rxnxgL
/private/tmp/brain-core-i7-9-NIyZRq
/private/tmp/brain-core-script-approval-XWd3xe
/private/tmp/brain-core-i7-9-AlYl9l
/private/tmp/brain-d0-d-bad-1789497504996-3cb48fbd062a68
/private/tmp/brain-core-i7-9-Dng5YP
/private/tmp/brain-d0-b-cli-src-enGFHo
/private/tmp/brain-core-i7-9-qoac4Y
/private/tmp/brain-core-i7-9-jWBeAy
/private/tmp/brain-core-script-approval-JOE1LS
/private/tmp/brain-core-script-approval-bilc1A
/private/tmp/brain-d0-c-real-package-buo0kg
/private/tmp/brain-d0-c-real-package-sfrgop
/private/tmp/brain-d0-d-bad-1789497490663-5543db7dfe4f1
/private/tmp/brain-d0-d-darwin-1789497033504-a96cebcad428e8
/private/tmp/brain-core-script-approval-EM3mJW
/private/tmp/brain-agent-mode-k5-a-vZPO9P
/private/tmp/brain-core-i7-9-0YkPLp
/private/tmp/brain-d0-c-real-package-WbGcPb
/private/tmp/brain-d0-c-real-package-jNaTEx
/private/tmp/brain-core-i7-9-CJSZEN
/private/tmp/brain-core-i7-9-OfxiH1
/private/tmp/brain-d0-d-bad-1789497033513-fbd7599ad9d7c8
/private/tmp/brain-core-i7-9-jmbg0m
/private/tmp/brain-agent-mode-k5-a-6tsfnX
/private/tmp/brain-core-i7-9-rl2cLu
/private/tmp/brain-agent-mode-k5-a-concurrent-xqrO8K
/private/tmp/brain-d0-d-bad-1789497543945-e2170fb36f3278
/private/tmp/brain-d0-c-real-package-tLtC6j
/private/tmp/brain-d0-d-cli-package-TS8jSB
/private/tmp/brain-core-i7-9-bNNOwK
/private/tmp/brain-core-i7-9-SXorgZ
/private/tmp/brain-core-i7-9-TVabLl
/private/tmp/brain-d0-d-bad-1789497159916-ccec7f4b4b742
/private/tmp/brain-d0-b-cli-home-v5nqMY
/private/tmp/brain-d0-c-smoke-package-SnJPMh
/private/tmp/brain-d0-c-real-package-ndH8Te
/private/tmp/brain-d0-d-package-1789497490657-b27c628758c05
/private/tmp/brain-agent-mode-k5-a-5CToKV
/private/tmp/brain-core-script-approval-QGSJ7U
/private/tmp/brain-d0-d-bad-1789496935473-69f6ec5fdea6f
/private/tmp/brain-d0-d-bad-1789497873996-484238f1a1e008
/private/tmp/brain-core-i7-9-Mgmt6e
/private/tmp/brain-core-i7-9-rwUwGy
/private/tmp/brain-k0-4-observer-read-pJV7ae
/private/tmp/brain-console-u0f-next.3P4Xii
/private/tmp/brain-core-agent-orchestrator-48591
/private/tmp/brain-core-i7-9-AUfeBa
/private/tmp/brain-k3-4-observer-workcell-x82Uk7
/private/tmp/brain-d0-c-real-package-pCLvxL
/private/tmp/brain-core-i7-9-GWkpv9
/private/tmp/brain-agent-mode-k5-a-28BcNr
/private/tmp/brain-d0-d-cli-install-rKmuUR
/private/tmp/brain-core-i7-9-W6xEnq
/private/tmp/brain-k0-4-observer-recovery-xY86k6
/private/tmp/brain-agent-mode-k5-a-3NesCT
/private/tmp/brain-core-i7-9-BMlBuQ
```

## uv cache

No active uv process or cache handle was present. The supported command was
run offline:

`/opt/homebrew/bin/uv cache prune --offline --no-progress`

It reported `No unused entries found`. Cache bytes remained
`2,256,527,360`; reclaimed bytes: `0`.

## Selective rebuildable cache

Mole identified the following exact GoogleUpdater CRX cache blobs as
rebuildable. They had no open handles and no active GoogleUpdater process:

```text
/Users/Office/Library/Application Support/Google/GoogleUpdater/crx_cache/07d3f64a3e085e828546109961809dd426f2acc730f2e3d7bed46c33ab56c059  137,931,864 bytes
/Users/Office/Library/Application Support/Google/GoogleUpdater/crx_cache/3e2b7bc8a91ec8418d90e14e0130b9caf5c24b577cec119d90b194064b7f0924  751,174,678 bytes
```

Only those two exact files were moved to Trash, reclaiming `889,106,542`
bytes (`0.828 GiB`). The small `metadata.json` file was retained. No browser
profile or broad Google Application Support directory was cleaned.

## Total and remaining candidates

| Source | Reclaimed |
| --- | ---: |
| stale Brain temp roots | `986,832,896` bytes (`0.919 GiB`) |
| uv cache prune | `0` bytes |
| exact GoogleUpdater CRX cache blobs | `889,106,542` bytes (`0.828 GiB`) |
| **total** | **`1,875,939,438` bytes (`1.747 GiB`)** |

Remaining large candidates were not authorized for this tranche:

- Hugging Face model cache: approximately `32 GiB`; owner decision required.
- ComfyUI model assets: approximately `6.5 GiB`; preserve active models.
- Codex cache: approximately `862 MiB`; active Codex handles were observed.
- Puppeteer cache: approximately `550 MiB`; retained for developer tooling.
- codex-runtimes: approximately `1.6 GiB`; tool-owned and owner review needed.

The excluded live-test temporary root also remains present. No further cleanup
was performed after the 1 GiB minimum target was met.

## Side-effect and protection audit

Counts for this read/cleanup tranche:

- Brain Core/Console stop or restart: `0`.
- AgentRuntime calls: `0`.
- Harness launches: `0`.
- Model/provider/AWS/network calls: `0`.
- BrainNode commands: `0`.
- Workcell operations: `0`.
- StateStore, budget, task, agent, scheduler, or approval mutations: `0`.
- protected unrelated paths modified/staged: `0`.

The only filesystem mutations were the exact recoverable moves listed in this
report. No production Brain file was a cleanup target.

## Next action

Stop after tranche 1. Before any additional deletion, obtain explicit owner
decisions for model assets, Codex/tool caches, and the excluded live-test root,
then perform a fresh capacity/open-handle/reference audit. Do not run bulk
Mole cleanup or remove Hugging Face/ComfyUI assets without that review.
