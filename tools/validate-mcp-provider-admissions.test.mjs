import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { validateAdmissionRegistry } from './validate-mcp-provider-admissions.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mcp-admission-'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/server.js'), 'server');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sha256 = crypto.createHash('sha256').update('server').digest('hex');
  const registry = {
    schemaVersion: '1.0.0', reviewedAt: '2026-07-15', admissions: [{
      admissionId: 'example-provider', status: 'active-local', owner: 'brain-runtime', consumer: 'brain',
      provider: { providerId: 'example', repository: 'example/provider', revision, sourceState: 'committed', version: '1.0.0', entrypoint: 'dist/server.js', artifacts: [{ path: 'dist/server.js', sha256 }] },
      transport: { kind: 'stdio', serverName: 'example', projectScoped: true, shell: false, networkPolicy: 'loopback-only' },
      authentication: { mode: 'derived-credential-file', credentialFileEnvironmentVariable: 'EXAMPLE_CREDENTIAL_FILE', principal: 'example-principal', audience: 'example-api', storage: 'outside-repositories-owner-only', relayAllowed: false },
      scope: { toolAllowlistEnvironmentVariable: 'EXAMPLE_ALLOWED_TOOLS', suboperationAllowlistEnvironmentVariable: 'EXAMPLE_ALLOWED_OPERATIONS', tools: [{ name: 'readStatus', risk: 'read', approval: 'none', allowedSuboperations: [] }] },
      limits: { startupTimeoutSeconds: 10, toolTimeoutSeconds: 30, maxRequestBytes: 65536, maxResponseBytes: 65536 },
      verification: { commands: ['node --test'], evidence: ['fixture'] },
      revocation: { procedure: 'Remove the project registration.', preserveEvidence: true }
    }]
  };
  return { root, registry };
}

test('validates identity, scope, and pinned provider artifacts', () => {
  const item = fixture();
  assert.deepEqual(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }), []);
  fs.writeFileSync(path.join(item.root, 'dist/server.js'), 'tampered');
  assert(validateAdmissionRegistry(item.registry, { providerRoots: new Map([['example', item.root]]) }).some((error) => error.includes('digest mismatch')));
  fs.rmSync(item.root, { recursive: true });
});

test('rejects embedded secret values and unapproved mutations', () => {
  const item = fixture();
  item.registry.admissions[0].authentication.token = 'forbidden';
  item.registry.admissions[0].scope.tools.push({ name: 'writeFile', risk: 'write', approval: 'none', allowedSuboperations: [] });
  const errors = validateAdmissionRegistry(item.registry);
  assert(errors.some((error) => error.includes('secret values are forbidden')));
  assert(errors.some((error) => error.includes('mutation requires approval')));
  fs.rmSync(item.root, { recursive: true });
});
