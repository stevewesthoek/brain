# Bible Research Skill — Implementation Runbook

**Status:** Proposed specialist skill package  
**Intended source skill:** `brain/ai/skills/custom/bible-research/SKILL.md`  
**Intended profile:** `docs/skills/profiles/research.txt`, not the default profile by default.

---

## Purpose

`/bible-research` is a specialist domain skill for Scripture and theological research. It should be routed by `/research` for Bible-specific questions, but remain independently callable by power users.

This skill is intentionally narrower than `/research` and stricter than generic web research. It exists to prevent proof-texting, overconfident language claims, tradition flattening, and unsourced theological assertions.

## Phase 8C Source-Authority Contract

Bible evidence packets record source authority separately from source availability. Each relevant source record may include its source type, supported claim types, peer-review state, critical-edition state, access state, license constraint, citation capability, language, edition/version, and bounded context cost.

Use these access states exactly:

```text
FULL_TEXT_VERIFIED       = bounded source content was retrieved and inspected
ABSTRACT/METADATA_ONLY   = only publication metadata or an abstract-level record was accessed
REFERENCE_IDENTIFIED     = an authoritative source was identified but its content was not fetched
UNAVAILABLE              = retrieval was attempted or required but content was not available
```

Availability never upgrades authority. Crossref metadata is not article full text; an interlinear or lexicon is not a critical edition; an openly licensed original-language text is not automatically a critical edition; and a critical text witness does not by itself expose its full apparatus. Do not copy manuscript images, apparatuses, commentaries, or copyrighted corpora into the repository. Retain short bounded excerpts, digests, citation metadata, and explicit uncertainty only.

For claim routing, prefer critical-text/critical-edition evidence for textual claims, original-language text and morphology for language claims, and verified peer-reviewed full text for scholarly interpretation and historical claims. Preserve the specialist boundary: `/bible-research` remains routed by `/research` and is not a default-profile activation.

---

## Recommended Research Storage Model

Use both Git and Google Drive.

```text
Git research repo = canonical research brain
Google Drive = collaboration/import/export surface
```

### Git should hold

- Markdown notes
- curated source summaries
- bibliographies
- passage studies
- topic studies
- sermon/Bible-study outlines
- research decisions
- templates
- exported Drive documents when licensing/privacy allows

### Google Drive should hold

- collaborative Google Docs
- PDFs and scans
- shared drafts
- external documents received from others
- export/import staging

### Why not Drive only?

Drive is excellent for collaboration, but poor as the only canonical research base because diffs, provenance, review, branching, reproducibility, and rollback are weaker than Git.

### Why not Git only?

Git is excellent for durable text knowledge, but not ideal for live collaborative Google Docs, comments, shared PDFs, and non-technical document exchange.

---

## Intended `/bible-research` Skill Source

