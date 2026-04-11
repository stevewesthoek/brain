# Phase 4D: Notifications & Monitoring

Phase 4D adds operational visibility through notifications, escalation workflows, and health monitoring — enabling teams to stay informed about mutations and catch issues early.

## Overview

**Three components:**
1. **Notification System**: Multi-channel alerts (Slack, webhooks, email-ready)
2. **Escalation Workflow**: Risk-based routing to human reviewers
3. **Health Monitoring**: JSON health endpoint for observability systems

## Notification System

### Configuration (rules.toml)

```toml
[notifications]
enabled = true

# Webhook for n8n, Make, Zapier
webhook_url = ""              # Override: GOOGLE_ADS_WEBHOOK_URL
notify_on_pending_mutations = true
notify_on_auto_approved = false       # Too noisy by default
notify_on_batch_operation = true
notify_on_compliance_warning = true
notify_on_high_risk = true
notify_on_applied_mutations = true

# Slack integration
slack_enabled = false
slack_webhook_url = ""        # Override: GOOGLE_ADS_SLACK_WEBHOOK
```

### Environment Setup

```bash
# Set webhook URL (e.g., n8n)
export GOOGLE_ADS_WEBHOOK_URL="https://n8n.example.com/webhook/google-ads"

# Set Slack webhook
export GOOGLE_ADS_SLACK_WEBHOOK="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
```

### Channels

#### Slack
- Colorized attachments (green/yellow/orange/red based on risk)
- Expandable fields (mutation type, resource, impact, risk factors)
- Timestamp and source metadata
- Ready for threading and reactions

**Output:**
```
🔔 Mutation Queued

Mutation Type: apply_recommendation
Resource: recommendation: 5
Estimated Impact: $850.00
Risk Level: MEDIUM (45/100)

Risk Factors:
  • Impact > $500
  • Medium priority (manual review)
```

#### Webhook (n8n, Make, Zapier)
- JSON payload with full context
- Event type, timestamp, details, risk score
- Ready for conditional logic (route by risk level)
- Supports any HTTP endpoint

**Payload:**
```json
{
  "event_type": "recommendation_queued",
  "timestamp": "2026-04-11T15:30:45Z",
  "details": {
    "mutation_type": "apply_recommendation",
    "resource_type": "recommendation",
    "resource_id": "5",
    "impact": 850.00
  },
  "risk_score": {
    "score": 45,
    "level": "medium",
    "reasons": [
      "Impact > $500",
      "Medium priority (manual review)"
    ],
    "requires_escalation": false
  }
}
```

#### Email (Framework Ready)
- Template-based messages
- Configurable recipient lists
- Requires SMTP configuration (not in MVP)

## Escalation Workflow

### Risk Scoring

Each mutation is scored 0-100 based on:
- **Impact** (0-30 pts): High impact ($1000+) = 30pts
- **Type** (0-40 pts): Risky types (bid adjust, budget) = 40pts
- **Scope** (0-25 pts): Account-level mutations = 25pts
- **Batch** (0-15 pts): Large batches (>5) = 15pts

**Risk Level Mapping:**
- 0-29: LOW (green badge)
- 30-59: MEDIUM (yellow badge)
- 60-79: HIGH (orange badge)
- 80-100: URGENT (red badge)

### Escalation Routing

Mutations with high risk scores are routed to human reviewers:

```toml
[escalation]
enabled = true
high_impact_threshold = 1000.0
high_risk_recommendation_types = ["BID_ADJUSTMENT", "CAMPAIGN_BUDGET"]
require_manual_for_bid_changes = true
require_manual_for_budget_changes = true
escalation_slack_channel = "#google-ads-mutations"
escalation_urgency_threshold = 2000.0
```

**Escalation Triggers:**
- Bid adjustments
- Campaign budget changes
- Impact > $1000 (HIGH)
- Impact > $2000 (URGENT)
- Account-level mutations

**Example:**
```
🚨 ESCALATION REQUIRED: High-Risk Mutation

Mutation ID: 5
Type: apply_recommendation
Risk Level: URGENT (85/100)

Details:
- Resource: recommendation (5)
- Impact: $1,250.00
- Priority: HIGH

Risk Factors:
  • High impact: $1,250.00
  • High-risk type: BID_ADJUSTMENT

Action Required:
Please review and approve/reject this mutation before applying.
```

