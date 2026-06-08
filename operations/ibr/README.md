# Infinite Brain Runtime (IBR) — Operations Guide

**Status:** Foundation Phase (IB0–IB3) + Pipeline phases (IB4–IB11) report-only complete + Execution phases (R–X) preview/readiness/dry-run complete + Writer architecture (Y) designed + Disabled executor skeleton (Y) created + Category writer stubs (Z) created all blocked  
**Date:** 2026-06-08  
**Phases Implemented:** IB0, IB1, IB2, IB3, IB4 (atomizer), IB8 (edges), IB9 (audit), IB10 (insights), IB11 (proposals) — all report-only; R–X execution phases; Y writer architecture + disabled executor; Z category writer stubs (all blocked)

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

### PHASE X — Executor Dry-Run Operations Console Visibility

**Files:**
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` (MODIFIED)
- `projects/brain-console-center/lib/braincore-schemas.ts` (NO CHANGE — schemas already exist)
- `operations/ibr/README.md` (This documentation)

**What it does:**
- Enhances InfiniteBrainExecutorDryRun component to display detailed operations from full dry-run report
- Adds "View Detailed Operations" button to fetch and display full report
- Shows operations in scrollable grid (max 10 initially, with count summary)
- Displays each operation's details: category, operationType, proposalId, stepId, targetPathsPreview
- Shows safety indicators: wouldWriteToMind, wouldDeleteFiles, wouldMoveFiles
- Displays applied/dryRunOnly/executionBlocked status badges
- All operations marked: dryRunOnly=true, executionBlocked=true, applied=false
- No execution controls added
- No Apply/Execute buttons
- No Mind writes
- Visibility-only, blocked-by-default

**Component Enhancements:**

1. **State Management:**
   - Added `fullReport` state for complete dry-run report
   - Added `fetchingFullReport` loading flag for async report fetch

2. **New Function:**
   ```typescript
   async function fetchFullDryRunReport() {
     // Fetch from /infinite-brain/proposals/executor-dry-run
     // Uses brainCoreRequest with infiniteBrainExecutorDryRunReportSchema
   }
   ```

3. **Operations Display:**
   - Conditional rendering: Show "View Detailed Operations" button if fullReport not yet loaded
   - Once loaded, display "Dry-Run Operations" section with:
     - Safety banner: "dry run only", "no files changed", "Mind unchanged"
     - Grid of operations (first 10, scrollable)
     - Each operation card shows:
       - operationType + category
       - Dry-run status badge
       - proposalId (first 8 chars)
       - stepId (first 12 chars)
       - targetPathsPreview (first 2 paths with "N more" summary)
       - Safety flags: wouldWriteToMind, wouldDeleteFiles, wouldMoveFiles
   - Pagination: "Showing X of Y operations" if count > 10

4. **Safety Messaging:**
   - Banner states: dry run only, no execution, no files changed, Mind unchanged
   - Status badges show dryRunOnly=true, applied=false
   - Never labels operations as "pending execution" or "will apply"

5. **UI Flow:**
   - Generate Dry Run (existing): Generates report, fetches summary
   - View Detailed Operations (new): Fetches full report, displays operations
   - Regenerate Dry Run (existing): Regenerates report, clears fullReport state

**Operation Card Display:**

```
┌─────────────────────────────────────┐
│ preview_atomic_note_creation [Dry-run]
│ atomization
│
│ Proposal: a1b2c3d4
│ Step: 123456789abc
│ Paths:
│   • mind/01-inbox/atomic-001.md
│   • mind/01-inbox/atomic-002.md
│   +1 more
│
│ [Writes to Mind] [Deletes] [Moves]
└─────────────────────────────────────┘
```

**Safety Invariants Maintained:**
- ✅ Visibility-only (no execution)
- ✅ No Apply/Execute buttons
- ✅ No Mind writes
- ✅ All operations marked applied=false
- ✅ All operations marked dryRunOnly=true
- ✅ All operations marked executionBlocked=true
- ✅ Blocked-by-default (nothing changes)
- ✅ Uses Brain Core client/proxy pattern

**Testing:**
- TypeScript typecheck passes
- Build succeeds
- No forbidden patterns (Math.random, child_process, exec, spawn, shell, fs.write)
- Component renders without errors
- "View Detailed Operations" button fetches full report
- Operations display with all required fields
- Safety indicators show correctly

**Console Display Updated:**

Executor Dry Run section now shows:
1. Summary metrics (Can Execute, Dry Run Only, Operations, Blocked, Blockers, Generated)
2. If fullReport loaded: "Dry-Run Operations" section with operation details
3. If fullReport not loaded: "View Detailed Operations" button
4. "Regenerate Dry Run" button always present

**Future Enhancement (Not in Phase X):**
- Add rollback preview for each operation
- Show validation check details and uncertainties
- Build "How to fix blocker" guidance links
- Add operation search/filter
- Show operation dependencies

---

### PHASE Y — Writer Architecture Design & Disabled Executor Skeleton

**Files:**
- `operations/ibr/INFINITE_BRAIN_WRITER_ARCHITECTURE.md` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-proposal-executor.ts` (NEW)
- `operations/ibr/README.md` (This documentation)

