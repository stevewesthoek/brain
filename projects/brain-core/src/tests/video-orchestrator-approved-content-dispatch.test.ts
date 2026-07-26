import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  dispatchApprovedMovingVideoContent,
  setApprovedContentProductionDispatchDependenciesForTests,
} from '../providers/video-orchestrator-provider.js';
import { createContentItemRequest } from '../adapters/vo-studio-write.js';
import { routeRequest } from '../api/routes.js';

const BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an';
const baseInput = {
  approvalId: 'approval-content-real-video-001',
  projectId: 'says-the-bible',
  title: 'Real approved moving video',
  description: 'Task 1W-I.1 production dispatch test',
};

const noRemotePersistence = async (): Promise<void> => {};

class MockResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  setHeader(name: string, value: string | number | readonly string[]): void {
    this.headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...(headers ?? {}) };
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createJsonPost(url: string, body: Record<string, unknown>): IncomingMessage {
  const request = Readable.from([JSON.stringify(body)]) as unknown as IncomingMessage;
  request.method = 'POST';
  request.url = url;
  Object.defineProperty(request, 'socket', {
    value: { remoteAddress: '127.0.0.1' },
  });
  return request;
}

test('approved-content dispatch rejects non-S3 source paths', async () => {
  const result = await dispatchApprovedMovingVideoContent({
    ...baseInput,
    sourceVideoPath: '/tmp/real-video.mp4',
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /must be an S3 object/);
});

test('approved-content dispatch rejects fixture sources', async () => {
  const result = await dispatchApprovedMovingVideoContent({
    ...baseInput,
    sourceVideoPath: `s3://${BUCKET}/uploads/fixture-video.mp4`,
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /fixture/);
});

test('approved-content dispatch rejects slideshow sources', async () => {
  const result = await dispatchApprovedMovingVideoContent({
    ...baseInput,
    sourceVideoPath: `s3://${BUCKET}/uploads/slideshow-final.mp4`,
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /slideshow/);
});

test('approved-content dispatch rejects test-001 sources', async () => {
  const result = await dispatchApprovedMovingVideoContent({
    ...baseInput,
    sourceVideoPath: `s3://${BUCKET}/jobs/test-001/exports/final.mp4`,
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /test-001/);
});

test('approved-content dispatch creates canonical metadata and starts mocked execution', async () => {
  const jobsRoot = await mkdtemp(join(tmpdir(), 'approved-content-dispatch-'));
  const executionArn = 'arn:aws:states:eu-north-1:123456789012:execution:video:test';
  const starts: Array<Record<string, unknown>> = [];

  try {
    const result = await dispatchApprovedMovingVideoContent({
      ...baseInput,
      sourceVideoPath: `s3://${BUCKET}/uploads/real-source-video.mp4`,
    }, {
      jobsRoot,
      persistMetadata: noRemotePersistence,
      startExecution: async (input) => {
        starts.push(input);
        return executionArn;
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.executionArn, executionArn);
    assert.equal(result.duplicate, undefined);
    assert.equal(starts.length, 1);
    assert.deepEqual(starts[0], {
      jobId: result.jobId,
      sourceVideoKey: 'uploads/real-source-video.mp4',
      mediaSource: 'uploaded-video',
      generationMode: 'approved-source-video',
    });

    const metadataDir = join(jobsRoot, result.jobId!, 'metadata');
    const assets = JSON.parse(await readFile(join(metadataDir, 'assets.json'), 'utf8')) as Record<string, unknown>;
    const status = JSON.parse(await readFile(join(metadataDir, 'status.json'), 'utf8')) as Record<string, unknown>;

    assert.equal(assets.mediaSource, 'uploaded-video');
    assert.equal(assets.generationMode, 'approved-source-video');
    assert.equal(assets.videoSourceKey, 'uploads/real-source-video.mp4');
    assert.equal(assets.slideshowGenerated, false);
    assert.equal(assets.fixtureUsed, false);
    assert.equal(status.currentStep, 'workflow_started');
    assert.equal(status.executionArn, executionArn);
  } finally {
    await rm(jobsRoot, { recursive: true, force: true });
  }
});

test('approved-content dispatch is idempotent for duplicate approval dispatch', async () => {
  const jobsRoot = await mkdtemp(join(tmpdir(), 'approved-content-duplicate-'));
  let executionStarts = 0;

  try {
    const dependencies = {
      jobsRoot,
      persistMetadata: noRemotePersistence,
      startExecution: async () => {
        executionStarts += 1;
        return 'arn:aws:states:eu-north-1:123456789012:execution:video:duplicate';
      },
    };
    const input = {
      ...baseInput,
      sourceVideoPath: `s3://${BUCKET}/uploads/duplicate-safe.mp4`,
    };

    const first = await dispatchApprovedMovingVideoContent(input, dependencies);
    const second = await dispatchApprovedMovingVideoContent(input, dependencies);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.executionArn, first.executionArn);
    assert.equal(executionStarts, 1);
  } finally {
    await rm(jobsRoot, { recursive: true, force: true });
  }
});

test('approval route dispatches an approved real-video content record', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'approved-content-route-'));
  const jobsRoot = join(tempDir, 'jobs');
  const approvalsPath = join(tempDir, 'approvals.json');
  const originalApprovalsPath = process.env.VO_APPROVALS_PATH;
  const executionArn = 'arn:aws:states:eu-north-1:123456789012:execution:video:route';
  let executionStarts = 0;

  process.env.VO_APPROVALS_PATH = approvalsPath;
  setApprovedContentProductionDispatchDependenciesForTests({
    jobsRoot,
    persistMetadata: noRemotePersistence,
    startExecution: async () => {
      executionStarts += 1;
      return executionArn;
    },
  });

  try {
    const creation = createContentItemRequest({
      projectId: 'says-the-bible',
      title: 'Approved route moving video',
      description: 'Real S3 video route dispatch',
      sourceVideoPath: `s3://${BUCKET}/uploads/route-real-video.mp4`,
    });

    assert.equal(creation.ok, true);
    assert.ok(creation.approval?.id);

    const response = new MockResponse();
    await routeRequest(
      createJsonPost(`/api/video-orchestrator/approvals/${creation.approval!.id}/approve`, {
        note: 'Approved for production dispatch',
      }),
      response as unknown as ServerResponse,
    );

    assert.equal(response.statusCode, 503);
    const payload = JSON.parse(response.body) as {
      ok: boolean;
      code?: string;
      safety?: { requestBodyRead: boolean; approvalBypassAllowed: boolean };
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.code, 'mutable_capability_contained');
    assert.equal(payload.safety?.requestBodyRead, false);
    assert.equal(payload.safety?.approvalBypassAllowed, false);
    assert.equal(executionStarts, 0);
  } finally {
    setApprovedContentProductionDispatchDependenciesForTests(null);
    if (originalApprovalsPath === undefined) delete process.env.VO_APPROVALS_PATH;
    else process.env.VO_APPROVALS_PATH = originalApprovalsPath;
    await rm(tempDir, { recursive: true, force: true });
  }
});
