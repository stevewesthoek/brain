# I-6.2c YouTube OAuth Token Storage — AWS Secrets Manager

**Status:** In Progress  
**Date:** 2026-05-31  
**Target:** Secure token storage for Step Functions integration  

---

## Overview

YouTube OAuth tokens are moved from local-only storage to AWS Secrets Manager for safe retrieval by Lambda functions and Step Functions workflows.

**Local-only approach (I-6.2a/b):**
- ✓ Works for local development and scripts
- ✓ No external dependencies (runs on user machine)
- ✗ Not accessible to AWS Lambda
- ✗ Not suitable for Step Functions

**Secrets Manager approach (I-6.2c+):**
- ✓ Accessible to Lambda functions
- ✓ Integrated with Step Functions
- ✓ Audit trail via CloudTrail
- ✓ Automatic rotation support
- ✓ IAM-based access control

---

## Storage Location

**Secret Name:**
```
prochat/youtube/says-the-bible/oauth-token
```

**Region:** `eu-north-1`

**Content:** Full YouTube OAuth token JSON
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

---

## Required IAM Permissions

### For Local User (storing/managing secrets)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:eu-north-1:*:secret:prochat/youtube/says-the-bible/oauth-token*"
    }
  ]
}
```

### For Lambda (retrieving secrets)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:eu-north-1:*:secret:prochat/youtube/says-the-bible/oauth-token*"
    }
  ]
}
```

### For Step Functions (orchestrating secret retrieval)

Same as Lambda above (Step Functions delegates to Lambda).

---

## Scripts

### Store Token: `../../cloud/scripts/youtube-store-secret.sh`

**Purpose:** Upload local token to Secrets Manager

**Usage:**
```bash
../../cloud/scripts/youtube-store-secret.sh
```

**Behavior:**
1. Read `~/.youtube_tokens.json`
2. Validate required fields (access_token, refresh_token, created_at, expires_in)
3. Check AWS credentials
4. Create or update Secrets Manager secret
5. Verify secret exists and is readable
6. Never prints token values

**Success criteria:**
```
✅ Token stored in Secrets Manager
Secret: prochat/youtube/says-the-bible/oauth-token
```

### Verify Token: `../../cloud/scripts/youtube-secret-check.sh`

**Purpose:** Verify token in Secrets Manager and test YouTube API access

**Usage:**
```bash
../../cloud/scripts/youtube-secret-check.sh
```

**Behavior:**
1. Check AWS credentials
2. Read secret from Secrets Manager
3. Validate token structure (access_token, refresh_token, created_at, expires_in)
4. Check token expiry
5. Call YouTube API (channels.list) to validate access
6. Print channel name and ID
7. Never prints token values

**Success criteria:**
```
✅ Token verification successful
Authenticated channel: [Channel Name]
```

---

## Setup: Granting IAM Permissions

Before running the store/check scripts, attach IAM policy to your AWS user.

**Your IAM User:** `claude-code`  
**Account ID:** `909439522876`  
**Region:** `eu-north-1`

**To grant permissions:**

1. **Option A: AWS Console**
   - Go to IAM → Users → claude-code
   - Click "Add permissions" → "Attach policies"
   - Create inline policy using `i-6-youtube-secrets-manager-iam-policy.json`

2. **Option B: AWS CLI**
   ```bash
   aws iam put-user-policy \
     --user-name claude-code \
     --policy-name YouTubeSecretsManagerAccess \
     --policy-document file://./i-6-youtube-secrets-manager-iam-policy.json
   ```

3. **Verify permissions:**
   ```bash
   aws iam get-user-policy \
     --user-name claude-code \
     --policy-name YouTubeSecretsManagerAccess
   ```

---

## Migration Steps

### From Local-Only to Secrets Manager

**Prerequisites:**
- Local token generated: `~/.youtube_tokens.json`
- AWS credentials configured: `aws configure`
- IAM permissions granted (see setup section above)

**Steps:**

1. **Verify local token is valid:**
   ```bash
   ../../cloud/scripts/youtube-auth-check.sh
   ```

2. **Upload token to Secrets Manager:**
   ```bash
   ../../cloud/scripts/youtube-store-secret.sh
   ```

3. **Verify token in Secrets Manager:**
   ```bash
   ../../cloud/scripts/youtube-secret-check.sh
   ```

4. **Both sources now available:**
   - Local: `~/.youtube_tokens.json` (for ../../cloud/scripts/youtube-upload-local.sh)
   - Secrets Manager: `prochat/youtube/says-the-bible/oauth-token` (for Lambda/Step Functions)

5. **(Later) Lambda retrieves from Secrets Manager:**
   - Step Functions invokes Lambda
   - Lambda reads secret
   - Lambda executes upload

---

## Rollback Procedure

If Secrets Manager secret becomes invalid or corrupted:

1. **Check local token:**
   ```bash
   ../../cloud/scripts/youtube-auth-check.sh
   ```

2. **Verify it's still valid:**
   - If valid: use local scripts
   - If expired/invalid: re-authenticate

3. **Regenerate Secrets Manager secret:**
   ```bash
   ../../cloud/scripts/youtube-store-secret.sh
   ```

