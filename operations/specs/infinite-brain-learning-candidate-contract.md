# CLR6 Learning Candidate Contract v1

CLR6 converts normalized CLR5 evidence into bounded, report-only learning
candidates and derived relationship observations. It does not promote a
candidate, write Mind or Brain canonical content, mutate IKHP, or call a
semantic provider.

## Candidate identity and aggregation

Candidate identity is deterministic: an explicit `candidate_key` or
`claim_key` is preferred; otherwise the category, normalized subject, and
normalized proposition form the identity. Exact replay merges by evidence
reference. Similar wording without the same normalized proposition does not
fuzzy-merge. Candidate records retain support and contradiction references,
source classes, source diversity, observation range, freshness, and an
explainable lifecycle state.

Human statements, tool/runtime observations, assistant statements, and
inferences remain distinct provenance classes. No opaque confidence score is
invented. Existing canonical knowledge is compared read-only as
`new_candidate`, `supports_existing`, or `contradicts_existing`; contradiction
creates a review-ready candidate and never silently overwrites the canonical
item.

## Relations

Explicit relation evidence retains relation type, subject/object references,
support and contradiction counts, independent-source count, inference level,
freshness, and provenance. Co-occurrence is a separate weak relation class;
repetition alone cannot turn it into a strengthened relation. Infrastructure
relations route to `ikhp:evidence-candidate` only as evidence. CLR6 never
creates or mutates an IKHP catalog/state record.

## Compaction and source lifecycle

Candidate and relation evidence references are bounded during compaction while
support counts, contradiction counts, provenance, time range, and a compaction
receipt remain. Resolved or superseded material is eligible for derived-layer
compaction, not canonical/history deletion. Source deletion or retraction
removes active support from the aggregate but retains the retraction reference.
Replay is idempotent across restart and watermark reprocessing.

The implementation reuses the personal-local retention classes:
`evidence-ledger`, `learning-candidate-queue`, `relation-index`, and
`context-pack-cache`. It does not add a second authority store.

## Review and privacy boundary

Candidates are review artifacts. Human review and the existing audited
Apply-one/promotion boundary remain required before canonical persistence.
Upstream CLR5 redaction is preserved; CLR6 accepts only the redacted bounded
statement and never reconstructs secret-bearing material or stores raw
transcripts.

Implementation: `tools/context-learning/learning-candidate-engine.mjs`.
Schema: `operations/specs/infinite-brain-learning-candidate.v1.schema.json`.
