import assert from 'node:assert/strict';
import test from 'node:test';
import {
  asReflexSkillCandidates,
  buildJarvisSkillContext,
  listJarvisSkillCandidates,
  selectJarvisSkillCandidates,
  type JarvisSkillContextCandidate,
} from '../agent-mode/jarvis-skill-context.js';

test('canonical Brain skill manifest produces bounded advisory candidates', async () => {
  const candidates = await listJarvisSkillCandidates();
  assert.ok(candidates.length > 1);
  assert.ok(candidates.length <= 8);
  assert.ok(candidates.every((candidate) => candidate.id.startsWith('skill.')));
  assert.ok(candidates.every((candidate) => candidate.description.length <= 240));
  assert.ok(asReflexSkillCandidates(candidates).every((candidate) => candidate.id.startsWith('skill.')));
});

test('ACTIVE_PILOT skill selection only narrows authorized summaries', () => {
  const candidates: readonly JarvisSkillContextCandidate[] = [
    { id: 'skill.code', label: 'Code', description: 'Read-only coding context.', safetyClass: 'repo_write' },
    { id: 'skill.research', label: 'Research', description: 'Evidence context.', safetyClass: 'read_only' },
  ];
  const selected = selectJarvisSkillCandidates(candidates, ['skill.research']);
  assert.deepEqual(selected.map((candidate) => candidate.id), ['skill.research']);
  assert.match(buildJarvisSkillContext(selected), /descriptive context only/u);
  assert.doesNotMatch(buildJarvisSkillContext(selected), /skill\.code/u);
});

test('missing or empty skill selection preserves the bounded baseline set', () => {
  const candidates: readonly JarvisSkillContextCandidate[] = [
    { id: 'skill.a', label: 'A', description: 'A', safetyClass: 'read_only' },
    { id: 'skill.b', label: 'B', description: 'B', safetyClass: 'read_only' },
  ];
  assert.deepEqual(selectJarvisSkillCandidates(candidates, undefined), candidates);
  assert.deepEqual(selectJarvisSkillCandidates(candidates, []), candidates);
});
