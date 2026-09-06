#!/bin/bash
# install-cli.sh — Automated CLI installation with manifest update and discovery route
#
# Usage:
#   ./install-cli.sh --name "command-name" --path "/path/to/binary" [--description "optional description"]
#
# This script:
# 1. Creates a symlink in ~/.local/bin/
# 2. Updates operations/CLI-MANIFEST.md with the new CLI
# 3. Registers the CLI in Brain's capability manifest
# 4. Verifies discovery and local access
#
# Example:
#   ./install-cli.sh --name "my-tool" --path "/usr/local/bin/my-tool" --description "My awesome tool"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_BIN="$HOME/.local/bin"

# Find manifest (check multiple locations)
if [[ -f "$BRAIN_ROOT/operations/CLI-MANIFEST.md" ]]; then
  MANIFEST="$BRAIN_ROOT/operations/CLI-MANIFEST.md"
elif [[ -f "$HOME/Repos/stevewesthoek/brain/operations/CLI-MANIFEST.md" ]]; then
  MANIFEST="$HOME/Repos/stevewesthoek/brain/operations/CLI-MANIFEST.md"
else
  MANIFEST="$BRAIN_ROOT/operations/CLI-MANIFEST.md"
fi

# Parse arguments
CLI_NAME=""
CLI_PATH=""
CLI_DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      CLI_NAME="$2"
      shift 2
      ;;
    --path)
      CLI_PATH="$2"
      shift 2
      ;;
    --description)
      CLI_DESCRIPTION="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ./install-cli.sh --name <name> --path <path> [--description <desc>]"
      echo ""
      echo "Examples:"
      echo "  ./install-cli.sh --name notebooklm --path /opt/homebrew/bin/notebooklm"
      echo "  ./install-cli.sh --name my-tool --path /usr/local/bin/my-tool --description 'My awesome tool'"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$CLI_NAME" || -z "$CLI_PATH" ]]; then
  echo -e "${RED}Error: --name and --path are required${NC}"
  echo "Use --help for usage information"
  exit 1
fi

# Validate target exists
if [[ ! -f "$CLI_PATH" ]]; then
  echo -e "${RED}Error: CLI path does not exist: $CLI_PATH${NC}"
  exit 1
fi

# Validate target is executable
if [[ ! -x "$CLI_PATH" ]]; then
  echo -e "${RED}Error: CLI is not executable: $CLI_PATH${NC}"
  exit 1
fi

echo -e "${BLUE}=== Installing CLI: $CLI_NAME ===${NC}"
echo ""

# Step 1: Create symlink
echo -e "${YELLOW}[1/5] Creating symlink...${NC}"
mkdir -p "$LOCAL_BIN"

SYMLINK_PATH="$LOCAL_BIN/$CLI_NAME"

if [[ -L "$SYMLINK_PATH" ]]; then
  # Symlink exists, remove it
  rm "$SYMLINK_PATH"
  echo "  Removed existing symlink"
fi

if [[ -f "$SYMLINK_PATH" ]]; then
  # Regular file exists with same name
  echo -e "${RED}Error: File already exists at $SYMLINK_PATH (not a symlink)${NC}"
  exit 1
fi

ln -s "$CLI_PATH" "$SYMLINK_PATH"
echo -e "${GREEN}  ✓ Symlink created: $SYMLINK_PATH -> $CLI_PATH${NC}"

# Verify symlink works
if ! command -v "$CLI_NAME" &> /dev/null; then
  echo -e "${RED}Error: Symlink created but CLI not found in PATH${NC}"
  rm "$SYMLINK_PATH"
  exit 1
fi

# Step 2: Update manifest
echo -e "${YELLOW}[2/5] Updating CLI manifest...${NC}"

if [[ ! -f "$MANIFEST" ]]; then
  echo -e "${RED}Error: Manifest not found at $MANIFEST${NC}"
  echo "  Make sure you're running from within the brain repo"
  rm "$SYMLINK_PATH"
  exit 1
fi

# Register the CLI in the canonical manifest.
REGISTRY_SCRIPT="$BRAIN_ROOT/tools/register-cli-manifest.mjs"
if [[ ! -f "$REGISTRY_SCRIPT" ]]; then
  echo -e "${RED}Error: CLI registry helper not found at $REGISTRY_SCRIPT${NC}"
  rm "$SYMLINK_PATH"
  exit 1
fi
node "$REGISTRY_SCRIPT" --name "$CLI_NAME" --path "$CLI_PATH" --description "$CLI_DESCRIPTION"
echo -e "${GREEN}  ✓ Manifest registration complete${NC}"

# Step 3: Verify discovery route
echo -e "${YELLOW}[3/5] Verifying Brain capability discovery...${NC}"

DISCOVERY_SCRIPT="$BRAIN_ROOT/tools/discover-capabilities.mjs"
if [[ -f "$DISCOVERY_SCRIPT" ]] && node "$DISCOVERY_SCRIPT" --query "$CLI_NAME" --kind cli --format compact >/dev/null; then
  echo -e "${GREEN}  ✓ CLI is discoverable by all Brain agents${NC}"
else
  echo -e "${RED}  ✗ CLI was not found by capability discovery${NC}"
  rm "$SYMLINK_PATH"
  exit 1
fi

# Step 4: Verify the full onboarding contract
echo -e "${YELLOW}[4/5] Verifying the onboarding contract...${NC}"

VALIDATOR_SCRIPT="$BRAIN_ROOT/tools/validate-agent-capability-onboarding.mjs"
if [[ -f "$VALIDATOR_SCRIPT" ]] && node "$VALIDATOR_SCRIPT" >/dev/null; then
  echo -e "${GREEN}  ✓ Shared skill/CLI/MCP onboarding contract passes${NC}"
else
  echo -e "${RED}  ✗ Shared onboarding contract failed${NC}"
  rm "$SYMLINK_PATH"
  exit 1
fi

# Step 5: Verify access
echo -e "${YELLOW}[5/5] Verifying CLI access...${NC}"

# Test 1: Can we run it?
if "$CLI_NAME" --version &> /dev/null || "$CLI_NAME" --help &> /dev/null || "$CLI_NAME" -h &> /dev/null; then
  echo -e "${GREEN}  ✓ CLI executable and responds to version/help${NC}"
elif command -v "$CLI_NAME" &> /dev/null; then
  echo -e "${GREEN}  ✓ CLI found in PATH${NC}"
else
  echo -e "${RED}  ✗ CLI not responding to standard queries${NC}"
  echo "    Try running manually to verify: $CLI_NAME"
fi

# Test 2: Is it in PATH for Claude Code?
if bash -c "command -v $CLI_NAME" &> /dev/null; then
  echo -e "${GREEN}  ✓ Claude Code can access via Bash tool${NC}"
else
  echo -e "${RED}  ✗ Claude Code may not have access${NC}"
fi

echo ""
echo -e "${BLUE}=== Installation Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Review the manifest entry in: $MANIFEST"
echo "2. Read the selected skill/runbook from capability discovery"
echo "3. Verify the command from each supported AI shell when needed"
echo "4. Update the Brain repo with the intentional manifest and docs changes"
echo ""
echo "Troubleshooting:"
echo "  If CLI not found in one AI: see operations/runbooks/codex-cli-access.md"
echo "  To verify all CLIs: ./tools/scripts/verify-cli-access.sh"
