# WhatsApp Business API Integration

**Status:** ✅ Scaffold Complete · ⚠️ Token Validation Pending  
**Created:** 2026-04-12 · **Ready for:** Claude, Codex, Gemini

---

## What's Included

This skill provides **complete bi-directional WhatsApp integration** for ProChat infrastructure:

### ✅ Installed Components

1. **Python SDK** (`lib/whatsapp_sdk.py`)
   - Full WhatsApp Cloud API client
   - Send text, media, templates, interactive messages
   - Webhook event parsing and handling
   - 100% type-hinted, production-ready

2. **CLI Wrapper** (`whatsapp-cli.py`)
   - Global CLI: `whatsapp send`, `whatsapp list-templates`, etc.
   - 8 commands for all major operations
   - JSON output for scripting
   - Help: `whatsapp --help`

3. **n8n Workflow Templates** (`templates/`)
   - `n8n-webhook-listener.json` — Receive messages/webhooks
   - `n8n-message-sender.json` — Send messages from workflows
   - Ready to import and activate

4. **Credentials Management** (`~/.config/whatsapp/.env`)
   - All 8 required Meta/WhatsApp credentials stored
   - Updated in credentials index (`brain/operations/accounts/credentials-index.md`)
   - Gitignored; local machine only

5. **Documentation**
   - `SKILL.md` — Feature overview and examples
   - `README.md` — This file
   - `operations/runbooks/whatsapp-business-api.md` — Full runbook
   - `lib/whatsapp_sdk.py` — Inline API reference

### ⚠️ Known Issue: Token Validation

The provided access token returns **"Invalid OAuth access token - Cannot parse access token"** error from Meta API. This typically indicates:
- Token format issue during copy-paste (contains URL-encoded characters?)
- Token genuinely expired/revoked
- Permission scope mismatch

**Resolution:** See "Token Regeneration" section below.

---

## Quick Start

### 1. Verify Setup

```bash
# Check credentials are loaded
source ~/.config/whatsapp/.env
echo $WHATSAPP_PHONE_NUMBER

# Output should show: 949-776-2428
```

### 2. Test Connection (Will Fail Until Token Fixed)

```bash
whatsapp test
```

Expected on success:
```
Testing WhatsApp Business API connection...
✓ Connection successful: 949-776-2428
```

Expected on token error:
```
Testing WhatsApp Business API connection...
✗ Connection failed: Invalid OAuth access token - Cannot parse access token
```

### 3. Send Your First Message

```bash
whatsapp send --phone 19491234567 --text "Hello from WhatsApp!"
```

### 4. Programmatic Usage (Python)

```python
from whatsapp_sdk import WhatsAppClient

client = WhatsAppClient()
response = client.send_message(to="19491234567", text="Hi!")
print(f"Sent: {response['messages'][0]['id']}")
```

---

## Token Regeneration

### Why It Failed

The access token you provided is being rejected. Most likely cause:
- **Copy-paste encoding issue** — Browser/clipboard added URL encoding
- **Token expired** — Temporary tokens expire ~2 hours
- **Permissions mismatch** — Token needs `whatsapp_business_messaging` scope

### How to Fix It

**Option 1: Regenerate via Browser (Recommended)**

1. Go to: https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup
2. Click **"Generate Long-Lived Token"** button
3. Copy the token by clicking the **"Copy"** button (not manual selection)
4. Send it to me in this format:
   ```
   New token: <paste token here>
   ```
5. I'll update the `.env` file and test immediately

**Option 2: Use Graph API Explorer (Testing)**

1. Go to: https://developers.facebook.com/tools/explorer
2. Select app: `819349503541241` (top right)
3. Paste your token into the **Access Token** field
4. Leave endpoint as `/me`
5. Click **Submit**
6. If it fails, screenshot the error and send it to me

---

## Available Commands

### Messaging

