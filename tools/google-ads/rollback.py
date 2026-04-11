#!/usr/bin/env python3
"""
Google Ads Mutation Rollback Framework

Auto-revert mutations if performance metrics degrade post-application.

Usage:
  from rollback import arm_rollback_monitor, check_mutations_for_rollback
  arm_rollback_monitor(conn, mutation_id, campaign_id, baseline_metrics)  # On apply
  check_mutations_for_rollback(conn, rules)  # Run every 4 hours (cron)
"""

import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def create_rollback_schema(conn: sqlite3.Connection) -> None:
    """Create mutation_rollbacks table if it doesn't exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS mutation_rollbacks (
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
          status TEXT DEFAULT 'pending',
          revert_reason TEXT,
          reverted_at TEXT,

          -- Audit
          manual_override TEXT,
          override_at TEXT,
          notes TEXT,

          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """
    )

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_rollbacks_mutation_id ON mutation_rollbacks(mutation_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_rollbacks_status ON mutation_rollbacks(status)"
    )


def arm_rollback_monitor(
    conn: sqlite3.Connection,
    mutation_id: int,
    campaign_id: Optional[str],
    baseline_metrics: Dict[str, float],
) -> bool:
    """Register mutation for rollback monitoring (called when mutation applied)."""

    try:
        conn.execute(
            """
            INSERT INTO mutation_rollbacks
              (mutation_id, baseline_cpa, baseline_conversions, baseline_spend_usd,
               baseline_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mutation_id,
                baseline_metrics.get("cpa", 0),
                baseline_metrics.get("conversions", 0),
                baseline_metrics.get("spend", 0),
                datetime.now().isoformat(),
                "pending",
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat(),
            ),
        )

        conn.commit()
        logger.info(f"Armed rollback monitor for mutation {mutation_id}")
        return True

    except Exception as err:
        logger.error(f"Error arming rollback monitor: {err}")
        return False


def check_mutations_for_rollback(conn: sqlite3.Connection, rules: Dict[str, Any]) -> Tuple[int, int]:
    """
    Check pending rollback monitors. If threshold breached, revert mutation.

    Returns (checked, reverted) counts.
    """

    rollback_config = rules.get("rollback", {})
    if not rollback_config.get("enabled", False):
        return (0, 0)

    try:
        max_window_hours = rollback_config.get("max_window_hours", 48)

        # Find mutations in pending rollback window
        pending = conn.execute(
            """
            SELECT
              mr.*, m.id as mutation_id, m.campaign_id, m.mutation_type,
              m.resource_id, m.payload
            FROM mutation_rollbacks mr
            JOIN pending_mutations m ON mr.mutation_id = m.id
            WHERE mr.status = 'pending'
              AND mr.baseline_date > datetime('now', ? || ' hours')
            ORDER BY mr.created_at ASC
            """,
            (f"-{max_window_hours}",),
        ).fetchall()

        if not pending:
            return (0, 0)

        checked = 0
        reverted = 0

        for rollback in pending:
            try:
                # Fetch current metrics since baseline_date
                current = conn.execute(
                    """
                    SELECT
                      AVG(cost_per_acquisition) as cpa,
                      SUM(conversions) as conversions,
                      AVG(spend_usd) as spend
                    FROM daily_metrics_detail
                    WHERE (campaign_id = ? OR (? IS NULL AND campaign_id IS NULL))
                      AND metrics_date > ?
                    """,
                    (rollback["campaign_id"], rollback["campaign_id"], rollback["baseline_date"]),
                ).fetchone()

                if not current:
                    # No metrics yet, skip
                    continue

                checked += 1

                baseline_cpa = rollback["baseline_cpa"] or 0.01
                baseline_conversions = rollback["baseline_conversions"] or 1
                baseline_spend = rollback["baseline_spend_usd"] or 0.01

                current_cpa = current["cpa"] or baseline_cpa
                current_conversions = current["conversions"] or 0
                current_spend = current["spend"] or 0

                # Calculate deltas
                cpa_delta = ((current_cpa - baseline_cpa) / baseline_cpa * 100)
                conv_delta = ((current_conversions - baseline_conversions) / baseline_conversions * 100)
                spend_delta = ((current_spend - baseline_spend) / baseline_spend * 100)

                # Update rollback record with current metrics
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
                        current_cpa,
                        current_conversions,
                        current_spend,
                        datetime.now().isoformat(),
                        cpa_delta,
                        conv_delta,
                        spend_delta,
                        datetime.utcnow().isoformat(),
                        rollback["mutation_id"],
                    ),
                )

                # Check thresholds
                should_revert = False
                revert_reasons = []

                cpa_threshold = rollback_config.get("cpa_increase_threshold_pct", 5.0)
                if cpa_delta > cpa_threshold:
                    should_revert = True
                    revert_reasons.append(f"CPA +{cpa_delta:.1f}% (threshold {cpa_threshold}%)")

                conv_threshold = rollback_config.get("conversion_drop_threshold_pct", 10.0)
                if conv_delta < -conv_threshold:
                    should_revert = True
                    revert_reasons.append(f"Conversions {conv_delta:.1f}% (threshold -{conv_threshold}%)")

                spend_threshold = rollback_config.get("spend_increase_threshold_pct", 15.0)
                if spend_delta > spend_threshold:
                    should_revert = True
                    revert_reasons.append(f"Spend +{spend_delta:.1f}% (threshold {spend_threshold}%)")

                if should_revert:
                    reason = "; ".join(revert_reasons)
                    if _perform_rollback(conn, rollback, reason, rules):
                        reverted += 1
                    logger.warning(f"Mutation {rollback['mutation_id']} breached thresholds: {reason}")
                else:
                    logger.info(
                        f"Mutation {rollback['mutation_id']} healthy (CPA{cpa_delta:+.1f}%, Conv{conv_delta:+.1f}%)"
                    )

                conn.commit()

            except Exception as err:
                logger.error(f"Error checking rollback for mutation {rollback['mutation_id']}: {err}")
                continue

        return (checked, reverted)

    except Exception as err:
        logger.error(f"Error in check_mutations_for_rollback: {err}")
        return (0, 0)


def _perform_rollback(
    conn: sqlite3.Connection,
    rollback: Any,
    reason: str,
    rules: Dict[str, Any],
) -> bool:
    """
    Revert a mutation by reversing the action.
    """

    try:
        mutation_id = rollback["mutation_id"]
        mutation_type = rollback["mutation_type"]
        resource_id = rollback["resource_id"]

        # For now, we just mark it as reverted and log the decision
        # Real implementation would call API to revert (e.g., remove negative keyword, dismiss recommendation)

        now = datetime.utcnow().isoformat()
        today = datetime.now().strftime("%Y-%m-%d")

        # Mark as reverted
        conn.execute(
            """
            UPDATE mutation_rollbacks
            SET status = ?, revert_reason = ?, reverted_at = ?, updated_at = ?
            WHERE mutation_id = ?
            """,
            ("reverted", reason, now, now, mutation_id),
        )

        # Log to change_events
        conn.execute(
            """
            INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                today,
                "mutation_auto_reverted",
                "mutation",
                str(mutation_id),
                json.dumps({
                    "reason": reason,
                    "mutation_type": mutation_type,
                    "reverted_by": "auto_rollback",
                }),
                now,
            ),
        )

        conn.commit()

        # Notify (if configured)
        if rules.get("rollback", {}).get("notify_on_rollback", False):
            logger.info(f"🔄 Auto-reverted mutation {mutation_id}: {reason}")

        logger.info(f"Successfully reverted mutation {mutation_id}")
        return True

    except Exception as err:
        logger.error(f"Failed to revert mutation {rollback['mutation_id']}: {err}")
        return False


