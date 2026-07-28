import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertActiveDefault,
  classifyPath,
  deletionPrerequisites,
  loadPathRegistry,
  resolveCanonicalPath,
  validatePathRegistry,
} from './mind-canonical-path-registry.mjs';

function fixture() { return structuredClone(loadPathRegistry()); }

test('canonical paths resolve and compatibility paths classify without becoming defaults', () => {
  const registry = fixture();
  assert.equal(resolveCanonicalPath(registry, 'inbox-new'), 'inbox/new/');
  assert.equal(resolveCanonicalPath(registry, 'inbox-failed'), 'inbox/failed/');
  assert.equal(classifyPath(registry, 'capture/inbox').entry.pathId, 'capture-inbox');
  assert.equal(classifyPath(registry, 'wiki/log.md').entry.pathId, 'wiki-log');
  assert.equal(classifyPath(registry, '02-strategy/').entry.pathId, 'numbered-roots');
  assert.equal(assertActiveDefault(registry, 'inbox/new').pathId, 'inbox-new');
  assert.equal(assertActiveDefault(registry, 'inbox/failed/').pathId, 'inbox-failed');
  assert.equal(registry.entries.find((entry) => entry.pathId === 'inbox-new').verifiedState, 'live-definition-verified');
  assert.equal(registry.entries.find((entry) => entry.pathId === 'capture-inbox').deployedState, 'absent-from-live-definition');
  assert.equal(registry.entries.find((entry) => entry.pathId === 'n8n-inbox-override-name').observedState, 'value-uninspected');
  assert.throws(() => assertActiveDefault(registry, 'capture/inbox'), /forbidden_active_default/);
  assert.throws(() => assertActiveDefault(registry, 'capture/failed/'), /forbidden_active_default/);
});

test('task, scoped exception, graph output, unknown, and deletion semantics stay explicit', () => {
  const registry = fixture();
  assert.equal(classifyPath(registry, 'kanban.md').entry.pathId, 'kanban-current-authority');
  assert.equal(classifyPath(registry, 'tasks.md').entry.type, 'future-target');
  assert.equal(classifyPath(registry, 'wiki/organisations/prochat/brand/').entry.pathId, 'prochat-brand-exception');
  assert.equal(classifyPath(registry, 'wiki/unscoped-note.md').entry.pathId, 'wiki-root');
  assert.equal(classifyPath(registry, '.graphify-out/').entry.type, 'generated-output');
  assert.equal(classifyPath(registry, 'not/registered').classification, 'unknown');
  assert.ok(deletionPrerequisites(registry, 'capture/inbox/').includes('cross-repository-conformance'));
});

test('duplicate, contradictory, missing-source, and candidate state errors fail closed', () => {
  const registry = fixture();
  registry.entries.push({ ...registry.entries[0], pathId: 'duplicate-inbox' });
  registry.entries.find((entry) => entry.pathId === 'wiki-root').activeDefaultAllowed = true;
  registry.entries.find((entry) => entry.pathId === 'inbox-new').normativeSource.path = 'system/not-present.md';
  const override = registry.entries.find((entry) => entry.pathId === 'n8n-inbox-override-name');
  override.lifecycleState = 'candidate';
  override.verifiedState = 'repository-validated';
  const errors = validatePathRegistry(registry);
  assert.ok(errors.some((error) => error.includes('duplicates')));
  assert.ok(errors.some((error) => error.includes('non-canonical path cannot')));
  assert.ok(errors.some((error) => error.includes('missing or invalid normativeSource')));
  assert.ok(errors.some((error) => error.includes('candidate integration')));
});
