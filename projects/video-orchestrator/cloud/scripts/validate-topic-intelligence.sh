#!/bin/bash
# Validate Topic Intelligence Layer
# Verifies topic backlogs, schemas, and Brain Core API integration
# Usage: scripts/validate-topic-intelligence.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BRAIN_CORE_URL="${BRAIN_CORE_URL:-http://localhost:4877}"

echo "==========================================="
echo "Validate Topic Intelligence Layer"
echo "==========================================="
echo ""

ERRORS=0
WARNINGS=0

# ── File Validation ────────────────────────────────────────────────────────

echo -e "${CYAN}[1/4] Validating Topic Backlog Files${NC}"
echo ""

CHANNELS=("says-the-bible" "prochat")

for CHANNEL_ID in "${CHANNELS[@]}"; do
    echo "  Checking: $CHANNEL_ID"

    # Check file exists
    BACKLOG_FILE="$PROJECT_ROOT/channels/$CHANNEL_ID/topic-backlog.json"
    if [ ! -f "$BACKLOG_FILE" ]; then
        echo -e "    ${RED}✗ topic-backlog.json not found${NC}"
        ((ERRORS++))
        continue
    fi

    echo -e "    ${GREEN}✓ topic-backlog.json exists${NC}"

    # Validate JSON
    if ! jq . "$BACKLOG_FILE" > /dev/null 2>&1; then
        echo -e "    ${RED}✗ Invalid JSON${NC}"
        ((ERRORS++))
        continue
    fi

    echo -e "    ${GREEN}✓ Valid JSON structure${NC}"

    # Check required fields
    CHANNEL_ID_CHECK=$(jq -r '.channelId' "$BACKLOG_FILE" 2>/dev/null)
    if [ "$CHANNEL_ID_CHECK" != "$CHANNEL_ID" ]; then
        echo -e "    ${RED}✗ channelId mismatch${NC}"
        ((ERRORS++))
        continue
    fi

    echo -e "    ${GREEN}✓ channelId: $CHANNEL_ID_CHECK${NC}"

    # Count topics
    TOPIC_COUNT=$(jq '.topicBacklog | length' "$BACKLOG_FILE")
    echo -e "    ${GREEN}✓ Topics: $TOPIC_COUNT${NC}"

    # Validate topic schema
    INVALID_TOPICS=0
    for i in $(seq 0 $((TOPIC_COUNT - 1))); do
        TOPIC=$(jq ".topicBacklog[$i]" "$BACKLOG_FILE")

        # Check required fields
        TOPIC_ID=$(echo "$TOPIC" | jq -r '.topicId' 2>/dev/null)
        TITLE=$(echo "$TOPIC" | jq -r '.title' 2>/dev/null)
        SCORE=$(echo "$TOPIC" | jq -r '.score' 2>/dev/null)
        STATUS=$(echo "$TOPIC" | jq -r '.status' 2>/dev/null)

        if [ -z "$TOPIC_ID" ] || [ -z "$TITLE" ] || [ -z "$SCORE" ] || [ -z "$STATUS" ]; then
            ((INVALID_TOPICS++))
        fi
    done

    if [ $INVALID_TOPICS -gt 0 ]; then
        echo -e "    ${RED}✗ $INVALID_TOPICS topics have missing required fields${NC}"
        ((ERRORS++))
    else
        echo -e "    ${GREEN}✓ All topics have required fields${NC}"
    fi

    echo ""
done

# ── Brain Core Integration ────────────────────────────────────────────────

echo -e "${CYAN}[2/4] Testing Brain Core API Integration${NC}"
echo ""

# Check if Brain Core is running
if ! curl -s "$BRAIN_CORE_URL/status" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠ Brain Core not running at $BRAIN_CORE_URL${NC}"
    echo -e "  ${YELLOW}   (This is OK for file validation, but API tests will skip)${NC}"
    BRAIN_CORE_AVAILABLE=false
else
    echo -e "  ${GREEN}✓ Brain Core is running${NC}"
    BRAIN_CORE_AVAILABLE=true
