# Apify CLI & API Integration

**Comprehensive runbook for web scraping, data extraction, and actor-based automation via Apify.**

Reference: `/apify` skill at `brain/ai/skills/custom/apify/`

---

## Quick Setup

### 1. Verify CLI Installation

```bash
apify --version
# Output: apify-cli/1.4.1 (a53a4f3) running on darwin-arm64 with node-25.9.0
```

### 2. Get API Token

1. Go to https://console.apify.com/ → sign up (free, no credit card)
2. **Integrations** → **API & Integrations**
3. Copy your **API token**

### 3. Configure CLI

```bash
# Set token (one-time)
apify auth --token YOUR_API_TOKEN

# Verify
cat ~/.apify/auth.json  # Verify token is stored
```

### 4. Test Basic Command

```bash
apify search "web scraper"  # Should list actors
```

---

## Common Workflows

### Workflow 1: One-Off Scraping

**Goal:** Scrape a single website, extract product data

```bash
# 1. Search for suitable actor
apify search "web scraper"

# 2. Get actor details
apify info actor/apify/web-scraper

# 3. Create input.json
cat > /tmp/scrape-input.json <<EOF
{
  "startUrls": [
    {"url": "https://example.com/products"}
  ],
  "cssSelectors": "h2.product-name, .price, .rating",
  "maxRequestsPerCrawl": 100
}
EOF

# 4. Run locally
apify run apify/web-scraper --input-file /tmp/scrape-input.json

# 5. Results in ~/.apify/storage/default/datasets/default/
```

### Workflow 2: Scheduled Competitor Monitoring (n8n)

**Goal:** Monitor competitor price/inventory daily, alert on changes

**n8n workflow:**

1. **Trigger:** Schedule (daily, 8am)
2. **HTTP POST** → Start Apify run
   ```
   URL: https://api.apify.com/v2/acts/{actor-id}/runs
   Auth: Bearer YOUR_API_TOKEN
   Body:
   {
     "startUrls": [{"url": "competitor.com"}],
     "cssSelectors": ".price, .in-stock"
   }
   ```
3. **Wait** → Poll status until complete (`status != RUNNING`)
4. **HTTP GET** → Fetch dataset results
   ```
   URL: https://api.apify.com/v2/datasets/{datasetId}/items
   Auth: Bearer YOUR_API_TOKEN
   ```
5. **Transform** → Extract prices, compare to previous day (stored in DB)
6. **Notify** → Slack alert if price dropped

**Store in n8n secrets:**
- `APIFY_TOKEN` — API token
- `APIFY_ACTOR_ID` — Actor ID for competitor scraping

### Workflow 3: Data Enrichment Pipeline

**Goal:** Enrich lead list with company info from web

**Flow:**

```bash
# 1. Prepare lead list (company names)
cat leads.json | jq '.[].company_name'

# 2. For each company, trigger Apify search
for company in $(cat leads.json | jq -r '.[].company_name'); do
  curl -X POST https://api.apify.com/v2/acts/actor/company-info/runs \
    -H "Authorization: Bearer $APIFY_TOKEN" \
    -d "{\"company\": \"$company\"}"
done

# 3. Poll and aggregate results
# (Use n8n Loop or custom script)

# 4. Update lead database with enriched data
```

---

## API Reference (Quick)

### Authenticate

```bash
export APIFY_TOKEN="your_token"
```

### List Available Actors

```bash
curl -s https://api.apify.com/v2/acts \
  -H "Authorization: Bearer $APIFY_TOKEN" | jq '.data[]'
```

### Start a Run

```bash
curl -X POST https://api.apify.com/v2/acts/{actor-id}/runs \
  -H "Authorization: Bearer $APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": [{"url": "https://example.com"}]
  }'

# Response:
# {
#   "id": "run-12345",
#   "status": "RUNNING",
#   "datasetId": "dataset-abc123"
# }
```

### Check Run Status

```bash
curl https://api.apify.com/v2/acts/{actor-id}/runs/{run-id} \
  -H "Authorization: Bearer $APIFY_TOKEN"
```

### Fetch Results

```bash
curl https://api.apify.com/v2/datasets/{dataset-id}/items \
  -H "Authorization: Bearer $APIFY_TOKEN" | jq '.'
```

### Delete Run (cleanup)

```bash
curl -X DELETE https://api.apify.com/v2/acts/{actor-id}/runs/{run-id} \
  -H "Authorization: Bearer $APIFY_TOKEN"
```

---

## Cost Tracking

### Monitor Monthly Spend

```bash
# 1. Apify Console → https://console.apify.com/
# 2. Click your username → **Billing**
# 3. See current month credit usage

# Current plan: Free ($5/month, renewable)
# Typical cost per run: 50–500 compute units (~$0.025–$0.25)
```

### Estimate Run Cost

Most Apify actors estimate cost **before running**:

```bash
# CLI shows estimate
apify run actor/apify/web-scraper --input-file input.json --dry-run

# Or check actor details for cost guidelines
apify info actor/apify/web-scraper | grep -i cost
```

### Stay Within Free Tier

