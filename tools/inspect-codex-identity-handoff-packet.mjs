#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2] || '/Users/Office/.brain/codex-identity-handoff/codex-identity-20260906T130049Z-91992.packet.json';
const sensitive = /token|secret|password|cookie|authorization|email|identity|credential|key/i;
function safe(value, key = '') {
  if (sensitive.test(key)) return '<redacted>';
  if (Array.isArray(value)) return value.map((item) => safe(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = safe(v, k);
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `<string:${value.length}>`;
  return value;
}
try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(safe(data), null, 2));
} catch (error) {
  console.error(`INSPECT_BLOCKED ${error.code || error.message}`);
  process.exit(3);
}
