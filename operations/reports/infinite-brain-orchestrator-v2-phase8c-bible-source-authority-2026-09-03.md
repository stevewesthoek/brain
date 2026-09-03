# Infinite Brain Orchestrator v2 — Phase 8C

## Bible Research Source Authority Hardening and Research Promotion Reassessment

Date: 2026-09-03  
Decision: `PROMOTION_READY`  
Implementation branch: `codex/infinite-brain-orchestrator-v2-phase8c-bible-authority`  
Baseline origin/main: `0c7e4340008b3dc2bf8324f346720bc694ea9977`

## 1. Baseline and scope

Phase 8C was run from a clean worktree based on the exact current `origin/main` baseline. The scope was limited to hardening Bible Research source authority and reassessing the Phase 8B Research promotion gate. No universal Orchestrator v2 redesign, default-profile promotion, Claude Research activation, Web/Design activation, Mind write, external mutation, deployment, or copyrighted-corpus acquisition was performed.

Phase 8C kept Bible Research as the specialist `skill.bible-research` under general `skill.research`.

## 2. Phase 8B blocker verification

The current Phase 8B report remains `MORE_RESEARCH_EVIDENCE_REQUIRED`. Its exact blocker was: “Bible source authority lacks peer-reviewed or critical-edition evidence.” The Phase 8B bounded cohort had 12 Bible substantive outputs, all dependent on translation and secondary lexical witnesses for the Bible portion; no peer-reviewed or critical-edition source had been added.

The Phase 8B runner was rerun from the Phase 8C worktree. Its baseline remained valid as a descendant of the Phase 8B maintenance commit, and its non-Bible gates remained passing.

## 3. Current Bible source inventory before hardening

The pre-Phase-8C Bible catalog contained Bible Gateway translation witnesses, a Bible Hub interlinear page, and a Blue Letter Bible lexical entry. These remain useful bounded supplementary/secondary sources, but none was promoted to critical or peer-reviewed authority. The catalog therefore correctly exposed the Phase 8B gap rather than silently upgrading these sources.

## 4. Implemented authority policy

`BIBLE_SOURCE_AUTHORITY_POLICY` now maps claim types to preferred and supporting source types:

- textual evidence: critical edition or critical text, with peer-reviewed method support;
- original-language evidence: original-language text or morphology, with critical-text support where relevant;
- lexical evidence: lexical source plus contextual language evidence; a lexical aid alone cannot settle contextual meaning;
- syntax: original-language text, morphology, and peer-reviewed interpretation;
- historical and scholarly interpretation: verified peer-reviewed full text, with metadata explicitly weaker;
- canonical synthesis: peer-reviewed interpretation and/or critical/original-language text, with synthesis labeled as interpretation.

Translation and lexical-aid sources are explicitly disallowed as sole authority for textual, historical, scholarly-interpretive, and canonical claims.

## 5. Critical-text and critical-edition evidence

