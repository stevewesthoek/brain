# MRU0-P2.5 Phase 0 — Observation Projection Acceptance

**Status:** complete / accepted as a read-only derived projection
**Date:** 2026-08-23
**Architecture checkpoint:** `f81f4da5c8d98e14bf34376fb37d8d878b616945`

## Scope

Phase 0 composes existing Infinite Brain authority, evidence, freshness, relation, and receipt concepts into a normalized observation view.

The projection is:

- derived;
- rebuildable;
- deterministic;
- idempotent;
- non-authoritative;
- provenance-driven;
- read-only.

It does not create a database, queue, memory layer, authority layer, decision system, or knowledge graph.

## Implementation

Added:

- `operations/specs/context-learning/observation-projection-v1.schema.json`
- `tools/context-learning/observation-projection.mjs`
- `tools/context-learning/observation-projection.test.mjs`
- `operations/fixtures/context-learning-observation-fixtures-v1.json`

The implementation reuses:

- `authority-registry.v1.json` for owner and canonical classification;
- `context-learning-core.mjs` for stable hashing and freshness evaluation;
- existing evidence and relationship reference conventions;
- existing privacy classes and freshness states.

## Observation contract

Each observation references:

- source kind and source reference;
- authority kind and resolved owner;
- canonical flag derived from the authority registry;
- observed timestamp;
- source revision;
- evidence references;
- relationship references;
- freshness;
- confidence;
- privacy class;
- Mind-impact state;
- deterministic fingerprint and observation ID.

Unknown authority fails closed. Missing freshness resolves to `unknown`. Raw content and secret-bearing payload keys are rejected. Mind impact is a review signal and never a write instruction.

## Mind/Brain boundary

Mind remains authoritative for meaning, importance, priorities, strategy, and human context.

Brain remains authoritative for operational truth, policies, capabilities, execution boundaries, and validation.

Mind context is referenced only through bounded metadata and source references. The projection does not copy Mind content or promote observations into canonical truth.

## Validation evidence

Passed:

- observation schema parse and schema-valid fixture projection;
- authority ownership and unknown-authority rejection;
- freshness, review-due, stale, and unknown behavior;
- Mind-impact classification;
- provenance completeness;
- relationship reference preservation;
- deterministic fingerprint and idempotency checks;
- no input mutation and no-write assertions;
- raw-content and secret-payload rejection;
- `npm run validate:context-learning-contracts`;
- `npm run test:context-learning` — 6/6;
- `npm run validate:context-learning-broker`;
- `npm run test:context-broker` — 11/11;
- documentation consistency validation;
- `git diff --check`;
- provider/model vocabulary scan of implementation and fixtures.

No provider calls, external runtime calls, canonical Brain/Mind writes, conversation ingestion, automatic proposal, session takeover, or predictive behavior occurred.

## Architecture compliance

- no new authority layer;
- no new database;
- no new queue;
- no shadow decision system;
- no parallel knowledge graph;
- Mind boundary preserved;
- Brain boundary preserved;
- existing CLR contracts reused;
- observation remains a derived projection only.

## Remaining boundary

Phase 0 does not perform maintenance analysis, generate proposals, approve changes, execute transactions, or update canonical sources.

Those actions require separate bounded packets and existing Decision Core and transaction gates.
