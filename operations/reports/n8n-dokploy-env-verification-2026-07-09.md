# n8n Dokploy Environment Verification — 2026-07-09

**Gate verification for mind-inbox workflow deployment**

## Execution Summary

- **Start commit (Brain)**: `d9703e78` — docs: gate n8n inbox deployment
- **Method**: SSH to Dokploy + `docker inspect` on running n8n container (read-only)
- **Status**: Env verification SUCCESSFUL

## Mind Repository Status (Read-Only Verification)

- **Latest commit**: `4da3e56` — docs: prioritize Workbench stability strategy
- **Dirty status**: `M wiki/log.md`, `?? Untitled.canvas`, `?? wiki/organisations/prochat/pitch-decks/`
- **No changes made**: ✅ Confirmed

## Dokploy n8n Container Environment

### Target Container

- **Container ID**: `455559609daa`
- **Container name**: `apps-internal-n8n-cvjx2s-n8n-1`
- **Inspection method**: `ssh dokploy` → `docker inspect` → `Config.Env`

### Verified Environment Variables

#### `MIND_INBOX_PATH`

- **Status**: **NOT SET** / **UNSET**
- **Current value**: Empty / absent from environment
- **Behavior**: Workflow will use fallback value `capture/inbox` per line 24 of `mind-inbox.json`
- **Risk**: **LOW** — Routing will stay at legacy path

#### `MIND_FAILED_PATH`

- **Status**: **NOT SET** / **UNSET**
- **Visible in container env**: No
- **Note**: This variable is not currently used in the environment

#### `N8N_BLOCK_ENV_ACCESS_IN_NODE`

- **Status**: **SET**
- **Current value**: `false`
- **Meaning**: Environment variable access is allowed in n8n node code
- **Implication**: The workflow can read `$env.MIND_INBOX_PATH` safely

### Other Key Environment Variables

Verified present and correct:

- `N8N_HOST=n8n.prochat.tools`
- `N8N_PROTOCOL=https`
- `N8N_PORT=5678`
- `N8N_ENCRYPTION_KEY=[set]`
- `DB_TYPE=postgresdb`
- `GITHUB_MIND_PAT=[set]`

Full container env confirmed consistent with Dokploy Compose configuration.

## Workflow Verification

**File**: `operations/automations/n8n/workflows/mind-inbox.json`

**Fallback routing logic** (line 24 of workflow):
```javascript
"inboxPrefix": "={{ ($env.MIND_INBOX_PATH || 'capture/inbox').trim().replace(/^\\/+|\\/+$/g, '') || 'capture/inbox' }}"
```

**Parsing**:
1. If `$env.MIND_INBOX_PATH` is set and non-empty: use it (trimmed, slashes normalized)
2. If `$env.MIND_INBOX_PATH` is unset or empty: fall back to `capture/inbox`
3. If the trimmed result is empty: fall back again to `capture/inbox`

**Current behavior**: Since `MIND_INBOX_PATH` is unset, routing **stays at `capture/inbox`**.

## Risk Classification

**Risk Level**: **LOW — DEPLOYMENT APPROVED**

**Rationale**:
- `MIND_INBOX_PATH` is unset in Dokploy n8n container environment
- Workflow fallback to `capture/inbox` is correctly implemented
- Live routing will NOT change upon deployment
- No routing switch; no operational impact on existing capture paths
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is safe and expected

## Deployment Readiness

**Status**: ✅ **APPROVED FOR DEPLOYMENT**

**Deployment decision**: Safe to deploy `mind-inbox.json` workflow with confidence that:
1. Live capture routing will preserve legacy `capture/inbox` path
2. No unintended inbox path changes will occur
3. Environment is structurally sound for workflow activation

## Validations

- ✅ No deployment performed
- ✅ No n8n workflow triggered
- ✅ No webhook sent
- ✅ No network mutation performed
- ✅ No Mind files changed
- ✅ No capture content moved
- ✅ No roadmap updated
- ✅ No implementation plan updated
- ✅ Brain dirty status preserved (only generated/known files)
- ✅ Mind read-only status preserved (no changes)

## Batch 8M Deployment Follow-Up

**Batch 8M executed 2026-07-09T16:28:20Z**

- **Deployment status**: ✅ Workflow successfully deployed via n8n API
- **Workflow version**: versionId `a419673f-2038-41e1-953d-ae38719c51cb`, counter 278
- **Routing preserved**: Yes — `MIND_INBOX_PATH` remained unset, fallback to `capture/inbox` active
- **Deployment report**: `operations/reports/n8n-inbox-workflow-deployment-2026-07-09.md`

## Notes

- Dokploy API (`/project.all` and `/compose.all`) endpoints are documented and working for future env inspections
- Container inspection via `ssh dokploy` + `docker inspect` is the primary verified method for Dokploy compose service env reading
- No safe Dokploy CLI alternate (CLI returns 401 per infra.md)
- n8n API requires authentication credentials; container inspection is cleaner for env-only reads
