# Infinite Brain Context & Learning Runtime Implementation Plan

**Status:** proposed implementation handoff; CLR0 specification only is authorized
**Version:** 0.1
**Date:** 2026-08-15
**Roadmap:** `operations/specs/infinite-brain-context-learning-runtime-roadmap.md`
**Architecture:** `operations/specs/infinite-brain-context-learning-runtime-architecture.md`
**Human authority:** `/Users/Office/Repos/stevewesthoek/mind/system/infinite-brain-context-learning-charter.md`

## Execution contract

This is a post-P1-P8 program. Do not reuse or renumber completed P1-P8/B-task history.

Execute one bounded task at a time. For each task:

1. read only the named architecture/contract plus directly relevant source;
2. preserve current runtime behavior unless the task explicitly changes a report-only surface;
3. add focused deterministic validation;
4. stop on authority ambiguity, protected Mind overlap, secret exposure, unrelated dirty work, or a failed prerequisite;
5. do not ingest real conversations until CLR5 is separately authorized;
6. do not apply learning to canonical Mind/Brain until CLR7 is separately authorized;
7. do not enable autonomous promotion or external actions;
8. do not modify `feature/video-orchestrator`.

A task marked `not authorized` is design backlog only and must not be executed from this document without a new owner authorization.

## CLR0 — Architecture/specification package

### CLR0.1 — Record owner charter

- **Status:** complete in specification package.
- **Scope:** Mind `system/infinite-brain-context-learning-charter.md`.
- **Outcome:** human outcomes, lean-memory principle, Decision Center, freshness, failure learning, packaging, and non-goals are canonical human authority.
- **Validation:** cross-link from Brain architecture; no protected `.obsidian/**`, `kanban.md`, or task surface touched.

### CLR0.2 — Create technical architecture

- **Status:** complete in specification package.
- **Scope:** architecture spec.
- **Outcome:** authority/evidence/derived layers, atom/relations, freshness, evidence adapters, learning candidates, compaction, Decision Core, broker, cross-host, consumer, packaging, security, and metrics are defined.

### CLR0.3 — Create roadmap and implementation plan

- **Status:** complete in specification package.
- **Outcome:** CLR1-CLR8 are separately gated and no runtime activation is implied.

### CLR0 exit validation

- Brain/Mind document links resolve.
- No contradiction with completed Infinite Brain P1-P8 closure.
- No runtime/config/service/scheduler/provider changes.
- Secret scan and diff hygiene pass.

---

## CLR1 — Authority, freshness, storage, and schemas

**Authorization:** not authorized.

### CLR1.1 — Versioned core schema package

- **Purpose:** Define JSON/TypeScript schemas for knowledge atoms, relations, evidence events, decision items, transactions, context packs, and retention profiles.
- **Likely scope:** a new Brain-owned schema module under `projects/brain-core/src/` or a reusable package boundary selected during implementation; fixtures under tests.
- **Must reuse:** current `mind-context` pack/provenance semantics where compatible.
- **Validation:** schema fixtures for valid/invalid authority, freshness, supersession, privacy, and transaction states.
- **Stop:** do not create runtime databases or migrate live memory.

### CLR1.2 — Canonical-authority registry

- **Purpose:** Machine-readable mapping of content classes to Mind, Brain, evidence, derived, or ephemeral ownership.
- **Outcome:** validators reject a candidate that would create a parallel authority store.
- **Must include:** strategy/preferences/identity → Mind; skills/runbooks/rules/config/capability → Brain; transcripts → evidence; hot memory/index/cache → derived.
- **Validation:** cross-repo contract fixture tests.

### CLR1.3 — Freshness and supersession evaluator

- **Purpose:** Deterministically compute `fresh`, `review_due`, `stale`, `superseded`, `contradicted`, or `unknown` from schema metadata.
- **Boundary:** no model calls.
- **Validation:** time-bound fixtures, contradictory evidence fixtures, stable/volatile classes.

### CLR1.4 — Existing shared-memory inventory

- **Purpose:** Produce a report-only inventory of `~/.brain/memory/` entries classified as Mind candidate, Brain candidate, continuity, duplicate/superseded, or unresolved.
- **Privacy:** do not print private full text in reports; use paths/hashes/bounded summaries.
- **Boundary:** no move, delete, rewrite, or promotion.
- **Validation:** deterministic repeatability and zero live writes.

### CLR1.5 — Retention/compaction policy schema

- **Purpose:** Make every runtime storage class declare TTL/retention, compaction, rebuildability, and deletion authority.
- **Outcome:** no new runtime store can be introduced without a bounded-growth policy.
- **Validation:** reject "retain forever" derived caches unless explicitly justified/approved.

### CLR1 exit gate

