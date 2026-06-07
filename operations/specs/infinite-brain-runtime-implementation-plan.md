# Infinite Brain Runtime — Implementation Plan

**Document ID:** IBR-IMPL-PLAN-001  
**Date:** 2026-06-07  
**Status:** Ready to hand off to development (pending planning approval)

## Executive Summary

This document breaks the Infinite Brain Runtime roadmap (IB0–IB17) into **5 implementation sprints** with per-sprint details: deliverables, task breakdown, dependencies, estimated effort, testing strategy, and definition of done.

Each sprint is designed to be executable by one developer (~60% effort per week) and includes explicit go/no-go decision points.

---

## Sprint 1: Foundation (Weeks 1–2)

**Goal:** Build the core infrastructure and safety foundations for autonomous runtime execution.

**Phases:** IB0 + IB1 + IB2 + IB3

**Estimated effort:** 10 days (60% per week × 2 weeks)

### Deliverables

#### IB0: Configuration & Project Structure
- `INFINITE_BRAIN_RUNTIME_CONFIG.json` (canonical config)
  - Entity type whitelist: Tasks, Decisions, Projects, Concepts, Sources
  - Edge type whitelist: supports, contradicts, depends_on, derived_from, related_to, part_of, preceded_by, followed_by, authored, tagging
  - Confidence thresholds: default 0.75 for inference, 0.90 for auto-creation
  - Limits: max 20 notes/week, max vault 5GB
  - Sync rules: one-way (Mind → Brain for Decisions/Projects)
- `IBR_DECISION_LOG.md` (decisions D1–D5 documented)
  - D1: Entity whitelist = Medium (Tasks, Decisions, Projects, Concepts, Sources) ✓
  - D2: Edge inference = Conservative (require approval for edges) ✓
  - D3: Update frequency = Scheduled (daily 00:00 UTC) ✓
  - D4: Versioning = Dual (git + version field) ✓
  - D5: iOS sync = Safe (detect lock, queue writes) ✓
- `.github/workflows/ibr-daily-update.yml` (optional GitHub Actions)
  - Trigger: 00:00 UTC daily
  - Jobs: preflight → inference → insights → reporting
  - Slack notifications on job results

**Tasks:**
```
[ ] Create INFINITE_BRAIN_RUNTIME_CONFIG.json (1 day)
    - Schema: entity/edge whitelists, thresholds, limits
    - Validation: JSON schema + defaults
    - Tests: config loads without errors

[ ] Document decision points (0.5 day)
    - D1–D5 recorded in IBR_DECISION_LOG.md
    - Traceability to inventory.md

[ ] Create GitHub Actions workflow (0.5 day)
    - Scheduled trigger (daily 00:00 UTC)
    - Job definitions (placeholders for IB1+)
    - Notifications (Slack or email)

[ ] Create project folders (0.25 day)
    - `tools/scripts/ibr/` (scripts)
    - `tools/adapters/ibr/` (adapters)
    - `operations/ibr/` (outputs)
```

#### IB1: Entity Changelog Infrastructure
- `ENTITY_CHANGELOG.jsonl` (append-only log)
  - Schema: `{ timestamp: ISO8601, entity_id: string, entity_type: string, action: string ("created"|"updated"|"deleted"), author: string ("system"|"steve"), source_job: string, diff_summary: string }`
  - Example: `{ timestamp: "2026-06-07T00:00:00Z", entity_id: "decision-hire-eng", entity_type: "decision", action: "updated", author: "system", source_job: "scheduler-run-relationship-inference-mind", diff_summary: "added 2 edges: depends_on (strategy-hiring), supports (project-growth)" }`
- Mutation logging adapter (`projects/brain-core/src/adapters/entity-changelog.ts`)
  - Export: `logMutation(mutation: EntityMutation): void`
  - Ensure append-only (never overwrite)
  - Ensure JSON-lines format (valid per line)
  - Thread-safe writes (use fs.appendFile)
- Utility scripts
  - `tools/scripts/ibr/entity-changelog-dump.sh — Show recent mutations (tail -20, or filter by entity/type)`
  - `tools/scripts/ibr/entity-changelog-stats.sh — Stats (mutations/day, types, authors)`

