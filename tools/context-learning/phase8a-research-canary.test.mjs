import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateJsonSchema } from './context-learning-core.mjs';
import { createCodexResearchAdapter } from './codex-research-consumer-adapter.mjs';
import { runResearchOutput } from './research-control-plane.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, rollbackUniversalConsumerCanary, runUniversalConsumerCanaryInvocation } from './universal-consumer-canary.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const catalog = createCapabilityCatalog({ repoRoot });
const okFetch = async (url) => new Response(`<html><title>${url}</title><body>Authoritative source evidence for the bounded research question.</body></html>`, { status: 200 });

test('Codex Research adapter is thin and routes through the universal Brain contract', () => {
  const adapter = createCodexResearchAdapter();
  const result = adapter.consume('Read-only research of current public evidence with citations.', {}, { catalog, repoRoot });
  assert.equal(result.route.primaryRouteFamily, 'research');
  assert.equal(result.route.primaryDescriptorId, 'skill.research');
  assert.equal(result.safety.providerCalls, 0);
  assert.equal(result.safety.writesPerformed, 0);
  assert.equal(adapter.adapterId, 'adapter.codex-research.v1');
});

test('Research evidence preserves provenance, layers, deepening, and contradiction state', async () => {
  const output = await runResearchOutput({ taskId: 'phase8a-test', topic: 'contradiction', category: 'technical', sourceRevision: 'test-revision', catalog, fetchImpl: okFetch, retrievedAt: '2026-09-02T00:00:00.000Z', contradiction: true, extraRequest: true });
  assert.deepEqual(output.errors, []);
  assert.equal(output.packet.execution.mode, 'research_read_only');
  assert.equal(output.packet.research.deepening.additionalRequests.length, 1);
  assert.equal(output.packet.research.deepening.additionalRequests[0].atomic, true);
  assert.equal(output.packet.conflicts.length, 1);
  assert.ok(output.packet.research.sourceRecords.every((source) => source.retrievedAt && source.contentDigest && source.sourceClass));
  assert.deepEqual(output.packet.research.evidenceLayers.slice(0, 4), ['SOURCE', 'EXTRACTED_EVIDENCE', 'INTERPRETATION', 'CONCLUSION']);
});

test('Unavailable source method degrades visibly without fabricated evidence', async () => {
  const output = await runResearchOutput({ taskId: 'phase8a-failure-test', topic: 'unavailable', category: 'technical', sourceRevision: 'test-revision', catalog, fetchImpl: async () => new Response('', { status: 503 }), retrievedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(output.packet.status, 'INCOMPLETE');
  assert.ok(output.packet.uncertainties.some((item) => /unavailable|failed/i.test(item)));
  assert.ok(output.packet.claims.every((claim) => claim.confidence === 0 || claim.sourceRefs.length > 0));
});

test('Source acquisition rejects non-allowlisted or non-HTTPS targets before fetching', async () => {
  let calls = 0;
  const output = await runResearchOutput({ taskId: 'phase8a-ssrf-test', topic: 'blocked-target', category: 'technical', sourceRevision: 'test-revision', catalog, sourceSpecs: [{ sourceId: 'blocked-target', title: 'Blocked target', publisher: 'Test', sourceClass: 'SUPPLEMENTARY', url: 'http://127.0.0.1/private', marker: '' }], fetchImpl: async () => { calls += 1; return new Response('should not be fetched', { status: 200 }); }, retrievedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(calls, 0);
  assert.equal(output.packet.status, 'INCOMPLETE');
  assert.ok(output.packet.sourceRevision);
});

test('Research canary rollback disables v2 and leaves Code default outside scope', () => {
  const adapter = createCodexResearchAdapter();
  let controller = createUniversalConsumerCanaryController({ consumer: 'codex', domain: 'research', adapterId: adapter.adapterId, sourceRevision: catalog.sourceRevision, priorPath: 'codex-current-research-entry' });
  controller = activateUniversalConsumerCanary(controller, { preflight: { passed: true } });
  controller = rollbackUniversalConsumerCanary(controller);
  const row = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: { prompt: 'Research current public evidence with citations.' }, catalog, repoRoot });
  assert.equal(row.selectedPath, 'legacy');
  assert.equal(row.v2, null);
  assert.equal(controller.productionActive, false);
});

test('Phase 8A activation spec validates and remains no-default', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-research-canary.v1.json'), 'utf8'));
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-research-canary.v1.schema.json'), 'utf8'));
  assert.deepEqual(validateJsonSchema(schema, spec), []);
  assert.equal(spec.defaultActive, false);
  assert.equal(spec.productionActive, false);
});