**What it does:**
- Defines architecture for future proposal writer layer (not yet implemented)
- Creates disabled executor skeleton that returns blocked status
- Documents category-specific writer boundaries and responsibilities
- Outlines approval gates, safety requirements, and rollback strategy
- Specifies preconditions that must pass before execution is allowed
- Establishes deterministic attempt ID generation
- Clarifies no shell execution, no direct model calls, no continuous runtime

**Writer Architecture Document (`INFINITE_BRAIN_WRITER_ARCHITECTURE.md`):**

**Scope:** Design document only, no implementation

**Writer Responsibilities:**
- Apply approved proposals to Mind vault after all checks pass
- Update entity changelog (append-only JSONL)
- Post evidence to evidence store
- Run post-write verification before marking steps applied
- Provide rollback capability for destructive operations

**Category-Specific Writers:**
1. **Atomization:** Split atomic notes from entity metadata (creates files in `mind/01-inbox/`)
2. **Entity Metadata:** Update YAML frontmatter only
3. **Edge/Evidence:** Record relationship edges and supporting evidence (append-only)
4. **Wiki-Writing:** Generate wiki pages in `mind/05-wiki/`
5. **Task Extraction:** Create tasks in `mind/04-tasks/`
6. **Cleanup:** Review and cleanup marked entities (DISABLED/DESTRUCTIVE, requires per-item approval)

**Key Design Principles:**
- **Blocked-by-default:** All execution disabled until all 7 preconditions pass
- **Operator authority:** Humans make execution decisions, not automated systems
- **Visibility-first:** Show dry-run and readiness before allowing write
- **Type-safe:** TypeScript only, no shell execution, no subprocess calls
- **Audit trail:** All mutations logged to entity changelog + evidence store
- **Rollback-capable:** Every write has documented rollback strategy
- **iOS-sync-aware:** Respects Obsidian sync timing and limitations
- **Deterministic IDs:** No randomness, repeatable execution

**Approval Gates (3 levels):**
1. **Readiness Checks:** All 10 checks must pass (currently 4 are blocked)
2. **Explicit Operator Approval:** User explicitly clicks "Execute" (not just "Approved")
3. **Dry-Run-Before-Write:** Dry-run must exist and match current state

**Disabled Executor Skeleton (`infinite-brain-proposal-executor.ts`):**

**Exports:**
- `executeInfiniteBrainProposalPlanDisabled()` — Always returns blocked status
- `evaluateExecutorPreconditions()` — Lists all 7 preconditions (all blocked)
- `readExecutorDryRunForExecution()` — Reads dry-run for inspection

