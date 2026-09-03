# Infinite Brain Orchestrator v2

**Status:** Phase 9A accepted; Codex Code and Codex Research remain v2 defaults and Codex Design/Web is canary-only; Claude Research and all other consumer/domain defaults remain inactive; no production execution authorized by this document
**Date:** 2026-09-03
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

## Phase 5 implementation truth — 2026-09-02

Phase 5 adds a real Codex consumer-shaped, read-only pilot. The path is:

```text
Codex request
  → Universal Entry descriptor bootstrap
  → descriptor-first qualification
  → bounded Context Broker bootstrap and selected pack
  → task/evidence/continuity packet pointers
  → Phase 4 composition shadow graph
  → bounded receipt and prior-path fallback
```

The pilot is explicitly identified as `CODEX_READ_ONLY_PILOT_MODE`. It consumes exact Brain source and projection references without exposing full client configuration, full conversation history, secrets, provider/model settings, or unselected skill bodies. It does not execute, call providers, write to Mind or repositories, activate profiles, resume automatically, take over a client, or mutate authority. `enabled=false` returns the exact prior-path result with `pilot_disabled`.

The pilot records separate conformance and activation states. A successful run is `CONFORMANT` and `PILOT-ACTIVE` while `activated`, `productionActive`, and `activationPerformed` remain false. Freshness states remain distinct: `CURRENT`, `STALE`, `CONFLICTED`, and `UNAVAILABLE`. Failure and fallback receipts preserve the reason and prior path rather than silently selecting stale or missing authority.

Phase 5 also reconciles profile source resolution and tracked consumer projections. Exact nested/file-backed skill sources are recognized; unavailable historical entries are governed by `operations/specs/profile-unavailable-allowlist.json`; duplicate full-current membership is deterministic; and the tracked Antigravity projection uses the active source through a relative repository link. Workbench is recorded as not applicable because it is not a skill-export consumer. Kiro is intentionally not mutated: its seven missing entry symlinks (`careful`, `code`, `handoff`, `memory`, `qa`, `research`, `review`) remain a separately authorized client boundary. Phase 6A accounts for them through the canonical `operations/specs/infinite-brain-kiro-projection.v1.json` manifest; repository projection conformance is proven without claiming live client installation.

The reproducible Phase 5 closeout evidence is `operations/reports/infinite-brain-orchestrator-v2-phase5-closeout-2026-09-02.md`. The validator is `tools/validate-orchestrator-v2-phase5.mjs`; its passing result is a conformance/pilot result, not permission for production activation. The current corpus contains 128 cases, including eight explicit fallback/edge cases, and reports route, gate, bootstrap, selected-instruction, context-pack, packet, graph, evidence, privacy, safety, and activation metrics.

## Phase 6A activation readiness truth — 2026-09-02

Phase 6A is a readiness-hardening phase only. It does not activate v2, modify ignored Kiro client state, change active skills, load providers, write Mind, resume conversations, deploy, or execute external/repository actions. The graph now inherits Code/Web/Mixed route ownership where those routes are authoritative and unions task-packet gates with only applicable local policy gates. Read-only analysis and planning no longer inherit mutation-quality or confirmation gates from sensitive nouns alone.

The canonical canary contract is `operations/specs/infinite-brain-codex-canary-activation.v1.json`. It is prepared but disabled, limited to Codex and the Code `read-only-analysis`/`read-only-plan` route classes, and falls back to the current Codex path on stale/conflicted source, unsafe routing, gate failure, context explosion, projection drift, unexpected activation/write, or any route/gate regression. The simulated rollback requires no manual configuration surgery and restores the legacy path.

The Phase 6A readiness report and deterministic validator are `operations/reports/infinite-brain-orchestrator-v2-phase6a-readiness-2026-09-02.md` and `tools/validate-orchestrator-v2-phase6a.mjs`. No production activation is implied by a passing result.

## Phase 6B bounded Codex canary truth — 2026-09-02

