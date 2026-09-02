# Infinite Brain Orchestrator v2

**Status:** Phase 4 bounded composition shadow implementation complete; no client activation or execution authorized by this document
**Date:** 2026-09-01
**Predecessor evidence:** `operations/reports/infinite-brain-orchestrator-audit-2026-09-01.md`
**Authority boundary:** Brain owns capability, routing, policy, validation, and orchestration knowledge; Mind remains authoritative for human meaning, strategy, preferences, commitments, and personal/business context.

## Purpose

Orchestrator v2 is a thin, provider-neutral routing and composition layer for Infinite Brain. A user should be able to describe an outcome in ordinary language. The system should select the smallest reliable domain workflow, retrieve only the relevant cited context, apply the correct risk and quality gates, and return a bounded result with evidence and a next action.

V2 is not a new domain skill and is not a replacement for `code`, `research`, `design`, `web`, `video`, `memory`, `review`, `qa`, `handoff`, `careful`, or their specialists. It is an adapter and contract layer above them.

## Current contracts to extend

V2 must reuse, not compete with, these current surfaces:

| Existing surface | V2 role |
|---|---|
| `operations/specs/context-learning/broker-contracts-v1.schema.json` | Provider-neutral context/capability operations and descriptor seed |
| `operations/specs/context-pack.schema.json` | Cited, freshness-visible, bounded context retrieval envelope |
| `tools/context-learning/context-broker.mjs` | Read-only progressive retrieval and capability inspection implementation |
| `tools/context-learning/universal-brain-entry.mjs` and consumer | Minimal entry identity, authority boundaries, navigation, and fail-closed consumption |
| `operations/specs/context-learning/session-continuity.v1.schema.json` | Session identity, objective, state, artifacts, handoff, and freshness |
| `projects/brain-core/src/adapters/agent-capabilities.ts` | Existing seed for safety class, approval requirements, preferred task types, and verification |
| `docs/skills/profiles/*.txt` | Human-curated activation/context profiles; v2 must validate but not silently rewrite them |
| `ai/policy/context-loading-order.md` | Least-context loading order |
| `ai/policy/routing.md` and `ai/policy/guardrails.md` | Runtime roles, escalation, decomposition, and safety policy |

The current Broker already defines nine read-only operations, progressive capability inspection, risk classes, confirmation classes, source revisions, health, and freshness. V2 adds the missing orchestration metadata and route/state envelopes around those primitives.

## Design principles

1. **Intent before skill names.** Users describe outcomes; the router chooses capabilities.
2. **Descriptors before instructions.** List compact metadata first; load full skill instructions only after relevance and policy selection.
3. **Domain quality stays local.** Bible method, design judgment, code review, QA, and video production remain specialist-owned.
4. **Mind first, Brain second.** Retrieve human meaning and priorities when relevant, then machine capability and policy.
5. **Read-only by default.** A route is not permission. Execution remains with the environment and explicit authorization boundaries.
6. **One question maximum by default.** Ask only if missing information materially changes the safe route, scope, or output.
7. **Evidence travels with decisions.** Results identify sources, freshness, validation, and exclusions without copying canonical truth.
8. **Risk is declared before execution.** External, credential, financial, destructive, database, deployment, and public-content work gets explicit gates.
9. **State is sparse and resumable.** Store references and summaries, not transcripts or duplicated knowledge.
10. **Progressive activation.** Shadow and conformance modes precede client or default-profile activation.

## Three-layer model

```text
Layer 0 — Universal entry and policy boundary
  identity, Brain/Mind authority, context bootstrap, risk preflight, question budget,
  route explanation, task/evidence/continuity envelope, fail-closed behavior

Layer 1 — Thin domain orchestrator adapters
  code, research, design, web, video, memory, review, QA, handoff, careful
  classify → select local workflow → declare required context/gates → return envelope

Layer 2 — Domain engines and capabilities
  Bible method, Scripture sources, Graphify/CBM navigation, Firecrawl/Playwright,
  FFmpeg/video pipeline, gstack review/QA, CLIs, MCP tools, validators, and runbooks
```

Layer 0 must not absorb Layer 2 instructions. Layer 1 must not duplicate Layer 2 bodies. Layer 2 remains independently callable for explicitly scoped work.

