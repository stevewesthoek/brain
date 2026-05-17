import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createRequest(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };

  if (input.method !== undefined) {
    request.method = input.method;
  }

  if (input.url !== undefined) {
    request.url = input.url;
  }

  return request;
}

async function exercise(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

test('GET /orchestrators returns full orchestrator list', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators' });
  const body = JSON.parse(response.body) as {
    orchestrators: Array<{ id: string; name: string; status: string; health?: string; lifecycle?: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.orchestrators.length, 12);
  assert.ok(body.orchestrators.some(o => o.id === 'brain-core'));
  assert.ok(body.orchestrators.some(o => o.id === 'video-orchestrator'));
  assert.ok(body.orchestrators.some(o => o.id === 'stb-pipeline'));
});

test('GET /orchestrators/:id returns specific orchestrator', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators/brain-core' });
  const body = JSON.parse(response.body) as { orchestrator: { id: string; name: string; role?: string } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.orchestrator.id, 'brain-core');
  assert.equal(body.orchestrator.name, 'Brain Core');
  assert.equal(body.orchestrator.role, 'primary');
});

test('GET /orchestrators/:id returns 404 for missing orchestrator', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators/nonexistent' });
  const body = JSON.parse(response.body) as { error: { code: string; message: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /pipelines returns full pipeline list', async () => {
  const response = await exercise({ method: 'GET', url: '/pipelines' });
  const body = JSON.parse(response.body) as {
    pipelines: Array<{ id: string; name: string; status: string; health: string; role: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.pipelines.length, 5);
  assert.ok(body.pipelines.some(p => p.id === 'stb-daily-pipeline'));
  assert.ok(body.pipelines.some(p => p.id === 'stb-to-video-migration'));
  const stbPipeline = body.pipelines.find(p => p.id === 'stb-daily-pipeline');
  assert.equal(stbPipeline?.health, 'error');
  assert.equal(stbPipeline?.status, 'migrating');
});

test('GET /pipelines/:id returns specific pipeline', async () => {
  const response = await exercise({ method: 'GET', url: '/pipelines/stb-daily-pipeline' });
  const body = JSON.parse(response.body) as {
    pipeline: {
      id: string;
      name: string;
      migration?: { sourcePipelineId?: string; targetPipelineId?: string };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.pipeline.id, 'stb-daily-pipeline');
  assert.equal(body.pipeline.migration?.sourcePipelineId, 'stb-legacy-office-scheduler');
  assert.equal(body.pipeline.migration?.targetPipelineId, 'stb-video-orchestrator');
});

test('GET /pipelines/:id returns 404 for missing pipeline', async () => {
  const response = await exercise({ method: 'GET', url: '/pipelines/nonexistent' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /projects returns full project list', async () => {
  const response = await exercise({ method: 'GET', url: '/projects' });
  const body = JSON.parse(response.body) as {
    projects: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      orchestratorIds?: string[];
      platformIds?: string[];
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.projects.length, 5);
  assert.ok(body.projects.some(p => p.id === 'says-the-bible'));
  const stbProject = body.projects.find(p => p.id === 'says-the-bible');
  assert.equal(stbProject?.category, 'content');
  assert.equal(stbProject?.status, 'migrating');
  assert.ok(stbProject?.orchestratorIds?.includes('stb-pipeline'));
});

test('GET /platforms returns full platform list', async () => {
  const response = await exercise({ method: 'GET', url: '/platforms' });
  const body = JSON.parse(response.body) as {
    platforms: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      projectIds?: string[];
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.platforms.length, 9);
  assert.ok(body.platforms.some(p => p.id === 'youtube'));
  assert.ok(body.platforms.some(p => p.id === 'obsidian'));
  const youtube = body.platforms.find(p => p.id === 'youtube');
  assert.equal(youtube?.category, 'social');
  assert.ok(youtube?.projectIds?.includes('says-the-bible'));
});

test('GET /orchestrators/:id with valid stb-pipeline returns pipeline', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators/stb-pipeline' });
  const body = JSON.parse(response.body) as {
    orchestrator: { id: string; lifecycle: string; health: string };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.orchestrator.id, 'stb-pipeline');
  assert.equal(body.orchestrator.lifecycle, 'migrating');
  assert.equal(body.orchestrator.health, 'error');
});

test('GET /platforms returns platforms with health status', async () => {
  const response = await exercise({ method: 'GET', url: '/platforms' });
  const body = JSON.parse(response.body) as {
    platforms: Array<{ id: string; health: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.platforms.every(p => ['ok', 'warning', 'error', 'unknown'].includes(p.health)));
});

test('GET /pipelines returns pipelines with stages', async () => {
  const response = await exercise({ method: 'GET', url: '/pipelines' });
  const body = JSON.parse(response.body) as {
    pipelines: Array<{ id: string; stages?: string[] }>;
  };

  assert.equal(response.statusCode, 200);
  const stbPipeline = body.pipelines.find(p => p.id === 'stb-daily-pipeline');
  assert.ok(Array.isArray(stbPipeline?.stages));
  assert.ok(stbPipeline?.stages?.includes('generate'));
});
