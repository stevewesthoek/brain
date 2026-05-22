import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listAgentCapabilities, readSkillFrontmatter } from '../adapters/agent-capabilities.js';
import { listAgentCliCapabilities } from '../adapters/agent-cli-capability-manifest.js';

test('listAgentCapabilities returns the seeded registry', async () => {
  const capabilities = await listAgentCapabilities();
  const ids = capabilities.map((capability) => capability.id);

  assert.equal(capabilities.length, 20);
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
    'cli.gcp',
    'cli.hetzner',
    'cli.tailscale',
    'cli.stripe',
    'cli.n8n',
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

test('external-state capabilities require approval for stateful actions', async () => {
  const capabilities = await listAgentCapabilities();
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

test('AI surfaces are ordered by priority', async () => {
  const capabilities = await listAgentCapabilities();
  const aiSurfaces = capabilities.filter((capability) => capability.kind === 'ai_surface');
  const priorities = aiSurfaces.map((capability) => capability.priority ?? Number.MAX_SAFE_INTEGER);

  assert.deepEqual([...priorities].sort((left, right) => left - right), priorities);
});

test('CLI capability manifest is normalized and approval-gated', () => {
  const capabilities = listAgentCliCapabilities();

  assert.equal(capabilities.length, 10);
  assert.deepEqual(
    capabilities.map((capability) => capability.id),
    [
      'cli.cloudflare',
      'cli.dokploy',
      'cli.aws',
      'cli.azure',
      'cli.gcp',
      'cli.hetzner',
      'cli.tailscale',
      'cli.stripe',
      'cli.n8n',
      'cli.github',
    ],
  );

  for (const capability of capabilities) {
    assert.equal(capability.kind, 'cli');
    assert.equal(typeof capability.label, 'string');
    assert.notEqual(capability.label.trim(), '');
    assert.ok(capability.requiresApprovalFor.length > 0, `${capability.id} should require approval`);
    assert.ok(capability.verification.length > 0, `${capability.id} should have verification`);
  }
});

test('skill capability metadata is enriched from live frontmatter when available', async () => {
  const capabilities = await listAgentCapabilities();
  const codeCapability = capabilities.find((capability) => capability.id === 'skill.code');

  assert.ok(codeCapability);
  assert.equal(codeCapability?.label, 'code');
  assert.match(codeCapability?.description ?? '', /single entry point for all coding work/i);
});

test('skill capability metadata falls back when a skill file is unavailable', async () => {
  const missingSkillsRoot = path.join(process.cwd(), '.tmp-missing-skills-root');
  const metadata = readSkillFrontmatter('design', missingSkillsRoot);
  const capabilities = await listAgentCapabilities(missingSkillsRoot);
  const designCapability = capabilities.find((capability) => capability.id === 'skill.design');

  assert.equal(metadata, null);
  assert.ok(designCapability);
  assert.equal(designCapability?.label, 'Design Orchestrator');
  assert.match(designCapability?.description ?? '', /routes design, layout, and ui work/i);
});
