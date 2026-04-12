# Apify Multi-Account Setup — Complete Guide

**10 accounts ($50/month total) with automatic round-robin rotation for n8n workflows and CLI testing.**

---

## ✅ What's Already Done

- ✅ All 10 Apify tokens loaded and validated
- ✅ Credential manager running (`apify-multi-account-manager.py`)
- ✅ Round-robin rotation tested (cycles through accounts 1-10)
- ✅ Credentials stored securely at `~/.apify-multi/`
- ✅ CLI wrapper (`apify-multi` command) ready
- ✅ n8n integration patterns documented
- ✅ All runbooks created

---

## Quick Start (3 Steps)

### 1. Check Your Budget

```bash
python3 ~/.apify-multi-account-manager.py status
```

**Output:**
```json
{
  "total_monthly_credit": "$50.00",
  "total_remaining": "$50.00",
  "current_cycle_position": "Account 6/10",
  "cycle_count": 1,
  "depleted_accounts": "None"
}
```

### 2. Get Next Token (For n8n)

```bash
python3 ~/.apify-multi-account-manager.py next-token
```

**Output:**
```json
{
  "token": "apify_api_...",
  "account_name": "ProChat-6",
  "account_index": 6,
  "total_accounts": 10,
  "cycle_count": 1
}
```

### 3. Run Apify (CLI Testing)

```bash
apify-multi run apify/web-scraper --input-file input.json
```

**Output:**
```
ℹ️  Using account: ProChat-7 (7/10, cycle #1)
✅ Run complete via ProChat-7
```

---

## Understanding Round-Robin Rotation

**How it works:**

```
Request 1 → Account 1 ✓
Request 2 → Account 2 ✓
Request 3 → Account 3 ✓
...
Request 10 → Account 10 ✓
Request 11 → Account 1 ✓  (cycle_count increments)
Request 12 → Account 2 ✓
```

**Each account gets:**
- ~3 runs per month (30 days ÷ 10 accounts)
- Fresh $5 credit monthly (1st UTC)

**Why this approach:**
- Bot detection: Rotating IPs/tokens looks more natural
- Even distribution: No account overused
- Predictable: Know exactly which account you're using

---

## Integration with n8n

### Pattern: Scrape 1 URL Every Day (10-Day Rotation)

**Workflow:**

1. **Trigger** (Schedule: Daily, 9am)

2. **Execute Command** (Get next token)
   ```bash
   python3 ~/.apify-multi-account-manager.py next-token
   ```

3. **HTTP Request** (Start Apify run)
   ```
   Method: POST
   URL: https://api.apify.com/v2/acts/apify/web-scraper/runs
   Authorization: Bearer {{ $json.token }}
   Body:
   {
     "startUrls": [{"url": "{{ $node.Trigger.json.targetUrl }}"}],
     "cssSelectors": "h1, .price"
   }
   ```

4. **Wait Loop** (Poll until complete)
   ```
   Check: GET /v2/acts/.../runs/{{ $json.id }}
   Status: "SUCCEEDED" or other final state
   Max retries: 60
   Interval: 5 seconds
   ```

5. **HTTP Request** (Fetch results)
   ```
   Method: GET
   URL: https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items
   Authorization: Bearer {{ $node.Step2.json.token }}
   ```

6. **Save Results** (Database, file, etc.)

**Monthly outcome:**
- Day 1: Account 1 scrapes URL
- Day 2: Account 2 scrapes URL
- ...
- Day 10: Account 10 scrapes URL
- Day 11: Account 1 again (fresh credit next month)

---

## 10 Accounts Available

