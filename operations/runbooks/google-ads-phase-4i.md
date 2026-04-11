# Phase 4I: Advanced Routing & ML Scoring

ML-based risk scoring (replaces hardcoded rules), predictive impact modeling, cost optimization suggestions, and A/B testing framework.

## Overview

**Four capabilities:**

1. **ML Risk Scoring** — Train model on historical mutation data to predict risk more accurately
2. **Impact Prediction** — Use campaign/mutation features to estimate actual impact
3. **Cost Optimization** — Auto-generate bid adjustment suggestions
4. **A/B Testing** — Bucket mutations into test/control for effect measurement

## Architecture

```
Historical Data (Phase 4G/4H)
  ├─ 500+ mutations
  ├─ Actual outcomes (conversions, CPA, spend)
  ├─ Risk ratings (low/medium/high/urgent)
  └─ Effectiveness ratings (ineffective/neutral/effective/highly_effective)
         ↓
  ML Training Pipeline
  ├─ Feature extraction (mutation type, impact, campaign type, etc.)
  ├─ Label generation (effectiveness rating)
  ├─ Model training (logistic regression or random forest)
  └─ Model validation (precision/recall)
         ↓
  Deployed Model
  ├─ New mutations scored via model (not hardcoded rules)
  ├─ Confidence scores attached to predictions
  └─ Fallback to rule-based scoring if features missing
         ↓
  n8n Workflows (Phase 4E)
  ├─ Route based on model score + confidence
  └─ A/B test bucket assignments
```

## 1. ML Risk Scoring

### Training Data

```python
def prepare_training_data(conn):
    """
    Extract features and labels from historical mutations.
    """
    
    query = """
    SELECT
      m.id,
      m.mutation_type,
      CAST(json_extract(m.payload, '$.impact_estimate') AS REAL) as impact,
      CASE WHEN m.campaign_id IS NULL THEN 1 ELSE 0 END as is_account_level,
      CAST(json_extract(m.payload, '$.priority') AS TEXT) as priority,
      c.type as campaign_type,
      ma.conversions_delta_pct,
      ma.cpa_delta_pct,
      ma.effectiveness_rating
    FROM pending_mutations m
    LEFT JOIN campaigns c ON m.campaign_id = c.id
    LEFT JOIN mutation_analysis ma ON m.id = ma.mutation_id
    WHERE ma.effectiveness_rating IS NOT NULL
    """
    
    df = pd.read_sql(query, conn)
    
    # Features
    X = df[[
        "impact",
        "is_account_level",
        "mutation_type_encoded",  # one-hot
        "campaign_type_encoded",   # one-hot
        "priority_encoded",        # one-hot
    ]]
    
    # Label (map effectiveness to binary: effective=1, ineffective=0)
    y = (df["effectiveness_rating"].isin(["effective", "highly_effective"])).astype(int)
    
    return X, y, df
```

### Model Training

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib

def train_mutation_model(conn, output_path="models/mutation_predictor.pkl"):
    """
    Train ML model on historical mutations.
    """
    
    X, y, df = prepare_training_data(conn)
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    
    # Train random forest
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced",  # Handle imbalanced data
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    train_acc = model.score(X_train, y_train)
    test_acc = model.score(X_test, y_test)
    
    logger.info(f"Model trained: train_acc={train_acc:.2%}, test_acc={test_acc:.2%}")
    
    # Save model
    joblib.dump(model, output_path)
    
    return model
```

### Scoring New Mutations

```python
def score_mutation_ml(mutation, model, confidence_threshold=0.7):
    """
    Score mutation using ML model.
    
    Returns:
    - score: 0-100 risk level
    - level: 'low', 'medium', 'high', 'urgent'
    - confidence: 0-1 (how sure the model is)
    - reason: 'ML model', optional fallback reason if low confidence
    """
    
    # Extract features
    features = extract_mutation_features(mutation)
    
    # Get model prediction + probability
    prediction = model.predict([features])[0]
    probabilities = model.predict_proba([features])[0]
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
        # Fallback to rule-based scoring
        return score_mutation_rules(mutation, rules)
    
    return {
        "score": int(score),
        "level": level,
        "confidence": float(confidence),
        "model_name": "random_forest_v1",
        "reason": "ML model prediction",
    }
