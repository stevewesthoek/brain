#!/bin/bash
# Validation script for Brain Core video orchestrator endpoints
# Tests that the correct endpoint returns channel data
# Usage: scripts/validate-brain-core-video-endpoints.sh

BRAIN_CORE_HOST="${BRAIN_CORE_HOST:-http://localhost:3000}"

echo "=========================================="
echo "Brain Core Video Orchestrator Endpoints Validation"
echo "=========================================="
echo ""
echo "Brain Core Host: $BRAIN_CORE_HOST"
echo ""

# Test 1: Test the correct endpoint
echo "[Test 1/3] Testing /api/video-orchestrator/topic-intelligence/status"
echo ""

RESPONSE=$(curl -s -X GET "$BRAIN_CORE_HOST/api/video-orchestrator/topic-intelligence/status" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if response is valid
OK=$(echo "$RESPONSE" | jq -r '.ok // false' 2>/dev/null)
if [ "$OK" = "true" ]; then
    echo "✓ PASS: Endpoint returned ok=true"
else
    echo "❌ FAIL: Endpoint returned ok=$OK"
    exit 1
fi

# Check for channels array
CHANNELS=$(echo "$RESPONSE" | jq '.data.channels // null' 2>/dev/null)
if [ "$CHANNELS" = "null" ]; then
    echo "❌ FAIL: No channels array in response"
    exit 1
fi

CHANNEL_COUNT=$(echo "$RESPONSE" | jq '.data.channels | length' 2>/dev/null || echo "0")
echo "✓ PASS: Channels array found with $CHANNEL_COUNT channels"
echo ""

# Test 2: Verify required channels exist
echo "[Test 2/3] Verifying required channels"

HAS_STB=$(echo "$RESPONSE" | jq '.data.channels[] | select(.channelId == "says-the-bible") | .channelId' 2>/dev/null)
HAS_PROCHAT=$(echo "$RESPONSE" | jq '.data.channels[] | select(.channelId == "prochat") | .channelId' 2>/dev/null)

if [ -z "$HAS_STB" ]; then
    echo "❌ FAIL: says-the-bible channel not found"
    exit 1
fi
echo "✓ PASS: says-the-bible channel found"

if [ -z "$HAS_PROCHAT" ]; then
    echo "❌ FAIL: prochat channel not found"
    exit 1
fi
echo "✓ PASS: prochat channel found"
echo ""

# Test 3: Verify topic candidates exist
echo "[Test 3/3] Verifying topic candidates"

STB_TOPICS=$(echo "$RESPONSE" | jq '.data.channels[] | select(.channelId == "says-the-bible") | .topCandidates | length' 2>/dev/null || echo "0")
PROCHAT_TOPICS=$(echo "$RESPONSE" | jq '.data.channels[] | select(.channelId == "prochat") | .topCandidates | length' 2>/dev/null || echo "0")

if [ "$STB_TOPICS" -gt 0 ]; then
    echo "✓ PASS: says-the-bible has $STB_TOPICS topic candidates"
else
    echo "⚠ WARNING: says-the-bible has no topic candidates"
fi

if [ "$PROCHAT_TOPICS" -gt 0 ]; then
    echo "✓ PASS: prochat has $PROCHAT_TOPICS topic candidates"
else
    echo "⚠ WARNING: prochat has no topic candidates"
fi

echo ""
echo "=========================================="
echo "✅ All Brain Core endpoint validations passed"
echo "=========================================="
echo ""
echo "Endpoint URL: $BRAIN_CORE_HOST/api/video-orchestrator/topic-intelligence/status"
echo "Response format: { ok: true, data: { channels: [...], recentJobs: [...], pipelineReady: boolean, ... } }"
echo ""
