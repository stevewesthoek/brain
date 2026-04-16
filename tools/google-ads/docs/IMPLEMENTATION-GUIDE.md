# Google Ads Automation: Implementation Guide

## Complete Status Summary (as of 2026-04-11)

### ✅ Phase 1: Foundation & Account Setup — COMPLETE

**GCP Identity & Config**
- Added `steve@yeshua.academy` to gcloud as third account
- Created dedicated config: `google-ads-nonprofit`
- Mapped configurations clearly documented in `ACCOUNTS.md`

**Account Structure Resolved**
- Client account: `592-920-2435` (Vila Solidária) — nonprofit ad-serving
- Customer-owned manager: `935-769-8503` (Yeshua Academy Google Ads Manager) — **linked to client**
- Upstream manager: `715-717-3541` (Ad Grants Netherlands) — Google-managed

**Google Ads API Credentials**
- Developer token: **obtained** (Explorer access level)
- OAuth 2.0 client: **created** in Google Cloud Console
- ADC (refresh token): **generated** with adwords scope
- All secrets stored locally only: `~/.config/google-ads/`

### ✅ Phase 2: AI-Agnostic CLI Scaffold — COMPLETE

**Directory Structure**
```
brain/
├── tools/google-ads/
│   └── cli.py (421 lines) — AI-agnostic CLI
├── config/google-ads/
│   ├── account.toml — account boundaries & credential status
│   ├── goals.toml — $10k budget, daily pacing targets
│   ├── rules.toml — automation guardrails (safe mode default)
│   └── sources.toml — 9+ official Google documentation sources
├── data/google-ads/
│   └── google_ads.sqlite3 — metrics, policy snapshots, runs
├── docs/google-ads/
│   ├── README.md — project overview
│   ├── ARCHITECTURE.md — system design
│   ├── ACCOUNTS.md — **CRITICAL account rules**
│   ├── RUNBOOK.md — operator workflow
│   ├── COMPLIANCE.md — Ad Grants compliance model
│   └── PROBOT-DASHBOARD.md — dashboard integration
└── ai/skills/custom/google-ads/
    └── SKILL.md — shared AI-agnostic skill interface
```

**CLI Commands (All Working)**
```bash
python3 tools/google-ads/cli.py doctor        # ✅ validates account/config boundary
python3 tools/google-ads/cli.py policy-watch  # ✅ monitors 9+ official Google sources
python3 tools/google-ads/cli.py pace          # ✅ calculates daily pacing vs $10k budget
python3 tools/google-ads/cli.py report        # ✅ generates status markdown
python3 tools/google-ads/cli.py sync          # ⏳ placeholder (awaits API integration)
```

**SQLite Database**
- Tables: `runs`, `metrics_snapshots`, `policy_snapshots`
- Policy watch stores hashes of official sources + change detection
- Pacing calculation reads from metrics table
- Run history for audit trail

### ✅ Phase 3: ProBot Dashboard Integration — COMPLETE

**New Dashboard Tab: "Google Ads"**
- Location: Between Analytics (Umami) and Domains tabs
- Real-time display of nonprofit grant metrics
- Auto-refresh every 30 seconds
- Color-coded pacing indicator (red/amber/green)

**Displayed Metrics**
- Daily spend (USD) vs. daily target ($329)
- Percentage of target progress
- Day of month and month completion %
- Policy watch status (sources checked, changes detected)
- System health (doctor check status)
- Canonical account footer (account IDs, manager, budget)

**Implementation Details**
- New function: `getGoogleAdsMetrics()` (uses better-sqlite3)
- New function: `renderGoogleAds(data)` (HTML/CSS rendering)
- Updated `getDashboardData()` to include Google Ads
- HTML tab button and panel added to navigation
- Fully typed with TypeScript
- Compiles cleanly with no errors

**Source Code**
- `projects/probot/src/bot/dashboard.ts` — main implementation
- `projects/probot/dist/bot/dashboard.js` — compiled output (64KB)

### ✅ Phase 4: Documentation — COMPLETE

**Google Ads Module Docs**
- `PROBOT-DASHBOARD.md` — 120+ lines covering all dashboard features
- Updated `README.md` to reference dashboard integration
- `ACCOUNTS.md` — detailed account boundary rules (CRITICAL)
- `ARCHITECTURE.md` — system design and control plane
- `RUNBOOK.md` — complete operator workflow
- `COMPLIANCE.md` — Ad Grants compliance model
- `SKILL.md` — AI-agnostic skill interface

**Credentials Documentation**
- `operations/accounts/credentials-index.md` — all 6 secrets mapped with rotation info
- Local-only storage documented and enforced
- Never committed to git

**Skill Integration**
- Added to `CLAUDE.md` available skills
- Added to `AGENTS.md` (Codex config)
- Added to `GEMINI.md` (Gemini config)

### ✅ Phase 5: Commits & Version Control — COMPLETE

**Commit 1: Credentials Index**
```
docs: add Google Ads credentials to credentials index
```
- Added credential inventory for all 6 secrets
- Documented rotation and regeneration paths

**Commit 2: ProBot Dashboard Integration**
```
feat: add Google Ads tab to ProBot dashboard
```
- Implemented dashboard tab with full metrics
- Added SQL queries for data retrieval
- Added TypeScript types and rendering logic
- All documentation updated

---

## Current State

### ✅ Ready Now
- [x] Account setup complete with explicit boundaries
- [x] API credentials obtained (developer token + OAuth)
- [x] SQLite database created with schema
- [x] CLI scaffold with 4 working commands + 1 placeholder
- [x] ProBot dashboard tab fully integrated
- [x] All documentation complete and versioned
- [x] TypeScript builds cleanly
- [x] All changes committed to main

