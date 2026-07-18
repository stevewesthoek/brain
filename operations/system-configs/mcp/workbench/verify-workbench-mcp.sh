#!/bin/bash
set -euo pipefail

# Workbench MCP Verification Script
# Verifies Workbench MCP setup and connectivity across IDEs

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

test_result() {
  local test_name=$1
  local result=$2

  if [ $result -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    ((passed++))
  else
    echo -e "${RED}✗${NC} $test_name"
    ((failed++))
  fi
}

echo -e "${YELLOW}=== Workbench MCP Verification ===${NC}"
echo ""

# Check Claude Code
if command -v claude &> /dev/null; then
  echo -e "${YELLOW}Checking Claude Code...${NC}"
  if claude mcp list 2>/dev/null | grep -q "workbench"; then
    test_result "Claude Code MCP registered" 0
    claude_available=1
  else
    test_result "Claude Code MCP registered" 1
    claude_available=0
  fi
else
  echo -e "${YELLOW}ℹ Claude Code not installed${NC}"
  claude_available=0
fi

# Check Codex
if command -v codex &> /dev/null; then
  echo -e "${YELLOW}Checking Codex...${NC}"
  if codex mcp list 2>/dev/null | grep -q "workbench"; then
    test_result "Codex MCP registered" 0
  else
    test_result "Codex MCP registered" 1
  fi
else
  echo -e "${YELLOW}ℹ Codex not installed${NC}"
fi

echo ""
echo -e "${YELLOW}=== Configuration Files ===${NC}"

# Check config files
check_config_file() {
  local file=$1
  local label=$2

  if [ -f "$file" ]; then
    test_result "$label exists" 0

    if grep -q "workbench" "$file" 2>/dev/null; then
      test_result "$label has workbench MCP" 0
    else
      test_result "$label has workbench MCP" 1
    fi
  else
    echo -e "${YELLOW}ℹ $label not found (may not be installed)${NC}"
  fi
}

check_config_file "$HOME/.claude.json" "Claude Code config"
check_config_file "$HOME/.codex/config.toml" "Codex config"
check_config_file "$HOME/.kiro/settings.json" "Kiro config"
check_config_file "$HOME/.cursor/settings.json" "Cursor config"

if [[ "$OSTYPE" == "darwin"* ]]; then
  check_config_file "$HOME/Library/Application Support/Antigravity/User/mcp.json" "Antigravity config"
fi

echo ""
echo -e "${YELLOW}=== Credential File ===${NC}"

# Check credential setup
for cred_path in ~/.credentials/workbench-mcp.token ~/.workbench-mcp.token /etc/workbench-mcp.token; do
  expanded_path="${cred_path/#\~/$HOME}"
  if [ -f "$expanded_path" ]; then
    perms=$(stat -f%OLp "$expanded_path" 2>/dev/null || stat -c%a "$expanded_path" 2>/dev/null || echo "unknown")
    if [ "$perms" = "600" ] || [ "$perms" = "-rw-------" ] || [[ "$perms" == *"rw"* ]]; then
      test_result "Credential file found and readable: $cred_path" 0
    else
      echo -e "${RED}✗${NC} Credential file permissions incorrect: $cred_path ($perms)"
      ((failed++))
    fi
    cred_found=1
    break
  fi
done

if [ -z "${cred_found:-}" ]; then
  test_result "Credential file found" 1
fi

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"
echo ""

if [ $failed -gt 0 ]; then
  echo -e "${RED}Some checks failed. See README.md for troubleshooting.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed!${NC}"
  echo ""
  echo "Next: Restart your IDE and verify with:"
  echo "  • claude mcp list | grep workbench"
  echo "  • codex mcp list | grep workbench"
  exit 0
fi
