# Infinite Brain Ingestion Envelope v1

## Status and purpose

This contract is a provider-neutral evidence-preparation envelope. It gives future Markdown, document, media, URL, repository, session, and Workbench adapters one shared shape without creating a new inbox, database, memory system, or ingestion authority.

The envelope is not canonical memory. It carries references to source and derived evidence, provenance, uncertainty, governance, freshness, and review state. Existing Mind and Brain sources remain authoritative.

## Authority boundary

- Mind owns meaning, identity, priorities, and strategic relevance.
- Brain owns processing, extraction, validation, tooling, and operational analysis.
- External sources remain authoritative for their own source facts until evidence is reviewed.
- Evidence and derived analysis cannot establish durable Mind or Brain truth by themselves.
- Human approval through an existing bounded transaction is required for promotion.

The envelope is invalid when its authority context uses an unknown owner, domain, or authority reference. Unknown authority fails closed.

## Contract shape

The JSON Schema is [infinite-brain-ingestion-envelope-v1.schema.json](infinite-brain-ingestion-envelope-v1.schema.json).

Required sections:

- `identity`: stable ingestion ID, source type/reference, creation time, and source revision/hash.
- `provenance`: origin, capture method, adapter, capture timestamp, and authority context.
- `content`: detected format, references to extracted content, metadata, optional summary/entity/relationship references, confidence, and uncertainty.
- `governance`: Mind/Brain impact, privacy classification, freshness, mandatory review, and the human-approved bounded promotion authority.
- `evidence`: source and validation references, extraction confidence, and uncertainty.
- `lifecycle`: captured, normalized, ready for review, reviewed, promoted, rejected, or archived.

The contract permits `promoted` only when both review and promotion references exist. That records an already-approved transaction; it does not authorize one.

## Lifecycle

```text
captured
  → normalized
  → ready_for_review
  → reviewed
  → promoted | rejected | archived
```

Failures remain represented by existing failure/report surfaces; this envelope does not create a second failure store. An adapter may retain a captured or normalized envelope when extraction is incomplete, but it must preserve uncertainty and source references.

## Safety exclusions

The envelope must not contain:

- final memories or copied canonical knowledge;
- human priorities or automatic decisions;
- provider/model instructions or model settings;
- execution permissions or runtime authority;
- full conversations by default;
- secret values.

Session adapters may reference an explicitly selected session and derived evidence, but raw conversation storage and automatic memory promotion remain outside this contract.

## Relationship to existing contracts

- Mind folder and Brain/Mind bridge contracts define destination and authority meaning.
- Evidence and receipt contracts provide source/validation references.
- Freshness systems provide freshness state; `unknown` is valid but requires review.
- Relation indexes provide relationship references; they remain derived and rebuildable.
- Context Broker and session continuity provide bounded retrieval and session references.
- Existing proposal, Decision Core, approval, and receipt workflows own decisions and writes.

This envelope is a normalized projection across those systems, not a replacement for any of them.

## Validation policy

Every producer must validate the schema before publishing an envelope. Validators must reject:

1. unknown authority owners/domains;
2. missing source or validation provenance;
3. missing privacy or freshness state;
4. `review_required=false` or any promotion authority other than human-approved bounded transaction;
5. a promoted state without review and promotion evidence;
6. unsupported source types or lifecycle values;
7. additional fields that could smuggle execution or provider authority.

Validation is structural evidence only. It never promotes, writes, executes, or changes canonical Mind/Brain sources.
