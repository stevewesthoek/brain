# Infinite Brain Research and Bible Orchestration Gap Analysis

**Date:** 2026-09-01
**Baseline:** `origin/main` `46bec0626b3d61c35f5f7da3b1a538c17978a4e2`
**Scope:** `research`, `bible-research`, `scripture-sources`, web/source acquisition, evidence, qualification, quality gates, state, and continuity
**Status:** Audit and proposed remediation only; no profile, client, provider, or runtime behavior changed

## Executive conclusion

Research is one of Brain’s strongest orchestration islands. The active `research` source has clear research types, evidence levels, source-first laws, freshness checks, citation/provenance requirements, disagreement handling, domain routing, and a recommended research-repo output. The `bible-research` source has an unusually strong domain method: context before application, exegesis/homiletics separation, translation comparison, cautious original-language handling, tradition representation, uncertainty, and no fabricated scholarly citations.

The gap is operational convergence. Bible research is a dormant specialist in the research profile, not a default active surface. The research profile itself currently fails resolution on `gemini`. Web acquisition, Scripture source retrieval, media acquisition, and academic/source tools are separate dormant capabilities. Research guidance recommends source ledgers and cited notes, but the universal Context Pack, task packet, evidence packet, and continuity contract are not yet connected to a live research route. The result is methodologically strong but not reliably black-box routable or consistently resumable.

## Current inventory

| Capability | Source | Current role | Current activation |
|---|---|---|---|
| Research | `ai/skills/custom/research/SKILL.md` | Active master research orchestrator | Default active |
| Bible research | `ai/skills/custom/bible-research/SKILL.md` | Domain specialist routed by research | Research profile; dormant by default |
| Scripture sources | `ai/skills/custom/scripture-sources/SKILL.md` | Translation/reference/original-language source acquisition | Research profile; dormant by default |
| Web | `ai/skills/custom/web/SKILL.md` | Web research, browser, automation, scraping router | Dormant; not in default/research source profile |
| Firecrawl | `ai/skills/custom/firecrawl/SKILL.md` | Web acquisition adapter | Research profile |
| Apify | `ai/skills/custom/apify/SKILL.md` | Scale acquisition adapter | Research profile |
| Playwright | `ai/skills/custom/playwright/SKILL.md` | Repeatable browser automation adapter | Research profile |
| Media acquisition | `ai/skills/custom/media-acquisition/SKILL.md` | Metadata/subtitle/media acquisition | Research profile |
| Graphify | `ai/skills/vendors/safishamsi/graphify/SKILL.md` | Optional structural/semantic navigation | Research/design profile; non-authoritative |
| Memory | `ai/skills/custom/memory/SKILL.md` | Explicit recall/capture/facts/maintenance | Default active; use only when requested/relevant |

The research profile has 14 entries and fails its dry-run because `gemini` is unresolved in the audited `origin/main` source. This is a profile-resolution failure, not evidence that the research method itself is invalid.

## What is strong today

### Research method and routing

`research/SKILL.md` provides:

- QUICK, WEB, DEEP, ACADEMIC, COMPARATIVE, FACT_CHECK, DOMAIN, and REPORT types;
- LIGHT, STANDARD, HIGH, and ARCHIVAL evidence standards;
- source-before-synthesis, primary-first, freshness, evidence-versus-interpretation, disagreement, citation, provenance, and no-fabrication laws;
- `/web` for acquisition, `/bible-research` for Bible method, `/code` for code questions, `/design` for visual work, and large-context preprocessing for very large corpora;
- research-repo output with source lists and compact notes.

That is a good domain router and should be retained. V2 should wrap it, not flatten it into a generic “search and summarize” prompt.

### Bible method

`bible-research/SKILL.md` and `operations/runbooks/bible-research.md` define passage, topical, word, theological, comparative, sermon-support, source-check, and research-note workflows. The method guardrails are appropriate for high-quality Bible work:

- read the passage in literary, historical, canonical, and immediate context;
- distinguish observation, interpretation, doctrine, and application;
- separate exegesis from homiletics;
- compare translations without treating one English rendering as the original;
- use original-language observations cautiously and disclose uncertainty;
- represent interpretive traditions honestly;
- preserve primary-text and scholarly-source provenance;
- avoid fabricated citations and overconfident pastoral conclusions.

The runbook’s recommended note frontmatter includes title, type, passage/topic, tradition, status, dates, sources, and confidence. This is an excellent domain-level seed for the evidence packet.

### Runtime contracts

The accepted CLR contracts already provide useful primitives:

