# Brain Agent Mode Discovery Report

**Date:** 2026-09-08  
**Scope:** read-only discovery and architecture proposal for the pasted “Brain Agent Mode / Bring Brain Alive” goal  
**Implementation status:** no runtime implementation or host cleanup performed  
**Authoritative follow-up:** `operations/specs/agent-mode-runtime-roadmap.md`

## Executive result

Brain already has useful pieces of an agent operating system, but it does not
yet have a durable autonomous Agent Mode. The current implementation is best
described as a read-only control plane with static agent summaries, approval
projections, selector adapters, snapshot files, and historical orchestration
stubs.

The correct next move is a narrow, restart-safe vertical slice:

```text
Jarvis orchestrator
  -> one bounded worker task
  -> AI Model Selector
  -> approved capability
  -> repository lease
  -> durable task/run/event/attempt records
  -> verification and evidence
  -> result reported back to Jarvis
```

The first Agent Mode policy is fixed as requested:

| Role | Model | Provider | Policy |
|---|---|---|---|
| Default worker | MiniMax M2.5 | Amazon Bedrock | first attempt for ordinary admitted work |
| Escalation/senior | GLM-5 | Amazon Bedrock | retry/escalation after bounded failure or complexity trigger |
| Principal/strongest | Claude Opus 4.6 | Amazon Bedrock | final escalation for high-complexity or repeated failure |

Escalation is strictly `MiniMax M2.5 → GLM-5 → Claude Opus 4.6`. Other
Bedrock models must not be silently substituted into this Agent Mode policy.
Codex remains a separate subscription-backed execution/provider surface in the
same Brain harness; it is not a fourth Bedrock tier and is selected only by an
explicit Codex execution policy.

No billable Bedrock inference was invoked during discovery. AWS credentials
were present and the account could enumerate the Bedrock catalog in
`us-east-1`; direct model callability and quotas remain unverified.

## Safety boundary

The following actions were deliberately not performed:

- no model, cache, application, LaunchAgent, package, or log deletion;
- no Ollama, oMLX, FluidVoice, MTPLX, LM Studio, or Qwen service changes;
- no AWS model-access request, IAM change, quota change, or paid inference;
- no MacBook deployment or remote mutation;
- no worktree reset, checkout, cleanup, or overwrite of existing user changes;
- no production migration, external message, or deployment.

The worktree was already dirty before the discovery pass. The later A0.1/A0.2
implementation slice is recorded separately in the A0 evidence reports and
adds only the explicitly named Agent Mode contract, topology-gate, test, and
roadmap files.

## 1. Current system map

### Brain Core

The local TypeScript/Node package at `projects/brain-core` is the primary
read-only API surface. Its README advertises routes for status, sessions,
skills, repositories, agents, runs, events, approvals, recovery, execution
plans, selector health, and cost summaries.

Important current boundaries:

- `projects/brain-core/src/api/routes.ts` exposes `/agents`, `/agent-runs`,
  `/agent-events`, `/agent-cost-summary`, `/ai-model-selector`, and
  `/ai-model-selector/health-matrix`.
- `projects/brain-core/src/adapters/agents.ts` contains a hardcoded static
  agent catalog. It is an Agent View, not a durable identity registry.
- `projects/brain-core/src/adapters/agent-runs.ts` derives runs from approval
  records and adds Claude/Codex placeholders. It does not record live task
  execution.
- `projects/brain-core/src/adapters/agent-task-state.ts` and
  `agent-executor-plan.ts` can read/write JSON snapshots, but the default
  derived state is still read-only and the executor plan is intent, not a
  runtime decision record.
- `projects/brain-core/src/adapters/agent-ledger-writer.ts` appends JSONL
  events, but its actor vocabulary is stale and it lacks durable task/run/
  attempt/lease semantics.
- `projects/brain-core/src/adapters/cost-budgets.ts` provides a daily
  threshold summary, not enforcement across agents, tasks, tools, tokens,
  wall-clock time, or concurrency.
- `projects/brain-core/src/adapters/agent-orchestrator-planner.ts` creates
  deterministic keyword-based plans; `agent-orchestrator-executor.ts` runs
  in memory, checkpoints only at plan completion, and still contains Gemini,
  Bash, n8n, and historical provider branches.

