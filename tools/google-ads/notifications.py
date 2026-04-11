#!/usr/bin/env python3
"""
Google Ads mutation notification system.

Sends alerts to Slack, email, or webhooks when:
- Mutations are queued or approved
- Auto-approval gates hold mutations
- Compliance checks find issues
- High-risk mutations need escalation
- Batch operations complete
"""

import json
import os
import urllib.request
from datetime import datetime
from typing import Optional
from pathlib import Path


def get_notification_config(rules: dict) -> dict:
    """Extract notification settings from rules."""
    return rules.get("notifications", {})


def get_escalation_config(rules: dict) -> dict:
    """Extract escalation settings from rules."""
    return rules.get("escalation", {})


def calculate_risk_score(mutation: dict, rules: dict) -> dict:
    """
    Calculate risk score for a mutation.

    Returns dict with:
    - score: 0-100 risk level
    - level: 'low', 'medium', 'high', 'urgent'
    - reasons: List of risk factors
    - requires_escalation: bool
    """
    escalation = get_escalation_config(rules)
    reasons = []
    score = 0

    try:
        payload = json.loads(mutation.get("payload", "{}")) if isinstance(mutation.get("payload"), str) else mutation.get("payload", {})
        mtype = mutation.get("mutation_type", "")
        impact = float(payload.get("impact_estimate", 0) or 0)

        # Risk factors
        high_impact_threshold = escalation.get("high_impact_threshold", 1000.0)
        if impact > high_impact_threshold:
            score += 30
            reasons.append(f"High impact: ${impact:.2f}")

        # Recommendation type risks
        risky_types = escalation.get("high_risk_recommendation_types", [])
        rec_type = payload.get("recommendation_type", "")
        if rec_type in risky_types:
            score += 40
            reasons.append(f"High-risk type: {rec_type}")

        # Bid adjustments
        if escalation.get("require_manual_for_bid_changes", False) and rec_type == "BID_ADJUSTMENT":
            score += 35
            reasons.append("Bid adjustments require manual review")

        # Budget changes
        if escalation.get("require_manual_for_budget_changes", False) and rec_type == "CAMPAIGN_BUDGET":
            score += 35
            reasons.append("Budget changes require manual review")

        # Campaign scope (broader is riskier)
        if not mutation.get("campaign_id"):
            score += 25
            reasons.append("Account-level mutation (broad scope)")

        # Batch size context
        batch_size = mutation.get("batch_size", 1)
        if batch_size > 5:
            score += 15
            reasons.append(f"Large batch: {batch_size} mutations")

    except (json.JSONDecodeError, ValueError, TypeError):
        score = 50
        reasons.append("Could not parse mutation details")

    # Determine level
    if score >= 80:
        level = "urgent"
    elif score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"

    requires_escalation = (
        level in ["high", "urgent"]
        and escalation.get("enabled", False)
    )

    return {
        "score": min(score, 100),
        "level": level,
        "reasons": reasons,
        "requires_escalation": requires_escalation,
    }


def format_slack_message(event_type: str, details: dict, risk_score: Optional[dict] = None) -> dict:
    """Format notification as Slack message."""
    color_map = {
        "low": "#36a64f",
        "medium": "#ff9900",
        "high": "#ff6600",
        "urgent": "#ff0000",
    }

    risk_level = risk_score.get("level", "medium") if risk_score else "info"
    color = color_map.get(risk_level, "#808080")

    # Build title and description
    title_map = {
        "mutation_queued": "🔔 Mutation Queued",
        "mutation_auto_approved": "✅ Auto-Approved",
        "mutation_batch_approved": "👥 Batch Approved",
        "compliance_warning": "⚠️ Compliance Warning",
        "mutation_pending_escalation": "🚨 Requires Escalation",
        "mutation_applied": "✓ Applied Successfully",
        "mutation_batch_applied": "✓ Batch Applied",
    }

    title = title_map.get(event_type, "Google Ads Update")

    # Build fields
    fields = []

    if "mutation_type" in details:
        fields.append({
            "title": "Mutation Type",
            "value": details["mutation_type"],
            "short": True,
        })

    if "resource_type" in details:
        fields.append({
            "title": "Resource",
            "value": f"{details['resource_type']}: {details.get('resource_id', 'N/A')}",
            "short": True,
        })

    if "impact" in details:
        fields.append({
            "title": "Estimated Impact",
            "value": f"${details['impact']:.2f}",
            "short": True,
        })

    if risk_score:
        fields.append({
            "title": "Risk Level",
            "value": f"{risk_score['level'].upper()} ({risk_score['score']}/100)",
            "short": True,
        })

        if risk_score.get("reasons"):
            fields.append({
                "title": "Risk Factors",
                "value": "\n".join(f"• {r}" for r in risk_score["reasons"][:3]),
                "short": False,
            })

    if "batch_size" in details:
        fields.append({
            "title": "Batch Size",
            "value": str(details["batch_size"]),
            "short": True,
        })

    return {
        "attachments": [
            {
                "fallback": title,
                "color": color,
                "title": title,
                "fields": fields,
                "footer": "Google Ads Automation",
                "ts": int(datetime.utcnow().timestamp()),
            }
        ]
    }


def format_webhook_payload(event_type: str, details: dict, risk_score: Optional[dict] = None) -> dict:
    """Format notification for generic webhook."""
    return {
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "details": details,
        "risk_score": risk_score,
    }