```

## 2. Impact Prediction

### Feature Engineering

```python
def extract_impact_features(mutation, conn):
    """
    Extract campaign and mutation features for impact prediction.
    """
    
    campaign_id = mutation.get("campaign_id")
    
    # Campaign metrics (last 30 days)
    campaign_stats = conn.execute(
        """
        SELECT
          AVG(spend_usd) as avg_daily_spend,
          SUM(conversions) as total_conversions,
          AVG(cpc) as avg_cpc,
          AVG(ctr) as avg_ctr,
          COUNT(DISTINCT metrics_date) as days_active
        FROM daily_metrics_detail
        WHERE campaign_id = ? AND metrics_date > date('now', '-30 days')
        """,
        (campaign_id,),
    ).fetchone()
    
    return {
        "mutation_type": mutation.get("mutation_type"),
        "impact_estimate": json.loads(mutation.get("payload", {})).get("impact_estimate"),
        "avg_daily_spend": campaign_stats["avg_daily_spend"],
        "total_conversions": campaign_stats["total_conversions"],
        "avg_cpc": campaign_stats["avg_cpc"],
        "avg_ctr": campaign_stats["avg_ctr"],
        "campaign_health": (campaign_stats["total_conversions"] / 
                          (campaign_stats["avg_daily_spend"] or 1)),
    }
```

### Impact Model

```python
def train_impact_model(conn):
    """
    Train regression model to predict actual impact.
    """
    
    query = """
    SELECT
      json_extract(m.payload, '$.impact_estimate') as predicted_impact,
      ma.actual_spend_usd - ma.baseline_spend_usd as actual_impact,
      ma.conversions_delta_pct,
      ma.cpa_delta_pct
    FROM pending_mutations m
    JOIN mutation_analysis ma ON m.id = ma.mutation_id
    WHERE ma.analysis_completed_at IS NOT NULL
    """
    
    df = pd.read_sql(query, conn)
    
    # Regression: predict actual_impact from predicted_impact + campaign features
    X = df[["predicted_impact", ...]]
    y = df["actual_impact"]
    
    model = RandomForestRegressor(n_estimators=50)
    model.fit(X, y)
    
    return model

def predict_impact(mutation, conn, model):
    """
    Predict actual impact of mutation.
    """
    
    features = extract_impact_features(mutation, conn)
    predicted = model.predict([features])[0]
    confidence = model.score([features])  # R² score
    
    return {
        "predicted_impact": float(predicted),
        "confidence": float(confidence),
        "uncertainty_range": (predicted * 0.8, predicted * 1.2),
    }
```

## 3. Cost Optimization Suggestions

### Automatic Bid Suggestions

```python
def suggest_bid_optimizations(conn, top_k=10):
    """
    Suggest bid adjustments based on campaign performance.
    """
    
    # Find keywords with high CPC but low conversion rate
    suggestions = conn.execute(
        """
        SELECT
          s.keyword,
          s.match_type,
          AVG(s.cpc) as avg_cpc,
          SUM(s.conversions) as total_conversions,
          AVG(s.ctr) as avg_ctr,
          SUM(s.cost) as total_cost,
          CASE
            WHEN AVG(s.ctr) > 0.05 AND SUM(s.conversions) = 0 THEN 'reduce_bids'
            WHEN SUM(s.conversions) > 10 AND AVG(s.cpc) < 0.50 THEN 'increase_bids'
            ELSE NULL
          END as suggestion
        FROM search_terms s
        WHERE suggestion IS NOT NULL
        GROUP BY s.keyword
        ORDER BY total_cost DESC
        LIMIT ?
        """,
        (top_k,),
    ).fetchall()
    
    mutations = []
    for sug in suggestions:
        if sug["suggestion"] == "reduce_bids":
            adjustment = 0.7  # Reduce by 30%
            reason = f"High CTR ({sug['avg_ctr']:.1%}) but 0 conversions"
        else:
            adjustment = 1.3  # Increase by 30%
            reason = f"High-converting keyword, avg CPC ${sug['avg_cpc']:.2f}"
        
        mutations.append({
            "mutation_type": "bid_adjustment",
            "keyword": sug["keyword"],
            "adjustment": adjustment,
            "reason": reason,
            "estimated_impact": sug["total_cost"] * (adjustment - 1),
        })
    
    return mutations
