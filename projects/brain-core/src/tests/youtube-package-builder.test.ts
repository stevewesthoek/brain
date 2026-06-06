import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYouTubePackage, type YouTubePackageInput } from '../providers/youtube-package-builder.js';

test('youtube-package: basic title cleaning', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-001',
    topicTitle: 'Make a video about an Audi R8.',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  // Title gets titleCase applied, so "an audi r8" becomes "An Audi R8"
  assert(pkg.title.includes('Audi') && pkg.title.includes('R8'), 'Title should contain Audi R8');
  assert(!pkg.title.includes('video'), 'Title should not include "video"');
  assert.equal(pkg.metadataQuality?.hasInternalTerms, false, 'Should have no internal terms');
  assert(pkg.metadataQuality && pkg.metadataQuality.warnings.length === 0, 'Should have no quality warnings');
});

test('youtube-package: removes internal terms from title', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-002',
    topicTitle: 'Make a video about AWS Bedrock FFmpeg pipeline proof',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(!pkg.title.toUpperCase().includes('AWS'), 'AWS should be removed from title');
  assert(!pkg.title.includes('Bedrock'), 'Bedrock should be removed from title');
  assert(!pkg.title.includes('FFmpeg'), 'FFmpeg should be removed from title');
  assert(!pkg.title.includes('pipeline'), 'pipeline should be removed from title (case insensitive)');
  assert(pkg.metadataQuality?.hasInternalTerms, 'Should detect internal terms in source');
});

test('youtube-package: removes internal terms from description', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-003',
    topicTitle: 'Make a video',
    topicDescription: 'This is a test using AWS and Bedrock',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(!pkg.description.includes('AWS'), 'AWS should be removed from description');
  assert(!pkg.description.includes('Bedrock'), 'Bedrock should be removed from description');
});

test('youtube-package: adds PIPELINE PROOF prefix only for fixture modes', () => {
  const fixtureInput: YouTubePackageInput = {
    jobId: 'test-fixture-001',
    topicTitle: 'Make a video about a cat',
    generationMode: 'fixture_assembly',
    mediaSource: 'fixture',
  };

  const fixturePkg = buildYouTubePackage(fixtureInput);
  assert(fixturePkg.title.startsWith('[PIPELINE PROOF]'), 'Fixture mode should have PIPELINE PROOF prefix');

  const hybridInput: YouTubePackageInput = {
    jobId: 'test-hybrid-001',
    topicTitle: 'Make a video about a cat',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const hybridPkg = buildYouTubePackage(hybridInput);
  assert(!hybridPkg.title.startsWith('[PIPELINE PROOF]'), 'Hybrid mode should NOT have PIPELINE PROOF prefix');
});

test('youtube-package: title length stays within limits', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-004',
    topicTitle: 'Make a really really really really long video about something very very very very very long that should be truncated',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(pkg.title.length <= 80, `Title should be ≤80 chars, got ${pkg.title.length}`);
  assert(!pkg.title.endsWith(' '), 'Title should not end with space');
  assert(!pkg.title.match(/[.,:;!?-]$/), 'Title should not end with punctuation');
});

test('youtube-package: generates clean tags without internal terms', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-005',
    topicTitle: 'Make a video about an Audi R8.',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  for (const tag of pkg.tags) {
    assert(!tag.includes('pipeline'), `Tag "${tag}" contains "pipeline"`);
    assert(!tag.includes('aws'), `Tag "${tag}" contains "aws"`);
    assert(!tag.includes('fixture'), `Tag "${tag}" contains "fixture"`);
    assert(!tag.includes('bedrock'), `Tag "${tag}" contains "bedrock"`);
    assert(!tag.includes('polly'), `Tag "${tag}" contains "polly"`);
    assert(!tag.includes('ffmpeg'), `Tag "${tag}" contains "ffmpeg"`);
  }
});

test('youtube-package: tag count is between 8–15', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-006',
    topicTitle: 'Make a video about something really interesting and meaningful',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(pkg.tags.length >= 8, `Should have ≥8 tags, got ${pkg.tags.length}`);
  assert(pkg.tags.length <= 15, `Should have ≤15 tags, got ${pkg.tags.length}`);
});

test('youtube-package: description is human-facing and concise', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-007',
    topicTitle: 'Make a video of somebody sitting behind the computer.',
    topicDescription: 'A person working at their desk with a laptop.',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(pkg.description.length <= 1000, `Description should be ≤1000 chars, got ${pkg.description.length}`);
  assert(!pkg.description.includes('['), 'Description should not contain brackets');
  assert(pkg.description.includes('A short video'), 'Description should start with "A short video"');
  assert(pkg.description.includes('private preview'), 'Description should mention "private preview"');
});

test('youtube-package: no duplicate sentences in description', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-008',
    topicTitle: 'Cozy nursery',
    topicDescription: 'A cozy nursery with soft toys.',
    scenePlan: [
      {
        index: 1,
        durationSeconds: 5,
        visualPrompt: 'Cozy nursery room',
        narrationText: 'Here we see a cozy nursery with soft toys and warm sunlight.',
      },
      {
        index: 2,
        durationSeconds: 5,
        visualPrompt: 'Toys on shelf',
        narrationText: 'The toys are arranged carefully on the shelf.',
      },
    ],
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  const sentences = pkg.description.split('. ').map(s => s.trim());
  const uniqueSentences = new Set(sentences);
  assert.equal(sentences.length, uniqueSentences.size, 'Description should not have duplicate sentences');
});

test('youtube-package: metadata quality reports issues', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-009',
    topicTitle: 'Make a super mega ultra long video about something really really really really long that goes on and on and on and on and on and on',
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  // Title should be truncated to stay within limits
  assert(pkg.title.length <= 80, `Title should be truncated to ≤80, got ${pkg.title.length}`);
  // Metadata quality should report the proper limits
  assert(pkg.metadataQuality && pkg.metadataQuality.titleLength <= 80, 'Metadata should report correct title length');
});

test('youtube-package: works with scene plan for richer description', () => {
  const input: YouTubePackageInput = {
    jobId: 'test-job-010',
    topicTitle: 'Create a short video about a cozy nursery with soft toys and warm sunlight.',
    scenePlan: [
      {
        index: 1,
        durationSeconds: 3,
        visualPrompt: 'Nursery interior',
        narrationText: 'A beautiful nursery bathed in golden afternoon light.',
      },
      {
        index: 2,
        durationSeconds: 3,
        visualPrompt: 'Toys arrangement',
        narrationText: 'Soft plush toys arranged on the floor create a playful atmosphere.',
      },
      {
        index: 3,
        durationSeconds: 4,
        visualPrompt: 'Window view',
        narrationText: 'Warm sunlight streams through the window.',
      },
    ],
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
  };

  const pkg = buildYouTubePackage(input);
  assert(pkg.description.includes('nursery'), 'Description should include nursery keyword');
  assert(pkg.description.includes('toys'), 'Description should include toys keyword');
  assert(pkg.description.length > 100, 'Description should be enriched by scene plan');
  assert(pkg.metadataQuality && pkg.metadataQuality.descriptionLength > 100, 'Quality should track description length');
});
