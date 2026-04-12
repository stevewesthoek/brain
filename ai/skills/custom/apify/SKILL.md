---
name: apify
description: "Actor-based web scraping & data extraction. 10 accounts, $50/month total. Multi-account round-robin rotation via n8n webhook. Deduplication patterns (paginated slices, URL partitioning). AI-agnostic: Claude Code, Codex, Gemini. Budget: ~20-50 runs/month. For n8n: POST webhook, never Execute Command."
---

# /apify — Web Scraping & Data Extraction via Apify Actors

**AI-agnostic, production-ready web scraping system.** 10 accounts with automatic round-robin rotation and deduplication support. $50/month total budget shared across all three AI engines.

---

## Budget Constraint (First-Class)

- **Total monthly credit:** $50/month (10 accounts × $5 each, renewable 1st UTC)
- **Typical cost per run:** $0.025–$0.25 (50–500 compute units)
- **Monthly budget:** ~20–50 runs total across all accounts
- **Per-account:** ~2–5 runs per month

**This is a lean budget.** Every run counts. Test with small inputs (`maxRequestsPerCrawl: 10`) before full runs. Exhausting credits mid-month means waiting until the 1st.

---

## When to Use Apify

**Best for:**
- Targeted one-off scraping jobs (YouTube, LinkedIn, e-commerce listings)
- Scheduled competitor monitoring (price feeds, inventory tracking)
- Lead enrichment and data collection pipelines
- Comment/review aggregation (social listening)
- Proof-of-concept automation before building production infrastructure
- Integration with n8n workflows, Next.js apps, or internal tools

**Don't use for:**
- High-volume production scraping (use your own infrastructure)
- Building a business on expensive third-party Actors (you will blow through $50 fast)
- High-frequency monitoring (Apify charges per run; use periodic jobs instead)

---

## Multi-Account System: How It Works

You have **10 Apify free accounts** with automatic rotation:

| Account | Email | Status |
|---------|-------|--------|
| ProChat-1 to ProChat-10 | Various | ✅ Active |

### Rotation: Day-Based Index

Each day, a different account is "active":

- **Days 1, 11, 21 of month:** Account 1 (ProChat-1)
- **Days 2, 12, 22 of month:** Account 2 (ProChat-2)
- ... (pattern repeats)
- **Days 10, 20, 30 of month:** Account 10 (ProChat-10)

This is **deterministic** — two concurrent calls on the same day use the same account (safe). No state corruption, no race conditions.

### For n8n Workflows: Use the Credential Manager Webhook

**Never use Execute Command nodes** — they break in Docker (n8n on Dokploy).

Call the webhook:
```
POST https://n8n.prochat.tools/webhook/apify-next-token
Content-Type: application/json
Body:
{
  "caller_id": "my-workflow-name",
  "offset": 0,
  "items_per_account": 100
}
```

Response:
```json
{
  "token": "apify_api_...",
  "account_name": "ProChat-3",
  "account_index": 3,
  "pagination_offset": 0
}
```

The webhook handles all account rotation internally. Your workflow just gets a token + offset back.

### For CLI / Local Testing: Use `apify-multi`

```bash
# Get next token (advances rotation)
apify-multi next-token

# Check status (all 10 accounts)
apify-multi status

# Run an actor with automatic account rotation
apify-multi run apify/web-scraper --input-file input.json
```

---

## Deduplication Patterns: Prevent 10 Copies of the Same Data

**Problem:** If you run the same query on 10 accounts, you get 1,000 identical results (100 from each), not 1,000 unique results.

**Solution:** Use one of three deduplication patterns.

### Pattern A: Paginated Single-Actor-Run (Recommended for Search/Listing Actors)

**When to use:** Scraping search results, listing feeds, or any data that supports `offset` pagination.

**How it works:**
- Run one Apify actor once
- Account 1 fetches results `offset=0, limit=100`
- Account 2 fetches results `offset=100, limit=100`
- Account 3 fetches results `offset=200, limit=100`
- ... Account 10 fetches `offset=900, limit=100`

**Result:** 1,000 unique results, no duplicates, zero wasted API calls.

