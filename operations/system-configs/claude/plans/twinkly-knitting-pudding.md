# Plan: Apify Multi-Account System — Complete Rebuild

## Context

The current system has critical architectural gaps discovered through codebase exploration:

1. **Deduplication is broken** — rotating 10 accounts over the same query returns identical results 10 times, not 10× the data
2. **n8n abstraction is broken** — current patterns use `Execute Command` with hard-coded macOS paths that fail silently inside n8n's Docker container on Dokploy
3. **SKILL.md is wrong everywhere that matters** — says "$5/mo", has no multi-account content, no deduplication patterns, no run lifecycle states, no budget constraint
4. **Brain-wide awareness is missing** — CLAUDE.md, AGENTS.md, GEMINI.md all have single-line stubs with wrong budget

## Architecture Decisions

### n8n: Day-Based Webhook (Zero Dependencies)
n8n runs in Docker on Dokploy — it cannot exec host Python scripts. The correct pattern: an n8n sub-workflow with a webhook that internally computes a day-based account index (`Math.floor(Date.now() / 86400000) % 10`), reads the matching token from n8n variables (`APIFY_TOKEN_1..10`), and returns it. Parent workflows call one endpoint, get one token back — completely unaware of 10 accounts existing.

### Deduplication: Three Patterns, Documented Clearly
- **Pattern A (default):** Paginated dataset slice — Account N fetches `offset=N*100, limit=100`. Same actor run, different slices. 10 accounts = 1000 unique results.
- **Pattern B:** Partition URL list — Account N gets URLs [N*10..(N+1)*10]. Different inputs → different outputs.
- **Pattern C (fallback):** Run all accounts, deduplicate by URL hash post-hoc. Wastes credits but works when A/B aren't applicable.

### Single Source of Truth: SKILL.md
The `firecrawl` skill is the gold standard — one file, full ops, all AI engines, all patterns. Delete duplicate files (`MULTI_ACCOUNT_SETUP.md`, `n8n-integration-pattern.md`). Everything lives in SKILL.md.

## Implementation Steps

### 1. Rewrite `SKILL.md` (foundation — everything references this)
`brain/ai/skills/custom/apify/SKILL.md`

New structure:
- Frontmatter: description updated to "$50/month total, 10 accounts, webhook-based n8n, AI-agnostic"
- **Budget block at top**: $50/month, ~20-50 runs total, ~2-5 runs/account/month — first-class constraint
- **Multi-Account System section**: day-based rotation explained, webhook endpoint, CLI alternative
- **Deduplication section**: Pattern A (paginate), B (partition URLs), C (post-hoc) with concrete API calls
- **n8n integration section** (complete rewrite):
  - 4-step pattern: GET token from webhook → POST to Apify → poll (all terminal states: SUCCEEDED/FAILED/TIMED-OUT/ABORTED) → GET dataset items with pagination params (`offset`, `limit`, `clean`, `format`)
  - Never use Execute Command
  - Credential Manager webhook setup instructions
- **Claude Code section**: `apify-multi` CLI commands, bash webhook call
- **Codex section**: budget note, CLI reference
- **Gemini section**: role is preprocessing Apify results — do NOT initiate scrapes
- **Ops section**: add/remove accounts, monthly reset (automatic), token validation
- Run lifecycle states documented: READY → RUNNING → SUCCEEDED | FAILED | TIMED-OUT | ABORTED

### 2. Update `apify-multi-account-manager.py`
`brain/ai/skills/custom/apify/apify-multi-account-manager.py`

Four targeted changes:
- **Add `get-token-for-offset` command**: `account_index = (offset // items_per_account) % 10` — enables Pattern A deduplication from CLI
- **Add run tracking**: new `~/.apify-multi/runs.json`, `record-run` command saves `{run_id, account, actor_id, started_at, estimated_cost_usd}`
- **Fix `get_status()` credit tracking**: sum `runs.json` estimates for current month instead of hardcoded `$0`
- **Add depletion-aware skip**: if last run for account has `status == "FAILED_402"`, skip it in rotation

