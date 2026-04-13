# Credentials & API Keys

This document indexes all API keys, tokens, and credentials used across projects. The actual values are stored securely in various locations; this document provides the metadata and locations only.

**Important:** Never commit secrets to the repository. Always use `.env` files or secure credential storage.

---

## Gemini AI (Google)

**Service:** Google Generative AI API (Gemini)  
**Used in:** Says the Bible (image generation), CLI tools  
**Location:** `~/.config/google-ai/.env`  
**Environment Variable:** `GOOGLE_GENERATIVE_AI_API_KEY`  
**API Key Format:** `AIzaSy*` (API key, not OAuth)  

**Configuration:**
- File: `~/.config/google-ai/.env` (loaded by Gemini CLI)
- Also added to project `.env` files when needed:
  - `~/Repos/prochattools/web/says-the-bible/.env`

**Setup:**
1. Get API key from https://aistudio.google.com/app/apikey
2. Store in `~/.config/google-ai/.env`: `GEMINI_API_KEY=<key>`
3. Project scripts load via `--env-file .env` in pipeline commands
4. CLI tools access via environment variable

---

## Stripe

**Service:** Stripe (payment processing)  
**Location:** Project `.env` files  
**Environment Variables:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public key)
- `STRIPE_SECRET_KEY` (secret key)
- `STRIPE_WEBHOOK_SECRET`

**Used in:** Says the Bible (billing, catalog)

---

## Azure Speech Services

**Service:** Azure Cognitive Services (Text-to-Speech)  
**Used in:** Says the Bible (podcast narration)  
**Environment Variables:**
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`

---

## Pinterest

**Service:** Pinterest Business API  
**Used in:** Says the Bible (pin distribution)  
**Environment Variables:**
- `PINTEREST_APP_ID`
- `PINTEREST_ACCESS_TOKEN`
- `PINTEREST_BOARD_*` (board IDs)

---

## YouTube

**Service:** YouTube Data API  
**Used in:** Says the Bible (video publishing)  
**Environment Variables:**
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_TOKEN_PATH` (runtime token storage)

---

## n8n Workflows

**Service:** n8n automation (internal)  
**Used in:** Says the Bible (Facebook auto-publish)  
**Environment Variables:**
- `N8N_FACEBOOK_AUTOPUBLISH_WEBHOOK_URL`
- `N8N_FACEBOOK_AUTOPUBLISH_SECRET`

---

## Supabase (PostgreSQL + Storage)

**Service:** Supabase (hosted PostgreSQL, object storage)  
**Used in:** Says the Bible (database, audio hosting)  
**Environment Variables:**
- `SUPABASE_URL` (internal/local)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

---

## Resend (Email)

**Service:** Resend email service (internal fork)  
**Used in:** Says the Bible (transactional emails)  
**Environment Variables:**
- `RESEND_API_KEY`
- `RESEND_BASE_URL`

---

## Summary: Where to Find Each Credential

| Service | Location | How to Access |
|---------|----------|---------------|
| Gemini API Key | `~/.config/google-ai/.env` | `cat ~/.config/google-ai/.env` |
| Project Secrets | `.env` files (not committed) | Environment-specific, in password manager |
| Stripe Keys | Project `.env` | Per-environment in dashboard |
| YouTube OAuth | Project `.env` | Generated via OAuth flow |
| Others | Project `.env` | Per-environment in password manager |

---

## Adding New Credentials

When adding a new API key or credential:

1. Store the value securely (password manager, `.env`, or `~/.config/`)
2. Add metadata entry to this file (location, usage, env var name)
3. Add the env var to the relevant project's `.env` (if applicable)
4. Document in project-specific README if needed

Never commit secrets; always `.gitignore` credential files.
