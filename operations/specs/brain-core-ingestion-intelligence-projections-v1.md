# Brain Core Ingestion and Intelligence Projections v1

Brain Core exposes read-only projections over the existing Infinite Brain P3.17–P3.24 runtime-local artifacts. These endpoints are views, not new storage, authority, or decision systems.

## Endpoints

- `GET /projections/ingestion` — inbox classification evidence.
- `GET /projections/review` — unified review workflow state.
- `GET /projections/intelligence` — unified intelligence briefing.
- `GET /projections/calibration` — operational feedback calibration.
- `GET /projections/learning` — operational learning checkpoint.

Each response uses the existing `brain-core-projection-v1` envelope and reports source path, provenance, revision, freshness, confidence, uncertainty, and availability. Missing runtime-local artifacts are represented as `empty`; invalid JSON is `invalid`; artifacts older than the freshness window are `stale`.

## Authority and safety

The source artifacts remain authoritative for their own evidence. Brain Core only projects them. The projection layer does not write Mind, write Brain canonical state, promote memory, decide review outcomes, schedule work, or call providers. Every response is report-only and requires human review where the underlying workflow requires it. Mind remains authoritative for meaning, importance, priorities, and strategic decisions.

The projection layer does not change the existing P3.17–P3.24 workflows and does not expose provider-specific execution authority.

## Limitations

Runtime-local artifacts may be absent before their producer has run. Empty output is not evidence that no knowledge exists. Projection freshness is a bounded file-state signal, not a claim that every underlying source is current. Consumers must follow provenance references and the existing review/decision contracts before any mutation.
