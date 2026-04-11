# Phase 4B: Recommendation Queuing & Approval Gates

Phase 4B extends the mutation automation system to handle Google Ads recommendations and introduces conditional auto-approval based on impact thresholds.

## New Commands

### `cmd_recommendations`
Discovers pending recommendations from the sync and queues them for approval.

```bash
bash tools/google-ads/run.sh recommendations
```

**Workflow:**
1. Queries `recommendations` table for entries without associated mutations
2. Groups by type (KEYWORD, BID_ADJUSTMENT, AD_COPY, etc.)
3. Queues each as a `pending_mutation` with full impact/priority context
4. Auto-approves HIGH priority recommendations with impact >= threshold (if gates enabled)
5. Lower priority items held for manual review

**Output:**
```
Found 8 pending recommendations

Queuing for approval:
  ✓ KEYWORD              impact=$  850.00 (HIGH   ) → approved
  ✓ BID_ADJUSTMENT       impact=$  320.50 (MEDIUM ) → pending
  ✓ AD_COPY              impact=$  185.75 (MEDIUM ) → pending
...

Queued: 8
```

### `cmd_mutations`
Query and visualize the full mutation pipeline.

```bash
# List pending mutations
bash tools/google-ads/run.sh mutations

# Filter by status
bash tools/google-ads/run.sh mutations --status approved

# Filter by type
bash tools/google-ads/run.sh mutations --type apply_recommendation

# Show pipeline statistics
bash tools/google-ads/run.sh mutations --stats
```

**Output (list):**
```
Mutations (12 total)
────────────────────────────────────────────────────────────────────────────────────────────────────
ID   Status       Type                     Resource                 Created
────────────────────────────────────────────────────────────────────────────────────────────────────
1    pending      add_negative_keywords    campaign_criterion:1:k1  2026-04-11 14:30:22
2    approved     apply_recommendation     recommendation:5         2026-04-11 14:31:15
3    pending      apply_recommendation     recommendation:6         2026-04-11 14:31:45
...
```

**Output (stats):**
```
Mutation Pipeline Statistics
────────────────────────────────────────────────────────────────────────────────────────────────────
pending      add_negative_keywords              5
pending      apply_recommendation               3
approved     add_negative_keywords              2
approved     apply_recommendation               1
applied      add_negative_keywords              8
applied      apply_recommendation               2
────────────────────────────────────────────────────────────────────────────────────────────────────
pending      TOTAL                              8
approved     TOTAL                              3
applied      TOTAL                             10
────────────────────────────────────────────────────────────────────────────────────────────────────
             GRAND TOTAL                       21
```

### `cmd_auto_approve`
Scans pending mutations and auto-approves those meeting approval gate thresholds.

```bash
bash tools/google-ads/run.sh auto-approve
```

**Output:**
```
Auto-approved: 3
```

Approval gates are defined in `rules.toml[approval_gates]`:
```toml
[approval_gates]
auto_approve_high_impact = true
high_impact_threshold_usd = 500.0
require_manual_medium = true
require_manual_low = true
```

Rules:
- HIGH priority + impact >= threshold → auto-approved
- MEDIUM/LOW priority → requires manual approval (configurable)
- Can be disabled entirely by setting `auto_approve_high_impact = false`

### `cmd_status`
Shows comprehensive pipeline and system health status.

```bash
bash tools/google-ads/run.sh status
```

**Output:**
```
================================================================================
GOOGLE ADS AUTOMATION STATUS
================================================================================

[SYSTEM HEALTH]
Last sync: 2 hours ago
API status: ok

[PACING]
Month: 2026-04
Day of month: 11/30
Actual spend: $3,450.75
Target spend: $3,333.33
Delta: $+117.42 (103%)

[MUTATION PIPELINE]
Pending:     3
Approved:    2
Applied:    15
Rejected:    1
Failed:      0
Total:      21

[RECENT EVENTS]
  2026-04-11 14:45 mutation_applied_add_negative_keywords  campaign_criterion:1:term
  2026-04-11 14:30 recommendation_auto_approved            recommendation:5
  2026-04-11 14:20 sync_completed                          account
  2026-04-11 13:15 mutation_applied_apply_recommendation   recommendation:3
  2026-04-11 13:00 campaign_status_changed                 campaign:2

[RECOMMENDATIONS]
Pending recommendations: 8
================================================================================
```

## Configuration

### Approval Gates (rules.toml)

```toml
[approval_gates]
# Enable auto-approval based on impact thresholds
auto_approve_high_impact = true

# Minimum impact in USD for HIGH priority auto-approval
high_impact_threshold_usd = 500.0

# Require manual review for MEDIUM/LOW priority recommendations
require_manual_medium = true
require_manual_low = true
```

