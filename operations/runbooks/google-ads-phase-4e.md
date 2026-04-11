# Phase 4E: n8n Workflow Automation

Automate mutation approval and escalation routing via n8n webhooks, reducing manual intervention from ~30% to ~5%.

## Overview

**Three workflows:**
1. **Auto-Approve Worker** — Listen for low-risk mutations, auto-approve + apply immediately
2. **Escalation Router** — Route high-risk mutations to Slack, wait for human approval, apply on confirmation
3. **Compliance Gatekeeper** — Validate mutations pre-queue, reject if policy violations detected

## Workflow 1: Auto-Approve Worker

**Trigger:** Webhook from Google Ads CLI (`POST /webhook/google-ads-auto-approve`)

**Payload:**
```json
{
  "event_type": "recommendation_queued",
  "details": {
    "mutation_id": 5,
    "mutation_type": "apply_recommendation",
    "impact": 850.00
  },
  "risk_score": {
    "score": 45,
    "level": "medium",
    "requires_escalation": false
  }
}
```

**Decision tree:**
```
Risk level = "low" OR "medium"?
  ├─ YES: Auto-approve and apply
  │   ├─ Call: bash tools/google-ads/run.sh approve --id {mutation_id}
  │   ├─ Call: bash tools/google-ads/run.sh apply --id {mutation_id} --live
  │   └─ Send Slack: "✅ Auto-approved and applied: {mutation_type} ($850 impact)"
  │
  └─ NO: Skip (escalation router will handle)
```

**n8n nodes:**
1. **Webhook Trigger** — Listen on `/webhook/google-ads-auto-approve`
2. **Extract Risk Level** — Parse `risk_score.level` from payload
3. **Filter (LOW/MEDIUM)** — Only proceed if level matches
4. **HTTP Approve** — `POST localhost:8000/api/mutations/{id}/approve` (or CLI call)
5. **HTTP Apply** — `POST localhost:8000/api/mutations/{id}/apply?live=true`
6. **Slack Notification** — Success message
7. **Error Handler** — Log failures to #google-ads-errors

**Configuration:**
```toml
# config/google-ads/rules.toml
[notifications]
webhook_url = "https://n8n.prochat.tools/webhook/google-ads-auto-approve"
```

## Workflow 2: Escalation Router

**Trigger:** Webhook for high-risk mutations

**Payload:** Same as above, but `risk_score.level = "high"` or `"urgent"`

**Decision tree:**
```
Risk level = "high"?
  ├─ YES (high): Send to #google-ads-mutations for review
  │   ├─ Message: "⚠️ HIGH-RISK mutation needs review"
  │   ├─ Add reactions: ✅ approve | ❌ reject
  │   └─ Wait for reaction
  │
  └─ URGENT: Page oncall immediately
      ├─ Message: "🚨 URGENT mutation requires immediate action"
      ├─ Mention: @google-ads-oncall
      ├─ Set timeout: 15 minutes for approval
      └─ Escalate to email/PagerDuty if no response
```

**Reaction-based approval:**
- ✅ Approve → Call apply (same as workflow 1)
- ❌ Reject → Call reject with reason "Rejected via Slack reaction"
- ⏱️ Timeout → Auto-reject with reason "Manual approval timeout"

**n8n nodes:**
1. **Webhook Trigger** — Listen on `/webhook/google-ads-escalate`
2. **Extract Risk Level** — Parse `risk_score.level`
3. **Filter (HIGH/URGENT)** — Only HIGH or URGENT
4. **Create Slack Message** — Post to #google-ads-mutations with mutation details
5. **Wait for Reaction** — Set 15min timeout
6. **Reaction Router**:
   - ✅ → HTTP call to approve endpoint
   - ❌ → HTTP call to reject endpoint
   - ⏱️ (timeout) → HTTP call to reject (timeout reason)
7. **Update Slack** — Pin approved/rejected status in thread
8. **Notify CLI** — (Optional) POST back to Google Ads CLI for status update

**Configuration:**
```toml
[notifications]
webhook_url = "https://n8n.prochat.tools/webhook/google-ads-escalate"

[escalation]
escalation_slack_channel = "#google-ads-mutations"
escalation_urgency_threshold = 2000.0  # Route to oncall if impact > $2000
```

