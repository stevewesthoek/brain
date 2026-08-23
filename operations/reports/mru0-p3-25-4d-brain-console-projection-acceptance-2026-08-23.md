# MRU0-P3.25.4D Brain Console Projection Integration Acceptance

**Status:** IMPLEMENTED / VALIDATED LOCALLY

## Integrated surface

Brain Console now consumes the existing Brain Core projection layer through the existing Zod-validated `brainCoreRequest` client. The new read-only overview displays:

- system health, topology, services, and contracts;
- ingestion, review, intelligence, calibration, and learning;
- evolution, promotion, transactions, and receipts.

Each card reports loading, freshness, or unavailable state. Requests refresh every 30 seconds and use a bounded five-second timeout. Invalid response envelopes are rejected by schema validation and shown as unavailable.

## Authority and safety

Brain Core remains the sole projection authority. Console adds no database, mutation API, approval control, scheduler, provider call, or autonomous action. The UI is an operational visibility surface only; decisions, writes, and execution remain outside Console authority.

## Validation

- Brain Console typecheck: PASS
- Brain Console production build: PASS
- Brain Core compiled projection tests: PASS (51 focused tests)
- Brain Core projection envelopes: validated through the existing contract schema
- Existing unrelated dirty files and Video Orchestrator worktree: untouched

Live browser rendering requires the normal local runtime ownership precondition: Brain Core must be available on 4877 and Brain Console on 4881. The prior runtime packet records intermittent stale-listener/loader instability on 4877; isolated compiled-port checks are the reliable validation method until that local process ownership issue is cleared.
