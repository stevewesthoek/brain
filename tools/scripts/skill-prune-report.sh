#!/bin/bash
# skill-prune-report.sh — Production-grade REPORT mode (output-only, never destructive)
# Monthly scheduler: runs REPORT only, generates candidate reports, never modifies files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONFIG_FILE="ai/skills/prune-config.json"
SKILLS_ACTIVE_DIR="ai/skills/active"
SKILLS_CUSTOM_LEARNED_DIR="ai/skills/custom/learned"
REPORT_OUTPUT_DIR="runtime/local/skill-prune"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIMESTAMP_FILE=$(date -u +"%Y-%m-%d-%H%M%S")

# Validate config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "ERROR: $CONFIG_FILE not found" >&2
    exit 1
fi

# Validate active skills dir exists
if [[ ! -d "$SKILLS_ACTIVE_DIR" ]]; then
    echo "ERROR: $SKILLS_ACTIVE_DIR not found" >&2
    exit 1
fi

# Create report output directory
mkdir -p "$REPORT_OUTPUT_DIR"

# Load config (using jq)
PROTECTED_SKILLS=$(jq -r '.protected_skills[]' "$CONFIG_FILE" 2>/dev/null | sort | tr '\n' ' ' || true)
PROTECTED_CATEGORIES=$(jq -r '.protected_categories[]' "$CONFIG_FILE" 2>/dev/null | tr '\n' '|' | sed 's/|$//' || true)
STALE_THRESHOLD_DAYS=${SKILL_PRUNE_STALE_DAYS:-180}
CUTOFF_TIME=$(date -v-"${STALE_THRESHOLD_DAYS}"d +%s 2>/dev/null || date -d "-${STALE_THRESHOLD_DAYS} days" +%s 2>/dev/null || echo "0")

# Initialize tracking
ACTIVE_SKILLS=()
PROTECTED_SKILLS_FOUND=()
CANDIDATES=()

# --- Helper functions ---

is_protected() {
    local skill=$1
    [[ " $PROTECTED_SKILLS " =~ " $skill " ]] && return 0 || return 1
}

is_protected_category() {
    local category=$1
    [[ -n "$PROTECTED_CATEGORIES" ]] && [[ "$category" =~ ^($PROTECTED_CATEGORIES)$ ]] && return 0 || return 1
}

is_stale() {
    local skill=$1
    local skill_path="$SKILLS_CUSTOM_LEARNED_DIR/$skill/SKILL.md"

    if [[ ! -f "$skill_path" ]]; then
        return 1
    fi

    local mtime=$(stat -f "%m" "$skill_path" 2>/dev/null || echo "$CUTOFF_TIME")
    [[ "$mtime" -lt "$CUTOFF_TIME" ]] && return 0 || return 1
}

# --- Inventory active skills ---