**n8n implementation:**
```
1. POST webhook → get token + pagination_offset
2. POST /acts/{actor}/runs with:
   {
     "startUrls": [{"url": "https://google.com/search?q=..."}],
     "maxRequestsPerCrawl": 100,
     "offset": {{pagination_offset}}    ← key to deduplication
   }
3. Poll until SUCCEEDED
4. GET /datasets/{id}/items?offset={{pagination_offset}}&limit=100
```

The webhook returns `pagination_offset: 0, 100, 200, ...` as requests cycle through accounts.

### Pattern B: Different URL Slices Per Account (For URL-List Actors)

**When to use:** You have a list of URLs to scrape (product pages, profiles, etc.).

**How it works:**
- Partition your URL list into 10 slices
- Account 1 → `[url1, url2, url3, url4, url5]`
- Account 2 → `[url6, url7, url8, url9, url10]`
- ... Account 10 → `[url91, ..., url100]`

**Result:** Each account gets a unique input set → unique output set → no duplicates.

**n8n implementation:**
```
1. Calculate which account is active: POST webhook
2. POST /acts/{actor}/runs with:
   {
     "startUrls": [
       {{urls.slice((account_index-1)*10, account_index*10)}}
     ]
   }
3. Poll + fetch results
```

### Pattern C: Post-Hoc Deduplication (Fallback)

**When to use:** You can't control input or output pagination. Last resort.

**How it works:**
- All 10 accounts run the same query independently
- Collect all results
- Deduplicate by URL, content hash, or unique ID before storing

**Cost:** Wasteful — you pay 10× compute units but only get 1×'s worth of unique data. Use only if A/B don't apply.

### Which Pattern to Use?

| Use Case | Pattern | Benefit |
|----------|---------|---------|
| Google search, YouTube, e-commerce listings | A | Paginated dataset |
| Product page scraping, lead enrichment | B | Partition input URLs |
| No pagination support | C | Post-hoc dedup |
| Single small job (<100 results) | None | Just use one account |

---

## n8n Integration: The Complete 4-Step Pattern

### Step 1: Get Token + Offset

```
HTTP POST https://n8n.prochat.tools/webhook/apify-next-token
Headers:
  Content-Type: application/json
Body:
{
  "caller_id": "{{$workflow.name}}",
  "offset": 0
}

Response (store as $json):
{
  "token": "apify_api_...",
  "account_name": "ProChat-3",
  "account_index": 3,
  "pagination_offset": 0
}
```

### Step 2: Start Apify Run

```
HTTP POST https://api.apify.com/v2/acts/{actor-id}/runs
Headers:
  Authorization: Bearer {{$json.token}}
  Content-Type: application/json
Body:
{
  "startUrls": [{"url": "https://example.com"}],
  "maxRequestsPerCrawl": 100
}

Response:
{
  "id": "run-12345",
  "datasetId": "dataset-abc123",
  "status": "RUNNING"
}
```

### Step 3: Poll Until Terminal State

```
Loop (max 60 retries × 5 seconds = 5 minutes):
  HTTP GET https://api.apify.com/v2/acts/{actor-id}/runs/{{run-id}}
  Headers: Authorization: Bearer {{$json.token}}
  
  Check: $json.status is one of:
    SUCCEEDED  — run complete, dataset ready
    FAILED     — actor threw error (check run logs)
    TIMED-OUT  — exceeded actor timeout (reduce scope)
    ABORTED    — manually stopped or 402 Payment Required (account depleted)
  
  Break if terminal state, else wait 5 seconds and retry
```

All terminal run states:
- `SUCCEEDED` — actor completed normally, dataset available
- `FAILED` — actor error (check logs for details)
- `TIMED-OUT` — actor exceeded timeout (too much data, reduce `maxRequestsPerCrawl`)
- `ABORTED` — user-cancelled OR account hit $0 limit (HTTP 402)
- `READY` — (initial state before RUNNING)
- `RUNNING` — (polling state, not terminal)

### Step 4: Fetch Results from Dataset

```
HTTP GET https://api.apify.com/v2/datasets/{{datasetId}}/items
Headers:
  Authorization: Bearer {{$json.token}}
Query Params:
  offset=0
  limit=100
  clean=true
  format=json

Response: JSON array of items

Dataset API Params Explained:
  offset    — Start from item N (0-based). Use {{pagination_offset}} from Step 1 for Pattern A.
  limit     — Max items to return (default: all). Use 100 for pagination.
  clean     — true = filter empty items (recommended)
  format    — json | csv | xlsx | xml | rss | html (default: json)
```

