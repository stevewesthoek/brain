import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGitHubRepositoryEvidence } from './mind-steward-github-repository-evidence.mjs';
import { enrichGitHubRepositoryDocumentation } from './mind-steward-github-repository-documentation.mjs';
import { assessGitHubRepositoryFit } from './mind-steward-github-repository-fit.mjs';

function response(status, body) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }
function readmeBody(markdown) { return { content: Buffer.from(markdown, 'utf8').toString('base64'), html_url: 'https://github.com/a/one#readme' }; }
function evidence() { return buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one', sourceReference: 'mind/inbox/new/repo.md' }); }

test('extracts bounded README purpose and documented signals with provenance', async () => {
  const result = await enrichGitHubRepositoryDocumentation(evidence(), { fetchImpl: async () => response(200, readmeBody('# Example Gateway\n\nA focused context gateway for teams.\n\n## Features\n- Resolve context packs\n- Explain source evidence\n\n## Integrations\n- MCP\n\n## Limitations\n- Fixture-only')) });
  assert.equal(result.documentation_status, 'available');
  assert.equal(result.documentation_evidence.stated_purpose.value, 'A focused context gateway for teams.');
  assert.deepEqual(result.documentation_evidence.main_capabilities.value, ['Resolve context packs', 'Explain source evidence']);
  assert.deepEqual(result.documentation_evidence.integration_points.value, ['MCP']);
  assert.equal(result.documentation_evidence.stated_purpose.provenance.source, 'https://api.github.com/repos/a/one/readme');
  assert.equal(result.safety.repository_execution, false);
});

test('preserves minimal README uncertainty and does not invent capabilities', async () => {
  const result = await enrichGitHubRepositoryDocumentation(evidence(), { fetchImpl: async () => response(200, readmeBody('# Demo\n\nHello.')) });
  assert.equal(result.documentation_status, 'available');
  assert.deepEqual(result.documentation_evidence.main_capabilities.value, []);
  assert.ok(result.documentation_evidence.main_capabilities.uncertainty.length > 0);
  const fit = assessGitHubRepositoryFit(result, { systemCapabilities: [{ capability_id: 'context', terms: ['context', 'gateway'] }] });
  assert.equal(fit.disposition.value, 'insufficient_evidence');
  assert.ok(fit.evidence_quality.missing_evidence.includes('documented capabilities'));
});

test('fails closed for unavailable and stale documentation', async () => {
  const unavailable = await enrichGitHubRepositoryDocumentation(evidence(), { fetchImpl: async () => response(404, {}) });
  assert.equal(unavailable.documentation_status, 'unavailable');
  assert.equal(unavailable.documentation_evidence.stated_purpose.value, null);
  const stale = await enrichGitHubRepositoryDocumentation(evidence(), { fetchImpl: async () => response(200, readmeBody('# Old\n\nA documented tool for context.')), now: new Date('2026-08-24T12:00:00Z'), retrievedAt: '2026-08-20T00:00:00Z' });
  assert.equal(stale.documentation_status, 'available');
  assert.equal(stale.documentation_freshness, 'stale');
  assert.match(stale.uncertainty.join(' '), /older than/);
});

test('treats misleading documentation as documented text, not verified fact', async () => {
  const result = await enrichGitHubRepositoryDocumentation(evidence(), { fetchImpl: async () => response(200, readmeBody('# Magic\n\nThis solves everything.')) });
  assert.equal(result.documentation_evidence.stated_purpose.value, 'This solves everything.');
  assert.equal(result.documentation_evidence.stated_purpose.confidence, 0.85);
  assert.equal(result.documentation_evidence.main_capabilities.value.length, 0);
});
