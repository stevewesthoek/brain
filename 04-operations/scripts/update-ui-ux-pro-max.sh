#!/usr/bin/env bash
set -euo pipefail

# Update UI/UX Pro Max data + scripts without touching custom skills.
# This syncs only the upstream catalog (data/) and helper scripts (scripts/).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL_DIR="$ROOT_DIR/01-ai/skills/ui-ux-pro-max"

if ! command -v uipro >/dev/null 2>&1; then
  echo "uipro CLI not found. Install with: npm install -g uipro-cli" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/uipro.XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pushd "$TMP_DIR" >/dev/null
uipro init --ai all
popd >/dev/null

SRC_DIR="$TMP_DIR/.codex/skills/ui-ux-pro-max"
if [ ! -d "$SRC_DIR/data" ] || [ ! -d "$SRC_DIR/scripts" ]; then
  echo "UI/UX Pro Max source not found in temp folder." >&2
  exit 1
fi

# Backup current data/scripts (if any)
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="$SKILL_DIR/.backup/$STAMP"
mkdir -p "$BACKUP_DIR"
if [ -d "$SKILL_DIR/data" ]; then
  rsync -a "$SKILL_DIR/data/" "$BACKUP_DIR/data/"
fi
if [ -d "$SKILL_DIR/scripts" ]; then
  rsync -a "$SKILL_DIR/scripts/" "$BACKUP_DIR/scripts/"
fi

# Sync upstream data + scripts
mkdir -p "$SKILL_DIR/data" "$SKILL_DIR/scripts"
rsync -a --delete "$SRC_DIR/data/" "$SKILL_DIR/data/"
rsync -a --delete "$SRC_DIR/scripts/" "$SKILL_DIR/scripts/"

# Clean Python cache if any
find "$SKILL_DIR/scripts" -type d -name "__pycache__" -prune -exec rm -rf {} +

echo "UI/UX Pro Max updated: data/ and scripts/ synced."
echo "Custom skills (web-design) and ui-ux-pro-max/SKILL.md were not touched."
