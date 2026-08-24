import assert from 'node:assert/strict';
import test from 'node:test';
import { assertUniqueGitHubRepositoryIdentities, buildGitHubRepositoryEvidence, extractGitHubRepositoryUrls, parseGitHubRepositoryUrl } from './mind-steward-github-repository-evidence.mjs';

test('parses and canonicalizes a valid GitHub repository URL', () => {
  assert.deepEqual(parseGitHubRepositoryUrl('https://github.com/Steve/Brain.git/'), { canonical_url: 'https://github.com/Steve/Brain', repository_id: 'steve/brain', owner: 'Steve', name: 'Brain' });
  assert.equal(parseGitHubRepositoryUrl('https://gitlab.com/steve/brain'), null);
});

test('extracts bounded repository references without fetching them', () => {
  assert.deepEqual(extractGitHubRepositoryUrls('See https://github.com/a/one and https://github.com/a/one#readme plus https://github.com/b/two.'), ['https://github.com/a/one', 'https://github.com/b/two']);
});

test('creates review-required evidence with unknown metadata and safe boundaries', () => {
  const evidence = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one', sourceReference: 'mind/inbox/new/repo.md', sourceHash: 'sha256:abc', ingestionId: 'ingestion:1', retrievedAt: 'fixed' });
  assert.equal(evidence.repository.repository_id, 'a/one');
  assert.equal(evidence.description, null);
  assert.equal(evidence.review_required, true);
  assert.match(evidence.uncertainty.join(' '), /metadata was not fetched/);
  assert.equal(evidence.safety.repository_execution, false);
});

test('preserves supplied advisory metadata without making a decision', () => {
  const evidence = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one', metadata: { description: 'Example', technology_indicators: ['TypeScript'], licensing: 'MIT', confidence: 0.8 } });
  assert.equal(evidence.description, 'Example');
  assert.deepEqual(evidence.technology_indicators, ['TypeScript']);
  assert.equal(evidence.licensing, 'MIT');
  assert.equal(evidence.safety.automatic_adoption, false);
});

test('fails closed on invalid and duplicate repository identities', () => {
  assert.throws(() => buildGitHubRepositoryEvidence({ url: 'https://example.com/a/one' }), /invalid_github_repository_url/);
  const first = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' });
  const second = buildGitHubRepositoryEvidence({ url: 'https://github.com/A/ONE.git' });
  assert.throws(() => assertUniqueGitHubRepositoryIdentities([first, second]), /duplicate_github_repository_identity/);
  assert.equal(assertUniqueGitHubRepositoryIdentities([]), true);
});
