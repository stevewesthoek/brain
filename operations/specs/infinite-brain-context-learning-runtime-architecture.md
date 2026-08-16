# Infinite Brain Context & Learning Runtime Architecture

**Status:** accepted architecture; CLR0-CLR2 complete; no live consumer/runtime activation authorized
**Version:** 0.1
**Date:** 2026-08-15
**Human authority:** `/Users/Office/Repos/stevewesthoek/mind/system/infinite-brain-context-learning-charter.md`
**Foundational philosophy:** `/Users/Office/Repos/stevewesthoek/mind/system/infinite-brain-philosophy.md`

## Purpose

Define a modular runtime through which supported LLMs and IDEs can automatically obtain small, fresh, cited Mind-first and Brain-second context, while conversation/runtime evidence can produce reviewed learning proposals without creating a second source of truth or unbounded storage growth.

This architecture extends existing Brain/Mind primitives. It does not replace the Context Gateway, shared-memory tools, learner skill, rule-onboarding policy, Brain Core proposal approvals, skill profiles, or Brain Console.

## Architectural objective

The runtime should make the model interchangeable and the context/learning layer durable:

```text
human + environment
      ↓
conversation/runtime evidence adapters
      ↓
normalized evidence ledger (local, private, bounded)
      ↓
relation + candidate extraction
      ↓
learning proposals ────────────────┐
      ↓                            │
Decision Core / human authority    │
      ↓                            │
logical learning transaction       │
      ↓                            │
Mind canonical truth + Brain canonical capability/learning
      ↓
rebuildable relational/hot indexes
      ↓
universal Context Broker
      ↓
Claude / Codex / Gemini / Cursor / Kiro / Workbench / future clients
```

At session time:

```text
small bootstrap envelope
→ task/intention detection
→ bounded Mind resolve
→ bounded Brain capability/skill resolve
→ alignment/freshness signal
→ progressive retrieval only when needed
```

## Design principles

1. **Mind first, Brain second.** Human meaning, strategy, preference, and approved decisions are oriented before machine execution policy when relevant.
2. **Small default context.** "Always available" means reliably retrievable, not always injected.
3. **Evidence is not truth.** Transcripts and logs are observations until authority and review rules promote them.
4. **Freshness is part of truth.** Retrieval must expose age, review state, contradictions, and supersession.
5. **Relationships over duplication.** Repeated evidence should strengthen, relate, or supersede existing knowledge instead of producing endless copies.
6. **Derived state is disposable.** Hot memory, search indexes, embeddings, caches, context packs, and projections are rebuildable.
7. **Human decisions converge.** One logical Decision Core owns unresolved decisions; notification/UI channels are adapters.
8. **Prevent instead of remember when possible.** Repeated failures should become tests/hooks/validators before prompt rules or textual memory.
9. **Logical atomicity across repos.** Cross-repo learning is visible only after a complete transaction receipt.
10. **Core before clients.** APIs/schemas stay vendor-neutral; Claude/Codex/Obsidian/macOS are adapters.
11. **Local-first, single-tenant first.** Personal and managed single-tenant installs precede multi-tenant complexity.
12. **Bounded storage and context cost.** Disk usage, token overhead, duplicate density, retrieval latency, and stale-hit rate are acceptance metrics.

## Existing primitives to extend

