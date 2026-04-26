#!/bin/bash
# skill-prune-delete.sh — Manual DELETE mode (requires quarantine precedent + age threshold)
# Deletes source folder only after quarantine age threshold is met
# Quarantine manifest must exist and show prior quarantine
# Requires explicit user approval

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG_FILE="ai/skills/prune-config.json"
SKILLS_CUSTOM_LEARNED_DIR="ai/skills/custom/learned"
QUARANTINE_DIR="ai/skills/quarantine"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Validate arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: skill-prune-delete.sh <skill-name> [--force]"
    echo ""
    echo "Deletes a quarantined skill's source folder."
    echo "Requires: skill was quarantined for >= delete_min_quarantine_days"
    echo ""
    echo "Options:"
    echo "  --force   Skip confirmation prompt"
    exit 1
fi

SKILL_NAME="$1"
FORCE_FLAG="${2:-}"

# Validate config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "ERROR: $CONFIG_FILE not found"
    exit 1
fi

# Load config
PROTECTED_SKILLS=$(jq -r '.protected_skills[]' "$CONFIG_FILE" 2>/dev/null | sort | tr '\n' ' ')
DELETE_MIN_QUARANTINE_DAYS=$(jq -r '.delete_min_quarantine_days' "$CONFIG_FILE" 2>/dev/null)

# Helper: check if skill is protected
is_protected() {
    local skill=$1
    [[ " $PROTECTED_SKILLS " =~ " $skill " ]] && return 0 || return 1
}

# --- Validation ---

if is_protected "$SKILL_NAME"; then
    echo "ERROR: Skill '$SKILL_NAME' is protected and cannot be deleted"
    exit 1
fi

SOURCE_PATH="$SKILLS_CUSTOM_LEARNED_DIR/$SKILL_NAME"

if [[ ! -d "$SOURCE_PATH" ]]; then
    echo "ERROR: Source folder not found at $SOURCE_PATH"
    exit 1
fi

# Find quarantine manifest and check age
MANIFEST_FOUND=false
QUARANTINE_TIME=""

for manifest_file in "$QUARANTINE_DIR"/**/manifest.md; do
    [[ ! -f "$manifest_file" ]] && continue

    if grep -q "## $SKILL_NAME" "$manifest_file"; then
        MANIFEST_FOUND=true

        # Extract quarantine timestamp
        QUARANTINE_TIME=$(grep -oP '(?<=Quarantined at: )[^ ]+' "$manifest_file" | head -1)
        MANIFEST_PATH="$manifest_file"
        break
    fi
done

if [[ "$MANIFEST_FOUND" != "true" ]]; then
    echo "ERROR: No quarantine manifest found for skill '$SKILL_NAME'"
    echo "Skill must be quarantined first (delete requires quarantine precedent)"
    exit 1
fi

# Check quarantine age
QUARANTINE_EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$QUARANTINE_TIME" +%s 2>/dev/null || echo "0")
CURRENT_EPOCH=$(date +%s)
QUARANTINE_AGE_SECONDS=$((CURRENT_EPOCH - QUARANTINE_EPOCH))
QUARANTINE_AGE_DAYS=$((QUARANTINE_AGE_SECONDS / 86400))

if [[ $QUARANTINE_AGE_DAYS -lt $DELETE_MIN_QUARANTINE_DAYS ]]; then
    echo "ERROR: Skill '$SKILL_NAME' was quarantined only $QUARANTINE_AGE_DAYS days ago"
    echo "Minimum quarantine age: $DELETE_MIN_QUARANTINE_DAYS days"
    echo "Can delete on: $(date -v+$((DELETE_MIN_QUARANTINE_DAYS - QUARANTINE_AGE_DAYS))d +"%Y-%m-%d")"
    exit 1
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