## Workflow 3: Compliance Gatekeeper

**Trigger:** Before mutations are queued (from CLI)

**Payload:**
```json
{
  "event_type": "mutation_pre_queue",
  "details": {
    "mutation_type": "add_negative_keywords",
    "keywords": ["bad keyword", "another term"],
    "campaign_id": "123456"
  }
}
```

**Validation:**
- Keyword length < 80 chars
- No stop words (the, a, an, etc.)
- Mission alignment check (keyword relevance)
- Duplicate check against existing negatives

**Decision tree:**
```
All validations pass?
  ├─ YES: Return {"valid": true}
  │       CLI queues mutation normally
  │
  └─ NO: Return {"valid": false, "errors": [...]}
         CLI rejects pre-queue with detailed error
```

**n8n nodes:**
1. **Webhook Trigger** — Listen on `/webhook/google-ads-compliance-check`
2. **Extract Keywords** — Parse `details.keywords` array
3. **Length Validator** — Check each keyword < 80 chars
4. **Stop Word Filter** — Remove known stop words, return violations
5. **Mission Alignment** — (Optional) Call ML endpoint for relevance scoring
6. **Duplicate Check** — Query SQLite negative_keywords table for existing entries
7. **Aggregator** — Combine all validation errors
8. **HTTP Response** — Return `{valid: bool, errors: array}`

**Configuration:**
```toml
[compliance]
enable_keyword_length_check = true
max_keyword_length = 80
enable_stop_word_filter = true
enable_mission_alignment = true

[notifications]
webhook_url = "https://n8n.prochat.tools/webhook/google-ads-compliance-check"
```

## Integration with CLI

### 1. Approve Endpoint (Mock HTTP)

The CLI doesn't expose HTTP endpoints natively. Instead, n8n calls the CLI via SSH or direct bash:

```bash
#!/bin/bash
# In n8n HTTP node, use SSH exec
ssh user@server "bash /path/to/tools/google-ads/run.sh approve --id $MUTATION_ID"
```

Or, create a lightweight HTTP wrapper:

```python
# tools/google-ads/http_server.py (optional, lightweight)
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import sys

class GoogleAdsHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/approve":
            data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            mutation_id = data.get("mutation_id")
            result = subprocess.run(
                ["bash", "tools/google-ads/run.sh", "approve", "--id", str(mutation_id)],
                capture_output=True
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": result.returncode == 0}).encode())

if __name__ == "__main__":
    server = HTTPServer(("localhost", 8001), GoogleAdsHandler)
    server.serve_forever()
```

Start server in supervisor or systemd:
```toml
[supervisord config]
[program:google-ads-http]
command=python3 tools/google-ads/http_server.py
autostart=true
autorestart=true
```

### 2. Webhook Integration in CLI

Update `cli.py` to POST notifications after key commands:

```python
def send_webhook_notification(webhook_url, payload):
    import urllib.request
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in [200, 201, 202]
    except:
        return False

# In cmd_recommendations:
for recommendation in recommendations:
    # ... existing code ...
    risk_score = calculate_risk_score(mutation, rules)
    webhook = rules.get("notifications", {}).get("webhook_url")
    if webhook:
        payload = {
            "event_type": "recommendation_queued",
            "details": {...},
            "risk_score": risk_score
        }
        send_webhook_notification(webhook, payload)
```

## Daily Workflow with n8n

```bash
# 1. Sync (automatically triggers webhooks for queued mutations)
bash tools/google-ads/run.sh sync
bash tools/google-ads/run.sh recommendations
  # → Webhooks POST to n8n
  # → n8n auto-approves low-risk
  # → n8n escalates high-risk to Slack
  # → Team reacts to approve/reject

# 2. Wait ~30 seconds for Slack reactions to be processed

# 3. Monitor pipeline
bash tools/google-ads/run.sh status
  # Output: pending=2 (awaiting manual reaction), approved=5, applied=0

# 4. After reactions are processed by n8n
bash tools/google-ads/run.sh status
  # Output: pending=0, approved=7, applied=5
```

## n8n Webhook URLs

