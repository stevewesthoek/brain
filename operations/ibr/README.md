# Infinite Brain Runtime (IBR) — Operations Guide

**Status:** Foundation Phase (IB0–IB3) complete  
**Date:** 2026-06-08  
**Phases Implemented:** IB0, IB1, IB2, IB3

---

## Overview

Infinite Brain Runtime is the autonomous knowledge graph maintenance layer for Steve's Brain system. It:
- Maintains entity types, relationships, and evidence without manual taxonomy burden
- Preserves Mind as strategic memory (read-only from IBR)
- Supports Brain Core scheduler for approval-gated execution
- Uses AI Model Selector for all model routing
- Keeps iOS sync coordination safe by detecting Obsidian locks

---

## Implemented Phases

### PHASE IB0 — Configuration & Schema Foundation

**Files:**
- `operations/specs/infinite-brain-runtime.config.schema.json` — JSON schema (machine-readable)
- `operations/specs/infinite-brain-runtime.example.config.json` — Example configuration
- `operations/specs/infinite-brain-runtime-decision-log.md` — Decision points D1–D5 locked

**What it does:**
- Defines 16 internal entity types (machine-maintained metadata, not folders)
- Defines 10 edge types (supports, contradicts, depends_on, etc.)
- Sets confidence thresholds (inference 0.75, auto-creation 0.90)
- Locks safety policies (no destructive Mind conversion, approval required)
- Establishes model policy (AI Model Selector mandatory, no fallback logic)

**Validation:**
- ✅ Config schema valid JSON
- ✅ Example config valid JSON
- ✅ All 5 decision points documented

**Usage:**
```bash
# Inspect schema
jq '.' operations/specs/infinite-brain-runtime.config.schema.json

# Reference example
cat operations/specs/infinite-brain-runtime.example.config.json
```

---

### PHASE IB1 — Entity Changelog Infrastructure

**Files:**
- `projects/brain-core/src/adapters/infinite-brain/types.ts` — Type definitions
- `projects/brain-core/src/adapters/infinite-brain/entity-changelog.ts` — Changelog adapter
- `projects/brain-core/src/tests/infinite-brain-entity-changelog.test.ts` — Unit tests
- `tools/scripts/ibr/entity-changelog-dump.sh` — View recent entries

**What it does:**
- Append-only JSONL log of entity mutations (created/updated/deleted)
- Validates mutations before writing
- Thread-safe append semantics (never overwrites)
- Supports filtering and statistics queries
- Location: `runtime/local/infinite-brain/entity-changelog.jsonl`

**Record Schema:**
```typescript
{
  timestamp: string;        // ISO8601
  entityId: string;
  entityType: string;
  action: 'created' | 'updated' | 'deleted';
  author: 'system' | 'steve';
  sourceJob: string;        // which scheduler job
  diffSummary: string;      // human-readable change
}
```

**Validation:**
- ✅ TypeScript types valid
- ✅ Unit tests pass
- ✅ Append-only semantics enforced

**Usage:**
```typescript
import { logMutation, getRecentMutations, getChangelogStats } from '...';

// Log a mutation
await logMutation({
  timestamp: new Date().toISOString(),
  entityId: 'decision-hire-eng',
  entityType: 'Decision',
  action: 'created',
  author: 'system',
  sourceJob: 'scheduler-run-inbox-processing',
  diffSummary: 'Created entity from capture',
});

// Query mutations
const recent = await getRecentMutations(20);
const stats = await getChangelogStats();
```

---

### PHASE IB2 — Evidence Store & Provenance

**Files:**
- `projects/brain-core/src/adapters/infinite-brain/evidence-store.ts` — Evidence adapter

**What it does:**
- Append-only JSONL log linking edges to supporting sources
- Every inferred relationship must have evidence
- Confidence scoring (0.0–1.0) for edges
- Tracks source provenance (file, markdown-link, frontmatter, api-response)
- Location: `runtime/local/infinite-brain/evidence-store.jsonl`

**Record Schemas:**
```typescript
// Evidence record
{
  evidenceId: string;
  sourceRepo: 'mind' | 'brain';
  sourcePath: string;
  sourceKind: 'file' | 'markdown-link' | 'frontmatter' | 'api-response';
  capturedAt: string;       // ISO8601
  summary: string;
  quoteOrSnippet?: string;
  hash?: string;
  relatedEntityIds: string[];
  confidence: number;       // 0.0–1.0
}

// Edge record
{
  edgeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  edgeType: string;         // one of 10 types
  sourceEvidenceIds: string[];
  strengthScore: number;    // 0.0–1.0
  addedBy: 'system' | 'steve';
  timestamp: string;        // ISO8601
}
```

**Validation:**
- ✅ TypeScript types valid
- ✅ Validate before write
- ✅ All inferred edges have evidence

**Usage:**
```typescript
import { linkEvidence, getEdgesByStrength, getEvidenceForEdge } from '...';

// Link evidence to edge
await linkEvidence(evidence, edge);

// Query by confidence
const highConfidenceEdges = await getEdgesByStrength(0.8);

// Get evidence for specific edge
const supporting = await getEvidenceForEdge('edge-id-123');
```

