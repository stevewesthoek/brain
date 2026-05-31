# I-6.2a YouTube Authentication Setup

**Date:** 2026-05-31  
**Phase:** I-6 Publishing Orchestration (I-6.2a)  
**Status:** ✅ DOCUMENTATION AND LOCAL SETUP COMPLETE

**Scope:** Authentication infrastructure only. No uploads. No videos posted to YouTube.

---

## Overview

This phase establishes secure YouTube authentication without publishing any content. It creates:
- Local OAuth flow tooling for development
- Token validation and testing
- Architectural patterns for AWS Lambda token storage (deferred to I-6.2b)
- Security guidelines and gitignore exclusions

---

## YouTube Data API v3 Requirements

### Google Cloud Project Setup

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project: "ProChat Video Publishing"
   - Enable billing (free tier available)

2. **Enable YouTube Data API v3**
   - In Cloud Console, search for "YouTube Data API v3"
   - Click "Enable"
   - This enables the API for your project

3. **Create OAuth Consent Screen**
   - Go to APIs & Services → OAuth consent screen
   - Choose User Type: External (required for development)
   - Fill in App information:
     - App name: "ProChat Video Generator"
     - User support email: your-email@example.com
     - Developer contact: your-email@example.com
   - Add scopes (see below)
   - Save draft (do not publish for now)

### OAuth 2.0 Credentials

1. **Create Service Account (for Lambda)**
   - Go to APIs & Services → Credentials
   - Create Credentials → Service Account
   - Name: "prochat-video-publishing"
   - Grant role: Editor (or custom role with youtube.upload)
   - Create key: JSON format
   - Download and store securely (see storage strategy below)

2. **Create OAuth 2.0 Client (for Local Dev)**
   - Go to APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Desktop application
   - Name: "ProChat Local Dev"
   - Download JSON file (client_secret.json)
   - Store in local .gitignored directory

### Required OAuth Scopes

**For Testing (readonly):**
```
https://www.googleapis.com/auth/youtube.readonly
```
- Allows reading channel information
- Used for validation: `channels.list` with `mine=true`

**For Publishing (upload):**
```
https://www.googleapis.com/auth/youtube.upload
```
- Allows uploading videos to channel
- Allows setting video metadata
- Used in I-6.2b for actual uploads

**Combined scope string for local dev:**
```
https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload
```

### Local Development OAuth Flow

**Credentials Setup:**

**Credentials file:** `~/.config/youtube/.env` (central location, single source of truth)

All scripts automatically load credentials from this central location. See `../credentials-youtube.md` for setup instructions.

**Token Lifecycle:**

1. **Initial Setup** (one-time, manual)
   - Create central credentials file: `~/.config/youtube/.env`
   - Add: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
   - User runs: `../../cloud/scripts/youtube-auth-local.sh`
   - Script reads credentials from central location
   - Script opens browser to Google OAuth consent screen
   - User clicks "Allow"
   - Google redirects to localhost with auth code
   - Script exchanges auth code for tokens
   - Tokens stored in `~/.youtube_tokens.json` (gitignored, auto-generated)

2. **Token Refresh** (automatic)
   - Access token: 1 hour validity
   - Refresh token: long-lived (until revoked)
   - Script automatically refreshes access token using refresh token
   - No manual intervention needed

3. **Validation** (on-demand)
   - Run: `../../cloud/scripts/youtube-auth-check.sh`
   - Script reads token from `~/.youtube_tokens.json`
   - Calls `channels.list` API to verify token works
   - Prints authenticated channel name and ID

### Token File Format

**`~/.youtube_tokens.json`** (LOCAL DEV ONLY)

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

**Properties:**
- `access_token`: Current token for API calls (expires in ~1 hour)
- `refresh_token`: Long-lived token to request new access tokens
- `expires_in`: Seconds until access_token expires
- `created_at`: Unix timestamp when token was created
- `scope`: Space-separated OAuth scopes granted by user

### AWS Lambda Token Storage Strategy (Deferred to I-6.2b)

**Pattern 1: AWS Secrets Manager** (Recommended)
```
Secret name: prochat/youtube/oauth-tokens
Region: eu-north-1
Stores: refresh_token (access_token can be regenerated)
Lambda: Reads refresh_token, calls OAuth endpoint to get new access_token
Cost: $0.40/secret/month
Security: Encrypted, access logs, automatic rotation possible
```

**Pattern 2: AWS Systems Manager Parameter Store** (Alternative)
```
Parameter name: /prochat/youtube/oauth-refresh-token
Type: SecureString
Lambda: Same flow as Secrets Manager
Cost: $0.04/parameter/month (free tier: 10 parameters)
```

**Lambda Token Refresh Logic:**
```python
def get_youtube_access_token():
    # Read refresh_token from Secrets Manager
    refresh_token = get_secret('prochat/youtube/oauth-tokens')['refresh_token']
    
    # Call Google OAuth endpoint
    response = requests.post('https://oauth2.googleapis.com/token', {
        'client_id': os.environ['YOUTUBE_CLIENT_ID'],
        'client_secret': os.environ['YOUTUBE_CLIENT_SECRET'],
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token'
    })
    
    # Extract access_token from response
    access_token = response.json()['access_token']
    
    # Use access_token for API calls
    return access_token
```

