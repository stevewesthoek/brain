# Office Mac Hugging Face cache cleanup — 2026-09-18

## Status

**PASS — bounded owner-authorized HF cleanup completed; further deletion
stopped at the accounting-safety gate.**

This was a separate maintenance tranche after the completed Genieo audit. It
did not stop or restart Brain, modify launchd, touch the Agent Mode StateStore,
alter release/rollback/backup artifacts, or touch ComfyUI, browser profiles,
personal files, Codex runtimes, or Brain runtimes.

## Starting repository and Phase 0 health

- Starting repository HEAD: `4c5e2c3e ops(mac): verify Genieo finding and
  bounded cleanup`.
- Core PID: `72595`.
- Console PID: `75201`.
- Both services were launchd-owned and running from the immutable RC.6 package
  root:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Core `/status`, `/agent-mode/observer`, `/agent-mode/console`, and
  `/scheduler/status`: HTTP 200.
- Console `/agents`: HTTP 200.
- StateStore schema: `10`.
- SQLite integrity: `ok`; foreign-key check: clean.
- Initial filesystem snapshot: `926 GiB` total, `841 GiB` used, `31 GiB`
  free, `97%` used.
- Rollback baseline was present:
  `brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`.
- Production backup was present at
  `/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc6-production-activation-20260918-072024`.

## Hugging Face inventory

Cache root:
`/Users/Office/.cache/huggingface/hub`

Initial size: approximately `32 GiB` by filesystem usage. The official
Hugging Face CLI (`hf` version `1.16.1`) reported 15 repository entries and 16
revision entries before cleanup. After cleanup the cache is approximately
`25 GiB`, with 12 repository and 12 revision entries.

The official metadata scan supplied repository size, revision, ref, last-access
and last-modified data. No model weights or private token files were read.

| Repository | Key revision / refs | Size before | Access evidence | Classification / action |
| --- | --- | ---: | --- | --- |
| `stabilityai/stable-audio-3-medium` | `71a346358b5c4c6ecb30cef5a31b6237946480d4`, `main` | 10.4G | 3 weeks ago | KEEP_RECENT; explicit Stable Audio workflow |
| `stabilityai/stable-audio-3-small-music` | `0fef1392cd842149a2b6d445e181c97608faac06`, `main` | 3.5G | 3 weeks ago | KEEP_RECENT; explicit Stable Audio workflow |
| `stabilityai/stable-audio-3-small-sfx` | `ae12755283df9d62ca39a9b050a39a0b607b8c20`, `main` | 3.5G | 3 weeks ago | KEEP_RECENT; explicit Stable Audio workflow |
| `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16` | `a6eb4f68e4b056f1215157bb696209bc82a6db48`, `main` | 4.5G | 3 months ago | OWNER_DECISION_REQUIRED; retained MLX target of an exact alias |
| `Qwen/Qwen3-TTS-12Hz-1.7B-Base` | exact symlink to the MLX repo above | 0B exclusive | 3 months ago | OWNER_DECISION_REQUIRED; alias retained, no payload duplicate |
| `mlx-community/whisper-large-v3-mlx` | `49e6aa286ad60c14352c404340ded53710378a11`, `main` | 3.1G | 5 months ago | KEEP_ACTIVE; explicit Bible Studies/MLX Whisper dependency |
| `mlx-community/whisper-large-v3-turbo` | `a4aaeec0636e6f84abdcbe3544cb2bf7e9f6fb` | 1.6G | 3 weeks ago | KEEP_RECENT |
| `openai/whisper-base` | `e37978b90ca9030d5170a5c07aadb050351a65bb`, `main` | 294.8M | 3 weeks ago | KEEP_RECENT |
| `Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed` | `be5190f2349594ec941753efc90a4ca5641af174`, `main` | 218.3K | 3 months ago | OWNER_DECISION_REQUIRED; historical/retired MTPLX surface |
| `Youssofal/Qwen3.6-35B-A3B-MTPLX-Optimized-Speed` | `f02bdf7908b6120a48a137e6a08d50f076a94101`, `main` | 145.6K | 3 months ago | OWNER_DECISION_REQUIRED; historical/retired MTPLX surface |
| `Youssofal/Qwen3.6-35B-A3B-MTPLX-Optimized-Balance` | `59d30340bb031b11259fb94009b4027ade66a654`, `main` | 27.6K | 3 months ago | OWNER_DECISION_REQUIRED; historical/retired MTPLX surface |
| `google/gemma-4-12b-it` | `5926caa4ec0cac5cbfadaf4077420520de1d5205`, `main` | 4.4K | 3 months ago | OWNER_DECISION_REQUIRED |
| `mlx-community/gemma-4-12B-it-bf16` | no material snapshot | 4.0K | 3 months ago | OWNER_DECISION_REQUIRED |

The following exact entries were safe to redownload, had no open handles, and
had no exact active workflow references:

- `openai/whisper-large`, revision
  `4ef9b41f0d4fe232daafdb5f76bb1dd8b23e01d7`: **deleted**, official tool
  reported `6.2G` freed.
- `mlx-community/whisper-base-mlx`, revision
  `a8f14b616d37f94a159016b04f80a7f7003a1b8f`: **deleted**.