Phase 6B executed the explicitly authorized first activation candidate from the Phase 6A report: Codex Code, limited to `read-only-analysis` and `read-only-plan`. The real repository-supported path is `runCodexLiveConsumptionPilot` → Universal Brain Entry/consumer gates → `runCodexReadOnlyPilot` → descriptor-first routing, bounded context, task/evidence packets, composition graph, and continuity references. The canary controller is scoped to Codex + Code and cannot transition to `PRODUCTION_DEFAULT`.

The clean-revision acceptance run is recorded in `operations/reports/infinite-brain-orchestrator-v2-phase6b-codex-canary-2026-09-02.md` at source revision `63e3ad95d442b6637fdbd191e3439c1401c7e06d`. It passed a serial five-case burn-in and a 45-case cohort (20 normal, 10 vague/edge, 5 stale/conflict/continuation, 5 high-risk, and 5 controlled-fallback cases). Routing, safety, quality, scope, stale-current, rollback, legacy availability, consumer projections, dormant behavior, and output checks all passed. No provider calls, writes, Mind writes, credential/financial/destructive actions, profile activation, client configuration change, automatic resume/takeover, or production routing occurred.

The canary is `CANARY_ACCEPTED`, not a production default. The prior Codex path remains available; high-risk, out-of-domain, stale/conflicted, descriptor-stale, and injected-failure cases select the legacy path or fail closed. The acceptance does not authorize another consumer, another domain, Kiro live projection changes, active-skill expansion, provider admission, external state, or production execution.

## Phase 6D universal consumer contract — 2026-09-02

Phase 6D defines one Brain-owned, versioned, provider-neutral and IDE-neutral
consumer contract:

```text
BrainRequest → BrainRoute → TaskPacket → CompositionGraph
  → ContextRequest[] → CapabilitySelection[] → GateSelection[]
  → EvidencePacket[] → BrainResult → Continuation
```

The canonical machine-readable contract is
`operations/specs/infinite-brain-universal-consumer-contract.v1.json` with its
schema beside it. Brain remains the authority for routing, qualification,
specialist selection, context budgets, packet decomposition, composition,
quality/safety gates, evidence semantics, receipts, and continuity. Conversation
transcripts are not canonical state, and continuation never automatically
resumes a task.

Environment adapters are deliberately thin. They translate native input and
session metadata, report capabilities, resolve a workspace boundary, execute
only already-approved actions, translate observations into evidence references,
render results, expose continuation identifiers, and respect canary/fallback
decisions. They do not choose domain methods, models, providers, gates,
specialists, context budgets, or packet structure.

Capability negotiation is explicit and capability-driven rather than
consumer-name-driven. Every required capability produces one of
`SUPPORTED`, `SUPPORTED_WITH_ALTERNATIVE`, `DEGRADED`,
`REQUIRES_EXTERNAL_CAPABILITY`, `UNAVAILABLE`, or `BLOCKED`; required omissions
never disappear silently. Equivalent environment capabilities receive the same
semantic route. The universal receipt schema is shared by all consumers and
records semantic references, revisions, degradation, safety, and bounded
metrics without storing the raw prompt or transcript.

The reference adapter matrix covers Codex, Claude Code, Cursor, Kiro,
Antigravity, Gemini, and Workbench. This phase assesses each consumer's
contract/readiness boundary but does not activate any client, profile, domain,
provider, default route, or live projection. Codex Code retains its existing
`CANARY_ACCEPTED`/promotion-ready status only.

## Phase 7A Codex Code default truth — 2026-09-02

Phase 7A promotes exactly one consumer/domain pair: Codex + Code. The canonical
promotion contract is `operations/specs/infinite-brain-codex-code-default.v1.json`
with its adjacent schema. The accepted transition is:

```text
CANARY_ACCEPTED → CODE_V2_DEFAULT_FOR_CODEX
```

