#!/bin/bash
set -e

BRAIN_CORE_PORT=4877
CONSOLE_CENTER_PORT=4881
BRAIN_CORE_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-core"
CONSOLE_CENTER_DIR="/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-center"

echo "🔧 Brain Console Center + Core Dev Reset (Hybrid TTS Mode)"
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

# Kill brain-console-center dev processes
CENTER_PIDS=$(pgrep -f "brain-console-center.*npm.*dev\|brain-console-center.*tsx\|brain-console-center.*next.*dev" 2>/dev/null || true)
if [ -n "$CENTER_PIDS" ]; then
  echo "  Killing Brain Console Center dev processes: $CENTER_PIDS"
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

# Step 4: Start Brain Core with hybrid TTS mode
echo ""
echo "Step 4: Starting Brain Core (hybrid TTS mode) on port $BRAIN_CORE_PORT..."
cd "$BRAIN_CORE_DIR"
mkdir -p /tmp
export AWS_VIDEO_GENERATION_MODE=hybrid_tts
npm run dev > /tmp/brain-core-hybrid.log 2>&1 &
BRAIN_CORE_PID=$!
echo "  Brain Core PID: $BRAIN_CORE_PID"
sleep 3

# Step 5: Start Brain Console Center
echo ""
echo "Step 5: Starting Brain Console Center on port $CONSOLE_CENTER_PORT..."
cd "$CONSOLE_CENTER_DIR"
npm run dev > /tmp/brain-console-center.log 2>&1 &
CONSOLE_CENTER_PID=$!
echo "  Brain Console Center PID: $CONSOLE_CENTER_PID"
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
    echo "  ✅ Brain Console Center is healthy"
    break
  else
    RETRY=$((RETRY + 1))
    if [ $RETRY -lt $RETRIES ]; then
      echo "  ⏳ Waiting for Brain Console Center to start... (attempt $RETRY/$RETRIES)"
      sleep 2
    else
      echo "  ⚠️  Brain Console Center timed out, but services may still be starting"
    fi
  fi
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Dev environment reset complete!"
echo ""
echo "📍 Brain Core URL: http://127.0.0.1:$BRAIN_CORE_PORT"
echo "📍 Brain Console Center URL: http://localhost:$CONSOLE_CENTER_PORT/aws-video"
echo ""
echo "🔍 Logs:"
echo "   Brain Core: tail -f /tmp/brain-core-hybrid.log"
echo "   Brain Console Center: tail -f /tmp/brain-console-center.log"
echo ""
echo "🧪 Test hybrid TTS mode:"
echo "   export JOB_ID=<new-job-from-console>"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/scene-plan.json' - --region eu-north-1 | jq"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/audio/narration-script.txt' - --region eu-north-1"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/audio/narration.mp3' - --region eu-north-1 | file -"
echo "   aws s3 cp 's3://prochat-video-dev-909439522876-eu-north-1-an/jobs/\$JOB_ID/metadata/assets.json' - --region eu-north-1 | jq '.audioProvider, .voiceId'"
echo ""