```

### Queue as Pending Mutations

```python
def queue_optimization_suggestions(conn, suggestions, rules):
    """
    Auto-queue bid adjustment suggestions as mutations.
    """
    
    for sug in suggestions:
        # Check approval gate: cost optimization typically low-risk
        auto_approve = (
            sug["estimated_impact"] > 0 and  # Savings, not additional spend
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
    
    conn.commit()
    logger.info(f"Queued {len(suggestions)} cost optimization mutations")
```

## 4. A/B Testing Framework

### Test Bucketing

```python
def assign_test_bucket(mutation_id, mutation_type, test_ratio=0.3):
    """
    Randomly assign mutation to test or control.
    
    Test: mutation applied, metrics monitored
    Control: mutation NOT applied, used as baseline for comparison
    """
    
    # Deterministic bucketing based on mutation ID
    hash_value = int(hashlib.md5(f"{mutation_id}_{mutation_type}".encode()).hexdigest(), 16)
    bucket = "test" if (hash_value % 100) < (test_ratio * 100) else "control"
    
    return bucket
```

### A/B Test Monitor

```python
def analyze_ab_test_results(conn, mutation_type, min_samples=20):
    """
    Compare test vs control bucket performance.
    """
    
    results = conn.execute(
        """
        SELECT
          CASE WHEN ab_bucket = 'test' THEN 'test' ELSE 'control' END as bucket,
          COUNT(*) as count,
          AVG(ma.conversions_delta_pct) as avg_conversion_lift,
          AVG(ma.cpa_delta_pct) as avg_cpa_change,
          AVG(ma.spend_delta_pct) as avg_spend_change
        FROM pending_mutations m
        JOIN mutation_analysis ma ON m.id = ma.mutation_id
        WHERE m.mutation_type = ? AND ma.analysis_completed_at IS NOT NULL
        GROUP BY bucket
        """,
        (mutation_type,),
    ).fetchall()
    
    if len(results) != 2 or any(r["count"] < min_samples for r in results):
        return {"status": "insufficient_data", "min_samples": min_samples}
    
    test = [r for r in results if r["bucket"] == "test"][0]
    control = [r for r in results if r["bucket"] == "control"][0]
    
    # T-test for statistical significance
    significance = statistical_test(test, control)
    
    return {
        "mutation_type": mutation_type,
        "test_size": test["count"],
        "control_size": control["count"],
        "conversion_lift": test["avg_conversion_lift"] - control["avg_conversion_lift"],
        "cpa_impact": test["avg_cpa_change"] - control["avg_cpa_change"],
        "significant": significance["p_value"] < 0.05,
        "p_value": significance["p_value"],
        "recommendation": (
            f"Apply to all mutations" if significance["p_value"] < 0.05
            else "Inconclusive, need more data"
        ),
    }
```

## Integration Points

### CLI Commands

```bash
# Train ML model on historical data
bash tools/google-ads/run.sh train-model

# Score new mutations with ML model
bash tools/google-ads/run.sh recommendations --use-ml-scoring

# Suggest cost optimizations
bash tools/google-ads/run.sh suggest-optimizations

# Analyze A/B test results
bash tools/google-ads/run.sh analyze-ab-tests --type apply_recommendation

# Export ML model metrics
bash tools/google-ads/run.sh model-performance --export csv
```

### Dashboard Views

```
📊 ML Model Performance
├─ Accuracy: 87% (vs 72% rule-based)
├─ Precision: 92%
├─ Recall: 81%
└─ Training samples: 487 mutations

💡 Cost Optimization Suggestions
├─ High-CPC keywords with 0 conversions: 12
├─ High-converting keywords to increase bids: 8
└─ Estimated monthly savings: $2,340

🧪 A/B Test Results (apply_recommendation)
├─ Test bucket: 24 mutations
├─ Control bucket: 26 mutations
├─ Conversion lift: +8.2% (p=0.043) ✅ Significant
├─ CPA impact: -1.3%
└─ Recommendation: "Deploy to all mutations"
```

## Model Retraining Schedule

```toml
[ml_model]
enabled = true
train_interval_days = 14    # Retrain every 2 weeks
min_new_samples = 20        # Only retrain if 20+ new mutations analyzed
model_path = "models/mutation_predictor.pkl"
model_version = "v2"
fallback_to_rules = true    # If model fails, use rule-based scoring
```

## Cron Job

```bash
# Every 2 weeks, retrain model
0 2 */14 * * cd /path/to/brain && bash tools/google-ads/run.sh train-model --schedule

# Daily: suggest cost optimizations
0 9 * * * bash tools/google-ads/run.sh suggest-optimizations --auto-queue

# Weekly: analyze A/B tests
0 10 * * 1 bash tools/google-ads/run.sh analyze-ab-tests --report
```

## Risk Mitigation

1. **Model Drift** — Periodically retrain (every 2 weeks) to catch shifting patterns
2. **Feature Availability** — If features missing, fallback to rule-based scoring
3. **Confidence Threshold** — Only use ML predictions if confidence > 70%
4. **Manual Override** — User can disable ML scoring and revert to rule-based
5. **Audit Trail** — Log which scoring method was used (ML vs rules) for each mutation

---

**Status**: 🚀 Ready for implementation  
**Time Estimate**: 5-6 hours (ML training, integration)  
**Dependencies**: Phase 4G analytics (training data)  
**Risk**: Low (non-blocking, fallback to rules, high audit trail)  
**Data Requirements**: 100+ analyzed mutations for meaningful model training