for skill_symlink in "$SKILLS_ACTIVE_DIR"/*; do
    [[ ! -L "$skill_symlink" ]] && continue
    skill_name=$(basename "$skill_symlink")
    ACTIVE_SKILLS+=("$skill_name")

    if is_protected "$skill_name"; then
        PROTECTED_SKILLS_FOUND+=("$skill_name")
    fi
done

# --- Find candidates ---

for skill in "${ACTIVE_SKILLS[@]}"; do
    skill_path="$SKILLS_CUSTOM_LEARNED_DIR/$skill"

    # Only check learned skills
    if [[ ! -d "$skill_path" ]]; then
        continue
    fi

    # Skip if protected
    if is_protected "$skill"; then
        continue
    fi

    # Check staleness
    if is_stale "$skill"; then
        CANDIDATES+=("$skill")
    fi
done

# --- Generate reports ---

# Markdown report
{
    echo "# Skill Prune Report — $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo ""
    echo "## Summary"
    echo ""
    echo "- **Active skills:** ${#ACTIVE_SKILLS[@]}"
    echo "- **Protected skills:** ${#PROTECTED_SKILLS_FOUND[@]}"
    echo "- **Candidates for action:** ${#CANDIDATES[@]}"
    echo "- **Stale threshold:** ${STALE_THRESHOLD_DAYS} days"
    echo ""

    if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
        echo "## Status"
        echo ""
        echo "✓ No candidates for action. All active skills are either protected or recently updated."
        echo ""
    else
        echo "## Candidates for Quarantine"
        echo ""
        echo "| Skill | Status |"
        echo "|-------|--------|"
        for skill in "${CANDIDATES[@]}"; do
            echo "| $skill | Stale (>$STALE_THRESHOLD_DAYS days) |"
        done
        echo ""
    fi

    echo "## Protected Skills (${#PROTECTED_SKILLS_FOUND[@]})"
    echo ""
    for ps in $PROTECTED_SKILLS; do
        [[ -z "$ps" ]] && continue
        echo "- $ps"
    done | sort
} > "$REPORT_OUTPUT_DIR/latest.md"

# JSON report
{
    echo "{"
    echo "  \"generated_at\": \"$TIMESTAMP\","
    echo "  \"mode\": \"report\","
    echo "  \"repo\": \"brain\","
    echo "  \"summary\": {"
    echo "    \"active_count\": ${#ACTIVE_SKILLS[@]},"
    echo "    \"protected_count\": ${#PROTECTED_SKILLS_FOUND[@]},"
    echo "    \"candidates_total\": ${#CANDIDATES[@]}"
    echo "  },"
    echo "  \"candidates\": ["

    for i in "${!CANDIDATES[@]}"; do
        skill="${CANDIDATES[$i]}"
        [[ $i -gt 0 ]] && echo "    },"
        echo "    {"
        echo "      \"skill\": \"$skill\","
        echo "      \"finding\": \"Stale >$STALE_THRESHOLD_DAYS days\","
        echo "      \"recommendation\": \"quarantine\""
        if [[ $i -eq $((${#CANDIDATES[@]} - 1)) ]]; then
            echo "    }"
        fi
    done

    echo "  ]"
    echo "}"
} > "$REPORT_OUTPUT_DIR/latest.json"

# Optional: Timestamped archive copies
cp "$REPORT_OUTPUT_DIR/latest.md" "$REPORT_OUTPUT_DIR/${TIMESTAMP_FILE}.md" 2>/dev/null || true
cp "$REPORT_OUTPUT_DIR/latest.json" "$REPORT_OUTPUT_DIR/${TIMESTAMP_FILE}.json" 2>/dev/null || true

# --- Optional: Send email via GWS Gmail ---

if [[ "${SKILL_PRUNE_EMAIL_ENABLED:-0}" == "1" ]]; then
    EMAIL_TO="${SKILL_PRUNE_EMAIL_TO:-}"
    GWS_BIN="${GWS_BIN:-gws}"

    if [[ -z "$EMAIL_TO" ]]; then
        echo "WARNING: SKILL_PRUNE_EMAIL_ENABLED=1 but SKILL_PRUNE_EMAIL_TO not set" >&2
    elif ! command -v "$GWS_BIN" &>/dev/null; then
        echo "WARNING: GWS not found at $GWS_BIN (email not sent)" >&2
    else
        # Prepare email body (base64 encoded for Gmail API)
        SUBJECT="Skill Prune Report — $(date -u +"%B %Y")"
        BODY_TEXT=$(cat "$REPORT_OUTPUT_DIR/latest.md")

        # Create RFC 2822 format email
        EMAIL_MSG=$(cat <<EMAILEOF
From: me
To: $EMAIL_TO
Subject: $SUBJECT
Content-Type: text/plain; charset="UTF-8"

$BODY_TEXT
EMAILEOF
)

        # Encode to base64 URL-safe (for Gmail raw format)
        EMAIL_B64=$(echo -n "$EMAIL_MSG" | base64 | tr '+/' '-_' | tr -d '=')

        # Send via GWS Gmail API
        if "$GWS_BIN" gmail users messages send --params "{\"userId\": \"me\", \"body\": {\"raw\": \"$EMAIL_B64\"}}" 2>&1 | grep -q '"id"'; then
            echo "✓ Email sent to $EMAIL_TO"
        else
            echo "WARNING: Failed to send email via GWS Gmail (requires 'gws auth login')" >&2
        fi
    fi
fi

# --- Output summary ---
echo "✓ Skill prune report generated"
echo "  - Markdown: $REPORT_OUTPUT_DIR/latest.md"
echo "  - JSON:     $REPORT_OUTPUT_DIR/latest.json"
echo ""
echo "Summary:"
echo "  - Active skills: ${#ACTIVE_SKILLS[@]}"
echo "  - Protected: ${#PROTECTED_SKILLS_FOUND[@]}"
echo "  - Candidates: ${#CANDIDATES[@]}"
echo ""
echo "Mode: REPORT (no files modified)"
