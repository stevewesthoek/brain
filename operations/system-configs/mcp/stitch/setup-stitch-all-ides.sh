#!/bin/bash

# setup-stitch-all-ides.sh
# Centralized setup script for Google Stitch MCP across all IDEs
# Usage: bash operations/system-configs/mcp/stitch/setup-stitch-all-ides.sh

set -e

STITCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$STITCH_DIR/../../../.." && pwd)"

echo "🔧 Setting up Google Stitch MCP across all IDEs..."
echo "   Brain root: $BRAIN_ROOT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to merge JSON objects
merge_json() {
    local target_file="$1"
    local snippet_key="$2"
    local snippet_value="$3"

    if [ ! -f "$target_file" ]; then
        echo "  ❌ File not found: $target_file"
        return 1
    fi

    # Use jq to merge
    if command -v jq &> /dev/null; then
        local temp_file="${target_file}.tmp"
        jq --arg key "$snippet_key" --argjson value "$snippet_value" \
            '.mcpServers += {($key): $value}' "$target_file" > "$temp_file"
        mv "$temp_file" "$target_file"
        echo "  ✅ Added to $target_file"
    else
        echo "  ⚠️  jq not found, skipping JSON merge"
        return 1
    fi
}

# 1. Initialize Stitch (first time)
echo "📦 Step 1: Initialize Stitch MCP with gcloud ADC"
if npx -y @_davideast/stitch-mcp doctor &>/dev/null; then
    echo "  ✅ Stitch already initialized"
else
    echo "  ⚙️  Running: npx -y @_davideast/stitch-mcp init"
    npx -y @_davideast/stitch-mcp init
    echo "  ✅ Stitch initialized"
fi
echo ""

# 2. Claude Code
echo "📝 Step 2: Claude Code (~/.claude.json)"
if [ -f ~/.claude.json ]; then
    STITCH_CONFIG=$(cat "$STITCH_DIR/claude-code-config.template.json" | jq '.mcpServers.stitch')
    if jq -e '.mcpServers.stitch' ~/.claude.json &>/dev/null; then
        echo "  ✅ Stitch already in ~/.claude.json"
    else
        echo "  ⚙️  Adding Stitch to ~/.claude.json..."
        merge_json ~/.claude.json "stitch" "$STITCH_CONFIG"
    fi
else
    echo "  ⚠️  ~/.claude.json not found (create it in Claude Code)"
fi
echo ""

# 3. Codex
echo "📝 Step 3: Codex (~/.codex/config.toml)"
if [ -f ~/.codex/config.toml ]; then
    if grep -q "\[mcp_servers.stitch\]" ~/.codex/config.toml; then
        echo "  ✅ Stitch already in ~/.codex/config.toml"
    else
        echo "  ⚠️  Stitch not in ~/.codex/config.toml"
        echo "     Expected: [mcp_servers.stitch] section with proxy command"
        echo "     Template: $STITCH_DIR/codex-config.template.toml"
    fi
else
    echo "  ⚠️  ~/.codex/config.toml not found"
fi
echo ""

# 4. Kiro
echo "📝 Step 4: Kiro (~/.kiro/settings.json)"
KIRO_CONFIG_DIR=~/.kiro
if [ ! -d "$KIRO_CONFIG_DIR" ]; then
    echo "  ⚠️  Kiro not installed yet (create it first, then re-run this script)"
    echo "     Or manually add using Kiro UI: Settings → Extensions → MCP Servers"
else
    if [ -f "$KIRO_CONFIG_DIR/settings.json" ]; then
        STITCH_CONFIG=$(cat "$STITCH_DIR/kiro-config.template.json" | jq '.mcpServers.stitch')
        if jq -e '.mcpServers.stitch' "$KIRO_CONFIG_DIR/settings.json" &>/dev/null; then
            echo "  ✅ Stitch already in Kiro settings.json"
        else
            echo "  ⚙️  Adding Stitch to Kiro settings.json..."
            merge_json "$KIRO_CONFIG_DIR/settings.json" "stitch" "$STITCH_CONFIG"
        fi
    else
        # Create settings.json with Stitch config
        echo "  ⚙️  Creating Kiro settings.json with Stitch..."
        mkdir -p "$KIRO_CONFIG_DIR"
        STITCH_CONFIG=$(cat "$STITCH_DIR/kiro-config.template.json")
        echo "$STITCH_CONFIG" > "$KIRO_CONFIG_DIR/settings.json"
        echo "  ✅ Kiro settings.json created with Stitch MCP"
    fi