## Universal entry lifecycle

```text
user intent
  → bootstrap Brain/Mind identity and authority
  → normalize request
  → classify intent, domain, artifact, risk, freshness, and output
  → list compact capability descriptors
  → ask zero or one material question
  → create task packet
  → resolve bounded cited context
  → select one orchestrator or a small composition graph
  → inspect selected instructions only
  → execute inside existing client/tool policy
  → run domain and risk gates
  → emit result + evidence packet
  → update sparse continuity pointer when needed
```

The first implementation should be shadow-only: it may explain this lifecycle and expose what it would select, but must not activate profiles, alter client configuration, call providers, write files, or execute capabilities.

## Phase 3 implementation truth

The Phase 3 shadow implementation is now present at:

- `operations/specs/infinite-brain-task-packet.v1.schema.json`
- `operations/specs/infinite-brain-evidence-packet.v1.schema.json`
- `tools/orchestration/task-evidence-packets.mjs`
- `tools/orchestration/domain-adapters.mjs`
- `tools/validate-orchestrator-v2-phase3.mjs`

It creates bounded task/evidence envelopes, Context Requests, gate declarations, thin Code/Research/Design/Memory/Review/QA/Handoff/Careful adapter traces, and revision-aware continuation pointers from the existing shadow router. Selected source inspection is exact-source and reference-only. The implementation remains shadow-only: no providers, external systems, Mind writes, profile activation, client configuration changes, execution, or automatic resume are exposed.

## Phase 4 implementation truth

Phase 4 extends the Phase 3 Task/Evidence Packet architecture with a bounded composition graph. The contract is defined in `operations/specs/infinite-brain-composition-graph.v1.schema.json`; its local shadow runtime is `tools/orchestration/composition-graph.mjs`, with regression coverage in `tools/orchestration/composition-graph.test.mjs` and `tools/orchestration/composition-fixtures-v4.json`.

The graph has exactly one `PRIMARY_OWNER`, references an existing atomic Phase 3 subtask from every node, and keeps specialists, context acquisition, execution placeholders, quality gates, safety gates, merges, synthesis, and continuation as explicit bounded nodes. Defaults are max depth 10, 24 nodes, 6 specialists per phase, parallel width 4, 2 repair edges, and merge fan-in 8. Exceeding a bound, introducing a cycle, unknown capability, implicit dependency, unsafe parallel group, missing conflict policy, missing required gate, stale source, or execution-ready confirmation-dependent mutation fails closed.

Safe parallelism is an eligibility decision only. It requires independent inputs and unresolved outputs, no overlapping authority writes, bounded context, deterministic failure behavior, a merge policy, and risk compatible with parallel work. The implementation does not spawn agents or call providers. `orchestrate` is reused as an internal policy reference for bounded independent work; it is not replaced by a second executor. `forge` remains an explicitly scoped sequential zero-to-production workflow and is never selected by vague composition prompts.

Evidence merges preserve packet provenance, source revisions, claims, uncertainties, gate results, and failures. Contradictory claims and revision mismatches remain visible as open or blocking conflicts. Synthesis consumes selected Evidence Packet references, success criteria, gate results, decisions, conflicts, and uncertainty—not raw graph context or full skill bodies. Continuation remains explicit and stale/conflicted state blocks resume.

The canonical Phase 3 conformance test that required B8.1–B8.6 to remain planned was obsolete: the implementation plan records all six tasks as complete and accepted. Phase 4 replaces that assertion with an exact complete-state reconciliation assertion; the authoritative conformance suite passes. This changes no client activation or provider admission.

## Capability descriptor v2

This is a proposed extension of the existing Broker `capabilityDescriptor` and Brain Core agent capability summary. It is metadata, not a full skill body.

