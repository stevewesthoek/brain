# Infinite Brain Runtime (IBR) — Operations Guide

**Status:** Foundation Phase (IB0–IB3) + Pipeline phases (IB4–IB11) report-only complete  
**Date:** 2026-06-08  
**Phases Implemented:** IB0, IB1, IB2, IB3, IB4 (atomizer), IB8 (edges), IB9 (audit), IB10 (insights), IB11 (proposals) — all report-only

---

## Overview

Infinite Brain Runtime is the autonomous knowledge graph maintenance layer for Steve's Brain system. It:
- Maintains entity types, relationships, and evidence without manual taxonomy burden
- Preserves Mind as strategic memory (read-only from IBR)
- Supports Brain Core scheduler for approval-gated execution
- Uses AI Model Selector for all model routing
- Keeps Mind writes blocked until iOS/git safety can be verified by allowlisted Brain actions

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

### PHASE IB3 — Mind Write Coordination Readiness

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

### PHASE IB4 — Atomizer Dry-Run (Report-Only)

**Files:**
- `tools/infinite-brain/atomizer-dry-run.mjs` — Atomization analysis tool
- `package.json` script: `ibr:atomizer:dry-run`

**What it does:**
- Scans Mind vault for files exceeding 300 lines (atomic note limit)
- Analyzes sections and estimated split boundaries
- Generates JSON + Markdown reports (no writes)
- Classifies each candidate: keep_atomic or consider_split
- Suggests entity types and one-sentence summaries

**Record Schema:**
```typescript
{
  path: string;              // relative path in vault
  fileName: string;
  totalLines: number;
  metadata: {
    title?: string;
    type?: string;           // entity type
    status?: string;
  };
  sections: Array<{
    heading: string;
    lines: number;
  }>;
  recommendation: 'keep_atomic' | 'consider_split';
  rationale: string;
}
```

**Output:**
- `runtime/local/infinite-brain/atomizer-latest.json`
- `runtime/local/infinite-brain/atomizer-latest.md`

**Usage:**
```bash
# Run dry-run
npm run ibr:atomizer:dry-run

# Or with custom vault path
MIND_VAULT_PATH=/path/to/vault npm run ibr:atomizer:dry-run

# View JSON report
jq '.' runtime/local/infinite-brain/atomizer-latest.json

# View markdown report
cat runtime/local/infinite-brain/atomizer-latest.md
```

**Safety:**
- ✅ Report-only (no files written to Mind)
- ✅ No mutations attempted
- ✅ Deterministic heuristics (heading-based analysis)
- ✅ No model calls
- ✅ No file moves or deletions

---

### PHASE IB11 — Proposal Generation (Report-Only)

**Files:**
- `tools/infinite-brain/proposal-generation-dry-run.mjs` — Proposal generation tool
- `package.json` script: `ibr:proposals:dry-run`
- `tools/infinite-brain/run-report-only-pipeline.mjs` — Integrated in pipeline step 6
- `projects/brain-core/src/adapters/infinite-brain-status.ts` — Status integration
- `projects/brain-console-center/lib/braincore-schemas.ts` — Schema extension
- `projects/brain-console-center/components/infinite-brain-dashboard.tsx` — UI display

**What it does:**
- Reads all prior reports (atomizer, classifier, edges, audit, insights)
- Generates deterministic proposals in 6 categories
- Each proposal includes metadata: confidence, priority, risk level, approval flag
- All proposals require explicit approval before execution
- Reports only; no mutations, no Mind writes, no model calls

**Proposal Categories:**

1. **atomization** — Propose splitting files >300 lines into atomic notes
2. **entity-metadata** — Propose adding/normalizing entity type metadata from inferred types
3. **edge-review** — Propose reviewing low-confidence or suspicious edges
4. **cleanup** — Propose removing stale/duplicate/orphan entities/edges
5. **wiki-writing** — Propose high-value wiki/knowledge page candidates
6. **task-extraction** — Propose possible tasks from classifier/insights data

**Record Schema:**
```typescript
{
  proposalId: string;                 // deterministic ID: prop-XYZ-{hash}
  category: string;                   // one of 6 categories above
  title: string;                      // human-readable proposal title
  summary: string;                    // one-sentence summary
  sourceReports: string[];            // which reports informed this proposal
  sourcePaths: string[];              // affected files/entities
  evidence: object;                   // supporting data
  confidence: number;                 // 0.0–1.0
  priority: 'high' | 'medium' | 'low';
  riskLevel: string;                  // 'low', 'medium', 'high'
  proposedAction: string;             // specific action to take
  requiresApproval: boolean;          // always true
  writesToMindIfApproved: boolean;    // true if this writes to Mind vault
  safetyMode: 'report-only';         // always 'report-only' until execution
  status: 'proposed';                // always 'proposed'
}
```