---

## CLI Usage: Single & Multi-Account

### Single Account (Default)

```bash
# Set token (one-time)
apify auth --token YOUR_API_TOKEN

# Run actor
apify run apify/web-scraper --input-file input.json

# List actors
apify actors ls

# View actor details (including input schema)
apify info actor/apify/web-scraper
```

### Multi-Account (Round-Robin)

```bash
# Get next token (advances rotation, shows which account)
apify-multi next-token

# Check all 10 accounts + monthly spend
apify-multi status

# Run actor with automatic account rotation
apify-multi run apify/web-scraper --input-file input.json
# Output: "Using account: ProChat-3 (3/10, cycle #0)"

# List all configured accounts
apify-multi list
```

---

## Actor Input Discovery: How to Know What Parameters an Actor Accepts

**Apify actors have different input schemas.** Don't guess — look it up.

### Option 1: Apify Console

Visit https://apify.com/store, find the actor, read the "Input" tab.

### Option 2: CLI

```bash
apify info actor/apify/web-scraper | jq '.defaultRunOptions, .inputSchema'
```

### Option 3: REST API

```bash
curl -s https://api.apify.com/v2/acts/apify/web-scraper \
  -H "Authorization: Bearer $APIFY_TOKEN" | jq '.defaultRunOptions, .inputSchema'
```

This returns the actor's expected inputs. Common fields for web scrapers:
- `startUrls` — list of URLs to scrape
- `maxRequestsPerCrawl` — max pages to fetch (cost control)
- `maxCrawlDepth` — max link depth (1 = single page)
- `cssSelectors` — CSS selectors to extract data
- `pageFunction` — custom JavaScript extraction code

---

## Cost Management: Real Numbers

### Typical Apify Runs

| Actor | Scope | Cost |
|-------|-------|------|
| Web scraper | 10 URLs | $0.03–0.05 |
| Web scraper | 100 URLs | $0.10–0.25 |
| Google Search scraper | 10 results | $0.01–0.02 |
| LinkedIn scraper | 10 profiles | $0.05–0.10 |
| YouTube comment scraper | 100 comments | $0.02–0.05 |

### Monitor Your Spend

```bash
# Check real spend (accumulated from all runs this month)
apify-multi status
# Output: "Total remaining: $47.32" (if you've spent ~$2.68 so far)
```

The manager tracks all runs you've made and estimates spend. If you're on pace to exceed $50, cut back.

### Optimize Cost

- Use `maxRequestsPerCrawl: 10` for testing, then scale up
- Use `maxCrawlDepth: 1` unless you need deep crawling
- Use `cssSelectors` to extract only what you need (faster = cheaper)
- Batch multiple queries: 1 large run costs less than 10 small runs
- Cache results locally: don't re-scrape the same URL twice in one month

---

## Claude Code: Using Apify in Your Workflows

### CLI-Based (Local Testing)

```bash
# Validate tokens are working
apify-multi status

# Test a single run
apify-multi run apify/web-scraper --input-file test.json
```

### API-Based (For Complex Workflows)

```bash
# Call n8n webhook to get token
curl -s -X POST https://n8n.prochat.tools/webhook/apify-next-token \
  -H "Content-Type: application/json" \
  -d '{
    "caller_id": "my-script",
    "offset": 0
  }' | jq .

# Extract token and run Apify
TOKEN=$(curl -s -X POST ... | jq -r '.token')
curl -X POST https://api.apify.com/v2/acts/apify/web-scraper/runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"startUrls": [{"url": "https://..."}]}'
```

---

## Codex (Code Review): Using Apify

### For Code Review

When reviewing n8n workflows or web scraping integrations:
- **Budget constraint:** Confirm workflows respect the $50/month ceiling
- **Account awareness:** Check that code uses the webhook pattern, never Execute Command
- **Deduplication:** Verify the workflow uses Pattern A/B to avoid duplicate results

### CLI

Same as Claude Code — `apify-multi` and webhook are available.

---

