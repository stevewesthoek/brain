# Agent Mode V0-D Voice Gateway Exit Audit — 2026-09-15

## Decision

V0-D is **COMPLETE** and V0 is **COMPLETE**. The V0 exit gate passes: voice is
a transport over the same durable Jarvis, task, and control-plane contracts and
can be replaced without changing agent identity or orchestration. No live model,
provider, Harness, BrainNode, Workcell, network, or lifecycle-control effect was
introduced. D0 has not been started.

Starting HEAD for this audit was `4a90e20c feat(agent-mode): add interruptible
Jarvis speech`. The repository reconciled with V0-A, V0-B, V0-C1, V0-C2, and V0-C
landed; no V0-D implementation or newer legitimate V0-D work was present.

## Scope and evidence crosswalk

| V0 requirement | Result | Canonical evidence | Limitation / decision |
| --- | --- | --- | --- |
| microphone and push-to-talk | PASS | `components/jarvis-push-to-talk.tsx`; V0-B report | Explicit user gesture only |
| STT into Jarvis | PASS | `MlxWhisperSpeechToTextProvider`; production `JarvisTextIntakeService`; V0-D offline test | Live MLX inference remains host-gated |
| durable root/task authority | PASS | `JarvisTextIntakeService`; StateStore tests | One Brain-owned intake contract |
| canonical Jarvis text ingress | PASS | `agent-mode.jarvis-text-intake.v1` | Bounded canonical text only |
| canonical response generation | PASS | `JarvisResponseFinalizer`; V0-C1 report | Deterministic, no LLM synthesis |
| text-to-speech | PASS | `components/jarvis-response-playback.tsx` / `lib/jarvis-speech.ts`; V0-C report | Browser/OS audible acceptance is classification B |
| interruptible output | PASS | transport generation fence and interruption tests | Transport-only cancellation |
| explicit voice approval semantics | PASS | `denyVoiceControlIntent()` and V0-D tests | `approve`/`reject` are denied, never lifecycle authority |
| Jarvis-only speech | PASS | closed `VoiceOutputRequestV1`; worker-output denial tests | No worker speech path |
| structured worker communication | PASS | K4/K5 durable tasks, events, results, evidence | No peer chat or conversation bus |
| replaceable transports | PASS | provider-neutral STT/TTS interfaces, fake transports, replay tests | Replacement preserves IDs and orchestration |
| wake word | DEFERRED, non-blocking | V0 roadmap scope | Explicitly not implemented in V0 |
| privacy and retention | PASS | bounded adapter/service contracts and tests | Raw audio and pre-review transcript are ephemeral |
| same durable control plane | PASS | offline fixture and K5/K4 tests | Voice is ingress/output transport only |

The earlier C2 evidence reference was corrected from a nonexistent filename to
the actual canonical file:
`operations/reports/agent-mode-v0-c-jarvis-tts-interruptible-playback-evidence-2026-09-15.md`.
No duplicate C2 report was created.

## End-to-end offline fixture

`projects/brain-core/src/tests/agent-mode-v0-exit-audit.test.ts` supplies a
deterministic STT fixture for `fixture://voice/hello-jarvis`, feeds the resulting
transcript through the production durable `JarvisTextIntakeService`, completes
the existing K5 fixture through `AgentModeOrganizationDelegationOrchestrator`
and `MockAgentRuntime`, derives the Jarvis-readable result, finalizes the
canonical response with `JarvisResponseFinalizer`, and sends that exact response
to a replaceable fake speech transport.

The fixture proves one Jarvis intake/root/task and one canonical response, three
distinct K5 child lifecycles, and exactly three mock runtime invocations. The
Research and Engineering results unlock the Independent Auditor structurally;
the auditor is a separate child and all three terminal results are aggregated
without replay or free-form worker communication. The approval test covers both
`approve` and `reject`: both return the bounded denial reason
`VOICE_CONTROL_REQUIRES_NON_VOICE_CONFIRMATION` and make zero control-service
calls.

Typed and voice submissions use the same durable intake identity, root/task
authority, and downstream K4/K5 path. STT and speech output are interfaces with
fixture/fake implementations; changing either transport does not change Jarvis,
root, task, organization, or response identity.

