# Infinite Brain Runtime — Roadmap

**Document ID:** IBR-ROADMAP-001  
**Date:** 2026-06-07  
**Last updated:** 2026-06-18  
**Status:** Current milestone complete — manual/report-only Infinite Brain runtime operational; future automation track deferred

## Current Milestone Boundary (2026-06-18)

### Complete — manual/report-only runtime

The following capabilities are implemented, tested, and ready for use:

- Brain Core service and nightly report infrastructure;
- read-only Mind inspection via report-only Mind Steward workflows;
- persistent Brain-owned inbox queue state with idempotency and content-hash tracking;
- debounce, stability detection, and concurrency controls;
- duplicate-prevention and retry/failure-buffer visibility;
- approval and execution gates with kill switch;
- bounded queue-state reconstruction with honest result metadata;
- report-only/manual Mind use (all durable writes require explicit human approval);
- disabled continuous runner by default (`continuousEnabled: false`, `watcherEnabled: false`);
- scheduler planning and readiness surfaces;
- phase-9 safety capabilities: stable-file detection, failure buffer, large-file nightly fallback plan;
- stale-page detector recall for the required freshness-metadata positive case validated by `test:mind-maintenance-loader-stale`, including Mind-style fenced YAML status blocks;
- report-only Mind structural validator implemented as a Brain Core module/CLI (`mind-structure-validator`) with pass/warn/fail checks for required Mind surfaces, maintenance pilot paths, report outputs, freshness metadata, Graphify output naming, and generated/runtime truth boundaries.

The current release is usable without continuous processing. No claim of black-box self-optimization is made. No LaunchAgent changes were made.

### Future automation track — not required for current use

The following capabilities are deferred and must not be treated as current:

- auto-starting continuous runner;
- approved real-Mind operational trial;
- persisted pause/recovery state across process restarts;
- automatic resume after failure;
- scheduler integration for inbox-queue dry-run;
- feedback learning and policy self-optimization;
- Brain-to-Mind approved writes (beyond current bounded write adapters);
- demonstrated time savings relative to manual processing.

Continuous processing remains disabled. These items require separate approval, evidence of value, and explicit enablement before they may be activated.

### Post-plan improvement backlog — documentation first

These items are approved for roadmap tracking only. They must be split into implementation-plan tasks before any code, automation, folder migration, or continuous behavior is built.

From the Infinite Brain OS repo review:

- Brain-owned Mind structural validator/report for required Mind surfaces, freshness metadata, Graphify output naming, maintenance pilot paths, and report outputs — implemented as a report-only Brain Core module/CLI on 2026-07-05;
- lightweight session closeout receipts for significant AI/repo sessions, recording branch, commits, changed files, validation, remaining dirty state, decisions, and next task — implemented in Mind as `system/session-closeout-receipt-template.md` on 2026-07-05;
- processed-capture receipts when inbox volume requires auditability from intake to ignored/summarized/promoted/task outcome — implemented in Mind as `system/processed-capture-receipt-template.md` on 2026-07-05;
- `operations/system-configs/**` ownership audit to separate canonical config from generated adapter shims, live local machine state, logs, and machine-specific files.

From the OODA / Infinite Brain transcript review:

- strengthen Mind as Brain's orientation layer through compact current-context, strategy, constraint, source-quality, active-project, and decision-principle briefs;
- define an intake-disposition pattern before adding more ingestion automation: ignore/archive, deterministic action, knowledge proposal, task proposal, project update proposal, maintenance finding, or source-quality rejection;
- add source-quality gates before promotion so external transcripts/newsletters/emails/meetings do not become durable Mind knowledge merely because they were ingested;
- add a lightweight wager/verdict pattern for significant business or workflow changes, including expected improvement, measurement window, evidence source, later verdict, and follow-up action;
- prefer routed model tiers: deterministic rules first, cheap model for simple classification, stronger model only for high-context or strategic orientation work.

These are future report-only/design-first improvements. They do not authorize continuous processing, hidden loops, autonomous durable writes, or broad ingestion.

---

## Executive Summary

