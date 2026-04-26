#!/bin/bash
# skill-prune-delete.sh — Manual DELETE mode (requires quarantine precedent + age threshold)
# Deletes source folder only after quarantine age threshold is met
# Quarantine manifest must exist and show prior quarantine
# Requires explicit user approval, git clean check, and path safety validation

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG_FILE="ai/skills/prune-config.json"
SKILLS_CUSTOM_LEARNED_DIR="ai/skills/custom/learned"
QUARANTINE_DIR="ai/skills/quarantine"
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

require_command() {
    local cmd=$1
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: Required command '$cmd' not found" >&2
        exit 1
    fi
}

is_protected() {
    local skill=$1
    local protected_skills=$2
    [[ " $protected_skills " =~ " $skill " ]] && return 0 || return 1
}

check_git_clean() {
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "ERROR: Git working tree is dirty. Please commit or stash changes first."
        echo ""
        echo "Dirty files:"
        git status --short | head -10
        echo ""
        echo "To proceed anyway (not recommended), use: $0 $SKILL_NAME --force-dirty"
        exit 1
    fi
}

# --- Validate arguments ---

if [[ $# -lt 1 ]]; then
    echo "Usage: skill-prune-delete.sh <skill-name> [--force] [--force-dirty]"
    echo ""
    echo "Deletes a quarantined skill's source folder."
    echo "Requires: skill was quarantined for >= delete_min_quarantine_days"
    echo ""
    echo "Options:"
    echo "  --force        Skip confirmation prompt"
    echo "  --force-dirty  Allow deletion with uncommitted changes (not recommended)"
    exit 1
fi

SKILL_NAME="$1"
FORCE_FLAG="${2:-}"
FORCE_DIRTY="${3:-}"

# Validate skill name format
if ! validate_skill_name "$SKILL_NAME"; then
    echo "ERROR: Invalid skill name '$SKILL_NAME'"
    echo "Allowed: alphanumeric, dots, underscores, hyphens only"
    exit 1
fi

# Require essential commands
require_command "jq"
require_command "git"

# Validate config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "ERROR: $CONFIG_FILE not found"
    exit 1
fi

# Load config
PROTECTED_SKILLS=$(jq -r '.protected_skills[]' "$CONFIG_FILE" 2>/dev/null | sort | tr '\n' ' ')
DELETE_MIN_QUARANTINE_DAYS=$(jq -r '.delete_min_quarantine_days' "$CONFIG_FILE" 2>/dev/null)

# --- Path safety validation ---

SOURCE_PATH="$SKILLS_CUSTOM_LEARNED_DIR/$SKILL_NAME"

# Verify source path is within learned skills directory
if ! [[ "$(cd "$SOURCE_PATH" 2>/dev/null && pwd)" == "$REPO_ROOT/$SKILLS_CUSTOM_LEARNED_DIR/$SKILL_NAME" ]]; then
    echo "ERROR: Source path resolution failed or outside safe scope"
    exit 1
fi

# --- Protect learned skills only ---

if is_protected "$SKILL_NAME" "$PROTECTED_SKILLS"; then
    echo "ERROR: Skill '$SKILL_NAME' is protected and cannot be deleted"
    exit 1
fi

if [[ ! -d "$SOURCE_PATH" ]]; then
    echo "ERROR: Source folder not found at $SOURCE_PATH"
    exit 1
fi

# --- Find quarantine manifest and check age ---

MANIFEST_FOUND=false
QUARANTINE_TIME=""
MANIFEST_PATH=""

# Use find instead of globstar (macOS Bash 3.2 compat)
while IFS= read -r manifest_file; do
    if grep -q "## $SKILL_NAME" "$manifest_file"; then
        MANIFEST_FOUND=true

        # Extract quarantine timestamp (portable: no grep -oP)
        QUARANTINE_TIME=$(awk -F': ' '/Quarantined at:/ {print $2; exit}' "$manifest_file" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        MANIFEST_PATH="$manifest_file"
        break
    fi
done < <(find "$QUARANTINE_DIR" -type f -name manifest.md 2>/dev/null || true)

if [[ "$MANIFEST_FOUND" != "true" ]]; then
    echo "ERROR: No quarantine manifest found for skill '$SKILL_NAME'"
    echo "Skill must be quarantined first (delete requires quarantine precedent)"
    exit 1
fi

# Verify manifest shows quarantined status
if ! grep -q "Status: quarantined" "$MANIFEST_PATH"; then
    echo "ERROR: Manifest does not show quarantined status"
    echo "File: $MANIFEST_PATH"
    exit 1
fi

# --- Check quarantine age ---

# Parse timestamp (portable: handle both formats)
QUARANTINE_EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$QUARANTINE_TIME" +%s 2>/dev/null || \
                    date -d "$QUARANTINE_TIME" +%s 2>/dev/null || echo "0")

if [[ "$QUARANTINE_EPOCH" == "0" ]]; then
    echo "ERROR: Could not parse quarantine timestamp: $QUARANTINE_TIME"
    exit 1
fi

CURRENT_EPOCH=$(date +%s)
QUARANTINE_AGE_SECONDS=$((CURRENT_EPOCH - QUARANTINE_EPOCH))
QUARANTINE_AGE_DAYS=$((QUARANTINE_AGE_SECONDS / 86400))

if [[ $QUARANTINE_AGE_DAYS -lt $DELETE_MIN_QUARANTINE_DAYS ]]; then
    echo "ERROR: Skill '$SKILL_NAME' was quarantined only $QUARANTINE_AGE_DAYS days ago"
    echo "Minimum quarantine age: $DELETE_MIN_QUARANTINE_DAYS days"
    exit 1
fi

# --- Check git status ---

if [[ "$FORCE_DIRTY" != "--force-dirty" ]]; then
    check_git_clean
fi

# --- Confirmation ---

echo "Delete Confirmation"
echo "=================="
echo ""
echo "Skill:          $SKILL_NAME"
echo "Source path:    $SOURCE_PATH"
echo "Quarantined:    $QUARANTINE_TIME ($QUARANTINE_AGE_DAYS days ago)"
echo "Manifest:       $MANIFEST_PATH"
echo ""
echo "Action:"
echo "  1. Delete source folder: $SOURCE_PATH"
echo "  2. Update manifest with deletion timestamp"
echo ""
echo "WARNING: This action is NOT reversible. Source files will be permanently deleted."
echo ""

if [[ "$FORCE_FLAG" != "--force" ]]; then
    read -p "Confirm deletion? (type 'delete $SKILL_NAME' to confirm): " confirm
    if [[ "$confirm" != "delete $SKILL_NAME" ]]; then
        echo "Deletion cancelled."
        exit 0
    fi
fi

# --- Delete ---

rm -rf "$SOURCE_PATH"

# --- Update manifest ---

{
    echo "- **Status:** deleted"
    echo "- **Deleted at:** $TIMESTAMP"
    echo "- **Deletion operator:** $(whoami)"
} >> "$MANIFEST_PATH"

# --- Output ---

echo ""
echo "✓ Skill deleted successfully"
echo ""
echo "Details:"
echo "  - Skill:      $SKILL_NAME"
echo "  - Deleted:    $SOURCE_PATH"
echo "  - Manifest:   $MANIFEST_PATH (updated)"
echo ""
echo "Manifest status: deleted"
