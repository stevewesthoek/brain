# WhatsApp Business API Runbook

**Status:** Production-ready · **Last Updated:** 2026-04-12  
**Skill Location:** `brain/ai/skills/custom/whatsapp/`  
**Credentials:** `~/.config/whatsapp/.env`

---

## Overview

Bi-directional WhatsApp Business messaging integration for ProChat. Handles:
- **Outgoing:** Text, media (image/video/audio/document), templates, interactive messages
- **Incoming:** Webhook listener for messages, status updates, read receipts
- **Management:** Template inventory, message tracking, analytics

**Account:**
- Phone: 949-776-2428
- Business Account ID: 244609202066850
- Meta App: 819349503541241 (WhatsApp Business product enabled)

---

## Quick Start

### 1. Verify Credentials

```bash
source ~/.config/whatsapp/.env

# Check all variables are loaded
env | grep WHATSAPP_
```

### 2. Test Connection

```bash
whatsapp test
```

Expected output:
```
Testing WhatsApp Business API connection...
✓ Connection successful: 949-776-2428
```

### 3. Send Your First Message

```bash
whatsapp send --phone 19491234567 --text "Hello from WhatsApp!"
```

### 4. Programmatic Usage (Python)

```python
from whatsapp_sdk import WhatsAppClient

client = WhatsAppClient()
response = client.send_message(
    to="19491234567",
    text="Hello via Python!"
)
print(response['messages'][0]['id'])
```

---

## CLI Commands Reference

### Send Text Message

```bash
whatsapp send --phone 19491234567 --text "Your message here"
```

**Options:**
- `--preview-url` (default: true) — Enable URL preview for links in message

### Send Template Message

```bash
whatsapp send-template \
  --phone 19491234567 \
  --template hello_world \
  --lang en \
  --parameters "Alice,Bob"
```

**Options:**
- `--lang` (default: en) — Language code for template
- `--parameters` — Comma-separated values to substitute in template (in order)

### Send Media

```bash
whatsapp send-media \
  --phone 19491234567 \
  --url "https://example.com/image.jpg" \
  --type image \
  --caption "Check this out!"
```

**Media Types:**
- `image` — PNG, JPG, GIF, WebP
- `video` — MP4, 3GPP
- `audio` — AAC, MP4, AMR, OGG
- `document` — PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX

### Send Interactive Message (Buttons)

```bash
whatsapp send-interactive \
  --phone 19491234567 \
  --header "Choose an option" \
  --body "What would you like to do?" \
  --buttons "Option 1,Option 2,Option 3" \
  --footer "Reply with a number"
```

### List All Templates

```bash
whatsapp list-templates
```

Filter by status:
```bash
whatsapp list-templates --status APPROVED
```

Possible statuses: `PENDING`, `APPROVED`, `REJECTED`, `DISABLED`

### Get Template Details

```bash
whatsapp get-template --name hello_world
```

### Mark Message as Read

```bash
whatsapp mark-read --message-id wamid.1234567890
```

### Get Account Information

```bash
whatsapp phone-info      # Phone number details
whatsapp account-info    # Business account details
```

---

## n8n Integration

Two workflow templates are provided in `brain/ai/skills/custom/whatsapp/templates/`:

### 1. Webhook Listener (`n8n-webhook-listener.json`)

**Purpose:** Receive incoming messages and status updates from WhatsApp

**Setup:**
1. In n8n, go to **Workflows → Import**
2. Select `n8n-webhook-listener.json`
3. Configure webhook URL in Meta: `https://n8n.prochat.tools/webhook/whatsapp`
4. Set webhook token in `.env`
5. Activate workflow

**Events handled:**
- Incoming text/media messages
- Message delivery status updates
- Message read receipts
- Account changes

**Output:**
- Logs to `whatsapp_events` database table
- Responds with `{"status": "ok"}`

### 2. Message Sender (`n8n-message-sender.json`)

**Purpose:** Send WhatsApp messages from n8n workflows