**Types:**
- `InfiniteBrainExecutionPrecondition` — name, status, reason
- `InfiniteBrainExecutionAttempt` — attemptId, preconditions, blockedReasons
- `InfiniteBrainExecutionResult` — Always returns ok: false, executed: false, canExecute: false

**Behavior:**
```typescript
executeInfiniteBrainProposalPlanDisabled(dryRunId, totalSteps) returns:
{
  ok: false,
  status: 'blocked',
  canExecute: false,
  executed: false,
  appliedSteps: 0,
  writesToMind: false,
  executionBlocked: true,
  attempt: {
    attemptId: deterministic_hash,
    preconditions: [
      { name: 'readinessCanExecute', status: 'blocked', reason: '...' },
      { name: 'dryRunAvailable', status: 'blocked', reason: '...' },
      { name: 'explicitOperatorApproval', status: 'blocked', reason: '...' },
      { name: 'allowlistedWriterAvailable', status: 'blocked', reason: '...' },
      { name: 'iosSyncSafe', status: 'blocked', reason: '...' },
      { name: 'rollbackPlanAvailable', status: 'blocked', reason: '...' },
      { name: 'postWriteVerificationAvailable', status: 'blocked', reason: '...' },
    ],
    blockedReasons: [...]
  }
}
```

**Preconditions (All Block Execution in Phase Y):**
1. `readinessCanExecute` — Execution readiness checks not all passing
2. `dryRunAvailable` — Dry-run report must be generated and validated
3. `explicitOperatorApproval` — Operator approval gate not yet implemented
4. `allowlistedWriterAvailable` — Proposal writer not yet implemented
5. `iosSyncSafe` — iOS sync safety verification not yet implemented
6. `rollbackPlanAvailable` — Rollback capability not yet implemented
7. `postWriteVerificationAvailable` — Post-write verification not yet implemented

**Deterministic Attempt IDs:**
- Hash of: dryRunId + precondition names/statuses (sorted)
- No randomness, no Date.now(), no crypto.randomBytes()
- Same dry-run + same preconditions = same attemptId

**Safety Invariants:**
- ✅ Execution always returns blocked status
- ✅ canExecute always false
- ✅ executed always false
- ✅ appliedSteps always 0
- ✅ writesToMind always false
- ✅ No proposals applied
- ✅ No files created, deleted, or moved
- ✅ No model calls
- ✅ No continuous runtime
- ✅ No shell execution
- ✅ Deterministic IDs (no randomness)

**What This Phase Does NOT Include:**
- ❌ Real writer implementation
- ❌ Actual file writes
- ❌ Apply button in Console
- ❌ Execute button in Console
- ❌ iOS sync safety verification
- ❌ Operator approval gate UI
- ❌ Category-specific writer functions
- ❌ Rollback implementation

**Future Implementation Phases:**
| Phase | Blocker | Status |
|-------|---------|--------|
| Z | Allowlisted writer functions | ⏳ Blocked |
| Z+1 | iOS sync safety verification | ⏳ Blocked |
| Z+2 | Operator approval gate | ⏳ Blocked |
| Z+3 | Category-specific implementations | ⏳ Blocked |

**Testing:**
- TypeScript typecheck: ✅ Pass
- No forbidden patterns: ✅ Verified
- Disabled skeleton exports: ✅ Match contract
- Preconditions all block: ✅ Confirmed
- Execution result always blocked: ✅ Confirmed

**Reference Documentation:**
- Full writer architecture: `operations/ibr/INFINITE_BRAIN_WRITER_ARCHITECTURE.md`
- Design principles and rationale: Same document
- Category boundaries and responsibilities: Same document
- Rollback strategy: Same document
- iOS sync requirements: Same document

---

### PHASE Z — Category-Specific Writer Stubs (All Blocked)

