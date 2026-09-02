# Infinite Brain Orchestrator v2 Phase 6D — Client-Agnostic Conformance

**Date:** 2026-09-02
**Source revision:** `28f72393f1f005fe754f6aad18647c3bbafebec2`
**Baseline:** accepted Phase 6C `origin/main` `f07baa74014cea0b5654187881245f99f0554bc1`
**Branch:** `codex/infinite-brain-orchestrator-v2-phase6d-client-agnostic`
**Production/default activation:** not performed

## Executive result

Phase 6D establishes and validates one Brain-owned, versioned, LLM-agnostic and
IDE-agnostic universal consumer contract:

```text
BrainRequest → BrainRoute → TaskPacket → CompositionGraph
  → ContextRequest[] → CapabilitySelection[] → GateSelection[]
  → EvidencePacket[] → BrainResult → Continuation
```

The canonical contract is `operations/specs/infinite-brain-universal-consumer-contract.v1.json`,
with the adjacent JSON Schema. Thin reference adapters for Codex, Claude Code,
Cursor, Kiro, Antigravity, Gemini, and Workbench consume the same Brain-owned
semantic pipeline. No adapter owns routing, qualification, specialist/method
selection, context budgets, packet decomposition, composition, quality gates,
safety gates, or continuity.

**Verdict:** `PASS — universal contract conformance and rollout-readiness
assessment accepted; no consumer or domain default activated.`

## Authority and scope

Brain remains the semantic authority for routing, qualification, catalog
discovery, atomic context, task/evidence packets, composition, gates, safety,
receipts, and continuity. Conversation transcripts are not canonical state.
Continuation remains explicit and never automatically resumes. The universal
receipt stores hashes, semantic references, revisions, safety, and degradation;
it does not store raw prompts or transcripts.

The adapter matrix is recorded in
`operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json`.
All seven environments can consume the contract through the same reference
adapter shape. This is a conformance/readiness result, not live client
activation. Kiro's separately authorized ignored projection remains deferred;
Workbench remains a provider/action boundary and was not activated.

## Source baseline and consumer inventory

| Field | Evidence |
|---|---|
| Main before | `f07baa74014cea0b5654187881245f99f0554bc1` (accepted Phase 6C) |
| Implementation branch | `codex/infinite-brain-orchestrator-v2-phase6d-client-agnostic` |
| Implementation commits | `87793a29`, `172091af`, `7b78362a`, `20f6fc63`, `78b764fb`, `28f72393` |
| Main after | `963e5c3ebed55a6973a45c18b672485947914456` verified integration point; the final report-only metadata commit is pushed immediately afterward |
| Current Brain authority | `operations/specs/infinite-brain-orchestrator-v2.md`, descriptor catalog, router, packet/graph/gate contracts, Context Broker, continuity contracts |

The exact inventory and capability columns are machine-readable in
`operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json`.
The following summarizes the current repository-backed surfaces; “reference
adapter” means contract conformance was proven without claiming live client
activation.

| Consumer | Entrypoint / projection | Skills, context, tools, continuity, policy | Current V2 / conformance / activation |
|---|---|---|---|
| Codex | `operations/system-configs/codex/AGENTS.md`; `config.toml`; `skills/user` | canonical active projection; Universal Entry + Broker; shell/browser/MCP; explicit continuation; canary/rules are transport and rollout boundaries | Phase 6C Code canary retained; reference PASS; not activated by 6D |
| Claude Code | `operations/system-configs/claude/CLAUDE.md`; settings/hooks/skills | Claude projection and hooks; Universal Entry + Broker bridge; shell/filesystem/runtime tools; explicit handoff continuation | reference PASS; separate rollout evaluation; not activated |
| Cursor | `operations/system-configs/cursor/README.md`; `skills-cursor` | IDE skill projection; Universal Entry + Broker bridge; host tools/MCP are capability-declared; explicit continuation | reference PASS; separate rollout evaluation; not activated |
| Kiro | `operations/system-configs/kiro/steering/brain-mind-context.md`; Kiro projection manifest | steering/powers/extensions; Broker bridge; host tools; live ignored symlink boundary; explicit continuation | repository projection manifested, live projection deferred; reference PASS; not activated |
| Antigravity | `operations/system-configs/antigravity/README.md`; Gemini Antigravity projection | tracked projection; Universal Entry + Broker bridge; IDE/MCP tools; explicit continuation | reference PASS; separate rollout evaluation; not activated |
| Gemini | `operations/system-configs/gemini/GEMINI.md`; config/MCP/skills | Gemini projection and RTK hook; Universal Entry + Broker bridge; shell/MCP/model runtime; explicit continuation | reference PASS; separate rollout evaluation; not activated |
| Workbench | `operations/system-configs/mcp/workbench` | no skill-export authority; Brain context/provider bridge; MCP/action boundary; explicit continuation only | reference PASS; runtime provider/action boundary remains N/A; not activated |

No consumer owns canonical routing, qualification, skill selection, context
budgeting, packets, evidence, composition, gates, safety, or continuity. Client
specific behavior remains limited to transport, host capability reporting,
projection, serialization, session, and rollout boundaries.

