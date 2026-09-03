# Infinite Brain Orchestrator v2 Roadmap

**Status:** Phase 9B accepted; Codex Code, Codex Research, and Codex Design/Web are v2 defaults; core orchestration architecture complete; no production execution
**Date:** 2026-09-02
**Baseline:** Phase 9B accepted baseline `origin/main` `f6fb519943498e5fc99e1569da6b339ce9768ba3`; source is the clean Phase 9B worktree
**Related specification:** [Infinite Brain Orchestrator v2](../specs/infinite-brain-orchestrator-v2.md)
**Safety boundary:** This roadmap does not authorize production orchestration, profile, client, provider, database, scheduler, deployment, or external-state changes.

## Outcome

Move Brain from strong but fragmented markdown/profile orchestration to a measured, descriptor-first, provider-neutral orchestration layer while preserving domain quality and the current least-context/safety model.

The migration target is not “one enormous orchestrator.” It is:

```text
Universal entry + policy
        ↓
compact capability descriptors
        ↓
thin domain adapters
        ↓
specialists / tools / quality gates
        ↓
bounded task + evidence + continuity packets
```

## Baseline findings

- 137 source `SKILL.md` files: 95 custom and 42 vendor.
- Seven default active entries: `code`, `research`, `memory`, `review`, `qa`, `handoff`, `careful`.
- Mature dormant domain masters: `design`, `web`, `video`.
- Accepted read-only Context Broker: nine operations, progressive capability list/inspect, freshness, authority, budget, and fallback contracts.
- Accepted universal entry and continuity contracts; client activation and automatic resume remain explicitly unclaimed.
- Agent capability manifests already contain useful safety class, approval, task-type, and verification fields.
- Research, video, design, review, and QA contain strong domain logic but are too large or side-effectful to be universal adapters.
- Research, video, deploy, power, and full-current profile checks were reconciled: exact nested/file-backed sources now resolve, and the remaining historical unavailable entries are explicit allowlisted exceptions.
- Antigravity projection drift was repaired in the tracked repository projection; Kiro remains a separate deferred client projection with exactly seven missing entry symlinks.

## Phase plan

### Phase 0 — Audit and freeze (complete)

**Purpose:** Establish a source-backed baseline before any design or implementation.

**Evidence:** the five requested deliverables, clean isolated worktree, source SHA, focused contract tests, profile dry-runs, and no-change confirmation.

**Exit:** complete when the audit is reviewed and the user authorizes a separate implementation phase.

### Phase 1 — Descriptor catalog and source reconciliation

**Priority:** P0
**Mode:** read-only projection and validators
**First implementation phase**

Create one source-agnostic descriptor projection from existing skill frontmatter, profile files, runbooks, Brain Core agent capabilities, CLI/MCP manifests, and Broker capability descriptors.

Deliver:

- descriptor schema extension with role, intent, domain, inputs/outputs, context cost, state model, side effects, risk, confirmation, gates, failure, continuity, source revision, profile membership, health, and freshness;
- explicit distinctions between source-present, indexed, profile-listed, active/exported, consumer-reachable, and runtime-activated;
- deterministic duplicate/missing-source/profile/projection checks;
- catalog provenance for every field;
- no full skill-body loading in list mode;
- fixtures for current seven active orchestrators, dormant masters, domain specialists, gates, CLIs, and validators.

Do not:

- change `ai/skills/active/`;
- repair consumer links as part of the catalog work;
- infer activation from a placeholder Brain Core registry;
- delete or rename source skills;
- load or store secrets.

**Exit gate:** all descriptors resolve to exact source paths or are visibly marked unavailable; the catalog is deterministic; profile checks report current failures; all existing context-learning tests remain green.

### Phase 2 — Shadow intent router

**Priority:** P0
**Mode:** explanation only; zero side effects

Accept a natural-language request and emit:

- normalized goal/domain/artifact/output/risk;
- candidate descriptors and rejected alternatives;
- selected context scopes and phase budgets;
- zero/one question decision and safe defaults;
- proposed composition graph;
- predicted quality and safety gates;
- route explanation and source revisions.

Use a fixed black-box corpus covering code, design, research, Bible, memory, review, QA, handoff, careful, and mixed-domain prompts. Compare the router output against expert-labeled expected route families, not exact wording.