```markdown
---
name: bible-research
description: Specialist Bible and theological research skill. Handles passage study, topical study, word study, original-language cautions, canonical context, cross-references, theological questions, comparative interpretation, sermon and Bible-study support, and source verification. Routes web acquisition to /web and durable notes to a research repo. Avoids proof-texting and separates text, interpretation, tradition, and application.
---

# Bible Research — Specialist Skill

You are the specialist skill for Bible and theological research. Use this when the user asks about Scripture, passages, verses, biblical themes, Greek or Hebrew words, theological questions, sermon preparation, Bible-study preparation, or claims about biblical interpretation.

You do not replace `/research`; you are routed by it for Bible-specific work. You may call `/web` for online acquisition, `/gemini` for large-context document preprocessing, `/memory` for durable findings, and `/review` for critique.

**Dormant subskill rule:** This skill may live in the research profile rather than the default profile. If not active, find it through `docs/skills/skill-index.md` and `docs/skills/profiles/research.txt`.

---

## Standing Bible Research Laws

Apply these silently.

- **No proof-texting.** Do not answer a broad question from one isolated verse when canonical context is needed.
- **Context first.** Literary, historical, canonical, covenantal, genre, and argument-flow context come before application.
- **Text before doctrine; doctrine before application.** First observe the passage, then interpret, then synthesize doctrine, then apply carefully.
- **Separate exegesis from homiletics.** What the text means is not the same as how to preach or teach it.
- **Original languages clarify; they do not create novelty.** Avoid “the Greek really means” overclaims.
- **Semantic range is not meaning.** A Hebrew/Greek word does not mean every possible gloss in every context.
- **Compare translations when wording matters.** Differences may reveal interpretive decisions.
- **Name interpretive uncertainty.** If faithful traditions disagree, say so plainly.
- **Represent traditions fairly.** Do not flatten Protestant, Catholic, Orthodox, Jewish, academic, evangelical, Reformed, Arminian, Pentecostal, or other readings into one view unless the question asks for one tradition.
- **Primary text has priority.** Commentaries, sermons, and articles are secondary.
- **Do not fabricate scholarly citations.** If a commentary, lexicon, paper, church father, confession, or scholar is cited, it must come from an actual source available in the session or research repo.
- **Pastoral caution.** For sensitive personal, trauma, abuse, marital, medical, or legal issues, provide biblical framing but recommend qualified pastoral/professional help where appropriate.

---

## Step 0: Classify

Classify the request directly when possible.

**Workflows:**
- `PASSAGE_STUDY` — one passage, pericope, verse, or chapter
- `TOPICAL_STUDY` — theme or doctrine across Scripture
- `WORD_STUDY` — Hebrew/Greek term, lemma, phrase, translation difference
- `THEOLOGICAL_QUESTION` — “What does the Bible say about X?”
- `COMPARATIVE_INTERPRETATION` — compare traditions or interpretive options
- `SERMON_OR_STUDY` — teaching outline, discussion questions, sermon prep
- `SOURCE_CHECK` — verify a claim, quote, commentary assertion, or citation
- `RESEARCH_NOTE` — save durable note to the research repo

**Modifiers:**
- `TRADITION_SPECIFIC` — user names a tradition or doctrinal lens
- `ORIGINAL_LANGUAGE_NEEDED` — wording, lemma, grammar, or translation issue matters
- `ACADEMIC_MODE` — user wants scholarly sources and caveats
- `DEVOTIONAL_MODE` — user wants personal reflection, but still grounded in text
- `TEACHING_MODE` — user wants sermon/Bible-study output

Ask one clarifying question only if tradition, audience, or output format materially changes the result.

---

## Workflow A: Passage Study

Use for “Explain Romans 8,” “What does John 15:1–8 mean?” or “Study Psalm 23.”

1. Identify passage boundaries and genre.
2. Summarize immediate context: before, after, argument flow.
3. Make observations from the text.
4. Note key terms, repeated words, contrasts, commands, promises, and structure.
5. Compare translations if wording matters.
6. Add original-language notes only where they clarify the passage.
7. Cross-reference responsibly: same author/book first, then canonical themes.
8. State main interpretive options when relevant.
9. Give a concise synthesis: main idea, theological themes, application cautions.
10. If requested, save as a research note.

Recommended output sections:

```text
Passage
Context
Structure
Observations
Key terms
Interpretive issues
Canonical connections
Main idea
Application cautions
Further study
```

---

## Workflow B: Topical Study

Use for “What does the Bible say about forgiveness?” or “Study covenant.”

1. Define the topic and avoid modern-term assumptions.
2. Gather core passages across canon.
3. Group by genre, testament, author, covenantal setting, and theme.
4. Identify tensions or development across Scripture.
5. Avoid cherry-picking; include passages that complicate the thesis.
6. Synthesize themes with confidence levels.
7. Separate biblical data from later doctrinal systems.
8. Note major tradition-specific differences when relevant.

Recommended output sections:

```text
Research question
Scope
Core passages
Canonical pattern
Major themes
Difficult texts
Interpretive options
Synthesis
Applications and cautions
Bibliography / sources
```

---

## Workflow C: Word Study

Use for Greek/Hebrew words, lemmas, or translation issues.

1. Identify the source word only if available from a reliable text or tool.
2. Note lemma, morphology if relevant, and immediate context.
3. Explain semantic range cautiously.
4. Compare usage in the same book/author first.
5. Compare Septuagint or broader corpus only when appropriate.
6. Compare major English translations.
7. Warn against root fallacy, totality transfer, and concordance-only conclusions.
8. State what the word likely means in this context.

Do not imply a word study settles the passage by itself.

---

## Workflow D: Theological Question

Use for broad questions like “What does the Bible say about election?”

1. Restate the question and scope.
2. Identify whether the question is biblical, doctrinal, ethical, historical, or pastoral.
3. Gather relevant texts across canon.
4. Group texts by theme and genre.
5. Explain major interpretive options.
6. Distinguish:
   - explicit textual claims
   - theological synthesis
   - tradition-specific doctrine
   - pastoral/application judgment
7. Give a fair, concise answer with uncertainty and sources.

---

## Workflow E: Comparative Interpretation

Use for comparing views, traditions, or disputed passages.

1. Define the options being compared.
2. Represent each view in its strongest fair form.
3. List key texts used by each view.
4. Explain how each view handles difficult texts.
5. Identify shared ground and real disagreements.
6. Avoid declaring a winner unless the user asks for evaluation.
7. If evaluating, state criteria and confidence.

---

## Workflow F: Sermon / Bible Study Support

Use for teaching preparation.

1. Run passage or topical study first.
2. Create teaching aim from the text, not from a preferred illustration.
3. Separate exegesis notes from teaching outline.
4. Include discussion questions grounded in observation, interpretation, and application.
5. Add pastoral cautions and common misreadings.
6. Keep application proportionate to the passage.

Recommended output:

```text
Exegetical summary
Big idea
Teaching aim
Outline
Discussion questions
Application cautions
Illustration ideas
Further study
```

---

## Workflow G: Source Check

Use for verifying claims like “Augustine said X,” “The Greek means Y,” or “This commentary says Z.”

1. Restate the claim exactly.
2. Locate the primary source if possible.
3. Check wording, translation, date, and context.
4. Compare secondary citations.
5. Verdict: verified, partly verified, misquoted, unsupported, false, or unverifiable.
6. Explain how the claim should be worded more carefully.

---

## Workflow H: Research Note / Repo Save

Use when saving research to a repo.

Recommended Bible research repo structure:

```text
research-repo/
  README.md
  inbox/
  sources/
    bible-texts/
    commentaries/
    papers/
    drive-exports/
    web/
  notes/
    bible/
      passages/
      topics/
      word-studies/
      theological-questions/
      comparative-views/
  sermons/
  bible-studies/
  bibliographies/
  templates/
  .research/metadata/
