# Infinite Brain Writer Architecture

**Status:** Design document (NOT IMPLEMENTED)  
**Date:** 2026-06-08  
**Phase:** Y (Future executor layer design)

> This document defines the architecture for the future Infinite Brain proposal writer layer. The writer is **not yet implemented**. All writer functions are currently disabled and return blocked status. Do not treat this as an existing system.

---

## Overview

The Infinite Brain Writer is the execution layer that applies approved proposals to the Mind vault after all readiness checks pass and explicit operator approval is recorded. The writer:

- Applies proposals from the application plan to the Mind vault
- Never executes until all 10 readiness checks pass
- Requires explicit operator confirmation (not just "approved")
- Uses allowlisted Brain-owned writer functions (no shell execution)
- Respects iOS/Obsidian sync safety (blocks until verified)
- Maintains rollback capability for all destructive operations
- Logs all changes to the entity changelog (append-only)
- Posts evidence to the evidence store
- Never calls model providers directly (uses AI Model Selector)
- Never enables continuous runtime
- Implements post-write verification before marking steps applied

---

## Writer Responsibilities

The writer is responsible for converting approved proposals into actual Mind mutations:

1. **Read approved proposals** from application plan
2. **Verify all preconditions** (dry-run validated, operator approval recorded, blockers resolved)
3. **Apply changes category by category** using allowlisted writer functions
4. **Update entity changelog** for all mutations
5. **Post evidence** to evidence store for AI context
6. **Run post-write verification** to confirm changes were written correctly
7. **Mark steps applied** only after verification passes
8. **Log rollback capability** in case reversal is needed

---

## Category-Specific Writer Boundaries

Each category has its own writer function with strict boundaries:

### Atomization Writer

**Responsibility:** Split atomic notes from entity metadata  
**Boundaries:**
- Create new note files in `mind/01-inbox/` (always atomized)
- Never modify existing notes
- Extract YAML frontmatter only (no inline edits)
- Never delete source entities (leave intact, mark atomized)
- Validate file path safety (no path traversal)

**Preconditions:**
- Dry-run shows targetPaths are in `mind/01-inbox/`
- No existing files at target paths
- Frontmatter is valid YAML
- Parent directory exists (`mind/01-inbox/`)

**Post-Write Verification:**
- Read back created files
- Verify YAML frontmatter parses
- Confirm file exists at target path
- Compare with dry-run preview

**Rollback:**
- Delete created files only
- Restore original entity metadata if modified

### Entity Metadata Writer

**Responsibility:** Update entity metadata and frontmatter  
**Boundaries:**
- Modify YAML frontmatter only (no file structure changes)
- Never delete or move files
- Never write to Mind directly (changes go through atomization if needed)
- Validate YAML syntax before writing
- Never modify content body, only metadata headers

**Preconditions:**
- Entity file exists
- YAML syntax is valid
- No merge conflicts with concurrent edits
- Parent directory exists

**Post-Write Verification:**
- Read back modified file
- Parse YAML frontmatter
- Confirm changes match proposal

**Rollback:**
- Restore original frontmatter from changelog

### Edge/Evidence Writer

**Responsibility:** Record relationship edges and supporting evidence  
**Boundaries:**
- Never apply edge deletions (only additions)
- Post to evidence store (append-only, immutable)
- Record edge sources and confidence scores
- Update edge metadata incrementally
- Never modify entity structure

**Preconditions:**
- Edge source is documented (repo, file, timestamp)
- Confidence score is in [0, 1]
- Both entities exist in changelog
- Evidence store is writable

**Post-Write Verification:**
- Query evidence store for posted evidence
- Confirm edges recorded correctly
- Verify confidence scores stored

**Rollback:**
- Mark evidence as invalidated (append-only)
- Never delete evidence entries

### Wiki-Writing Writer

**Responsibility:** Generate and post wiki pages  
**Boundaries:**
- Create new wiki files in `mind/05-wiki/`
- Never overwrite existing wiki pages
- Content generated from entity graph only (no LLM calls)
- Never include personal strategy (read-only context)
- Markdown syntax only

**Preconditions:**
- Target wiki path doesn't exist
- Entity data is complete
- Wiki index is writable
- Parent directory exists

**Post-Write Verification:**
- Read back created wiki file
- Verify Markdown syntax
- Confirm links resolve to entities