The active default entry remains a thin Codex adapter around the Brain-owned
universal consumer contract. It invokes the existing Universal Entry, catalog,
Context Broker, packet, composition-graph, gate, continuity, and receipt path;
it does not duplicate routing, qualification, specialist, model, context, or
gate policy. The prior `codex-current-entry` path remains available and is
selected for disabled/default-rolled-back state, high or critical risk,
out-of-domain requests, stale/conflicted context, projection drift, controlled
failures, or any safety/validation regression.

Phase 7A's default evidence requires a serial ten-request Code burn-in, a
100-plus default-path cohort, at least 25 disposable isolated Code tasks with a
bounded repair cycle, high-risk and stale/conflict checks, dormant capability
checks, atomic-context bounds, proportional Review/QA selection, controlled
fallbacks, receipt privacy, model-swap invariance, and a live rollback/restore
drill. Default activation is not production execution: productionActive remains
false, providers remain unavailable, no client configuration or active-skill
projection changes are made, and no other consumer or domain is activated.

The Phase 7A closeout report records the activation timestamp, activation source
revision, Universal Consumer Contract version, adapter revision, mechanism,
prior path, rollback result, thresholds, cohort evidence, non-regression gates,
and exactly one recommended next domain canary plus one first non-Codex consumer
canary. Any future domain or consumer canary requires its own explicit
authorization and must not be inferred from this Code default.

## Phase 7B second-consumer Code canary truth — 2026-09-02

Phase 7B activates exactly one additional consumer/domain pair: Claude Code +
Code. Phase 7A's exact recommendation was followed because Claude Code has a
locally reachable runtime and equivalent filesystem, Git, shell, testing,
qualification, receipt, and continuity capabilities. The canonical activation
packet is `operations/specs/infinite-brain-claude-code-canary.v1.json`.

The Claude Code adapter is `adapter.claude-code.v1`. It translates native
message/workspace/session input, reports capabilities, renders the universal
result, and exposes the prior path. Brain remains the owner of routing,
qualification, specialist selection, context budgets, task/evidence packets,
composition graphs, quality/safety gates, fallback, receipts, and continuity.
No Claude-specific Code orchestrator or semantic policy fork was added.

The clean Phase 7B acceptance source is recorded in
`operations/reports/infinite-brain-orchestrator-v2-phase7b-second-consumer-code-canary-2026-09-02.md`.
It records a 10/10 serial burn-in, a 100-case selected-consumer cohort, 50/50
semantic parity against the Codex v2 default, 100% qualification parity,
15/15 isolated bounded coding fixtures with implementation, Review, QA, and
Evidence Packet completion, dormant-specialist parity, atomic-context bounds,
bidirectional continuity, explicit failure fallback, and a live rollback and
re-enable drill. Safety parity and mandatory quality-gate parity are both
100%; providers, execution, repository/Mind writes, production effects, and
automatic resume remain at zero.

The final canary state is `CANARY_ACCEPTED`, but Claude Code is not a default:
`defaultActive=false` and `productionActive=false`. Codex Code remains the only
v2 default. Other consumers and domains remain inactive. Browser, MCP, and
visual capabilities remain host-dependent alternatives for Claude Code and are
not silently treated as equivalent in this bounded Code canary.

The broad conformance recheck still reports exact pre-existing drift outside
this canary: Workbench revision/artifact/provenance digest drift, unavailable
scheduler inventory and typed-job validators, and unavailable Workbench provider
admission validation. These findings remain visible and are not suppressed;
they do not block the targeted Claude Code + Code contract because its clean
Universal Contract, projection, capability handshake, Code route, safety,
continuity, receipt, fallback, and rollback gates pass.

## Phase 8A Codex Research canary truth — 2026-09-02

Phase 8A activates exactly one additional pair: Codex + Research, in `CANARY`
mode. The activation packet is
`operations/specs/infinite-brain-codex-research-canary.v1.json`; the adapter is
`adapter.codex-research.v1`; and the prior path is
`codex-current-research-entry`. Codex Code remains the only v2 default.

