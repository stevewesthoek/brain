#!/bin/bash
# YouTube Local Upload Proof
# Uploads generated video to YouTube as private (or unlisted with --unlisted flag)
# Updates publish.json with video ID and status
# Usage: scripts/youtube-upload-local.sh <jobId> [--unlisted] [--dry-run] [--force-new-upload]
#        scripts/youtube-upload-local.sh <jobId> --retry-thumbnail [--dry-run]
#
# Credentials location: ~/.config/youtube/<channel>.env (channel-specific credentials store)
# Token location: configured by YOUTUBE_TOKEN_FILE in that channel env file
#
# Safety features:
# - Prevents duplicate video uploads (checks publish.json for existing videoId)
# - Retry thumbnail upload independently with --retry-thumbnail mode
# - Captures thumbnail errors in publish.json for debugging

set -e

JOB_ID="${1}"
BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
TMP_DIR="/tmp/youtube-upload-${RANDOM}-$(date +%s)"

infer_channel_from_job_id() {
    case "$1" in
        prochat-*) echo "prochat" ;;
        says-the-bible-*) echo "says-the-bible" ;;
        approved-video-*)
            # Phase 1W: read projectId from topic.json if present
            local script_dir
            script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            local jobs_dir
            jobs_dir="$(dirname "$script_dir")/jobs"
            local topic_file="$jobs_dir/$1/metadata/topic.json"
            if [ -f "$topic_file" ]; then
                python3 -c "import json; d=json.load(open('$topic_file')); print(d.get('projectId',''))" 2>/dev/null || echo ""
            else
                echo ""
            fi
            ;;
        *) echo "" ;;
    esac
}

CHANNEL_ID="${YOUTUBE_CHANNEL_ID:-$(infer_channel_from_job_id "$JOB_ID")}"
if [ -z "$CHANNEL_ID" ]; then
    echo "ERROR: Cannot infer YouTube channel from jobId: $JOB_ID"
    echo "Set YOUTUBE_CHANNEL_ID explicitly or use a jobId starting with prochat- or says-the-bible-."
    exit 1
fi

CONFIG_FILE="${YOUTUBE_CONFIG_FILE:-${HOME}/.config/youtube/${CHANNEL_ID}.env}"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Channel-specific YouTube config not found: $CONFIG_FILE"
    echo "Create one config per channel, for example:"
    echo "  ~/.config/youtube/prochat.env"
    echo "  ~/.config/youtube/says-the-bible.env"
    exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

TOKEN_FILE="${YOUTUBE_TOKEN_FILE:-${HOME}/.youtube_tokens-${CHANNEL_ID}.json}"

# Defaults
PRIVACY_STATUS="private"
DRY_RUN=false
UNLISTED=false
FORCE_NEW_UPLOAD=false
RETRY_THUMBNAIL=false

is_quota_error() {
    local text="${1:-}"
    shopt -s nocasematch
    case "$text" in
        *quotaexceeded*|*dailylimitexceeded*|*ratelimitexceeded*|*userratelimitexceeded*|*"exceeded your quota"*)
            return 0
            ;;
    esac
    shopt -u nocasematch
    return 1
}

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
if [ -z "$JOB_ID" ]; then
    echo "Usage: $0 <jobId> [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --unlisted            Upload as unlisted (default: private)"
    echo "  --dry-run             Validate only, don't upload"
    echo "  --force-new-upload    Force new upload (bypass duplicate check)"
    echo "  --retry-thumbnail     Retry thumbnail upload for existing videoId"
    echo ""
    echo "Examples:"
    echo "  $0 prochat-os-030                           # Upload as private"
    echo "  $0 prochat-os-030 --dry-run                 # Validate only"
    echo "  $0 prochat-os-030 --unlisted                # Upload as unlisted"
    echo "  $0 prochat-os-030 --retry-thumbnail         # Retry thumbnail"
    echo "  $0 prochat-os-030 --retry-thumbnail --dry-run"
    exit 1
fi

# Parse optional flags
for arg in "${@:2}"; do
    case "$arg" in
        --unlisted)
            PRIVACY_STATUS="unlisted"
            UNLISTED=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --force-new-upload)
            FORCE_NEW_UPLOAD=true
            ;;
        --retry-thumbnail)
            RETRY_THUMBNAIL=true
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

echo "==========================================="
if [ "$RETRY_THUMBNAIL" = true ]; then
    echo "YouTube Thumbnail Retry"
