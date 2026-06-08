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

### PHASE U — Execution Readiness Console Visibility

**Files:**
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` — InfiniteBrainExecutionReadiness component
- `operations/ibr/README.md` — This documentation

**What it does:**
- Displays execution readiness status in Console dashboard
- Shows total steps, blocked steps, blocker count, can-execute flag, execution status
- Provides "Generate Execution Readiness" button to generate/refresh readiness report
- Always displays: `canExecute: false`, `executionBlocked: true`, safety messaging
- Never provides an Apply button or execution controls
- Never writes to Mind
- Never applies proposals

**UI Component: InfiniteBrainExecutionReadiness**

Behavior:
- Fetches latest readiness summary via `GET /infinite-brain/proposals/execution-readiness/summary`
- Displays readiness metadata (generated timestamp, status, blocker count)
- Shows three-column metric display: Can Execute (always No), Status (always Blocked), Total Steps
- Button labeled "Generate Execution Readiness" (never "Apply")
- On button click: calls `POST /infinite-brain/proposals/execution-readiness/generate`, waits for result, refetches summary
- Safety banner explains: "Execution is blocked. No proposals are applied. Mind is unchanged."
- Error handling with red alert boxes
- Success confirmation with green alert boxes
- Loading state while fetching

**Display Fields:**
- Can Execute: Always shows "No" (literal false)
- Status: Always shows "Blocked" (literal true for executionBlocked)
- Total Steps: Count from plan (0 if no plan)
- Blocked Steps: Count from plan (all steps blocked in this phase)
- Blockers: Count of blocked/failed required checks
- Generated: ISO8601 timestamp of report generation

**API Integration:**

```typescript
// Fetch readiness summary
GET /infinite-brain/proposals/execution-readiness/summary
Response:
{
  ok: true,
  summary: {
    available: true,
    generatedAt: "2026-06-08T...",
    canExecute: false,
    totalSteps: 5,
    blockedSteps: 5,
    blockerCount: 3,
    executionBlocked: true
  }
}

// Generate readiness report
POST /infinite-brain/proposals/execution-readiness/generate
Response:
{
  ok: true,
  code: "execution_readiness_generated",
  message: "Execution readiness report generated",
  report: {
    reportId: "readiness-abc123...",
    generatedAt: "2026-06-08T...",
    status: "blocked",
    canExecute: false,
    totalSteps: 5,
    blockedSteps: 5,
    blockerCount: 3
  },
  safety: {
    writesToMind: false,
    appliesProposals: false,
    canExecute: false,
    executionBlocked: true,
    previewOnly: true,
    continuousRuntime: false,
    modelCalls: false
  }
}
```

**Safety Invariants:**
- ✅ Readiness-check-only (no execution)
- ✅ Can Execute always false
- ✅ Execution Blocked always true
- ✅ No proposals applied
- ✅ No Mind writes
- ✅ No Apply button
- ✅ No execution controls
- ✅ No model calls
- ✅ No continuous runtime

**Integration:**
- Brain Core status: `GET /infinite-brain/status` includes `runtime.executionReadiness`
- Console display: New "Execution Readiness" section in InfiniteBrainProposalReview component
- No direct fetch: Uses existing brainCoreRequest pattern
- Inline Zod schemas for readiness responses (no hardcoded inline schemas in component — schemas already in braincore-schemas.ts)

**User Experience Flow:**
1. User visits Console dashboard
2. Sees "Execution Readiness" section below Application Plan Preview
3. Shows current readiness status if report exists (can execute: No, blocked: Yes, etc.)
4. User can click "Generate Execution Readiness" button
5. Button shows loading state "Generating..."
6. On success, displays green banner "✓ Readiness report generated successfully"
7. Section updates with new metrics
8. Safety message always visible: "Execution is blocked. No proposals are applied. Mind is unchanged."

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas use Zod unions (available/unavailable)
- ✅ Build: `npm run typecheck` passes
- ✅ No forbidden patterns (child_process, exec, Math.random, provider calls)
- ✅ No direct fetch (uses brainCoreRequest)
- ✅ No random/time-based stable IDs in component

**Testing:**
- Manual: Click "Generate Execution Readiness" button, verify readiness summary updates
- Manual: Verify can-execute always shows "No"
- Manual: Verify execution status always shows "Blocked"
- Manual: Verify safety banner present
- Manual: Verify no Apply button present

**Next Phase (U+1):**
- Build 10 required checks display (detailed readiness view)
- Implement check details page (what's blocking execution)
- Add check-resolution guidance (how to unblock each check)

---

### PHASE V — Detailed Readiness Checks in Console

**Files:**
- `projects/brain-console-center/lib/braincore-schemas.ts` — Full readiness report schema
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` — Enhanced component with checks display
- `operations/ibr/README.md` — This documentation

