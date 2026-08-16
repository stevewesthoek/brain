# Infinite Brain Context & Learning Runtime Roadmap

**Status:** CLR0-CLR2 accepted; CLR3-CLR8 not authorized; no conversation ingestion or learning promotion active
**Version:** 0.1
**Date:** 2026-08-15
**Architecture:** `operations/specs/infinite-brain-context-learning-runtime-architecture.md`
**Human authority:** `/Users/Office/Repos/stevewesthoek/mind/system/infinite-brain-context-learning-charter.md`

## Program boundary

This is a new program after the completed P1-P8 Infinite Brain runtime roadmap. It does not reopen, renumber, or reinterpret P1-P8 or the completed Mind implementation plan.

The program namespace is `CLR` — Context & Learning Runtime.

Current state:

```text
P1-P8 Infinite Brain runtime roadmap: CLOSED
Mind implementation plan: CLOSED
CLR0 architecture/specification: COMPLETE
CLR1 authority/freshness/storage/schema foundation: COMPLETE
CLR2 universal context broker/live alignment: COMPLETE
CLR3-CLR8 runtime implementation: NOT AUTHORIZED
```

No roadmap status in this document is live runtime truth. Future live status must have a separate Brain-owned status surface after implementation begins.

## Success definition

The program succeeds when supported AI clients can begin with a tiny fresh Mind-first/Brain-second orientation, retrieve precise context on demand, learn from conversation evidence through a reviewed and freshness-aware pipeline, route all unresolved human decisions into one logical Decision Center, and keep hot memory/storage/context cost bounded as evidence grows.

The result must be installable and configurable for personal, dual-host, business single-tenant, and managed single-tenant deployments without hardcoding Steve, Office, macOS, Obsidian, or one LLM into the core.

## Program principles

- Evidence grows; hot memory should not grow proportionally.
- Relationships and supersession should replace duplicate textual accumulation.
- One logical decision queue; multiple notification/UI adapters.
- Live strategy feedback is proactive; durable human authority remains explicit.
- Core contracts are transport-neutral and client-neutral.
- Derived indexes are rebuildable.
- Raw private conversations stay outside Git.
- Deterministic prevention outranks textual memory for recurring failures.
- No automatic promotion before measured report-only evidence justifies it.
- Single-tenant/local-first before multi-tenant complexity.

## CLR0 — Architecture and contract closure

**Status:** complete and accepted 2026-08-15.

### Objective

Define the authority, freshness, evidence, relation, storage, decision, broker, transaction, adapter, cross-host, productization, and safety contracts before touching runtime behavior.

### Deliverables

- Mind owner charter;
- Brain architecture spec;
- Brain roadmap;
- Brain implementation plan;
- explicit no-runtime-activation boundary.

### Exit gate

CLR0 exits only when:

1. the four documents agree on authority and terminology;
2. `~/.brain/memory/` has an explicit future role as derived hot recall rather than independent Mind truth;
3. the Decision Core/Decision Center model is explicit;
4. lean-storage and compaction requirements are measurable;
5. packaging profiles and client-neutral interfaces are explicit;
6. runtime phases remain unstarted.

## CLR1 — Authority, freshness, storage, and schema foundation

**Status:** complete and accepted 2026-08-15.

**Acceptance evidence:** `operations/reports/clr1-authority-freshness-storage-acceptance-2026-08-15.md`

### Objective

Implement only the versioned schemas, validators, and report-only inventory needed to distinguish canonical Mind/Brain truth from evidence, candidates, decisions, transactions, and derived indexes.

### Required outcomes

- knowledge atom + relation schema;
- freshness/supersession schema;
- evidence event schema;
- decision item schema;
- logical transaction/receipt schema;
- retention/compaction profile schema;
- inventory/migration report for existing `~/.brain/memory/` without moving or deleting data;
- schema/version compatibility tests.

### Exit gate

No ingestion or writes. Schemas validate fixtures, current sources can be classified without ambiguity, and an existing-memory migration report is reviewable without content loss.

## CLR2 — Universal Context Broker and live alignment

**Provider rule:** exact-source/canonical Mind+Brain retrieval is the correctness baseline. CBM, Graphify, embeddings, or future retrieval providers remain optional adapters and must degrade visibly to bounded exact-source behavior. Workbench is a consumer/bridge, not a canonical retrieval provider; its integration must use the same source-agnostic context and capability contracts as any other client.

