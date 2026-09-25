# RC48 Auto-Router Isolated Acceptance Evidence — 2026-09-25

## Scope and production boundary

This records the single authorized RC48 trivial-turn acceptance. The user
authorized at most one isolated MiniMax M2.5 inference and one isolated GLM-5
inference, with no Opus or Codex calls, and prohibited production promotion.
One MiniMax provider request was attempted. It failed with the Brain-normalized
`access_denied` class. No retry and no GLM inference were made.

Production remained on RC47. The candidate used a foreground Core bound only
to `127.0.0.1:4992`, a fresh candidate-only StateStore, the exact retained RC48
package and CLI, and a temporary in-memory service identity. It did not open
the production StateStore, contact a production endpoint, change a service
descriptor, or modify production state. The temporary service secret is not
retained in this report or acceptance bundle.

## Exact candidate identity

- Version: `1.0.0-rc.48`.
- Source: `0674c11877348069b5ad06d51e47118fb5969abc`.
- Package: `brain-runtime-package:sha256:b0fb30ada370d9aedc196f386f50d95eab23cd23a1fba4326670ca158a0e9a13`.
- Package manifest hash: `fa0ec49fa321b6f1df85f0d21ea150a613b7972ae09f59126a052ae74028ed6a`.
- Release: `brain-agent-release:sha256:fd7fc7cff41a1c0831851930f8f2a049fecf916e7017e0dcefb7287251dcaa3d`.
- Package completeness/hash verification and Ed25519 release-signature
  verification passed for this retained artifact; it was not rebuilt.
- Candidate CLI was the packaged `package/core/dist/bin/brain-agent.js`.

## Pre-call durability and isolation gates

Before inference, package identity and signature were verified; the isolated
Core observer returned successfully; the approved `ClaudeCodexProvisioner`
role was confirmed without printing account identifiers; and the candidate
StateStore passed SQLite integrity validation. A canary event was written,
the StateStore was closed and reopened read-only, and the canary was recovered.
The retained package exposes durable StateStore APIs for Attempts, effects,
events, Jarvis intakes, and conversation turns. No production endpoint or
StateStore was used.

The private acceptance bundle is:

`/Users/Office/Library/Application Support/Brain/agent-mode/acceptance-evidence/rc48-auto-router-20260925141909-5nvhTh/`

It retains `preflight.json`, `acceptance-summary.json`, and
`candidate-agent-mode.db`. The directory is user-only accessible. No secret or
AWS account number is recorded here.

## Single live attempt and durable outcome

The exact packaged CLI submitted one no-context Jarvis turn (`hi`) with
`--model auto` to the isolated Core. The recorded deterministic route was
`agent-mode/minimax-m2.5` → `minimax.minimax-m2.5`, using the K4
`runtime:model-gateway` runtime. Jev’s durable preflight reason was
`REFLEX_SKIPPED_SIMPLE_TURN`; the bridge made no Jev inference.

K4 durably retained one failed Attempt, one failed runtime-dispatch effect, one
failed receipt, and nine provider lifecycle events. The provider command
started and exited with code 254. Its normalized public error class is
`access_denied`. The provider diagnostic parser classified stderr as
`malformed_error_output`, and the safe provider diagnostic was unavailable.
Consequently, no provider-specific code, safe message, request ID, or HTTP
status was durably available; this report does not infer those values. The
failure stage is the provider command/process response followed by ModelGateway
error normalization.

The Jarvis user turn and route metadata were retained, but no successful
Attempt or Jarvis result/history turn was produced. The live identity answer
therefore was not accepted as a successful gate. The authoritative durable
route fact identifies MiniMax; it is not a model-generated answer.

Durable fixture counts after the run:

- Agents: 2 (Jarvis root and one child); Tasks: 2; Runs: 2.
- Attempts: 1, failed; runtime-dispatch effects: 1, failed; receipts: 1,
  failed.
- Jarvis conversation turns: 1 user turn; successful Jarvis result turns: 0.
- Workcells, tool operations, Codex escalation, and repository mutations: 0.
- MiniMax provider request attempted: 1; GLM-5: 0; Opus: 0; Codex: 0.

The AWS CLI retry cap was one attempt. The single failed scheduler pass was not
replayed; no replacement child or runtime dispatch was created. The candidate
Core/CLI processes exited, and port 4992 is no longer listening. The private
StateStore and diagnostics remain preserved; they were not deleted during
cleanup.

## Deterministic routing validation

The precise historical RC47 cause for `hi` selecting GLM-5 cannot be proven
from this acceptance bundle: it contains no durable per-turn admission snapshot
for that earlier production turn. The preceding source used a general
candidate selection path; GLM could be selected if MiniMax was not in the
canonically admitted runtime set. The claim that MiniMax was admitted for that
specific turn is not independently established here. The RC48 source makes
trivial/normal/reasoning/high tiers explicit and guards simple-turn Jev
recommendations from replacing the deterministic route.

After the acceptance, the isolated source worktree passed 118 focused tests:
86 across model-tier policy, Jarvis routing, Jev/reflex routing, and
low-confidence behavior; and 32 across terminal rendering, Jarvis history,
authoritative model disclosure, failure presentation, and K4 terminal intake.
These prove the deterministic route matrix, simple-turn MiniMax selection,
Jev simple-turn bypass, low-confidence non-escalation, GLM reasoning route,
Opus cost gate, and Codex Auto exclusion without live inference. Core
typecheck/build and Console typecheck/build had passed in the earlier source
validation; they were not rerun during this failure-only acceptance follow-up.

The routing implementation uses verified price data for deterministic cost
ordering. No canonical comparative provider latency measurements exist in the
current Brain contracts, so latency ranking is not claimed or fabricated.

## Decision

**BLOCKED — external/provider authorization or configuration gate.** The
authoritative failure class is `access_denied`, but the sanitized provider
diagnostic parser could not retain a provider code or message. No Brain source
defect is proven, and the exact AWS authorization cause cannot be determined
from retained diagnostics. This does not meet the live acceptance gate; the
candidate is not declared ready for production promotion.

Do not retry under the current authorization. The exact next action is for the
AWS administrator to review the approved role’s narrowly scoped Bedrock
inference authorization for `minimax.minimax-m2.5` in `us-east-1`, using the
retained sanitized failure facts or authorized AWS audit records. Any further
inference requires fresh explicit user authorization. RC47 production remains
unchanged.
