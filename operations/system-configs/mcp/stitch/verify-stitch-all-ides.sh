#!/bin/bash

# verify-stitch-all-ides.sh
# Centralized verification script for Google Stitch MCP across all IDEs
# Usage: bash operations/system-configs/mcp/stitch/verify-stitch-all-ides.sh

# Continue on errors for verification
set +e

STITCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$STITCH_DIR/../../../.." && pwd)"

echo "🔍 Verifying Google Stitch MCP Setup"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Helper functions
pass() {
    echo -e "${GREEN}✅${NC} $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}❌${NC} $1"
    ((FAIL_COUNT++))
}

warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
    ((WARN_COUNT++))
}

# 1. Check gcloud setup
echo "📦 Stitch MCP Proxy Setup"
echo "------------------------"

if npx -y @_davideast/stitch-mcp doctor &>/dev/null; then
    pass "Stitch proxy health check"
else
    warn "Stitch proxy health check has issues (may be IAM-related)"
    npx -y @_davideast/stitch-mcp doctor 2>&1 | head -10
fi
echo ""

# 2. Claude Code
echo "🔧 Claude Code (~/.claude.json)"
echo "--------------------------------"

if [ -f ~/.claude.json ]; then
    if jq -e '.mcpServers.stitch' ~/.claude.json &>/dev/null; then
        if jq -e '.mcpServers.stitch.env.STITCH_API_KEY' ~/.claude.json &>/dev/null; then
            pass "Stitch configured in ~/.claude.json"
            local api_key=$(jq -r '.mcpServers.stitch.env.STITCH_API_KEY' ~/.claude.json)
            if [ "$api_key" = "gcloud-adc" ]; then
                pass "Using gcloud ADC (correct)"
            else
                warn "STITCH_API_KEY set to '$api_key' (should be 'gcloud-adc')"
            fi
        else
            fail "STITCH_API_KEY env var not set"
        fi
    else
        fail "Stitch not in ~/.claude.json"
    fi
else
    fail "~/.claude.json not found"
fi

if command -v claude &>/dev/null; then
    if claude mcp list 2>/dev/null | grep -q "stitch"; then
        pass "Claude Code sees stitch MCP server"
    else
        warn "Claude Code MCP list doesn't show stitch (may need restart)"
    fi
else
    warn "Claude Code CLI not in PATH"
fi
echo ""

# 3. Codex
echo "🔧 Codex (~/.codex/config.toml)"
echo "--------------------------------"

if [ -f ~/.codex/config.toml ]; then
    if grep -q "\[mcp_servers.stitch\]" ~/.codex/config.toml; then
        pass "Stitch configured in ~/.codex/config.toml"
        if grep -q 'STITCH_API_KEY = "gcloud-adc"' ~/.codex/config.toml; then
            pass "Using gcloud ADC (correct)"
        else
            fail "STITCH_API_KEY not set to gcloud-adc"
        fi
    else
        fail "Stitch not in ~/.codex/config.toml"
    fi
else
    fail "~/.codex/config.toml not found"
fi

if command -v codex &>/dev/null; then
    if codex mcp list 2>/dev/null | grep -q "stitch"; then
        pass "Codex sees stitch MCP server"
    else
        warn "Codex MCP list doesn't show stitch (may need restart)"
    fi
else
    warn "Codex not installed or not in PATH"
fi
echo ""

# 4. Kiro
echo "🔧 Kiro (~/.kiro/)"
echo "------------------"

if [ -d ~/.kiro ]; then
    warn "Kiro config directory exists but MCP must be configured in Kiro UI"
    echo "     Manual step: Kiro → Settings → Extensions → MCP → Add Stitch"
else
    warn "Kiro not installed yet"
fi
echo ""

# 5. Cursor
echo "🔧 Cursor (~/.cursor/)"
echo "---------------------"

if [ -d ~/.cursor ]; then
    warn "Cursor config directory exists but MCP must be configured in Cursor UI"
    echo "     Manual step: Cursor → Settings → Extensions → MCP → Add Stitch"
else
    warn "Cursor not installed yet"
fi
echo ""

# 6. Antigravity
echo "🔧 Antigravity (~/Library/Application Support/Antigravity/User/)"
echo "---------------------------------------------------------------"

ANTIGRAVITY_APP_DIR=~/Library/Application\ Support/Antigravity/User
ANTIGRAVITY_BRAIN_DIR=$BRAIN_ROOT/operations/system-configs/antigravity/User

if [ -L "$ANTIGRAVITY_APP_DIR/mcp.json" ]; then
    pass "Antigravity MCP symlink exists"
    SYMLINK_TARGET=$(readlink "$ANTIGRAVITY_APP_DIR/mcp.json")
    if [ "$SYMLINK_TARGET" = "$ANTIGRAVITY_BRAIN_DIR/mcp.json" ]; then
        pass "Symlink points to correct centralized location"
    else
        warn "Symlink points to unexpected location: $SYMLINK_TARGET"
    fi
else
    if [ -f "$ANTIGRAVITY_APP_DIR/mcp.json" ]; then
        warn "Antigravity MCP is a regular file (not symlinked)"
    else
        fail "Antigravity MCP config not found"
    fi
fi

if [ -f "$ANTIGRAVITY_BRAIN_DIR/mcp.json" ]; then
    pass "Centralized Antigravity MCP config exists"
    if grep -q "stitch" "$ANTIGRAVITY_BRAIN_DIR/mcp.json"; then
        pass "Stitch configured in Antigravity MCP"
    else
        fail "Stitch not in Antigravity MCP config"
    fi
else
    fail "Centralized Antigravity MCP config not found"
fi
echo ""

# 7. Central documentation
echo "📚 Documentation"
echo "----------------"

STITCH_README="$STITCH_DIR/README.md"
MASTER_MCP="$STITCH_DIR/../MASTER-MCP-SETUP.md"
MCP_README="$STITCH_DIR/../README.md"

[ -f "$STITCH_README" ] && pass "Stitch README exists" || fail "Stitch README missing"
[ -f "$MASTER_MCP" ] && pass "Master MCP setup doc exists" || fail "Master MCP setup doc missing"
[ -f "$MCP_README" ] && pass "MCP README exists" || fail "MCP README missing"

echo ""

# 8. Summary
echo "======================================="
echo "🎯 Summary"
echo "======================================="
echo -e "  ${GREEN}✅ Passed:${NC}  $PASS_COUNT"
echo -e "  ${RED}❌ Failed:${NC}  $FAIL_COUNT"
echo -e "  ${YELLOW}⚠️ Warnings:${NC} $WARN_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✨ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Restart all IDEs (Claude Code, Codex, Kiro, Cursor, Antigravity)"
    echo "  2. Verify MCP servers appear in each tool's MCP list"
    echo "  3. Test by invoking Stitch tools in each IDE"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️ Some critical checks failed. See above for details.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Check $STITCH_README for setup instructions"
    echo "  • Verify gcloud ADC: gcloud auth application-default login"
    echo "  • Check managed paths: ls -la ~/.claude.json ~/.codex/config.toml"
    echo "  • Restart IDEs and check their MCP settings"
    echo ""
    exit 1
fi