| Existing primitive | New role |
|---|---|
| `projects/mind-context/` | Foundation for bounded cited Mind retrieval and explanation. |
| `ai/policy/context-loading-order.md` | Defines existing lean startup order; new broker should implement it mechanically. |
| `operations/runbooks/shared-memory-system.md` + `~/.brain/memory/` | Transitional hot-recall layer; migrate away from independent human-truth ownership. |
| `tools/scripts/brain-learn-failures.mjs` | Seed for failure-episode evidence adapter/candidate extraction. |
| `ai/skills/custom/learner/SKILL.md` | Seed for learned-skill classification and promotion rules. |
| `docs/rules/rule-onboarding-and-hook-policy.md` | Canonical destination classifier for hook/test/rule/skill/runbook/memory proposals. |
| `projects/brain-core/src/adapters/infinite-brain-proposal-approval-store.ts` | Seed for Decision Core records; currently report-only and execution-blocked. |
| Brain Core `/infinite-brain/proposals*` APIs | Seed for proposal/decision API surface. |
| Brain Console in Obsidian | Steve's preferred Decision Center UI adapter. |
| `docs/skills/profiles/*` + skill pruning | Existing bounded-skill/context-cost mechanism. |
| `docs/product/prochat-os-cli-plan.md` | Packaging/CLI direction for installable product surfaces. |
| `docs/product/prochat-os-managed-plan.md` | Single-tenant managed deployment direction. |

## Optional accelerators and integration boundaries

CLR must remain useful when third-party or optional acceleration modules are unavailable.

- **Exact source + canonical Mind/Brain Markdown** are the baseline authority and retrieval fallback.
- **Codebase Memory MCP (CBM)** is an admitted Brain-only optional structural-navigation accelerator when fresh. It may identify symbols, routes, caller/callee relationships, and blast radius, but exact current source remains authority. CLR must consume CBM behind a provider interface and must not require it for correctness, portability, or customer installs.
- **Graphify** is an optional non-authoritative semantic/relationship projection and future visualization adapter. Structural Graphify remains frozen; current bounded Brain semantic Graphify does not authorize Mind ingestion. CLR may later project its own approved atom/relation model into Graphify-compatible visualizations, but Graphify must never become the canonical relation store or a runtime dependency.
- **Workbench** is an optional guarded local-repository bridge and a supported CLR **context-and-capability consumer**. Its currently admitted MCP scope exposes bounded repository status/context and guarded operations; it does **not** currently provide passive ChatGPT conversation-history export. CLR5 may add a Workbench/ChatGPT evidence adapter only through a supported export/event/capture surface. In the opposite direction, Workbench sessions should be able to discover and use the same bounded Mind context plus Brain-provided skills, orchestrators, named CLI capabilities, MCP servers/tools, runbooks, and execution capabilities as other approved clients. That integration must use versioned provider/catalog contracts rather than Brain-specific path knowledge inside Workbench. Steve's Brain/Mind setup is one installation profile; other Workbench users may attach different context and capability providers that implement the same contracts.
- Any future vector database, graph database, embedding service, hosted memory vendor, or IDE-native memory system is an adapter. Replacing or disabling it must not change canonical Mind/Brain truth.

This modular boundary is a product requirement: third-party accelerators may improve latency, navigation, visualization, or recall quality, but they must remain replaceable and independently upgradeable.

## 1. Authority layers

### 1.1 Canonical layers

**Mind canonical authority**

Owns:

- beliefs and values;
- preferences and identity;
- strategy and priorities;
- commitments and approved human decisions;
- durable personal/business knowledge;
- relationship/context meaning;
- human historical context.

**Brain canonical authority**

Owns:

- machine capability truth;
- execution policy;
- skills and orchestration knowledge;
- runbooks and operational lessons;
- deterministic rules/hooks/tests/validators;
- tool/provider/runtime configuration;
- approved operational decision records and receipts.

### 1.2 Non-canonical layers

**Evidence layer** — raw transcripts/logs/events and source references. Observation only.

**Learning proposal layer** — model/deterministic suggestions awaiting classification/review.

**Derived hot layer** — compact indexes/caches used for fast retrieval. Rebuildable and non-authoritative.

**Context pack layer** — ephemeral per-task projection with citations and freshness information.

### 1.3 `~/.brain/memory/` migration direction

The current shared memory system remains compatible during migration, but its target role changes:

```text
before: potentially independent cross-AI human memory
future: derived hot recall + pointers/projections from canonical Mind/Brain truth
```

No history is deleted during the migration. Existing entries are classified as:

- canonical Mind candidate;
- canonical Brain operational knowledge candidate;
- transient/session continuity;
- duplicate/superseded;
- unresolved historical evidence.

## 2. Knowledge atom and relation model

The system should not treat each observation as a new Markdown note. It needs a normalized logical atom for retrieval and freshness reasoning.

Proposed atom fields:

```text
atom_id
kind
canonical_owner          mind | brain
canonical_ref            path/symbol/decision/skill identifier
summary                   compact retrieval text
authority                 human | verified-source | approved-operational | derived
observed_at
valid_from
valid_to                  optional
last_confirmed_at
review_after              optional
freshness_class           stable | changing | volatile | unknown
confidence
sensitivity
source_evidence_refs[]
supersedes[]
superseded_by[]
contradicts[]
related_to[]
tags[]
content_hash
transaction_id            optional
```

Relations are first-class and can strengthen without copying content. Examples:

```text
strategy A --governs--> project X
failure F --prevented_by--> validator V
preference P --applies_to--> design tasks
decision D2 --supersedes--> decision D1
skill S --learned_from--> evidence E1,E2,E3
fact A --contradicts--> fact B
```

Canonical Markdown remains human-readable authority. The relation/index layer is a derived projection over those sources plus approved receipts.

## 3. Freshness and supersession

Every retrieved item receives a runtime freshness state:

```text
fresh
review_due
stale
superseded
contradicted
unknown
```

Freshness logic must be authority-sensitive:

- machine/runtime claims prefer exact current Brain/source verification;
- strategies/preferences rely on Mind review metadata and explicit later human evidence;
- stable historical facts may remain valid indefinitely unless contradicted;
- volatile facts require short review windows or live source checks.

A contradiction never silently overwrites the old item. The candidate engine creates a supersession/revalidation proposal with both source references.

The Context Broker must expose stale/conflicted status to the consuming LLM so it can say "this may need review" instead of confidently applying old context.

## 4. Conversation evidence model

### 4.1 Raw evidence ownership

Default rule: do not duplicate complete conversation histories into Brain or Mind.

For local clients, keep raw evidence in the client-owned local runtime location when safe. The evidence ledger stores content-addressed references, bounded excerpts where policy allows, source metadata, and processing watermarks.

For hosted clients, ingest only through supported export/event interfaces or explicit capture. Do not scrape unsupported private application databases.

### 4.2 Normalized conversation event

Proposed event schema:

```text
event_id
source_adapter            claude-code | codex | gemini | cursor | kiro | workbench | ...
source_session_id
source_message_id         optional
host_id
workspace/repo
actor                     human | assistant | tool
observed_at
content_hash
content_ref               local pointer or approved excerpt reference
privacy_class
processing_watermark
transaction_context       optional
```

Adapters must be incremental and idempotent. Reprocessing the same source event must not create a second candidate.

### 4.3 Source adapter contract

Every adapter provides:

```text
discover_since(watermark)
normalize(record)
verify_source(record)
privacy_classify(record)
checkpoint(watermark)
health()
```

Adapters do not decide what becomes memory. They only produce normalized evidence.

## 5. Learning candidate engine

Candidate categories:

- explicit human decision;
- strategy update or conflict;
- repeated preference;
- repeated task/workflow pattern;
- skill candidate;
- failure episode;
- successful recovery;
- deterministic prevention candidate;
- runbook update candidate;
- Brain decision-log candidate;
- stale-knowledge review;
- contradiction/supersession;
- relationship/link enrichment;
- transient continuity only;
- discard/no durable value.

Candidate extraction should combine deterministic signals and bounded semantic classification. Private conversation semantics must use an approved private provider and fail closed; current private-policy direction prefers approved Bedrock classification with no unsafe fallback.

### 5.1 Failure episode model

```text
symptom
attempts[]
failed_attempt_reasons[]
root_cause
successful_repair
learned_invariant
prevention_candidates[]
evidence_refs[]
```

Prevention ranking:

```text
test/validator/hook
→ deterministic rule
→ runbook
→ skill
→ contextual memory
```

Use contextual memory only when the lesson cannot be cheaply enforced mechanically.

### 5.2 Repetition-to-skill policy

Repetition alone is insufficient. A skill candidate must pass existing skill-quality rules and show evidence of recurrence, non-triviality, and reusable procedure. Duplicate skills should strengthen/update an existing skill proposal rather than create another skill folder.

## 6. Lean storage and compaction

The runtime must become more efficient as it learns.

### 6.1 Storage classes

| Class | Canonical? | Default retention |
|---|---:|---|
| Source-owned raw conversation | No | Source/client policy; not duplicated by default. |
| Evidence ledger metadata/hash | No | Retain while referenced; compact old low-value records after policy gate. |
| Candidate | No | Until resolved/expired/superseded; then compact to receipt. |
| Decision/transaction receipt | Yes for audit | Durable, small. |
| Mind/Brain canonical content | Yes | Existing Git/history policy. |
| Relational/hot index | No | Size-bounded, rebuildable, garbage-collectable. |
| Context pack/cache | No | TTL/LRU bounded. |

### 6.2 Compaction rules

- Merge duplicate candidates by canonical target + semantic/content fingerprint.
- Collapse repeated supporting evidence into relation counts/source references rather than repeated summaries.
- Remove superseded content from the hot retrieval set while retaining canonical/history pointers.
- Expire context caches aggressively.
- Rebuild derived indexes instead of indefinitely migrating obsolete internal formats.
- Preserve compact transaction/decision receipts after bulky intermediate proposals are pruned.
- Use the existing skill-pruning philosophy for learned Brain content.

### 6.3 Required growth metrics

Track:

- raw evidence bytes observed;
- evidence metadata bytes retained;
- hot-index bytes;
- candidate queue bytes/count;
- duplicate/superseded ratio;
- canonical atoms created vs updated;
- average relations per atom;
- context tokens per bootstrap/resolve;
- retrieval latency;
- stale-hit rate;
- disk growth per 1,000 processed messages.

Acceptance requires measured **sublinear hot-state growth** relative to evidence volume. Exact production limits are configuration/profile values established from pilot baselines, not hardcoded Steve-specific constants.

## 7. Logical atomicity and learning transactions

Brain and Mind are separate Git repositories, so physical one-commit atomicity is impossible. The runtime must provide logical atomicity.

Proposed transaction states:

```text
proposed
→ approved
→ prepared
→ mind-applied        optional
→ brain-applied       optional
→ validated
→ complete
```

Failure states:

```text
blocked
partial
compensating
rolled-back
failed
```

A transaction contains:

```text
transaction_id
proposal_ids[]
expected_mind_revision
expected_brain_revision
planned_operations[]
approval_refs[]
validation_plan
resulting_revisions
receipt_hash
state
```

The Context Broker may expose new canonical learning only after `complete`. Partial transactions remain invisible as active truth and must surface as operator exceptions.

No cross-repo mutation is authorized by this architecture spec.

## 8. Decision Core and human Decision Center

### 8.1 One logical queue

Extend the existing Infinite Brain proposal-approval semantics rather than create a new approval subsystem.

The Decision Core stores unresolved and resolved human-authority decisions independently of presentation UI.

Decision item fields should include:

```text
decision_id
proposal_ids[]
category
title
why_now
recommended_action
alternatives[]
consequence_of_delay
priority
risk
freshness_deadline
evidence_refs[]
canonical_targets[]
status                      pending | approved | rejected | deferred | superseded
decided_by
decided_at
reason
transaction_id              optional
```

### 8.2 Steve's Decision Center and master portal

Steve's preferred and already-decided primary human cockpit is **Obsidian**. The Decision Center should therefore live inside the Obsidian Brain Console plugin/cockpit, not require a second standalone browser portal.

`Brain Core` is the headless localhost API/control/safety boundary underneath that cockpit. It is not itself a human UI.