- All schemas/versioning are stable enough for consumers.
- Shared-memory migration can be planned without data loss.
- No real evidence ingestion or canonical write has happened.

---

## CLR2 — Universal Context Broker and live alignment

**Authorization:** not authorized.

### CLR2.1 — Extract transport-neutral context-core interfaces

- **Purpose:** Define `health`, `bootstrap`, `resolve`, `explain`, `align`, `decisions_status`, `learn_status` interfaces.
- **Reuse:** `projects/mind-context/` discovery/resolve/explain logic and Brain capability discovery.
- **Boundary:** no new provider registration yet.

### CLR2.2 — Bootstrap envelope builder

- **Purpose:** Produce a tiny session envelope with Mind/Brain revisions, freshness, authority, entrypoints, decision count, and cache state.
- **Target:** 300-800 tokens by default; configurable hard ceiling.
- **Validation:** token-count tests and no corpus dumps.

### CLR2.3 — Mind-first / Brain-second resolver

- **Purpose:** Resolve task-relevant Mind context before Brain execution context when human meaning matters, while avoiding unnecessary Mind retrieval for purely mechanical tasks.
- **Validation:** representative eval corpus across strategy, coding, operations, and trivial tasks.

### CLR2.4 — Alignment signal

- **Purpose:** Return `aligned`, `potentially_conflicting`, `conflicting`, `strategy_stale`, or `insufficient_context` with citations.
- **Boundary:** warning/advice only; no strategy mutation.
- **Validation:** current-strategy, outdated-strategy, deliberate-pivot, and insufficient-evidence cases.

### CLR2.5 — Broker explainability

- **Purpose:** Explain included/excluded items, freshness decisions, authority, and relation paths.
- **Validation:** every context item has a citation/provenance explanation.

### CLR2 exit gate

- Context quality improves without default token bloat.
- The broker can detect strategy conflicts without treating strategy as immutable.
- All responses distinguish repository expectation from live runtime verification.

---

## CLR3 — Decision Core and human Decision Center

**Authorization:** not authorized.

### CLR3.1 — Extend existing proposal-approval store schema

- **Purpose:** Evolve `infinite-brain-proposal-approval-store` into a versioned Decision Core record without creating a second queue.
- **States:** pending, approved, rejected, deferred, superseded.
- **Boundary:** keep execution blocked.

### CLR3.2 — Decision aggregation API

- **Purpose:** Expose one Brain Core queue combining learning, freshness, strategy-conflict, compaction, and authority decisions.
- **Output:** compact cards with evidence refs, recommendation, alternatives, risk, priority, and freshness deadline.
- **Validation:** no sensitive raw transcript in default response.

### CLR3.3 — Brain Console Decision Center read UI

- **Purpose:** Add a shared Decision Center surface in Obsidian Brain Console.
- **Boundary:** first task is read-only; no approval buttons yet.
- **Validation:** pending count, sorting, citations, and empty state.

### CLR3.4 — Decision actions

- **Purpose:** Approve/reject/defer through existing Brain Core controlled API semantics.
- **Boundary:** recording approval still does not apply canonical changes.
- **Validation:** audit record, idempotency, stale proposal hash rejection.

### CLR3.5 — Obsidian notification adapter

- **Purpose:** Notify Steve of new important decision attention without flooding.
- **Default:** high-priority immediate, zero→pending transition, persistent badge, daily digest for normal items.
- **Validation:** dedupe notifications and redact sensitive content.

### CLR3.6 — Notification adapter interface

- **Purpose:** Define optional macOS/email/Slack/Telegram/web adapters over the same attention event.
- **Boundary:** no adapter stores decision authority.

### CLR3 exit gate

- All unresolved program decisions are discoverable in one logical queue.
- Steve can operate the queue from one Brain Console Decision Center.
- Notification volume is measured and bounded.

---

## CLR4 — Cross-host runtime and packaging foundation

**Authorization:** not authorized.

### CLR4.1 — Deployment profile schema

- **Profiles:** personal-local, personal-dual-host, business-single-tenant, managed-single-tenant.
- **Fields:** Brain/Mind discovery, broker endpoint/transport, cache policy, host identity, adapter enablement, privacy/provider policy.
- **Boundary:** no Steve-specific path in public schema defaults.

### CLR4.2 — Host-neutral path/config discovery

- **Purpose:** Replace consumer-visible absolute Office paths with deployment resolution.
- **Boundary:** preserve existing live configs until migration is separately approved.

### CLR4.3 — Dual-host broker transport fixture

- **Purpose:** Model Office authority host + MacBook client using an abstract secure transport.
- **Steve adapter:** existing `office` SSH alias, Thunderbolt preferred/Tailscale fallback.
- **Core:** must not know route/IP details.

### CLR4.4 — Stale last-known-good cache