## Thin adapter and capability contract

The reference adapter implements only native-input/session translation,
capability reporting, Brain contract invocation, bounded result rendering, and
continuation-reference exposure. A conformance validator rejects
consumer/client/model-conditioned route, specialist, gate, context, or
qualification policy. The audit result is `independenceViolations: []` and
domain-routing/qualification/quality-gate/safety/context-budget duplication is
`0` for the Phase 6D adapter surface.

The capability matrix records filesystem, Git, shell, web, browser, MCP,
Workbench, structured output, continuation, interactive qualification, visual,
and other relevant capabilities as `observed`, `host-dependent`, or
`not_applicable`; it is environment metadata only and contains no route rules.
Capability negotiation is explicit: `SUPPORTED`,
`SUPPORTED_WITH_ALTERNATIVE`, `DEGRADED`, `REQUIRES_EXTERNAL_CAPABILITY`,
`UNAVAILABLE`, or `BLOCKED`. The contract rejects unsupported request/adapter
versions, rejects duplicate stage identities, and never selects an explicitly
unavailable alternative.

## Catalog authority and dormant skills

All consumers discover capabilities through the same Brain descriptor catalog.
The Phase 6D corpus and packet runs show zero ambient full-skill loads, zero
LIST full-body reads, zero unrelated full-skill reads, and selected full-body
reads only after semantic selection. Dormant `investigate`, planning, web-design,
Bible, and other specialist descriptors remain discoverable; relevant prompts
select them and then permit exact instruction inspection. The seven Kiro entry
symlinks remain represented by the canonical repository manifest without
mutating ignored live state. No consumer-specific semantic skill fork was
created.

## Cross-domain semantic parity

The 228-scenario corpus includes at least 30 Code cases, Research/Bible cases,
Design/Web cases, Memory/Review/QA/Handoff/Careful/Video cases, mixed-domain
cases, high-risk and ambiguous requests, stale/continuation cases, dormant
specialists, unavailable capabilities, and model swaps.

| Domain / property | Result |
|---|---|
| Code ownership, specialists, qualification, Review/QA intent, risk | equivalent across all seven reference consumers; Codex Code remains `PROMOTION_READY` |
| Research/Bible ownership, evidence/source intent, qualification | equivalent semantic route; acquisition mechanics remain adapter capability concerns |
| Design/Web ownership, visual/implementation handoff intent | equivalent route semantics; missing browser/visual capability is explicit rather than a silent QA pass |
| Safety / Careful / confirmation / rollback | 100% parity; capability loss never weakens safety |
| Primary-owner / qualification / specialist / risk / gate / context-scope parity | 100% on the tested equivalent reference shapes |
| Consumer-name-only semantic route differences | 0 |

## Universal receipt and continuity parity

Every Brain-owned receipt now carries the consumer identifier and reported
capabilities plus Brain revision, request hash, route, qualification, selected
capabilities, Task Packet and Composition Graph references, context and evidence
references, gates, risk, freshness, continuity, side effects, outcome,
degradation, and safety. Raw prompts and transcripts are not stored in the
receipt, and transport-specific serialization is not canonical state.

The cross-consumer continuation fixture creates the same Task Packet and
Continuation identifiers for Codex and Claude Code from the same source and
intent. Continuation state is consumer-independent, stale/conflicted state fails
closed, reconciliation remains explicit, and transcript replay or automatic
resume is never required.

## Per-consumer Infinite Brain metrics

The validator emits the same metrics for each consumer because every row uses
the same Brain reference pipeline:

| Consumer metric | Codex / Claude Code / Cursor / Kiro / Antigravity / Gemini / Workbench |
|---|---:|
| Full pipeline cases | 12 each |
| Ambient full-skill bodies | 0 |
| LIST full-body reads | 0 |
| Selected full-skill reads | 40 each |
| Unrelated full-skill reads | 0 |
| Bootstrap target | 800 tokens |
| Descriptor tokens (max) | 10,478 |
| Selected instruction tokens (max) | 27,279 |
| Context Pack tokens (max) | 0 in pure universal planning; policy ceiling 4,000 |
| Maximum context requests | 7 |
| Profile activation / automatic resume | 0 / false |

## Future consumer onboarding

A future IDE or LLM client follows the matrix checklist: discover the canonical
contract and descriptors; translate native input/session without policy; report
capabilities and negotiation outcomes; resolve only the named workspace;
consume route/packet/graph/context/gate/evidence/result/continuation stages;
render the semantic result; verify receipt/safety/context/freshness invariants;
run the universal corpus and supplemental checks; and obtain separate activation
authorization with canary/fallback/rollback. No new domain orchestrator,
catalog, qualification logic, route policy, gate policy, or client semantic fork
is required.

## Universal conformance evidence

