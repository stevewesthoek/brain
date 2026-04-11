# Phase 4G: Analytics & Impact Tracking

Track actual mutation impact vs predicted impact. Identify patterns, improve approval gates, measure system effectiveness.

## Overview

**Two components:**
1. **Impact Measurement** — Track metrics post-mutation for 24/48 hours
2. **Analysis & Insights** — Compare predicted vs actual, identify patterns

## Data Flow

```
Mutation Applied
    ↓
Record baseline metrics (pre-mutation)
    ↓
Sync metrics every 4 hours
    ↓
After 48 hours, calculate delta
    ↓
Compare to risk_score & impact_estimate
    ↓
Store analysis in mutation_analysis table
    ↓
Generate insights (for dashboard)
```

## New Database Table

```sql
CREATE TABLE mutation_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id INTEGER NOT NULL UNIQUE,
  
  -- Predictions (from risk_score)
  predicted_impact REAL,
  predicted_level TEXT,  -- low, medium, high, urgent
  predicted_reasons TEXT,  -- JSON array
  
  -- Baseline (pre-mutation metrics)
  baseline_spend_usd REAL,
  baseline_cpa REAL,
  baseline_cpc REAL,
  baseline_ctr REAL,
  baseline_conversions INTEGER,
  baseline_date TEXT NOT NULL,
  
  -- Actual (post-mutation metrics after 48h)
  actual_spend_usd REAL,
  actual_cpa REAL,
  actual_cpc REAL,
  actual_ctr REAL,
  actual_conversions INTEGER,
  actual_date TEXT,
  
  -- Calculated deltas
  spend_delta_pct REAL,  -- (actual - baseline) / baseline * 100
  cpa_delta_pct REAL,
  conversions_delta_pct REAL,
  impact_accuracy_pct REAL,  -- How close actual to predicted
  
  -- Classification
  accuracy_rating TEXT,  -- overestimated, accurate, underestimated
  effectiveness_rating TEXT,  -- ineffective, neutral, effective, highly_effective
  
  -- Audit
  analysis_completed_at TEXT,
  confidence_score REAL,  -- 0-100, higher if more historical data
  notes TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for quick lookups
CREATE INDEX idx_mutation_analysis_mutation_id ON mutation_analysis(mutation_id);
CREATE INDEX idx_mutation_analysis_accuracy ON mutation_analysis(accuracy_rating);
```

## Workflow

### Step 1: Record Baseline (When Mutation Applied)

When mutation is applied:

```python
def record_baseline_metrics(conn, mutation_id, campaign_id):
    """Capture pre-mutation metrics for impact comparison."""
    
    # Fetch last 7 days of metrics for this campaign
    baseline = conn.execute(
        """
        SELECT
          AVG(spend_usd) as avg_spend,
          AVG(cost_per_acquisition) as avg_cpa,
          AVG(cost_per_click) as avg_cpc,
          AVG(ctr) as avg_ctr,
          SUM(conversions) as total_conversions
        FROM daily_metrics_detail
        WHERE campaign_id = ? AND metrics_date >= date('now', '-7 days')
        """,
        (campaign_id,),
    ).fetchone()
    
    # Insert into mutation_analysis (pending actual data)
    conn.execute(
        """
        INSERT INTO mutation_analysis
          (mutation_id, baseline_spend_usd, baseline_cpa, baseline_cpc, baseline_ctr, 
           baseline_conversions, baseline_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mutation_id,
            baseline["avg_spend"],
            baseline["avg_cpa"],
            baseline["avg_cpc"],
            baseline["avg_ctr"],
            baseline["total_conversions"],
            datetime.now().isoformat(),
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat(),
        ),
    )
```

### Step 2: Measure Actual Impact (After 48 Hours)

Scheduled sync job (run nightly):