The hardening catalog records the SBL Greek New Testament (SBLGNT) as `CRITICAL_TEXT`, not as a complete apparatus. Its official site identifies it as a critically edited Greek New Testament and its license page records CC BY 4.0 terms: [SBLGNT](https://www.sblgnt.com/) and [SBLGNT license](https://www.sblgnt.com/license/).

The Institut für Neutestamentliche Textforschung New Testament Virtual Manuscript Room (INTF NTVMR) is recorded as `CRITICAL_EDITION` / `CRITICAL_EDITION_SUPPORT`, but only `REFERENCE_IDENTIFIED` in this run. Its service was not fetched as apparatus or manuscript content, so no apparatus claim was made and no apparatus material was copied: [INTF NTVMR](https://ntvmr.uni-muenster.de/).

This distinction is material: SBLGNT supports a critical Greek-text witness; INTF identifies the scholarly critical-edition/manuscript environment; neither record authorizes copying a commercial or restricted apparatus into Brain.

## 6. Peer-reviewed scholarly support

The harness used the open scholarly article “Approaches Old and New in Twenty-First Century New Testament Textual Criticism” as a verified `PEER_REVIEWED_FULL_TEXT` source for method and scholarly-context claims: [Religions article 17(3), 400](https://www.mdpi.com/2077-1444/17/3/400).

The catalog also records the Society of Biblical Literature’s Textual Criticism journal and the University of Tübingen’s Advances in Ancient, Biblical, and Near Eastern Research as peer-reviewed venues. Their pages were unavailable to the bounded fetcher in this run, so they were not counted as retrieved full-text evidence. The SBL journal record remains a source reference, not a fabricated article retrieval: [SBL Textual Criticism journal](https://www.sbl-site.org/sbl-press/browse-journals/textual-criticism/) and [Tübingen journal](https://ojs3.uni-tuebingen.de/ojs/index.php/beabs/index).

Crossref and Research.fi records were used only as `ABSTRACT/METADATA_ONLY` publication-identification evidence. Crossref metadata was not treated as article full text: [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/).

## 7. Evidence-packet metadata contract

Source records now support:

`sourceType`, `claimTypes`, `peerReviewStatus`, `criticalEditionStatus`, `accessLevel`, `licenseConstraint`, `citationCapability`, `language`, and `editionVersion`.

The four access states are preserved exactly:

| State | Meaning in this run |
|---|---|
| `FULL_TEXT_VERIFIED` | bounded content was fetched and inspected |
| `ABSTRACT/METADATA_ONLY` | only publication metadata/abstract-level record was accessed |
| `REFERENCE_IDENTIFIED` | authoritative source identified without fetching its content |
| `UNAVAILABLE` | retrieval was unavailable; no evidence was fabricated |

Packet authority assessment also records claim type, preferred and selected source types, metadata-only sources, full-text sources, and the three false preload controls for all Bible sources, commentaries, and critical resources.

## 8. Textual-critical cases

Ten cases were added: Romans 5:1; Mark 1:1; John 1:18; 1 Timothy 3:16; Acts 20:28; 1 John 5:7–8; Romans 8:1; Luke 23:34; Mark 16:9–20; and John 7:53–8:11.

Each case separates the critical-text witness from the apparatus question. The harness does not turn SBLGNT’s public web identity into a claim that a particular variant has been exhaustively adjudicated. Cases requiring manuscript or apparatus detail retain that as a bounded follow-up requirement.

## 9. Greek and Hebrew cases

Fifteen cases were added: Greek phroneō, sarx, pneuma, dikaiosynē, pistis, monogenēs, logos, agapē, sōzō, and metanoeō; Hebrew hesed, ruach, nephesh, torah, and emunah.

Greek cases use the critical-text witness with peer-reviewed textual-criticism method support. Hebrew cases use Open Scriptures Hebrew Bible text/morphology records, labeled `ORIGINAL_LANGUAGE_TEXT`/`MORPHOLOGY` and explicitly `NOT_CRITICAL`: [OSHB repository](https://github.com/openscriptures/morphhb) and [bounded Genesis XML witness](https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/Gen.xml).

The packet language follows the Bible Research rule that original-language data clarifies context but does not create a novel meaning, and that semantic range is not contextual meaning.

## 10. Scholarly exegesis cases

Fifteen cases were added: Romans 8:1–17; Romans 3:21–31; Galatians 2:15–21; Ephesians 2:1–10; James 2:14–26; Matthew 5:17–20; John 15:1–8; Hebrews 6:4–12; 1 Corinthians 11:2–16; 1 Corinthians 14:33–40; 1 Peter 3:18–22; Colossians 1:15–20; Philippians 2:5–11; Psalm 22; and Isaiah 53.

The cases use peer-reviewed full-text support where retrieved, but conclusions remain bounded to source scope. Publication metadata is never substituted for an article’s argument, and a source fact is kept separate from interpretation and canonical synthesis.

## 11. Scholarly disagreement cases

Ten disagreement cases were added: Romans 9–11; Romans 8:28–30; Matthew 16:18–19; James 2:14–26; 1 Timothy 2:11–15; Revelation 20:1–6; baptism and household passages; Lord’s Supper passages; Genesis 1–2; and Isaiah 7:14.

Disagreement is retained as disagreement. No tradition is represented as the neutral default, no conflicting interpretation is silently discarded, and metadata-only records cannot be used to claim that scholarship has been reconciled.

## 12. Historical and cultural cases

Ten cases were added: Roman citizenship in Acts 16 and Acts 22; idol-food disputes in 1 Corinthians 8–10; Corinthian dress in 1 Corinthians 11; Roman political context in Romans 13; Paul’s chronology in Galatians 1–2; Second Temple purity context in Mark 7; Samaritan-Jewish context in John 4; shepherd imagery in Psalm 23; and ancient covenant/law context in Exodus 20.

Historical claims require peer-reviewed support or an explicit insufficiency label. They are not inferred from a translation, lexicon, or a generalized cultural assumption.

## 13. Canonical and theological synthesis cases

Ten cases were added: Romans 8 with Genesis 1–3; Romans 4 with Genesis 15; Galatians 3 with Genesis 12; Matthew 5 with Exodus 20; John 1 with Genesis 1; Hebrews 8 with Jeremiah 31; 1 Peter 2 with Exodus 19; Revelation 21–22 with Isaiah 65–66; Psalms and Romans; and Exodus 34 with 2 Corinthians 3.

These packets label canonical connections as synthesis rather than pretending that a cross-reference is itself a direct textual claim. Greek/Hebrew source facts, textual evidence, scholarly interpretation, and theological conclusions remain separate layers.

## 14. Copyright, licensing, and access boundaries

SBLGNT and OSHB are recorded with their stated CC BY 4.0 attribution boundaries. Bible Gateway, Bible Hub, and Blue Letter Bible remain supplementary/secondary witnesses with quotation and site-use constraints. Crossref abstracts and scholarly articles are not copied as corpora. INTF apparatuses and manuscript images are not copied. The harness retains only bounded excerpts, content digests, source identity, license metadata, and citation capability.

No access failure was converted into authority, and no abstract was represented as full text.

## 15. 60+ substantive Bible benchmark

The benchmark contains 70 new substantive Bible cases:

| Family | Required | Added |
|---|---:|---:|
| Textual-critical | 10 | 10 |
| Greek/Hebrew | 15 | 15 |
| Scholarly exegesis | 15 | 15 |
| Scholarly disagreement | 10 | 10 |
| Historical/cultural | 10 | 10 |
| Canonical/theological | 10 | 10 |
| Total | 70 | 70 |

All 70 cases used at least one strengthened source. All 70 had verified peer-reviewed full-text support in the bounded packet source set; 65 also had retrieved critical-text authority. The latter count does not imply that every case required a textual variant decision.

## 16. Selectivity and atomic context

The harness did not preload all Bible sources, all commentaries, all critical resources, or all Bible skill bodies. Every case selected only two to four source records. Full source bodies were not stored; raw bodies were absent from every packet. Unrelated evidence classes and unrelated full-body reads were zero.

This preserves the atomic context rule: acquire only the source class needed for the claim, preserve bounded provenance, and deepen one material gap at a time.

## 17. Codex/Claude semantic parity

Thirty new Bible-focused Codex/Claude semantic comparisons were run. Result: 30/30 semantic matches, 100% parity. The Claude Research consumer was shadow-compared only; it was not activated.

## 18. Expert assessment

This is a bounded engineering assessment of the implemented evidence contract, not an external peer review of every theological conclusion.

| Dimension | Assessment |
|---|---:|
| route and specialist boundary | 9/10 |
| source authority classification | 10/10 |
| critical-text honesty | 10/10 |
| peer-review handling | 9/10 |
| access-state fidelity | 10/10 |
| citation completeness | 10/10 |
| scholarly disagreement preservation | 9/10 |
| original-language discipline | 9/10 |
| licensing/copyright boundary | 10/10 |
| atomic context/selectivity | 10/10 |
| Codex/Claude parity | 10/10 |
| rollback/no-promotion safety | 10/10 |

The residual caution is methodological: a passing source-authority gate establishes a safe and traceable source path; it does not make every future exegetical conclusion correct without passage-specific review.

## 19. Phase 8B regression

Phase 8B was rerun. Its decision remained `MORE_RESEARCH_EVIDENCE_REQUIRED`, preserving the historical baseline rather than rewriting it. All Phase 8B non-Bible hard gates remained passing, including routing, evidence gates, source independence, contradiction handling, insufficiency, freshness, deepening, stopping, business/technical/outdoor minimums, handoffs, parity, prior-path comparison, failure visibility, rollback, safety, atomic context, and no-other-activation controls.

Phase 8B citation regression remained 136/136 resolved and passed, with zero fabricated, unrelated, or major unsupported citations. Its authority blocker remained isolated to the prior 12 Bible outputs. This is the expected regression: Phase 8C resolves the gap in the new bounded evidence path without falsifying the Phase 8B historical result.

The repository-wide conformance command was also rerun. It reported the pre-existing Workbench artifact/provenance revision mismatch and unavailable baseline scheduler/provider commands; the Phase 8B runner classified that drift as non-blocking with universal semantics unaffected. The focused context-learning, orchestrator, and universal-consumer validators passed.

## 20. Blocker resolution verdict

Prior gap: **Bible source authority lacks peer-reviewed or critical-edition evidence.**

Resolution: `RESOLVED`.

Evidence: 70/70 Bible cases used strengthened authority; 70/70 included verified peer-reviewed full-text support; 65/70 included retrieved critical-text authority; 196/196 citation checks passed; fabricated scholarly claims, critical-source misrepresentation, copyright/access violations, major unsupported conclusions, silent disagreement loss, and stale-as-current source use were all zero; all authority gap assessments were false; and the packet/atomicity/safety controls passed.

## 21. Research promotion verdict

`PROMOTION_READY`.

The Phase 8C acceptance gate passed while default activation remained false. Codex Research v2 was not made the default in this goal. No Claude Research, Design, Web, or other consumer activation occurred.

Required exact acceptance statement:

"Infinite Brain Orchestrator v2 Phase 8C is accepted: the remaining Bible research source-authority gap is resolved with selective access to appropriate critical-edition and scholarly evidence, while preserving atomic context, provenance, interpretive transparency, licensing boundaries, and consumer-independent Research semantics. Codex Research is now PROMOTION_READY."

## 22. Exact next action

The exact next transition is:

```text
Codex × Research
CANARY_ACCEPTED
→
RESEARCH_V2_DEFAULT_FOR_CODEX
```

Retain the prior Research path for rollback. Perform that transition only in a separately authorized phase with clean revalidation of the Phase 8B and Phase 8C gates.

Required next-phase statement:

"Next phase: promote Codex Research v2 to default while retaining the prior Research path as rollback. After Research stabilizes, begin Design/Web as the final major execution archetype."
