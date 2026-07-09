# n8n Env-Access Verification Plan — 2026-07-09

**Task:** Task O — Batch 8I controlled n8n env-access verification planning and repo-safe validation
**Status:** plan only; no routing switched, no live n8n triggered, no network calls made
**Starting Brain commit:** `ffdbc8d0 docs: reconcile Mind inbox workflow config`

## Brain latest commit verified

```
ffdbc8d0 docs: reconcile Mind inbox workflow config
```

## Brain dirty status summary

Pre-existing unrelated dirty paths (56 total) — all preserved untouched:
- `M .graphifyignore`
- `M operations/infrastructure/local-apps.json`
- `M operations/infrastructure/local-apps.md`
- `M operations/system-configs/claude/**` (various)
- `M operations/system-configs/codex/**` (various)
- `D operations/system-configs/claude/plans/` (12 deleted plan files)
- `M tools/firecrawl/logs/firecrawl.log`

Relevant workflow files confirmed clean:
- `operations/automations/n8n/workflows/mind-inbox.json` — clean
- `operations/automations/n8n/workflows/mind-inbox-fixed.json` — clean

## Mind read-only status

- **Latest commit:** `c1b5f4a docs: record external Brain workflow validation plan`
- **Dirty paths:** `M wiki/log.md`, `?? Untitled.canvas`, `?? wiki/organisations/prochat/pitch-decks/`
- **Mind was NOT modified in this batch.**

## Dokploy/n8n env config search results

### `N8N_BLOCK_ENV_ACCESS_IN_NODE`

- **Not found in any repo config file.**
- Zero occurrences in: `docker-compose.yml`, `operations/scripts/docker.yaml`, any `.env` file, n8n runbooks, shell scripts, or CLAUDE.md.
- Only occurs in Brain reports (5 total mentions across reconciliation and validation-plan reports), where it is discussed as a hypothetical setting.
- **Live Dokploy value: NOT verified.** No network calls, no Dokploy authentication, no n8n API calls were made in this batch.

### `MIND_INBOX_PATH`

- Present in:
  - `operations/automations/n8n/workflows/mind-inbox.json` — as `process.env.MIND_INBOX_PATH` in Code node (try/catch, fallback `capture/inbox`)
  - `operations/automations/n8n/workflows/mind-inbox-fixed.json` — as `$env.MIND_INBOX_PATH` in Code node (fallback `capture/inbox`)
  - Three Brain reports

### `MIND_FAILED_PATH`

- Present in:
  - `operations/automations/n8n/workflows/mind-inbox-fixed.json` — as `$env.MIND_FAILED_PATH` in Code node (fallback `capture/failed`)
  - Three Brain reports (discussed, referenced)
- NOT present in `mind-inbox.json` (simple deployed workflow has no failure mechanism).

### `GITHUB_MIND_PAT`

- Present in:
  - `operations/automations/n8n/workflows/mind-inbox.json` — used in HTTP Request header expressions via `$env.GITHUB_MIND_PAT` (3 occurrences)
  - `operations/automations/n8n/workflows/mind-inbox-fixed.json` — used in HTTP Request header expressions via `$env.GITHUB_MIND_PAT` (6 occurrences)
- Proven to work in live n8n (`$env` in expression fields).

### `GEMINI_API_KEY`

- Present in:
  - `operations/automations/n8n/workflows/mind-inbox-fixed.json` — used in HTTP Request URL expression via `$env.GEMINI_API_KEY` (1 occurrence)
- NOT present in `mind-inbox.json` (no Gemini classification).

## Current workflow env-access patterns

| Pattern | Where used | Status in n8n |
|---------|-----------|---------------|
| `$env.GITHUB_MIND_PAT` in expression field (HTTP header) | Both workflows | **Proven working** |
| `$env.GEMINI_API_KEY` in expression field (HTTP URL) | `mind-inbox-fixed.json` | **Proven working** (same mechanism) |
| `$env.MIND_INBOX_PATH` in Code node | `mind-inbox-fixed.json` | **Blocked** (observed empty response in Batch 8G) |
| `$env.MIND_FAILED_PATH` in Code node | `mind-inbox-fixed.json` | **Blocked** (same Code-node sandbox) |
| `process.env.MIND_INBOX_PATH` in Code node | `mind-inbox.json` | **Blocked** (same Code-node sandbox, but try/catch gracefully falls back to `capture/inbox`) |