**Output:**
- `runtime/local/infinite-brain/proposals-latest.json` (JSON report with all proposals)
- `runtime/local/infinite-brain/proposals-latest.md` (Markdown summary, high/medium priority)

**Usage:**
```bash
# Run proposal generator (requires prior phases to complete)
npm run ibr:pipeline:dry-run    # Runs all phases including proposals

# Or generate proposals only (from existing reports)
npm run ibr:proposals:dry-run

# View JSON report
jq '.' runtime/local/infinite-brain/proposals-latest.json

# View markdown summary
cat runtime/local/infinite-brain/proposals-latest.md

# Filter proposals by category
jq '.proposals[] | select(.category=="atomization")' runtime/local/infinite-brain/proposals-latest.json

# Count by priority
jq '.byPriority' runtime/local/infinite-brain/proposals-latest.json
```

**Report Metadata:**
```typescript
{
  timestamp: string;
  status: 'complete';
  totalProposals: number;
  byCategory: Record<string, number>;
  byPriority: { high: number, medium: number, low: number };
  proposalsRequireApproval: number;
  highPriorityProposals: number;
  sourceReports: ['atomizer-latest.json', 'entity-classifier-latest.json', 
                  'edge-inference-latest.json', 'relationship-audit-latest.json',
                  'insights-latest.json'];
  safety: {
    writesToMind: false;
    deletesFiles: false;
    movesFiles: false;
    continuousRuntime: false;
    modelCalls: false;
    deterministic: true;
    reportOnly: true;
  }
}
```

**Safety:**
- ✅ Report-only (no mutations applied)
- ✅ Deterministic heuristics (no randomness, reproducible)
- ✅ No model calls
- ✅ No Mind writes (only proposals about future writes)
- ✅ Approval required metadata in every proposal
- ✅ All proposals flagged `requiresApproval: true`
- ✅ Console integration via brainCoreRequest

**Integration:**
- Brain Core status: `GET /infinite-brain/status` includes `proposals` section under runtime
- Console display: Dashboard shows total proposals, high/medium/low counts, by-category breakdown, report-only status, approval required flag
- No direct fetch: Uses existing brainCoreRequest pattern
- Pipeline integration: Proposals phase runs as step 6 after insights

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas pass Zod validation
- ✅ Console component uses brainCoreRequest
- ✅ Build: `npm run typecheck` passes
- ✅ No forbidden patterns (child_process, exec, Math.random, provider calls)

**Next Steps (Future Phases):**
- **Approval Workflow:** Build a Brain Core scheduler stage that accepts/rejects proposals
- **Execution Phase:** Implement approval-gated proposal execution (IB12+)
- **Feedback Loop:** Track which proposals were approved/rejected for machine learning

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

### PHASE IB9 — Relationship Audit (Report-Only)

**Files:**
- `tools/infinite-brain/relationship-audit-dry-run.mjs` — Audit analysis tool
- `package.json` script: `ibr:relationships:audit`
- `projects/brain-core/src/adapters/infinite-brain-status.ts` — Status integration
- `projects/brain-console-center/lib/braincore-schemas.ts` — Schema extension
- `projects/brain-console-center/components/infinite-brain-dashboard.tsx` — UI display

**What it does:**
- Evaluates health of inferred edges from IB8 edge inference
- Detects broken references (orphan source/target entities)
- Finds duplicate edge pairs (same source, target, type)
- Flags bidirectional conflicts (e.g., both "supports" and "contradicts")
- Identifies missing evidence/reasoning fields
- Spots suspicious patterns (very low confidence, no reasoning)
- Computes health score (% of valid edges)
- Generates top 10 riskiest edges for review
- Creates actionable recommendations