else
    echo "YouTube Local Upload Proof"
fi
echo "==========================================="
echo ""
echo "Job ID: $JOB_ID"
echo "Channel config: $CHANNEL_ID"
echo "Config file: $CONFIG_FILE"
echo "Token file: $TOKEN_FILE"
if [ -n "${YOUTUBE_ACCOUNT_LABEL:-}" ]; then
    echo "Expected Google account: $YOUTUBE_ACCOUNT_LABEL"
fi
if [ -n "${YOUTUBE_CHANNEL_TITLE:-}" ]; then
    echo "Expected YouTube channel: $YOUTUBE_CHANNEL_TITLE"
fi
if [ "$RETRY_THUMBNAIL" = false ]; then
    echo "Privacy: $PRIVACY_STATUS"
    echo "Force new: $FORCE_NEW_UPLOAD"
fi
echo "Retry thumbnail: $RETRY_THUMBNAIL"
echo "Dry-run: $DRY_RUN"
echo ""

# Clean up on exit
cleanup() {
    if [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}
trap cleanup EXIT

# Step 1: Check OAuth token
echo "[1/8] Checking OAuth token..."

if [ ! -f "$TOKEN_FILE" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}⚠ [DRY-RUN] Token file not found — skipping OAuth check${NC}"
        echo "  (Token is only required for live upload)"
        # Set placeholder values for dry-run metadata steps
        ACCESS_TOKEN="DRY_RUN_TOKEN"
        REFRESH_TOKEN="DRY_RUN_REFRESH"
    else
        echo -e "${RED}❌ ERROR: Token file not found: $TOKEN_FILE${NC}"
        echo ""
        echo "Run: scripts/youtube-auth-local.sh"
        exit 1
    fi
else

ACCESS_TOKEN=$(jq -r '.access_token // empty' "$TOKEN_FILE" 2>/dev/null)
REFRESH_TOKEN=$(jq -r '.refresh_token // empty' "$TOKEN_FILE" 2>/dev/null)
CREATED_AT=$(jq -r '.created_at // empty' "$TOKEN_FILE" 2>/dev/null)
EXPIRES_IN=$(jq -r '.expires_in // empty' "$TOKEN_FILE" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ -z "$REFRESH_TOKEN" ]; then
    echo -e "${RED}❌ ERROR: Invalid token file${NC}"
    exit 1
fi

# Check token expiry and refresh if needed
CURRENT_TIME=$(date +%s)
EXPIRY_TIME=$((CREATED_AT + EXPIRES_IN))
SECONDS_REMAINING=$((EXPIRY_TIME - CURRENT_TIME))

if [ $SECONDS_REMAINING -lt 300 ]; then
    echo "⚠ Token expiring soon, refreshing..."

    # Refresh token
    if [ -z "${YOUTUBE_CLIENT_ID}" ] || [ -z "${YOUTUBE_CLIENT_SECRET}" ]; then
        # Try to read from this channel's configured client_secret file
        CLIENT_SECRET_FILE="${YOUTUBE_CLIENT_SECRET_JSON:-}"
        if [ -z "$CLIENT_SECRET_FILE" ] || [ ! -f "$CLIENT_SECRET_FILE" ]; then
            echo -e "${RED}❌ ERROR: Cannot refresh token (missing channel credentials)${NC}"
            echo "Config file: $CONFIG_FILE"
            echo "Expected YOUTUBE_CLIENT_SECRET_JSON to point to a valid OAuth client JSON."
            echo "Run: scripts/youtube-auth-local.sh $CHANNEL_ID"
            exit 1
        fi
        CLIENT_ID=$(jq -r '.installed.client_id' "$CLIENT_SECRET_FILE")
        CLIENT_SECRET=$(jq -r '.installed.client_secret' "$CLIENT_SECRET_FILE")
    else
        CLIENT_ID="${YOUTUBE_CLIENT_ID}"
        CLIENT_SECRET="${YOUTUBE_CLIENT_SECRET}"
    fi

    REFRESH_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
        -d "client_id=${CLIENT_ID}" \
        -d "client_secret=${CLIENT_SECRET}" \
        -d "refresh_token=${REFRESH_TOKEN}" \
        -d "grant_type=refresh_token")

    NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.access_token // empty')
    if [ -z "$NEW_ACCESS_TOKEN" ]; then
        echo -e "${RED}❌ ERROR: Token refresh failed${NC}"
        echo "Response: $REFRESH_RESPONSE"
        exit 1
    fi

    # Update token file
    NEW_CREATED_AT=$(date +%s)
    NEW_EXPIRES_IN=$(echo "$REFRESH_RESPONSE" | jq -r '.expires_in')
    jq --arg at "$NEW_ACCESS_TOKEN" --arg ct "$NEW_CREATED_AT" --arg ei "$NEW_EXPIRES_IN" \
        '.access_token = $at | .created_at = ($ct | tonumber) | .expires_in = ($ei | tonumber)' \
        "$TOKEN_FILE" > "${TOKEN_FILE}.tmp" && mv "${TOKEN_FILE}.tmp" "$TOKEN_FILE"

    ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
    echo "✓ Token refreshed"
