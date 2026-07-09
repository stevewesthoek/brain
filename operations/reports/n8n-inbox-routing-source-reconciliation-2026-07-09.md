# n8n Inbox Routing Source Reconciliation — Batch 8Q

**Date:** 2026-07-09
**Task:** Reconcile Brain local workflow source with live n8n deployed state
**Status:** ✅ COMPLETE — Source-of-truth mismatch fixed

## Pre-Reconciliation State

**Brain:**
- Latest commit: `ebf71f67 docs: record Batch 8P inbox routing switch — SUCCESS`
- Dirty status: Known unrelated/generated paths only

**Mind:**
- Local latest commit: `4da3e56 docs: prioritize Workbench stability strategy`
- Local dirty status: M wiki/log.md, ?? Untitled.canvas, ?? wiki/organisations/prochat/pitch-decks/
- Local Batch 8P test file: NOT present (expected — remote-only capture)

**Live n8n Workflow (FwP5INe9qoo1OwGC):**
- Active: true
- Hardcoded routing: inbox/new
- Status: Working, receiving new captures

**Local Brain Workflow Source (mind-inbox.json):**
- resolve-inbox-path: Had env var fallback logic
- prepare-capture: Had double-fallback to capture/inbox
- Status: OUT OF SYNC with live deployment

## Verification Results

### Remote Mind Evidence (Read-Only)
**Method:** git ls-tree origin/main

**Result:** ✅ Verified
- Batch 8P test file found at: `inbox/new/20260709-175104-batch-8p-routing-test-final-with-both-nodes-hardcoded-2026-07-09.md`
- File is in correct routing target path
- Remote commit: a0761fd (latest on origin/main has this file)

### Live n8n Workflow (Read-Only)
**Method:** n8n API GET /workflows/FwP5INe9qoo1OwGC

**Result:** ✅ Verified
```
Name: Save to Mind — Capture for Mind Steward
ID: FwP5INe9qoo1OwGC
Active: true
Webhook: mind-inbox

Resolve Inbox Path Output:
  {"inboxPrefix": "inbox/new"}

Prepare Capture Code:
  const inboxPrefix = 'inbox/new';
```

### Local Brain Workflow Source (Before)
**File:** operations/automations/n8n/workflows/mind-inbox.json

**Result:** OUT OF SYNC
```
Resolve Inbox Path:
  {"inboxPrefix": "={{ ($env.MIND_INBOX_PATH || 'capture/inbox').trim()... || 'capture/inbox' }}"}

Prepare Capture:
  const inboxPrefix = (raw.inboxPrefix || 'capture/inbox').replace(...) || 'capture/inbox';
```

## Source-of-Truth Update

**Changes Made:**

1. **resolve-inbox-path node:**
   ```json
   FROM: {"inboxPrefix": "={{ ($env.MIND_INBOX_PATH || 'capture/inbox').trim().replace(/^\/+|\/+$/g, '') || 'capture/inbox' }}"}
   TO:   {"inboxPrefix": "inbox/new"}
   ```

2. **prepare-capture node:**
   ```javascript
   FROM: const inboxPrefix = (raw.inboxPrefix || 'capture/inbox').replace(/^\/+|\/+$/g, '') || 'capture/inbox';
   TO:   const inboxPrefix = 'inbox/new';
   ```

3. **Other nodes:**
   - Webhook: unchanged (mind-inbox)
   - Build Inbox Note: unchanged
   - Check Existing GitHub File: unchanged (stevewesthoek/mind repo, GITHUB_MIND_PAT)
   - Connections: unchanged
   - Workflow name: unchanged
   - Workflow ID: unchanged

## Validation Results

✅ JSON parses successfully
✅ resolve-inbox-path contains: `"inboxPrefix": "inbox/new"`
✅ prepare-capture contains: `const inboxPrefix = 'inbox/new';`
✅ No fallback routes to capture/inbox
✅ No references to $env or process.env in routing logic
✅ Webhook path: mind-inbox (unchanged)
✅ GitHub target: stevewesthoek/mind (unchanged)
✅ mind-inbox-fixed.json still valid (unchanged)
✅ Connections preserved

## Actions NOT Taken

- ✓ No new webhook sent
- ✓ No workflow execution triggered
- ✓ No Dokploy env changed
- ✓ No n8n restart/redeploy
- ✓ No existing capture content moved
- ✓ No .obsidian/app.json edited
- ✓ No roadmap updated
- ✓ No implementation plan updated
- ✓ No Mind repo files modified
- ✓ No unrelated Brain dirty paths staged

## Brain Changes Summary

**Files Changed:**
- `M operations/automations/n8n/workflows/mind-inbox.json` — Updated to match live hardcoded inbox/new routing
- `M operations/reports/n8n-inbox-routing-switch-2026-07-09.md` — Added Batch 8Q reconciliation note
- `A operations/reports/n8n-inbox-routing-source-reconciliation-2026-07-09.md` — This report

**Files NOT Changed:**
- operations/automations/n8n/workflows/mind-inbox-fixed.json (unchanged, still valid)
- No roadmap files
- No implementation plan files
- No Mind repo files

## Reconciliation Status

**Source-of-Truth:** ✅ RECONCILED

Brain local workflow source now matches live n8n deployed state. The hardcoded `inbox/new` routing is now the authoritative source in both:
1. Live n8n instance (active, receiving captures)
2. Brain repo source file (now synced, ready for future exports/imports)

**Ready for Next Step:** Batch 8Q can proceed with Mind-side documentation updates reflecting inbox/new as the active Save-to-Mind target.

## Note on Future Env Var Migration

The workflow currently hardcodes `inbox/new`. If n8n environment variable access to `$env.MIND_INBOX_PATH` can be verified working with correct syntax, this workflow can be updated to dynamically read the env var. This would allow Dokploy env changes to take effect without workflow redeployment.

Current status: Env var access methods (`$env.*` and `process.env.*`) were tested during Batch 8P and did not function as expected in n8n expressions, resulting in fallback to legacy routing.
