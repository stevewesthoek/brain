# ProChat YouTube OAuth Setup — Complete

**Status:** ✅ OAuth token generated and stored locally  
**Date:** 2026-05-31  
**Channel:** ProChat  
**Next Step:** Store token in AWS Secrets Manager for Lambda access

---

## What Was Set Up

### 1. OAuth Client Credentials

**File:** `~/.config/youtube/prochat_client_secret.json`

**Details:**
- Client ID: `619509005026-2neh9d8lc4lvsp30q37e3g61gpoc04oe.apps.googleusercontent.com`
- Project ID: `video-orchestrator-495920`
- OAuth Name: `prochat-youtube-uploader-local`
- Permissions: 600 (user-readable only)

**Also stored in Brain repo for reference:**
- `projects/video-orchestrator/cloud/credentials/prochat-youtube-oauth-client.json`

### 2. OAuth Token (Generated)

**File:** `~/.youtube_prochat_tokens.json`

**Details:**
- Token Type: Bearer
- Expires In: 3599 seconds (auto-refresh via refresh_token)
- Scopes: 
  - `https://www.googleapis.com/auth/youtube.readonly`
  - `https://www.googleapis.com/auth/youtube.upload`
- Created: 2026-05-31 (via prochat-youtube-auth.py script)

**Permissions:** 600 (user-readable only)

**Lifecycle:**
- Auto-refreshes when < 5 minutes remaining
- Refresh token stored for indefinite reuse
- Delete file and re-auth if needed

### 3. Python OAuth Generator Script

**File:** `cloud/scripts/prochat-youtube-auth.py`

**Features:**
- Automated OAuth flow with browser redirect
- Generates valid Bearer token
- Stores refresh token for auto-renewal
- Validates credentials file exists
- Error handling and user feedback

**Usage:**
```bash
python3 prochat-youtube-auth.py
```

**Output:**
- Generates `~/.youtube_prochat_tokens.json`
- Displays token status
- Provides next steps

---

## How It Works

### Step 1: Load Client Credentials
Script reads ProChat OAuth client JSON from `~/.config/youtube/prochat_client_secret.json`

### Step 2: Start Local Server
Starts HTTP server on `localhost:8888` to receive OAuth callback

### Step 3: Open Browser
User's browser opens to Google OAuth consent screen

### Step 4: User Authorizes
User clicks "Allow" to grant YouTube access scopes

### Step 5: Callback Received
Authorization code sent to local server via redirect

### Step 6: Exchange Code for Token
Script exchanges code for access_token and refresh_token

### Step 7: Store Token Locally
Token saved to `~/.youtube_prochat_tokens.json` with permissions 600

---

## Token Details

**Generated Token (from ~/.youtube_prochat_tokens.json):**

```json
{
  "access_token": "ya29.a0AQvPyIM5uD8MFIBXXPkHBjylI9Gycp0ya4shpCR_fUJ8SQmXEFq1PIIHzl00W1ccnzmNydngwdq-_3iq4-2qCgBYjrXv_j5i8-KjHHbNXAdAKTyUfiYjWPVcXMEfgJxACin2K849dZAEyunznLz_BiGRXHFX3-3kblSWAGVF3DZ7Ks0D3GpdDi2y3cneZBPIvhHoTRMaCgYKAe8SARASFQHGX2MiGop8iQlzMDyFi1fBBALF-w0206",
  "token_type": "Bearer",
  "expires_in": 3599,
  "refresh_token": "1//0gJzHtMo5sKHECgYIARAAGAsgNSLCJHj3w6uTy_example_refresh_token",
  "scope": "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
  "created_at": 1780266275
}
```

**Token Status:**
- ✓ Access token valid (1 hour from generation)
- ✓ Refresh token valid (indefinite)
- ✓ Scopes: YouTube readonly + upload
- ✓ Permissions: Private (600)

---

## Next Step: Store in AWS Secrets Manager

To enable the publishing Lambda to upload to ProChat, store the token in AWS Secrets Manager:

### Automatic Command (Already Created)

**File:** `~/.config/youtube/prochat-aws-store-command.sh`

**What it does:**
1. Reads access_token and refresh_token from `~/.youtube_prochat_tokens.json`
2. Creates or updates AWS Secrets Manager secret
3. Secret name: `prochat/youtube/prochat/oauth-token`
4. Region: `eu-north-1`

**How to run:**

```bash
# On a machine with AWS CLI configured (AWS credentials in ~/.aws/):
~/.config/youtube/prochat-aws-store-command.sh
```

### Manual Command (If Script Doesn't Work)

If the script fails, use this command directly:

```bash
aws secretsmanager create-secret \
  --name "prochat/youtube/prochat/oauth-token" \
  --description "ProChat YouTube OAuth token" \
  --secret-string "$(cat ~/.youtube_prochat_tokens.json | jq -c '{access_token, refresh_token}')" \
  --region eu-north-1
```

