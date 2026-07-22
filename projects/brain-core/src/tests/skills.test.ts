import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listSkills } from '../adapters/skills.js';

test('listSkills follows active skill symlinks and ignores broken links', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-core-skills-'));

  try {
    const activeDir = path.join(root, 'active');
    const sourceDir = path.join(root, 'sources', 'example-skill');
    mkdirSync(activeDir, { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(path.join(sourceDir, 'SKILL.md'), '# Example skill\n');
    symlinkSync(sourceDir, path.join(activeDir, 'example-skill'));
    symlinkSync(path.join(root, 'missing'), path.join(activeDir, 'broken-skill'));

    const skills = listSkills(activeDir);

    assert.equal(
      JSON.stringify(skills.map(({ id, status }) => ({ id, status }))),
      JSON.stringify([{ id: 'example-skill', status: 'indexed' }]),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listSkills returns a placeholder when the active directory is unavailable', () => {
  const missing = path.join(tmpdir(), 'brain-core-skills-directory-that-does-not-exist');
  const skills = listSkills(missing);

  assert.equal(skills.length, 1);
  assert.equal(skills[0]?.id, 'skills-index-unavailable');
  assert.equal(skills[0]?.status, 'placeholder');
});
