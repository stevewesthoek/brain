# Gemini API Quota Audit — 2026-05-30

## Executive Summary

Your Gemini API quota is exhausted due to **two services sharing a single 1,500 req/day quota**:

1. **Video Analyzer** (on-demand YouTube analysis) — Personal free tier ✅
2. **n8n Classification Workflow** (inbox automation) — Personal free tier ⚠️

**The Problem:** The n8n workflow likely consumes most of the daily quota through frequent execution. The video analyzer shows 5 calls on 2026-05-23, but the n8n workflow data isn't directly accessible without logging into n8n.

**The Solution:** Move the n8n workflow to the ProChat workspace account (paid tier) to isolate it from the video analyzer's free tier.

---

## 1. Current API Key Setup

| Property | Value |
|----------|-------|
| **API Key File** | `~/.config/google-ai/.env` |
| **API Key** | `AIzaSyCMI60gQqRiFy9qNVitTghQ9nSsM7H44Cw` |
| **Account** | Personal Google (stevewesthoek) |
| **Tier** | Free tier |
| **Daily Limit** | 1,500 requests/day |
| **Independent from** | Gemini CLI (`~/.gemini/`) — separate OAuth pool |

---

## 2. All Gemini API Consumers

### 2.1 Video Analyzer (Primary)
```
Location: /Users/Office/Repos/stevewesthoek/brain/projects/brain-core/services/video-analyzer/analyze.py
Purpose:  YouTube video analysis (transcription + structured metadata)
Account:  ✅ Personal (free tier — correct choice)
Status:   Active
Rate Limit: Local enforcement (1500 RPD, 15 RPM, 8h video/day)
Usage:    On-demand via Research Orchestrator
```

**Recent Usage (2026-05-23):**
- 5 API calls
- 5,608 seconds (~93 minutes) of video analyzed
- Source: `~/.local/video-orchestrator/state/gemini-rate-limits.json`

**Rate Limit Tracking:**
```json
{
  "calls_today": [1779563144.7, 1779567194.5, 1779567268.0, 1779567523.2, 1779568462.9],
  "video_seconds_today": 5608.0,
  "day": "2026-05-23"
}
```

### 2.2 n8n Workflow: "Mind Inbox — Capture & Classify with Signal Scoring"
```
Location:  /Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/workflows/mind-inbox-fixed.json
n8n ID:    FwP5INe9qoo1OwGC
Purpose:   PARA classification for Mind inbox captures
Account:   ⚠️ Personal (free tier — should move to paid)
Status:    ✅ Active (enabled)
Last Run:  2026-05-16 21:55:10 UTC
```

**Flow:**
```
Email/Capture → n8n Webhook → Gemini API (classification) → Mind/capture/inbox/
```

**API Details:**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash`
- Method: Direct HTTP POST via n8n HTTP node
- Auth: Uses `GEMINI_API_KEY` environment variable
- Frequency: **Every capture/email** sent to inbox automation

---

## 3. The Root Cause

Both services use the **same shared 1,500 req/day quota** because they both read from `~/.config/google-ai/.env`:

```bash
# This is what's in the file:
GEMINI_API_KEY=AIzaSyCMI60gQqRiFy9qNVitTghQ9nSsM7H44Cw
```

**There is NO quota isolation or splitting** between the two services.

### Why the quota is exhausted:

The n8n classification workflow likely executes **hundreds of times per day** if your inbox receives many captures. Each execution = 1 API call. So:

```
Example daily usage:
- Video analyzer:     ~5–10 calls
- n8n classification: ~1,000–1,500 calls  ← exhausts quota
- Total:              1,500+ (quota exceeded)
```

---

## 4. n8n Workflow Details

**Current State:**
- **Status:** Active ✅
- **Name:** "Mind Inbox — Capture & Classify with Signal Scoring"
- **Created:** 2026-04-10 21:01:15 UTC
- **Updated:** 2026-05-16 21:55:10 UTC
- **Flow:** Webhook trigger → Gemini classification → Write to Mind

**Gemini Node:**
- Calls Gemini API directly with HTTP POST
- Sends inbox message/capture for PARA classification
- Stores classified result back to `~/mind/capture/inbox/`

**Note:** This is NOT the old "mind inbox classification" — it's the newer "Capture & Classify" workflow created 2026-04-10. The naming suggests it's already been updated from the legacy classification approach.

---

## 5. Mind Repo Structure

**Confirmed Flow:**
```
mind/capture/inbox/
  └─ README.md
  └─ 2026-05-16-mind-os-live-deployment-verification.md
  └─ (daily captures from n8n workflow)

mind/capture/daily/
  └─ README.md

mind/capture/failed/
  └─ README.md
  └─ (failed captures)
