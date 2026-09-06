#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const candidates = [
  '/Applications/Codex Web GPT.app',
  `${os.homedir()}/Applications/Codex Web GPT.app`,
];
const app = candidates.find((candidate) => fs.existsSync(candidate));
if (!app) {
  console.error('WEBGPT_LAUNCH_BLOCKED installed Codex Web GPT.app not found');
  process.exit(2);
}
const result = spawnSync('/usr/bin/open', ['-a', app], {
  stdio: 'ignore',
  timeout: 10_000,
  env: {
    HOME: process.env.HOME || os.homedir(),
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    USER: process.env.USER || '',
  },
});
if (result.error) {
  console.error(`WEBGPT_LAUNCH_BLOCKED ${result.error.message}`);
  process.exit(3);
}
if (result.status !== 0) {
  console.error(`WEBGPT_LAUNCH_BLOCKED open exited ${result.status}`);
  process.exit(4);
}
console.log(JSON.stringify({ launched: true, application: 'Codex Web GPT.app' }));
