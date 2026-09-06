#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const vendorRoot = process.env.CODEX_WEBGPT_SOURCE_ROOT || '/Users/Office/Repos/vendors/codex-chatgpt-web';
const cliPath = path.join(vendorRoot, 'src', 'cli.ts');
const bunCandidates = [
  process.env.BUN_BIN,
  path.join(os.homedir(), '.bun', 'bin', 'bun'),
  '/opt/homebrew/bin/bun',
  '/usr/local/bin/bun',
].filter(Boolean);

const operation = process.argv[2];
const allowed = new Map([
  ['doctor', ['run', cliPath, 'doctor', '--json']],
  ['route-status', ['run', cliPath, 'route', 'status']],
  ['route-connect', ['run', cliPath, 'route', 'connect']],
  ['service-status', ['run', cliPath, 'service', 'status']],
  ['service-start', ['run', cliPath, 'service', 'start']],
  ['tunnel-status', ['run', cliPath, 'tunnel', 'status']],
  ['tunnel-start', ['run', cliPath, 'tunnel', 'start']],
  ['browser-check', ['run', cliPath, 'browser', 'check']],
]);

if (!allowed.has(operation)) {
  console.error('usage: node tools/codex-webgpt-owner-cli.mjs <doctor|route-status|route-connect>');
  process.exit(2);
}
if (!fs.existsSync(cliPath)) {
  console.error(`WEBGPT_OWNER_CLI_BLOCKED missing owner CLI: ${cliPath}`);
  process.exit(3);
}
const bun = bunCandidates.find((candidate) => fs.existsSync(candidate));
if (!bun) {
  console.error('WEBGPT_OWNER_CLI_BLOCKED bun runtime not found');
  process.exit(4);
}

const env = {
  HOME: process.env.HOME || os.homedir(),
  PATH: process.env.PATH || '',
  USER: process.env.USER || '',
  LOGNAME: process.env.LOGNAME || process.env.USER || '',
  TMPDIR: process.env.TMPDIR || os.tmpdir(),
  LANG: process.env.LANG || 'en_US.UTF-8',
  LC_ALL: process.env.LC_ALL || '',
};

const result = spawnSync(bun, allowed.get(operation), {
  cwd: vendorRoot,
  env,
  encoding: 'utf8',
  timeout: 30_000,
  maxBuffer: 512 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const redact = (value = '') => value
  .replace(/(authorization|token|secret|password|cookie|runtime[_-]?key)\s*[:=]\s*[^\s,;\"']+/ig, '$1=<redacted>')
  .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/ig, 'Bearer <redacted>');

if (result.stdout) process.stdout.write(redact(result.stdout));
if (result.stderr) process.stderr.write(redact(result.stderr));
if (result.error) {
  console.error(`WEBGPT_OWNER_CLI_BLOCKED ${result.error.message}`);
  process.exit(5);
}
if (result.signal) {
  console.error(`WEBGPT_OWNER_CLI_BLOCKED signal=${result.signal}`);
  process.exit(6);
}
process.exit(result.status ?? 1);
