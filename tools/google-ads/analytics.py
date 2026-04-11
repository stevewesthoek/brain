#!/usr/bin/env python3
"""
Google Ads Mutation Analytics Engine

Tracks mutation impact vs predicted, measures effectiveness, auto-adjusts gates.

Usage:
  from analytics import analyze_applied_mutations, get_insights
  analyze_applied_mutations(conn, rules)  # Run nightly
  insights = get_insights(conn)           # Get summary stats
"""

import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def create_analysis_schema(conn: sqlite3.Connection) -> None:
    """Create mutation_analysis table if it doesn't exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS mutation_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mutation_id INTEGER NOT NULL UNIQUE,

          -- Predictions (from risk_score)
          predicted_impact REAL,
          predicted_level TEXT,
          predicted_reasons TEXT,

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
          spend_delta_pct REAL,
          cpa_delta_pct REAL,
          conversions_delta_pct REAL,
          impact_accuracy_pct REAL,

          -- Classification
          accuracy_rating TEXT,
          effectiveness_rating TEXT,

          -- Audit
          analysis_completed_at TEXT,
          confidence_score REAL,
          notes TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_mutation_analysis_mutation_id ON mutation_analysis(mutation_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_mutation_analysis_accuracy ON mutation_analysis(accuracy_rating)"
    )


def record_baseline_metrics(
    conn: sqlite3.Connection, mutation_id: int, campaign_id: Optional[str]
) -> bool:
    """Capture pre-mutation metrics for impact comparison (called when mutation applied)."""

    try:
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
            WHERE (campaign_id = ? OR (? IS NULL AND campaign_id IS NULL))
              AND metrics_date >= date('now', '-7 days')
            """,
            (campaign_id, campaign_id),
        ).fetchone()

        if not baseline:
            logger.warning(f"No baseline metrics found for mutation {mutation_id}")
            return False

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
                baseline["avg_spend"] or 0,
                baseline["avg_cpa"] or 0,
                baseline["avg_cpc"] or 0,
                baseline["avg_ctr"] or 0,
                baseline["total_conversions"] or 0,
                datetime.now().isoformat(),
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat(),
            ),
        )

        conn.commit()
        logger.info(f"Recorded baseline for mutation {mutation_id}")
        return True

    except Exception as err:
        logger.error(f"Error recording baseline: {err}")
        return False


