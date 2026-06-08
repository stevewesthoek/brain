#!/bin/bash
# Verify Mind repo is ready for writes (no git lock, no uncommitted changes)
# Usage: ./verify-ios-sync-ready.sh

set -euo pipefail

MIND_REPO="${MIND_REPO_PATH:-.../mind}"

if [ ! -d "$MIND_REPO" ]; then
  echo "error: Mind repo not found at $MIND_REPO"
  exit 1
fi

echo "Verifying iOS sync readiness for: $MIND_REPO"
echo ""

# Check 1: Git lock
LOCK_FILE="$MIND_REPO/.git/index.lock"
if [ -f "$LOCK_FILE" ]; then
  echo "✗ Check 1: Git lock exists (iOS sync in progress)"
  exit 1
fi
echo "✓ Check 1: No git lock"

# Check 2: No uncommitted changes
cd "$MIND_REPO"
if ! git diff --quiet; then
  echo "✗ Check 2: Uncommitted changes detected"
  git status --short
  exit 1
fi
if ! git diff --cached --quiet; then
  echo "✗ Check 2: Staged changes detected"
  git status --short
  exit 1
fi
echo "✓ Check 2: Git status clean"

# Check 3: No untracked critical files
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l)
if [ "$UNTRACKED" -gt 0 ]; then
  echo "⚠ Warning: $UNTRACKED untracked files present (will not block writes)"
fi
echo "✓ Check 3: Ready for writes"
echo ""
echo "iOS sync ready: true"
exit 0
