# I-6.2d YouTube OAuth Token Validation Lambda

**Status:** In Progress  
**Date:** 2026-05-31  
**Target:** Lambda-based token validation with auto-refresh for Step Functions  

---

## Overview

A Lambda function validates YouTube OAuth tokens from Secrets Manager and automatically refreshes them if expiring soon. This enables Step Functions workflows to safely retrieve and use tokens without exposing secrets in code.

**Capabilities:**
- ✓ Reads OAuth token from AWS Secrets Manager
- ✓ Validates token structure and fields
- ✓ Auto-refreshes if expiring in < 5 minutes
- ✓ Updates Secrets Manager with refreshed token
- ✓ Validates token by calling YouTube API
- ✓ Returns channel info (ID, title)
- ✓ Never prints token values in logs

---

## Lambda Configuration

### Function Details

| Property | Value |
|----------|-------|
| **Name** | `video-orchestrator-youtube-auth-check` |
| **Region** | `eu-north-1` |
| **Runtime** | Python 3.11 |
| **Timeout** | 30 seconds |
| **Memory** | 256 MB |
| **Handler** | `youtube-auth-check.handler` |

### Environment Variables

| Variable | Value |
|----------|-------|
| `YOUTUBE_SECRET_NAME` | `prochat/youtube/says-the-bible/oauth-token` |

### Source Code

**File:** `../../cloud/lambda/youtube-auth-check.py`

**Key functions:**
- `handler(event, context)` — Main Lambda entry point
- `read_secret(secret_name)` — Read token from Secrets Manager
- `update_secret(secret_name, token_json)` — Write updated token
- `refresh_token(refresh_token, client_id, client_secret)` — Call OAuth endpoint
- `validate_youtube_token(access_token)` — Test YouTube API

---

## Secret Structure

The token secret stores all information needed for refresh:

```json
{
  "access_token": "ya29.a0AfH6SMB...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "refresh_token": "1//0g...",
  "scope": "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
  "created_at": 1686840000,
  "client_id": "352914416758-ju164nd2uqlat4jj148e4i9snv1t7a05.apps.googleusercontent.com",
  "client_secret": "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"
}
```

**Required fields for refresh:**
- `access_token` — Current token for API calls
- `refresh_token` — Long-lived token for getting new access_token
- `created_at` — UNIX timestamp when token was generated/refreshed
- `expires_in` — Lifetime in seconds (usually 3600)
- `client_id` — OAuth client ID (for refresh)
- `client_secret` — OAuth client secret (for refresh)

---

## IAM Permissions

### Lambda Execution Role Policy

**Role Name:** `lambda-youtube-auth-check-role`

**Inline Policy:** `lambda-youtube-auth-check-policy`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:eu-north-1:909439522876:secret:prochat/youtube/says-the-bible/oauth-token*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-north-1:909439522876:log-group:/aws/lambda/video-orchestrator-youtube-auth-check*"
    }
  ]
}
```

**Least-privilege approach:**
- Only access the specific OAuth token secret
- Only write logs to its own log group
- No other AWS resource access

---

## Lambda Behavior

### Input

Lambda accepts no input (or empty event):
```json
{}
```

### Output (Success)

```json
{
  "ok": true,
  "channelId": "UCTET3QhCzrA1nwMkcNj8LmQ",
  "channelTitle": "Says the Bible",
  "tokenRefreshed": false,
  "expiresIn": 1234
}
```

### Output (Failure)

```json
{
  "ok": false,
  "error": "Token refresh failed: OAuth error: invalid_grant"
}
```

### Return Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Success indicator |
| `channelId` | string | YouTube channel ID (if ok=true) |
| `channelTitle` | string | YouTube channel name (if ok=true) |
| `tokenRefreshed` | boolean | Whether token was refreshed (if ok=true) |
| `expiresIn` | number | Seconds until token expiry (if ok=true) |
| `error` | string | Error message (if ok=false) |

---

## Token Refresh Process

### When Refresh Happens

1. Lambda reads token from Secrets Manager
2. Calculates: `expiry_time = created_at + expires_in`
3. Calculates: `seconds_remaining = expiry_time - current_time`
4. If `seconds_remaining < 300` (5 minutes):
   - Calls Google OAuth token endpoint
   - Sends: `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`
   - Receives: new `access_token`, `expires_in`
   - Updates Secrets Manager with new token
   - Returns: `tokenRefreshed: true`
5. Otherwise:
   - Continues with current token
   - Returns: `tokenRefreshed: false`

### Token Endpoint

**URL:** `https://oauth2.googleapis.com/token`

**Request:**
```
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

client_id=<CLIENT_ID>
&client_secret=<CLIENT_SECRET>
&refresh_token=<REFRESH_TOKEN>
&grant_type=refresh_token
```

**Response:**
```json
{
  "access_token": "ya29.a0AfH6SMC...",
  "expires_in": 3599,
  "token_type": "Bearer"
}
```

---

## Deployment

### Deploy Lambda

```bash
../../cloud/scripts/deploy-youtube-auth-check-lambda.sh
```

**What it does:**
1. Validates Lambda source file exists
2. Creates IAM role with trust policy
3. Attaches least-privilege inline policy
4. Packages Lambda as ZIP
5. Creates or updates Lambda function
6. Configures environment variables
7. Verifies deployment

### Verify Deployment

```bash
../../cloud/scripts/youtube-auth-check-lambda.sh
```