**Tasks:**
```
[ ] Design ENTITY_CHANGELOG.jsonl schema (0.5 day)
    - Field names, types, examples
    - Validation rules
    - Git ignore rules

[ ] Implement entity-changelog adapter (1.5 days)
    - logMutation() export
    - Thread-safe append
    - Validation before write
    - Error handling + logging

[ ] Create utility scripts (1 day)
    - entity-changelog-dump.sh (tail, filter, format)
    - entity-changelog-stats.sh (aggregation, stats)
    - Tests: scripts run without error

[ ] Validate append-only semantics (0.5 day)
    - Test concurrent writes
    - Test immutability (existing lines don't change)
    - Tests pass, no overwrites
```

#### IB2: Evidence Store & Source Linking
- `EVIDENCE_STORE.jsonl` (edge → sources mapping)
  - Schema: `{ edge_id: string, source_ids: string[], strength_score: 0.0–1.0, added_by: string, timestamp: ISO8601 }`
  - Example: `{ edge_id: "decision-hire-eng:supports:project-growth", source_ids: ["source-market-research-2026", "source-hiring-best-practices"], strength_score: 0.85, added_by: "system", timestamp: "2026-06-07T00:00:00Z" }`
- Evidence linking adapter (`projects/brain-core/src/adapters/evidence-store.ts`)
  - Export: `linkEvidence(edge_id: string, sources: string[], score: number): void`
  - Validate edge_id exists in graph
  - Validate source_ids exist in Mind vault
  - Validate score is 0.0–1.0
- Evidence query utilities
  - `tools/scripts/ibr/query-evidence-by-edge.sh — Show sources for a given edge`
  - `tools/scripts/ibr/query-edges-by-confidence.sh — Show edges above/below threshold`

**Tasks:**
```
[ ] Design EVIDENCE_STORE.jsonl schema (0.5 day)
    - Edge ID format, source ID format
    - Confidence score ranges and interpretation
    - Validation rules

[ ] Implement evidence-store adapter (1 day)
    - linkEvidence() export
    - Validation (edge exists, sources exist, score valid)
    - Thread-safe writes

[ ] Create query utilities (0.75 days)
    - query-evidence-by-edge.sh
    - query-edges-by-confidence.sh
    - Tests: queries return correct results

[ ] Integrate with entity-changelog (0.25 day)
    - Log evidence changes to changelog
    - Add "evidence-linked" action type
```

#### IB3: iOS Sync Coordination
- Git lock detection utility (`tools/scripts/ibr/detect-git-lock.sh`)
  - Check for `.git/index.lock` in Mind
  - Wait with exponential backoff (1s, 2s, 4s, ..., up to 5 min)
  - Timeout → return error (fail the job, preserve iOS)
  - Output: locked=true/false, wait_time_ms, message
- Mind write coordinator (`projects/brain-core/src/adapters/mind-write-coordinator.ts`)
  - Export: `acquireWriteLock(): Promise<boolean>`
  - Before write: run detect-git-lock
  - Before write: check git status (no uncommitted changes)
  - Before write: optional pull (if configured)
  - If lock detected: queue write (FIFO queue, max 10 pending)
  - If timeout: abort (return error)
- Verification script (`tools/scripts/ibr/verify-ios-sync-ready.sh`)
  - Check 1: No .git/index.lock
  - Check 2: No uncommitted changes
  - Check 3: No pending pulls
  - Output: ready=true/false, reason

**Tasks:**
```
[ ] Implement detect-git-lock.sh (0.5 day)
    - Check lock file exists
    - Exponential backoff loop
    - Timeout handling
    - Output format

[ ] Implement mind-write-coordinator adapter (1.5 days)
    - acquireWriteLock() function
    - Integration with detect-git-lock
    - Git status checks
    - Queue management (optional)
    - Error handling

[ ] Create verify-ios-sync-ready.sh (0.5 day)
    - Three verification checks
    - Clear output (ready/not-ready)
    - Debugging output (reasons)

[ ] Test iOS sync coordination (0.75 days)
    - Simulate lock file, test detection
    - Simulate uncommitted changes, test abort
    - Simulate concurrent writes, test queue
    - All tests pass
```

