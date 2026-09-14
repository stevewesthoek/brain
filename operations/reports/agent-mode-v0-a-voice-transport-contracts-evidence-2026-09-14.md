# Agent Mode V0-A — Jarvis Voice Transport Contracts Evidence

Date: 2026-09-14
Starting HEAD: `5013e66a fix(agent-mode): harden unified console closure`
Implementation status: V0-A complete; V0 remains in progress

## Starting-state reconciliation

- U0-A through U0-G and the U0 exit gate are complete at the starting HEAD.
- The authoritative roadmap names **Phase V0 — Jarvis voice gateway** as the
  next phase.
- The U0-G audit records durable Root Goal/Jarvis ownership visibility but no
  canonical conversational text-intake queue. V0-A therefore implements the
  allowed narrow interface plus deterministic fixture and does not claim a
  production exactly-once intake path.
- Existing MLX Whisper and FluidVoice surfaces were inspected and left
  untouched. Existing Video Orchestrator Polly/Azure-shaped TTS types remain a
  separate media domain and were not invoked or reused.
- The only pre-existing worktree changes are the protected Firecrawl log and
  two unrelated roadmap files; none were modified or staged.

## Contract and authority boundary

`projects/brain-core/src/agent-mode/jarvis-voice-gateway.ts` defines the
versioned `agent-mode.jarvis-voice-gateway.v1` contract family:

```text
VoiceInputRequestV1
  -> SpeechToTextProvider
  -> bounded VoiceTranscriptV1
  -> JarvisTextIntake
  -> bounded Jarvis response
  -> Jarvis-only VoiceOutputRequestV1
  -> VoiceOutputReceiptV1
```

The contracts include `VoiceSessionRef`, fixture/push-to-talk input mode,
bounded opaque audio refs, bounded transcripts and responses, deterministic
request/intake/output identities, output interruption, and typed denial of
voice control intents. `sessionId` is transport correlation only; it is not an
Agent, Task, Run, Attempt, root, or authority identity.

Organization role, K4 execution role, runtime, model, and capabilities remain
separate. The voice module imports no StateStore, K4, ModelGateway, AgentRuntime,
BrainNode, Workcell, AWS, or network module. It cannot create work, reserve
budget, approve controls, or select a provider model. The closed capability
labels are metadata only: `voice.input`, `voice.output`, `speech.stt`, and
`speech.tts`.

## Deterministic fixture

`FixtureSpeechToTextProvider` maps
`fixture://voice/hello-jarvis` to `Jarvis, summarize the current task.`.
`DeterministicFixtureJarvisTextIntake` returns the bounded fixture response
`The current task is ready.` and no root/task reference because canonical
production text intake is not yet available. The fixture TTS adapter returns
`fixture://voice/jarvis-response` and is bound to `speakerRole: 'jarvis'`.

Replay uses the same transport identity and an explicit fixture receipt-store
port. One accepted intake and one output receipt are retained in the fixture
store; redelivery returns `duplicate` and does not replay logical intake or
TTS. A same-identity transcript conflict fails closed. The store is explicitly
reported as `fixture-only`, not presented as a production durable ledger.

## Safety semantics

- Empty or oversized transcripts, invalid input, filesystem audio refs, and
  STT failures stop before intake/TTS.
- TTS failure and uncertain TTS output are typed transport outcomes and do not
  replay domain work.
- `interrupt_output` has `controlEffects: 0`; it affects only output transport
  state and cannot cancel/kill/pause/resume Brain work.
- Explicit voice approve/reject/cancel/kill/pause/resume/retry/spawn intents
  return `VOICE_CONTROL_REQUIRES_NON_VOICE_CONFIRMATION` with zero control-service
  calls.
- Worker speech is denied with zero runtime effects.
- No wake-word parser, microphone, browser recorder, live model, live STT/TTS,
  ModelGateway, Harness, BrainNode, Workcell, tool, repository, or network
  effect is present.
- No voice-specific Agent/Task/Run/Attempt/result ledger or raw audio/result
  body is introduced.

## Validation evidence

Focused test file: `projects/brain-core/src/tests/agent-mode-jarvis-voice-gateway.test.ts`

The focused suite covers 10 deterministic cases: contract identity and
authority separation, happy-path STT/intake/TTS, replay idempotency, conflicting
material, STT/normalization failures, TTS failure/uncertainty, provider
replacement, transport-only interruption and control denial, fixture
push-to-talk behavior, and filesystem-ref rejection.

Final validation:

- V0-A focused tests: **10 passed, 0 failed**.
- K5-A/K5-B/K5-C, K4, and U0 focused regression set: **219 passed, 0 failed**.
- Brain Core typecheck: **passed**.
- Brain Core build: **passed**.
- `git diff --check`: **passed**.
- The full Brain Core suite was started and built successfully. It reproduced
  the known unrelated `agent-orchestrator.test.js` timing/hang condition after
  the relevant V0/K5/K4/U0 tests observed green; it was stopped safely rather
  than claimed as a complete pass. No V0-A test failure was observed.
- The fixture's deterministic counters are one STT invocation, one accepted
  text-intake invocation, and one TTS invocation; replay does not add another
  logical intake or TTS dispatch. ModelGateway, live model, provider network,
  Harness, BrainNode, Workcell, and Agent Mode/K4 mutation effects remain zero.

The security review found no raw audio, prompt, hidden reasoning, provider
payload, credential, filesystem-authority, or voice-specific execution/result
ledger in the V0-A module. No protected unrelated path is included in the
change.

## Explicit production gap and next task

Brain has durable Root Goal/Jarvis ownership but no canonical conversational
text-intake queue. V0-A deliberately stops at the `JarvisTextIntake` port and
marks fixture idempotency honestly. The exact next bounded task is:

**V0-B — Push-to-Talk Input and Local Speech-to-Text Adapter**, including the
production durable text-intake prerequisite. It must preserve the same Jarvis
and control-plane semantics and must not modify FluidVoice or the retained MLX
Whisper media pipeline without a separately scoped adapter decision.

V0-A is complete; V0 is not complete. Do not start V0-B automatically.