fi
echo ""

# 5. Cursor
echo "📝 Step 5: Cursor (~/.cursor/settings.json)"
CURSOR_CONFIG_DIR=~/.cursor
if [ ! -d "$CURSOR_CONFIG_DIR" ]; then
    echo "  ⚠️  Cursor not installed yet (create it first, then re-run this script)"
    echo "     Or manually add using Cursor UI: Settings → Extensions → MCP Servers"
else
    if [ -f "$CURSOR_CONFIG_DIR/settings.json" ]; then
        STITCH_CONFIG=$(cat "$STITCH_DIR/cursor-config.template.json" | jq '.mcpServers.stitch')
        if jq -e '.mcpServers.stitch' "$CURSOR_CONFIG_DIR/settings.json" &>/dev/null; then
            echo "  ✅ Stitch already in Cursor settings.json"
        else
            echo "  ⚙️  Adding Stitch to Cursor settings.json..."
            merge_json "$CURSOR_CONFIG_DIR/settings.json" "stitch" "$STITCH_CONFIG"
        fi
    else
        # Create settings.json with Stitch config
        echo "  ⚙️  Creating Cursor settings.json with Stitch..."
        mkdir -p "$CURSOR_CONFIG_DIR"
        STITCH_CONFIG=$(cat "$STITCH_DIR/cursor-config.template.json")
        echo "$STITCH_CONFIG" > "$CURSOR_CONFIG_DIR/settings.json"
        echo "  ✅ Cursor settings.json created with Stitch MCP"
    fi
fi
echo ""

# 6. Antigravity
echo "📝 Step 6: Antigravity (centralized config)"
ANTIGRAVITY_USER_DIR="$BRAIN_ROOT/operations/system-configs/antigravity/User"
ANTIGRAVITY_APP_DIR=~/Library/Application\ Support/Antigravity/User

mkdir -p "$ANTIGRAVITY_USER_DIR"

if [ ! -f "$ANTIGRAVITY_USER_DIR/mcp.json" ]; then
    echo "  ⚙️  Creating Antigravity runtime config..."
    cat > "$ANTIGRAVITY_USER_DIR/mcp.json" << 'EOF'
{
  "servers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_GOOGLE_STITCH_ACCESS_TOKEN_HERE",
        "X-Goog-User-Project": "YOUR_GCP_PROJECT_ID_HERE"
      }
    }
  }
}
EOF
    echo "  ⚠️  Created config template (update tokens manually or use proxy mode)"
else
    echo "  ✅ Antigravity config exists at $ANTIGRAVITY_USER_DIR/mcp.json"
fi

# Create symlink from Antigravity app directory
mkdir -p "$ANTIGRAVITY_APP_DIR"
ln -sfn "$ANTIGRAVITY_USER_DIR/mcp.json" "$ANTIGRAVITY_APP_DIR/mcp.json" 2>/dev/null || true

if [ -L "$ANTIGRAVITY_APP_DIR/mcp.json" ]; then
    echo "  ✅ Antigravity symlink created"
else
    echo "  ⚠️  Antigravity symlink may not be set (check permissions)"
fi
echo ""

# Verification
echo "🔍 Verification"
echo ""

if command -v codex &>/dev/null; then
    echo "Codex MCP servers:"
    codex mcp list | grep -E "^\s*(stitch|Name)" || echo "  ⚠️  No stitch server found"
    echo ""
fi

if command -v claude &>/dev/null; then
    echo "Claude Code MCP servers:"
    claude mcp list | grep -E "^\s*(stitch|Name)" || echo "  ⚠️  No stitch server found"
    echo ""
fi

echo "🧪 Testing Stitch MCP"
if npx -y @_davideast/stitch-mcp doctor 2>&1 | grep -q "✓"; then
    echo "  ✅ Stitch proxy health check passed"
else
    echo "  ⚠️  Stitch health check returned warnings (see above)"
fi
echo ""

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart all IDEs (Claude Code, Codex, Kiro, Cursor, Antigravity)"
echo "  2. Verify MCP servers appear in each tool's settings"
echo "  3. For Antigravity HTTP mode, update tokens in:"
echo "     $ANTIGRAVITY_USER_DIR/mcp.json"
echo "  4. Test by invoking Stitch tools in each IDE"
echo ""
