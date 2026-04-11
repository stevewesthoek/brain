# Phase 4: Google Ads Safe Automation

## Context

Phase 3 built a full read pipeline (sync → SQLite → ProBot dashboard). Phase 4 adds:
- **Phase 4A**: Two quickfix bugs + safe write operations (negative keywords)
- **Phase 4B**: Approval-gated mutations (pending_mutations queue + approve/reject/apply)

**Safety constraint:** This is a nonprofit Ad Grants account ($10k/month). One wrong mutation can trigger suspension. All mutations default to dry-run. `--live` must be passed explicitly. Mock mode blocks `--live` with a clear error.

Two critical bugs exist that must be fixed first (before any new features):
1. `cmd_pace` reads from `metrics_snapshots` (always empty) — sync writes to `daily_metrics_detail`
2. ProBot dashboard reads same wrong table

---

## Files to Modify

- `tools/google-ads/cli.py` — main CLI (530 lines)
- `tools/google-ads/api.py` — API wrapper
- `config/google-ads/rules.toml` — add `[negative_keywords]` section
- `projects/probot/src/bot/dashboard.ts` — fix data source + pending mutations badge

---

## Implementation Steps

### Step 1: Fix pace data source mismatch (cli.py)

**Current (broken):** `latest_month_spend()` at line 487 queries `metrics_snapshots` (always 0 rows).
**Fix:** Replace with a new helper querying `daily_metrics_detail` where `campaign_id IS NULL` (account rollup rows that sync writes).

```python
def latest_month_spend_from_detail(conn: sqlite3.Connection, month_prefix: str) -> float:
    row = conn.execute(
        "SELECT COALESCE(SUM(spend_usd), 0) FROM daily_metrics_detail "
        "WHERE metrics_date LIKE ? AND campaign_id IS NULL",
        (f"{month_prefix}%",),
    ).fetchone()
    return float(row[0] or 0.0)
```

Update `cmd_pace` (line 507) to call `latest_month_spend_from_detail` instead of `latest_month_spend`.

### Step 2: Fix ProBot dashboard data source (dashboard.ts)

**Current (broken):** Line 690 queries `metrics_snapshots ORDER BY id DESC LIMIT 1`.
**Fix:** Replace with:

```sql
SELECT metrics_date as snapshot_date, SUM(spend_usd) as spend_usd
FROM daily_metrics_detail
WHERE campaign_id IS NULL AND metrics_date LIKE strftime('%Y-%m','now') || '%'
GROUP BY metrics_date ORDER BY metrics_date DESC LIMIT 1
```

Wrap in try/catch since table may not exist in older DBs.

### Step 3: Wire pacing bands to pace command (cli.py)

`cmd_pace` already loads `goals.toml` but ignores `[pacing]`. Add:
- Compute `daily_avg = actual_spend / day_index`
- Compare against `green_min/max`, `yellow_min`, `red_min` from goals.toml
- Print `Pacing status: GREEN/YELLOW/RED`
- On yellow/red: print to stderr AND insert a `change_events` row (`change_type = "pacing_alert"`)

### Step 4: Add `[negative_keywords]` section to rules.toml

```toml
[negative_keywords]
spend_threshold_usd = 20.0
lookback_days = 30
match_type = "BROAD"
```

### Step 5: Add `--live` flag + `assert_live_allowed()` helper (cli.py)

Add global `--live` argument to the argument parser. Add helper:

```python
def assert_live_allowed(args: argparse.Namespace, api) -> None:
    if api.use_mock and args.live:
        print("ERROR: --live passed but API is in mock mode. Fix credentials first.", file=sys.stderr)
        raise SystemExit(2)
    if not args.live:
        print("[DRY RUN] Pass --live to execute real mutations.")
```

### Step 6: Add schema to connect_db() (cli.py)

Two new tables added to the `executescript` in `connect_db()`:

```sql
CREATE TABLE IF NOT EXISTS pending_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_type TEXT NOT NULL,
    campaign_id TEXT,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    rule_source TEXT,
    proposed_by TEXT NOT NULL DEFAULT 'auto',
    reviewed_by TEXT,
    applied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS negative_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    keyword_text TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'BROAD',
    google_resource_name TEXT,
    source TEXT NOT NULL DEFAULT 'auto',
    created_at TEXT NOT NULL,
    UNIQUE(campaign_id, keyword_text, match_type)
);
```

### Step 7: Add mutation methods to api.py

Add two new methods to `GoogleAdsAPI`:

**`add_negative_keywords(campaign_id, keywords, match_type, dry_run)`**
- dry_run=True (default): returns plan without API call
- use_mock + live: simulates success, logs "mock" flag
- real: calls `CampaignCriterionService.mutate_campaign_criteria()`
- returns: `{"added": [...], "skipped": [...], "errors": [...], "dry_run": bool}`