**Exit gate:** no provider calls, writes, profile activation, client changes, or execution; 100% of high-risk fixtures fail closed or require confirmation; no fixture asks the user to choose a skill/provider/model; false-positive routes are reviewed.

### Phase 3 — Task/evidence packet and gate adapters

**Priority:** P1
**Mode:** local bounded state; still no client activation
**Status:** implemented in the Phase 3 shadow-only worktree; acceptance evidence is recorded in `operations/reports/infinite-brain-orchestrator-v2-phase3-closeout-2026-09-02.md`.

Add packet validators and thin adapters around existing domain engines:

- `code` adapter to select map/plan/fix/build/review/ship mode;
- `research` adapter to select quick/web/deep/academic/comparative/fact-check/domain mode;
- `design` adapter to select new/mimic/upgrade mode without mandatory intake when safe defaults are available;
- `memory` adapter to select recall/capture/facts/review/maintenance;
- `review` and `qa` adapters to select report-only versus fix-enabled behavior and tier;
- `handoff` adapter to bind session continuity and exact next action;
- `careful` adapter to classify risk and require existing policy confirmation;
- `bible-research` and `scripture-sources` as research specialists, not universal entrypoints.

The adapters return task/evidence envelopes and invoke existing sources only after selection. They do not copy specialist instructions into the universal layer.

**Exit gate:** every selected node declares output, evidence, gates, risk, and failure behavior; packet references resolve; stale/conflicted continuity blocks resume; domain tests remain green.

### Phase 4 — Composition and bounded parallelism

**Priority:** P1
**Mode:** shadow first, then explicitly authorized local pilot

Add composition rules for genuinely mixed requests such as “build a polished dashboard and deploy it”:

1. normalize and retrieve relevant Mind/Brain context;
2. choose primary domain adapter;
3. add only required specialists;
4. order design/code/review/QA/deploy gates;
5. split parallel work only when inputs are independent and evidence is mergeable;
6. merge packets without duplicating canonical truth;
7. stop before external/production state until approval.

Use `orchestrate` internally for bounded parallel work where its cost/merge conditions are met. Do not expose `forge` as a universal default; retain it as an explicitly scoped launch workflow pending a separate risk review.

**Implementation:** `operations/specs/infinite-brain-composition-graph.v1.schema.json`, `tools/orchestration/composition-graph.mjs`, `tools/orchestration/composition-graph.test.mjs`, `tools/orchestration/composition-fixtures-v4.json`, and `tools/validate-orchestrator-v2-phase4.mjs`.

**Evidence:** 53 mixed-domain fixtures; exactly one owner in 100%; required gate coverage 100%; 10 safe parallel groups; zero unsafe parallel acceptance; conflict-preserving merge fixtures; explicit failure propagation; bounded context lifetime metrics; zero provider calls, writes, profile activation, client changes, and automatic resume. The B8 planned-state assertion was reconciled to the accepted canonical complete state and the conformance suite passes.

**Exit gate:** passed locally in shadow mode. Mixed-domain fixtures produce deterministic graph ordering, bounded node count, explicit merge/failure behavior, and no skipped required gate. Client activation, provider execution, Mind mutation, and production routing remain unclaimed.

### Phase 5 — Universal entry and consumer conformance pilot

**Priority:** P1, separately authorized
**Mode:** read-only client pilot first

**Status:** accepted for the Codex read-only pilot on the Phase 5 audit branch; no production activation, provider calls, Mind writes, routed repository writes, automatic resume, or client takeover.

**Implementation:** `tools/context-learning/codex-read-only-pilot.mjs`, `tools/context-learning/codex-read-only-pilot.test.mjs`, `tools/orchestration/codex-pilot-corpus-v5.json`, `tools/validate-orchestrator-v2-phase5.mjs`, `operations/specs/infinite-brain-codex-read-only-pilot.v1.schema.json`, `operations/specs/infinite-brain-activation-state.v1.schema.json`, and `operations/specs/profile-unavailable-allowlist.json`.