### Testing Strategy

**Unit Tests:**
- Entity changelog: append, immutability, validation
- Evidence store: linking, validation, query
- Git lock detection: lock detection, timeout, backoff
- Mind write coordinator: lock acquisition, queue

**Integration Tests:**
- Config loads and is used by adapters
- Entity changelog receives mutations from scheduler stubs
- Evidence store receives edges from relationship-inference stubs
- iOS sync coordinator blocks writes during lock

**Manual Tests:**
- Config can be edited and reloaded
- Changelog file is human-readable
- Evidence file is queryable
- Lock detection works on real Mind repo

**Automation:**
- `npm run test:ibr:sprint-1` (runs all Sprint 1 tests)
- All tests pass before moving to Sprint 2

### Definition of Done

- ✅ All deliverables exist and are committed
- ✅ All unit tests pass (100% coverage for adapters)
- ✅ All integration tests pass
- ✅ Manual verification completes without issues
- ✅ Documentation updated (CLAUDE.md, README)
- ✅ No regressions in existing Brain Core functionality

### Go/No-Go Checkpoint

**After Sprint 1, review:**
- Are all components stable (no crashes)?
- Are append-only semantics working (no overwrites)?
- Is iOS sync detection reliable?
- Should we proceed to Sprint 2?

**Decision:** If all yes → proceed; if no → debug before proceeding

---

## Sprint 2: Soft-Launch Candidate (Weeks 3–4)

**Goal:** Build and validate the first autonomous scheduler job (deduplication).

**Phases:** IB4

**Estimated effort:** 10 days

### Deliverables

#### IB4: Entity Deduplication
- Deduplication algorithm (`tools/scripts/ibr/find-entity-duplicates.ts`)
  - Input: Mind vault root
  - Strategy: Title exact match + semantic similarity (Levenshtein distance >85%)
  - Output: `DEDUPLICATION_REPORT.json`
    ```json
    {
      "timestamp": "2026-06-07T00:00:00Z",
      "entities_scanned": 1500,
      "duplicates_found": 12,
      "candidate_pairs": [
        {
          "entity_1": { "id": "task-123", "title": "Hire engineer", "path": "04-tasks/..." },
          "entity_2": { "id": "task-456", "title": "Hire an engineer", "path": "04-tasks/..." },
          "similarity_score": 0.95,
          "conflict_level": "high",
          "recommendation": "merge_into_1"
        }
      ]
    }
    ```
  - Report placed in `operations/ibr/DEDUPLICATION_REPORT.json`
- Scheduler candidate (`scheduler-run-entity-deduplication-mind`)
  - Execution plans: blocked, preview, executable (future)
  - Blocked mode: Run find-entity-duplicates, show report, no action
  - Preview mode: Same as blocked; show in Brain Console
  - Executable mode: Disabled in Sprint 2; enable in Sprint 3
- Soft-launch workflow
  - Week 1: Blocked mode only (report-only, safe)
  - Week 2: Preview mode (Brain Console shows candidates)
  - Week 3+: Executable mode (Steve approves merges)

**Tasks:**
```
[ ] Implement deduplication algorithm (2 days)
    - Exact title match detection
    - Semantic similarity scoring (string distance)
    - Cross-folder search
    - Report generation
    - Tests: known duplicates detected, no false positives

[ ] Integrate with entity-changelog (0.5 day)
    - Log when duplicates found
    - Track deduplication runs

[ ] Create scheduler candidate (1.5 days)
    - Add execution-plan definition
    - Blocked mode: report-only
    - Preview mode: show in Console
    - Tests: typecheck + build pass

[ ] Create Brain Console display (1 day)
    - Show duplicate candidates
    - Link to entities
    - Show merge recommendations
    - "Approve merge" button (stubs executor for Sprint 3)

[ ] Manual soft-launch (1 day)
    - Week 1: Run blocked mode on Mind vault
    - Week 2: Run preview mode, observe results
    - Week 3: Prepare executable mode (don't execute)
    - Steve reviews candidates for false positives

[ ] Write soft-launch runbook (1 day)
    - How to run each mode
    - How to interpret report
    - How to approve/deny merges (next sprint)
    - Troubleshooting guide
```

