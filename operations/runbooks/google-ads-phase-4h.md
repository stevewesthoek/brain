# Phase 4H: Rollback Framework

Automatically revert mutations if performance metrics degrade post-application. Safety net for bad recommendations or unexpected interactions.

## Overview

**Three mechanisms:**
1. **Health Check** — Monitor metrics post-mutation (4/12/24 hour intervals)
2. **Threshold Evaluation** — Compare against baseline + user-defined thresholds
3. **Auto-Revert** — If threshold breached, automatically revert mutation

## Thresholds

```toml
[rollback]
enabled = true

# Monitoring window
check_interval_hours = 4  # Check metrics every 4h
max_window_hours = 48     # Stop checking after 48h

# Thresholds for auto-revert
cpa_increase_threshold_pct = 5.0      # If CPA increases >5%, revert
conversion_drop_threshold_pct = 10.0  # If conversions drop >10%, revert
spend_increase_threshold_pct = 15.0   # If spend increases >15%, revert

# Manual override
allow_manual_override = true  # User can mark mutation as "no-revert"
override_reason_required = true

# Notification
notify_on_rollback = true
rollback_slack_channel = "#google-ads-errors"
```

## New Database Tables

```sql
CREATE TABLE mutation_rollbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id INTEGER NOT NULL UNIQUE,
  
  -- Baseline metrics (at time of application)
  baseline_cpa REAL,
  baseline_conversions INTEGER,
  baseline_spend_usd REAL,
  baseline_date TEXT NOT NULL,
  
  -- Trigger metrics (when threshold breached)
  trigger_cpa REAL,
  trigger_conversions INTEGER,
  trigger_spend_usd REAL,
  trigger_date TEXT,
  
  -- Deltas
  cpa_delta_pct REAL,
  conversions_delta_pct REAL,
  spend_delta_pct REAL,
  
  -- Action taken
  status TEXT DEFAULT 'pending',  -- pending, reverted, ignored, manual_override
  revert_reason TEXT,  -- Which threshold was breached
  reverted_at TEXT,
  
  -- Audit
  manual_override TEXT,  -- User-provided reason for skipping revert
  override_at TEXT,
  notes TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for quick lookups
CREATE INDEX idx_rollbacks_mutation_id ON mutation_rollbacks(mutation_id);
CREATE INDEX idx_rollbacks_status ON mutation_rollbacks(status);
```

## Workflow

### Step 1: Arm Rollback Monitor (When Mutation Applied)

```python
def arm_rollback_monitor(conn, mutation_id, campaign_id, baseline_metrics):
    """
    Register mutation for rollback monitoring.
    """
    
    conn.execute(
        """
        INSERT INTO mutation_rollbacks
          (mutation_id, baseline_cpa, baseline_conversions, baseline_spend_usd,
           baseline_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mutation_id,
            baseline_metrics["cpa"],
            baseline_metrics["conversions"],
            baseline_metrics["spend"],
            datetime.now().isoformat(),
            "pending",
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat(),
        ),
    )
    
    logger.info(f"Armed rollback monitor for mutation {mutation_id}")
```

### Step 2: Monitor & Evaluate (Every 4 Hours)

Scheduled job (via cron or n8n):

