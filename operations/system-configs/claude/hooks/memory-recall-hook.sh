#!/usr/bin/env bash
# memory-recall-hook.sh — UserPromptSubmit hook
# Detects natural-language memory recall intent and injects relevant memories.
# Zero cost on non-recall prompts (passthrough only).
# Works with mem-search.sh to find and inject memory entries.

set -euo pipefail

INPUT=$(cat)

# Extract prompt from hook JSON payload
PROMPT=$(node -e "
const d = JSON.parse(process.argv[1]);
process.stdout.write(d.prompt || '');
" "$INPUT" 2>/dev/null || echo "")

# Guard: empty prompt
if [ -z "$PROMPT" ]; then
  echo "$INPUT"
  exit 0
fi

# Trigger pattern: phrases that indicate memory recall intent
# Kept narrow to avoid false positives and unnecessary mem-search calls
TRIGGER_PATTERN="what did we|remind me|do you remember|do we have|previously|last time|we used to|we always|what was the|what is our|what are our|why did we|how did we|what settings|what config|what decision|what approach"

# Check if trigger pattern matches prompt
if ! printf '%s' "$PROMPT" | grep -qiE "$TRIGGER_PATTERN"; then
  # No trigger detected — pass through unchanged (zero cost)
  echo "$INPUT"
  exit 0
fi

# Trigger detected: extract keywords for memory search
# Algorithm: split prompt, remove stop words, take first 3 meaningful words
KEYWORDS=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]' | \
  sed -E 's/[^a-z0-9 ]//g' | \
  tr ' ' '\n' | \
  grep -v -E '^(the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|be|do|did|what|when|where|why|how|which|who|if|that|this|from|with|by|as|we|you|i|me|us|him|her|it|they|them|our|your)$' | \
  head -3 | \
  paste -sd ' ' - || echo "")

# Guard: no keywords extracted
if [ -z "$KEYWORDS" ]; then
  echo "$INPUT"
  exit 0
fi

# Run mem-search with extracted keywords
SEARCH_RESULT=$(bash ~/.local/bin/mem-search $KEYWORDS 2>/dev/null | head -10 || echo "")

# Guard: mem-search returned nothing or error
if [ -z "$SEARCH_RESULT" ] || printf '%s' "$SEARCH_RESULT" | grep -q "Index matches.*File matches"; then
  # Either no matches or tool unavailable — pass through
  echo "$INPUT"
  exit 0
fi

# Prepare memory context block (cap at 5 entries to keep token cost low ~100-200 tokens)
MEMORY_BLOCK=$(printf '%s' "$SEARCH_RESULT" | head -5)

# Inject memory block into prompt (append to existing prompt)
node -e "
const d = JSON.parse(process.argv[1]);
const memory_block = process.argv[2];
d.prompt = (d.prompt || '') + '\n\n--- Memory recall ---\n' + memory_block + '\n---';
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$MEMORY_BLOCK" 2>/dev/null || echo "$INPUT"