### Testing Strategy

**Unit Tests:**
- Deduplication algorithm:
  - Exact matches detected (zero false negatives)
  - Similarity scoring correct (Levenshtein or similar)
  - No false positives (unrelated entities not flagged)
- Scheduler candidate:
  - Executes in blocked mode without error
  - Report generated with valid JSON
  - Brain Console integration points work

**Integration Tests:**
- Soft-launch on real Mind vault (read-only)
- Compare report to manual inspection (ground truth)
- Verify duplicate detection accuracy

**Manual Tests:**
- Run on sample vaults (known duplicates + known non-duplicates)
- Verify report is human-readable
- Verify soft-launch workflow (blocked → preview)

### Definition of Done

- ✅ Deduplication algorithm working (validated on real Mind)
- ✅ Scheduler candidate passes typecheck + builds
- ✅ Blocked mode runs without error
- ✅ Report is accurate (Steve verifies no false positives/negatives)
- ✅ Brain Console shows candidates
- ✅ Soft-launch runbook written and tested
- ✅ All tests pass

### Go/No-Go Checkpoint

**After Sprint 2 (end of week 4), review:**
- Did blocked mode run reliably?
- Are duplicates detected correctly?
- Is the Brain Console display useful?
- **Go decision:** Should we enable executable mode and proceed to Sprint 3 (IB5+)?

**Possible outcomes:**
- GO (green): Proceed to Sprint 3
- GO-WITH-ADJUSTMENTS (yellow): Adjust confidence thresholds; proceed
- NO-GO (red): Debug before proceeding; possible 1-week delay

---

## Sprint 3: Knowledge Maintenance (Weeks 5–7)

**Goal:** Build core maintenance automation (inference, inbox, versioning).

**Phases:** IB5 + IB6 + IB7

**Estimated effort:** 15 days

### Deliverables

#### IB5: Relationship Inference & Scoring
- Inference engine (`tools/scripts/ibr/infer-relationships.ts`)
  - Input: Mind vault (entities + content)
  - Scoring strategies:
    1. Title overlap: A.title contains B.title or vice versa → high confidence
    2. Semantic similarity: entity descriptions similar → medium confidence
    3. Explicit links: A references B (markdown [[...]]) → high confidence
    4. Type-based: similar types (Concept + Concept) → low confidence
  - Output: `INFERENCE_REPORT.json` (all inferred edges + scores)
  - Confidence threshold (from config): default 0.75
  - Max edges per entity (from config): default 20
- Conflict resolver
  - Input: new inferred edges + existing edges in graph
  - Detect contradictions: A supports B but also contradicts B → flag
  - Output: conflicts list (requires Steve approval to override)
- Scheduler candidate (`scheduler-run-relationship-inference-mind`)
  - Blocked mode: Show all inferred edges, no action
  - Preview mode: Show edges >threshold, flag contradictions
  - Executable mode: Create edges >threshold (approve contradictions first)

**Tasks:**
```
[ ] Implement inference engine (2 days)
    - Title overlap scoring
    - Semantic similarity (string distance + content analysis)
    - Explicit link detection (markdown parsing)
    - Type-based heuristics
    - Threshold filtering
    - Tests: known related entities inferred, no false edges

[ ] Implement conflict resolver (1 day)
    - Compare to existing graph
    - Detect contradictions
    - Generate conflict report
    - Tests: contradictions flagged correctly

[ ] Integrate with evidence store (0.5 day)
    - Link inferred edges to confidence score (as evidence strength)
    - Record inference method as "reasoning"

[ ] Create scheduler candidate (1.5 days)
    - Three execution modes (blocked/preview/executable)
    - Error handling + rollback
    - Tests: typecheck + build pass

[ ] Brain Console integration (1 day)
    - Show inferred edges
    - Filter by confidence
    - Show conflicts
    - "Approve edge" button (execute merge)

[ ] Write inference documentation (0.5 day)
    - Explain scoring methods
    - Explain confidence thresholds
    - Troubleshooting low/high confidence
```

#### IB6: Inbox Processing & Entity Creation
- Inbox classifier (extend Mind Steward)
  - Input: capture (raw markdown)
  - Entity extraction: detect type (task|decision|concept|source|note)
  - Metadata extraction: title, key claim, related concepts
  - Output: entity skeleton (type, title, content, related)