```yaml
schemaVersion: "2.0.0"
capabilityId: "skill.research"
kind: skill | orchestrator | specialist | gate | runbook | named_cli | validator | mcp_server | mcp_tool | service | workflow
role: router | domain_orchestrator | specialist | quality_gate | safety_gate | adapter | execution
label: "Research Orchestrator"
sourceRef: "ai/skills/custom/research/SKILL.md"
sourceRevision: "git-or-provider revision"
profileRefs: ["default", "research"]
intents: [research, fact_check, comparison, source_verification]
domains: [general_research]
triggers: ["research", "verify", "compare", "find sources"]
excludes: ["interactive form submission", "deployment"]
inputSchemaRef: "..."
outputSchemaRef: "..."
requiredContextScopes: [brain_policy, mind_strategy_when_relevant, source_material]
contextCost:
  descriptorTokens: 70
  selectedInstructionTokens: 900
  evidenceBudgetTokens: 2400
  maxTotalTokens: 4000
stateModel: stateless | task_packet | project_state | session_continuity
sideEffects: [none]
riskClass: read-only | low | medium | high | critical
confirmationClass: none | policy | user | admin
qualityGateRefs: [citation_completeness, source_provenance]
failureModes: [source_unavailable, stale_context, contradictory_sources]
continuity: pointer_only | resumable | project_checkpoint
composition:
  canPrecede: [memory_capture]
  canFollow: [universal_router]
  optionalChildren: [bible-research, web, scripture-sources]
health: healthy | degraded | unavailable | disabled
freshness: fresh | review_due | stale | superseded | contradicted | unknown
```

### Descriptor rules

- `sourceRef`, `sourceRevision`, `health`, and `freshness` are required for any selected capability.
- `kind`, `role`, `intents`, `domains`, `inputSchemaRef`, `outputSchemaRef`, and `requiredContextScopes` determine routing; the body does not.
- `sideEffects`, `riskClass`, and `confirmationClass` are mandatory before a capability can be selected for action.
- `qualityGateRefs` and `failureModes` make the route explainable and testable.
- `contextCost` is a forecast, not a promise. Actual context usage is recorded in the result/evidence packet.
- `profileRefs` are hints for curated activation, not permission to silently mutate a profile.
- A stale, contradicted, superseded, or unavailable descriptor may be listed with a warning but must not be selected as current execution capability.
- Instructions are retrieved through `capabilities_inspect` only after selected relevance; the current Broker already rejects instruction retrieval for metadata-only relevance.

## Request normalization

The router creates a normalized request internally. It should never require the user to provide all fields.

```yaml
requestId: "stable request identifier"
rawIntent: "the original user request"
goal: "desired outcome"
scope:
  workspace: "current workspace when known"
  repository: "repo identifier when known"
  paths: []
  inScope: []
  outOfScope: []
artifact:
  target: code | design | research | bible | memory | web | video | operations | unknown
  kind: file | report | answer | plan | rendered_media | external_record | unknown
output:
  form: answer | patch | report | plan | preview | packet | handoff
  audience: user | operator | collaborator | public | unknown
constraints: []
freshnessNeed: none | current | live | archival | unknown
riskHints: []
authorization: inferred_from_request | explicit_confirmation_required | unavailable
```

Unknown fields are allowed. The router asks a question only when an unknown is material to safety or output quality. It must not ask the user to choose a skill, model, provider, or profile when the system can select those internally.

## Minimum-question policy

### Ask zero questions when

- the goal, target, and safe output are inferable;
- the next action is read-only, local, reversible, and within scope;
- a domain has an accepted default mode;
- a missing preference affects polish but not correctness or safety.

### Ask one bundled question when

- two or more missing values are coupled and change the route or deliverable;
- a design request cannot distinguish a new build, reference mimic, or existing upgrade from available evidence;
- a research request lacks both a substantive question and an evidence/output target;
- a QA request lacks a target environment and no local evidence can identify it;
- an external/destructive action lacks target, scope, or authorization.

The one question should state safe defaults and request only the missing decision. “What are you building, where is it starting from, what vibe, and what is the goal?” is too broad when repository evidence can answer part of it. Domain workflows may still stop for a required approval or risk confirmation; that is a gate, not an intake questionnaire.

## Domain route map