The canary uses the same universal Brain-owned request, route, Task Packet,
composition graph, Context Requests, capability negotiation, quality gates,
Evidence Packets, receipt, and continuation contract. The thin adapter only
translates Codex input and capabilities. Research source acquisition is a
bounded read-only layer that records source identity, publisher, URL,
retrieval timestamp, source class, content digest, claim relation, confidence,
uncertainty, and contradiction state. It preserves SOURCE,
EXTRACTED_EVIDENCE, INTERPRETATION, CONCLUSION, and UNCERTAINTY as separate
layers and performs at most one atomic deepening request after Round 1.

The accepted canary evidence is recorded in
`operations/reports/infinite-brain-orchestrator-v2-phase8a-research-canary-2026-09-02.md`.
It includes a 10-request serial burn-in, a 100-case Research cohort, 24
substantive read-only source-backed outputs, 7 Bible specialist outputs, 50
Codex-versus-Claude shadow comparisons with Claude Research inactive, 20
prior-path comparisons, explicit source-unavailable/weak/disagreement/tool/
Broker/specialist/citation/stale degradation, and a rollback/re-enable drill.
All hard checks passed. The final state is `CANARY_ACCEPTED`; `defaultActive`
and `productionActive` remain false. No Research default promotion is implied.

The Bible specialist remains subordinate to Research. Its bounded validation
covered passage context, original-language caution, lexical/syntax discipline,
historical/cultural context, canonical/cross-reference context, scholarly
disagreement, and theological synthesis without preloading unrelated layers.
The canary did not activate Claude Research or any other consumer/domain.

## Phase 8B Codex Research promotion-readiness truth — 2026-09-02

Phase 8B revalidated the Phase 8A foundation and added 150 new unique
Research-path routing cases, bringing the comparable cohort to 250. It also
ran 50 new substantive read-only source-backed outputs across general/deep,
business/company/market, technical/product/comparative, outdoor/location,
Bible specialist, and contradiction/fact-check classes. Evidence packets now
record the question and subquestions, citation resolution and evidence-bound
checks, source authority and independence groups, retrieval method, freshness,
and explicit insufficiency behavior. Research-to-Code handoffs are refs-and-
claims-only and retain Review/QA gates; Research-to-Design cases remain shadow
preparation only.

The measured result is `MORE_RESEARCH_EVIDENCE_REQUIRED`. Routing, mandatory
evidence gates, citation checks (136/136), source independence, contradiction
retention, stale/unavailable degradation, 22 atomic deepening cases, stopping,
business/technical/Bible/outdoor minimums, qualification, 75-case Claude
shadow parity, 30 prior-path comparisons, failure visibility, rollback,
atomic-context, and no-mutation gates pass. Codex Research remains
`CANARY_ACTIVE`/`CANARY_ACCEPTED`; `defaultActive=false` and
`productionActive=false`. No default promotion, Claude Research activation,
Design/Web activation, profile expansion, Mind write, provider call, or
external mutation occurred.

The blocking follow-up is source authority, not routing or citation
correctness: all 12 new Bible outputs use translation and secondary lexical
witnesses, without a peer-reviewed or critical-edition source in this bounded
canary. The promotion contract is defined but not executed. The full report
is `operations/reports/infinite-brain-orchestrator-v2-phase8b-research-promotion-readiness-2026-09-02.md`.

## Phase 8C Bible source-authority hardening truth — 2026-09-03

Phase 8C resolved the Phase 8B Research promotion blocker without changing the
universal runtime or activating a default. It added explicit Bible source
authority metadata and policy for critical text, critical-edition reference,
original-language text, morphology, peer-reviewed full text, scholarly
metadata, access state, license, citation capability, language, and
edition/version. The full report is
`operations/reports/infinite-brain-orchestrator-v2-phase8c-bible-source-authority-2026-09-03.md`.

