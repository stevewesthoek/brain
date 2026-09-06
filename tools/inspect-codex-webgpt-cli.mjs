#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CODEX_WEBGPT_SOURCE_ROOT || '/Users/Office/Repos/vendors/codex-chatgpt-web';
const files = ['package.json', 'src/cli.ts', 'src/codex-integration.ts', 'src/codex-integration-shared.ts'];
const patterns = [
  /setup/ig,
  /replace[-_ ]?route/ig,
  /doctor/ig,
  /status/ig,
  /codex/ig,
  /ack/ig,
  /--yes/ig,
  /--full/ig,
  /runtime-key/ig,
  /tunnel-id/ig,
  /non-interactive/ig,
];

function boundedMatches(text, file) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length && out.length < 80; i += 1) {
    const line = lines[i];
    if (!patterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(line); })) continue;
    const safe = line
      .replace(/(authorization|token|secret|password|cookie)\s*[:=]\s*[^\s,;]+/ig, '$1=<redacted>')
      .slice(0, 300);
    out.push({ file, line: i + 1, text: safe });
  }
  return out;
}

const result = { root, files: [], matches: [] };
for (const relative of files) {
  const file = path.join(root, relative);
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error('not_file');
    const text = fs.readFileSync(file, 'utf8');
    result.files.push({ file: relative, present: true, bytes: stat.size });
    result.matches.push(...boundedMatches(text, relative));
  } catch (error) {
    result.files.push({ file: relative, present: false, reason: error.code || error.message });
  }
}
console.log(JSON.stringify(result, null, 2));