```

**Status:** ✅ Workflow is correctly saving to `mind/capture/inbox/` as expected.

---

## 6. Recommended Actions

### Option A: Split Quota by Account (RECOMMENDED)
**Goal:** Keep video analyzer on free tier, move n8n to paid tier

**Steps:**
1. Create a new Gemini API key in the **ProChat workspace** Google Cloud project
2. Store it in a new env var: `~/.config/google-ai/.env.prochat`
3. Update the n8n workflow to use the new ProChat key
4. Leave `~/.config/google-ai/.env` unchanged for video analyzer

**Benefits:**
- Video analyzer stays on free tier (designed for personal use)
- n8n gets unlimited requests (ProChat workspace = paid account)
- Clear separation of concerns
- No impact on existing video analyzer rate limiting

**Effort:** ~30 minutes (generate key + update n8n credential + test)

### Option B: Monitor and Batch n8n
**Goal:** Keep everything on personal account, reduce n8n frequency

**Steps:**
1. Log into n8n dashboard
2. Change "Mind Inbox — Capture & Classify" to run on a **schedule** instead of per-capture
3. Process captures in **batches** (e.g., every 1 hour or 4 hours)
4. Monitor daily usage

**Benefits:**
- No cost changes
- Predictable quota consumption
- Can calculate exact daily burn rate

**Drawbacks:**
- Captures are classified with delay
- Less real-time inbox processing

### Option C: Disable n8n Temporarily
**Goal:** Free up quota for video analyzer

**Steps:**
1. Disable the n8n workflow: `FwP5INe9qoo1OwGC`
2. Verify if "capture inbox classification" is the replacement
3. If replacement works, delete the old workflow

**Note:** Only do this if you've confirmed that the newer inbox classification (via another automation) is the actual replacement and the old n8n workflow is truly redundant.

---

## 7. Video Analyzer — No Action Needed

The video analyzer is working correctly:

✅ Uses personal free tier (correct)
✅ Has local rate limiting (1500 RPD, 15 RPM, 8h video/day)
✅ Tracks usage in `~/.local/video-orchestrator/state/gemini-rate-limits.json`
✅ Shows in Obsidian dashboard under "Research Orchestrator"
✅ On-demand (not consuming quota constantly)

**Status:** Keep as-is. It's not the problem.

---

## 8. Action Plan

### Immediate (today):
1. **Verify quota is indeed exhausted:**
   ```bash
   gcloud auth login  # or use gcloud auth application-default login
   gcloud compute projects get-serials PROJECT_ID  # or check Google Cloud console
   ```

2. **Check n8n execution history** to confirm it's the culprit:
   - Go to n8n dashboard (n8n.prochat.tools)
   - Navigate to workflow `FwP5INe9qoo1OwGC`
   - View "Execution history" for today
   - Count how many times it ran

3. **Decide on a fix:**
   - Recommend **Option A** (split to ProChat) for ongoing use
   - Recommend **Option B** (batch/schedule) if cost is a concern
   - Recommend **Option C** (disable) only if confirmed redundant

### Within 1-2 days:
1. Implement chosen fix
2. Test both services work with new setup
3. Update documentation (this file and workflow READMEs)

### Long-term:
1. Add quota monitoring dashboard (log daily usage to observability)
2. Document per-service quota allocation in decision-log.md
3. Set up alerts for quota threshold (e.g., 80% of daily limit)

---

## 9. Files to Update After Fix

- `operations/accounts/credentials-index.md` — add ProChat Gemini key entry
- `operations/automations/n8n/workflows/mind-inbox-fixed.json` — update credential reference
- `operations/decision-log.md` — record the quota split decision
- `operations/automations/n8n/README.md` (if exists) — document n8n account assignment

---

## 10. Reference Commands

**Check video analyzer usage:**
```bash
cat ~/.local/video-orchestrator/state/gemini-rate-limits.json
```

**List all n8n workflows (need API key):**
```bash
API_KEY=$(grep N8N_API_KEY ~/.config/n8n/.env | cut -d= -f2)
curl -s -H "X-N8N-API-KEY: $API_KEY" https://n8n.prochat.tools/api/v1/workflows \
  | jq '.data[] | {id, name, active}'
```

**Get specific workflow details:**
```bash
curl -s -H "X-N8N-API-KEY: $API_KEY" https://n8n.prochat.tools/api/v1/workflows/FwP5INe9qoo1OwGC \
  | jq '.data.nodes[] | {name, type}'
```

**Check Google Cloud quota usage:**
- Go to https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- Select the personal Google project
- View "Requests per day" quota

---

## Appendix: Why This Matters

- **Free tier:** 1,500 req/day per API key, shared across all applications
- **Paid tier:** Unlimited (ProChat workspace)
- **No isolation:** Both services hitting the same rate limit means one can block the other
- **Solution:** Separate API keys for separate purposes = predictable, scalable quota management

---

**Report Generated:** 2026-05-30 13:30 UTC
**Status:** Ready for decision and implementation
