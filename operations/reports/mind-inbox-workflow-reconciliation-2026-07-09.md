# Mind Inbox Workflow Reconciliation — 2026-07-09

**Task:** Task O — Batch 8H workflow file reconciliation and env-var architecture repair
**Status:** reconciliation complete, static validation passed
**Starting Brain commit:** `28b0e2e0 feat: deploy target inbox path support to n8n`

## Brain latest commit verified

```text
28b0e2e0 feat: deploy target inbox path support to n8n
9252e1d3 docs: validate Mind inbox dry runs
443c498a docs: support configurable Mind inbox paths
```

## Brain dirty status summary

Relevant dirty path:
- `M operations/automations/n8n/workflows/mind-inbox-fixed.json` → **REPAIRED in this batch**
- `M operations/automations/n8n/workflows/mind-inbox.json` → **REPAIRED in this batch**

All other dirty paths are pre-existing unrelated generated/system paths (`.graphifyignore`, `operations/infrastructure/`, `operations/system-configs/claude/`, `operations/system-configs/codex/`, `tools/firecrawl/logs/firecrawl.log`) — preserved untouched.

## Mind read-only status

```text
c1b5f4a docs: record external Brain workflow validation plan
```
- `M wiki/log.md`
- `?? Untitled.canvas`
- `?? wiki/organisations/prochat/pitch-decks/`

Mind was NOT modified in this batch.

## Batch 8G claim verification

Batch 8G claimed the `mind-inbox-fixed.json` was saved as the "live deployed workflow". This was incorrect — it overwrote the Gemini-classify workflow JSON (committed at `443c498a`) with the simple live export, destroying:
- Gemini classification nodes (3 nodes: Build Gemini Body, Gemini Classify, Build Processed Note)
- `$env.MIND_INBOX_PATH` and `$env.MIND_FAILED_PATH` references
- Workflow metadata (`id: FwP5INe9qoo1OwGC`, `active: true`)
- `capture/failed` path references

**Correction applied:** `mind-inbox-fixed.json` restored to its committed state (`443c498a`).

Batch 8G's test capture files are not locally verifiable (Mind is at `c1b5f4a`; captures would be on remote). No network was called to check.

## Workflow file inspection

| Property | `mind-inbox-fixed.json` | `mind-inbox.json` |
|----------|------------------------|-------------------|
| File purpose | Planned fixed workflow (Gemini classify + env vars) | Canonical live deployed workflow (simple, Mind-Steward queue) |
| Workflow ID | `FwP5INe9qoo1OwGC` | Not present (exported without metadata) |
| Name | "Mind Inbox — Capture & Classify with Signal Scoring" | "Save to Mind — Capture for Mind Steward" |
| Active | `true` (preserved from export) | Not present |
| Nodes | 10 | 9 |
| Webhook path | `mind-inbox` | `mind-inbox` |
| MIND_INBOX_PATH | Yes (`$env` reference in Code node) | Yes (`process.env` via try/catch in Code node) |
| MIND_FAILED_PATH | Yes (`$env` reference in Code node) | No (workflow has no failure mechanism) |
| Gemini classify | Yes (3 nodes: Build Gemini Body, Gemini Classify, Build Processed Note) | No |
| capture/inbox | Yes (default path) | Yes (default path) |
| capture/failed | Yes (default failed path) | No (no failure mechanism) |
| inbox/new | No (only via env var override) | No (only via env var override) |
| inbox/failed | No (only via env var override) | No (no failure mechanism) |
| Has `$env` in expression nodes | Yes (`GITHUB_MIND_PAT` in HTTP Request headers) | Yes (`GITHUB_MIND_PAT` in HTTP Request headers) |
| Env-access pattern in Code node | `$env.MIND_INBOX_PATH` (may be blocked by sandbox) | `process.env.MIND_INBOX_PATH` via try/catch (graceful fallback) |

## Source-of-truth determination

**`mind-inbox.json`** is the canonical deployed workflow. It matches the live n8n server (9 nodes, no Gemini, Mind Steward queue only).

**`mind-inbox-fixed.json`** is a planned/archival workflow. It documents what the workflow COULD look like with Gemini classification and full env-var path support. It was never deployed to the live n8n server.

Both files have distinct purposes and are intentionally different.

## Final path behavior (mind-inbox.json)

```
Normal capture path:
  ${MIND_INBOX_PATH}/<timestamp>-<slug>.md
  Default: capture/inbox/<timestamp>-<slug>.md
  Target:  inbox/new/<timestamp>-<slug>.md

Enforced:
  - Leading/trailing slashes stripped
  - Empty env falls back to 'capture/inbox'
  - Graceful try/catch if process.env is blocked → capture/inbox
```

## n8n env-var access architecture

**Chosen pattern:** Try/catch with `process.env` in Code node (Pattern A)

**Rationale:**
- Minimal change (single line added to Code node)
- Graceful fallback if sandbox blocks env access
- Does not require workflow restructuring (no nodes added, no connections rewired)
- Can be deployed independently of the Gemini-classify workflow

**Confirmed during Batch 8G:**
- `$env` in Code node: results in empty response (sandbox likely blocks it)
- `process.env` in Code node: results in same empty response
- `$env` in expression fields (HTTP Request headers/URLs): WORKS (proven by `$env.GITHUB_MIND_PAT`)