- Entity creation workflow
  - Generate ID (UUID)
  - Create frontmatter (id, title, type, created, updated, status, tags)
  - Place in folder (04-tasks/ for tasks, 07-wiki/ for concepts, etc.)
  - Add to changelog (created action)
- Scheduler candidate (`scheduler-run-inbox-processing`)
  - Blocked mode: Preview entities to create
  - Preview mode: Show in Brain Console
  - Executable mode: Create entities + move captures to processed

**Tasks:**
```
[ ] Extend Mind Steward classifier (1.5 days)
    - Detect entity type from capture content
    - Extract metadata (title, key claim)
    - Generate entity skeleton
    - Tests: known captures classified correctly

[ ] Implement entity creation workflow (1.5 days)
    - ID generation
    - Frontmatter creation
    - Folder routing
    - Changelog logging
    - Tests: entities created with correct structure

[ ] Create scheduler candidate (1.5 days)
    - Three modes (blocked/preview/executable)
    - Error handling
    - Rollback on failure
    - Tests: typecheck + build pass

[ ] Brain Console integration (1 day)
    - Show proposed entities
    - Preview frontmatter
    - "Approve creation" button

[ ] Write inbox processing runbook (0.5 day)
    - How to configure entity type rules
    - Troubleshooting low classification confidence
```

#### IB7: Version History Extraction & Indexing
- Version history extractor (`tools/scripts/ibr/extract-entity-history.ts`)
  - Input: git log for Mind repo
  - Parse commit history for entity file changes
  - Extract per-entity versions: entity_id → [v1, v2, ...]
  - Track: author, timestamp, commit hash
  - Output: `VERSION_INDEX.jsonl` (append-only index)
- Version index schema
  - `{ entity_id, type, versions: [{ timestamp, author, commit_hash, summary }], last_updated }`
- History query utility (`tools/scripts/ibr/query-entity-history.sh`)
  - Show when entity was created
  - Show recent changes (last N versions)
  - Show who touched it (author list)
- Scheduled index job (`scheduler-run-version-history-index`)
  - Runs after Mind write jobs (e.g., 00:30 UTC)
  - Blocked mode: Show indexing plan
  - Executable mode: Update VERSION_INDEX.jsonl

**Tasks:**
```
[ ] Implement version history extractor (1.5 days)
    - Parse git log for entity files
    - Extract version metadata
    - Timestamp + author + commit hash
    - Generate summary (how many lines changed, which fields)
    - Tests: versions extracted correctly

[ ] Create VERSION_INDEX.jsonl schema (0.5 day)
    - Field definitions
    - Validation rules
    - Query format

[ ] Implement history query utility (1 day)
    - Show entity creation time
    - Show recent N changes
    - Show author list
    - Tests: queries return correct data

[ ] Create scheduler candidate (1 day)
    - Blocked mode: Show indexing plan
    - Executable mode: Update index
    - Run frequency: after write jobs

[ ] Brain Console integration (0.5 day)
    - Show entity version history
    - Link to commits (if Git integrating)

[ ] Write versioning documentation (0.25 day)
```

### Testing Strategy

**Unit Tests:**
- Inference engine: scoring, threshold, edge generation
- Conflict resolver: contradiction detection
- Inbox classifier: entity type detection, metadata extraction
- Entity creation: frontmatter generation, folder routing
- Version extractor: git log parsing, version extraction
- Query utilities: return correct results

**Integration Tests:**
- Inference + evidence store: edges get evidence scores
- Inbox + changelog: captures processed, entities created, logged
- Version index: updated after Mind writes

**Manual Tests:**
- Infer relationships on real Mind vault; compare to manual inspection
- Process sample inboxes; verify entities created correctly
- Extract version history; compare to git log
- Query history; verify results match

### Definition of Done

- ✅ All three phases (IB5–IB7) implemented and tested
- ✅ All scheduler candidates pass typecheck + build
- ✅ Relationship inference confidence well-calibrated (>75% accuracy)
- ✅ Inbox processing accuracy >80%
- ✅ Version history complete and queryable
- ✅ Brain Console displays all results
- ✅ All tests pass (unit + integration + manual)