This roadmap sequences 18 phases (IB0–IB17) for evolving Brain's existing automation foundations into a Unified Knowledge Graph Runtime (UKGR). Implementation did not begin from zero: Brain Core, scheduler visibility, Mind Steward report-only workflows, Graphify, the bounded Mind maintenance pilot, decision handling, and approval-oriented safety boundaries already exist.

The foundational bridge and report-only maintenance infrastructure (queue state, debounce, retries, failure buffer, approval gates, kill switch, bounded reconstruction) is now complete. The system is usable today in manual/report-only mode. Phase IB0 and beyond address the UKGR ambition; they are not required for the current operational release.

**Timeline:** Phase-gated. Dates are estimates only and must not override acceptance criteria or safety boundaries.

**Risk level:** Medium. Scheduler, queue, approval, recovery, and cross-repo contract alignment must remain proven before write-capable or continuous behavior is enabled.

**Go/no-go decision point:** Before any approved durable Mind write and again before any continuous watcher.

## Canonical philosophy

Read `operations/specs/infinite-brain-philosophy.md` first. It is the shared philosophy contract for Infinite Brain across Brain and Mind.

## Non-Negotiable User Experience Principles

The Infinite Brain Runtime must be a black-box improvement layer for Steve, not a new manual filing system.

Steve should not need to:

- remember entity types;
- maintain graph edges;
- move notes into a taxonomy;
- run startup rituals;
- manually clean stale information;
- change his capture, strategy, research, or project workflow.

The runtime should:

- classify, atomize, summarize, index, and connect knowledge automatically;
- keep Mind human-readable and strategically useful;
- keep Brain responsible for execution, scheduling, reports, and safety gates;
- surface status in Brain Console instead of requiring command memorization;
- use report-only and approval-gated phases before any knowledge mutation;
- use AI Model Selector for all model/provider choices;
- use Graphify for repo/context graphing without turning Graphify into a knowledge-writing engine;
- reject hidden continuous loops until they are observable, reversible, and feature-flagged.

---

## Target Architecture

