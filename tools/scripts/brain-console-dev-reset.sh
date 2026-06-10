#!/bin/bash
set -e

BRAIN_CORE_PORT=4877
CONSOLE_CENTER_PORT=4881
BRAIN_CORE_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-core"
CONSOLE_CENTER_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-console"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Allow mode override: ./script.sh hybrid_storyboard
GENERATION_MODE="${1:-hybrid_tts}"

MODE_UPPER=$(echo "$GENERATION_MODE" | sed 's/_/ /g' | sed 's/^./\U&/g')
echo "🔧 Brain Console + Core Dev Reset ($MODE_UPPER Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

free_port() {
  local PORT="$1"
  local ATTEMPT=1
  local PIDS=""

  while [ "$ATTEMPT" -le 8 ]; do
    PIDS=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -z "$PIDS" ]; then
      echo "  ✅ Port $PORT is free"
      return 0
    fi

    echo "  Attempt $ATTEMPT: killing listeners on port $PORT: $PIDS"
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 0.5

    PIDS=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "  Attempt $ATTEMPT: force-killing listeners on port $PORT: $PIDS"
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi

    sleep 0.75
    ATTEMPT=$((ATTEMPT + 1))
  done

  PIDS=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "  ❌ Error: Port $PORT is still in use by:"
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
    return 1
  fi

  echo "  ✅ Port $PORT is free"
}

