# Brain Core Projection Envelope v1

## Purpose

Brain Core projections are read-only, deterministic, rebuildable views over existing
Brain/Mind references and derived runtime artifacts. They are not a new database,
memory system, or authority layer.

Clients consume projections through Brain Core. They do not read `runtime/local/**`
or other internal artifacts directly.

## Required envelope

Every v1 projection contains:

- `contract`: `brain-core-projection-v1`;
- `projection` and `version`;
- `authorityOwner`: `brain`, `mind-reference`, `evidence`, or `derived-runtime`;
- `provenance.sourceReferences`, adapter, capture time, and source revision;
- `freshness`: `fresh`, `stale`, `unknown`, `unavailable`, or `not_instrumented`;
- `confidence`;
- `uncertainty`;
- `privacyClassification`;
- generation and revision timestamps/identifiers;
- `availability` and structured failure state;
- `safety` with `readOnly=true`, `writesToMind=false`, and
  `executionEnabled=false`;
- projection-specific `data`.

Unknown authority values, unknown source-reference kinds, missing provenance, and
unsafe safety flags fail closed.

## Authority rules

Mind remains authoritative for meaning, importance, priorities, and strategic human
context. Brain remains authoritative for operational policy, evidence handling,
validation, workflow state, and execution boundaries. A projection may reference
Mind-owned information, but it cannot make that information Brain authority or infer
human importance.

Projection endpoints do not promote proposals, mutate Mind, execute actions, schedule
work, remediate infrastructure, or change provider state.

## Initial endpoints

The first implementation exposes only foundation views:

```text
GET /health/projection
GET /projections/status
GET /projections/capabilities
GET /projections/runtime-state
```

These wrap existing Brain Core status, capabilities, and Infinite Brain runtime
readers. Existing routes remain compatibility views; no client is required to migrate
in this packet.

## Client consumption

Obsidian, the optional port-4881 Brain Console, Claude, Codex, Workbench, and future
clients consume Brain Core projections only. They must preserve stale/unavailable/
invalid states, display provenance, and treat empty data as a state rather than proof
of absence.