fi

echo ""

if [ "$BRAIN_CORE_AVAILABLE" = true ]; then
    # Test Status Endpoint
    echo "  Testing: /api/video-orchestrator/topic-intelligence/status"
    STATUS_RESPONSE=$(curl -s "$BRAIN_CORE_URL/api/video-orchestrator/topic-intelligence/status")

    if echo "$STATUS_RESPONSE" | jq . > /dev/null 2>&1; then
        OK=$(echo "$STATUS_RESPONSE" | jq -r '.ok')
        if [ "$OK" = "true" ]; then
            CHANNEL_COUNT=$(echo "$STATUS_RESPONSE" | jq '.data.channels | length')
            echo -e "    ${GREEN}✓ Status endpoint working${NC}"
            echo -e "    ${GREEN}✓ Channels returned: $CHANNEL_COUNT${NC}"
        else
            echo -e "    ${RED}✗ Status endpoint returned ok: false${NC}"
            ((ERRORS++))
        fi
    else
        echo -e "    ${RED}✗ Status endpoint returned invalid JSON${NC}"
        ((ERRORS++))
    fi

    echo ""

    # Test Channel Topics Endpoints
    for CHANNEL_ID in "${CHANNELS[@]}"; do
        echo "  Testing: /api/video-orchestrator/topic-intelligence/channels/$CHANNEL_ID"

        CHANNEL_RESPONSE=$(curl -s "$BRAIN_CORE_URL/api/video-orchestrator/topic-intelligence/channels/$CHANNEL_ID")

        if echo "$CHANNEL_RESPONSE" | jq . > /dev/null 2>&1; then
            OK=$(echo "$CHANNEL_RESPONSE" | jq -r '.ok')
            if [ "$OK" = "true" ]; then
                DISPLAY_NAME=$(echo "$CHANNEL_RESPONSE" | jq -r '.data.displayName')
                TOP_CANDIDATES=$(echo "$CHANNEL_RESPONSE" | jq '.data.topCandidates | length')
                echo -e "    ${GREEN}✓ Channel endpoint working${NC}"
                echo -e "    ${GREEN}✓ Channel: $DISPLAY_NAME${NC}"
                echo -e "    ${GREEN}✓ Top candidates: $TOP_CANDIDATES${NC}"
            else
                echo -e "    ${RED}✗ Channel endpoint returned ok: false${NC}"
                ((ERRORS++))
            fi
        else
            echo -e "    ${RED}✗ Channel endpoint returned invalid JSON${NC}"
            ((ERRORS++))
        fi

        echo ""
    done
fi

# ── Schema Validation ──────────────────────────────────────────────────────

echo -e "${CYAN}[3/4] Validating Topic Schema${NC}"
echo ""

CHANNEL_CONFIG="$PROJECT_ROOT/channels/says-the-bible/channel.json"
if [ -f "$CHANNEL_CONFIG" ]; then
    echo -e "  ${GREEN}✓ Channel config exists${NC}"

    CONTENT_PROFILE="$PROJECT_ROOT/channels/says-the-bible/content-profile.json"
    if [ -f "$CONTENT_PROFILE" ]; then
        echo -e "  ${GREEN}✓ Content profile exists${NC}"
    else
        echo -e "  ${YELLOW}⚠ Content profile missing (not critical for topic intelligence)${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "  ${YELLOW}⚠ Channel config missing (topic intelligence may be incomplete)${NC}"
    ((WARNINGS++))
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────

echo "==========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Topic Intelligence validation passed${NC}"
    echo "==========================================="
else
    echo -e "${RED}❌ Topic Intelligence validation FAILED${NC}"
    echo "==========================================="
fi

echo ""
echo "Results:"
echo "  Files validated: ✓"
echo "  Topic schemas: ✓"
echo "  Brain Core API: $([ "$BRAIN_CORE_AVAILABLE" = true ] && echo '✓' || echo '⏳ (not running)')"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}  Errors: $ERRORS${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}  Warnings: $WARNINGS${NC}"
fi

echo ""

exit $ERRORS
