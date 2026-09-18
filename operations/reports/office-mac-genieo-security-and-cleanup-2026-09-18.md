# Office Mac Genieo verification and bounded cleanup — 2026-09-18

## Status

**PASS — Genieo not independently verified; bounded safe cleanup completed.**

This audit began only after the Brain RC.6 service-recovery health gate passed.
No Brain launchd descriptor, release, StateStore, provider, model, AWS, SSH,
Tailscale, BrainNode, or Workcell state was changed by this goal.

## Starting state and Brain health gate

- Repository starting HEAD: `fb01a4ad docs(brain): clarify RC6 recovery effects`.
- Recovery evidence: `operations/reports/office-brain-service-recovery-2026-09-18.md`.
- Brain Core: launchd-owned PID `72595`, RC.6 runtime root.
- Brain Console: launchd-owned PID `75201`, RC.6 runtime root.
- `GET /status`, `/agent-mode/observer`, `/agent-mode/console`, and
  `/scheduler/status`: HTTP 200.
- Console `/agents`: HTTP 200.
- Canonical Store schema: `10`.
- SQLite integrity: `ok`; foreign-key check: clean.
- Initial capacity snapshot for this audit: approximately `926 GiB` total,
  `838 GiB` used, `35 GiB` free, `96%` used. Capacity fluctuated during the
  audit; it is not treated as a precise cleanup accounting source.

## Genieo finding

CleanMyMac was present and running from the Setapp installation, but its
accessible support records and logs contained no Genieo reference. No
machine-readable CleanMyMac report identifying a Genieo path was available.
The CleanMyMac label is therefore **uncorroborated**.

The independent bounded audit found:

- no Genieo-named files in user/system launch agents or daemons;
- no Genieo launchd entry, process, open-file handle, login item, background
  task, profile, package receipt, or Spotlight filename match;
- no Genieo references in bounded Chrome, Dia, Firefox, or Safari metadata;
- no managed-browser policy match;
- no Genieo quarantine event or origin URL match;
- no Genieo reference in the relevant Brain repository, Brain recovery records,
  or Brain application-support metadata.

Classification:

| Question | Result |
| --- | --- |
| Genieo actually present | **No, based on bounded independent evidence** |
| Active persistence | None found |
| Detected Genieo components | None confirmed |
| Origin/provenance | Unknown; no evidence of Brain/Codex origin |
| Most likely explanation | False positive or stale historical CleanMyMac finding |
| Browser persistence | None found in bounded metadata audit |
| Launch/background persistence | None found |
| Credential interception evidence | None |

Browser history was not read, and no broad filesystem scan or invasive malware
removal tool was run. Because no component was confirmed, no credential
rotation was warranted by this evidence.

## Removal decision

No Genieo component was removed because there was no confirmed target. This is
the safe result: deleting unrelated files based only on an uncorroborated
third-party label would not be justified.

The CleanMyMac application and its normal support/log files were retained.
The following were also retained for owner review:

- Hugging Face model cache: approximately `32 GiB`;
- ComfyUI data: approximately `8.4 GiB`, including `6.5 GiB` of models and
  `487 MiB` of output;
- Codex runtime cache: approximately `1.6 GiB`;
- Brain runtime cache: approximately `1.9 GiB`;
- Playwright cache: approximately `3.4 GiB`, with an open system-service
  handle at audit time;
- app/browser caches, mail/messages/photos, Documents, Repos, release,
  rollback, backup, signing, and canonical Brain StateStore paths.

## Bounded safe cleanup

Only exact, rebuildable cache targets with no open handles were moved to Trash
using the macOS recoverable-trash operation:

- `~/.cache/puppeteer/chrome` — browser build `152.0.7977.75`;
- `~/.cache/puppeteer/chrome-headless-shell` — browser build `152.0.7977.75`;
- `~/Library/Caches/loom-updater/pending/Loom-0.372.0-arm64-mac.zip`;
- `~/Library/Caches/electron-builder`.

Approximate bounded safe-cache amount moved to Trash: **0.89 GiB**. No
permanent deletion occurred and Trash was not emptied.

An earlier cleanup tranche had moved approximately `0.919 GiB` of exact
temporary roots to Trash. The Trash directory itself was not readable under
the current macOS privacy boundary, so permanently reclaimed space is
**0 GiB confirmed** and the retained Trash amount is **not independently
measurable**. The current disk snapshot remained approximately `926 GiB`
total, `838 GiB` used, `35 GiB` free, `96%` used.