The current Agent View therefore answers “what agents and approval-shaped
work are visible?” It does not answer “which durable task is owned by which
agent, what attempt is running, what lease is held, what capability executed,
or what evidence proves completion?”

### AI Model Selector

The current selector is the Python service at
`operations/system-configs/model-selector/runtime/selector_service.py`,
normally launched by `com.office.ai-model-selector`. Its canonical current
configuration is:

- provider config: `operations/system-configs/model-selector/config/ai-providers.json`;
- task config: `operations/system-configs/model-selector/config/ai-task-types.json`;
- Bedrock catalog: `operations/system-configs/model-selector/config/ai-bedrock-models.json`;
- registry: `operations/system-configs/model-selector/config/ai-model-registry.json`;
- selector port: `127.0.0.1:4890`;
- Brain Core proxy: `127.0.0.1:4877` when Brain Core is running.

The current admitted managed text providers are `claude-bedrock` and
`codex-cli`; Whisper providers remain media-only. The current registry is
still a broader historical Bedrock portfolio and does not yet contain the
requested MiniMax M2.5 and GLM-5 Agent Mode entries. Claude Opus 4.6 is
present and enabled.

The selector runtime still contains dormant local-inference compatibility
logic: LM Studio-named health intervals, OpenAI-compatible probing, Ollama
model/resource checks, and old local-provider tests. Current provider config
does not make those local routes current Agent Mode providers, but this drift
must be resolved before the selector becomes the authority for autonomous
execution.

The active architecture document
`projects/brain-core/docs/ai-model-selector-architecture.md` correctly states
that Brain-managed Ollama/MTPLX/Qwen text routes are retired, Whisper may
remain for media, and Codex is a secondary managed surface. That document is
more current than the older routing standard and `ai/policy/routing.md`, which
still describe local-first, Gemini-first, and Haiku/Sonnet/Opus ladders.

### Console

Brain Console currently reads Brain Core projections. The AI model dashboard
is an observation surface, not the source of truth. This is the correct
starting boundary, but it must later display durable Agent Mode task/run/event
records rather than approval-derived placeholders.

The Console must not own model ranking, provider probes, task transitions,
lease acquisition, or budget enforcement. It should show selector decisions,
task state, attempt history, evidence, blockers, and approved operator actions
from the same durable store used by the runner.

### Existing durable state

There are three different persistence patterns today:

1. snapshot JSON under `~/.local/video-orchestrator/state/` for task state,
   executor plan, ledger summary, and cost budget;
2. append-only JSONL under `~/.local/brain-ledger/ledger.jsonl`;
3. application-owned Claude/Codex session history under `~/.claude` and
   `~/.codex`.

None is currently a sufficient Agent Mode system of record. The first vertical
slice should introduce an explicit Agent Mode store with an append-only event
stream and materialized task/run views. Existing snapshots and session logs
should remain compatibility/observability inputs during migration.

## 2. Script audit

### `tools/scripts/repos.sh`

This is a repo picker and interactive launcher, not a model router.

- scans `~/Repos` and caches at `~/.claude/cache/repos.json`;
- tracks recency in `~/.claude/cache/repo_usage.json`;
- presents `Claude`, `Codex`, and stale `Qwen` choices;
- Claude sources `claude-bedrock-env.sh` and hardcodes `claude --model haiku`;
- Codex launches `codex`;
- Qwen launches a local command that is no longer present in the repository.

The comments and menu are stale. The future menu should distinguish an
`Agent/Auto` control-plane entry from `Claude` and `Codex`, while concrete
Bedrock model selection remains selector-owned. The Qwen entry should be
retired only after the dependency checklist in the deletion manifest is
completed and a separate cleanup approval is granted.

### `tools/scripts/jump.sh`

This is a robust quick repo navigator. It does not select models, create
sessions, or execute tasks. Keep its scope narrow. Its cache locking and
atomic-write behavior are useful patterns for future local state, but it
should not become an Agent Mode store.

### `tools/scripts/sessions.sh`

This is an application-session history picker:

- Claude history is read from `~/.claude/projects/**/*.jsonl`;
- Codex history is read from `~/.codex/sessions/**/*.jsonl` and
  `~/.codex/session_index.jsonl`;
- selection resumes the underlying CLI session and changes directory to the
  recorded project;
- Claude again hardcodes `--model haiku` after sourcing Bedrock environment.

