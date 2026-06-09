#!/bin/bash
set -e

BRAIN_CORE_PORT=4877
CONSOLE_CENTER_PORT=4881
BRAIN_CORE_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-core"
CONSOLE_CENTER_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-console"

# Allow mode override: ./script.sh hybrid_storyboard
GENERATION_MODE="${1:-hybrid_tts}"

MODE_UPPER=$(echo "$GENERATION_MODE" | sed 's/_/ /g' | sed 's/^./\U&/g')
echo "🔧 Brain Console + Core Dev Reset ($MODE_UPPER Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Kill listeners on ports 4877 and 4881
echo ""
echo "Step 1: Freeing ports $BRAIN_CORE_PORT and $CONSOLE_CENTER_PORT..."

for PORT in $BRAIN_CORE_PORT $CONSOLE_CENTER_PORT; do
  PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "  Killing processes listening on port $PORT: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done

# Step 2: Kill stale dev processes
echo ""
echo "Step 2: Killing stale repo dev processes..."

# Kill brain-core dev processes
BRAIN_CORE_PIDS=$(pgrep -f "brain-core.*npm.*dev\|brain-core.*tsx\|brain-core.*next.*dev" 2>/dev/null || true)
if [ -n "$BRAIN_CORE_PIDS" ]; then
  echo "  Killing Brain Core dev processes: $BRAIN_CORE_PIDS"
  echo "$BRAIN_CORE_PIDS" | xargs kill -9 2>/dev/null || true
fi

# Kill brain-console dev processes
CENTER_PIDS=$(pgrep -f "brain-console.*npm.*dev\|brain-console.*tsx\|brain-console.*next.*dev" 2>/dev/null || true)
if [ -n "$CENTER_PIDS" ]; then
  echo "  Killing Brain Console dev processes: $CENTER_PIDS"
  echo "$CENTER_PIDS" | xargs kill -9 2>/dev/null || true
fi

sleep 1

# Step 3: Verify ports are free
echo ""
echo "Step 3: Verifying ports are free..."

for PORT in $BRAIN_CORE_PORT $CONSOLE_CENTER_PORT; do
  if lsof -ti :$PORT >/dev/null 2>&1; then
    echo "  ❌ Error: Port $PORT is still in use. Try: lsof -ti :$PORT | xargs kill -9"
    exit 1
  else
    echo "  ✅ Port $PORT is free"
  fi
done

# Step 4: Start Brain Core with specified generation mode
echo ""
MODE_LABEL=$(echo "$GENERATION_MODE" | tr '_' ' ')
echo "Step 4: Starting Brain Core ($MODE_LABEL mode) on port $BRAIN_CORE_PORT..."
cd "$BRAIN_CORE_DIR"
mkdir -p /tmp
export AWS_VIDEO_GENERATION_MODE="$GENERATION_MODE"

# Configure image provider defaults for hybrid_image_slideshow mode
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ]; then
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
    echo "  ❌ Error: hybrid_image_slideshow requires AWS_VIDEO_IMAGE_PROVIDER, AWS_VIDEO_IMAGE_MODEL_ID, and AWS_VIDEO_IMAGE_REGION"
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
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ]; then
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
if [ "$GENERATION_MODE" = "hybrid_image_slideshow" ]; then
  echo "   aws s3 ls 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/exports/' --region eu-north-1"
  echo "   (Look for scene PNGs and final MP4)"
fi
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/audio/narration.mp3' - --region eu-north-1 | file -"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/assets.json' - --region eu-north-1 | jq '.audioProvider, .voiceId, .imageProvider'"
echo ""
