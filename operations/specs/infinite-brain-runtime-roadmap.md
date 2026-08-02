# Infinite Brain Runtime Roadmap

**Status:** canonical Brain implementation projection
**Version:** 2.0
**Last reviewed:** 2026-08-01
**Strategic priority owner:** `/Users/Office/Repos/stevewesthoek/mind/system/mind-roadmap.md`

## Purpose

This document projects Mind's seven strategic priorities into Brain-owned runtime outcomes. It does not define human truth and it does not report live capability status.

Live status is owned only by:

```text
operations/runbooks/infinite-brain-roadmap-status.md
```

## Pre-1.0 Architecture Stabilization Program

This program is the safety and architecture gate for the remaining Brain and
Mind migration work. It is tracked in the implementation plan with the
`BS0.1`–`BS0.23` namespace so the existing `B1`, `B2`, and later task IDs keep
their meanings, statuses, blockers, and evidence links unchanged.

The stabilization program is sequenced as follows:

| Lane | Purpose | Execution state |
|---|---|---|
| **P0 — Safety containment** | Quiesce unsafe writes, freeze unsafe activation, and audit credential/backup boundaries. | Complete through BS0.4. |
| **P1 — Contract and authority closure** | Establish the versioned contract/path registries and separate normative policy from executable validation. | Complete: BS0.5–BS0.7, BS0.23, B1.0–B1.7 all complete. B1.6 and B1.7 complete 2026-07-30; B1.0a guarded deployment complete 2026-07-22. |
| **P2 — Runtime path migration** | Move Mind Steward, Brain Core, and active legacy-path producers to the canonical registry. | Complete: BS0.8–BS0.10 all complete. |
| **P3 — Operational truth and orchestration** | Reconcile scheduler behavior, capability state, manifests, job semantics, and bounded Graphify operation. | BS0.11–BS0.15 complete as bounded repository-only work. |
| **P4 — Cross-system proof and recovery** | Build layered conformance, exact-scope approvals, typed workers, deletion readiness, rollback, and restoration proof. | Complete: BS0.16–BS0.19 complete; B4.4 and B5.1–B5.3 complete. |
| **P5 — Evaluation-first Context Gateway** | Create the evaluation corpus, context-pack schema, deterministic retrieval vertical slices, and adapters only after parity. | Core batch through B3.4 is validated; thin adapters are complete; B5.4 complete (2026-07-31). |
| **P6 — Controlled-write pilots** | Expand only from fixture-proven, evidence-backed, approval-gated pilots. | B6.1–B6.3 are complete; measured automation remains fixture-only until a later approved run. |
| **P7 — Scale and 1.0 certification** | Certify capability truth, recovery, performance, documentation, and deletion gates before scale. | B7.1–B7.7 and the independent B1.0a guarded-deployment lane are complete. |
| **P8 — Context-memory efficiency and freshness** | Make deterministic structural code memory the always-current default across active repositories; retain Graphify only for bounded, event-driven Brain/Mind knowledge synthesis. | Planned post-stabilization phase; no deployment or scheduler change is authorized by this roadmap entry. |

### Stabilization principles

- Brain and Mind remain separate. Mind owns meaning, decisions, priorities, and human-readable authority; Brain owns runtime, schemas, automation, deployment, and machine truth.
- The bridge is an interface, not a third authority owner. Query, authorization, and execution remain separate boundaries.
- Localhost is not authentication or authorization.
- n8n performs authenticated immutable intake; it does not own authoritative classification or direct promotion.
- Mind Steward remains proposal-only by default and the sole classification/proposal engine.
- Canonical path meaning and executable path validation use one versioned registry; repository, deployed, observed, and verified state remain distinct.
- Compatibility paths never remain active defaults.
- Runtime capability truth is generated from evidence.
- Scheduler jobs declare privilege, dependencies, timeout, retry, receipts, failure behavior, and kill switches.
- Cross-repository conformance, rollback, and restoration proof precede broad controlled writes.
- Graphs and generated reports remain non-authoritative.
- `kanban.md` remains current task authority until M1.4 proves a lossless switch.

### Explicit deferrals

The stabilization program does not authorize broad Brain or Mind folder restructuring, immediate deletion of existing contracts, a wholesale scheduler rewrite, distributed-service decomposition before bounded boundaries are proven, Context Gateway implementation before safety containment, automatic migration of unresolved authority conflicts, or deletion of legacy paths before cross-repository proof.

### Independent lanes

- `B1.0a — Deploy and verify Save-to-Mind target paths` completed as a separate guarded-deployment lane on 2026-07-22. The admitted MRP-6 Workbench provider executed one fresh migration, and exact canonical readback confirmed the approved candidate without a webhook fixture or Mind write.
- `BS0.23`, `B1.1`, `B1.2`, `B1.3`, and `B1.4` are complete as the current contract-closure batch.
- Mind `M1.3` is complete (2026-07-31).
- Mind `M1.4` is complete (2026-07-31): kanban.md retained as sole human task authority; tasks.md retired.

## Priority projection

