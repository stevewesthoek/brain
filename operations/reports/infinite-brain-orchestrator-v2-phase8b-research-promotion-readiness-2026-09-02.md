# Infinite Brain Orchestrator v2 — Phase 8B Research Promotion Readiness

Date: 2026-09-02
Baseline: `origin/main` = `ffe6b0caae15ab2525709ecaddbdc92bd5c6cb16`
Consumer under test: Codex × Research only
Decision: `MORE_RESEARCH_EVIDENCE_REQUIRED`

## 1. Baseline

Phase 8B ran in clean isolated worktree branch
`codex/infinite-brain-orchestrator-v2-phase8b-research-readiness`, based on
the verified `origin/main` baseline. The original dirty checkout was not
edited. The baseline matched the Phase 8A expected SHA.

## 2. Phase 8A revalidation

The Phase 8A runner returned `CANARY_ACCEPTED`. Its foundation, activation
scope, burn-in, 100-case cohort, evidence packets, provenance, contradiction,
deepening, stopping, quality, Bible specialist, parity, prior path, failure,
safety, atomicity, rollback, and no-other-activation checks passed.

## 3. 150+ extended cohort

The new cohort contains 150 unique prompt and case IDs, serially executed. It
adds 30 general/deep, 30 business/company/market, 24 technical/product,
15 outdoor/location, 36 Bible, and 15 contradiction/fact-check cases. With
the 100 Phase 8A cases, the comparable total is 250.

## 4. 50+ substantive outputs

Fifty new substantive outputs were acquired through the read-only Research
control plane: 10 general/deep, 10 business/company/market, 8
technical/product/comparative, 5 outdoor/location/other, 12 Bible specialist,
and 5 contradiction/fact-check outputs. Each preserved question,
subquestions, source records, claim ledger, evidence layers, uncertainty, and
citations.

## 5. Citation correctness

All 136/136 citation checks resolved to recorded sources, matched claim
references, were bounded by retained evidence, and passed freshness
consideration. Fabricated citations: 0. Unrelated citations: 0. Major
unsupported conclusions: 0. Weak retrieval remains explicitly quality-
degraded rather than silently treated as canonical.

## 6. Source authority

38/50 output packets included a PRIMARY, OFFICIAL, DIRECT_DATA, or SCHOLARLY
source. The precise remaining weakness is the 12 Bible packets: their
retrieved witnesses are translation and secondary lexical sources, not a
peer-reviewed or critical-edition authority set.

## 7. Source independence/diversity

Measured source quality was primary/authoritative use 0.76, relevance 1.00,
diversity 0.6333, weak-source dependence 0.1940, and contradiction loss 0.
Independence groups are recorded by source host; repeated upstream use is
visible in each packet rather than counted as independent corroboration.

## 8. Contradiction tests

Five contradiction/fact-check outputs retained both source positions, emitted
an `UNCERTAINTY` layer, preserved open conflict state, and recorded quality
comparison. Silent overwrite count: 0. Unsupported certainty count: 0.

## 9. Evidence insufficiency

Ten insufficiency cases were exercised: five unavailable-source cases and five
stale-source cases. All returned `INCOMPLETE`, `answerReady=false`, explicit
`EVIDENCE_INSUFFICIENT`, and no passing citation. No certainty was fabricated.

## 10. Freshness

All 50 substantive current-output packets recorded freshness metadata and were
current-enough for this harness. Five stale cases were rejected or downgraded;
stale evidence was not silently selected as current.

## 11. Iterative deepening

Twenty-two substantive cases measured a second round. Each had exactly one
atomic request, two total depth rounds, evidence added, and a decision marked
as improved after the gap check. Unnecessary expansion: 0.

## 12. Stopping

Premature stopping with a major unanswered question: 0 measured cases.
Over-research: 0 measured cases. Stopping records include answer readiness,
claim support, contradiction handling, source-quality review, retrieval value,
and budget checks.

## 13. Business

Ten new business/company/market outputs used SEC or World Bank source paths,
with source authority, retrieval timestamp, digest, claim bounds, and
uncertainty recorded. No business decision was executed or published.

## 14. Technical

Eight new technical/product/comparative outputs used PostgreSQL official
documentation paths and retained version-sensitive source provenance. No code
was changed by the Research path and no provider call occurred.

## 15. Bible

