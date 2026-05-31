# YouTube Credentials Documentation

**Last Updated:** 2026-05-31  
**Status:** ✅ Central credentials storage configured (Says the Bible + ProChat)

---

## Central Credentials Location

All YouTube OAuth credentials and configuration are stored in a **single central directory** on your computer:

```
~/.config/youtube/
```

This directory contains two files:

| File | Purpose | Status |
|------|---------|--------|
| `.env` | Configuration and references (env variables) | Text, gitignored |
| `client_secret.json` | OAuth 2.0 client JSON (from Google Cloud) | Secret, gitignored |

This follows the pattern established in the Brain repo (see: `/Users/Office/Repos/stevewesthoek/brain/operations/accounts/credentials-index.md`)

### Why This Location?

- **Single source of truth:** All projects (mind, brain, etc.) reference the same location
- **Git-safe:** `~/.config/` is gitignored system-wide
- **Secure:** OAuth client JSON is not embedded in scripts
- **Discoverable:** Credentials index in Brain tracks all secrets in `~/.config/`
- **Portable:** Scripts can source `~/.config/youtube/.env` without hardcoding paths

---

## Credentials Files Contents

### File 1: `~/.config/youtube/.env`

**Purpose:** Configuration and file references (non-secret)  
**Permissions:** `600` (user-readable only)  
**Format:** Bash environment variables  
**Git Status:** Gitignored (no secrets, but referenced)

```bash
# OAuth 2.0 Client JSON file location
YOUTUBE_CLIENT_SECRET_JSON="${HOME}/.config/youtube/client_secret.json"

# Token storage location (auto-generated)
YOUTUBE_TOKEN_FILE="${HOME}/.youtube_tokens.json"

# API endpoints (non-secret config)
YOUTUBE_API_URL="https://www.googleapis.com/youtube/v3"
YOUTUBE_OAUTH_URL="https://oauth2.googleapis.com"
YOUTUBE_UPLOAD_API_URL="https://www.googleapis.com/upload/youtube/v3"

# OAuth flow settings
YOUTUBE_REDIRECT_URI="http://localhost:8888"
YOUTUBE_SCOPES="https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"
```

### File 2: `~/.config/youtube/client_secret.json`

**Purpose:** OAuth 2.0 client credentials (secret)  
**Permissions:** `600` (user-readable only)  
**Format:** JSON  
**Git Status:** Gitignored (SECRET - never commit)  
**Source:** Downloaded from Google Cloud Console

```json
{
  "installed": {
    "client_id": "352914416758-ju164nd2uqlat4jj148e4i9snv1t7a05.apps.googleusercontent.com",
    "project_id": "says-the-bible",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "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",
    "redirect_uris": ["http://localhost"]
  }
}
```

### Credentials Metadata

| File | Variable | Purpose | Storage | Permissions | Rotation |
|------|----------|---------|---------|-------------|----------|
| `.env` | `YOUTUBE_CLIENT_SECRET_JSON` | Path to OAuth client JSON file | `~/.config/youtube/.env` | 600 | Static |
| `.env` | `YOUTUBE_TOKEN_FILE` | Path to auto-generated token file | `~/.config/youtube/.env` | 600 | Static |
| `.env` | `YOUTUBE_REDIRECT_URI` | Local OAuth callback URL | `~/.config/youtube/.env` | 600 | Static |
| `.env` | `YOUTUBE_SCOPES` | OAuth scopes authorized | `~/.config/youtube/.env` | 600 | Static |
| `client_secret.json` | `client_id` | OAuth 2.0 client identifier | `~/.config/youtube/client_secret.json` | 600 (SECRET) | Rotate via Google Cloud Console |
| `client_secret.json` | `client_secret` | OAuth 2.0 client secret | `~/.config/youtube/client_secret.json` | 600 (SECRET) | Rotate if compromised |
| `client_secret.json` | `token_uri` | Google OAuth token endpoint | `~/.config/youtube/client_secret.json` | 600 | Static |
| `client_secret.json` | `redirect_uris` | Allowed redirect URIs | `~/.config/youtube/client_secret.json` | 600 | Static |

---

## OAuth Credential Details

### Says the Bible

**OAuth 2.0 Client Name:** `says-the-bible-youtube-uploader-local`  
**Google Cloud Project ID:** `says-the-bible`

