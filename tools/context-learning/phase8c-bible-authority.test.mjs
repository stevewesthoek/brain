import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { BIBLE_AUTHORITY_SOURCE_CATALOG, BIBLE_SOURCE_AUTHORITY_POLICY, runResearchOutput } from './research-control-plane.mjs';
import { cases } from './run-phase8c-bible-source-authority.mjs';

const catalog = createCapabilityCatalog({ sourceRevision: 'phase8c-test' });
const okFetch = async (url) => new Response(`bounded evidence for ${url}`, { status: 200, headers: { 'content-type': 'text/plain' } });

test('Phase 8C has the required Bible case families and volume', () => {
  const rows = cases();
  const counts = Object.fromEntries([...new Set(rows.map((row) => row.family))].map((family) => [family, rows.filter((row) => row.family === family).length]));
  assert.equal(rows.length, 70);
  assert.ok(counts.TEXTUAL_CRITICAL >= 10);
  assert.ok(counts.GREEK_HEBREW >= 15);
  assert.ok(counts.SCHOLARLY_EXEGESIS >= 15);
  assert.ok(counts.SCHOLARLY_DISAGREEMENT >= 10);
  assert.ok(counts.HISTORICAL_CULTURAL >= 10);
  assert.ok(counts.CANONICAL_THEOLOGICAL >= 10);
});

test('Bible authority catalog records access and authority distinctions', () => {
  const byId = new Map(BIBLE_AUTHORITY_SOURCE_CATALOG.map((source) => [source.sourceId, source]));
  assert.equal(byId.get('sblgnt-critical-text').sourceType, 'CRITICAL_TEXT');
  assert.equal(byId.get('sblgnt-critical-text').accessLevel, 'FULL_TEXT_VERIFIED');
  assert.equal(byId.get('sblgnt-critical-text').licenseConstraint.includes('CC BY 4.0'), true);
  assert.equal(byId.get('mdpi-biblical-textual-criticism').peerReviewStatus, 'VERIFIED');
  assert.equal(byId.get('crossref-biblical-scholarship').accessLevel, 'ABSTRACT/METADATA_ONLY');
  assert.equal(byId.get('oshb-hebrew-text-morphology').criticalEditionStatus, 'NOT_CRITICAL');
  assert.equal(byId.get('intf-ntvmr').accessLevel, 'REFERENCE_IDENTIFIED');
  assert.deepEqual(BIBLE_SOURCE_AUTHORITY_POLICY.TEXTUAL_EVIDENCE.disallowedSoleSources, ['TRANSLATION', 'LEXICAL_AID']);
});

test('authority metadata survives evidence-packet validation without raw bodies', async () => {
  const sourceSpecs = BIBLE_AUTHORITY_SOURCE_CATALOG.filter((source) => ['sblgnt-critical-text', 'mdpi-biblical-textual-criticism', 'crossref-biblical-scholarship'].includes(source.sourceId));
  const result = await runResearchOutput({ taskId: 'phase8c-packet-shape', topic: 'phase8c-packet-shape', category: 'bible', sourceSpecs, sourceRevision: 'phase8c-test', retrievedAt: '2026-09-03T00:00:00.000Z', freshnessRequirement: 'archival', specialist: true, catalog, fetchImpl: okFetch });
  assert.deepEqual(result.errors, []);
  assert.equal(result.packet.execution.mode, 'research_read_only');
  assert.equal(result.sourceRecords.every((source) => source.accessLevel && source.sourceType && source.claimTypes && source.editionVersion), true);
  assert.equal(result.sourceRecords.some((source) => source.accessLevel === 'ABSTRACT/METADATA_ONLY'), true);
  assert.equal(result.sourceRecords.some((source) => Object.hasOwn(source, 'rawBody')), false);
});
