# Agent Mode K4.3-A Live MiniMax Dynamic-Worker Evidence — 2026-09-11

**Status:** IN PROGRESS — the original attempt and the fresh authorized R1
recovery attempt both failed before acceptance settlement.

## Scope and safety boundary

This run attempted only K4.3-A. The K4.2-E2 restricted Harness path, the
existing D1 dispatcher, the existing Bedrock `ModelGateway`, and the disabled
K4.3-A action rule were used. The Firecrawl log modification in the worktree
was preserved and was not touched.

The live runner performed fresh AWS access checks before the model path. It
did not retry, fall back, escalate, issue a second model turn, or repeat the
live run after the failure. Its disposable SQLite database and evidence
directory were removed by the runner cleanup path.

## Deterministic gates

- K4.3-A focused tests: PASS, 6/6 (including exact final-token acceptance/rejection, quiet scheduler redelivery, and no-replay coverage for an observed provider effect).
- K4.2-E2 focused tests: PASS, 16/16.
- Brain Core package validation: PASS, 2,489/2,489.
- Typecheck/build: PASS.
- `git diff --check`: PASS after the diagnostic coverage update.
- Default K4.3-A action rule: disabled.

After the failed live attempt, local diagnosis found that the live model path
was inheriting the D2 fixture Harness timeout of 10 seconds. The established
live K3.4 path uses a finite 90-second model timeout. K4.3-A now selects that
90-second bound only when the Brain-owned model bridge is present; deterministic
fixture runs retain the 10-second bound. The bridge also requires the exact
acceptance token after bounded normalization. The focused regression suite and
the full package suite pass with these corrections.

## Fresh live access evidence

The runner completed the existing AWS evidence path successfully before
attempting inference:

- provider: `amazon-bedrock`
- modelRef: `agent-mode/minimax-m2.5`
- modelId: `minimax.minimax-m2.5`
- route: `direct` / `minimax.minimax-m2.5`
- region: `us-east-1`
- catalog lifecycle: `ACTIVE`
- authorization: `AUTHORIZED`
- agreement: `AVAILABLE`
- entitlement: `AVAILABLE`
- region availability: `AVAILABLE`
- evidence source: `aws-bedrock-get-foundation-model-and-availability`

No account identifier, credential, raw AWS response, or provider payload is
stored in this report.

## Live outcome

The fresh bounded runner created exactly one scheduler event, child, Task,
Run, and Attempt; it launched and reaped exactly one restricted Harness; and
it recorded exactly one ModelGateway invocation. The final dynamic-worker
decision was `COMPLETED` with terminal worker outcome `failed`
(`RUNTIME_FAILED`). The model outbox remained `effect_applied`, not verified,
so no normalized provider receipt or settlement was accepted. The disposable
database was cleaned, and no second live call was made.

The fresh attempt therefore proves the bounded lifecycle and no-retry
behavior, but not successful MiniMax completion, provider request identity,
usage, cost, or final response acceptance. The failure diagnostics are now
bounded to allowlisted provider codes, result metadata, and runtime error
codes; they do not retain raw provider payloads or hidden reasoning.

## Gate disposition

K4.3-A is not complete. The required success commit was intentionally not
created. K4.2 remains complete and K4 remains in progress. The next task after
successful K4.3-A acceptance remains:

**K4.3-B — K4 Live Autonomy Closure Audit and Phase Exit Gate**

The live failure should be rechecked with a future explicitly authorized run;
the live-only timeout correction, deterministic provider-failure coverage, and
bounded failure diagnostics improve that path, but this evidence does not
authorize another provider call. The fresh R1 recovery authorization is now
consumed; its bounded failure record is preserved in
`operations/reports/agent-mode-k4-3-a-r1-live-minimax-recovery-evidence-2026-09-11.md`.

## Fresh recovery attempt R1 — 2026-09-12

R1 used a new acceptance generation (`k4.3-a-r1`) and fresh durable
identities. The existing non-generative access checks passed for
`amazon-bedrock`, `minimax.minimax-m2.5`, direct route, and `us-east-1`; the
catalog and authorization/availability checks were all positive.

The run created exactly one child, Task, Run, and Attempt; launched and reaped
one restricted Harness; and made exactly one ModelGateway and one MiniMax
provider invocation. It made one model turn and zero tool, BrainNode,
Workcell, repository, replacement-worker, or grandchild effects.

The normalized provider result existed with usage `51 / 191 / 242` input /
output / total tokens, settled-cost calculation `$0.000244`, stop reason
`end_turn`, and latency `6725 ms`. Its final text length was 67 and did not
equal the required acceptance token, so response validation failed. No
normalized provider receipt was persisted; the model operation remains
`effect_applied`/unverified. A provider request ID was not available in the
bounded retained evidence.

R1 is classified as a post-provider known validation failure, not a transport
failure or automatic escalation. The R1 runner performed no retry, fallback,
escalation, second turn, redelivery, or restart check after the failure. The
bounded failure summary preserves only allowlisted IDs, counts, states,
classification, and timing; it contains no credentials, raw provider payload,
or hidden reasoning. Phase B was not started.
