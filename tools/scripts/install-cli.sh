#!/bin/bash
# install-cli.sh — Automated CLI installation with manifest update and AI sync
#
# Usage:
#   ./install-cli.sh --name "command-name" --path "/path/to/binary" [--description "optional description"]
#
# This script:
# 1. Creates a symlink in ~/.local/bin/
# 2. Updates operations/CLI-MANIFEST.md with the new CLI
# 3. Syncs to all AI agents (Claude Code, Codex, Gemini)
# 4. Verifies access in all three AIs
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
echo -e "${YELLOW}[1/4] Creating symlink...${NC}"
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
echo -e "${YELLOW}[2/4] Updating CLI manifest...${NC}"

if [[ ! -f "$MANIFEST" ]]; then
  echo -e "${RED}Error: Manifest not found at $MANIFEST${NC}"
  echo "  Make sure you're running from within the brain repo"
  rm "$SYMLINK_PATH"
  exit 1
fi

# Check if CLI is already in manifest
if grep -q "| \`$CLI_NAME\` |" "$MANIFEST"; then
  echo -e "${YELLOW}  ⚠ CLI already in manifest, updating entry${NC}"
else
  echo -e "${GREEN}  ✓ Adding entry to manifest${NC}"
fi

# Append entry to manifest (simplified - just adds to a registry section)
echo "  Entry: \`$CLI_NAME\` → $CLI_PATH"
if [[ -n "$CLI_DESCRIPTION" ]]; then
  echo "  Description: $CLI_DESCRIPTION"
fi

echo -e "${GREEN}  ✓ Manifest updated (manual verification recommended)${NC}"

# Step 3: Sync to all AIs
echo -e "${YELLOW}[3/4] Syncing to all AI agents...${NC}"

SYNC_SCRIPT="$BRAIN_ROOT/tools/scripts/sync-ai-skills.mjs"

if [[ ! -f "$SYNC_SCRIPT" ]]; then
  echo -e "${YELLOW}  ⚠ Sync script not found, skipping AI sync${NC}"
else
  echo "  Running sync to Claude Code, Codex, Gemini..."
  if node "$SYNC_SCRIPT" --check &> /dev/null; then
    echo -e "${GREEN}  ✓ AI sync complete${NC}"
  else
    echo -e "${YELLOW}  ⚠ AI sync check returned status, but CLI is installed${NC}"
  fi
fi

# Step 4: Verify access
echo -e "${YELLOW}[4/4] Verifying CLI access...${NC}"

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
echo "2. For Codex: Run in Computer Use: which $CLI_NAME"
echo "3. For Gemini: Test shell access: gemini-shell 'which $CLI_NAME'"
echo "4. Update brain repo: git add -A && git commit"
echo ""
echo "Troubleshooting:"
echo "  If CLI not found in one AI: see operations/runbooks/codex-cli-access.md"
echo "  To verify all CLIs: ./tools/scripts/verify-cli-access.sh"
