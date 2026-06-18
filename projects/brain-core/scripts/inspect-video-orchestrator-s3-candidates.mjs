#!/usr/bin/env node
/**
 * Read-only S3 inspection for Task 1W-I production moving-video candidates.
 *
 * Safety:
 * - Lists at most 100 job prefixes.
 * - Reads only script.json, review.json, assets.json, publish.json, status.json.
 * - Never downloads media.
 * - Never writes local or S3 data.
 * - Never invokes publish code.
 * - Never prints credentials or full metadata payloads.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AWS_REGION = 'eu-north-1';
const S3_BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an';
const S3_PREFIX = 'jobs/';
const MAX_JOBS = 12;
const JOB_CONCURRENCY = 4;
const METADATA_FILES = ['script.json', 'review.json', 'assets.json', 'publish.json', 'status.json'];
const JOB_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const FIXTURE_MARKERS = ['fixture', 'test-001', '[pipeline proof]'];
const SLIDESHOW_MARKERS = ['slideshow', 'fixture_assembly', 'image_sequence'];
const PUBLISHED_MARKERS = ['uploaded', 'published'];

async function awsJson(args, timeout = 15_000) {
  const { stdout } = await execFileAsync('aws', [...args, '--region', AWS_REGION, '--no-cli-pager'], {
    timeout,
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function listJobIds() {
  const result = await awsJson([
    's3api',
    'list-objects-v2',
    '--bucket', S3_BUCKET,
    '--prefix', S3_PREFIX,
    '--delimiter', '/',
    '--max-keys', String(MAX_JOBS),
    '--output', 'json',
  ]);

  return (result.CommonPrefixes ?? [])
    .map((entry) => entry?.Prefix ?? '')
    .map((prefix) => /^jobs\/([^/]+)\/$/.exec(prefix)?.[1] ?? '')
    .filter((jobId) => JOB_ID_PATTERN.test(jobId))
    .slice(0, MAX_JOBS);
}

async function readMetadata(jobId, fileName) {
  try {
    const { stdout } = await execFileAsync('aws', [
      's3', 'cp',
      `s3://${S3_BUCKET}/jobs/${jobId}/metadata/${fileName}`,
      '-',
      '--region', AWS_REGION,
      '--no-cli-pager',
    ], {
      timeout: 1_200,
      maxBuffer: 512 * 1024,
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function textValues(value, values = []) {
  if (typeof value === 'string') values.push(value.toLowerCase());
  else if (Array.isArray(value)) value.forEach((entry) => textValues(entry, values));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => textValues(entry, values));
  return values;
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? null;
}

function nestedObject(value, key) {
  const candidate = value && typeof value === 'object' ? value[key] : null;
  return candidate && typeof candidate === 'object' ? candidate : null;
}

function classify(jobId, metadata) {
  const { script, review, assets, publish, status } = metadata;
  const allText = textValues({ jobId, script, review, assets, publish, status });
  const youtube = nestedObject(nestedObject(publish, 'platforms'), 'youtube');

  const generationMode = firstString(status?.generationMode, assets?.generationMode, publish?.generationMode);
  const mediaSource = firstString(status?.mediaSource, assets?.mediaSource, publish?.mediaSource);
  const videoKey = firstString(
    publish?.videoKey,
    assets?.videoKey,
    status?.finalVideoKey,
    nestedObject(assets, 'finalVideo')?.path,
  );
  const thumbnailKey = firstString(
    publish?.thumbnailKey,
    assets?.thumbnailKey,
    status?.thumbnailKey,
    nestedObject(assets, 'thumbnail')?.path,
  );
  const reviewStatus = firstString(review?.reviewStatus, review?.status);
  const videoId = firstString(youtube?.videoId, publish?.videoId);
  const publishStatus = firstString(youtube?.status, publish?.publishStatus, publish?.status);

  const fixture = allText.some((value) => FIXTURE_MARKERS.some((marker) => value.includes(marker)));
  const slideshow = allText.some((value) => SLIDESHOW_MARKERS.some((marker) => value.includes(marker)));
  const published = Boolean(videoId) || PUBLISHED_MARKERS.includes((publishStatus ?? '').toLowerCase());
  const complete = Boolean(script && review && assets && publish && status && videoKey && thumbnailKey);
  const approved = reviewStatus === 'approved';
  const movingVideo = !fixture && !slideshow && Boolean(videoKey) && (
    (generationMode ?? '').toLowerCase().includes('motion') ||
    (generationMode ?? '').toLowerCase().includes('video') ||
    (mediaSource ?? '').toLowerCase().includes('video') ||
    (mediaSource ?? '').toLowerCase().includes('motion')
  );

  return {
    jobId,
    title: firstString(script?.title),
    channelId: firstString(script?.channelId),
    generationMode,
    mediaSource,
    reviewStatus,
    publishStatus,
    hasVideo: Boolean(videoKey),
    hasThumbnail: Boolean(thumbnailKey),
    hasVideoId: Boolean(videoId),
    eligible: complete && approved && movingVideo && !published,
    exclusionReasons: [
      fixture ? 'fixture' : null,
      slideshow ? 'slideshow' : null,
      !complete ? 'incomplete_metadata_or_assets' : null,
      !approved ? 'review_not_approved' : null,
      !movingVideo ? 'not_moving_video' : null,
      published ? 'already_uploaded_or_published' : null,
    ].filter(Boolean),
  };
}

async function inspectJob(jobId) {
  const entries = await Promise.all(METADATA_FILES.map(async (fileName) => [fileName, await readMetadata(jobId, fileName)]));
  const byFile = Object.fromEntries(entries);
  return classify(jobId, {
    script: byFile['script.json'],
    review: byFile['review.json'],
    assets: byFile['assets.json'],
    publish: byFile['publish.json'],
    status: byFile['status.json'],
  });
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }));

  return results;
}

async function main() {
  const jobIds = await listJobIds();
  const results = await mapWithConcurrency(jobIds, JOB_CONCURRENCY, inspectJob);

  const candidates = results.filter((result) => result.eligible);
  console.log(JSON.stringify({
    ok: true,
    inspectedJobCount: results.length,
    candidateCount: candidates.length,
    candidates,
    excludedSummary: results.reduce((summary, result) => {
      for (const reason of result.exclusionReasons) summary[reason] = (summary[reason] ?? 0) + 1;
      return summary;
    }, {}),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