**Files:**
- `projects/brain-core/src/adapters/infinite-brain-writers/types.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-atomization.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-metadata.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-edges.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-wiki.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-tasks.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/writer-cleanup.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-writers/index.ts` (NEW)
- `projects/brain-core/src/adapters/infinite-brain-proposal-executor.ts` (MODIFIED)
- `projects/brain-core/src/tests/infinite-brain-writer-stubs.test.ts` (NEW)
- `operations/ibr/README.md` (This documentation)

**What it does:**
- Creates 6 category-specific disabled writer stubs
- All writers return blocked status (ok: false, canWrite: false)
- Each writer defines its blockers (category-specific)
- Connects disabled executor to writer stubs
- Cleanup writer explicitly marked DESTRUCTIVE and disabled
- Maintains safety: no Mind writes, no file operations, no execution

**Writer Stubs Created:**

1. **Atomization Writer:**
   - Stub: `runAtomizationWriterDisabled()`
   - Blockers: path safety, dry-run validation, writer not implemented, post-write verification
   - Category: `atomization`

2. **Metadata Writer:**
   - Stub: `runMetadataWriterDisabled()`
   - Blockers: frontmatter patcher, conflict detection, YAML validation, writer not implemented
   - Category: `entity-metadata`

3. **Edges/Evidence Writer:**
   - Stub: `runEdgesWriterDisabled()`
   - Blockers: evidence store gate, edge validation, confidence scoring, writer not implemented
   - Category: `edge-review`

4. **Wiki Writer:**
   - Stub: `runWikiWriterDisabled()`
   - Blockers: wiki path policy, content validation, link resolution, writer not implemented
   - Category: `wiki-writing`

5. **Tasks Writer:**
   - Stub: `runTasksWriterDisabled()`
   - Blockers: task schema approval, ID generation, kanban integration, writer not implemented
   - Category: `task-extraction`

6. **Cleanup Writer (DESTRUCTIVE-DISABLED):**
   - Stub: `runCleanupWriterDisabled()`
   - Blockers: destructive operations disabled, per-item approval missing, archive strategy incomplete, deletion audit trail incomplete, iOS sync safety uncertain, writer not implemented
   - Category: `cleanup`
   - Explicit messaging: "DESTRUCTIVE OPERATIONS DISABLED"

**Shared Writer Types (`types.ts`):**
- `InfiniteBrainWriterCategory` — Enum of 6 categories
- `InfiniteBrainWriterInput` — dryRunId, category, targetSteps, etc.
- `InfiniteBrainWriterPrecondition` — name, status, reason, requiredForWrite
- `InfiniteBrainWriterResult` — ok: false, status: blocked, canWrite: false, etc.
- `InfiniteBrainWriterSafety` — writesToMind: false, canWrite: false, etc.
- `createBlockedWriterResult()` — Helper to create blocked result for any category

**Writer Result Structure:**
```typescript
{
  ok: false,
  status: 'blocked',
  category: 'atomization' | 'entity-metadata' | 'edge-review' | 'wiki-writing' | 'task-extraction' | 'cleanup',
  canWrite: false,
  wroteToMind: false,
  applied: false,
  filesCreated: [],
  filesModified: [],
  filesDeleted: [],
  executionBlocked: true,
  blockers: [...],
  preconditions: [...],
  safety: {
    writesToMind: false,
    deletesFiles: false,
    movesFiles: false,
    appliesProposal: false,
    callsModels: false,
    usesShell: false,
    continuousRuntime: false,
    canWrite: false,
    wroteToMind: false,
    executionBlocked: true,
  }
}
```

**Disabled Executor Integration:**
- Updated `infinite-brain-proposal-executor.ts` to import writer stubs
- Added `evaluateWriterStubAvailability()` function
- Returns status of all 6 writers (all available: false, all blocked)
- `allowlistedWriterAvailable` precondition updated: "stubs available but disabled"
- Executor still returns `canExecute: false, executed: false`

