# Agent Mode K4.3-A R3 Live MiniMax Acceptance Evidence — 2026-09-12

## Decision

**K4.3-A COMPLETE for its bounded live acceptance gate.** R3 used one fresh
authorized MiniMax inference with the repaired 1024-token output allowance.
The exact visible response was accepted, one normalized provider receipt was
persisted and verified, and the model operation settled. K4 remains in
progress. K4.3-B was not started.

## Acceptance identity

| Field | Value |
|---|---|
| Acceptance generation | `k4.3-a-r3` |
| Root goal | `goal:k4-3-a-r3` |
| Scheduler event | `event:k4-3-a-r3` |
| Correlation | `corr:k4-3-a-r3` |
| Child Agent | `agent:child:b814b1cc5777ef1e23d86e852f7dd06a423e16f46047760348baf48309e1265b` |
| Task | `task:child-assignment:d99e4cd2745d7288e0ca0157ffe7bc93e215e847f91c18ad860bdb52a080db88` |
| Run | `run:child-assignment:d99e4cd2745d7288e0ca0157ffe7bc93e215e847f91c18ad860bdb52a080db88` |
| Attempt | `attempt:child-assignment:d99e4cd2745d7288e0ca0157ffe7bc93e215e847f91c18ad860bdb52a080db88` |
| Runtime dispatch | `dispatch:e1:c14a62b2a30734d04d4fae2caca3adcd5c33cf3cf2316161` |
| Model operation | `model-op:sha256:95c4b3a6a524e534ad1433f7b9b0381bbfd15eb57a5eb16d3466c9919ec8cc73` |

R3 identities are fresh and are not reused from R1 or R2.

## Access evidence

Fresh existing access evidence passed before inference for `amazon-bedrock`,
`agent-mode/minimax-m2.5`, `minimax.minimax-m2.5`, direct route, and
`us-east-1`; catalog, authorization, agreement, entitlement, region, and
callable checks were positive. Evidence version:
`agent-mode-live-access:2026-09-12T21:40:37.789Z`.

No credentials, account identifiers, raw provider payload, or reasoning
content are retained.

## Bounded execution

| Effect | Count |
|---|---:|
| Child / Task / Run / Attempt | 1 / 1 / 1 / 1 |
| Harness launches / reaps | 1 / 1 |
| ModelGateway / MiniMax provider calls | 1 / 1 |
| Model turns | 1 |
| Tool calls | 0 |
| BrainNode / Workcell / repository effects | 0 / 0 / 0 |
| Replacement workers / grandchildren | 0 / 0 |
| Fallback / escalation | 0 / 0 |

The Harness used version `0.1.3-alpha.2`, commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, profile
`brain-agent-mode-restricted`. It received zero AWS credential variables and
had no direct provider authority.

## Prompt and response contract

The canonical live output allowance is `1024` tokens. The provider-facing
instruction remained:

`Return exactly the following token and no other text: BRAIN_K4_3_A_LIVE_MINIMAX_PASS`

The normalized visible response was exactly:

`BRAIN_K4_3_A_LIVE_MINIMAX_PASS`

Strict exact-response validation passed. No substring, semantic, or judge-based
acceptance was used. Stop reason: `end_turn`.

## Provider receipt and accounting

- input tokens: `61`
- output tokens: `119`
- total tokens: `180`
- settled cost: `$0.000161`
- latency: `2679 ms`
- provider request ID: unavailable (`null`)
- receipt: present, identity-bound, durable, verified
- model operation final state: `verified` and settled

The settled cost is below the `$0.01` acceptance ceiling. Hidden reasoning was
not persisted or exposed.

## Recovery and no-replay checks

The runner closed and reopened the disposable StateStore; the observer
reconstructed the terminal scheduler, child, Task, Run, Attempt, runtime
dispatch, model operation, receipt, usage, cost, and worker result state.
Redelivery of the same scheduler event completed quietly with zero additional
child, Harness, ModelGateway, provider, or spend effects.

## Deterministic validation

- focused K4.3-A / Harness / D1-D2 / ModelGateway / policy tests: **159/159**
- full Brain Core suite: **2494/2494**
- typecheck: **PASS**
- build: **PASS**
- syntax and `git diff --check`: **PASS**

## Status and next gate

The R3 repair was committed as
`a81ee10c fix(agent-mode): bound minimax live reasoning headroom`.
K4.3-A is complete; K4 remains in progress. The exact next roadmap task is
**K4.3-B — K4 Live Autonomy Closure Audit and Phase Exit Gate**. It is not
started by this evidence.