---

### PHASE IB3 — iOS Sync Coordination

**Files:**
- `projects/brain-core/src/adapters/infinite-brain/mind-write-coordinator.ts` — Coordinator
- `tools/scripts/ibr/verify-ios-sync-ready.sh` — Verification script

**What it does:**
- Detects git lock file (`.git/index.lock`) before Mind writes
- Exponential backoff waiter (1s, 2s, 4s, ... up to 5 min timeout)
- Checks git status for uncommitted changes
- Aborts writes on timeout (preserves iOS sync)
- Safe for concurrent iOS Obsidian sync

**Coordinator API:**
```typescript
// Try to acquire write lock
const result = await acquireWriteLock();
if (result.acquired) {
  // Safe to write to Mind
} else {
  console.error('Write blocked:', result.reason);
}

// Diagnostic check
const ready = await verifyIosSyncReady();
console.log('iOS sync ready:', ready.ready);
console.log('Checks:', ready.checks);
```

**Validation:**
- ✅ TypeScript types valid
- ✅ Git lock detection logic sound
- ✅ Backoff strategy tested

**Usage:**
```bash
# Verify Mind is ready
./tools/scripts/ibr/verify-ios-sync-ready.sh

# Manually check sync status
MIND_REPO_PATH=$HOME/Repos/stevewesthoek/mind ./verify-ios-sync-ready.sh
```

---

## Runtime Directory Structure

```
brain/
├── runtime/
│   └── local/
│       └── infinite-brain/
│           ├── entity-changelog.jsonl        (IB1: append-only mutation log)
│           ├── evidence-store.jsonl          (IB2: edge evidence + sources)
│           ├── inbox-classifier-latest.json  (IB3: report-only, future)
│           ├── atomizer-latest.json          (IB4: report-only, future)
│           └── ...                           (other scheduler outputs)
├── operations/
│   └── specs/
│       ├── infinite-brain-runtime.config.schema.json  (IB0: schema)
│       ├── infinite-brain-runtime.example.config.json (IB0: example)
│       └── infinite-brain-runtime-decision-log.md     (IB0: decisions)
└── tools/
    └── scripts/
        └── ibr/
            ├── entity-changelog-dump.sh      (IB1: view entries)
            └── verify-ios-sync-ready.sh      (IB3: check sync)
```

---

## Build & Test

### TypeScript Type Checking
```bash
cd projects/brain-core
npm run typecheck
# Expected: no errors
```

### Unit Tests
```bash
cd projects/brain-core
npm test
# Expected: entity-changelog validation tests pass
```

### JSON Validation
```bash
jq empty operations/specs/infinite-brain-runtime.config.schema.json
jq empty operations/specs/infinite-brain-runtime.example.config.json
# Expected: both valid
```

---

## Next Steps (IB4+)

**When to implement:** After IB0–IB3 validation is complete (all tests pass, no integration blockers).

**PHASE IB4 — Entity Deduplication (Soft-Launch)**
- Find duplicate notes in Mind vault
- Semantic similarity matching
- Report-only → Preview → Executable workflow
- First scheduler candidate to test approval gates

**Gating Decision:** End of Sprint 2 (week 4)
- Has deduplication been reliable?
- Are duplicates detected correctly?
- Should we proceed to IB5+ (inference, inbox processing)?

---

## Safety Rules (Non-Negotiable)

✅ **Enforced by design:**
- Append-only changelog (never overwrites)
- iOS sync coordination (detects locks before writes)
- No destructive Mind conversion (schema prevents it)
- Approval gates required (scheduler integration)
- AI Model Selector mandatory (no fallback logic)
- No continuous runtime (scheduled/manual trigger only)

❌ **Not permitted:**
- Hidden continuous loops
- Direct provider/model fallback
- Silent deletion without logging
- Untracked entity mutations
- Destructive Mind restructuring

---

## Troubleshooting

### Changelog not found
```bash
# Create runtime directory
mkdir -p runtime/local/infinite-brain
```

### Git lock detection fails
```bash
# Check MIND_REPO_PATH
export MIND_REPO_PATH=$HOME/Repos/stevewesthoek/mind
./tools/scripts/ibr/verify-ios-sync-ready.sh
```

### Type errors
```bash
cd projects/brain-core
npm run typecheck 2>&1 | head -20
```

---

## Metrics

**IB0–IB3 Foundation Completion:**
- Config: 100% (schema, example, decisions locked)
- Changelog: 100% (adapter, utilities, tests)
- Evidence: 100% (adapter, queries, types)
- iOS Sync: 100% (coordinator, verification script)
- Build: ✅ TypeScript passes
- Tests: ✅ Unit tests pass
- Mind mutations: 0 (read-only phase)
- Continuous runtime: Disabled

---

## Contact

For architecture decisions or questions about IBR foundation:
- See: `operations/specs/infinite-brain-runtime-decision-log.md`
- Reference: `operations/specs/infinite-brain-runtime-roadmap.md`
- Implementation: `operations/specs/infinite-brain-runtime-implementation-plan.md`