- `mlx-community/whisper-small-mlx`, revision
  `eb52dbc58f50f19eb8c87b54b7c621633c67b7e0`: **deleted**.
- `mlx-community/whisper-tiny`, revision
  `54773fb11b9b7640b1a2ce4f8b55b2ce44239589`: **deleted**.

The three smaller MLX deletions freed `699.5M` according to the official
tool. The combined direct repository cleanup was therefore `6.2G + 699.5M`.

## Active-use and dependency checks

### Active process use

- `lsof +D ~/.cache/huggingface/hub` showed no model handles after each cleanup
  group.
- No running `mlx_whisper`, Stable Audio, ComfyUI, Hugging Face, Transformers,
  or model-server process was found after cleanup. The bounded process check
  did find unrelated Python services and FluidVoice, but none referenced this
  cache root.
- No model repository was open by Core or Console. Their `lsof` checks showed
  no Hugging Face paths.

No process was killed or interrupted.

### Production Brain dependency

The RC.6 runtime configuration contains no Hugging Face cache path or model
reference. Core and Console had no open HF files. Agent Mode production was
therefore ruled out as a dependency of the deleted repositories.

The active large-v3 transcription dependency was preserved because the Brain
repository, Bible Studies pipeline, and runtime roadmap explicitly identify
`mlx-community/whisper-large-v3-mlx` as the consumed model. The repository
does not imply that the production Agent Mode service loads it.

### ComfyUI dependency

No ComfyUI process was active. The ComfyUI installation uses its own
`~/.local/share/comfyui/models` path and its bounded blueprint references point
to separate Comfy-Org model repositories, not any deleted repository. ComfyUI
models, outputs, workflows, custom nodes, and its environment were not
modified.

## Duplicate and detached snapshot review

`mlx-community/whisper-large-v3-mlx` initially had two snapshots:

- retained `49e6aa286ad60c14352c404340ded53710378a11` with `main`;
- detached `06cacdcc84198b112b7c83224f816c6c7aa4a4a9` with no refs.

The official `hf cache prune --dry-run` identified only `240` bytes of
reclaimable detached data. The official prune removed that snapshot and its
exclusive blob, saving `240.0` bytes. The apparent Qwen TTS duplicate is an
exact symlink to the retained MLX repository, not a second payload; the
official repository removal correctly refused to recurse through it, and the
alias was preserved.

No random blobs or snapshot directories were manually removed.

## Previous cleanup Trash

The earlier Genieo tranche moved approximately `0.89 GiB` of exact
rebuildable caches to Trash, and the earlier Brain cleanup moved approximately
`0.919 GiB` of exact temporary roots to Trash. Under the current macOS privacy
boundary, the Trash contents could not be enumerated sufficiently to
positively identify those exact entries among all user Trash. No permanent
Trash deletion was performed; previous cleanup permanently reclaimed **0 GiB
confirmed**.

The user's entire Trash was not emptied.

## Capacity accounting

- Initial: `926 GiB` total, `841 GiB` used, `31 GiB` free, `97%` used.
- HF cache filesystem usage: approximately `32 GiB` before, `25 GiB` after.
- Official HF deletion accounting: `6.2G + 699.5M + 240B` (approximately
  `6.9G` in tool-reported units).
- Final global filesystem snapshot: `926 GiB` total, `841 GiB` used, `31 GiB`
  free, `97%` used.

The HF cache itself shrank as expected, but global APFS free-space reporting
did not improve measurably during this window. This is treated as an accounting
and/or concurrent-system-usage discrepancy. The cleanup stopped at that hard
gate; no additional model or user-data deletion was attempted to chase the
capacity thresholds.

Threshold status: still **CRITICAL** and below the minimum `40 GiB` free
target. The preferred `50 GiB` and operational `75 GiB` targets were not
claimed.

## Retained largest consumers

- Hugging Face cache: approximately `25 GiB`.
- ComfyUI: approximately `8.4 GiB`; untouched.
- Codex runtime cache: approximately `1.6 GiB`; untouched.
- Brain runtime cache: approximately `1.9 GiB`; untouched.
- Brain Agent Mode install/state area: approximately `140 MiB`; untouched.

## Brain health after cleanup

- Core remained PID `72595`, launchd-owned, RC.6 root, no restart.
- Console remained PID `75201`, launchd-owned, RC.6 root, no restart.
- All required health/read routes remained HTTP 200.
- StateStore schema remained `10`.
- SQLite integrity remained `ok`; foreign-key check remained clean.
- Rollback baseline remained present.
- Production backup remained present.
- No Brain, provider, model, AWS, SSH, Tailscale, ComfyUI, or runtime-cache
  mutation occurred.

## Evidence/commit scope

Only this report is intended for the repository commit. Protected unrelated
worktree paths were not staged or modified:

- `tools/firecrawl/logs/firecrawl.log`
- `operations/specs/mindcontrol-product-roadmap.md`
- `operations/specs/nevermind-release-pipeline-roadmap.md`
- `operations/accounts/credentials-index.md`

Exact next recommended maintenance action: owner decision on the retained
Qwen TTS alias and recently accessed Whisper assets, followed by a separate
APFS/global disk-usage accounting check before any further deletion. Do not
start ComfyUI or Codex/Brain runtime cleanup automatically.
