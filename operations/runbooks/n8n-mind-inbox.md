# n8n Save to Mind — Mind OS Capture Runbook

**Status:** ✅ Active and verified  
**Workflow ID:** `FwP5INe9qoo1OwGC`  
**Deployed:** 2026-04-09  
**Last updated:** 2026-05-16 — Live Save-to-Mind capture path verified to `capture/inbox/`; webhook endpoint /mind-inbox verified active (200 OK); failure-buffer test path verified to `capture/failed/`; old /brain-inbox returns 404

---

## Purpose

Automates capture and classification of ChatGPT conversations into the Mind personal knowledge management system using PARA methodology (Projects, Areas, Resources, Inbox).

**What it does:**
1. Receives raw text via webhook
2. Gemini Flash classifies into PARA categories with confidence score
3. Generates structured markdown note with classification metadata
4. Commits note to `stevewesthoek/mind` repo in `capture/inbox/` after Mind OS migration deployment; legacy/current production path was `01-inbox/` until the live workflow was updated and tested, and is now verified live on 2026-05-16
5. Obsidian vault syncs automatically

**What it is NOT:**
- Not a final organization system (inbox is classified landing zone only)
- Not the Kanban board (downstream Kanban syncer handles visualization)
- Not the task/project tracker (those are in `03-projects/`, `04-tasks/`, etc.)

---

## Current Source of Truth

This document (`n8n-mind-inbox.md`) is the authoritative reference for the Save to Mind workflow.

---

## Webhook Contract

### Production Endpoint

```
POST https://n8n.prochat.tools/webhook/mind-inbox
```

**Status:** Correct production endpoint  
**Current n8n workflow path:** `/mind-inbox`  
**Migration note:** Webhook path recently updated from `/brain-inbox` to `/mind-inbox` as part of naming standardization

### Request Format

```json
{
  "source": "chatgpt",
  "title": "Conversation topic or title",
  "content": "Full raw text from ChatGPT or other source",
  "type_hint": ""
}
```

**Fields:**
- `source` (required): Label for source ("chatgpt", "shortcut", etc.)
- `title` (required): Topic or heading (Gemini will refine)
- `content` (required): Full text to classify
- `type_hint` (optional): Guidance for Gemini ("This is a resource", "pricing decision", etc.)

### Response Format

```json
{
  "status": "saved",
  "file": "capture/inbox/2026-05-16-slug-title.md",
  "title": "Refined Title",
  "para_type": "project|area|resource|inbox",
  "confidence": 0.95,
  "signal_quality": 0.90
}
```

**Fields:**
- `status`: "saved" on success
- `file`: Relative path in mind repo where note was written
- `title`: Gemini-refined title
- `para_type`: Classified category
- `confidence`: Gemini confidence score (0.0–1.0)
- `signal_quality`: Content quality assessment (0.0–1.0)

---

## Workflow Architecture

### Data Flow

```
Webhook (/mind-inbox) [receives raw capture]
  ↓
Build Gemini Body [prepares classification prompt]
  ↓
Gemini Classify [calls Gemini Flash API]
  ↓
Build Processed Note [generates markdown with frontmatter]
  ↓
Save to GitHub [commits to stevewesthoek/mind repo]
  ↓
Respond [returns success/failure to caller]
```

### Node Details

| Node | Type | Purpose | Details |
|------|------|---------|---------|
| **Webhook** | Trigger | Receives /mind-inbox requests | Path: mind-inbox; Method: POST; Response: responseNode |
| **Build Gemini Body** | Code | Constructs classification prompt | Extracts title, content, source; adds PARA context |
| **Gemini Classify** | HTTP Request | Calls Gemini 2.5 Flash API | Returns: para_type, confidence, signal_quality, summary, key_points |
| **Build Processed Note** | Code | Generates markdown with frontmatter | Creates base64-encoded content for GitHub |
| **Save to GitHub** | HTTP Request | Commits file to mind repo | Auth: GITHUB_MIND_PAT; URL: /repos/stevewesthoek/mind/contents/ |
| **Respond** | Webhook Response | Returns result to caller | Depends on Save to GitHub node |

