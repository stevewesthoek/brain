#!/bin/bash
# skill-prune-quarantine.sh — Manual QUARANTINE mode (requires confirmation, symlink-only)
# Disables a skill by moving its active symlink to quarantine
# Source folder is PRESERVED for recovery
# Requires explicit user approval

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG_FILE="ai/skills/prune-config.json"
SKILLS_ACTIVE_DIR="ai/skills/active"
SKILLS_CUSTOM_LEARNED_DIR="ai/skills/custom/learned"
QUARANTINE_DIR="ai/skills/quarantine"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MONTH_DIR=$(date -u +"%Y-%m")

# Validate arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: skill-prune-quarantine.sh <skill-name> [--force]"
    echo ""
    echo "Quarantines a skill by moving its active symlink."
    echo "Source folder is preserved in $SKILLS_CUSTOM_LEARNED_DIR/"
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
QUARANTINE_REQUIRES_CONFIRMATION=$(jq -r '.quarantine_requires_confirmation' "$CONFIG_FILE" 2>/dev/null)

# Helper: check if skill is protected
is_protected() {
    local skill=$1
    [[ " $PROTECTED_SKILLS " =~ " $skill " ]] && return 0 || return 1
}

# --- Validation ---

if is_protected "$SKILL_NAME"; then
    echo "ERROR: Skill '$SKILL_NAME' is protected and cannot be quarantined"
    echo "Protected skills are intentional and exempt from pruning."
    exit 1
fi

ACTIVE_SYMLINK="$SKILLS_ACTIVE_DIR/$SKILL_NAME"

if [[ ! -L "$ACTIVE_SYMLINK" ]]; then
    echo "ERROR: Skill '$SKILL_NAME' is not an active symlink at $ACTIVE_SYMLINK"
    exit 1
fi

SYMLINK_TARGET=$(readlink "$ACTIVE_SYMLINK")

# Determine source type (custom-learned, vendor, etc)
if [[ "$SYMLINK_TARGET" == ../custom/learned/* ]]; then
    SOURCE_TYPE="custom-learned"
    SOURCE_PATH="$SKILLS_CUSTOM_LEARNED_DIR/$SKILL_NAME"
elif [[ "$SYMLINK_TARGET" == ../vendors/* ]]; then
    SOURCE_TYPE="vendor"
    SOURCE_PATH="ai/skills/$SYMLINK_TARGET"
else
    SOURCE_TYPE="unknown"
    SOURCE_PATH="$SYMLINK_TARGET"
fi

if [[ ! -d "$SOURCE_PATH" ]]; then
    echo "ERROR: Source folder not found at $SOURCE_PATH"
    exit 1
fi

# --- Confirmation ---

if [[ "$QUARANTINE_REQUIRES_CONFIRMATION" == "true" && "$FORCE_FLAG" != "--force" ]]; then
    echo "Quarantine Confirmation"
    echo "======================"
    echo ""
    echo "Skill:         $SKILL_NAME"
    echo "Active link:   $ACTIVE_SYMLINK"
    echo "Target:        $SYMLINK_TARGET"
    echo "Source type:   $SOURCE_TYPE"
    echo "Source path:   $SOURCE_PATH"
    echo ""
    echo "Action:"
    echo "  1. Move symlink: $ACTIVE_SYMLINK → $QUARANTINE_DIR/$MONTH_DIR/$SKILL_NAME.symlink"
    echo "  2. Create manifest: $QUARANTINE_DIR/$MONTH_DIR/manifest.md"
    echo "  3. Source folder PRESERVED at: $SOURCE_PATH"
    echo ""
    read -p "Confirm quarantine? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "Quarantine cancelled."
        exit 0
    fi
fi

# --- Quarantine ---

mkdir -p "$QUARANTINE_DIR/$MONTH_DIR"

# Move symlink to quarantine
mv "$ACTIVE_SYMLINK" "$QUARANTINE_DIR/$MONTH_DIR/$SKILL_NAME.symlink"

# --- Write manifest ---

MANIFEST_FILE="$QUARANTINE_DIR/$MONTH_DIR/manifest.md"

# Append to or create manifest
{
    echo "# Quarantine Manifest — $MONTH_DIR"
    echo ""
    if [[ -f "$MANIFEST_FILE" ]]; then
        tail -n +2 "$MANIFEST_FILE"  # Skip header if already exists
    fi
    echo ""
    echo "## $SKILL_NAME"
    echo ""
    echo "- **Quarantined at:** $TIMESTAMP"
    echo "- **Operator:** $(whoami)"
    echo "- **Skill name:** $SKILL_NAME"
    echo "- **Active symlink moved:** $ACTIVE_SYMLINK → $QUARANTINE_DIR/$MONTH_DIR/$SKILL_NAME.symlink"
    echo "- **Symlink target:** $SYMLINK_TARGET"
    echo "- **Reason:** Manual quarantine"
    echo "- **Risk:** low"
    echo "- **Source folder:** $SOURCE_PATH (PRESERVED)"
    echo "- **Source type:** $SOURCE_TYPE"
    echo ""
    echo "### Recovery"
    echo ""
    if [[ "$SOURCE_TYPE" == "vendor" ]]; then
        echo "Vendor skill recovery:"
        echo ""
        echo "\`\`\`bash"
        echo "ln -s $SYMLINK_TARGET $ACTIVE_SYMLINK"
        echo "\`\`\`"
    else
        echo "Custom skill recovery:"
        echo ""
        echo "\`\`\`bash"
        echo "ln -s ../custom/learned/$SKILL_NAME $ACTIVE_SYMLINK"
        echo "\`\`\`"
    fi
    echo ""
    echo "- **Status:** quarantined"
} > "$MANIFEST_FILE"

# --- Output ---

echo "✓ Skill quarantined successfully"
echo ""
echo "Details:"
echo "  - Skill:      $SKILL_NAME"
echo "  - Symlink:    moved to $QUARANTINE_DIR/$MONTH_DIR/$SKILL_NAME.symlink"
echo "  - Manifest:   $MANIFEST_FILE"
echo "  - Source:     preserved at $SOURCE_PATH"
echo ""
echo "Recovery (if needed):"
if [[ "$SOURCE_TYPE" == "vendor" ]]; then
    echo "  ln -s $SYMLINK_TARGET $ACTIVE_SYMLINK"
else
    echo "  ln -s ../custom/learned/$SKILL_NAME $ACTIVE_SYMLINK"
fi
