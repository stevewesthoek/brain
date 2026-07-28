import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalMindPrefix,
  describeMindPath,
  resolveCanonicalMindPath,
} from '../canonical-mind-path-registry.js';
import { isCanonicalMindMutationSourcePath } from '../mind-paths.js';
import {
  classifyPath,
  loadPathRegistry,
  resolveCanonicalPath,
} from '../../../../tools/mind-canonical-path-registry.mjs';

const registry = loadPathRegistry({
  repoRoot: new URL('../../../..', import.meta.url).pathname,
});

test('Brain Core canonical path wrapper matches the shared registry resolver', () => {
  for (const pathId of ['inbox-new', 'inbox-failed', 'projects', 'knowledge', 'kanban-current-authority']) {
    assert.equal(resolveCanonicalMindPath(pathId), resolveCanonicalPath(registry, pathId));
  }
  assert.equal(canonicalMindPrefix('projects'), 'projects/');
  assert.equal(canonicalMindPrefix('inbox-new'), 'inbox/new/');
});

test('Brain Core path descriptions match shared classification', () => {
  for (const token of ['inbox/new/note.md', 'capture/inbox/note.md', 'kanban.md', 'tasks.md', 'unknown/path']) {
    assert.deepEqual(describeMindPath(token), classifyPath(registry, token).entry);
  }
});

test('Brain Core canonical path wrapper rejects unknown and unsafe inputs', () => {
  assert.throws(() => resolveCanonicalMindPath('capture-inbox'), /canonical_path_not_found/);
  assert.throws(() => resolveCanonicalMindPath('unknown-path-id'), /canonical_path_not_found/);
  for (const token of ['', '/absolute/path', '../traversal', 'windows\\path']) {
    assert.equal(describeMindPath(token), null);
  }
});




test('canonical mutation sources exclude compatibility, historical, future, and unknown paths', () => {
  for (const token of ['inbox/new/note.md', 'projects/example.md', 'knowledge/reference.md', 'kanban.md']) {
    assert.equal(isCanonicalMindMutationSourcePath(token), true, token);
  }
  for (const token of ['capture/inbox/note.md', 'live/projects/example.md', 'tasks.md', 'unknown/path.md']) {
    assert.equal(isCanonicalMindMutationSourcePath(token), false, token);
  }
});
