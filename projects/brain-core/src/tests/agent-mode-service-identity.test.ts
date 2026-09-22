import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, brainServiceContentSha256, signBrainServiceRequest } from '../security/brain-service-auth.js';
import { brainServiceSecretCandidates, resolveBrainServiceIdentity } from '../agent-mode/service-identity.js';

const SERVICE_ID = 'service:brain-console';
const SECRET = 'rc8-package-layout-fixture-secret';

test('installed CLI derives the external secret path from install metadata without BRAIN_SECRETS_FILE', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-rc8-service-identity-'));
  const installRoot = path.join(root, 'install');
  const packageId = 'brain-runtime-package:sha256:rc8-fixture';
  const releaseRoot = path.join(installRoot, 'releases', packageId);
  const externalConfigRoot = path.join(root, 'external-config');
  const secretsPath = path.join(externalConfigRoot, 'secrets.env');
  const configPath = path.join(externalConfigRoot, 'brain-runtime-config.json');
  const repositoryRoot = path.join(root, 'Repos', 'fixture');
  mkdirSync(path.join(releaseRoot, 'core'), { recursive: true });
  mkdirSync(path.join(installRoot, 'releases', 'tools'), { recursive: true });
  mkdirSync(path.join(installRoot, 'releases', 'tools', 'infrastructure-catalog'), { recursive: true });
  mkdirSync(path.join(installRoot, 'releases', 'tools', 'context-learning'), { recursive: true });
  mkdirSync(path.join(installRoot, 'releases', 'operations', 'specs'), { recursive: true });
  mkdirSync(externalConfigRoot, { recursive: true });
  mkdirSync(path.join(repositoryRoot, '.git'), { recursive: true });
  cpSync(path.join(process.cwd(), 'dist'), path.join(releaseRoot, 'core', 'dist'), { recursive: true });
  cpSync(path.join(process.cwd(), '..', '..', 'tools', 'mind-canonical-path-registry.mjs'), path.join(installRoot, 'releases', 'tools', 'mind-canonical-path-registry.mjs'));
  cpSync(path.join(process.cwd(), '..', '..', 'tools', 'infrastructure-catalog', 'governance-core.mjs'), path.join(installRoot, 'releases', 'tools', 'infrastructure-catalog', 'governance-core.mjs'));
  cpSync(path.join(process.cwd(), '..', '..', 'tools', 'context-learning', 'context-learning-core.mjs'), path.join(installRoot, 'releases', 'tools', 'context-learning', 'context-learning-core.mjs'));
  cpSync(path.join(process.cwd(), '..', '..', 'operations', 'specs', 'infinite-brain-boundary-contracts.js'), path.join(installRoot, 'releases', 'operations', 'specs', 'infinite-brain-boundary-contracts.js'));
  cpSync(path.join(process.cwd(), '..', '..', 'operations', 'specs', 'infinite-brain-path-registry.json'), path.join(installRoot, 'releases', 'operations', 'specs', 'infinite-brain-path-registry.json'));
  writeFileSync(secretsPath, `BRAIN_CORE_SERVICE_ID=${SERVICE_ID}\nBRAIN_CORE_SERVICE_SECRET=${SECRET}\n`, { mode: 0o600 });
  chmodSync(secretsPath, 0o600);
  writeFileSync(configPath, JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', repositoryRoots: [path.dirname(repositoryRoot)] }));
  writeFileSync(path.join(installRoot, 'install.json'), JSON.stringify({ packageId, releaseRoot, configPath }));
  const cliPath = path.join(releaseRoot, 'core', 'dist', 'bin', 'brain-agent.js');
  const candidates = brainServiceSecretCandidates({ argvPath: cliPath, env: { HOME: root } });
  assert.ok(candidates.includes(secretsPath));
  assert.deepEqual(resolveBrainServiceIdentity({ argvPath: cliPath, env: { HOME: root } }), { serviceId: SERVICE_ID, secret: SECRET });

  let receivedHeaders: Record<string, string | string[] | undefined> = {};
  let receivedBody = '';
  const server = createServer((request, response) => {
    const input = request as unknown as { headers: Record<string, string | string[] | undefined>; setEncoding: (encoding: BufferEncoding) => void; on: (event: string, listener: (chunk?: string) => void) => void };
    if (request.method === 'POST') receivedHeaders = input.headers;
    input.setEncoding('utf8');
    input.on('data', (chunk) => { if (request.method === 'POST') receivedBody += chunk ?? ''; });
    input.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        result: { receipt: { rootGoalId: 'root:fixture', rootRunId: 'run:fixture' } },
        status: {
          schemaVersion: 'agent-mode.terminal-intake.v1', rootGoalId: 'root:fixture', taskId: 'task:fixture', rootRunId: 'run:fixture', status: 'completed',
          childAgentId: null, childTaskId: null, childRunId: null, attemptId: null, resultText: 'fixture completed', resultRef: null, evidenceRef: null, reasonCode: null,
          workerCount: 1, runtimeRef: null, runtimeProfileRef: null, modelRef: null, requestedModel: 'auto', repositoryRef: 'fixture/fixture', startedAt: null, elapsedMs: 0,
          safeActivity: null, lastActivityAt: null, activity: [], telemetry: null, updatedAt: null,
        },
      }));
    });
  });
  const listener = server as unknown as { listen(port: number, host: string): void; on(event: string, callback: () => void): void; address(): AddressInfo; close(callback: () => void): void };
  await new Promise<void>((resolve, reject) => {
    listener.on('listening', resolve);
    listener.on('error', reject);
    listener.listen(0, '127.0.0.1');
  });
  const address = listener.address();
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: root, BRAIN_CORE_URL: `http://127.0.0.1:${address.port}` };
  delete env.BRAIN_SECRETS_FILE;
  delete env.BRAIN_CORE_SERVICE_ID;
  delete env.BRAIN_CORE_SERVICE_SECRET;
  delete env.BRAIN_RUNTIME_CONFIG_PATH;
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath, 'submit', '--model', 'auto', '--repository-ref', 'fixture/fixture', '--repository-root', repositoryRoot, '--task', 'Report the repository name and current git branch. Do not modify anything.', '--core-url', `http://127.0.0.1:${address.port}`, '--json'], { env });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code: number | null) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `packaged CLI exited with ${String(code)}`)));
    });
    const payload = JSON.parse(output) as { status?: { status?: string } };
    assert.equal(payload.status?.status, 'completed');
    const requestId = String(receivedHeaders['x-brain-request-id']);
    const timestamp = String(receivedHeaders['x-brain-request-timestamp']);
    const digest = brainServiceContentSha256(receivedBody);
    assert.equal(receivedHeaders['x-brain-auth-version'], BRAIN_SERVICE_AUTH_PROTOCOL_VERSION);
    assert.equal(receivedHeaders['x-brain-service-id'], SERVICE_ID);
    assert.equal(receivedHeaders['x-brain-content-sha256'], digest);
    assert.equal(receivedHeaders['x-brain-signature'], signBrainServiceRequest({ serviceId: SERVICE_ID, secret: SECRET, method: 'POST', pathname: '/agent-mode/terminal/intake', requestId, timestamp, contentSha256: digest }));
  } finally {
    await new Promise<void>((resolve) => listener.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});

test('service identity rejects group/other-readable external secret files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-rc8-service-identity-perms-'));
  const secretsPath = path.join(root, 'secrets.env');
  writeFileSync(secretsPath, `BRAIN_CORE_SERVICE_ID=${SERVICE_ID}\nBRAIN_CORE_SERVICE_SECRET=${SECRET}\n`, { mode: 0o644 });
  try {
    assert.throws(() => resolveBrainServiceIdentity({ env: { BRAIN_SECRETS_FILE: secretsPath } }), /permissions/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