**Status:** complete and accepted 2026-08-15 as a read-only repository implementation; live consumer activation remains unclaimed.

**Acceptance evidence:** `operations/reports/clr2-context-broker-live-alignment-acceptance-2026-08-15.md`

### Objective

Turn existing Context Gateway and Brain capability discovery into one bounded, transport-neutral context interface.

### Required outcomes

- `health`, `bootstrap`, `resolve`, `explain`, `align`, `capabilities_list`, `capabilities_inspect`, `decisions_status`, `learn_status` contracts;
- source-agnostic capability catalog for skills, orchestrators, runbooks, named CLIs, MCP servers/tools, validators, and future providers; discovery only in CLR2, with execution still owned by each consumer's existing policy boundary;
- 300-800 token target bootstrap envelope with configurable hard ceiling;
- Mind-first then Brain-second resolution ordering;
- freshness/conflict/unknown signals in every relevant pack;
- strategy-alignment signal and cited proactive conflict guidance;
- no automatic durable decision or write from inline chat;
- deterministic exact-source verification where Brain/runtime facts require it.

### Exit gate

Representative prompts demonstrate that context quality improves without default context bloat. Strategy drift is surfaced with citations and stale strategies are not treated as immutable truth.

## CLR3 — Decision Core, Obsidian Decision Center, and notifications

**Status:** not authorized.

### Objective

Give the human one logical place for unresolved durable decisions while keeping presentation adapters replaceable.

### Required outcomes

- reconcile the existing UI directions first: Obsidian remains the single primary human cockpit; Brain Core remains the headless API/control boundary; the standalone `projects/brain-console` web app on port `4881` is optional/legacy for CLR and receives no Decision Center-only feature work;
- extend existing Infinite Brain proposal approval store/API rather than create a second queue;
- pending/approved/rejected/deferred/superseded decision lifecycle;
- compact evidence and recommendation packets;
- dedicated Decision Center in Brain Console for Steve;
- pending-count badge;
- Obsidian notification adapter;
- configurable daily digest and high-priority notification rules;
- adapter contract for future macOS/email/Slack/Telegram/web notifications;
- no sensitive source text in default notification payloads.

### Exit gate

Steve can process all program decisions from one Decision Center. Notification noise remains bounded and no UI channel becomes a separate authority store.

## CLR4 — Cross-host runtime and packaging foundation

**Status:** not authorized.

### Objective

Make the broker and decision contracts location-neutral and installable before conversation ingestion begins.

### Required outcomes

- host-neutral configuration/discovery;
- versioned source/provider manifests so context and capability providers are install/configuration concerns rather than hardcoded application logic;
- Steve's Brain/Mind pair as one reference provider profile, with fixtures for alternate context/capability sources that do not use Steve's taxonomy or paths;
- Office local authority-host profile;
- MacBook client profile using local Brain clone plus authoritative remote Mind/context access;
- Thunderbolt/Tailscale transport hidden behind deployment configuration;
- stale last-known-good cache with explicit age;
- fail-closed behavior for operations requiring current Mind/decision state;
- `personal-local`, `personal-dual-host`, `business-single-tenant`, and `managed-single-tenant` profiles;
- CLI/doctor/export/backup/update contract aligned with existing ProChat OS plans;
- no hard requirement on Obsidian or macOS in core schemas.

### Exit gate

The same broker contract works in local and dual-host fixtures with no `/Users/Office` assumption in consumer-facing APIs. Offline behavior is explicit and tested.

## CLR5 — Conversation evidence adapters, report-only

**Status:** not authorized.

### Objective

Incrementally discover and normalize conversation evidence without creating canonical memory.

### Initial adapter order

1. Claude Code local sessions;
2. Codex local sessions/app evidence where supported;
3. Gemini local sessions;
4. Cursor/Kiro only where supported interfaces exist;
5. Workbench/ChatGPT only through supported export/event surfaces or explicit capture.

### Required outcomes

- source adapter interface;
- watermarks/idempotency/content hashing;
- privacy classification/redaction boundary;
- no raw transcript duplication into Git;
- source-owned evidence references;
- adapter health/coverage report;
- report-only normalized ledger;
- no semantic processing through an unapproved provider.

