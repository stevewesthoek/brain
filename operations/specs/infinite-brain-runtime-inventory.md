# Infinite Brain Runtime — Inventory & Current State

**Document ID:** IBR-INVENTORY-001  
**Date:** 2026-06-07  
**Status:** Current (safe for action)

## Executive Summary

This document inventories the existing Brain runtime infrastructure, Mind vault structure, and current knowledge system architecture. It identifies gaps, safety risks, and prerequisites for evolving toward an Infinite Brain Runtime (IBR) — a continuous, AI-assisted knowledge graph that maintains entities, relationships, and insights autonomously while preserving Steve's intentionality and control.

**Current state:** Partial; islands of automation exist (Graphify, scheduler, Mind Steward) but are not connected as a unified runtime.

**Target state:** Unified Knowledge Graph Runtime (UKGR) with entity and relationship maintenance, continuous reasoning, and operator-controlled execution gates.

---

## Existing Infrastructure

### Brain Core System

**Location:** `projects/brain-core/src`

**Core Components:**
1. **Scheduler** (`adapters/scheduler.ts`) — Job runner with approval gates
2. **Action Registry** (`adapters/actions.ts`) — Task registration and tracking
3. **Execution Plans** (`adapters/execution-plans.ts`) — Plan definitions with safety candidates
4. **Approval Store** (`adapters/approval-store.ts`) — Persistent approval tracking
5. **Brain Console** (`projects/brain-console-center/`) — Web UI for status and control

**Current capabilities:**
- ✅ Approval gate model for guarded execution
- ✅ Scheduler job definitions with status tracking
- ✅ Multi-plan candidate system (safe vs. risky variants)
- ✅ Status endpoint (`GET /graphify/status`)
- ✅ Browser UI showing execution status and safety flags