### Workflow Decisions

**Classification criteria:**
- Keyword analysis (project, strategy, area, resource indicators)
- Content structure (goals, timelines, concepts)
- User context (known businesses, personal interests)

**Output path:**
- Target after Mind OS migration: `capture/inbox/` (never skips, never pre-sorts)
- Legacy/current production path before verification: `01-inbox/`
- Live production path verified on 2026-05-16: `capture/inbox/`
- Filename: `{YYYY-MM-DD}-{slug-title}.md`
- Unique timestamps prevent collisions

---

## Output Note Format

Notes saved to `mind/capture/inbox/` by n8n use this structure. Note that `status` is not produced by n8n; it is added by the auto-router on first processing.

```markdown
---
type: capture
source: chatgpt|shortcut
para_type: project|area|resource|inbox
confidence: 0.95
created: 2026-04-18T08:26:30.198Z
title: Refined Title
tags: []
---

# Refined Title

## Summary

2–3 sentence summary of key insight.

## Key Points

- Point 1
- Point 2
- Point 3

## Content

Full structured content or raw text excerpt.

---
*ChatGPT capture · 2026-04-18 · 95% confidence · suggested: project*
*Review in [[home|Command Center]] — promote to [[03-projects/|projects]], [[05-areas/|areas]], or [[06-resources/|resources]]*
```

**Frontmatter fields (producer-supplied by n8n) — CURRENT STATE:**
- `type: capture` — Always `capture` (identifies capture notes)
- `source` — Source label (e.g. "chatgpt", "shortcut")
- `para_type` — Gemini classification (project, area, resource, or inbox)
- `confidence` — Classification confidence (0.0–1.0)
- `signal_quality` — Content quality assessment (0.0–1.0)
- `created` — ISO 8601 timestamp with timezone (e.g. "2026-04-18T08:26:30.198Z")
- `title` — Refined title (present in captures)
- `tags` — Optional array of tags (empty array if none)
- `area` — User area context (optional, rarely used)

**Frontmatter fields (added by auto-router):**
- `status` — Router status after first processing (review-queue, ready-for-review, or archived-*)

**Producer status (as of 2026-04-18 after manual n8n patch):**
- ✅ `signal_quality` now extracted and included in frontmatter
- ✅ Router routing works correctly: captures with confidence ≥ 0.8 AND signal_quality ≥ 0.8 route to PARA folders
- ✅ Fail-safe logic applies when signal_quality is low or missing
- ✅ Sanitized live workflow uses a runtime Gemini key reference instead of a hardcoded URL key
- ✅ Guarded failure-buffer test path writes recoverable captures to `mind/capture/failed/`

**Sections:**
- **Summary** — Concise overview
- **Key Points** — Bulleted highlights
- **Action Items** — Checklist if applicable
- **Notes** — Full content

---

## Credentials & Security

### GitHub Authentication

**Required:** Commit access to `stevewesthoek/mind` repository

**Credential options (in priority order):**

1. **n8n Managed GitHub Credential** ✅ Recommended
   - Stored encrypted in n8n
   - Rotatable via n8n UI
   - No exposure in workflow JSON
   - Use: n8n credential selector (UI)

