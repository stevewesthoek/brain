# B8.5 bounded Graphify semantic synthesis acceptance — 2026-08-11

## Decision

B8.5 is accepted. Legacy structural Graphify remains frozen and is no longer scheduled. Graphify now has one bounded Brain-only semantic event path that produces non-authoritative generated projections from explicitly approved architecture documents only.

## Scope and authority

- repository scope: Brain only
- Mind scope: not approved
- structural Graphify: frozen
- CBM: structural navigation default
- exact source: authority
- semantic output: non-authoritative projection only
- default model runtime: none
- external/local model requirement: none

Approved semantic scope `brain-architecture-docs` contains only these Brain documents:

- `docs/system/brain-agentic-os-strategy.md`
- `docs/system/brain-agentic-os-roadmap.md`
- `docs/system/brain-console-architecture.md`
- `docs/system/graphify-context-standard.md`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`

Secrets, credentials, backups, generated output, runtime state, vendor state, `node_modules`, `.git`, and legacy Graphify output roots are excluded.

## Event-driven behavior

Scheduler entrypoint is now `tools/graphify-semantic-event.mjs --mode=scheduler` rather than the legacy six-phase `graphify-nightly.sh` path.

The event gate compares Git state to the last evaluated semantic state and only considers changed approved semantic documents. Code-only or unapproved changes:

- do not invoke a runner;
- do not mark the semantic projection stale;
- write an auditable receipt only.

Relevant approved document changes mark semantic state stale. Regeneration occurs only when an explicit runner path is supplied. There is no default model runner and acceptance did not call an external or local model API.

Manual mode requires an approved scope and at least one explicit changed document.

## Bounds

Canonical profile: `operations/specs/graphify-operational-profile.json`.

- max documents: 8
- max input bytes: 2,097,152
- max estimated tokens: 500,000
- max runtime: 300 seconds
- max output bytes: 5,242,880
- receipts retained: max 7 runs / 14 days
- failure receipts: 14-day retention
- publication: staged atomic rename
- repository mutation: forbidden

Only changed approved documents are staged. Staging is removed on success and failure. Runner failure leaves semantic state stale and writes a failure receipt.

## Structural freeze

`tools/scripts/graphify-nightly.sh` remains fail-closed behind `GRAPHIFY_CONTAINED_EXECUTION`; it is no longer the Office scheduler entrypoint.

Runtime truth reports:

- `graphify-structural-state=frozen`
- `graphify-semantic-state=bounded-event-driven-active`
- `graphify-scheduler-gate=semantic-event-enforced`
- `graphify-process=not-observed`
- `structuralIndexingAuthorized=false`

The typed scheduler manifest and scheduler inventory preserve the existing `graphify-nightly` job ID and containment kill switch, but change its entrypoint/mode to the bounded semantic event gate.

## Validation

- B8.5 semantic fake-runner fixtures: 11/11 pass
- combined B8.5 + typed-scheduler + MCP runtime-truth tests: 65/65 pass
- typed scheduler validation: pass
- scheduler inventory validation: pass, 17 jobs
- Graphify operational-profile validation: pass
- Office scheduler shell syntax: pass
- live scheduler event-gate invocation with no runner: safe no-op receipt, no runner invoked
- MCP runtime-truth: pass
- Brain conformance: pass; only six pre-existing finalized-Mind evidence warnings

Acceptance used only fake runners and local deterministic validation. No external or local model API was invoked.

## Boundary

B8.5 does not authorize Mind ingestion, structural Graphify reactivation, global semantic rollout, or changes to Mind/Workbench. B8.6 may now pilot the accepted CBM + exact-source + bounded-semantic architecture on Brain plus exactly one already-approved application repository and must prove rollback/disable/cleanup before P8 closure.