**Evidence:** 128-case corpus (120 routable + 8 explicit fallback/edge cases); 100% primary-owner accuracy; 29/29 material questions; 0 unnecessary questions; 95.2% required-gate correctness; 100% high-risk safety coverage; 8/8 fallback correctness; bootstrap maximum 419 tokens; context-pack maximum 41 tokens; maximum simultaneous relevant context 1,400 tokens; descriptor LIST full-body reads 0; unrelated full-body reads 0; provider calls, execution, writes, automatic resume, and production routing all 0. Codex reports `CONFORMANT` plus `PILOT-ACTIVE`, while `productionActive` and activation performed remain false.

**Reconciliation:** profile aliases and nested/file-backed sources are explicit; duplicate `brain-nightly-scheduler-new-job` membership was reduced to one entry and its historical absence is allowlisted; Antigravity now points through the tracked relative projection to the active source; Workbench is explicitly `NOT_APPLICABLE`; Kiro's seven ignored entry-symlink changes remain deferred and are not silently applied.

**Phase 6 readiness:** `BLOCKED` only for the exact Kiro projection boundary: `careful`, `code`, `handoff`, `memory`, `qa`, `research`, and `review` need explicit client activation authorization before their Kiro entry symlinks may be created. This does not block Codex Phase 5 conformance.

Connect the router’s bootstrap and packet pointers to the existing universal entry and Context Broker contracts for one consumer at a time. Start with a read-only Codex or future-agent fixture, then evaluate Claude/Gemini/Workbench adapters independently.

Required controls:

- exact Brain revision and authority registry;
- provider neutrality;
- bounded bootstrap and on-demand retrieval;
- freshness/conflict visibility;
- no full repository/conversation/secrets/client configuration in bootstrap;
- no automatic resume/takeover;
- explicit rollback to prior client path;
- activation status distinguishable from conformance status.

**Exit gate:** the existing universal-entry, conformance, continuity, and Broker tests remain green; pilot evidence records zero mutation/provider activity; user explicitly authorizes any client activation.

### Phase 7A — Codex Code default (accepted)

Phase 7A promotes Codex + Code to the only v2 default. The accepted state is
`CODE_V2_DEFAULT_FOR_CODEX`; the legacy Codex path remains available for
disabled, high-risk, out-of-domain, stale, conflicted, projection-drift, and
controlled-failure cases. Its acceptance evidence is the Phase 7A closeout
report and includes the required burn-in, cohort, isolated-task, safety,
quality, continuity, fallback, and rollback checks. No other consumer or
domain became active.

### Phase 7B — Claude Code second-consumer Code canary (accepted)

Phase 7B followed Phase 7A's exact first non-Codex recommendation: Claude Code.
The canary is limited to Claude Code + Code and consumes the same Brain-owned
Universal Contract and canonical composition pipeline. The serial burn-in is
10/10; the selected-consumer cohort is 100 cases across vague/exact, bug,
feature, frontend, backend/API, configuration, performance, security, testing,
refactor, continuation, stale, high-risk, dormant, and out-of-domain classes.
The side-by-side parity set is 50 identical Code prompts against the Codex v2
default: semantic parity 100%, qualification parity 100%, mandatory
Review/QA-gate parity 100%, safety parity 100%, risk parity 100%, and context
scope parity 100%. Fifteen isolated bounded coding fixtures completed
implementation, tests, Review, QA, Evidence Packet, and completion checks;
critical defects and production writes were zero.

The live rollback drill disabled the canary, selected
`claude-code-current-entry` with no v2 invocation or packet replay, then
re-enabled the canary after successful validation. Final state is
`CANARY_ACCEPTED`; `defaultActive=false`, `productionActive=false`, Codex's
Code default remains preserved, and other consumers/domains remain inactive.
Browser/MCP/visual host-dependent capability differences are recorded as
alternatives, not hidden. Exact broad-conformance drift is documented in the
Phase 7B report and does not suppress targeted acceptance.

### Phase 8A — Codex Research real-path canary (accepted)

Phase 8A activates exactly Codex × Research in `CANARY` mode and leaves every
other Research consumer/domain inactive. The clean acceptance report is
`operations/reports/infinite-brain-orchestrator-v2-phase8a-research-canary-2026-09-02.md`.
The canary passed a 10/10 serial burn-in, 100-case Research cohort, 24
substantive source-backed outputs, 7 Bible specialist outputs, 50/50 Codex /
Claude shadow semantic parity, 20 prior-path comparisons, source-quality and
provenance gates, contradiction retention, one-request iterative deepening,
failure degradation, atomic-context bounds, and rollback/re-enable. Public
source acquisition was read-only and recorded identity, retrieval time, class,
digest, claim relationship, confidence, uncertainty, and contradiction state.