2. **Environment Variable: `GITHUB_MIND_PAT`** ✅ Acceptable
   - Set in n8n Dokploy environment
   - Rotatable without workflow edit
   - Referenced as `$env.GITHUB_MIND_PAT` in workflow
   - Requires: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` in Dokploy config
   - Use: Literal `token $env.GITHUB_MIND_PAT` in Authorization header

3. **Hardcoded Token** ❌ DEPRECATED
   - Exposed in workflow JSON
   - Exposes token in backups and exports
   - Not rotatable without workflow edit
   - DO NOT USE

### Token Rotation History

- **2026-04-09:** Initial deployment (token exposed in workflow JSON)
- **2026-04-17:** Token rotated after exposure discovered
  - Old token revoked in GitHub
  - New token placed in `GITHUB_MIND_PAT` environment variable
  - Workflow Authorization header updated to `token $env.GITHUB_MIND_PAT`
  - n8n service restarted

### If Token Is Compromised

1. Revoke immediately in GitHub (Settings → Developer Settings → Tokens → Delete)
2. Create new GitHub PAT with `repo` scope only
3. Update `GITHUB_MIND_PAT` in n8n Dokploy environment
4. Restart n8n service (Dokploy will pick up new env var)
5. Reactivate workflow in n8n UI (post-restart workflows often deactivate)
6. Re-test webhook

### Gemini Authentication

Google Gemini Flash API credentials are pre-configured on n8n.prochat.tools.  
Status: ✅ Active  
Scope: Classification only (not exposed in workflow exports)

---

## Failure Behavior & Pending Buffer

**Current state:**
- ✅ Legacy success path: Classified note → `mind/01-inbox/`
- ✅ Mind OS scaffold exists for target success path: `mind/capture/inbox/`
- ✅ Live success path verified on 2026-05-16: classified note → `mind/capture/inbox/2026-05-16-mind-os-live-deployment-verification.md`
- ✅ Sanitized live success path verified on 2026-05-16: classified note → `mind/capture/inbox/2026-05-16-mind-os-sanitized-workflow-verification.md`
- ✅ Mind OS scaffold exists for failure buffer: `mind/capture/failed/`
- ✅ Failure-buffer test verified on 2026-05-16: `mind/capture/failed/2026-05-16-mind-os-failure-buffer-verification.md`

**Failure buffer target:**
- Success → `mind/capture/inbox/` (classified)
- Gemini failure → `mind/capture/failed/` (raw, recoverable)
- Webhook should return a user-friendly response after failure buffer deployment
- Allows manual or automated retry

See: `FAILURE-BUFFER-IMPLEMENTATION-PLAN.md`

---

## Post-Capture Lightweight Sorting

After capture lands in `capture/inbox/`, the **lightweight inbox sorter** (optional, manual or scheduled) adds triage metadata:

- Clarity score (how well-defined)
- Usefulness score (how valuable)
- Actionability score (does it imply action)
- Suggested destination folder (projects, areas, resources, archive, etc.)

The sorter does NOT move files automatically—user decides whether to move.

See: `operations/runbooks/mind-inbox-sorting.md`

---

## Testing

### Quick Validation Test

```bash
curl -X POST https://n8n.prochat.tools/webhook/mind-inbox \
  -H "Content-Type: application/json" \
  -d '{
    "source": "chatgpt",
    "title": "Save to Mind Test",
    "content": "Testing the Save to Mind workflow to verify it creates a classified capture in the Mind inbox.",
    "type_hint": "This is a test resource."
  }'
```

**Expected response (200 OK):**
```json
{
  "status": "saved",
  "file": "capture/inbox/2026-04-17-save-to-mind-test.md",
  "title": "Save to Mind Test",
  "para_type": "resource",
  "confidence": 0.85,
  "signal_quality": 0.90
}
```

**Next steps:**
```bash
cd ~/Repos/stevewesthoek/mind
git pull
cat capture/inbox/2026-04-17-save-to-mind-test.md
```

### Test Scenarios

| Scenario | Request | Expected |
|----------|---------|----------|
| Normal capture | Valid payload | 200, saved to capture/inbox/ |
| Gemini failure | Valid payload, API down | 404 (workflow inactive) or 500 (API error) |
| Invalid payload | Missing "content" | 400 Bad Request |
| GitHub auth error | Valid payload, token revoked | 401 or 403 |

---

## Updating & Deploying Workflow

### Making Changes in n8n UI

1. Go to: https://n8n.prochat.tools/workflows
2. Find: "Save to Mind — Capture & Classify with Signal Scoring" (ID: FwP5INe9qoo1OwGC)
3. Click to open editor
4. Make changes (e.g., update Gemini prompt, add error handling)
5. Click "Save" (top-left)
6. Verify workflow is "Active" (toggle top-right)
7. Test via webhook

### Deploying from Local Workflow JSON

If editing locally and exporting workflow:

```bash
# Export from n8n
tools/n8n-api.sh get-workflow FwP5INe9qoo1OwGC > workflow-export.json

