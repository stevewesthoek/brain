# Phase 4E Deployment Guide

## Prerequisites

- Google Ads CLI Phase 4D fully deployed and tested
- n8n instance running at `https://n8n.prochat.tools` with admin access
- Python 3.13+ environment
- sqlite3 database at `data/google-ads/google_ads.sqlite3`

## Step 1: Start HTTP Server

The HTTP server allows n8n to callback to control mutations.

### Option A: Manual (Testing)

```bash
cd /Users/Office/Repos/stevewesthoek/brain
python3 tools/google-ads/http_server.py --port 8001 --host localhost
```

Output:
```
INFO:__main__:Starting HTTP server on localhost:8001
INFO:__main__:Endpoints: /approve, /reject, /apply, /status
```

### Option B: Supervisor (Production)

Copy supervisor config:
```bash
sudo cp operations/system-configs/supervisor/google-ads-http-server.conf \
  /etc/supervisor/conf.d/google-ads-http-server.conf

sudo supervisorctl reread
sudo supervisorctl update google-ads-http-server
sudo supervisorctl status google-ads-http-server
```

Verify:
```bash
curl -X POST http://localhost:8001/status -H "Content-Type: application/json" \
  -d '{"mutation_id": 1}'
# Expected: 404 (mutation doesn't exist yet) or status record if one does
```

## Step 2: Configure Environment Variables

Set webhook URLs in your shell or `.env` file:

```bash
export GOOGLE_ADS_N8N_AUTO_APPROVE="https://n8n.prochat.tools/webhook/google-ads-auto-approve"
export GOOGLE_ADS_N8N_ESCALATION="https://n8n.prochat.tools/webhook/google-ads-escalate"
export GOOGLE_ADS_N8N_COMPLIANCE="https://n8n.prochat.tools/webhook/google-ads-compliance-check"
```

Or add to `~/.config/google-ads/brain-google-ads.env`:
```
GOOGLE_ADS_N8N_AUTO_APPROVE=https://n8n.prochat.tools/webhook/google-ads-auto-approve
GOOGLE_ADS_N8N_ESCALATION=https://n8n.prochat.tools/webhook/google-ads-escalate
GOOGLE_ADS_N8N_COMPLIANCE=https://n8n.prochat.tools/webhook/google-ads-compliance-check
```

## Step 3: Deploy n8n Workflows

### 3.1 Auto-Approve Workflow

Import the workflow JSON:

```bash
# Navigate to n8n UI → Workflows → Import
# Upload: operations/backups/n8n-workflows/google-ads-auto-approve-workflow.json
```

**Configure:**
1. Edit "Webhook Trigger" → Test your domain (typically auto-filled to `https://n8n.prochat.tools`)
2. Set "Slack Success" to your notification channel (default: `#google-ads-notifications`)
3. Save & Activate

**Test:**
```bash
curl -X POST "https://n8n.prochat.tools/webhook/google-ads-auto-approve" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "recommendation_queued",
    "details": {"mutation_id": 1, "mutation_type": "test", "impact": 100},
    "risk_score": {"level": "low", "score": 20}
  }'
```

Expected: Workflow executes, mutation approved in SQLite, Slack notification sent.

### 3.2 Escalation Workflow

Import the workflow JSON:

```bash
# Navigate to n8n UI → Workflows → Import
# Upload: operations/backups/n8n-workflows/google-ads-escalation-workflow.json
```

**Configure:**
1. Edit "Webhook Trigger" → Test your domain
2. Set "Post to Slack" → Channel = `#google-ads-mutations`
3. Set "Slack Approved" → Channel = `#google-ads-mutations`
4. Set "Slack Timeout" → Channel = `#google-ads-errors`
5. Save & Activate

**Test:**
```bash
# First create a test high-risk mutation
sqlite3 data/google-ads/google_ads.sqlite3 <<EOF
INSERT INTO pending_mutations
  (mutation_type, campaign_id, resource_type, resource_id, payload, status, rule_source, created_at, updated_at)
VALUES
  ('apply_recommendation', 'test', 'recommendation', '999',
   '{"impact_estimate": 2500}', 'pending', 'test', datetime('now'), datetime('now'));
EOF

# Send escalation webhook
curl -X POST "https://n8n.prochat.tools/webhook/google-ads-escalate" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "recommendation_queued",
    "details": {"mutation_id": 999, "mutation_type": "test", "impact": 2500},
    "risk_score": {"level": "urgent", "score": 85, "reasons": ["High impact"]}
  }'
```

Expected:
- Message posted to `#google-ads-mutations` with ✅ and ❌ reactions
- React with ✅ → mutation approved & applied
- React with ❌ → mutation rejected
- Wait 15 min → auto-reject with timeout reason

### 3.3 Compliance Gatekeeper Workflow

Import the workflow JSON:

```bash
# Navigate to n8n UI → Workflows → Import
# Upload: operations/backups/n8n-workflows/google-ads-compliance-gatekeeper.json
```

**Configure:**
1. Edit "Webhook Trigger" → Test your domain
2. Save & Activate

**Test:**
```bash
# Valid keywords
curl -X POST "https://n8n.prochat.tools/webhook/google-ads-compliance-check" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "mutation_pre_queue",
    "details": {
      "mutation_type": "add_negative_keywords",
      "keywords": ["bad keyword phrase", "low quality search"],
      "campaign_id": "123"
    }
  }'

# Invalid keywords (too long, stop words)
curl -X POST "https://n8n.prochat.tools/webhook/google-ads-compliance-check" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "mutation_pre_queue",
    "details": {
      "mutation_type": "add_negative_keywords",
      "keywords": ["this is a very long keyword that exceeds eighty characters and should be rejected"],
      "campaign_id": "123"
    }
  }'
```