Codex Research is `CANARY_ACCEPTED_NO_DEFAULT`; Codex Code's default is
unchanged. Claude Research was shadow-compared only and was not activated.
The Bible Research and Scripture Sources capabilities remain specialists under
the canonical Research owner; no competing universal router was created. The
recommendation is to gather more Research evidence before any default
promotion because the bounded corpus is intentionally limited and Bible
original-language source quality remains a follow-up area.

### Phase 8B — Codex Research promotion-readiness evidence (deferred)

Phase 8B revalidated Phase 8A and added 150 new unique Research-path cases
(250 comparable total), 50 substantive source-backed outputs, 136/136
bounded citation checks, 5 contradiction cases, 10 explicit insufficiency
cases, 5 stale rejection/downgrade cases, 22 one-request deepening cases,
75 Claude shadow parity cases (100%), 30 prior-path comparisons, 8 bounded
Research→Code handoffs, and 5 Research→Design shadow preparations. Business,
technical, Bible, outdoor, qualification, atomic-context, failure, rollback,
safety, and broad-drift classification gates were exercised. No default
promotion or other consumer/domain activation occurred.

The verdict is `MORE_RESEARCH_EVIDENCE_REQUIRED`. Citation correctness and
operational gates pass, but all 12 Bible substantive outputs still rely on
translation and secondary lexical witnesses; the cohort does not yet provide
the peer-reviewed or critical-edition authority needed to treat specialist
Bible research as promotion-complete. The promotion contract is defined but
not executed. Design/Web remains the next archetype only after this evidence
gap is closed and a fresh gate review passes.

### Phase 6A — Activation readiness hardening (complete)

**Status:** accepted as readiness evidence; no activation occurred.

**Evidence:** seven Kiro entries are individually accounted for in the canonical repository manifest with valid active sources, repository projection `PASS`, unexplained drift `0`, and live activation `NOT_PERFORMED`. Claude, Codex, Gemini, Cursor, and Antigravity projections are green; Workbench is not applicable. Phase 3, Phase 4, and Phase 5 validators pass. The six Phase 5 gate mismatches are corrected at the route-owner/risk/task-packet graph boundary, raising required-gate correctness from 95.2% to 100%.

The expanded readiness suite covers 38 dedicated proportional gate-edge fixtures and a 288-case activation benchmark (including the 128-case Phase 5 corpus and 92 Code scenarios). Routing is 280/280 routable cases; all required gates are 284/284; safety gates are 15/15 with zero unsafe execution-ready results; quality gates are 161/161; and safety/quality mandatory misses are zero. Bootstrap remains bounded at 419 tokens, descriptor LIST full-body reads remain zero, unrelated full-body reads remain zero, context packs remain bounded at 41 tokens, and maximum simultaneous relevant context remains 1,400 tokens.

The first activation candidate is Codex Code, restricted to read-only analysis and read-only planning route classes. The canary is prepared but disabled; OFF selects the legacy path, simulated ON selects v2 only inside the allowlist, injected failure selects legacy, and rollback restores legacy without manual configuration surgery. Telemetry and the ten stop conditions are defined in the canonical canary spec.

**Exit gate:** PASS. The next phase may activate only this bounded Codex canary with fresh authorization and measured comparison; it must stop or roll back on any defined regression.

### Phase 6B — Risk-aware gate policy and measured activation

**Priority:** P1/P2, high blast radius
**Mode:** one client/profile and one bounded domain at a time

**Status:** `CANARY_ACCEPTED` for Codex Code only; `PRODUCTION_DEFAULT` is not active.

**Evidence:** `operations/reports/infinite-brain-orchestrator-v2-phase6b-codex-canary-2026-09-02.md` and `tools/context-learning/run-phase6b-codex-canary.mjs`.

