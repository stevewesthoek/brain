# WhatsApp Skill Installation Checklist

**Date:** 2026-04-12  
**Status:** ✅ Scaffold Complete · ⚠️ Token Validation Pending

---

## ✅ Completed

### Credentials & Storage
- [x] Credentials file created: `~/.config/whatsapp/.env`
- [x] All 8 Meta/WhatsApp variables stored:
  - Phone Number ID: `244609202066850`
  - Business Account ID: `244609202066850`
  - Meta App ID: `819349503541241`
  - Meta App Secret: (stored securely)
  - Access Token: (stored securely)
  - API base URL & version: (configured)
- [x] Credentials gitignored (not in repo)
- [x] Credentials Index updated: `operations/accounts/credentials-index.md`
- [x] Permissions set correctly: `600` (user-readable only)

### Code & CLI
- [x] Python SDK created: `lib/whatsapp_sdk.py`
  - Full WhatsApp Cloud API client
  - Send text, media, templates, interactive messages
  - Webhook event parsing
  - 100% type-hinted
- [x] CLI wrapper created: `whatsapp-cli.py`
  - 8 commands (send, send-template, send-media, list-templates, etc.)
  - Executable permissions set
  - Global CLI: `whatsapp <command>`
- [x] Symlink created: `active/whatsapp → ../custom/whatsapp`
- [x] CLI accessible as global command

### Documentation
- [x] SKILL.md — Feature reference and examples
- [x] README.md — Quick start and overview
- [x] INSTALLATION_CHECKLIST.md — This checklist
- [x] Runbook created: `operations/runbooks/whatsapp-business-api.md`
  - Complete CLI reference
  - Programmatic usage examples
  - n8n integration guide
  - Troubleshooting section

### n8n Templates
- [x] Webhook Listener template: `templates/n8n-webhook-listener.json`
  - Receive incoming messages
  - Parse status updates
  - Log to database
  - Send confirmation response
- [x] Message Sender template: `templates/n8n-message-sender.json`
  - HTTP Request node setup
  - Authentication pre-configured
  - Response extraction

---

## ⚠️ Pending (Blockers)

### Token Validation
- [ ] **Access token validation** — Currently fails with "Invalid OAuth access token"
  - Root cause: Likely URL encoding during copy-paste or token genuinely expired
  - Impact: Cannot test connection or send messages until resolved
  - Action: Regenerate token via browser, update `.env`, test

### Universal Capability Install
- [ ] Run `/brain-universal-capability-install` once token is valid
  - Syncs Claude, Codex, Gemini configs simultaneously
  - Ensures all three engines can access the skill
  - Sets up shared credentials reference

### n8n Workflow Activation
- [ ] Import `n8n-webhook-listener.json` into n8n
- [ ] Configure webhook URL in Meta
- [ ] Activate workflow
- [ ] Test webhook receiving

### Production Testing
- [ ] Send test message via CLI
- [ ] Send test template
- [ ] Send test media
- [ ] Verify webhook receives incoming messages
- [ ] Check database logging (if n8n integration enabled)

---

## 🔄 Next Steps (Priority Order)

### 1. Fix Token ✅ (High Priority)

The access token you provided is being rejected by Meta API. Options:

**Option A: Regenerate via Browser (Recommended)**
1. Go to: https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup
2. Click **"Generate Long-Lived Token"**
3. Copy the token using the **Copy** button (not manual selection)
4. Provide the token to me
5. I'll update `~/.config/whatsapp/.env` and test

**Option B: Verify via Graph API Explorer**
1. Go to: https://developers.facebook.com/tools/explorer
2. Select app: `819349503541241`
3. Paste current token
4. Test `/me` endpoint
5. Screenshot the error and send to me

### 2. Run Universal Capability Install

Once token is valid:
```bash
/brain-universal-capability-install
```

This ensures Claude, Codex, and Gemini can all use the skill.

### 3. Import n8n Workflows

Once CLI is working:
1. n8n → Workflows → Import → `templates/n8n-webhook-listener.json`
2. n8n → Workflows → Import → `templates/n8n-message-sender.json`
3. Configure Meta webhook URL in app settings
4. Activate both workflows