```
INFINITE BRAIN RUNTIME (IBR)

┌─────────────────────────────────────────────────────────┐
│  OPERATOR INTERFACE                                     │
│  - Brain Console: Status display, job controls          │
│  - Scheduler UI: Approve/deny job execution            │
│  - Query interface: Natural language graph search       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  ORCHESTRATION LAYER                                    │
│  - Scheduler: Job scheduling + approval gates           │
│  - Brain Core: Action registry + execution plans        │
│  - Safety gates: Feature flags + environment checks     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  KNOWLEDGE MAINTENANCE LAYER                            │
│  - Entity deduplication                                 │
│  - Relationship inference + conflict resolution        │
│  - Evidence linking (edges → sources)                   │
│  - Version history extraction                           │
│  - Inbox processing (captures → entities)               │
│  - Insight generation (patterns → hypotheses)           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  PERSISTENCE LAYER                                      │
│  - Mind vault (markdown)                                │
│  - Brain graphs (JSON + artifacts)                      │
│  - Entity changelog (ENTITY_CHANGELOG.jsonl)            │
│  - Evidence store (EVIDENCE_STORE.jsonl)                │
│  - Version index (VERSION_INDEX.jsonl)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  SOURCE SYSTEMS                                         │
│  - Graphify: Extraction + relationship export           │
│  - Mind Steward: Inbox classification + routing         │
│  - iOS sync: Obsidian Git (read-only from runtime)      │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Groups

### Group A: Foundation (IB0–IB4)
Setup, hardening, and first soft-launch candidate

### Group B: Knowledge Maintenance (IB5–IB9)
Core entity and relationship maintenance automation

### Group C: Continuous Reasoning (IB10–IB13)
Insight generation and pattern discovery

### Group D: Query & Discovery (IB14–IB17)
Unified query interface and advanced retrieval

---

## Detailed Phases

### IB0 — Project Initialization & Configuration

**Scope:** Setup project structure and decision points

**Deliverables:**
- `INFINITE_BRAIN_RUNTIME_CONFIG.json` — Configuration file
  - Entity type whitelist (Tasks, Decisions, Projects, Concepts, Sources)
  - Edge type whitelist
  - Confidence thresholds for relationship inference
  - Update frequency (daily 00:00 UTC)
  - Hard limits (max notes per week, max vault size)
- `IBR_DECISION_LOG.md` — Document decision points D1–D5 from inventory
- `.github/workflows/ibr-daily-update.yml` — GitHub Actions workflow (optional, for scheduled execution)

**Decision gates:**
- D1: Entity type whitelist (recommend: Medium / B)
- D2: Edge inference strategy (recommend: Conservative / A)
- D3: Update frequency (recommend: Scheduled / B)
- D4: Versioning model (recommend: Dual / C)
- D5: iOS sync coordination (recommend: Safe / B)

**Estimated effort:** 2 days (planning + config creation)

**Status:** Ready to start after roadmap approval

---

### IB1 — Entity Changelog Infrastructure

**Scope:** Create append-only entity mutation log

**Deliverables:**
- `ENTITY_CHANGELOG.jsonl` — Append-only log of entity mutations
  - Schema: `{ timestamp, entity_id, entity_type, action (created|updated|deleted), author, source_job, diff_summary }`
- Mutation logging adapter (`projects/brain-core/src/adapters/entity-changelog.ts`)
  - Log before-and-after state for updates
  - Track author (runtime vs. Steve)
  - Track source job (which scheduler candidate made the change)
- Utility scripts:
  - `tools/scripts/entity-changelog-dump.sh` — View recent mutations
  - `tools/scripts/entity-changelog-stats.sh` — Stats on mutation frequency by type

**Validation:**
- ✅ Append-only; never overwrite
- ✅ Valid JSON-lines format
- ✅ All mutations logged before writes to Mind
- ✅ Human-readable summary in each log line

**Estimated effort:** 3 days (schema design + adapter + utilities)

**Dependencies:** IB0 (config exists)

**Status:** Queued for IB0 completion

---

### IB2 — Evidence Store & Source Linking

**Scope:** Create structured evidence tracking

**Deliverables:**
- `EVIDENCE_STORE.jsonl` — Links edges to supporting sources
  - Schema: `{ edge_id, source_ids (array), strength_score (0.0–1.0), added_by, timestamp }`
- Source reference schema (extend Mind frontmatter):
  - `sources_cited` field in edges (link to sources)
  - `evidence_level` field: high|medium|low (enum)
- Evidence linking adapter (`projects/brain-core/src/adapters/evidence-store.ts`)
  - Attach evidence to inferred edges
  - Score edges by confidence (input to confidence threshold)
  - Query edges by evidence strength

**Validation:**
- ✅ All inferred edges have evidence entry
- ✅ Edge IDs are valid (exist in graph)
- ✅ Confidence score is numeric (0.0–1.0)

**Estimated effort:** 3 days (schema + adapter + queries)

**Dependencies:** IB0 (config exists), IB1 (optional but recommended)

**Status:** Queued for IB0–IB1 completion

---

### IB3 — iOS Sync Coordination

**Scope:** Safely coordinate Mind writes with iOS sync

**Deliverables:**
- Git lock detection utility (`tools/scripts/detect-git-lock.sh`)
  - Check for `.git/index.lock` in Mind
  - If lock exists, wait with exponential backoff (max 5 min)
  - Timeout → fail the job (preserve iOS changes)
- Mind write coordinator (`projects/brain-core/src/adapters/mind-write-coordinator.ts`)
  - Before write: check lock + git status
  - Detect local uncommitted changes (bail if present)
  - Implement pull-before-write for safety
  - Queue writes if lock active
- Verification script (`tools/scripts/verify-ios-sync-ready.sh`)
  - Check Mind is clean (no uncommitted changes)
  - Check no git lock
  - Check iOS sync is not active

**Validation:**
- ✅ Detects lock and waits
- ✅ Aborts if timeout
- ✅ Verifies Mind is clean before write
- ✅ Rolls back on conflict

**Estimated effort:** 2 days (lock detection + coordinator + verification)

**Dependencies:** IB0 (config exists)

**Status:** Queued for IB0 completion

---

### IB4 — Entity Deduplication (First Soft-Launch Candidate)

**Scope:** Find and flag duplicate notes in Mind

**Deliverables:**
- Deduplication algorithm (`tools/scripts/find-entity-duplicates.sh`)
  - Semantic similarity matching (title + content)
  - Exact title match detection
  - Cross-folder duplicate search
  - Report: `DEDUPLICATION_REPORT.json`
    - Candidate pairs: (entity_1, entity_2, similarity_score, conflict_level)
    - Conflict levels: exact|high|medium|low
- Scheduler candidate (`scheduler-run-entity-deduplication-mind`)
  - Blocked mode: Report-only, no action
  - Executable mode: Flag conflicts for Steve review (future)
- Steve approval workflow:
  - Show duplicates in Brain Console
  - Steve manually merges or dismisses
  - Scheduler removes duplicate (if approved)

**Soft-Launch Plan:**
- Week 1: Run in blocked mode (report-only)
- Week 2: Run executable mode (flag, wait for Steve approval)
- Week 3+: Add to daily schedule (run every Sunday)

**Validation:**
- ✅ Detects exact matches
- ✅ Detects high-similarity duplicates
- ✅ No false positives (manual review gates)
- ✅ Scheduler candidate passes typecheck + builds

**Estimated effort:** 5 days (algorithm + scheduler candidate + soft-launch)

**Dependencies:** IB0 (config + decision gates), IB1 (changelog), IB3 (iOS sync coordination)

**Status:** Queued for IB3 completion (go/no-go decision after this phase)

---

### IB5 — Relationship Inference & Scoring

**Scope:** Auto-infer edges between entities with confidence scoring

**Deliverables:**
- Inference engine (`tools/scripts/infer-relationships.ts`)
  - Semantic similarity scoring (entity descriptions)
  - Title overlap detection
  - Explicit link detection (markdown [[references]])
  - Confidence scoring: 0.0–1.0
  - Output: (entity_1, entity_2, edge_type, confidence, reasoning)
- Relationship conflict resolver
  - Compare inferred edges to existing edges in graph
  - Detect contradictions (e.g., both "supports" and "contradicts")
  - Report conflicts for manual resolution
- Scheduler candidate (`scheduler-run-relationship-inference-mind`)
  - Blocked mode: Report all inferred edges (no action)
  - Executable mode: Create edges above confidence threshold
  - Conflict mode: Flag contradictions (require Steve approval to override)

**Configuration (from IB0):**
- Confidence threshold (default: >0.75)
- Max edges per entity (default: 20)
- Edge creation policy (conservative/balanced/aggressive)

**Validation:**
- ✅ Detects existing edges (avoids duplicates)
- ✅ Confidence scores are well-calibrated (compare to manual verification)
- ✅ No false contradictions

**Estimated effort:** 6 days (inference + resolver + scheduler candidate)

**Dependencies:** IB0, IB1, IB4 (deduplication ran first to clean up duplicates)

**Status:** Queued for IB4 completion

---

### IB6 — Inbox Processing & Entity Creation

**Scope:** Automate captures → entities conversion

**Deliverables:**
- Inbox classifier (extend Mind Steward)
  - Existing: Route to wiki/tasks/router
  - New: Extract entity metadata (type, title, key claim)
  - New: Detect category (task|decision|concept|source|note)
- Entity creation workflow
  - New entity generated from capture
  - Schema applied (frontmatter)
  - Changelog entry created
  - Entity added to appropriate folder
- Scheduler candidate (`scheduler-run-inbox-processing`)
  - Blocked mode: Preview entities to create (no action)
  - Executable mode: Create entities + move captures
  - Preview shows entity metadata for Steve review

**Configuration:**
- Auto-create thresholds (when to auto-generate vs. flag for manual)
- Entity type rules (which types are auto-creatable)

**Validation:**
- ✅ All captures processed
- ✅ Metadata extraction is accurate
- ✅ Entities placed in correct folders
- ✅ Changelog entries created

**Estimated effort:** 5 days (classifier + workflow + scheduler candidate)

**Dependencies:** IB0, IB1, IB3 (iOS sync)

**Status:** Queued for IB5 completion

---

### IB7 — Version History Extraction & Indexing

**Scope:** Build queryable entity history from git

**Deliverables:**
- Version history extractor (`tools/scripts/extract-entity-history.ts`)
  - Parse git log for entity file changes
  - Extract versions: entity_id → [v1, v2, v3, ...]
  - Track who changed it (git author) and when
  - Cache in `VERSION_INDEX.jsonl`
- Version index schema:
  - `{ entity_id, type, versions: [{ timestamp, author, commit_hash, summary }], last_updated }`
- History query utility (`tools/scripts/query-entity-history.sh`)
  - Show when entity was created/updated
  - Show who touched it last
  - Show recent changes
- Scheduled index job (`scheduler-run-version-history-index`)
  - Blocked mode: Show indexing plan
  - Executable mode: Update VERSION_INDEX.jsonl with recent changes
  - Run daily (after Mind write jobs)

**Validation:**
- ✅ All entities indexed
- ✅ Version history is accurate (matches git log)
- ✅ Query utilities work on indexed data

**Estimated effort:** 4 days (extractor + indexing + queries)

**Dependencies:** IB0, IB1

**Status:** Queued for IB6 completion

---

### IB8 — Metadata Standardization

**Scope:** Enforce consistent entity frontmatter across Mind vault

**Deliverables:**
- Frontmatter schema validator (`tools/scripts/validate-entity-frontmatter.ts`)
  - Required fields: id, title, type, created, updated
  - Optional fields: status, tags, author, version, sources_cited, evidence_level
  - Enforce types and formats
  - Report missing/invalid fields
- Fixer utility (`tools/scripts/fix-entity-frontmatter.sh`)
  - Auto-add missing fields (id generation, timestamps)
  - Normalize formats
  - Preview changes before applying
- Scheduler candidate (`scheduler-run-metadata-standardization`)
  - Blocked mode: Report non-compliant entities
  - Executable mode: Fix frontmatter
  - Show diff before applying

**Validation:**
- ✅ All entities conform to schema
- ✅ No data loss during fixing
- ✅ IDs are globally unique

**Estimated effort:** 3 days (validator + fixer + scheduler candidate)

**Dependencies:** IB0, IB1, IB7 (optional; version field)

**Status:** Queued for IB7 completion

---

### IB9 — Relationship Audit & Repair

**Scope:** Validate and repair relationship integrity

**Deliverables:**
- Relationship validator
  - Check all edges point to valid entities
  - Detect broken links (entity deleted but edge remains)
  - Detect orphan edges (no source or target)
  - Report relationship health (% valid edges)
- Repair workflow
  - Remove broken edges
  - Suggest merges for orphaned edges
  - Report changes to changelog
- Scheduler candidate (`scheduler-run-relationship-audit`)
  - Blocked mode: Audit report (health score)
  - Executable mode: Clean up broken edges
  - High-risk: Requires Steve approval

**Validation:**
- ✅ All edges valid after repair
- ✅ No orphan relationships
- ✅ Changelog records repairs

**Estimated effort:** 3 days (validator + repair + scheduler)

**Dependencies:** IB0, IB1, IB5

**Status:** Queued for IB8 completion

---

### IB10 — Insight Generation Engine (Basic)

**Scope:** Generate patterns and hypotheses from knowledge graph

**Deliverables:**
- Pattern detector
  - Find entity clusters (frequently-related concepts)
  - Detect missing edges (A relates to B, B relates to C, but A and C aren't connected)
  - Find concept chains (prerequisite relationships)
  - Report: `PATTERN_REPORT.json`
- Hypothesis generator
  - Synthesize patterns into testable hypotheses
  - Example: "If Decisions share these three Concepts, then the Concept usually leads to Outcome"
  - Rank hypotheses by evidence strength
  - Output: `HYPOTHESES.jsonl`
- Scheduler candidate (`scheduler-run-insight-generation`)
  - Blocked mode: Preview insights
  - Executable mode: Add hypotheses to Mind (as special entities)
  - Run weekly (Sunday night)

**Configuration:**
- Min cluster size (default: 3 entities)
- Min evidence for hypothesis (default: 0.7 confidence)
- Max hypotheses per week (default: 10)

**Validation:**
- ✅ Patterns are valid (supported by edges)
- ✅ Hypotheses are testable
- ✅ No duplicate hypotheses

**Estimated effort:** 7 days (pattern detection + hypothesis generation + scheduler)

**Dependencies:** IB0, IB1, IB5, IB7

**Status:** Queued for IB9 completion

---

### IB11 — Question Backlog & Hypothesis Tracking

**Scope:** Formalize questions and track hypothesis validation

**Deliverables:**
- Question entity type (new)
  - Schema: id, title, type: question, related_concepts, answering_hypotheses, status (open|answered|abandoned)
  - Can be auto-generated from gaps (e.g., "Why does A relate to B?")
- Hypothesis entity type (extend from IB10)
  - Schema: id, title, type: hypothesis, predictions, evidence_strength, validation_attempts
  - Track when hypothesis was tested
  - Track results (confirmed|refuted|inconclusive)
- Scheduler candidate (`scheduler-run-question-suggestion`)
  - Find unanswered questions in Mind
  - Suggest answers based on graph
  - Flag for Steve to research
  - Run weekly

**Validation:**
- ✅ Questions are well-formed (answerable)
- ✅ Hypotheses track validation progress
- ✅ No abandoned questions pile up

**Estimated effort:** 4 days (entity types + tracking + scheduler)

**Dependencies:** IB0, IB6, IB10

**Status:** Queued for IB10 completion

---

### IB12 — Concept Gap Detection & Suggestion

**Scope:** Find missing concepts and suggest new entities

**Deliverables:**
- Gap detector
  - Find topics mentioned in multiple places but no formal Concept entity
  - Example: "Trust" mentioned in 5 notes, no Concept entity
  - Suggest new concept with related notes
  - Report: `CONCEPT_GAPS.json`
- Scheduler candidate (`scheduler-run-concept-gap-detection`)
  - Find gaps in current graph
  - Suggest new concepts
  - Preview entity to create
  - Run weekly

**Validation:**
- ✅ Gaps are real (supported by mentions)
- ✅ Suggested concepts are useful (not trivial)

**Estimated effort:** 3 days (gap detection + scheduler)

**Dependencies:** IB0, IB1, IB6

**Status:** Queued for IB11 completion

---

### IB13 — Insight Dashboard & Reporting

**Scope:** Create reports of runtime insights

**Deliverables:**
- Weekly insight report (`INSIGHT_REPORT.weekly.md`)
  - Patterns discovered this week
  - Hypotheses validated (and results)
  - Questions answered
  - New concepts suggested
  - Relationship health summary
- Dashboard component (Brain Console extension)
  - Show weekly trends (entities/edges added, insights generated)
  - Show hypothesis validation rate
  - Show question backlog
  - Show concept gaps
- Report generation scheduler (`scheduler-run-generate-weekly-report`)
  - Runs Sunday night (after weekly jobs)
  - Generates INSIGHT_REPORT.md
  - Notifies Steve

**Validation:**
- ✅ Reports are accurate (match underlying data)
- ✅ Trends are meaningful

**Estimated effort:** 4 days (report generation + dashboard + scheduler)

**Dependencies:** IB0, IB10–IB12

**Status:** Queued for IB12 completion

---

### IB14 — Unified Graph Query Interface

**Scope:** Single query interface for Mind + Brain graphs

**Deliverables:**
- Query orchestrator (`/query` skill)
  - Natural language → graph queries
  - Routes to Mind graph or Brain graph (or both)
  - Returns unified results
- Query adapter layer
  - Mind query: Search markdown + graph.json
  - Brain query: Search Graphify output
  - Result union: Deduplicate across graphs
- Query examples:
  - "What decisions depend on the Decision: Hire an engineer?"
  - "What are the recent questions about Trust?"
  - "Which concepts appear in both my research and my tasks?"

**Validation:**
- ✅ Query results are accurate
- ✅ No false duplicates (same entity in both graphs)
- ✅ Natural language routing works

**Estimated effort:** 5 days (query engine + adapter + routing)

**Dependencies:** IB0, IB7, Graphify (already exists)

**Status:** Queued for IB13 completion

---

### IB15 — Advanced Retrieval & Ranking

**Scope:** Improve search quality with relevance ranking

**Deliverables:**
- Ranking engine
  - BM25 scoring for full-text search
  - Entity proximity scoring (how close in graph)
  - Recency boost (newer entities rank higher)
  - User interaction boost (entities Steve recently edited)
  - Combining scores: weighted average
- Query refinement
  - Suggest related queries
  - Offer to expand/narrow search
  - Show reasoning (why this result ranked high)

**Validation:**
- ✅ Ranking feels intuitive (top results are relevant)
- ✅ Reasoning is clear

**Estimated effort:** 4 days (ranking + refinement + UI)

**Dependencies:** IB0, IB14

**Status:** Queued for IB14 completion

---

### IB16 — Cross-Platform Entity Sync

**Scope:** Sync entities between Mind and Brain as appropriate

**Deliverables:**
- Sync rules engine
  - Define which entities should sync (config)
  - Example: "Decisions from Mind → Brain entities"
  - One-way vs. two-way sync
- Sync adapter
  - Transform Mind entity → Brain representation
  - Transform Brain entity → Mind representation
  - Handle conflicts (same entity modified in both places)
- Scheduler candidate (`scheduler-run-cross-platform-sync`)
  - Blocked mode: Show sync plan
  - Executable mode: Sync entities
  - Detect and flag conflicts for Steve

**Configuration:**
- Entity type sync rules (which types sync)
- Sync direction (mind→brain, brain→mind, both)
- Conflict resolution strategy

**Validation:**
- ✅ Entities sync correctly
- ✅ No data loss
- ✅ Conflicts detected

**Estimated effort:** 5 days (rules + adapter + scheduler)

**Dependencies:** IB0, IB1, IB3, IB8

**Status:** Queued for IB15 completion

---

### IB17 — Continuous Reasoning Loop (Future)

**Scope:** Enable continuous runtime reasoning without Steve's intervention

**Deliverables:**
- Autonomous reasoning loop
  - Run insight generation daily (not just weekly)
  - Auto-update hypotheses based on new evidence
  - Auto-generate new questions
  - Rate-limit: no more than 10 new entities/day
- Loop exit conditions
  - Max iterations (e.g., 5 cycles/day)
  - Timeout per job (10 minutes)
  - Loop termination on no-new-insights (dry run)
- Scheduling
  - Distributed throughout day (not all at once)
  - Stagger jobs to avoid conflicts
  - Pause during iOS sync windows

**Validation:**
- ✅ Loop terminates (doesn't run forever)
- ✅ New entities stay within limits
- ✅ No performance degradation

**Estimated effort:** 6 days (loop + scheduling + safeguards)

**Dependencies:** All prior phases (IB0–IB16)

**Status:** Queued for IB16 completion (optional; nice-to-have)

---

## Timeline & Milestones

### Sprint 1 (Weeks 1–2): Foundation
- IB0: Project initialization
- IB1: Entity changelog
- IB2: Evidence store
- IB3: iOS sync coordination
- **Milestone:** Foundation complete; ready for soft-launch

### Sprint 2 (Weeks 3–4): First Candidate
- IB4: Entity deduplication (soft-launch)
- **Go/no-go decision:** After IB4 (reassess timeline and risks)
- If GO: Proceed to Sprint 3
- If NO-GO: Pause; reassess roadmap

### Sprint 3 (Weeks 5–7): Knowledge Maintenance
- IB5: Relationship inference
- IB6: Inbox processing
- IB7: Version history
- **Milestone:** Knowledge maintenance ready

### Sprint 4 (Weeks 8–10): Standardization & Quality
- IB8: Metadata standardization
- IB9: Relationship audit
- **Milestone:** All entities validated

### Sprint 5 (Weeks 11–13): Insights & Patterns
- IB10: Insight generation
- IB11: Question tracking
- IB12: Concept gaps
- IB13: Insight reporting
- **Milestone:** Runtime generating insights

### Sprint 6 (Weeks 14–16): Query & Discovery
- IB14: Unified query interface
- IB15: Advanced retrieval
- **Milestone:** Unified search ready

### Sprint 7 (Weeks 17–18): Integration & Continuous
- IB16: Cross-platform sync
- IB17: Continuous reasoning loop (optional)
- **Milestone:** IBR fully operational

**Total timeline:** 18 weeks (4.5 months) assuming 1 developer, 60% effort allocation

---

## Risk Mitigation

### Risk 1: iOS Sync Conflicts

**Likelihood:** High  
**Impact:** Lost Mind changes or merge conflicts  
**Mitigation:** IB3 (iOS sync coordination); queue writes; detect lock; wait or abort

### Risk 2: Relationship Hallucination

**Likelihood:** Medium  
**Impact:** Incorrect edges added to graph  
**Mitigation:** IB5 (confidence scoring + conservative strategy); evidence store; manual approval gates

### Risk 3: Entity Explosion

**Likelihood:** Medium  
**Impact:** Mind vault grows unmanageably  
**Mitigation:** IB0 (hard limits config); IB6 (inbox processing gate); IB4 (dedup); rate limits

### Risk 4: Performance Degradation

**Likelihood:** Low–Medium  
**Impact:** Query/index slow; nightly jobs don't finish  
**Mitigation:** IB7 (index caching); IB14 (query optimization); Monitor runtime metrics

### Risk 5: Approval Gate Fatigue

**Likelihood:** Medium  
**Impact:** Steve ignores approval gates; makes mistakes  
**Mitigation:** Smart defaults (auto-safe jobs); show only important approvals; dashboard feedback

---

## Decision Gates & Checkpoints

### Gate 1: Planning Approval
- **When:** Now (before IB0 starts)
- **Decision:** Proceed with roadmap as written, or modify?
- **Checkpoint:** Steve approves IB0–IB17 phases

### Gate 2: Foundation Readiness
- **When:** End of Sprint 1 (after IB3)
- **Checkpoint:** All foundation components built and tested

### Gate 3: Go/No-Go (Soft-Launch)
- **When:** End of Sprint 2 (after IB4 deduplication soft-launch)
- **Checkpoint:** Deduplication worked reliably; no data loss; Steve confident
- **Decision:** Continue to full rollout (IB5+), or pause?

### Gate 4: Halfway Review
- **When:** End of Sprint 4 (after IB9)
- **Checkpoint:** All core maintenance jobs working; insights generated
- **Decision:** Continue to query/discovery phases (IB14+), or stop?

### Gate 5: Launch Readiness
- **When:** End of Sprint 6 (after IB15)
- **Checkpoint:** Unified query interface works; advanced search ready
- **Decision:** Proceed to continuous loop (IB17)?

---

## Success Criteria

### Functional Criteria
- ✅ All 18 phases complete and tested
- ✅ 10+ scheduler candidates running safely
- ✅ Entity count stable (no runaway growth)
- ✅ Relationship graph has >500 valid edges
- ✅ Weekly insights generated consistently
- ✅ Zero data loss incidents

### Operational Criteria
- ✅ Daily runtime jobs complete in <10 min
- ✅ No manual intervention needed (except approvals)
- ✅ Steve approves >80% of safeguarded jobs
- ✅ Approval gates catch 100% of risky operations

### Quality Criteria
- ✅ Relationship inference confidence >0.75
- ✅ Hypothesis validation rate >60%
- ✅ Search result relevance (top-3 precision) >0.85
- ✅ Entity deduplication F1 score >0.90

---

## Recommendation

**Status:** ✅ Roadmap complete and ready for planning approval.

**Next steps:**
1. Steve reviews roadmap (phases, timeline, risks)
2. Steve approves or requests modifications
3. Upon approval: Start IB0 project initialization
4. Proceed through sprints; gate at IB4 (soft-launch validation)

**Timeline to start:** Anytime after planning approval; no dependencies on external systems.

**Decision required:** Approve roadmap and proceed to implementation planning (next document)?
