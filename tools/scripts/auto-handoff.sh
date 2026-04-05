#!/usr/bin/env bash
# auto-handoff.sh — Stop hook
# Mechanically parses the session transcript and writes a compact .ai/current.md.
# Zero LLM calls. Zero token cost. No infinite loop risk.
# Preserves manually-written handoffs that contain real decisions.

set -euo pipefail

INPUT=$(cat)

# Guard: stop_hook_active=true means this Stop was triggered by a Stop hook — exit to prevent recursion.
STOP_HOOK_ACTIVE=$(node -e "
const d = JSON.parse(process.argv[1]);
process.stdout.write(String(d.stop_hook_active || false));
" "$INPUT" 2>/dev/null || echo "false")
[ "$STOP_HOOK_ACTIVE" = "true" ] && exit 0

TRANSCRIPT_PATH=$(node -e "
const d = JSON.parse(process.argv[1]);
process.stdout.write(d.transcript_path || '');
" "$INPUT" 2>/dev/null || echo "")
[ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ] && exit 0

node - "$TRANSCRIPT_PATH" 2>/dev/null <<'NODEEOF' || true
const fs = require('fs');
const path = require('path');

const transcriptPath = process.argv[2];
const rawLines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean);
const entries = rawLines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Skip trivial sessions
if (entries.length < 4) process.exit(0);

// CWD and git branch from most recent entries
let cwd = '', gitBranch = '';
for (const e of [...entries].reverse()) {
  if (e.cwd && !cwd) cwd = e.cwd;
  if (e.gitBranch && !gitBranch) gitBranch = e.gitBranch;
  if (cwd && gitBranch) break;
}
if (!cwd) process.exit(0);

const handoffDir = path.join(cwd, '.ai');
const handoffFile = path.join(handoffDir, 'current.md');

// Only write if .ai/ already exists — don't create it for repos not using the system
if (!fs.existsSync(handoffDir)) process.exit(0);

// Preserve manually-written handoffs (no auto-saved marker + has real decisions)
if (fs.existsSync(handoffFile)) {
  const existing = fs.readFileSync(handoffFile, 'utf8');
  const isAutoSave = existing.includes('auto-saved at');
  const hasRealDecisions = existing.includes('## Decisions made') &&
    !existing.includes('None recorded') &&
    !existing.includes('None this session');
  if (!isAutoSave && hasRealDecisions) process.exit(0);
}

// Files edited/written — exclude secrets
const SECRET_PAT = /\.(env|pem|key|p12|pfx)$|credentials|secrets|\.npmrc|\.pypirc|id_rsa|id_ed25519/i;
const filesEdited = new Set();
for (const e of entries) {
  if (e.toolUseResult?.filePath) {
    const fp = e.toolUseResult.filePath;
    if (!SECRET_PAT.test(fp)) filesEdited.add(fp.replace(cwd + '/', '').replace(cwd, ''));
  }
}

// Recent bash commands (last 5, sanitized)
const bashCmds = [];
for (const e of entries) {
  if (e.message?.role === 'assistant' && Array.isArray(e.message.content)) {
    for (const c of e.message.content) {
      if (c.type === 'tool_use' && c.name === 'Bash' && c.input?.command) {
        const cmd = c.input.command.slice(0, 120).replace(/\n/g, ' ');
        if (!SECRET_PAT.test(cmd) && !/export\s+\w+=.+/i.test(cmd)) bashCmds.push(cmd);
      }
    }
  }
}

// Goal: first real user text
let goal = '';
for (const e of entries) {
  if (e.message?.role === 'user' && Array.isArray(e.message.content)) {
    for (const c of e.message.content) {
      if (c.type === 'text' && c.text?.length > 15 && !c.text.startsWith('---')) {
        goal = c.text.slice(0, 250).replace(/\n+/g, ' ').trim();
        break;
      }
    }
    if (goal) break;
  }
}

// Last assistant summary
let lastSummary = '';
for (const e of [...entries].reverse()) {
  if (e.message?.role === 'assistant' && Array.isArray(e.message.content)) {
    for (const c of e.message.content) {
      if (c.type === 'text' && c.text?.length > 30) {
        lastSummary = c.text.slice(0, 400).replace(/\n+/g, ' ').trim();
        break;
      }
    }
    if (lastSummary) break;
  }
}

const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const repo = path.basename(cwd);
const branch = gitBranch || 'unknown';

const filesList = filesEdited.size > 0
  ? [...filesEdited].slice(0, 12).map(f => `- ${f}`).join('\n')
  : '- none recorded';

const cmdsList = bashCmds.slice(-5).length > 0
  ? bashCmds.slice(-5).map(c => `- \`${c}\``).join('\n')
  : '- none recorded';

fs.writeFileSync(handoffFile, `# Current Handoff

## Repo
${repo} (${branch})

## Tool
Claude Code

## Goal
${goal || 'See transcript for context'}

## Status
auto-saved at ${timestamp} — run /handoff resume to reconstruct full context

## Files touched
${filesList}

## Recent commands
${cmdsList}

## Last response summary
${lastSummary || 'none'}

## Decisions made
None recorded automatically — run /handoff pause to capture decisions explicitly

## Next steps
Run /handoff resume to reconstruct context from this auto-save

## Blockers
Unknown — auto-save only

## Resume prompt
Resume from last session in ${repo} (${branch}). Review .ai/current.md and recent git log for full context.
`, 'utf8');
NODEEOF

exit 0