---

## Sprint 4: Standardization & Quality (Weeks 8–10)

**Goal:** Enforce metadata standards and clean up graph integrity.

**Phases:** IB8 + IB9

**Estimated effort:** 12 days

### Deliverables

#### IB8: Metadata Standardization
- Frontmatter validator (`tools/scripts/ibr/validate-entity-frontmatter.ts`)
  - Required fields: id, title, type, created, updated
  - Optional fields: status, tags, author, version, sources_cited, evidence_level
  - Validation rules:
    - id: UUID format
    - title: non-empty string
    - type: enum (task, decision, project, concept, source, note, question, hypothesis)
    - created/updated: ISO8601 timestamp
    - status: enum (active, archived, planning)
    - tags: array of strings
  - Report: `METADATA_REPORT.json` (non-compliant entities)
- Fixer utility (`tools/scripts/ibr/fix-entity-frontmatter.sh`)
  - Auto-generate missing IDs (UUID)
  - Auto-fill created/updated (from git history)
  - Normalize timestamp formats (ISO8601)
  - Preview changes before applying
  - Tests: no data loss, valid YAML after fixing
- Scheduler candidate (`scheduler-run-metadata-standardization`)
  - Blocked mode: Report non-compliant entities
  - Preview mode: Show entities to fix
  - Executable mode: Fix frontmatter

**Tasks:**
```
[ ] Design and implement validator (1 day)
    - Field definitions + validation rules
    - Report generation
    - Tests: all compliance rules enforced

[ ] Implement fixer utility (1.5 days)
    - ID generation (UUID)
    - Timestamp extraction from git
    - Format normalization
    - Dry-run mode (preview before applying)
    - Tests: no data loss, valid YAML

[ ] Create scheduler candidate (1 day)
    - Three modes
    - Error handling
    - Rollback

[ ] Write standardization runbook (0.5 day)
```

#### IB9: Relationship Audit & Repair
- Relationship validator
  - Check: all edges point to valid entities (both source and target exist)
  - Check: no orphan edges (entities deleted but edges remain)
  - Check: no circular dependencies (if applicable)
  - Report: `RELATIONSHIP_AUDIT.json` (broken edges, orphans, metrics)
  - Health score: % of valid edges
- Repair workflow
  - Remove broken edges
  - Remove orphan edges
  - Log repairs to changelog
  - Output: `RELATIONSHIP_REPAIR.json` (what was fixed)
- Scheduler candidate (`scheduler-run-relationship-audit`)
  - Blocked mode: Audit report (health score, broken edges count)
  - Executable mode: Clean up broken edges

**Tasks:**
```
[ ] Implement validator (1 day)
    - Entity reference checking
    - Orphan detection
    - Report generation
    - Tests: all broken edges detected

[ ] Implement repair workflow (1 day)
    - Remove broken edges
    - Log changes
    - Rollback on error

[ ] Create scheduler candidate (1 day)
    - Two modes (blocked, executable)
    - Safety checks (don't delete valid edges)

[ ] Write audit runbook (0.5 day)
```

### Testing Strategy

**Unit Tests:**
- Validator: all field types validated, errors detected
- Fixer: missing fields added, formats normalized, no data loss
- Relationship validator: broken edges detected, orphans found
- Repair: edges removed correctly, logs created

**Integration Tests:**
- Metadata standardization + changelog: fixes logged
- Relationship audit + entity deduplication: coordinated cleanup

**Manual Tests:**
- Introduce errors (bad IDs, broken edges, orphans); verify detection
- Verify fixer doesn't lose data
- Verify audit reports are accurate

### Definition of Done

- ✅ All entities have valid frontmatter
- ✅ All edges point to valid entities (no broken references)
- ✅ Relationship health score tracked
- ✅ All tests pass

---

## Sprint 5: Insights & Reporting (Weeks 11–13)

**Goal:** Generate patterns, track hypotheses, and create weekly reports.

**Phases:** IB10 + IB11 + IB12 + IB13

**Estimated effort:** 15 days

### Deliverables Summary

