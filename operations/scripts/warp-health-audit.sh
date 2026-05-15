#!/usr/bin/env bash
set -euo pipefail

# Warp Agent Health Audit Script
# Comprehensive health check of the brain repo infrastructure
# Checks: skill sync, symlinks, docs, secrets, dependencies, builds

echo "🏥 BRAIN REPO HEALTH AUDIT"
echo "============================"
echo
echo "Started: $(date)"
echo "Working directory: $(pwd)"
echo

ERRORS=0
WARNINGS=0
PASSES=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; PASSES=$((PASSES + 1)); }
fail() { echo -e "${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

# ============================================
# 1. SKILL SYNC CHECK
# ============================================
echo "1. Skill Sync Verification"
echo "=========================="

if [ -f "tools/scripts/sync-ai-skills.mjs" ]; then
    if node tools/scripts/sync-ai-skills.mjs --check &> /tmp/sync-check.log; then
        pass "Skill sync check passed"
    else
        fail "Skill sync check failed - run: node tools/scripts/sync-ai-skills.mjs --dry-run"
        cat /tmp/sync-check.log | head -20
    fi
else
    fail "sync-ai-skills.mjs not found"
fi
echo

# ============================================
# 2. SYMLINK INTEGRITY
# ============================================
echo "2. Symlink Integrity Check"
echo "=========================="

SYMLINKS=(
    "~/.claude:operations/system-configs/claude"
    "~/.codex:operations/system-configs/codex"
    "~/.gemini:operations/system-configs/gemini"
    "~/.kiro:operations/system-configs/kiro"
    "ai/skills/active/spark:../custom/spark"
)

for symlink_def in "${SYMLINKS[@]}"; do
    IFS=':' read -r link target <<< "$symlink_def"
    EXPANDED_LINK=$(eval echo "$link")
    if [ -L "$EXPANDED_LINK" ]; then
        pass "Symlink exists: $link"
    elif [[ "$link" =~ ^ai/skills ]]; then
        # Check relative to repo root
        if [ -L "$link" ]; then
            pass "Symlink exists: $link"
        else
            fail "Symlink missing: $link"
        fi
    else
        warn "Symlink not found locally (expected on non-Mac): $link"
    fi
done
echo

# ============================================
# 3. CRITICAL FILES EXIST
# ============================================
echo "3. Critical Files Verification"
echo "=============================="

CRITICAL_FILES=(
    "CLAUDE.md"
    "AGENTS.md"
    "00-start-here.md"
    "00-current-context.md"
    "00-memory-map.md"
    "README.md"
    "ai/skills/active"
    "operations/system-configs/README.md"
    "operations/runbooks/spark-cli.md"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -e "$file" ]; then
        pass "File/dir exists: $file"
    else
        fail "Missing: $file"
    fi
done
echo

# ============================================
# 4. DOCUMENTATION VALIDATION
# ============================================
echo "4. Documentation Validation"
echo "==========================="

DOCS=(
    "CLAUDE.md"
    "operations/runbooks/spark-cli.md"
    "operations/decision-log.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        SIZE=$(wc -c < "$doc")
        if [ $SIZE -gt 500 ]; then
            pass "Documentation present: $doc ($SIZE bytes)"
        else
            warn "Documentation seems sparse: $doc ($SIZE bytes)"
        fi
    else
        fail "Documentation missing: $doc"
    fi
done
echo

# ============================================
# 5. SECRET SCAN (basic)
# ============================================
echo "5. Secret Scan (Basic)"
echo "====================="

SECRETS_FOUND=0

# Scan for common secret patterns in tracked files
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Check for API keys, tokens in committed files
    if git grep -l "api_key\|apiKey\|secret\|token\|password" -- '*.md' '*.json' '*.yml' '*.yaml' '*.env*' 2>/dev/null | head -10; then
        warn "Potential secrets found in tracked files (review manually)"
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    else
        pass "No obvious secrets detected in tracked files"
    fi

    # Check for .env files
    if git ls-files | grep -E "\.env$|\.env\." | head -10; then
        warn ".env files tracked (should be ignored)"
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    else
        pass "No .env files tracked"
    fi
else
    warn "Not a git repo or git not available"
fi
echo

# ============================================
# 6. GIT STATUS
# ============================================
echo "6. Git Status Check"
echo "==================="

if git rev-parse --git-dir > /dev/null 2>&1; then
    UNCOMMITTED=$(git status --short | wc -l)
    if [ $UNCOMMITTED -eq 0 ]; then
        pass "Working tree clean (no uncommitted changes)"
    else
        warn "$UNCOMMITTED uncommitted changes"
        git status --short | head -10
    fi

    # Check for unpushed commits
    UNPUSHED=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
    if [ "$UNPUSHED" -gt 0 ]; then
        warn "$UNPUSHED commits ahead of origin/main"
    else
        pass "All commits pushed to origin/main"
    fi
else
    fail "Not a git repository"
fi
echo

# ============================================
# 7. NODE/NPM HEALTH
# ============================================
echo "7. Node/NPM Health"
echo "=================="

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    pass "Node.js installed: $NODE_VERSION"
else
    fail "Node.js not found"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    pass "npm installed: $NPM_VERSION"
else
    fail "npm not found"
fi

if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        pass "node_modules directory exists"
    else
        warn "package.json exists but node_modules missing - run: npm install"
    fi
else
    info "No package.json (optional for this repo)"
fi
echo

# ============================================
# 8. CLI TOOLS AVAILABLE
# ============================================
echo "8. CLI Tools Check"
echo "=================="

TOOLS=(
    "git:git"
    "bash:bash"
    "node:node"
    "spark-cli:spark-cli"
)

for tool_def in "${TOOLS[@]}"; do
    IFS=':' read -r name cmd <<< "$tool_def"
    if command -v "$cmd" &> /dev/null; then
        VERSION=$($cmd --version 2>&1 | head -1)
        pass "$name: $VERSION"
    else
        warn "$name not found in PATH"
    fi
done
echo

# ============================================
# 9. DIRECTORY STRUCTURE
# ============================================
echo "9. Directory Structure Validation"
echo "=================================="

DIRS=(
    "ai/skills"
    "ai/skills/active"
    "ai/skills/custom"
    "operations/system-configs"
    "operations/runbooks"
    "operations/standards"
    "tools/scripts"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        COUNT=$(find "$dir" -maxdepth 1 | tail -n +2 | wc -l)
        pass "Directory exists: $dir ($COUNT items)"
    else
        fail "Directory missing: $dir"
    fi
done
echo

# ============================================
# 10. RECENT COMMITS
# ============================================
echo "10. Recent Commit History"
echo "========================="

if git rev-parse --git-dir > /dev/null 2>&1; then
    info "Last 3 commits:"
    git log --oneline -3 | sed 's/^/  /'
else
    warn "Git not available"
fi
echo

# ============================================
# SUMMARY
# ============================================
echo "════════════════════════════════════════"
echo "HEALTH AUDIT SUMMARY"
echo "════════════════════════════════════════"
echo -e "Passed:  ${GREEN}$PASSES${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo "Completed: $(date)"
echo

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ BRAIN REPO HEALTH: EXCELLENT${NC}"
    echo "All critical systems operational."
    exit 0
elif [ $ERRORS -lt 3 ]; then
    echo -e "${YELLOW}⚠ BRAIN REPO HEALTH: GOOD${NC}"
    echo "Minor issues detected - see warnings above."
    exit 0
else
    echo -e "${RED}✗ BRAIN REPO HEALTH: NEEDS ATTENTION${NC}"
    echo "Multiple issues detected - review errors above."
    exit 1
fi
