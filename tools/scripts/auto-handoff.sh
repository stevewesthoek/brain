#!/usr/bin/env bash
# auto-handoff.sh — writes .ai/current.md when a Claude session stops.
# Registered as a Stop hook in ~/.claude/settings.json.
# Zero LLM calls. Zero tokens. Pure file parsing.

set -euo pipefail

INPUT=$(cat)

# Extract transcript path from hook JSON
TRANSCRIPT_PATH=$(echo "$INPUT" | node -e "
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(Buffer.concat(chunks).toString());
    process.stdout.write(d.transcript_path || '');
  } catch { process.stdout.write(''); }
}" 2>/dev/null <<< "$INPUT" || echo "")

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# Parse JSONL, extract CWD and last user prompt, write handoff
node - "$TRANSCRIPT_PATH" <<'NODEEOF'
const fs = require('fs');
const path = require('path');

const transcriptPath = process.argv[2];
if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Get working directory
let cwd = '';
for (const e of entries) {
  if (e.cwd) { cwd = e.cwd; break; }
}

if (!cwd || !fs.existsSync(path.join(cwd, '.ai'))) process.exit(0);

const handoffPath = path.join(cwd, '.ai', 'current.md');
const repoName = path.basename(cwd);
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

// Find last user prompt (skip meta/system entries)
let lastPrompt = 'No prompt recorded';
for (let i = entries.length - 1; i >= 0; i--) {
  const e = entries[i];
  if (e.type !== 'user' || e.isMeta) continue;
  const content = e.message?.content;
  let text = '';
  if (typeof content === 'string') text = content.trim();
  else if (Array.isArray(content)) {
    text = content.filter(c => c?.type === 'text').map(c => c.text).join(' ').trim();
  }
  if (text && !text.startsWith('<')) {
    lastPrompt = text.slice(0, 300);
    break;
  }
}

// Find last assistant text snippet
let lastReply = '';
for (let i = entries.length - 1; i >= 0; i--) {
  const e = entries[i];
  if (e.type !== 'assistant') continue;
  const content = e.message?.content;
  if (typeof content === 'string') lastReply = content.slice(0, 200);
  else if (Array.isArray(content)) {
    const t = content.find(c => c?.type === 'text');
    if (t?.text) lastReply = t.text.slice(0, 200);
  }
  if (lastReply) break;
}

const handoff = `# Current Handoff

## Repo
${repoName}

## Tool
Claude Code

## Goal
${lastPrompt}

## Status
- Auto-saved at ${now} (session stopped)
- Run \`git diff --name-only HEAD\` to see recent file changes

## Files touched
- (check git diff --name-only HEAD)

## Decisions made
- (review session if decisions were made)

## Next steps
1. Run \`/resume ${repoName}\` in ProBot to get the resume prompt
2. Check git status for uncommitted changes

## Blockers
- None recorded automatically

## Resume prompt
Continue work on ${repoName}. Last task: ${lastPrompt.slice(0, 200)}
`;

fs.writeFileSync(handoffPath, handoff, 'utf8');
NODEEOF
