#!/bin/bash
# Dump recent entity changelog entries
# Usage: ./entity-changelog-dump.sh [lines]

set -euo pipefail

CHANGELOG_FILE="${BRAIN_RUNTIME_LOCAL:-runtime/local}/infinite-brain/entity-changelog.jsonl"
LINES="${1:-20}"

if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "Changelog not found: $CHANGELOG_FILE"
  exit 1
fi

echo "=== Entity Changelog (last $LINES entries) ==="
echo ""

tail -n "$LINES" "$CHANGELOG_FILE" | while read -r line; do
  # Parse JSON and format for readability
  timestamp=$(echo "$line" | jq -r '.timestamp')
  entity_id=$(echo "$line" | jq -r '.entityId')
  entity_type=$(echo "$line" | jq -r '.entityType')
  action=$(echo "$line" | jq -r '.action')
  author=$(echo "$line" | jq -r '.author')
  job=$(echo "$line" | jq -r '.sourceJob')
  summary=$(echo "$line" | jq -r '.diffSummary')

  printf "[%s] %s (%s) %s by %s from %s\n  → %s\n\n" \
    "$timestamp" "$entity_id" "$entity_type" "$action" "$author" "$job" "$summary"
done