kill_stale_dev_processes() {
  local PATTERN="$1"
  local LABEL="$2"
  local PIDS=""

  PIDS=$(pgrep -f "$PATTERN" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "  Killing stale $LABEL processes: $PIDS"
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 0.5
    PIDS=$(pgrep -f "$PATTERN" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo "  Force-killing stale $LABEL processes: $PIDS"
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

# Step 1: Kill stale dev processes first so npm/tsx/next parents cannot respawn listeners
echo ""
echo "Step 1: Killing stale repo dev processes..."

kill_stale_dev_processes "projects/brain-core|brain-core.*npm.*dev|brain-core.*tsx|brain-core.*next.*dev|/tmp/brain-core-hybrid.log" "Brain Core"
kill_stale_dev_processes "projects/brain-console|brain-console.*npm.*dev|brain-console.*tsx|brain-console.*next.*dev|brain-console-center.*npm.*dev|brain-console-center.*next.*dev|/tmp/brain-console.log" "Brain Console"

sleep 1

# Step 2: Free listeners on ports 4877 and 4881
echo ""
echo "Step 2: Freeing ports $BRAIN_CORE_PORT and $CONSOLE_CENTER_PORT..."

free_port "$BRAIN_CORE_PORT"
free_port "$CONSOLE_CENTER_PORT"

# Step 3: Verify ports are free
echo ""
echo "Step 3: Verifying ports are free..."

free_port "$BRAIN_CORE_PORT"
free_port "$CONSOLE_CENTER_PORT"

# Step 4: Start Brain Core with specified generation mode
echo ""
MODE_LABEL=$(echo "$GENERATION_MODE" | tr '_' ' ')
echo "Step 4: Starting Brain Core ($MODE_LABEL mode) on port $BRAIN_CORE_PORT..."
cd "$BRAIN_CORE_DIR"
mkdir -p /tmp
export AWS_VIDEO_GENERATION_MODE="$GENERATION_MODE"

# Configure image provider defaults for generated image/video modes
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ] || [ "$GENERATION_MODE" = "hybrid_animated_video" ]; then
  export AWS_VIDEO_IMAGE_PROVIDER="${AWS_VIDEO_IMAGE_PROVIDER:-aws-bedrock-nova-canvas}"
  export AWS_VIDEO_IMAGE_MODEL_ID="${AWS_VIDEO_IMAGE_MODEL_ID:-amazon.nova-canvas-v1:0}"
  export AWS_VIDEO_IMAGE_REGION="${AWS_VIDEO_IMAGE_REGION:-us-east-1}"
  export AWS_VIDEO_IMAGE_WIDTH="${AWS_VIDEO_IMAGE_WIDTH:-1280}"
  export AWS_VIDEO_IMAGE_HEIGHT="${AWS_VIDEO_IMAGE_HEIGHT:-720}"
  export AWS_VIDEO_IMAGE_CFG_SCALE="${AWS_VIDEO_IMAGE_CFG_SCALE:-6.5}"
  export AWS_VIDEO_IMAGE_SEED="${AWS_VIDEO_IMAGE_SEED:-42}"
  export AWS_VIDEO_IMAGE_QUALITY="${AWS_VIDEO_IMAGE_QUALITY:-standard}"

  # Preflight check: ensure required vars are set
  if [ -z "$AWS_VIDEO_IMAGE_PROVIDER" ] || [ -z "$AWS_VIDEO_IMAGE_MODEL_ID" ] || [ -z "$AWS_VIDEO_IMAGE_REGION" ]; then
    echo "  ❌ Error: $GENERATION_MODE requires AWS_VIDEO_IMAGE_PROVIDER, AWS_VIDEO_IMAGE_MODEL_ID, and AWS_VIDEO_IMAGE_REGION"
    exit 1
  fi
fi

npm run dev > /tmp/brain-core-hybrid.log 2>&1 &
BRAIN_CORE_PID=$!
echo "  Brain Core PID: $BRAIN_CORE_PID"
sleep 3

# Step 5: Start Brain Console
echo ""
echo "Step 5: Starting Brain Console on port $CONSOLE_CENTER_PORT..."
cd "$CONSOLE_CENTER_DIR"
npm run dev > /tmp/brain-console.log 2>&1 &
CONSOLE_CENTER_PID=$!
echo "  Brain Console PID: $CONSOLE_CENTER_PID"
sleep 4

# Step 6: Health check
echo ""
echo "Step 6: Health check..."

RETRIES=5
RETRY=0
while [ $RETRY -lt $RETRIES ]; do
  if curl -fsS "http://127.0.0.1:$BRAIN_CORE_PORT/status" >/dev/null 2>&1; then
    echo "  ✅ Brain Core status endpoint is healthy"
    break
  else
    RETRY=$((RETRY + 1))
    if [ $RETRY -lt $RETRIES ]; then
      echo "  ⏳ Waiting for Brain Core to start... (attempt $RETRY/$RETRIES)"
      sleep 2
    else
      echo "  ⚠️  Brain Core status endpoint timed out, but services may still be starting"
    fi
  fi
done

RETRIES=5
RETRY=0
while [ $RETRY -lt $RETRIES ]; do
  if curl -fsS "http://localhost:$CONSOLE_CENTER_PORT/aws-video" >/dev/null 2>&1; then
    echo "  ✅ Brain Console is healthy"
    break
  else
    RETRY=$((RETRY + 1))
    if [ $RETRY -lt $RETRIES ]; then
      echo "  ⏳ Waiting for Brain Console to start... (attempt $RETRY/$RETRIES)"
      sleep 2
    else
      echo "  ⚠️  Brain Console timed out, but services may still be starting"
    fi
  fi
done

# Step 7: Materialize dev publish assets for fixture job (required for hybrid_image_slideshow dry-run)
echo ""
echo "Step 7: Materializing dev publish assets for fixture job..."
MATERIALIZE_SCRIPT="$SCRIPTS_DIR/materialize-dev-publish-assets.sh"
FIXTURE_JOB="prochat-prompt-1780856968989-make-a-video-of-a-box-"

if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ]; then
  if ! bash "$MATERIALIZE_SCRIPT" "$FIXTURE_JOB"; then
    echo ""
    echo "❌ Error: Asset materialization failed (required for hybrid_image_slideshow dry-run testing)"
    echo "   Donor job: $FIXTURE_DONOR"
    echo "   Target job: $FIXTURE_JOB"
    echo "   Bucket: prochat-video-dev-909439522876-eu-north-1-an"
    echo "   Region: eu-north-1"
    echo "   Verify AWS credentials and S3 access, then re-run this script."
    exit 1
  fi
  echo "  ✅ Dev publish assets materialized and ready for dry-run testing"
else
  if bash "$MATERIALIZE_SCRIPT" "$FIXTURE_JOB"; then
    echo "  ✅ Dev publish assets materialized"
  else
    echo "  ⚠️  Warning: asset materialization failed (optional for $GENERATION_MODE mode)"
    echo "     Dry-run fixture testing will be skipped until assets are available."
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Dev environment reset complete!"
echo ""
echo "📍 Brain Core URL: http://127.0.0.1:$BRAIN_CORE_PORT"
echo "📍 Brain Console URL: http://localhost:$CONSOLE_CENTER_PORT/aws-video"
echo ""
echo "⚙️  Configuration:"
echo "   Generation Mode: $GENERATION_MODE"
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ] || [ "$GENERATION_MODE" = "hybrid_animated_video" ]; then
  echo "   Image Provider: $AWS_VIDEO_IMAGE_PROVIDER"
  echo "   Image Model: $AWS_VIDEO_IMAGE_MODEL_ID"
  echo "   Image Region: $AWS_VIDEO_IMAGE_REGION"
  echo "   Image Size: ${AWS_VIDEO_IMAGE_WIDTH}x${AWS_VIDEO_IMAGE_HEIGHT}"
fi
echo ""
echo "🔍 Logs:"
echo "   Brain Core: tail -f /tmp/brain-core-hybrid.log"
echo "   Brain Console: tail -f /tmp/brain-console.log"
echo ""
TEST_LABEL=$(echo "$GENERATION_MODE" | tr '_' ' ')
echo "🧪 Test $TEST_LABEL mode:"
echo "   export JOB_ID=<new-job-from-console>"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/scene-plan.json' - --region eu-north-1 | jq"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/audio/narration-script.txt' - --region eu-north-1"
if [ "$GENERATION_MODE" = "hybrid_storyboard" ]; then
  echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/storyboard.json' - --region eu-north-1 | jq"
  echo "   aws s3 ls 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/images/' --region eu-north-1"
fi
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ] || [ "$GENERATION_MODE" = "hybrid_animated_video" ]; then
  echo "   aws s3 ls 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/exports/' --region eu-north-1"
  echo "   aws s3 ls 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/animated/' --region eu-north-1"
  echo "   (Look for scene PNGs, animated clips when enabled, and final MP4)"
fi
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/audio/narration.mp3' - --region eu-north-1 | file -"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/assets.json' - --region eu-north-1 | jq '.audioProvider, .voiceId, .imageProvider'"
echo ""
