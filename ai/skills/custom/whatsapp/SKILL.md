# WhatsApp Business API Skill

**Status:** Ready for integration · **Last Updated:** 2026-04-12  
**Account:** Personal (949-776-2428) · **Credentials:** `~/.config/whatsapp/.env`

## Overview

Bi-directional WhatsApp Business API integration for ProChat infrastructure. Supports:
- **Outgoing**: Send messages, media, templates, interactive messages
- **Incoming**: Webhook listener for message reception, status updates, read receipts
- **Templates**: Message template management and scheduling
- **Analytics**: Message delivery tracking, read status, error handling

Integrated with n8n for workflow automation. Available to Claude, Codex, and Gemini.

---

## Installation & Setup

### 1. Credentials (Already Stored)

Credentials live at: `~/.config/whatsapp/.env`

```bash
# Verify credentials are loaded
source ~/.config/whatsapp/.env
echo $WHATSAPP_PHONE_NUMBER_ID
```

### 2. Install Dependencies

```bash
# Python dependencies
pip install requests python-dotenv

# (Optional) Install as global CLI
ln -s /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/whatsapp/whatsapp-cli.py /usr/local/bin/whatsapp
chmod +x /usr/local/bin/whatsapp
```

### 3. Set Up n8n Webhook Listener

See `templates/n8n-webhook-listener.json` for workflow template.

---

## CLI Usage

### Send Message

```bash
whatsapp send \
  --phone 19491234567 \
  --text "Hello from WhatsApp!"
```

### Send Template

```bash
whatsapp send-template \
  --phone 19491234567 \
  --template-name "hello_world" \
  --lang en
```

### Send Media

```bash
whatsapp send-media \
  --phone 19491234567 \
  --url "https://example.com/image.jpg" \
  --type image \
  --caption "Check this out!"
```

### List Templates

```bash
whatsapp list-templates
```

### Webhook Status

```bash
whatsapp webhook-status
```

### Test Connection

```bash
whatsapp test
```

---

## Programmatic Usage (Python)

```python
from whatsapp_sdk import WhatsAppClient

client = WhatsAppClient()

# Send message
response = client.send_message(
    to="19491234567",
    text="Hello!"
)
print(f"Message ID: {response['messages'][0]['id']}")

# Send template
response = client.send_template(
    to="19491234567",
    template_name="hello_world",
    language="en",
    parameters=["Alice"]
)

# List templates
templates = client.list_message_templates()
for t in templates:
    print(f"{t['name']}: {t['status']}")
```

---

## n8n Integration

Two workflow templates provided:

### 1. Incoming Webhook Listener
- Receives messages/webhooks from WhatsApp
- Classifies message type (text/media/template/status)
- Routes to appropriate handler
- Logs to database

**Location:** `templates/n8n-webhook-listener.json`

### 2. Outgoing Message Sender
- HTTP Request node to send messages
- Template parameter substitution
- Error handling + retry logic
- Delivery tracking

**Location:** `templates/n8n-message-sender.json`

Import these into n8n via: **Workflows → Import → Select JSON file**

---

## API Reference

### Core Methods

**WhatsAppClient.send_message(to, text, preview_url=True)**
- Send text message
- Returns: Message ID + status

**WhatsAppClient.send_template(to, template_name, language, parameters=[])**
- Send template message
- Returns: Message ID + template status

**WhatsAppClient.send_media(to, url, type, caption=None)**
- Send image/video/document
- Types: `image`, `video`, `audio`, `document`
- Returns: Media message ID

**WhatsAppClient.list_message_templates()**
- List all templates in account
- Returns: Array of template objects

**WhatsAppClient.get_message_status(message_id)**
- Get delivery status of sent message
- Returns: `sent`, `delivered`, `read`, `failed`

**WhatsAppClient.mark_as_read(message_id)**
- Mark incoming message as read
- Returns: Success/failure

---

## Webhook Events

The incoming webhook listener handles:

### Message Events
- `message` — Incoming text, image, video, or document
- `message_template` — User responded to interactive template
- `message_read` — Message read by recipient

### Status Events
- `message_status_sent` — Message sent
- `message_status_delivered` — Message delivered
- `message_status_read` — Message read by recipient
- `message_status_failed` — Message delivery failed

### Account Events
- `account_update` — Account settings changed
- `phone_number_name_update` — Display name changed
- `phone_number_quality_update` — Quality rating changed

---

## Rate Limits & Quotas

- **Free tier**: 1,000 messages/day
- **Standard tier**: $0.0035 per message (outbound)
- **Inbound**: Unlimited (webhook only)
- **Rate limit**: 80 API calls/second per business account

---

## Troubleshooting

### Token Invalid

```bash
# Regenerate token (requires browser access to developer console)
# Go to: https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup
# Click "Generate Long-Lived Token"
# Update ~/.config/whatsapp/.env

source ~/.config/whatsapp/.env
whatsapp test  # Verify connectivity
```

### Message Send Failed

Check error code:
- `400` — Bad request (invalid phone number format, missing fields)
- `401` — Unauthorized (invalid token)
- `403` — Forbidden (insufficient permissions)
- `429` — Rate limited (backoff and retry)
- `500` — Server error (retry)

### Webhook Not Receiving

1. Verify webhook URL is publicly accessible
2. Check that n8n workflow is running
3. Verify webhook token matches Meta app configuration
4. Test webhook manually: `whatsapp webhook-test`

---

## Examples

### Example 1: Send Promotional Message via CLI

```bash
whatsapp send --phone 19491234567 --text "New product available! Check it out at prochat.tools"
```

### Example 2: Programmatic Campaign (Python)

```python
from whatsapp_sdk import WhatsAppClient

client = WhatsAppClient()

phone_numbers = [
    "19491234567",
    "19491234568",
    "19491234569"
]

for phone in phone_numbers:
    client.send_message(
        to=phone,
        text="Exclusive offer just for you!"
    )
    time.sleep(0.5)  # Respect rate limits
```

### Example 3: n8n Workflow - Incoming Message Handler

See `templates/n8n-message-handler.json` for complete workflow that:
1. Receives webhook from WhatsApp
2. Logs message to database
3. Sends auto-reply based on keyword
4. Updates CRM if needed

---

## Security

- **Token Storage:** `~/.config/whatsapp/.env` (600 permissions, user-readable only)
- **Secrets in Memory:** Never logged or printed to stdout
- **Webhook Verification:** All webhooks signed with account token
- **Rate Limiting:** Automatic backoff on 429 errors
- **Error Handling:** No sensitive data in error messages

---

## Future Enhancements

- [ ] Message encryption (end-to-end when available)
- [ ] Group messaging support
- [ ] Broadcast message scheduling
- [ ] Sentiment analysis on incoming messages
- [ ] CRM integration (auto-log to n8n)
- [ ] Smart reply suggestions via Claude API

---

## Support

**Credential Issues:** Check `brain/operations/accounts/credentials-index.md`  
**n8n Workflows:** See `operations/runbooks/n8n-workflows.md`  
**API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/  
**Runbook:** `operations/runbooks/whatsapp-business-api.md`
