import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMindPathSnapshotFromRoot } from '../snapshot.js';

test('createMindPathSnapshotFromRoot collects safe stat-only metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-router-snapshot-'));
  try {
    fs.mkdirSync(path.join(root, 'capture', 'inbox'), { recursive: true });
    fs.writeFileSync(path.join(root, 'capture', 'inbox', 'note.md'), '# Hello\nWorld\n');
    fs.writeFileSync(path.join(root, 'live.md'), 'one\ntwo\nthree\n');

    const snapshot = createMindPathSnapshotFromRoot(root, ['capture/inbox/', 'capture/inbox/note.md', 'live.md']);

    assert.equal(snapshot.paths.length, 3);
    assert.equal(snapshot.paths[0]?.kind, 'directory');
    assert.equal(snapshot.paths[0]?.exists, true);
    assert.equal(snapshot.paths[1]?.lineCount, 3);
    assert.equal(snapshot.paths[2]?.lineCount, 4);
    assert.equal(snapshot.paths.every((status) => status.followedSymlink !== true), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('createMindPathSnapshotFromRoot rejects unsafe roots', () => {
  let threw = false;
  try {
    createMindPathSnapshotFromRoot('/tmp/mind/.git', []);
  } catch (error) {
    threw = true;
    assert.match(String(error), /Unsafe mind-steward root path/);
  }

  assert.equal(threw, true);
});
