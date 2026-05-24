import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentItemRequest } from '../adapters/vo-studio-write.js';

test('createContentItemRequest accepts valid input and returns approval preview', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode for the series',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.ok(result.preview.contentItem);
});

test('createContentItemRequest rejects missing projectId', () => {
  const result = createContentItemRequest({
    projectId: '',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.equal(result.approval, undefined);
});

test('createContentItemRequest rejects missing title', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: '',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /title is required/);
});

test('createContentItemRequest rejects missing sourceAudioPath', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /sourceAudioPath is required/);
});

test('createContentItemRequest rejects missing backgroundImagePath', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /backgroundImagePath is required/);
});

test('createContentItemRequest allows empty description', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: '',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
  assert.equal(result.preview.contentItem.description, '');
});

test('preview contentItem has correct structure', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode Title',
    description: 'Description text',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  const item = result.preview!.contentItem!;

  assert.equal(item.projectId, 'project-123');
  assert.equal(item.title, 'Episode Title');
  assert.equal(item.description, 'Description text');
  assert.equal(item.sourceAudioPath, '/audio/episode-1.mp3');
  assert.equal(item.backgroundImagePath, '/images/bg.png');
  assert.equal(item.status, 'queued');
  assert.equal(item.language, 'en');
  assert.equal(item.durationSec, null);
  assert.ok(item.createdAt);
  assert.ok(item.updatedAt);
});

test('preview contentItem IDs are unique', () => {
  const result1 = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode 1',
    description: '',
    sourceAudioPath: '/audio/1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  const result2 = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode 2',
    description: '',
    sourceAudioPath: '/audio/2.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.notEqual(
    result1.preview!.contentItem!.id,
    result2.preview!.contentItem!.id,
  );
});

test('multiple validation errors are reported', () => {
  const result = createContentItemRequest({
    projectId: '',
    title: '',
    description: '',
    sourceAudioPath: '',
    backgroundImagePath: '',
  });

  assert.equal(result.ok, false);
  assert.ok(result.error!.includes('projectId'));
  assert.ok(result.error!.includes('title'));
  assert.ok(result.error!.includes('sourceAudioPath'));
  assert.ok(result.error!.includes('backgroundImagePath'));
});