**Record Schema:**
```typescript
{
  timestamp: string;              // ISO8601
  totalInferredEdges: number;
  totalReviewCandidates: number;
  edgesByType: Record<string, number>;
  confidenceDistribution: {
    veryHigh: number;  // >= 0.9
    high: number;      // >= 0.75
    medium: number;    // >= 0.6
    low: number;       // >= 0.4
    veryLow: number;   // < 0.4
  };
  highConfidenceCount: number;
  lowConfidenceCount: number;
  orphanSources: Array<{ edgeId, entityId, confidence }>;
  orphanTargets: Array<{ edgeId, entityId, confidence }>;
  duplicateEdgePairs: Array<{ edgeA, edgeB, confidenceA, confidenceB }>;
  bidirectionalIssues: Array<{ sourceEntity, targetEntity, edgeType1, edgeType2 }>;
  missingEvidenceFields: Array<{ edgeId, reason }>;
  suspiciousPatterns: Array<{ edgeId, pattern, confidence }>;
  topRiskyEdges: Array<{ sourceEntityId, targetEntityId, edgeType, confidence, reasoning }>;
  healthScore: number;  // 0-100
  recommendations: Array<{ priority, category, count, action, rationale }>;
}
```

**Output:**
- `runtime/local/infinite-brain/relationship-audit-latest.json` (JSON report)
- `runtime/local/infinite-brain/relationship-audit-latest.md` (Markdown report)

**Usage:**
```bash
# Run audit (requires IB8 edge inference report first)
npm run ibr:classify:dry-run     # Generate entities
npm run ibr:edges:dry-run        # Generate edges
npm run ibr:relationships:audit  # Audit relationships

# View JSON report
jq '.' runtime/local/infinite-brain/relationship-audit-latest.json

# View markdown report
cat runtime/local/infinite-brain/relationship-audit-latest.md
```

**Safety:**
- ✅ Report-only (no repairs, no mutations)
- ✅ Deterministic heuristics (no randomness)
- ✅ No model calls
- ✅ No file moves or deletions
- ✅ Console integration via brainCoreRequest

**Integration:**
- Brain Core status: `GET /infinite-brain/status` includes `relationshipAudit` section
- Console display: Dashboard shows health score, issue counts, last updated
- No direct fetch: Uses existing brainCoreRequest pattern

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas pass Zod validation
- ✅ Console component uses brainCoreRequest
- ✅ Build: `npm run typecheck` passes

---

### PHASE N — Proposal Approval Records (Decision-Only)

**Files:**
- `projects/brain-core/src/adapters/infinite-brain-proposal-approval-store.ts` — Approval store adapter
- `projects/brain-core/src/api/routes.ts` — GET/POST endpoints
- `projects/brain-core/src/adapters/infinite-brain-status.ts` — Status integration
- `projects/brain-console-center/lib/braincore-schemas.ts` — Zod schema
- `projects/brain-console-center/components/infinite-brain-dashboard.tsx` — UI display

**What it does:**
- Records approval decisions for Infinite Brain proposals (no execution)
- Tracks: proposalId, decision (approved/rejected/needs-review), decidedBy, reason
- Ensures safety invariants: `executionBlocked: true`, `applied: false`
- All records immutable (append-only or overwrite same proposal)
- No Mind writes (decisions record-only, execution blocked)

**Record Schema:**
```typescript
{
  proposalId: string;              // from proposals-latest.json
  category: string;                // one of 6 proposal categories
  decision: 'approved' | 'rejected' | 'needs-review';
  decidedAt: string;               // ISO8601
  decidedBy: string;               // who made the decision
  reason?: string;                 // optional explanation
  sourceReport: string;            // always 'proposals-latest.json'
  proposalHash: string;            // 16-char SHA256 hash
  writesToMindIfApproved: boolean; // false in current phase
  executionBlocked: true;          // always true
  applied: false;                  // always false
}
```

**Storage:**
- Path: `runtime/local/infinite-brain/proposal-approvals.json`
- Format: JSON with `{ records: [...] }` root
- Thread-safe: append or merge decisions safely

**API Endpoints:**

GET `/infinite-brain/proposals`
- Returns all approval records (decision history)

GET `/infinite-brain/proposals/approvals`
- Returns summary: total decisions, approved, rejected, needs-review, applied (always 0), executionBlocked (always true)

POST `/infinite-brain/proposals/approvals`
- Records a decision
- Body: `{ proposalId, category, decision, decidedBy, reason? }`
- Response includes: `applied: false`, `executionBlocked: true`, `writesToMind: false`
- Decision recorded but never applied in current phase

**Usage:**