```python
def analyze_applied_mutations(conn):
    """
    Find mutations applied 48+ hours ago and measure actual impact.
    """
    
    # Find mutations applied 48+ hours ago without analysis
    mutations = conn.execute(
        """
        SELECT m.id, m.payload, ma.baseline_spend_usd, ma.baseline_date
        FROM pending_mutations m
        JOIN mutation_analysis ma ON m.id = ma.mutation_id
        WHERE m.status = 'applied'
          AND m.applied_at < datetime('now', '-48 hours')
          AND ma.actual_date IS NULL  -- Not yet analyzed
        LIMIT 10
        """
    ).fetchall()
    
    for mutation in mutations:
        payload = json.loads(mutation["payload"])
        campaign_id = mutation.get("campaign_id")
        baseline_date = mutation["baseline_date"]
        
        # Fetch metrics for 48 hours after application
        actual = conn.execute(
            """
            SELECT
              AVG(spend_usd) as avg_spend,
              AVG(cost_per_acquisition) as avg_cpa,
              AVG(cost_per_click) as avg_cpc,
              AVG(ctr) as avg_ctr,
              SUM(conversions) as total_conversions
            FROM daily_metrics_detail
            WHERE campaign_id = ? 
              AND metrics_date > ?
              AND metrics_date <= date(?, '+2 days')
            """,
            (campaign_id, baseline_date, baseline_date),
        ).fetchone()
        
        # Calculate deltas
        spend_delta = ((actual["avg_spend"] - mutation["baseline_spend_usd"]) 
                      / mutation["baseline_spend_usd"] * 100)
        cpa_delta = ((actual["avg_cpa"] - mutation["baseline_cpa"]) 
                    / mutation["baseline_cpa"] * 100)
        conversions_delta = ((actual["total_conversions"] - mutation["baseline_conversions"]) 
                           / max(mutation["baseline_conversions"], 1) * 100)
        
        # Classify accuracy
        predicted_impact = payload.get("impact_estimate", 0)
        actual_impact = actual["avg_spend"] - mutation["baseline_spend_usd"]
        impact_delta = abs(actual_impact - predicted_impact) / max(predicted_impact, 1)
        
        if impact_delta < 0.1:
            accuracy = "accurate"
        elif actual_impact > predicted_impact:
            accuracy = "underestimated"
        else:
            accuracy = "overestimated"
        
        # Classify effectiveness
        if conversions_delta > 10:
            effectiveness = "highly_effective"
        elif conversions_delta > 0:
            effectiveness = "effective"
        elif conversions_delta > -10:
            effectiveness = "neutral"
        else:
            effectiveness = "ineffective"
        
        # Update mutation_analysis
        conn.execute(
            """
            UPDATE mutation_analysis
            SET
              actual_spend_usd = ?,
              actual_cpa = ?,
              actual_cpc = ?,
              actual_ctr = ?,
              actual_conversions = ?,
              actual_date = ?,
              spend_delta_pct = ?,
              cpa_delta_pct = ?,
              conversions_delta_pct = ?,
              accuracy_rating = ?,
              effectiveness_rating = ?,
              analysis_completed_at = ?,
              updated_at = ?
            WHERE mutation_id = ?
            """,
            (
                actual["avg_spend"],
                actual["avg_cpa"],
                actual["avg_cpc"],
                actual["avg_ctr"],
                actual["total_conversions"],
                datetime.now().isoformat(),
                spend_delta,
                cpa_delta,
                conversions_delta,
                accuracy,
                effectiveness,
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat(),
                mutation["id"],
            ),
        )
        
        conn.commit()
```

### Step 3: Generate Insights

Aggregate analysis for dashboard:

```python
def get_mutation_insights(conn):
    """
    Generate high-level insights from mutation analysis.
    """
    
    # Overall accuracy
    accuracy = conn.execute(
        """
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN accuracy_rating = 'accurate' THEN 1 ELSE 0 END) as accurate,
          SUM(CASE WHEN accuracy_rating = 'underestimated' THEN 1 ELSE 0 END) as underestimated,
          SUM(CASE WHEN accuracy_rating = 'overestimated' THEN 1 ELSE 0 END) as overestimated
        FROM mutation_analysis
        WHERE analysis_completed_at IS NOT NULL
        """
    ).fetchone()
    
    # By mutation type
    by_type = conn.execute(
        """
        SELECT
          m.mutation_type,
          COUNT(*) as count,
          AVG(ma.conversions_delta_pct) as avg_conversion_lift,
          AVG(ma.cpa_delta_pct) as avg_cpa_change,
          SUM(CASE WHEN ma.effectiveness_rating = 'highly_effective' THEN 1 ELSE 0 END) as highly_effective_count
        FROM pending_mutations m
        JOIN mutation_analysis ma ON m.id = ma.mutation_id
        WHERE ma.analysis_completed_at IS NOT NULL
        GROUP BY m.mutation_type
        ORDER BY count DESC
        """
    ).fetchall()
    
    # By risk level
    by_risk = conn.execute(
        """
        SELECT
          ma.predicted_level,
          COUNT(*) as count,
          SUM(CASE WHEN ma.effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as positive_count,
          AVG(ma.conversions_delta_pct) as avg_conversion_lift
        FROM mutation_analysis ma
        WHERE ma.analysis_completed_at IS NOT NULL
        GROUP BY ma.predicted_level
        ORDER BY count DESC
        """
    ).fetchall()
    
    return {
        "accuracy_overall": {
            "total": accuracy["total"],
            "accurate_pct": accuracy["accurate"] / accuracy["total"] * 100,
            "underestimated_pct": accuracy["underestimated"] / accuracy["total"] * 100,
            "overestimated_pct": accuracy["overestimated"] / accuracy["total"] * 100,
        },
        "by_mutation_type": [
            {
                "type": row["mutation_type"],
                "count": row["count"],
                "avg_conversion_lift": row["avg_conversion_lift"],
                "avg_cpa_change": row["avg_cpa_change"],
                "highly_effective": row["highly_effective_count"],
            }
            for row in by_type
        ],
        "by_risk_level": [
            {
                "risk_level": row["predicted_level"],
                "count": row["count"],
                "effectiveness": row["positive_count"] / row["count"] * 100,
                "avg_conversion_lift": row["avg_conversion_lift"],
            }
            for row in by_risk
        ],
    }
```

