import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildMetadataSnapshot,
  parseTaskInventory,
  validateMetadataSnapshot,
} from './validate-infinite-brain-conformance.mjs';

const brainRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mindRoot = path.resolve(brainRoot, '../mind');

function clone(value) {
  return structuredClone(value);
}

function setAtPath(object, dottedPath, value) {
  const parts = dottedPath.split('.');
  const leaf = parts.pop();
  let cursor = object;
  for (const part of parts) cursor = cursor[part];
  cursor[leaf] = value;
}

test('current cross-repository metadata passes deterministic validation', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  assert.deepEqual(validateMetadataSnapshot(snapshot), []);
  assert.ok(snapshot.tasks.brain.length > 0);
  assert.ok(snapshot.tasks.mind.length > 0);
  assert.deepEqual(snapshot.tasks.duplicateBrainIds, []);
  assert.deepEqual(snapshot.tasks.duplicateMindIds, []);
});

test('task inventory captures machine-checkable state and evidence metadata', () => {
  const inventory = parseTaskInventory(`### BS0.99 — Fixture task

- **Status:** blocked — exact fixture blocker.
- **Prerequisites:** BS0.98.
- **Likely scope:** \`tools/example.mjs\` and [report](../reports/example.md).
- **Minimum validation:** Fixture validation.
- **Stop conditions:** Runtime access is required.
- **Evidence:** [fixture evidence](../reports/example.md).
- **Exact outcome:** Machine-readable inventory.
`, 'brain');

  assert.deepEqual(inventory, [{
    id: 'BS0.99',
    title: 'Fixture task',
    repository: 'brain',
    status: 'blocked — exact fixture blocker.',
    state: 'blocked',
    dependencies: 'BS0.98.',
    evidencePaths: ['../reports/example.md'],
    implementationPaths: ['../reports/example.md', 'tools/example.mjs'],
    validationStatus: 'blocked',
    blocker: 'blocked — exact fixture blocker.',
    nextAction: 'Machine-readable inventory.',
  }]);
});

test('blocked status remains blocked when it explicitly says not complete', () => {
  const [task] = parseTaskInventory(`### B1.99 — Blocked fixture

- **Status:** blocked — live evidence absent; not complete.
`, 'brain');
  assert.equal(task.state, 'blocked');
});

test('stale metadata fixture fails closed for every declared mutation', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  const fixture = JSON.parse(fs.readFileSync(
    path.join(brainRoot, 'tools/fixtures/infinite-brain-conformance/stale-metadata.json'),
    'utf8',
  ));

  for (const mutation of fixture.mutations) {
    const stale = clone(snapshot);
    setAtPath(stale, mutation.path, mutation.value);
    assert.ok(
      validateMetadataSnapshot(stale).includes(mutation.expectedError),
      `${mutation.path} must emit ${mutation.expectedError}`,
    );
  }
});

test('B8.1–B8.6 tasks are parsed from the Brain implementation plan', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  const brainIds = new Set(snapshot.tasks.brain.map((task) => task.id));
  for (let i = 1; i <= 6; i += 1) {
    assert.ok(brainIds.has(`B8.${i}`), `B8.${i} must be present in Brain task inventory`);
  }
});

test('B8.1–B8.6 tasks match the canonical accepted implementation state', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  const b8Tasks = snapshot.tasks.brain.filter((task) => /^B8\.\d+$/.test(task.id));
  assert.equal(b8Tasks.length, 6, 'exactly 6 B8 tasks must be present');
  for (const task of b8Tasks) {
    assert.equal(task.state, 'complete', `${task.id} must match the canonical accepted implementation plan state`);
  }
});

test('B8 task IDs are unique in the Brain inventory', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  const b8Ids = snapshot.tasks.brain.filter((task) => /^B8\.\d+$/.test(task.id)).map((task) => task.id);
  assert.deepEqual(b8Ids, [...new Set(b8Ids)], 'B8 task IDs must be unique');
});

test('missing B8.1 task causes tasks:missing:B8.1 error', () => {
  const snapshot = buildMetadataSnapshot({ brainRoot, mindRoot });
  const stale = clone(snapshot);
  stale.tasks.brain = stale.tasks.brain.filter((task) => task.id !== 'B8.1');
  const errors = validateMetadataSnapshot(stale);
  assert.ok(errors.includes('tasks:missing:B8.1'), 'missing B8.1 must emit tasks:missing:B8.1');
});

test('B8 task inventory parsed correctly by parseTaskInventory', () => {
  const tasks = parseTaskInventory(`### B8.1 — Benchmark structural code-memory options on the M1 Pro

- **Status:** planned.
- **Scope:** Codebase Memory MCP and Graphify.
- **Change:** Record indexing time and retrieval quality.
- **Verify:** Benchmark fixtures and comparison report.
- **Stop if:** Benchmark requires credentials.

### B8.2 — Admit and install Codebase Memory MCP as the structural default

- **Status:** planned; blocked on B8.1 evidence and provider-admission review.
- **Change:** Install the pinned Codebase Memory version.
- **Verify:** Provider schema and read-only behavior pass.
- **Safety:** No repository writes.
`, 'brain');

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].id, 'B8.1');
  assert.equal(tasks[0].state, 'planned');
  assert.equal(tasks[1].id, 'B8.2');
  // B8.2 status includes "blocked on B8.1" — blocked takes priority in taskState.
  assert.equal(tasks[1].state, 'blocked');
});
