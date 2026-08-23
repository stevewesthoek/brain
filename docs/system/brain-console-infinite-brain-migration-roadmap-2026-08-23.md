# Brain Console Infinite Brain Migration Roadmap

## Phase A — Connect existing Console to projections

**Scope:** Add shared Zod schemas and TanStack Query read hooks for the existing projection-envelope routes. Start with review, intelligence, evolution, promotion, transactions, and receipts; add system projections where useful. Preserve current status and approval routes during migration.

**Dependencies:** Brain Core projection contracts P3.25.3C/P3.25.3D; existing client and schema conventions.

**Risks:** envelope/data-shape drift, stale-versus-empty misrendering, duplicated polling, and accidental coupling of read projections to mutation controls.

**Validation:** Console typecheck/build; schema fixtures for available, empty, stale, invalid, and unavailable envelopes; browser read-only smoke checks; no POST calls from projection hooks.

## Phase B — Replace stale direct integrations

**Scope:** Move Infinite Brain display reads from legacy status/report routes to projection-backed reads where parity is proven. Keep existing approval and transaction mutation routes unchanged until a separate authorization review.

**Dependencies:** Phase A parity evidence and explicit route-by-route compatibility mapping.

**Risks:** loss of fields currently supplied by legacy routes; accidental removal of operator context; overloading the projection with UI-specific semantics.

**Validation:** response parity fixtures, regression tests for existing proposal review, stale/error behavior, and Brain Core contract validation.

## Phase C — Add Infinite Brain operational views

**Scope:** Add bounded Console views for review inbox, intelligence, lifecycle, promotion, transaction readiness, and receipts using existing cards/tables/tabs. No new dashboard backend or decision controls.

**Dependencies:** Phase A projection consumption and Phase B read parity where applicable.

**Risks:** turning report-only findings into implied priorities; visual overload; duplicating the Obsidian Decision Center.

**Validation:** component tests, responsive/manual QA, explicit authority/freshness rendering, and proof that all actions remain Brain Core approval routes.

## Phase D — Evaluate advanced dashboards

**Scope:** Only after evidence from actual use, assess filtering, trend charts, relationship views, and cross-projection operational summaries. This is an evaluation gate, not authorization to build predictive intelligence or a second cockpit.

**Dependencies:** real usage evidence, performance measurements, operator feedback, and an explicit owner decision.

**Risks:** dashboard sprawl, new client-side authority, data duplication, and misleading aggregate scores.

**Validation:** bounded design review, performance/accessibility review, provenance tests, and explicit acceptance of any new aggregation contract.

## Recommended next implementation packet

**MRU0-P3.25.4B — Brain Console projection-envelope compatibility layer.** Add only shared schemas, read hooks, and fixture tests for the new Brain Core projection endpoints. Do not add pages, dashboards, mutation controls, or Brain Core changes in that packet.