The first activation candidate named by Phase 6A was authorized and exercised through the real repository-supported Codex consumer path. The serial burn-in was 5/5 v2 selections. The cohort was 45 cases: 20 normal, 10 vague/edge, 5 stale/conflict/continuation, 5 high-risk, and 5 controlled fallback injections. The canary selected v2 for 19 cohort cases and retained the legacy path for 26; this is expected because only Code read-only analysis/planning is in scope.

Measured hard checks passed: routing `100%`, safety `100%`, quality `100%`, mandatory safety misses `0`, mandatory quality misses `0`, scope leakage `0`, stale/conflicted current treatment `0`, unsafe execution-ready results `0`, provider calls `0`, writes `0`, Mind writes `0`, credential/financial/destructive actions `0`, active-skill expansion `0`, other consumer/domain activation `0`, and legacy fallback availability `PASS`. Bootstrap maximum was 407 tokens; context-pack maximum 41; maximum simultaneous relevant context 650; descriptor LIST full-body reads 0; unrelated full-body reads 0; full repository/conversation/secrets were not loaded.

The side-by-side baseline covered 20 prompts. The prior path was available and execution-free for all 20, averaging 1,397 bootstrap bytes and 15 context pointers with zero writes/providers. V2 produced task packets and graphs for all 20, selected v2 for 17, and emitted 37 evidence packets. Because the legacy path does not expose equivalent route/task/evidence instrumentation, the comparison is structural-only; no unsupported quality-delta claim is made.

Rollback was exercised while active: `CANARY_ACTIVE` → `ROLLED_BACK` selected legacy with no v2 invocation, then `READY` → `CANARY_ACTIVE` re-enabled selection without packet replay. The final state is `CANARY_ACCEPTED`; `productionActive` and production-default activation remain false. No other client, domain, provider, profile, skill, external system, or production surface was activated.

Add measured thresholds for:

- when code work gets review/QA;
- when research gets primary-source or academic evidence depth;
- when design gets visual/motion review;
- when Bible research requires tradition/audience or original-language disclosure;
- when memory capture requires human review or Mind authority;
- when external, credential, financial, database, destructive, deployment, or public-content actions require confirmation and rollback evidence.

Never activate broad default behavior until route accuracy, question rate, context cost, gate coverage, and failure behavior are measured against the shadow baseline.

### Phase 6D — Universal consumer contract and cross-client conformance

**Priority:** P1/P2, architecture boundary
**Mode:** deterministic conformance and rollout-readiness assessment; no client activation
**Status:** `ACCEPTED`; no consumer or domain default activated

Phase 6D establishes one Brain-owned, versioned, LLM-agnostic and IDE-agnostic
contract for every consumer:

```text
BrainRequest → BrainRoute → TaskPacket → CompositionGraph
  → ContextRequest[] → CapabilitySelection[] → GateSelection[]
  → EvidencePacket[] → BrainResult → Continuation
```

The contract is `operations/specs/infinite-brain-universal-consumer-contract.v1.json`.
Thin adapters may translate native input/session data, report environment
capabilities, resolve workspace boundaries, render results, translate evidence,
and expose continuation references. They may not duplicate Brain routing,
qualification, specialist/method selection, context budgets, packet
decomposition, composition, quality gates, safety gates, or continuity policy.

The deterministic corpus contains 228 semantic scenarios and exercises Codex,
Claude Code, Cursor, Kiro, Antigravity, Gemini, and Workbench through the same
reference adapter shape. It includes Code, Research, Bible, Design, Web,
Memory, Review, QA, Handoff, Careful, Video, mixed, high-risk, ambiguous,
stale/continuation, dormant-specialist, capability-unavailable, and model-swap
cases. Semantic parity compares route/owner/specialist/qualification/risk/gate/
context/continuity meaning, not client serialization.

Capability negotiation returns explicit `SUPPORTED`,
`SUPPORTED_WITH_ALTERNATIVE`, `DEGRADED`, `REQUIRES_EXTERNAL_CAPABILITY`,
`UNAVAILABLE`, or `BLOCKED` outcomes. Required omissions cannot be silent.
Universal receipts are bounded and provider-neutral; raw prompts and transcripts
are not canonical state. No consumer, profile, domain default, provider,
projection, or production path is activated by this phase.