**`apply_recommendation(recommendation_resource_name, dry_run)`**
- dry_run=True (default): returns plan without API call
- use_mock + live: simulates success
- real: calls `RecommendationService.apply_recommendation()`
- returns: `{"applied": bool, "resource_name": str, "dry_run": bool}`

### Step 8: Add `negatives` command (cli.py)

New `cmd_negatives(args)` function + subparser registration:

1. Load `rules.toml` — check `safe_auto_apply.negative_keywords = true`. If false, print blocking key, exit 0.
2. Load thresholds from `rules.toml[negative_keywords]`.
3. Query `search_terms` for trailing `lookback_days` where `conversions = 0 AND spend_usd > spend_threshold_usd`.
4. Deduplicate against existing `negative_keywords` table entries.
5. Print candidate list.
6. Call `assert_live_allowed(args, api)`.
7. Dry run: log to `change_events` (`change_type = "negative_keyword_dry_run"`), exit 0.
8. Live: group by `campaign_id`, call `api.add_negative_keywords()` per group, insert into `negative_keywords` table, log each to `change_events` (`change_type = "negative_keyword_added"`).

### Step 9: Add `approve`, `reject`, `apply` commands (cli.py)

**`cmd_approve(args)`** — `approve [id]` or `approve --all`
- Updates `pending_mutations.status = 'approved'` for given ID(s)
- Prints confirmation

**`cmd_reject(args)`** — `reject <id> [--reason TEXT]`
- Updates `pending_mutations.status = 'rejected'`
- Stores reason in `payload` JSON if provided

**`cmd_apply(args)`** — `apply [--id N] [--all-approved] [--live]`
- Calls `assert_live_allowed(args, api)` first
- Fetches approved mutations from `pending_mutations`
- For each: dispatches to the correct API method based on `mutation_type`
- On success: sets `status = 'applied'`, `applied_at = now()`
- Logs `change_events` row per applied mutation
- On failure: sets `status = 'failed'`, stores error in payload

### Step 10: Populate change_events from sync (cli.py)

In `cmd_sync`, after storing campaigns: compare new status vs previously stored status (read before upsert). For each changed campaign, insert a `change_events` row.

At end of every successful sync, insert one `sync_completed` row:
```python
conn.execute(
    "INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    (today, "sync_completed", "account", None,
     json.dumps({"campaigns": len(campaigns), "search_terms": len(search_terms), "recommendations": len(recommendations)}),
     utc_now_iso()),
)
```

### Step 11: Update ProBot dashboard (dashboard.ts)

1. Add `pendingMutations?: number` to `GoogleAdsMetrics` interface.
2. In `getGoogleAdsMetrics()`, after the existing queries, add:
```typescript
const pendingMutationsRow = (() => {
  try {
    return db.prepare("SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'pending'").get() as { count: number } | undefined;
  } catch { return undefined; }
})();
```
3. Include `pendingMutations: pendingMutationsRow?.count ?? 0` in the returned object.
4. In `renderGoogleAds()`, show a badge when `data.pendingMutations > 0`.
5. Update the tab button to reflect count.
6. Recompile TypeScript.

---

## Verification

After each step, verify:

1. **Step 1–2:** Run `bash tools/google-ads/run.sh pace` — should show non-zero actual spend. ProBot dashboard Google Ads tab shows non-zero spend (after refreshing).

2. **Step 3:** Run `pace` with mocked high/low spend values — verify GREEN/YELLOW/RED output and `change_events` row on yellow/red.

3. **Step 5:** Run any mutation command without `--live` — must print `[DRY RUN]`. Run with `--live` while mock active — must exit 2 with error message.

4. **Step 8:** `bash tools/google-ads/run.sh negatives` (dry run) — prints candidates, no API calls, `change_events` row written. Verify with: `sqlite3 data/google-ads/google_ads.sqlite3 "SELECT * FROM change_events ORDER BY id DESC LIMIT 3;"`.

5. **Step 9:** Create a pending mutation manually, run `approve`, confirm status changes. Run `apply --all-approved` without `--live` — must show dry-run output. Run with `--live` while mock — must exit 2.

6. **Step 11:** Start ProBot, navigate to Google Ads tab — verify non-zero spend shows, pending mutations badge appears when rows exist.

---

## Execution Order

Steps 1, 2, 3 first (pure read fixes, zero risk).  
Then Steps 4, 5, 6 together (schema/config prep, no behavior change).  
Then Steps 7, 8 together (mutation API + negatives command).  
Then Steps 9, 10, 11 (event tracking + dashboard).  
Commit after each logical group.
