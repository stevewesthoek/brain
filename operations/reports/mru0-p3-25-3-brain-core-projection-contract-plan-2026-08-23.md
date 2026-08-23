# MRU0-P3.25.3 — Brain Core Projection-Contract Plan

**Date:** 2026-08-23
**Status:** Planning only
**Decision:** Define read-only projection contracts before any new cockpit UI

## Purpose

This plan defines how existing Infinite Brain capabilities become safely consumable
through Brain Core. It does not implement routes, change Brain Console, create a
database, or activate automation.

The target boundary is:

```text
canonical Brain/Mind sources and derived runtime artifacts
                         |
                         v
              Brain Core projection adapters
                         |
                         v
       Obsidian | Brain Console | agents | Workbench
```

Clients consume typed projections. They do not read runtime files, infer authority,
or write canonical state directly.

## Authority model

Mind remains authoritative for meaning, importance, priorities, and strategic human
context. Brain remains authoritative for operational policies, evidence handling,
validation, workflow state, and execution boundaries. Brain Core is an API/control/
safety boundary, not a new knowledge authority.

Each projection must declare:

- `authority`: the canonical owner and source domain;
- `sourceRefs`: references to source artifacts, reports, or contracts;
- `generatedAt` and `sourceRevision`;
- `freshness`: `fresh | stale | unavailable | not_instrumented`;
- `confidence` where the source provides it;
- `status`: projection-specific health state;
- `warnings` and structured `errors`;
- `readOnly`, `writesToMind`, and `executionEnabled` safety fields where relevant.

Projection data is derived and rebuildable. It must never silently promote a
proposal, rewrite Mind, or become a replacement for the source artifact.

## Current Brain Core assessment

### Route families already present

Brain Core currently exposes route families for:

- `/status`, `/capabilities`, `/sessions`, `/skills`, `/repos`, `/orchestrators`,
  `/projects`, and `/platforms`;
- `/runtime/reports`, `/scheduler/*`, `/execution/*`, `/approvals/*`, and
  `/actions/*`;
- `/infinite-brain/status` and the existing proposal, decision, approval,
  application-plan, execution-readiness, dry-run, metadata-validation, write-manifest,
  and post-write-verification views;
- `/local-apps/*` and `/infra/*` infrastructure projections;
- `/ops/*` operational metrics and AI usage/cost projections;
- `/ai-model-selector/*` selector health projections;
- read-only Video Orchestrator planning/status and readiness routes.

The route implementation is a local Node HTTP server with explicit method/path
dispatch, adapter modules, JSON responses, redaction support, and localhost
containment checks. Existing response shapes are useful but heterogeneous: some use
`id/generatedAt/status/data`, some use domain-specific fields, and older routes use
placeholder or report-backed responses.

### Current data sources

Adapters read bounded combinations of:

- canonical Brain specifications and catalogs;
- report-only files under `runtime/local/**`;
- approval, receipt, and runtime report stores;
- infrastructure catalog and provider-normalized observations;
- local configuration and explicitly permitted provider status calls;
- deterministic fixtures for planning-only surfaces.

The source remains outside the client. Runtime-local files are disposable derived
state, not canonical Brain or Mind truth.

### Current security boundary

Brain Core binds to localhost by default and rejects non-local requests for protected
operations. High-impact mutation routes are separately contained and approval-aware;
many current actions are scaffolding that return `executed: false`. Responses use
redaction helpers and must not expose credentials. The current service does not yet
have an authenticated service identity, so loopback and browser-origin checks are
containment, not general authorization.

### Current limitations

- No single versioned projection envelope is enforced across all routes.
- Freshness and provenance are not uniform across legacy and newer adapters.
- Some routes perform provider-backed reads with uneven latency and may return
  unavailable/placeholder state.
- The large route dispatcher makes contract discovery and route ownership harder.
- P3.17–P3.24 artifacts exist, but they are not yet exposed through one canonical
  read-only projection family for all clients.
