# Phase 1W Research — Approval-Gated Studio Writes

**Date:** 2026-05-24  
**Status:** Research complete, ready for documentation  
**Goal:** Document approval workflow patterns from industry systems and existing VO codebase state

---

## Industry Best Practices: Approval Workflows

### Airflow (Apache Airflow)
- **Pattern:** Two-step execution (dry-run + approval + execute)
- **UI:** Tasks with status badges → click to see preview → approve button
- **Data:** Stores approval request with: actor, timestamp, diff preview, decision record
- **Scope:** Project-level or task-level approvals

### Dagster (Dagster Orchestrator)
- **Pattern:** "Asset materialization approval" — generate asset, show preview, operator approves
- **UI:** Each asset card shows current state + "pending review" badge + action buttons
- **Data:** Approval tied to asset generation run (immutable audit trail)
- **Scope:** By asset and sensor rule

### n8n (n8n Automation Platform)
- **Pattern:** "Approval workflows" as first-class nodes in DAG
- **UI:** Workflow pauses at approval node → shows message → human clicks approve/reject
- **Data:** Approval decision is part of workflow execution history
- **Scope:** By workflow run

### Common traits across all three:
1. **Preview-based decisions** — show exactly what will happen before approval
2. **Immutable audit trail** — approval decisions are never rewritten
3. **Scoped authority** — different users can approve different types (thumbnails, metadata, final publish)
4. **Timeout handling** — auto-reject or escalate if approval takes too long
5. **Rejection feedback** — operator can comment on why rejected before resubmitting

---

## VO Studio Existing State

### Current Components

**UI: ApprovalQueuePanel** (already exists, lines 1–271)
```typescript
export class ApprovalQueuePanel {
  constructor(container: HTMLElement, projectId: string)
  async initialize(): Promise<void>
  
  private render()        // skeleton HTML
  private loadApprovals() // GET /api/video-orchestrator/approvals/queue?projectId=X
  private renderList()    // render all pending items
  private showDetail()    // expand one item, show variants
  private handleApproval(item, approved) // POST decision
}
```

**States:** Not yet integrated into VOShell or called from anywhere.

**Backend: vo-studio-read.ts** (lines 1–300+)
- `readApprovalQueue(projectId)` — returns `ApprovalQueueResponse`
- `readWorkflowState(packageId)` — returns `ApprovalWorkflowState`
- Stubs: all return empty arrays. No actual data source yet.

**Backend: vo-studio-write.ts** (sample, lines 25–88)
- `createContentItemRequest()` calls `requestAction('custom-content-item-create')`
- Returns `{ ok, approval?: { id, status }, preview?: { contentItem }, error? }`
- Pattern established: writes return approval records + preview data

**Types: vo-studio.ts**
```typescript
export interface Approval {
  id: string;
  type: 'thumbnail' | 'metadata' | 'final_review';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedAt?: string;
  actor?: string;
}

export interface ProductionPackage {
  id: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'queued' | 'completed';
  // ... other fields
}
```

### API Endpoints (routes.ts imports)
- Read: `readApprovalQueue`, `readWorkflowState`, `readExecutionSummary`, `readJobHistory`
- Write: `approveThumbnailRequest`, `approveMetadataRequest`, `finalApprovalRequest`
- Already imported but not yet wired to actual routes

---

## Write Approval Architecture

### Flow: Request → Pending → Approval → Committed

```
User creates content item
  ↓
Request handler validates input
  ↓
Create approval record (status: 'pending')
  ↓
Return preview + approval ID to UI
  ↓
UI shows preview in ApprovalQueuePanel
  ↓
Operator clicks approve/reject
  ↓
Backend patches approval record (status: 'approved' | 'rejected')
  ↓
If approved: commit write (update database, trigger pipeline)
  ↓
If rejected: mark for cleanup, operator can resubmit
```

### Data Model