**Key insight:** `$env` and `process.env` in n8n Code nodes share the same sandbox. If one is blocked, both are blocked. Expression-field `$env` uses n8n's expression evaluator, which is a separate sandbox and IS working.

### `mind-inbox.json` static validation

- JSON parse: **PASS**
- `process.env.MIND_INBOX_PATH` present with try/catch: **PASS** (line 23)
- Fallback `capture/inbox` present: **PASS**
- `MIND_FAILED_PATH` absent: **PASS** (workflow has no failure mechanism)
- `capture/failed` absent: **PASS**
- `inbox/new` absent: **PASS** (only via env var override)
- `inbox/failed` absent: **PASS**
- Webhook path `mind-inbox`: **PASS**

### `mind-inbox-fixed.json` static validation

- JSON parse: **PASS**
- `$env.MIND_INBOX_PATH` present: **PASS** (line 71, fallback `capture/inbox`)
- `$env.MIND_FAILED_PATH` present: **PASS** (line 71, fallback `capture/failed`)
- Fallback `capture/inbox` present: **PASS**
- Fallback `capture/failed` present: **PASS**
- `process.env` absent: **PASS** (uses `$env` instead)
- Webhook path `mind-inbox`: **PASS**
- Secondary Code node (line 500) still has hardcoded `capture/inbox/`: **KNOWN** — this is the planned/archival workflow and needs further work

## Architecture decision table

| Option | Description | Risk | Effort | Env-blocker | Recommended? |
|--------|-------------|------|--------|-------------|--------------|
| **A** | Keep Code-node `process.env` + verify `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Requires Dokploy access and changing security setting | Medium (verify + set env + restart n8n) | Must be `false` | Fallback |
| **B** | Add Set node reading `$env.MIND_INBOX_PATH` via expression → pass to Code node as `$json.inboxPrefix` | Low (expression `$env` is proven working) | Low (one new node, edit Code node) | Bypassed entirely | **Strongly recommended** |
| **C** | Keep legacy `capture/inbox` until proven env access | None (current state) | None | Irrelevant | Current safe state |
| **D** | n8n Variables API (create variable, read in Code node) | Low | Medium (API call + Code node edit) | Bypassed but adds management overhead | Not recommended |

### Strong recommendation: Option B

**Rationale:**
1. Expression-field `$env` access is **proven working** (`$env.GITHUB_MIND_PAT` in HTTP headers on live n8n).
2. Does NOT require modifying `N8N_BLOCK_ENV_ACCESS_IN_NODE` — bypasses the Code-node sandbox entirely.
3. No Dokploy access or n8n restart needed.
4. Minimal architectural change: insert one Set node and remove one env-access line in Code node.
5. The Code node then reads `$json.inboxPrefix` — regular data, no sandbox restriction.

**Proposed change to `mind-inbox.json`:**
1. Add an n8n Set/Edit Fields node between `Webhook` and `Prepare Capture`.
2. Set node configuration:
   - Add a new field `inboxPrefix` with value `={{ $env.MIND_INBOX_PATH || 'capture/inbox' }}`
   - Keep all existing fields passing through (Mode: "Add New Field" or "JSON")
3. Edit `Prepare Capture` Code node:
   - Remove `process.env.MIND_INBOX_PATH` try/catch block
   - Read from `$json.inboxPrefix` instead:
     ```javascript
     const inboxPrefix = ($json.inboxPrefix || 'capture/inbox').replace(/^\/+|\/+$/g, '') || 'capture/inbox';
     ```
4. Rewire: `Webhook → Set Node → Prepare Capture`
5. All other nodes remain unchanged.

**Option A remains as a fallback** if Option B proves undesirable for any reason. Option A would require:
- Verify `N8N_BLOCK_ENV_ACCESS_IN_NODE` in Dokploy n8n service env
- If absent or `true`, set to `false` and restart n8n container
- Re-test Code-node `process.env` access
- Currently not feasible without live Dokploy/n8n access

## Safe-state confirmation

**`mind-inbox.json` CANNOT safely switch to `inbox/new` by env var alone.**

Reasons:
1. Code-node env access is blocked in the current sandbox configuration.
2. The try/catch gracefully falls back to `capture/inbox`, which is the current safe behavior.
3. Setting `MIND_INBOX_PATH=inbox/new` in Dokploy has NO EFFECT on the live workflow because the Code node cannot read it.
4. A Set-node architecture (Option B) is required before env-var-driven path switching can work.

## Validation summary

| Check | Result |
|-------|--------|
| Brain latest commit | `ffdbc8d0` verified |
| Brain dirty status | 56 pre-existing unrelated paths, 2 workflow files clean |
| Mind status | `c1b5f4a`, dirty paths preserved, NOT modified |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` in repo config | **Not found** (zero occurrences beyond reports) |
| Live Dokploy value verified | **No** — no network calls made |
| `mind-inbox.json` valid JSON | PASS |
| `mind-inbox-fixed.json` valid JSON | PASS |
| `mind-inbox.json` has `MIND_INBOX_PATH` + `process.env` + fallback | PASS |
| `mind-inbox.json` does NOT have `MIND_FAILED_PATH` | PASS |
| `mind-inbox-fixed.json` has `MIND_INBOX_PATH` + `MIND_FAILED_PATH` + fallbacks | PASS |
| Webhook path `mind-inbox` on both workflows | PASS |

