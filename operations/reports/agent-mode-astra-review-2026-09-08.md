# Brain Agent Mode — principal architecture decision

Date: 2026-09-08. Scope: architecture review only; no runtime implementation or
live-provider validation. Primary packet: the full runtime roadmap, progress
handoff and discovery report. The newer roadmap's cloud-text and media-retention
decisions intentionally supersede conflicting discovery recommendations.

## 1. Verdict

**APPROVE WITH CHANGES.** This is the right foundation for a personal system,
two execution hosts and a later single-controller VPS deployment. Brain should
own durable work and authority; Jarvis should own the relationship; replaceable
runtimes should supply reasoning loops. Replacing Brain with a harness, gateway
or terminal fleet manager would lose the strongest part of the design.

The missing foundation is an **enforced attempt/effect protocol**, not more agent
roles. A plugin seam does not prove tool confinement; an append-only transcript
does not prove safe replay. Make admission, budget reservation, fenced execution,
receipt reconciliation and cancellation one tested boundary before live work.

Material changes are incorporated into the roadmap and progress handoff. This
approves architecture direction, not installation, production authority or an
unattended runtime. Account access for the three target models remains a later,
separately admitted prerequisite; this review made no billable calls.

## 2. Architecture assessment

The existing system supplies useful adapters and contracts, but not yet this
durable execution kernel. Targeted implementation checks establish the gap:

| Current evidence | Consequence |
|---|---|
| `operations/system-configs/model-selector/runtime/core.py`: `_load_config` retains legacy selection authority; the consolidated registry is parity-only. `_pick_bedrock_model` calls `_bedrock_access_status` before admission/allow-list filtering; that function can run `aws bedrock-runtime converse`. | The selector is the right policy owner, but selection is not currently a pure/read-only decision. A registry-only edit cannot complete migration. |
| Same file: access cache key is region/model; exploratory ranking can choose among top candidates; failure handling includes provider-wide exclusion/circuit state. | Identity, freshness and failure scope need correction; fixed portfolio policy cannot inherit exploratory or blanket-provider fallback behavior. |
| `projects/brain-core/src/adapters/managed-text-executor.ts` defaults to legacy Bedrock followed by Codex. `managed-provider-executor.mjs` returns text, uses environment-derived region and loses structured response metadata. | These are migration seams, not an agent-ready ModelGateway. Bedrock failure must not silently consume manual Codex capacity. |
| `agent-executor-plan.ts` conflates executor/provider identity. `agent-orchestrator-executor.ts` keeps results/ledger in memory and calls `updatePlan` only after the task loop. | Extend surrounding contracts; replace the execution bookkeeping path for Agent Mode rather than treating it as restart-safe. |
| `agents.ts`, `agent-runs.ts`, `agent-ledger.ts`, `agent-task-state.ts` contain static/derived projections and JSON snapshots. `agent-ledger-writer.ts` separately appends JSONL and returns a boolean on failure. | Existing routes can become compatibility observers; they are not the authoritative task/event transaction. Its unkeyed SHA-256 “signature” is not node authentication. |
| `approval-store.ts` can be in-memory; orchestrator approval persistence catches errors. `agent-capabilities.ts` describes grants rather than enforcing every tool path. | A successful return or metadata safety label is not durable authorization. Fail closed on persistence failure. |
| `infinite-brain-exact-scope-approval.ts` and `infinite-brain-typed-capability-worker.ts` already express scope, approval, ownership and receipt constraints in bounded fixtures. | Reuse and test these patterns; do not duplicate the policy vocabulary or mistake fixture maps for durable production machinery. |
| `operations/infrastructure/catalog/README.md`, `infrastructure-identity-access-v1.schema.json`, and `infrastructure-plane.mjs` already separate stable resources, accounts, application sessions, runtime profiles, opaque credentials and observations. | Agent Mode should reference these identities. A second host/account/credential catalog would be a concrete architectural regression. |

Keep these minimum boundaries; do not turn every noun into a service:

