#!/usr/bin/env bash
# inject-handoff.sh — UserPromptSubmit hook
# Reads .ai/current.md from the current working directory.
# If found and non-empty, prepends a compact status brief to the user's prompt.
# Only injects when the session is fresh (fewer than 3 existing messages).

set -euo pipefail

INPUT=$(cat)

# Get the transcript path and current prompt from hook JSON
TRANSCRIPT_PATH=$(node -e "
const d = JSON.parse(process.argv[1]);
process.stdout.write(d.transcript_path || '');
" "$INPUT" 2>/dev/null || echo "")

CURRENT_PROMPT=$(node -e "
const d = JSON.parse(process.argv[1]);
process.stdout.write(d.prompt || '');
" "$INPUT" 2>/dev/null || echo "")

# Only inject on fresh sessions (transcript missing or very small)
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  LINE_COUNT=$(wc -l < "$TRANSCRIPT_PATH" 2>/dev/null || echo "99")
  if [ "$LINE_COUNT" -gt 4 ]; then
    # Session already has messages — pass through unchanged
    echo "$INPUT"
    exit 0
  fi
fi

# Find .ai/current.md relative to CWD
HANDOFF_FILE="$PWD/.ai/current.md"

if [ ! -f "$HANDOFF_FILE" ]; then
  echo "$INPUT"
  exit 0
fi

HANDOFF_CONTENT=$(cat "$HANDOFF_FILE")

# Skip if it's still a blank template (no real goal set)
if echo "$HANDOFF_CONTENT" | grep -q "Not yet set\|Fresh setup\|No active session"; then
  echo "$INPUT"
  exit 0
fi

# Extract just the key sections to keep token cost low
BRIEF=$(node -e "
const content = process.argv[1];
const lines = content.split('\n');
let sections = {};
let current = null;
for (const line of lines) {
  if (line.startsWith('## ')) {
    current = line.replace('## ', '').trim();
    sections[current] = [];
  } else if (current && line.trim()) {
    sections[current].push(line.trim());
  }
}
const get = (key) => (sections[key] || []).slice(0, 3).join(' | ') || 'none';
const out = [
  '--- Session context (from last handoff) ---',
  'Goal: ' + get('Goal'),
  'Status: ' + get('Status'),
  'Next steps: ' + get('Next steps'),
  'Blockers: ' + get('Blockers'),
  '---',
  ''
].join('\n');
process.stdout.write(out);
" "$HANDOFF_CONTENT" 2>/dev/null || echo "")

# NEW: Extract keywords from current prompt and search memory on session start
# This triggers only on fresh sessions (same guard as above: < 4 lines in transcript)
MEMORY_CONTEXT=""
if [ -n "$CURRENT_PROMPT" ]; then
  # Extract 1-3 meaningful keywords from the user's first prompt
  KEYWORDS=$(printf '%s' "$CURRENT_PROMPT" | tr '[:upper:]' '[:lower:]' | \
    sed -E 's/[^a-z0-9 ]//g' | \
    tr ' ' '\n' | \
    grep -v -E '^(the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|be|do|did|what|when|where|why|how|which|who|if|that|this|from|with|by|as|we|you|i|me|us|him|her|it|they|them|our|your)$' | \
    head -3 | \
    paste -sd ' ' - || echo "")

  # If keywords found, search memory and cap at 5 entries
  if [ -n "$KEYWORDS" ]; then
    SEARCH_RESULT=$(bash ~/.local/bin/mem-search $KEYWORDS 2>/dev/null | head -5 || echo "")
    if [ -n "$SEARCH_RESULT" ]; then
      MEMORY_CONTEXT=$(printf '\n--- Memory context ---\n%s\n---\n' "$SEARCH_RESULT")
    fi
  fi
fi

if [ -z "$BRIEF" ]; then
  echo "$INPUT"
  exit 0
fi

# Output modified JSON with memory context + brief prepended to the prompt
node -e "
const d = JSON.parse(process.argv[1]);
const memory = process.argv[2];
const brief = process.argv[3];
d.prompt = memory + brief + (d.prompt || '');
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$MEMORY_CONTEXT" "$BRIEF" 2>/dev/null || echo "$INPUT"