Expected: Returns `{"valid": false, "errors": ["Keyword too long..."]}`

## Step 4: Configure Slack Bot

Workflows require Slack bot integration for posting and reading reactions.

1. **Create/Configure Slack Bot:**
   - Go to n8n → Credentials → Create new Slack credential
   - Authorize your Slack workspace
   - Grant permissions: `chat:write`, `reactions:read`, `channels:read`

2. **Configure Channels:**
   - Set `#google-ads-mutations` for escalation reviews
   - Set `#google-ads-notifications` for success messages
   - Set `#google-ads-errors` for timeout/error logs

3. **Test Bot:**
   ```
   # In Slack, try:
   /invite @n8n-bot #google-ads-mutations
   /test-bot "hello"
   ```

## Step 5: Update CLI Configuration

Edit `config/google-ads/rules.toml` to enable n8n webhooks:

```toml
[notifications.n8n_webhooks]
auto_approve = "https://n8n.prochat.tools/webhook/google-ads-auto-approve"
escalation = "https://n8n.prochat.tools/webhook/google-ads-escalate"
compliance_check = "https://n8n.prochat.tools/webhook/google-ads-compliance-check"
webhook_base_url = "https://n8n.prochat.tools/webhook"
```

Verify:
```bash
grep -A 5 "n8n_webhooks" config/google-ads/rules.toml
```

## Step 6: Test End-to-End

### Full Workflow Test

```bash
# 1. Sync (no mutations yet)
bash tools/google-ads/run.sh sync

# 2. Queue recommendations (triggers webhooks)
bash tools/google-ads/run.sh recommendations
# Watch for:
#   - Mutations inserted into SQLite
#   - Webhooks POST to n8n
#   - n8n workflows execute
#   - Low-risk auto-approved in SQLite
#   - High-risk escalation posted to Slack

# 3. Check pipeline status
bash tools/google-ads/run.sh status
# Expected: pending=X (awaiting Slack reactions), approved=Y (auto-approved), applied=0

# 4. React to escalation in Slack
# → Open #google-ads-mutations
# → React with ✅ to approve
# → n8n executes, mutation applied

# 5. Verify final state
bash tools/google-ads/run.sh status
# Expected: pending=0, approved=X, applied=X
```

### Error Scenarios

**HTTP server not reachable:**
```bash
curl http://localhost:8001/status -d '{"mutation_id": 1}'
# If fails: supervisor service down, start with `supervisorctl start google-ads-http-server`
```

**Webhook not firing:**
```bash
# Check CLI logs
tail -f data/google-ads/logs/cli.log | grep webhook

# Check if environment variables set
echo $GOOGLE_ADS_N8N_AUTO_APPROVE
echo $GOOGLE_ADS_N8N_ESCALATION
```

**n8n workflow not executing:**
1. Check n8n Executions log (UI → Workflows → Executions)
2. Verify webhook path matches: `https://n8n.prochat.tools/webhook/google-ads-auto-approve`
3. Test webhook manually: `curl -X POST https://n8n.prochat.tools/webhook/google-ads-auto-approve -d '{"test": true}'`

**Slack reactions not detected:**
1. Check Slack bot has `reactions:read` permission
2. Manually post test message to `#google-ads-mutations`
3. Add reaction, check n8n execution logs to see if workflow fires

## Step 7: Monitor & Optimize

### Key Metrics

Track in n8n Dashboard:

| Metric | Target | Formula |
|--------|--------|---------|
| Auto-approve success rate | >95% | low-risk approved / low-risk queued |
| Manual approval avg time | <5 min | time(reaction) - time(posted) |
| Escalation timeout rate | <2% | timed-out / total-escalations |
| HTTP server uptime | >99.9% | (3600 - failures) / 3600 |

### Logs

Check logs for issues:

```bash
# HTTP server logs
tail -f data/google-ads/logs/http_server.log

# n8n execution logs
# UI → Workflows → Executions → Filter by workflow

# SQLite audit trail
sqlite3 data/google-ads/google_ads.sqlite3 \
  "SELECT * FROM change_events WHERE change_type LIKE '%webhook%' ORDER BY id DESC LIMIT 10;"
```

### Adjustments

If auto-approve rate too low:
```toml
# config/google-ads/rules.toml
[approval_gates]
high_impact_threshold_usd = 1000.0  # Increase from 500 to approve more mutations
```

If escalation timeout too frequent:
```toml
[escalation]
reaction_timeout_minutes = 20  # Increase from 15 to give more time
```

## Rollback Plan

If workflows are causing issues:

```bash
# 1. Disable n8n webhooks (keep CLI working)
# Edit config/google-ads/rules.toml
[notifications.n8n_webhooks]
auto_approve = ""
escalation = ""

# 2. Pending mutations stay pending until manually approved
bash tools/google-ads/run.sh approve --id 1
bash tools/google-ads/run.sh apply --id 1 --live

# 3. Stop HTTP server if needed
supervisorctl stop google-ads-http-server
```

## Next Steps

1. Monitor Phase 4E for 1 week
2. Measure success rates against targets above
3. Adjust thresholds based on real-world performance
4. Plan Phase 4F (approval dashboard UI, analytics, rollback)

---

**Deployment Status**: Ready for staging  
**Time Estimate**: 30 min (setup) + 1 week (monitoring)  
**Complexity**: Medium (webhook/n8n integration)  
**Risk**: Low (mutations still behind approval gates)
