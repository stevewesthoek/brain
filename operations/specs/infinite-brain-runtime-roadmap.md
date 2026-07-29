# Infinite Brain Runtime Roadmap

**Status:** canonical Brain implementation projection
**Version:** 2.0
**Last reviewed:** 2026-07-10
**Strategic priority owner:** `/Users/Office/Repos/stevewesthoek/mind/system/mind-roadmap.md`

## Purpose

This document projects Mind's seven strategic priorities into Brain-owned runtime outcomes. It does not define human truth and it does not report live capability status.

Live status is owned only by:

```text
operations/runbooks/infinite-brain-roadmap-status.md
```

## Priority projection

| Priority | Brain outcome | Current roadmap state |
|---|---|---|
| 1. Canonical coherence | One path/schema contract; all consumers conform; legacy package resolved | in progress |
| 2. Context Gateway | One deterministic retrieval core with CLI and thin adapters | planned |
| 3. Retrieval evaluation | Versioned corpus and fixed benchmark command | planned |
| 4. Capability truth | Machine-readable manifest and generated status | partially implemented |
| 5. Controlled application | General bounded proposal apply path built from the narrow writer proof | planned |
| 6. Measured automation | One evidence-backed pilot at a time | planned |
| 7. Simplification | Smaller routers, fewer duplicate contracts, bounded generated state | planned |
| 8. Context-memory efficiency and freshness | Deterministic structural code memory by default; bounded semantic synthesis for selected Brain/Mind scopes | planned |

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
- benchmark JSON and Markdown output;
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
- Codebase Memory MCP as the proposed default structural code-memory layer for active repositories;
- bounded Graphify profiles only for selected Brain architecture and approved Mind knowledge synthesis, with event-driven freshness and retention policy;
- generated/runtime/source boundary audit;
- startup, retrieval, context-token, and storage budgets;
- documentation lint and link/path consistency check.
- tested backup/restore and retention procedures for canonical data and runtime recovery evidence.

B1.0f reconciliation, B1.0a guarded-deployment lane are complete; B1.0e is retained only as superseded historical evidence.

## Phase P8 runtime deliverables

- one local Codebase Memory MCP service or approved equivalent providing deterministic structural indexes for each active code repository;
- incremental or file-watch refresh that updates changed code without an LLM and records repository commit/freshness metadata;
- agent instructions that query structural memory before broad repository exploration while requiring exact source reads before edits or authority claims;
- bounded Graphify profiles limited to approved Brain architecture and Mind knowledge scopes;
- Graphify runs triggered only by relevant document/media changes or explicit architecture work, never by an unconditional nightly full-repository schedule;
- no local LLM dependency for routine code graph generation or refresh;
- a benchmark covering indexing latency, CPU/memory load, freshness lag, retrieval quality, token use, and failure fallback on the M1 Pro host;
- rollback and graceful-degradation rules proving repositories remain usable when either context service is unavailable.

P8 is planned only. This roadmap entry authorizes no provider installation, watcher, scheduler change, Graphify retirement, or rollout.

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