| Normalized intent | Primary adapter | Specialist composition | Required gates |
|---|---|---|---|
| understand/fix/build/refactor/document code | `code` | Graph/CBM navigation, investigate, plan, implementation | tests; review before ship; careful for high-risk |
| research/verify/compare | `research` | `web`, Firecrawl, academic/source tools, memory only when requested | primary sources, citations, freshness, disagreement |
| passage/theology/sermon/Bible question | `research` → `bible-research` | `scripture-sources`, translation/original-language checks when justified | context/exegesis, tradition/audience disclosure, provenance |
| new UI/landing page/upgrade/mimic | `design` | design-system, web-design, design review, motion, visual QA | design artifact, user triage/approval where material |
| web research/browser/test/automation/scraping | `web` or `research` by intent | Firecrawl, browse, Playwright, Apify | auth/external-state/anti-bot and repeatability gates |
| script/voice/render/thumbnail/video pipeline | `video` | Viral Flow, FFmpeg, design, media acquisition, STB | asset manifest, render/package QA, posting approval |
| remember/recall/facts/maintenance | `memory` | Mind/Brain authority classifier, facts tools, learner | privacy, authority, duplicate/supersession review |
| review code or pre-landing state | `review` | Codex/secondary review only by risk/size policy | severity, scope, evidence, no implicit broad rewrite |
| test a site or application | `qa` | web/browser, test bootstrap only when authorized | clean-tree/setup gate, screenshots/console, regression evidence |
| continue/pause/switch runtime | `handoff` | continuity validator, Context Broker | identity/freshness/conflict; confirmation before mutation |
| delete/deploy/credential/billing/database/public write | `careful` + domain adapter | deploy/CLI/MCP capability as applicable | explicit target, risk preflight, confirmation, rollback/evidence |

This map is proposed routing metadata. It does not claim that dormant adapters are currently active or that profile activation is currently automatic.

## Composition contract

The router should return a small graph, not prose instructions copied from every skill.

```yaml
routeId: "route-..."
requestId: "request-..."
nodes:
  - nodeId: entry
    capabilityId: universal.entry
    mode: bootstrap
  - nodeId: context
    capabilityId: context.broker.resolve
    mode: selected
  - nodeId: domain
    capabilityId: skill.research
    mode: selected
  - nodeId: specialist
    capabilityId: skill.bible-research
    mode: optional
  - nodeId: gate
    capabilityId: gate.citation-completeness
    mode: required
edges:
  - [entry, context]
  - [context, domain]
  - [domain, specialist]
  - [specialist, gate]
termination:
  success: required gates pass and requested output exists
  stop: user decision, stale authority, unresolved conflict, or budget exhausted
  handoff: context/state exceeds current runtime or surface boundary
```

Composition rules:

- one primary domain orchestrator per task unless the normalized request has genuinely independent domains;
- at most three top-level domain nodes before an explicit decomposition decision;
- specialist nodes are selected by the primary adapter, not exposed as mandatory user choices;
- parallelism requires independent inputs, mergeable evidence, and a measurable benefit;
- every node declares output, failure, cost, and side-effect metadata;
- a failed or unavailable optional specialist produces a visible fallback, never silent substitution;
- the graph terminates on a gate result, not on token exhaustion alone.

## Task packet

The task packet is the ephemeral orchestration envelope. It references canonical sources; it does not become a second knowledge store.

```yaml
schemaVersion: "1.0.0"
taskId: "task-..."
request: <normalized request>
route:
  routeId: "route-..."
  selectedCapabilities: []
  rejectedAlternatives: []
  rationale: []
scope: <bounded scope>
context:
  bootstrapRef: "entry/pack reference"
  contextPackRefs: []
  requiredScopes: []
  budget: { maxTokens: 4000, usedTokens: 0 }
qualification:
  questionAsked: false
  questionRef: null
  assumptions: []
permissions:
  riskClass: read-only
  confirmationClass: none
  confirmationState: not_required | required | received | denied
plan:
  nodes: []
  currentNode: null
state:
  status: planned | active | blocked | awaiting_user | complete | handed_off
  completed: []
  pending: []
  blockers: []
  decisions: []
evidenceRefs: []
artifactRefs: []
validationRefs: []
continuityRef: null
nextAction: "one exact next action"
```

The packet may be held in memory or a bounded local projection during a run. It must not store transcripts, secrets, model/provider settings, complete logs, or copied Brain/Mind knowledge. For durable continuation, project only the existing session-continuity schema and `.ai/current.md` convention.

## Evidence packet

