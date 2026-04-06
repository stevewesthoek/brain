# Custom GPT — "Save to Brain"

Setup guide for the ChatGPT Custom GPT that sends conversations to your brain via n8n.

---

## Step 1 — Prerequisites (do these first)

### 1a. Get a free Gemini API key
1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**
3. Copy the key

### 1b. Add Gemini API key to n8n
1. Open n8n → **Settings → Variables**
2. Create variable: `GEMINI_API_KEY` = your key

### 1c. Add GitHub credential to n8n
1. Open n8n → **Credentials → New → GitHub**
2. Name it: `GitHub Brain`
3. Access token: create one at https://github.com/settings/tokens
   - Scope needed: `repo` (read + write contents)
4. Save

### 1d. Import the workflow
1. Open n8n → **Workflows → Import from file**
2. Select: `brain/tools/n8n-brain-inbox.json`
3. Click the **GitHub — Save to Inbox** node → assign the `GitHub Brain` credential
4. **Activate** the workflow (toggle top right)
5. Copy the webhook URL shown in the Webhook node (looks like `https://n8n.prochat.tools/webhook/brain-inbox`)

---

## Step 2 — Create the Custom GPT

1. Go to https://chatgpt.com → **Explore GPTs → Create**
2. Click **Configure** tab
3. Fill in:

**Name:** Save to Brain

**Description:** Saves this conversation to my personal knowledge base with AI structuring.

**Instructions:**
```
You are a knowledge capture assistant. When the user asks to save, capture, or send a conversation to their brain/notes, you:

1. Summarise the current conversation into a structured format
2. Ask the user for a short title if they haven't provided one
3. Call the saveToBrain action with the title and full conversation summary
4. Confirm what was saved and where it will be classified

Be concise. Do not add unnecessary commentary. When the user says "save this", "send to brain", "capture this", or similar — act immediately.
```

---

## Step 3 — Add the Action

In the Custom GPT editor, click **Add actions** → paste this schema:

```yaml
openapi: 3.1.0
info:
  title: Brain API
  version: 1.0.0
  description: Save conversations to personal knowledge base
servers:
  - url: https://n8n.prochat.tools
paths:
  /webhook/brain-inbox:
    post:
      operationId: saveToBrain
      summary: Save a conversation or idea to the personal brain inbox
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - title
                - content
              properties:
                title:
                  type: string
                  description: Short descriptive title for this note (max 8 words)
                content:
                  type: string
                  description: The full conversation content or key ideas to save
                type_hint:
                  type: string
                  enum: [project, area, resource, brainstorm, task]
                  description: Optional hint about what type of content this is
      responses:
        "200":
          description: Saved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  file:
                    type: string
                  title:
                    type: string
                  type:
                    type: string
                  confidence:
                    type: number
```

4. Set **Authentication** to None (the webhook is protected by the unique URL)
5. Click **Save**

---

## Step 4 — Install Obsidian Git plugin

This makes notes appear in Obsidian automatically within 5 minutes of being saved.

1. Open Obsidian → Settings → Community plugins → Browse
2. Search: **Obsidian Git** → Install → Enable
3. Settings are pre-configured in `.obsidian/plugins/obsidian-git/data.json`
   - Auto-pulls every 5 minutes
   - Auto-commits Obsidian changes every 10 minutes

---

## How to use it

**In any ChatGPT conversation:**
```
"Save this to my brain"
"Capture this conversation — title: SaaS pricing strategy"
"Send this to brain as a resource"
"Save this as a project idea"
```

The Custom GPT will:
1. Summarise the conversation
2. POST to your n8n webhook
3. Gemini Flash classifies it (free)
4. A structured note appears in `notes/inbox/` within seconds
5. Obsidian Git pulls it within 5 minutes

**Then in Obsidian:**
- Open `notes/home.md` → see it in the Inbox section
- Review the note (frontmatter shows `para_type` suggestion + confidence %)
- Ask Claude: *"process my inbox"* — I'll move items to the right PARA folder

---

## Webhook URL

After importing and activating the workflow in n8n, the webhook URL is:
```
https://n8n.prochat.tools/webhook/brain-inbox
```

Test it manually:
```bash
curl -X POST https://n8n.prochat.tools/webhook/brain-inbox \
  -H "Content-Type: application/json" \
  -d '{"title": "Test capture", "content": "This is a test note to verify the pipeline works."}'
```