### Exit gate

Repeated scans create no duplicate events, private material does not leak, adapters can resume from watermarks, and disk growth from ledger metadata is demonstrably bounded.

## CLR6 — Learning candidates, relational strengthening, and compaction

**Status:** not authorized.

### Objective

Convert evidence into report-only learning candidates and relationship updates without promotion.

### Required outcomes

- explicit decision detection;
- strategy conflict/update candidates;
- repeated preference/workflow candidates;
- failure episode extraction;
- deterministic prevention ranking;
- skill/runbook/rule/test/hook destination classification using existing onboarding policy;
- duplicate-candidate merging;
- relation strengthening instead of repeated summaries;
- supersession/revalidation candidates;
- hot-index compaction and cache TTL/LRU behavior;
- disk/context growth metrics.

### Exit gate

Candidate precision, duplicate rate, hot-index/evidence ratio, and human-review burden meet pilot thresholds. No canonical Mind/Brain content is changed.

## CLR7 — Reviewed promotion and logical learning transactions

**Status:** not authorized.

### Objective

Allow approved proposals to become validated canonical changes with logical cross-repo atomicity.

### Required outcomes

- prepared transaction with exact expected Brain/Mind revisions;
- explicit operation list and approvals;
- Mind and Brain application adapters with narrow authority;
- validation before transaction completion;
- partial/blocked/compensating/rollback states;
- context visibility only after `complete` receipt;
- migration of eligible `~/.brain/memory/` entries without losing history;
- no broad Mind write capability;
- no external action authorization implied by learning approval.

### Exit gate

Fixture and controlled dry-run transactions prove that partial changes cannot become active context and rollback/compensation preserves canonical truth.

## CLR8 — Universal consumer conformance and measured automation pilot

**Status:** not authorized.

### Objective

Make the system seamless across supported tools, measure actual value/cost, and authorize only narrow automation classes that evidence supports.

### Consumer targets

- Claude Code/CLI;
- Codex App/CLI;
- Gemini CLI;
- Cursor;
- Kiro;
- Workbench;
- generic MCP/terminal clients.

### Required outcomes

- consumer conformance matrix and deterministic tests where possible;
- automatic startup bootstrap where the client has a true hook;
- clearly labeled best-effort behavior where only persistent instructions exist;
- proactive alignment/freshness feedback;
- Brain skill discovery without loading all skills;
- source-agnostic capability discovery for skills, orchestrators, runbooks, named CLIs, MCP servers/tools, and validators, with Steve's Brain as one provider profile rather than a Workbench hard dependency;
- Workbench conformance proving it can consume both bounded Mind/Brain context and admitted Brain capabilities through generic provider contracts, while other installations can substitute different context/capability sources;
- Decision Center pending awareness;
- measured pilot metrics for precision, stale incidents, token overhead, latency, disk growth, decision backlog, notification noise, and recurrence of learned failures;
- productization/upgrade/backup/export certification for at least personal-local and single-tenant profiles.

### Automation gate

Automatic promotion remains prohibited by default. Any later auto-promotion class must have a separately approved policy defining category, confidence/evidence requirements, rollback, audit, and exclusion boundaries.

### Program exit gate

The program can be called complete only when:

1. supported clients reliably receive fresh bounded context without manual prompting;
2. all unresolved durable human decisions converge on one logical queue;
3. evidence processing demonstrably improves retrieval/learning without linear hot-state growth;
4. stale/superseded knowledge is handled explicitly;
5. recurring failures can produce proactive deterministic prevention;
6. cross-host behavior is stable and freshness-visible;
7. the system is installable/upgradeable through documented profiles;
8. measured automation remains inside proven safe classes;
9. no parallel human-truth store exists beside Mind;
10. product/customer deployment does not require Steve-specific paths or taxonomy.

## Explicitly deferred

Not authorized by this roadmap alone:

- continuous autonomous model calls;
- broad Mind mutation;
- automatic strategy changes;
- ingesting unsupported hosted-client private databases;
- deleting source conversation evidence outside its owning retention policy;
- automatic skill publication without the review gate;
- multi-tenant shared customer memory infrastructure;
- replacing Obsidian/Mind Markdown as Steve's human-readable canonical source;
- reopening completed P1-P8 or changing `feature/video-orchestrator`.
