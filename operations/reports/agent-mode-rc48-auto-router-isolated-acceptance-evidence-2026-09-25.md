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

## Read-only authorization follow-up

At `2026-09-25T14:41:53.938Z`, the same `ClaudeCodexProvisioner` role again
returned `AUTHORIZED` plus `AVAILABLE` agreement, entitlement, and region
availability for both `zai.glm-5` and `minimax.minimax-m2.5` in `us-east-1`.
This control-plane availability result does not establish Bedrock inference
permission. A read-only IAM policy simulation for `bedrock:InvokeModel` could
not run: the approved role received `AccessDenied` for the simulation request,
so the simulated invoke decision is **UNKNOWN**, not implicitly denied. No IAM
write or identity change was performed, and this diagnostic made zero model
inferences. The sanitized diagnostic is retained in the private bundle as
`read-only-authorization-check.json`.

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
retained sanitized failure facts or authorized AWS audit records; the current
role cannot self-simulate that permission. Any further inference requires
fresh explicit user authorization. RC47 production remains unchanged.

## Explicitly authorized RC48 retry after Bedrock policy update — 2026-09-25

After the user confirmed adding the narrowly scoped policy statement, one new
isolated MiniMax call was explicitly authorized as a retry. No further retry
was authorized. The earlier failed provider attempt described above remains
retained and unchanged; this section records the later successful attempt and
supersedes the earlier blocked acceptance decision for the RC48 candidate.

The exact retained RC48 package, release, and source identities above were
rechecked. Through the same approved `ClaudeCodexProvisioner` role in
`us-east-1`, the read-only Bedrock availability check returned authorized and
available for both MiniMax M2.5 and GLM-5. No identity change or IAM mutation
was made by this task.

The exact packaged RC48 Core and CLI ran in an isolated environment at
`127.0.0.1:4992` with a separate copied StateStore. One `hi` turn with
`--model auto` completed. Brain selected MiniMax M2.5
(`agent-mode/minimax-m2.5`, provider model `minimax.minimax-m2.5`) on
`runtime:model-gateway`. Jev recorded `REFLEX_SKIPPED_SIMPLE_TURN`; no Jev
inference occurred. The K4 Task, Run, and Attempt completed, the ModelGateway
receipt is durably `succeeded` / `accepted`, and the Jarvis conversation has
completed user and Jarvis turns linked to the runtime receipt. SQLite
integrity is `ok`. The result reference is
`6fddc0433ec162151cb27ff7de5ebe35368a3e8fc38c7ee095d84a98b890cc75`.

The successful Jarvis response did not itself state the model name; no extra
inference was made for a status question because the MiniMax authorization was
already consumed. Brain's authoritative route metadata and the focused
deterministic terminal-disclosure tests agree on the actual MiniMax route and
Jev bypass. The optional additional conversational status turn was not
performed.

The retry evidence, including the isolated StateStore and this result record,
is retained outside Git at:

`/Users/Office/Library/Application Support/Brain/agent-mode/acceptance-evidence/rc48-auto-router-retry-20260925T1545Z.hfpbvI/`

The candidate Core stopped after completion and port 4992 is no longer
listening. During the isolated acceptance turn, no production endpoint,
service, or StateStore was used; there was no repository/tool mutation,
Codex escalation, Harness, BrainNode, Workcell, GLM-5, Opus, or Codex
execution. The later forensic reconciliation made one read-only Observer GET
and immutable-mode read-only SQLite queries against the production StateStore;
it did not modify production state. This report was committed locally as
scoped evidence and was not pushed. Across the original failed request and the
separately authorized retry, MiniMax requests total two; the retry was the
final authorized call.

## Revalidation and current gate assessment

On the clean source worktree at `0674c11877348069b5ad06d51e47118fb5969abc`,
the router/Jev/terminal focused suite passed 95/95 and the K4
SpawnPolicy/assignment/runtime-dispatch, ModelGateway, and resume-route suite
passed 190/190. Brain Core and Brain Console typechecks and builds passed.
The exact retained RC48 package reverified with 2,567 files and manifest hash
`fa0ec49fa321b6f1df85f0d21ea150a613b7972ae09f59126a052ae74028ed6a`; the
release signature verified as Ed25519 for release
`brain-agent-release:sha256:fd7fc7cff41a1c0831851930f8f2a049fecf916e7017e0dcefb7287251dcaa3d`.

The production StateStore was subsequently checked read-only in immutable
SQLite mode. It contains one completed GLM turn from `2026-09-25T10:58Z` whose
stored input is 22 characters (the text is intentionally not reproduced
here). The exact RC47 package classifies that stored input as `moderate`; its
durable route event says `adaptive-quality-tier`. The same root's Jev facts
show `REFLEX_LOW_CONFIDENCE` with no recommendation model, so Jev did not
select GLM for that turn: Brain's baseline adaptive tier did. Two other
durable turns whose stored user text is literally `hi` (on September 21 and
22) used Opus under the earlier routing state, not GLM. Therefore the
available production evidence does not corroborate the initial assertion that
an exact literal-`hi` input selected GLM; it does precisely explain the
matched GLM turn as moderate-tier adaptive routing. The pre-fix source also
allowed Jev to replace a simple-turn route, which RC48 now prevents. RC48's
isolated literal-`hi` acceptance confirms MiniMax selection and deterministic
Jev bypass.

The deterministic matrix covers trivial and normal MiniMax selection,
reasoning-tier GLM selection, high-tier Opus admission/cost fallback, unavailable
MiniMax fallback, Jev bypass and low-confidence non-escalation, Codex Auto
exclusion, and Brain-owned model/Jev disclosures. No canonical comparative
latency evidence exists, so no measured latency ranking is claimed. No second
provider inference was needed for these routing and disclosure assertions.

**Current isolated acceptance: PASS. Candidate decision: READY_FOR_PRODUCTION_PROMOTION.**
This is readiness only; production promotion/cutover was not performed or
authorized by this goal. RC47 remains `PRODUCTION_ACTIVE` and RC27 remains the
rollback target.