**Evidence:** `operations/reports/infinite-brain-orchestrator-v2-phase6d-client-agnostic-conformance-2026-09-02.md` and `tools/validate-universal-consumer-conformance.mjs`.

**Exit gate:** the universal schema validates; all supported consumer adapters
produce equivalent semantic routes; safety and context parity remain within the
contract; dormant discovery stays lazy; model/provider swaps do not change
semantic routing; adapter independence and thinness checks pass; the existing
Phase 3–6C validators remain green; and all activation/default-promotion flags
remain false. **PASS.**

### Phase 7 — Consolidation and de-duplication

**Priority:** P2
**Mode:** documentation/source maintenance only until separately approved

After v2 has stable evidence:

- reduce duplicated routing prose in runbooks/configs to pointers;
- reconcile `orchestrators-reference.md` with the actual active/profile model;
- split large review/QA/video/design bodies into adapter plus specialist sources only where tests prove behavior parity;
- retire stale profile entries through a deliberate migration, not deletion by accident;
- preserve direct specialist invocation for power users;
- promote repeated failures to deterministic validators/hooks/tests before new prompt rules.

## Migration order by surface

| Order | Surface | Migration action | Why |
|---:|---|---|---|
| 1 | Broker/context pack | Reuse existing schemas and bounded operations | Already tested and read-only |
| 2 | Agent capability manifest | Extend existing safety/task/verification metadata | Existing descriptor seed |
| 3 | Default seven | Add descriptors and shadow routes only | Stable baseline, small context |
| 4 | Research + Bible | Establish source/evidence/qualification contract | High-value read-only domain and gap area |
| 5 | Code + design | Establish output/state/gate contract | Primary build experience; design currently dormant |
| 6 | Memory + handoff | Bind authority/continuity references | Prevent duplicate truth and unsafe resume |
| 7 | Review + QA + careful | Make gates selectable and thresholded | Strong existing quality/safety engines |
| 8 | Web + video + project pipelines | Add external-state and artifact-specific adapters | Higher complexity and side-effect risk |
| 9 | Cross-client activation | Conformance and one-client pilot | Activation must be evidence-backed |

## Quick-win backlog

| ID | Quick win | Risk | Evidence of completion |
|---|---|---|---|
| Q1 | Add descriptor inventory/provenance report | Low | deterministic source/profile/catalog report |
| Q2 | Add profile resolution to CI/manual validation | Low | failed profiles are visible before activation |
| Q3 | Add black-box prompt corpus and expected route fixtures | Low | route/question/gate regression results |
| Q4 | Reconcile stale “five orchestrators” documentation | Low | one current source-of-truth statement |
| Q5 | Publish one-question policy and design/web exceptions | Low | qualification fixtures pass |
| Q6 | Add route/evidence/gate receipt to shadow output | Low | every route is explainable |
| Q7 | Add adapter readiness fields to existing agent manifest | Low | descriptors include state/context/continuity |
| Q8 | Audit Antigravity/Kiro projection drift separately | Medium | sync check passes in a dedicated config change |

Q8 is deliberately not included in the audit implementation: it would change consumer projection/config state and requires its own bounded authorization.

## Success metrics

### Route quality

- ≥95% correct primary route on the fixed prompt corpus.
- 0 high-risk prompts routed to execution without the required confirmation class.
- 0 prompts requiring the user to name a skill, provider, model, or profile.
- ≤10% unnecessary clarification rate on prompts with inferable safe defaults.
- 100% of ambiguous high-cost/destructive prompts receive one question or fail closed.

### Context and cost

- Bootstrap remains ≤800 target tokens for the default contract.
- Descriptor list stays within its phase budget and never includes full instructions.
- Selected context packs remain within the existing 4,000-token ceiling unless an explicit domain policy authorizes a different bounded envelope.
- 100% of excluded/truncated material has a reason.
- Stale/contradicted/unknown context is visible and never silently selected as current.

### Quality and safety

- 100% of selected routes declare required gates and risk/confirmation class.
- Code shipping routes have review evidence; applicable web/UI routes have QA/visual evidence; research/Bible outputs have source/citation evidence; memory writes have authority/provenance evidence.
- 100% of shadow mode runs record zero provider calls, writes, execution, and authority changes.
- 100% of continuation candidates verify repository/worktree/revision/freshness/conflict before resume.
- No new canonical store or duplicate conversation history is created.