Keep it as a reconnect/observability surface. Do not make terminal sessions
the authoritative identity of an Agent Mode agent. A durable Agent Mode run
may attach to a Claude or Codex session, but task identity, attempt identity,
leases, policy decisions, and evidence must survive CLI-session loss.

## 3. Host and local-AI inventory

### Office Mac mini — observed locally

Observed host: `Office`, macOS `26.6.2`, `arm64`.

Relevant binaries and services:

| Surface | Observation | Classification |
|---|---|---|
| AWS CLI | `/usr/local/bin/aws` | required for Bedrock access; preserve |
| Codex | `/opt/homebrew/bin/codex` | subscription-backed execution surface; preserve |
| Claude | `/Users/Office/.local/bin/claude` | Bedrock-backed CLI surface; preserve |
| oMLX | `/opt/homebrew/bin/omlx`, version `0.4.3` | active Video Orchestrator sidecar capability; preserve pending migration |
| MLX Whisper | `/Users/Office/.local/bin/mlx_whisper` | active media capability; preserve |
| Ollama | app/server running; no model rows from `ollama list` | retired Brain text route; candidate for future cleanup, no action taken |
| LM Studio | no CLI in PATH; support directory about 3 MB | likely residue; verify dependencies before cleanup |
| MTPLX | no binary in PATH | historical/retired; verify stale config only |
| Qwen launcher | `~/.local/bin/qwen` is a broken symlink to absent `brain/tools/scripts/qwen` | stale; cleanup candidate after reference check |

Launch services observed include `com.office.ai-model-selector`,
`com.office.brain-core`, and `com.office.brain-console`. No MTPLX or oMLX
LaunchAgent was found in the matching launch-agent inventory. Ollama’s app
launch service is separate from Brain’s admitted text-provider policy.

Observed storage:

| Path | Approximate size | Interpretation |
|---|---:|---|
| `~/.omlx/models` | 22 GB | Gemma 4 12B oMLX model; likely active VO sidecar dependency |
| `~/.cache/huggingface/hub` | 32 GB | mixed cache; do not delete as a unit |
| Qwen MTPLX cache directories | small directory entries observed | may be incomplete, linked, or cached metadata; verify before deletion |
| `~/.local/video-orchestrator` | 1.8 GB | active selector/VO state, code, venv, and logs; preserve as a product dependency |
| `~/.local/video-orchestrator/logs` | about 1.1 GB | retention candidate, not deletion-authorized |
| `~/Library/Application Support/Ollama` | about 336 KB | app state, no model evidence |
| `~/.ollama` | about 860 KB | Ollama state, no model evidence |
| `~/Library/Application Support/LM Studio` | about 3 MB | likely residue; verify before cleanup |

There is also a running FluidVoice MLX process with its own model directory.
It is an audio/voice application dependency, not evidence of a Brain-managed
text provider. Preserve it unless an independent application audit authorizes
otherwise.

### MacBook M1 — not reachable during discovery

The canonical SSH alias and both known paths were attempted read-only:

- Tailscale `100.70.12.18:22` timed out;
- Thunderbolt `192.168.2.2:22` did not accept the connection.

No MacBook inventory, process list, storage measurement, or cleanup decision is
claimed. The canonical topology remains Office `192.168.2.1` / `100.86.124.66`
and MacBook `192.168.2.2` / `100.70.12.18`, with Thunderbolt preferred and
Tailscale as fallback. A future read-only inventory is a prerequisite to any
MacBook worker or cleanup action.

### Local-AI dependency classification

**Retain as active or explicitly scoped dependencies:**

- MLX Whisper and Whisper provider entries for transcription;
- oMLX and its model while the Video Orchestrator metadata-variant sidecar is
  active; see `operations/runbooks/video-orchestrator-phase-3y-macbook-omlx-sidecar.md`;
- the Video Orchestrator virtual environment, selector service, state, and
  code until their migration is separately planned;
- FluidVoice’s private application models;
- image/audio models and ComfyUI references that are not Brain text routing.

**Retire from Brain policy, but do not physically delete yet:**

- Ollama as a Brain-managed always-on text route;
- MTPLX/Qwen/Aider as Brain-managed coding or Graphify routes;
- LM Studio as a selector route;
- historical Gemini/local-first routing claims in active-looking policy files.

**Cleanup candidates requiring a separate deletion approval:**

