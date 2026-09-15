# Agent Mode V0-C2 — Jarvis TTS / Interruptible Playback Evidence

Date: 2026-09-15
Starting HEAD: `3e323555 feat(agent-mode): finalize canonical Jarvis responses`

## Decision

V0-C2 is **COMPLETE** for the bounded browser-local speech-output slice. V0-C
is **COMPLETE**; V0 remains **IN PROGRESS** because the V0-D phase-exit audit
has not started. V0-A, V0-B, and V0-C1 remain landed and green. No V0-D work was
started.

The result is a safe read-only output effect over the canonical Jarvis response;
it is not a new runtime, model, provider, or control plane.

## Provider inventory and selection

The pre-implementation inventory classified the available backends as follows:

| Candidate | Classification | Decision |
| --- | --- | --- |
| Video Orchestrator Polly | B — narration-specific AWS/S3/video adapter | Rejected; not a Jarvis provider |
| Azure speech/media path | B/C — separate media capability | Rejected; no Jarvis adapter |
| FluidVoice | C — retained personal external capability | Not inspected or integrated |
| macOS `say` | B/C — local OS process | Not selected; unnecessary server coupling |
| Browser `SpeechSynthesis` | A — client-local, feature-detectable effect | Selected |
| Piper/eSpeak/Kokoro | D — no Brain adapter | Not introduced |

Browser-native `SpeechSynthesis` is the smallest safe transport: it requires no
credentials or network, is activated by an explicit user gesture, and exposes
local cancellation. It does not imply a model, provider, AgentRuntime,
Harness, capability grant, or Brain authority.

## Canonical input and contract

The only production input is the strict Brain Core response returned by:

```text
GET /agent-mode/jarvis/responses/:rootGoalId
```

The Console validates `agent-mode.jarvis-user-response.v1` and passes the
validated response object to `BrowserJarvisSpeechTransport`. The transport
speaks exactly `response.text`; it does not accept a separate text argument.
Worker output, K4/K5 raw facts, prompts, reasoning, provider payloads, and
caller-authored arbitrary text cannot enter the speech path. Worker speech is
not exposed.

The narrow request/receipt contract is versioned as
`agent-mode.jarvis-speech-request.v1`. Its provider identity is
`browser-speech-synthesis.v1`, effect classification is
`CLIENT_LOCAL_EFFECT`, and playback states are bounded:
`idle`, `starting`, `speaking`, `interrupted`, `completed`, `failed`, and
`unavailable`. `deriveJarvisSpeechOutputId()` deterministically combines the
canonical response ID with the transport version; no random or process ID is
used. The browser-local receipt is an effect observation, not a durable Brain
result ledger.

## Playback, interruption, and replaceability

`Speak` is enabled only for a loaded canonical response and is triggered by an
explicit click. A new explicit speak cancels any prior local utterance. `Stop
speaking` calls only `SpeechSynthesis.cancel()` and leaves Brain tasks, runs,
attempts, budgets, agents, and cancellation authority unchanged. Generation
fencing makes interruption win over late completion/error callbacks. A failed
speech effect is reported locally and does not alter the canonical response or
worker state. A later explicit Speak reuses the same response and deterministic
output identity; it does not rerun K5 or any worker.

The transport depends on narrow `SpeechSynthesisLike` and utterance factory
interfaces. Tests replace the browser implementation with a deterministic fake;
no live speech device, model, or external provider is needed for unit coverage.
Unsupported browsers produce explicit `unavailable` state while leaving the
canonical text readable.

## Persistence, multi-client, and security

No TTS table, audio file, playback cache, delivery record, or server playback
ledger is added. Canonical response durability remains in the existing Brain
StateStore; speech state is intentionally ephemeral per browser tab. Multiple
clients read the same Brain response and may independently perform the same
local effect without changing authoritative state. There is no new auth or
capability boundary because there is no new server mutation or speech service.

The client bundle contains no secrets, credentials, environment values, raw
prompts, hidden reasoning, provider request/response bodies, or filesystem
paths. There are no AWS, Bedrock, MiniMax, GLM, Opus, Codex, SSH, BrainNode,
Harness, Workcell, repository, or network operations.

## Validation

| Check | Result |
| --- | ---: |
| Brain Console speech/schema focused tests | 14/14 passed |
| Brain Core V0/K5/observer/StateStore/scheduler regression set | 74/74 passed |
| Brain Core typecheck | passed previously and unchanged by C2 |
| Brain Core build | passed previously and unchanged by C2 |
| Brain Console typecheck | passed |
| Brain Console production build | passed; `/agents` included |
| `git diff --check` | clean before final staging; rerun after docs |

The isolated Console visual check used the C2 checkout on port 4882. At the
default desktop viewport the Agents navigation, summary cards, read-only
operator area, and Agent Mode content remained inside the layout. At 390×844,
the two-column navigation and operational cards remained usable without
overlap. The local Brain Core service on port 4877 is an older build without
`GET /agent-mode/console` and the response route, so live data and audible
device acceptance could not be exercised there; the page correctly rendered an
explicit unavailable state. This is a validation-environment limitation, not a
speech failure. Live audible acceptance is therefore classified **B**: the
supported transport and deterministic tests are complete, while manual browser
audio acceptance remains deferred.

## V0-C closure matrix

| Requirement | Result |
| --- | --- |
| canonical Jarvis response only | PASS |
| exact text, Jarvis-only speaker | PASS |
| safe replaceable provider boundary | PASS — browser-local adapter |
| deterministic output identity/idempotent replay | PASS |
| explicit playback states | PASS |
| interrupt-only local effect | PASS |
| interrupt wins callback race | PASS |
| failure/unsupported isolation | PASS |
| no worker speech | PASS |
| no model/provider/network effect | PASS |
| no audio retention or delivery ledger | PASS |
| desktop/narrow layout check | PASS |
| live audible device acceptance | DEFERRED — classification B |

V0 remaining-gap matrix: microphone/push-to-talk, STT transport, canonical
response generation, and C2 speech output are complete; wake word remains
roadmap-deferred; the broader voice gateway phase audit remains. The exact next
bounded task is **V0-D — Jarvis Voice Gateway Phase Exit Audit**.

## Side-effect counts

```text
live model calls: 0
ModelGateway calls: 0
AgentRuntime calls from C2: 0
Harness launches: 0
AWS/Bedrock/MiniMax/GLM/Opus/Codex calls: 0
BrainNode calls: 0
Workcell operations: 0
network/provider probes: 0
Brain lifecycle/budget/task/agent mutations: 0
durable TTS/audio records: 0
```

## Conclusion

V0-C2 and V0-C are complete for this bounded implementation. Brain now has a
deterministic, replaceable, browser-local Jarvis speech output over the
canonical Brain-owned response, with transport-only interruption and no new
authority. V0 remains in progress. Do not start V0-D automatically.
