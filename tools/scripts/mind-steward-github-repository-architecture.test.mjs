import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGitHubRepositoryEvidence } from './mind-steward-github-repository-evidence.mjs';
import { enrichGitHubRepositoryDocumentation } from './mind-steward-github-repository-documentation.mjs';

function response(status, body) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }
function readme(markdown) { return { content: Buffer.from(markdown, 'utf8').toString('base64'), html_url: 'https://github.com/a/one#readme' }; }
function evidence() { return buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' }); }

test('extracts documented architecture, interfaces, deployment, and operations only', async () => {
  const result = await enrichGitHubRepositoryDocumentation(evidence(), { includeArchitecture: true, fetchImpl: async () => response(200, readme('# Tool\n\nA documented tool.\n\n## Architecture\n- API service\n- Worker\n\n## API\n- REST endpoint\n\n## Deployment\n- Docker\n\n## Environments\n- Linux\n\n## Operations\n- Metrics')) });
  assert.equal(result.architecture_status, 'available');
  assert.deepEqual(result.architecture_evidence.signals.architectural_components.value, ['API service', 'Worker']);
  assert.deepEqual(result.architecture_evidence.signals.interfaces_apis.value, ['REST endpoint']);
  assert.deepEqual(result.architecture_evidence.signals.deployment_model.value, ['Docker']);
  assert.equal(result.architecture_evidence.safety.source_inspection, false);
});

test('keeps undocumented architecture unknown', async () => {
  const result = await enrichGitHubRepositoryDocumentation(evidence(), { includeArchitecture: true, fetchImpl: async () => response(200, readme('# Tool\n\nA documented tool.')) });
  assert.equal(result.architecture_status, 'available');
  assert.equal(result.architecture_evidence.signals.architectural_components.value, null);
  assert.ok(result.architecture_evidence.signals.architectural_components.uncertainty.length > 0);
});

test('architecture failures and stale sources remain visible', async () => {
  const unavailable = await enrichGitHubRepositoryDocumentation(evidence(), { includeArchitecture: true, fetchImpl: async () => response(404, {}) });
  assert.equal(unavailable.documentation_status, 'unavailable');
  assert.equal(unavailable.architecture_status, undefined);
  const stale = await enrichGitHubRepositoryDocumentation(evidence(), { includeArchitecture: true, now: new Date('2026-08-24T12:00:00Z'), retrievedAt: '2026-08-20T00:00:00Z', fetchImpl: async () => response(200, readme('# Architecture\n\n## Architecture\n- Service')) });
  assert.equal(stale.architecture_evidence.freshness, 'stale');
  assert.match(stale.architecture_evidence.uncertainty.join(' '), /older than/);
});
