#!/bin/bash
# skill-prune-keep.sh — Safe audit logging for "keep" decisions
# Records decision to keep a skill without modifying it
# Non-destructive: writes to audit log only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

KEEP_DECISIONS_LOG="runtime/local/skill-prune/keep-decisions.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Helper functions ---

validate_skill_name() {
    local name=$1
    # Only allow alphanumeric, dots, underscores, hyphens (no slashes, no .., no spaces)
    if ! [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]]; then
        return 1
    fi
    return 0
}

# --- Validate arguments ---

if [[ $# -lt 1 ]]; then
    echo "Usage: skill-prune-keep.sh <skill-name> [reason...]"
    echo ""
    echo "Records a decision to keep a skill in the audit log."
    echo "Non-destructive: does not modify or delete any files."
    echo ""
    echo "Examples:"
    echo "  bash tools/scripts/skill-prune-keep.sh old-skill"
    echo "  bash tools/scripts/skill-prune-keep.sh old-skill 'Still used occasionally'"
    exit 1
fi

SKILL_NAME="$1"
REASON="${2:-No reason provided}"

# Validate skill name format
if ! validate_skill_name "$SKILL_NAME"; then
    echo "ERROR: Invalid skill name '$SKILL_NAME'"
    echo "Allowed: alphanumeric, dots, underscores, hyphens only"
    exit 1
fi

# Verify skill exists in active skills
ACTIVE_SYMLINK="ai/skills/active/$SKILL_NAME"
if [[ ! -L "$ACTIVE_SYMLINK" ]]; then
    echo "ERROR: Skill '$SKILL_NAME' is not an active symlink"
    exit 1
fi

# --- Create audit entry ---

mkdir -p "$(dirname "$KEEP_DECISIONS_LOG")"

{
    echo "timestamp=$TIMESTAMP"
    echo "operator=$(whoami)"
    echo "skill=$SKILL_NAME"
    echo "decision=keep"
    echo "reason=$REASON"
    echo ""
} >> "$KEEP_DECISIONS_LOG"

# --- Output ---

echo "✓ Keep decision recorded"
echo ""
echo "Details:"
echo "  - Skill:      $SKILL_NAME"
echo "  - Decision:   keep"
echo "  - Reason:     $REASON"
echo "  - Logged:     $KEEP_DECISIONS_LOG"
echo ""
echo "Skill remains active. No files modified."
