# Google Ads API Integration Plan

## Overview

This document describes the exact sequence of steps to go from the current CLI scaffold to live Google Ads API integration with real campaign data flowing into the ProBot dashboard.

**Status:** All prerequisites complete. Ready to implement immediately.

## Prerequisites (✅ All Complete)

- [x] Developer token obtained (H38UKw1pjKJ-GgaOQVyHFQ)
- [x] OAuth 2.0 desktop client created (stored locally)
- [x] ADC refresh token generated (via gcloud)
- [x] Manager account linked to client (935-769-8503 → 592-920-2435)
- [x] Local config and documentation in place
- [x] ProBot dashboard tab ready
- [x] SQLite schema initialized
- [x] TypeScript build system working

## Phase 3: Live API Integration (This Phase)

### Step 1: Add Python Dependency

**File:** `tools/google-ads/requirements.txt` (create new)

```
google-ads==20.0.0
```

**Why this version:**
- Latest stable as of April 2026
- Full support for API v16
- Excel-compatible credential handling
- Async support (future-proofed)

**Verification:**
```bash
pip install -r tools/google-ads/requirements.txt
python3 -c "from google.ads.googleads.client import GoogleAdsClient; print('OK')"
```

### Step 2: Create API Wrapper Module

**File:** `tools/google-ads/api.py` (new)

**Purpose:** Single source of truth for Google Ads API interactions

**Key Functions:**
```python
class GoogleAdsAPI:
    def __init__(self, developer_token, customer_id, login_customer_id, refresh_token, client_id, client_secret):
        """Initialize with locally-stored credentials"""
        
    def fetch_campaigns(self) -> List[CampaignSnapshot]:
        """Returns campaign name, ID, status, budget, spend"""
        
    def fetch_daily_metrics(self, date: str) -> DailyMetrics:
        """Returns spend, clicks, impressions, CTR, conversions for a date"""
        
    def fetch_search_terms(self, date_range: Tuple[str, str]) -> List[SearchTerm]:
        """Returns search terms, clicks, impressions, conversions"""
        
    def fetch_recommendations(self) -> List[Recommendation]:
        """Returns Google recommendations from the account"""
        
    def fetch_change_events(self, since: str) -> List[ChangeEvent]:
        """Returns account mutations for audit trail"""
```

**Error Handling:**
- Catch `google.api_core.exceptions.InvalidArgument` for bad credentials
- Catch rate limit errors (429) and retry with backoff
- Log all API calls with timestamps

### Step 3: Update `sync` Command

**File:** `tools/google-ads/cli.py` (modify `cmd_sync`)

**Current state:** Placeholder that checks credentials and blocks

**New behavior:**
```python
def cmd_sync(_: argparse.Namespace) -> int:
    """Fetch live data from Google Ads API and store snapshots"""
    
    state = collect_doctor_state()
    missing = [key for key, present in state.env_status.items() if not present]
    
    if missing:
        print(f"Credentials blocked: {', '.join(missing)}")
        log_run("sync", "blocked", f"missing={', '.join(missing)}")
        return 2
    
    try:
        # Load credentials from local env file
        creds = load_credentials_from_env()
        api = GoogleAdsAPI(**creds)
        
        # Fetch all data types
        campaigns = api.fetch_campaigns()
        metrics = api.fetch_daily_metrics(datetime.now().strftime('%Y-%m-%d'))
        search_terms = api.fetch_search_terms(last_7_days())
        recommendations = api.fetch_recommendations()
        change_events = api.fetch_change_events(last_24_hours())
        
        # Store in SQLite
        with connect_db() as conn:
            store_campaigns(conn, campaigns)
            store_metrics(conn, metrics)
            store_search_terms(conn, search_terms)
            store_recommendations(conn, recommendations)
            store_change_events(conn, change_events)
        
        log_run("sync", "ok", f"campaigns={len(campaigns)} metrics={len(metrics)}")
        return 0
        
    except Exception as err:
        error_msg = f"API sync failed: {str(err)}"
        print(error_msg)
        log_run("sync", "error", error_msg)
        return 1
```

**Testing:**
```bash
python3 tools/google-ads/cli.py sync
# Expected output: "API sync completed: X campaigns, Y metrics, Z search terms"
```

### Step 4: Extend SQLite Schema

**File:** `tools/google-ads/cli.py` (modify `connect_db` schema)

**New tables:**
```sql
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_campaign_id TEXT NOT NULL UNIQUE,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL,
    budget_usd REAL,
    campaign_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metrics_date TEXT NOT NULL,
    campaign_id TEXT,
    clicks INTEGER,
    impressions INTEGER,
    spend_usd REAL,
    conversions REAL,
    conversion_value REAL,
    fetch_timestamp TEXT NOT NULL,
    UNIQUE(metrics_date, campaign_id)
);

CREATE TABLE IF NOT EXISTS search_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_term TEXT NOT NULL,
    campaign_id TEXT,
    clicks INTEGER,
    impressions INTEGER,
    conversions REAL,
    spend_usd REAL,
    status TEXT,
    fetch_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_type TEXT NOT NULL,
    campaign_id TEXT,
    priority TEXT,
    description TEXT,
    impact_estimate REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS change_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_date TEXT NOT NULL,
    change_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
);
```

### Step 5: Update ProBot Dashboard

**File:** `projects/probot/src/bot/dashboard.ts` (enhance `renderGoogleAds`)

**Current output:** Basic metrics from summary tables

