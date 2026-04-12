# Apify Multi-Account Management Runbook

**Manage 10 Apify accounts ($50/month total credit) with automatic round-robin rotation.**

---

## Quick Reference

| What | Command |
|------|---------|
| Get next token | `python3 ~/.apify-multi-account-manager.py next-token` |
| Check status | `python3 ~/.apify-multi-account-manager.py status` |
| List accounts | `python3 ~/.apify-multi-account-manager.py list` |
| Export for n8n | `python3 ~/.apify-multi-account-manager.py export-config` |
| CLI wrapper | `apify-multi run actor-id --input-file input.json` |

---

## System Architecture

### 10 Accounts × $5/month = $50/month Total Credit

```
ProChat-1  (info@prochat.tools)         ← Account 1
ProChat-2  (54.car-culler@icloud.com)   ← Account 2
ProChat-3  (builds.mustard.3z@icloud.com) ← Account 3
... (7 more accounts)
ProChat-10 (vastest_images.2z@icloud.com) ← Account 10
```

### Credential Manager

**Location:** `~/.apify-multi/`
```
~/.apify-multi/
├── tokens.json       ← 10 API tokens (encrypted permissions: 600)
└── state.json        ← rotation state (current index, cycle count)
```

**Manager script:** `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py`

### Rotation Logic

**Round-robin, cycle-based:**

```
Cycle 1:
  Call 1: Account 1/10
  Call 2: Account 2/10
  ...
  Call 10: Account 10/10 (cycle_count increments to 1)

Cycle 2:
  Call 11: Account 1/10
  Call 12: Account 2/10
  (repeats next month)
```

**Benefits:**
- Distributes load evenly (bot detection resistance)
- All 10 accounts used equally
- Clear cycle tracking (know when to expect monthly reset)

---

## Core Operations

### 1. Get Next Token (For Automation)

**Command:**
```bash
python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py next-token
```

**Output:**
```json
{
  "token": "apify_api_...",
  "account_name": "ProChat-3",
  "account_index": 3,
  "total_accounts": 10,
  "cycle_count": 0
}
```

**Usage in n8n:**
```javascript
// Inside n8n Execute Command or JavaScript node
const token = $json.token;
const account = $json.account_name;
const cycle = $json.cycle_count;

return {
  token,
  account,
  cycle,
  is_cycle_complete: $json.account_index === $json.total_accounts
};
```

### 2. Check Status (Monthly Budget Tracking)

**Command:**
```bash
python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py status
```

**Output:**
```json
{
  "total_monthly_credit": "$50.00",
  "total_remaining": "$50.00",
  "current_cycle_position": "Account 1/10",
  "cycle_count": 0,
  "depleted_accounts": "None",
  "account_details": [
    {
      "account": "ProChat-1",
      "email": "info@prochat.tools",
      "monthly_credit": 5,
      "status": "active"
    },
    ...
  ]
}
```

**Reading status:**
- `total_remaining` — total budget left across all 10 accounts
- `cycle_count` — how many complete cycles have occurred this month
- `depleted_accounts` — any accounts at $0? (should be "None")

### 3. List All Accounts

**Command:**
```bash
python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py list
```

**Output:**
```
Configured Apify Accounts (10/10):

1. ProChat-1 (info@prochat.tools)
   Plan: FREE
   Monthly credit: $5

2. ProChat-2 (54.car-culler@icloud.com)
   ...
```

---

## Integration Patterns

### Pattern A: n8n Workflow (Recommended)

**Use multi-account system in n8n workflows:**

1. **Trigger** → Manual, Schedule, or Webhook

2. **Execute Command** (Get next token)
   ```bash
   python3 /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py next-token
   ```

3. **HTTP POST** (Start Apify run)
   ```
   URL: https://api.apify.com/v2/acts/apify/web-scraper/runs
   Header: Authorization: Bearer {{ $json.token }}
   Body: { "startUrls": [...], "cssSelectors": "..." }
   ```

4. **Wait Loop** (Poll until complete)
   ```
   Check: GET /v2/acts/.../runs/{{runId}} → status !== "RUNNING"
   ```

5. **HTTP GET** (Fetch results)
   ```
   URL: https://api.apify.com/v2/datasets/{{ datasetId }}/items
   Header: Authorization: Bearer {{ $json.token }}
   ```

**Full n8n integration guide:** `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/n8n-integration-pattern.md`

### Pattern B: CLI Wrapper (Local Testing)

**Test locally before wiring into n8n:**

```bash
apify-multi run apify/web-scraper --input-file input.json
```

**Output:**
```
ℹ️  Using account: ProChat-2 (2/10, cycle #0)
✅ Run complete via ProChat-2
```

Script location: `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-cli-wrapper.sh`

### Pattern C: Python SDK (For Custom Scripts)

```python
import sys
sys.path.insert(0, '/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify')
from apify_multi_account_manager import ApifyMultiManager

manager = ApifyMultiManager()

# Get next token
token_info = manager.get_next_token()
print(f"Using: {token_info['account_name']}")

# Get status
status = manager.get_status()
print(f"Remaining: {status['total_remaining']}")
```

---

## Use Cases

### Use Case 1: Scheduled Daily Scraping

