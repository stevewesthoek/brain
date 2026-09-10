# Agent Mode K3.6 Foundation Audit

**Date:** 2026-09-09
**Scope:** Architecture, documentation, model routing, launcher scripts,
local AI boundaries, naming, security, repository state, and K4 extensibility
**Decision:** Foundation **READY WITH CONDITIONS**; K4 **not implemented**

## Executive result

The bounded Agent Mode foundation is coherent and ready to support a separately
planned K4 design. K0, K1, K2, N0, K3, and K3.5-A through K3.5-D are recorded
as complete for their fixture or bounded gates. The durable path is:

Brain Kernel → Model Gateway → Node Transport → Workcells
→ Validation → Review → Commit → Merge → durable receipts/events/observer

K4 event-driven autonomy, dynamic workers, scheduling expansion, autonomous
loops, push, deployment, and production mutation were not implemented.

## Completed capabilities

- K0 durable kernel, StateStore, events, evidence, receipts, and recovery;
- K1 Bedrock gateway, model/access admission, budgets, and escalation policy;
- K2 bounded Jarvis/worker slice and operator controls;
- N0 portable BrainNode and node transport envelope;
- K3 Workcells, fenced writes, validation, review, commit, and merge authority;
- observer projections, restart reconciliation, and disposable fixture evidence;
- consolidated Auto/model selectors and retired local-text routing boundary.

## Requirement audit

| Area | Evidence | Result |
|---|---|---|
| Architecture | brain-core architecture doc, runtime roadmap, Agent Mode runbook | PASS |
| Documentation | roadmap, progress handoff, architecture strategy, and this report | PASS |
| Model routing | model-tier-policy.ts, model-gateway.ts, model registry validation | PASS |
| Launcher scripts | repos.sh --runtime-menu and sessions.sh --runtime-menu | PASS |
| Local AI boundary | local-text policy validator plus consumer/runbook review | PASS with unresolved MacBook inventory |
| Naming | Amazon Bedrock transport identity and separate model/vendor metadata | PASS |
| Security | bounded Agent Mode static review and targeted tests | PASS |
| Repository cleanliness | current git status --short | CONDITION: intentionally dirty |
| Extensibility | StateStore, ModelGateway, AgentRuntime, CapabilityProvider, BrainNode, NodeTransport seams | PASS |

## Model layer

The Agent Mode model portfolio is:

Auto root/planning: MiniMax M2.5
Quality escalation: MiniMax M2.5 → GLM-5 → Claude Opus 4.6
Execution resource: Amazon Bedrock
Separate manual resource: Codex subscription

The policy starts Auto root/planning with MiniMax even when static task
classification is senior or principal. Escalation is Brain-owned, bounded by
budget and depth, and model escalation requests are untrusted intent signals.
The gateway admits only the three typed Agent Mode Bedrock model references.
Codex is not silently substituted for Bedrock and has separate quota policy.

The general selector registry also validated with Bedrock as priority 1 and
Codex as priority 2. Private Mind tasks remain explicitly Bedrock-only.
Historical Claude/Haiku/Gemini terminology remains in older planning and
strategy documents where it describes other harnesses; it is no longer exposed
as an Agent Mode launcher choice or model route.

## Scripts and naming

Both tools/scripts/repos.sh and tools/scripts/sessions.sh expose exactly:

Auto
MiniMax M2.5
GLM-5
Opus 4.6
Codex

Auto invokes brain-agent run. Explicit Brain choices invoke the same
policy-gated entrypoint with a model request. Codex remains a separate native
runtime. Obsolete Claude menu/launcher paths and stale local text labels were
removed from these two scripts. The --choose-model compatibility alias and
--model non-interactive option remain supported.

## Local AI audit

| Capability | Current consumer/evidence | Decision |
|---|---|---|
| Ollama / MTPLX / Qwen text serving | retired provider IDs, launchers, and selector routes are absent; validator passes | REMOVE/RETIRED |
| oMLX text serving / Gemma text model | no current Agent Mode or managed text route; old Video Orchestrator document is historical/optional | REMOVE candidate after exact host/dependency check |
| LM Studio text inference | old strategy/platform references remain historical; no current Agent Mode route | REMOVE candidate after exact host/dependency check |
| FluidVoice local MLX voice | active personal voice capability recorded in roadmap/progress | KEEP |
| MLX Whisper large-v3 | nightly Bible Studies pipeline explicitly invokes mlx_whisper | KEEP WHILE CONSUMED |
| faster-whisper / Whisper API fallbacks | media/video transcription surfaces, not text-LLM routing | KEEP as separate media capability |
| ComfyUI/local image generation | on-demand image/media surface | KEEP pending its own current-use audit |