```bash
# GET approval summary
curl http://localhost:3000/infinite-brain/proposals/approvals

# Record an approval decision
curl -X POST http://localhost:3000/infinite-brain/proposals/approvals \
  -H 'Content-Type: application/json' \
  -d '{
    "proposalId": "prop-ato-a1b2c3d4",
    "category": "atomization",
    "decision": "approved",
    "decidedBy": "steve",
    "reason": "File split aligns with project structure"
  }'

# Response (execution always blocked)
{
  "ok": true,
  "code": "approval_recorded",
  "record": {
    "proposalId": "prop-ato-a1b2c3d4",
    "decision": "approved",
    "decidedAt": "2026-06-08T...",
    "executionBlocked": true,
    "applied": false
  },
  "safety": {
    "applied": false,
    "executionBlocked": true,
    "writesToMind": false
  }
}
```

**Console Display:**
- Dashboard shows: total decisions, approved/rejected/needs-review counts
- Applied count always 0
- Execution blocked status always true
- Latest decision timestamp

**Safety:**
- ✅ Decision-record-only (no proposal application)
- ✅ Execution always blocked (executionBlocked: true)
- ✅ No Mind writes
- ✅ No model calls
- ✅ Approval records immutable
- ✅ All records tracked with proposalId and hash

**Next Phase (IB12+):**
- Build approval workflow (accept/review decisions)
- Create approval-gated proposal execution when ready
- Track approval decisions for machine learning

---

### PHASE P — Proposal Application Planning (Preview-Only)

**Files:**
- `projects/brain-core/src/adapters/infinite-brain-proposal-application-planner.ts` — Planner adapter
- `projects/brain-core/src/api/routes.ts` — GET/POST endpoints for application plan
- `projects/brain-console-center/lib/braincore-schemas.ts` — Zod schema for application plan
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` — Application plan preview UI
- `projects/brain-core/src/adapters/infinite-brain-status.ts` — Status integration
- `projects/brain-core/src/tests/routes.test.ts` — Route tests

**What it does:**
- Reads approved proposals from approval records
- Generates a preview application plan without executing anything
- Each step includes: proposed action, source paths, target path previews, rollback plan preview, risk level, confidence
- All steps marked: `executionBlocked: true`, `applied: false`, `previewOnly: true`
- Never writes to Mind, never applies proposals, never calls models

**Category-specific preview behavior:**

- **atomization** — Preview: new atomic file paths (split targets)
- **entity-metadata** — Preview: which files would get frontmatter changes
- **edge-review** — Preview: edge store modifications (no new files)
- **cleanup** — Preview: which entities would be cleaned up (no file deletion preview)
- **wiki-writing** — Preview: new wiki page paths
- **task-extraction** — Preview: task creation (no file changes)

**Record Schema:**
```typescript
interface ProposalApplicationPlanStep {
  stepId: string;
  proposalId: string;
  category: string;
  proposedAction: string;
  sourcePaths: string[];
  targetPathsPreview: string[];
  wouldWriteToMind: boolean;
  requiresApproval: boolean;
  executionBlocked: boolean;
  applied: boolean;
  rollbackRequired: boolean;
  rollbackPlanPreview: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  reason: string;
}

interface ProposalApplicationPlan {
  planId: string;
  generatedAt: string;
  sourceProposalReport: string;
  sourceApprovalStore: string;
  status: 'preview-only';
  totalApprovedProposals: number;
  totalPlannedSteps: number;
  steps: ProposalApplicationPlanStep[];
  safety: {
    writesToMind: false;
    appliesProposals: false;
    deletesFiles: false;
    movesFiles: false;
    continuousRuntime: false;
    modelCalls: false;
    executionBlocked: true;
    previewOnly: true;
  };
}
```

**API Endpoints:**

POST `/api/infinite-brain/proposals/application-plan/generate`
- Generates preview plan from approved proposals
- Writes only to Brain runtime
- Returns plan summary: `planId`, `generatedAt`, `status`, `totalApprovedProposals`, `totalPlannedSteps`
- Response includes: `safety` (all false/true as above)

GET `/api/infinite-brain/proposals/application-plan`
- Returns full plan with all steps (if available)
- 404 if no plan found

GET `/api/infinite-brain/proposals/application-plan/summary`
- Returns plan metadata: `totalApprovedProposals`, `totalPlannedSteps`, `executionBlocked: true`, `previewOnly: true`

**Usage:**

```bash
# Generate plan (from console UI button or manual API call)
curl -X POST http://localhost:3000/api/infinite-brain/proposals/application-plan/generate

# Fetch full plan
curl http://localhost:3000/api/infinite-brain/proposals/application-plan

