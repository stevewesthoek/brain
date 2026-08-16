# CLR2 Universal Context Broker and Live Alignment Acceptance — 2026-08-15

## Decision

CLR2 is accepted as a **read-only repository implementation** of the universal Context Broker, live-alignment contract, optional retrieval-provider fallback, and source-agnostic capability catalog.

This acceptance does **not** claim deployment or client activation. No new MCP/provider registration, service, scheduler, conversation ingestion, Mind write, capability execution route, or Workbench `v1.3.8-beta` implementation was enabled.

CLR3-CLR8 remain unstarted and require separate owner authorization.

## Implemented

- `operations/specs/context-learning/broker-contracts-v1.schema.json`
  - generic versioned broker request;
  - exact nine-operation surface: `health`, `bootstrap`, `resolve`, `explain`, `align`, `capabilities_list`, `capabilities_inspect`, `decisions_status`, `learn_status`;
  - context/retrieval provider descriptors;
  - health, bootstrap, resolve/context-pack, explain, alignment, capability list/inspect, decision-status, and learning-status response contracts;
  - capability descriptors for skills, orchestrators, runbooks, named CLIs, validators, MCP servers/tools, local apps, and future provider kinds.
- `tools/context-learning/context-broker.mjs`
  - transport-neutral read-only broker core;
  - deterministic `human_authority` → `machine_capability` → `supplemental` ordering, allowing Mind-first/Brain-second behavior without hardcoding repository names;
  - bounded bootstrap and progressive context-pack budgeting;
  - cited inclusion/exclusion explanations;
  - freshness/conflict/unknown propagation;
  - five alignment signals: `aligned`, `potentially_conflicting`, `conflicting`, `strategy_stale`, `insufficient_context`;
  - optional non-authoritative retrieval accelerators with visible fallback;
  - compact capability listing plus selected/relevant instruction inspection;
  - no capability execution method;
  - duplicate provider-scoped capability IDs rejected visibly;
  - bounded in-memory explain history only.
- `operations/fixtures/context-learning-broker-fixtures-v1.json`
  - Brain/Mind-style reference profile;
  - alternate provider profile using unrelated names/taxonomy to prove source neutrality.
- `tools/validate-context-learning-broker.mjs`
  - validates the versioned operation/contract surface and both provider profiles;
  - rejects reference-profile coupling in the alternate fixture.
- `tools/context-learning/context-broker.test.mjs`
  - focused read-only behavior tests.

## Validation evidence

### JSON

`validate_json_files` passed for:

- `operations/specs/context-learning/broker-contracts-v1.schema.json`;
- `operations/fixtures/context-learning-broker-fixtures-v1.json`;
- `package.json`.

### Broker contract validation

```text
npm run validate:context-learning-broker
```

Result:

```text
context-learning-broker-contracts-valid
  definitions=15
  operations=9
  profiles=2
```

### Focused behavior tests

```text
npm run test:context-broker
```

Result: `11/11 PASS`.

Coverage proves:

1. the broker surface is read-only and exposes no execution operation;
2. bootstrap remains within its configured hard token ceiling and orders human authority before machine capability;
3. context retrieval is bounded, progressive, cited, ordered, and explainable;
4. stale/conflicting/unknown information and item/token exclusions propagate explicitly;
5. all five required alignment signals are deterministic from structured human-authority evidence;
6. disabled, stale, and unavailable optional accelerators fall back without breaking canonical context resolution;
7. capability list results exclude full instructions by default;
8. full instructions are returned only after explicit selected relevance;
9. capability discovery never invokes provider execution callbacks;
10. stale capability providers fail visibly and duplicate capability IDs within one provider are rejected;
11. a non-Brain/Mind profile follows the same bootstrap, resolve, and capability-consumer paths;
12. decision/learning status outputs validate against explicit schemas and unsupported execution operations fail closed.

One bounded repair occurred during testing: the first test run showed that a provider skipped after the global item limit had no explainability record. The broker was changed to record provider-level `item-limit` / `token-budget` exclusions instead of silently breaking resolution. The full suite then passed.

## Authority and provider boundary

CLR2 does not make Codebase Memory MCP, Graphify, Workbench, a vector database, or any specific vendor/model part of the correctness core.

The baseline is a configured authoritative context provider plus exact-source verification appropriate to that provider. Optional accelerators return only derived navigation hints and are marked `nonAuthoritative: true`. Disabled, stale, unavailable, or failing accelerators produce visible fallback metadata.

The reference profile can represent Steve's Mind and Brain, but the core uses only provider roles and contracts. The alternate fixture contains no Steve identity, Office/MacBook topology, Obsidian dependency, or Brain/Mind reference provider names.

## Capability boundary

CLR2 capability federation is **discovery and read-only instruction retrieval only**.

A capability descriptor can advertise:

- provider/capability identity;
- kind;
- source revision;
- summary;
- input/output schema references;
- required context scopes;
- risk/confirmation class;
- transport reference;
- health/freshness;
- optional instructions reference.

The broker cannot execute that capability. Consumers such as Workbench continue to own source locking, grants, confirmation, command/MCP allowlists, validation, Git policy, network policy, and execution authority.

## Live-alignment boundary

CLR2 does not use an LLM to rewrite strategy. It aggregates structured human-authority alignment evidence into one of five signals and preserves citations. A consumer may proactively warn about conflict or stale strategy, but no Mind strategy is mutated.

## Explicit non-actions

CLR2 did **not**:

- ingest any conversation history;
- promote any memory or learning candidate;
- write to Mind;
- start or configure a scheduler/background loop;
- register a new provider/MCP server;
- activate CBM or Graphify for a new scope;
- execute a skill, orchestrator, CLI, MCP tool, validator, or local app;
- modify Workbench-private;
- implement Workbench `v1.3.8-beta`;
- modify `feature/video-orchestrator`;
- modify `operations/migrations/`;
- modify the unrelated Claude settings working change;
- push any commit.

## Runtime truth

Repository implementation: **verified**.

Live consumer deployment/automatic startup integration: **not activated / not claimed**.

The later CLR consumer-conformance phases remain responsible for proving automatic use inside Claude, Codex, Gemini, Cursor, Kiro, Workbench, and other clients.

## Next gate

CLR2 acceptance authorizes nothing beyond itself. CLR3 — Decision Core, portal consolidation, Obsidian Decision Center, and notifications — remains blocked until separately authorized by the owner.