The standalone Next.js `projects/brain-console` web application on port `4881` is not required for CLR and must not become a second primary portal. Until a separate consolidation decision is executed, treat it as an optional/legacy diagnostics or specialist surface; do not add CLR-only human workflows there. CLR3 must explicitly reconcile/freeze overlapping portal responsibilities before adding Decision Center UI work.

The Obsidian view should show:

- pending count and priority;
- one compact decision card at a time;
- evidence/citations and current canonical context;
- recommendation plus alternatives;
- approve/reject/defer;
- explicit indication when approval still does not authorize automatic execution;
- completed decision history and linked transaction receipts.

`mind/inbox/processed/` remains a proposal/evidence location, but Steve should not have to manually browse it as the primary decision workflow once Decision Center exists.

### 8.3 Notification adapters

Core publishes an attention event when queue state changes. Adapters may include:

- Obsidian Brain Console badge + Obsidian Notice;
- macOS notification;
- daily email digest;
- Slack/Telegram for packaged deployments;
- future browser/mobile control plane.

Default anti-noise behavior:

- immediate notification for high-priority/high-risk decisions;
- notify on transition from no pending decisions to pending decisions;
- persistent badge/count;
- optional once-daily digest for normal items;
- no per-item notification storm.

Notifications never contain sensitive source text by default and never become a separate decision authority.

## 9. Live conversation alignment

Every supported session should receive a tiny bootstrap envelope containing:

- current Mind revision/freshness summary;
- current Brain capability/config revision;
- owner/authority boundary;
- retrieval tool entrypoints;
- current unresolved high-priority decision count;
- cache freshness if remote/offline.

Recommended default bootstrap budget: **target 300–800 tokens**, hard profile-specific ceiling. No project/personal corpus dump.

When a user message is strategic, planning-oriented, preference-sensitive, or conflicts with known canonical context, the broker may return an alignment signal:

```text
aligned
potentially_conflicting
conflicting
strategy_stale
insufficient_context
```

The LLM should proactively surface a conflict, cite current Mind strategy, and explain whether the user appears to be making a strategy change. It must not prevent the user from changing their own strategy.

If a durable decision is required, the conversation can create a Decision Core proposal. For the initial program, final durable approval remains in the Decision Center; inline chat confirmation does not silently mutate Mind.

## 10. Universal Context Broker

### 10.1 Stable logical API

Proposed transport-neutral operations:

```text
health
bootstrap
resolve
explain
align
decisions_status
learn_status
```

Potential CLI projection:

```text
prochat context health
prochat context bootstrap
prochat context resolve <query>
prochat context explain <pack-id>
prochat capabilities list
prochat capabilities inspect <capability-id>
prochat decisions list
prochat learn status
```

Potential MCP projection uses the same schemas. Brain Core HTTP may expose the same operations for local UIs.

### 10.2 `resolve` behavior

Input includes:

```text
query
workspace/repo
intent
token_budget
freshness_requirement
allowed_authorities
sensitivity
```

Output includes:

```text
context_pack_id
items[]
relations[]
citations[]
freshness[]
conflicts[]
unknowns[]
excluded[]
Mind revision
Brain revision
cache state
```

Progressive retrieval should stream/return small groups when the client supports it. Consumers may request more only when justified by the task.

### 10.3 Capability discovery and provider federation

Context and capabilities are separate contracts. A consumer may need fresh Mind/Brain context without any execution authority, or it may need to discover an applicable Brain capability without loading that capability's full instructions until selected.

The broker therefore exposes a **source-agnostic capability catalog**. Provider types may include:

```text
skill
orchestrator
runbook
named_cli
mcp_server
mcp_tool
validator
local_app
future_provider
```

A provider advertises compact versioned descriptors such as:

```text
provider_id
provider_kind
capability_id
summary
source_revision
input/output schema references
required context scopes
risk/confirmation class
execution transport reference
freshness/health
```