**What it does:**
- Displays all 10 readiness checks with status, label, and reason
- Shows check status badges: pass (green), blocked (amber), fail (red), not-applicable (gray)
- Displays blockers in "What's Blocking Execution" section with guidance
- Shows check count summary (pass, blocked, failed, N/A)
- Provides static guidance text for known blockers
- Never provides Apply button or execution controls
- Never writes to Mind
- Never applies proposals

**Readiness Checks Display:**

Fetches full readiness report via:
```typescript
GET /infinite-brain/proposals/execution-readiness
Response: { reportId, generatedAt, applicationPlanId, status, canExecute, totalSteps, executableSteps, blockedSteps, blockers[], checks[], safety }
```

Each check displays:
- **checkId**: Machine ID (check-0, check-1, etc.)
- **label**: Human-readable check name ("Plan exists", "Execution blocked flag set", etc.)
- **status**: pass | fail | blocked | not-applicable
- **reason**: Explanation of current status
- **requiredForExecution**: Whether this check must pass for execution

**Blocker Guidance Text:**

Static guidance for known blockers:
- "Mind write gate available" → "Requires explicit Mind writer implementation and approval gates."
- "iOS sync safety available" → "Requires verified iOS/Obsidian sync safety before writes."
- "Allowlisted writer available" → "Requires Brain-owned allowlisted writer; no shell execution."
- "Operator approval gate" → "Requires explicit operator approval for execution."
- "Dry-run validation available" → "Requires a completed dry-run validation before execution."

**Schema: infiniteBrainExecutionReadinessFullReportSchema**

```typescript
{
  ok: true,
  report: {
    reportId: string,
    generatedAt: string,
    applicationPlanId: string | null,
    status: 'blocked',
    canExecute: false,
    totalSteps: number,
    executableSteps: number,
    blockedSteps: number,
    blockers: string[],
    checks: [{
      checkId: string,
      label: string,
      status: 'pass' | 'fail' | 'blocked' | 'not-applicable',
      reason: string,
      requiredForExecution: boolean
    }],
    safety: {
      writesToMind: false,
      appliesProposals: false,
      canExecute: false,
      executionBlocked: true,
      previewOnly: true,
      continuousRuntime: false,
      modelCalls: false
    }
  }
}
```

**UI Layout:**

1. Summary metrics (Can Execute: No, Status: Blocked, Total Steps, Blocked Steps, Blockers)
2. "Readiness Checks" section:
   - List all 10 checks with badges
   - Show check label, reason, status
   - Color-coded badges
   - Summary counts at bottom
3. "What's Blocking Execution" section:
   - List all active blockers
   - Show guidance text for each (if available)
   - Red/warning color scheme
4. Or "No active blockers" message if empty (execution still blocked by default)
5. "Generate Execution Readiness" button (never "Apply" or "Execute")

**Safety Invariants:**
- ✅ Readiness-visibility-only (no execution)
- ✅ Can Execute always false (displayed as "No")
- ✅ Execution Blocked always true (displayed as "Blocked")
- ✅ No proposals applied
- ✅ No Mind writes
- ✅ No Apply button
- ✅ No execution controls
- ✅ No model calls
- ✅ No continuous runtime
- ✅ All 10 checks visible
- ✅ All blockers visible with guidance

**Integration:**
- Brain Core status: `/infinite-brain/status` includes `runtime.executionReadiness`
- Console display: Enhanced InfiniteBrainExecutionReadiness component
- No direct fetch: Uses brainCoreRequest pattern
- Full report fetched independently from summary

**User Experience Flow:**
1. User visits Console dashboard
2. Sees "Execution Readiness" section with summary metrics
3. Button: "Generate Execution Readiness"
4. On success, displays:
   - All 10 checks with status badges
   - Reasons why each check is blocked/failed/passed
   - "What's Blocking Execution" list with guidance
   - Check count summary
5. Safety banner always visible explaining readiness-only visibility
6. Can regenerate report at any time

**Validation:**
- ✅ TypeScript types valid
- ✅ Schemas use Zod with z.literal() for safety
- ✅ Build: `npm run typecheck` passes
- ✅ No forbidden patterns (child_process, exec, Math.random, provider calls)
- ✅ No direct fetch (uses brainCoreRequest)
- ✅ Full report schema defined and exported

**Testing:**
- Manual: Click "Generate Execution Readiness", verify all 10 checks display
- Manual: Verify all blockers are visible
- Manual: Verify check status badges render correctly
- Manual: Verify safety banner present
- Manual: Verify no Apply/Execute button
- Manual: Verify guidance text displays for blockers

**Next Phase (V+1):**
- Build check details deep view (modal or separate page)
- Add "How to unblock" implementation guidance links
- Add feedback mechanism to track check improvements
- Implement milestone tracking for unblocking progress

---

### PHASE W — Executor Dry-Run Contract

