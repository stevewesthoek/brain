# Agent Mode Progress

## Agent Mode architecture handoff — 2026-09-08

The next Brain phase is Agent Mode / Bring Brain Alive. The authoritative plan is
`operations/specs/agent-mode-runtime-roadmap.md`; the discovery evidence is
`operations/reports/agent-mode-discovery-2026-09-08.md`. Principal review:
`operations/reports/agent-mode-astra-review-2026-09-08.md` — **APPROVE WITH CHANGES**.

### Agreed architecture

- Brain is the deterministic control plane: durable agents/tasks/runs/attempts,
  append-only events/evidence, scheduling, leases, budgets, approvals, recovery,
  node/capability registry, and agent-spawn policy.
- Jarvis is the persistent human-facing executive agent, not the kernel. Jarvis
  may eventually create worker identities autonomously, but deterministic policy
  limits roles, capabilities, budget, TTL, spawn depth, concurrency, scope, and
  kill switches.
- Initial Bedrock intelligence policy is fixed to MiniMax M2.5 → GLM-5 → Claude
  Opus 4.6. It is capability-driven rather than a forced retry chain.
- Autonomous work defaults to Amazon Bedrock. Codex remains a separate
  ChatGPT-subscription-backed runtime/resource whose quota state is observable;
  automatic Codex use must preserve a configurable reserve for manual use.
  Unknown/stale quota denies automatic admission; Bedrock errors never silently
  spend the Codex reserve.
- The generic Bedrock provider/transport must migrate away from legacy
  `claude-bedrock` naming toward `amazon-bedrock`, with
  vendor/model identity separated from transport.
- Core portability seams are `StateStore`, `ModelGateway`, `AgentRuntime`,
  `ExecutionResource`, `CapabilityProvider`, and `BrainNode/NodeTransport`.
  SQLite WAL is the first StateStore implementation, not the architecture.
  ExecutionResource and BrainNode are descriptors; NodeTransport stays thin.
  Reuse infrastructure resource/account/runtime-profile/credential identities
  rather than creating a second catalog. Use one controller with private local
  state outside checkouts; remote nodes never share its SQLite files.
- Enforce every model/tool/child operation at the gateway/broker/node boundary,
  including runtime built-ins and auxiliary model calls. Atomically record
  claims, budget reservations, fenced leases and dispatch outbox entries;
  deduplicate receipts and preserve uncertain outcomes without blind replay.
  Safety/recovery gates apply from the first fixture, not only final hardening.
  Opaque subscription runtimes use declared whole-attempt resource controls;
  deny tasks needing finer controls their supported interface cannot enforce.
- Office is the first BrainNode. MacBook must be the second instance of the same
  portable protocol after read-only inventory/connectivity succeeds. A future
  VPS/macOS/Linux deployment must not require domain-model rewrites.
- Brain Console is the primary dashboard/control surface; Obsidian/Mind, IDEs,
  CLIs, and optional specialist UIs remain complementary clients over durable
  Brain APIs/events. Voice is a transport over Jarvis, not a parallel agent
  control plane.

### Upstream reuse policy

- DeepSeek Harness decision: **USE PARTIALLY**, through a pinned, restricted SDK
  composition only after admission fixtures and an integration spike pass.
  Default/minimal profiles are not safe Brain policy boundaries as shipped.
  Reuse loop/tool/context/session mechanisms, not its scheduling/organization
  authority. If conformance fails, build only the missing minimal runtime.
- OmniRoute is an optional `ModelGateway` candidate/reference for quota/cost/
  health-aware routing. Native Amazon Bedrock remains the v1 reference gateway
  without requiring an OmniRoute prototype in A0. Current bearer-key Bedrock
  authentication and feature fidelity need proof before any later adapter use.
- Orca contributes fleet/worktree/remote/usage UX patterns; Brain Console remains
  the control plane.
- Omarchy contributes agent-friendly OS/event integration patterns, not Brain's
  orchestration kernel.

### Local inference policy

Cloud-only applies to general-purpose/text LLM reasoning, not to every local ML
capability.

Cleanup targets after exact dependency checks are Ollama, MTPLX/Qwen local text
routes/tooling, oMLX/Gemma text serving, LM Studio text-model residue, local
text-model weights/caches, stale launchers, and current operational references.
Video Orchestrator's previous oMLX text dependency is not a retention reason; it
will use cloud text inference when that product is resumed.

Known non-text capabilities are separate:

- FluidVoice local MLX voice stack: **keep**; active personal voice use.
- MLX Whisper large-v3: **keep while consumed**; the nightly Bible Studies
  transcription pipeline explicitly invokes it.
- `faster-whisper`: **separate media capability**; installed/referenced for Video
  Orchestrator subtitle/transcription work, not part of text-LLM cleanup.
