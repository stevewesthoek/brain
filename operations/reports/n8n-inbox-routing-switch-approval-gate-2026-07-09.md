# n8n Inbox Routing Switch — Explicit Approval Gate — Batch 8O

**Batch 8O Correction:** This report corrects Batch 8N inaccuracies in approval-gate path prefixes and folder counts.

**Original header:** Batch 8N

**Date:** 2026-07-09  
**Batch:** 8O (correction of 8N)  
**Executor:** Codex (Haiku)

## Summary

Workflow deployment completed in Batch 8M with routing preserved in legacy mode (`capture/inbox`). This report creates an explicit approval gate for switching live Save-to-Mind routing from `capture/inbox` to `inbox/new` via Dokploy environment variable.

**No deployment performed. No Dokploy env changed. No webhook sent. No workflow execution triggered. No Mind files changed. No capture content moved.**

## Current State Verification (Batch 8N)

### Brain Repository
- **Latest commit:** `97a33ca5` — docs: record n8n inbox workflow deployment
- **Dirty status:** Only known unrelated/generated paths present (verified)

### Mind Repository (Read-Only)
- **Latest commit:** `4da3e56` — docs: prioritize Workbench stability strategy
- **Dirty status:** Expected files only — `M wiki/log.md`, `?? Untitled.canvas`, `?? wiki/organisations/prochat/pitch-decks/`
- **No changes made:** ✅ Confirmed

### Mind Folder State (Read-Only Count)
```
capture/inbox      19 files (19 Markdown files — existing capture content)
inbox/new          1 file (README.md only — target folder, scaffolding only)
capture/failed     3 files (3 Markdown files — existing failed captures)
inbox/failed       1 file (README.md only — target folder, scaffolding only)
```

Note: `inbox/new` and `inbox/failed` are target folders and currently contain only README scaffolding. Existing capture content remains in `capture/inbox` and `capture/failed`.

### Deployed Workflow (Read-Only Verification)
- **Source file:** `operations/automations/n8n/workflows/mind-inbox.json`
- **Workflow name:** `Save to Mind — Capture for Mind Steward`
- **Webhook path:** `mind-inbox` ✓
- **JSON valid:** Yes ✓
- **Resolve Inbox Path node:** Present ✓
  - Reads: `$env.MIND_INBOX_PATH` ✓
  - Fallback: `capture/inbox` ✓
- **Prepare Capture node:** Present ✓
  - No Code-node process.env access ✓
  - No Code-node $env access ✓
- **Failure routing:** Not implemented in simple workflow ✓
- **GitHub target:** `stevewesthoek/mind` ✓

### Current Deployed Routing State
- **Dokploy env:** `MIND_INBOX_PATH=unset`
- **Active fallback:** `capture/inbox` (legacy)
- **Behavior:** All captures route to `capture/inbox/<timestamp>-<slug>.md`

## Proposed Switch

### Exact Change
Set Dokploy n8n environment variable:
```
MIND_INBOX_PATH=inbox/new
```

### Routing Impact After Switch
- **New captures will route to:** `inbox/new/<timestamp>-<slug>.md`
- **Webhook path:** Unchanged — `mind-inbox`
- **Workflow logic:** Unchanged
- **Failure handling:** Not affected (not implemented in simple workflow)

### Non-Effects (Explicit)
- ❌ Does NOT move existing `capture/inbox` content
- ❌ Does NOT edit `.obsidian/app.json`
- ❌ Does NOT update Mind docs or context
- ❌ Does NOT change failure routing
- ❌ Does NOT affect GitHub authentication or target repo
- ❌ Does NOT alter existing captures or their metadata

## Explicit Approval Statement

**To proceed with the routing switch, the operator must explicitly approve:**

> "I approve switching live Save-to-Mind routing to inbox/new by setting Dokploy MIND_INBOX_PATH=inbox/new."

No deployment, env change, webhook, or Mind mutation occurs without this exact statement.

## Rollback Instructions

If the switch causes issues:

1. **Rollback option A** — unset the variable:
   ```
   Dokploy n8n env: MIND_INBOX_PATH (delete)
   ```
   Routing reverts to `capture/inbox` (legacy fallback).

2. **Rollback option B** — explicit re-revert:
   ```
   Dokploy n8n env: MIND_INBOX_PATH=capture/inbox
   ```
   Routing explicitly reverts to `capture/inbox`.

3. **Redeploy/restart:** Only required if Dokploy compose policy mandates env redeployment.

## Validation Plan After Approval

After the exact approval statement is received and env is set:

1. **Verify env value:**
   - SSH to Dokploy
   - `docker inspect apps-internal-n8n-cvjx2s-n8n-1 | grep MIND_INBOX_PATH`
   - Confirm value is `inbox/new`

2. **Redeploy/restart if required:**
   - If Dokploy requires redeployment: execute redeploy
   - Otherwise: no action needed (env changes auto-apply)

3. **Send controlled test capture:**
   - Invoke webhook with test payload:
     ```json
     {
       "source": "test-gate",
       "title": "Batch 8N Approval Test",
       "content": "Testing inbox/new routing",
       "type_hint": "test"
     }
   ```

4. **Verify test file created:**
   - File should exist at: `inbox/new/<timestamp>-batch-8n-approval-test.md`
   - Read file to confirm metadata (no modification)
   - Record exact file path

5. **Confirm via commit:**
   - If test file created in new location, approval gate is successful
   - Existing `capture/inbox` content remains untouched

## Strict Boundary Compliance — Batch 8N

✓ No deployment performed  
✓ No Dokploy env changed  
✓ No n8n restarted  
✓ No webhook sent  
✓ No workflow execution triggered  
✓ No test captures created  
✓ No Mind files changed  
✓ No capture content moved  
✓ No roadmap updated  
✓ No implementation plan updated  
✓ No `.obsidian/app.json` edited  
✓ Only approval gate report created  
✓ Mind repo read-only confirmed  

## Summary

Deployment (Batch 8M) is complete and stable. Current routing is preserved at `capture/inbox` via unset `MIND_INBOX_PATH`. The switch to `inbox/new` is explicit, reversible, and non-destructive. Awaiting operator approval before proceeding.

---

**Next:** If approval statement received → Batch 8O (execute switch, test, validate).  
**If no approval:** Stop and await explicit gate approval.
