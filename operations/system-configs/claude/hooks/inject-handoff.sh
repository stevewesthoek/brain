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

if [ -z "$BRIEF" ]; then
  echo "$INPUT"
  exit 0
fi

# Output modified JSON with brief prepended to the prompt
node -e "
const d = JSON.parse(process.argv[1]);
const brief = process.argv[2];
d.prompt = brief + (d.prompt || '');
process.stdout.write(JSON.stringify(d));
" "$INPUT" "$BRIEF" 2>/dev/null || echo "$INPUT"