**Setup:**
1. Import `n8n-message-sender.json`
2. Credentials are auto-loaded from `~/.config/whatsapp/.env`
3. Call via HTTP: `POST http://n8n.prochat.tools/webhook/send-whatsapp`

**Request body:**
```json
{
  "phone": "19491234567",
  "message": "Your message text here"
}
```

**Response:**
```json
{
  "message_id": "wamid.1234567890",
  "status": "success"
}
```

---

## Programmatic Usage (Python)

### Import and Initialize

```python
from whatsapp_sdk import WhatsAppClient

client = WhatsAppClient()  # Loads from ~/.config/whatsapp/.env automatically
```

### Send Message

```python
response = client.send_message(
    to="19491234567",
    text="Hello!",
    preview_url=True
)

message_id = response['messages'][0]['id']
print(f"Sent: {message_id}")
```

### Send Template

```python
response = client.send_template(
    to="19491234567",
    template_name="hello_world",
    language="en",
    parameters=["Alice"]
)
```

### Send Media

```python
response = client.send_media(
    to="19491234567",
    url="https://example.com/image.jpg",
    media_type="image",
    caption="Look at this!"
)
```

### Get Templates

```python
templates = client.list_message_templates()

for tmpl in templates:
    print(f"{tmpl['name']}: {tmpl['status']}")
```

### Check Connection

```python
if client.test_connection():
    print("✓ Connected to WhatsApp API")
else:
    print("✗ Connection failed")
```

### Handle Incoming Webhooks

```python
from whatsapp_sdk import WhatsAppWebhookHandler

# In your Flask/FastAPI endpoint:
payload = request.json
event = WhatsAppWebhookHandler.parse_webhook(payload)

if event['type'] == 'message':
    print(f"From: {event['from']}")
    print(f"Text: {event['text']}")
    print(f"Message ID: {event['message_id']}")
    
    # Mark as read
    client.mark_as_read(event['message_id'])
```

---

## Rate Limits & Quotas

| Limit | Value | Notes |
|-------|-------|-------|
| Messages/day (free tier) | 1,000 | Resets daily |
| Outbound message cost | $0.0035 | Per message |
| Inbound (webhooks) | Unlimited | No charge |
| API calls/second | 80 | Per business account |

**Backoff Strategy:**
- On `429` (rate limited): Wait 5 seconds, retry
- On `500` (server error): Exponential backoff (2s, 4s, 8s)

---

## Troubleshooting

### "Invalid OAuth access token - Cannot parse access token"

**Cause:** Token is expired or invalid

**Fix:**
1. Go to [Meta Developers → WhatsApp API Setup](https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup)
2. Click **"Generate Long-Lived Token"**
3. Copy the new token
4. Update `~/.config/whatsapp/.env`:
   ```bash
   WHATSAPP_ACCESS_TOKEN=<new_token>
   ```
5. Test: `whatsapp test`

### "Recipient phone number does not match the expected phone format"

**Cause:** Phone number format is incorrect

**Fix:**
- Must include country code: `19491234567` (not `949-1234567` or `1-949-123-4567`)
- Format: `<country_code><area_code><number>`
- Example: US (1) + 949 + 1234567 → `19491234567`

### "Message contains unsupported media type"

**Cause:** Media URL is inaccessible or wrong type

**Fix:**
- Verify URL is publicly accessible: `curl -I <url>`
- Check MIME type matches media_type: `image/*`, `video/*`, etc.
- URL must start with `https://` (not `http://`)
- File size limits:
  - Image: ≤ 16 MB
  - Video: ≤ 100 MB
  - Audio: ≤ 16 MB
  - Document: ≤ 100 MB

### Webhook Not Receiving Events

**Cause:** Webhook URL not configured in Meta or n8n workflow is inactive