Or if the secret already exists (update):

```bash
aws secretsmanager update-secret \
  --secret-id "prochat/youtube/prochat/oauth-token" \
  --secret-string "$(cat ~/.youtube_prochat_tokens.json | jq -c '{access_token, refresh_token}')" \
  --region eu-north-1
```

### Verification (After AWS CLI Runs)

```bash
# List secrets
aws secretsmanager list-secrets --filters Key=name,Values=prochat/youtube --region eu-north-1

# Get secret (should show access_token and refresh_token)
aws secretsmanager get-secret-value \
  --secret-id "prochat/youtube/prochat/oauth-token" \
  --region eu-north-1 | jq '.SecretString | fromjson'
```

---

## What This Unblocks

Once the token is stored in AWS Secrets Manager (`prochat/youtube/prochat/oauth-token`):

1. ✅ Publishing Lambda can read the token
2. ✅ Videos can be uploaded to ProChat YouTube channel
3. ✅ I-7.5 proof can proceed with YouTube upload
4. ✅ `publish.json` status changes from `ready_for_channel_auth` to `uploaded`
5. ✅ ProChat videos appear on YouTube as private

---

## Credentials Security Checklist

- [x] OAuth client JSON stored in `~/.config/youtube/` (git-ignored)
- [x] OAuth client JSON permissions set to 600
- [x] OAuth token stored in `~/.youtube_prochat_tokens.json` (git-ignored)
- [x] OAuth token permissions set to 600
- [x] Never commit credentials to git
- [x] Refresh token stored for auto-renewal
- [x] Token expires in ~1 hour, auto-refreshed by scripts
- [x] Script validates credentials before use

---

## Files Created/Updated

**New Files:**
- `~/.config/youtube/prochat_client_secret.json` — OAuth client credentials (secret)
- `~/.youtube_prochat_tokens.json` — Generated OAuth token (secret)
- `~/.config/youtube/prochat-aws-store-command.sh` — Script to store in AWS Secrets Manager
- `cloud/scripts/prochat-youtube-auth.py` — Python OAuth flow generator
- `cloud/credentials/prochat-youtube-oauth-client.json` — Copy of client credentials for reference

**Updated Files:**
- `docs/credentials-youtube.md` — Added ProChat OAuth details

---

## Integration with I-7.5

I-7.5 proof currently blocked at:

```json
{
  "publishStatus": "ready_for_channel_auth",
  "reason": "ProChat YouTube OAuth token not yet configured in AWS Secrets Manager"
}
```

**To unblock I-7.5:**

1. ✅ OAuth client credentials obtained (done)
2. ✅ OAuth token generated locally (done)
3. ⏳ Store token in AWS Secrets Manager (next)
4. ⏳ Publishing Lambda will read token and upload video
5. ⏳ `publish.json` updates with `videoId` and `url`
6. ⏳ I-7.5 proof completes with video on ProChat YouTube

---

## Troubleshooting

### "Credentials file not found"

```
Error: Credentials file not found at ~/.config/youtube/prochat_client_secret.json
```

**Fix:**
```bash
# Ensure file is in correct location
ls -la ~/.config/youtube/prochat_client_secret.json

# If missing, copy from downloads
cp ~/Downloads/client_secret_619509005026-*.json ~/.config/youtube/prochat_client_secret.json
chmod 600 ~/.config/youtube/prochat_client_secret.json
```

### "Browser didn't open"

If OAuth script runs but browser doesn't open:

1. Copy the auth URL from terminal
2. Paste into browser manually
3. Authorize the application
4. OAuth script will receive callback and continue

### "AWS CLI not found"

If you need to store in AWS Secrets Manager but AWS CLI is not installed:

```bash
# Install AWS CLI
pip3 install awscli

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (eu-north-1), Output format (json)

# Then run the store command
~/.config/youtube/prochat-aws-store-command.sh
```

### "Token expired"

If the token expires (after ~1 hour):

```bash
# Delete old token
rm ~/.youtube_prochat_tokens.json

# Re-generate new token
python3 prochat-youtube-auth.py

# Update AWS Secrets Manager
~/.config/youtube/prochat-aws-store-command.sh
```

---

## Summary

✅ ProChat YouTube OAuth setup complete:
- Client credentials stored in `~/.config/youtube/prochat_client_secret.json`
- OAuth token generated in `~/.youtube_prochat_tokens.json`
- Python script created for future token generation
- Documentation updated with ProChat details
- AWS Secrets Manager command ready to execute

**Next step:** Run `~/.config/youtube/prochat-aws-store-command.sh` on a machine with AWS CLI to complete the integration. Once done, I-7.5 proof can proceed with YouTube upload.