The Phase 8C bounded benchmark contains 70 new Bible cases: 10
textual-critical, 15 Greek/Hebrew, 15 scholarly exegesis, 10 scholarly
disagreement, 10 historical/cultural, and 10 canonical/theological. All 70
used strengthened authority; all 70 included verified peer-reviewed full-text
support; 65 included retrieved critical-text authority; and 196/196 citation
checks passed. Thirty Codex/Claude semantic comparisons matched. Access states,
critical-text versus apparatus boundaries, metadata-only limits, licensing,
atomic context, and no-preload controls all passed. The prior Phase 8B result
remains historically `MORE_RESEARCH_EVIDENCE_REQUIRED`; its isolated Bible
source-authority gap is recorded as resolved by Phase 8C.

## Phase 8D Codex Research default truth — 2026-09-03

Phase 8D promotes exactly one authorized consumer/domain pair:
`Codex × Research`. The canonical default contract is
`operations/specs/infinite-brain-codex-research-default.v1.json` with its
adjacent schema. The accepted transition is:

```text
CANARY_ACCEPTED → RESEARCH_V2_DEFAULT_FOR_CODEX
```

The default entry is a thin Codex state selector around the same Brain-owned
Universal Entry, Research route, Task Packet, Composition Graph, Context
Requests, capability negotiation, Evidence Packets, source authority/citation
gates, contradiction handling, synthesis, receipt, and continuity path used by
the accepted canary. It adds no Codex-specific Research, Bible, source,
citation, context-budget, specialist, or model policy. The prior
`codex-current-research-entry` path remains available for disabled/rolled-back
state, out-of-domain prompts, stale/conflicted continuity, controlled failure,
projection drift, or any safety/validation regression.

Default activation is not production execution: `productionActive` remains
false, providers and external mutations remain disabled, Code remains
`CODE_V2_DEFAULT_FOR_CODEX`, Claude Research and every other consumer/domain
remain inactive, and no active profile expansion occurs. The Phase 8D report
records the preflight, 10-request burn-in, 100-case default cohort, substantive
outputs, Bible regression, source/citation regression, fallback and rollback,
Research/Code composition, prior-path comparison, Claude shadow parity,
cross-consumer checks, and the next Design/Web canary recommendation.

## Phase 9A Codex combined Design/Web canary truth — 2026-09-03

Phase 9A activates exactly `Codex × canonical combined Design/Web` through
`adapter.codex-design-web.v1` in `CANARY` mode. Brain remains the sole owner of
intent interpretation, qualification, route selection, Task Packets, Context
Broker references, Composition Graphs, specialist discovery, risk, gates,
continuity, and Evidence Packets. The canonical relationship is `skill.design`
as primary owner, selective `skill.web-design`/`skill.design-system`/
`skill.design-review` specialists, `skill.code` for bounded frontend
implementation, rendered visual QA for presentation, and functional QA for
behavior.

The acceptance report is
`operations/reports/infinite-brain-orchestrator-v2-phase9a-design-web-canary-2026-09-03.md`.
It records a 10/10 serial burn-in, 120-case Design/Web cohort, 30 substantive
outputs, 20 rendered artifacts across desktop/tablet/mobile, screenshot-based
visual QA, distinct functional QA, bounded repair, vague-intent qualification,
50/50 cross-consumer parity, 25 prior-path comparisons, explicit degradation,
safe high-risk handling, and rollback/re-enable. All hard checks pass and the
decision is `CANARY_ACCEPTED`; promotion readiness is `PROMOTION_READY`.

The canary is not a Design/Web default. Codex Code and Codex Research remain
`DEFAULT_ACTIVE`; Claude Code remains unchanged; Claude Research and every other
consumer/domain remain inactive. Global profiles and `ai/skills/active` are
unchanged. Mind writes, production website writes, publishing, deployments,
provider calls, and external mutations remain zero.