- broken `~/.local/bin/qwen` symlink;
- stale `~/.aider.conf.d/mtplx.yml`;
- LM Studio support residue;
- unused Ollama app/state after proving no external workflow depends on it;
- Qwen/MTPLX model cache directories after exact ownership and reference
  checks;
- old launch-agent templates and dated runbooks only after retaining an
  archive/reference decision.

## 4. Non-destructive deletion manifest

This is a manifest, not an execution list.

| Candidate | Why it appears obsolete | Required preconditions | Status |
|---|---|---|---|
| `~/.local/bin/qwen` | broken symlink; repo launcher absent | search shell configs, aliases, CI, docs, and user workflows | not deleted |
| `~/.aider.conf.d/mtplx.yml` | points Aider at retired local endpoint | confirm no active Aider workflow and preserve file hash/archive | not deleted |
| `~/.cache/huggingface/hub/models--Youssofal--Qwen*` | historical MTPLX/Qwen cache | identify hardlinks/symlinks, exact size, last use, and no external app dependency | not deleted |
| `~/.omlx/models/mlx-community/gemma-4-12B-it-bf16` | local model storage | prove VO sidecar is migrated or explicitly exempted | not deleted |
| Ollama app/state | no models; retired Brain route | verify no independent app/workflow dependency; user approval | not deleted |
| LM Studio support directory | no runtime binary observed | verify no active app or user workflow; user approval | not deleted |
| old MTPLX/Qwen runbooks/templates | historical instructions | archive/reference decision; do not erase evidence | not deleted |

The existing local inference policy validator already asserts that obsolete
Brain launchers and admitted local text providers stay absent. Any future
cleanup must preserve that policy and must not remove the current oMLX
Video-Orchestrator sidecar contract by pattern matching.

## 5. Bedrock evidence and target policy

### What was verified

Read-only AWS commands succeeded for the configured account/region:

- STS identity check returned successfully without exposing identity data;
- `aws bedrock list-foundation-models --region us-east-1` enumerated MiniMax
  M2.5, GLM-5, and Claude Opus 4.6;
- `aws bedrock list-inference-profiles --region us-east-1` showed active US
  and global Claude Opus 4.6 inference profiles.

The catalog evidence proves visibility, not invocation entitlement. No
`bedrock-runtime converse` call was made because that would be billable and
was outside the read-only discovery scope.

AWS’s current compatibility documentation lists Invoke, Converse, and Chat
Completions for MiniMax M2.5 and GLM-5. It lists Invoke and Converse for
Claude Opus 4.6. GLM-5’s AWS model card reports a 200K context window and
128K maximum output. Claude Opus 4.6’s AWS card reports a 1M context window
and 128K maximum output. MiniMax M2.5 context/output limits must be copied from
the current model card during implementation rather than inferred from a
neighboring model.

References:

- [AWS MiniMax model page](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards-minimax.html)
- [AWS GLM-5 model card](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-zai-glm-5.html)
- [AWS Bedrock API compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html)
- [AWS Claude Opus 4.6 model card](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-6.html)

### Proposed Agent Mode registry entries

Add these as a distinct Agent Mode policy surface, not as an unreviewed
replacement for every existing workflow:

```text
agent-mode/minimax-m2.5
  provider: claude-bedrock-compatible-bedrock-runtime
  model_id: minimax.minimax-m2.5
  role: worker
  rank: 10

agent-mode/glm-5
  provider: claude-bedrock-compatible-bedrock-runtime
  model_id: zai.glm-5
  role: senior
  rank: 20

agent-mode/claude-opus-4.6
  provider: claude-bedrock-compatible-bedrock-runtime
  model_id: us.anthropic.claude-opus-4-6-v1
  direct_model_id: anthropic.claude-opus-4-6-v1
  role: principal
  rank: 30
```

The provider identifier should be normalized during implementation rather than
reusing `claude-bedrock` to hide three materially different model policies.
The selector result must include provider, exact model ID, region/profile,
policy ID, reason, estimated cost, and access-verification state.

### Access verification gate

Before enabling live Agent Mode, run a separately approved, bounded probe for
each target model with a very small output budget and persist only redacted
status/error evidence. The probe must distinguish:

```text
catalog_visible
profile_visible
iam_authorized
runtime_callable
tool_call_shape_verified
budget_available
```