- Keep `maxResults` small (50–100 instead of 1000)
- Use `maxCrawlDepth: 1` (single page depth) unless needed
- Batch multiple goals into one run if possible
- Test with smaller datasets first

---

## Integration with n8n

### Setup: Store API Token

1. **n8n** → **Credentials**
2. **Create new** → Search "API"
3. **API Key (Generic)**
   - Name: `Apify Token`
   - API Key: `YOUR_APIFY_TOKEN`
   - Key: `Authorization`
   - Prefix: `Bearer`

### Usage: HTTP Request Node

**Start Apify Run:**
```
Method: POST
URL: https://api.apify.com/v2/acts/apify/web-scraper/runs
Credentials: Apify Token (Generic API)
Headers: Content-Type: application/json
Body:
{
  "startUrls": [{"url": "{{ $json.targetUrl }}"}],
  "cssSelectors": "h1, p, .price"
}
```

**Poll Status (Loop):**
```
Do:
  - GET https://api.apify.com/v2/acts/{actor-id}/runs/{{ $json.runId }}
  - Extract: status
  - Break if status == "SUCCEEDED"
  - Wait 5 seconds
While: status != "SUCCEEDED" (max 60 iterations)
```

**Fetch Results:**
```
Method: GET
URL: https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items
Credentials: Apify Token
```

---

## JavaScript/Python SDK Usage

### Node.js

```javascript
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
});

(async () => {
  const run = await client
    .actor('apify/web-scraper')
    .call({
      startUrls: [{ url: 'https://example.com' }],
      cssSelectors: 'h1, .price'
    });

  console.log('Run ID:', run.id);
  console.log('Dataset ID:', run.datasetId);

  const dataset = await client
    .dataset(run.datasetId)
    .listItems();

  dataset.items.forEach(item => console.log(item));
})();
```

### Python

```python
from apify_client import ApifyClient
import os

client = ApifyClient(token=os.getenv("APIFY_TOKEN"))

# Run actor
run = client.actor("apify/web-scraper").call(
    run_input={
        "startUrls": [{"url": "https://example.com"}],
        "cssSelectors": "h1, .price"
    }
)

print(f"Run ID: {run['id']}")
print(f"Dataset ID: {run['datasetId']}")

# Get results
dataset = client.dataset(run["datasetId"]).list_items()
for item in dataset["items"]:
    print(item)
```

---

## Troubleshooting

### Problem: "Unauthorized" (401)

**Solution:** Token is missing or invalid
```bash
apify auth --token YOUR_TOKEN  # Re-set token
apify auth --token              # Verify token is set
```

### Problem: "Actor not found" (404)

**Solution:** Actor path is incorrect
```bash
apify search keyword            # Find correct actor
apify info actor/user/name      # Verify path
```

### Problem: "Run failed" (status: FAILED)

**Solution:** Check error log in Apify Console
1. Console → **Runs** → click run ID
2. **Logs** tab — see error details
3. Common: site blocks scraper, wrong CSS selectors, timeout

### Problem: "Out of budget" (no credit remaining)

**Solution:** Monthly credit exhausted
```bash
# Check balance: Console → Billing
# Wait for next month OR
# Purchase credit: Console → Billing → "Add credit"
```

### Problem: Rate limiting (429 Too Many Requests)

**Solution:** Too many concurrent requests
- Add exponential backoff to retry logic
- Space out runs with delays (e.g., 2–5 seconds between starts)
- Contact Apify if issue persists

---

## Best Practices

1. **Always test locally first**
   ```bash
   apify run actor-name --input-file test.json
   ```

2. **Use input presets** (if building custom actors)
   - Document expected input schema
   - Validate inputs before run

3. **Cache results**
   - Don't re-scrape same URL same day
   - Store results in local DB/file
   - Check before starting new run

4. **Store token securely**
   - Use env vars, never hard-code
   - In n8n, use **Credentials**
   - Rotate token if exposed

5. **Monitor cost closely**
   - Set up Apify alerts (Console → Notifications)
   - Log all runs to spreadsheet (timestamp, actor, cost)
   - Review monthly before bill closes

6. **Build incrementally**
   - Start simple (single URL scrape)
   - Add features (batch, schedule, enrichment)
   - Move to API once workflow proven

---

## Resources

- **Apify Console:** https://console.apify.com/
- **Actor Store:** https://apify.com/store
- **API Docs:** https://docs.apify.com/api/v2/
- **CLI Docs:** https://docs.apify.com/cli/
- **JavaScript SDK:** https://www.npmjs.com/package/apify-client
- **Python SDK:** https://pypi.org/project/apify-client/

---

## Status

- **CLI:** `apify-cli/1.4.1` (installed 2026-04-12)
- **Free tier:** $5/month renewable, no credit card required
- **Setup:** Requires API token from Apify Console
- **Recommended for:** Sporadic scraping, competitor monitoring, data enrichment
- **Not recommended for:** High-volume production scraping (build your own infra)

---

## See Also

- `/apify` — Skill with full reference
- `n8n` — Workflow automation (for scheduled jobs)
- `/firecrawl` — Alternative for web search + markdown extraction
- `/playwright` — Browser automation for complex interactions
