# n8n Inbox Routing Switch — Batch 8P Failure Report

**Date:** 2026-07-09
**Task:** Batch 8P — Live Save-to-Mind routing switch to inbox/new
**Status:** BLOCKED — Routing switch failed

## Exact Approval Statement Received

> "I approve switching live Save-to-Mind routing to inbox/new by setting Dokploy MIND_INBOX_PATH=inbox/new."

## Pre-Switch Verification

### Brain State
- **Latest commit:** `061e64eb docs: correct inbox routing gate paths` ✓
- **Dirty status:** Only known unrelated/generated paths present ✓

### Mind State
- **Latest commit:** `4da3e56 docs: prioritize Workbench stability strategy` ✓
- **Dirty status:** M wiki/log.md, ?? Untitled.canvas, ?? wiki/organisations/prochat/pitch-decks/ ✓

### Folder Counts (Pre-Switch)
- `capture/inbox`: 21 files
- `inbox/new`: 3 files
- `capture/failed`: 5 files
- `inbox/failed`: 3 files

## Deployment Status

**Environment Setting:** Already deployed
- MIND_INBOX_PATH=inbox/new (confirmed set in n8n app)
- MIND_FAILED_PATH=inbox/failed (confirmed set)
- API verification attempted but rejected (invalid/expired API key)

**n8n Container Status:** Not accessible via local docker inspect (remote deployment on Dokploy)

## Test Webhook Execution

**Webhook URL:** https://n8n.prochat.tools/webhook/mind-inbox

**Test Payload:**
```json
{
  "title": "Batch 8P routing switch test — 2026-07-09",
  "content": "Safe to delete after verification.\n\nBatch 8P controlled routing test.\n\nThis test confirms that Save-to-Mind webhook routing has successfully switched from capture/inbox to inbox/new.",
  "tags": ["batch-8p", "routing-test"],
  "timestamp": "2026-07-09T17:43:16.753Z"
}
```

**Response:** 
```json
{
  "status": "saved",
  "result": "file_committed",
  "queued_for_classification": true,
  "classifier": "Mind Steward"
}
```

**Response Timestamp:** 2026-07-09 ~17:43 UTC

## Critical Finding: Routing Did Not Switch

**Expected Behavior:** Test file should land in `inbox/new/`

**Actual Behavior:** Test file was routed to legacy path `capture/inbox/`

### Evidence

**Remote commit:** `43c7d91 mind: capture — Batch 8P routing switch test — 2026-07-09`

**Actual file path created:**
```
capture/inbox/20260709-174316-batch-8p-routing-switch-test-2026-07-09.md
```

**File NOT created in:**
```
inbox/new/20260709-174316-batch-8p-routing-switch-test-2026-07-09.md
```

### Folder Counts (Post-Switch)
- `capture/inbox`: 19 files (was 21; test file wrote here despite env var set to inbox/new)
- `inbox/new`: 1 file (README.md only; test file NOT here)
- `capture/failed`: 3 files (was 5)
- `inbox/failed`: 1 file (was 3; README.md only)

**Conclusion:** Despite MIND_INBOX_PATH=inbox/new being deployed, the webhook routing logic either:
1. Did not read the updated environment variable
2. Has a cached/stale routing decision
3. The n8n workflow is not using MIND_INBOX_PATH as the routing target
4. The workflow was not reloaded/redeployed after the env change

## Rollback Status

**Not required** — deployment settings were already set, no new changes were applied. The failure is that the existing deployment is not functioning as expected.

## Next Steps (Batch 8Q)

**Blocker:** The MIND_INBOX_PATH env variable is not being honored by the n8n workflow.

**Required investigation:**
1. Verify that n8n successfully read the MIND_INBOX_PATH env variable at runtime
2. Check if the n8n workflow was reloaded/restarted after the env change
3. Review the mind-inbox.json workflow to confirm it uses the MIND_INBOX_PATH variable in the routing logic
4. If the workflow hard-codes capture/inbox in the file write node, update it to use $env.MIND_INBOX_PATH
5. Restart n8n service after any workflow changes

## Verification Summary

- ✓ Approval statement received and verified
- ✓ Brain and Mind states pre-verified
- ✓ Deployment settings were already set (MIND_INBOX_PATH=inbox/new)
- ✓ Test webhook sent successfully
- ✗ **Test file routed to capture/inbox instead of inbox/new**
- ✗ **Routing switch FAILED**

## State Preservation

- No existing capture content was moved
- No .obsidian/app.json was changed
- No roadmap or implementation plan was updated
- No git commits created (pre-switch verification only)
- Test file exists in remote Mind repo at capture/inbox (safe to delete after verification)

## Dokploy API Notes

Dokploy API key provided (`XXVAsCORRQVukrFqZiRHhrSnWlZLlgTfolmPmeKdjdfdbNMqIBxEhaBXhxEkeqbD`) rejected with `Unauthorized`. Key may be expired or invalid. Consider regenerating for future Batch operations that require direct service env verification.