| # | Name | Email | Status |
|---|------|-------|--------|
| 1 | ProChat-1 | info@prochat.tools | ✅ Active |
| 2 | ProChat-2 | 54.car-culler@icloud.com | ✅ Active |
| 3 | ProChat-3 | builds.mustard.3z@icloud.com | ✅ Active |
| 4 | ProChat-4 | lot_retinol.7@icloud.com | ✅ Active |
| 5 | ProChat-5 | parties.clank-0w@icloud.com | ✅ Active |
| 6 | ProChat-6 | slog_odder0i@icloud.com | ✅ Active |
| 7 | ProChat-7 | smiths.fights-5v@icloud.com | ✅ Active |
| 8 | ProChat-8 | stances-malt.18@icloud.com | ✅ Active |
| 9 | ProChat-9 | terry_92_basho@icloud.com | ✅ Active |
| 10 | ProChat-10 | vastest_images.2z@icloud.com | ✅ Active |

**Total:** $50/month (renewable 1st UTC each month)

---

## Core Commands

### For Automation (n8n / Scripts)

```bash
# Get next token (advances rotation automatically)
python3 ~/.apify-multi-account-manager.py next-token

# Check current status
python3 ~/.apify-multi-account-manager.py status

# Export config (for reference)
python3 ~/.apify-multi-account-manager.py export-config
```

### For CLI Testing

```bash
# Run actor with automatic account rotation
apify-multi run apify/web-scraper --input-file input.json

# Check status
apify-multi status

# List accounts
apify-multi list
```

### Single-Account (Direct CLI)

```bash
# Using default token (ProChat-1)
apify actors ls
apify run apify/web-scraper --input-file input.json
```

---

## Files & Locations

| File | Purpose |
|------|---------|
| `~/.apify-multi/tokens.json` | All 10 API tokens (permissions: 600) |
| `~/.apify-multi/state.json` | Rotation state (current index, cycle count) |
| `apify-multi-account-manager.py` | Core manager (get token, status, etc.) |
| `apify-multi-cli-wrapper.sh` | CLI wrapper (`apify-multi` command) |
| `n8n-integration-pattern.md` | n8n workflow examples |
| `apify-multi-account.md` | Full runbook + troubleshooting |
| `SKILL.md` | Single-account Apify reference |

---

## Troubleshooting

### "Command not found: apify-multi"

**Solution:** Add to PATH or use full path:
```bash
~/.local/bin/apify-multi status
```

### "All accounts depleted"

**Solution:** Wait for monthly reset (1st UTC) or purchase credit on one account.

Check when credits reset:
```bash
python3 ~/.apify-multi-account-manager.py status
```

### "Bearer token invalid" (401 error in n8n)

**Solution:** Ensure token is extracted from manager output:
```bash
# Verify token format
python3 ~/.apify-multi-account-manager.py next-token | jq '.token'
# Should start with: apify_api_...
```

---

## Monthly Maintenance

**1st of each month (UTC):**
- All $50 credit resets automatically
- Cycle count can be manually reset if desired
- Rotation continues from Account 1

**To reset rotation manually:**
```bash
python3 << 'EOF'
import json
from pathlib import Path

state = {
    "current_index": 0,
    "cycle_count": 0,
    "last_updated": "2026-05-01T00:00:00"
}

with open(Path.home() / '.apify-multi' / 'state.json', 'w') as f:
    json.dump(state, f, indent=2)

print("✅ Rotation reset for new month")
EOF
```

---

## Next: Wire Into Your n8n Workflows

1. **Read:** `n8n-integration-pattern.md` for complete examples
2. **Test locally:** `apify-multi run apify/web-scraper --input-file test.json`
3. **Build workflow:**
   - Add Execute Command node → get next token
   - Add HTTP POST → start Apify run
   - Add Wait Loop → poll status
   - Add HTTP GET → fetch results
4. **Monitor:** `python3 ~/.apify-multi-account-manager.py status` (daily)

---

## Support

- **API Docs:** https://docs.apify.com/api/v2/
- **Apify Console:** https://console.apify.com/
- **Runbook:** `/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/apify-multi-account.md`

---

**Ready to scale.** 10 accounts, $50/month, automatic rotation. Let's go! 🚀