## Workflow Examples

### Example 1: Queue Recommendations & Auto-Approve

```bash
# 1. Queue all pending recommendations (auto-approves HIGH impact)
bash tools/google-ads/run.sh recommendations

# 2. View what got auto-approved vs. pending
bash tools/google-ads/run.sh mutations --stats

# 3. Review pending and manually approve if desired
bash tools/google-ads/run.sh mutations --status pending

# 4. Approve specific recommendation
bash tools/google-ads/run.sh approve 5
```

### Example 2: Batch Approval Workflow

```bash
# 1. Check current pipeline
bash tools/google-ads/run.sh status

# 2. Run auto-approval for qualifying mutations
bash tools/google-ads/run.sh auto-approve

# 3. Manually approve remaining pending
bash tools/google-ads/run.sh mutations --status pending
# → Review output, then:
bash tools/google-ads/run.sh approve --all

# 4. Apply all approved mutations (dry-run first)
bash tools/google-ads/run.sh apply --all-approved
# → Review output, then:
bash tools/google-ads/run.sh apply --all-approved --live

# 5. Verify application
bash tools/google-ads/run.sh status
```

### Example 3: Reject and Reason

```bash
# List pending mutations
bash tools/google-ads/run.sh mutations --status pending

# Reject specific mutation with reason
bash tools/google-ads/run.sh reject 3 --reason "Keyword too generic, likely low-quality traffic"

# Verify rejection
bash tools/google-ads/run.sh mutations --status rejected
```

## Database Schema

### pending_mutations
```sql
CREATE TABLE pending_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_type TEXT NOT NULL,           -- add_negative_keywords, apply_recommendation
    campaign_id TEXT,                      -- Google Ads campaign ID
    resource_type TEXT NOT NULL,           -- campaign_criterion, recommendation
    resource_id TEXT,                      -- ID of the resource being mutated
    payload TEXT NOT NULL,                 -- JSON with mutation details
    status TEXT DEFAULT 'pending',         -- pending, approved, rejected, applied, failed
    rule_source TEXT,                      -- Source rule (e.g., negatives_cmd, recommendations_cmd)
    proposed_by TEXT DEFAULT 'auto',       -- Who proposed (auto, user)
    reviewed_by TEXT,                      -- Who approved/rejected
    applied_at TEXT,                       -- When applied
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### change_events (related)
All mutations create change_events records:
- `recommendation_queued`: Recommendation added to queue
- `recommendation_auto_approved`: Auto-approved by gates
- `mutation_auto_approved`: Manual auto-approval scan
- `mutation_applied_{type}`: Mutation successfully applied
- `sync_completed`: Sync run completed with summary

## Safety Invariants

1. **Default dry-run**: `--live` flag required for any mutation application
2. **Mock mode blocks --live**: Returns exit 2 if API unavailable
3. **All mutations logged**: change_events table provides full audit trail
4. **Approval gates configurable**: Thresholds can be adjusted or disabled
5. **Graceful fallback**: Missing tables handled with try/catch in status queries

## Integration

### ProBot Dashboard
- Shows pending mutation count on Google Ads tab
- Red badge "X pending" when mutations await action
- Tab counter displays count

### Nightly Sync
- Automatically discovers new recommendations
- Queues them for approval
- Auto-approves high-impact items if configured

### Monitoring
Use `cmd_status` output to monitor pipeline health in external systems:
```bash
# Export JSON for monitoring systems
bash tools/google-ads/run.sh mutations --stats | grep "Total:"
```

## Troubleshooting

### Recommendations not queuing?
1. Check sync is running: `bash tools/google-ads/run.sh sync`
2. Verify `recommendations` table has data: Query SQLite
3. Ensure `safe_auto_apply.negative_keywords = true` in rules.toml

### Auto-approval not working?
1. Check gates enabled: `[approval_gates] auto_approve_high_impact = true`
2. Verify threshold: `high_impact_threshold_usd` (default $500)
3. Check priority is HIGH: `recommendations --status pending` shows priority
4. Run `auto-approve` manually to test logic

### Mutations stuck in pending?
1. Check approval gates: `rules.toml[approval_gates]`
2. Manually approve: `approve --all`
3. Check auto-approval eligibility: `mutations --stats`

## Next Steps (Phase 4C)

- Conditional approval based on campaign type
- Budget-aware approval (hold if month paced poorly)
- Recommendation grouping/batching
- Integration with approval workflow notifications
