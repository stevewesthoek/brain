import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { makeNewCohort } from './run-phase8b-research-promotion-readiness.mjs';
import { runResearchOutput } from './research-control-plane.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;
const catalog = createCapabilityCatalog({ repoRoot });
const okFetch = async (url) => new Response(`<html><body>Bounded evidence for ${url}</body></html>`, { status: 200 });

test('Phase 8B cohort contains 150 new unique cases across required distributions', () => {
  const cohort = makeNewCohort();
  assert.equal(cohort.length, 150);
  assert.equal(new Set(cohort.map((item) => item.id)).size, 150);
  assert.equal(new Set(cohort.map((item) => item.prompt)).size, 150);
  assert.ok(cohort.filter((item) => item.category === 'BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL').length >= 12);
  assert.ok(cohort.filter((item) => item.category === 'CONTRADICTION_FACT_CHECK').length >= 5);
});

test('Research evidence records citation, independence, freshness, and question bounds', async () => {
  const result = await runResearchOutput({ taskId: 'phase8b-evidence-shape', topic: 'phase8b-evidence-shape', category: 'technical', question: 'What does the bounded source set establish?', subquestions: ['Which source is primary?', 'What remains uncertain?'], sourceRevision: 'test-revision', catalog, fetchImpl: okFetch, retrievedAt: '2026-09-02T00:00:00.000Z', extraRequest: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.packet.research.question, 'What does the bounded source set establish?');
  assert.equal(result.packet.research.subquestions.length, 2);
  assert.ok(result.packet.research.citationChecks.every((item) => item.passed && item.claimBoundedByEvidence));
  assert.ok(result.packet.research.sourceIndependence.independentSourceCount >= 1);
  assert.equal(result.packet.research.freshness.currentEnough, true);
  assert.equal(result.packet.research.deepening.additionalRequests.length, 1);
});

test('Stale and unavailable evidence remain visibly insufficient', async () => {
  const stale = await runResearchOutput({ taskId: 'phase8b-stale', topic: 'phase8b-stale', category: 'technical', sourceRevision: 'test-revision', catalog, fetchImpl: okFetch, retrievedAt: '2026-09-02T00:00:00.000Z', stale: true });
  const unavailable = await runResearchOutput({ taskId: 'phase8b-unavailable', topic: 'phase8b-unavailable', category: 'technical', sourceRevision: 'test-revision', catalog, fetchImpl: async () => new Response('', { status: 503 }), retrievedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(stale.packet.status, 'INCOMPLETE');
  assert.equal(stale.packet.research.freshness.currentEnough, false);
  assert.equal(unavailable.packet.status, 'INCOMPLETE');
  assert.ok(unavailable.packet.claims.some((claim) => /EVIDENCE_INSUFFICIENT/i.test(claim.statement)));
  assert.ok(unavailable.packet.research.citationChecks.every((item) => item.passed === false));
});