### ProChat

**OAuth 2.0 Client Name:** `prochat-youtube-uploader-local`  
**Google Cloud Project ID:** `video-orchestrator-495920`

**Scopes Authorized (Both Channels):**
- `https://www.googleapis.com/auth/youtube.readonly` — Read channel info, validate access
- `https://www.googleapis.com/auth/youtube.upload` — Upload videos, set thumbnails

---

## Token File (Auto-Generated)

**File:** `~/.youtube_tokens.json`  
**Created by:** `../cloud/scripts/youtube-auth-local.sh`  
**Permissions:** `600` (user-readable only)  
**Git Status:** Gitignored (never commit)

**Contents:**
```json
{
  "access_token": "ya29.a0AfH6SMB...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "refresh_token": "1//0g...",
  "scope": "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
  "created_at": 1686840000
}
```

**Lifecycle:**
- **Generated:** First run of `../cloud/scripts/youtube-auth-local.sh`
- **Refreshed:** Auto-refreshed by scripts if < 5 minutes remaining
- **Valid:** ~1 hour (access_token), indefinite (refresh_token until revoked)
- **Stored:** `~/.youtube_tokens.json` (path configurable via `YOUTUBE_TOKEN_FILE`)

---

## How Scripts Use Credentials

### 1. `../cloud/scripts/youtube-auth-local.sh` (Setup)

**Reads from:**
- `~/.config/youtube/.env` → `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`

**Writes to:**
- `~/.youtube_tokens.json` → OAuth tokens (auto-generated)

**Flow:**
1. Load credentials from central config
2. Start OAuth browser flow
3. User authorizes
4. Script receives code, exchanges for tokens
5. Saves tokens to `~/.youtube_tokens.json`

### 2. `../cloud/scripts/youtube-auth-check.sh` (Validation)

**Reads from:**
- `~/.config/youtube/.env` → Config location reference
- `~/.youtube_tokens.json` → Access token, expiry, scopes

**Validates:**
- Token file exists
- Token not expired
- YouTube API responds (channels.list)
- Authenticated channel info

### 3. `../cloud/scripts/youtube-upload-local.sh` (Upload)

**Reads from:**
- `~/.config/youtube/.env` → `YOUTUBE_TOKEN_FILE` path
- `~/.youtube_tokens.json` → Access token (auto-refreshes if needed)

**Does:**
1. Load OAuth token from central location
2. Check expiry, auto-refresh if needed
3. Read publish.json from S3
4. Download video and thumbnail
5. Upload to YouTube via API
6. Update publish.json with videoId
7. Write updated publish.json back to S3

---

## Adding Credentials to Your Computer

### For New Setup

1. Create the central credentials directory:
   ```bash
   mkdir -p ~/.config/youtube
   chmod 700 ~/.config/youtube
   ```

2. Download OAuth 2.0 Client JSON from Google Cloud Console:
   - Go to https://console.cloud.google.com
   - Select project: `says-the-bible`
   - Go to APIs & Services → Credentials
   - Find OAuth 2.0 Client ID: `says-the-bible-youtube-uploader-local`
   - Click Download button (JSON format)
   - Save to: `~/.config/youtube/client_secret.json`

3. Set proper permissions on JSON file:
   ```bash
   chmod 600 ~/.config/youtube/client_secret.json
   ```

4. Create the configuration file:
   ```bash
   cat > ~/.config/youtube/.env << 'EOF'
   # YouTube OAuth Configuration
   YOUTUBE_CLIENT_SECRET_JSON="${HOME}/.config/youtube/client_secret.json"
   YOUTUBE_TOKEN_FILE="${HOME}/.youtube_tokens.json"
   
   YOUTUBE_API_URL="https://www.googleapis.com/youtube/v3"
   YOUTUBE_OAUTH_URL="https://oauth2.googleapis.com"
   YOUTUBE_UPLOAD_API_URL="https://www.googleapis.com/upload/youtube/v3"
   
   YOUTUBE_REDIRECT_URI="http://localhost:8888"
   YOUTUBE_SCOPES="https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"
   EOF
   chmod 600 ~/.config/youtube/.env
   ```

5. Verify files exist and have correct permissions:
   ```bash
   ls -la ~/.config/youtube/
   # Should show:
   # -rw------- client_secret.json
   # -rw------- .env
   ```