Twelve new Bible outputs were produced under `skill.bible-research`, covering
passage/context, lexical/syntax, historical/cultural, canonical context,
scholarly disagreement, and theological synthesis classes. Bible remained a
specialist beneath Research; it did not become a universal router.

## 16. Original-language

Original-language cases explicitly carried an original-language caution and
lexical/syntax class. The harness treats interlinear and lexicon material as
secondary aids and does not infer that a gloss settles contextual meaning.
This discipline passed, while source-authority depth remains the promotion
gap.

## 17. Specialist

Five new outdoor/location/other specialist outputs used National Park Service
source paths. Specialist selection remained bounded to the case and did not
activate a global specialist profile.

## 18. Research/Code handoff

Eight mixed Research→Code shadow cases kept `skill.research` primary and
`skill.code` downstream. Handoffs contained evidence and source references,
decision constraints, `gate.review`, and `gate.qa`; raw source bodies and raw
excerpts were excluded. Code review and QA remain required downstream.

## 19. Research/Design preparation

Five Research→Design shadow cases kept Research primary and exposed only a
refs-and-claims boundary. Design was not activated, and no design artifact or
external state was mutated.

## 20. Qualification

Across the 150-case cohort, architecture/provider/model/profile/skill choice
questions were 0, unnecessary clarification was 0, and missed material
ambiguity was 0. The cases used safe inferable defaults without asking users
to select internal implementation details.

## 21. Atomic context

Full Research skill bodies, full Bible layers, full source bodies, secrets,
and unrelated specialist bodies were not loaded into the route context. The
recorded maximum referenced context was 1 bounded unit; unrelated full-body
reads were 0.

## 22. Claude shadow parity

Claude Research remained inactive. Seventy-five Codex-versus-Claude shadow
comparisons produced 75/75 semantic matches (100%). This is shadow parity,
not Claude Research activation or a claim about provider execution.

## 23. Prior path

Thirty representative prior-path comparisons retained
`codex-current-research-entry` availability. The v2 path added source-backed
evidence, freshness, citation, and bounded handoff metadata; the measured
overall comparison was equal or better with no prior-path removal.

## 24. Expert researcher assessment

The 20-dimension assessment used a non-perfect range of 7–9/10: route
correctness 9, qualification 9, source authority 7, citation correctness 9,
citation fidelity 8, source independence 8, contradiction handling 8,
evidence insufficiency 9, freshness 8, iterative deepening 8, stopping 8,
business 8, technical 8, Bible 7, original-language discipline 7,
specialist routing 9, Research→Code 8, Research→Design 8, failure visibility
9, and rollback safety 9. No perfect claim is made; Bible authority and
original-language source depth are the weakest dimensions.

## 25. Failure/degradation

Ten visible failure cases covered unavailable, blocked, weak-only, stale,
contradictory, Broker-unavailable, specialist-unavailable,
citation-metadata-missing, tool-unavailable, and primary-unavailable states.
All degraded visibly, recorded insufficiency, and passed the no-fabrication
check.

## 26. Rollback

Rollback selected the legacy path with `v2=null` and no packet replay. A fresh
preflight then re-enabled the canary. The Code default remained unchanged.

## 27. Broad drift

The broad Brain conformance check was rerun and returned known non-blocking
drift outside Research semantics: Workbench artifact/provenance mismatch,
missing scheduler inventory/typed validators, and baseline capability flags.
The drift was recorded, not suppressed; universal Research/Code semantics were
not affected.

## 28. Promotion contract

The promotion contract is defined but not executed. `defaultActive=false`,
`productionActive=false`, and no client/profile/global skill expansion occurred.
Future promotion requires explicit authorization and a clean revalidation of
all Phase 8B gates, including the source-authority gap.

## 29. Final verdict

`MORE_RESEARCH_EVIDENCE_REQUIRED`.

The exact remaining weakness is Bible source authority: the 12 new Bible
outputs use translation and secondary lexical witnesses, without a
peer-reviewed or critical-edition source in this bounded canary. This blocks
promotion readiness even though citation correctness, safety, routing,
freshness, contradiction, deepening, parity, prior-path, and rollback gates
pass.

## 30. Next archetype

Design/Web is deferred as the next archetype. It may be evaluated only after
the Bible evidence-authority gap is closed, this report’s promotion contract
is freshly revalidated, and separate authorization is provided. No Design or
Web activation occurred in Phase 8B.
