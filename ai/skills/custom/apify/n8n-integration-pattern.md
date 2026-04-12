# n8n Multi-Account Apify Integration Pattern

**Use this pattern to integrate multi-account Apify into n8n workflows with automatic account rotation.**

---

## Overview

Instead of hardcoding a single Apify token in each workflow, define your actor once and let the credential manager handle account rotation:

```
Actor definition (once):
  apify/web-scraper
  startUrls: [{"url": "https://example.com"}]
  cssSelectors: "h1, .price"

Execution (10x per month):
  Request 1: Use token from Account 1
  Request 2: Use token from Account 2
  ...
  Request 10: Use token from Account 10
  (repeat next month)
```

---

## n8n Workflow Setup

### Prerequisites

1. **Install Python HTTP Request node** (or use generic HTTP)
2. **Configure credential manager** — already done at `~/.apify-multi/tokens.json`

### Pattern 1: Single Apify Run (Simplest)

**Workflow nodes:**

1. **Trigger** (Manual, Schedule, or Webhook)

2. **Execute Command** (Execute node OR HTTP POST)
   ```bash
   python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py next-token
   ```
   Output: `{token, account_name, account_index, total_accounts, cycle_count}`

3. **HTTP Request** — Start Apify Run
   - Method: `POST`
   - URL: `https://api.apify.com/v2/acts/apify/web-scraper/runs`
   - Auth: `Bearer {{ $json.token }}` (from step 2)
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "startUrls": [{"url": "{{ $node.\"Trigger\".json.url }}"}],
       "cssSelectors": "h1, .price"
     }
     ```

4. **Wait** (Loop until run completes)
   - Poll endpoint: `https://api.apify.com/v2/acts/apify/web-scraper/runs/{{ $json.id }}`
   - Check `status != RUNNING`
   - Max retries: 60
   - Wait between retries: 5s

5. **HTTP Request** — Fetch Results
   - Method: `GET`
   - URL: `https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items`
   - Auth: `Bearer {{ $node.\"Step2\".json.token }}`

6. **Process Results** (JS node, Database, etc.)

7. **Check Rotation Status** (Optional, for monitoring)
   ```bash
   python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py status
   ```

---

## Pattern 2: Batch Scraping (10 URLs, 10 Accounts)

**Scenario:** Scrape 10 URLs, one per account per month.

**Workflow:**

1. **Trigger** → Provides `urls` array: `["url1.com", "url2.com", ..., "url10.com"]`

2. **Loop Over Items** (forEach url in urls)

   a. **Get Next Token** (inside loop)
      ```bash
      python3 apify-multi-account-manager.py next-token
      ```

   b. **Run Apify** with next token + current URL
      - Token: `{{ $json.token }}` (from loop)
      - URL: `{{ $items(1)[0].json.url }}` (current item)

   c. **Wait for completion** + **Fetch results**

3. **Aggregate Results** (after loop completes)
   - Combine all 10 runs' data
   - Store in database

4. **Send Notification**
   ```
   "Batch complete: 10 URLs scraped across 10 accounts"
   "Remaining credits: $50.00 (all accounts reset)"
   ```

---

## Pattern 3: Monitor Monthly Cycle Status

**Every morning, check if we've exhausted all 10 accounts.**

1. **Trigger** — Schedule (daily, 9am)

2. **Execute Command**
   ```bash
   python3 apify-multi-account-manager.py status
   ```

3. **Parse Response** (JavaScript)
   ```javascript
   return {
     deployed: $json.accounts_configured,
     remaining_credit: $json.total_remaining,
     cycle: $json.cycle_count,
     all_exhausted: $json.total_remaining === "$0.00"
   }
   ```

4. **Conditional Notification**
   - If `all_exhausted === true` → Slack: "All 10 accounts exhausted, waiting for next month"
   - Else → Slack: "Status: {{ remaining_credit }} remaining across all accounts"

---

## n8n Node Configuration Examples

### HTTP Request: Get Next Token

```
Method: POST
URL: (use Execute Command or HTTP if you have Python HTTP node)

Alternative: Use Execute Command node:
  Command: bash
  Command: python3 ~/.apify-multi-account-manager.py next-token | jq .
```

### Execute Command Node: Get Status

```
Command: bash
Command: python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py status
```