Until then, Agent Mode remains design/fixture-only. The existing selector’s
`_bedrock_access_status()` performs a real Converse probe and therefore must
not be called as an incidental health check without explicit billable-call
authorization.

## 6. Codex integration

Codex is a first-class execution surface in the same Brain harness, but not a
Bedrock escalation tier.

Recommended contract:

- Agent Mode task policy chooses `bedrock-agent-mode` or `codex-cli` at the
  execution-surface level;
- if Bedrock Agent Mode is selected, model escalation is exactly MiniMax →
  GLM-5 → Opus;
- if Codex is selected, the task records the Codex model/effort and remains
  outside that Bedrock ladder;
- Codex sessions may be attached to a Brain run for interactive or isolated
  coding work, but the Brain run ledger remains authoritative;
- Codex prompts continue to treat repository content as untrusted data and
  use the existing read-only/sandboxed command boundary where applicable.

The current `managed-provider-executor.mjs` and `managed-text-executor.ts`
are useful adapters, but the current admitted-provider and route types must be
extended rather than allowing the selector to silently collapse Agent Mode
models into a generic `claude-bedrock` label.

## 7. Durable Agent Mode domain model

The first implementation should add a versioned Agent Mode schema without
removing the existing read-only contracts.

### Agent identity

```text
agent_id          stable UUID/slug, never a process ID
agent_kind        jarvis | worker | reviewer | system
role              orchestrator | executor | researcher | reviewer
display_name      human label
policy_id         model/capability/safety policy revision
home_node_id      preferred execution node
home_repo         optional default repository
capability_refs   admitted capability IDs
status            registered | ready | busy | blocked | retired
created_at        immutable creation time
updated_at        last heartbeat/metadata update
```

### Task, run, attempt, and event

Every record should carry a stable ID, schema version, timestamps, and the
parent IDs needed for recovery:

```text
task_id, run_id, attempt_id, event_id
parent_task_id, requested_by_agent_id, assigned_agent_id
repo_ref, repo_revision, task_type, objective, constraints
model_policy_id, selected_provider, selected_model, escalation_index
capability_refs, approval_refs, lease_ref, budget_ref
status, reason, error_class, result_ref, evidence_refs
```

Event types should include `task_created`, `task_claimed`, `lease_acquired`,
`selection_made`, `approval_required`, `capability_started`,
`capability_completed`, `attempt_failed`, `escalated`, `verification_passed`,
`verification_failed`, `task_completed`, `task_blocked`, and `task_recovered`.

### Storage and recovery

Use an append-only local event stream plus materialized views. SQLite in WAL
mode is the preferred first implementation for atomic transitions, uniqueness,
leases, and indexed queries; JSONL evidence export can preserve compatibility
with the existing ledger. Store under a new Agent Mode state root, for example
`runtime/local/agent-mode/`, not inside the user’s personal Mind vault.

The store must support:

- idempotency key per submitted task;
- atomic compare-and-set status transitions;
- durable attempt heartbeats and expiry;
- recovery of `running` attempts after process restart;
- no duplicate execution after a result was durably committed;
- immutable policy/model/capability selection records;
- redacted error/evidence payloads with content hashes.

## 8. Tasks, events, runs, sessions, and leases

### Task lifecycle

```text
queued → admitted → assigned → running → verifying → completed
                         ↘ blocked
                         ↘ failed → retrying → escalated → running
```

The transition is written before and after side effects. A worker must never
infer “completed” from a process exit code alone; verification and evidence
are separate transitions.

### Session architecture

Separate four concepts:

1. **Agent identity:** durable logical actor.
2. **Brain run:** durable unit of work and policy history.
3. **Executor session:** Claude/Codex/worker process attached to an attempt.
4. **Console connection:** temporary observer/browser session.

CLI JSONL history remains useful for resume and human inspection. It must be
linked by `executor_session_id` to a Brain attempt, never used as the primary
task database.

### Repository leases

Repository mutation requires a lease keyed by canonical repository path and
revision scope. The lease should include owner agent, run/attempt ID, node ID,
acquired/renewed/expiry times, requested mode (`read`, `worktree`, `shared`),
and a recovery token.

Rules:

- read-only tasks may run concurrently;
- worktree tasks should receive isolated worktrees by default;
- shared checkout mutation is denied unless explicitly approved;
- expired leases become recoverable only after an evidence-backed heartbeat
  check;
