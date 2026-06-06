import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverlayPlan, containsInternalOverlayTerms, sanitizeOverlayText, wrapOverlayText } from '../providers/aws-video-overlay-provider.js';
import type { ScenePlan } from '../providers/aws-video-generation-types.js';

function scenePlan(prompt: string, onScreenText?: string): ScenePlan {
  return {
    jobId: 'test-job',
    prompt,
    title: prompt,
    targetDurationSeconds: 20,
    providerName: 'deterministic-local',
    deterministic: true,
    createdAt: '2026-06-07T00:00:00.000Z',
    scenes: [
      {
        index: 0,
        durationSeconds: 20,
        visualPrompt: prompt,
        narrationText: prompt,
        ...(onScreenText ? { onScreenText } : {}),
      },
    ],
  };
}

test('overlay text removes raw prompt command wording', () => {
  assert.equal(sanitizeOverlayText('Make a video about an Audi R8.'), 'an Audi R8');
  assert.equal(sanitizeOverlayText('Make a video of somebody sitting behind the computer.'), 'somebody sitting behind the computer');
});

test('overlay plan uses clean scene captions without internal terms', () => {
  const plan = buildOverlayPlan({
    jobId: 'test-job',
    scenePlan: scenePlan('Make a video about an Audi R8.', 'Make a video about an Audi R8.'),
    sceneImageKeys: ['jobs/test-job/images/scene-001.png'],
    title: 'Audi R8 design story',
    createdAt: '2026-06-07T00:00:00.000Z',
  });

  assert.equal(plan.provider, 'deterministic-overlay');
  assert.equal(plan.cards[0]?.type, 'intro');
  assert.equal(plan.cards[1]?.type, 'scene');
  assert.equal(plan.cards[1]?.text, 'an Audi R8');
  assert.equal(containsInternalOverlayTerms(plan), false);
});

test('overlay wrapping limits lines and ellipsizes long captions', () => {
  const longPrompt = 'Make a video of somebody sitting behind the computer while planning a detailed launch sequence with many visual beats and careful notes.';
  const lines = wrapOverlayText(sanitizeOverlayText(longPrompt), 28, 3);

  assert.equal(lines.length, 3);
  assert.ok(lines.every((line) => line.length <= 29));
  assert.ok(lines[2]?.endsWith('…'));
});
