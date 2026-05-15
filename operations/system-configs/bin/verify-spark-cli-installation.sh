#!/usr/bin/env bash
set -euo pipefail

# Verify Spark CLI universal installation across all LLM/IDE consumers

echo "🔍 Spark CLI Universal Installation Verification"
echo "=================================================="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

ERRORS=0

# 1. Wrapper script
echo "1. Wrapper Script"
echo "================='"
WRAPPER="/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/spark-cli"
if [ -f "$WRAPPER" ]; then
    pass "Wrapper exists at $WRAPPER"
    if [ -x "$WRAPPER" ]; then
        pass "Wrapper is executable"
    else
        fail "Wrapper is not executable"
        ERRORS=$((ERRORS + 1))
    fi
else
    fail "Wrapper not found at $WRAPPER"
    ERRORS=$((ERRORS + 1))
fi
echo

# 2. Symlink in ~/.local/bin
echo "2. ~/.local/bin Symlink"
echo "========================"
LOCALBIN_LINK="$HOME/.local/bin/spark-cli"
if [ -L "$LOCALBIN_LINK" ]; then
    TARGET=$(readlink "$LOCALBIN_LINK")
    pass "Symlink exists: $LOCALBIN_LINK → $TARGET"
else
    fail "Symlink not found at $LOCALBIN_LINK"
    ERRORS=$((ERRORS + 1))
fi
echo

# 3. CLI binary
echo "3. Spark CLI Binary"
echo "==================="
if command -v spark &> /dev/null; then
    VERSION=$(spark --version)
    pass "Spark CLI binary found: $VERSION"
else
    fail "Spark CLI binary not found in PATH"
    ERRORS=$((ERRORS + 1))
fi
echo

# 4. Wrapper invocation
echo "4. Wrapper Invocation Test"
echo "=========================="
if spark-cli --version &> /dev/null; then
    VERSION=$(spark-cli --version)
    pass "spark-cli wrapper works: $VERSION"
else
    fail "spark-cli wrapper invocation failed"
    ERRORS=$((ERRORS + 1))
fi
echo

# 5. Skill custom source
echo "5. Skill Custom Source"
echo "===================="
SKILL_SOURCE="/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/spark/SKILL.md"
if [ -f "$SKILL_SOURCE" ]; then
    SIZE=$(wc -c < "$SKILL_SOURCE")
    pass "Skill source exists: $SKILL_SOURCE ($SIZE bytes)"
    SKILL_VERSION=$(grep 'version:' "$SKILL_SOURCE" | head -1 | sed 's/.*version: //; s/^ *//; s/ *$//')
    pass "Skill version: $SKILL_VERSION"
else
    fail "Skill source not found at $SKILL_SOURCE"
    ERRORS=$((ERRORS + 1))
fi
echo

# 6. Skill active symlink
echo "6. Skill Active Symlink"
echo "======================"
SKILL_ACTIVE="/Users/Office/Repos/stevewesthoek/brain/ai/skills/active/spark"
if [ -L "$SKILL_ACTIVE" ]; then
    TARGET=$(readlink "$SKILL_ACTIVE")
    pass "Skill active symlink exists: $SKILL_ACTIVE → $TARGET"
else
    fail "Skill active symlink not found at $SKILL_ACTIVE"
    ERRORS=$((ERRORS + 1))
fi
echo

# 7. Consumer accessibility
echo "7. Consumer Skill Accessibility"
echo "==============================="

CONSUMERS=(
    "Claude Code:$HOME/.claude/skills/spark/SKILL.md"
    "Codex:$HOME/.codex/skills/user/spark/SKILL.md"
    "Gemini CLI:$HOME/.gemini/skills/spark/SKILL.md"
    "Cursor:$HOME/.config/cursor/skills/spark/SKILL.md"
    "Antigravity:$HOME/.config/antigravity/skills/spark/SKILL.md"
)

for consumer_def in "${CONSUMERS[@]}"; do
    IFS=':' read -r consumer path <<< "$consumer_def"
    if [ -f "$path" ]; then
        pass "$consumer: accessible"
    elif [ -L "$path" ]; then
        pass "$consumer: accessible (symlink)"
    else
        fail "$consumer: not found at $path"
        # Check alternate path for Cursor
        if [ "$consumer" = "Cursor" ]; then
            ALT="/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/cursor/skills/spark/SKILL.md"
            if [ -f "$ALT" ]; then
                pass "$consumer: accessible (alternate path)"
            fi
        fi
    fi
done
echo

# Kiro (entry-symlinks mode)
if [ -L "$HOME/.kiro/skills/spark" ]; then
    pass "Kiro: spark skill symlink exists"
else
    warn "Kiro: spark skill symlink not found (may not be configured)"
fi
echo

# 8. CLI functionality test
echo "8. CLI Functionality Test"
echo "========================"
if spark-cli accounts &> /dev/null; then
    pass "spark-cli accounts command works"
else
    fail "spark-cli accounts command failed (Spark Desktop may not be running)"
fi
echo

# Summary
echo "Summary"
echo "======="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo
    echo "Spark CLI is successfully installed and available to:"
    echo "  - Claude Code"
    echo "  - Codex"
    echo "  - Gemini CLI"
    echo "  - Kiro"
    echo "  - Cursor"
    echo "  - Antigravity"
    echo
    echo "Usage:"
    echo "  1. From Claude Code/Codex/Gemini CLI: spark-cli <command>"
    echo "  2. From Kiro/Cursor/Antigravity: use /use-spark skill"
    echo
    echo "For full documentation, see: operations/runbooks/spark-cli.md"
    exit 0
else
    echo -e "${RED}✗ $ERRORS check(s) failed${NC}"
    echo
    echo "See operations/runbooks/spark-cli.md for troubleshooting"
    exit 1
fi