- **Purpose:** Allow bounded offline read context with explicit source revision and age.
- **Fail closed:** no approval/current-Mind-required operation when stale.
- **Validation:** offline, expired-cache, reconnect, revision-change cases.

### CLR4.5 — CLI contract alignment

- **Purpose:** Extend existing ProChat OS CLI plan with `prochat context`, `prochat decisions`, and `prochat learn` namespaces.
- **Boundary:** spec/doctor/status first; no mutation commands until CLR7.

### CLR4.6 — Backup/export/update contract

- **Purpose:** Make runtime state portable and recoverable without treating derived indexes as irreplaceable.
- **Validation:** safe export excludes secrets/raw private evidence by default.

### CLR4 exit gate

- Local and dual-host fixtures use the same broker API.
- Core remains Obsidian/macOS/vendor-neutral.
- Upgrade/backup/export boundaries are explicit before ingestion.

---

## CLR5 — Conversation evidence adapters (report-only)

**Authorization:** not authorized.

### CLR5.1 — Evidence ledger

- **Purpose:** Local private ledger for normalized event metadata, relations to source, watermarks, processing status, and hashes.
- **Recommended store:** SQLite consistent with architecture; no raw transcript duplication by default.
- **Validation:** idempotency, restart recovery, bounded metadata growth.

### CLR5.2 — Claude Code adapter

- **Purpose:** Discover local session events incrementally through documented/current local sources.
- **Boundary:** report-only; no promotion.
- **Validation:** watermark resume, deletion/rotation tolerance, privacy classification.

### CLR5.3 — Codex adapter

- **Purpose:** Discover supported Codex local session/app evidence without modifying Codex databases or private runtime state.
- **Boundary:** use supported/read-only sources; no DB surgery.

### CLR5.4 — Gemini adapter

- **Purpose:** Normalize supported local Gemini sessions with the same contract.

### CLR5.5 — Cursor/Kiro capability investigation

- **Purpose:** Determine supported transcript/event surfaces.
- **Stop:** if no stable supported source exists, document unsupported/best-effort instead of scraping private internals.

### CLR5.6 — Workbench/ChatGPT adapter contract

- **Purpose:** Define ingestion through future supported export/event/capture surfaces.
- **Stop:** do not claim passive access that the host does not expose.

### CLR5.7 — Evidence coverage/health report

- **Purpose:** One report of sessions/events seen, watermarks, adapter errors, privacy exclusions, duplicates, and ledger growth.

### CLR5 exit gate

- Repeated runs create no duplicate events.
- No raw private conversations enter Git.
- Adapter failure never blocks normal LLM use.
- Storage growth remains bounded.

---

## CLR6 — Learning candidates, relations, and compaction

**Authorization:** not authorized.

### CLR6.1 — Deterministic candidate signals

- **Signals:** explicit corrections/decisions, repeated commands/tasks, known failure markers, repeated preference phrases, stale-knowledge references.
- **Boundary:** candidates only.

### CLR6.2 — Private semantic classifier

- **Purpose:** Classify ambiguous evidence into the architecture taxonomy.
- **Routing:** approved private provider only, fail closed, no fallback that violates policy.
- **Validation:** no private content in argv/logs; bounded request/timeouts.

### CLR6.3 — Failure episode builder

- **Purpose:** Build symptom→attempts→root cause→repair→invariant→prevention candidate records.
- **Reuse:** `brain-learn-failures` logic where useful.

### CLR6.4 — Destination classifier

- **Purpose:** Apply current rule-onboarding policy to choose test/hook/rule/runbook/skill/Mind/decision/discard destinations.
- **Boundary:** report-only.

### CLR6.5 — Duplicate merge and relation strengthening

- **Purpose:** Merge candidates targeting the same canonical concept, increment evidence relationships, and avoid repeated summaries.

### CLR6.6 — Supersession/revalidation candidates

- **Purpose:** Detect newer evidence conflicting with existing Mind/Brain knowledge and queue a human or source revalidation decision.

### CLR6.7 — Compaction and hot-index lifecycle

- **Purpose:** TTL/LRU caches, remove superseded hot entries, compact resolved candidates to receipts, preserve rebuildability.
- **Boundary:** no deletion of canonical/history sources.

### CLR6.8 — Pilot metrics report

- **Metrics:** precision, duplicate rate, relations/atom, hot-index ratio, disk growth per 1,000 messages, stale-hit rate, token/latency, decision burden.

### CLR6 exit gate

- Candidate quality is high enough that review saves time rather than creating work.
- Hot state grows sublinearly relative to evidence.
- No canonical promotion has occurred.

---

## CLR7 — Reviewed promotion and logical transactions

**Authorization:** not authorized.

### CLR7.1 — Prepared learning transaction

