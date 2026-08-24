import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGitHubRepositoryEvidence } from './mind-steward-github-repository-evidence.mjs';
import { enrichGitHubRepositoryEvidence } from './mind-steward-github-repository-metadata.mjs';
import { assessGitHubRepositoryFit, buildBrainCapabilityProjection } from './mind-steward-github-repository-fit.mjs';

const repository = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one', sourceReference: 'mind/inbox/new/repo.md' });
const publicResponses = async (url) => url.endsWith('/releases/latest')
  ? { ok: true, status: 200, async json() { return { tag_name: 'v1.0.0' }; } }
  : { ok: true, status: 200, async json() { return { description: 'A TypeScript context gateway', stargazers_count: 12, language: 'TypeScript', topics: ['context', 'gateway'] }; } };

test('produces deterministic advisory fit with possible overlap and no authority', async () => {
  const evidence = await enrichGitHubRepositoryEvidence(repository, { fetchImpl: publicResponses, now: new Date('2026-08-24T12:00:00Z') });
  const capabilities = buildBrainCapabilityProjection({ capabilities: [{ capabilityId: 'context-gateway-core', displayName: 'Context Gateway Core', description: 'Deterministic context gateway for bounded retrieval', evidenceReferences: ['operations/specs/context-learning-runtime.md'] }] });
  const first = assessGitHubRepositoryFit(evidence, { systemCapabilities: capabilities });
  const second = assessGitHubRepositoryFit(evidence, { systemCapabilities: capabilities });
  assert.deepEqual(first, second);
  assert.equal(first.disposition.value, 'likely_overlap');
  assert.equal(first.disposition.advisory_only, true);
  assert.equal(first.safety.automatic_recommendation, false);
  assert.equal(first.safety.canonical_writes, false);
  assert.match(first.disposition.uncertainty.join(' '), /does not prove/);
});

test('reports potential usefulness without claiming a gap when no overlap is evidenced', async () => {
  const evidence = await enrichGitHubRepositoryEvidence(repository, { fetchImpl: publicResponses, now: new Date('2026-08-24T12:00:00Z') });
  const assessment = assessGitHubRepositoryFit(evidence, { systemCapabilities: [{ capability_id: 'video-processing', display_name: 'Video Processing', terms: ['video', 'rendering'], evidence_references: ['operations/specs/video.md'] }] });
  assert.equal(assessment.disposition.value, 'potentially_useful');
  assert.match(assessment.system_relevance.potential_gaps.join(' '), /gap is possible/);
  assert.match(assessment.disposition.uncertainty.join(' '), /not proof/);
});

test('fails closed to insufficient evidence for unavailable or stale metadata', () => {
  const unavailable = assessGitHubRepositoryFit({ ...repository, metadata_status: 'unavailable', freshness: 'unavailable', uncertainty: ['unavailable'] }, { systemCapabilities: [{ capability_id: 'context', terms: ['context', 'gateway'] }] });
  assert.equal(unavailable.disposition.value, 'insufficient_evidence');
  const stale = assessGitHubRepositoryFit({ ...repository, metadata_status: 'available', freshness: 'stale', metadata: { description: { value: 'gateway' } }, uncertainty: [] }, { systemCapabilities: [{ capability_id: 'context', terms: ['context', 'gateway'] }] });
  assert.equal(stale.disposition.value, 'insufficient_evidence');
  assert.match(stale.disposition.uncertainty.join(' '), /stale/);
});

test('does not invent comparison when canonical system capability evidence is absent', async () => {
  const evidence = await enrichGitHubRepositoryEvidence(repository, { fetchImpl: publicResponses });
  const assessment = assessGitHubRepositoryFit(evidence);
  assert.equal(assessment.disposition.value, 'insufficient_evidence');
  assert.match(assessment.disposition.uncertainty.join(' '), /canonical Brain capability projection/);
});

test('downgrades a low-signal control without penalizing small projects with corroborating signals', async () => {
  const lowSignal = await enrichGitHubRepositoryEvidence(buildGitHubRepositoryEvidence({ url: 'https://github.com/octocat/Hello-World' }), {
    fetchImpl: async (url) => url.endsWith('/releases/latest') ? { ok: false, status: 404, async json() { return {}; } } : { ok: true, status: 200, async json() { return { description: 'My first repository on GitHub!', topics: [], language: null, stargazers_count: 1 }; } },
  });
  const lowAssessment = assessGitHubRepositoryFit(lowSignal, { systemCapabilities: [{ capability_id: 'context', terms: ['context', 'gateway'] }] });
  assert.equal(lowAssessment.disposition.value, 'likely_low_value');
  assert.ok(lowAssessment.evidence_quality.negative_evidence.length > 0);
  const smallProject = await enrichGitHubRepositoryEvidence(buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' }), {
    fetchImpl: async (url) => url.endsWith('/releases/latest') ? { ok: false, status: 404, async json() { return {}; } } : { ok: true, status: 200, async json() { return { description: 'Small focused tool', topics: ['context'], language: 'TypeScript', stargazers_count: 1 }; } },
  });
  const smallAssessment = assessGitHubRepositoryFit(smallProject, { systemCapabilities: [{ capability_id: 'video', terms: ['video', 'rendering'] }] });
  assert.equal(smallAssessment.disposition.value, 'potentially_useful');
});