### 3. Fix `apify-multi-cli-wrapper.sh`
`brain/ai/skills/custom/apify/apify-multi-cli-wrapper.sh`

Single change: replace hard-coded `/Users/Office/Repos/...` with `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`.

### 4. Create `n8n-credential-manager-workflow.json`
`brain/ai/skills/custom/apify/n8n-credential-manager-workflow.json`

Deployable n8n workflow spec:
- Webhook: `POST /webhook/apify-next-token` — body: `{caller_id, offset?, items_per_account?}`
- Code node: `index = Math.floor(Date.now() / 86400000) % 10` (or offset-based if provided), reads `$vars['APIFY_TOKEN_' + (index+1)]`
- Set node: builds `{token, account_name, account_index, pagination_offset}`
- RespondToWebhook node: returns JSON

Also includes: one-time n8n variable setup commands for `APIFY_TOKEN_1..10`.

### 5. Update `CLAUDE.md`
`brain/CLAUDE.md`

Two changes:
- `/apify` line → "$50/mo total (10 accounts × $5, round-robin). n8n: use Credential Manager webhook. Budget: ~20-50 runs/month."
- CLIs list → add `apify-multi`

### 6. Update `AGENTS.md` (Codex)
`brain/operations/system-configs/codex/AGENTS.md`

One paragraph: Apify reference → add budget constraint + webhook URL.

### 7. Update `GEMINI.md`
`brain/operations/system-configs/gemini/GEMINI.md`

One paragraph: Apify reference → add budget + "Gemini's role is preprocessing Apify results, not initiating scrapes."

### 8. Trim `operations/runbooks/apify-multi-account.md`
Remove integration examples (moved to SKILL.md). Keep ops-only: credentials management, monthly reset, token validation, troubleshooting. Reduce from ~430 → ~200 lines.

### 9. Delete duplicate files
- `MULTI_ACCOUNT_SETUP.md` → content superseded by SKILL.md
- `n8n-integration-pattern.md` → content superseded by SKILL.md

### 10. Commit all together
One atomic commit: `"rebuild(apify): webhook-based n8n, deduplication patterns, AI-agnostic skill, $50/mo budget"`

## Critical Files

| File | Change |
|------|--------|
| `ai/skills/custom/apify/SKILL.md` | Complete rewrite |
| `ai/skills/custom/apify/apify-multi-account-manager.py` | 4 targeted additions |
| `ai/skills/custom/apify/apify-multi-cli-wrapper.sh` | 1 line fix |
| `ai/skills/custom/apify/n8n-credential-manager-workflow.json` | New file |
| `CLAUDE.md` | 2 line changes |
| `operations/system-configs/codex/AGENTS.md` | 1 paragraph |
| `operations/system-configs/gemini/GEMINI.md` | 1 paragraph |
| `operations/runbooks/apify-multi-account.md` | Trim to ops-only |
| `MULTI_ACCOUNT_SETUP.md` | Delete |
| `n8n-integration-pattern.md` | Delete |

## What Does NOT Change
- `~/.apify-multi/tokens.json` — 10 tokens are correct
- `operations/runbooks/apify.md` — single-account basic reference, leave as-is
- `operations/accounts/credentials-index.md` — Apify section is correct
- Active symlink `ai/skills/active/apify` — no change

## Verification
1. `python3 apify-multi-account-manager.py status` → shows real run-based spend, not $0
2. `python3 apify-multi-account-manager.py get-token-for-offset 300 100` → returns Account 4
3. `apify-multi run apify/web-scraper --input-file test.json` → uses rotated account (relative path works)
4. n8n workflow JSON is valid and deployable via n8n-api.sh
5. `grep "apify" CLAUDE.md AGENTS.md GEMINI.md` → all 3 mention $50/month and webhook
6. `ls ai/skills/custom/apify/` → MULTI_ACCOUNT_SETUP.md and n8n-integration-pattern.md gone
