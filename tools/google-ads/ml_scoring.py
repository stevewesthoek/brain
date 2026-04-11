#!/usr/bin/env python3
"""
ML-based Risk Scoring & Cost Optimization (Phase 4I)

Replaces hardcoded risk rules with ML model trained on historical mutations.
Generates bid adjustment suggestions for cost optimization.

Usage:
  from ml_scoring import train_mutation_model, score_mutation_ml
  model = train_mutation_model(conn)  # Run weekly
  score = score_mutation_ml(mutation, model, confidence_threshold=0.7)
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Try to import sklearn (optional dependency)
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder
    import joblib
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logger.warning("sklearn not installed. ML scoring disabled. Install: pip install scikit-learn")


def train_mutation_model(db_path: str, model_path: str = "models/mutation_predictor.pkl") -> Optional[Any]:
    """
    Train ML model on historical mutations for risk prediction.

    Returns trained model or None if insufficient data or sklearn unavailable.
    """

    if not HAS_SKLEARN:
        logger.warning("sklearn not available. Skipping model training.")
        return None

    try:
        import sqlite3
        import pandas as pd
        from sklearn.model_selection import train_test_split

        conn = sqlite3.connect(db_path)

        # Fetch historical data
        query = """
        SELECT
          m.id,
          m.mutation_type,
          json_extract(m.payload, '$.impact_estimate') as impact,
          CASE WHEN m.campaign_id IS NULL THEN 1 ELSE 0 END as is_account_level,
          json_extract(m.payload, '$.priority') as priority,
          ma.effectiveness_rating,
          ma.conversions_delta_pct
        FROM pending_mutations m
        LEFT JOIN mutation_analysis ma ON m.id = ma.mutation_id
        WHERE ma.effectiveness_rating IS NOT NULL
        """

        df = pd.read_sql(query, conn)
        conn.close()

        if len(df) < 20:
            logger.warning(f"Only {len(df)} analyzed mutations. Need 20+ for training.")
            return None

        logger.info(f"Training on {len(df)} mutations")

        # Encode categorical features
        le_type = LabelEncoder()
        le_priority = LabelEncoder()

        df["mutation_type_encoded"] = le_type.fit_transform(df["mutation_type"].fillna("unknown"))
        df["priority_encoded"] = le_priority.fit_transform(df["priority"].fillna("MEDIUM"))

        # Features
        X = df[["impact", "is_account_level", "mutation_type_encoded", "priority_encoded"]].fillna(0)

        # Label: effective = 1, ineffective = 0
        y = (df["effectiveness_rating"].isin(["effective", "highly_effective"])).astype(int)

        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Train random forest
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight="balanced",
        )

        model.fit(X_train, y_train)

        # Evaluate
        train_acc = model.score(X_train, y_train)
        test_acc = model.score(X_test, y_test)

        logger.info(f"Model trained: train_acc={train_acc:.1%}, test_acc={test_acc:.1%}")

        # Save model
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, model_path)
        logger.info(f"Model saved to {model_path}")

        return model

    except Exception as err:
        logger.error(f"Error training model: {err}")
        return None


def score_mutation_ml(
    mutation: Dict[str, Any],
    model: Optional[Any],
    confidence_threshold: float = 0.7,
) -> Dict[str, Any]:
    """
    Score mutation using ML model if available, else fallback to rules.

    Returns dict with score (0-100), level, confidence, and reasoning.
    """

    if not model or not HAS_SKLEARN:
        return score_mutation_rules(mutation)

    try:
        from sklearn.preprocessing import LabelEncoder

        # Extract features
        payload = json.loads(mutation.get("payload", "{}"))
        impact = float(payload.get("impact_estimate", 0))
        is_account_level = 1 if not mutation.get("campaign_id") else 0
        mutation_type = mutation.get("mutation_type", "unknown")
        priority = payload.get("priority", "MEDIUM")

        # Encode features (match training)
        le_type = LabelEncoder()
        le_priority = LabelEncoder()
        # Note: In production, these should be persisted with the model
        le_type.fit(["add_negative_keywords", "apply_recommendation", "bid_adjustment"])
        le_priority.fit(["LOW", "MEDIUM", "HIGH"])

        type_encoded = le_type.transform([mutation_type])[0]
        priority_encoded = le_priority.transform([priority])[0]

        # Predict
        features = [[impact, is_account_level, type_encoded, priority_encoded]]
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        confidence = max(probabilities)

        # Map prediction to risk score
        # prediction=1 (effective) → low risk (0-40)
        # prediction=0 (ineffective) → high risk (60-100)

        if prediction == 1:
            score = 20 + (1 - confidence) * 20  # 20-40 range
            level = "low"
        else:
            score = 60 + confidence * 40  # 60-100 range
            level = "high" if confidence > 0.8 else "medium"

        if confidence < confidence_threshold:
            # Fallback to rule-based scoring for low confidence
            return score_mutation_rules(mutation)

        return {
            "score": int(score),
            "level": level,
            "confidence": float(confidence),
            "model_name": "random_forest_v1",
            "reason": f"ML model (confidence {confidence:.0%})",
        }

    except Exception as err:
        logger.error(f"Error in ML scoring: {err}")
        return score_mutation_rules(mutation)


def score_mutation_rules(mutation: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback rule-based scoring (same as notifications.py)."""

    payload = json.loads(mutation.get("payload", "{}"))
    impact = float(payload.get("impact_estimate", 0))

    score = 0
    reasons = []

    if impact > 1000:
        score += 30
        reasons.append(f"High impact: ${impact:.2f}")
    if impact > 500:
        score += 15
        reasons.append("Medium impact")

    priority = payload.get("priority", "").upper()
    if priority == "HIGH":
        score += 20
        reasons.append("High priority")

    if not mutation.get("campaign_id"):
        score += 25
        reasons.append("Account-level mutation")

    level = "low" if score < 30 else "medium" if score < 60 else "high" if score < 80 else "urgent"

    return {
        "score": min(score, 100),
        "level": level,
        "confidence": 0.6,
        "model_name": "rule_based",
        "reason": "Fallback rule-based scoring",
    }