**Goal:** Scrape one URL every day, rotate through 10 accounts.

**n8n Workflow:**
1. Schedule: Daily, 9am
2. Get next token (manager) → Account 1
3. Start Apify run (web-scraper actor)
4. Wait for completion
5. Store results in database
6. Repeat next day → Account 2

**Monthly outcome:** Each account used 3 times (30 days ÷ 10 accounts ≈ 3)

### Use Case 2: Batch Competitor Monitoring

**Goal:** Monitor 10 competitors daily for price changes.

**n8n Workflow:**
1. Loop over 10 competitors array
2. Inside loop:
   - Get next token (cycles through accounts)
   - Run scraper on competitor URL
   - Wait for completion
   - Alert if price changed
3. End of loop: all 10 competitors monitored via 10 different accounts

### Use Case 3: Monthly Status Check

**Goal:** Each morning, verify we haven't exhausted all credits.

**n8n Workflow:**
1. Schedule: Daily, 8am
2. Get status (manager)
3. If `total_remaining > 0` → Slack: ✅ "$50.00 remaining"
4. If `total_remaining == 0` → Slack: ⏸️ "All accounts exhausted, waiting for reset"

---

## Monitoring & Alerts

### Daily Status Check

```bash
# Set up a cron job to run daily
0 9 * * * python3 ~/.apify-multi-account-manager.py status | mail -s "Apify Status" you@example.com
```

Or in n8n: Schedule daily, call `status`, send Slack notification.

### Monthly Reset

**Apify credits reset on the 1st of each month (UTC).**

- Cycle count resets manually (or create a monthly cron job to reset it)
- All $50 credit is available again
- Continue rotation

### Budget Tracking

**Current usage estimate:**

```bash
python3 ~/.apify-multi-account-manager.py status | jq '.total_remaining'
```

**If spending too much:**
- Reduce `maxRequestsPerCrawl` in actor input
- Use `maxCrawlDepth: 1` (single-page crawls only)
- Cache results to avoid re-scraping same URLs

---

## Troubleshooting

### Problem: "No accounts configured"

**Cause:** Tokens not loaded into manager.

**Solution:**
```bash
# Re-add all 10 tokens
python3 ~/.apify-multi-account-manager.py add-token "apify_api_..." "Account-1"
```

### Problem: Token returned but Apify says "invalid"

**Cause:** Token might be expired or revoked.

**Solution:**
1. Check Apify Console — is token still valid?
2. If revoked, generate new token and update manager:
   ```bash
   python3 ~/.apify-multi-account-manager.py add-token "apify_api_NEW" "Account-X"
   ```

### Problem: All accounts show "depleted"

**Cause:** All 10 accounts used up their $5 credit for the month.

**Solution:**
1. Wait for monthly reset (1st of next month, UTC)
2. Or purchase additional credit on any account ($1-100 top-up)
3. Cycle will automatically continue after reset

### Problem: n8n HTTP node returns 429 (Too Many Requests)

**Cause:** Rate limiting from Apify API.

**Solution:**
1. Increase wait time between API calls (use loop delay)
2. Reduce batch size (fewer concurrent runs)
3. Space out workflow triggers (don't start multiple runs simultaneously)

---

## Credentials Management

### Where Tokens Are Stored

```
~/.apify-multi/tokens.json  (permissions: 600, readable by user only)
```

**Format:**
```json
{
  "accounts": [
    {
      "token": "apify_api_zIeyOGwEcfmqQYNVvW7QHHIjaynj4w48eknG",
      "name": "ProChat-1",
      "username": "ProChat",
      "email": "info@prochat.tools",
      "plan": "FREE",
      "monthly_credit": 5
    },
    ...
  ]
}
```

### Rotation State

```
~/.apify-multi/state.json
{
  "current_index": 3,
  "cycle_count": 0,
  "last_updated": "2026-04-12T17:24:51.240614"
}
```

### Backing Up Credentials

```bash
# Backup tokens (keep safe, contains API keys!)
cp ~/.apify-multi/tokens.json ~/.apify-multi/tokens.json.backup

# Do NOT commit to git — these are secrets
echo "~/.apify-multi/" >> ~/.gitignore
```

---

## Advanced: Manual Rotation Reset

**If you need to reset the rotation counter (e.g., first run of month):**

```bash
python3 -c "
import json
from pathlib import Path

state_file = Path.home() / '.apify-multi' / 'state.json'
state = {
    'current_index': 0,
    'cycle_count': 0,
    'last_updated': '$(date -Iseconds)'
}

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)

print('✅ Rotation reset to starting position')
"
```

---

## Status

- ✅ All 10 accounts configured and validated
- ✅ Credential manager running
- ✅ Round-robin rotation tested (1-10 → 1-10 cycle)
- ✅ n8n integration pattern documented
- ✅ CLI wrapper ready
- ✅ Monthly status tracking enabled

**Next:** Wire into n8n workflows. See `n8n-integration-pattern.md` for details.

---

## Related Docs

- **Integration pattern:** `n8n-integration-pattern.md`
- **Original Apify skill:** `brain/ai/skills/custom/apify/SKILL.md`
- **Apify API docs:** https://docs.apify.com/api/v2/
- **Credentials index:** `operations/accounts/credentials-index.md`
