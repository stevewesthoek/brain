# Graphify Semantic Event Gate — Manual/Event-Driven Boundary

**Status:** Manual/event-driven compatibility runbook; daily scheduler path blocked
**Last updated:** 2026-08-12
**Scheduler registry entry:** `graphify-nightly` (policy-blocked, event-driven)
**Canonical semantic entrypoint:** `tools/graphify-semantic-event.mjs`

## Current Operating Model

The old phased nightly Graphify workflow is retired. Structural code/repository graph generation remains frozen under B8.5. Codebase Memory MCP is the structural navigation layer when fresh, and exact current source remains authoritative.

The daily Brain Scheduler does not execute this entry. The registry retains the
event-driven metadata as a policy-blocked boundary. Use the semantic event gate
only through an explicitly admitted manual/event-driven procedure:

```text
node tools/graphify-semantic-event.mjs --mode=manual ...
```

The historical `tools/scripts/graphify-nightly.sh` path is a fail-closed compatibility stub. Do not use it to generate graphs.

## Event-gate Behavior

The semantic event gate evaluates changes against the explicit Brain allowlist in `operations/specs/graphify-operational-profile.json`.

- Code-only changes do not invoke a semantic runner.
- Changes outside the approved semantic document scope do not invoke a runner.
- Relevant approved document changes mark semantic freshness stale.
- A runner is optional and must be supplied explicitly through `GRAPHIFY_SEMANTIC_RUNNER`.
- Without a runner, the gate records state/receipts only.
- No local model server is started automatically.
- No repository is mutated.

The event-gate timeout is 300 seconds and remains bounded by the operational profile.

## Manual Semantic Regeneration

A manual semantic run is allowed only for an approved scope and explicit changed files.

Example shape:

```bash
node tools/graphify-semantic-event.mjs \
  --mode=manual \
  --scope=brain-architecture-docs \
  --changed-file=docs/system/graphify-context-standard.md
```

This evaluates the event but does not invoke a model unless a bounded runner is supplied explicitly:

```bash
node tools/graphify-semantic-event.mjs \
  --mode=manual \
  --scope=brain-architecture-docs \
  --changed-file=docs/system/graphify-context-standard.md \
  --runner=/absolute/path/to/approved-bounded-runner
```

Do not configure a default runner in repo state.

## Disable Switch

Set:

```bash
GRAPHIFY_SEMANTIC_DISABLED=1
```

When disabled, the event gate remains fail-closed and does not invoke a runner.

## Scope and Authority

Current approved semantic scope is Brain-only. Mind is not approved for Graphify semantic ingestion.

Graphify output is non-authoritative. It may help human or agent understanding but cannot:

- authorize edits;
- override roadmap/status truth;
- replace exact-source verification;
- establish runtime/provider/security truth;
- write to Brain or Mind.

## Structural Navigation

For code structure, symbols, routes, callers/callees, or blast radius:

1. use fresh Codebase Memory MCP when available;
2. identify likely files/symbols/relationships;
3. read exact current source;
4. make edits or final claims only after exact-source verification.

If CBM is stale/unavailable/unknown, use bounded exact-source search/read directly.

## Logs and State

Scheduler log:

```text
~/Library/Logs/office-scheduler/graphify-semantic-event.log
```

Local semantic state/output roots are defined by `operations/specs/graphify-operational-profile.json` under `runtime/local/graphify/` and are non-authoritative runtime artifacts.

## Legacy Artifacts

Existing `graphify-out/` or `.graphify-out/` artifacts may be retained for historical integrity but are stale-prone compatibility artifacts. Do not regenerate them through the retired nightly runner and do not treat them as current source truth.
