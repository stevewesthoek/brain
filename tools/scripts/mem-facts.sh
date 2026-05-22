#!/usr/bin/env bash
# mem-facts.sh — Structured facts manager for the memory orchestrator
# Append-only JSONL-based entity-predicate-object fact store
# Usage:
#   mem-facts add <entity> <predicate> <object> [--since YYYY-MM-DD] [--source ID]
#   mem-facts list [entity]
#   mem-facts search <keyword>
#   mem-facts invalidate <fact-id>

set -euo pipefail

MEMORY_DIR="${BRAIN_MEMORY_DIR:-$HOME/.brain/memory}"
FACTS_FILE="${MEMORY_DIR}/facts.jsonl"

mkdir -p "$MEMORY_DIR"

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in

  add)
    entity="${1:?Usage: mem-facts add <entity> <predicate> <object> [--since YYYY-MM-DD] [--source ID]}"
    predicate="${2:?}"
    object="${3:?}"

    # Parse optional flags
    since=""
    source="session"
    while [ $# -gt 0 ]; do
      case "$1" in
        --since)
          since="${2:?}"
          shift 2
          ;;
        --source)
          source="${2:?}"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done

    # Determine ID: line count + 1, zero-padded 3 digits
    if [ ! -f "$FACTS_FILE" ]; then
      id="fact-001"
    else
      count=$(wc -l < "$FACTS_FILE" | tr -d ' ')
      id=$(printf "fact-%03d" $((count + 1)))
    fi

    # Use provided date or today
    if [ -z "$since" ]; then
      since=$(date +%Y-%m-%d)
    fi

    # Escape quotes in values (simple: double any existing double-quotes)
    entity=$(printf '%s' "$entity" | sed 's/"/""/g')
    predicate=$(printf '%s' "$predicate" | sed 's/"/""/g')
    object=$(printf '%s' "$object" | sed 's/"/""/g')
    source=$(printf '%s' "$source" | sed 's/"/""/g')

    # Construct and append JSON line
    json="{\"id\":\"${id}\",\"entity\":\"${entity}\",\"predicate\":\"${predicate}\",\"object\":\"${object}\",\"valid_from\":\"${since}\",\"valid_to\":null,\"source\":\"${source}\"}"
    echo "$json" >> "$FACTS_FILE"

    echo "Added $id: $entity | $predicate | $object"
    ;;

  list)
    entity_filter="${1:-}"

    if [ ! -f "$FACTS_FILE" ]; then
      echo "(no facts stored yet)"
      exit 0
    fi

    found=0
    while IFS= read -r line; do
      # Only process lines where valid_to is null
      if ! printf '%s' "$line" | grep -q '"valid_to":null'; then
        continue
      fi

      # Extract fields using grep+cut
      id=$(printf '%s' "$line" | grep -oE '"id":"([^"]*)"' | cut -d'"' -f4)
      entity=$(printf '%s' "$line" | grep -oE '"entity":"([^"]*)"' | cut -d'"' -f4)
      predicate=$(printf '%s' "$line" | grep -oE '"predicate":"([^"]*)"' | cut -d'"' -f4)
      object=$(printf '%s' "$line" | grep -oE '"object":"([^"]*)"' | cut -d'"' -f4)
      valid_from=$(printf '%s' "$line" | grep -oE '"valid_from":"([^"]*)"' | cut -d'"' -f4)
      source=$(printf '%s' "$line" | grep -oE '"source":"([^"]*)"' | cut -d'"' -f4)

      # Filter by entity if provided
      if [ -n "$entity_filter" ] && [ "$entity" != "$entity_filter" ]; then
        continue
      fi

      printf "  [%s] %s | %s | %s (since %s, src: %s)\n" "$id" "$entity" "$predicate" "$object" "$valid_from" "$source"
      found=1
    done < "$FACTS_FILE"

    if [ $found -eq 0 ]; then
      if [ -n "$entity_filter" ]; then
        echo "(no facts found for entity: $entity_filter)"
      else
        echo "(no active facts)"
      fi
    fi
    ;;

  search)
    keyword="${1:?Usage: mem-facts search <keyword>}"

    if [ ! -f "$FACTS_FILE" ]; then
      echo "(facts store empty)"
      exit 0
    fi

    found=0
    grep -i "$keyword" "$FACTS_FILE" 2>/dev/null | while IFS= read -r line; do
      # Only process lines where valid_to is null
      if ! printf '%s' "$line" | grep -q '"valid_to":null'; then
        continue
      fi

      # Extract fields
      id=$(printf '%s' "$line" | grep -oE '"id":"([^"]*)"' | cut -d'"' -f4)
      entity=$(printf '%s' "$line" | grep -oE '"entity":"([^"]*)"' | cut -d'"' -f4)
      predicate=$(printf '%s' "$line" | grep -oE '"predicate":"([^"]*)"' | cut -d'"' -f4)
      object=$(printf '%s' "$line" | grep -oE '"object":"([^"]*)"' | cut -d'"' -f4)
      valid_from=$(printf '%s' "$line" | grep -oE '"valid_from":"([^"]*)"' | cut -d'"' -f4)
      source=$(printf '%s' "$line" | grep -oE '"source":"([^"]*)"' | cut -d'"' -f4)

      printf "  [%s] %s | %s | %s (since %s, src: %s)\n" "$id" "$entity" "$predicate" "$object" "$valid_from" "$source"
      found=1
    done

    if [ $found -eq 0 ]; then
      echo "No facts matching: $keyword"
    fi
    ;;

  invalidate)
    fact_id="${1:?Usage: mem-facts invalidate <fact-id>}"

    if [ ! -f "$FACTS_FILE" ]; then
      echo "Error: facts store not found" >&2
      exit 1
    fi

    # Find the line and create invalidated copy
    found=0
    while IFS= read -r line; do
      id=$(printf '%s' "$line" | grep -oE '"id":"([^"]*)"' | cut -d'"' -f4 || true)
      if [ "$id" = "$fact_id" ]; then
        # Replace valid_to:null with valid_to:DATE
        today=$(date +%Y-%m-%d)
        invalidated=$(printf '%s' "$line" | sed "s/\"valid_to\":null/\"valid_to\":\"${today}\"/")
        echo "$invalidated" >> "$FACTS_FILE"
        echo "Invalidated $fact_id (valid_to: $today)"
        found=1
        break
      fi
    done < "$FACTS_FILE"

    if [ $found -eq 0 ]; then
      echo "Error: fact not found: $fact_id" >&2
      exit 1
    fi
    ;;

  help|--help|-h)
    cat <<'EOF'
mem-facts — Structured facts manager

Commands:
  add <entity> <predicate> <object>     Add a fact
    [--since YYYY-MM-DD]                Set valid_from date (default: today)
    [--source ID]                       Set source (default: session)

  list [entity]                         List all active facts (optionally filtered by entity)

  search <keyword>                      Search facts by keyword

  invalidate <fact-id>                  Mark a fact as no longer true

Facts store: ~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/facts.jsonl

Examples:
  mem-facts add Steve role founder
  mem-facts add ProChat stack "Next.js + Supabase"
  mem-facts list Steve
  mem-facts search "founder"
  mem-facts invalidate fact-001
EOF
    ;;

  *)
    echo "Unknown command: $cmd" >&2
    echo "Run: mem-facts help" >&2
    exit 1
    ;;

esac