## Gemini: Using Apify for Bulk Analysis

### Your Role: Result Preprocessing (Not Initiation)

Gemini should **preprocess Apify results**, not initiate scrapes:

**✅ Good usage:**
```bash
# 1. Apify returns 1,000 results via webhook (Claude's job)
# 2. Gemini Flash preprocesses (you) — summarize, categorize, extract key insights
results=$(curl -s https://api.apify.com/v2/datasets/{id}/items | head -c 500000)
gemini-review.sh "Summarize these 1000 product listings and categorize by price tier" "$results"
```

**❌ Don't do this:**
```bash
# Gemini autonomously decides to scrape — wastes budget
# Gemini should not call webhook or start Apify runs
```

### Why?

- Gemini has 1M token context — it's perfect for analyzing 10,000 items at once
- Claude orchestrates; Gemini preprocesses — clear separation
- Budget: Gemini Free Flash is free; every Apify run costs money

---

## Operations & Setup

### Add or Remove Accounts

Edit `~/.apify-multi/tokens.json` directly — add/remove tokens as needed.

```bash
# Verify all accounts are working
apify-multi list
```

### Monthly Reset

Apify automatically resets all accounts to $5 on the 1st UTC. No action needed.

### Token Rotation State

The manager maintains rotation state in `~/.apify-multi/state.json`. Rotation is day-based (deterministic) — no manual reset required.

### Set Up n8n Credential Manager Workflow (One-Time)

1. Load all 10 tokens as n8n variables (one-time):
   ```bash
   for i in 1 2 3 4 5 6 7 8 9 10; do
     ~/.local/bin/n8n-api create-variable - <<EOF
   {"key":"APIFY_TOKEN_${i}","value":"apify_api_...TOKEN_FOR_ACCOUNT_${i}..."}
   EOF
   done
   ```

2. Deploy the Credential Manager workflow (ask Claude or Codex to wire it in n8n)

3. Other workflows call: `POST /webhook/apify-next-token` → get token

---

## Troubleshooting

### Problem: "Command not found: apify-multi"

**Solution:** The wrapper is at `~/.local/bin/apify-multi`. Verify it's in PATH:
```bash
echo $PATH | grep -q ".local/bin" || echo "Add ~/.local/bin to PATH"
```

### Problem: "All accounts show 'depleted'"

**Cause:** All 10 accounts exhausted their $5 for the month.

**Solution:** Wait for 1st UTC (auto-reset) or buy additional credit on one account.

### Problem: "Bearer token invalid" (HTTP 401 from Apify)

**Cause:** Token is wrong, expired, or revoked.

**Solution:** Verify token in n8n variables or `~/.apify-multi/tokens.json`.

### Problem: Run returns HTTP 402

**Cause:** Account hit $0 limit mid-month.

**Solution:** Workflow falls back to next account automatically. Check `apify-multi status` to see which accounts are depleted.

### Problem: Rate limiting (HTTP 429 from Apify)

**Solution:** Space out workflow triggers — don't start 10 runs simultaneously. Add 5-10 second delays between runs.

---

## Comparison: Apify vs Other Scraping Tools

| Tool | Best For | Cost | Setup | Budget |
|------|----------|------|-------|--------|
| **Apify** | Actor-based scraping, re-usable workflows | $0 free tier, $0.025–0.25/run | API token + n8n | $50/month (10 accounts) |
| **Firecrawl** | Web search + markdown extraction | Free (self-hosted) | Tailscale IP | Unlimited |
| **Playwright** | Browser automation, complex interactions | Free | CLI install | Unlimited |
| **Cheerio** | Lightweight HTML parsing | Free | Node.js lib | Unlimited |

---

## Status & Support

- ✅ 10 accounts configured, all validated
- ✅ Multi-account rotation working (day-based, stateless)
- ✅ n8n webhook deployed
- ✅ Run tracking + real credit accounting active
- ✅ Deduplication patterns documented

**Links:**
- Apify Console: https://console.apify.com/
- Actor Store: https://apify.com/store
- API Docs: https://docs.apify.com/api/v2/
- CLI Docs: https://docs.apify.com/cli/

**Related skills:** `/firecrawl` (web search), `/n8n` (workflow automation), `/playwright` (browser automation)