- **Purpose:** Create transaction with exact expected Mind/Brain revisions, proposed operations, approvals, and validation plan.
- **Boundary:** prepare-only first.

### CLR7.2 — Brain narrow application adapter

- **Purpose:** Apply an approved Brain-only lesson to a narrowly allowed path/category.
- **Initial candidate class:** documentation/runbook or learned-skill proposal in fixture/sandbox, not live broad mutation.
- **Validation:** exact paths, diff, tests, rollback receipt.

### CLR7.3 — Mind narrow application adapter

- **Purpose:** Apply an explicitly approved exact-path Mind change under existing authority rules.
- **Prerequisite:** separate Mind-write authorization and fixture proof.
- **Stop:** no broad writer.

### CLR7.4 — Cross-repo transaction visibility gate

- **Purpose:** Broker exposes new learning only after transaction `complete`.
- **Validation:** partial Mind-only or Brain-only application remains invisible as active truth.

### CLR7.5 — Compensation/rollback

- **Purpose:** Restore/compensate partial transactions with audit receipt.

### CLR7.6 — Existing-memory migration pilot

- **Purpose:** Promote a small reviewed sample from `~/.brain/memory/` into correct canonical/derived destinations without losing historical evidence.
- **Boundary:** owner-reviewed sample only.

### CLR7 exit gate

- Atomic visibility is proven.
- Narrow rollback is proven.
- No new broad mutation surface exists.

---

## CLR8 — Consumer conformance, measured automation, and productization certification

**Authorization:** not authorized.

### CLR8.1 — Consumer adapter contract tests

For each supported client verify:

- startup awareness;
- automatic bootstrap guarantee level;
- Mind resolve;
- Brain skill/capability discovery;
- freshness/strategy feedback;
- decision pending awareness;
- privacy/failure behavior.

### CLR8.2 — Claude adapter

- Use deterministic hooks where supported.
- Prove bootstrap does not duplicate large context.

### CLR8.3 — Codex adapter

- Cover App and CLI supported configuration/MCP surfaces.
- Prove no manual "load Mind" prompt is required in the supported path.

### CLR8.4 — Gemini adapter

- Use global config plus broker integration available to the current client.

### CLR8.5 — Cursor/Kiro adapters

- Use supported IDE rule/MCP/startup mechanisms; label best-effort where a deterministic first-turn hook is unavailable.

### CLR8.6 — Workbench adapter

- Define the same broker/context contract for Workbench sessions; do not rely on hidden access to hosted conversation history.

### CLR8.7 — End-to-end Steve dual-host pilot

- Office authority host + MacBook client;
- home Thunderbolt and Tailscale paths;
- offline stale-cache test;
- Decision Center notification;
- strategy-conflict session;
- failure-learning candidate;
- no automatic promotion.

### CLR8.8 — Product profile certification

At minimum:

- personal-local install/doctor/backup/update;
- personal-dual-host install/doctor;
- business-single-tenant headless broker + non-Obsidian decision adapter fixture;
- no Steve-specific paths or IDs in public schemas.

### CLR8.9 — Automation proposal

- Analyze pilot metrics.
- If warranted, propose narrowly scoped auto-promotion classes.
- **This task cannot authorize them.** New owner policy required.

### CLR8 exit gate

- Supported clients behave consistently enough for normal use.
- Human review burden is acceptable.
- Hot memory remains bounded.
- Freshness and conflict warnings are useful rather than noisy.
- Packaged profiles install/update/recover predictably.

---

## Validation families to add over the program

The exact scripts may be chosen during implementation, but the program should converge on these validation families:

```text
validate:context-learning-contracts
validate:context-learning-authority
validate:context-learning-freshness
validate:context-learning-storage
validate:context-learning-decisions
validate:context-learning-transactions
validate:context-learning-consumers
validate:context-learning-productization
```

Each validator must distinguish repository conformance from live runtime proof.

## Global stop conditions

Stop the current task immediately if:

- it would make conversation evidence canonical without review;
- it would introduce a second human-truth store beside Mind;
- it would place raw private transcripts in Git;
- it would bypass the Decision Core for a required human decision;
- it would make derived indexes irreplaceable;
- it would create unbounded retention without compaction policy;
- it would require scraping unsupported private client databases;
- it would hardcode Steve/Office paths into core public contracts;
- it would enable broad Mind writes;
- it would auto-promote skills/strategy/decisions without separate approval;
- it would change completed P1-P8 history or `feature/video-orchestrator`;
- validation shows context/storage growth is becoming linear and unbounded.

## First implementation authorization recommendation

When the owner chooses to begin runtime work, authorize **CLR1 only**.

Do not authorize conversation ingestion first. Authority, freshness, retention, Decision Core schemas, and shared-memory migration inventory must exist before the system starts learning from additional evidence.