## Insights Dashboard

### View 1: Overall Performance

```
┌────────────────────────────────────────────┐
│ Mutation Impact Analysis                   │
├────────────────────────────────────────────┤
│                                            │
│ 📊 Overall Accuracy                        │
│ Total Mutations Analyzed: 24               │
│ Accurate: 18 (75%)   ████░░░░░░░░          │
│ Underestimated: 4 (17%)  ██░░░░░░░░░░░░    │
│ Overestimated: 2 (8%)   █░░░░░░░░░░░░░░    │
│                                            │
│ 💰 Impact Summary                          │
│ Total Predicted Impact: $18,500            │
│ Total Actual Impact: $17,200 (-7%)         │
│ Avg Conversion Lift: +12.3%                │
│                                            │
│ 🎯 Effectiveness Rating                    │
│ Highly Effective: 8 (33%)                  │
│ Effective: 12 (50%)                        │
│ Neutral: 3 (13%)                           │
│ Ineffective: 1 (4%)                        │
│                                            │
└────────────────────────────────────────────┘
```

### View 2: By Mutation Type

```
Type                 Count   Conversion  CPA     Effective
apply_recommendation   12    +15.2%     -8.3%    10/12 ✅
add_negative_keywords   8    +8.5%      -2.1%    7/8 ✅
bid_adjustment          4    +2.1%      +1.5%    2/4 ⚠️
```

### View 3: By Risk Level

```
Risk     Count  Effectiveness  Avg Lift   Status
Low        8    100%          +18.2%    🟢 Highly predictable
Medium     12   83%           +12.5%    🟡 Good predictability
High        3   67%           +5.3%     🟠 Lower predictability
Urgent      1   0%            -2.1%     🔴 Single data point
```

## Insights API

```typescript
GET /api/insights
GET /api/insights/by-type/:type
GET /api/insights/by-risk/:level
GET /api/mutations/:id/analysis
```

## Integration with Approval Gates

Use insights to auto-adjust gates:

```python
def adjust_approval_gates_from_insights(insights, rules):
    """
    Suggest approval gate adjustments based on mutation analysis.
    """
    
    recommendations = []
    
    # If apply_recommendation has >90% success rate, lower impact threshold
    for mutation_type_insight in insights["by_mutation_type"]:
        if mutation_type_insight["type"] == "apply_recommendation":
            effectiveness = (mutation_type_insight["highly_effective"] + 
                           mutation_type_insight["effective"]) / mutation_type_insight["count"]
            
            if effectiveness > 0.9:
                recommendations.append({
                    "type": "lower_threshold",
                    "mutation_type": "apply_recommendation",
                    "reason": "90%+ effectiveness rate",
                    "suggestion": "Lower high_impact_threshold from $500 to $300",
                })
    
    # If high-risk mutations have poor accuracy, increase escalation threshold
    for risk_insight in insights["by_risk_level"]:
        if risk_insight["risk_level"] == "urgent" and risk_insight["effectiveness"] < 50:
            recommendations.append({
                "type": "increase_escalation",
                "reason": "<50% effectiveness on urgent mutations",
                "suggestion": "Increase escalation_urgency_threshold to $2500",
            })
    
    return recommendations
```

## Commands

```bash
# Analyze mutations (run nightly)
bash tools/google-ads/run.sh analyze

# Show insights
bash tools/google-ads/run.sh insights

# Show insights by type
bash tools/google-ads/run.sh insights --by-type

# Export analysis CSV
bash tools/google-ads/run.sh insights --export csv > mutation_analysis.csv

# Suggest gate adjustments
bash tools/google-ads/run.sh suggest-gate-adjustments
```

## Next Phase (4H): Rollback Framework

If mutation causes performance regression:
- Monitor for 48 hours post-application
- If CPA increases >5% or conversions drop >10%, auto-revert

---

**Status**: 🚀 Ready for implementation  
**Time Estimate**: 3-4 hours  
**Dependencies**: Phase 4F dashboard (for UI)  
**Risk**: Low (read-only analysis)