fi

echo -e "${GREEN}✓ Token valid (${SECONDS_REMAINING}s remaining)${NC}"

CHANNEL_INFO=$(curl -s "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
AUTHORIZED_CHANNEL_NAME=$(echo "$CHANNEL_INFO" | jq -r '.items[0].snippet.title // empty')
AUTHORIZED_CHANNEL_ID=$(echo "$CHANNEL_INFO" | jq -r '.items[0].id // empty')
if [ -z "$AUTHORIZED_CHANNEL_NAME" ] || [ -z "$AUTHORIZED_CHANNEL_ID" ]; then
    echo -e "${RED}❌ ERROR: Could not verify authorized YouTube channel${NC}"
    echo "Response: $CHANNEL_INFO"
    exit 1
fi
if [ -n "${YOUTUBE_CHANNEL_TITLE:-}" ] && [ "$AUTHORIZED_CHANNEL_NAME" != "$YOUTUBE_CHANNEL_TITLE" ]; then
    echo -e "${RED}❌ ERROR: Authorized YouTube channel does not match this job config${NC}"
    echo "  Config file: $CONFIG_FILE"
    echo "  Expected channel: $YOUTUBE_CHANNEL_TITLE"
    echo "  Authorized channel: $AUTHORIZED_CHANNEL_NAME"
    echo "  Authorized channel ID: $AUTHORIZED_CHANNEL_ID"
    echo "Delete the wrong token and rerun auth with the correct Google/brand account:"
    echo "  rm -f \"$TOKEN_FILE\""
    echo "  scripts/youtube-auth-local.sh $CHANNEL_ID"
    exit 1
fi
echo "✓ Authorized channel verified: $AUTHORIZED_CHANNEL_NAME ($AUTHORIZED_CHANNEL_ID)"
echo ""

# Step 2: Read publish.json from S3
echo "[2/8] Reading publish.json from S3..."

PUBLISH_JSON=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" - --region eu-north-1 2>/dev/null)

if [ -z "$PUBLISH_JSON" ]; then
    echo -e "${RED}❌ ERROR: publish.json not found${NC}"
    exit 1
fi

PUBLISH_STATUS=$(echo "$PUBLISH_JSON" | jq -r '.publishStatus // "MISSING"')
VIDEO_KEY=$(echo "$PUBLISH_JSON" | jq -r '.videoKey // "MISSING"')
THUMBNAIL_KEY=$(echo "$PUBLISH_JSON" | jq -r '.thumbnailKey // "MISSING"')
TITLE=$(echo "$PUBLISH_JSON" | jq -r '.title // ""')
DESCRIPTION=$(echo "$PUBLISH_JSON" | jq -r '.description // ""')
TAGS=$(echo "$PUBLISH_JSON" | jq -r '.tags // [] | @csv')

# Extract existing YouTube metadata
EXISTING_VIDEO_ID=$(echo "$PUBLISH_JSON" | jq -r '.platforms.youtube.videoId // empty')
EXISTING_YT_STATUS=$(echo "$PUBLISH_JSON" | jq -r '.platforms.youtube.status // empty')
EXISTING_YT_ERROR=$(echo "$PUBLISH_JSON" | jq -r '.platforms.youtube.error // empty')

echo -e "${GREEN}✓ publish.json found${NC}"
echo "  publishStatus: $PUBLISH_STATUS"
echo "  videoKey: $VIDEO_KEY"
echo "  thumbnailKey: $THUMBNAIL_KEY"
if [ -n "$EXISTING_VIDEO_ID" ]; then
    echo "  platforms.youtube.videoId: $EXISTING_VIDEO_ID"
    echo "  platforms.youtube.status: $EXISTING_YT_STATUS"
fi
echo ""

# Step 2b: Try to prefer youtube-package.json fields if available
echo "[2b/8] Checking for youtube-package.json (canonical metadata)..."
YT_PACKAGE_JSON=$(aws s3 cp "s3://$BUCKET/jobs/$JOB_ID/metadata/youtube-package.json" - --region eu-north-1 2>/dev/null || echo "")
if [ -n "$YT_PACKAGE_JSON" ]; then
    PKG_TITLE=$(echo "$YT_PACKAGE_JSON" | jq -r '.title // ""')
    PKG_DESCRIPTION=$(echo "$YT_PACKAGE_JSON" | jq -r '.description // ""')
    PKG_TAGS=$(echo "$YT_PACKAGE_JSON" | jq -r '.tags // [] | @csv')
    if [ -n "$PKG_TITLE" ]; then
        echo -e "${GREEN}✓ youtube-package.json found — using canonical title${NC}"
        TITLE="$PKG_TITLE"
    fi
    if [ -n "$PKG_DESCRIPTION" ]; then
        DESCRIPTION="$PKG_DESCRIPTION"
    fi
    if [ -n "$PKG_TAGS" ]; then
        TAGS="$PKG_TAGS"
    fi
else
    echo "ℹ️  youtube-package.json not found — using publish.json metadata"
fi
echo ""

# Handle --retry-thumbnail mode (upload to existing video)
if [ "$RETRY_THUMBNAIL" = true ]; then
    if [ -z "$EXISTING_VIDEO_ID" ]; then
        echo -e "${RED}❌ ERROR: No existing videoId found in publish.json${NC}"
        echo "Cannot retry thumbnail without a video to attach to"
        exit 1
    fi
    echo -e "${CYAN}Retry mode: Uploading thumbnail to existing video $EXISTING_VIDEO_ID${NC}"
    echo ""
    VIDEO_ID="$EXISTING_VIDEO_ID"
    # Jump to thumbnail upload section below
fi

# Skip validation and asset checks in retry mode
if [ "$RETRY_THUMBNAIL" = true ]; then
    echo "[2.5/8] Skipping validation (retry mode)..."
    echo ""
else
    # Step 3: Validate publish.json
    echo "[3/8] Validating publish.json..."

    # Check for duplicate upload FIRST (safety feature)
    if [ -n "$EXISTING_VIDEO_ID" ] && [ "$FORCE_NEW_UPLOAD" != true ]; then
        echo -e "${YELLOW}⚠ Duplicate upload protection${NC}"
        echo "  Existing videoId found: $EXISTING_VIDEO_ID"
        echo "  Status: $EXISTING_YT_STATUS"
        if [ -n "$EXISTING_YT_ERROR" ]; then
            echo "  Error: $EXISTING_YT_ERROR"
        fi
        echo ""
        echo -e "${CYAN}Options:${NC}"
        echo "  1. Retry thumbnail: $0 $JOB_ID --retry-thumbnail"
        echo "  2. Force new upload: $0 $JOB_ID --force-new-upload"
        exit 1
    fi

    if [ "$PUBLISH_STATUS" != "pending" ] && [ "$PUBLISH_STATUS" != "published" ]; then
        echo -e "${RED}❌ ERROR: Invalid publishStatus: $PUBLISH_STATUS${NC}"
        echo "Expected: pending or published"
        exit 1
    fi

    echo -e "${GREEN}✓ publish.json valid (no duplicate)${NC}"
    echo ""
fi

if [ "$RETRY_THUMBNAIL" != true ]; then
    if [ "$VIDEO_KEY" = "MISSING" ] || [ -z "$VIDEO_KEY" ]; then
        echo -e "${RED}❌ ERROR: videoKey missing${NC}"
        exit 1
    fi

    if [ "$THUMBNAIL_KEY" = "MISSING" ] || [ -z "$THUMBNAIL_KEY" ]; then
        echo -e "${RED}❌ ERROR: thumbnailKey missing${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ publish.json valid${NC}"
    echo ""

    # Step 4: Verify assets exist in S3
    echo "[4/8] Verifying assets exist in S3..."

    if ! aws s3api head-object --bucket "$BUCKET" --key "$VIDEO_KEY" --region eu-north-1 &>/dev/null; then
        echo -e "${RED}❌ ERROR: Video not found in S3: $VIDEO_KEY${NC}"
        exit 1
    fi
    echo "✓ Video exists"

    if ! aws s3api head-object --bucket "$BUCKET" --key "$THUMBNAIL_KEY" --region eu-north-1 &>/dev/null; then
        echo -e "${RED}❌ ERROR: Thumbnail not found in S3: $THUMBNAIL_KEY${NC}"
        exit 1
    fi
    echo "✓ Thumbnail exists"

    echo -e "${GREEN}✓ All assets verified${NC}"
    echo ""
fi

THUMBNAIL_FILE="$TMP_DIR/thumbnail.jpg"

if [ "$RETRY_THUMBNAIL" != true ]; then
    # Step 5: Download video and thumbnail to /tmp
    # Dry-run: skip large file downloads — HEAD checks already confirmed existence
    if [ "$DRY_RUN" = true ]; then
        echo "[5/8] Skipping asset download (dry-run mode — S3 HEAD verified above)"
        mkdir -p "$TMP_DIR"
        VIDEO_FILE=""
        THUMBNAIL_FILE="$TMP_DIR/thumbnail.jpg"
        echo -e "${GREEN}✓ Assets verified via HEAD (download skipped for dry-run)${NC}"
        echo ""
    else
        echo "[5/8] Downloading assets to /tmp..."

        mkdir -p "$TMP_DIR"

        VIDEO_FILE="$TMP_DIR/video.mp4"
        THUMBNAIL_FILE="$TMP_DIR/thumbnail.jpg"

        aws s3 cp "s3://$BUCKET/$VIDEO_KEY" "$VIDEO_FILE" --region eu-north-1 > /dev/null
        echo "✓ Video downloaded: $VIDEO_FILE"

        aws s3 cp "s3://$BUCKET/$THUMBNAIL_KEY" "$THUMBNAIL_FILE" --region eu-north-1 > /dev/null
        echo "✓ Thumbnail downloaded: $THUMBNAIL_FILE"

        # Get file sizes
        VIDEO_SIZE=$(du -h "$VIDEO_FILE" | cut -f1)
        THUMBNAIL_SIZE=$(du -h "$THUMBNAIL_FILE" | cut -f1)

        echo -e "${GREEN}✓ Assets ready ($VIDEO_SIZE video, $THUMBNAIL_SIZE thumbnail)${NC}"
        echo ""
    fi

    # Step 6: Prepare upload metadata
    echo "[6/8] Preparing upload metadata..."
else
    # Retry mode: only download thumbnail
    echo "[3/8] Downloading thumbnail to /tmp..."
    mkdir -p "$TMP_DIR"
    aws s3 cp "s3://$BUCKET/$THUMBNAIL_KEY" "$THUMBNAIL_FILE" --region eu-north-1 > /dev/null
    echo -e "${GREEN}✓ Thumbnail downloaded: $THUMBNAIL_FILE${NC}"
    echo ""
    # Skip to thumbnail upload
fi

# Skip metadata preparation in retry mode
if [ "$RETRY_THUMBNAIL" != true ]; then
    echo "[6/8] Preparing upload metadata..."

    # Use safe fallback title if blank
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
        TITLE="ProChat OS Internal Test Video"
    fi

    # Create metadata snippet
    # Parse TAGS (already @csv format from youtube-package.json or publish.json)
    # Convert CSV format to JSON array format
    TAGS_JSON="[]"
    if [ -n "$TAGS" ] && [ "$TAGS" != "[]" ]; then
        # Remove quotes from CSV output and convert to JSON array
        TAGS_JSON=$(echo "$TAGS" | jq -R 'split(",") | map(gsub("^\"|\"$"; ""))')
    fi

    SNIPPET=$(cat <<EOF
{
  "title": "$TITLE",
  "description": "$DESCRIPTION",
  "tags": $TAGS_JSON,
  "categoryId": "22"
}
EOF
)

    # Create status (privacy)
    STATUS=$(cat <<EOF
{
  "privacyStatus": "$PRIVACY_STATUS"
}
EOF
)

    echo "Title: $TITLE"
    echo "Description: $DESCRIPTION"
    echo "Privacy: $PRIVACY_STATUS"
    echo -e "${GREEN}✓ Metadata prepared${NC}"
    echo ""

    # Validation: Ensure request body has status part in URL
    echo "[6.5/8] Validating request body matches URL parts..."
    if echo "$SNIPPET" | jq . > /dev/null 2>&1 && echo "$STATUS" | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Metadata JSON valid (snippet and status parts will be included)${NC}"
    else
        echo -e "${RED}❌ ERROR: Invalid metadata JSON${NC}"
        exit 1
    fi
    echo ""
fi

if [ "$RETRY_THUMBNAIL" != true ]; then
    # Step 7: Upload video to YouTube (or dry-run)
    echo "[7/8] Uploading video to YouTube..."

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN] Would upload video with:${NC}"
        echo "  URL: /upload/youtube/v3/videos?part=snippet,status&uploadType=multipart"
        echo "  Title: $TITLE"
        echo "  Description: $DESCRIPTION"
        echo "  Privacy: $PRIVACY_STATUS"
        echo "  Body includes: snippet, status"
        echo ""
        VIDEO_ID="dQw4w9WgXcQ_TEST"  # Fake ID for dry-run
        echo -e "${GREEN}✓ [DRY-RUN] Video upload validation passed${NC}"
    else
        echo "Uploading to YouTube API..."

        # Create metadata file for upload
        METADATA_FILE="$TMP_DIR/metadata.json"
        cat > "$METADATA_FILE" <<EOF
{
  "snippet": $SNIPPET,
  "status": $STATUS
}
EOF

        # Upload video with snippet and status parts
        UPLOAD_RESPONSE=$(curl -s -X POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status\&uploadType=multipart \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -F "metadata=<$METADATA_FILE;type=application/json" \
            -F "data=@$VIDEO_FILE;type=video/mp4")

        VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id // empty')

        if [ -z "$VIDEO_ID" ]; then
            ERROR=$(echo "$UPLOAD_RESPONSE" | jq -r '.error.message // "Unknown error"')
            ERROR_REASON=$(echo "$UPLOAD_RESPONSE" | jq -r '.error.errors[0].reason // empty')
            if is_quota_error "$ERROR $ERROR_REASON $UPLOAD_RESPONSE"; then
                NOW=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
                UPDATED_PUBLISH=$(echo "$PUBLISH_JSON" | jq \
                    --arg ts "$NOW" \
                    --arg err "$ERROR" \
                    '.publishStatus = "pending" |
                     .updatedAt = $ts |
                     .youtubeUpload = {
                       status: "quota_exceeded",
                       checkedAt: $ts,
                       errorCode: "youtube_quota_exceeded",
                       message: $err,
                       videoKey: .videoKey,
                       thumbnailKey: .thumbnailKey
                     } |
                     .platforms.youtube.status = "quota_exceeded" |
                     .platforms.youtube.error = "youtube_quota_exceeded"')
                aws s3 cp - "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" --region eu-north-1 <<< "$(echo "$UPDATED_PUBLISH" | jq .)"
                echo -e "${YELLOW}⚠ YouTube upload quota reached: $ERROR${NC}"
                echo "Response: $UPLOAD_RESPONSE"
                exit 1
            fi
            echo -e "${RED}❌ Video upload failed: $ERROR${NC}"
            echo "Response: $UPLOAD_RESPONSE"
            exit 1
        fi

        echo -e "${GREEN}✓ Video uploaded successfully${NC}"
        echo "  Video ID: $VIDEO_ID"
        echo "  URL: https://www.youtube.com/watch?v=$VIDEO_ID"
    fi

    echo ""
fi

# Step 8: Upload thumbnail (or dry-run)
THUMBNAIL_STEP="[8/8]"
if [ "$RETRY_THUMBNAIL" = true ]; then
    THUMBNAIL_STEP="[4/4]"
fi
echo "$THUMBNAIL_STEP Uploading thumbnail..."

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] Would upload thumbnail to videoId=$VIDEO_ID${NC}"
    echo "  URL: /upload/youtube/v3/thumbnails/set?videoId=$VIDEO_ID"
    echo "  Content-Type: image/jpeg"
    echo "  Body: raw image bytes from $THUMBNAIL_FILE"
    echo ""
    echo -e "${GREEN}✓ [DRY-RUN] Thumbnail upload validation passed${NC}"
