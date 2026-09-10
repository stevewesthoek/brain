#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const pin = {
  repository: 'https://github.com/deepseek-ai/deepseek-harness.git',
  commit: 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8',
  version: '0.1.3-alpha.2',
};
const runtimeRoot = resolve(process.env.BRAIN_AGENT_MODE_RUNTIME_DIR ?? join(homedir(), '.local', 'brain', 'runtimes', 'deepseek-harness', pin.commit));

function run(command, args) {
  execFileSync(command, args, { cwd: runtimeRoot, stdio: 'inherit' });
}

mkdirSync(resolve(runtimeRoot, '..'), { recursive: true });
try {
  readFileSync(join(runtimeRoot, 'package.json'));
} catch {
  execFileSync('git', ['clone', '--no-checkout', pin.repository, runtimeRoot], { stdio: 'inherit' });
}
run('git', ['fetch', '--quiet', '--depth', '1', 'origin', pin.commit]);
run('git', ['checkout', '--quiet', '--detach', pin.commit]);
const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'package.json'), 'utf8'));
if (manifest.version !== pin.version) throw new Error(`unexpected Harness version: ${manifest.version}`);
run('pnpm', ['install', '--frozen-lockfile']);
run('pnpm', ['run', 'build:lib']);
process.stdout.write(`${JSON.stringify({ ...pin, runtimeRoot, sdkClient: join(runtimeRoot, 'packages/sdk/client/lib/index.js') })}\n`);
