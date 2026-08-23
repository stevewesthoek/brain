# MRU0-P3.10 — Universal Information Ingestion Architecture Blueprint

**Date:** 2026-08-23
**Status:** architecture/planning only
**Runtime effect:** none

## Purpose

This blueprint defines one future ingestion architecture for Infinite Brain. It does not implement pipelines, add watchers or databases, activate automation, or grant automatic memory-promotion authority.

The shared model is:

```text
external input
→ capture
→ recognition
→ normalization
→ evidence creation
→ understanding
→ human review
→ optional Brain/Mind promotion
```

Every source type uses the same lifecycle and provenance model. Source-specific adapters may differ in extraction, but they must not create independent memory stores or promotion authorities.

## Authority model

### Mind owns

- meaning and interpretation;
- human priorities and importance;
- personal and business knowledge;
- strategic context and intent;
- durable memories and human-facing conclusions.

### Brain owns

- capture orchestration and source recognition;
- technical extraction and normalization;
- operational analysis and validation;
- tooling, adapters, reports, receipts, and bounded automation;
- technical knowledge about AI systems and infrastructure.

### Evidence remains evidence

Raw captures, source files, transcripts, extracted text, metadata, analysis results, and validation receipts are evidence or derived projections. They do not become canonical Mind or Brain knowledge merely because processing succeeded.

Durable promotion requires a human decision through the existing review/approval surfaces. No future ingestion adapter may silently promote content.

## Common ingestion contract

Every future adapter should produce a provider-neutral ingestion record containing:

- stable intake identifier;
- source kind and source locator;
- source revision or content hash;
- captured timestamp;
- media/content type and size where known;
- privacy classification;
- authority domain (`Mind`, `Brain`, or external/source authority);
- raw evidence reference;
- normalized derivative references;
- extraction status and failure reason;
- provenance and relationship references;
- freshness state;
- confidence and uncertainty;
- Mind-impact indicator;
- review state;
- proposed destinations, never implicit destinations;
- validation and receipt references.

The contract is a projection over existing Brain/Mind sources and reports. It is not authorization to create a new database or queue.

## Future input capability matrix

| Input class | Status | Recognition | Extraction/understanding | Normalization target | Review and risks |
|---|---|---|---|---|---|
| Markdown | ACTIVE | extension/content inspection | headings, links, frontmatter, body | source-preserving Markdown plus metadata | human review for meaning, links, and target authority |
| Plain text | PARTIAL | MIME/extension/content inspection | text and encoding validation | source-preserving text or Markdown derivative | encoding loss, unbounded size, accidental secrets |
| PDF | FUTURE | MIME/signature and page metadata | text, layout, tables, OCR where needed | provenance-linked structured Markdown plus page references | OCR errors, embedded secrets, copyright, missing visual context |
| DOCX | FUTURE | MIME/signature and package inspection | paragraphs, tables, headings, embedded media metadata | structured Markdown with source and section references | hidden comments, tracked changes, embedded files |
| XLSX | FUTURE | MIME/signature and workbook inspection | workbook/sheet/range extraction, formulas, types | structured tabular evidence with sheet/range provenance | formulas versus values, PII, large workbooks |
| Images | FUTURE | MIME/signature and image metadata | OCR, captions, objects, visual context when approved | image evidence plus structured observation/proposal | hallucinated interpretation, faces/PII, sensitive media |
| Audio | PARTIAL | MIME/container metadata | transcription and timestamps where an approved adapter exists | raw audio plus timestamped transcript | speaker/consent/privacy, transcription error |
| Video | PARTIAL | MIME/container metadata | audio transcription, visual/scene analysis, time ranges | raw video plus transcript and timestamped scene/context evidence | high cost, privacy, missing context, multimodal uncertainty |
| URL | PARTIAL | URL validation and source fetch policy | page metadata/content extraction only when authorized | fetched source snapshot with URL, timestamp, and hash | mutable pages, network failure, prompt injection, copyright |
| YouTube link | PARTIAL | URL/platform recognition | metadata/transcript/media acquisition only through an approved workflow | source record plus timestamped derivatives | terms/access, mutable content, media size, privacy |
| GitHub repository link | FUTURE | URL/repository identity and revision | metadata, architecture/dependency analysis, maintenance and similarity analysis | bounded repository evidence report with revision | supply-chain risk, licenses, secrets, unbounded scans |
| AI conversation/session | FUTURE | environment/session metadata and explicit consent | important moments, decisions, lessons, assumptions, candidate memories | evidence-linked review proposal; never raw transcript dump | sensitive content, context loss, false attribution, retention |

Status meanings: **ACTIVE** means an existing path is documented and operational for the limited scope stated; **PARTIAL** means a source-specific or report-only capability exists but not the universal contract; **FUTURE** means design/implementation is still required.

## Normalization patterns

### Documents

```text
source file
→ type/signature validation
→ text/structure/metadata extraction
→ source-linked structured Markdown
→ evidence review
```

Page, section, sheet, range, formula, and embedded-object references must remain attached to derivatives. Extracted text must never replace the raw source.

### Media

```text
media source
→ container/metadata validation
→ transcript with time ranges
→ visual/scene/context observations where supported
→ structured evidence report
→ human review
```

Transcription, visual understanding, and multimodal analysis are separate evidence-producing steps. A transcript alone is not proof of visual content, and an analysis result is not canonical knowledge.

### GitHub repositories

```text
repository URL/revision
→ identity and revision capture
→ bounded metadata and license review
→ architecture/dependency analysis
→ maintenance/security assessment
→ similarity with existing Brain capabilities
→ recommendation
→ human review
```

Repository reverse-analysis tools may be useful as bounded Brain adapters, but they should remain report-producing tools behind the same provenance and review contract. They must not become a second code index, autonomous adoption mechanism, or provider-specific authority.