| Workflow | URL | Payload |
|----------|-----|---------|
| Auto-Approve | `https://n8n.prochat.tools/webhook/google-ads-auto-approve` | Low/medium-risk mutations |
| Escalation Router | `https://n8n.prochat.tools/webhook/google-ads-escalate` | High/urgent-risk mutations |
| Compliance Check | `https://n8n.prochat.tools/webhook/google-ads-compliance-check` | Pre-queue validation |

## Configuration Example

```toml
# config/google-ads/rules.toml

[notifications]
enabled = true
webhook_url = ""  # Set in environment or per-workflow

# Route by risk level
[notifications.webhooks]
auto_approve = "https://n8n.prochat.tools/webhook/google-ads-auto-approve"
escalation = "https://n8n.prochat.tools/webhook/google-ads-escalate"
compliance = "https://n8n.prochat.tools/webhook/google-ads-compliance-check"

[escalation]
enabled = true
escalation_slack_channel = "#google-ads-mutations"
escalation_urgency_threshold = 2000.0

# Reaction-based approval settings
reaction_timeout_minutes = 15
urgent_pagerduty_page = true
```

## Error Handling & Retries

**n8n retry strategy:**
- HTTP errors (5xx): Retry 3x with exponential backoff
- Timeout (>10s): Retry 1x, then fail-open (log to error channel, notify ops)
- Slack reaction timeout: Auto-reject and log to #google-ads-errors

**Error channel:**
All workflow errors post to `#google-ads-errors` with:
- Workflow name
- Error message
- Mutation ID
- Manual recovery link (e.g., `bash tools/google-ads/run.sh preview --id 5`)

## Monitoring & Debugging

### n8n Dashboard Stats

Track in n8n:
- `auto_approve_success_rate` — % of low-risk mutations successfully auto-approved
- `escalation_avg_approval_time` — Time from Slack post to reaction (target: <5 min)
- `escalation_timeout_rate` — % of mutations timing out (target: <2%)
- `compliance_rejection_rate` — % of mutations rejected by compliance check

### Log Queries

Check n8n execution logs:
```bash
# In n8n UI: Executions → Filter by workflow
# Or via API:
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://n8n.prochat.tools/api/v1/executions?workflowId=auto-approve
```

### Troubleshooting

**Auto-approve workflow not triggering:**
1. Check webhook URL in rules.toml matches n8n workflow
2. Verify CLI is posting to webhook: `grep -i webhook tools/google-ads/cli.py`
3. Test webhook manually: `curl -X POST https://n8n.prochat.tools/webhook/google-ads-auto-approve -d '{"event_type":"test"}'`

**Escalation timeout not working:**
1. Verify reaction timeout in n8n > 15 min is set
2. Check Slack bot has permission to read reactions: Settings > OAuth Scopes > `reactions:read`
3. Test with manual reaction (add ✅ to workflow's test message)

**HTTP calls to CLI failing:**
1. Check SSH credentials if using remote CLI
2. Verify `http_server.py` is running: `ps aux | grep http_server`
3. Test endpoint: `curl http://localhost:8001/approve -X POST -d '{"mutation_id": 1}'`

## Future Enhancements

1. **ML Scoring** — Call custom ML model for predicted impact accuracy
2. **A/B Testing** — Route mutations to test cohort vs control
3. **Cost Optimization** — Auto-suggest bid adjustments based on performance
4. **Rollback Triggers** — Monitor post-application metrics, auto-revert if CPA degrades
5. **Calendar Integration** — Defer mutations if pacing is already on track for the day

## Next Steps

1. **Export n8n workflows** — Backup current workflows to `brain/operations/backups/n8n-workflows/`
2. **Create auto-approve workflow** — Deploy and test with 1-2 low-risk mutations
3. **Create escalation workflow** — Deploy and test with high-risk mutation
4. **Deploy compliance gatekeeper** — Add to recommendation queuing flow
5. **Monitor for 1 week** — Measure success rates, adjust timeouts/thresholds

---

**Status**: 🚀 Ready for implementation  
**Risk Level**: 🟡 Medium (external dependency on n8n availability)  
**Integration**: n8n.prochat.tools (self-hosted)  
**Estimated Time**: 2-3 hours for full deployment