else
    echo "Uploading thumbnail to YouTube API..."

    # Upload thumbnail with correct Content-Type and --data-binary
    THUMBNAIL_RESPONSE=$(curl -sS -X POST \
        "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=$VIDEO_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: image/jpeg" \
        --data-binary "@$THUMBNAIL_FILE")

    # Check for errors in response
    THUMBNAIL_ERROR=$(echo "$THUMBNAIL_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)

    if [ -n "$THUMBNAIL_ERROR" ]; then
        echo -e "${YELLOW}⚠ Thumbnail upload failed: $THUMBNAIL_ERROR${NC}"
        echo "Response: $THUMBNAIL_RESPONSE"

        # Update publish.json with error
        UPDATED_PUBLISH=$(echo "$PUBLISH_JSON" | jq \
            --arg vid "$VIDEO_ID" \
            --arg ts "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
            --arg err "$THUMBNAIL_ERROR" \
            '.platforms.youtube.status = "thumbnail_failed" |
             .platforms.youtube.videoId = $vid |
             .platforms.youtube.url = "https://www.youtube.com/watch?v=" + $vid |
             .platforms.youtube.error = $err |
             .publishStatus = "uploaded" |
             .updatedAt = $ts')

        aws s3 cp - "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" --region eu-north-1 <<< "$(echo "$UPDATED_PUBLISH" | jq .)"

        echo ""
        echo -e "${YELLOW}⚠ Video preserved at: https://www.youtube.com/watch?v=$VIDEO_ID${NC}"
        echo "Retry thumbnail upload with:"
        echo "  $0 $JOB_ID --retry-thumbnail"
        exit 1
    fi

    echo -e "${GREEN}✓ Thumbnail uploaded${NC}"
fi

echo ""

# Step 9: Update publish.json (success)
echo "Updating publish.json..."

NOW=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

# For retry mode, clear the error field; for new uploads, set videoId
if [ "$RETRY_THUMBNAIL" = true ]; then
    UPDATED_PUBLISH=$(echo "$PUBLISH_JSON" | jq \
        --arg ts "$NOW" \
        '.platforms.youtube.status = "uploaded" |
         .platforms.youtube.error = null |
         .platforms.youtube.publishedAt = $ts |
         .publishStatus = "uploaded" |
         .updatedAt = $ts')
else
    UPDATED_PUBLISH=$(echo "$PUBLISH_JSON" | jq \
        --arg vid "$VIDEO_ID" \
        --arg ts "$NOW" \
        '.platforms.youtube.status = "uploaded" |
         .platforms.youtube.videoId = $vid |
         .platforms.youtube.url = "https://www.youtube.com/watch?v=" + $vid |
         .platforms.youtube.publishedAt = $ts |
         .publishStatus = "uploaded" |
         .updatedAt = $ts')
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] Would update publish.json:${NC}"
    echo "$UPDATED_PUBLISH" | jq .
else
    # Upload updated publish.json to S3
    aws s3 cp - "s3://$BUCKET/jobs/$JOB_ID/metadata/publish.json" --region eu-north-1 <<< "$(echo "$UPDATED_PUBLISH" | jq .)"
    echo -e "${GREEN}✓ publish.json updated in S3${NC}"
fi

echo ""
echo "==========================================="
echo -e "${GREEN}✅ YouTube Upload Proof Complete${NC}"
echo "==========================================="
echo ""
echo "Summary:"
echo "  Job ID: $JOB_ID"
echo "  Privacy: $PRIVACY_STATUS"
echo "  Video ID: $VIDEO_ID"
echo "  URL: https://www.youtube.com/watch?v=$VIDEO_ID"
echo "  Status: $([ "$DRY_RUN" = true ] && echo "DRY-RUN (validation only)" || echo "UPLOADED")"
echo ""

if [ "$DRY_RUN" = false ]; then
    echo "To delete video:"
    echo "  curl -X DELETE 'https://www.googleapis.com/youtube/v3/videos?id=$VIDEO_ID' \\"
    echo "    -H 'Authorization: Bearer <access_token>'"
    echo ""
    echo "To change privacy status:"
    echo "  curl -X PUT 'https://www.googleapis.com/youtube/v3/videos?part=status' \\"
    echo "    -H 'Authorization: Bearer <access_token>' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"id\": \"$VIDEO_ID\", \"status\": {\"privacyStatus\": \"private\"}}'"
    echo ""
fi

echo "Ready for: I-6.2c (Step Functions integration)"
echo ""

fi  # closes: if [ ! -f "$TOKEN_FILE" ] ... else
