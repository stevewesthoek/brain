#!/bin/bash

# Validation script for model tracking system
# Run this to verify all components are correctly installed and functional

set -e

TRACKING_FILE="$HOME/.claude/model-tracking.json"
SETTINGS_FILE="$HOME/.claude/settings.json"
STATUSLINE_SCRIPT="$HOME/.claude/statusline-command.sh"
HOOKS_DIR="$HOME/.claude/hooks"

PASS=0
FAIL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Model Tracking System Validation ==="
echo

# Check tracking file exists
echo -n "✓ Tracking file exists... "
if [ -f "$TRACKING_FILE" ]; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Check tracking file is valid JSON
echo -n "✓ Tracking file is valid JSON... "
if jq empty "$TRACKING_FILE" 2>/dev/null; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Check required fields in tracking file (can be null)
echo -n "✓ Tracking file has required fields... "
REQUIRED_FIELDS=("model" "reason" "context" "timestamp" "agent")
MISSING_FIELDS=()
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e "has(\"$field\")" "$TRACKING_FILE" >/dev/null 2>&1; then
    MISSING_FIELDS+=("$field")
  fi
done
if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC} (missing: ${MISSING_FIELDS[*]})"
  FAIL=$((FAIL + 1))
fi

# Check status line script exists
echo -n "✓ Status line script exists... "
if [ -f "$STATUSLINE_SCRIPT" ]; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Check hooks exist
REQUIRED_HOOKS=("model-tracking-hook.sh" "model-escalation-detector.sh" "model-reset-on-stop.sh")
for hook in "${REQUIRED_HOOKS[@]}"; do
  echo -n "✓ Hook exists: $hook... "
  if [ -f "$HOOKS_DIR/$hook" ]; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}"
    FAIL=$((FAIL + 1))
  fi
done

# Check hooks are registered in settings.json
echo -n "✓ model-tracking-hook registered in UserPromptSubmit... "
if jq -e '.hooks.UserPromptSubmit[0].hooks[] | select(.command | contains("model-tracking-hook"))' "$SETTINGS_FILE" >/dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

echo -n "✓ model-escalation-detector registered in PostToolUse... "
if jq -e '.hooks.PostToolUse[] | select(.matcher == "Agent") | .hooks[] | select(.command | contains("model-escalation-detector"))' "$SETTINGS_FILE" >/dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

echo -n "✓ model-reset-on-stop registered in Stop... "
if jq -e '.hooks.Stop[0].hooks[] | select(.command | contains("model-reset-on-stop"))' "$SETTINGS_FILE" >/dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Test status line rendering
echo -n "✓ Status line renders correctly... "
TEST_INPUT='{"workspace": {"current_dir": "/tmp"}, "model": {"display_name": "Haiku"}, "context_window": {"context_window_size": 200000, "used_percentage": 42}}'
OUTPUT=$(echo "$TEST_INPUT" | bash "$STATUSLINE_SCRIPT" 2>/dev/null)
if echo "$OUTPUT" | grep -q "haiku\|Haiku"; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Test status line with escalation
echo -n "✓ Status line shows escalation badge... "
# Temporarily update tracking file
ORIG_TRACKING=$(cat "$TRACKING_FILE")
cat > "$TRACKING_FILE" <<'EOF'
{"model": "sonnet", "reason": "escalation-complexity", "context": "test", "timestamp": null, "agent": "coder-default"}
EOF
OUTPUT=$(echo "$TEST_INPUT" | bash "$STATUSLINE_SCRIPT" 2>/dev/null)
# Restore original
echo "$ORIG_TRACKING" > "$TRACKING_FILE"
if echo "$OUTPUT" | grep -q "sonnet.*↑.*coder-default"; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

# Summary
echo
echo "=== Summary ==="
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✓ All checks passed! Model tracking is ready.${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some checks failed. See above for details.${NC}"
  exit 1
fi