```bash
# Send text
whatsapp send --phone 19491234567 --text "Hello!"

# Send template
whatsapp send-template --phone 19491234567 --template hello_world --lang en

# Send media (image/video/audio/document)
whatsapp send-media --phone 19491234567 --url https://... --type image --caption "Photo"

# Send interactive (buttons)
whatsapp send-interactive --phone 19491234567 --header "Choose" --body "Pick one" --buttons "A,B,C"

# Mark message as read
whatsapp mark-read --message-id wamid.1234567890
```

### Templates

```bash
# List all templates
whatsapp list-templates

# List approved templates only
whatsapp list-templates --status APPROVED

# Get template details
whatsapp get-template --name hello_world
```

### Account

```bash
# Get phone number info
whatsapp phone-info

# Get business account info
whatsapp account-info

# Test connection
whatsapp test

# Parse webhook payload (for testing)
whatsapp webhook-parse --json '{"entry":[...]}'
whatsapp webhook-parse --file webhook.json
```

---

## Integration with n8n

### Incoming Webhook Listener

Receives messages and status updates from WhatsApp:

1. **Import workflow:**
   ```
   n8n → Workflows → Import → Select brain/ai/skills/custom/whatsapp/templates/n8n-webhook-listener.json
   ```

2. **Configure Meta webhook:**
   ```
   Meta Developers → WhatsApp → Configuration
   Webhook URL: https://n8n.prochat.tools/webhook/whatsapp
   Webhook Token: (set in environment)
   ```

3. **Activate workflow:**
   ```
   Toggle Active in n8n UI
   ```

4. **Test:**
   ```bash
   curl -X POST https://n8n.prochat.tools/webhook/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"19491234567","type":"text","text":{"body":"test"}}]}}]}]}'
   ```

### Outgoing Message Sender

Send WhatsApp messages from n8n workflows:

1. **Import workflow:**
   ```
   n8n → Workflows → Import → Select brain/ai/skills/custom/whatsapp/templates/n8n-message-sender.json
   ```

2. **Use in other workflows:**
   ```
   HTTP Request → POST https://n8n.prochat.tools/webhook/send-whatsapp
   Body: {"phone": "19491234567", "message": "Your message"}
   ```

---

## Programmatic Usage (Python)

### Basic Usage

```python
from whatsapp_sdk import WhatsAppClient, WhatsAppConfig

# Auto-load from ~/.config/whatsapp/.env
client = WhatsAppClient()

# Or manual config
config = WhatsAppConfig(
    phone_number_id="244609202066850",
    business_account_id="244609202066850",
    access_token="your_token_here"
)
client = WhatsAppClient(config)
```

### Send Messages

```python
# Text
response = client.send_message(to="19491234567", text="Hi!")

# Media
response = client.send_media(
    to="19491234567",
    url="https://example.com/image.jpg",
    media_type="image",
    caption="Look!"
)

# Template
response = client.send_template(
    to="19491234567",
    template_name="hello_world",
    language="en",
    parameters=["Alice"]
)

# Interactive (buttons)
response = client.send_interactive_message(
    to="19491234567",
    header="Choose an option",
    body="What would you like?",
    buttons=[
        {"type": "reply", "reply": {"id": "1", "title": "Option 1"}},
        {"type": "reply", "reply": {"id": "2", "title": "Option 2"}}
    ]
)
```

### Get Information

```python
# List templates
templates = client.list_message_templates()

# Get specific template
template = client.get_message_template("hello_world")

# Phone info
info = client.get_phone_number_info()

# Account info
account = client.get_business_account_info()

# Test connection
is_connected = client.test_connection()
```

### Handle Webhooks

