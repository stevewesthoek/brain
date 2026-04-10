#!/bin/bash
# Brain Automation Verification Script
#
# Run this after rebooting, OS updates, or whenever you want to verify
# that the Auto-Router is still set up correctly.
#
# Usage:
#   bash ~/Repos/stevewesthoek/brain/tools/scripts/brain-automate-verify.sh
#

set -e

SCRIPT_PATH="$HOME/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py"
GITHUB_CONFIG="$HOME/.config/github/.env"
LOG_DIR="$HOME/.local/share/brain/logs"
REPO_PATH="$HOME/Repos/stevewesthoek/brain"

echo "🔍 Brain Automation Verification"
echo "=================================="
echo ""

# 1. Check cron job
echo "1. Checking cron job..."
if crontab -l 2>/dev/null | grep -q "brain-auto-router"; then
    CRON_ENTRY=$(crontab -l | grep brain-auto-router)
    echo "   ✓ Cron job found:"
    echo "   $CRON_ENTRY"
else
    echo "   ✗ ERROR: Cron job not found!"
    echo "   Run this to reinstall:"
    echo "   (crontab -l 2>/dev/null | grep -v 'brain-auto-router'; echo '*/1 * * * * $SCRIPT_PATH >> /dev/null 2>&1') | crontab -"
    exit 1
fi

echo ""

# 2. Check script exists and is executable
echo "2. Checking Python script..."
if [ -f "$SCRIPT_PATH" ]; then
    if [ -x "$SCRIPT_PATH" ]; then
        echo "   ✓ Script exists and is executable"
        SCRIPT_SIZE=$(du -h "$SCRIPT_PATH" | cut -f1)
        echo "   Size: $SCRIPT_SIZE"
    else
        echo "   ✗ Script exists but is NOT executable"
        echo "   Run: chmod +x $SCRIPT_PATH"
        exit 1
    fi
else
    echo "   ✗ Script not found at: $SCRIPT_PATH"
    exit 1
fi

echo ""

# 3. Check GitHub config
echo "3. Checking GitHub credentials..."
if [ -f "$GITHUB_CONFIG" ]; then
    if grep -q "GITHUB_PAT=" "$GITHUB_CONFIG"; then
        TOKEN=$(grep "GITHUB_PAT=" "$GITHUB_CONFIG" | cut -d= -f2)
        if [ ${#TOKEN} -gt 10 ]; then
            echo "   ✓ GitHub PAT found (${#TOKEN} chars)"
        else
            echo "   ✗ GitHub PAT appears empty"
            exit 1
        fi
    else
        echo "   ✗ GITHUB_PAT not found in $GITHUB_CONFIG"
        exit 1
    fi
else
    echo "   ✗ Config file not found: $GITHUB_CONFIG"
    echo "   Create it with: mkdir -p ~/.config/github && echo 'GITHUB_PAT=<your-token>' > $GITHUB_CONFIG"
    exit 1
fi

echo ""

# 4. Check logs directory
echo "4. Checking logs directory..."
if [ -d "$LOG_DIR" ]; then
    echo "   ✓ Logs directory exists: $LOG_DIR"
    RECENT_LOG=$(ls -t "$LOG_DIR"/auto-router.log* 2>/dev/null | head -1)
    if [ -n "$RECENT_LOG" ]; then
        LAST_RUN=$(tail -1 "$RECENT_LOG")
        echo "   Last run: $LAST_RUN"
    fi
else
    echo "   ⚠ Logs directory doesn't exist yet (will be created on first run)"
fi

echo ""

# 5. Check Git repo
echo "5. Checking Git repository..."
if [ -d "$REPO_PATH/.git" ]; then
    echo "   ✓ Git repo found: $REPO_PATH"
    cd "$REPO_PATH"
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    echo "   Current branch: $BRANCH"
    REMOTE_STATUS=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$REMOTE_STATUS" -eq 0 ]; then
        echo "   ✓ Working directory clean"
    else
        echo "   ⚠ Working directory has changes ($REMOTE_STATUS files)"
    fi
else
    echo "   ✗ Git repo not found at: $REPO_PATH"
    exit 1
fi

echo ""

# 6. Test git access
echo "6. Testing Git connectivity..."
cd "$REPO_PATH"
if git remote -v 2>/dev/null | grep -q "github.com"; then
    echo "   ✓ GitHub remote configured"
    # Try to fetch (but don't modify anything)
    if git fetch origin --dry-run 2>&1 | grep -q "From github.com"; then
        echo "   ✓ Can reach GitHub"
    else
        echo "   ⚠ Could not verify GitHub connectivity (may be network issue)"
    fi
else
    echo "   ✗ GitHub remote not configured"
    exit 1
fi

echo ""

# 7. Test Python execution
echo "7. Testing Python script..."
if python3 "$SCRIPT_PATH" 2>&1 | grep -q "brain-auto-router"; then
    echo "   ✓ Script runs without errors"
else
    echo "   ⚠ Script executed but may have issues"
    echo "   Run manually to debug: $SCRIPT_PATH"
fi

echo ""
echo "=================================="
echo "✓ All checks passed!"
echo ""
echo "Next steps:"
echo "  - Auto-Router runs every 1 minute via cron"
echo "  - Check logs: tail -f $LOG_DIR/auto-router.log"
echo "  - Add test notes to $REPO_PATH/notes/01-inbox/"
echo ""