**ApprovalRequest** (in-flight pending write)
```typescript
{
  id: string;                    // unique approval ID
  projectId: string;
  type: 'content' | 'metadata' | 'thumbnail' | 'package' | 'publish';
  actor: string;                 // who requested (user email or agent ID)
  requestedAt: string;           // ISO timestamp
  
  // What was requested
  requestPayload: Record<string, unknown>;
  
  // Preview (what will happen if approved)
  preview: {
    contentItem?: ContentItem;
    package?: ProductionPackage;
    thumbnail?: ThumbnailAsset;
    metadata?: PackageMetadata;
  };
  
  // Decision tracking
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;            // who approved/rejected
  decidedAt?: string;
  rejectionReason?: string;      // why rejected
  expiresAt?: string;            // auto-reject if not decided by this time
}
```

---

## Scope Decision: Project-Level or Workflow-Step-Level?

### Option A: Project-level approvers
- Entire project requires same operator to approve all write types
- Simpler: one approval panel per project
- Risk: bottleneck if single operator

### Option B: Role-based (thumbnail vs. metadata vs. publish)
- Different roles approve different types
- Alignment with n8n and Dagster patterns
- Complexity: managing role → user mapping

### VO Studio decision: Start with **Option A (project-level)**, evolve to Option B later
- Reason: Keep Phase 1W scope small
- Implement: All approvals require project's designated operator
- Future: Add role-based approval matrix in Phase 2W

---

## Approval Timeout & Escalation

**Pattern:** If approval not decided within time window, escalate

**Suggested rules:**
- Thumbnail/metadata approval: 15 minutes
- Final publish approval: 30 minutes
- Escalation: Email operator, ping Slack, move to escalation queue

**Phase 1W scope:** No timeout. Just show timestamp. Add escalation logic in Phase 2W.

---

## Integration with Existing VO Studio Tabs

### Current VOShell Tabs (Phase 10 & 11 complete)
1. Overview — dashboard
2. Studio — content creation
3. Pipelines — execution tracking
4. Accounts — credential management
5. History — audit log
6. Dashboard — health + metrics

### New Tab: Approvals (Phase 1W)
- Sits alongside other tabs
- Uses existing ApprovalQueuePanel component
- Integrates with VOShell tab management

### Why new tab vs. overlay?
- Industry practice: approval workflows are top-level concerns, not modal overlays
- Allows operators to compare approval preview with other tabs (switch context)
- Consistent with VO Studio navigation model

---

## Audit & Compliance

### What to log?
1. **Approval requested** — actor, timestamp, payload, preview
2. **Approval decided** — decidedBy, decidedAt, approved/rejected, reason
3. **Write committed** — if approved, log actual database mutation

### Where to store?
- Approval records: same database as packages/content items
- Audit log: append-only log in EventLogPanel (Phase 6 already has this)
- Immutability: approval.id + status + decidedAt form immutable key; never update after decided

---

## CSS & Design Alignment

### Existing VO CSS classes (from Phase 10 & 11)
- `.vo-queue-item` — card for approval
- `.vo-approval-type` — badge (thumbnail/metadata/final_review)
- `.vo-type-{type}` — color variants
- `.vo-btn-primary`, `.vo-btn-secondary` — action buttons
- `.vo-message`, `.vo-message-success`, `.vo-message-error` — toasts

**No new CSS needed** — all existing.

---

## Validation Checklist Before Implementation

✅ ApprovalQueuePanel component exists and has correct lifecycle  
✅ Backend types defined (Approval, ApprovalRequest, ApprovalQueueResponse)  
✅ Backend stubs exist in vo-studio-read.ts  
✅ Existing CSS covers approval UI elements  
✅ VOShell integration pattern (two-phase init) is proven  
✅ Write endpoints return approval records + preview  
✅ Audit trail pattern established (requestAction)  

---

## Open Questions for User

1. **Approval timeout:** Should we auto-reject if operator doesn't decide in N minutes, or just warn?
2. **Email notifications:** Should operators get emailed when approval is requested?
3. **Batch approvals:** Should operators be able to approve multiple items at once?
4. **Rejection workflow:** When an operator rejects, should the original request be resubmittable or replaced?

(Recommend: defer these to Phase 2W; Phase 1W focuses on basic approve/reject UI)

---

## Next Steps

1. Document execution plan with 4 clear tasks
2. Implement ApprovalQueuePanel integration into VOShell
3. Wire approval decision handlers (POST endpoints)
4. Test end-to-end: create content → see in queue → approve → verify committed