## Alerts Command

Show pending mutations requiring attention:

```bash
# All alerts
bash tools/google-ads/run.sh alerts

# High-risk only
bash tools/google-ads/run.sh alerts --high-risk

# Escalations only
bash tools/google-ads/run.sh alerts --escalate
```

**Output:**
```
PENDING ALERTS
════════════════════════════════════════════════════════════════════════════════

🚨 REQUIRING ESCALATION (1)
────────────────────────────────────────────────────────────────────────────────
ID   2 | apply_recommendation        | Risk: URGENT
  Resource: recommendation:5
  Impact: $1,250.00
  Reasons: High impact: $1,250.00, High-risk type: BID_ADJUSTMENT

⚠️  HIGH-RISK MUTATIONS (2)
────────────────────────────────────────────────────────────────────────────────
ID   3 | apply_recommendation        | Risk: HIGH
ID   4 | add_negative_keywords       | Risk: MEDIUM

════════════════════════════════════════════════════════════════════════════════

Summary: 1 escalations, 2 high-risk, 5 normal

ACTION REQUIRED: Review escalated mutations before proceeding
```

## Health Monitoring

### Health Command

Output system health as JSON for monitoring integration:

```bash
bash tools/google-ads/run.sh health
```

**JSON Response:**
```json
{
  "timestamp": "2026-04-11T15:30:45.123456+00:00",
  "system": {
    "api_available": true,
    "database_available": true,
    "last_sync_age_seconds": 3600
  },
  "pipeline": {
    "pending": 3,
    "approved": 2,
    "applied": 15,
    "rejected": 1,
    "failed": 0
  },
  "pacing": {
    "actual_spend": 3450.75,
    "target_spend": 3333.33,
    "pacing_pct": 103.5,
    "status": "yellow"
  },
  "alerts": {
    "escalations": 0,
    "high_risk": 1,
    "compliance_warnings": 0
  },
  "health_score": 92,
  "status": "healthy"
}
```

### Health Score Calculation

**Scoring penalties:**
- Database unavailable: -50 pts
- API unavailable: -25 pts
- Last sync >24h old: -15 pts
- Each escalation: -10 pts (max -30)
- Pacing RED status: -20 pts

**Status Levels:**
- **Healthy (90+)**: All systems green, no alerts
- **Degraded (70-89)**: Minor issues (old sync, 1 escalation)
- **Unhealthy (50-69)**: Multiple issues (API down, many escalations)
- **Critical (<50)**: Severe issues (database down, >3 escalations)

### Monitoring Integration

#### Prometheus
```yaml
global:
  scrape_interval: 5m

scrape_configs:
  - job_name: 'google-ads'
    metrics_path: '/health'
    static_configs:
      - targets: ['localhost:8000']
    json_sd_configs:
      - files: ['/etc/prometheus/jobs/*.json']
```

Custom metric extractor:
```bash
#!/bin/bash
HEALTH=$(bash tools/google-ads/run.sh health 2>/dev/null)
echo "google_ads_health_score $(echo $HEALTH | jq '.health_score')"
echo "google_ads_escalations $(echo $HEALTH | jq '.alerts.escalations')"
echo "google_ads_high_risk $(echo $HEALTH | jq '.alerts.high_risk')"
```

#### Datadog / New Relic
Post to metrics API:

```bash
#!/bin/bash
HEALTH=$(bash tools/google-ads/run.sh health 2>/dev/null)
SCORE=$(echo $HEALTH | jq '.health_score')
STATUS=$(echo $HEALTH | jq -r '.status')

# Datadog
curl -X POST "https://api.datadoghq.com/api/v1/series" \
  -H "DD-API-KEY: $DATADOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"series\": [{\"metric\": \"google_ads.health\", \"points\": [[$(date +%s), $SCORE]]}]}"
```

#### Grafana Dashboard
- Pull health endpoint every 5 minutes
- Graph health_score over time
- Alert if status == "critical"
- Display pipeline counts as gauge
- Show pacing percentage with thresholds

## Workflows

### Daily Workflow with Notifications

