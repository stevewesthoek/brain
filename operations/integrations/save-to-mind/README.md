# Save to Mind — ChatGPT Custom GPT Integration

ChatGPT custom GPT that captures conversations and ideas directly into your personal knowledge management system (Obsidian vault).

## What it does

Uses the `/webhook/mind-inbox` endpoint on n8n to:
1. Accept conversation text or ideas from ChatGPT
2. Classify content using PARA method (Projects, Areas, Resources, Inbox)
3. Generate structured markdown notes with metadata
4. Commit directly to `stevewesthoek/mind` repo in `01-inbox/` folder
5. Auto-sync with Obsidian

## Setup Instructions

### 1. Create the ChatGPT Custom GPT

In ChatGPT:
- Go to **My GPTs** → **Create a new GPT**
- Name: "Save to Mind"
- Description: "Capture conversations and ideas into my personal knowledge base"

### 2. Configure the Action

In the Custom GPT editor:
- Go to **Actions** section
- Click **Create new action**
- Paste the schema from `openapi.json` into the schema editor

**Alternative: Use the Schema URL**
If hosted, you can reference: `{your-domain}/operations/integrations/save-to-mind/openapi.json`

### 3. No Authentication Required

The n8n webhook (`/webhook/mind-inbox`) is public. No API key needed.

### 4. Test the Integration

Send a message to the Custom GPT like:
```
Save this to my mind: I learned about PARA method today. 
It's a framework for organizing information: Projects, Areas, Resources, Inbox.
```

The GPT should:
1. Call the `/webhook/mind-inbox` action
2. Return confirmation with the file path
3. File should appear in `mind/01-inbox/` within seconds

## Schema Details

**Endpoint:** `POST https://n8n.prochat.tools/webhook/mind-inbox`

**Request:**
```json
{
  "source": "chatgpt",
  "title": "Short title",
  "content": "Full content to save",
  "type_hint": "project|area|resource|inbox"
}
```

**Response:**
```json
{
  "status": "saved",
  "result": "file_committed",
  "file": "01-inbox/2026-04-17-short-title.md",
  "title": "Short title",
  "para_type": "resource",
  "confidence": 0.95,
  "signal_quality": 0.9
}
```

## Workflow Details

See `operations/runbooks/n8n-mind-inbox.md` for the full n8n workflow documentation, including:
- Node architecture
- PARA classification logic
- GitHub API integration
- Troubleshooting guide

## Files

| File | Purpose |
|------|---------|
| `openapi.json` | ChatGPT custom GPT action schema — import into Actions |
| `SYSTEM_PROMPT.md` | System instructions for the Custom GPT — copy into Instructions field |
| `README.md` | This file — setup and usage guide |

## Related

- **N8N Workflow:** `brain/operations/runbooks/n8n-mind-inbox.md`
- **Workflow ID:** `FwP5INe9qoo1OwGC`
- **Target Repository:** `stevewesthoek/mind`
- **Target Folder:** `mind/01-inbox/`
- **Credentials:** GitHub PAT for `stevewesthoek/mind` repo (stored in n8n)
