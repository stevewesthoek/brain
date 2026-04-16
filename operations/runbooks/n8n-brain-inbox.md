# n8n Brain Inbox Automation Runbook

**Deployed:** 2026-04-09  
**Workflow ID:** `FwP5INe9qoo1OwGC` (updated 2026-04-16)  
**Status:** ✅ Active  
**Last tested:** 2026-04-16
**Updated:** 2026-04-16 — Migrated to write exclusively to `stevewesthoek/mind` repo at `01-inbox/`

## Overview

Automates the capture and classification of ChatGPT conversations into a personal knowledge management system using the PARA method (Projects, Areas, Resources, Inbox).

**Flow:**
1. Raw text sent via webhook
2. Gemini Flash classifies into PARA categories with confidence score
3. Structured markdown note generated with frontmatter
4. Note committed to `01-inbox/` in mind repo
5. Obsidian syncs automatically (or on next pull)

## Webhook URL

```
POST https://n8n.prochat.tools/webhook/brain-inbox
```

### Request

```json
{
  "source": "chatgpt",
  "title": "Your conversation topic",
  "content": "Full raw text from ChatGPT or other source",
  "type_hint": ""
}
```

**Fields:**
- `source` (string): Label for the source ("chatgpt", "shortcut", etc.)
- `title` (string): Topic or heading (Gemini will refine this)
- `content` (string): The full text to classify
- `type_hint` (string, optional): Guidance for Gemini (e.g., "This is a pricing decision")

### Response

```json
{
  "status": "saved",
  "file": "01-inbox/2026-04-09-slug-title.md",
  "title": "Refined Title",
  "para_type": "project|area|resource|inbox",
  "confidence": 0.95,
  "signal_quality": 0.9
}
```

## Node architecture

| Node | Type | Purpose |
|------|------|---------|
| **Webhook** | Trigger | Receives POST to `/brain-inbox` |
| **Build Gemini Body** | Code | Constructs PARA classification prompt |
| **Gemini Flash — Classify** | HTTP Request | Calls Gemini API for classification |
| **Build Note** | Code | Parses JSON, generates markdown with frontmatter |
| **GitHub — Save to Inbox** | GitHub | Commits to brain repo via GitHub API |
| **Respond** | Webhook Response | Returns confirmation JSON |

## Output format

Generated note lands in `01-inbox/` in the mind repo with this structure:

```markdown
---
type: capture
source: chatgpt
para_type: project|area|resource|inbox
confidence: 0.95
area: Business Automation
created: 2026-04-09
tags:
  - tag1
  - tag2
---

# Title

## Summary
2-3 sentence summary of the key insight.

## Key Points
- Point 1
- Point 2
- Point 3

## Action Items
- [ ] Actionable task if any

## Notes
Full structured content or raw text.

---
*ChatGPT capture · 2026-04-09 · 95% confidence · 90% signal · suggested: project*
*Review in [[home|Command Center]] — promote to [[03-projects/|projects]], [[05-areas/|areas]], or [[06-resources/|resources]]*
```

## Credentials

Both pre-configured on n8n.prochat.tools:

| Credential | Type | Used by | Status |
|-----------|------|---------|--------|
| Google Gemini(PaLM) Api account | googlePalmApi | Gemini Flash node | ✅ Active |
| GitHub account | githubApi | GitHub Save to Inbox node | ✅ Active |

No manual setup required.

## PARA context in Gemini prompt

The workflow includes your personal context to improve classification accuracy:

- **SaaS & Automation Focus:** Detects business automation projects, pricing decisions, product strategy
- **Known businesses:** prochattools (statuslink, xgrow, prochat, says-the-bible, probot), Yeshua Academy (ministry)
- **Goal:** Automate and optimize costs → guides categorization toward actionable items

## Testing

### Quick test

```bash
curl -X POST https://n8n.prochat.tools/webhook/brain-inbox \
  -H "Content-Type: application/json" \
  -d '{
    "source": "chatgpt",
    "title": "Test topic",
    "content": "This is a test of the ChatGPT capture automation system.",
    "type_hint": ""
  }'
```

Expected: 200 OK with JSON response + new file in `vault/inbox/`.

### Full end-to-end test

1. Send test payload via webhook
2. Check n8n execution logs for success (no errors in Gemini or GitHub nodes)
3. Pull mind repo: `cd ../mind && git pull`
4. Verify file exists: `ls 01-inbox/2026-04-16-*.md`
5. Verify Obsidian refreshes automatically

