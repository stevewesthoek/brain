# Agent Mode V0-C1 — Canonical Jarvis Response Generation Evidence

Date: 2026-09-15

## Status and starting state

Starting HEAD: `34d0c571 feat(agent-mode): establish Jarvis response boundary`.
V0-A and V0-B remain complete. The V0-C response-boundary slice is complete.
V0-C1 is **COMPLETE** for the bounded response-generation/finalization
prerequisite. V0-C remains **IN PROGRESS** because speech synthesis,
playback, and interruption are explicitly deferred. V0 remains **IN PROGRESS**.

The protected unrelated paths remain untouched and unstaged; they remain the
only remaining worktree entries outside this scoped change.

## Authoritative response-source inventory

| Source | Classification | Decision |
| --- | --- | --- |
| K4 runtime receipt | C — result hash/evidence reference only | execution evidence, not answer text |
| K4 evidence reference | C — reference only | dereference is not performed |
| Restricted Harness evidence | B/C — runtime evidence, not Jarvis-readable | not copied or exposed |
| Mock runtime result | B/C — typed fixture/runtime metadata | not user-facing by itself |
| K5 work-item/result facts | C — structured refs/status/cost | aggregate authority only |
| K5 auditor result | C — structured ref/status | gate evidence only |
| K5 organization final result | C — immutable aggregate refs/facts | source lineage, not prose |
| V0-B intake | C — previously hash-only | bounded task-input seam added |
| durable evidence/content stores | D for approved Jarvis prose | no arbitrary dereference |

The audit found that meaningful original intent and answer material were not
available before this slice. A hash cannot tell Jarvis what the user asked, and
K4/K5 hashes/references cannot be stringified into an answer.

## Strategy decision

Selected strategy: **A — deterministic finalization is sufficient after adding
the smallest explicit source seams**. This is not a status-only answer path.
The fixture retains the bounded request `Summarize the completed research.` and
three explicitly Jarvis-readable business facts. The producer derives a natural
answer containing the research review, engineering implementation, and
independent audit conclusions. It does not mention IDs, hashes, digests, or
infrastructure metadata.

No model is needed for this bounded deterministic contract. Strategy B is not
implemented, so there is no ModelGateway admission, model operation, model
budget reservation, usage receipt, or uncertainty path to report for this
slice. Strategy C was the initial audit finding and was resolved narrowly by
the two source contracts below; it is not a reason to claim speech completion.

## Source contracts

`agent-mode.jarvis-task-input.v1` is a bounded root-lifecycle input record. It
stores normalized text up to 4,000 characters, source (`typed` or `voice`),
root/task/Jarvis ownership, content hash, fixed retention class, and timestamp.
It stores no audio and is not a conversation history.

`agent-mode.jarvis-readable-result.v1` is a bounded business-result seam above
K4. It stores up to 16 unique facts, each with bounded human-readable fact text
and up to four evidence references, plus a content hash and root/task/source
lineage. StateStore accepts it only when the referenced K5 organization final
result is durably successful and every fact/work-item/evidence reference is
linked to that result. It stores no raw worker output, provider response,
prompt, reasoning, or runtime log.

The existing K4 receipt and K5 final-result ledgers remain authoritative. These
source seams do not duplicate Task, Run, Attempt, provider, cost, or runtime
receipt state.

## Producer contract

`JarvisResponseFinalizer` implements the Brain-owned
`agent-mode.jarvis-response-finalization.v1` producer. Its request contains
only schema version, root/task identity, authoritative K5 final-result source,
deterministic operation identity, and request timestamp. The caller cannot
supply response text, model, provider, speaker, Jarvis identity, or worker
output.

The producer requires:

- an existing completed K5 organization plan and successful final result;
- exact root/task/supervisor lineage;
- durable bounded original intent;
- durable bounded Jarvis-readable result facts;
- source/evidence linkage validated by StateStore;
- canonical generation context under 12,000 serialized characters.

It produces bounded natural text and calls `JarvisUserResponseService.publish`
for the only response publication. Workers cannot publish user-facing Jarvis
responses; a worker-owned publication is rejected.

## Identity, idempotency, and recovery

The finalization operation ID is deterministic from root, task, and source
result. The response ID remains the existing deterministic identity from root,
task, and source result. Text and material hashes are deterministic. Repeated
finalization returns `ALREADY_PUBLISHED`; it does not regenerate or duplicate a
response. Two concurrent controllers converge on one response row, and
StateStore close/reopen reconstructs the same text/hash/source lineage.

The response publication remains immutable and one-per-root. GET response
retrieval is unchanged and side-effect free; it does not invoke finalization,
models, TTS, or providers.

## Readiness and failure semantics

Finalization refuses missing roots/plans, wrong source or lineage, incomplete
plans, cancelled/expired plans, missing input, missing result content, invalid
content, unlinked evidence, and conflicting response material. A K5 result
failure does not cause worker replay. This deterministic strategy has no
external model effect, so there is no ambiguous model outcome to replay.

## Fixture result

The deterministic fixture executes the existing K5-B three-worker MockAgentRuntime
path exactly once per worker, finalizes K5, publishes three linked readable
facts, and finalizes one Jarvis response. The response is meaningful text,
bounded to 2,000 canonical characters, and references semantic conclusions
rather than infrastructure identifiers.

```text
Jarvis response publications: 1
worker speech publications: 0
additional workers introduced by V0-C1: 0
MockAgentRuntime calls: 3 (existing K5 fixture only)
ModelGateway calls: 0
TTS/playback calls: 0
```

## Privacy and security review

Changed code was checked for direct provider invocation, raw worker/provider
output, hidden reasoning, Harness transcripts, credentials, environment
values, arbitrary evidence reads, unbounded generation context, response-table
inserts outside StateStore/service authority, and browser-triggered generation.
The response contract contains only bounded canonical text and source lineage.
Events carry hashes/counts/IDs, not response text or result bodies.

Video Orchestrator Polly and FluidVoice are unchanged and unused. No TTS
provider, new credential, browser speech API, model route, AWS call, network
request, BrainNode, Harness, or Workcell operation was added.

## Validation

- V0-C1 focused producer/source tests: **4/4 passed**.
- Combined V0-A/B, V0-C boundary, V0-C1, K5-A/B/C, observer, StateStore, and
  K4 scheduler tests: **76/76 passed**.
- Brain Core typecheck: passed.
- Brain Core build: passed.
- Brain Core full suite: **2,570 passed, 1 failed**. The single failure is the
  known unrelated Video Orchestrator `vo-studio-write` metadata-title test
  (`generateMetadataRequest generates YouTube metadata...`), with the same
  historical mismatch recorded before V0-C1; no Brain/K5/V0 test failed.
- Brain Console typecheck: passed (no Console source changed in V0-C1).
- Brain Console build: passed (no Console source changed in V0-C1).
- Brain Console validation: no Console source changes; existing validation is
  unaffected.
- `git diff --check`: passed.

The final scoped validation was run after the implementation and documentation
changes. The full-suite failure is retained as an out-of-scope pre-existing
baseline issue and was not modified by V0-C1.

## Decision and next task

V0-C1 is **COMPLETE**. V0-C remains **IN PROGRESS**; TTS/output/playback is
not implemented or claimed. V0 remains **IN PROGRESS**.

Exact next bounded task: **V0-C2 — Safe Jarvis TTS Provider Selection and
Interruptible Playback**. Re-audit available speech backends before selecting
the smallest supported provider. Do not start V0-C2 or V0-D automatically.
