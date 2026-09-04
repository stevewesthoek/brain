#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runtimeRoot = path.resolve(process.env.BRAIN_CONSOLE_RUNTIME_ROOT ?? repoRoot);
const consoleRoot = path.join(runtimeRoot, 'projects', 'brain-console');
const nextEntry = path.join(consoleRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.BRAIN_CONSOLE_PORT ?? '4881';
const host = process.env.BRAIN_CONSOLE_HOST ?? '127.0.0.1';
const nodePath = '/opt/homebrew/bin/node';
const pathValue = [
  path.dirname(nodePath),
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  process.env.PATH,
].filter(Boolean).join(':');

if (!fs.existsSync(nextEntry)) {
  console.error(`[brain-console] Next.js entry is missing: ${nextEntry}`);
  process.exit(1);
}

const child = spawn(nodePath, [nextEntry, 'dev', '--hostname', host, '--port', port], {
  cwd: consoleRoot,
  env: {
    ...process.env,
    PATH: pathValue,
    NEXT_PUBLIC_BRAIN_CORE_URL: process.env.NEXT_PUBLIC_BRAIN_CORE_URL ?? 'http://127.0.0.1:4877',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopping = true;
    if (!child.killed) child.kill(signal);
  });
}

child.once('error', (error) => {
  console.error(`[brain-console] failed to start: ${error.message}`);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal && !stopping) {
    console.error(`[brain-console] exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
