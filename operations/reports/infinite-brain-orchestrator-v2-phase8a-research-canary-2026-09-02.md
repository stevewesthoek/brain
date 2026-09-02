# Infinite Brain Orchestrator v2 — Phase 8A Research Canary

Date: 2026-09-02  
Decision: `CANARY_ACCEPTED`  
Scope: exactly Codex × Research, `CANARY`; no Research default promotion.

## 1. Executive summary

The Codex Research real-path canary passed every hard check. It used the
universal Brain-owned orchestration contract, performed safe public read-only
source acquisition, preserved evidence provenance and uncertainty, routed
Bible work to the Research-owned specialist, and retained a deterministic
legacy fallback and rollback path.

## 2. Baseline and source revision

Expected and observed `origin/main`: `5a386cfd4704302680d693c3e7685169f50c8ba4`.
The canary was run from that clean baseline before its implementation changes.
The original dirty checkout was not modified.

## 3. Universal foundation revalidation

The Universal Consumer Contract, schema, Brain entry, capability negotiation,
Task Packet, composition graph, Context Requests, gates, Evidence Packets,
receipt, and continuation surfaces passed targeted revalidation. Code default
selection remained unchanged.

## 4. Broad conformance drift

The broad drift recheck was rerun and exact known non-blocking drift remained:
Workbench artifact/provenance digest mismatch; unavailable scheduler inventory
and typed admission validators; baseline `network_access=false`; and baseline
`personal_mind_content_read=false`. Universal Research/Code semantics were not
affected. No drift was suppressed.

## 5. Research ownership and routing

General Research remains owned by `skill.research`. Bible Research and Scripture
Sources were selected only as specialists under that owner. No competing
universal Research router was introduced. Technical Research did not become
Code unless implementation was requested.

## 6. Exact activation scope

Activated: Codex × Research, `CANARY`, adapter
`adapter.codex-research.v1`. Not activated: Claude Research, other consumers,
other domains, Research default, production, Mind, publishing, financial,
credential, provider-execution, or automatic-resume paths.

## 7. Adapter thinness

The Codex adapter translates native input/session/workspace metadata, reports
capabilities, consumes the universal result, and renders its semantic receipt.
It does not select methods, specialists, sources, models, gates, context
budgets, or packet structure.

## 8. Serial burn-in

Ten serial Research requests all selected the v2 path and Research route. The
set covered factual/current, company, market, technical, comparison,
source-heavy, fact-check, Bible passage, Bible lexical, and outdoor/location
research. No provider call or write occurred.

## 9. Research cohort

The cohort contained 100 Research-path cases across general web, company,
market, competitive, business decision, technical, product comparison,
academic/source-heavy, fact-check, historical, outdoor/location, Bible,
mixed, ambiguous, stale/continuation, and source-conflict/unavailable classes.
76 selected v2; 24 retained legacy fallback for qualification, stale state, or
other bounded safety/validation reasons. No out-of-domain v2 selection occurred.

## 10. Substantive output distribution

Twenty-four substantive outputs were acquired and validated: 5 general/deep,
5 company/business/market, 4 technical/product/comparative, 3
outdoor/location/other specialist, and 7 Bible. Every output contained a
read-only Research Evidence Packet.

## 11. Source acquisition method

The real source method used bounded public HTTP GETs with a read-only user
agent, a 2 MB byte cap, content digests, short bounded excerpts, and no raw
source-body persistence. Retrieved sources included SEC EDGAR, World Bank,
PostgreSQL documentation, National Park Service, Bible Gateway, Bible Hub,
and Blue Letter Bible. No new secret or credential was used.

## 12. Claim/evidence separation

Every substantive packet separates SOURCE, EXTRACTED_EVIDENCE,
INTERPRETATION, CONCLUSION, and explicit UNCERTAINTY. A conclusion is never
represented as source text. Source records carry source identity, publisher,
URL, retrieval timestamp, source class, digest, claim references, confidence,
uncertainty, and contradiction state.

## 13. Source quality

Mean primary/authoritative use was 0.7083, relevance 1.0000, source diversity
0.6250, and weak-source dependence 0.2375. Primary, official, and direct-data
sources were preferred. Bible translation and lexical pages were explicitly
classified as supplementary or high-quality secondary rather than original
language authorities.

## 14. Contradiction handling

A representative disagreement case retained both source records, marked the
conflict `OPEN`, compared quality, and surfaced uncertainty. Contradiction
loss was 0. No source was silently overwritten or discarded.

## 15. Iterative deepening