### Local Dev vs AWS Lambda Credentials

| Aspect | Local Dev | AWS Lambda |
|--------|-----------|-----------|
| **Credentials Config** | `~/.config/youtube/.env` (central) | AWS Secrets Manager (I-6.2c+) |
| **Token Storage** | `~/.youtube_tokens.json` (auto-generated) | AWS Secrets Manager (I-6.2c+) |
| **Client Type** | OAuth Desktop Client | Service Account or OAuth |
| **Token Flow** | Browser + localhost | Automatic via Secrets Manager |
| **Setup** | Manual (one-time) | Automated (no manual steps) |
| **Refresh** | Automatic if present | Automatic on each call |
| **Scopes** | Both readonly + upload | Depends on service account role |

**Central Credentials Location:** All local scripts read from `~/.config/youtube/.env` (see `../credentials-youtube.md` for details)

---

## Security Cautions

### DO ✅

- ✅ Store tokens in `.gitignored` files locally
- ✅ Store tokens in AWS Secrets Manager in production
- ✅ Use OAuth refresh tokens (not storing access tokens long-term)
- ✅ Rotate credentials if leaked
- ✅ Use minimal required scopes
- ✅ Log authentication errors but never log tokens
- ✅ Use HTTPS for all OAuth flows
- ✅ Validate token expiry before API calls
- ✅ Test token validation before attempting uploads

### DO NOT ❌

- ❌ Commit `client_secret.json` to git
- ❌ Commit token files to git
- ❌ Log or print tokens (even in debug mode)
- ❌ Embed credentials in Lambda code
- ❌ Use the same credentials for multiple environments
- ❌ Hardcode scopes (parameterize them)
- ❌ Skip token expiry checks
- ❌ Upload videos with invalid tokens (API rejects them anyway)

### Credential Rotation

If credentials are compromised:

1. **Immediately revoke** at https://myaccount.google.com/permissions
2. **Delete** old `client_secret.json`
3. **Delete** old token files
4. **Create new** credentials in Cloud Console
5. **Re-authenticate** locally: `../../cloud/scripts/youtube-auth-local.sh`
6. **Update** AWS Secrets Manager with new refresh token

---

## Validation Workflow

**Before I-6.2b (uploads), run:**

```bash
# Step 1: Authenticate (one-time setup)
../../cloud/scripts/youtube-auth-local.sh

# Step 2: Validate token works
../../cloud/scripts/youtube-auth-check.sh

# Expected output:
# ✓ Token found: ~/.youtube_tokens.json
# ✓ Token valid (expires in 3599 seconds)
# ✓ YouTube API responding
# ✓ Authenticated channel: My Channel (ID: UC1234...)
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `../../cloud/scripts/youtube-auth-local.sh` | Start OAuth flow, generate local token |
| `../../cloud/scripts/youtube-auth-check.sh` | Validate token, test API access |
| `./i-6-youtube-auth-setup.md` | This document |
| `.gitignore` | Entries for credentials and tokens |

---

## Deferred to I-6.2b

The following are **NOT** implemented in this phase:

- ❌ AWS Secrets Manager setup
- ❌ Service account key creation
- ❌ Lambda environment variables for client_id/client_secret
- ❌ `lambda-publish-youtube.py` (actual upload Lambda)
- ❌ Step Functions integration with YouTube publishing
- ❌ Video uploads to YouTube
- ❌ Thumbnail uploads
- ❌ Public video publishing

These will be added in I-6.2b after auth is validated locally.

---

## Quick Reference

### Setup (One-time)
```bash
# Manually in Cloud Console:
1. Create Google Cloud project
2. Enable YouTube Data API v3
3. Create OAuth consent screen
4. Create OAuth 2.0 Desktop Client
5. Download client_secret.json to ~/.youtube_client_secret.json

# Via script:
../../cloud/scripts/youtube-auth-local.sh
```

### Validate (Before each session)
```bash
../../cloud/scripts/youtube-auth-check.sh
```

### Check Token Expiry
```bash
jq '.expires_in' ~/.youtube_tokens.json  # Seconds remaining
```

### Revoke Token (if needed)
```bash
# At command line:
curl -X POST --data "token=$(jq -r '.access_token' ~/.youtube_tokens.json)" \
  https://oauth2.googleapis.com/revoke
```

---

## Next Steps (I-6.2b)

1. Create `lambda-publish-youtube.py` that reads publish.json
2. Implement OAuth token refresh in Lambda
3. Call YouTube `videos.insert` API
4. Handle upload progress and errors
5. Update publish.json with videoId and URL
6. Create integration test: upload test video, verify in YouTube Studio

---

## Success Criteria for I-6.2a

- [x] YouTube API v3 requirements documented
- [x] Google Cloud project setup documented
- [x] OAuth scopes defined (readonly + upload)
- [x] Local OAuth flow tooling created
- [x] Token validation script created
- [x] AWS token storage strategy documented
- [x] Security guidelines documented
- [x] .gitignore entries added
- [x] No real secrets in git
- [x] No uploads to YouTube
- [x] No service account keys created yet
- [x] No Lambda environment setup

---

**Status:** Ready for I-6.2b (YouTube upload Lambda implementation)

**Generated by:** Claude Haiku 4.5  
**Date:** 2026-05-31