The evidence packet is the result/quality envelope. It should be compatible with the current Context Pack and report conventions.

```yaml
schemaVersion: "1.0.0"
evidenceId: "evidence-..."
taskId: "task-..."
status: complete | partial | blocked | failed
claims:
  - claimId: "claim-..."
    summary: "bounded claim or finding"
    sourceRefs: []
    authority: canonical | supporting | conflicting | untrusted
    freshness: fresh | review_due | stale | superseded | contradicted | unknown
    confidence: 0.0
observations: []
decisions: []
validation:
  checks: []
  passed: 0
  failed: 0
  skipped: 0
gates:
  required: []
  passed: []
  blocked: []
exclusions:
  - item: "not loaded or not used"
    reason: "budget, privacy, freshness, or scope"
budget:
  maxTokens: 4000
  usedTokens: 0
provenance:
  sourceRevisions: []
  retrievers: []
  deterministicOrder: true
safety:
  providersCalled: 0
  writesPerformed: 0
  authorityChanged: false
nextAction: "one exact next action"
```

For research, `claims[].sourceRefs` should point to a source ledger or cited source table. For Bible research, it should additionally identify passage/translation/tradition/source boundaries. For code and QA, validation references should point to commands, tests, screenshots, diffs, and review results. For memory, evidence must retain capture provenance and authority classification.

## Context phases and budgets

These are target defaults derived from the existing 800-token Broker bootstrap and 4,000-token context-pack ceiling. They are not current client behavior.

| Phase | Purpose | Target budget | Never load |
|---|---|---:|---|
| P0 bootstrap | identity, authority, freshness, continuity, navigation | ≤800 tokens | full repos, conversations, secrets, client config |
| P1 descriptors | candidate capabilities and risk/quality metadata | ≤1,200 tokens | full skill bodies |
| P2 selected instructions | primary adapter plus required specialist/gate instructions | ≤2,400 tokens | unrelated profiles and tool bodies |
| P3 evidence | exact sources, outputs, validation, conflicts | ≤4,000 total pack ceiling | unbounded logs/transcripts |
| P4 result | answer/artifacts, provenance, next action | ≤1,000 tokens plus artifacts | duplicate source content |
| P5 handoff | sparse continuation state | 200–500 tokens; hard max 800 | transcript, secrets, provider settings |

Budget behavior:

- reserve space for safety warnings, conflicts, unknowns, and citations before optional detail;
- stop or ask when the next retrieval would exceed budget and is material;
- prefer a smaller exact source set over a larger stale projection;
- record truncation/exclusion reasons in the packet;
- use Gemini preprocessing only for genuinely large input, then pass a compact cited brief to the acting runtime;
- do not solve context pressure by activating every profile or deleting source skills.

## Risk routing and confirmation

| Risk class | Examples | Default behavior |
|---|---|---|
| read-only | inspect, explain, local source research, report | proceed if scope is clear |
| low | reversible local artifact generation, bounded test fixture | proceed inside requested scope; validate |
| medium | repository write, package/config change, local app mutation | state scope and validation; follow environment policy |
| high | external API write, public content, deploy, credential use, billing, database migration | preflight, explicit confirmation, dedicated gate, evidence |
| critical | destructive deletion, production data, irreversible migration, credential rotation, financial transfer | fail closed until target/authority/rollback are explicitly verified and confirmed |

The router may identify risk but never grants permission. Existing guardrails, careful hooks, environment policies, approval endpoints, and human confirmation remain authoritative. A capability descriptor with `confirmationClass: user` or `admin` cannot be executed by descriptor discovery or `capabilities_inspect`.

## Quality-gate policy

The universal layer selects gates; domain layers define the quality standard.

| Domain | Minimum gate | Escalation trigger |
|---|---|---|
| Code | exact-source scope, validation, review before ship | auth, billing, migration, production, broad diff |
| Design | design artifact, implementation/visual review, motion when relevant | new system, reference mimic, major UI change |
| Research | source provenance, citations, freshness, disagreement/unknowns | high-stakes claim, academic/archival, conflicting sources |
| Bible | passage context, method, translation/source transparency, tradition/audience disclosure | theological dispute, original-language claim, public teaching artifact |
| Memory | privacy, authority owner, duplicate/supersession, explicit capture intent | Mind/Brain boundary ambiguity or sensitive content |
| Review | severity, scope, evidence, bounded fix policy | large diff, high risk, contradictory findings |
| QA | environment baseline, test plan, issue evidence, regression validation | external site, missing test harness, public/customer path |
| Handoff | identity/revision/freshness/conflict and exact next action | mismatched worktree, stale evidence, competing sessions |
| Careful | command/path/environment preflight and confirmation | destructive, credentials, database, production, external state |