| Priority | Brain outcome | Current roadmap state |
|---|---|---|
| 1. Canonical coherence | One path/schema contract; all consumers conform; legacy package resolved | complete (B1.0–B1.7, BS0.5–BS0.7, BS0.23) |
| 2. Context Gateway | One deterministic retrieval core with CLI and thin adapters | tested core plus CLI/trust-boundary batch, thin adapters complete |
| 3. Retrieval evaluation | Versioned corpus and fixed benchmark command | tested corpus/core plus fixed benchmark command, semantic gate complete |
| 4. Capability truth | Machine-readable manifest and generated status | manifest schema, inventory, generated live status, and status-view exposure complete |
| 5. Controlled application | General bounded proposal apply path built from the narrow writer proof | complete: B5.1–B5.4 (fixture-only activation, 2026-07-31) |
| 6. Measured automation | One evidence-backed pilot at a time | complete: B6.1–B6.3 (fixture-only; no live pilot authorized until separately approved) |
| 7. Simplification | Smaller routers, fewer duplicate contracts, bounded generated state | complete: B7.1–B7.7 (2026-07-17) |

## Runtime architecture target

```text
Mind source files
    ↓ read-only discovery
Context Gateway core
    ├─ deterministic path/frontmatter/link search
    ├─ authority, freshness, privacy, and budget filters
    ├─ optional graph/embedding/model rankers
    └─ cited context pack
         ↓
CLI / MCP / API / Console / agent adapters
         ↓
proposal engine
         ↓
validation → approval → execution → verification → receipt
```

Cross-cutting services:

- canonical Mind contract;
- capability manifest;
- evaluation runner;
- audit and rollback evidence;
- feature flags and kill switch;
- bounded runtime storage.

## Priority 1 runtime deliverables

- `mind-path-contract` module or schema is the only active path authority.
- Mind Steward and Brain Core consume the same contract.
- active global AI instructions point to `mind/system/agent-context/`.
- success intake resolves only `inbox/new/`.
- failure intake resolves only the verified active failure path.
- classification defaults to report-only/dry-run.
- source-preservation behavior is explicit and tested.
- Brain Core and Mind Steward verification commands pass, or the obsolete package is retired.

## Priority 2 runtime deliverables

- `mind-context` CLI package and core library;
- JSON Schema for context packs;
- deterministic discovery, scoring, budgeting, and citations;
- `resolve`, `explain`, and `health` commands;
- structured error states for unavailable Mind, missing sources, stale context, and insufficient evidence;
- source excerpts carried as untrusted data that cannot affect permissions or policy;
- thin MCP/API/Console adapters added only after CLI tests pass.

## Priority 3 runtime deliverables

- fixture corpus stored outside personal production content;
- expected-source and forbidden-source assertions;
- privacy-scope cases;
- prompt-injection and data-poisoning cases;
- authority/freshness/contradiction cases;
- benchmark JSON and Markdown output from the fixed `npm run eval` command;
- fixed seed and deterministic baseline;
- CI or local check for regressions.

## Priority 4 runtime deliverables

- capability manifest schema and data file;
- validator for unique IDs, known states, owners, and evidence commands;
- health-check adapter for active capabilities;
- generated status Markdown;
- stale verification warning;
- Console/CLI view sourced from the same manifest.

## Priority 5 runtime deliverables

- proposal schema aligned with the Brain–Mind bridge;
- exact target and allowed-section validation;
- source commit, before hash, expiry, and approval replay protection;
- idempotent executor;
- rollback bundle and post-write verifier;
- fixture-only activation before any production Mind target expansion.

## Priority 6 runtime deliverables

- pilot definition schema;
- baseline and measurement scripts;
- approval volume, review latency, false-positive, failure, and rollback metrics;
- kill switch and bounded schedule;
- human verdict record;
- automatic return to report-only when trial gates fail.

## Priority 7 runtime deliverables

- route inventory for the current Brain Core dispatcher;
- domain routers with unchanged external behavior;
- contract-duplication report and removal plan;
- Codebase Memory MCP as the default structural code-memory layer for active repositories;
- bounded Graphify profiles only for selected Brain architecture and Mind knowledge synthesis, with event-driven freshness and retention policy;
- generated/runtime/source boundary audit;
- startup, retrieval, context-token, and storage budgets;
- documentation lint and link/path consistency check.
- tested backup/restore and retention procedures for canonical data and runtime recovery evidence.

## Phase P8 runtime deliverables

- one local Codebase Memory MCP service or approved equivalent providing deterministic structural indexes for each active code repository;
- incremental or file-watch refresh that updates changed code without an LLM and records repository commit/freshness metadata;
- agent instructions that query structural memory before broad repository exploration while requiring exact source reads before edits;
- bounded Graphify profiles limited to approved Brain architecture and Mind knowledge scopes;
- Graphify runs triggered only by relevant document/media changes or explicit architecture work, never by an unconditional nightly full-repository schedule;
- no local LLM dependency for routine code graph generation or refresh;
- a benchmark covering indexing latency, CPU/memory load, freshness lag, retrieval quality, token use, and failure fallback on the M1 Pro host;
- rollback and graceful-degradation rules proving repositories remain usable when either context service is unavailable.

## Sequencing rules

1. Complete contract coherence before building retrieval adapters.
2. Build the CLI/core before MCP, API, or Console surfaces.
3. Establish a baseline corpus before adding semantic ranking.
4. Generate status before expanding write authority.
5. Prove write safety on fixtures before selecting a real proposal type.
6. Run one automation pilot at a time.
7. Simplify in small behavior-preserving batches with regression checks.

## Non-goals

- full-vault context injection;
- autonomous strategy or priority changes;
- a mandatory vector database;
- separate retrieval logic per model or IDE;
- broad folder or glob writes;
- continuous automation without measured value;
- reporting implementation as active capability without evidence.

## Roadmap completion gate

The runtime roadmap is complete only when all seven priorities pass the exit gates in Mind's roadmap and the live status page records evidence for every active capability.