The catalog is discovery metadata, not an authority bypass. Actual execution remains owned by the consuming runtime's policy boundary (for Workbench: source lock, grants, confirmation, allowlisted commands/MCP scope, validation, and Git discipline).

Steve's Brain repository is one provider implementation that can publish skills, orchestrators, named CLI manifests, runbooks, and admitted MCP capability descriptors. Workbench must not encode Brain paths, Mind taxonomy, Steve identity, or Office/MacBook topology into its generic core. Other users may attach Git repositories, knowledge folders, enterprise catalogs, or other provider implementations that satisfy the same versioned contract.

Capability descriptors are retrieved progressively. Listing a skill or orchestrator must not inject its complete body into every chat; full instructions are resolved only after task relevance and policy permit it.

## 11. Cross-host runtime

### 11.1 Steve deployment

**Office Mac mini**

- canonical Brain `main` checkout;
- canonical Mind checkout/vault;
- primary Context Broker and Decision Core runtime;
- local evidence processing where authorized.

**MacBook**

- local Brain clone for skills/config portability;
- broker client uses local Brain metadata where safe and routes authoritative Mind/context calls to Office;
- transport uses the existing `office` SSH contract: Thunderbolt preferred, Tailscale fallback;
- cache last-known-good context packs with explicit age/staleness.

Consumer-facing APIs must not expose `/Users/Office/...` as a required contract. Host/path resolution belongs in deployment configuration.

### 11.2 Offline behavior

If Office is unreachable:

- return last-known-good cache only when policy allows;
- mark it stale with exact age and source revision;
- allow local Brain skill discovery from the MacBook clone;
- fail closed for operations requiring current Mind authority or current approval state.

## 12. Consumer adapter and conformance model

Every supported consumer gets an adapter describing what it can guarantee.

Conformance dimensions:

| Dimension | Requirement |
|---|---|
| Startup awareness | Knows the broker and tiny bootstrap contract. |
| Automatic bootstrap | Deterministic hook where client supports it; best-effort persistent instructions otherwise. |
| Mind resolve | Can request bounded cited Mind context. |
| Brain discovery | Can locate applicable skills/runbooks/capabilities without loading everything. |
| Alignment | Surfaces strategy conflict/freshness warnings. |
| Decisions | Can show pending status; durable approval path remains Decision Center initially. |
| Privacy | Does not expose private evidence through unsafe providers/logs. |
| Freshness | Exposes cache/source revision and stale state. |
| Failure mode | Fails closed or visibly degrades; never silently fabricates fresh context. |

Initial consumers:

- Claude Code/CLI;
- Codex App/CLI;
- Gemini CLI;
- Cursor;
- Kiro;
- Workbench;
- generic terminal/MCP clients.

A client that cannot guarantee an automatic startup tool invocation must be documented as such. Persistent prompt text is not equivalent to a deterministic hook.

## 13. Technology and module boundaries

Prefer existing Brain/ProChat OS technology rather than a new platform.

### 13.1 Core runtime recommendation

- TypeScript/Node 20-compatible core modules consistent with Brain Core/provider code;
- SQLite for local runtime ledger/relations/FTS where durable indexed state is needed;
- Git/Markdown remain canonical human-readable source for Mind/Brain content;
- JSON/JSONL receipts for compact audit/export where appropriate;
- MCP/stdio and localhost Brain Core HTTP as adapter transports;
- optional derived semantic/vector index behind an interface, never canonical and never required for basic operation.

Do not introduce a separate always-on graph database or vector service for the personal/local profile unless measured evidence later proves SQLite/FTS/relations insufficient.

### 13.2 Logical packages/modules

Design APIs so these can later become packages without forcing an immediate monorepo split:

```text
context-core          schemas, authority, freshness, context packs
relation-index        atoms/edges/search/compaction
context-broker        bootstrap/resolve/explain/align
capability-catalog     source-agnostic skills/orchestrators/runbooks/CLI/MCP discovery
conversation-adapters source discovery/normalization/watermarks
learning-engine       candidate extraction/classification
 decision-core         queue, approvals, notifications, receipts
learning-transactions prepared cross-repo application/validation
consumer-adapters     Claude/Codex/Gemini/Cursor/Kiro/Workbench
ui-adapters           Obsidian Brain Console, future web/mobile
```

All modules communicate through versioned schemas, not direct knowledge of Steve-specific paths.

## 14. Productization profiles

The same core should support deployment profiles:

### `personal-local`

One machine; local Brain/Mind; Obsidian optional.

### `personal-dual-host`

Office-style authority host + laptop client; local Brain replication; secure broker transport; stale cache.

### `business-single-tenant`

Dedicated workstation/VPS; tenant-specific Mind/Brain; web/Slack/Obsidian decision adapter; encrypted backup; explicit update channel.

### `managed-single-tenant`

Dedicated customer instance controlled through ProChat managed tooling; support/audit interfaces; no arbitrary shared customer datastore.

Core schemas must support tenant/subject identifiers without assuming Steve's folder taxonomy. A customer may use a simpler Mind structure while retaining the same authority/freshness/decision contracts.

## 15. Upgrade and migration principles

- version every public schema;
- supply deterministic migrations with dry-run and receipts;
- preserve old canonical content until new validation passes;
- treat derived indexes as rebuildable instead of migration-critical where possible;
- keep application runtime data outside Git;
- provide `doctor`, `status`, export/backup, and rollback surfaces;
- do not require Obsidian for headless/VPS operation;
- use adapter capability negotiation for client-specific behavior;
- keep private provider selection policy separate from learning logic.

## 16. Security and privacy boundaries

- Raw private conversations do not enter Git.
- Never ingest credentials/private keys/secrets as learning content.
- Evidence adapters must redact/classify before semantic processing.
- Private semantic extraction uses approved private model routing and fails closed.
- Decision notifications contain metadata/summary only by default.
- Broad Mind writes remain prohibited until transaction-level write authority is separately implemented and approved.
- No autonomous external actions are authorized by learning approval alone.
- Cross-host transport uses existing authenticated secure channels; the broker never weakens SSH/Tailscale policy.

## 17. Pilot metrics

Before any automatic promotion, report at least:

- ingestion coverage and adapter errors;
- duplicate event rate;
- candidate precision by category;
- user acceptance/rejection/defer rates;
- false strategy-conflict rate;
- stale-memory incidents detected/prevented;
- repeated failure recurrence after prevention proposals;
- skill duplication and pruning rate;
- median/p95 bootstrap and resolve token cost;
- median/p95 resolve latency;
- disk growth per processed evidence volume;
- hot-index/evidence size ratio;
- Decision Center backlog age;
- notification usefulness/noise rate;
- cross-host stale-cache frequency;
- consumer conformance pass rate.

Automation is blocked until these metrics demonstrate useful precision, bounded growth, and acceptable human review burden.

## 18. Specification-phase acceptance gates

This architecture is ready to enter implementation planning only when:

1. Mind authority charter is approved and linked.
2. No P1-P8 history is reopened or rewritten.
3. Existing Context Gateway, proposal approvals, memory, learner, rule-onboarding, skill pruning, Brain Console, and productization plans are explicitly reused.
4. Canonical vs evidence vs derived layers are unambiguous.
5. Freshness/supersession and relation models are defined.
6. Storage/compaction principles prevent naive transcript accumulation.
7. One logical Decision Core and Steve-facing Decision Center are defined.
8. Cross-repo logical atomicity is defined without pretending Git commits are physically atomic.
9. Context Broker API remains bounded and transport/client neutral.
10. Cross-host offline/staleness behavior is explicit.
11. Productization profiles avoid Steve/macOS/Obsidian hard dependency in the core.
12. No runtime mutation, ingestion, schedule, provider, or broad Mind write is activated by these documents.