**Files:**
- `projects/brain-core/src/adapters/infinite-brain-proposal-executor-dry-run.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-status.ts` (MODIFIED)
- `projects/brain-core/src/api/routes.ts` (MODIFIED)
- `projects/brain-console-center/lib/braincore-schemas.ts` (MODIFIED)
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` (MODIFIED)
- `operations/ibr/README.md` (This documentation)

**What it does:**
- Generates executor dry-run report describing what would execute if execution were allowed
- Reads approved proposals, application plan, and readiness report
- Produces operations contract with category-specific operation types
- All operations marked: dryRunOnly: true, executionBlocked: true, applied: false
- No execution occurs
- No Mind writes occur
- No proposals are applied

**Executor Dry-Run Report:**

Input files:
- `proposal-application-plan-latest.json` — approved proposals converted to plan
- `proposal-execution-readiness-latest.json` — execution readiness checks and blockers

Output file:
- `proposal-executor-dry-run-latest.json` — dry-run contract

Report fields:
- **reportId**: Deterministic SHA256 hash of planId + readinessId + step IDs
- **generatedAt**: ISO8601 timestamp
- **applicationPlanId**: ID from application plan (null if missing)
- **readinessReportId**: ID from readiness report (null if missing)
- **status**: blocked | dry-run-ready (blocked if canExecute is false)
- **canExecute**: false (always)
- **wouldExecuteSteps**: 0 (no execution in this phase)
- **blockedSteps**: count of total steps (all blocked)
- **operations**: Array of dry-run operations
- **blockers**: List of blocker reasons from readiness report
- **safety**: All safety literals enforced

**Operation Types by Category:**

| Category | Operation Type | Preview Behavior |
|----------|---------------|------------------|
| atomization | preview_atomic_note_creation | Show paths that would be created |
| entity-metadata | preview_metadata_update | Show frontmatter changes |
| edge-review | preview_edge_review | Show edge updates |
| cleanup | preview_cleanup_review | Show entities to review for cleanup |
| wiki-writing | preview_wiki_page_creation | Show wiki page paths |
| task-extraction | preview_task_creation | Show tasks to be created |
| fallback | preview_manual_review | Manual review required |

**Operation Schema:**

```typescript
{
  operationId: string,                    // deterministic hash
  stepId: string,
  proposalId: string,
  category: string,
  operationType: string,                  // category-specific type
  targetPathsPreview: string[],
  wouldWriteToMind: boolean,
  wouldDeleteFiles: boolean,              // always false in this phase
  wouldMoveFiles: boolean,                // always false in this phase
  dryRunOnly: true,
  executionBlocked: true,
  applied: false,
  rollbackPreview: string,
  validationChecks: [{
    checkId: string,
    label: string,
    status: 'pass' | 'fail' | 'uncertain',
    reason: string
  }]
}
```

**API Endpoints:**

POST `/infinite-brain/proposals/executor-dry-run/generate`
- Generates dry-run report from latest plan + readiness
- Returns report summary + safety invariants
- Response includes: canExecute false, dryRunOnly true, executionBlocked true, writesToMind false

GET `/infinite-brain/proposals/executor-dry-run`
- Returns full dry-run report with all operations
- 404 if missing

GET `/infinite-brain/proposals/executor-dry-run/summary`
- Returns metadata: status, canExecute, wouldExecuteSteps, blockedSteps, operationCount, blockerCount
- 404 if missing

**Safety Invariants:**
- ✅ Dry-run-only (no execution)
- ✅ Can Execute always false
- ✅ Execution Blocked always true
- ✅ No proposals applied
- ✅ No Mind writes
- ✅ All operations marked dryRunOnly: true
- ✅ All operations marked executionBlocked: true
- ✅ All operations marked applied: false
- ✅ No model calls
- ✅ No continuous runtime
- ✅ Deterministic report and operation IDs (no randomness)

**Console Display:**

New "Executor Dry Run" section shows:
- Can Execute: No (always)
- Dry Run Only: Yes (always)
- Operations: count
- Blocked: count
- Blockers: count
- Generated: timestamp
- Button: "Generate Executor Dry Run" (never "Execute" or "Apply")

**Status Integration:**

`GET /infinite-brain/status` now includes:
- `runtime.executorDryRun`:
  - available
  - generatedAt
  - status
  - canExecute: false
  - wouldExecuteSteps: 0
  - blockedSteps
  - operationCount
  - blockerCount
  - dryRunOnly: true
  - executionBlocked: true
  - safety (all false/true literals)

**Future Phase (After Implementation Approval):**

When all 10 readiness checks pass AND explicit operator approval is recorded:
- Build actual proposal executor
- Implement allowlisted writer for each category
- Add proposal application state tracking
- Create proposal rollback capability
- Add audit trail logging

**Next Phase (W+1):**
- Build operation details viewer (show what each operation would do)
- Add rollback preview for each operation
- Show validation check details and uncertainties
- Build "How to fix blocker" guidance links

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