6. Test that scripts can read credentials:
   ```bash
   source ~/.config/youtube/.env
   echo "JSON file: $YOUTUBE_CLIENT_SECRET_JSON"
   cat "$YOUTUBE_CLIENT_SECRET_JSON" | jq .installed.client_id
   ```

### For Existing Setup

If you previously had credentials elsewhere, consolidate to central location:

```bash
# Old locations (no longer used)
~/.youtube_client_secret.json     # ❌ Delete this
./client_secret*.json             # ❌ Delete this

# New central location (use this)
~/.config/youtube/client_secret.json  # ✅ Central OAuth client JSON
~/.config/youtube/.env                # ✅ Central config references
~/.youtube_tokens.json                # Still used (auto-generated by scripts)
```

**Migration steps:**

```bash
# 1. Move OAuth client JSON to central location
cp ~/path/to/client_secret.json ~/.config/youtube/client_secret.json
chmod 600 ~/.config/youtube/client_secret.json

# 2. Create ~/.config/youtube/.env (see setup steps above)

# 3. Delete old files
rm -f ~/.youtube_client_secret.json ./client_secret*.json

# 4. Verify new location works
source ~/.config/youtube/.env
cat "$YOUTUBE_CLIENT_SECRET_JSON" | jq .
```

---

## Integration with Brain Repo

This credential location should be tracked in the Brain repo's credentials index:

**File:** `/Users/Office/Repos/stevewesthoek/brain/operations/accounts/credentials-index.md`

**Proposed entries:**

| Credential | Storage | Purpose | Rotation | Regenerate |
|------------|---------|---------|----------|-----------|
| Says the Bible OAuth Client JSON | `~/.config/youtube/client_secret.json` | OAuth 2.0 client credentials (says-the-bible) — contains client_id, client_secret, token_uri, etc. | Rotate via Google Cloud Console if compromised | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Clients |
| ProChat OAuth Client JSON | `~/.config/youtube/prochat_client_secret.json` | OAuth 2.0 client credentials (prochat/video-orchestrator-495920) — contains client_id, client_secret, token_uri, etc. | Rotate via Google Cloud Console if compromised | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Clients |
| YouTube Config | `~/.config/youtube/.env` | References to OAuth JSON files, token file, API endpoints, scopes (config, not secret) | Static | — |
| Auto-refreshed OAuth tokens | `~/.youtube_tokens.json` | Generated by `../cloud/scripts/youtube-auth-local.sh` — contains access_token and refresh_token for both channels | Auto-refreshes; delete and re-auth if stale | Run `../cloud/scripts/youtube-auth-local.sh` to re-authenticate |

**Why?** The Brain repo maintains a master credentials index for all systems. This keeps all credentials discoverable, trackable, and properly secured in one place.

---

## Security Cautions

### DO ✅

