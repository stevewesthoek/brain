#!/usr/bin/env bash
# mind-compile-loop.sh — Suggest-only inbox classification for the Mind wiki
#
# Run nightly by office-nightly-scheduler.sh.
#
# Reads inbox/new/, classifies each file by its frontmatter and content,
# and appends proposed actions to wiki/log.md. Does NOT move, rename, or
# modify any files. Human reviews and approves from wiki/log.md.
#
# Phase: Suggest-only (Phase 1). No file moves until explicitly approved.
# Future Phase 2: implement approved moves after review workflow is stable.
#
# Classification logic (frontmatter + heuristics):
#   para_type=project   → propose move to live/projects/
#   para_type=task      → propose add to live/tasks.md
#   para_type=area      → propose move to wiki/areas/
#   para_type=resource  → propose move to sources/research/
#   type=decision       → propose move to live/decisions.md
#   anything else       → propose move to wiki/ (general knowledge)
#
# Skip README.md and files that already have a compiled: true frontmatter field.

set -euo pipefail

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
WIKI_LOG="${MIND_DIR}/wiki/log.md"

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

# Collect proposed actions to append in one block
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

  # Classify → proposed destination
  proposed_dest=""
  action_note=""

  case "$para_type" in
    project)
      slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed 's/^-//;s/-$//')
      proposed_dest="live/projects/${slug}.md"
      action_note="new project page"
      ;;
    task)
      proposed_dest="live/tasks.md (append as task item)"
      action_note="new task"
      ;;
    area)
      slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed 's/^-//;s/-$//')
      proposed_dest="wiki/areas/${slug}.md"
      action_note="new area note"
      ;;
    resource|reference)
      slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed 's/^-//;s/-$//')
      proposed_dest="resources/research/${slug}.md"
      action_note="new research note"
      ;;
    *)
      # Fall back to file_type
      case "$file_type" in
        decision)
          proposed_dest="live/decisions.md (append)"
          action_note="new decision"
          ;;
        capture|"")
          # Generic capture — goes to wiki as a knowledge note
          slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed 's/^-//;s/-$//')
          proposed_dest="wiki/${slug}.md"
          action_note="general knowledge note"
          ;;
        *)
          slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed 's/^-//;s/-$//')
          proposed_dest="wiki/${slug}.md"
          action_note="unclassified → wiki"
          ;;
      esac
      ;;
  esac

  proposals="${proposals}
- ${today} — compile-suggest — **${title}** (${action_note}, confidence=${confidence}, src=${source}) → propose move \`inbox/${filename}\` → \`${proposed_dest}\` — created ${created}"
  proposed=$((proposed + 1))

done < <(find "$INBOX_DIR" -maxdepth 1 -name "*.md" -print0 2>/dev/null)

# Only write to log if there are proposals
if [[ -z "$proposals" ]] || [[ "$proposed" -eq 0 ]]; then
  echo "mind-compile-loop: no new inbox files to process (total=$total skipped=$skipped)"
  exit 0
fi

# Append proposals to wiki/log.md
if [[ ! -f "$WIKI_LOG" ]]; then
  echo "Wiki log not found: $WIKI_LOG — skipping write" >&2
  exit 1
fi

{
  echo ""
  echo "<!-- mind-compile-loop run: ${today} | processed=${proposed} skipped=${skipped} total=${total} -->"
  printf '%s\n' "$proposals"
} >> "$WIKI_LOG"

echo "mind-compile-loop: proposed=${proposed} skipped=${skipped} total=${total} → appended to wiki/log.md"