| Contract | Decision |
|---|---|
| `StateStore` | Keep transactional domain operations: claim/reserve/dispatch, reconcile receipt, settle attempt, append audit and update projection. Avoid a generic CRUD interface that hides atomicity requirements. |
| `AgentRuntime` | Keep attempt lifecycle, progress, cancellation, trace and declared supported controls. Distinguish delegated model routing from an opaque subscription runtime. |
| `ModelGateway` | Keep typed invocation/streaming over an already admitted selector decision. No second independent model-ranking engine. |
| `CapabilityProvider` | Keep typed, scoped operation execution and receipts. The broker checks policy; the node enforces the actual execution perimeter. MCP may adapt this contract, not replace authorization. |
| `ExecutionResource` | Keep as data: runtime/node/account/profile references, capacity, quota evidence and admission policy. Do not create another executable abstraction. |
| `BrainNode` | Keep as an execution descriptor referencing infrastructure identity, capability manifest, protocol version and health evidence. Not another host-management plane. |
| `NodeTransport` | Keep thin local/remote command-and-receipt delivery. No new generic message-bus framework before a second transport exists. |

Missing fields belong in these contracts, not in new frameworks: operation ID,
causation ID, immutable scope/input hash, policy/grant version, lease fence,
deadline, verification contract, evidence reference and explicit delivery state.
Keep Agent, Task, Run and Attempt distinct; derive current task/children/cost
views rather than duplicating independently writable state on every agent object.

## 3. Five critical changes, in priority order

1. **Close runtime bypasses.** Model overrides, compaction/title calls, built-in
   shell/filesystem tools, code mode, schedules, subagents and background jobs
   must not bypass Brain grants or budgets. Deny them initially or prove their
   equivalent enforcement. No ambient credential/home access; constrain reads,
   egress and descendant processes, not merely workspace writes. Jarvis is also
   a caller subject to these controls. An in-process tool callback is not an OS
   security boundary.
2. **Specify effect recovery, not just task replay.** Claim/reserve/lease/outbox
   must be atomic before dispatch. Deduplicate receipts by operation ID and
   commit them with state/events. A crash after remote success but before receipt
   persistence produces an uncertain outcome, not permission to retry. Reconcile
   or require review. Fence stale node writers; a database TTL cannot stop a
   running shell. Cancellation is pending until node/process-tree acknowledgement
   or isolation, not merely a changed task status.
3. **Make admission authoritative end to end.** Selection must never probe
   forbidden candidates. Separate model access, resource health, subscription
   quota and task quality. No hidden selector exploration, runtime escalation,
   provider fallback or gateway retry multiplication. Preserve one audited route
   decision and aggregate budget across every retry and child.
4. **Move a minimal node boundary into K0.** Live capabilities cannot precede the
   execution protocol that confines them. Start in-process/local transport with
   the same envelope remote nodes will use. Reference the existing infrastructure
   identity catalog, keep machine bindings in configuration, and use one active
   controller/database. N0 becomes remote delivery/reconnect, not the first
   definition of safe local execution.
5. **Reduce prerequisites; move controls earlier.** Test a narrow contract before
   freezing it. Run staged A1 alongside fixture K0. Remove a mandatory OmniRoute
   prototype and paid three-model matrix from the first slice. Supply minimal
   human intake/inspect/pause/cancel controls by K2; apply safety gates throughout,
   with H0 reserved for long-duration soak and release readiness.

## 4. What remains unchanged

The fixed initial portfolio, cloud-only text policy, retained media capabilities,
one Jarvis relationship, one initial worker, structured delegation, provider
neutrality, Codex membership, native Bedrock default, Console primacy, late voice
and manifest-first C0 are correct. No additional runtime, model tier, workflow
engine or mandatory cloud service is needed now.

Retire owned Ollama, MTPLX/Qwen, oMLX/Gemma and LM Studio text paths only after
dependency checks and separate cleanup authorization. Keep active FluidVoice,
MLX Whisper large-v3 for nightly Bible Studies, faster-whisper as a separate
Video Orchestrator media capability and ComfyUI under its own media audit.
Never delete a mixed Hugging Face cache wholesale. MacBook inventory remains
unknown until reachable. This review neither redesigns Video Orchestrator nor
changes private Mind policies, Infinite Brain closure or retention gates.

## 5. DeepSeek Harness decision

**USE PARTIALLY.** Prefer its reusable agent loop, typed tool dispatch,
context/session handling and SDK behind `AgentRuntime`; do not admit its stock
application or its own organization, global scheduler, budget authority or task
store. Adoption is conditional on a restricted composition passing A0, not on
installing it and trusting its defaults.

Reviewed pin: `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`.

- Cordis services/plugins and filesystem/subprocess adapters are genuine reuse
  points. Model requests, tool interception and session persistence are separable.
  Reusing them can avoid building another generic agent loop and context engine.
  Headless/SDK modes exist. [Architecture][h-architecture]
