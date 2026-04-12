---
name: apify
description: "Web scraping, data extraction, and actor-based automation via Apify CLI and REST API. AI-agnostic: works with Claude Code, Codex, and Gemini. Free plan includes $5 monthly credits. Use for targeted scraping jobs, competitor monitoring, data collection, and lead enrichment."
---

# /apify — Web Scraping & Data Extraction

**AI-agnostic web scraping platform.** Apify CLI and REST API for building and running scraping workflows, actor-based automation, and targeted data extraction. Free plan: $0 with $5 monthly platform credit (no credit card required).

- **Free tier:** $5/month platform credit (renewable), no credit card required
- **Best for:** Sporadic scraping, competitor monitoring, lead enrichment, listing extraction, comment scraping
- **Auth:** Apify API token from console (required for CLI and REST API)
- **CLI:** `apify` command (installed globally via Homebrew)
- **Works with:** Claude Code, Codex, Gemini Flash

---

## When to Use Apify

**Use Apify for:**
- Targeted one-off scraping jobs (YouTube, LinkedIn, e-commerce listings)
- Scheduled data collection (competitor monitoring, pricing feeds)
- Lead enrichment and business intelligence
- Comment/review aggregation
- Proof-of-concept automation before building production systems
- Integration with n8n, Next.js apps, or internal tools

**Do NOT use Apify for:**
- Building your whole business on expensive third-party Actors without cost analysis — that's how "$0 free plan" becomes "$500/month"
- High-volume production scraping (use your own infrastructure)
- High-frequency site monitoring (expensive per run)

**Workflow philosophy:**
1. **CLI (quick validation)**: Test scraping with `apify run` locally
2. **API (production)**: Move winning workflows to API calls in your app or n8n
3. **Actors (reuse)**: Package workflows as Actors for team/marketplace distribution

---

## Authentication

### Get Your API Token

1. Go to **Apify Console** → https://console.apify.com/
2. Sign up (free account, no credit card required)
3. Navigate to **Integrations** → **API & Integrations**
4. Copy your **API token**

### Configure CLI

```bash
# Set token (one-time setup)
apify auth --token YOUR_API_TOKEN

# Verify
apify auth --token # shows your current token
```

Store token safely. For automation/n8n, use environment variables:
```bash
export APIFY_TOKEN="your_token_here"
```

---

## Quick Start: CLI

### Search for and Run Pre-Built Actors

```bash
# Search the Apify Store
apify search "keyword"

# Example: Find web scrapers
apify search "web scraper"
apify search "e-commerce"
apify search "youtube"

# View actor details
apify info actor/username/actor-name
```

### Run an Actor Locally

```bash
# Run an actor and see output
apify run actor/username/actor-name --input-file input.json

# Save results to file
apify run actor/username/actor-name > output.json

# Run with inline input
apify run actor/username/actor-name \
  --input-string '{"startUrls": [{"url": "https://example.com"}]}'
```

### Common Actors (Examples)

| Actor | Purpose | Input |
|-------|---------|-------|
| `apify/web-scraper` | Generic HTML scraping | URLs + CSS selectors |
| `apify/youtube-comment-scraper` | YouTube comments | Video URL |
| `apify/website-content-crawler` | Full site crawl to markdown | Start URL |
| `apify/google-search-scraper` | Google search results | Query term |
| `apify/linkedin-profile-scraper` | LinkedIn data (login required) | Profile URL |

**Tip:** Most actors on the Apify Store include CLI examples in their README.

---

## REST API Usage

### Run an Actor via API

```bash
# Start a run
curl -X POST https://api.apify.com/v2/acts/actor-id/runs \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": [{"url": "https://example.com"}],
    "cssSelectors": "h1, p"
  }'

# Response:
# {
#   "id": "run-12345",
#   "status": "RUNNING",
#   "datasetId": "dataset-12345"
# }

# Check status
curl https://api.apify.com/v2/acts/actor-id/runs/run-12345 \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get results
curl https://api.apify.com/v2/datasets/dataset-12345/items \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Call from n8n

1. Add **HTTP Request** node
2. URL: `https://api.apify.com/v2/acts/{actor-id}/runs`
3. Method: `POST`
4. Auth: `Bearer YOUR_API_TOKEN` (store token in n8n secrets)
5. Body:
   ```json
   {
     "startUrls": [{"url": "https://..."}],
     "otherOptions": "..."
   }
   ```
6. Parse response: `jsonata` — `$.datasetId`
7. Fetch results: Second HTTP node → `/datasets/{datasetId}/items`

---

## SDK Usage (JavaScript/Python)

### JavaScript (Node.js)

```javascript
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

(async () => {
  // Run an actor
  const run = await client.actor('apify/web-scraper').call({
    startUrls: [{ url: 'https://example.com' }],
    cssSelectors: 'h1, p'
  });

  // Get results
  const dataset = await client.dataset(run.datasetId).listItems();
  console.log(dataset.items);
})();
```

### Python

```python
from apify_client import ApifyClient

client = ApifyClient(token=os.getenv("APIFY_TOKEN"))

# Run actor
actor_run = client.actor("apify/web-scraper").call(
    run_input={
        "startUrls": [{"url": "https://example.com"}],
        "cssSelectors": "h1, p"
    }
)

# Get results
dataset = client.dataset(actor_run["datasetId"]).list_items()
for item in dataset["items"]:
    print(item)
```

---

## Common Use Cases

### 1. Extract Product Data from E-Commerce Site