**What it does:**
1. Checks Lambda function exists
2. Invokes function with no input
3. Decodes CloudWatch logs
4. Parses response JSON
5. Validates response structure
6. Prints channel info (never token values)

---

## Safe Logging Rules

### DO ✅

- Log operation status (reading secret, refreshing token, calling API)
- Log channel ID and channel title from YouTube API
- Log token refresh status (true/false)
- Log seconds remaining until expiry
- Log error messages (without token values)

### DO NOT ❌

- Print access_token anywhere
- Print refresh_token anywhere
- Print client_secret anywhere
- Log raw request/response bodies (they contain tokens)
- Send tokens to external logging services
- Store tokens in CloudWatch logs
- Print OAuth responses that include tokens

### Example Safe Log Output

```
Reading token from Secrets Manager
Token validation in progress
Token expiring soon (280s remaining), refreshing...
Calling OAuth refresh endpoint
Token refreshed successfully
Validating YouTube API access
Channel: Says the Bible
Channel ID: UCTET3QhCzrA1nwMkcNj8LmQ
```

---

## Manual Testing

### Invoke Function (CLI)

```bash
aws lambda invoke \
  --function-name video-orchestrator-youtube-auth-check \
  --region eu-north-1 \
  --log-type Tail \
  /tmp/response.json

cat /tmp/response.json | jq .
```

### View CloudWatch Logs

```bash
aws logs tail /aws/lambda/video-orchestrator-youtube-auth-check \
  --region eu-north-1 \
  --follow
```

### Check Secret in Secrets Manager

```bash
aws secretsmanager get-secret-value \
  --secret-id prochat/youtube/says-the-bible/oauth-token \
  --region eu-north-1 \
  --query SecretString \
  --output text | jq 'keys'
```

Output shows fields (tokens not printed):
```json
[
  "access_token",
  "created_at",
  "expires_in",
  "refresh_token",
  "scope",
  "token_type",
  "client_id",
  "client_secret"
]
```

---

## Validation Proof (I-6.2d Complete)

### Pre-requisites
- ✓ OAuth token in Secrets Manager (I-6.2c)
- ✓ OAuth token includes client_id and client_secret
- ✓ IAM permissions configured

### Success Criteria

1. **Lambda deployment succeeds:**
   ```
   ✅ Lambda deployment complete
   Function: video-orchestrator-youtube-auth-check
   ```

2. **Lambda invocation succeeds:**
   ```
   ✅ Lambda validation successful
   Channel: Says the Bible
   Channel ID: UCTET3QhCzrA1nwMkcNj8LmQ
   ```

3. **Token validation passes:**
   - `ok: true`
   - Channel ID and title returned
   - No token values in response

4. **No token values printed:**
   - Response shows only `ok`, `channelId`, `channelTitle`, `tokenRefreshed`, `expiresIn`
   - Never prints `access_token`, `refresh_token`, or `client_secret`

---

## Troubleshooting

### "Access denied" when reading secret

**Cause:** Lambda IAM role lacks permissions

**Fix:**
```bash
# Verify role policy
aws iam get-role-policy \
  --role-name lambda-youtube-auth-check-role \
  --policy-name lambda-youtube-auth-check-policy \
  --region eu-north-1
```

### "OAuth error: invalid_grant"

**Cause:** Refresh token expired or client credentials wrong

**Fix:**
1. Re-authenticate locally: `../../cloud/scripts/youtube-auth-local.sh`
2. Upload new token: `../../cloud/scripts/youtube-store-secret.sh`
3. Update secret with client credentials (should be automatic)
4. Re-deploy Lambda: `../../cloud/scripts/deploy-youtube-auth-check-lambda.sh`

### "No channel found for authenticated user"

**Cause:** Token doesn't have proper scopes or belongs to disabled account

**Fix:**
1. Check token has `youtube.readonly` scope
2. Verify account at https://www.youtube.com
3. Re-authenticate if needed: `../../cloud/scripts/youtube-auth-local.sh`

### Lambda timeout

**Cause:** Network issues or Google OAuth endpoint slow

**Fix:**
- Timeout is 30 seconds (sufficient)
- Check CloudWatch logs for network errors
- Try invocation again (may be transient)

---

## Related Documentation

- **Secrets Manager Setup:** `./i-6-youtube-secrets-manager.md`
- **Local Upload Proof:** `./i-6-youtube-upload-proof.md`
- **Deployment Script:** `../../cloud/scripts/deploy-youtube-auth-check-lambda.sh`
- **Invocation Script:** `../../cloud/scripts/youtube-auth-check-lambda.sh`
- **Lambda Source:** `../../cloud/lambda/youtube-auth-check.py`

---

## Timeline

- **I-6.2a:** OAuth client credentials downloaded (✓)
- **I-6.2b:** Local YouTube upload proof (✓)
- **I-6.2c:** Secrets Manager storage (✓)
- **I-6.2d:** Lambda token validation (in progress)
- **I-6.2e:** Step Functions integration
- **I-6.2f:** Production video publishing pipeline

---

## Next Steps (I-6.2e)

1. Create Step Functions state machine
2. Define video upload task
3. Invoke Lambda for token validation
4. Chain: Validate → Download → Upload → Update

---

**Last Updated:** 2026-05-31  
**Next Step:** Run ../../cloud/scripts/deploy-youtube-auth-check-lambda.sh
