# MRU0-P3.30 Infinite Brain Roadmap Decision

**Status:** planning decision complete
**Date:** 2026-08-24
**Scope:** evidence-based prioritization only; no implementation authorization

## Current operational state

The completed P3 chain provides a usable, human-controlled review loop:

```text
Mind inbox/new
  -> ingestion envelope
  -> unified review projection
  -> intelligence briefing
  -> explicit human review workflow
  -> promotion candidate
  -> separate approval and receipt boundary
  -> daily intelligence, calibration, readiness, and learning views
  -> Brain Core projections / read-only Console visibility
```

### Works and is actively usable

- Markdown and plain-text Mind inbox ingestion is deterministic and report-only.
- Provenance, source hashes, authority, freshness, confidence, uncertainty, and evidence references survive the review projection.
- The unified review layer combines the existing evidence producers without creating a second authority or store.
- Human review states and history are explicit and fail closed on missing reasons, mismatched sources, and duplicate identities.
- Accepted evidence can produce a promotion candidate, but promotion remains separately approved and receipt-gated.
- The daily review entrypoint, batch decision support, daily loop, calibration, readiness, and Brain Core projections are operator-usable.
- Brain Console exposes read-only projection health and a review-queue summary.

### Current limitations

- Review decisions remain human and explicit by design.
- The CLI still exposes source paths and hashes rather than a bounded source-content preview.
- Batch decisions require a prepared JSON file rather than an interactive form.
- The web Console is an optional specialist surface; the Obsidian cockpit remains the primary human cockpit.
- Runtime-local artifacts are projections, not canonical Mind or Brain knowledge.
- No scheduler or automatic source discovery is active.

## Evidence synthesis

The decision uses P3.26 real usage, P3.27 workflow optimization, P3.28 real human review, and P3.29 cockpit refinement evidence.

| Evidence | Finding | Priority meaning |
|---|---|---|
| P3.26-F1/F4 | A real queue of 11 items initially had no operator decision session | The human boundary works; ergonomics need bounded support |
| P3.26-F2 | Provenance calibration initially reported 11 missing items | Resolved in P3.27; do not reopen as a new capability |
| P3.26-F3 | Multiple manual commands were required | Resolved by the daily entrypoint and P3.29 batch decisions |
| P3.28 cycle | Five decisions were completed, six remained pending | The workflow is usable with real decisions |
| P3.28 friction | Source content was referenced, not rendered inline | Highest remaining repeated inspection cost |
| P3.29 result | Queue counts and batch decisions improved operation | Continue bounded ergonomics before adding new producers |

The evidence does not demonstrate demand for GitHub intelligence, richer media, video understanding, or a merged Video Orchestrator. Those remain deferred.

## Candidate assessment

### A. GitHub repository intelligence — deferred

- **Value:** potentially useful for bounded architecture and maintenance reports.
- **Evidence:** no measured usage demand in P3.26–P3.29.
- **Dependencies:** explicit source authorization, revision capture, license/security handling, bounded scan policy, and review-only output.
- **Risks:** unbounded scans, secrets, supply-chain exposure, duplicate code-index authority, and scope expansion.
- **Activation:** reconsider only after a concrete repository-analysis need is recorded.

### B. Conversation evidence expansion — later, not next

- **Value:** may capture decisions, assumptions, and lessons currently lost between sessions.
- **Evidence:** P3.16 establishes a safe foundation, but no real usage window demonstrates recurring loss or source demand.
- **Dependencies:** explicit session selection/export, privacy and retention review, watermark/idempotency, and review-only normalization.
- **Risks:** transcript accumulation, sensitive-content leakage, false attribution, and parallel memory storage.
- **Activation:** require a bounded real-use demand case and owner-approved source format first. CLR5 remains separately unauthorized.

### C. Richer document/media ingestion — deferred

- **Value:** DOCX/XLSX/images/video could broaden capture coverage.
- **Evidence:** the observed workload was 11 Markdown items; no format gap was measured.
- **Dependencies:** source-specific extraction, size/privacy limits, provenance, copyright, and human review.
- **Risks:** extraction error, OCR/multimodal hallucination, cost, and unnecessary ingestion complexity.
- **Activation:** add one format only after real source demand and a bounded adapter plan.

### D. Brain Console expansion — narrow follow-up only

- **Value:** visibility is useful, and P3.29 already closed the highest evidence-backed queue-summary gap.
- **Evidence:** remaining friction is source inspection, not missing dashboard breadth. The Console integration matrix explicitly keeps review read-only and decisions separate.
- **Dependencies:** existing Brain Core projection contracts and primary Obsidian cockpit boundary.
- **Risks:** duplicating Decision Center behavior, adding mutation controls, and turning the optional web Console into a second cockpit.
- **Activation:** one read-only evidence-preview slice may be justified; broader Console expansion is deferred.

### E. Video Orchestrator — separate/deferred

- **Value:** operationally distinct media workflow value may exist.
- **Evidence:** no P3 usage evidence connects it to the Infinite Brain review queue.
- **Dependencies:** its own architecture, provider, credential, execution, and acceptance boundaries.
- **Risks:** cross-product coupling, authority confusion, execution expansion, and merging unrelated work.
- **Activation:** keep isolated; do not merge as part of Infinite Brain prioritization.

## Prioritized roadmap

### Immediate next phase: MRU0-P3.31 — Bounded Review Evidence Preview

Purpose: reduce the remaining repeated inspection step by showing a bounded, source-linked preview through the existing daily-review/Brain Core projection surfaces.

Scope for a future implementation packet:

- read-only preview only;
- existing source references and hashes remain authoritative;
- explicit allowlisted local source roots;
- bounded size and line/character limits;
- privacy classification and fail-closed unavailable/oversized states;
- provenance and source hash displayed with every preview;
- no preview persistence beyond existing runtime-local projection artifacts;
- no decision, promotion, or canonical write controls.

Acceptance should prove deterministic preview behavior, source/hash matching, bounded output, unavailable-source handling, secret/privacy guardrails, no canonical mutation, and unchanged review regressions.

This is the next implementation goal, but it requires a separate explicit implementation authorization.

### Later phases

1. **P3.32 evidence-format demand review:** measure whether real sessions demonstrate a DOCX, XLSX, image, video, GitHub, or conversation gap before building an adapter.
2. **P3.33 selected-source adapter:** implement exactly one evidence producer only after P3.32 identifies demand and its privacy/authority contract is approved.
3. **P3.34 repeated-cycle reassessment:** review at least another bounded set of real human review sessions before considering broader Console or workflow changes.

### Deferred ideas

- automatic decisions or promotion;
- scheduling and autonomous maintenance;
- GitHub intelligence without a measured use case;
- broad conversation scanning or transcript storage;
- multimodal/video expansion without source demand;
- Video Orchestrator merge;
- a second queue, database, authority, or Decision Center.

## Recommendation

Choose the existing review loop's narrow next usability improvement: **authorize planning/implementation of MRU0-P3.31 bounded review evidence preview**. Do not start GitHub, conversation expansion, richer media, or Video Orchestrator work from the current evidence.

## Safety boundary

This report changes no runtime behavior and authorizes no implementation, scheduling, provider call, canonical Mind/Brain write, automatic decision, automatic promotion, or execution authority.