**Rollback:**
- Delete created wiki files
- Update wiki index to remove references

### Task Extraction Writer

**Responsibility:** Extract tasks from proposals  
**Boundaries:**
- Create new task entries in `mind/04-tasks/`
- Add to kanban.md (machine-brain tasks marked with #machine tag)
- Never delete tasks (only archive)
- Link to source proposals
- Include priority and due date if available

**Preconditions:**
- Task file structure exists
- Kanban.md exists and is writable
- Task ID generation deterministic
- Source proposal references available

**Post-Write Verification:**
- Read back created task entry
- Confirm kanban.md updated
- Verify task ID is unique

**Rollback:**
- Mark tasks as archived
- Remove from kanban.md (append archive marker)

### Cleanup Writer (Disabled/Destructive)

**Responsibility:** Review and cleanup marked-for-cleanup entities  
**Boundaries:**
- **DISABLED BY DEFAULT** — This writer is intentionally destructive
- **REQUIRES EXPLICIT OPERATOR CONFIRMATION** for each deletion
- Never automatic deletion
- Archive-first approach: move to `mind/99-archive/` before deletion
- Preserve deletion audit trail
- Never delete strategy decisions or active projects

**Preconditions (ALL must pass before cleanup can run):**
- Explicit operator approval for each entity to cleanup
- Entity marked as reviewed and approved for deletion
- No active references (edges point away but none point back)
- Backups exist (cleanup creates archive before deletion)
- Deletion reason is documented

**Post-Write Verification:**
- Confirm files moved to archive
- Verify deletion log entry created
- Query for any remaining references (should be zero)

**Rollback:**
- Restore from archive directory
- Restore deletion log marker

**Why Destructive Cleanup is Blocked:**
1. iOS sync: Deletions sync unpredictably; current detection is unreliable
2. Obsidian vault: Deletion may orphan links; verification incomplete
3. Long-term strategy: No confidence in "cleanup complete" state
4. Operator safety: Requires explicit per-item approval
5. Audit trail: Deletion history must be preservable

---

## Rollback Strategy

Rollback is essential because some operations cannot be undone automatically:

### Reversible Operations
- File creation → Delete created files
- Metadata updates → Restore from changelog
- Evidence posting → Mark as invalidated
- Wiki generation → Delete wiki files
- Task creation → Archive tasks

### Irreversible Operations
- Cleanup/deletion → Restore from archive (if available)
- File moves → Restore original paths (if recorded)
- Entity consolidation → Requires manual inspection

**Rollback Preconditions:**
- Full execution history available (changelog)
- Original state recorded (before/after diffs)
- No concurrent modifications during rollback
- Operator approval required

---

## Post-Write Verification

After each category-specific writer runs, verification confirms the changes were applied correctly:

1. **Read-back verification:** File exists and content matches proposal
2. **Syntax validation:** YAML parses, Markdown valid, JSON schema passes
3. **Reference integrity:** Links resolve, edges correct, entities accessible
4. **Changelog audit:** Change logged correctly with timestamp and author
5. **Evidence posted:** Evidence store contains mutation records
6. **Rollback recorded:** Rollback plan stored and accessible

**Verification Failure Handling:**
- Stop execution immediately
- Do NOT mark step as applied
- Trigger automatic rollback if partial
- Record failure reason in execution log
- Require operator manual review before retry

---

## iOS/Obsidian Sync Safety

Mind is synchronized to iOS via Obsidian Git plugin. Execution writer must account for:

1. **Sync Timing:** Changes may take 5-30 seconds to sync
2. **Deletion Detection:** File deletions sometimes fail to sync (especially rapid deletes)
3. **Conflict Resolution:** Concurrent edits on iOS and Mac can create conflicts
4. **Backup Availability:** Execution writer must not delete until sync completes

**Writer Requirements:**
- Never execute until sync safety is verified by allowlisted Brain action
- Wait for sync ACK before considering operation complete
- Archive before delete (cleanup-only safety)
- Log all sync timestamps
- Provide manual intervention point if sync stalls

---

## Changelog & Evidence Store Integration

Every write is recorded in two places:

### Entity Changelog (Append-Only JSONL)
```jsonl
{
  "timestamp": "2026-06-09T14:23:45Z",
  "entityId": "decision-hire-eng",
  "entityType": "Decision",
  "action": "updated",
  "author": "writer:atomization",
  "sourceJob": "proposal-executor",
  "diffSummary": "Split atomic note from entity metadata"
}
```

### Evidence Store (Queryable, Immutable)
```json
{
  "evidenceId": "evidence-{hash}",
  "timestamp": "2026-06-09T14:23:45Z",
  "entityId": "decision-hire-eng",
  "sourceKind": "proposal-execution",
  "sourceRepo": "brain",
  "assertion": "Entity atomized into mind/01-inbox/atomic-001.md",
  "confidence": 0.99
}
```

**Writer Responsibility:**
- Log every mutation to changelog
- Post evidence for AI context
- Both operations must succeed (all-or-nothing)
- Append-only (never overwrite)

---

## Approval Gates

Three gates must all pass before execution:

### Gate 1: Readiness Checks (10 checks, all must pass or block)
```typescript
const checks = [
  'Plan exists',
  'Plan is preview-only',
  'Execution blocked flag set',
  'No steps already applied',
  'Mind write gate available',          // ← Currently blocked
  'Rollback plans present',
  'iOS sync safety available',           // ← Currently blocked
  'Allowlisted writer available',        // ← Currently blocked
  'Operator approval gate',              // ← Currently blocked
  'Dry-run validation available',
];
```

### Gate 2: Explicit Operator Approval
- User explicitly clicks "Execute" (not just "Approved")
- User confirms all dry-run operations
- User acknowledges rollback capability and risks
- Approval recorded with timestamp and reason

### Gate 3: Dry-Run-Before-Write
- Dry-run report must exist and be recent (within 1 hour)
- Writer must validate actual state matches dry-run preview
- If any divergence, warn operator and require new dry-run

---

## Allowlisted Writer Requirement

The writer is **not a generic subprocess**. It is:

1. **Brain-owned code** (in this repo)
2. **Type-safe TypeScript** (not shell scripts, not subprocess calls)
3. **Sandboxed to filesystem operations** only (no network, no model calls)
4. **Auditable** (all code reviewed and committed)
5. **No eval, no child_process, no exec, no spawn**

**Valid Writer Patterns:**
```typescript
// ✅ Valid: Type-safe file I/O with Zod validation
const updated = await updateEntity(entityId, { metadata });

// ✅ Valid: Append-only changelog record
await logMutation({ entityId, action, timestamp });

// ❌ Invalid: Shell execution
child_process.exec(`mv ${oldPath} ${newPath}`);

// ❌ Invalid: Subprocess call to external script
spawn('python', ['writer.py', '--entity', id]);

// ❌ Invalid: Direct model API call
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const result = await openai.chat.completions.create(...);

// ❌ Invalid: Child process to node script
exec('node scripts/apply-proposal.js', { cwd: '/app' });
```

---

## No Shell Execution

The writer is forbidden from executing shell commands:

- ❌ `child_process.exec()`
- ❌ `child_process.spawn()`
- ❌ `child_process.execFile()`
- ❌ `require('child_process')`
- ❌ Shelling out to Python, Ruby, etc.
- ❌ System commands (`rm`, `mv`, `cp`, `git`, etc.)

All file operations go through Node.js `fs` module with Zod validation.

---

## No Direct Model Provider Calls

The writer never calls model providers directly:

- ❌ OpenAI API
- ❌ Anthropic API (Claude)
- ❌ Google Gemini API
- ❌ LangChain wrappers
- ❌ Direct HTTP requests to model endpoints

If LLM output is needed (e.g., for wiki content):

1. Proposal includes pre-generated content (from application planning phase)
2. Content is Zod-validated before write
3. No runtime generation during execution
4. AI Model Selector is consulted at planning time only

---

## No Automatic Deletion

Destructive cleanup writer never runs automatically:

- ❌ No scheduled cleanup runs
- ❌ No background deletion tasks
- ❌ No automatic archive-then-delete chains
- ❌ No "old entity cleanup" timers

Cleanup requires:
1. Explicit proposal generation (not automatic)
2. Operator review (proposal list)
3. Operator approval decision
4. Application planning (converts to steps)
5. Explicit operator execution approval
6. Per-entity confirmation before delete

---

## No Continuous Runtime

Writer execution is **manual, on-demand**:

- ❌ No scheduled execution
- ❌ No event watchers
- ❌ No polling loops
- ❌ No "auto-apply when ready" timers
- ✅ Manual "Execute" button in Console
- ✅ Operator must click "Generate Dry-Run" first
- ✅ Operator must review operations
- ✅ Operator must click "Execute" explicitly

---

## Deterministic Attempt IDs

Execution attempt IDs must be deterministic:

```typescript
// ✅ Correct: Hash of dry-run ID + precondition statuses
const attemptId = crypto
  .createHash('sha256')
  .update(dryRunId + preconditions.map(p => p.status).join(','))
  .digest('hex')
  .substring(0, 12);

// ❌ Incorrect: Uses Date.now()
const attemptId = `attempt-${Date.now()}`;

// ❌ Incorrect: Uses Math.random()
const attemptId = `attempt-${Math.random().toString(36)}`;

// ❌ Incorrect: Uses crypto.randomBytes()
const attemptId = crypto.randomBytes(6).toString('hex');
```

---

## Future Implementation Phases

Execution writer is blocked until each phase completes:

| Phase | Gate | Status | Required Before Writer |
|-------|------|--------|------------------------|
| T | Execution readiness checks | ✅ Done | YES |
| U | Application plan preview | ✅ Done | YES |
| W | Executor dry-run | ✅ Done | YES |
| X | Dry-run operation visibility | ✅ Done | YES |
| Y | Writer architecture + disabled skeleton | 🔄 In progress | YES (this phase) |
| Z | Writer implementation (category by category) | ⏳ Blocked | NO — awaiting Phase Y |
| Z+1 | iOS/Obsidian sync safety verification | ⏳ Blocked | YES (before cleanup) |
| Z+2 | Operator approval gate implementation | ⏳ Blocked | YES (before execution) |
| Z+3 | Execution tracing and rollback | ⏳ Blocked | YES (verification layer) |

---

## Design Principles

1. **Blocked-by-default:** Everything is disabled until all gates pass
2. **Operator authority:** Humans make execution decisions, not automated systems
3. **Visibility-first:** Show dry-run and readiness before allowing write
4. **Rollback-required:** Every write must have documented rollback plan
5. **Append-only-audit:** All mutations logged immutably
6. **Type-safe:** No shell, no subprocess, no eval, no dynamic code
7. **AI Model Selector:** All LLM work routed through allowlisted brain entry point
8. **iOS-sync-aware:** Respects Obsidian sync timing and limitations
9. **Evidence-driven:** Changes justified by entity changelog + evidence store
10. **Deterministic:** No randomness in IDs, repeatable execution

---

## What This Document Does NOT Include

This document specifies the **architecture only**. It does not include:

- ❌ Implementation details (see writer category files when implemented)
- ❌ Code snippets for actual writing
- ❌ Database schema (entity/edge schemas are defined elsewhere)
- ❌ iOS sync protocol details (defined in separate sync design)
- ❌ Operator UI for approval gate (defined in Console design)
- ❌ Rollback procedures (will be defined per-category)

Those are separate design documents and implementation phases.

---

## Approval Gates Timeline

When each gate is implemented:

**Phase Y (this):** Disabled skeleton only, no gates implemented  
**Phase Z:** Allowlisted writer function stubs (still blocked)  
**Phase Z+1:** iOS sync safety check (unblocks "iOS sync safety" check 7)  
**Phase Z+2:** Operator approval gate (unblocks "Operator approval" check 9)  
**Phase Z+3:** Category-specific writers (enable actual execution)

Until all phases complete, `canExecute` remains false and all execution endpoints return 409 Blocked status.

---

## References

- Execution Readiness Checks (10 checks): `projects/brain-core/src/adapters/infinite-brain-proposal-execution-readiness.ts`
- Application Plan: `projects/brain-core/src/adapters/infinite-brain-proposal-application-planner.ts`
- Executor Dry-Run: `projects/brain-core/src/adapters/infinite-brain-proposal-executor-dry-run.ts`
- Entity Changelog: `projects/brain-core/src/adapters/infinite-brain/entity-changelog.ts`
- Evidence Store: (Future phase)
- Console UI: `projects/brain-console/components/infinite-brain-proposal-review.tsx`