Round 1 used minimum evidence. Outputs either stopped `SUFFICIENT` or emitted
one atomic `GAP_DETECTED` request. No automatic full deep-research escalation
occurred. Final budgets recorded source fetch count, depth rounds, and
estimated evidence tokens; maximum depth was 2.

## 16. Stopping criteria

The stop gate required answer readiness, support for important claims,
contradiction status, source-quality review, retrieval-value review, and budget
review. All 24 substantive outputs passed these bounded stopping checks.

## 17. Qualification behavior

The canary used Brain qualification only where the target was materially
ambiguous. No question asked the user to choose a skill, provider, mode,
model, profile, or tool. Architecture-choice questions: 0; unnecessary
qualification: 0 in the accepted cohort; missed material ambiguity: 0 in the
targeted cases.

## 18. Business and specialist cases

Company, market, business-decision, technical-product, and outdoor/location
cases routed without manual specialist invocation. Business outputs retained
primary/official evidence and uncertainty; outdoor outputs used official NPS
planning and safety guidance. The specialist was engaged only when the
question materially required it.

## 19. Bible specialist validation

Seven substantive Bible outputs covered passage context, original-language
caution, lexical/syntax, historical/cultural context, canonical/cross-reference
context, scholarly disagreement, and theological synthesis. Only relevant
evidence layers were requested; unrelated commentary, lexicon, theology,
cross-reference, and Mind bodies were not preloaded.

## 20. Bible interpretation discipline

Translation text, interlinear/lexical aids, interpretation, and theological
conclusion remained separate. Lexical evidence was treated as semantic-range
input rather than a lexical fallacy. Scholarly/traditional disagreement was
represented as disagreement and uncertainty, not as fabricated consensus.

## 21. Codex–Claude Research shadow parity

Fifty identical semantic comparisons passed: 50/50, 100%. Claude Research was
not activated. The comparison included route family, owner, specialists,
qualification, gates, context scopes, continuity, and safety semantics.

## 22. Prior Research path comparison

Twenty representative prior-path comparisons passed availability and routing
checks. The prior Codex Research entry remained available and execution-free.
V2 added source acquisition, provenance, claim layering, contradiction state,
deepening, and stopping evidence; no unsupported user-facing quality delta is
claimed for the uninstrumented prior path.

## 23. Atomic context

The canary did not load all Research skills, all Bible layers, unrelated
specialists, full source bodies, full repository context, full conversation
history, secrets, or Mind history. Unrelated full-skill ambient reads and
transcript replay were 0; selected Research/Bible instructions were inspected
only after semantic selection, and automatic resume remained false.

## 24. Resumability

Continuations preserve task identity, source revision, evidence references,
open questions, contradiction state, and next action. Pause points are valid
after decomposition, acquisition, and contradiction review. Stale or
conflicted state requires reconciliation; there is no transcript replay or
automatic takeover.

## 25. Failure and degradation cases

Source unavailable, weak-only, disagreeing, no-primary, tool unavailable,
Context Broker unavailable, specialist unavailable, missing citation metadata,
and stale evidence cases all degraded visibly or returned
`EVIDENCE_INSUFFICIENT`; no fabricated evidence was emitted. All failure
receipts recorded zero provider calls and zero writes.

## 26. Safety and non-regression

Provider calls, writes, external mutations, Mind writes, publishing, financial
actions, credential actions, production activation, and automatic resume were
all 0. Codex Code default remained active and unchanged. No other consumer or
domain became active.

## 27. Rollback and rollout matrix

Rollback while active selected `codex-current-research-entry` with no v2
invocation or packet replay. Re-enable required a fresh preflight and restored
the v2 canary path. The rollout matrix records Codex Research as
`CANARY_ACCEPTED_NO_DEFAULT`, Claude Research as shadow-only/not activated,
and all other Research consumers as `NOT_PERFORMED`.

## 28. Quality rubric and final decision

The 15-dimension review passed architecture ownership, route correctness,
adapter thinness, qualification, source provenance, evidence separation,
source quality, contradiction handling, deepening, stopping, Bible discipline,
atomic context, resumability, safety, and rollback. The remaining weakness is
intentional bounded corpus depth—especially primary scholarly/original-language
Bible coverage—so the canary is accepted without default promotion.

Infinite Brain Orchestrator v2 Phase 8A is accepted: Research now runs through
a bounded real-path Codex canary using the same universal Brain-owned
orchestration contract, with atomic source acquisition, evidence provenance,
specialist research routing, contradiction handling, selective deepening,
quality gates, resumable research packets, and no client-specific semantic
fork.

NEXT ACTION:
C. Gather more Research evidence before considering default promotion.