```python
def check_mutations_for_rollback(conn, rules):
    """
    Check all pending rollback monitors. If threshold breached, revert.
    """
    
    rollback_config = rules.get("rollback", {})
    if not rollback_config.get("enabled", False):
        return
    
    # Find mutations in pending rollback window
    pending = conn.execute(
        """
        SELECT mr.*, m.id as mutation_id
        FROM mutation_rollbacks mr
        JOIN pending_mutations m ON mr.mutation_id = m.id
        WHERE mr.status = 'pending'
          AND mr.baseline_date > datetime('now', ? || ' hours')
          AND NOT EXISTS (
            SELECT 1 FROM mutation_rollbacks
            WHERE mutation_id = mr.mutation_id AND status != 'pending'
          )
        """,
        (f"-{rollback_config.get('max_window_hours', 48)}",),
    ).fetchall()
    
    for rollback in pending:
        # Fetch current metrics
        current = conn.execute(
            """
            SELECT
              AVG(cost_per_acquisition) as cpa,
              SUM(conversions) as conversions,
              AVG(spend_usd) as spend
            FROM daily_metrics_detail
            WHERE campaign_id = ? AND metrics_date > ?
            """,
            (rollback["campaign_id"], rollback["baseline_date"]),
        ).fetchone()
        
        # Calculate deltas
        cpa_delta = ((current["cpa"] - rollback["baseline_cpa"]) / 
                    max(rollback["baseline_cpa"], 0.01) * 100)
        conv_delta = ((current["conversions"] - rollback["baseline_conversions"]) / 
                     max(rollback["baseline_conversions"], 1) * 100)
        spend_delta = ((current["spend"] - rollback["baseline_spend_usd"]) / 
                      max(rollback["baseline_spend_usd"], 1) * 100)
        
        # Check thresholds
        should_revert = False
        revert_reason = []
        
        if cpa_delta > rollback_config.get("cpa_increase_threshold_pct", 5):
            should_revert = True
            revert_reason.append(f"CPA +{cpa_delta:.1f}%")
        
        if conv_delta < -rollback_config.get("conversion_drop_threshold_pct", 10):
            should_revert = True
            revert_reason.append(f"Conversions {conv_delta:.1f}%")
        
        if spend_delta > rollback_config.get("spend_increase_threshold_pct", 15):
            should_revert = True
            revert_reason.append(f"Spend +{spend_delta:.1f}%")
        
        # Update rollback record
        conn.execute(
            """
            UPDATE mutation_rollbacks
            SET
              trigger_cpa = ?,
              trigger_conversions = ?,
              trigger_spend_usd = ?,
              trigger_date = ?,
              cpa_delta_pct = ?,
              conversions_delta_pct = ?,
              spend_delta_pct = ?,
              updated_at = ?
            WHERE mutation_id = ?
            """,
            (
                current["cpa"],
                current["conversions"],
                current["spend"],
                datetime.now().isoformat(),
                cpa_delta,
                conv_delta,
                spend_delta,
                datetime.utcnow().isoformat(),
                rollback["mutation_id"],
            ),
        )
        
        if should_revert:
            logger.warning(f"Mutation {rollback['mutation_id']} breached thresholds: {revert_reason}")
            perform_rollback(conn, rollback, ", ".join(revert_reason), rules)
        else:
            logger.info(f"Mutation {rollback['mutation_id']} healthy (CPA{cpa_delta:+.1f}%, Conv{conv_delta:+.1f}%)")
        
        conn.commit()
```

### Step 3: Perform Rollback

```python
def perform_rollback(conn, rollback, reason, rules):
    """
    Revert a mutation by reversing the action.
    """
    
    mutation = conn.execute(
        "SELECT * FROM pending_mutations WHERE id = ?",
        (rollback["mutation_id"],),
    ).fetchone()
    
    try:
        if mutation["mutation_type"] == "add_negative_keywords":
            # Remove the negative keyword from the campaign
            api = get_google_ads_api()
            api.remove_negative_keywords(
                campaign_id=mutation["campaign_id"],
                resource_names=[mutation["resource_id"]],
                dry_run=False
            )
        elif mutation["mutation_type"] == "apply_recommendation":
            # Dismiss the recommendation
            api = get_google_ads_api()
            api.dismiss_recommendation(
                recommendation_resource_name=mutation["resource_id"],
                dry_run=False
            )
        
        # Mark rollback as complete
        conn.execute(
            """
            UPDATE mutation_rollbacks
            SET status = ?, revert_reason = ?, reverted_at = ?, updated_at = ?
            WHERE mutation_id = ?
            """,
            (
                "reverted",
                reason,
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat(),
                rollback["mutation_id"],
            ),
        )
        
        # Log to change_events
        today = datetime.now().strftime("%Y-%m-%d")
        conn.execute(
            """
            INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                today,
                "mutation_auto_reverted",
                "mutation",
                str(rollback["mutation_id"]),
                json.dumps({
                    "reason": reason,
                    "cpa_delta": rollback["cpa_delta_pct"],
                    "conversions_delta": rollback["conversions_delta_pct"],
                }),
                datetime.utcnow().isoformat(),
            ),
        )
        
        conn.commit()
        
        # Notify
        if rules.get("rollback", {}).get("notify_on_rollback", False):
            send_slack_notification(
                channel=rules.get("rollback", {}).get("rollback_slack_channel"),
                message=f"🔄 Auto-reverted mutation {rollback['mutation_id']}: {reason}"
            )
        
        logger.info(f"Successfully reverted mutation {rollback['mutation_id']}")
        
    except Exception as e:
        logger.error(f"Failed to revert mutation {rollback['mutation_id']}: {e}")
        # Mark as failed but don't retry automatically
        conn.execute(
            """
            UPDATE mutation_rollbacks
            SET status = ?, revert_reason = ?, updated_at = ?
            WHERE mutation_id = ?
            """,
            (
                "revert_failed",
                f"Error: {str(e)}",
                datetime.utcnow().isoformat(),
                rollback["mutation_id"],
            ),
        )
        conn.commit()
```

