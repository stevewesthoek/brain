# Infinite Brain Runtime — Decision Log

**Document ID:** IBR-DECISIONLOG-001  
**Date:** 2026-06-08  
**Status:** Decisions locked; foundation ready

---

## D1: Entity Type Whitelist

**Decision:** Full 16-type vocabulary internally; not a user-facing mandatory folder structure.

**Selected Option:** Full (16 types) + Custom type for extensions

**Rationale:** NotebookLM research shows AI thrives on higher complexity than humans (humans prefer 4 folders; AI can handle 16 types efficiently). Entity type is machine-maintained metadata, not a manual filing obligation for Steve.

**Implementation:**
- Internal vocabulary: 16 entity types (Pillar, Decision, Concept, Question, Playbook, Task, Event, Pattern, Hypothesis, Fact, Source, Bookmark, Note, Contact, Reference, Custom)
- User experience: None required. Steve continues his capture, strategy, research workflow unchanged
- Classifier auto-detects entity type and maintains it in frontmatter
- No manual taxonomy folder management required

**Acceptance:** ✅ Locked. Reflected in INFINITE_BRAIN_RUNTIME_CONFIG.json.

---

## D2: Edge Inference Strategy

**Decision:** Conservative approach (report-only first; require approval before writes)

**Selected Option:** Conservative (A)

**Rationale:** False edges are worse than missing edges. If AI infers incorrectly, Steve can accept or reject. If AI misses edges, Steve can add manually later.

**Implementation:**
- Default confidence threshold: 0.75 for inference
- Edge inference runs in blocked/preview mode first
- All edges require evidence store linkage
- Conflicts detected and flagged for manual review
- Confidence scoring prevents over-creation

**Acceptance:** ✅ Locked. Configured in confidence thresholds.

---

## D3: Runtime Style and Visibility

**Decision:** Invisible by default (Brain Console status; no manual taxonomy burden)

**Selected Option:** Invisible/Automated

**Rationale:** Infinite Brain is a black-box improvement layer. Steve should not need to remember entity types, maintain graph edges, move notes into folders, run startup rituals, or manually clean stale information.

**Implementation:**
- Status: Brain Console shows IBR runtime health, job completions, reports
- No startup rituals required
- Scheduler jobs run on configured schedule or manual trigger
- Brain Console is primary control surface (not Slack, email, or GitHub)
- All captures flow through Mind as usual (Obsidian capture, iOS sync)
- Entity classification happens behind the scenes

**Acceptance:** ✅ Locked. Brain Core scheduler integration.

---

## D4: Versioning Model

**Decision:** Dual model (git history + append-only runtime changelog)

**Selected Option:** Dual (git + runtime logs)

**Rationale:** git log is source of truth; VERSION_INDEX.jsonl and ENTITY_CHANGELOG.jsonl enable fast entity history queries without parsing git.

**Implementation:**
- git remains authoritative for content history
- ENTITY_CHANGELOG.jsonl: append-only log of mutations (created/updated/deleted + timestamp + author)
- VERSION_INDEX.jsonl: queryable entity version metadata extracted from git
- Query utilities provide fast access without git parsing

**Acceptance:** ✅ Locked. IB7 (version history) implements this.

---

## D5: Mind Safety (iOS Sync Coordination)

**Decision:** Non-destructive coexistence with queue-and-approve pattern

**Selected Option:** Safe (B) — Detect Obsidian git lock; queue writes until sync done

**Rationale:** Mind is Steve's source-of-truth personal memory. iOS sync is bidirectional. IBR must never cause conflicts. Priority: iOS sync first, IBR writes second.

**Implementation:**
- Detect `.git/index.lock` before Mind writes
- Exponential backoff with timeout (max 5 minutes)
- If timeout, fail the job (preserve iOS changes)
- Pre-write: check git status (no uncommitted changes)
- Post-write: verify no conflicts introduced
- All Mind writes logged to ENTITY_CHANGELOG.jsonl

**Acceptance:** ✅ Locked. IB3 implements iOS sync coordination.

---

## Additional Locked Decisions

### D6: Model Routing (inherited from graphify-standard)

**Policy:** All semantic AI decisions use AI Model Selector. No hardcoded fallback logic in IBR scripts.

**Implementation:** IBR scheduler jobs delegate model selection to AI Model Selector via `TaskMetadata` with quality tiers and preference ordering.

### D7: Graphify Boundary

**Policy:** Graphify owns repo/codebase graphs (extraction, AST, architecture). IBR owns knowledge graph edges (relationships, entity maintenance, inference).

**Implementation:** Graphify produces graph.json. IBR reads graph.json for entity extraction, adds edges via evidence store and relationship inference.

### D8: Continuous Runtime Disabled

**Policy:** No hidden continuous loops. Only scheduled (daily, weekly) or manual trigger.

**Implementation:** Scheduler jobs require approval before execution. Jobs can be scheduled (cron) or triggered manually. No autonomous background process.

### D9: Mind Non-Destructive Policy

**Policy:** No destructive Mind conversion. No auto-rewriting of existing Mind content. No deletion without approval. No invisible restructuring.

**Implementation:** IBR adds metadata, infers edges, creates new entities. IBR never modifies existing Mind note content. Consolidation/deduplication requires Steve approval.

---

## Sprint 1 Foundation Checklist

- ✅ **IB0:** Config schema + example + decision log (this document)
- ⏳ **IB1:** Entity changelog adapter + utilities
- ⏳ **IB2:** Evidence store adapter + queries
- ⏳ **IB3:** iOS sync coordination adapter

---

## Approval Gate (End of IB0)

**Status:** Configuration complete. Ready for IB1 implementation.

**Next:** Proceed to IB1 (entity changelog infrastructure).