## Authority, privacy, and safety audit

The authority chain remains:

```text
microphone or typed text
  → authenticated Jarvis intake
  → durable root/task
  → K4/K5 execution and receipts
  → K5 final result/evidence
  → deterministic Jarvis-readable facts
  → immutable canonical Jarvis response
  → browser-local speech transport
```

Voice approval phrases do not reach `AgentModeControlService`; interruption
calls only the speech transport's local cancel operation. Worker output cannot be
spoken, and arbitrary caller text cannot be published as a response. The
browser-local SpeechSynthesis path makes no application network/provider request,
but the browser/OS speech engine may be platform-managed, so privacy is
classified **B** rather than claimed as guaranteed offline. No cloud TTS is
integrated.

Retention is bounded: MLX input audio is capped at 8 MiB and 30 seconds and is
cleaned from private temporary storage; STT output is bounded at 2,000
characters; canonical intake text is bounded at 4,000 characters; canonical
response text is bounded at 2,000 characters. Durable records retain hashes,
stable IDs, structured references, and approved canonical text as required for
reconstruction—not raw audio, hidden reasoning, prompts, provider payloads, or
unbounded logs. Intake is authenticated and the console routes enforce local
operator/session, provenance, CSRF, and loopback protections.

The MLX adapter uses `shell: false`, explicit configured executable/model paths,
bounded output, timeout, validation, and a resource lock. No live MLX process was
run during this audit. `tools/scripts/bible-studies-pipeline.sh` and
`tools/scripts/bible-studies/pipeline.mjs` were not modified; the retained Bible
Studies transcription capability remains separate and protected by the same
resource-coordination requirement.

Interruption is race-safe: a generation fence prevents late completion/error
callbacks from overwriting `interrupted`, and a later explicit replay reuses the
same canonical response/output identity. Multiple browser clients reconstruct
the same canonical response identity while keeping playback state local to each
client. Refresh, cache clearing, and a second client do not mutate Brain state.

## Isolated current-build acceptance

The current Core build was started against a temporary StateStore on port 4883
and the current Console build on port 4884. `GET /agent-mode/console` returned a
valid empty `agent-mode-console-v1` projection with explicit available/empty
freshness; the canonical response route correctly returned not-found without a
fixture response. The current `/agents` page rendered its read-only canonical
response panel and operation summaries. A 390px viewport had no horizontal
overflow (`scrollWidth == clientWidth == 375`) and the sidebar/header/main
containers remained within the viewport.

Physical audible output was unavailable in this validation environment and is a
manual device check, classification **B**, non-blocking for the deterministic
contract gate. The browser page does not speak on load or polling; speech occurs
only after the explicit Speak action.

## Validation

- V0-D plus voice gateway Core tests: **12/12 passed**.
- Broader focused Brain Core set, including V0-D, V0-B/C, K5-A/B/C, observer,
  StateStore, controls, scheduler, and auth tests: **94/94 passed**.
- Brain Console speech/schema tests: **15/15 passed**.
- Brain Core typecheck: **passed**.
- Brain Core build: **passed**.
- Brain Console typecheck: **passed**.
- Brain Console build: **passed**; `/agents` is present.
- `git diff --check`: **passed**.
- Full Brain Core release suite: see final validation result in the completion
  record; the historical unrelated Video Orchestrator metadata-title failure,
  if repeated, remains out of scope and does not affect V0/K4/K5 tests.

## V0 exit audit

All first-class V0 requirements pass: one durable Jarvis voice gateway spans
typed/voice parity, authenticated intake, durable root/task ownership, existing
K4/K5 structured execution, deterministic response publication, replaceable
speech transport, transport-only interruption, and explicit non-authoritative
voice control semantics. Wake word is an explicit roadmap deferral and does not
block V0. There is no second runtime, control, result, or conversation ledger.

Therefore:

- **V0-D COMPLETE**
- **V0 COMPLETE**
- **D0 NOT STARTED**

The exact next roadmap phase is **Phase D0 — distribution and always-on
options**. This audit does not begin D0.