The current gstack review and QA workflows remain available as domain engines. V2 should call them through adapters that select report-only versus fix-enabled modes and record the result in the evidence packet.

## Failure and fallback contract

Every route returns one of:

- `ready`: enough fresh authority/context and no blocked gate;
- `needs_question`: exactly one material question is required;
- `needs_confirmation`: route is known but action authority is not;
- `blocked`: stale/contradicted authority, unresolved conflict, missing capability, or failed prerequisite;
- `partial`: bounded result with explicit unknowns/exclusions;
- `handed_off`: continuation packet created or recommended;
- `complete`: requested output and required gates passed.

Failure rules:

- no silent fallback from a stale or contradictory source;
- optional accelerator failure falls back to exact-source/bounded behavior and is recorded;
- unresolved capability/profile paths are reported, not silently skipped;
- provider failure does not become user-visible fabricated output;
- missing context never becomes permission to act;
- budget exhaustion returns partial/blocked with an exact next action;
- repeated validation failure stops or hands off according to current policy.

## Continuity contract

Use the existing session-continuity model for cross-surface continuation. A v2 packet may point to:

- repository, worktree, branch, and Brain revision;
- normalized goal and bounded scope;
- route and selected capability IDs;
- completed/pending/blocker/decision summaries;
- artifact, evidence, validation, and report references;
- exact continuation point and next action;
- confirmation requirement.

It must not store full conversation history, model/provider settings, secrets, execution grants, or copied canonical knowledge. Resume must verify identity, freshness, missing references, and conflicts before loading selected context; automatic takeover remains disabled until separately authorized.

## Catalog ownership and reconciliation

V2 should converge these partial surfaces into one read projection:

1. source `SKILL.md` and runbook metadata;
2. curated profile membership;
3. Brain Core agent capability summaries;
4. Context Broker capability descriptors;
5. client projection/health state.

The projection must expose provenance for every field and distinguish “source exists,” “profile contains,” “active/exported,” “consumer reachable,” and “runtime activated.” It must not pretend that a Brain Core placeholder registry or a successful fixture test proves live client activation.

## Conformance requirements

Before activation, a v2 implementation must pass deterministic fixtures for:

- zero-question safe default routing;
- one bundled question for a material ambiguity;
- no skill/provider/model question when selection is possible;
- code, design, research, Bible, memory, review, QA, handoff, and careful prompts;
- mixed-domain composition with explicit gate ordering;
- profile resolution and consumer reachability;
- stale/contradicted/unknown context fail-closed behavior;
- capability descriptor/list/inspect separation;
- bounded phase budgets and exclusion reporting;
- no provider call/write/execution in shadow mode;
- task/evidence packet schema and continuity identity validation;
- domain-gate evidence and exact next action.

## Non-goals and explicit boundaries

- No production behavior change is authorized here.
- No active skill/profile symlink change is authorized here.
- No client configuration or universal bootstrap activation is authorized here.
- No new canonical Mind/Brain store is introduced.
- No conversation ingestion or autonomous learning promotion is introduced.
- No universal generic quality prompt replaces Bible, design, code, research, video, review, or QA expertise.
- No automatic execution authority is granted by the catalog or route graph.
- No external provider, deployment, database, billing, credential, or public-content action is enabled.
- No broad deletion or rewrite of existing skills is required.

## Acceptance definition for a future implementation

Orchestrator v2 is ready for bounded activation only when the shadow router, catalog projection, packet validators, route corpus, profile checks, and consumer conformance results are reproducible from a clean revision; every route has source/freshness/risk/gate evidence; the current read-only Broker and universal-entry tests remain green; and a separately authorized activation packet names exact clients, rollback, permissions, and success thresholds.