### 4. Production Testing

Once n8n workflows are active:
```bash
# Test CLI
whatsapp send --phone <test_number> --text "Integration test"

# Test templates
whatsapp list-templates

# Monitor webhook listener
# (Check n8n execution history)
```

### 5. Integration into Use Cases

- Website "Message Advice" button → WhatsApp automation
- Promotional campaigns via n8n scheduler
- Customer support workflows
- Lead qualification via templates

---

## File Locations Summary

```
brain/ai/skills/custom/whatsapp/
├── SKILL.md                              # Feature reference
├── README.md                             # Quick start
├── INSTALLATION_CHECKLIST.md             # This file
├── whatsapp-cli.py                       # CLI entry point (executable)
├── lib/
│   ├── __init__.py                      # (auto-created on first import)
│   └── whatsapp_sdk.py                  # Python SDK
└── templates/
    ├── n8n-webhook-listener.json        # Incoming webhook handler
    └── n8n-message-sender.json          # Outgoing message sender

Symlink:
brain/ai/skills/active/whatsapp → ../custom/whatsapp

Credentials:
~/.config/whatsapp/.env                  # API tokens (gitignored)

Documentation:
operations/runbooks/whatsapp-business-api.md     # Full runbook
operations/accounts/credentials-index.md         # Credentials index
```

---

## Command Reference

### Test Connection (Will Fail Until Token Fixed)
```bash
whatsapp test
```

### Send Test Message (Once Token Fixed)
```bash
whatsapp send --phone 19491234567 --text "Hello!"
```

### List Commands
```bash
whatsapp --help
```

### Get Help on Specific Command
```bash
whatsapp send --help
whatsapp send-template --help
whatsapp list-templates --help
```

---

## Credentials Status

| Variable | Status | Value |
|----------|--------|-------|
| Phone Number | ✅ Verified | 949-776-2428 |
| Phone Number ID | ✅ Stored | 244609202066850 |
| Business Account ID | ✅ Stored | 244609202066850 |
| Meta App ID | ✅ Stored | 819349503541241 |
| Meta App Secret | ✅ Stored | (secure) |
| Access Token | ⚠️ Invalid | Needs regeneration |
| API Base URL | ✅ Configured | https://graph.instagram.com |
| API Version | ✅ Configured | v18.0 |

---

## Known Issues & Resolutions

### Issue 1: "Invalid OAuth access token - Cannot parse access token"

**Status:** Blocking token validation  
**Root Cause:** Unknown (could be encoding, expiration, or permission scope)  
**Impact:** Cannot test CLI or send messages  
**Resolution:** Regenerate token via browser and provide new value

### Issue 2: n8n Webhooks Not Activated

**Status:** Awaiting n8n setup  
**Root Cause:** Workflows not yet imported into n8n  
**Impact:** Incoming messages won't be processed  
**Resolution:** Import JSON templates and activate workflows

---

## Rollback Plan

If anything breaks, to restore clean state:

```bash
# Remove skill
rm -rf ~/brain/ai/skills/custom/whatsapp

# Remove credentials
rm ~/.config/whatsapp/.env

# Remove symlink
rm ~/brain/ai/skills/active/whatsapp

# Revert credentials index
git checkout ~/brain/operations/accounts/credentials-index.md
```

---

## Success Criteria

- [ ] Token validation passes: `whatsapp test` → "Connection successful"
- [ ] CLI works: `whatsapp send --phone ... --text ...` → Returns message ID
- [ ] Templates accessible: `whatsapp list-templates` → Shows template list
- [ ] n8n workflows imported and active
- [ ] Webhook listener receives incoming messages
- [ ] Universal capability install completes without errors
- [ ] All three engines (Claude, Codex, Gemini) can call whatsapp CLI

---

## Support & Questions

- **Quick Start:** `README.md`
- **Full Reference:** `SKILL.md`
- **Complete Runbook:** `operations/runbooks/whatsapp-business-api.md`
- **Credentials Help:** `operations/accounts/credentials-index.md`
- **Meta Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/

---

**Status Update:** Ready for token validation and universal capability install.  
**Last Updated:** 2026-04-12  
**Next Check:** After token regeneration
