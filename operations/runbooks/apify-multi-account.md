# Apify Multi-Account Operations Runbook

**Manage 10 Apify accounts ($50/month total) with automatic round-robin rotation. For full usage patterns, see `/apify` skill at `brain/ai/skills/custom/apify/SKILL.md`.**

---

## Quick Start

| What | Command |
|------|---------|
| Get next token | `python3 ~/.apify-multi-account-manager.py next-token` |
| Check budget/status | `python3 ~/.apify-multi-account-manager.py status` |
| List all accounts | `python3 ~/.apify-multi-account-manager.py list` |
| Add new token | `python3 ~/.apify-multi-account-manager.py add-token <token> [name]` |
| CLI wrapper | `apify-multi run actor-id --input-file input.json` |
| Get offset token (Pattern A) | `python3 ~/.apify-multi-account-manager.py get-token-for-offset <offset> [items_per_account]` |

---

## System Architecture

### 10 Accounts × $5/month = $50/month Total

```
ProChat-1  (info@prochat.tools)
ProChat-2  (54.car-culler@icloud.com)
ProChat-3  (builds.mustard.3z@icloud.com)
ProChat-4  (lot_retinol.7@icloud.com)
ProChat-5  (parties.clank-0w@icloud.com)
ProChat-6  (slog_odder0i@icloud.com)
ProChat-7  (smiths.fights-5v@icloud.com)
ProChat-8  (stances-malt.18@icloud.com)
ProChat-9  (terry_92_basho@icloud.com)
ProChat-10 (vastest_images.2z@icloud.com)
```

### Credential Storage

```
~/.apify-multi/
├── tokens.json      ← 10 API tokens (permissions: 600)
├── state.json       ← rotation state (current index, cycle count)
└── runs.json        ← run history for credit tracking
```

### Round-Robin Rotation

Each call to `next-token` advances the pointer:

```
Call 1 → Account 1 ✓
Call 2 → Account 2 ✓
...
Call 10 → Account 10 ✓ (cycle_count increments)
Call 11 → Account 1 ✓ (next cycle)
```

---

## Operations

### 1. Check Budget

```bash
python3 ~/.apify-multi-account-manager.py status
```

Output shows:
- Total monthly credit: $50.00
- Total spent this month (from runs.json)
- Total remaining: $50 - spent
- Current cycle position and count
- Depleted accounts (if any)
- Per-account breakdown with run counts

### 2. Add New Account

```bash
python3 ~/.apify-multi-account-manager.py add-token <token> [optional-name]

# Example:
python3 ~/.apify-multi-account-manager.py add-token apify_api_xyz123 ProChat-11
```

Validates token against Apify API. Max 10 accounts.

### 3. List All Accounts

```bash
python3 ~/.apify-multi-account-manager.py list

# Output:
# Configured Apify Accounts (10/10):
# 1. ProChat-1 (info@prochat.tools)
#    Plan: free
#    Monthly credit: $5
# ...
```

### 4. Track Runs for Credit Accounting

When a run is initiated:

```bash
python3 ~/.apify-multi-account-manager.py record-run \
  <run_id> \
  <account_index> \
  <actor_id> \
  [estimated_cost_usd]
```

When a run completes:

```bash
python3 ~/.apify-multi-account-manager.py update-run-status \
  <run_id> \
  <status> \
  [final_cost_usd]
```

Status values:
- `RUNNING`, `SUCCEEDED`, `FAILED`, `TIMED-OUT`, `ABORTED`

---

## Rotation States

### Deterministic vs Offset-Based

**Default (deterministic):** Every call to `next-token` returns the next account in sequence. Same sequence every month.

**Offset-based (Pattern A deduplication):** For paginated scraping, use offset to select account:

```bash
python3 ~/.apify-multi-account-manager.py get-token-for-offset 300 100
# Returns: Account 4 (because 300 / 100 = 3, 3 % 10 = 3, so index 3 = Account 4)
```

Use this pattern when scraping paginated datasets where Account 1 fetches offset 0-100, Account 2 fetches 100-200, etc.

---

## Monthly Maintenance

**1st UTC of each month:**
- Apify automatically resets all $5 credits
- Rotation continues from Account 1
- Previous runs.json stays for historical tracking

To manually reset rotation (optional):

```python
python3 << 'EOF'
import json
from pathlib import Path
from datetime import datetime

state = {
    "current_index": 0,
    "cycle_count": 0,
    "last_updated": datetime.now().isoformat()
}

with open(Path.home() / '.apify-multi' / 'state.json', 'w') as f:
    json.dump(state, f, indent=2)

print("✅ Rotation reset")
EOF
```

---

## Troubleshooting

### "Command not found: apify-multi"

The wrapper is at `~/.local/bin/apify-multi` or use full path:

```bash
python3 ~/.apify-multi-account-manager.py status
```

### "Bearer token invalid" (401)

Token may be expired or wrong:

```bash
python3 ~/.apify-multi-account-manager.py list
# Check token format (should start with apify_api_)
```

### "All accounts depleted"

All 10 accounts exhausted their $5 this month. Wait for 1st UTC reset or purchase credit on one account via Apify Console.

### "Run returns 402 Payment Required"

Account hit $0 limit mid-month. Rotation automatically skips to next account. Check `status` to see which accounts are depleted.

---

## n8n Integration

Use the credential manager webhook endpoint (deployed as separate n8n workflow):

```
POST https://n8n.prochat.tools/webhook/apify-next-token
{
  "caller_id": "workflow-name",
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
  "pagination_offset": 0,
  "items_per_account": 100,
  "total_accounts": 10
}
```

The webhook handles:
- Day-based deterministic rotation by default
- Offset-based selection if `offset` param provided (Pattern A)
- Reading tokens from n8n variables `APIFY_TOKEN_1..10`

See `n8n-credential-manager-workflow.json` for deployment.

---

## For Developers

Manager is located at: `brain/ai/skills/custom/apify/apify-multi-account-manager.py`

Methods available:
- `get_next_token()` — round-robin rotation
- `get_token_for_offset(offset, items_per_account)` — Pattern A deduplication
- `get_status()` — aggregated budget + per-account breakdown
- `record_run(run_id, account_index, actor_id, cost)` — track runs
- `update_run_status(run_id, status, final_cost)` — update run completion
- `add_token(token, name)` — validate and add account
- `list_accounts()` — display all configured accounts
- `export_config()` — export non-sensitive config for reference

---

## Related

- **Full skill:** `brain/ai/skills/custom/apify/SKILL.md` (usage, patterns, cost management, n8n workflow examples)
- **CLI wrapper:** `brain/ai/skills/custom/apify/apify-multi-cli-wrapper.sh`
- **n8n workflow:** `brain/ai/skills/custom/apify/n8n-credential-manager-workflow.json`
- **Credentials:** `brain/operations/accounts/credentials-index.md` (Apify section)
- **Console:** https://console.apify.com/
- **Docs:** https://docs.apify.com/api/v2/