- ComfyUI/local image generation: **separate media capability**; registered and
  referenced by video/image workflows, requiring its own current-use audit
  before any removal.
- Historical Stable Diffusion/Wave/FLUX/Roop-era local media references must be
  classified individually rather than swept into text-LLM cleanup.

MacBook local-model/media state is still unresolved. Do not infer its inventory
from Office and do not perform cleanup there until read-only host inventory
succeeds.

### Current implementation order

1. **A0 — minimal contracts + runtime admission spike**
2. **A1 — staged generic Amazon Bedrock/provider normalization**, alongside K0
3. **K0 — durable Brain kernel + local BrainNode envelope**, using canonical IDs/mocks
4. **K1 — model/resource gateway**
5. **K2 — one Jarvis + one worker + one read-only capability**, with minimal human controls
6. **N0 — remote extension of the same BrainNode protocol**
7. **K3 — safe coding autonomy/worktrees**
8. **K4 — event-driven autonomy + bounded dynamic workers**
9. **K5 — multi-agent organization**
10. **U0 — unified Brain Console control surface**
11. **V0 — Jarvis voice gateway**
12. **D0 — distribution / VPS / commercial extraction options**
13. **H0 — long-duration soak/release gate**; safety checks apply throughout

A0.1 **offline attempt-admission contracts and adversarial conformance fixtures**
is complete (principal review, section 14). A0.2's restricted ephemeral
overlay passes the pinned Harness SDK read-only, denied-shell, single-provider,
cancellation, and crash-after-effect reconciliation checks. The shipped
`sdk-minimal` base is still `danger-full-access` and includes
shell/filesystem/jobs surfaces, so upstream base adoption is **denied** while
the restricted replay proof is **passed**. Durable effect journaling belongs
to K0's SQLite StateStore. A1.1 completed the staged canonical provider
migration. A1.2 also keeps Bedrock selection side-effect-free:
selection reads cached evidence only, while explicit health probing remains
separate. A1.3 removed Qwen/Haiku assumptions from repo/session launchers.
K0.1 provided the fixture-backed SQLite-WAL StateStore foundation with
transaction rollback, lease fencing, and effect idempotency tests. K0.2 now
extends that same store with durable task/run/attempt admission, run-scoped
budget reservation and settlement, effect/outbox/receipt journaling,
cancellation state, stale-fence protection, append-only evidence and
restart-safe crash recovery classifications. K0.3 now adds the portable,
non-listening local BrainNode command/receipt envelope, deterministic fixture
authentication, canonical resource/worktree containment, and one bounded
`repo.read` capability with node-side grant/scope/policy/deadline/cancellation/
fence/outbox enforcement plus durable receipt reconciliation. K0.4 now adds a deterministic mock AgentRuntime, typed broker-to-
BrainNode execution, durable verification/settlement/terminal state,
crash/reopen recovery, and a versioned read-only StateStore observer projection.
Existing approval/snapshot surfaces remain explicitly compatibility data. K0 is
complete for the offline fixture/kernel gate; live execution remains gated.
K1.1 is complete for the native Amazon Bedrock ModelGateway plus account/model
access verification; the next task is K1.2 model-tier routing, budget, health,
and escalation policy. Do not begin K1.2 automatically. K0 must pass before
K1/K2 live admission; a full historical rename or paid three-model matrix does
not block mocked kernel work. C0 local-text cleanup is a separate manifest-first
lane and may not remove non-text media capabilities without their own consumer
classification. Tailscale is an optional network overlay, not a node transport;
a VPS is a deployment location. The local envelope exists before live execution.

### K1.1 — native Bedrock gateway and access verification (2026-09-08)

K1.1 is complete for the native gateway/access gate. The exact MiniMax M2.5,
GLM-5, and Claude Opus 4.6 identities were catalog/model-card verified in
`us-east-1`; the US Opus inference profile was active; and one tiny authorized
Converse probe was run for each target. The redacted identity/region/route/
freshness evidence is recorded in
`operations/reports/agent-mode-k1-1-evidence-2026-09-08.md`.

Brain Core now owns an admitted-only, transport-swappable ModelGateway over the
bounded managed AWS CLI Converse transport. It rejects arbitrary model routes,
stale or mismatched access evidence, expired deadlines, and provider failures
with bounded classifications. It normalizes usage/route/region/latency and
final text, explicitly excluding MiniMax reasoning-content blocks. Existing
ordinary model selection remains read-only with no incidental AWS probe;
selection is still disabled for the Agent Mode portfolio pending K1.2 policy.

Validation: 12 focused gateway/portfolio/managed-provider tests passed, 55
model-selector tests passed, registry/local-text validators passed, Brain Core
typecheck passed, and scoped diff checks were clean. K1 is not complete.

Exact next task: **K1.2 — model-tier routing, budget, health, and escalation
policy**. Do not start it automatically.

