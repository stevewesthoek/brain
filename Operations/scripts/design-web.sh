#!/usr/bin/env bash
set -euo pipefail

# One-liner wrapper to generate a UI/UX Pro Max design system
# and persist it for use by the web-design skill.
#
# Usage:
#   bash Operations/scripts/design-web.sh "<query>" "<Project Name>" [page]
# Example:
#   bash Operations/scripts/design-web.sh "brutalism landing page for fintech" "Fintech SaaS" landing

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL_ROOT="$ROOT_DIR/AI/skills/ui-ux-pro-max"
QUERY="${1:-}"
PROJECT="${2:-Default}"
PAGE="${3:-}"  # optional

if [ -z "$QUERY" ]; then
  echo "Missing query. Example:" >&2
  echo "  bash Operations/scripts/design-web.sh \"brutalism landing page for fintech\" \"Fintech SaaS\" landing" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3.x first." >&2
  exit 1
fi

if [ ! -d "$SKILL_ROOT/data" ] || [ ! -d "$SKILL_ROOT/scripts" ]; then
  echo "UI/UX Pro Max data/scripts not found. Run:" >&2
  echo "  bash Operations/scripts/update-ui-ux-pro-max.sh" >&2
  exit 1
fi

CMD=(python3 "$SKILL_ROOT/scripts/search.py" "$QUERY" --design-system --persist -p "$PROJECT")
if [ -n "$PAGE" ]; then
  CMD+=(--page "$PAGE")
fi

"${CMD[@]}"

PROJECT_SLUG=$(echo "$PROJECT" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

cat <<EOF2

Next step:
- Use the web-design skill and apply the design system from:
  design-system/${PROJECT_SLUG}/MASTER.md
EOF2