- lease acquisition and release are durable events;
- a worker may not execute a repo capability without a valid lease.

### Capability/MCP boundary

MCP and local tools should be admitted capabilities, not arbitrary tool names.
Each capability needs an ID, schema, owner, risk class, allowed nodes,
network scope, filesystem scope, approval requirement, timeout, retry policy,
and verification command.

Default capability classes:

- read-only repository inspection;
- deterministic test/lint/typecheck;
- isolated worktree edit;
- external network research;
- credential-sensitive or production action.

Only the first two are eligible for the initial autonomous proof. The worker
receives a typed capability invocation, not a free-form shell prompt.

## 9. Local execution nodes

### Office Mac mini

Office should be the initial control-plane and worker node because it hosts
Brain, the selector, AWS CLI, Codex, Claude, and the canonical repository.
Jarvis can run here as a long-lived local process supervised by the existing
Brain runtime conventions, but the first milestone should be manually started
or explicitly enabled rather than silently adding another LaunchAgent.

### MacBook M1

Treat the MacBook as an optional remote worker node after read-only inventory
and connectivity repair. It may host scoped oMLX/MLX capabilities for the
Video Orchestrator, but it must not become an implicit Agent Mode model tier.
Remote execution should use the canonical Thunderbolt/Tailscale identities,
SSH host verification, capability manifests, bounded timeouts, and receipts.

### Distributed control principle

The control plane owns task identity, policy, leases, budgets, and evidence.
Nodes own process execution and local resource reporting. A node outage must
not destroy task truth or cause duplicate work.

## 10. Budgets and escalation

The current `$20/day` threshold snapshot is a useful display seed, not an
enforcement system. Agent Mode budgets should be hierarchical:

```text
global day/week
  → agent
    → task
      → run
        → attempt
```

Track input/output tokens, estimated/actual USD, wall time, tool calls,
concurrency, network bytes where relevant, and retry count. Reserve budget
before a billable attempt and reconcile after completion. If budget cannot be
reserved, the task blocks visibly; it does not silently switch models.

Escalation must be deterministic and explainable:

- MiniMax first for ordinary worker tasks;
- GLM-5 after a retryable failure, quality-verification failure, or declared
  senior complexity trigger;
- Opus after a second bounded failure or a principal complexity trigger;
- no downgrade after an escalation unless a new policy decision is recorded;
- no infinite retry loop;
- each escalation records the trigger, previous attempt, budget impact, and
  selected exact model ID.

## 11. Jarvis / CEO master agent

Jarvis should be a durable orchestrator identity, not a privileged shell.
Its responsibilities are:

- accept a human objective;
- decompose it into bounded typed tasks;
- assign workers by capability and policy;
- observe task/run/evidence state;
- request approvals for gated actions;
- replan after failure or missing evidence;
- report a concise result with links to evidence.

Jarvis must not bypass the selector, leases, capabilities, budgets, or
verification gates. A worker must not self-promote to Jarvis or grant itself
new capabilities. “CEO” is a role label and UX concept, not an authorization
scope.

## 12. Voice integration

Voice should be a transport adapter over Jarvis, not a second orchestration
system:

```text
audio input → transcription capability → Jarvis task API
  → durable task/run state → text result
  → optional speech synthesis capability
```

Retain Whisper/MLX as the current local media surface where already admitted.
Voice commands must create the same durable task records as CLI/Console input,
include a confidence/transcript artifact, and require confirmation for
high-impact actions. FluidVoice remains an external application dependency
until separately integrated and must not be conflated with Agent Mode state.

## 13. AgentCore assessment

Amazon Bedrock AgentCore is useful as an optional future hosting boundary, not
as the foundation of the first Brain Agent Mode slice.

Potentially useful later:

- Runtime for isolated cloud agent sessions and long-running workloads;
- Memory for session continuity and durable semantic memory;
- Gateway for governed MCP/HTTP targets and centralized auth/observability.

Reasons to defer adoption as the control plane:

- Brain still needs its own authoritative task/run/lease/budget/evidence model;
- AgentCore Runtime does not replace local repository leases or Mac node
  ownership;
- Gateway target routing and MCP aggregation are different from Brain’s
  capability admission model;
- cloud deployment adds IAM, egress, cost, packaging, and data-boundary work;
- the first proof can be made locally with lower blast radius.