Four sub-phases:
- **IB10:** Pattern detection + hypothesis generation
- **IB11:** Question backlog + hypothesis tracking
- **IB12:** Concept gap detection
- **IB13:** Weekly insight reporting + dashboard

Each phase builds on prior ones (IB10 → IB11 → IB12 → IB13).

### Testing Strategy

- Unit tests for each algorithm (pattern detection, hypothesis generation, etc.)
- Integration tests for scheduler candidates
- Manual tests on real Mind vault
- Dashboard usability review

### Definition of Done

- ✅ Patterns detected reliably
- ✅ Hypotheses are testable and documented
- ✅ Questions tracked with answers
- ✅ Concept gaps identified
- ✅ Weekly report generated and displayed in Dashboard

---

## Sprint 6: Query & Discovery (Weeks 14–16)

**Goal:** Unify Mind + Brain graph searching and ranking.

**Phases:** IB14 + IB15

**Estimated effort:** 12 days

### Deliverables Summary

- **IB14:** Unified query interface (`/query` skill)
- **IB15:** Advanced relevance ranking (BM25, proximity, recency)

### Definition of Done

- ✅ Query interface accepts natural language
- ✅ Results from both Mind and Brain graphs
- ✅ Ranking is intuitive (top results are relevant)
- ✅ Search quality metrics >0.85 (precision on top-3)

---

## Sprint 7: Integration & Continuous (Weeks 17–18)

**Goal:** Cross-platform sync and optional continuous reasoning loop.

**Phases:** IB16 + IB17 (optional)

**Estimated effort:** 12 days (or 6 if IB17 skipped)

### Deliverables Summary

- **IB16:** Entity sync between Mind and Brain
- **IB17 (optional):** Autonomous continuous reasoning loop

### Definition of Done

- ✅ Entities sync correctly between platforms
- ✅ Conflicts detected and resolved
- ✅ No data loss
- ✅ (IB17 optional) Continuous loop terminates properly

---

## Timeline Summary

| Sprint | Weeks | Phases | Effort | Estimated Status |
|--------|-------|--------|--------|------------------|
| 1 | 1–2 | IB0–IB3 | 10d | May 31 |
| 2 (Soft-launch) | 3–4 | IB4 | 10d | June 14 |
| 2 Go/No-Go | — | Review | 2d | June 16 |
| 3 | 5–7 | IB5–IB7 | 15d | July 7 |
| 4 | 8–10 | IB8–IB9 | 12d | July 28 |
| 5 | 11–13 | IB10–IB13 | 15d | Aug 18 |
| 6 | 14–16 | IB14–IB15 | 12d | Sept 8 |
| 7 | 17–18 | IB16–IB17 | 12d | Sept 22 |
| **Total** | **18 weeks** | **IB0–IB17** | **98d** | **~4.5 months** |

---

## Risk Mitigation per Sprint

### Sprint 1 Risks
- Config errors → validate schema on load
- iOS sync conflicts → comprehensive testing

### Sprint 2 Risks
- False duplicate detection → low threshold, manual review

### Sprint 3 Risks
- Relationship hallucination → evidence store + confidence scoring
- Entity explosion → rate limits + deduplication

### Sprint 4 Risks
- Data loss in metadata fixing → comprehensive testing + backups

### Sprint 5 Risks
- Pattern noise (false insights) → Steve manually flags bad patterns

### Sprint 6 Risks
- Query performance → caching + indexing

### Sprint 7 Risks
- Sync conflicts → comprehensive testing + manual review for conflicts

---

## Quality Gates

All sprints have:
1. **Unit test coverage** >80%
2. **Integration test pass rate** 100%
3. **Manual verification** by Steve
4. **Type checking** passes (TypeScript)
5. **Build** passes (npm run build)
6. **No regressions** in existing systems

---

## Recommendation

**Status:** ✅ Implementation plan complete and ready for development hand-off.

**Next steps:**
1. Steve reviews sprints 1–7
2. Steve approves implementation plan
3. Hand off to development team (or proceed as solo developer)
4. Start Sprint 1 (IB0–IB3) in week 1
5. Go/no-go checkpoint at end of Sprint 2 (week 4)

**Decision required:** Ready to start development, or request modifications?
