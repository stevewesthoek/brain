# Phase 1W Implementation Plan — Approval-Gated Studio Writes

**Date:** 2026-05-24  
**Status:** Ready for implementation  
**Scope:** Integrate ApprovalQueuePanel into VOShell, wire approval decision handlers, validate end-to-end flow  
**Phases:** Phase 1W (this), Phase 2W (future: role-based approvals, escalation, notifications)

---

## Architecture Summary

**Goal:** Prevent unauthorized writes by requiring operator approval before content/package changes are committed.

**Flow:**
1. User initiates write (create content, edit metadata, etc.)
2. Backend creates approval record with preview
3. UI displays pending approval in ApprovalQueuePanel
4. Operator reviews preview and clicks approve/reject
5. If approved: backend commits write and triggers pipeline
6. If rejected: write is discarded, operator can provide feedback

**Scope:** 
- No timeout/escalation (Phase 2W)
- No email notifications (Phase 2W)
- No batch approvals (Phase 2W)
- All approvals project-scoped (one approval queue per project, not role-based)

---

## Implementation Tasks

### Task 1: Integrate ApprovalQueuePanel into VOShell

**File:** `projects/brain-console-obsidian/src/components/VO/VOShell.ts`

**Changes:**
1. Import ApprovalQueuePanel at top: `import { ApprovalQueuePanel } from './ApprovalQueuePanel.js';`
2. Add field after other panel fields: `private approvalQueuePanel: ApprovalQueuePanel | null = null;`
3. Add new tab button after the existing tabs in the HTML template:
   ```
   <button class="vo-tab" data-tab="approvals">Approvals</button>
   ```
4. In `renderCurrentTab()` method, add case for 'approvals':
   ```typescript
   case 'approvals':
     if (this.approvalQueuePanel) {
       this.approvalQueuePanel.destroy();
       this.approvalQueuePanel = null;
     }
     const approvalContainer = this.contentArea.createDiv();
     this.approvalQueuePanel = new ApprovalQueuePanel(approvalContainer, this.state.projectId);
     await this.approvalQueuePanel.initialize();
     break;
   ```
5. In `destroy()` method, add null-guard:
   ```typescript
   if (this.approvalQueuePanel) {
     this.approvalQueuePanel.destroy();
     this.approvalQueuePanel = null;
   }
   ```

**Validation:**
- TypeScript compiles without errors
- No import cycles (ApprovalQueuePanel only imports VOContext)
- Tab renders when clicked

**Expected result:** "Approvals" tab appears in VO Studio tabs row, clicking it loads ApprovalQueuePanel

---

### Task 2: Wire Approval Decision Endpoints in Brain Core

**File:** `projects/brain-core/src/api/routes.ts`

**Changes:**
1. Locate the VO Studio POST route handlers (~line 200+)
2. Add three new POST handlers:
   ```typescript
   if (url === '/api/video-orchestrator/approvals/decide') {
     const body = JSON.parse(requestBody);
     const result = decideApprovalRequest(body); // will implement in Task 3
     sendJson(response, 200, result);
     return;
   }
   
   if (url === '/api/video-orchestrator/thumbnails/approve') {
     const body = JSON.parse(requestBody);
     const result = approveThumbnailRequest(body);
     sendJson(response, 200, result);
     return;
   }
   
   if (url === '/api/video-orchestrator/metadata/approve') {
     const body = JSON.parse(requestBody);
     const result = approveMetadataRequest(body);
     sendJson(response, 200, result);
     return;
   }
   ```

3. Add GET handler for approval queue:
   ```typescript
   if (url.startsWith('/api/video-orchestrator/approvals/queue')) {
     const projectId = parseQueryParam(url, 'projectId');
     const result = readApprovalQueue(projectId);
     sendJson(response, 200, result);
     return;
   }
   ```

**Validation:**
- Routes compile without errors
- Endpoints match what ApprovalQueuePanel expects

**Expected result:** Brain Core API can receive approval decisions and approval queue requests

---

### Task 3: Implement Approval Decision Logic in Adapters

**File:** `projects/brain-core/src/adapters/vo-studio-write.ts`

**New functions to add:**

```typescript
export interface ApprovalDecisionRequest {
  approvalId: string;
  projectId: string;
  approved: boolean;
  variantId?: string;
  rejectionReason?: string;
}

export interface ApprovalDecisionResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: 'approved' | 'rejected';
    decidedAt: string;
  };
  error?: string;
}

export function decideApprovalRequest(
  request: ApprovalDecisionRequest,
): ApprovalDecisionResponse {
  const errors: string[] = [];
  
  if (!request.approvalId?.trim()) errors.push('approvalId is required');
  if (!request.projectId?.trim()) errors.push('projectId is required');
  if (typeof request.approved !== 'boolean') errors.push('approved must be boolean');
  
  if (errors.length > 0) {
    return { ok: false, error: errors.join('; ') };
  }
  
  // TODO: Phase 1W stub
  // In production: look up approval record, update status, trigger write if approved
  
  return {
    ok: true,
    approval: {
      id: request.approvalId,
      status: request.approved ? 'approved' : 'rejected',
      decidedAt: new Date().toISOString(),
    },
  };
}
```

