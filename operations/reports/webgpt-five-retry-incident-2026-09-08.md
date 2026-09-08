# WebGPT Five-Retry Turn Failure — Incident and Recovery

Date: 2026-09-08

Status: recovered and validated

## ROOT_CAUSE

The user-visible retry loop was the outer Codex symptom, not a route or stream failure. The first real failure was a ChatGPT Web terminal turn failure on a large tool-capable payload. ChatGPT accepted the submission and generation began, then rendered `Something went wrong`; the adapter classified it as retryable `upstream_server_error` (`chatgpt_turn_failure`, HTTP 502) and Codex retried the same turn five times.

The exact internal upstream cause is not exposed by ChatGPT Web. The evidence does prove the failing layer and terminal error. It does not prove rate limiting, a stale turn token, DOM drift, connector attachment failure, or profile splitting.

## Evidence

- Failure trace: `00418e82a152`.
- Browser checkpoints reached page acquisition, Temporary Chat preparation, effort selection, connector selection, prompt attachment, send acceptance, and response visibility before checkpoint 20 `turn-failed`.
- Safe diagnostic error: `ChatGPT ended the turn with 'Something went wrong'. Retry the turn.`
- The failing payload was approximately 71.5k estimated input tokens with no compaction trimming.
- A fresh minimal High turn, a read-only tool round, and a resumed second turn all completed before the repair, proving the service was not globally unavailable.

## Profile and ownership audit

The failing Codex Desktop process used the shared `/Users/Office/.codex` configuration and the managed route `http://127.0.0.1:17841/v1`. Dedicated `openai.01.cli` and `openai.02.cli` roots were not in that process path and remain direct/native profiles. Profile splitting was ruled out as the incident cause.

The current launcher-owned tunnel is healthy and ready. Browser-turn evidence recorded successful selection of the `Codex Native2` connector. Local checks cannot independently prove the remote connector-to-tunnel attachment, so the UI warning remains documented; operationally, the current tunnel completed all acceptance turns.

## Versions

| Component | Version/state |
| --- | --- |
| Vendor checkout used by the original wrapper | 5.0.2, tag `v5.0.2` |
| Installed Codex Web GPT launcher | 5.0.5 |
| Active managed proxy/runtime | 5.0.5 |
| Integration journal | schema/version 10; route points to `127.0.0.1:17841/v1` |
| Model cache | includes ChatGPT Web High and native models |

The Brain owner wrapper was corrected to use the configured launcher-owned runtime by default, while retaining `CODEX_WEBGPT_SOURCE_ROOT` as an explicit source-development override.

## Repair

1. Staged and SHA-256 verified the official macOS arm64 5.0.5 release.
2. Replaced the launcher bundle with 5.0.5 while preserving WebGPT state.
3. Preserved the previous 5.0.4 bundle at:
   `/Users/Office/.codex-chatgpt-web/rollback/20260908T1106-v5.0.4-pre-upgrade/Codex Web GPT.app`
4. Recovered the orphaned 5.0.4 daemon left by the interrupted handoff; the 5.0.5 supervisor now owns the ready runtime.
5. Updated `tools/codex-webgpt-owner-cli.mjs` to target the active installed runtime rather than stale vendor source by default.

No OAuth, connector, tunnel identity, key, browser profile, dedicated account profile, IAM, CLR, Ollama, Bedrock, or Brain vault state was recreated or deleted.

## Live acceptance

- Test 1 — ChatGPT Web High simple response: `WEBGPT_SMOKE_OK`, passed.
- Test 2 — High model read-only repository command followed by continuation: `TOOL_ROUND_OK`, passed.
- Test 3 — second turn resumed in the same High conversation: `CONTINUITY_TURN_TWO_OK`, passed.
- No `Reconnecting 5/5`, stream disconnect, or ChatGPT terminal error occurred in the post-repair acceptance runs.

## Regression

- Shared native Codex model: `NATIVE_CODEX_OK`, passed.
- `openai.01.cli`: `openai.01.cli_NATIVE_OK`, passed.
- `openai.02.cli`: `openai.02.cli_NATIVE_OK`, passed.
- Dedicated profiles remained direct/native and independent of the WebGPT shared route.

## Remaining limitation

The launcher doctor still reports that local checks cannot prove the remote `Codex Native2` connector attachment. This is a human/UI-verification limitation, not an observed turn failure; actual connector selection and completed WebGPT turns provide operational evidence of the current binding.

## Validation

- Owner doctor, route status, tunnel status, and browser check: passed.
- Owner wrapper syntax check: passed.
- No secrets, cookies, tokens, authorization headers, or private prompt contents were recorded.
- Existing unrelated dirty changes on `codex/cloudflare-tooling-normalization` were preserved.