- Context Broker `resolve`, `explain`, `align`, and capability list/inspect;
- bounded cited context items with freshness and authority;
- generic context packs with conflicts, unknowns, exclusions, budget, provenance, and state;
- universal-entry identity, Brain/Mind boundaries, progressive retrieval, and fail-closed behavior;
- session continuity with objective/state/artifact/handoff references.

Those contracts are explicitly repository/read-only implementations. CLR0–CLR4 acceptance does not claim live client activation, automatic research routing, automatic resume, conversation ingestion, or learning promotion.

## Gap matrix

| Area | Current evidence | Gap | Priority |
|---|---|---|---|
| Universal discovery | Research is active; Bible is routed in prose/profile docs | No one machine-enforced route from arbitrary prompt to research/Bible descriptor | P0 |
| Profile resolution | Default passes; research fails on `gemini` | Research profile cannot be applied reliably as written | P0 |
| Bible activation | Specialist source and runbook exist | Dormant-by-default and no active universal consumer route | P1 |
| Source acquisition | Firecrawl/Apify/Playwright/media/Scripture sources are separate | No normalized acquisition descriptor or common evidence result | P1 |
| Evidence ledger | Research recommends source tables/ledgers; Bible recommends sources/confidence | No universal claim/source/evidence packet emitted by the orchestrator | P0 |
| Context retrieval | Broker can bound and cite context | No live research adapter connects research intent to Broker scopes and selected instructions | P1 |
| Freshness | Broker supports six freshness states | Research output does not consistently expose source/context freshness in one envelope | P1 |
| Conflicts | Research says to represent disagreement; Broker supports conflicts | No standard conflict section in research/Bible output contract | P1 |
| Qualification | One clarification is allowed when evidence/output ambiguity is material | No shared test corpus; question behavior depends on skill prose | P0 |
| Bible tradition/audience | Specialist asks only when material | No descriptor fields or packet field forcing disclosure when material | P1 |
| Original-language claims | Method caution exists | No source capability/verification receipt connecting claim to lexicon/text evidence | P1 |
| Citation quality | Strong written law | No deterministic completeness gate across claims and source refs | P0 |
| Output state | Research-repo output and Bible note frontmatter are recommended | No common artifact/state references for pause/resume | P1 |
| Mind boundary | Research is expected to save durable personal research in Mind | No universal classification between ephemeral answer, Mind candidate, Brain evidence, and canonical write | P1 |
| Continuity | Handoff/CLR continuity contracts exist | Research/Bible outputs do not automatically carry continuity refs | P1 |
| Web/source fallback | Optional accelerators have policies | Profile/source drift and no live resolver make fallback inconsistent | P1 |
| High-stakes research | Evidence levels exist | No universal risk class/confirmation policy for medical/legal/financial/current operational claims | P0 |

## Black-box cases

| Prompt | Desired behavior | Current documented behavior | Gap |
|---|---|---|---|
| “Research this.” | Ask one bundled question only if question/output/evidence are all materially missing | Research allows one clarification when ambiguity matters | No shared route receipt or question schema |
| “Verify whether this claim is true.” | Route fact-check, use primary sources, show disagreement/freshness | Research has FACT_CHECK and source-first laws | Good method; no universal evidence packet |
| “What does Romans 8:28 mean?” | Route research → Bible specialist, retrieve passage context, disclose method/tradition only when material | Route is documented; Bible specialist is dormant | No runtime activation or route receipt |
| “Compare how Calvinist and Arminian readings handle this passage.” | Bible comparative workflow, represent traditions, cite primary/secondary sources, disclose scope | Comparative workflow and method are documented | No standard tradition/audience fields or conflict packet |
| “Do a word study on `hesed`.” | Bible word workflow, translation/original-language source checks, uncertainty | Word-study and Scripture source workflows exist | Source availability/provenance is not one contract |
| “Find current research on this medical question.” | High-evidence current research, primary/authoritative sources, risk note, no clinical overclaim | Research can select DEEP/ACADEMIC and freshness; global guardrails cover high-stakes topics | Risk/evidence routing is not machine-enforced |
| “Turn this study into a note for the vault.” | Produce cited note, classify as Mind candidate, require write policy/approval | Research/Bible recommend repo/Drive/note output | No shared artifact/authority packet |
| “Continue my Bible study where I stopped.” | Verify continuity/revision/conflicts, retrieve only cited sources, ask confirmation before mutation | Handoff/continuity contracts define this | No automatic research adapter binding |

## Target research/Bible composition

