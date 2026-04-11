# Phase 4C: Production-Ready Safety & Batch Operations

Phase 4C makes the mutation system production-ready with budget-aware approval, campaign-type conditions, batch operations with visual confirmation, and pre-execution validation.

## New Commands

### `cmd_preview`
Preview approved mutations before applying them. Shows exact details of what each mutation will do.

```bash
# Preview all approved mutations
bash tools/google-ads/run.sh preview

# Preview specific type
bash tools/google-ads/run.sh preview --type negative_keywords

# Preview specific mutation
bash tools/google-ads/run.sh preview --id 5
```

**Output:**
```
MUTATION PREVIEW
====================================================================================================

Mutation ID 1:
  Type: Negative Keywords
  Campaign ID: 1
  Match type: BROAD
  Keywords (3):
    - poor quality traffic
    - irrelevant terms
    - competitor spam

Mutation ID 2:
  Type: Google Ads Recommendation
  Recommendation type: KEYWORD
  Priority: HIGH
  Campaign ID: 2
  Estimated impact: $850.00
  Description: Add high-intent keyword: "donate to nonprofit"

====================================================================================================
Total mutations: 2
Total estimated impact: $850.00

To apply these mutations, run:
  bash tools/google-ads/run.sh batch-apply --live
```

### `cmd_compliance_check`
Validates pending mutations against organizational rules before approval.

```bash
# Check all pending mutations
bash tools/google-ads/run.sh compliance-check
```

**Validations:**
- Negative keywords: length check (rejects < 2 chars), stop word detection
- Recommendations: priority level, mission alignment
- Resource history: recent modifications, rate limits
- Recommendation types: flags high-risk operations (bid adjustments)

**Output:**
```
COMPLIANCE CHECK
════════════════════════════════════════════════════════════════════════════════════════════════════

✓ PASS ID   1 add_negative_keywords
⚠ WARN ID   2 apply_recommendation
      WARNING: Medium priority recommendation requires mission check
✓ PASS ID   3 add_negative_keywords

════════════════════════════════════════════════════════════════════════════════════════════════════
Passed: 2
Warnings: 1
Failed: 0

All mutations passed compliance checks.
```

**Exit codes:**
- `0`: All passed or warnings only
- `1`: Failures found (block execution)

### `cmd_batch_approve`
Approve multiple mutations at once with visual confirmation.

```bash
# Show pending and ask for confirmation
bash tools/google-ads/run.sh batch-approve

# Approve specific type
bash tools/google-ads/run.sh batch-approve --type negative_keywords

# Auto-confirm without prompting
bash tools/google-ads/run.sh batch-approve --auto
```

**Output:**
```
Pending mutations to approve: 5
════════════════════════════════════════════════════════════════════════════════════════════════════

add_negative_keywords (3 mutations):
  ID    1 | campaign_criterion:1:keyword1
  ID    3 | campaign_criterion:2:keyword2
  ID    4 | campaign_criterion:1:keyword3

apply_recommendation (2 mutations):
  ID    2 | recommendation:5
  ID    5 | recommendation:8

════════════════════════════════════════════════════════════════════════════════════════════════════
Approve all 5 mutations? (yes/no): yes
✓ Approved 5 mutations
```

### `cmd_batch_apply`
Apply approved mutations in safe batches with dry-run preview and confirmation.

```bash
# Dry-run: show what would be applied
bash tools/google-ads/run.sh batch-apply

# Apply for real
bash tools/google-ads/run.sh batch-apply --live

# Apply specific type only
bash tools/google-ads/run.sh batch-apply --type negative_keywords --live
```

**Workflow:**
1. List approved mutations grouped by type
2. Ask for confirmation (dry-run asks "continue?", --live asks "confirm")
3. Execute mutations or show dry-run preview
4. Report success/errors

**Output (dry-run):**
```
Approved mutations ready to apply: 3
════════════════════════════════════════════════════════════════════════════════════════════════════

add_negative_keywords (2 mutations):
  ID    1 | campaign_criterion:1:kw1
  ID    3 | campaign_criterion:2:kw2

apply_recommendation (1 mutation):
  ID    2 | recommendation:5

════════════════════════════════════════════════════════════════════════════════════════════════════
[DRY RUN] Use --live to apply these mutations for real
Continue with dry-run preview? (yes/no): yes
[DRY RUN] Would apply add_negative_keywords to campaign_criterion
[DRY RUN] Would apply add_negative_keywords to campaign_criterion
[DRY RUN] Would apply apply_recommendation to recommendation

Dry-run preview: 3 mutations would be applied
```

**Output (live):**
```
Apply 3 mutations (LIVE)? Type 'confirm' to proceed: confirm
✓ Applied 1: add_negative_keywords
✓ Applied 3: add_negative_keywords
✓ Applied 2: apply_recommendation

Applied: 3
Errors: 0
```

## Configuration

### Budget-Aware Approval (rules.toml)

```toml
[approval_gates]
enable_budget_checks = true
min_pacing_pct_for_approval = 80.0   # Don't approve if underspending
max_pacing_pct_for_approval = 120.0  # Don't approve if overspending
```

**How it works:**
- `cmd_auto_approve` and `cmd_recommendations` check current pacing
- If < 80% of target (underspending): Hold mutations (manual review recommended)
- If > 120% of target (overspending): Hold mutations (prevent wasting remaining budget)
- If 80-120%: Approve automatically (if other conditions met)

### Campaign Type Conditions (rules.toml)

```toml
[approval_gates.campaign_types]
SEARCH = { min_impact = 300.0, max_daily_spend = 150.0 }
DISPLAY = { min_impact = 200.0, max_daily_spend = 100.0 }
VIDEO = { min_impact = 400.0, max_daily_spend = 200.0 }
```