Output format:
```json
{
  "timestamp": "2026-04-12T17:24:51...",
  "total_monthly_credit": "$50.00",
  "total_remaining": "$50.00",
  "current_cycle_position": "Account 1/10",
  "cycle_count": 0,
  "depleted_accounts": "None"
}
```

### HTTP Request: Start Apify Run

```
Method: POST
URL: https://api.apify.com/v2/acts/apify/web-scraper/runs
Headers:
  Authorization: Bearer {{ $json.token }}
  Content-Type: application/json

Body:
{
  "startUrls": [{"url": "{{ $node.\"Trigger\".json.targetUrl }}"}],
  "cssSelectors": "{{ $node.\"Trigger\".json.selectors }}",
  "maxRequestsPerCrawl": 100
}

Response: { id, datasetId, status, ... }
```

### Wait Node: Poll Until Complete

```
URL: https://api.apify.com/v2/acts/apify/web-scraper/runs/{{ $json.id }}
Headers:
  Authorization: Bearer {{ $node.\"Step2\".json.token }}

Check: $json.status !== "RUNNING"
Retries: 60
Interval: 5000ms (5 seconds)
```

### HTTP Request: Fetch Results

```
Method: GET
URL: https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items
Headers:
  Authorization: Bearer {{ $node.\"Step2\".json.token }}
```

---

## Testing Workflow (Start Here)

**Simple 3-node workflow to validate the system:**

1. **Trigger** (Manual)

2. **Execute Command** → Get next token
   ```
   Command: python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py next-token
   ```

3. **Debug** → Print output
   ```
   Message: Got token for {{ $json.account_name }} (cycle {{ $json.cycle_count }})
   ```

Run manually 10+ times and verify:
- Token cycles through ProChat-1 → ProChat-10 → ProChat-1 (wrap-around)
- Cycle count increments when wrapping
- No token appears twice in one cycle

---

## Troubleshooting

### Problem: "Command not found" (Execute Command node fails)

**Solution:** Use full path in Execute Command:
```bash
/usr/bin/python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py status
```

### Problem: "Bearer token invalid" (HTTP 401)

**Solution:** Ensure token is extracted correctly:
```
Header: Authorization: Bearer {{ $json.token }}
                             ↑ check exact field name in token response
```

### Problem: Apify run timed out (waited 60 polls = 5 min, still running)

**Solution:** Increase wait retries or max crawl time in Apify actor input:
```json
{
  "maxRequestsPerCrawl": 50,  ← reduce scope
  "maxCrawlDepth": 1          ← single page only
}
```

---

## Best Practices

1. **Define actor input once** — store in a `.json` file or as workflow variables
2. **Test token rotation locally** — run `apify-multi status` before building workflow
3. **Monitor monthly spend** — add daily status check (Pattern 3)
4. **Set notifications** — Slack alert when cycle completes
5. **Log which account was used** — for debugging, save `{{ $json.account_name }}` to database
6. **Cache results** — don't re-run the same URL on the same day across accounts

---

## Full Workflow Example (Copy-Paste Ready)

**Scenario:** Scrape one URL per workday, rotating through accounts.

**n8n JSON:**
```json
{
  "nodes": [
    {
      "parameters": {
        "triggerType": "every",
        "unit": "day",
        "value": 1,
        "timezone": "Europe/Lisbon"
      },
      "id": "Trigger - Daily 9am",
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger"
    },
    {
      "parameters": {
        "command": "python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py next-token"
      },
      "id": "Get Next Token",
      "name": "Execute Command",
      "type": "n8n-nodes-base.executeCommand"
    },
    {
      "parameters": {
        "authentication": "predefinedCredentialType",
        "url": "https://api.apify.com/v2/acts/apify/web-scraper/runs",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer {{ $json.token }}"
        },
        "body": "{\"startUrls\": [{\"url\": \"https://example.com\"}], \"cssSelectors\": \"h1, p\"}"
      },
      "id": "Start Apify Run",
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest"
    }
  ],
  "connections": {
    "Trigger - Daily 9am": {
      "main": [
        [
          {
            "node": "Get Next Token",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Next Token": {
      "main": [
        [
          {
            "node": "Start Apify Run",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Status

- Credential manager: `~/.apify-multi/tokens.json` (10 accounts loaded)
- CLI wrapper: `apify-multi` command
- Pattern tested locally with `next-token` ✅

Ready to integrate into workflows!