**Writer Stub Availability:**
```typescript
evaluateWriterStubAvailability() returns: [
  { category: 'atomization', available: false, blockerCount: 4, blockers: [...] },
  { category: 'entity-metadata', available: false, blockerCount: 4, blockers: [...] },
  { category: 'edge-review', available: false, blockerCount: 4, blockers: [...] },
  { category: 'wiki-writing', available: false, blockerCount: 4, blockers: [...] },
  { category: 'task-extraction', available: false, blockerCount: 4, blockers: [...] },
  { category: 'cleanup', available: false, blockerCount: 6, blockers: [...] },
]
```

**Safety Invariants (All Maintained):**
- ✅ All writers return blocked (ok: false)
- ✅ canWrite always false
- ✅ wroteToMind always false
- ✅ applied always false
- ✅ filesCreated always empty
- ✅ filesModified always empty
- ✅ filesDeleted always empty
- ✅ executionBlocked always true
- ✅ No Mind writes
- ✅ No file operations
- ✅ No model calls
- ✅ No shell execution
- ✅ No continuous runtime
- ✅ Cleanup explicitly marked DESTRUCTIVE-DISABLED

**Tests Added:**
- 9 focused tests in `infinite-brain-writer-stubs.test.ts`:
  1. Atomization writer returns blocked
  2. Metadata writer returns blocked
  3. Edges writer returns blocked
  4. Wiki writer returns blocked
  5. Tasks writer returns blocked
  6. Cleanup writer returns blocked with destructive-disabled messaging
  7. All writers have safety invariants correct
  8. Writer stub availability shows all blocked
  9. Disabled executor remains blocked with writer stubs

All tests pass: ✅ 9/9

**What This Phase Does NOT Include:**
- ❌ Real writer implementation
- ❌ Actual file writes
- ❌ Apply button in Console
- ❌ Execute button in Console
- ❌ Category-specific implementation logic
- ❌ Post-write verification
- ❌ Rollback implementation
- ❌ Cleanup deletion capability

---

### PHASE AB — Operator Approval Intent Recording

**Files:**
- `projects/brain-core/src/adapters/infinite-brain-operator-approval.ts` — Operator approval adapter
- `projects/brain-core/src/api/routes.ts` — GET/POST `/infinite-brain/operator-approval` endpoints
- `projects/brain-console-center/lib/braincore-schemas.ts` — Operator approval schemas
- `projects/brain-console-center/components/infinite-brain-proposal-review.tsx` — UI for recording approval
- `projects/brain-core/src/adapters/infinite-brain-status.ts` — Status integration
- `projects/brain-core/src/adapters/infinite-brain-proposal-execution-readiness.ts` — Readiness check 9 update
- `projects/brain-core/src/tests/infinite-brain-operator-approval.test.ts` — Unit tests

**What it does:**
- Records explicit operator approval intent (approved/rejected/needs-review)
- Requires operator name, decision, and written reason
- Generates deterministic `approvalId` from operator + decision + reason (no timestamps/randomness in ID)
- Stores approval record at `runtime/local/infinite-brain/operator-approval-latest.json`
- Integrates with execution readiness check 9 (operator approval gate)
- Approval intent alone does NOT enable execution (executionEnabled remains false)

**Key Safety Invariants:**
- ✅ `executionEnabled: false` (always, even if decision is approved)
- ✅ `canExecute: false` (always)
- ✅ `applied: false` (always)
- ✅ `writesToMind: false` (always)
- ✅ `approvalRecordOnly: true` (always)
- ✅ Required next gates listed (deletion-sync-verification, allowlisted-writer-deployment, post-write-verification)
- ✅ No Mind modifications
- ✅ No shell execution
- ✅ No model provider calls

