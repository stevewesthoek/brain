#!/bin/bash
set -euo pipefail

# Workbench MCP Automated Setup for All IDEs
# This script configures Workbench MCP across Claude Code, Codex, Kiro, Cursor, and Antigravity
# Prerequisites: Node.js installed, workbench-private repo available, credential token created

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
brain_root="$(cd "$script_dir/../../../.." && pwd)"

echo -e "${GREEN}=== Workbench MCP Setup for All IDEs ===${NC}"
echo ""

# Collect configuration from user
echo -e "${YELLOW}Please provide the following information:${NC}"
echo ""

# Get workbench-private repo path
read -p "Path to workbench-private repository: " workbench_path
workbench_path=$(cd "$workbench_path" 2>/dev/null || { echo "Invalid path"; exit 1; } && pwd)
echo -e "${GREEN}✓ Using Workbench: $workbench_path${NC}"

# Get Node path
node_path=$(which node)
read -p "Path to node executable [${node_path}]: " node_input
node_path=${node_input:-$node_path}
echo -e "${GREEN}✓ Using Node: $node_path${NC}"

# Get credential file path
read -p "Path to credential file (e.g., ~/.credentials/workbench-mcp.token): " cred_file
cred_file="${cred_file/#\~/$HOME}"
if [ ! -f "$cred_file" ]; then
  echo -e "${RED}✗ Credential file not found: $cred_file${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Using credentials: $cred_file${NC}"

echo ""
echo -e "${YELLOW}Which IDEs would you like to configure?${NC}"
read -p "Claude Code [y/n]: " install_claude_code
install_claude_code=${install_claude_code:-y}

read -p "Codex [y/n]: " install_codex
install_codex=${install_codex:-y}

read -p "Kiro [y/n]: " install_kiro
install_kiro=${install_kiro:-y}

read -p "Cursor [y/n]: " install_cursor
install_cursor=${install_cursor:-y}

read -p "Antigravity [y/n]: " install_antigravity
install_antigravity=${install_antigravity:-n}

echo ""
echo -e "${YELLOW}=== Installation Preview ===${NC}"
[ "$install_claude_code" = "y" ] && echo "  • Claude Code: ~/.claude.json"
[ "$install_codex" = "y" ] && echo "  • Codex: ~/.codex/config.toml"
[ "$install_kiro" = "y" ] && echo "  • Kiro: ~/.kiro/settings.json"
[ "$install_cursor" = "y" ] && echo "  • Cursor: ~/.cursor/settings.json"
[ "$install_antigravity" = "y" ] && echo "  • Antigravity: ~/Library/Application Support/Antigravity/User/mcp.json"
echo ""

read -p "Proceed with installation? [y/n]: " confirm
if [ "$confirm" != "y" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo -e "${YELLOW}=== Installing Workbench MCP ===${NC}"
echo ""

# Helper function to merge JSON config
merge_json_config() {
  local config_file=$1
  local config_key=$2
  local json_config=$3

  if [ ! -f "$config_file" ]; then
    echo "{}" > "$config_file"
  fi

  # Use jq to merge the config
  if command -v jq &> /dev/null; then
    jq ".mcpServers.$config_key = $json_config" "$config_file" > "${config_file}.tmp" && \
    mv "${config_file}.tmp" "$config_file"
  else
    echo -e "${YELLOW}⚠ jq not found, manual merge required${NC}"
    return 1
  fi
}

# Claude Code setup
if [ "$install_claude_code" = "y" ]; then
  echo -e "${YELLOW}Configuring Claude Code...${NC}"
  claude_config="$HOME/.claude.json"

  # Create base config if missing
  if [ ! -f "$claude_config" ]; then
    echo "{\"mcpServers\": {}}" > "$claude_config"
  fi

  # Generate the config block
  claude_config_json=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": ["$workbench_path/packages/mcp/dist/server.js"],
  "env": {
    "WORKBENCH_MCP_CREDENTIAL_FILE": "$cred_file",
    "WORKBENCH_MCP_ALLOWED_TOOLS": "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand",
    "WORKBENCH_MCP_ALLOWED_COMMAND_KINDS": "n8n_workflow_migration"
  }
}
EOF
)

  if merge_json_config "$claude_config" "workbench" "$claude_config_json"; then
    echo -e "${GREEN}✓ Claude Code configured${NC}"
  else
    echo -e "${YELLOW}⚠ Manual setup required for Claude Code${NC}"
    echo "   Add to $claude_config:"
    echo "$claude_config_json" | sed 's/^/   /'
  fi
fi

