import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Brain workspace exposes the required drill-down routes', () => {
  for (const route of [
    'app/brain/page.tsx',
    'app/brain/active-work/page.tsx',
    'app/brain/tasks-evidence/page.tsx',
    'app/brain/quality-safety/page.tsx',
    'app/brain/continuity/page.tsx',
    'app/brain/capability-routing/page.tsx',
    'app/brain/tasks/[taskId]/page.tsx',
  ]) assert.ok(fs.existsSync(path.join(root, route)), `missing ${route}`);
});

test('Brain workspace is a read-only projection of real Core contracts', () => {
  const source = read('components/brain-workspace.tsx');
  for (const endpoint of [
    '/agent-task-graph',
    '/agent-task-state',
    '/agent-executor-plan',
    '/agent-approval-gates',
    '/api/agent/capabilities',
    '/infinite-brain/status',
    '/runtime/reports',
  ]) assert.match(source, new RegExp(endpoint.replaceAll('/', '\\/')));
  assert.match(source, /dependsOn/);
  assert.match(source, /View raw task reference/);
  assert.match(source, /No automatic resume/);
  assert.match(source, /evidencePacketRefs/);
  assert.match(source, /\?context=/);
  assert.match(source, /\?evidence=/);
  assert.match(source, /descriptor only/i);
  assert.doesNotMatch(source, /postBrainCoreAction|brainCoreAction/);
});

test('reference fixtures cover context-only, evidence-only, both, legacy, stale, and missing states', () => {
  const fixtures = JSON.parse(read('lib/fixtures/brain-workspace-task-references.json'));
  assert.deepEqual(Object.keys(fixtures).sort(), ['legacy', 'missing', 'stale', 'withBoth', 'withContextPack', 'withEvidencePacket']);
  assert.equal(fixtures.withBoth.contextPackRefs[0].type, 'context-pack');
  assert.equal(fixtures.withBoth.evidencePacketRefs[0].type, 'evidence-packet');
  assert.equal(fixtures.legacy.contextPackRefs, undefined);
  assert.equal(fixtures.stale.contextPackRefs[0].status, 'stale');
  assert.equal(fixtures.missing.evidencePacketRefs[0].status, 'missing');
});

test('legacy Infinite Brain URL redirects into the workspace', () => {
  assert.match(read('app/infinite-brain/page.tsx'), /redirect\('\/brain'\)/);
});

test('routine model selection is framed as diagnostics with a Brain routing path', () => {
  const source = read('components/ai-model-selector-dashboard.tsx');
  assert.match(source, /Advanced diagnostics/);
  assert.match(source, /Open Capability Routing/);
  assert.match(read('components/shell.tsx'), /\/brain\/capability-routing/);
});
