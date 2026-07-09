# N8N Inbox Workflow Deployment — Batch 8M

**Date:** 2026-07-09  
**Batch:** 8M  
**Executor:** Codex (Haiku)

## Context

Deploy prepared n8n workflow while preserving legacy routing to `capture/inbox`.

## Pre-Deployment State

- **Brain commit:** `acf38c27` — docs: verify n8n inbox env gate
- **Mind commit:** `4da3e56` — docs: prioritize Workbench stability strategy (read-only)
- **Dokploy n8n env routing gate:**
  - `MIND_INBOX_PATH`: **unset** ✓
  - `MIND_FAILED_PATH`: not checked (not used in simple workflow)
  - `N8N_BLOCK_ENV_ACCESS_IN_NODE`: `false` (permits env reads)
- **Pre-deploy risk:** LOW — env gate is clear

## Deployment Action

**Workflow ID:** `FwP5INe9qoo1OwGC`  
**Workflow Name:** `Save to Mind — Capture for Mind Steward`  
**Source file:** `operations/automations/n8n/workflows/mind-inbox.json`  
**Deployment method:** n8n API (PUT `/workflows/{id}`)  
**Deployment command:**
```bash
jq 'del(.tags)' operations/automations/n8n/workflows/mind-inbox.json | \
curl -X PUT \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @- \
  "${N8N_API_URL}/workflows/FwP5INe9qoo1OwGC"
```

**Deployment timestamp:** 2026-07-09T16:28:20.032Z (from n8n response)  
**Workflow version after deploy:** versionId `a419673f-2038-41e1-953d-ae38719c51cb`, counter 278

## Deployment Issues

**Issue:** Workflow JSON contained read-only `tags` field causing 400 error.  
**Resolution:** Removed `tags` before PUT request using `jq 'del(.tags)'`.  
**Impact:** No workflow logic changed; only metadata field removed.

## Post-Deployment Verification

Verified deployed workflow by reading n8n API response and confirming:

✓ **Workflow name:** `Save to Mind — Capture for Mind Steward`  
✓ **Webhook path:** `mind-inbox`  
✓ **Nodes present:**
- Webhook (trigger)
- Resolve Inbox Path (set node)
- Prepare Capture (code node)
- Build Inbox Note (code node)
- Check Existing GitHub File (http node)
- Handle File Check Result (code node)
- File Exists? (if node)
- Save to GitHub - Create (http node)
- Save to GitHub - Update (http node)
- Respond (webhook response)

✓ **Resolve Inbox Path configuration:**
```
{{ ($env.MIND_INBOX_PATH || 'capture/inbox').trim().replace(/^\/+|\/+$/g, '') || 'capture/inbox' }}
```
Correctly reads `$env.MIND_INBOX_PATH` with fallback to `capture/inbox`.

✓ **Prepare Capture node:** Code node — no process.env access, no $env use.  
✓ **Build Inbox Note node:** Code node — writes frontmatter with `para_type`, `confidence`, `signal_quality`.  
✓ **Workflow active:** `active: true` in response.  
✓ **No MIND_FAILED_PATH:** Simple workflow does not implement failed-path routing.

## Routing Preservation Confirmation

**Pre-deploy MIND_INBOX_PATH value:** unset/empty  
**Fallback routing target:** `capture/inbox` (legacy)  
**Post-deploy routing target:** `capture/inbox` (unchanged, env-gated)

Because `MIND_INBOX_PATH` is unset, all captures route through the fallback to `capture/inbox`. Routing remains in legacy mode.

## Strict Boundary Compliance

✓ No roadmap updated  
✓ No implementation plan updated  
✓ Mind repo not edited  
✓ No `.obsidian/app.json` edited  
✓ No capture content moved  
✓ No webhook sent  
✓ No workflow execution triggered  
✓ No test captures created  
✓ No Dokploy env values changed  
✓ N8n not restarted  
✓ Only workflow definition deployed  

## Summary

Workflow deployment succeeded. Routing gate remains clear (`MIND_INBOX_PATH` unset). Captures will route to legacy `capture/inbox` on next webhook invocation. No workflow execution or Mind mutations occurred during deployment.

---

## Batch 8N & 8O Follow-Up Notes

**Batch 8N executed:** 2026-07-09

Batch 8N prepared explicit approval gate for routing switch without deploying or executing workflow. Approval gate report created at `operations/reports/n8n-inbox-routing-switch-approval-gate-2026-07-09.md`.

**Batch 8O correction:** 2026-07-09

Batch 8O corrected Batch 8N approval-gate path/count inaccuracies:
- Corrected current routing path from `wiki/capture/inbox` to `capture/inbox`
- Corrected target routing path from `wiki/inbox/new` to `inbox/new`
- Verified actual Mind folder counts: `capture/inbox` (19 files), `inbox/new` (1 README.md), `capture/failed` (3 files), `inbox/failed` (1 README.md)
- Confirmed wiki-prefixed inbox/capture paths do not exist in Mind

Current state remains:
- Routing: `capture/inbox` (legacy, via unset `MIND_INBOX_PATH`)
- Deployment: Stable, no execution triggered
- Mind: Read-only, unchanged

Gate is ready. Awaiting explicit operator approval before switching to `inbox/new`.

---

**Next batch:** Batch 8P — if approval received, execute routing switch, test, and validate.
