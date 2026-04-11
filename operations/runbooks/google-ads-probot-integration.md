# Google Ads Integration with ProBot Dashboard

**Status:** ✅ Complete  
**Dashboard Location:** ProBot web UI → "Google Ads" tab  
**Components:** Phase 4A (core pipeline) through Phase 4I (ML scoring)  

---

## Overview

The Google Ads automation system is fully integrated into the ProBot dashboard as a dedicated tab. The dashboard displays:

- **Account Status** — Nielsen Ads account (Vila Solidária 592-920-2435)
- **Current Pacing** — Monthly spend vs budget (80-120% healthy range indicator)
- **Recent Metrics** — Conversions, CPA, CTR, spend from the latest sync
- **Pending Mutations** — Count of mutations awaiting approval
- **Sync Status** — Last sync timestamp and freshness indicator

---

## Dashboard Data Sources

### Metrics Display

The dashboard queries two SQLite databases for real-time data:

**Primary database:** `data/google-ads/google_ads.sqlite3`

**Tables read:**
- `daily_metrics_detail` — Campaign-level metrics by date (account rollup: `campaign_id IS NULL`)
- `pending_mutations` — Mutation queue (status filtering)
- `change_events` — Audit trail (sync history)

**Data refreshed:** On each dashboard page load, queries are executed to fetch latest data.

### Tab Button Badge

**Pending Mutations Badge** — Shows count of pending mutations needing approval
```
Example: "Google Ads [3]" if 3 mutations are awaiting approval
```

---

## Starting ProBot Dashboard

### Development Mode (Testing)

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot

# Install dependencies (if needed)
npm install

# Run development mode with hot reload
npm run dev
```

**Access at:** `http://localhost:7070`

### Production Mode (Recommended)

```bash
# Build TypeScript
npm run build

# Start the daemon
npm start
```

**Access at:** `http://localhost:7070`

### LaunchD Agent (Background Service)

For persistent daemon running at system startup:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot

# Install the launchd agent
./scripts/install-launchd.sh

# Verify installation
launchctl list | grep probot

# View daemon logs
launchctl log stream --level debug --predicate 'process == "probot"'
```

---

## Restarting ProBot

### Quick Restart (Development)

If ProBot is running in dev mode (`npm run dev`):

```bash
# Kill the process
pkill -f "tsx watch src/index.ts"

# Restart
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot
npm run dev
```

### Full Restart (Production)

```bash
# Stop the daemon
launchctl stop com.office.probot

# Clear any stale processes
pkill -f "node dist/index.js" || true

# Start the daemon
launchctl start com.office.probot

# Verify it's running
sleep 2 && curl -s http://localhost:7070 > /dev/null && echo "✅ ProBot is running" || echo "❌ ProBot failed to start"
```

### Check Current Status

```bash
# Is ProBot running?
lsof -i :7070

# View recent logs
tail -f /tmp/probot.log

# Check launchd status
launchctl list com.office.probot
```

---

## Google Ads Tab Features

### Current Pacing Display

Shows current month's spend against budget:

```
Current Month: $4,250 / $10,000 (42.5%)
Status: 🟢 GREEN (within 80-120% healthy range)
```

**Color codes:**
- 🟢 **GREEN** — 80-120% healthy pacing
- 🟡 **YELLOW** — 70-80% or 120-130% pace (alert, may need adjustment)
- 🔴 **RED** — <70% or >130% pace (urgent, action required)

### Pending Mutations Badge

The tab button shows a badge with the count of pending mutations:

```
Google Ads [5]  ← 5 mutations awaiting approval
```

**Click the tab to see:**
- List of pending mutations
- Their risk level (low/medium/high/urgent)
- Estimated impact
- Approve/reject buttons
- Full audit trail

### Recent Metrics

Displays the latest synced metrics:

```
Last Sync: 2 hours ago ✓
Conversions: 24 (this week)
CPA: $12.50
CTR: 4.2%
Spend: $850 (this week)
```

### Sync Status

Shows when the last sync completed:

- ✓ **Fresh** — synced within last 6 hours
- ⚠️ **Stale** — synced 6-24 hours ago
- ❌ **Old** — synced >24 hours ago

---

## Integration Points

### Phase 4A: Core Pipeline
- Mutation queue visible in tab
- Pending mutations count in badge
- Audit trail display (change_events)

### Phase 4B: Recommendations
- Queued recommendations shown in detail view
- Status progression (pending → approved → applied)

### Phase 4C: Production Safety
- Dry-run status indicated
- Approval gates shown in mutation details
- Compliance validation results displayed

### Phase 4D: Notifications
- Risk score visualization (color badges)
- Escalation indicator for high-risk mutations

### Phase 4E-4I: Advanced Features (Ready for Deployment)
- Once deployed, dashboard will update to show:
  - Analytics insights (effectiveness by type)
  - Rollback decisions (monitored mutations)
  - ML scoring confidence
  - Cost optimization suggestions

---

## Troubleshooting

### Google Ads Tab Not Showing

**Issue:** Tab button visible but no data, or tab doesn't appear at all

**Solution:**

1. **Check database exists:**
   ```bash
   ls -la data/google-ads/google_ads.sqlite3
   ```
   If not found, run: `bash tools/google-ads/run.sh sync`

2. **Verify database is readable:**
   ```bash
   sqlite3 data/google-ads/google_ads.sqlite3 "SELECT COUNT(*) FROM pending_mutations;"
   ```

3. **Restart ProBot:**
   ```bash
   pkill -f "tsx watch" && cd projects/probot && npm run dev
   ```

4. **Check ProBot logs:**
   ```bash
   tail -100 /tmp/probot.log | grep -i "google\|ads\|error"
   ```

### Pending Mutations Badge Not Updating

**Issue:** Badge shows count but doesn't update after mutations change

**Solution:**

1. Refresh the browser page (Cmd+R)
2. Clear browser cache (Cmd+Shift+Delete)
3. Restart ProBot: `launchctl stop com.office.probot && launchctl start com.office.probot`

### Metrics Show "No Data"

**Issue:** Tab shows error or no metrics data

**Solution:**

1. **Run sync to populate database:**
   ```bash
   bash tools/google-ads/run.sh sync
   ```

2. **Verify data in database:**
   ```bash
   sqlite3 data/google-ads/google_ads.sqlite3 << EOF
   SELECT metrics_date, campaign_id, spend_usd FROM daily_metrics_detail LIMIT 5;
   EOF
   ```

3. **Check if database path is correct** — verify ProBot is looking at the right path:
   ```bash
   grep -n "google_ads.sqlite3" projects/probot/src/bot/dashboard.ts
   ```

---

## Configuration

### Dashboard Settings

Location: `projects/probot/src/bot/dashboard.ts`

**Google Ads section:** Lines 652-800 (helpers and rendering)

Key configuration:

```typescript
// Database path (line 676)
const googleAdsDbPath = path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "data", "google-ads", "google_ads.sqlite3");

