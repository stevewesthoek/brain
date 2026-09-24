import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeManagedBedrockConverse, executeManagedProvider } from '../adapters/managed-provider-executor.mjs';
import { runManagedCommand } from '../adapters/managed-command-runner.mjs';

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-managed-provider-test-'));
  const executable = path.join(root, 'fake-provider.mjs');
  const trace = path.join(root, 'trace.json');
  fs.writeFileSync(executable, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
const tracePath = process.env.MANAGED_PROVIDER_TRACE;
const data = { args, pid: process.pid, cwd: process.cwd() };
if (args.includes('--cli-input-json')) {
  const requestUri = args[args.indexOf('--cli-input-json') + 1];
  if (!requestUri.startsWith('file://')) throw new Error('expected file URI');
  const requestPath = requestUri.slice('file://'.length);
  data.requestUri = requestUri;
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
if (process.env.MANAGED_PROVIDER_MODE === 'aws-error') {
  process.stderr.write('An error occurred (AccessDeniedException) when calling the Converse operation: denied');
  process.exit(4);
}
if (process.env.MANAGED_PROVIDER_MODE === 'bedrock-validation-error') {
  process.stderr.write('An error occurred (ValidationException) when calling the Converse operation: Error 002: The supplied request is invalid. (Service: BedrockRuntime, Status Code: 400, Request ID: req-12345678)\\nAuthorization: Bearer never-store-this-secret\\n');
  process.exit(4);
}
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

test('Bedrock maps Brain tool schemas to Converse toolSpec.inputSchema.json', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await executeManagedBedrockConverse({
    modelId: 'minimax.minimax-m2.5', region: 'us-east-1',
    messages: [{ role: 'user', content: [{ text: 'read' }] }], maxTokens: 16,
    tools: [{ name: 'brain_read', description: 'read only', inputSchema: { type: 'object', required: ['path'] } }],
    timeoutMs: 1_000,
  }, { aws: fixture.executable, env: envFor(fixture.trace) });
  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.deepEqual(trace.request.toolConfig, {
    tools: [{ toolSpec: { name: 'brain_read', description: 'read only', inputSchema: { json: { type: 'object', required: ['path'] } } } }],
  });
});

test('Bedrock CLI input preserves temp paths containing spaces without URL encoding', async (t) => {
  const fixture = createFixture();
  const tempRoot = path.join(fixture.root, 'temporary files with spaces');
  fs.mkdirSync(tempRoot);
  const originalTmpdir = process.env.TMPDIR;
  t.after(() => {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  process.env.TMPDIR = tempRoot;
  let text;
  try {
    text = await executeManagedBedrockConverse({
      modelId: 'zai.glm-5', region: 'us-east-1',
      messages: [{ role: 'user', content: [{ text: 'bounded fixture request' }] }],
      maxTokens: 16, timeoutMs: 5_000,
    }, { aws: fixture.executable, env: envFor(fixture.trace) });
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
  }

  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.deepEqual(text, { output: { message: { content: [{ text: 'bedrock-result' }] } } });
  assert.match(trace.requestPath, /temporary files with spaces/u);
  assert.equal(trace.requestUri, `file://${trace.requestPath}`);
  assert.equal(trace.requestUri.includes('%20'), false);
  assert.equal(trace.request.messages[0].content[0].text, 'bounded fixture request');
  assert.equal(fs.existsSync(trace.requestPath), false);
});

test('production managed-provider Bedrock route preserves temp paths containing spaces', async (t) => {
  const fixture = createFixture();
  const tempRoot = path.join(fixture.root, 'provider temporary files with spaces');
  fs.mkdirSync(tempRoot);
  const originalTmpdir = process.env.TMPDIR;
  t.after(() => {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  process.env.TMPDIR = tempRoot;
  try {
    await executeManagedProvider(
      { providerId: 'claude-bedrock', model: 'zai.glm-5', timeoutInferenceSec: 30 },
      'bounded fixture request',
      { aws: fixture.executable, env: envFor(fixture.trace) },
    );
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
  }

  const trace = JSON.parse(fs.readFileSync(fixture.trace, 'utf8'));
  assert.match(trace.requestPath, /provider temporary files with spaces/u);
  assert.equal(trace.requestUri, `file://${trace.requestPath}`);
  assert.equal(trace.requestUri.includes('%20'), false);
  assert.equal(fs.existsSync(trace.requestPath), false);
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

test('managed command preserves structured AWS error codes for gateway classification', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    runManagedCommand(fixture.executable, [], {
      timeoutMs: 5_000,
      env: envFor(fixture.trace, 'aws-error'),
    }),
    (error) => error?.code === 'AccessDeniedException' && /exited unsuccessfully/.test(error.message),
  );
});

test('Bedrock failure capture keeps only bounded service diagnostic fields and never raw stderr', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(
    executeManagedBedrockConverse({
      modelId: 'zai.glm-5', region: 'us-east-1', messages: [{ role: 'user', content: [{ text: 'private request text' }] }], maxTokens: 16, timeoutMs: 5_000,
    }, { aws: fixture.executable, env: envFor(fixture.trace, 'bedrock-validation-error') }),
    (error) => {
      assert.equal(error.message.includes('Authorization'), false);
      assert.equal(error.providerDiagnostic.providerCode, 'ValidationException');
      assert.equal(error.providerDiagnostic.providerMessage, 'Error 002: The supplied request is invalid.');
      assert.equal(error.providerDiagnostic.requestId, 'req-12345678');
      assert.equal(error.providerDiagnostic.httpStatus, 400);
      assert.equal(JSON.stringify(error).includes('never-store-this-secret'), false);
      return true;
    },
  );
});

test('managed command lifecycle records bounded success and parsed provider failure stages only', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const successEvents = [];
  await executeManagedBedrockConverse({
    modelId: 'zai.glm-5', region: 'us-east-1', messages: [{ role: 'user', content: [{ text: 'private request text' }] }], maxTokens: 16, timeoutMs: 5_000,
  }, {
    aws: fixture.executable,
    env: envFor(fixture.trace),
    onLifecycleEvent: (event) => successEvents.push(event),
  });
  assert.deepEqual(successEvents.map((event) => event.stage), [
    'provider_command_prepare', 'provider_command_spawn_start', 'provider_command_spawn_success',
    'provider_process_exit', 'provider_stderr_present',
  ]);
  assert.equal(successEvents.at(-1).stderrPresent, false);

  const failureEvents = [];
  await assert.rejects(executeManagedBedrockConverse({
    modelId: 'zai.glm-5', region: 'us-east-1', messages: [{ role: 'user', content: [{ text: 'private request text' }] }], maxTokens: 16, timeoutMs: 5_000,
  }, {
    aws: fixture.executable,
    env: envFor(fixture.trace, 'bedrock-validation-error'),
    onLifecycleEvent: (event) => failureEvents.push(event),
  }));
  assert.deepEqual(failureEvents.map((event) => event.stage), [
    'provider_command_prepare', 'provider_command_spawn_start', 'provider_command_spawn_success',
    'provider_process_exit', 'provider_stderr_present', 'provider_error_parse_start', 'provider_error_parse_success',
  ]);
  assert.equal(failureEvents.find((event) => event.stage === 'provider_stderr_present').stderrPresent, true);
  assert.equal(JSON.stringify([...successEvents, ...failureEvents]).includes('never-store-this-secret'), false);
  assert.equal(JSON.stringify([...successEvents, ...failureEvents]).includes('private request text'), false);
});

test('managed command emits bounded parse-failure facts for empty, malformed, and parser-failure stderr', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  for (const [mode, parser, expectedKind] of [
    ['nonzero', undefined, 'empty_stderr'],
    ['aws-error', (stderr) => undefined, 'malformed_error_output'],
    ['aws-error', () => { throw new Error('private parser detail'); }, 'parser_failure'],
  ]) {
    const events = [];
    await assert.rejects(runManagedCommand(fixture.executable, [], {
      timeoutMs: 5_000,
      env: envFor(fixture.trace, mode),
      ...(parser ? { failureDiagnosticParser: parser } : {}),
      onLifecycleEvent: (event) => events.push(event),
    }));
    const parseFailure = events.find((event) => event.stage === 'provider_error_parse_failure');
    assert.ok(parseFailure);
    assert.equal(parseFailure.errorKind, expectedKind);
    assert.equal(JSON.stringify(events).includes('private parser detail'), false);
  }
});

test('managed command records spawn failure and signal termination without persisting error text', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const spawnEvents = [];
  await assert.rejects(runManagedCommand(path.join(fixture.root, 'missing-provider'), [], {
    timeoutMs: 1_000,
    onLifecycleEvent: (event) => spawnEvents.push(event),
  }));
  assert.ok(spawnEvents.some((event) => event.stage === 'provider_command_spawn_failure'));

  const signalEvents = [];
  await assert.rejects(runManagedCommand(fixture.executable, [], {
    timeoutMs: 100,
    killGraceMs: 50,
    env: envFor(fixture.trace, 'hang'),
    onLifecycleEvent: (event) => signalEvents.push(event),
  }));
  assert.ok(signalEvents.some((event) => event.stage === 'provider_process_signal'));
  assert.equal(JSON.stringify([...spawnEvents, ...signalEvents]).includes('never-store-this-secret'), false);
});

test('lifecycle persistence failure before spawn fails closed without starting the provider', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(runManagedCommand(fixture.executable, [], {
    timeoutMs: 1_000,
    onLifecycleEvent: () => { throw new Error('private persistence detail'); },
  }), (error) => error.code === 'BRAIN_PROVIDER_LIFECYCLE_PERSISTENCE_FAILED' && error.providerEffectMayHaveStarted === false);
  assert.equal(fs.existsSync(fixture.trace), false);
});

test('lifecycle persistence failure after spawn is surfaced as an uncertain-effect boundary', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(runManagedCommand(fixture.executable, [], {
    timeoutMs: 1_000,
    env: envFor(fixture.trace),
    onLifecycleEvent: (event) => {
      if (event.stage === 'provider_command_spawn_success') throw new Error('private persistence detail');
    },
  }), (error) => error.code === 'BRAIN_PROVIDER_LIFECYCLE_PERSISTENCE_FAILED' && error.providerEffectMayHaveStarted === true);
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
