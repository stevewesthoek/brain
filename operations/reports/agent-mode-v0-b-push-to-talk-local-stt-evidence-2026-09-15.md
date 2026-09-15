# Agent Mode V0-B Evidence — Durable Jarvis Push-to-Talk and Local STT

Date: 2026-09-15

## Status

V0-B — Durable Jarvis Push-to-Talk and Local STT: COMPLETE.

V0 remains IN PROGRESS. No V0-C work was started.

Starting HEAD was `63be0b37 feat(agent-mode): add deterministic voice gateway`.
The V0-A voice gateway, K0–K5 contracts, and the read-only U0-A Agent Mode
Console surface were present before this slice. The protected unrelated
working-tree paths remained outside the change set.

## Durable intake contract

`JarvisTextIntakeService` is the single typed/voice intake service. It accepts
the versioned `agent-mode.jarvis-text-intake.v1` command, canonicalizes text,
derives stable hashes and a root goal ID, and records the intake, Jarvis
ownership, and root task atomically in the existing `AgentModeSqliteStateStore`.

The persistent Jarvis identity is the closed `agent:jarvis` agent. Intake
ownership binds each root through the durable intake record and root task; an
existing Jarvis agent is never silently rebound to another root. Raw text is
not stored. Durable records contain only bounded hashes, IDs, source, operator,
timestamps, and canonical lifecycle references.

The store uses the existing WAL/transaction/`BEGIN IMMEDIATE` conventions and
schema version 9. The intake uniqueness constraints make replay idempotent and
conflicting reuse fail closed. Close/reopen reconstructs the same intake, root,
Jarvis ownership, and observer/console projection.

## Authenticated Core boundary

`POST /agent-mode/jarvis/intake` is a contained Brain Core mutation with the
narrow `agent-mode.intake` service capability. Service HMAC authentication and
bounded request validation happen before the body is admitted. The route accepts
only the typed intake fields and rejects forged root/task/policy/model/runtime,
credential, shell, repository, and capability fields. It uses the authenticated
Core request timestamp as the injected received-at value.

The browser never receives the Core service secret and never calls SQLite,
AWS, or a model provider. The existing `/agent-mode/observer` and
`/agent-mode/console` read paths remain unchanged.

## Local MLX Whisper adapter

`MlxWhisperSpeechToTextProvider` implements the existing speech-to-text
boundary. It requires explicitly configured absolute executable, model, and
owner-only resource-lock paths; it never downloads models or probes the
network. Process execution is `shell: false`, bounded by a 30-second timeout,
bounded stdout/stderr, and a deterministic JSON transcript contract.

WAV input is bounded to 8 MiB and 30 seconds, with header/channel/sample-rate/
bit-depth validation. Temporary uploads are created in an owner-only temporary
directory and removed in a `finally` path. The lock admission fails closed when
the MLX resource is unavailable, preventing uncoordinated overlap with the
existing local MLX workload. No Bible Studies scripts or runbook were changed.

The adapter is classified as deterministic process-fixture acceptance (B), not
live host acceptance. Live MLX execution remains deferred until safe shared
resource coordination is explicitly established.

## Console push-to-talk flow

The `/agents` page now includes an explicit authenticated Push to talk control.
Microphone access begins only after the click. The bounded client recording is
sent through the existing authenticated Console server proxy, transcribed by
the Core-configured local adapter, and displayed for review in a bounded text
area. Submit is a separate explicit action; Discard clears the draft without
creating an intake. There is no wake word, background recording, TTS, Jarvis
chat, or lifecycle control mutation.

The proxy derives the intake ID from the request identity and source, forwards
only the typed intake contract, and validates the bounded response with Zod.

## Security and side-effect review

The change adds no model/runtime control plane and no second result or task
ledger. It does not call AgentRuntime, ModelGateway, Bedrock, MiniMax, GLM,
Opus, Codex, Restricted Harness, BrainNode, Workcells, AWS, SSH, Tailscale, or
external network services. It does not persist prompts, hidden reasoning,
provider payloads, credentials, environment values, or raw audio after the
request cleanup path.

The only direct task/agent inserts are the atomic canonical Jarvis root-intake
records, not K4 child execution records. No child worker, run, attempt, budget
reservation, scheduler mutation, approval mutation, or repository mutation is
created by reading or transcribing through the Console.

## Validation evidence

Focused Core tests:

- V0-B intake route, durable intake/restart, and MLX fixture tests: **5/5 pass**.
- V0-A voice gateway and service-auth regressions: **16/16 pass**.
- All Agent Mode tests: **429/429 pass**.
- StateStore/K4 scheduler regressions after schema-version expectation update:
  **23/23 pass**.
- Brain Core typecheck: **pass**.
- Brain Core build: **pass**.
- `git diff --check`: **pass**.

Brain Console tests and checks:

- Canonical projection/Zod schema tests: **9/9 pass**.
- Brain Console typecheck: **pass**.
- Brain Console production build: **pass**; the build includes `/agents`,
  `/api/agent-mode/jarvis/intake`, and `/api/agent-mode/jarvis/transcribe`.

The full Brain Core suite was run after the migration assertions were updated:
2,564 tests total, **2,561 pass and 3 fail**. The three failures are the known
unrelated `agent-orchestrator.test.js` timing failures. An earlier full run
also exposed two stale schema-version assertions expecting version 8; those
were updated to the intentional schema version 9 and the affected 23-test
regression set is green. The three orchestration timing failures are
pre-existing and outside V0-B; no V0-B or K4-focused test failed.

Visual inspection of the already-running local Console confirmed the sidebar,
Agents navigation, compact summary layout, tabs, and bounded table containers
remain usable at desktop width. That service was an older running build and did
not include the new push-to-talk panel, so live visual acceptance of the new
panel was not claimed. No service restart or deployment was performed.

## V0-B completion decision

The bounded V0-B gate passes: typed and authenticated push-to-talk intake share
one durable idempotent Brain-owned contract; local STT is explicit, bounded,
resource-coordinated, and fail-closed; the Console flow requires review and
explicit submit; restart and replay preserve durable identity; and no live
model/tool/network/runtime effects were introduced.

Exact next bounded slice: **V0-C — Durable TTS, Interruptible Playback, and
Voice Response Lifecycle**.