**Limitations:**
- ❌ No entity mutation tracking (Brain Core doesn't track what changed in Mind/Brain)
- ❌ No relationship graph maintenance (edges not auto-maintained)
- ❌ No continuous reasoning loop (scheduler runs tasks, but no autonomous insight generation)
- ❌ Limited to Graphify tasks; other entity types not integrated
- ❌ No historical fact versioning

---

### Graphify Orchestrator (O1–O8)

**Location:** `tools/graphify/`, `operations/specs/graphify-*.md`

**Completion:** 100% (all safe phases delivered, June 7 2026)

**Current capabilities:**
- ✅ Preflight analysis (report-only, always safe)
- ✅ Blocked update validation (proves guardrails, no mutations)
- ✅ Executable update (gated, requires `GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true`)
- ✅ Semantic build readiness preview (shows selector status, no execution)
- ✅ Hook/watch planning (disabled by schema, ready for future enablement)
- ✅ AI Model Selector integration (preview + resolution)
- ✅ Brain Console visibility (status surface)

**Safety model:**
- Feature flags prevent accidental repo writes
- Schema-level enforcement of hook/watch disabled
- Scheduler integration provides approval gates
- Two execution paths: blocked (validation) and executable (guarded)

**Integration:**
- Scheduler candidates: 10 total (4 safe preflight/validation, 4 semantic preview, 2 executable update)
- Brain Console displays: output validation status, selector flags, safety fields
- AI Model Selector contact: delegation for full/critical-rebuild model selection

**Limitations:**
- Graphify updates only graph artifacts, not source Knowledge graph (graph.json)
- No continuous runtime (manual trigger or scheduled job only)
- No query-time entity generation (Graphify is extract/resolve only)
- Hook/watch still disabled (future phase)

---

### Mind Steward Orchestration

**Location:** `projects/brain-core/` (routing), `operations/specs/1779034874780-mind-steward-mind-write-apply-policy.md`

**Current capabilities:**
- ✅ Inbox classification (raw captures categorized)
- ✅ Write-apply policy enforced (prevents unauthorized Mind writes)
- ✅ Task processing (captures → tasks)
- ✅ Router-based routing (inbound → capture → wiki → tasks)

**Limitations:**
- ❌ No entity linking (captures not auto-linked to existing entities)
- ❌ No relationship inference (new notes don't infer edges to related notes)
- ❌ No conflict resolution (duplicate entity detection only manual)
- ❌ Limited to inbox; doesn't maintain existing entities

---

### Mind Vault Structure

**Location:** `/Users/Office/Repos/stevewesthoek/mind/`

**Physical structure:**
```
mind/
  01-inbox/              # Raw captures (daily, weekly, misc)
  02-strategy/           # Strategic decisions and planning
  03-projects/           # Active projects (Yeshua Academy, ProChat, brain, mind)
  04-tasks/              # 742+ atomic work items
  05-areas/              # Long-term responsibilities
  06-sources/            # Research sources (books, papers, web, transcripts)
  07-wiki/               # Knowledge wiki areas
  08-live/               # Active work and daily notes
  09-router/             # Routing decisions and workflow state
  10-system/             # System configuration and metadata
  .graphify-out/          # Graphify-generated artifacts (graph.json, html, reports)
```

**Entity density:** ~1,500+ notes across all areas (estimated from disk usage and structure)

**Knowledge graph state:**
- ✅ graph.json exists (from Graphify extraction)
- ✅ Entities: Decisions, Concepts, Projects, Tasks, People, Resources
- ❌ Relationships: extracted by Graphify but not updated by Mind Steward
- ❌ No backlinks or reference tracking in markdown

**Constraints:**
- iOS sync via Obsidian Git plugin (bidirectional, ~200MB per clone)
- Plugin ecosystem: CSS snippets, dataview, quick-capture, templater
- Markdown-only (no database, all text)
- Steve is the sole author (no multi-user collaboration expected)

---

## Current Knowledge Structure (Mind + Brain)

### Entity Types (Observed)

From Mind vault analysis:

| Type | Current count | Source | Auto-maintained? | Steve-maintained? |
|------|---------------|--------|------------------|-------------------|
| Tasks | 742+ | 04-tasks/ | Partial (scheduler) | Yes |
| Projects | 8+ | 03-projects/ | No | Yes |
| Decisions | 50+ | 02-strategy/, 09-router/ | No | Yes |
| Concepts | 200+ | 07-wiki/ | No | Yes |
| Sources | 100+ | 06-sources/ | No | Yes |
| People | 30+ | 07-wiki/people/ | No | Yes |
| Areas | 5+ | 05-areas/ | No | Yes |
| Notes | 500+ | 08-live/, 07-wiki/ | Partial (daily captures) | Yes |

**Missing entity types:**
- Hypotheses (no formal structure)
- Questions (no backlog)
- Patterns (no library)
- Facts (no evidence store)
- Bookmarks (scattered across sources)
- Custom types (none formalized)

### Relationship Types (Observed)

From Mind graph.json and markdown links:

| Edge type | Current coverage | Direction | Auto-inferred? | Needs maintenance? |
|-----------|------------------|-----------|--------|-------------------|
| `supports` | Partial | bidirectional | No | Yes |
| `contradicts` | Rare | bidirectional | No | Yes |
| `depends_on` | Common in tasks | directed | Partial (scheduler) | Yes |
| `derived_from` | Partial | directed | No | Yes |
| `related_to` | Common | bidirectional | No | Yes |
| `part_of` | Common | directed | No | Yes |
| `preceded_by` | Rare | directed | No | Yes |
| `followed_by` | Rare | directed | No | Yes |
| `authored` | Partial | directed | Graphify | No |
| `tagging` | Partial | directed | Partial | Yes |

**Missing relationship inference:**
- `contradicts` — No conflict detection
- `derived_from` — No evidence tracking
- `supports` — No citation/evidence system
- `updated_by` — No version history
- `depends_on` — Only for tasks; not for concepts/decisions

---

## Atomic Note Guidance (Current)

**Observed structure in Mind:**

```markdown
---
id: note-{uuid}
title: Note Title
type: decision|concept|project|task|source|person|area
status: active|archived|planning
created: 2026-06-07
updated: 2026-06-07
tags: [tag1, tag2]
---

## Content

2–5 sentences on the core idea.

## Context

Where this came from, why it matters.

## Related

- [[Note A]] (relationship)
- [[Note B]] (relationship)

## Sources

- [Title](url) — accessed date
```

**Current state:**
- ✅ Most notes have id/title/type/created/updated
- ❌ Not all notes have explicit relationships
- ❌ No standardized status field
- ❌ Tags exist but not consistently applied
- ❌ Sources are mixed (some links, some text)
- ❌ No explicit evidence field

**Recommended pattern (not yet implemented):**
- Target length: 100–300 lines (focused idea, not comprehensive)
- Metadata: id, title, type, status, tags, created, updated, author, version
- Structure: Core idea → Context → Related notes → Evidence/Sources
- Version field: track when AI last touched vs. Steve last edited
- Maintenance flag: mark notes that need human review vs. AI-only maintenance

---

## Safety Risks & Constraints

### Current Risks

1. **Scope creep:** Brain+Mind are open-ended. IBR could attempt to "maintain" everything without Steve's intent.
   - **Mitigation:** Explicit entity type whitelist; scheduler approval gates; operator control only

2. **Relationship hallucination:** AI could infer false edges between concepts without evidence.
   - **Mitigation:** Require evidence field; show inferred edges separately; Steve approves edge creation

3. **Entity duplication:** Two notes about the same concept not recognized; runtime creates duplicates.
   - **Mitigation:** Entity deduplication stage before update; show conflicts for Steve to resolve

4. **Uncontrolled growth:** Runtime creates notes autonomously until Mind vault is unnavigable.
   - **Mitigation:** Hard limits (notes per week, max vault size); scheduler gates

5. **iOS sync collisions:** Mind Steward writes while iOS sync in progress → merge conflicts.
   - **Mitigation:** Detect Obsidian git locks; queue writes when sync active; prioritize iOS

6. **Execution runaway:** Scheduler loop runs forever if approval gate fails.
   - **Mitigation:** Loop exit conditions; max iterations per job; timeout per candidate

### Current Constraints

| Constraint | Current state | Impact | Workaround |
|-----------|---------------|--------|-----------|
| Single author | Steve only | No multi-user sync needed | Keep iOS sync simple |
| iOS sync | Obsidian Git | Runtime writes trigger re-sync | Queue Mind writes; prioritize iOS |
| Markdown-only | No DB | No transactions or atomic operations | Write via FS + git; validate before commit |
| Schema-free | Obsidian notes | No type enforcement | Frontmatter only; validation via script |
| Graphify execution | Manual/scheduled | No continuous extraction | Future hook/watch enablement (phase O8) |
| AI Model Selector | Operator-gated | Premium models blocked without approval | Use Haiku by default; show when escalation needed |
| Brain Core capacity | ~4 concurrent jobs | Low concurrency | Sequence long operations; parallelize short ones |

---

## Integration Gaps

### Gap 1: Entity Mutation Tracking
- **Problem:** Brain Core doesn't know what changed when Mind Steward runs
- **Current:** Mind writes succeed/fail; no entity changelog
- **Needed:** Track entity mutations (created/updated/deleted + timestamp + author)
- **Proposal:** ENTITY_CHANGELOG.jsonl in Mind root; append-only log

### Gap 2: Relationship Inference & Maintenance
- **Problem:** Relationships not auto-maintained; new edges need Steve's hands
- **Current:** Graphify extracts edges; scheduler doesn't update them
- **Needed:** Entity relationship update job (runs post-extraction)
- **Proposal:** Scheduler candidate: `scheduler-run-relationship-inference`

### Gap 3: Continuous Reasoning Loop
- **Problem:** No insight generation; runtime is task-execution only
- **Current:** Scheduler runs predefined jobs; no autonomous reasoning
- **Needed:** Insight generation job (runs periodically, generates patterns/hypotheses)
- **Proposal:** Scheduler candidate: `scheduler-run-insight-generation` (weekly, summary)

### Gap 4: Unified Query Interface
- **Problem:** Brain entities (graphify) and Mind entities (markdown) are separate
- **Current:** Graphify query is Brain-only; Mind has no equivalent
- **Needed:** Query layer that spans Mind+Brain graphs
- **Proposal:** `/query` skill that accepts natural language and queries both graphs

### Gap 5: Evidence & Source Tracking
- **Problem:** Relationships have no evidence; easy to assert unsupported edges
- **Current:** Mind notes have @Sources section (text links)
- **Needed:** Structured evidence store linking edges to sources
- **Proposal:** EVIDENCE_STORE.jsonl (edge_id → source_ids + strength score)

### Gap 6: Version History
- **Problem:** No record of what changed or when
- **Current:** git log exists but not queryable by entity
- **Needed:** Entity-level version history (who changed what when)
- **Proposal:** Extract from git log; index by entity ID and timestamp

---

## Existing Automation Candidates (Ready to Connect)

### Scheduler Jobs Already Safe to Run

From Graphify rollout:
- ✅ `scheduler-run-graphify-preflight-mind`
- ✅ `scheduler-run-graphify-preflight-brain`
- ✅ `scheduler-run-graphify-update-mind-blocked` (validation only)
- ✅ `scheduler-run-graphify-update-brain-blocked` (validation only)
- ✅ `scheduler-run-graphify-update-mind` (executable, approval-gated)
- ✅ `scheduler-run-graphify-update-brain` (executable, approval-gated)
- ✅ `scheduler-run-graphify-full-brain-selector-preview`
- ✅ `scheduler-run-graphify-full-mind-selector-preview`
- ✅ `scheduler-run-graphify-critical-rebuild-brain-selector-preview`
- ✅ `scheduler-run-graphify-critical-rebuild-mind-selector-preview`

### Potential New Candidates (IBR Foundation)

Not yet implemented, but architecture ready:
- ⏳ `scheduler-run-entity-deduplication-mind` (find duplicate notes)
- ⏳ `scheduler-run-relationship-inference-mind` (infer edges + show conflicts)
- ⏳ `scheduler-run-inbox-processing` (captures → entities)
- ⏳ `scheduler-run-insight-generation` (find patterns, generate hypotheses)
- ⏳ `scheduler-run-version-history-index` (extract entity history from git)

---

## Decision Points for Next Phase

### D1: Entity Type Whitelist

**Question:** Which entity types should IBR maintain?

**Options:**
A. Narrow (safe): Tasks, Decisions, Projects only
B. Medium (balanced): Tasks, Decisions, Projects, Concepts, Sources
C. Full (ambitious): All types + Custom types

**Recommendation:** Medium (B). Focus on core types first; Custom types add complexity. Concepts and Sources are stable and won't break if auto-generated.

**Action:** Define whitelist in `INFINITE_BRAIN_RUNTIME_CONFIG.json`

### D2: Edge Inference Strategy

**Question:** How aggressive should relationship inference be?

**Options:**
A. Conservative: Only infer edges with >90% confidence; require Steve approval for edge creation
B. Balanced: Infer edges with >70% confidence; show conflicts; auto-create low-conflict edges
C. Aggressive: Infer edges with >50% confidence; create autonomously; Steve can delete

**Recommendation:** Conservative (A). False edges worse than missing edges. Steve can add them manually.

**Action:** Implement inference with confidence scoring + approval gate

### D3: Update Frequency

**Question:** How often should IBR update Mind?

**Options:**
A. Manual: Only when Steve runs scheduler job
B. Scheduled: Daily (00:00 UTC, after iOS sync)
C. Triggered: Post-Graphify extraction, post-Inbox processing

**Recommendation:** Scheduled (B). Daily updates are predictable; Steve knows when to expect changes.

**Action:** Add daily job to scheduler at 00:00 UTC

### D4: Versioning Model

**Question:** How should entity versions be tracked?

**Options:**
A. Git-only: Rely on `git log` for history
B. Metadata: Add version field to entity frontmatter
C. Dual: Both git history + version field for quick lookup

**Recommendation:** Dual (C). git log is source of truth; version field enables fast entity history queries.

**Action:** Implement version increment on every entity change

### D5: iOS Sync Coordination

**Question:** How should IBR handle iOS Obsidian sync?

**Options:**
A. Naive: Write freely; let iOS sync handle conflicts (risk: merge conflicts)
B. Safe: Detect Obsidian git lock; queue writes until sync done
C. Integrated: Wait for iOS push before running IBR; pull first

**Recommendation:** Safe (B). Detect lock file and queue writes. Safe by default; no manual resolution needed.

**Action:** Add `.git/index.lock` check before Mind writes

---

## Prerequisites for IBR Enablement

### Phase 0: Foundation (Complete)
- ✅ Graphify orchestrator standardized (all phases delivered)
- ✅ Brain Core scheduler architecture exists
- ✅ Mind vault structure stable
- ✅ Atomic note patterns observed

### Phase 1: Inventory & Planning (This Document)
- ✅ Current state documented (this inventory)
- ⏳ Roadmap created (roadmap.md)
- ⏳ Implementation plan created (implementation-plan.md)
- ⏳ Decision points documented (above)

### Phase 2: Foundation Hardening (Before IBR Execution)
- ⏳ Entity type whitelist defined and tested
- ⏳ ENTITY_CHANGELOG.jsonl schema created
- ⏳ EVIDENCE_STORE.jsonl schema created
- ⏳ iOS sync coordination implemented
- ⏳ Deduplication algorithm tested (in isolation)
- ⏳ Inference confidence scoring implemented
- ⏳ Approval gate infrastructure extended (for new scheduler candidates)

### Phase 3: Scheduler Candidate Creation
- ⏳ Implement 5 new scheduler candidates (dedup, inference, inbox, insights, version index)
- ⏳ Validate each candidate in blocked/preview mode first
- ⏳ Add approval gates and status tracking

### Phase 4: Soft Launch
- ⏳ Enable scheduler jobs on manual-trigger basis only
- ⏳ Steve approves each job before execution
- ⏳ Monitor for errors, conflicts, duplicates
- ⏳ Adjust inference thresholds based on real runs

### Phase 5: Automated Cadence
- ⏳ Enable scheduled daily jobs (00:00 UTC)
- ⏳ Auto-execute safe jobs (preflight, blocked validation)
- ⏳ Require approval for executable jobs (inference, updates)

### Phase 6: Continuous Runtime (Future)
- ⏳ Evaluate hook/watch enablement for Graphify (phase O8+)
- ⏳ Consider real-time inbox capture trigger
- ⏳ Evaluate autonomous reasoning loop (weekly insights)

---

## Recommendation

**Status:** ✅ Inventory complete. Ready to proceed to Roadmap.

**Next steps:**
1. Review this inventory for accuracy (Steve can add notes/corrections)
2. Proceed to create roadmap.md (phases IB0–IB18 detailed)
3. Proceed to create implementation-plan.md (slices for Sprint 1–5)

**Timeline:** IBR phases can begin when Steve approves the roadmap. No code changes needed yet; planning phase only.
