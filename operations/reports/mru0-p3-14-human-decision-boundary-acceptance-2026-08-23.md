# MRU0-P3.14 — Human Decision Boundary Acceptance

**Date:** 2026-08-23
**Status:** accepted; preparation artifacts only

## Implemented workflow

The review projection now has an explicit, operator-invoked decision artifact boundary:

```text
needs_review
→ accepted | rejected | deferred | archived
```

Outcomes are evidence artifacts only:

| Decision | Bounded outcome |
|---|---|
| `accepted` | promotion candidate; no memory write |
| `rejected` | retained evidence with required reason |
| `deferred` | review-queue item with required reason |
| `archived` | traceable historical evidence with required reason |

Every artifact preserves source file, ingestion ID, and source hash. Invalid decisions and missing required reasons fail closed.

## Safety result

- Mind canonical files are not modified.
- Brain canonical knowledge is not modified.
- No automatic promotion occurs.
- No autonomous importance or priority inference occurs.
- No new database, inbox, memory system, or review authority is created.
- Decision artifacts are restricted to Brain runtime-local state.

## Validation

Passed:

- accepted candidate-only behavior;
- rejected/deferred/archived traceability;
- required reason enforcement;
- invalid decision rejection;
- provenance preservation;
- runtime-local output containment;
- no Mind/Brain canonical mutation;
- existing ingestion, envelope, validator, and review projection tests;
- Brain documentation consistency;
- `git diff --check`.

## Classification

### ACTIVE

- Explicit decision artifact creation.
- Candidate-only accepted outcome.
- Traceable rejected, deferred, and archived outcomes.
- Human approval boundary remains authoritative.

### PARTIAL

- Decision artifacts are not yet connected to a durable review queue or approval UI.
- Accepted candidates still require a separate exact-path approved transaction.

### ROADMAP

Reassess the next ingestion capability only after observing decision-artifact use. Candidate options remain PDF ingestion, conversation evidence extraction, or GitHub repository intelligence; none is activated by P3.14.

## Acceptance decision

MRU0-P3.14 is accepted as a bounded human decision and promotion-preparation layer. It does not authorize automatic memory promotion or canonical Mind/Brain updates.
