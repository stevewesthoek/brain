# Infinite Brain Orchestrator v2 — Phase 8D Research Default

**Date:** 2026-09-03  
**Decision:** `DEFAULT_ACCEPTED`  
**Validated commit:** `4cd4d977ceee6c1ea732b2eec9922d09646a43be`  
**Scope:** Codex × Research only

## 1. Source baseline

The required Phase 8C source baseline was `656dab18dff508beb1dd69be1d02c16317cf3b1d`. `origin/main` matched it exactly before promotion, and the validated Phase 8D commit is its descendant. The original dirty checkout was not used or modified.

## 2. Phase 8C authority revalidation

Phase 8C reran successfully as `PROMOTION_READY`: 70 Bible cases, 196/196 citation checks, 70/70 strengthened-authority cases, 65 critical-text cases, 35 metadata-only cases, 0 authority gaps, and 30/30 Codex↔Claude semantic matches. Its prior Phase 8B result remains historical; no Phase 8B evidence was silently rewritten.

## 3. Promotion state

The only authorized transition executed was:

```text
CANARY_ACCEPTED → RESEARCH_V2_DEFAULT_FOR_CODEX
```

`productionActive` remained `false`. The canonical contract is `operations/specs/infinite-brain-codex-research-default.v1.json` and its adjacent schema.

## 4. Fallback path

`codex-current-research-entry` remains available. The selector falls back on disabled state, out-of-domain routing, stale/conflicted continuity, controlled failure, source revision drift, safety failure, or validation failure. No destructive migration or manual configuration surgery is required.

## 5. Serial default-path burn-in

Ten serial cases passed across general research, company, market, technical, comparison, fact-check, Bible passage, Greek, scholarly disagreement, and outdoor safety prompts. All 10 selected v2, routed to Research, and remained read-only.

## 6. Default-path cohort

The cohort contained 100 Research requests. Ninety-five selected v2 and five selected the explicitly controlled fallback path. All 95 v2 rows routed to the Research family; the five fallbacks carried visible reasons and preserved the legacy path.

## 7. Substantive outputs

Twenty-five substantive outputs passed the minimum matrix: 5 general/deep, 5 business/company, 4 technical/comparative, 3 outdoor/specialist, and 8 Bible. Outputs used bounded source records and Evidence Packets rather than raw source corpora.

## 8. Citation and source regression

All 51 citation checks passed: 51 resolved, 51 matched the recorded claim, 51 were bounded by extracted evidence, and 51 passed. Fabricated citations, unrelated citations, and major unsupported claims were all zero.

## 9. Bible regression

All eight Bible outputs used the selected `skill.bible-research` specialist and strengthened authority metadata. Coverage included textual, Greek, Hebrew, historical, scholarly disagreement, canonical, passage, and lexical cases. Authority gaps were zero; metadata-only records were not treated as full text; interpretation remained distinct from source fact; and no corpus preload occurred.

## 10. Qualification

The natural-language qualification check found 2 expected questions, 2 observed questions, 0 unnecessary questions, and 0 missed material ambiguities. Architecture/provider/model/profile/research-mode questions were all zero.

## 11. Specialist discovery and routing

Descriptor discovery was exercised for Bible, outdoor safety, company/market, and official technical documentation. All four queries were discoverable with zero full-body reads during listing. Bible selected `skill.bible-research` in the substantive evidence path; no nonexistent outdoor specialist was invented, and no global specialist activation occurred.

## 12. Atomic context

The maximum measured bounded-context values were: bootstrap 399 tokens, descriptor routing 3,572, selected instructions 9,988, task packet 4,582, graph 5,364, evidence packet 3,466, simultaneous active context 1,400, and referenced context 4,000. Full repository, full conversation, secrets, all-Research preload, all-Bible preload, all-source-body storage, unrelated full-body reads, and raw prompt storage were all false/zero.

## 13. Contradiction and insufficiency

Five source-unavailable probes returned `INCOMPLETE`, `answerReady=false`, explicit `EVIDENCE_INSUFFICIENT`, and no passing citation. Contradiction/uncertainty state was preserved; silent loss and fabricated certainty were both zero.

## 14. Freshness

The stale-context probe selected the legacy path with visible reason `continuity_stale`. Stale evidence was not treated as current; stale-as-current was zero.

## 15. Research plus Code composition

The mixed request retained `skill.research` as the primary owner, selected v2, excluded raw graph/source corpus context, and exposed bounded evidence references for downstream Code. Review and QA gates remained retained for implementation work.

## 16. Prior-path comparison

Twenty-five prior-path comparisons confirmed the legacy path was available. Each v2 comparison added evidence-packet, freshness, and citation-check provenance; no v2 comparison was worse than the retained path on the measured contract dimensions.

## 17. Claude shadow parity

Thirty Codex↔Claude Research shadow comparisons matched semantically 30/30. Ownership, qualification, source-class route, specialist, risk, and evidence-gate parity were each 100%. Claude Research remained shadow-only and inactive.

## 18. Controlled failures and fallback

Adapter/catalog unavailable, source capability unavailable, Context Broker unavailable, and invalid Evidence Packet/graph validation cases all degraded visibly to legacy. Provenance bypass, silent fallback, and raw-corpus inclusion were zero.

## 19. Rollback drill

Rollback while Research was default-active selected `codex-current-research-entry`, invoked no v2 path, kept packets inert, and performed no automatic replay. Explicit preflight then restored v2 successfully. The measured rollback path was within the 60-second contract target.

## 20. Code non-regression

The Phase 7A Code default suite reran with every hard check true, including Code burn-in, isolated tasks, review/QA gates, stale handling, high-risk handling, model swap invariants, rollback, and no production writes. `CODE_V2_DEFAULT_FOR_CODEX` was unchanged.

## 21. Cross-consumer conformance

Context-learning contracts, Context Broker, Orchestrator v2, and Universal Consumer Conformance validators all passed. The universal matrix records Codex Code and Research defaults while Claude, Cursor, Kiro, Antigravity, Gemini, Workbench, and all non-Research domains remain inactive for this rollout.

## 22. Default decision

All 25 Phase 8D hard checks passed. The decision is `DEFAULT_ACCEPTED`. The default is a thin state selector around the Brain-owned universal runtime; it is not a Codex-specific Research fork and is not production execution.

Infinite Brain Orchestrator v2 Phase 8D is accepted: Research requests in Codex now use the universal Brain-owned v2 orchestration contract by default, with authoritative and selective source acquisition, citation provenance, contradiction handling, specialist routing, atomic context, retained fallback, validated rollback, and no client-specific Research fork.

## 23. Design/Web readiness

Design and Web were audited only as future archetypes. No Design, Web, Video, Claude Research, or other consumer/domain default was activated. Existing Design/Web descriptors and universal contracts are the appropriate next evaluation surface after this Codex Research default stabilizes.

## 24. Next-canary contract

Recommend exactly one combined rollout shape: **Design → Web implementation**, preserving one Brain-owned universal runtime, descriptor-first specialist discovery, atomic Context Broker retrieval, evidence/visual QA gates, retained prior path, and explicit rollback. The first consumer should be Codex, with all other consumers shadow-only until separately authorized.

NEXT MAJOR ARCHETYPE:
Design / Web combined Design-Web route

NEXT CANARY CONSUMER:
Codex

## 25. Broad drift

`npm run infinite-brain:conformance` was rerun and failed with the same hashed output as the pre-promotion baseline. It is recorded as unchanged, nonblocking broad Workbench drift; it did not affect universal semantics, Research authority, provenance, safety, rollback, or the Phase 8D decision. No broad drift was suppressed or reclassified as a pass.