No local text LLM should be reintroduced into Agent Mode to satisfy a missing
provider. MacBook inventory is unresolved; Office evidence must not be
extrapolated to MacBook. No host cleanup was performed by this audit.

## Security boundary review

The bounded implementation preserves:

- no repo.write(main) capability;
- Workcell-only writes with repository, owner, lease, and fence binding;
- fixed non-shell Git adapters with no arbitrary command, reset, force, push,
  or model-supplied flags;
- typed Bedrock model admission and Brain-owned escalation;
- no model-created approvals or approval bypass;
- durable validation, review, commit, merge, receipt, and crash-reconciliation
  boundaries;
- thin node transport with shell false;
- observer output limited to bounded state/evidence and no credentials.

This is a scoped Agent Mode review, not a claim that every unrelated Brain
utility is free of shell usage. General shell/deploy/database capabilities
remain governed by their own guardrails and approval policies.

## Repository cleanliness and release condition

The worktree currently contains intentional in-progress changes from the
Agent Mode implementation and prior related work. The audit observed:

 modified: 20
 untracked: 63

This is a readiness condition, not a cleanup authorization. Before K4 work is
landed, the existing changes must be separated into reviewed commits or an
explicit handoff/branch boundary. No files were deleted, committed, pushed, or
deployed by this audit.

## Future extensibility

The current seams are sufficient for later phases without changing the domain
model:

- StateStore: durable state, leases, events, evidence, and receipts;
- ModelGateway: typed provider/model admission and usage accounting;
- AgentRuntime: restricted runtime composition;
- CapabilityProvider: scoped capabilities and receipts;
- BrainNode / NodeTransport: portable local/remote execution;
- Workcell promotion stages: explicit future effect boundaries.

K4 should add event-driven scheduling and bounded dynamic workers behind these
seams, with explicit limits, cancellation, recovery, and observer evidence. It
should not widen the existing Workcell, model, node, or merge authorities
implicitly.

## K4 readiness assessment

**READY WITH CONDITIONS.** The architecture, model routing, script surfaces,
local-text boundary, security controls, and extension seams are ready for K4
planning. Two conditions remain:

1. isolate and review the current dirty worktree before landing further
   autonomy work;
2. complete read-only MacBook inventory before making any local-media cleanup
   decision.

This audit does not authorize K4 implementation. The next action is a
separately scoped K4 design/review package, after the repository boundary is
cleanly handed off.

## Remaining gaps

- The shared worktree is not a clean landing boundary; existing changes need
  isolation and review.
- MacBook local-media inventory has not yet completed.
- K4 event scheduler, dynamic worker admission, and autonomous-loop
  reconciliation are intentionally absent.
- Long-duration soak, multi-node loss/reconnect, and broader release gates
  remain future H0 evidence.

## Recommended next roadmap

1. Create a clean reviewed boundary for the completed K0–K3.5 work.
2. Run the read-only MacBook inventory and classify local media independently.
3. Write and review a K4 design specifying event sources, bounded worker
   templates, budgets, TTLs, cancellation, recovery, and observer evidence.
4. Implement only the smallest fixture-backed K4 admission slice.
5. Run adversarial review and soak evidence before any broader autonomy.
6. Defer K5 organization and K6/V0 voice control-plane work until K4 exits.

## Verification evidence

Commands run from the Brain repository:

    bash -n tools/scripts/repos.sh tools/scripts/sessions.sh
    tools/scripts/repos.sh --runtime-menu
    tools/scripts/sessions.sh --runtime-menu
    npm run validate:local-text-policy --silent
    node tools/validate-ai-model-registry.mjs

Results:

- both menus printed exactly five expected entries;
- stale selector labels scan passed;
- local-text policy validation returned valid true, Bedrock primary true,
  Codex secondary true, and obsolete local text surfaces false;
- model registry validation returned valid true with 4 providers and 16 models;
- prior K3.5 bounded promotion audit passed 17/17 tests, with typecheck,
  build, diff check, and restricted safety scan clean.

## Updated references

- operations/specs/agent-mode-runtime-roadmap.md
- docs/product/agent-mode-progress.md
- projects/brain-core/docs/agent-orchestrator-architecture.md
- docs/system/brain-agentic-os-strategy.md
- ai/policy/routing.md
- ai/models/README.md
- tools/scripts/repos.sh
- tools/scripts/sessions.sh