| Measure | Result |
|---|---:|
| Semantic scenarios | 228 (minimum 200) |
| Consumer surfaces | 7 |
| Adapter route comparisons | 1,596 |
| Expected route-family correctness | 100% |
| Client-name-only route differences | 0 |
| Full pipeline scenarios per consumer | 12 |
| Full pipeline executions | 84 |
| Task/evidence packet validation | 100% |
| Safety parity | 100% |
| Model/provider swap route invariant | PASS |
| Required capability omission | explicit `UNAVAILABLE` |
| Alternative capability | explicit `SUPPORTED_WITH_ALTERNATIVE` |
| Silent required-node omission | 0 |
| Provider calls / writes | 0 / 0 |
| Automatic resume / transcript replay | 0 / 0 |
| Client activation / configuration change | 0 / 0 |
| Default promotion | 0 |

The corpus covers Code, Research, Bible, Design, Web, Memory, Review, QA,
Handoff, Careful, Video, mixed routes, high-risk and ambiguous requests,
stale/continuation state, dormant specialists, capability-unavailable paths,
and model-swap cases. Route comparison is semantic: route family, owner,
specialists, qualification, risk, confirmation, gates, context scopes, and
continuity are compared independently of native serialization.

## Capability negotiation and degradation

The universal negotiation contract is capability-driven and returns only the
following explicit outcomes:

`SUPPORTED`, `SUPPORTED_WITH_ALTERNATIVE`, `DEGRADED`,
`REQUIRES_EXTERNAL_CAPABILITY`, `UNAVAILABLE`, and `BLOCKED`.

Tests cover a supported set, an alternative implementation, an external
capability requirement, missing required and optional capabilities, and an
explicit block. Required capabilities are never silently omitted; missing
required capability blocks the BrainResult while preserving zero activity.

## Atomic context, lazy discovery, and continuity

Each consumer's 12 full pipeline cases reported the same bounded context
policy: universal bootstrap target `800` tokens, Context Broker/task context
ceiling `4,000` tokens, no full repository bootstrap, no full conversation
bootstrap, and no transcript replay. Descriptor listing remains metadata-only;
full instruction bodies are read only after semantic selection. Dormant
`investigate`, planning, web-design, Bible, and other specialist capabilities
remain discoverable without ambient activation and are selected only when
relevant. Stale continuation fails closed, exposes reconciliation state, and
does not resume automatically.

## Consumer readiness

| Consumer | Contract consumption | Runtime activation | Readiness boundary |
|---|---|---|---|
| Codex | reference adapter PASS; existing Code canary retained | not performed | `CANARY_ACCEPTED`, promotion-ready Code only |
| Claude Code | reference adapter PASS | not performed | separate rollout evaluation |
| Cursor | reference adapter PASS | not performed | separate rollout evaluation |
| Kiro | reference adapter PASS; repository projection accounted | not performed | ignored live projection requires separate authorization |
| Antigravity | reference adapter PASS | not performed | separate rollout evaluation |
| Gemini | reference adapter PASS | not performed | separate rollout evaluation |
| Workbench | reference adapter PASS | not performed | provider/action boundary; separate evaluation |

No global profile, active skill surface, client configuration, provider,
external system, Mind state, deployment, or production route was changed.

## Existing regression gates

The following clean-revision gates passed:

- Phase 3 validator: PASS.
- Phase 4 validator: PASS.
- Phase 5 validator: PASS; its existing Kiro readiness boundary remains
  explicitly blocked only for ignored live symlink activation.
- Phase 6A validator: PASS.
- Umbrella Orchestrator v2 validator: PASS.
- Phase 6B canary runner: `CANARY_ACCEPTED`; source-clean, routing, quality,
  safety, rollback, legacy, projection, Kiro-accounting, and dormant checks
  all PASS.
- Phase 6C extended runner: all hard checks PASS.
- Phase 6C isolated coding fixtures: all 20 disposable fixtures PASS, with the
  existing one bounded repair-cycle success retained.
- Universal consumer contract tests: 11/11 PASS.
- Broker, Universal Entry, continuity, and projection suites: 27/27 PASS.
- Orchestration catalog/router/graph/packet suites: 29/29 PASS.
- Capability manifest/state/current capability validators: PASS.
- `git diff --check`: PASS.

The dormant skill source described an older
`tools/validate-agent-capability-onboarding.mjs` helper that is not present in
this revision. The repository's current capability-manifest, capability-state,
and Infinite Brain capability validators were run instead and passed; no new
capability was installed.

## Acceptance and non-activation

Infinite Brain Orchestrator v2 Phase 6D is accepted: Brain now exposes one
versioned, LLM-agnostic and IDE-agnostic orchestration contract consumed through
thin environment adapters. Routing, qualification, skill discovery, atomic
context, task/evidence packets, composition, quality gates, safety, and
continuity remain canonical in Brain rather than in individual clients.

Codex Code retains PROMOTION_READY status under the universal consumer
contract. Future consumer rollouts can now reuse the same orchestration
architecture rather than implementing client-specific orchestration.

This acceptance does not promote Codex Code to a default, activate another
consumer or domain, change Kiro live state, expand active skills, admit a
provider, write Mind, execute external/repository actions, or enable automatic
resume.
