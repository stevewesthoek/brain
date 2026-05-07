#!/usr/bin/env bash
# memory-recall-hook.sh — UserPromptSubmit hook
# Detects memory intent (RECALL/CAPTURE/FACTS/REVIEW) and injects appropriate context
# Works with mem-search.sh and mem-facts.sh to find and inject memory entries

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

# Trigger patterns for 4 intent types (detection order matters: REVIEW → FACTS → CAPTURE → RECALL)
# REVIEW pattern (most specific, should match first)
REVIEW_PATTERN="show all my memories|audit memory|what do I have saved|list all memories|show me everything saved|memory overview|full memory|show memory index|what have I saved"

# FACTS pattern (entity-specific queries)
FACTS_PATTERN="what do we know about|show facts|current status of|facts about|what facts|tell me about|what is the current|profile of|what do you know about"

# CAPTURE pattern (save/remember intent)
CAPTURE_PATTERN="remember this|save this|note that|make a note|I prefer|I want you to know|keep in mind|store this|save that|add to memory|worth remembering|don't forget that|write this down|log this"

# RECALL pattern (existing, retrieve intent)
RECALL_PATTERN="what did we|remind me|do you remember|do we have|previously|last time|we used to|we always|what was the|what is our|what are our|why did we|how did we|what settings|what config|what decision|what approach|do we still|what have we"

# Detect intent (first match wins)
if printf '%s' "$PROMPT" | grep -qiE "$REVIEW_PATTERN"; then
  # REVIEW intent
  MEM_INDEX=$(bash ~/.local/bin/mem-search 2>/dev/null || echo "(memory not available)")
  MEM_FACTS=$(bash ~/.local/bin/mem-facts list 2>/dev/null || echo "(facts not available)")

  CONTEXT_BLOCK="--- Memory index ---
$MEM_INDEX

Facts summary:
$MEM_FACTS
---"

  node -e "
const d = JSON.parse(process.argv[1]);
const context = process.argv[2];
d.prompt = (d.prompt || '') + '\n\n' + context + '\n';
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$CONTEXT_BLOCK" 2>/dev/null || echo "$INPUT"
  exit 0
fi

if printf '%s' "$PROMPT" | grep -qiE "$FACTS_PATTERN"; then
  # FACTS intent - extract entity name
  # Strategy: remove trigger words, apply stop-word filter, take first 2 words
  stop_words="the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|be|do|did|what|when|where|why|how|which|who|if|that|this|from|with|by|as|we|you|i|me|us|him|her|it|they|them|our|your|show|facts|current|status|know|about|tell|profile|do"

  # Remove trigger phrase words and convert to lowercase
  entity=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]' | \
    sed -E 's/(what do we know about|show facts|current status of|facts about|what facts|tell me about|what is the current|profile of|what do you know about)//gi' | \
    sed -E 's/[^a-z0-9 ]//g' | \
    tr ' ' '\n' | \
    grep -v -E "^($stop_words)$" | \
    head -2 | paste -sd ' ' - || echo "")

  # Guard: if no entity extracted, pass through
  if [ -z "$entity" ]; then
    echo "$INPUT"
    exit 0
  fi

  # Get facts and related memories
  MEM_FACTS=$(bash ~/.local/bin/mem-facts list "$entity" 2>/dev/null || echo "(no facts for: $entity)")
  MEM_ENTRIES=$(bash ~/.local/bin/mem-search "$entity" 2>/dev/null | head -10 || echo "(no memory entries)")

  CONTEXT_BLOCK="--- Facts context ---
Known facts about $entity:
$MEM_FACTS

Related memory entries:
$MEM_ENTRIES
---"

  node -e "
const d = JSON.parse(process.argv[1]);
const context = process.argv[2];
d.prompt = (d.prompt || '') + '\n\n' + context + '\n';
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$CONTEXT_BLOCK" 2>/dev/null || echo "$INPUT"
  exit 0
fi

if printf '%s' "$PROMPT" | grep -qiE "$CAPTURE_PATTERN"; then
  # CAPTURE intent - extract keywords for duplicate check
  KEYWORDS=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]' | \
    sed -E 's/[^a-z0-9 ]//g' | \
    tr ' ' '\n' | \
    grep -v -E '^(the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|be|do|did|what|when|where|why|how|which|who|if|that|this|from|with|by|as|we|you|i|me|us|him|her|it|they|them|our|your|remember|save|note|prefer|know|keep|store|add|worth|forget|write|log|make)$' | \
    head -3 | paste -sd ' ' - || echo "")

  # Get related memory entries for duplicate check
  if [ -n "$KEYWORDS" ]; then
    RELATED=$(bash ~/.local/bin/mem-search $KEYWORDS 2>/dev/null | grep -A 5 "File matches" | head -5 || echo "(none)")
  else
    RELATED="(none)"
  fi

  CONTEXT_BLOCK="--- Memory capture instructions ---
The user wants to save something to memory. Follow these steps:

1. Identify memory type:
   - user: personal info, preferences, role
   - feedback: how AI should behave, what to avoid
   - project: project decisions, status, milestones
   - ref: external URLs, tools, credentials

2. Check for duplicates (do not duplicate):
   Existing related entries:
$RELATED

   If an existing entry covers this, offer to update it instead.

3. Create the memory entry:
   mem-write {type} \"<name>\" \"<description>\" --body \"<content>\"

4. Extract and write facts (MANDATORY):
   For each discrete fact (date, role, preference, person, tool, etc.):
   mem-facts add \"<entity>\" \"<predicate>\" \"<object>\" --source <new-id>

5. Confirm to the user:
   \"Saved as mem-{type}-NNN. Also recorded N fact(s).\"
---"

  node -e "
const d = JSON.parse(process.argv[1]);
const context = process.argv[2];
d.prompt = (d.prompt || '') + '\n\n' + context + '\n';
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$CONTEXT_BLOCK" 2>/dev/null || echo "$INPUT"
  exit 0
fi

if printf '%s' "$PROMPT" | grep -qiE "$RECALL_PATTERN"; then
  # RECALL intent - extract keywords (existing behavior)
  KEYWORDS=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]' | \
    sed -E 's/[^a-z0-9 ]//g' | \
    tr ' ' '\n' | \
    grep -v -E '^(the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|be|do|did|what|when|where|why|how|which|who|if|that|this|from|with|by|as|we|you|i|me|us|him|her|it|they|them|our|your)$' | \
    head -3 | paste -sd ' ' - || echo "")

  # Guard: no keywords extracted
  if [ -z "$KEYWORDS" ]; then
    echo "$INPUT"
    exit 0
  fi

  # Run mem-search with extracted keywords
  SEARCH_RESULT=$(bash ~/.local/bin/mem-search $KEYWORDS 2>/dev/null | head -10 || echo "")

  # Guard: mem-search returned nothing or error
  if [ -z "$SEARCH_RESULT" ] || printf '%s' "$SEARCH_RESULT" | grep -q "Index matches.*File matches"; then
    echo "$INPUT"
    exit 0
  fi

  # Prepare memory context block (cap at 5 entries)
  MEMORY_BLOCK=$(printf '%s' "$SEARCH_RESULT" | head -5)

  # Inject memory block into prompt
  node -e "
const d = JSON.parse(process.argv[1]);
const memory_block = process.argv[2];
d.prompt = (d.prompt || '') + '\n\n--- Memory recall ---\n' + memory_block + '\n---';
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$MEMORY_BLOCK" 2>/dev/null || echo "$INPUT"
  exit 0
fi

# No intent detected - pass through unchanged (zero cost)
echo "$INPUT"