**How it works:**
- Each campaign type has minimum impact requirement for auto-approval
- HIGH priority recommendation only auto-approved if impact >= minimum for that type
- Lower thresholds for DISPLAY (broad reach, lower impact)
- Higher thresholds for VIDEO and SEARCH (more specific targeting)

## Workflow Examples

### Example 1: Safe Daily Automation

```bash
# 1. Run sync to get latest recommendations
bash tools/google-ads/run.sh sync

# 2. Queue recommendations (auto-approves high-impact ones)
bash tools/google-ads/run.sh recommendations

# 3. Check overall pipeline
bash tools/google-ads/run.sh status

# 4. Run auto-approval scan
bash tools/google-ads/run.sh auto-approve

# 5. Check compliance
bash tools/google-ads/run.sh compliance-check

# 6. Preview what will be applied
bash tools/google-ads/run.sh preview

# 7. Approve any remaining manually
bash tools/google-ads/run.sh mutations --status pending
# Review, then:
bash tools/google-ads/run.sh batch-approve --auto

# 8. Apply all (dry-run first)
bash tools/google-ads/run.sh batch-apply
bash tools/google-ads/run.sh batch-apply --live

# 9. Verify
bash tools/google-ads/run.sh status
```

### Example 2: Overspending Guard

```bash
# Check if we're overspending
bash tools/google-ads/run.sh status | grep "Delta:"

# If overspending, try to auto-approve
bash tools/google-ads/run.sh auto-approve

# Will output:
# ⊘ ID   5 held: Overspending: 125.3% > 120.0% maximum

# Manual review required before approving
```

### Example 3: Campaign Type Validation

```bash
# Scenario: Budget $300 recommendation to DISPLAY campaign (min $200)
# Expected: AUTO-APPROVED (✓)

# Scenario: Budget $250 recommendation to VIDEO campaign (min $400)
# Expected: HELD (⊘ reason: Campaign type VIDEO requires impact >= $400.00)
```

### Example 4: Batch Operations with Safety Gates

```bash
# 1. Stage negative keywords from low-performing search terms
bash tools/google-ads/run.sh negatives --live

# 2. View what's pending
bash tools/google-ads/run.sh mutations --status pending

# 3. Run compliance check
bash tools/google-ads/run.sh compliance-check

# If any warnings, preview and review
bash tools/google-ads/run.sh preview --type negative_keywords

# 4. Approve batch
bash tools/google-ads/run.sh batch-approve --type negative_keywords --auto

# 5. Apply batch (dry-run)
bash tools/google-ads/run.sh batch-apply --type negative_keywords

# 6. Apply batch (live)
bash tools/google-ads/run.sh batch-apply --type negative_keywords --live

# 7. Verify
bash tools/google-ads/run.sh mutations --status applied
```

## Decision Flow Chart

```
Recommendation discovered during sync
         ↓
Queue as pending_mutation
         ↓
─────────────────────────────────────
│ should_auto_approve_mutation()    │
│  - Check: HIGH priority?           │
│  - Check: impact >= threshold?    │
│  - Check: budget healthy?         │
│  - Check: campaign type rules?    │
─────────────────────────────────────
         ↓
    ┌────┴────┐
    ↓         ↓
 Approved   Pending
    ↓         ↓
    │    Manual review:
    │    - compliance-check
    │    - preview
    │    - approve
    │         ↓
    │    ┌────┴────┐
    │    ↓         ↓
    │  Approved  Rejected
    │         ↓
    └─────────┘
          ↓
    batch-approve (grouped)
          ↓
    batch-apply (dry-run first)
          ↓
    batch-apply --live
          ↓
    change_events logged
```

## Safety Guarantees

1. **Budget-aware**: Won't approve when underspending or overspending
2. **Campaign-aware**: Enforces type-specific impact minimums
3. **Compliance-gated**: Pre-execution validation catches bad mutations
4. **Batch-safe**: Visual confirmation before group operations
5. **Dry-run first**: See exact impact before --live execution
6. **Audit trail**: Every operation logged with decision reasoning
7. **Human-in-loop**: All batch operations require confirmation

## ProBot Integration (Future)

- Show pacing health color (green/yellow/red) on dashboard
- Link to compliance warnings if any
- Quick action buttons: "Preview", "Approve All", "Apply All"
- Real-time pipeline status updates

## Troubleshooting

### Auto-approval held mutation, why?

```bash
bash tools/google-ads/run.sh auto-approve
# Output: ⊘ ID   2 held: Overspending: 115.0% > 120.0% maximum
```

**Check pacing:**
```bash
bash tools/google-ads/run.sh status | grep -A 5 "PACING"
```

**Solution:** Wait until pacing returns to target range (80-120%), or manually approve if justified.

### Compliance check failed, how to fix?

```bash
bash tools/google-ads/run.sh compliance-check
# Output: ✗ FAIL ID   1 add_negative_keywords
#         WARNING: 2 keywords too short (likely invalid)
```

**Solution:** Edit keywords, delete mutation, re-queue with valid keywords.

### Batch-apply won't execute, why?

```bash
bash tools/google-ads/run.sh batch-apply --live
# No mutations found
```

**Debug:** Check if there are approved mutations:
```bash
bash tools/google-ads/run.sh mutations --status approved
```

## Next Steps (Phase 4D)

- Webhook notifications for pending mutations
- Approval escalation to humans via Slack/email
- Integration with Google Ads monitoring alerts
- Automated rollback on API errors
- A/B testing framework for campaign mutations
- Impact analysis dashboard (predicted vs actual)
