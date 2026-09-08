#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const vendorRoot = '/Users/Office/Repos/vendors/codex-chatgpt-web';
const explicitSourceRoot = process.env.CODEX_WEBGPT_SOURCE_ROOT?.trim();
const codexWebGptHome = process.env.CODEX_CHATGPT_WEB_HOME?.trim()
  || path.join(os.homedir(), '.codex-chatgpt-web');
const runtimeConfigPath = path.join(codexWebGptHome, 'config.json');
let configuredReleaseVersion = null;
try {
  const config = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
  if (typeof config.releaseVersion === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(config.releaseVersion)) {
    configuredReleaseVersion = config.releaseVersion;
  }
} catch {
  // Fall back to the source checkout when the launcher has not been configured yet.
}

const installedRuntimeRoot = configuredReleaseVersion
  ? path.join(codexWebGptHome, 'versions', `${configuredReleaseVersion}-${process.platform}-${process.arch}`)
  : null;
const installedCliPath = installedRuntimeRoot && path.join(installedRuntimeRoot, 'app', 'cli.js');
const installedBun = installedRuntimeRoot && path.join(installedRuntimeRoot, 'runtime', 'bun');
const useInstalledRuntime = !explicitSourceRoot
  && Boolean(installedCliPath && installedBun && fs.existsSync(installedCliPath) && fs.existsSync(installedBun));
const ownerRoot = useInstalledRuntime ? codexWebGptHome : (explicitSourceRoot || vendorRoot);
const cliPath = useInstalledRuntime ? installedCliPath : path.join(ownerRoot, 'src', 'cli.ts');
const bunCandidates = useInstalledRuntime
  ? [installedBun]
  : [
      process.env.BUN_BIN,
      path.join(os.homedir(), '.bun', 'bin', 'bun'),
      '/opt/homebrew/bin/bun',
      '/usr/local/bin/bun',
    ];

const operation = process.argv[2];
const allowed = new Map([
  ['doctor', ['doctor', '--json']],
  ['route-status', ['route', 'status']],
  ['route-connect', ['route', 'connect']],
  ['service-status', ['service', 'status']],
  ['service-start', ['service', 'start']],
  ['tunnel-status', ['tunnel', 'status']],
  ['tunnel-start', ['tunnel', 'start']],
  ['browser-check', ['browser', 'check']],
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

const commandArgs = useInstalledRuntime
  ? [cliPath, ...allowed.get(operation)]
  : ['run', cliPath, ...allowed.get(operation)];
const result = spawnSync(bun, commandArgs, {
  cwd: ownerRoot,
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