- Default profiles layer substantial functionality. Even `sdk-minimal` selects
  `danger-full-access`, bare local filesystem, shell, jobs, an LLM and retry
  plugin; user/home patches can apply above it. It is **not** a restricted Brain
  fixture profile. Build an explicit allowlisted composition and isolated runtime
  home; record its resolved configuration/hash. [Minimal profile][h-minimal]
- Sandbox policy currently describes filesystem effects; network access and
  process visibility are outside that vocabulary. The project explicitly states
  developer-preview/security-audit limitations. A filesystem read-only mode alone
  cannot protect personal files or credentials from exfiltration.
  [Sandbox][h-sandbox], [Safety notice][h-safety]
- The TypeScript SDK's collected result covers an accepted-message-to-idle
  interval, not necessarily one causally exclusive prompt if steering/concurrent
  input occurs. Use one exclusive session per attempt. Runtime session/attempt
  settlement is not a pre-effect Brain journal; hard-crash replay requires Brain
  receipts. Pin SDK and runtime together, set deadlines explicitly, and retain
  only necessary trace evidence. [SDK][h-sdk], [Architecture][h-architecture]
- Subagent capability flags/tool filters are useful machinery, but Brain owns
  child admission; disable autonomous subagents initially. Session-local
  scheduling delivers later conversation turns, not Brain's global work/budget
  scheduler. Its storage seam and replay logs remain runtime-local evidence.
  [Subagents][h-subagents], [Schedule][h-schedule], [Storage][h-storage]
- The Pi-AI integration has native catalog-provider behavior, including a
  distinct Bedrock route rather than generic OpenAI headers. This does **not**
  prove the three target models work with Brain's selected account/profile or
  preserve all tool/reasoning/usage fields. Brain's gateway must own the admitted
  call; do not inherit provider credential lookup or an independent retry policy.
  [Pi-AI integration][h-pi], [Provider implementation][h-provider]

A0 must collect reproducible offline evidence for: exact resolved plugin set;
one mocked model/tool attempt; lossless tool IDs/results/stop/usage; rejection of
model overrides and auxiliary calls; denied direct/indirect tool paths; exclusive
attempt correlation; bounded parent/child process cancellation; and interrupted
effect reconciliation. Test both macOS and Linux boundary assumptions in the
contract, without claiming a platform passed until executed there.

If the spike cannot enforce the boundary without a broad fork, choose a minimal
Brain runtime implementing only the failed necessary mechanisms. Do not spend
an open-ended phase adapting a preview. Runtime upgrades must replay conformance
fixtures before admission; opaque old traces retain their original version.

## 6. OmniRoute decision

**Keep optional; native Amazon Bedrock is the default/reference gateway.**
With three fixed models and an existing selector, mandatory OmniRoute would add
another routing policy and operational dependency without a demonstrated need.

Reviewed pin: `ba597b631d22d85e56db6982f24b7d1ebe238df9`.

The current Bedrock executor uses the AWS SDK's Converse/ConverseStream but
constructs a bearer-token client from `credentials.apiKey` with
`authSchemePreference: ["httpBearerAuth"]`. Its model listing is also bearer-key
based. That is not a drop-in replacement for Brain's existing AWS CLI credential
chain; don't create/change credentials to make a speculative adapter fit.
[Executor][o-bedrock], [Catalog service][o-catalog]

The executor translates OpenAI tool calls/results and sanitizes conversation
blocks; inspected reasoning conversion carries text without retaining all native
signature data. No complete structured-output equivalence for the target models
was established. Require transcript/tool-ID/stop/usage/cache/cancellation and
strict-output fixtures before adoption; reject unsupported requests explicitly
rather than silently normalizing away required evidence. [Executor][o-bedrock]

Its quota, health/headroom, cost and latency ranking, persistent circuit state,
telemetry and stickiness are useful references. However, unknown quota remains
eligible in its routing policy, and stickiness can reorder candidates. Context
window eligibility must remain a hard Brain admission check; ranking cannot
compensate for an incompatible model. Operational HTTP success is not verified
task quality. [Routing policy][o-policy], [Adaptive routing][o-adaptive],
[Stickiness][o-sticky]

A future adapter must accept a fixed admitted target, disable competing fallback,
shadow calls and cross-target stickiness, identify actual provider/model/account,
return full usage and keep sensitive payloads out of telemetry. Preserve the
gateway contract now; defer the adapter until a concrete portfolio/economic need
can justify its complexity. No mandatory OmniRoute bake-off blocks A0.