The supported `uv` offline cache prune found no unused entries and reclaimed
`0` bytes. Active Playwright, pnpm, application/browser, model, ComfyUI,
Codex, and Brain runtime caches were not pruned.

## Mole result

Mole `1.54.0` was verified as installed. Only its non-destructive version
identity check was performed. The earlier broad Mole dry run had timed out, so
no broad preview or category deletion was attempted in this resumed goal.
There were no Mole-assisted deletions; the exact cache moves above used the
recoverable macOS Trash operation and remained within the authorized cleanup
bound.

## Post-cleanup Brain verification

- Core PID remained `72595`; Console PID remained `75201`.
- All required Core and Console health routes remained HTTP 200.
- StateStore schema remained `10`.
- SQLite integrity remained `ok`; foreign-key check remained clean.
- No Brain runtime/provider/model/network/tool side effect was observed.

## Capacity review retained for later owner decision

The largest review-only opportunities are model and media/application data,
not confirmed malware:

- Hugging Face: approximately `32 GiB`; model inventory below is metadata-only.
  The cache had no open handles at audit time. Model files are likely
  redownloadable, but are classified `UNKNOWN`/`LIKELY_NEEDED` as owner data;
  no reclaim was authorized.

| Repository | Size | Snapshots | Last modified | Classification |
| --- | ---: | ---: | --- | --- |
| `stabilityai/stable-audio-3-medium` | 9.7 GiB | 1 | 2026-05-25 | LIKELY_NEEDED |
| `openai/whisper-large` | 5.8 GiB | 1 | 2026-03-03 | LIKELY_NEEDED |
| `mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16` | 4.2 GiB | 1 | 2026-03-03 | UNKNOWN |
| `stabilityai/stable-audio-3-small-music` | 3.2 GiB | 1 | 2026-05-25 | LIKELY_NEEDED |
| `stabilityai/stable-audio-3-small-sfx` | 3.2 GiB | 1 | 2026-05-25 | LIKELY_NEEDED |
| `mlx-community/whisper-large-v3-mlx` | 2.9 GiB | 2 | 2026-04-12 | UNKNOWN; duplicate-snapshot review candidate |
| `mlx-community/whisper-large-v3-turbo` | 1.5 GiB | 1 | 2026-05-30 | UNKNOWN |
| `mlx-community/whisper-small-mlx` | 459 MiB | 1 | 2026-03-03 | SAFE_TO_REDOWNLOAD, owner review required |
| `openai/whisper-base` | 281 MiB | 1 | 2026-05-26 | SAFE_TO_REDOWNLOAD, owner review required |
| `mlx-community/whisper-base-mlx` | 137 MiB | 1 | 2026-03-03 | SAFE_TO_REDOWNLOAD, owner review required |
| `mlx-community/whisper-tiny` | 71 MiB | 1 | 2026-03-03 | SAFE_TO_REDOWNLOAD, owner review required |
| Remaining small repositories | <1 MiB each | 0–1 | 2026-03-16–2026-06-23 | UNKNOWN |

The one repository with two snapshots is a duplicate-snapshot potential, not
proof of duplicate content; no snapshot was removed. Theoretical total reclaim
if the owner later approves model removal is approximately `32 GiB`, but the
authorized reclaim in this goal is `0 GiB`.

- ComfyUI: approximately `8.4 GiB`: `6.5 GiB` models, `487 MiB` output,
  `1.3 GiB` virtual environment, and small source/support data. `temp` is
  empty, `input` is about `12 KiB`, and `custom_nodes` is about `16 KiB`.
  Safe temporary-cache potential is therefore approximately `0 GiB`; models,
  output, and the environment were retained.
- Codex runtime cache: approximately `1.6 GiB`, modified 2026-09-06;
  Brain/deepseek runtime: approximately `1.9 GiB`, modified 2026-09-09.
  No active process or open handle was observed in the bounded check, but both
  are current runtime assets and have no safe stale candidate established.
  Safe reclaim is `0 GiB`; approximately `3.5 GiB` remains owner-review-only.

No further cleanup tranche was started automatically.

## Evidence and commit scope

This report records the bounded audit, exact recoverable cache moves, health
verification, and retained review-only inventory. Protected unrelated working
tree entries were not staged or modified:

- `tools/firecrawl/logs/firecrawl.log`
- `operations/specs/mindcontrol-product-roadmap.md`
- `operations/specs/nevermind-release-pipeline-roadmap.md`

Exact next task: owner-directed review of the retained Hugging Face/ComfyUI
model and output inventories, or a fresh separately scoped security request if
new Genieo evidence appears. No further cleanup or service mutation is
authorized by this report.