def send_slack_notification(webhook_url: str, message: dict) -> bool:
    """Send notification to Slack webhook."""
    if not webhook_url:
        return False

    try:
        payload = json.dumps(message).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 200
    except Exception as err:
        print(f"ERROR: Failed to send Slack notification: {err}", file=__import__("sys").stderr)
        return False


def send_webhook_notification(webhook_url: str, payload: dict) -> bool:
    """Send notification to generic webhook."""
    if not webhook_url:
        return False

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status in [200, 201, 202]
    except Exception as err:
        print(f"ERROR: Failed to send webhook notification: {err}", file=__import__("sys").stderr)
        return False


def send_notifications(
    event_type: str,
    details: dict,
    rules: dict,
    risk_score: Optional[dict] = None,
) -> dict:
    """
    Send notifications based on event type and configuration.

    Supports:
    - Legacy webhook_url (all events to one endpoint)
    - n8n routing: separate webhooks for auto-approve, escalation, compliance (Phase 4E)
    - Slack, email

    Returns dict with:
    - slack_sent: bool
    - webhook_sent: bool
    - n8n_webhooks_sent: dict with {auto_approve, escalation, compliance}
    - email_sent: bool
    - errors: list
    """
    config = get_notification_config(rules)

    if not config.get("enabled", True):
        return {
            "slack_sent": False,
            "webhook_sent": False,
            "n8n_webhooks_sent": {},
            "email_sent": False,
            "errors": [],
        }

    # Check if event should trigger notifications
    trigger_key = f"notify_on_{event_type.replace('mutation_', '')}"
    if not config.get(trigger_key, False):
        return {
            "slack_sent": False,
            "webhook_sent": False,
            "n8n_webhooks_sent": {},
            "email_sent": False,
            "errors": [],
        }

    results = {
        "slack_sent": False,
        "webhook_sent": False,
        "n8n_webhooks_sent": {},
        "email_sent": False,
        "errors": [],
    }

    # Send Slack
    if config.get("slack_enabled", False):
        slack_webhook = os.environ.get("GOOGLE_ADS_SLACK_WEBHOOK") or config.get("slack_webhook_url")
        if slack_webhook:
            message = format_slack_message(event_type, details, risk_score)
            if send_slack_notification(slack_webhook, message):
                results["slack_sent"] = True
            else:
                results["errors"].append("Slack notification failed")

    # Send to legacy webhook (all events)
    webhook_url = os.environ.get("GOOGLE_ADS_WEBHOOK_URL") or config.get("webhook_url")
    if webhook_url:
        payload = format_webhook_payload(event_type, details, risk_score)
        if send_webhook_notification(webhook_url, payload):
            results["webhook_sent"] = True
        else:
            results["errors"].append("Webhook notification failed")

    # Send to n8n workflow-specific webhooks (Phase 4E)
    n8n_config = config.get("n8n_webhooks", {})
    if n8n_config:
        payload = format_webhook_payload(event_type, details, risk_score)

        # Route by risk level
        if risk_score:
            level = risk_score.get("level", "medium")
            if level in ["low", "medium"] and risk_score.get("requires_escalation") is False:
                # Auto-approve workflow
                webhook_key = "auto_approve"
                webhook_url = os.environ.get("GOOGLE_ADS_N8N_AUTO_APPROVE") or n8n_config.get(webhook_key)
                if webhook_url:
                    if send_webhook_notification(webhook_url, payload):
                        results["n8n_webhooks_sent"]["auto_approve"] = True
                    else:
                        results["errors"].append("n8n auto-approve webhook failed")
            elif level in ["high", "urgent"] or risk_score.get("requires_escalation"):
                # Escalation workflow
                webhook_key = "escalation"
                webhook_url = os.environ.get("GOOGLE_ADS_N8N_ESCALATION") or n8n_config.get(webhook_key)
                if webhook_url:
                    if send_webhook_notification(webhook_url, payload):
                        results["n8n_webhooks_sent"]["escalation"] = True
                    else:
                        results["errors"].append("n8n escalation webhook failed")

    # Email would be implemented here if SMTP configured
    # For now, just flag it
    if config.get("email_enabled", False):
        results["errors"].append("Email notifications not yet implemented")

    return results


def should_escalate_mutation(mutation: dict, rules: dict) -> bool:
    """Check if mutation should be escalated to human reviewer."""
    escalation = get_escalation_config(rules)

    if not escalation.get("enabled", False):
        return False

    risk_score = calculate_risk_score(mutation, rules)
    return risk_score.get("requires_escalation", False)


def get_escalation_message(mutation: dict, risk_score: dict) -> str:
    """Generate escalation message for human review."""
    payload = json.loads(mutation.get("payload", "{}")) if isinstance(mutation.get("payload"), str) else mutation.get("payload", {})

    message = f"""
⚠️ ESCALATION REQUIRED: High-Risk Mutation

Mutation ID: {mutation.get('id')}
Type: {mutation.get('mutation_type')}
Risk Level: {risk_score['level'].upper()} ({risk_score['score']}/100)

Details:
- Resource: {mutation.get('resource_type')} ({mutation.get('resource_id')})
- Impact: ${payload.get('impact_estimate', 0):.2f}
- Priority: {payload.get('priority', 'UNKNOWN')}

Risk Factors:
{chr(10).join(f'  • {r}' for r in risk_score['reasons'])}

Action Required:
Please review and approve/reject this mutation before it can be applied.

Link: bash tools/google-ads/run.sh preview --id {mutation.get('id')}
""".strip()

    return message