## 7. Model and execution-resource policy

**MiniMax M2.5 worker → GLM-5 senior → Claude Opus 4.6 principal is the correct
initial policy for the stated constraints**, not a proven universal quality
ranking. Start known complex work on GLM and principal/security arbitration on
Opus. Use verifier failures, scope/context need, conflicting evidence and bounded
failure history for escalation; model self-confidence alone is not a signal.
Keep the portfolio fixed. Do not substitute another catalog model.

Normalize `amazon-bedrock` transport, vendor (`minimax`, `zai`, `anthropic`),
logical model and exact invocation binding separately. The binding includes
account/credential reference, region and model ID or inference profile. Region
and data-handling restrictions must survive routing and escalation. Catalog
listing, configured profile and a callable account binding are distinct evidence.

Migration must cover the selector's **actual** legacy source configs, consumer
allowlists, provider comparisons, health/failure/cache keys and managed executor,
not only `ai-model-registry.json`. The legacy `claude-bedrock` alias can remain
at compatibility boundaries; new Agent Mode records use canonical IDs. Preserve
private Mind's product-specific historical Sonnet/no-fallback policy until its
owner separately migrates it. Relevant sources: selector `core.py`,
`ai-providers.json`, `ai-task-types.json`, `ai-model-registry.json`,
`managed-text-executor.ts`, `managed-provider-executor.mjs`, `agent-executor-plan.ts`.

Make model choice side-effect-free. Dedicated approved probes update
account/region/model-bound access evidence with a TTL. Unknown/stale access denies
live admission. Separate transport failures from semantic failures; scope circuit
breakers appropriately and count SDK/runtime/gateway retries against one total.
Changing model/runtime creates a new attempt with verified context/evidence;
do not blindly replay vendor-specific reasoning signatures across providers.

Codex is an `AgentRuntime` adapter used by a subscription `ExecutionResource`,
specializing in coding. It need not traverse ModelGateway when its supported
subscription interface owns model invocation. It must still obey Brain's task,
scope, budget/time, lease and result-verification envelope. Capability support
must be declared honestly; a runtime without enforceable fine-grained controls
gets a correspondingly narrower whole-process admission class.

Track `available | constrained | exhausted | unknown` quota with account/profile,
source, timestamp, reset window and reserve policy. Binary presence, nominal
zero marginal-dollar cost and stale UI observations are not usable headroom.
Unknown/stale means no **automatic** Codex start; a bounded human override is
explicit. The reserve is a conservative admission policy, not a provider-enforced
guarantee against concurrent manual account use; recheck at supported boundaries
and deny automatic work when its consumption cannot be bounded sufficiently.
No credential extraction, account rotation or second orchestrator is needed.
Bedrock is the default autonomous capacity; Codex stays available without
becoming the provider-error escape hatch or a fourth Bedrock tier.

## 8. Portability and BrainNode decision

The generic node idea is correct after three corrections: reuse infrastructure
identity; distinguish deployment/overlay from transport; and define authenticated,
versioned command/receipt admission before executing locally. Tailscale supplies
network connectivity; SSH/local are transport choices; VPS is a deployment site.
Reachability and observed health never confer capability permission.

Each command binds controller/node/attempt/operation IDs, admitted capability,
canonical resource/worktree IDs, scope hash, grant version, lease fence and
deadline. The node resolves allowlisted roots locally, rejects path/symlink
escapes and stale authority, bounds execution, and returns a deduplicable receipt.
Remote reconnect reconciles outstanding operations; it does not automatically
rerun them. A disconnected node may finish only already admitted bounded work;
no new autonomous work or lease extension without authority.

Use the existing infrastructure catalog/account/runtime-profile references and
host-connectivity runbooks; don't repurpose
`operations/specs/video-orchestrator/local-worker-nodes.schema.json`, which
currently hardcodes oMLX and VO task types. Retain product adapters without making
their schema the generic node contract.

Portable core needs no Office paths, personal repo names, fixed IPs, macOS-only
Keychain assumption or GUI-only control APIs. Keep personal Mind integrations,
secret custody, host roots and platform capabilities in installation profiles.
Another user's missing application is an unavailable capability, not a failed
core boot. Test alternate-user paths and Linux-shaped fixtures early.