```text
universal entry
  → normalize research/Bible intent and risk
  → Mind context when strategy/audience/tradition is relevant
  → Brain research policy and capability descriptors
  → research adapter
      ├─ web / Firecrawl / academic source acquisition
      ├─ bible-research method
      ├─ scripture-sources when text/translation/language evidence is needed
      └─ memory only when explicitly requested or policy requires a candidate
  → evidence packet
      ├─ claims and source refs
      ├─ translation/tradition/language boundaries
      ├─ freshness, conflicts, unknowns, exclusions
      └─ confidence and validation
  → citation/method/risk gate
  → answer, cited research note, or bounded handoff
```

Research acquisition must remain distinct from synthesis. `scripture-sources` should retrieve or compare text; `bible-research` should interpret with method; `research` should choose evidence depth and output; the universal router should only compose them and carry the envelope.

## Proposed descriptor additions

Research/Bible descriptors should add these fields to the proposed v2 catalog:

```yaml
intents: [research, fact_check, comparison, bible_passage, bible_topical, bible_word, theology]
domains: [general_research, bible]
requiredContextScopes: [source_material, research_policy, mind_strategy_when_relevant]
sourceModes: [web, academic, scripture_text, translation, original_language]
evidenceStandards: [light, standard, high, archival]
outputKinds: [answer, report, research_note, sermon_support, source_check]
qualityGateRefs: [citation_completeness, source_provenance, freshness, method_disclosure]
materialQuestionFields: [scope, audience, tradition, evidence_standard, output_kind]
riskClass: read-only | low | high
confirmationClass: none | user
continuity: pointer_only | resumable
```

These are proposed metadata fields, not current `SKILL.md` frontmatter and not current runtime behavior.

## Priority remediation

### P0 — Route and evidence contract

1. Add research/Bible descriptors to the shadow catalog.
2. Define one route fixture set for general research, fact-check, Bible passage, theology, comparison, word study, and high-stakes current research.
3. Define the one-question policy and expected safe defaults.
4. Adapt the existing Context Pack to a research evidence packet with claim/source references, freshness, conflicts, unknowns, and exclusions.
5. Add deterministic citation-completeness and source-provenance validators.

### P1 — Domain composition

1. Repair or explicitly quarantine the unresolved research profile entry; do not silently remove `gemini`.
2. Connect `research` to `bible-research` and `scripture-sources` through descriptor selection rather than profile assumptions.
3. Connect web/source acquisition as adapters with side-effect and provenance metadata.
4. Bind research-note and Bible-note output to artifact references and Mind/Brain authority classification.
5. Add continuity references for resumable research tasks.

### P2 — Activation and measurement

1. Run the shadow router against the prompt corpus.
2. Run read-only consumer conformance for one client at a time.
3. Measure route accuracy, question rate, source/citation completeness, stale-source visibility, context cost, and resume correctness.
4. Activate only after a separate authorization names the client, profile, provider boundary, rollback, and evidence threshold.

## Acceptance criteria

Research/Bible routing is ready for a bounded activation proposal when:

- all route fixtures select the correct primary adapter and specialists;
- no user is asked to choose a skill, model, provider, or profile;
- material ambiguity produces at most one bundled question;
- every claim in a cited output has source refs or an explicit unsupported/unknown status;
- source authority, freshness, conflicts, translation/tradition scope, and original-language uncertainty are visible;
- acquisition and synthesis are separate in the evidence graph;
- Mind candidate versus Brain operational evidence is explicit;
- stale or unavailable sources fail visibly or produce a bounded partial result;
- task/evidence/continuity references validate against current revision;
- shadow mode performs no provider calls, writes, or external actions.

## Evidence links

- [Research skill](../../ai/skills/custom/research/SKILL.md)
- [Bible research skill](../../ai/skills/custom/bible-research/SKILL.md)
- [Scripture sources skill](../../ai/skills/custom/scripture-sources/SKILL.md)
- [Research orchestrator runbook](../runbooks/research-orchestrator.md)
- [Bible research runbook](../runbooks/bible-research.md)
- [Scripture source stack](../runbooks/scripture-source-stack.md)
- [Media acquisition boundary](../runbooks/media-acquisition-yt-dlp.md)
- [Context Broker contract](../specs/context-learning/broker-contracts-v1.schema.json)
- [Context Pack schema](../specs/context-pack.schema.json)
- [Universal entry consumption policy](../specs/context-learning/universal-entry-consumption-policy.md)
- [Session continuity policy](../specs/context-learning/session-continuity-policy.md)
- [Orchestrator v2 specification](../specs/infinite-brain-orchestrator-v2.md)