### Conversations and sessions

```text
explicitly selected session
→ source/revision/privacy check
→ important moments and decision candidates
→ lessons/assumptions/blockers
→ evidence-linked proposal
→ human review
```

The future design covers Codex CLI, Codex App exports, Claude Code sessions, and other environments through adapters. It must not scan all local sessions by default, dump raw transcripts into Mind, or promote candidate memories automatically.

## Review pipeline

The future review projection should reuse existing locations and authorities:

```text
Mind inbox/new or approved raw source
→ Brain processing report
→ Mind inbox/processed proposal/receipt surface
→ human review queue
→ decision/approval
→ bounded transaction
→ validation receipt
→ optional exact-path Mind or Brain update
```

Existing `inbox/failed/` remains the failure surface. Existing reports, receipts, Decision Core proposals, authority registry, freshness systems, relation indexes, Context Broker, and session continuity contracts remain the system of record for their respective concerns. A future review UI may be a derived view, not another store.

Human review must answer:

- Is the source authentic and sufficiently fresh?
- Is the extraction faithful to the source?
- Is the proposed interpretation evidence-backed?
- Does the material affect Mind meaning/priorities or Brain operational truth?
- What exact destination, if any, is authorized?
- What rollback and validation evidence are required?

## Proposed lifecycle states

The lifecycle is a state transition across existing systems, not a new stored “evolution” entity:

```text
captured
→ recognized
→ normalized
→ evidenced
→ understood
→ review_required
→ approved | rejected | deferred | failed
→ bounded_applied
→ validated
```

`bounded_applied` is only reachable after explicit authority and approval. `validated` records evidence of the bounded change; it does not grant future authority.

## Roadmap and implementation order

### P3.10.1 — Canonical ingestion envelope

**Purpose:** define schema, provenance, privacy, freshness, failure, and review contracts over existing sources.
**Not included:** adapters, watchers, queues, databases, or runtime activation.
**Dependencies:** authority registry, evidence/receipt contracts, freshness and relation indexes.
**Acceptance:** contract is provider-neutral, source-linked, fail-closed, and does not duplicate canonical content.

### P3.10.2 — Adapter coverage and recognition matrix

**Purpose:** specify bounded recognition/extraction support for documents, media, URLs, repositories, and sessions.
**Not included:** enabling unsupported formats or adding a universal processor.
**Dependencies:** P3.10.1 and existing source-specific workflows.
**Acceptance:** each adapter has explicit status, limits, privacy rules, failure routing, and review output.

### P3.10.3 — Review projection

**Purpose:** derive one read-only review view from existing inbox, reports, proposals, receipts, and decisions.
**Not included:** a second queue/store or automatic promotion.
**Dependencies:** existing Mind review surfaces and Decision Core contracts.
**Acceptance:** every item has provenance, proposed destination, authority owner, and review state.

### P3.10.4 — Opt-in conversation evidence extraction

**Purpose:** design and later implement explicit, privacy-preserving extraction for selected Claude/Codex/other sessions.
**Not included:** ambient scanning, raw transcript retention, or autonomous memory writes.
**Dependencies:** session continuity, privacy/retention policy, P3.10.1, review projection.
**Acceptance:** selected sessions produce review-only, source-linked proposals with no automatic promotion.

### P3.10.5 — Bounded approved promotion

**Purpose:** extend existing approval/receipt mechanisms to selected ingestion classes.
**Not included:** unrestricted Mind writes, autonomous Brain policy changes, or bulk promotion.
**Dependencies:** validated adapter evidence and human review.
**Acceptance:** exact-path approval, idempotency, rollback, validation receipt, and unchanged authority boundaries.

### P3.10.6 — Optional controlled activation

**Purpose:** activate only specifically accepted adapters under explicit flags and bounded schedules.
**Not included:** always-on watchers, unbounded concurrency, or provider expansion.
**Dependencies:** all previous packets and owner authorization.
**Acceptance:** dry-run evidence, failure routing, privacy checks, resource limits, and no unauthorized durable writes.

## Activation points

No activation occurs in P3.10 itself. Future activation requires separate authorization after:

1. contract and schema validation;
2. source-specific fixture tests;
3. privacy and secret scanning;
4. failure and rollback tests;
5. human-review walkthrough;
6. dry-run evidence;
7. explicit owner approval for the exact adapter and write scope.

## Dependencies and risks

- Existing Mind folder and review contracts are the canonical destination boundary.
- Brain evidence, receipts, Decision Core, authority, freshness, relations, Context Broker, and session continuity must be reused rather than cloned.
- External systems such as n8n, GitHub, media providers, and local session stores are availability and privacy dependencies.
- Document and media extraction can create false confidence; source references and uncertainty are mandatory.
- Repository analysis can expose secrets or licenses; scans must be bounded and read-only by default.
- Conversation extraction risks privacy leakage and loss of context; explicit selection and retention are prerequisites.
- Automatic promotion would be an authority regression and is explicitly excluded.

## Definition of done for this blueprint

- One shared lifecycle is defined for all listed input classes.
- Input-specific recognition and extraction needs are identified without implementing them.
- Mind, Brain, evidence, review, and promotion authority boundaries are explicit.
- GitHub repositories and AI sessions are included as future classes.
- Existing inbox/review/receipt systems are reused conceptually.
- No watcher, processor, database, queue, adapter, or runtime behavior was added.
- Future activation points and acceptance gates are explicit.

## Final recommendation

Proceed next with **P3.10.1 — Canonical ingestion envelope** as a specification/validation packet. Do not begin source adapters or activation until the envelope, provenance, privacy, failure, review, and authority contracts are accepted.
