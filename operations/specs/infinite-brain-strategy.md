# Infinite Brain Strategy for Brain

**Status:** canonical strategy
**Version:** 1.0
**Last reviewed:** 2026-07-10
**Depends on:** `operations/specs/infinite-brain-philosophy.md`

## Strategic objective

Brain is the LLM-agnostic capability and execution layer for Steve's work.

Its objective is:

```text
Give every authorized AI surface the same efficient access to Steve's relevant context
and the same safe path from proposal to verified action.
```

## Strategic position

```text
Mind  = human authority and orientation source
Brain = retrieval, capability, execution, safety, and observability
Other repos = implementation targets and consumers
```

Brain must make Mind useful without copying Mind into global prompts or requiring one model provider.

## Strategic outcomes

Brain should deliver:

1. One versioned path/schema contract for Mind integration.
2. One Context Gateway core used by CLI, MCP, API, Console, and agent adapters.
3. Deterministic retrieval before model-based ranking or synthesis.
4. Small cited context packs with authority, freshness, privacy scope, conflicts, and budget reporting.
5. Fail-closed, exact-path, single-use approvals for durable Mind changes.
6. Observable capability status derived from tests and runtime evidence.
7. Measured automation that is retained only when it proves value.

## Architecture principles

### One core, multiple adapters

CLI, MCP, API, Console, and agent integrations must call the same core modules. They must not contain separate path lists, ranking rules, or approval semantics.

### Canonical contracts

Brain owns machine-readable schemas and validators. Mind owns human policy and meaning. Generated human-readable summaries may appear in both repos, but they must identify their canonical source and version.

### Deterministic first

Use filesystem search, frontmatter, explicit links, path maps, freshness metadata, hashes, and rule-based filters before embeddings or model inference.

### Replaceable model layer

Models may classify, rank, summarize, compare, and explain. Provider selection stays behind the AI Model Selector or an equivalent policy adapter. Core retrieval and approval logic must work without a hosted model.

### Bounded modules

Large general modules should be split by domain and stable interface. In particular, Brain Core routing should move from a single multi-thousand-line dispatcher toward domain routers with shared request/response utilities.

### Generated state isolation

Runtime data, caches, Graphify history, app binaries, browser state, and generated reports should remain outside canonical source where possible. Git tracks source, contracts, selected fixtures, and deliberate audit evidence.

### Ownership before automation

Every mutable resource must have one resolved authoritative owner. Brain may
coordinate observation, drift detection, lifecycle checks, and recovery
proposals while the application/provider/adapter retains custody of its state.
Discovery is candidate evidence, not admission authority. A new consumer joins
through the shared `discover → candidate → classify → validate → resolve →
admit → participate` contract and must declare environment, isolation,
dependencies, health/recovery coverage, quiescence, and account capacity.

The infrastructure catalog and Identity & Access contracts are the shared
machine-readable model. Provider-specific runtime adapters translate local
mechanics—such as a profile directory, browser session, connector, or route—
into that model; they do not become a second config writer or secret store.

Quiescence is scoped to the exact resource and declared dependency being
changed. An unrelated process, application, session, or runtime cannot become
a global admission failure merely because it shares a host.

### Observation and admission plane

The shared observer seam is deliberately small: `discover()` finds
non-secret candidates, `observe()` returns the latest evidence for a candidate,
and `verifyRelationship()` tests a claimed dependency or ownership link. A
local runtime adapter may inspect process and listener metadata without
capturing command arguments or environment variables. A product adapter may
interpret supported status/doctor output, but must normalize it into the same
observation contract.

The resulting flow is:

```text
observer → observation → candidate → pure admission plan → canonical catalog
                                  ↘ unknown/conflict backlog + attention
```

Live observation is ephemeral and redacted; canonical admission is durable and
reviewable. Current evidence can make a resource degraded or unknown, but it
cannot silently import account identity, application OAuth, or secret-store
material. The first/reference local secret-store boundary remains macOS
Keychain; OnePassword can be added later as a replaceable adapter only after
the same custody, identity, and verification contract is proven.

## Context Gateway strategy

The Context Gateway is the primary missing product capability.

Initial surface:

```text
mind-context resolve --query <text> --scope <scope> --budget <tokens> --format json|markdown
mind-context explain --pack <id>
mind-context health
```

Core output:

```yaml
schema_version: "1.0"
query: ""
scopes_searched: []
scopes_excluded: []
sources: []
authority_summary: ""
freshness_summary: ""
conflicts: []
unknowns: []
context_budget:
  requested_tokens: 0
  estimated_tokens: 0
  omitted_source_count: 0
brief: ""
```

The first implementation may use deterministic search and scoring only. Embeddings, graph traversal, and model summarization are later adapters justified by evaluation gains.

Retrieved excerpts are always labeled as source data. Text inside a source cannot grant permissions, change system instructions, widen privacy scope, or trigger tools.

## Reliability strategy

Every durable action follows:

```text
proposal
→ validation
→ exact diff
→ approval bound to source state and expiry
→ execution
→ post-action verification
→ receipt and rollback evidence
```

Retries require idempotency keys. Failed work remains visible. Missing evidence returns `unknown` or `insufficient-evidence`, never a fabricated zero or success.

Lifecycle operations additionally check required dependencies and explicit
workload/lease evidence. Active work blocks a disruptive operation; missing
runtime evidence is unknown. Availability policy remains with the owning
application/provider, so Brain does not invent competing keepalive behavior.

## Status strategy

`operations/runbooks/infinite-brain-roadmap-status.md` is the only live capability-status page.

Each capability uses one state:

```text
planned | implemented | tested | report-only | approval-gated | active | paused | retired
```

Roadmaps describe order. Implementation plans describe work. Status describes reality. These documents must not substitute for each other.

## Evaluation strategy

Before adding semantic complexity, create a versioned evaluation corpus of real Mind questions with expected sources, forbidden sources, authority expectations, freshness cases, privacy scopes, and contradiction cases.

Every retrieval change reports:

- top-k source precision;
- required-source recall;
- authority/freshness correctness;
- privacy leakage failures;
- context-token cost;
- latency.

No claimed improvement is accepted without before/after results on the same corpus.

## Security and privacy

Brain should use least privilege and least retention:

- no secrets in context packs;
- no raw credentials or application-managed session state in the canonical catalog;
- no full-vault export by default;
- explicit scope filters;
- local processing for sensitive classification when suitable;
- bounded runtime retention;
- audit receipts for durable writes;
- tests for path traversal, symlink escape, approval replay, stale hashes, and unauthorized scope expansion.
- prompt-injection and data-poisoning fixtures for retrieved source text.
- ownership, route-writer, environment-isolation, admission, quiescence, and
  multi-account capacity conflict fixtures.

## Delivery strategy

The seven-priority roadmap is sequential. Lower-tier models execute one task at a time from the implementation plan. Each task names exact files, change boundaries, verification commands, and stop conditions.

## Non-goals

Brain should not become:

- a second copy of Mind;
- a universal autonomous agent with implicit authority;
- a collection of provider-specific implementations with inconsistent behavior;
- a permanent store for raw personal context;
- a reason to load more context than the task needs;
- a system whose success is measured by model calls or automation count.
- a universal vault or credential janitor that assumes every provider supports
  refresh, renewal, browser reauthentication, or synthetic keepalive.

## Strategic rule

```text
Centralize policy and retrieval semantics, decentralize adapters,
measure every expansion, and keep human meaning in Mind.
```