```bash
# Use web-scraper actor
apify run apify/web-scraper --input-file products.json

# products.json:
# {
#   "startUrls": [
#     {"url": "https://shop.example.com/products"}
#   ],
#   "cssSelectors": "product-name, price, rating"
# }
```

### 2. Monitor Competitor Pricing

```bash
# Schedule daily via n8n
# 1. HTTP POST to start run
# 2. Wait for completion
# 3. Store results in database
# 4. Alert if price changed

# In n8n n8n HTTP node:
POST https://api.apify.com/v2/acts/actor-id/runs
Body: {"urls": ["competitor-site.com"]}
```

### 3. Extract YouTube Comments

```bash
apify run apify/youtube-comment-scraper --input-string '{
  "videoUrl": "https://youtube.com/watch?v=VIDEO_ID",
  "maxComments": 1000
}'
```

### 4. Validate Website Structure

```bash
# Crawl site, extract all pages, links, and title tags
apify run apify/website-content-crawler --input-file crawl.json

# crawl.json:
# {
#   "startUrls": [{"url": "https://example.com"}],
#   "maxCrawlDepth": 2,
#   "maxResultsPerCrawl": 100
# }
```

---

## Integration with n8n

**n8n Brain Inbox workflow** can feed Apify results for data enrichment:

1. **Trigger:** Webhook or schedule (e.g., hourly competitor price check)
2. **Apify HTTP node:** Start actor run
3. **Wait node:** Poll status until complete
4. **Fetch results:** HTTP node → GET `/datasets/{datasetId}/items`
5. **Process:** Filter, transform, store in database
6. **Notify:** Slack/email alert if thresholds exceeded

Example workflow URL pattern:
```
https://n8n.prochat.tools/webhook/apify-enrichment
```

---

## Cost Management

### Free Plan Details

- **$5/month** platform credit (renewable)
- **No credit card** required
- Shared queue (standard priority)
- 1M compute units/month (typical actor: 50-500 units/run)

### Estimate Cost Per Run

Most pre-built actors cost 50–500 units per run:
- Small scrape (10 URLs): ~50 units ($0.025)
- Medium scrape (100 URLs): ~200 units ($0.10)
- Large scrape (1000 URLs): ~500 units ($0.25)

**At $5/month, you can run ~20–50 typical scrapes.**

### Tips to Stay Within Free Tier

1. Test locally with `apify run` before scheduling
2. Use smallest possible `maxResults` / `maxCrawlDepth`
3. Batch jobs (combine 5 scrapes into 1 run) if possible
4. Monitor monthly spend via **Apify Console** → **Billing**
5. Set up alerts: Console → **Notifications** → alert when credit low

---

## CLI Commands Reference

```bash
# Authentication
apify auth --token TOKEN              # Set API token
apify auth --token                    # Show current token

# Actor Discovery
apify search keyword                  # Search Apify Store
apify info actor/user/name           # View actor details

# Running Actors
apify run actor/user/name             # Run locally (interactive)
apify run actor/user/name --input-file input.json
apify run actor/user/name --input-string '{"key": "value"}'

# View Results
apify runs list                       # List recent runs
apify datasets list                   # List datasets
apify datasets --latest               # Get latest dataset
```

---

## Troubleshooting

### "API token not found"
```bash
apify auth --token YOUR_TOKEN  # Set token
```

### "Actor not found"
```bash
apify search keyword           # Search for correct actor name
apify info actor/user/name    # Verify exact actor path
```

### "Run failed" or "Out of budget"
- Check Apify Console → **Runs** → see error log
- Reduce `maxResults` or `maxCrawlDepth`
- Confirm you have monthly credit remaining (Console → **Billing**)
- Switch to a simpler actor (smaller compute cost)

### Rate Limiting (429)
- Wait 1–5 minutes before retrying
- Use exponential backoff in automation (n8n, scripts)
- Contact Apify support if issue persists

---

## Best Practices

### ✅ Do

- Test scraping with `apify run` locally first
- Use metadata filters (e.g., date range, category) to reduce results
- Cache results if same data needed multiple times
- Store API token in environment variables, never in code
- Monitor monthly spend (Console → Billing)
- Document actor inputs/outputs for team reuse

### ❌ Don't

- Scrape high-frequency without caching (wastes credits)
- Hard-code credentials in CLI commands (use env vars)
- Assume actor output schema is stable (test after updates)
- Run actors without cost estimates (always test small first)
- Use Apify as your primary data infrastructure (too expensive at scale)

---

## Comparison with Other Scraping Tools

| Tool | Best for | Cost | Setup |
|------|----------|------|-------|
| **Apify** | One-off, targeted scraping | $5/mo free | Token auth, pre-built actors |
| **Firecrawl** | Web search + markdown extraction | Free (self-hosted) | Curl/API, no auth |
| **Playwright** | Browser automation, complex interactions | Free | Local script, npm install |
| **Cheerio** | Lightweight HTML parsing | Free | Node.js library |
| **Scrapy** | Full-featured web scraping framework | Free | Python framework, heavy setup |

---

## Links & Resources

- **Apify Console:** https://console.apify.com/
- **Actor Store:** https://apify.com/store
- **REST API Docs:** https://docs.apify.com/api/v2/
- **CLI Docs:** https://docs.apify.com/cli/
- **JavaScript SDK:** https://www.npmjs.com/package/apify-client
- **Python SDK:** https://pypi.org/project/apify-client/

---

## Status

- **CLI installed:** `apify-cli/1.4.1` via Homebrew
- **Auth:** Requires API token from Apify Console
- **Free tier:** $5/month renewable, no credit card
- **Maintained by:** Claude Code, Codex, Gemini Flash automation workflows