// Account info (line 1266)
const ACCOUNT_ID = "592-920-2435";
const ACCOUNT_NAME = "Vila Solidária";
```

### Customizing Tab Display

To modify what's shown in the Google Ads tab:

1. Edit `projects/probot/src/bot/dashboard.ts`
2. Update the `renderGoogleAds()` function (around line 1237)
3. Add/remove fields as needed
4. Recompile: `npm run build`
5. Restart: `npm run start`

---

## Data Flow

```
Google Ads API
    ↓
tools/google-ads/run.sh sync
    ↓
data/google-ads/google_ads.sqlite3
    ├─ daily_metrics_detail (← account-level metrics)
    ├─ pending_mutations (← mutation queue)
    └─ change_events (← audit trail)
    ↓
ProBot Dashboard (HTTP server)
    ├─ Load database on page render
    ├─ Query latest metrics
    ├─ Count pending mutations
    └─ Display in "Google Ads" tab
    ↓
Browser (http://localhost:7070)
    └─ Render tab with metrics and mutation list
```

---

## Next Steps

### Immediate
1. ✅ Restart ProBot daemon to load updated dashboard code
2. ✅ Navigate to Google Ads tab in dashboard
3. ✅ Verify metrics display correctly

### Week +1 (Phase 4E Deployment)
- HTTP server for n8n webhooks will be deployed separately
- Dashboard will sync with live mutation approvals via HTTP callbacks

### Week +2 (Phase 4F Deployment)
- Dashboard will add batch operations UI
- Real-time WebSocket updates for mutation status changes

### Week +3+ (Phase 4G-4I)
- Analytics tab showing effectiveness patterns
- Rollback decision history
- ML confidence scores

---

## Support

### ProBot Restart Commands

```bash
# Quick restart (dev mode)
pkill -f "tsx watch src/index.ts" && cd /Users/Office/Repos/stevewesthoek/brain/projects/probot && npm run dev

# Full restart (production)
launchctl stop com.office.probot && launchctl start com.office.probot

# Force kill and restart
pkill -9 -f probot ; sleep 1 ; launchctl start com.office.probot
```

### View Dashboard Logs

```bash
# Stream logs
tail -f /tmp/probot.log

# Search for errors
grep -i "error\|google\|ads" /tmp/probot.log | tail -20
```

### Verify Google Ads Data

```bash
# Count mutations by status
sqlite3 data/google-ads/google_ads.sqlite3 "SELECT status, COUNT(*) FROM pending_mutations GROUP BY status;"

# Check latest metrics
sqlite3 data/google-ads/google_ads.sqlite3 "SELECT metrics_date, SUM(spend_usd) FROM daily_metrics_detail WHERE campaign_id IS NULL GROUP BY metrics_date ORDER BY metrics_date DESC LIMIT 5;"

# View recent changes
sqlite3 data/google-ads/google_ads.sqlite3 "SELECT change_date, change_type, COUNT(*) FROM change_events GROUP BY change_date, change_type ORDER BY change_date DESC LIMIT 10;"
```

---

## Related Documentation

- `PHASE-4-IMPLEMENTATION-SUMMARY.md` — All phases overview
- `google-ads-phase-4-complete.md` — Master summary with architecture
- `google-ads-phase-4e.md` — n8n workflow automation (deployment next)
- `google-ads-phase-4f.md` — Web dashboard advanced features (Phase 4F)
- `projects/probot/README.md` — ProBot daemon documentation
- `projects/probot/SPEC.md` — ProBot API specification

---

**Last Updated:** 2026-04-11  
**Status:** ✅ Google Ads integration complete and ready for deployment