### ⏳ Next Phase (Not Yet Started)

**Live Google Ads API Integration**
- Install Python Google Ads client library
- Implement read-only connectivity test
- Upgrade `sync` command from placeholder to live API ingestion
- Ingest real account structure and metrics
- Update ProBot dashboard with live campaign data

**Expected Implementation Order**
1. Add `google-ads` Python package to tools requirements
2. Create `tools/google-ads/api.py` — Google Ads API wrapper
3. Implement `sync()` command to fetch:
   - Campaign list and status
   - Daily spend and metrics
   - Search terms and performance
   - Recommendations from Google
4. Store all data in SQLite with timestamps
5. Update `renderGoogleAds()` to show real campaign details
6. Add campaign-level pacing and health checks

---

## Critical Rules (Never Break These)

1. **Account Boundary:**
   - ONLY use `steve@yeshua.academy` for Google Ads work
   - ONLY use `google-ads-nonprofit` gcloud config
   - Do not use `westhoek@hotmail.com` or `info@prochat.tools`

2. **Credential Storage:**
   - Developer token: `~/.config/google-ads/brain-google-ads.env`
   - OAuth client JSON: `~/.config/google-ads/yeshua-google-ads-oauth.json`
   - ADC refresh token: `~/.config/gcloud/application_default_credentials.json`
   - NEVER commit any of these to git

3. **Database Path:**
   - Always: `data/google-ads/google_ads.sqlite3` in the repo root
   - Never move or rename this path without updating all references

4. **CLI Interface:**
   - Always from repo root: `python3 tools/google-ads/cli.py [command]`
   - Supported commands: `doctor`, `sync`, `pace`, `report`, `policy-watch`
   - Output is deterministic and loggable

5. **Dashboard Access:**
   - ProBot reads from SQLite; do not modify database directly
   - Dashboard refreshes every 30 seconds
   - All metrics are read-only from ProBot perspective

---

## How to Verify Everything Works

### Local CLI Test
```bash
cd ~/Repos/stevewesthoek/brain

# Verify account boundary
gcloud config configurations list
# Should show: google-ads-nonprofit (active) → steve@yeshua.academy

# Test doctor command
python3 tools/google-ads/cli.py doctor
# Expected: all checks pass

# Test policy monitoring
python3 tools/google-ads/cli.py policy-watch
# Expected: checks 9+ sources, stores snapshots

# Test pacing
python3 tools/google-ads/cli.py pace
# Expected: shows month progression and target delta

# Generate report
python3 tools/google-ads/cli.py report
# Expected: writes to reports/google-ads/YYYY-MM-DD-status.md
```

### ProBot Dashboard Test
```bash
# Ensure ProBot is running (usually on port 7070)
open http://localhost:7070

# Click "Google Ads" tab
# Should show:
# - Daily spend vs target
# - Policy sources status
# - Account information
# - No errors
```

### TypeScript Build Test
```bash
cd projects/probot
npm run typecheck  # Should have zero errors
npm run build      # Should complete successfully
```

---

## Roadmap to Live API Integration

### Week 1: API Client Setup
- [ ] Install `google-ads` Python package
- [ ] Create `api.py` wrapper with authentication
- [ ] Implement `sync()` command to fetch campaign list
- [ ] Test read-only access to client account (592-920-2435)

### Week 2: Data Ingestion
- [ ] Pull daily metrics from Google Ads API
- [ ] Store in SQLite with timestamps
- [ ] Implement search term harvesting
- [ ] Implement recommendation retrieval

### Week 3: Dashboard Enhancement
- [ ] Update `renderGoogleAds()` to show:
  - Campaign names and status
  - Daily spend by campaign
  - Search term quality scores
  - Recommendation count and types
- [ ] Add campaign detail view

### Week 4: Automation Layer (Phase 2)
- [ ] Add low-risk auto-apply rules (negatives, labels)
- [ ] Add approval-gated mutations (new campaigns, keywords)
- [ ] Implement nightly scheduler job for daily sync
- [ ] Add Slack alerts for pacing anomalies

---

## AI-Agnostic Design Principles

**All three engines (Claude, Codex, Gemini) use the SAME:**
- CLI commands in `tools/google-ads/cli.py`
- Config files in `config/google-ads/`
- SQLite database in `data/google-ads/`
- Documentation in `docs/google-ads/`
- ProBot dashboard metrics

**No shadow dashboards, no duplicate reporting, no conflicting state.**

Each engine can:
- Read metrics from the shared database
- Call the CLI to trigger operations
- View reports in the same location
- Reference the same documentation

---

## Troubleshooting Matrix

| Symptom | Cause | Fix |
|---------|-------|-----|
| `doctor` fails account check | Active gcloud config is wrong | `gcloud config configurations activate google-ads-nonprofit` |
| Database not found | Google Ads scaffold never run | Run `python3 tools/google-ads/cli.py doctor` first |
| ProBot tab shows "no_data" | Database exists but is empty | Run `cli.py policy-watch` to initialize |
| ProBot tab shows error | SQLite read failed | Check file permissions: `ls -la data/google-ads/` |
| Credentials missing from doctor | Secrets not in local env files | Regenerate via gcloud or check file paths |

---

## Commit History (This Session)

```
6db8d80 docs: add Google Ads credentials to credentials index
3949b14 feat: add Google Ads tab to ProBot dashboard
```

---

**Status: READY FOR PHASE 3 (Live API Integration)**

All foundation work complete. Database, CLI, dashboard, and documentation are in place and working. Next step is to wire the Google Ads API client library and populate the database with real data.