```bash
# 1. Sync and queue recommendations (sends notifications for high-risk)
bash tools/google-ads/run.sh sync
bash tools/google-ads/run.sh recommendations

# 2. Check alerts
bash tools/google-ads/run.sh alerts

# If escalations exist, they appear in Slack:
# → Team reviews escalated mutations
# → Team manually approves or rejects

# 3. Auto-approve qualifying mutations
bash tools/google-ads/run.sh auto-approve

# 4. Batch approve remaining
bash tools/google-ads/run.sh batch-approve --auto

# 5. Apply (notifications sent on completion)
bash tools/google-ads/run.sh batch-apply --live

# 6. Monitor health
bash tools/google-ads/run.sh health | jq '.status'
# Output: healthy
```

### Escalation Response Flow

```
Mutation queued
    ↓
Risk score calculated
    ↓
    ├─ High risk (>=60)? → Escalation notification sent
    │                       ↓
    │                   Team reviews in Slack
    │                       ↓
    │                   Team approves/rejects
    │                       ↓
    │                   (if approved) Applied with confirmation
    │
    └─ Normal risk? → Auto-approve if meets gates
                        ↓
                    Applied with notification
```

### On-Call Alerting

```bash
#!/bin/bash
# Run every 5 minutes via cron

HEALTH=$(bash tools/google-ads/run.sh health 2>/dev/null)
STATUS=$(echo $HEALTH | jq -r '.status')
ESCALATIONS=$(echo $HEALTH | jq '.alerts.escalations')

if [ "$STATUS" == "critical" ]; then
  slack-notify --channel @oncall "🚨 Google Ads CRITICAL"
elif [ "$ESCALATIONS" -gt 3 ]; then
  slack-notify --channel #ops-alerts "⚠️ Many escalations: $ESCALATIONS"
fi
```

## Configuration Examples

### Conservative (Manual Review Everything)

```toml
[notifications]
notify_on_pending_mutations = true
notify_on_batch_operation = true
notify_on_high_risk = true

[escalation]
enabled = true
high_impact_threshold = 500.0
require_manual_for_bid_changes = true
```

### Automated (Low Friction)

```toml
[notifications]
notify_on_pending_mutations = false
notify_on_auto_approved = false
notify_on_compliance_warning = true
notify_on_high_risk = true

[escalation]
enabled = true
high_impact_threshold = 2000.0
```

### Team Collaboration (Slack-First)

```toml
[notifications]
slack_enabled = true
webhook_url = ""
notify_on_pending_mutations = true
notify_on_batch_operation = true
notify_on_applied_mutations = true

[escalation]
escalation_slack_channel = "#google-ads-mutations"
escalation_urgency_threshold = 1500.0
```

## Troubleshooting

### Notifications not sending?

1. Check configuration:
   ```bash
   grep -A 5 "\[notifications\]" config/google-ads/rules.toml
   ```

2. Verify webhook URL:
   ```bash
   echo $GOOGLE_ADS_WEBHOOK_URL
   echo $GOOGLE_ADS_SLACK_WEBHOOK
   ```

3. Test webhook:
   ```bash
   curl -X POST "$GOOGLE_ADS_WEBHOOK_URL" -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

### High false positive escalations?

- Reduce `high_impact_threshold` in rules.toml
- Adjust risk scoring weights in `notifications.py`
- Example: Change bid adjustment penalty from 40 → 25 pts

### Health check failing?

```bash
bash tools/google-ads/run.sh health | jq '.system'

# If api_available: false, check connectivity:
bash tools/google-ads/run.sh doctor

# If database_available: false, check path:
ls -la data/google-ads/google_ads.sqlite3
```

## Next Steps (Phase 4E+)

1. **Workflow Automation**: n8n workflows triggered by notifications
2. **Custom Alerts**: Domain-specific alerting rules (e.g., budget alerts)
3. **Approval Dashboard**: Web UI for reviewing escalations
4. **Analytics**: Track which mutations have highest impact
5. **A/B Testing**: Framework for testing mutation effects
6. **Rollback**: Automatic undo if performance degrades post-mutation

## Command Summary

| Command | Purpose |
|---------|---------|
| `alerts` | Show pending alerts and escalations |
| `health` | Output JSON health for monitoring |
| `status` | Text dashboard (still available) |
| `notifications` | (future) Manage notification subscriptions |

---

**Status**: ✅ Production-ready for team operations  
**Risk Level**: 🟢 Low (advisory notifications only)  
**Integration**: Ready for Slack, n8n, Prometheus, Grafana