# Codex setup
if [ "$install_codex" = "y" ]; then
  echo -e "${YELLOW}Configuring Codex...${NC}"
  codex_config="$HOME/.codex/config.toml"

  # Create directory if missing
  mkdir -p "$HOME/.codex"

  # Create base config if missing
  if [ ! -f "$codex_config" ]; then
    touch "$codex_config"
  fi

  # Check if workbench section already exists
  if grep -q "\[mcp_servers.workbench\]" "$codex_config"; then
    echo -e "${YELLOW}⚠ Workbench MCP already in Codex config, skipping${NC}"
  else
    cat >> "$codex_config" <<EOF

[mcp_servers.workbench]
command = "$node_path"
args = ["$workbench_path/packages/mcp/dist/server.js"]

[mcp_servers.workbench.env]
WORKBENCH_MCP_CREDENTIAL_FILE = "$cred_file"
WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand"
WORKBENCH_MCP_ALLOWED_COMMAND_KINDS = "n8n_workflow_migration"
EOF
    echo -e "${GREEN}✓ Codex configured${NC}"
  fi
fi

# Kiro setup
if [ "$install_kiro" = "y" ]; then
  echo -e "${YELLOW}Configuring Kiro...${NC}"
  kiro_config="$HOME/.kiro/settings.json"

  mkdir -p "$HOME/.kiro"
  if [ ! -f "$kiro_config" ]; then
    echo "{\"mcpServers\": {}}" > "$kiro_config"
  fi

  kiro_config_json=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": ["$workbench_path/packages/mcp/dist/server.js"],
  "env": {
    "WORKBENCH_MCP_CREDENTIAL_FILE": "$cred_file",
    "WORKBENCH_MCP_ALLOWED_TOOLS": "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand",
    "WORKBENCH_MCP_ALLOWED_COMMAND_KINDS": "n8n_workflow_migration"
  }
}
EOF
)

  if merge_json_config "$kiro_config" "workbench" "$kiro_config_json"; then
    echo -e "${GREEN}✓ Kiro configured${NC}"
  else
    echo -e "${YELLOW}⚠ Manual setup required for Kiro${NC}"
  fi
fi

# Cursor setup
if [ "$install_cursor" = "y" ]; then
  echo -e "${YELLOW}Configuring Cursor...${NC}"
  cursor_config="$HOME/.cursor/settings.json"

  mkdir -p "$HOME/.cursor"
  if [ ! -f "$cursor_config" ]; then
    echo "{\"mcpServers\": {}}" > "$cursor_config"
  fi

  cursor_config_json=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": ["$workbench_path/packages/mcp/dist/server.js"],
  "env": {
    "WORKBENCH_MCP_CREDENTIAL_FILE": "$cred_file",
    "WORKBENCH_MCP_ALLOWED_TOOLS": "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand",
    "WORKBENCH_MCP_ALLOWED_COMMAND_KINDS": "n8n_workflow_migration"
  }
}
EOF
)

  if merge_json_config "$cursor_config" "workbench" "$cursor_config_json"; then
    echo -e "${GREEN}✓ Cursor configured${NC}"
  else
    echo -e "${YELLOW}⚠ Manual setup required for Cursor${NC}"
  fi
fi

# Antigravity setup (macOS only)
if [ "$install_antigravity" = "y" ]; then
  if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${YELLOW}⚠ Antigravity setup skipped (macOS only)${NC}"
  else
    echo -e "${YELLOW}Configuring Antigravity...${NC}"
    antigravity_dir="$HOME/Library/Application Support/Antigravity/User"
    antigravity_config="$antigravity_dir/mcp.json"

    mkdir -p "$antigravity_dir"

    cat > "$antigravity_config" <<EOF
{
  "mcpServers": {
    "workbench": {
      "type": "stdio",
      "command": "$node_path",
      "args": ["$workbench_path/packages/mcp/dist/server.js"],
      "env": {
        "WORKBENCH_MCP_CREDENTIAL_FILE": "$cred_file",
        "WORKBENCH_MCP_ALLOWED_TOOLS": "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand",
        "WORKBENCH_MCP_ALLOWED_COMMAND_KINDS": "n8n_workflow_migration"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✓ Antigravity configured${NC}"
  fi
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Restart your IDE(s)"
echo "2. Verify with: claude mcp list, codex mcp list, etc."
echo "3. Check the Workbench MCP README for troubleshooting"
echo ""
echo "Workbench MCP tools admitted:"
echo "  • getWorkbenchStatus"
echo "  • readWorkbenchContext"
echo "  • runWorkbenchCommand (n8n_workflow_migration only)"