def suggest_cost_optimizations(db_path: str, top_k: int = 10) -> list:
    """
    Suggest bid adjustments based on keyword performance.

    Returns list of bid adjustment suggestions.
    """

    try:
        import sqlite3

        conn = sqlite3.connect(db_path)

        # Find keywords with high CPC but low conversion rate
        suggestions = conn.execute(
            """
            SELECT
              s.keyword,
              s.match_type,
              AVG(s.cpc) as avg_cpc,
              SUM(s.conversions) as total_conversions,
              AVG(s.ctr) as avg_ctr,
              SUM(s.spend_usd) as total_spend,
              CASE
                WHEN AVG(s.ctr) > 0.05 AND SUM(s.conversions) = 0 THEN 'reduce_bids'
                WHEN SUM(s.conversions) > 10 AND AVG(s.cpc) < 0.50 THEN 'increase_bids'
                ELSE NULL
              END as suggestion
            FROM search_terms s
            WHERE s.spend_usd > 0
            GROUP BY s.keyword
            HAVING suggestion IS NOT NULL
            ORDER BY total_spend DESC
            LIMIT ?
            """,
            (top_k,),
        ).fetchall()

        conn.close()

        mutations = []
        for row in suggestions:
            suggestion = row[6]  # suggestion column

            if suggestion == "reduce_bids":
                adjustment = 0.7  # Reduce by 30%
                reason = f"High CTR ({row[4]:.1%}) but 0 conversions"
                estimated_savings = row[5] * (1 - adjustment)
            else:  # increase_bids
                adjustment = 1.3  # Increase by 30%
                reason = f"High-converting keyword, avg CPC ${row[2]:.2f}"
                estimated_savings = -(row[5] * (adjustment - 1))

            mutations.append({
                "mutation_type": "bid_adjustment",
                "keyword": row[0],
                "match_type": row[1],
                "adjustment": adjustment,
                "reason": reason,
                "estimated_impact": estimated_savings,
                "current_spend": row[5],
            })

        logger.info(f"Generated {len(mutations)} cost optimization suggestions")
        return mutations

    except Exception as err:
        logger.error(f"Error generating suggestions: {err}")
        return []


def queue_optimization_suggestions(conn: Any, suggestions: list, rules: Dict[str, Any]) -> int:
    """Queue cost optimization mutations for auto-approval."""

    try:
        queued = 0

        for sug in suggestions:
            # Check if should auto-approve
            auto_approve = (
                sug["estimated_impact"] > 0 and  # Savings, not cost
                rules.get("safe_auto_apply", {}).get("bid_optimizations", False)
            )

            conn.execute(
                """
                INSERT INTO pending_mutations
                  (mutation_type, resource_type, resource_id, payload, status, rule_source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "bid_adjustment",
                    "keyword",
                    sug["keyword"],
                    json.dumps(sug),
                    "approved" if auto_approve else "pending",
                    "cost_optimization_engine",
                    datetime.utcnow().isoformat(),
                    datetime.utcnow().isoformat(),
                ),
            )

            queued += 1

        conn.commit()
        logger.info(f"Queued {queued} cost optimization mutations")
        return queued

    except Exception as err:
        logger.error(f"Error queuing suggestions: {err}")
        return 0


def analyze_ab_test_results(db_path: str, mutation_type: str, min_samples: int = 20) -> Dict[str, Any]:
    """
    Compare test vs control bucket performance (A/B test analysis).

    Returns significance test results and recommendation.
    """

    try:
        import sqlite3
        from scipy import stats

        conn = sqlite3.connect(db_path)

        # Simplified: just check effectiveness by type
        # In production, would use proper A/B bucketing and statistical tests

        results = conn.execute(
            """
            SELECT
              COUNT(*) as count,
              AVG(ma.conversions_delta_pct) as avg_conversion_lift,
              AVG(ma.cpa_delta_pct) as avg_cpa_change
            FROM pending_mutations m
            JOIN mutation_analysis ma ON m.id = ma.mutation_id
            WHERE m.mutation_type = ? AND ma.analysis_completed_at IS NOT NULL
            """,
            (mutation_type,),
        ).fetchone()

        conn.close()

        if not results or results[0] < min_samples:
            return {
                "status": "insufficient_data",
                "min_samples": min_samples,
                "actual_samples": results[0] if results else 0,
            }

        return {
            "status": "sufficient_data",
            "mutation_type": mutation_type,
            "sample_size": results[0],
            "conversion_lift": results[1] or 0,
            "cpa_impact": results[2] or 0,
            "recommendation": (
                "Deploy to all mutations"
                if (results[1] or 0) > 5
                else "Need more data" if (results[1] or 0) > 0
                else "Consider other approaches"
            ),
        }

    except Exception as err:
        logger.error(f"Error analyzing A/B tests: {err}")
        return {"status": "error", "message": str(err)}