**Validation:**
- Functions accept correct request shapes
- Return correct response types
- No errors during TypeScript check

**Expected result:** Backend can record approval decisions

---

### Task 4: Test End-to-End Flow in Brain Console

**Manual test checklist:**

1. Build and deploy
   ```bash
   cd projects/brain-console-obsidian
   npm run build && npm run package && npm run install:active-vault
   pkill -x "Obsidian" && sleep 2 && open -a Obsidian
   ```

2. Open Brain Console → Video Orchestrator tab
3. Verify "Approvals" tab is visible alongside Overview, Studio, Pipelines, etc.
4. Click "Approvals" tab
5. Verify ApprovalQueuePanel loads (should show "No pending approvals" or list items if any exist)
6. Create test approval via curl:
   ```bash
   curl -X POST http://localhost:4877/api/video-orchestrator/approvals/queue \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "test-project-1",
       "type": "thumbnail",
       "contentItemId": "item-123",
       "packageId": "pkg-456",
       "variants": [
         { "id": "v1", "label": "Variant 1" },
         { "id": "v2", "label": "Variant 2" }
       ]
     }'
   ```
7. Refresh ApprovalQueuePanel (click "Refresh" button)
8. Verify approval item appears in list
9. Click approval item to expand
10. Verify variant options show and "Approve Selected" button is clickable
11. Select a variant and click "Approve Selected"
12. Verify success message appears
13. Verify queue is refreshed and item is removed (or marked as approved)

**Expected result:** Full end-to-end flow works; operator can approve pending writes

---

## Files Modified

1. `projects/brain-console-obsidian/src/components/VO/VOShell.ts` — integrate ApprovalQueuePanel
2. `projects/brain-core/src/api/routes.ts` — add approval decision endpoints
3. `projects/brain-core/src/adapters/vo-studio-write.ts` — add decideApprovalRequest function

---

## Validation Checklist

- [ ] TypeScript: `npm run typecheck` passes
- [ ] Build: `npm run build && npm run package` succeeds
- [ ] Install: `npm run install:active-vault` completes
- [ ] Obsidian: Plugin loads without errors
- [ ] Tab: "Approvals" tab visible in VO Studio
- [ ] Panel: ApprovalQueuePanel renders and shows "No pending approvals"
- [ ] Load: Approval queue loads via API
- [ ] List: Pending approvals appear as items in list
- [ ] Expand: Clicking item shows detail view with variants
- [ ] Approve: Clicking approve button sends decision to backend
- [ ] Feedback: Success/error message appears
- [ ] Refresh: Queue refreshes after decision
- [ ] Console: No errors in browser console

---

## Success Criteria

✅ ApprovalQueuePanel integrated into VOShell  
✅ "Approvals" tab appears in VO Studio navigation  
✅ Approval queue loads from `/api/video-orchestrator/approvals/queue`  
✅ Operator can view pending approvals with preview  
✅ Operator can select variant and approve  
✅ Backend receives approval decision via POST endpoint  
✅ No TypeScript errors or import cycles  
✅ UI is responsive and readable  
✅ Manual test passes end-to-end  

---

## Timeline Estimate

- Task 1 (VOShell integration): 30 minutes
- Task 2 (API routes): 20 minutes
- Task 3 (Approval logic): 30 minutes
- Task 4 (Testing): 30 minutes
- **Total: 1.5–2 hours**

---

## Rollback Plan

If integration breaks VO Studio:
1. Remove "Approvals" tab from SECTION_TABS
2. Revert `renderCurrentTab()` case removal
3. Remove ApprovalQueuePanel import and destroy call
4. Remove approval decision routes from routes.ts
5. Rebuild and reinstall
6. Restart Obsidian

All changes are isolated to VOShell integration; no database or config changes.

---

## Open Questions (defer to Phase 2W)

1. **What triggers approval request creation?** (Currently manual curl. Should integrate with each write endpoint like createContentItemRequest.)
2. **How long before auto-reject?** (Suggest: 15 min for metadata, 30 min for publish. Phase 2W scope.)
3. **Email notification?** (Suggest: yes, but Phase 2W. For now, operator must manually check Approvals tab.)
4. **Batch approval?** (Suggest: allow selecting multiple items + single approve. Phase 2W.)

---

## Notes for Phase 2W

1. Hook all write endpoints (createContentItem, updateContentItem, generateThumbnail, etc.) to create approval records
2. Implement timeout/escalation logic
3. Add email notifications to operator
4. Implement batch approval UI
5. Add role-based approval matrix (thumbnail approver ≠ metadata approver ≠ publish approver)
6. Add rejection feedback form (operator can leave comment for resubmitter)
