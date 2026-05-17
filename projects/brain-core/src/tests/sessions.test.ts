import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listSessions } from '../adapters/sessions.js';

const TEST_ROOT = path.join(process.cwd(), '.buildflow-test-sessions');

test('listSessions ranks configured session files by recency and intent', () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(TEST_ROOT, 'brain'), { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, 'brain', 'codex-deploy-handoff.jsonl'), '{}\n');
  fs.writeFileSync(path.join(TEST_ROOT, 'brain', 'claude-general-notes.txt'), 'notes\n');

  const previousDirs = process.env.BRAIN_CORE_SESSION_DIRS;
  process.env.BRAIN_CORE_SESSION_DIRS = TEST_ROOT;

  try {
    const sessions = listSessions();
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0]?.tool, 'codex');
    assert.equal(sessions[0]?.intent, 'deploy');
    assert.equal(sessions[0]?.repo, 'brain');
    assert.equal(typeof sessions[0]?.score, 'number');
    assert.equal(typeof sessions[0]?.age, 'string');
  } finally {
    if (previousDirs === undefined) {
      delete process.env.BRAIN_CORE_SESSION_DIRS;
    } else {
      process.env.BRAIN_CORE_SESSION_DIRS = previousDirs;
    }
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }
});