- ✅ Store credentials in `~/.config/youtube/.env`
- ✅ Set permissions to `600`
- ✅ Keep `.config/` gitignored globally
- ✅ Use `YOUTUBE_TOKEN_FILE` reference (don't hardcode paths)
- ✅ Let scripts auto-refresh tokens
- ✅ Rotate if compromised

### DO NOT ❌

- ❌ Commit `~/.config/youtube/.env` to git
- ❌ Commit `~/.youtube_tokens.json` to git
- ❌ Hardcode credentials in scripts
- ❌ Log or print tokens
- ❌ Share credentials via email/Slack
- ❌ Leave credentials in temp files
- ❌ Use the same token across machines

---

## Rotation and Maintenance

### Automatic Maintenance

Scripts handle this automatically:

1. **Credential Loading**
   - All scripts source `~/.config/youtube/.env` at startup
   - Scripts read path to `client_secret.json` from env variable
   - If file not found: script fails with clear error message

2. **Token Expiry Check**
   - Before upload: scripts check if `expires_in < 300` seconds
   - If expiring: auto-refresh using `refresh_token`
   - No manual intervention needed

3. **Token Refresh**
   - `../cloud/scripts/youtube-upload-local.sh` extracts `client_id` and `client_secret` from JSON
   - Calls Google OAuth endpoint
   - Gets new `access_token` using `refresh_token`
   - Updates `~/.youtube_tokens.json` with new token and timestamp

### Manual Rotation

If credentials are compromised:

1. **Revoke OAuth client** (disable old client):
   ```
   Google Cloud Console → APIs & Services → Credentials
   Delete or disable the "says-the-bible-youtube-uploader-local" client
   ```

2. **Create new OAuth client**:
   ```
   Google Cloud Console → APIs & Services → Credentials
   Create new Desktop application OAuth client
   Download as JSON
   ```

3. **Replace OAuth client JSON**:
   ```bash
   # Download new client_secret.json from Google Cloud Console
   cp ~/Downloads/client_secret_*.json ~/.config/youtube/client_secret.json
   chmod 600 ~/.config/youtube/client_secret.json
   ```

4. **Re-authenticate locally**:
   ```bash
   rm ~/.youtube_tokens.json  # Delete old token
   ../cloud/scripts/youtube-auth-local.sh  # Re-authorize with new credentials
   ../cloud/scripts/youtube-auth-check.sh  # Verify new token works
   ```

---

## Deferred to I-6.2c+

The following credential storage patterns are deferred:

- ❌ AWS Secrets Manager integration
- ❌ Service account key storage
- ❌ Lambda environment variables
- ❌ Multi-region credential replication

For now: Local `~/.config/youtube/.env` is the only source.

---

## Troubleshooting

### "Central credentials config not found"

```bash
Error: Central credentials config not found: ~/.config/youtube/.env

Fix:
mkdir -p ~/.config/youtube
chmod 700 ~/.config/youtube

# Then follow "Adding Credentials to Your Computer" section above
```

### "OAuth client JSON not found"

```bash
Error: OAuth client JSON not found: ~/.config/youtube/client_secret.json

Fix:
1. Download OAuth 2.0 Client JSON from Google Cloud Console
   Google Cloud Console → APIs & Services → Credentials
   → OAuth 2.0 Client ID: "says-the-bible-youtube-uploader-local"
   → Download button (JSON format)

2. Move to central location:
   cp ~/Downloads/client_secret_*.json ~/.config/youtube/client_secret.json
   chmod 600 ~/.config/youtube/client_secret.json

3. Verify:
   cat ~/.config/youtube/client_secret.json | jq .
```

### "Could not extract credentials from JSON"

```bash
Error: Could not extract credentials from ~/.config/youtube/client_secret.json

Cause: JSON file is malformed or missing required fields

Fix:
1. Verify JSON is valid:
   cat ~/.config/youtube/client_secret.json | jq .

2. Verify required fields exist:
   cat ~/.config/youtube/client_secret.json | jq '.installed | keys'
   # Should show: client_id, client_secret, token_uri, etc.

3. If JSON is invalid, re-download from Google Cloud Console
```

### "Token file not found"

```bash
Error: Token file not found: ~/.youtube_tokens.json

Cause: First-time setup, no token generated yet

Fix:
../cloud/scripts/youtube-auth-local.sh
# Follows OAuth flow, generates ~/.youtube_tokens.json
```

### "Token expired"

```bash
Scripts auto-refresh if token < 5 minutes old

If manual refresh needed:
rm ~/.youtube_tokens.json
../cloud/scripts/youtube-auth-local.sh

Or verify current token:
../cloud/scripts/youtube-auth-check.sh
```

### "Cannot read config files"

```bash
Error: Permission denied reading ~/.config/youtube/

Fix:
chmod 700 ~/.config/youtube
chmod 600 ~/.config/youtube/.env
chmod 600 ~/.config/youtube/client_secret.json

Verify:
ls -la ~/.config/youtube/
# .env and client_secret.json should show: -rw------- (600)
```

---

## Related Documentation

- **Setup Guide:** `releases/i-6-youtube-auth-setup.md`
- **Upload Proof:** `releases/i-6-youtube-upload-proof.md`
- **Brain Credentials Index:** `/Users/Office/Repos/stevewesthoek/brain/operations/accounts/credentials-index.md`
- **Local Auth Script:** `../cloud/scripts/youtube-auth-local.sh`
- **Validation Script:** `../cloud/scripts/youtube-auth-check.sh`
- **Upload Script:** `../cloud/scripts/youtube-upload-local.sh`

---

**Status:** ✅ Central credentials storage configured  
**Date:** 2026-05-31  
**Last verified:** Manual setup confirmed
