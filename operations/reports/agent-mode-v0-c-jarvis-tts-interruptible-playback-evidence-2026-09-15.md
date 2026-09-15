# Agent Mode V0-C — Jarvis TTS / Interruptible Playback Evidence

Date: 2026-09-15

## Decision

V0-C is **IN PROGRESS**. This bounded implementation establishes and tests the
canonical Jarvis user-response boundary, but it does not claim production
text-to-speech or interruptible playback.

Starting HEAD was `0e7fcdee feat(agent-mode): add durable Jarvis voice ingress`.
V0-A and V0-B are landed, K4 and K5 remain complete, and the protected
unrelated worktree paths were left untouched.

## Boundary audit

The repository contains durable Root Goal/Jarvis ownership, K4 lifecycle facts,
and K5 structured organization final results. It does not contain a canonical
production component that turns those authoritative facts into approved,
human-facing Jarvis response text.

The V0-A `responseText` is a deterministic transport-fixture field only. K4/K5
worker and organization result references are structured execution/evidence
references and are not automatically speech-safe. The existing AWS Polly
adapter belongs to Video Orchestrator narration and is not a Jarvis provider.
FluidVoice remains an external retained personal capability without a Brain
Core adapter. No supported Jarvis TTS provider or playback transport could be
selected without inventing a new provider boundary.

Classification: **C for production Jarvis response generation and speech
output**. The bounded prerequisite is a Brain-owned canonical
response-generation/finalization producer. It must produce approved
user-facing text from authoritative Brain facts and publish it through the
response contract before a supported Jarvis TTS/playback adapter is selected.

## Implemented response contract

`agent-mode.jarvis-user-response.v1` is a closed Brain-owned contract with:

- fixed `agent:jarvis` owner and `jarvis` speaker role;
- bounded normalized text (2,000 characters maximum);
- root/task lineage and one authoritative K5 organization final-result source;
- deterministic response ID, text hash, and material hash;
- immutable `published` status;
- no prompt, reasoning, worker output body, provider payload, credential, or raw
  evidence body.

`JarvisUserResponseService` is a publication boundary, not a response
generator. It rejects extra authority-shaped fields, non-Jarvis ownership,
non-canonical source references, invalid text, and malformed timestamps before
StateStore persistence.

## Durable persistence and read path

The existing `AgentModeSqliteStateStore` was extended with one bounded
`agent_mode_jarvis_user_responses` table. This is a response publication record,
not a Task/Run/Attempt, provider, cost, or result ledger. One response is
allowed per root; deterministic replay is a duplicate and conflicting material
fails closed. The schema migration advances to version 10.

The response record is inserted atomically with its bounded event reference and
is reconstructed after close/reopen. The read-only route is:

```text
GET /agent-mode/jarvis/responses/:rootGoalId
```

The route opens the existing StateStore read-only, returns only the public
response fields, omits the material hash, and performs no provider, model,
runtime, filesystem, or network operation.

## Deterministic and restart evidence

The focused V0-C test file proves:

- bounded canonical Jarvis-owned response validation;
- deterministic response identity and text/material hashing;
- authoritative K5 final-result source enforcement;
- rejection of missing sources and non-Jarvis speakers;
- idempotent publication and conflict rejection;
- exact reconstruction after StateStore close/reopen;
- read-only route retrieval without exposing material hash.

Focused V0-A/V0-B/K5/observer/StateStore/scheduler validation passed **72/72**
tests. Brain Core typecheck and build passed. The complete Brain Core suite
passed **2,567/2,567** tests with no failures.

Brain Console typecheck and build passed. No Console source or UI behavior was
changed in V0-C because production speech output is not enabled; the existing
`/agents` push-to-talk/typed-intake surface remains unchanged and read-only
with respect to lifecycle control.

## Side-effect audit

V0-C introduced no TTS provider, playback loop, interrupt mutation, model call,
ModelGateway call, AgentRuntime call, Harness launch, BrainNode operation,
Workcell operation, AWS/Bedrock/MiniMax/GLM/Opus/Codex call, network request, or
repository mutation. No live MLX process was invoked. The response route only
reads durable local state.

Counts for the response-boundary tests:

```text
production Jarvis response producer calls: 0
TTS provider calls: 0
playback calls: 0
interrupt mutations: 0
live model/provider calls: 0
runtime/Harness/BrainNode/Workcell calls: 0
network calls: 0
```

## Next bounded task

**Brain-owned canonical Jarvis response-generation/finalization producer.**

It must create approved user-facing text from authoritative Brain state and
publish through `JarvisUserResponseService`. Only after that prerequisite is
accepted should the remaining V0-C speech provider, playback, and transport-only
interrupt implementation be started. V0 remains in progress; V0-D is not
started.
