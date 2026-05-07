#!/usr/bin/env bash
# mem-write.sh — Memory entry writer for the memory orchestrator
# Creates and updates memory entries in the ~/.claude/.../memory/ directory
# Usage:
#   mem-write user|feedback|project|ref <name> <description> [--body "..."] [--facts "e|p|o,e|p|o"]
#   mem-write update <id> [--name "..."] [--description "..."] [--body "..."]

set -euo pipefail

MEMORY_DIR="${HOME}/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory"
MEMORY_INDEX="${MEMORY_DIR}/MEMORY.md"

mkdir -p "$MEMORY_DIR"

cmd="${1:?Usage: mem-write user|feedback|project|ref <name> <description> | mem-write update <id>}"
shift

# Helper: slugify name (lowercase, spaces to underscores, strip non-alnum except underscore)
slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_]/_/g' | sed 's/_+/_/g' | sed 's/^_//;s/_$//'
}

# Helper: find highest NNN for a memory type in MEMORY.md
highest_nnn() {
  local type="$1"
  grep -oE "\[mem-${type}-[0-9]+\]" "$MEMORY_INDEX" 2>/dev/null | \
    grep -oE "[0-9]+" | sort -n | tail -1 || echo "0"
}

case "$cmd" in

  user|feedback|project|ref)
    mem_type="$cmd"
    name="${1:?Usage: mem-write $mem_type <name> <description>}"
    description="${2:?}"
    shift 2

    # Parse optional flags
    body=""
    facts=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --body)
          body="${2:?}"
          shift 2
          ;;
        --facts)
          facts="${2:?}"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done

    # Determine next ID
    nnn=$(highest_nnn "$mem_type")
    nnn=$((nnn + 1))
    mem_id=$(printf "mem-%s-%03d" "$mem_type" "$nnn")

    # Generate filename
    slug=$(slugify "$name")
    filename="${mem_type}_${slug}_${nnn}.md"
    filepath="${MEMORY_DIR}/${filename}"

    # Create date
    created=$(date +%Y-%m-%d)

    # Write memory file with frontmatter
    cat > "$filepath" <<EOF
---
id: ${mem_id}
name: ${name}
description: ${description}
type: ${mem_type}
created: ${created}
---

${body}
EOF

    # Append to MEMORY.md index (create index if it doesn't exist)
    if [ ! -f "$MEMORY_INDEX" ]; then
      cat > "$MEMORY_INDEX" <<'INDEXEOF'
# Memory Index

This directory stores persistent memory entries for the AI system. Each entry has a unique ID in the format `mem-{type}-{NNN}`.

## Index

INDEXEOF
    fi

    # Append entry to index (after ## Index line)
    (grep -v "^$" "$MEMORY_INDEX" | head -n -0) > "$MEMORY_INDEX.tmp" || true
    (head -n 100 "$MEMORY_INDEX" | grep -n "## Index") > /dev/null 2>&1 || echo "## Index" >> "$MEMORY_INDEX"
    echo "- [$mem_id] [$name]($filename) — $description" >> "$MEMORY_INDEX"
    mv "$MEMORY_INDEX.tmp" "$MEMORY_INDEX" 2>/dev/null || true
    grep -v "^$" "$MEMORY_INDEX" | uniq > "$MEMORY_INDEX.tmp" && mv "$MEMORY_INDEX.tmp" "$MEMORY_INDEX" || true

    # Simple append if index update is complex
    if ! grep -q "^\- \[$mem_id\]" "$MEMORY_INDEX" 2>/dev/null; then
      echo "- [$mem_id] [$name]($filename) — $description" >> "$MEMORY_INDEX"
    fi

    # Extract and write facts if provided
    if [ -n "$facts" ]; then
      IFS=',' read -ra fact_triples <<< "$facts"
      fact_count=0
      for triple in "${fact_triples[@]}"; do
        IFS='|' read -r entity predicate object <<< "$triple"
        entity=$(echo "$entity" | xargs)  # trim
        predicate=$(echo "$predicate" | xargs)
        object=$(echo "$object" | xargs)
        bash ~/.local/bin/mem-facts add "$entity" "$predicate" "$object" --source "$mem_id" > /dev/null 2>&1 || true
        fact_count=$((fact_count + 1))
      done
      echo "Created $mem_id: $filename (and recorded $fact_count fact(s))"
    else
      echo "Created $mem_id: $filename"
    fi
    ;;

  update)
    mem_id="${1:?Usage: mem-write update <id> [--name ...] [--description ...] [--body ...]}"
    shift

    # Parse optional flags
    new_name=""
    new_description=""
    new_body=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --name)
          new_name="${2:?}"
          shift 2
          ;;
        --description)
          new_description="${2:?}"
          shift 2
          ;;
        --body)
          new_body="${2:?}"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done

    # Find the file by ID (grep for "^id: <id>" in frontmatter)
    file_path=$(grep -r "^id: $mem_id$" "$MEMORY_DIR" 2>/dev/null | cut -d: -f1 | head -1)
    if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
      echo "Error: memory entry not found: $mem_id" >&2
      exit 1
    fi

    # Read current frontmatter
    frontmatter_end=$(grep -n "^---$" "$file_path" | tail -1 | cut -d: -f1)
    if [ -z "$frontmatter_end" ]; then
      echo "Error: invalid memory file format: $file_path" >&2
      exit 1
    fi

    # Extract body
    body_start=$((frontmatter_end + 1))
    body=$(tail -n +$body_start "$file_path")

    # Read current frontmatter values
    current_name=$(grep "^name: " "$file_path" | cut -d' ' -f2- | head -1)
    current_description=$(grep "^description: " "$file_path" | cut -d' ' -f2- | head -1)
    current_type=$(grep "^type: " "$file_path" | cut -d' ' -f2- | head -1)
    current_created=$(grep "^created: " "$file_path" | cut -d' ' -f2- | head -1)

    # Apply updates
    if_name="${new_name:-$current_name}"
    if_description="${new_description:-$current_description}"
    if_body="${new_body:-$body}"

    # Write updated file
    cat > "$file_path" <<EOF
---
id: ${mem_id}
name: ${if_name}
description: ${if_description}
type: ${current_type}
created: ${current_created}
---

${if_body}
EOF

    # Update MEMORY.md index if name or description changed
    if [ -n "$new_name" ] || [ -n "$new_description" ]; then
      # Remove old entry
      sed -i.bak "/^\- \[$mem_id\]/d" "$MEMORY_INDEX" 2>/dev/null || true

      # Add updated entry
      filename=$(basename "$file_path")
      echo "- [$mem_id] [${if_name}]($filename) — ${if_description}" >> "$MEMORY_INDEX"
      rm -f "$MEMORY_INDEX.bak"
    fi

    echo "Updated $mem_id"
    ;;

  *)
    echo "Error: unknown command: $cmd" >&2
    echo "Usage: mem-write user|feedback|project|ref <name> <description> [--body ...] [--facts ...]" >&2
    echo "   or: mem-write update <id> [--name ...] [--description ...] [--body ...]" >&2
    exit 1
    ;;

esac