4. **If both local and remote are invalid:**
   ```bash
   # Re-authenticate locally
   rm ~/.youtube_tokens.json
   ../../cloud/scripts/youtube-auth-local.sh
   ../../cloud/scripts/youtube-auth-check.sh
   
   # Upload to Secrets Manager
   ../../cloud/scripts/youtube-store-secret.sh
   ../../cloud/scripts/youtube-secret-check.sh
   ```

---

## Token Refresh Behavior

### Current (I-6.2c)

- Access token: Valid ~1 hour (expires_in: 3600)
- Refresh token: Valid indefinitely (until revoked by Google)
- Manual refresh: User must run youtube-auth-local.sh

**Token stored includes:**
- access_token: Current token for API calls
- refresh_token: Can be used to get new access_token
- created_at: When token was generated (UNIX timestamp)
- expires_in: Lifetime in seconds (usually 3600)

### Future (I-6.2d+)

- Lambda will auto-refresh before expiry
- Step Functions will update Secrets Manager with new token
- No manual intervention needed

### Refresh Process (Lambda)

1. Read secret from Secrets Manager
2. Calculate expiry: created_at + expires_in
3. If expired or expiring soon:
   - Use refresh_token to get new access_token
   - Update secret with new access_token and created_at
4. Use access_token for YouTube API calls

---

## Local Scripts (Unchanged)

These scripts continue to work with local `~/.youtube_tokens.json`:

- `../../cloud/scripts/youtube-auth-local.sh` — Generate token locally
- `../../cloud/scripts/youtube-auth-check.sh` — Validate local token
- `../../cloud/scripts/youtube-upload-local.sh` — Upload video using local token

**No changes needed** — Dual-mode operation:
- Local mode for development: uses `~/.youtube_tokens.json`
- Lambda mode for production: uses Secrets Manager

---

## .gitignore Updates

Ensure these are gitignored (already should be):

```
# YouTube credentials
~/.youtube_tokens.json
~/.config/youtube/
.env.youtube
*.youtube_*
```

**These should NEVER be committed:**
- Local token files
- OAuth client secrets
- Any AWS secret values

---

## AWS Secrets Manager Features Used

### Versioning
- Automatic version history kept
- Can retrieve previous versions if needed
- Supports secret rotation

### Encryption
- Server-side encryption with AWS KMS (default key)
- Can use custom KMS key for additional control

### Audit Trail
- All access logged to CloudTrail
- Can track who accessed secret and when
- Useful for security reviews

### Access Control
- IAM-based permissions
- Can restrict by ARN, principal, condition
- Supports resource-based policies

---

## Manual Secret Management

### View Secret (Masked)
```bash
aws secretsmanager describe-secret \
  --secret-id prochat/youtube/says-the-bible/oauth-token \
  --region eu-north-1
```

### Rotate Secret (Manual)
```bash
# Re-authenticate locally
../../cloud/scripts/youtube-auth-local.sh

# Upload new token
../../cloud/scripts/youtube-store-secret.sh

# Verify
../../cloud/scripts/youtube-secret-check.sh
```

### Delete Secret
```bash
# WARNING: Cannot retrieve after deletion period (30 days default)
aws secretsmanager delete-secret \
  --secret-id prochat/youtube/says-the-bible/oauth-token \
  --region eu-north-1 \
  --recovery-window-in-days 30
```

### List All Secrets
```bash
aws secretsmanager list-secrets \
  --region eu-north-1 \
  --filters Key=name,Values=prochat/youtube
```

---

## Security Considerations

### DO ✅
- Store full token JSON (access + refresh tokens)
- Use Secrets Manager for production access
- Rotate tokens annually (or when compromised)
- Use IAM roles for Lambda (never hardcode keys)
- Audit secret access via CloudTrail
- Use KMS encryption (AWS managed key is fine)

### DO NOT ❌
- Print token values in logs
- Expose token in Lambda environment variables
- Commit token to git
- Share secrets via email/Slack
- Use same token across multiple machines
- Store plaintext in CloudFormation

---

## Related Documentation

- **Local Auth Setup:** `./i-6-youtube-auth-setup.md`
- **Upload Proof:** `./i-6-youtube-upload-proof.md`
- **Brain Credentials Index:** `/Users/Office/Repos/stevewesthoek/brain/operations/accounts/credentials-index.md`
- **Local Auth Script:** `../../cloud/scripts/youtube-auth-local.sh`
- **Store Secret Script:** `../../cloud/scripts/youtube-store-secret.sh`
- **Check Secret Script:** `../../cloud/scripts/youtube-secret-check.sh`

---

## Timeline

- **I-6.2a:** OAuth client credentials downloaded (✓ done)
- **I-6.2b:** Local YouTube upload proof (✓ done)
- **I-6.2c:** Secrets Manager storage (in progress)
- **I-6.2d:** Lambda token retrieval and refresh
- **I-6.2e:** Step Functions integration
- **I-6.2f:** Production video publishing pipeline

---

**Last Updated:** 2026-05-31  
**Next Step:** Run ../../cloud/scripts/youtube-store-secret.sh
