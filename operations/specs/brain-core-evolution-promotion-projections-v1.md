# Brain Core Evolution and Promotion Projections v1

Brain Core exposes read-only projections over existing Infinite Brain review, decision, promotion, transaction, validation, and receipt artifacts. These endpoints do not create a new store or authority.

## Endpoints

- `GET /projections/evolution` — combined workflow, proposal, approval, transaction-readiness, calibration, and learning state.
- `GET /projections/promotion` — controlled promotion artifacts and review state.
- `GET /projections/transactions` — prepared plans, readiness reports, dry-run state, and write manifests.
- `GET /projections/receipts` — verification, dry-run, write, and promotion receipt references.

Each response uses the existing `brain-core-projection-v1` envelope. Runtime-local artifacts remain the evidence sources; Brain Core reports their provenance, revision, freshness, availability, and uncertainty without treating projections as canonical decisions.

## Authority and safety

Human approval remains the decision boundary. Brain Core does not approve, reject, promote, execute, schedule, or write Mind or Brain canonical state. `promoted` or `approved_for_promotion` states are reported as existing artifact state; they are not created by these endpoints. Missing requirements, stale evidence, rollback references, and validation state remain visible to consumers.

Mind owns meaning, importance, priorities, and strategic decisions. Brain owns evidence handling, workflow validation, and operational projections. Provider calls and mutation authority are outside this projection surface.

## Limitations

Runtime-local artifacts may be absent, stale, or invalid. Empty projections do not prove that no proposals or receipts exist outside the listed artifact paths. Consumers must follow the source references and existing approval/transaction contracts before any change is considered.