- There is no general pagination/filter contract for growing review or evidence sets.

## Projection responsibilities

An adapter may:

1. locate the already-authoritative source or accepted derived artifact;
2. validate its schema and revision;
3. normalize it into a stable read projection;
4. attach provenance, freshness, confidence, and safety metadata;
5. return a structured unavailable/stale/error result without inventing data.

An adapter must not:

- create a competing store;
- infer Mind importance or strategic priority;
- promote or reject a proposal;
- mutate canonical Brain or Mind state in a GET path;
- invoke execution, remediation, scheduling, or provider mutation;
- expose secrets or raw credential material.

## Canonical projection envelope

The first contract packet should standardize this conceptual envelope:

```json
{
  "contract": "brain-core-projection-v1",
  "projection": "example",
  "status": "ok",
  "generatedAt": "2026-08-23T00:00:00.000Z",
  "sourceRevision": "source-revision-or-null",
  "freshness": "fresh",
  "authority": {
    "owner": "brain",
    "sourceRefs": ["operations/reports/example.json"]
  },
  "confidence": "verified",
  "data": {},
  "warnings": [],
  "errors": [],
  "safety": {
    "readOnly": true,
    "writesToMind": false,
    "executionEnabled": false
  }
}
```

`data` remains projection-specific. `errors` are structured and non-secret. Empty
data is valid when `status` explains `empty`, `unavailable`, or `not_instrumented`.
Clients must render those states rather than treating an empty array as proof that
nothing exists.

## First read-only projection contracts

### 1. System health and readiness

Proposed logical projection: `system-health`.

It should aggregate existing `/status`, `/capabilities`, runtime readiness, and
component freshness without replacing their source authority.

Required data:

- Brain Core version and bind mode;
- capability availability and contract revision;
- component health/freshness;
- readiness blockers and warnings;
- safety state, including execution-disabled indicators.

Candidate route: `GET /projections/system-health`.

### 2. Intelligence state

Proposed logical projection: `intelligence-review`.

It should project existing P3.17–P3.24 artifacts:

- review inbox items;
- briefing attention groups;
- workflow state and review history;
- calibration signals;
- operational readiness and learning-checkpoint summaries.

It must preserve source item IDs, provenance, confidence, uncertainty, freshness,
Brain impact, Mind impact, and `requiresHumanDecision`. It must not infer importance
or perform promotion.

Candidate routes:

- `GET /projections/intelligence/review`
- `GET /projections/intelligence/briefing`
- `GET /projections/intelligence/readiness`

Bounded query parameters should include explicit state filters and a maximum page
size. No unbounded runtime file listing is allowed.

### 3. Ingestion state

Proposed logical projection: `ingestion-state`.

It should expose existing ingestion-envelope and report-only pipeline state:

- source and envelope counts;
- pending/reviewed/failed/deferred counts;
- latest accepted source revision;
- failure summaries without secret payloads;
- provenance and freshness.

Candidate route: `GET /projections/ingestion`.

It must not write inbox state, retry ingestion, or classify importance.

### 4. Evolution and promotion state

Proposed logical projection: `evolution-state`.

It should aggregate existing proposal, approval, validation, application-plan, and
execution-readiness artifacts:

- proposal candidates and lifecycle state;
- human decisions and decision timestamps;
- validation and receipt references;
- promotion readiness and blockers;
- rollback/transaction references where present.

Candidate routes:

- `GET /projections/evolution`
- `GET /projections/evolution/proposals/:id`

The projection is observational. Approval and application remain behind existing
explicit mutation boundaries and are not expanded by this plan.

### 5. Repository and connected-system state

Proposed logical projection: `system-topology`.

It should normalize existing `/repos`, infrastructure catalog, component status, and
provider-admission metadata into a non-secret topology view:

- repository identity and revision;
- connected component identity and availability;
- source authority and freshness;
- provider/adapter health metadata;
- relationship references;
- no credentials, tokens, or private runtime instructions.

Candidate route: `GET /projections/system-topology`.

## Client access model

All clients consume the same provider-neutral projections:

- Obsidian: primary human Decision Center and Mind-facing workflow adapter;
- Brain Console: optional specialist diagnostics/operations adapter;
- Claude Code and Codex: bounded context/status consumers, not decision authorities;
- Workbench: tool/MCP consumer subject to its separately admitted authority;
- future clients: conform only after contract and safety validation.

No client receives direct filesystem access to runtime artifacts. No client may treat
derived projection state as canonical source truth.

## Failure and freshness semantics

The contract must distinguish:

- `fresh`: source exists, validates, and is within its declared freshness deadline;
- `stale`: source exists but exceeds its deadline; data remains visibly stale;
- `empty`: valid source with no current items;
- `unavailable`: source or permitted provider unavailable;
- `invalid`: source exists but fails schema/provenance validation;
- `not_instrumented`: capability is not yet wired to a source.

Failure behavior is fail-closed for authority and mutation. A failed projection may
show a diagnostic state, but must not silently fall back to a different authority or
invent a healthy/empty result.

## Permissions and mutation boundary

The first projection packet is GET-only. It does not add authentication, execution,
remediation, scheduling, provider mutation, or Mind writes. Existing POST routes
remain unchanged and independently governed.

Before broader deployment, Brain Core needs an explicit service identity and route
authorization contract. Localhost containment must not be presented as complete
authentication.

## Implementation order

### P3.25.3A — envelope and authority contract

Define the versioned envelope, freshness vocabulary, provenance requirements, safety
fields, error shape, and conformance fixtures. No routes changed.

### P3.25.3B — system health and topology projection

Add read-only adapters over already-accepted `/status`, capability, repository, and
infrastructure sources. Prove no secrets, no direct client file reads, and stable
empty/stale states.

### P3.25.3C — ingestion and intelligence projections

Expose P3.17–P3.24 artifacts through bounded adapters with pagination, provenance,
human-decision indicators, and deterministic empty-state fixtures.

### P3.25.3D — evolution projection

Expose proposal/approval/validation/readiness state as read-only data while retaining
existing Decision Core and approval authority.

### P3.25.3E — client conformance plan

Validate Obsidian, optional Brain Console, and future client consumption against the
same projections. Only then consider bounded UI work.

## Risks and rollback

Risks:

- a new projection accidentally becomes a second authority;
- legacy route shapes drift from the envelope;
- stale data is rendered as current;
- large inbox/evidence payloads affect local clients;
- provider failures leak secrets or block unrelated projections.

Mitigation and rollback:

- adapters remain read-only and feature-gated by route availability;
- preserve existing routes as compatibility views;
- add contract fixtures and validators before client adoption;
- cap result size and isolate provider calls;
- disable a projection route without changing its source artifacts;
- remove only the adapter/route after proving no client depends on it.

## Acceptance criteria for the first implementation packet

- one versioned projection envelope is defined and validated;
- authority, provenance, freshness, confidence, and safety fields are mandatory;
- empty, stale, unavailable, and invalid states are distinct;
- no projection creates a database or canonical authority;
- no client reads `runtime/local/**` directly;
- no mutation, execution, scheduling, remediation, or Mind write is introduced;
- existing routes remain behaviorally compatible;
- focused fixtures prove deterministic output and secret absence;
- documentation and diff validation pass.

## Final recommendation

Start with **MRU0-P3.25.3A — envelope and authority contract**. It is the smallest
bounded packet that makes later system-health, ingestion, intelligence, evolution,
and topology projections interoperable without prematurely expanding Brain Console or
Brain Core authority.

No UI implementation, Video Orchestrator merge, provider activation, or automation
activation is authorized by this plan.
