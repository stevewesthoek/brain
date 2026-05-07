#!/usr/bin/env bash
# mem-search — AI-agnostic memory search for the gstack memory system
# Usage:
#   mem-search                          list all entries (index)
#   mem-search <query>                  search index + files for keyword
#   mem-search --id <mem-id>            show full content of a memory file
#   mem-search --full <query>           show full content of all matches
#   mem-search --facts <keyword>        search structural facts
#
# Works with: Claude Code, Codex CLI, Gemini CLI (shell access)
# Dependencies: bash, grep, cat, find, cut (all standard)

set -euo pipefail

MEMORY_DIR="$HOME/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory"
MEMORY_INDEX="$MEMORY_DIR/MEMORY.md"
FACTS_FILE="$MEMORY_DIR/facts.jsonl"

case "${1:-}" in
  --facts)
    # Layer 2.5: Search structural facts
    keyword="${2:?Usage: mem-search --facts <keyword>}"
    if [ ! -f "$FACTS_FILE" ]; then
      echo "(facts store empty)"
      exit 0
    fi

    grep -i "$keyword" "$FACTS_FILE" 2>/dev/null | while IFS= read -r line; do
      # Only process lines where valid_to is null (active facts)
      if ! printf '%s' "$line" | grep -q '"valid_to":null'; then
        continue
      fi

      # Extract fields using grep+cut
      id=$(printf '%s' "$line" | grep -oE '"id":"([^"]*)"' | cut -d'"' -f4)
      entity=$(printf '%s' "$line" | grep -oE '"entity":"([^"]*)"' | cut -d'"' -f4)
      predicate=$(printf '%s' "$line" | grep -oE '"predicate":"([^"]*)"' | cut -d'"' -f4)
      object=$(printf '%s' "$line" | grep -oE '"object":"([^"]*)"' | cut -d'"' -f4)
      since=$(printf '%s' "$line" | grep -oE '"valid_from":"([^"]*)"' | cut -d'"' -f4)

      printf "  [%s] %s | %s | %s (since %s)\n" "$id" "$entity" "$predicate" "$object" "$since"
    done
    ;;

  --id)
    # Layer 3: Fetch full content by ID
    id="${2:?Usage: mem-search --id <mem-id>}"
    file=$(find "$MEMORY_DIR" -type f -name "*.md" 2>/dev/null | xargs grep -l "^id: $id" 2>/dev/null | head -1)
    if [ -n "$file" ]; then
      cat "$file"
    else
      echo "Not found: $id" >&2
      exit 1
    fi
    ;;

  --full)
    # Layer 3+: Show full content of all matches
    shift
    found=0
    find "$MEMORY_DIR" -type f -name "*.md" 2>/dev/null | while read -r f; do
      if grep -qi "$*" "$f" 2>/dev/null; then
        found=1
        echo "=== $(basename "$f") ==="
        cat "$f"
        echo ""
      fi
    done
    [ "$found" -eq 0 ] && echo "No matches for: $*" >&2 && exit 1
    ;;

  "")
    # Layer 1: List index with IDs
    if [ -f "$MEMORY_INDEX" ]; then
      grep -E '^\- \[mem-' "$MEMORY_INDEX" 2>/dev/null || cat "$MEMORY_INDEX" 2>/dev/null
    else
      echo "Memory index not found at: $MEMORY_INDEX" >&2
      echo "Run 'mem-search --init' to set up the memory system." >&2
      exit 1
    fi
    ;;

  *)
    # Layer 2: Keyword search — show index matches + file matches with IDs
    query="$*"
    echo "--- Index matches ---"
    if grep -i "$query" "$MEMORY_INDEX" 2>/dev/null; then
      :
    else
      echo "(none)"
    fi

    echo ""
    echo "--- File matches ---"
    found=0
    find "$MEMORY_DIR" -type f -name "*.md" 2>/dev/null | while read -r f; do
      if grep -qi "$query" "$f" 2>/dev/null; then
        found=1
        id=$(grep -m1 "^id:" "$f" 2>/dev/null | awk -F': ' '{print $2}' || echo "?")
        name=$(grep -m1 "^name:" "$f" 2>/dev/null | awk -F': ' '{print $2}' || echo "$(basename "$f")")
        echo "  [$id] $name"
      fi
    done
    if [ "$found" -eq 0 ]; then
      echo "(none)"
    fi
    ;;
esac