```python
from whatsapp_sdk import WhatsAppWebhookHandler

# In your Flask/FastAPI endpoint:
payload = request.json
event = WhatsAppWebhookHandler.parse_webhook(payload)

# event structure:
# {
#   "type": "message" or "status",
#   "from": "19491234567",
#   "message_id": "wamid.1234567890",
#   "text": "message text",
#   "status": "sent|delivered|read|failed",  # for status events
#   "timestamp": "1234567890"
# }

if event['type'] == 'message':
    print(f"From: {event['from']}")
    print(f"Text: {event['text']}")
    # Mark as read
    client.mark_as_read(event['message_id'])
```

---

## File Structure

```
brain/ai/skills/custom/whatsapp/
├── SKILL.md                          # Feature reference
├── README.md                         # This file
├── whatsapp-cli.py                   # Global CLI entry point
├── lib/
│   └── whatsapp_sdk.py              # Python SDK
└── templates/
    ├── n8n-webhook-listener.json    # Incoming webhook handler
    └── n8n-message-sender.json      # Outgoing message sender

Credentials:
~/.config/whatsapp/.env              # API tokens (gitignored)

Documentation:
operations/runbooks/whatsapp-business-api.md  # Full runbook
operations/accounts/credentials-index.md      # Updated with WhatsApp creds
```

---

## Universal Capability Integration

This skill is designed for **Claude, Codex, and Gemini equally**:

- ✅ Python SDK (language-agnostic CLI wrapper)
- ✅ CLI accessible from all three engines
- ✅ n8n templates for workflow integration
- ✅ Credentials stored centrally
- ✅ Runbook + documentation shared

Next step: Run `/brain-universal-capability-install` to sync Claude, Codex, and Gemini configs simultaneously.

---

## What's Next

### 1. Fix Token (Priority)

Get a valid access token and update `~/.config/whatsapp/.env`:
```bash
source ~/.config/whatsapp/.env
# Edit or regenerate token via https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup
whatsapp test  # Verify connection
```

### 2. Universal Capability Install

Once token works:
```bash
/brain-universal-capability-install
```

This will configure all three engines (Claude, Codex, Gemini) simultaneously.

### 3. n8n Webhook Setup

Import and activate the two workflow templates:
- `n8n-webhook-listener.json` — Receive messages
- `n8n-message-sender.json` — Send messages

### 4. Test End-to-End

```bash
# Send test message
whatsapp send --phone <your_test_number> --text "Integration test"

# Verify templates
whatsapp list-templates

# Check account
whatsapp account-info
```

### 5. Production Use Cases

Once verified, integrate into:
- Website "Message Advice" button → WhatsApp automation
- Promotional campaigns via n8n scheduler
- Customer support workflows
- Lead qualification via interactive templates

---

## Troubleshooting

### "Invalid OAuth access token" Error

See "Token Regeneration" section above.

### "Recipient phone number does not match expected format"

Phone must be in E.164 format:
```
✓ 19491234567 (correct: country code + number, no +/- or spaces)
✗ 949-123-4567 (missing country code)
✗ +1-949-123-4567 (has +/- and spaces)
```

### "Message contains unsupported media type"

- URL must be publicly accessible and HTTPS only
- File size limits: Images ≤16MB, Videos ≤100MB
- MIME type must match media_type (e.g., image/jpeg for type=image)

### Webhook Not Receiving Events

1. Verify webhook URL configured in Meta
2. Check n8n workflow is active
3. Verify firewall allows incoming webhooks
4. Test manually with curl (see n8n section)

---

## Support

- **Runbook:** `operations/runbooks/whatsapp-business-api.md`
- **Credentials:** `operations/accounts/credentials-index.md`
- **Meta API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/
- **CLI Help:** `whatsapp --help`
- **SDK Docs:** See `lib/whatsapp_sdk.py` docstrings

---

## Changelog

**2026-04-12:** Initial release
- ✅ Python SDK complete
- ✅ CLI wrapper complete
- ✅ n8n templates complete
- ✅ Credentials stored
- ✅ Documentation complete
- ⚠️ Token validation pending (parse error from Meta API)

---

**Ready to integrate?** Next: Get a valid token, then run `/brain-universal-capability-install`