### Operational health

- All intended profiles resolve, or an explicit allowlist documents why a profile is unavailable.
- All intended consumer projections pass reachability/sync checks.
- Route and gate outcomes are reproducible from source revision and fixture inputs.
- Failed optional accelerators produce visible fallback records.
- Packet references and source revisions remain resolvable after a repository change.

## Phase 9A — Codex combined Design/Web canary (accepted)

Phase 9A proves the third major execution archetype through the same universal
Brain-owned runtime. Exactly Codex × canonical combined Design/Web is
`CANARY_ACCEPTED`; it is not a Design/Web default. The measured evidence is in
`operations/reports/infinite-brain-orchestrator-v2-phase9a-design-web-canary-2026-09-03.md`.

The acceptance gates pass: 10/10 serial burn-in, 120/120 routed cohort,
30 substantive outputs, 20 rendered frontend artifacts, 20/20 screenshot
visual QA, 20/20 distinct functional QA, bounded repair, 100% shadow parity,
25 prior-path comparisons, explicit degradation, rollback/re-enable, and zero
provider calls, writes, publishing, deployment, or production website changes.
Design remains the primary owner; Web/Design and design-system specialists are
dormant/selectively discovered; Code remains the frontend implementation
handoff; visual QA and functional QA are separate gates.

Code and Research remain `DEFAULT_ACTIVE`. Claude Code is unchanged. Claude
Research, other consumers/domains, global profiles, and `ai/skills/active`
remain inactive/unchanged. Remaining work is controlled rollout and eventual
default-promotion evidence, not core orchestration architecture.

## Stop/rollback rules

Stop the phase and do not continue activation when:

- source authority, Mind/Brain ownership, or user scope is ambiguous;
- a profile silently drops a missing skill;
- a descriptor claims a capability not evidenced by an exact source or admitted provider;
- a stale/contradicted context item is treated as current;
- a route crosses external, credential, financial, database, destructive, deployment, or public-content boundaries without confirmation;
- packet state conflicts with Git/worktree or current source revision;
- a domain gate is skipped or its evidence cannot be reproduced;
- context budget, privacy, or retention bounds cannot be enforced.

Rollback is “disable the new consumer/router projection and restore the prior profile/client path.” Do not use destructive Git or filesystem rollback commands as an implementation shortcut.

## Authorization gates

| Gate | Required before | Evidence |
|---|---|---|
| A0 | descriptor/catalog work | source SHA, clean worktree, no-change scope |
| A1 | shadow router | descriptor fixtures, profile diagnostics, route corpus |
| A2 | packet adapters | schema validation, packet references, domain regression tests |
| A3 | composition | graph/merge/failure fixtures and bounded cost evidence |
| A4 | client conformance | universal-entry/Broker/continuity tests and rollback |
| A5 | client activation | explicit user authorization, exact client/profile, pilot evidence |
| A6 | external/production behavior | dedicated risk, approval, credential, rollback, and deployment gates |

Phase 9A records an A5 client-activation gate pass for exactly Codex × Design/Web
in canary-only mode. A6 external/production behavior remains a future
authorization boundary, and no production execution is authorized here.

## Phase 9B — Codex Design/Web default and core closeout (accepted)

Phase 9A was revalidated as `CANARY_ACCEPTED` + `PROMOTION_READY`, then exactly
Codex Design/Web was promoted to `DEFAULT_ACTIVE` using
`DESIGN_WEB_V2_DEFAULT_FOR_CODEX`. Evidence includes 10/10 default burn-in,
120 default-path cohort cases, 20 new rendered default implementations,
20/20 visual QA, 20/20 distinct functional QA, zero critical defects/false
passes, bounded repair, atomic context, cross-domain composition, 100% parity,
safe degradation, safety, and rollback.

This closes the core architecture: Code, Research, and Design/Web are proven
default execution archetypes through the same universal Brain-owned contract.
Future consumer/domain work follows
`operations/specs/infinite-brain-rollout-template.v1.md` and is rollout,
monitoring, maintenance, or incremental capability improvement—not a new
numbered architecture phase. Legacy fallbacks remain until stable retirement
criteria are met.
