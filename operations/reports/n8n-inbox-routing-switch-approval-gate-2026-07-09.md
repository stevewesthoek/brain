# Batch 8P Approval Gate — Routing Switch Result

**Date:** 2026-07-09
**Batch:** Batch 8P — Live Save-to-Mind routing switch to inbox/new
**Result:** **BLOCKED — Routing switch failed**

## Approval Decision

**Exact approval statement received at 2026-07-09:**

> "I approve switching live Save-to-Mind routing to inbox/new by setting Dokploy MIND_INBOX_PATH=inbox/new."

**Operator:** Steve Westhoek

## Execution Result

**Status:** FAILED

Despite MIND_INBOX_PATH being already deployed to n8n as `inbox/new`, the test webhook routed the capture to the legacy path:

- **Expected:** `inbox/new/20260709-174316-batch-8p-routing-switch-test-2026-07-09.md`
- **Actual:** `capture/inbox/20260709-174316-batch-8p-routing-switch-test-2026-07-09.md`

## Root Cause

The n8n workflow is not honoring the MIND_INBOX_PATH environment variable. Likely scenarios:

1. n8n did not reload the workflow after the env var was set
2. The workflow hard-codes the routing path instead of reading from $env.MIND_INBOX_PATH
3. The n8n service requires a restart/redeploy to pick up the env change

## Recommended Next Steps

**For Batch 8Q:**

1. Force n8n workflow reload/redeploy via Dokploy
2. Add request logging to the mind-inbox workflow to confirm env var is being read
3. If workflow hard-codes path, update to use $env.MIND_INBOX_PATH variable
4. Restart n8n service after any changes
5. Re-run Batch 8P test with verification that workflow logs show the correct env value

## Batch 8P Holdover

Batch 8P cannot proceed until routing is verified. Do not advance to Batch 8Q (Mind-side doc updates) until the routing actually switches to inbox/new.

---

**See full details:** `operations/reports/n8n-inbox-routing-switch-2026-07-09.md`
