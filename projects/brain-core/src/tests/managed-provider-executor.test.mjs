import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeManagedProvider } from '../adapters/managed-provider-executor.mjs';
import { runManagedCommand } from '../adapters/managed-command-runner.mjs';

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-managed-provider-test-'));
  const executable = path.join(root, 'fake-provider.mjs');
  const trace = path.join(root, 'trace.json');
  fs.writeFileSync(executable, `#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const tracePath = process.env.MANAGED_PROVIDER_TRACE;
const data = { args, pid: process.pid, cwd: process.cwd() };
if (args.includes('--cli-input-json')) {
  const requestPath = fileURLToPath(args[args.indexOf('--cli-input-json') + 1]);
  data.requestPath = requestPath;
  data.requestMode = fs.statSync(requestPath).mode & 0o777;
  data.request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
}
if (args.includes('--output-last-message')) {
  const outputPath = args[args.indexOf('--output-last-message') + 1];
  data.outputPath = outputPath;
  data.outputMode = fs.statSync(outputPath).mode & 0o777;
}
fs.writeFileSync(tracePath, JSON.stringify(data));
if (process.env.MANAGED_PROVIDER_MODE === 'nonzero') process.exit(7);
if (process.env.MANAGED_PROVIDER_MODE === 'hang') {
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
} else if (process.env.MANAGED_PROVIDER_MODE === 'flood') {
  process.stdout.write('x'.repeat(10000));
} else if (args.includes('--cli-input-json')) {
  process.stdout.write(JSON.stringify({ output: { message: { content: [{ text: 'bedrock-result' }] } } }));
} else {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    const current = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
    current.input = input;
    fs.writeFileSync(tracePath, JSON.stringify(current));
    fs.writeFileSync(current.outputPath, 'codex-result');
  });
}
`, { mode: 0o755 });
  return { root, executable, trace };
}

function envFor(trace, mode = 'success') {
  return { ...process.env, MANAGED_PROVIDER_TRACE: trace, MANAGED_PROVIDER_MODE: mode };
}

test('Bedrock uses a 0600 private request, keeps content out of argv, and cleans up', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const prompt = 'PRIVATE-BEDROCK-CONTENT';
  const text = await executeManagedProvider(
    { providerId: 'claude-bedrock', model: 'model', timeoutInferenceSec: 30 },
    prompt,
    { aws: fixture.executable, env: envFor(fixture.trace) },
  );
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.equal(text, 'bedrock-result');
  assert.equal(trace.requestMode, 0o600);
  assert.equal(trace.request.messages[0].content[0].text, prompt);
  assert.equal(JSON.stringify(trace.args).includes(prompt), false);
  assert.equal(fs.existsSync(trace.requestPath), false);
  assert.equal(fs.existsSync(path.dirname(trace.requestPath)), false);
});

test('Codex uses stdin, a 0600 private output, empty cwd, and cleans up', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const prompt = 'PRIVATE-CODEX-CONTENT';
  const text = await executeManagedProvider(
    { providerId: 'codex-cli', model: 'model', timeoutInferenceSec: 30 },
    prompt,
    { codex: fixture.executable, env: envFor(fixture.trace) },
  );
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.equal(text, 'codex-result');
  assert.equal(trace.outputMode, 0o600);
  assert.match(trace.input, /PRIVATE-CODEX-CONTENT/);
  assert.equal(JSON.stringify(trace.args).includes(prompt), false);
  assert.equal(fs.existsSync(trace.outputPath), false);
  assert.equal(fs.existsSync(trace.cwd), false);
});

test('provider nonzero exit propagates failure and cleans the private directory', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    executeManagedProvider(
      { providerId: 'claude-bedrock', model: 'model', timeoutInferenceSec: 30 },
      'private',
      { aws: fixture.executable, env: envFor(fixture.trace, 'nonzero') },
    ),
    /exited unsuccessfully/,
  );
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.equal(fs.existsSync(path.dirname(trace.requestPath)), false);
});

test('timeout waits for TERM-to-KILL close before rejecting', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    runManagedCommand(fixture.executable, [], {
      timeoutMs: 300,
      killGraceMs: 50,
      env: envFor(fixture.trace, 'hang'),
    }),
    /timed out/,
  );
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.throws(() => process.kill(trace.pid, 0), { code: 'ESRCH' });
});

test('output limit terminates the child before rejecting', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    runManagedCommand(fixture.executable, [], {
      timeoutMs: 5_000,
      killGraceMs: 50,
      maxOutputBytes: 100,
      env: envFor(fixture.trace, 'flood'),
    }),
    /bounded output limit/,
  );
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.throws(() => process.kill(trace.pid, 0), { code: 'ESRCH' });
});