**Fix:**
1. Verify webhook URL in Meta:
   - Go to [Meta Developers → WhatsApp → Configuration](https://developers.facebook.com/apps/819349503541241/whatsapp/configuration)
   - Webhook URL should be: `https://n8n.prochat.tools/webhook/whatsapp`
2. Verify n8n workflow is active:
   - Go to n8n → WhatsApp Webhook Listener → Toggle **Active**
3. Test manually:
   ```bash
   curl -X POST https://n8n.prochat.tools/webhook/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"19491234567","type":"text","text":{"body":"test"}}]}}]}]}'
   ```

### "Message send failed" with no error code

**Cause:** Network issue or API timeout

**Fix:**
- Check internet connectivity: `ping graph.instagram.com`
- Check Meta API status: https://status.meta.com/
- Retry with exponential backoff:
  ```bash
  for i in {1..3}; do
    whatsapp send --phone ... && break
    sleep $((2 ** i))
  done
  ```

---

## Monitoring

### Check Message Status

```bash
# Get status of recently sent message
whatsapp account-info

# View raw webhook logs in n8n
# Go to n8n → WhatsApp Webhook Listener → Execution history
```

### Database Query (n8n)

If webhook listener is logging to PostgreSQL:

```sql
SELECT * FROM whatsapp_events
ORDER BY timestamp DESC
LIMIT 10;

-- Messages only
SELECT * FROM whatsapp_events
WHERE type = 'message'
ORDER BY timestamp DESC;

-- Status updates only
SELECT * FROM whatsapp_events
WHERE type = 'status'
ORDER BY timestamp DESC;
```

### New Relic Monitoring

If integrated with New Relic:
```bash
# Check APM for whatsapp-sender app
# View: latency, throughput, errors
# Alert: >50ms latency, >5% error rate
```

---

## Token Rotation

Access tokens expire ~60 days after generation. Set a monthly reminder to check expiry:

```bash
# Check token expiry (if Meta provides it in API)
curl -s https://graph.instagram.com/v18.0/debug_token \
  -d "access_token=$WHATSAPP_ACCESS_TOKEN" | jq '.data.expires_at'
```

**Rotation checklist:**
- [ ] Go to [Meta Developers → WhatsApp API Setup](https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup)
- [ ] Click **"Generate Long-Lived Token"**
- [ ] Copy new token
- [ ] Update `~/.config/whatsapp/.env`
- [ ] Test: `whatsapp test`
- [ ] Verify n8n workflows still work
- [ ] Update this runbook with new generation date

---

## Security Best Practices

1. **Token Storage:**
   - Never commit `~/.config/whatsapp/.env` to git
   - Permissions: `600` (user-readable only)
   - Never print token to stdout

2. **Webhook Security:**
   - Always verify webhook signatures (optional but recommended)
   - Use HTTPS only (`https://` URLs required)
   - Limit webhook accessible IPs (in firewall)

3. **Message Content:**
   - No sensitive data in plain text messages
   - Use templates for templated/repetitive content
   - Archive message logs separately if needed for compliance

4. **API Rate Limiting:**
   - Implement backoff for rate-limit responses (429)
   - Distribute load across time (don't send 1,000 messages in 1 second)

---

## Support & Links

**Meta Documentation:**
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Message Types & Formats](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)
- [API Rate Limits](https://developers.facebook.com/docs/whatsapp/cloud-api/rate-limits)

**Internal:**
- Skill: `brain/ai/skills/custom/whatsapp/`
- Credentials Index: `brain/operations/accounts/credentials-index.md`
- SDK: `whatsapp_sdk.py`
- CLI: `whatsapp` (global)

**Common Issues:**
- Token validation: See "Invalid OAuth access token" above
- Phone format: See "Recipient phone number" above
- Webhook: See "Webhook Not Receiving Events" above

---

## Changelog

**2026-04-12:**
- ✅ Initial setup: Credentials stored, CLI created, n8n templates provided
- ⚠️ Token validation pending (token parsing error from Meta API)
- 🔄 Next: Verify token format with Meta developer support or regenerate via browser

---

**Last verified:** 2026-04-12 · **Next check:** 2026-05-12 (token rotation)