All four reviewed upstream repositories have MIT license text at the recorded
pins. That is not a conclusion about every dependency, redistribution bundle or
provider/subscription right. Preserve notices, pin dependencies, and review
packaging/authentication terms before D0. Start single-user/BYO credentials;
multi-tenant hosted security is a separate design gate, not a free consequence
of `StateStore`. Do not expose local APIs directly on a VPS without authenticated
operator/node access and a reviewed threat model. [Harness license][h-license],
[OmniRoute license][o-license], [Orca license][orca-license],
[Omarchy license][omarchy-license]

## 9. Autonomy and safety decision

Bounded dynamic workers are sound **only with root-goal accounting**. Per-agent
limits alone allow serial TTL/recreation loops to spend indefinitely. Cap total
creations, aggregate tokens/dollars/tool steps, active descendants, escalation,
deadline and event redelivery for the whole root. Reserve capacity atomically;
settle observed usage, and retain conservative reservations for unknown usage.
Cap a call's possible output before sending it; billing telemetry alone is not
a hard stop. Unknown prices/usage cannot mean free work.

Retain template/role/parent/depth/TTL/capability/repo scope and kill-switch limits.
Children inherit the intersection of parent and template authority, never greater
authority. Killing a parent cancels its whole tree; respawning cannot reset the
root budget. Spawn permission, tool permission and approval-writing permission
are distinct. Neither Jarvis nor an auditor can grant itself higher authority.

Event-driven autonomy is right. Use source watermarks, causation/deduplication IDs,
debounce/cooldown, bounded retries and bounded missed-schedule catch-up. A no-op
heartbeat performs deterministic checks without a model. A task's own generated
events must not endlessly retrigger the same task. Structure requests/results
instead of free-chat; classify and isolate untrusted repository/web/tool content.

Avoid deadlock: parents waiting for children release worker slots and write
leases; resource acquisition uses a stable order. One writer per worktree is
necessary, not sufficient: shared Git refs/config and merge/commit operations
need repository-level serialization/authority. Isolated worktrees share some Git
state and external services. Readers use pinned revisions or detect drift;
verify preimages/dirty state before applying edits, including human edits.
Do not reap a stale lease or worktree until the old writer is stopped/reconciled.

## 10. Persistence decision