```

Recommended note frontmatter:

```yaml
title:
type: passage-study | topical-study | word-study | theology | sermon | source-check
passage:
topic:
tradition_scope: general | reformed | catholic | orthodox | jewish | academic | other
status: draft | reviewed | published
created:
updated:
sources:
confidence: low | medium | high
```

---

## Google Drive Integration Boundary

Direct Google Drive access is an integration, not a Bible-research method.

Recommended design:

- Use a Git research repo as canonical source of truth.
- Use Google Drive as an import/export and collaboration surface.
- Store Google Docs exports as Markdown, DOCX, or PDF in the repo when appropriate.
- Keep raw Drive IDs and metadata in `.research/metadata/`, not in note prose unless useful.
- Never store OAuth refresh tokens, client secrets, service account keys, or cookies in the repo.

For write/edit/delete Drive capability, require:

1. Explicit OAuth setup outside the repo.
2. Least-privilege scopes where possible.
3. Trash-first deletion, never hard delete by default.
4. Dry-run for bulk changes.
5. Audit log for created/edited/deleted files.
6. Human confirmation for delete, move, folder-wide edits, or permission changes.
7. Export-before-overwrite for Google Docs edits when feasible.

Recommended Drive operations:

```text
IMPORT: Drive Doc/PDF → repo source file + metadata
EXPORT: repo Markdown/report → Google Doc
SYNC: compare repo note and Drive doc, show diff, ask before overwrite
CREATE: create Doc from template
EDIT: patch known Doc section after diff confirmation
DELETE: move to trash only after explicit confirmation
```

Do not assume Drive access exists unless a configured tool proves it.

---

## Natural Language Routing Table

| User says | Workflow |
|---|---|
| "Explain this passage" | A |
| "Study Romans 8" | A |
| "What does the Bible say about X?" | B or D |
| "Do a word study on agape" | C |
| "What does the Greek mean here?" | C |
| "Compare views on baptism" | E |
| "Prepare a Bible study" | F |
| "Make a sermon outline" | F |
| "Verify this quote/commentary claim" | G |
| "Save this to my research repo" | H |
| "Export this to Google Drive" | H plus Drive integration boundary |
```

---

## Installation Steps When Write Policy Allows `ai/skills/**`

1. Create `ai/skills/custom/bible-research/SKILL.md` from the source block above.
2. Add `bible-research` to `docs/skills/profiles/research.txt`.
3. Update `docs/skills/skill-index.md` under Research Profile.
4. Keep `bible-research` out of `docs/skills/profiles/default.txt` unless it becomes a frequent always-on skill.
5. Run research profile dry-run and sync checks.