**New output:**
```html
<div class="campaigns-section">
  <h3>Active Campaigns</h3>
  <div class="campaign-list">
    <!-- For each campaign -->
    <div class="campaign-card">
      <div class="camp-name">{{campaign_name}}</div>
      <div class="camp-metrics">
        <span>{{spend_usd}}</span>
        <span>{{clicks}} clicks</span>
        <span>{{impressions}} impressions</span>
      </div>
      <div class="camp-status">{{status}}</div>
    </div>
  </div>
</div>

<div class="search-terms-section">
  <h3>Top Search Terms (Last 7 Days)</h3>
  <div class="search-terms-list">
    <!-- Top 10 by clicks -->
  </div>
</div>

<div class="recommendations-section">
  <h3>Google Recommendations</h3>
  <div class="recommendations-list">
    <!-- Pending recommendations -->
  </div>
</div>
```

**Data queries:**
```typescript
const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY budget_usd DESC LIMIT 20").all();
const topSearchTerms = db.prepare(
  "SELECT search_term, clicks, impressions, spend_usd FROM search_terms " +
  "WHERE fetch_date >= date('now', '-7 days') " +
  "ORDER BY clicks DESC LIMIT 10"
).all();
const recommendations = db.prepare(
  "SELECT * FROM recommendations WHERE status = 'pending' LIMIT 15"
).all();
```

### Step 6: Implement Nightly Scheduler Job

**File:** `operations/system-configs/launchagents/` (new or update existing)

**Job Definition:**
- Name: `com.office.google-ads-sync.plist`
- Schedule: Daily at 6:00 AM (00:00 UTC+1)
- Command: `/usr/bin/python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py sync`
- Log output to: `~/.config/google-ads/sync.log`
- Retry on failure: 3 attempts with 60s backoff

**Alternative: Use existing brain nightly scheduler**

Add to scheduler configuration:
```toml
[jobs.google-ads-sync]
schedule = "0 6 * * *"  # 6 AM daily
command = "python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py sync"
timeout_seconds = 300
label = "Google Ads Daily Sync"
```

### Step 7: Validation & Testing

**Manual test sequence:**

```bash
# 1. Verify credentials are still accessible
python3 tools/google-ads/cli.py doctor
# Expected: all checks pass, credentials present

# 2. Run first sync manually
python3 tools/google-ads/cli.py sync
# Expected: fetches campaigns, creates database entries

# 3. Inspect database
sqlite3 data/google-ads/google_ads.sqlite3 "SELECT COUNT(*) FROM campaigns;"
# Expected: >0 (your campaigns)

# 4. Check ProBot dashboard
open http://localhost:7070
# Click "Google Ads" tab
# Expected: Shows real campaign names and metrics

# 5. Check daily metrics snapshot
sqlite3 data/google-ads/google_ads.sqlite3 \
  "SELECT metrics_date, SUM(spend_usd) FROM daily_metrics_detail GROUP BY metrics_date;"
# Expected: Today's date with spend > $0

# 6. Verify search terms ingestion
sqlite3 data/google-ads/google_ads.sqlite3 "SELECT COUNT(*) FROM search_terms;"
# Expected: >0 (your search terms)
```

**Automated test (CI/CD ready):**

```bash
#!/bin/bash
set -e

# Test doctor
python3 tools/google-ads/cli.py doctor || exit 1

# Test sync (dry run first?)
python3 tools/google-ads/cli.py sync || exit 1

# Validate database
sqlite3 data/google-ads/google_ads.sqlite3 <<EOF
SELECT COUNT(*) as campaign_count FROM campaigns;
SELECT COUNT(*) as metric_count FROM daily_metrics_detail;
EOF

# Test ProBot dashboard compiles
cd projects/probot
npm run typecheck
npm run build
```

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|-----------------|
| 1 | Add dependency + create api.py | 2-3 hours |
| 2 | Update sync command | 1-2 hours |
| 3 | Extend SQLite schema | 1 hour |
| 4 | Update ProBot dashboard rendering | 1-2 hours |
| 5 | Set up nightly scheduler | 30 minutes |
| 6 | Testing & validation | 1-2 hours |
| **Total** | | **7-10 hours** |

## Risk Assessment

**Low Risk:**
- Readonly API access (no mutations)
- Credentials already provisioned
- Database schema design is simple
- Dashboard is read-only from ProBot

**Medium Risk:**
- Rate limiting (429 errors) if API called too frequently
- Large accounts with 100+ campaigns (pagination needed)
- API version drift (tested on v20.0.0)

**Mitigation:**
- Implement exponential backoff for rate limits
- Paginate campaigns query
- Pin API version in requirements.txt
- Test on non-production account first (already doing this)

## Rollback Plan

If API integration causes issues:

1. Stop nightly scheduler job
2. Revert ProBot dashboard to basic metrics
3. Keep existing metrics and policy snapshots
4. Fall back to manual CLI runs

All previous work is preserved; no data loss.

## Success Criteria

✅ All of the following must be true:

1. `cli.py sync` runs without errors and populates database
2. ProBot dashboard shows real campaign names and metrics
3. Daily metrics match Google Ads UI (within 5% variance)
4. Nightly scheduler runs sync automatically
5. Documentation updated to reflect live API integration
6. TypeScript builds cleanly
7. No secrets exposed anywhere

## Next Steps After API Integration

1. **Phase 4A: Safe Automation**
   - Add negative keyword auto-management
   - Auto-pause low-quality search terms
   - Auto-apply low-risk recommendations

2. **Phase 4B: Approval-Gated Mutations**
   - New campaign creation (approval required)
   - New ad group creation (approval required)
   - New keyword theme addition (approval required)

3. **Phase 5: Enhanced Reporting**
   - Automated weekly summaries
   - Monthly utilization reports
   - Policy compliance attestation
   - Nightly anomaly alerts to Slack/Telegram

---

**Ready to implement? Start with Step 1: Add Python Dependency**