**Operator Approval Record Schema:**
```typescript
{
  approvalId: string;              // Deterministic SHA256 hash
  generatedAt: string;             // ISO8601 timestamp
  operator: string;                // Operator name/identifier
  decision: 'approved' | 'rejected' | 'needs-review';
  reason: string;                  // Required written reason
  dryRunReportId: string | null;   // Optional reference to dry-run
  readinessReportId: string | null;// Optional reference to readiness report
  scope: 'execution-approval-intent';
  executionEnabled: false;         // Always false
  canExecute: false;               // Always false
  applied: false;                  // Always false
  writesToMind: false;             // Always false
  expiresAt?: string;              // Optional expiration (ISO8601)
  requiredNextGates: string[];     // Gates still required before execution
  safety: {
    writesToMind: false;
    appliesProposals: false;
    canExecute: false;
    executionEnabled: false;
    applied: false;
    approvalRecordOnly: true;
    continuousRuntime: false;
    modelCalls: false;
  };
}
```

**API Endpoints:**

`GET /infinite-brain/operator-approval`
- Returns latest approval record
- 404 with code `operator_approval_missing` if not found

`POST /infinite-brain/operator-approval/record`
- Records approval intent
- Requires: `operator` (non-empty), `decision` (approved|rejected|needs-review), `reason` (non-empty)
- Response includes safety block with all false values except `approvalRecordOnly: true`
- Returns: `ok: true`, `record`, `safety` object with execution block confirmation

**Console UI (Operator Approval Intent Form):**
- Embedded in InfiniteBrainProposalReview component
- Fields: operator name (text), decision (radio: approved/rejected/needs-review), reason (textarea)
- Button: "Record Approval Intent" (not "Apply", not "Execute")
- Shows current approval intent if available
- Safety text: "Approval intent does not execute proposals. Execution remains blocked. Mind is unchanged."
- Calls `POST /infinite-brain/operator-approval/record` via brainCoreRequest pattern

**Execution Readiness Integration (Check 9):**
- If approval exists with decision `approved`: check status becomes `pass`
- If approval exists with decision `rejected` or `needs-review`: check status remains `blocked`
- If approval missing: check status remains `blocked`
- Reason includes operator name and approval status
- Overall readiness report STILL shows `canExecute: false` (other gates block execution)

**Status Integration:**
- Added `operatorApproval` to `runtime` object in status response
- Includes: `available`, `generatedAt`, `operator`, `decision`, `executionEnabled`, `canExecute`, `applied`, `writesToMind`, `approvalRecordOnly`

**Deterministic ID Generation:**
- `approvalId = SHA256(operator + decision + dryRunReportId + readinessReportId + reason).substring(0,12)`
- Sorted component string (no timestamp, no randomness)
- Same input always produces same ID

**Environment Variables:**
- `IBR_OPERATOR_APPROVAL_PATH` — Override approval record path (absolute or relative to BRAIN_ROOT)

**Safety Checks:**
- ✅ No `executionEnabled: true` in source
- ✅ No `canExecute: true` in source
- ✅ No `applied: true` in source
- ✅ No `writesToMind: true` in source
- ✅ No shell execution
- ✅ No model provider calls
- ✅ No Math.random or crypto.randomBytes for IDs
- ✅ No child_process, exec, spawn
- ✅ Deterministic ID via SHA256

**Validation:**
- ✅ TypeScript types valid
- ✅ Zod schemas pass validation
- ✅ 10 unit tests pass (missing operator, missing reason, invalid decision, approved decision blocks, deterministic ID, readiness integration, needs-review blocked, rejected blocked, required gates, etc.)
- ✅ Build passes
- ✅ No forbidden patterns

**Future Gates (Still Blocked):**
- Deletion sync verification (blocks execution)
- Allowlisted writer deployment (blocks execution)
- Post-write verification (blocks execution)
- Mind write coordination (blocks execution)
- Rollback implementation (blocks execution)

---

**Future Implementation Phases:**
| Phase | Blocker | Status |
|-------|---------|--------|
| Z+1 | iOS sync safety verification | ⏳ Blocked |
| Z+2 | Operator approval gate | ⏳ Blocked |
| Z+3 | Category-specific implementations | ⏳ Blocked |
| Z+4 | Post-write verification | ⏳ Blocked |
| Z+5 | Rollback implementation | ⏳ Blocked |

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
