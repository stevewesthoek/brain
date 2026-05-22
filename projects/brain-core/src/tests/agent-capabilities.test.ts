import test from 'node:test';
import assert from 'node:assert/strict';
import { listAgentCapabilities } from '../adapters/agent-capabilities.js';

test('listAgentCapabilities returns the seeded registry', () => {
  const capabilities = listAgentCapabilities();
  const ids = capabilities.map((capability) => capability.id);

  assert.equal(capabilities.length, 14);
  assert.equal(new Set(ids).size, ids.length);

  for (const requiredId of [
    'skill.code',
    'skill.design',
    'skill.research',
    'skill.web',
    'skill.video',
    'ai.ollama-m4pro',
    'ai.ollama-m1',
    'ai.codex-cli',
    'ai.claude-bedrock',
    'cli.cloudflare',
    'cli.dokploy',
    'cli.aws',
    'cli.azure',
    'cli.github',
  ]) {
    assert.ok(ids.includes(requiredId), `missing capability ${requiredId}`);
  }

  for (const capability of capabilities) {
    assert.equal(typeof capability.label, 'string');
    assert.notEqual(capability.label.trim(), '');
    assert.equal(typeof capability.description, 'string');
    assert.notEqual(capability.description.trim(), '');
    assert.equal(typeof capability.source, 'string');
    assert.notEqual(capability.source.trim(), '');
    assert.ok(
      ['skill', 'cli', 'ai_surface', 'service', 'workflow'].includes(capability.kind),
      `invalid kind for ${capability.id}`,
    );
    assert.ok(
      ['read_only', 'local_write', 'repo_write', 'external_state', 'credential_sensitive', 'destructive', 'financial'].includes(capability.safetyClass),
      `invalid safety class for ${capability.id}`,
    );
    assert.ok(Array.isArray(capability.requiresApprovalFor));
    assert.ok(Array.isArray(capability.preferredAiTaskTypes));
    assert.ok(Array.isArray(capability.verification));
    assert.ok(capability.verification.length > 0, `verification missing for ${capability.id}`);
    assert.equal(typeof capability.enabled, 'boolean');
  }
});

test('external-state capabilities require approval for stateful actions', () => {
  const capabilities = listAgentCapabilities();
  const externalStateCapabilities = capabilities.filter((capability) => capability.safetyClass === 'external_state');

  assert.ok(externalStateCapabilities.length > 0);

  for (const capability of externalStateCapabilities) {
    assert.ok(
      capability.requiresApprovalFor.some((action) =>
        ['deploy', 'dns_change', 'external_state', 'credential_sensitive'].includes(action),
      ),
      `${capability.id} should require approval for stateful actions`,
    );
  }
});

test('AI surfaces are ordered by priority', () => {
  const capabilities = listAgentCapabilities();
  const aiSurfaces = capabilities.filter((capability) => capability.kind === 'ai_surface');
  const priorities = aiSurfaces.map((capability) => capability.priority ?? Number.MAX_SAFE_INTEGER);

  assert.deepEqual([...priorities].sort((left, right) => left - right), priorities);
});