The future integration point is a Brain capability/provider adapter. AgentCore
may host a worker or gateway target, but it must report into Brain’s durable
run/event contracts and must not become a parallel source of truth.

References:

- [AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [AgentCore Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-get-started.html)
- [AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-core-concepts.html)
- [AgentCore Runtime targets](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-http-runtime.html)
- [AgentCore harness versus Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html)

## 14. Current drift register

The following is the highest-value cleanup/migration queue. It is not a
permission to edit every file now.

| Drift | Current evidence | Treatment |
|---|---|---|
| Agent View is static | `adapters/agents.ts` | replace with durable registry projection in Agent Mode slice |
| Runs are approval-derived | `adapters/agent-runs.ts` | preserve compatibility; add real run store |
| Ledger actor vocabulary is stale | `types/agent-ledger.ts`, `agent-ledger-writer.ts` | version/extend, do not break historical records |
| Planner has old providers | `agent-orchestrator-planner.ts` / executor | isolate historical path; new runner uses Agent Mode policy |
| Selector has dormant local guards | `runtime/core.py` | remove or quarantine only after current tests are split |
| Registry lacks MiniMax/GLM | `ai-bedrock-models.json`, `ai-model-registry.json` | add exact entries after approved access/cost verification |
| Active policies conflict | routing standard, `ai/policy/routing.md`, `CLAUDE.md` | reconcile by source authority; preserve dated history |
| CLI scripts hardcode Haiku/Qwen | `repos.sh`, `sessions.sh` | make provider/session labels policy-neutral |
| Cost budget is one daily threshold | `cost-budgets.ts` | add reservations and hierarchical enforcement |
| No repo lease | no current Agent Mode primitive | implement before write-capable worker |
| No restart-safe runner | executor checkpoints at plan end | implement per-transition persistence |

## 15. Exact first implementation task

### M0 — one Jarvis, one worker, restart-safe bounded proof

Implement one fixture-backed, non-production task type in Brain Core. The task
must:

1. create or accept a stable Jarvis task request;
2. persist task, run, attempt, and event records before execution;
3. select MiniMax M2.5 through the Agent Mode selector policy;
4. invoke one approved read-only capability in a known repository/worktree;
5. acquire and release a repository read lease;
6. enforce a small token/time/tool budget;
7. checkpoint every state transition atomically;
8. survive process restart and recover an interrupted attempt;
9. verify the result with a deterministic command;
10. persist redacted result/evidence hashes;
11. simulate a bounded failure and prove escalation to GLM-5;
12. simulate a second bounded failure and prove escalation to Opus without
    silently using another model;
13. report the worker result to Jarvis;
14. expose the same state through a read-only Brain Core route and Console
    observer view;
15. leave all existing approval-gated execution paths disabled.

Suggested implementation seam:

```text
projects/brain-core/src/types/agent-mode.ts
projects/brain-core/src/adapters/agent-mode-store.ts
projects/brain-core/src/adapters/agent-mode-selector.ts
projects/brain-core/src/adapters/agent-mode-capabilities.ts
projects/brain-core/src/adapters/agent-mode-repo-leases.ts
projects/brain-core/src/adapters/agent-mode-runner.ts
projects/brain-core/src/tests/agent-mode-*.test.ts
```

Use fixtures and mocked provider responses for the first test proof. Live
Bedrock invocation, LaunchAgent installation, MacBook execution, or production
repository mutation require a separate approval after the local proof passes.

### M0 acceptance evidence

The implementation is not complete until it can show:

- stable IDs before and after process restart;
- exactly one durable completion for a successful task;
- no duplicate completion after replaying the same event or idempotency key;
- lease conflict and lease expiry behavior;
- budget block behavior;
- exact selector and escalation records;
- failure recovery with a visible blocker when recovery is unsafe;
- deterministic verification output and content hash;
- read-only API/Console parity with the persisted store;
- tests that prove Codex remains separate from the Bedrock ladder;
- no modification to current local model caches, services, or unrelated files.

## Conclusion

The Brain foundation is strong enough to begin Agent Mode, but the next step
is durable execution truth, not more static dashboards or broad host cleanup.
The requested model stack is available in the AWS catalog, while account-level
callability still needs an explicitly approved probe. Office is the correct
first control-plane node. MacBook and local model cleanup remain gated by
connectivity/dependency evidence. AgentCore is a future adapter boundary, not
the first source of truth.