# Fetch summary
curl http://localhost:3000/api/infinite-brain/proposals/application-plan/summary
```

**Console Display:**
- "Generate Application Preview" button (never labeled "Apply")
- Shows approved proposal count
- Shows planned step count
- Safety banner: "This is a preview only. No files are changed."
- Never applies proposals

**Safety:**
- ✅ Preview-only (no mutations applied)
- ✅ No proposals executed
- ✅ No Mind writes
- ✅ Execution always blocked (executionBlocked: true)
- ✅ All steps marked applied: false
- ✅ No model calls
- ✅ Rollback plan provided for preview (informational only)

**Integration:**
- Brain Core status: `GET /infinite-brain/status` includes `applicationPlan` section
- Console display: Shows plan summary with safety messaging
- No direct fetch: Uses existing brainCoreRequest pattern

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas pass Zod validation
- ✅ Route tests cover: empty plan, approved-only filtering, missing plan 404
- ✅ Build: `npm run typecheck` passes
- ✅ No forbidden patterns (child_process, exec, Math.random, provider calls)

**Next Phase (IB13+):**
- Build approval-gated proposal execution (actual application when ready)
- Implement rollback tracking
- Add execution metrics and feedback loop

---

### PHASE O2 — Proposal Review UI (Decision-Record-Only)

**Files:**
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` — React component
- `projects/brain-core/src/api/routes.ts` — GET `/infinite-brain/proposals` endpoint
- `projects/brain-console-center/components/infinite-brain-dashboard.tsx` — Integration
- `projects/brain-core/src/tests/routes.test.ts` — Focused route tests

**What it does:**
- Fetches proposals from `GET /infinite-brain/proposals`
- Displays top 20 proposals grouped by priority (high/medium/low)
- Shows: title, summary, category, confidence, writes-to-mind flag
- Allows selecting a proposal and recording a decision (approved/rejected/needs-review)
- Requires a short reason text before submission
- Calls `POST /infinite-brain/proposals/approvals` to record decision
- Displays clear safety messaging: decision-only, no execution, Mind unchanged, execution blocked
- No Apply button, no continuous runtime enabled

**UI Features:**
- Proposal list grouped by priority
- Selection radio buttons
- Decision form with radio options + textarea for reason
- Success/error messages with execution-blocked confirmation
- Auto-refetch after successful submission
- Polling-free (manual refresh interval)
- Clear safety banner: "Decision-Record-Only" mode

**Safety Invariants:**
- ✅ Decision recorded only (no proposal application)
- ✅ Mind unchanged (no writes)
- ✅ Execution blocked (always true in response)
- ✅ Applied always false
- ✅ No Apply button present
- ✅ Brain Core client/proxy pattern used

**Route Tests (Focused Coverage):**
1. GET `/infinite-brain/proposals` returns proposals report or 404 with `proposals_report_missing`
2. GET `/infinite-brain/proposals/approvals` returns summary with `executionBlocked: true`, `applied: 0`
3. POST `/api/infinite-brain/proposals/approvals` rejects invalid proposalId with 404
4. POST `/api/infinite-brain/proposals/approvals` rejects invalid decision with 400
5. POST response includes safety invariants: `applied: false`, `executionBlocked: true`, `writesToMind: false`

**Environment Variables (For Testing):**
- `IBR_PROPOSAL_APPROVALS_PATH` — Override approval store path (absolute or relative to BRAIN_ROOT)
- `IBR_PROPOSALS_REPORT_PATH` — Override proposals report path (absolute or relative to BRAIN_ROOT)

**API Integration:**
```typescript
// Fetch proposals
const data = await brainCoreRequest('/infinite-brain/proposals', infiniteBrainProposalsResponseSchema);

// Record decision
const result = await postBrainCoreAction(
  '/infinite-brain/proposals/approvals',
  infiniteBrainProposalApprovalDecisionResponseSchema,
  { proposalId, decision, decidedBy: 'console-ui', reason }
);
```

**Usage:**
- Component embedded in InfiniteBrainDashboard
- Appears below "Proposal Approvals (Decision Records)" section
- Renders automatically if proposals are available
- No manual action needed to activate

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas pass Zod validation
- ✅ Component uses brainCoreRequest pattern
- ✅ Focused route tests cover main flows
- ✅ Build: `npm run typecheck` passes
- ✅ No forbidden patterns
- ✅ No Model provider calls
- ✅ No Math.random, no shell execution

---

## Contact

For architecture decisions or questions about IBR foundation:
- See: `operations/specs/infinite-brain-runtime-decision-log.md`
- Reference: `operations/specs/infinite-brain-runtime-roadmap.md`
- Implementation: `operations/specs/infinite-brain-runtime-implementation-plan.md`