def analyze_applied_mutations(conn: sqlite3.Connection) -> int:
    """
    Find mutations applied 48+ hours ago and measure actual impact.

    Returns count of mutations analyzed.
    """

    try:
        # Find mutations applied 48+ hours ago without analysis
        mutations = conn.execute(
            """
            SELECT m.id, m.payload, m.campaign_id, ma.baseline_spend_usd, ma.baseline_date,
                   ma.baseline_cpa, ma.baseline_cpc, ma.baseline_ctr, ma.baseline_conversions
            FROM pending_mutations m
            JOIN mutation_analysis ma ON m.id = ma.mutation_id
            WHERE m.status = 'applied'
              AND m.applied_at < datetime('now', '-48 hours')
              AND ma.actual_date IS NULL
            LIMIT 20
            """
        ).fetchall()

        if not mutations:
            return 0

        analyzed = 0

        for mutation in mutations:
            try:
                payload = json.loads(mutation["payload"] or "{}")
                campaign_id = mutation["campaign_id"]
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
                    WHERE (campaign_id = ? OR (? IS NULL AND campaign_id IS NULL))
                      AND metrics_date > ?
                      AND metrics_date <= date(?, '+2 days')
                    """,
                    (campaign_id, campaign_id, baseline_date, baseline_date),
                ).fetchone()

                if not actual:
                    continue

                # Calculate deltas
                baseline_spend = mutation["baseline_spend_usd"] or 0.01
                baseline_cpa = mutation["baseline_cpa"] or 0.01
                baseline_conversions = mutation["baseline_conversions"] or 1

                actual_spend = actual["avg_spend"] or 0
                actual_cpa = actual["avg_cpa"] or 0
                actual_conversions = actual["total_conversions"] or 0

                spend_delta = ((actual_spend - baseline_spend) / baseline_spend * 100)
                cpa_delta = ((actual_cpa - baseline_cpa) / baseline_cpa * 100)
                conversions_delta = ((actual_conversions - baseline_conversions) / baseline_conversions * 100)

                # Classify accuracy
                predicted_impact = payload.get("impact_estimate", 0)
                actual_impact = actual_spend - baseline_spend
                impact_delta = (
                    abs(actual_impact - predicted_impact) / max(abs(predicted_impact), 1)
                )

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
                        actual_spend,
                        actual_cpa,
                        actual["avg_cpc"] or 0,
                        actual["avg_ctr"] or 0,
                        actual_conversions,
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
                analyzed += 1
                logger.info(
                    f"Analyzed mutation {mutation['id']}: {effectiveness} (acc: {accuracy})"
                )

            except Exception as err:
                logger.error(f"Error analyzing mutation {mutation['id']}: {err}")
                continue

        return analyzed

    except Exception as err:
        logger.error(f"Error in analyze_applied_mutations: {err}")
        return 0


def get_insights(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Generate high-level insights from mutation analysis."""

    try:
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

        total = accuracy["total"] or 1
        accurate_pct = (accuracy["accurate"] or 0) / total * 100
        underestimated_pct = (accuracy["underestimated"] or 0) / total * 100
        overestimated_pct = (accuracy["overestimated"] or 0) / total * 100

        # By mutation type
        by_type = conn.execute(
            """
            SELECT
              m.mutation_type,
              COUNT(*) as count,
              AVG(ma.conversions_delta_pct) as avg_conversion_lift,
              AVG(ma.cpa_delta_pct) as avg_cpa_change,
              SUM(CASE WHEN ma.effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as highly_effective_count
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
              'low' as level,
              COUNT(*) as count,
              SUM(CASE WHEN effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as positive_count,
              AVG(conversions_delta_pct) as avg_conversion_lift
            FROM mutation_analysis
            WHERE predicted_level = 'low' AND analysis_completed_at IS NOT NULL
            UNION ALL
            SELECT
              'medium' as level,
              COUNT(*) as count,
              SUM(CASE WHEN effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as positive_count,
              AVG(conversions_delta_pct) as avg_conversion_lift
            FROM mutation_analysis
            WHERE predicted_level = 'medium' AND analysis_completed_at IS NOT NULL
            UNION ALL
            SELECT
              'high' as level,
              COUNT(*) as count,
              SUM(CASE WHEN effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as positive_count,
              AVG(conversions_delta_pct) as avg_conversion_lift
            FROM mutation_analysis
            WHERE predicted_level = 'high' AND analysis_completed_at IS NOT NULL
            UNION ALL
            SELECT
              'urgent' as level,
              COUNT(*) as count,
              SUM(CASE WHEN effectiveness_rating IN ('effective', 'highly_effective') THEN 1 ELSE 0 END) as positive_count,
              AVG(conversions_delta_pct) as avg_conversion_lift
            FROM mutation_analysis
            WHERE predicted_level = 'urgent' AND analysis_completed_at IS NOT NULL
            ORDER BY count DESC
            """
        ).fetchall()

        return {
            "accuracy_overall": {
                "total": total,
                "accurate_pct": accurate_pct,
                "underestimated_pct": underestimated_pct,
                "overestimated_pct": overestimated_pct,
            },
            "by_mutation_type": [
                {
                    "type": row["mutation_type"],
                    "count": row["count"],
                    "avg_conversion_lift": row["avg_conversion_lift"] or 0,
                    "avg_cpa_change": row["avg_cpa_change"] or 0,
                    "highly_effective": row["highly_effective_count"] or 0,
                    "effectiveness_pct": (row["highly_effective_count"] or 0) / row["count"] * 100
                    if row["count"] > 0
                    else 0,
                }
                for row in by_type
            ],
            "by_risk_level": [
                {
                    "risk_level": row["level"],
                    "count": row["count"],
                    "effectiveness": (row["positive_count"] or 0) / row["count"] * 100
                    if row["count"] > 0
                    else 0,
                    "avg_conversion_lift": row["avg_conversion_lift"] or 0,
                }
                for row in by_risk
                if row["count"] > 0
            ],
        }

    except Exception as err:
        logger.error(f"Error generating insights: {err}")
        return {
            "accuracy_overall": {},
            "by_mutation_type": [],
            "by_risk_level": [],
        }