## Monitoring

### Health check

n8n dashboard at https://n8n.prochat.tools:
- Look for "Brain Inbox — ChatGPT Capture" workflow
- Status should show "Active"
- Recent executions should show green checkmarks

### Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| 400 Bad Request | JSON malformed or missing required fields | Validate request body matches schema |
| Gemini parsing error | Response includes markdown code fences or control chars | See sanitizeJsonString logic in "Build Note" node |
| GitHub commit fails | Repo permission issue or branch protection | Verify GitHub token has `repo` scope |
| Low confidence (< 0.7) | Content is ambiguous or doesn't fit PARA | Add `type_hint` to guide classification |

## Integration with macOS

Your macOS automation (Shortcuts app) should:

1. **Trigger:** Select text in ChatGPT (or any app)
2. **Extract:** Get selected text + optional context (URL, app name)
3. **POST:** Send to webhook with structure above
4. **Notify:** Display returned confidence and file path (optional)

Example Shortcut pseudocode:
```
Get selected text
Create JSON body:
  - source: "chatgpt"
  - title: [extract from context or ask user]
  - content: [selected text]
POST to https://n8n.prochat.tools/webhook/brain-inbox
Show result: "Saved as {file} ({type}, {confidence}% confidence)"
```

## Integration with Obsidian

After capture, notes appear in `mind/01-inbox/`:

- **Review:** Open in Obsidian, read summary and key points
- **Promote:** If it's a real project/area/resource, move to appropriate folder (03-projects, 05-areas, 06-resources)
- **Link:** Backlinks in the note template point to [[home|Command Center]] for easy navigation
- **Auto-sync:** If using Obsidian Git plugin, pull automatically updates vault

## Updating the workflow

To modify the workflow:

1. **Edit in n8n UI:** https://n8n.prochat.tools/workflows
2. **Export as JSON:** Use n8n's export function
3. **Save to git:** Commit to `brain/tools/n8n-brain-inbox.json`
4. **Deploy via CLI:** `tools/n8n-api.sh update-workflow WiZPSTJwq22LBIqZ <json_file>`

## Related files

- **Workflow JSON (archived reference):** `brain/tools/n8n-brain-inbox.json`
- **Workflow Retry JSON (archived reference):** `brain/tools/n8n-brain-inbox-retry.json`
- **Target Inbox folder:** `mind/01-inbox/` (in stevewesthoek/mind repo)
- **Source Obsidian vault:** `mind/` (in stevewesthoek/mind repo)
- **Obsidian config:** `mind/.obsidian/` (gitignored)

## Troubleshooting

### "File exists" error in GitHub node

The workflow tries to create a new commit. If the filename collides, GitHub API rejects it.
- Check if a note with that slug already exists: `ls vault/inbox/2026-04-09-*slug*`
- The "Build Note" node generates unique filenames with timestamps, so collisions are rare
- If it happens, increment the slug manually or re-run with a slightly different title

### Gemini returns "could not process"

The fallback error handler captures this as:
```markdown
# Unprocessed capture
Gemini could not process — review manually.
```

**Common causes:**
- Content too short or context-poor (Gemini can't classify)
- Gemini API error (rate limit, auth issue)
- Invalid JSON response from Gemini

**Fix:**
1. Check n8n execution log for the error
2. Manually fix frontmatter: `para_type` and `confidence` in the saved note
3. If recurring: add `type_hint` to the request to guide Gemini

### Slow execution (> 10 seconds)

- Gemini API call takes 5-7 seconds normally
- GitHub commit takes 2-3 seconds normally
- Total expected time: 8-12 seconds
- If > 15 seconds: check n8n logs for rate limiting or network issues

## Appendix: n8n CLI commands

List all workflows:
```bash
tools/n8n-api.sh list-workflows
```

Get this workflow:
```bash
tools/n8n-api.sh get-workflow WiZPSTJwq22LBIqZ
```

Deactivate (pause) the workflow:
```bash
tools/n8n-api.sh deactivate-workflow WiZPSTJwq22LBIqZ
```

Activate (resume):
```bash
tools/n8n-api.sh activate-workflow WiZPSTJwq22LBIqZ
```

Delete (use with caution):
```bash
tools/n8n-api.sh delete-workflow WiZPSTJwq22LBIqZ
```