# Edit workflow-export.json (do not hardcode tokens)

# Deploy back to n8n
tools/n8n-api.sh update-workflow FwP5INe9qoo1OwGC workflow-export.json
```

### Reactivating After Restart

After Dokploy or n8n service restart:

1. Go to n8n dashboard
2. Find workflow by name or ID
3. Toggle "Active" switch (top-right of editor)
4. Confirm toggle shows green/active state
5. Re-test webhook

---

## Troubleshooting

### Webhook Returns 404

**Message:** "The requested webhook is not registered"

**Causes:**
- Workflow is inactive (toggle off)
- Webhook path doesn't match (check n8n UI vs. request URL)
- n8n service restarted recently

**Fix:**
1. Check workflow status in n8n (should show "Active" toggle)
2. If inactive, toggle on in n8n UI
3. Retry webhook test

### Webhook Returns 401/403 (GitHub Auth)

**Message:** "Invalid authentication credentials"

**Causes:**
- GitHub token expired or revoked
- Token doesn't have `repo` scope
- `GITHUB_MIND_PAT` not set in Dokploy environment
- `$env.GITHUB_MIND_PAT` reference broken in workflow

**Fix:**
1. Check GitHub PAT in Dokploy (should be valid, not revoked)
2. Verify scope: `repo` only (Settings → Developer Settings → Tokens)
3. Verify `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` in n8n Dokploy config
4. If a credential was embedded directly in workflow JSON: replace it with the environment-variable based credential reference.

### Gemini Returns Error / Unclassified Captures

**Behavior:** Captures land in inbox but para_type is empty

**Causes:**
- Gemini API rate limit (429)
- Gemini API timeout
- Content is ambiguous (valid but low confidence)
- Invalid JSON response from Gemini

**Workaround:** Manually classify in frontmatter or use sorter script. The failure-buffer branch now preserves recoverable failure captures when the workflow is deliberately exercised with the test-only `type_hint: force-failure-buffer-test` path.

### Captures Not Appearing in Obsidian

**Causes:**
- Obsidian vault not synced (check Obsidian Git plugin)
- File not committed to mind repo yet (check git status in mind/)
- Obsidian cache stale

**Fix:**
1. In Obsidian: Command Palette → "Obsidian Git: Pull"
2. Or: `cd ~/Repos/stevewesthoek/mind && git pull`
3. Or: Reload Obsidian (Command Palette → "Reload app without saving")

---

## Related Files

| File | Purpose |
|------|---------|
| `operations/runbooks/mind-inbox-sorting.md` | Lightweight triage sorter (post-capture) |
| `tools/scripts/mind-inbox-sorter.py` | Sorter script (optional, manual) |
| `FAILURE-BUFFER-IMPLEMENTATION-PLAN.md` | Planned error resilience feature |
| `CREDENTIAL-AUDIT-REPORT-2026-04-17.md` | Credential rotation audit (historical) |
| `operations/automations/n8n/n8n_backup/` | Workflow backups (local reference only) |

---

## History & Migration Notes

**Why "Save to Mind" instead of "Brain Inbox"?**

The system's purpose is to save captures INTO the Mind vault (personal knowledge system).
The workflow saves to the Mind inbox (`capture/inbox/` in `stevewesthoek/mind` repo).
Historical references to "Brain Inbox" are deprecated.

**Endpoint migration:** `/brain-inbox` → `/mind-inbox`

This runbook documents the current, correct naming and endpoint.

---

**Last updated:** 2026-05-16  
**Next review:** After credential rotation or when replacing the test-only failure-buffer trigger with a real recoverable error branch