### Step 4: Manual Override

If user disagrees with auto-revert decision:

```python
def override_rollback(conn, mutation_id, reason):
    """
    User manually overrides auto-revert decision.
    """
    
    conn.execute(
        """
        UPDATE mutation_rollbacks
        SET status = ?, manual_override = ?, override_at = ?, updated_at = ?
        WHERE mutation_id = ?
        """,
        (
            "manual_override",
            reason,
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat(),
            mutation_id,
        ),
    )
    
    conn.commit()
    logger.info(f"User override: mutation {mutation_id} - {reason}")
```

## Commands

```bash
# Start rollback monitor (run every 4 hours via cron)
bash tools/google-ads/run.sh monitor-rollbacks

# Show rollback status
bash tools/google-ads/run.sh rollback-status

# Show candidates for revert (upcoming thresholds)
bash tools/google-ads/run.sh rollback-at-risk

# Manually override auto-revert
bash tools/google-ads/run.sh override-rollback --id 5 --reason "Acceptable variance"

# Force manual revert
bash tools/google-ads/run.sh manual-revert --id 5 --reason "External feedback"

# Export rollback analysis
bash tools/google-ads/run.sh rollback-analysis --export csv > rollback_events.csv
```

## Rollback Status Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ Rollback Monitor Status                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 🟢 Healthy Mutations (48h monitoring window)            │
│ ├─ ID 1: apply_recommendation (CPA +2.1%, Conv +8.5%)  │
│ ├─ ID 3: add_negative_keywords (CPA -0.5%, Conv +3.2%) │
│ └─ ID 4: bid_adjustment (CPA +1.8%, Conv +0.9%)        │
│                                                          │
│ ⚠️  At-Risk (approaching thresholds)                     │
│ └─ ID 7: apply_recommendation (CPA +4.2%, Conv -2.1%)  │
│   • CPA close to 5% threshold                           │
│   • Conversion drop minimal                             │
│   • Est. alert in 12 hours if trend continues           │
│                                                          │
│ 🔄 Auto-Reverted (within last 7 days)                   │
│ ├─ ID 2: apply_recommendation                          │
│   • Reason: CPA +7.2% (threshold 5%)                    │
│   • Reverted: 2026-04-10 14:32 UTC                      │
│   • Impact: Saved ~$200 in wasted spend                 │
│                                                          │
│ 👤 Manual Overrides (user disagreed with revert)        │
│ └─ ID 5: bid_adjustment                                │
│   • Would-be reason: Conversions -8.5% (threshold 10%) │
│   • Override reason: "Acceptable seasonal variance"     │
│   • User: steve                                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Integration with Analytics (Phase 4G)

Link rollback data to mutation analysis:

- If mutation was reverted, mark analysis.effectiveness_rating = "ineffective"
- Track which mutations are frequently reverted (identify patterns)
- Auto-adjust approval gates for high-revert-rate types

## Safety Features

1. **Grace Period** — Don't revert mutations applied <2 hours ago (needs stable data)
2. **Confirmation** — Require manual approval to revert (optional safety toggle)
3. **Audit Trail** — All revert decisions logged to change_events with reasoning
4. **Notification** — Slack alert on each auto-revert (no silent failures)
5. **Rate Limiting** — Max 1 revert per mutation (no churn)

## Thresholds Guide

### Conservative (Ad Grants / Nonprofit)

```toml
cpa_increase_threshold_pct = 3.0       # Very sensitive to CPA rise
conversion_drop_threshold_pct = 5.0    # Protect conversion counts
spend_increase_threshold_pct = 10.0    # Budget-conscious
check_interval_hours = 2               # Monitor frequently
```

### Balanced (Mid-market)

```toml
cpa_increase_threshold_pct = 5.0       # Allow minor fluctuation
conversion_drop_threshold_pct = 10.0   # Allow expected variance
spend_increase_threshold_pct = 15.0    # Standard margin
check_interval_hours = 4               # Check every 4h
```

### Aggressive (High-volume)

```toml
cpa_increase_threshold_pct = 10.0      # Tolerate volatility
conversion_drop_threshold_pct = 20.0   # Focus on overall health
spend_increase_threshold_pct = 25.0    # Efficiency less critical
check_interval_hours = 6               # Hourly checks expensive
```

---

**Status**: 🚀 Ready for implementation  
**Time Estimate**: 4-5 hours  
**Dependencies**: Phase 4G analytics (for data accuracy)  
**Risk**: Medium (auto-revert is destructive, but gated by thresholds)  
**Safety Level**: 🟢 High (audit trail, manual override, notifications)