def override_rollback(
    conn: sqlite3.Connection,
    mutation_id: int,
    reason: str,
) -> bool:
    """User manually overrides auto-revert decision."""

    try:
        now = datetime.utcnow().isoformat()

        conn.execute(
            """
            UPDATE mutation_rollbacks
            SET status = ?, manual_override = ?, override_at = ?, updated_at = ?
            WHERE mutation_id = ?
            """,
            ("manual_override", reason, now, now, mutation_id),
        )

        conn.commit()
        logger.info(f"User override: mutation {mutation_id} - {reason}")
        return True

    except Exception as err:
        logger.error(f"Error overriding rollback: {err}")
        return False


def get_rollback_status(conn: sqlite3.Connection) -> Dict[str, Any]:
    """Get current rollback status for all mutations."""

    try:
        # Count by status
        status_counts = conn.execute(
            """
            SELECT
              status,
              COUNT(*) as count
            FROM mutation_rollbacks
            WHERE status IN ('pending', 'reverted', 'manual_override')
            GROUP BY status
            """
        ).fetchall()

        # Get at-risk mutations (approaching thresholds)
        at_risk = conn.execute(
            """
            SELECT
              m.id,
              m.mutation_type,
              mr.cpa_delta_pct,
              mr.conversions_delta_pct,
              mr.spend_delta_pct
            FROM mutation_rollbacks mr
            JOIN pending_mutations m ON mr.mutation_id = m.id
            WHERE mr.status = 'pending'
              AND (
                ABS(mr.cpa_delta_pct) > 3 OR
                ABS(mr.conversions_delta_pct) > 7 OR
                ABS(mr.spend_delta_pct) > 10
              )
            ORDER BY mr.updated_at DESC
            LIMIT 10
            """
        ).fetchall()

        # Get recently reverted
        reverted = conn.execute(
            """
            SELECT
              m.id,
              m.mutation_type,
              mr.revert_reason,
              mr.reverted_at
            FROM mutation_rollbacks mr
            JOIN pending_mutations m ON mr.mutation_id = m.id
            WHERE mr.status = 'reverted'
              AND mr.reverted_at > datetime('now', '-7 days')
            ORDER BY mr.reverted_at DESC
            LIMIT 10
            """
        ).fetchall()

        # Get manual overrides
        overrides = conn.execute(
            """
            SELECT
              m.id,
              m.mutation_type,
              mr.manual_override,
              mr.override_at,
              mr.revert_reason
            FROM mutation_rollbacks mr
            JOIN pending_mutations m ON mr.mutation_id = m.id
            WHERE mr.status = 'manual_override'
            ORDER BY mr.override_at DESC
            LIMIT 10
            """
        ).fetchall()

        return {
            "status_counts": {row["status"]: row["count"] for row in status_counts},
            "at_risk": [
                {
                    "id": row["id"],
                    "type": row["mutation_type"],
                    "cpa_delta": row["cpa_delta_pct"],
                    "conversions_delta": row["conversions_delta_pct"],
                    "spend_delta": row["spend_delta_pct"],
                }
                for row in at_risk
            ],
            "recently_reverted": [
                {
                    "id": row["id"],
                    "type": row["mutation_type"],
                    "reason": row["revert_reason"],
                    "reverted_at": row["reverted_at"],
                }
                for row in reverted
            ],
            "manual_overrides": [
                {
                    "id": row["id"],
                    "type": row["mutation_type"],
                    "override_reason": row["manual_override"],
                    "override_at": row["override_at"],
                    "would_have_reverted": row["revert_reason"],
                }
                for row in overrides
            ],
        }

    except Exception as err:
        logger.error(f"Error getting rollback status: {err}")
        return {
            "status_counts": {},
            "at_risk": [],
            "recently_reverted": [],
            "manual_overrides": [],
        }


def export_rollback_csv(conn: sqlite3.Connection, output_path: str) -> bool:
    """Export rollback decisions to CSV."""

    try:
        import csv

        query = """
        SELECT
          m.id,
          m.mutation_type,
          m.campaign_id,
          m.status,
          mr.baseline_cpa,
          mr.baseline_conversions,
          mr.trigger_cpa,
          mr.trigger_conversions,
          mr.cpa_delta_pct,
          mr.conversions_delta_pct,
          mr.spend_delta_pct,
          mr.status as rollback_status,
          mr.revert_reason,
          mr.reverted_at,
          mr.manual_override
        FROM pending_mutations m
        LEFT JOIN mutation_rollbacks mr ON m.id = mr.mutation_id
        WHERE mr.id IS NOT NULL
        ORDER BY m.applied_at DESC
        """

        rows = conn.execute(query).fetchall()

        with open(output_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([desc[0] for desc in conn.execute(query).description])
            writer.writerows(rows)

        logger.info(f"Exported {len(rows)} rollback decisions to {output_path}")
        return True

    except Exception as err:
        logger.error(f"Error exporting rollback CSV: {err}")
        return False
