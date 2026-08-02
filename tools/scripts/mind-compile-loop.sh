#!/usr/bin/env bash
# mind-compile-loop.sh — Report-only inbox classification for Mind
#
# Run nightly by office-nightly-scheduler.sh.
#
# Reads inbox/new/, classifies each file by its frontmatter and content, and
# prints proposals to stdout. It does not move, rename, append, or otherwise
# modify Mind. Destination selection remains deferred to the path registry.
#
# Phase: report-only containment. No write mode is provided by this script.
#
# Classification logic (frontmatter + heuristics) assigns a proposal category
# only. It intentionally does not calculate a filesystem destination.
#
# Skip README.md and files that already have a compiled: true frontmatter field.

set -euo pipefail

MODE="report-only"
case "$#" in
  0)
    ;;
  1)
    if [[ "$1" != "--mode=report-only" ]]; then
      echo "usage: $0 [--mode=report-only]" >&2
      exit 64
    fi
    ;;
  2)
    if [[ "$1" != "--mode" || "$2" != "report-only" ]]; then
      echo "usage: $0 [--mode=report-only]" >&2
      exit 64
    fi
    ;;
  *)
    echo "usage: $0 [--mode=report-only]" >&2
    exit 64
    ;;
esac

resolve_inbox_dir() {
  local mind_dir="$1"
  if [[ -d "${mind_dir}/inbox/new" ]]; then
    printf '%s\n' "${mind_dir}/inbox/new"
    return 0
  fi
  # No fallback to capture/inbox; retired after Batch 8W cleanup (2026-07-09)
  printf '%s\n' "unavailable"
  return 1
}

MIND_DIR="${MIND_DIR:-$HOME/Repos/stevewesthoek/mind}"
INBOX_DIR="$(resolve_inbox_dir "$MIND_DIR")"

if [[ ! -d "$INBOX_DIR" ]] || [[ "$INBOX_DIR" == "unavailable" ]]; then
  echo "Inbox not found (expected inbox/new): $MIND_DIR"
  exit 0
fi

# Count files to process (excluding README.md and already-compiled)
total=0
proposed=0
skipped=0
errors=0

today="$(date +%Y-%m-%d)"

# Collect a report-only proposal block.
proposals=""

while IFS= read -r -d '' file; do
  filename="$(basename "$file")"

  # Skip README.md
  if [[ "$filename" == "README.md" ]]; then
    continue
  fi

  total=$((total + 1))

  # Skip if already marked compiled
  if grep -q "^compiled:" "$file" 2>/dev/null; then
    skipped=$((skipped + 1))
    continue
  fi

  # Extract frontmatter fields
  para_type=$(grep -m1 "^para_type:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | tr -d '"' | xargs || echo "")
  file_type=$(grep -m1 "^type:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | tr -d '"' | xargs || echo "")
  title=$(grep -m1 "^title:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | tr -d '"' | xargs || echo "$filename")
  source=$(grep -m1 "^source:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | tr -d '"' | xargs || echo "inbox")
  created=$(grep -m1 "^created:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | xargs || echo "unknown")
  confidence=$(grep -m1 "^confidence:" "$file" 2>/dev/null | awk -F': ' '{print $2}' | xargs || echo "?")

  # Classify → proposal category. Destination assignment is deliberately
  # deferred until the canonical path registry governs this workflow.
  action_note=""

  case "$para_type" in
    project)
      action_note="new project page"
      ;;
    task)
      action_note="new task"
      ;;
    area)
      action_note="new area note"
      ;;
    resource|reference)
      action_note="new research note"
      ;;
    *)
      # Fall back to file_type
      case "$file_type" in
        decision)
          action_note="new decision"
          ;;
        capture|"")
          action_note="general knowledge note"
          ;;
        *)
          action_note="unclassified"
          ;;
      esac
      ;;
  esac

  proposals="${proposals}
- ${today} — compile-suggest — **${title}** (${action_note}, confidence=${confidence}, src=${source}) — source \`inbox/new/${filename}\` — created ${created} — destination unresolved"
  proposed=$((proposed + 1))

done < <(find "$INBOX_DIR" -maxdepth 1 -name "*.md" -print0 2>/dev/null)

# Only write to log if there are proposals
if [[ -z "$proposals" ]] || [[ "$proposed" -eq 0 ]]; then
  echo "mind-compile-loop: no new inbox files to process (total=$total skipped=$skipped)"
  exit 0
fi

echo "<!-- mind-compile-loop mode=${MODE} | ${today} | processed=${proposed} skipped=${skipped} total=${total} -->"
printf '%s\n' "$proposals"
echo "mind-compile-loop: mode=${MODE} proposed=${proposed} skipped=${skipped} total=${total} (no Mind writes)"