**SQLite WAL behind StateStore is a sound v1** for one active controller on one
host. Remote nodes use APIs; they do not mount the database. SQLite WAL supports
concurrent readers but one writer and requires same-host shared memory. Use a
supported, pinned SQLite version and explicitly choose durability settings.
[SQLite WAL documentation](https://sqlite.org/wal.html)

Use current-state tables plus transactional append-only audit/outbox history,
not a new event-sourcing framework that must replay every token to know a task's
status. Enforce unique operation IDs and compare-and-set versions. Agent intent,
admission, dispatch, receipts, verification and settlement must survive restart.
Disk-full/persistence errors stop admission; never claim success from memory.

Keep large traces/artifacts outside hot tables by versioned, redacted references
and content hashes. Audit append-only means no silent editing, not unlimited
retention of private prompts. Define evidence retention, tombstones/redaction,
backup consistency and restore/migration tests. Do not present hashes as signed
authorization. Keep necessary opaque provider replay blocks private and versioned;
cross-runtime recovery may restart from an evidence pack, not a resumable session.

Store state outside Git checkouts, Mind and synced folders using an installation
setting. Do not overwrite existing Video Orchestrator snapshots. A future VPS
can run the same single-controller SQLite arrangement; Postgres is a later
operational choice. DynamoDB is possible only with explicit transactional/claim
semantics and conformance tests, not an assumed drop-in CRUD replacement.

## 11. Interface and Jarvis decision

The product strategy is coherent: one Jarvis relationship across Console,
knowledge authoring, IDEs and CLIs, not one application replacing every tool.
Jarvis reconstructs awareness from authorized, freshness-labelled Brain views;
its context window is not global state. Its executive proposals go through the
same deterministic kernel. Human pause/kill and exact-scope approval must work
without Jarvis generating a response.

Current Console has reusable Brain Core request/schema handling, model/resource
telemetry and Infinite Brain status/approval views in `braincore-client.ts`,
`overview-dashboard.tsx` and `infinite-brain-dashboard.tsx`. Those are integration
surfaces, not proof of a completed durable agent fleet. Project task/run/event
views from the new store; add minimal operational controls at K2, full fleet UX
at U0. Display unknown/stale facts honestly rather than inferring completion.

Borrow Orca's worktree/session/remote/usage/review UX, not its session-as-agent
identity. Orca's terminal daemon survives window closure, but host/daemon loss
ends processes: reconnectable terminals do not replace durable tasks.
[Orca session model][orca-sessions], [Restore behavior][orca-restore]

Omarchy's neutral lazy launchers, usage panel and OS-event-to-agent flow are
good interaction references. Do **not** copy its unattended/auto-approving launch
defaults or local-LLM install direction into Brain. [Omarchy AI manual][omarchy-ai]

Script verification: canonical `tools/scripts/repos.sh` retains Qwen launcher/menu
and Haiku defaults; migrate it toward execution surfaces/selector intent, keeping
Claude/Codex manual choices. `tools/scripts/jump.sh` remains repository navigation.
Canonical `tools/scripts/sessions.sh` observes CLI session files and resumes
Claude/Codex, including a Haiku resume default; remove stale resume-model forcing
without rewriting historical transcript metadata. It is not an Agent Mode store
or a reason to introduce tmux. Attach sessions as attempt-owned executor resources;
never let multiple agents concurrently steer the same interactive session.

Voice correctly comes later: microphone/STT → Jarvis/control plane → structured
work/results → Jarvis/TTS. Workers stay quiet. Spoken requests may create approval
requests, but sensitive confirmation needs authenticated, exact-scope semantics
and a non-voice fallback. Audio interruption and cancellation of committed work
are different operations.

## 12. Phase-order decision

Keep the phase names, change dependencies and scope:

| Phase | Required correction |
|---|---|
| A0 | Minimal provisional contracts, offline adversarial fixtures, then admitted restricted runtime spike. No broad schema freeze or mandatory OmniRoute prototype. |
| A1 + K0 | Run staged provider migration alongside canonical-ID fixture kernel work. K0 includes the local node envelope, transactions/effect recovery and safety tests. |
| K1 | Consume completed Agent Mode migration gates plus K0; native gateway and resource admission. Access probes remain separately approved. |
| K2 | One Jarvis, one worker, one task class, one read-only capability and one accessible target model. Fixture-test escalation/Codex/write denial; minimal human controls required. |
| N0 | Add remote delivery, enrollment and reconnect to the existing local protocol; MacBook after reachable inventory. |
| K3 → K4 → K5 | Coding/worktrees, then event-driven bounded creation, then larger organization. No team expansion before authority and recovery work. |
| U0 → V0 → D0 | Full Console, voice, then distribution/always-on packaging. Portability is tested earlier; packaging and multi-tenant claims are not. |
| H0 | Final long-duration soak/release gate, not the first security/recovery work. |

C0 stays an independent, explicitly authorized cleanup lane. Do not block
fixture/kernel progress on an unreachable MacBook, local model deletion,
all-three-model paid benchmarking, automatic Codex usage or optional gateway work.

## 13. Rejected alternatives

- Brain replaced by Harness/Orca/OmniRoute: each solves a different layer and
  would create competing task, policy or identity authority.
- Seven independent plugin frameworks: retain executable seams, use data
  descriptors for resources/nodes, and keep transport thin.
- New node/account/credential inventory: reference existing infrastructure
  authority and add only Agent Mode enrollment/admission state.
- Blind retry ladder, silent Codex fallback or unknown-quota admission: these
  confuse task quality, transport health and scarce execution capacity.
- Transcript replay as exactly-once effects; shared-network SQLite; lease TTL as
  process termination: none establishes the required recovery guarantee.
- Full bespoke generic harness before testing upstream, or indefinite preview
  integration: both spend effort before proving the narrow required boundary.
- Mandatory AgentCore/MCP/workflow engine/cloud database: adapt established
  mechanisms when needed; do not make them prerequisites for the local slice.
- Forking Console into a second desktop fleet manager or building voice first:
  neither addresses durable execution and both multiply integration work.

## 14. Exact next task for GPT-5.6 Sol

**A0.1 — implement offline attempt-admission contracts and adversarial conformance
fixtures.** Do not start the durable kernel, install a runtime or normalize live
provider configuration in this task.

Scope: one isolated Agent Mode contract module and focused tests in Brain Core,
plus `operations/specs/agent-mode-contracts-v1.md` and a short A0 evidence record.
Follow existing test layout; preserve all unrelated dirty work. Use canonical
transport/model/resource references and deterministic fake runtime/gateway/node/
store ports. Fixtures may be ephemeral; they must not masquerade as a production
StateStore. Do not build a generic agent loop.

Acceptance:

1. One Jarvis/worker task produces a correlated admitted attempt, one mocked
   model response, one approved read operation, one receipt and verified result.
   Contract includes operation ID, scope/input hash, policy/grant reference,
   budget reservation, lease fence, deadline and evidence/verification reference.
2. Forbidden model/auxiliary call, ungranted tool, indirect shell/child/schedule,
   stale fence and expired grant are rejected before simulated dispatch.
3. Duplicate dispatch/receipt and crash-after-effect-before-receipt have explicit
   reconciliation outcomes; uncertain non-idempotent effects are not replayed.
4. Budget exhaustion, unknown Codex quota and cancellation prevent further work;
   cancellation distinguishes requested from acknowledged termination.
5. Two synthetic installations with different user roots/platforms use the same
   core contract. Existing infrastructure IDs are referenced, not re-enrolled.
6. Map each required Harness control to exact pinned source/plugin seams above,
   especially replacement of the unsafe minimal profile. Record unproven runtime
   controls as pending, not PASS. Document the later isolated installation/spike
   boundary and stop after focused tests/document checks.

No live/billable models, AWS/IAM/quota/billing changes, host mutation, cleanup,
global skill/config changes, credentials, installation, deployment, stage,
commit or push. A later authorized A0 runtime spike is required to validate real
process/sandbox behavior; mocks cannot establish runtime security.

Hard blockers: none for A0.1. Real Harness confinement, per-account Bedrock access
and MacBook reachability remain explicit gates for their later phases, not
claims established by this review.

### Review validation

Only the three review documents changed during the edit/validation window.
Markdown structure/reference checks and diff-whitespace checks passed; obsolete
phase tokens are absent (the MiniMax model name is not a phase token). Roadmap
and handoff agree on A0.1, staged A1/K0, early local-node enforcement, optional
OmniRoute and K2 scope. Legacy provider mentions are migration or explicitly
historical product state. Model, cleanup, media-retention and authority guardrails
remain intact. No implementation test suite or live model probe was run.

### Pinned upstream evidence

Sources accessed 2026-09-08. Pins are review evidence, not installed/admitted versions.

[h-architecture]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/docs/architecture.md
[h-minimal]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/packages/bundle/sdk-minimal/cordis.patch.yml
[h-sandbox]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/docs/subsystems/sandbox.md
[h-safety]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/SAFETY.md
[h-sdk]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/packages/sdk/client/README.md
[h-subagents]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/docs/subsystems/subagent.md
[h-schedule]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/docs/subsystems/schedule.md
[h-storage]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/docs/subsystems/storage.md
[h-pi]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/packages/llm/llm-pi-ai/README.md
[h-provider]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/packages/llm/llm-pi-ai/src/provider.ts
[h-license]: https://github.com/deepseek-ai/deepseek-harness/blob/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8/LICENSE
[o-bedrock]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/open-sse/executors/bedrock.ts
[o-catalog]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/open-sse/services/bedrock.ts
[o-policy]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/docs/OMNIROUTE_ROUTING_POLICY.md
[o-adaptive]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/docs/architecture/ADAPTIVE_ROUTING.md
[o-sticky]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/open-sse/services/combo/sessionStickiness.ts
[o-license]: https://github.com/diegosouzapw/OmniRoute/blob/ba597b631d22d85e56db6982f24b7d1ebe238df9/LICENSE
[orca-sessions]: https://github.com/stablyai/orca/blob/bba68b1bddf1276c8bd27ad4ca41efcbd4260321/docs/site/content/docs/model/agents-sessions.mdx
[orca-restore]: https://github.com/stablyai/orca/blob/bba68b1bddf1276c8bd27ad4ca41efcbd4260321/docs/site/content/docs/model/session-restore.mdx
[orca-license]: https://github.com/stablyai/orca/blob/bba68b1bddf1276c8bd27ad4ca41efcbd4260321/LICENSE
[omarchy-ai]: https://github.com/omacom/omarchy/blob/7e8feb047d8e1989ba1ae1fe5d8faa38f3f5fe60/manual/17-ai.md
[omarchy-license]: https://github.com/omacom/omarchy/blob/7e8feb047d8e1989ba1ae1fe5d8faa38f3f5fe60/LICENSE