## Boundaries

- **No n8n workflow was triggered.**
- **No network calls were made.**
- **No webhook was fired.**
- **No Mind repo files were modified.**
- **No `.obsidian/app.json` was changed.**
- **No Save-to-Mind routing was switched.**
- **No capture content was moved.**
- **No Dokploy config or live deployment settings were changed.**
- **No `N8N_BLOCK_ENV_ACCESS_IN_NODE` in repo config to change.**
- **Only intended Brain report files were staged.**

## Files changed

- `operations/reports/n8n-env-access-verification-plan-2026-07-09.md` — this report
- `M operations/reports/mind-inbox-workflow-reconciliation-2026-07-09.md` — Batch 8I note added

## Recommendation for Batch 8J

**Implement Option B (Set-node expression-`$env` architecture) on `mind-inbox.json`:**

1. Edit `operations/automations/n8n/workflows/mind-inbox.json`:
   a. Add a Set (Edit Fields) node between `Webhook` and `Prepare Capture`.
   b. Set `inboxPrefix` = `={{ $env.MIND_INBOX_PATH || 'capture/inbox' }}`.
   c. Rewire connections: Webhook → Set Node → Prepare Capture.
   d. Simplify `Prepare Capture` Code node: remove the try/catch block, read `$json.inboxPrefix`.
   e. Preserve all other nodes unchanged.
2. Validate workflow JSON statically (parse, pattern check, path defaults).
3. Deploy to n8n (requires `n8n-api.sh update-workflow` with network access).
4. Run a **controlled offline/static path simulation** after deployment:
   - Simulate `$json.inboxPrefix` = `'capture/inbox'` (env unset) → verify filepath = `capture/inbox/<file>`.
   - Simulate `$json.inboxPrefix` = `'inbox/new'` (env set to target) → verify filepath = `inbox/new/<file>`.
5. Do NOT run a live Save-to-Mind write test until Step 4 passes.
6. Do NOT switch routing to `inbox/new` until a controlled write test confirms the env var is read correctly.

After Batch 8J passes, the routing can be switched by:
- Setting `MIND_INBOX_PATH=inbox/new` in Dokploy n8n env (already done from Batch 8G, now actually read by the workflow).