No destructive host cleanup, AWS access mutation, billable model probe, or
commit is authorized by this handoff alone.

## Historical maintenance handoff — 2026-08-14

The following records the product-specific maintenance state at that date, not
the new Agent Mode provider policy. Preserve its outstanding retention gates.

The configuration/local-AI and two-host activation tranche is maintenance only.
Infinite Brain remains closed; do not reopen roadmap or feature work from this
handoff.

## Implemented state

- Office and MacBook canonical Brain checkouts contain the same activation line.
- Office application runtime roots are physical, machine-local directories;
  intentional narrow configuration entries are Git-managed.
- Codex keeps a physical `~/.codex` runtime root. Durable entries are symlinked;
  `config.toml` is an owner-only generated copy with the current account home
  rendered locally.
- Codex auth, sessions, thread index, databases, plugins, caches, and Computer
  Use bundles remain local-only.
- Office connectivity has exactly two repository routes: Thunderbolt preferred
  (`office-repos-tb`) and Tailscale fallback (`office-repos-ts`). The obsolete
  Office LAN route was removed from Git and MacBook Codex connection state.
- Brain-managed MTPLX/Ollama always-on text routes are retired. Bedrock is the
  primary managed text route and Codex CLI the secondary route.
- Private Mind classification is pinned to `amazon-bedrock` and
  `us.anthropic.claude-sonnet-4-6`, with private/sensitive flags and no fallback.
- The private Mind request uses a unique mode-`0600` temporary request file;
  capture text is not present in process arguments and cleanup runs in `finally`.
- The active video analyzer uses Bedrock-primary/Codex-secondary routing and no
  local OpenAI-compatible text endpoint.
- Structural Graphify execution is retired. The bounded semantic event gate has
  no default model.
- The retired Mind decomposer remains a fail-closed compatibility stub.
- Mind's unrelated `.obsidian/**` and `kanban.md` working changes were preserved.
- The dirty Video Orchestrator feature worktree was preserved, restored as a
  healthy `feature/video-orchestrator` Git worktree at its original path, and is
  not part of this maintenance closeout.
- Obsolete clean maintenance worktree directories `brain-next` and
  `brain-host-activation` were verified empty of modified/untracked work and
  removed after their commits were confirmed in `main`.
- Herdr `0.8.0` remains application-local; one obsolete
  `ui.agent_panel_scope` key was backed up and removed, and `herdr config check`
  now reports `config: ok`.

## Activation evidence and remaining retention gate

The final activation run ID is `20260814T155610Z-26638`.

- Office receipt state is `8 OFFICE_CONNECTIVITY_PASS`.
- MacBook receipt state is `6 MACBOOK_CONFIG_ACTIVE`.
- The original MacBook application acceptance recorded Codex/Remote SSH as
  failed or declined.
- A later bounded follow-up repaired Codex Remote SSH to the two-route model and
  verified both SSH aliases, but it did not rewrite the original receipt as a
  fabricated phase-10 PASS.

Operational behavior is working, but the formal rollback-retention gate is not
closed. The Video Orchestrator archive dependency has been cleared by the
verified worktree rescue. Retain the final Office and MacBook receipt directories
and the old dirty canonical Brain archive until:

1. manual Codex/Remote SSH acceptance is explicitly recorded;
2. matching final receipt closure is documented honestly; and
3. the setup survives one normal reboot plus a representative application
   update, or 14 days elapse after formal acceptance, whichever is later.

For the 2026-08-14 acceptance window, the calendar component is no earlier than
2026-08-28. Do not delete the final rollback set before the observation and
acceptance conditions above are also satisfied.

Failed pre-mutation and rolled-back run copies are not part of this final
rollback set and may be removed after their exact paths and sizes are recorded.

## Restore model

Git restores intentional, reproducible, non-secret configuration. A rebuilt Mac
still requires normal sign-in or an encrypted external backup for SSH private
keys, AWS credentials, application auth, Codex/Claude sessions, local databases,
and other `LOCAL-ONLY` state. Those items must never be reconstructed from Git.

Use:

- `operations/runbooks/workstation-config-ownership.md`
- `operations/runbooks/codex-managed-runtime-root.md`
- `operations/runbooks/host-activation.md`
- `operations/scripts/brain-configs-link.sh`
- `operations/scripts/codex-home-managed-root.sh`

Application upgrades may change local generated/runtime state. Never replace a
whole runtime root with a symlink and never copy app-build hashes, marketplace
timestamps, caches, auth, or sessions into Git. Promote only reviewed durable
settings into the portable baseline.

## Resume rule

Before any further backup or worktree deletion, inspect current Git status,
receipt state, active worktrees, and the closeout report. Do not delete the final
rollback set or the Video Orchestrator worktree merely to reclaim space.