def suggest_gate_adjustments(insights: Dict[str, Any], rules: Dict[str, Any]) -> List[Dict[str, str]]:
    """Suggest approval gate adjustments based on insights."""

    recommendations = []

    try:
        # If apply_recommendation has >90% effectiveness, lower impact threshold
        for mutation_type in insights["by_mutation_type"]:
            if mutation_type["type"] == "apply_recommendation":
                effectiveness = mutation_type["effectiveness_pct"]

                if effectiveness > 90:
                    recommendations.append({
                        "type": "lower_threshold",
                        "mutation_type": "apply_recommendation",
                        "reason": f"{effectiveness:.0f}% effectiveness rate",
                        "suggestion": "Lower high_impact_threshold from $500 to $300",
                        "priority": "medium",
                    })
                elif effectiveness < 50:
                    recommendations.append({
                        "type": "raise_threshold",
                        "mutation_type": "apply_recommendation",
                        "reason": f"Only {effectiveness:.0f}% effectiveness rate",
                        "suggestion": "Raise high_impact_threshold from $500 to $750",
                        "priority": "high",
                    })

        # If high-risk mutations have poor accuracy, increase escalation threshold
        for risk_level in insights["by_risk_level"]:
            if risk_level["risk_level"] == "urgent":
                if risk_level["effectiveness"] < 50:
                    recommendations.append({
                        "type": "increase_escalation",
                        "risk_level": "urgent",
                        "reason": f"<50% effectiveness on urgent mutations ({risk_level['effectiveness']:.0f}%)",
                        "suggestion": "Increase escalation_urgency_threshold to $2500",
                        "priority": "high",
                    })

        # If all mutations accurate within 5%, relax prediction requirements
        accuracy = insights["accuracy_overall"]
        if accuracy.get("accurate_pct", 0) > 80:
            recommendations.append({
                "type": "confidence_increase",
                "reason": f"High prediction accuracy ({accuracy['accurate_pct']:.0f}%)",
                "suggestion": "Can lower confidence_threshold on ML predictions from 0.70 to 0.60",
                "priority": "low",
            })

    except Exception as err:
        logger.error(f"Error generating suggestions: {err}")

    return recommendations


def export_analysis_csv(conn: sqlite3.Connection, output_path: str) -> bool:
    """Export mutation analysis to CSV for external analysis."""

    try:
        import csv

        query = """
        SELECT
          m.id,
          m.mutation_type,
          m.campaign_id,
          m.status,
          ma.predicted_impact,
          ma.predicted_level,
          ma.baseline_spend_usd,
          ma.baseline_cpa,
          ma.actual_spend_usd,
          ma.actual_cpa,
          ma.spend_delta_pct,
          ma.cpa_delta_pct,
          ma.conversions_delta_pct,
          ma.accuracy_rating,
          ma.effectiveness_rating,
          ma.analysis_completed_at
        FROM pending_mutations m
        JOIN mutation_analysis ma ON m.id = ma.mutation_id
        WHERE ma.analysis_completed_at IS NOT NULL
        ORDER BY m.created_at DESC
        """

        rows = conn.execute(query).fetchall()

        with open(output_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([desc[0] for desc in conn.execute(query).description])
            writer.writerows(rows)

        logger.info(f"Exported {len(rows)} mutations to {output_path}")
        return True

    except Exception as err:
        logger.error(f"Error exporting analysis: {err}")
        return False