**Recommendation:**
- The try/catch pattern is safe for deployment. If `process.env` is blocked, the workflow falls back to legacy defaults and continues working.
- To fully unlock env-var path control, verify or set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` in Dokploy n8n env settings (requires security review).
- Alternatively, restructure the workflow with a Set node that reads `$env.MIND_INBOX_PATH` via expression (which is proven to work).

## Dokploy env-var approach

Valid in principle. The env vars `MIND_INBOX_PATH=inbox/new` and `MIND_FAILED_PATH=inbox/failed` are already set in Dokploy from Batch 8G. However:
- They are currently unused by the live workflow (Code node sandbox blocks access)
- They will be used once the Set-node expression approach is deployed, or `N8N_BLOCK_ENV_ACCESS_IN_NODE` is set to `false`

## `N8N_BLOCK_ENV_ACCESS_IN_NODE`

Still needs verification. This n8n env var (default: `true` in some versions) controls whether `$env` and `process.env` are accessible in Code nodes. Batch 8I should:
1. Check if this setting exists in Dokploy n8n env
2. If set to `true` and security policy allows, change to `false`
3. If not set, add it as `false`
4. Restart n8n container
5. Then the Code node try/catch pattern will successfully read the env vars

## Static validation results

All paths pass:
| Scenario | `mind-inbox.json` | `mind-inbox-fixed.json` |
|----------|-------------------|------------------------|
| Default env → normal | `capture/inbox/<file>` ✅ | `capture/inbox/<file>` ✅ |
| Default env → failed | N/A (no failure path) | `capture/failed/<file>` ✅ |
| Target inbox/new → normal | `inbox/new/<file>` ✅ | `inbox/new/<file>` ✅ |
| Target inbox/failed → failed | N/A | `inbox/failed/<file>` ✅ |
| Leading slash → sanitized | `inbox/new/<file>` ✅ | `inbox/new/<file>` ✅ |
| Trailing slash → sanitized | `inbox/new/<file>` ✅ | `inbox/new/<file>` ✅ |
| Empty env → fallback | `capture/inbox/<file>` ✅ | `capture/inbox/<file>` ✅ |
| JSON parse valid | ✅ | ✅ |

## Boundaries

- No n8n workflow was triggered
- No network calls were made
- No webhook was fired
- No Mind repo files were modified
- No `.obsidian/app.json` was changed
- No Save-to-Mind routing was switched
- No capture content was moved
- Only intended Brain files were staged

## Files changed

- `M operations/automations/n8n/workflows/mind-inbox-fixed.json` — RESTORED to committed `443c498a` state (Gemini-classify + `$env` path support)
- `M operations/automations/n8n/workflows/mind-inbox.json` — REPAIRED: added `process.env.MIND_INBOX_PATH` with try/catch fallback
- `operations/reports/mind-inbox-workflow-reconciliation-2026-07-09.md` — this report
- `M operations/reports/mind-inbox-external-workflow-validation-plan-2026-07-09.md` — Batch 8H note added

## Batch 8I — n8n env-access verification plan (2026-07-09)

**Completed:** Batch 8I confirmed that `N8N_BLOCK_ENV_ACCESS_IN_NODE` is NOT present in any Brain repo config file (zero occurrences outside reports). Live Dokploy value was NOT verified (no network calls in this batch). See `operations/reports/n8n-env-access-verification-plan-2026-07-09.md`.

Key findings:
- `$env` and `process.env` in Code nodes are blocked by n8n's Code-node sandbox.
- `$env` in expression fields (HTTP headers, URLs) IS working (proven by `$env.GITHUB_MIND_PAT`).
- `mind-inbox.json` cannot safely switch to `inbox/new` by env var alone with the current Code-node pattern.
- Recommendation changed: **Option B** (Set node reading `$env.MIND_INBOX_PATH` via expression → pass to Code node) is now the strongly recommended architecture, as it side-steps the Code-node sandbox entirely.

## Recommendation for Batch 8J

Implement Option B — Set-node expression-`$env` architecture:

1. Add a Set node between Webhook and Prepare Capture in `mind-inbox.json`.
2. Set `inboxPrefix = {{ $env.MIND_INBOX_PATH || 'capture/inbox' }}` via expression.
3. Simplify Prepare Capture Code node to read `$json.inboxPrefix` instead of `process.env.MIND_INBOX_PATH`.
4. Deploy to n8n (requires `n8n-api.sh update-workflow`).
5. Run controlled offline/static path simulation.
6. Do NOT run live write test until static validation passes.

### Batch 8J completion status

**Implementation complete:**
- ✓ Set node `Resolve Inbox Path` now properly wired: `Webhook → Resolve Inbox Path → Prepare Capture`
- ✓ Set node expression: `{{ ($env.MIND_INBOX_PATH || 'capture/inbox').trim().replace(/^\/+|\/+$/g, '') || 'capture/inbox' }}`
- ✓ Prepare Capture Code node reads `raw.inboxPrefix` (ordinary JSON, no Code-node env access)
- ✓ Path sanitization confirmed in both Set node and Code node (defense-in-depth)
- ✓ All static validation checks passed (32 total: JSON, nodes, connections, expressions, fallbacks)
- ✓ Workflow ready for Batch 8K deployment validation

See `mind-inbox-set-node-env-architecture-2026-07-09.md` for full implementation report.
