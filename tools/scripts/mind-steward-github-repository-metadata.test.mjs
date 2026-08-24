import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGitHubRepositoryEvidence } from './mind-steward-github-repository-evidence.mjs';
import { enrichGitHubRepositoryEvidence } from './mind-steward-github-repository-metadata.mjs';

function evidence() {
  return buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one', sourceReference: 'mind/inbox/new/repo.md' });
}

function fetchSequence(responses) {
  let index = 0;
  return async () => responses[index++];
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test('enriches public repository metadata with field-level provenance', async () => {
  const result = await enrichGitHubRepositoryEvidence(evidence(), {
    fetchImpl: fetchSequence([
      response(200, { description: 'Example', stargazers_count: 4, forks_count: 2, subscribers_count: 3, updated_at: '2026-08-24T00:00:00Z', pushed_at: '2026-08-23T00:00:00Z', open_issues_count: 1, language: 'TypeScript', topics: ['brain'], license: { key: 'mit', name: 'MIT', spdx_id: 'MIT' } }),
      response(200, { tag_name: 'v1.0.0', published_at: '2026-08-20T00:00:00Z', html_url: 'https://github.com/a/one/releases/tag/v1.0.0' }),
    ]),
    now: new Date('2026-08-24T12:00:00Z'),
  });
  assert.equal(result.metadata_status, 'available');
  assert.equal(result.metadata.stars.value, 4);
  assert.equal(result.metadata.last_release.value.tag_name, 'v1.0.0');
  for (const item of Object.values(result.metadata)) {
    assert.equal(item.provenance.source, item.source);
    assert.equal(item.provenance.retrieved_at, item.retrieved_at);
  }
  assert.equal(result.safety.repository_execution, false);
});

test('fails closed for private, deleted, and rate-limited repositories', async () => {
  for (const status of [404, 429]) {
    const result = await enrichGitHubRepositoryEvidence(evidence(), { fetchImpl: async () => response(status, {}) });
    assert.equal(result.metadata_status, 'unavailable');
    assert.equal(result.metadata.stars.value, null);
    assert.match(result.uncertainty.join(' '), status === 404 ? /private|deleted/ : /rate limited/);
  }
});

test('keeps network failures visible without promotion or adoption', async () => {
  const result = await enrichGitHubRepositoryEvidence(evidence(), { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.metadata_status, 'unavailable');
  assert.equal(result.safety.automatic_adoption, false);
  assert.equal(result.review_required, true);
});

test('marks supplied retrieval time stale without hiding the metadata', async () => {
  const result = await enrichGitHubRepositoryEvidence(evidence(), {
    fetchImpl: fetchSequence([response(200, { stargazers_count: 1 }), response(404, {})]),
    now: new Date('2026-08-24T12:00:00Z'),
    retrievedAt: '2026-08-20T00:00:00Z',
    staleAfterMs: 24 * 60 * 60 * 1000,
  });
  assert.equal(result.metadata_status, 'available');
  assert.equal(result.freshness, 'stale');
  assert.match(result.uncertainty.join(' '), /older than/);
  assert.equal(result.metadata.stars.retrieved_at, '2026-08-20T00:00:00Z');
});

test('does not fetch when no fetch implementation is available', async () => {
  const result = await enrichGitHubRepositoryEvidence(evidence(), { fetchImpl: null });
  assert.equal(result.metadata_status, 'unavailable');
  assert.match(result.uncertainty.join(' '), /unavailable/);
});
