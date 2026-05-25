#!/bin/bash
# verify-cli-access.sh — Check CLI availability across all AI agents
#
# Usage:
#   ./verify-cli-access.sh [cli-name]
#
# Without argument: checks all CLIs in the manifest
# With argument: checks specific CLI
#
# Example:
#   ./verify-cli-access.sh notebooklm
#   ./verify-cli-access.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Find manifest (check multiple locations)
if [[ -f "$BRAIN_ROOT/operations/CLI-MANIFEST.md" ]]; then
  MANIFEST="$BRAIN_ROOT/operations/CLI-MANIFEST.md"
elif [[ -f "$HOME/Repos/stevewesthoek/brain/operations/CLI-MANIFEST.md" ]]; then
  MANIFEST="$HOME/Repos/stevewesthoek/brain/operations/CLI-MANIFEST.md"
else
  MANIFEST="$BRAIN_ROOT/operations/CLI-MANIFEST.md"
fi

CLI_TO_CHECK="${1:-}"

echo -e "${BLUE}=== CLI Access Verification ===${NC}"
echo ""

# Helper function to test CLI
test_cli() {
  local cli_name="$1"

  # Try to find the CLI
  if command -v "$cli_name" &> /dev/null; then
    # Try to run it with --version or --help
    if "$cli_name" --version &> /dev/null 2>&1; then
      return 0
    elif "$cli_name" --help &> /dev/null 2>&1; then
      return 0
    elif "$cli_name" -h &> /dev/null 2>&1; then
      return 0
    else
      # Found in PATH but can't run standard commands
      return 1
    fi
  else
    return 1
  fi
}

# If specific CLI requested
if [[ -n "$CLI_TO_CHECK" ]]; then
  echo -e "${YELLOW}Checking: $CLI_TO_CHECK${NC}"
  echo ""

  # Check in manifest
  if grep -q "\`$CLI_TO_CHECK\`" "$MANIFEST"; then
    echo -e "${GREEN}✓ In manifest${NC}"
  else
    echo -e "${RED}✗ Not in manifest (add via: ./install-cli.sh --name $CLI_TO_CHECK ...)${NC}"
  fi

  # Check in PATH (Claude Code)
  echo -n "Claude Code (Bash): "
  if test_cli "$CLI_TO_CHECK"; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
  fi

  # Check symlink
  if [[ -L "$HOME/.local/bin/$CLI_TO_CHECK" ]]; then
    TARGET=$(readlink "$HOME/.local/bin/$CLI_TO_CHECK")
    echo -e "Symlink: $HOME/.local/bin/$CLI_TO_CHECK -> $TARGET"
  elif [[ -f "$HOME/.local/bin/$CLI_TO_CHECK" ]]; then
    echo -e "File: $HOME/.local/bin/$CLI_TO_CHECK (not a symlink)"
  else
    echo -e "${YELLOW}No symlink at ~/.local/bin/$CLI_TO_CHECK${NC}"
  fi

  echo ""
  echo "Manual verification:"
  echo "  Codex (Computer Use): which $CLI_TO_CHECK"
  echo "  Gemini: gemini-shell 'which $CLI_TO_CHECK'"

  exit 0
fi

# Check all critical CLIs
echo -e "${YELLOW}Checking all critical CLIs...${NC}"
echo ""

CRITICAL_CLIS=(
  "git"
  "node"
  "python3"
  "notebooklm"
  "spark-cli"
  "aws-cli"
  "cloudflare-cli"
  "mem-search"
  "sync-credentials"
)

PASSED=0
FAILED=0

for cli in "${CRITICAL_CLIS[@]}"; do
  printf "%-20s " "$cli"

  if test_cli "$cli"; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
  fi
done

echo ""
echo -e "${BLUE}Summary: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}${NC}"

if [[ $FAILED -eq 0 ]]; then
  echo ""
  echo -e "${GREEN}All critical CLIs are accessible from Claude Code!${NC}"
  echo ""
  echo "For full verification in all AIs:"
  echo "  Codex: Run in Computer Use shell and check each CLI"
  echo "  Gemini: Use context-mode shell access"
  echo ""
  echo "See: operations/CLI-MANIFEST.md for complete registry"
else
  echo ""
  echo -e "${RED}Some CLIs are missing. Install them:${NC}"
  echo "  ./tools/scripts/install-cli.sh --name <cli> --path <path>"
  echo ""
  echo "Or add to manifest manually: operations/CLI-MANIFEST.md"
fi

exit $FAILED
