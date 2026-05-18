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

function createRequest(input: { method?: string; url?: string; remoteAddress?: string }): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };
  if (input.method !== undefined) request.method = input.method;
  if (input.url !== undefined) request.url = input.url;
  return request;
}

async function exercise(input: { method?: string; url?: string; remoteAddress?: string }): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

test('GET /post-orchestrator/status returns read-only scaffold status', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/status' });
  const body = JSON.parse(response.body) as {
    id: string;
    publishingEnabled: boolean;
    schedulingEnabled: boolean;
    executionEnabled: boolean;
    modules: Array<{ id: string; name: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'post-orchestrator');
  assert.equal(body.publishingEnabled, false);
  assert.equal(body.schedulingEnabled, false);
  assert.equal(body.executionEnabled, false);
  assert.ok(body.modules.some((module) => module.id === 'social-proof-asset-flow'));
  assert.ok(body.modules.some((module) => module.id === 'growth-optimization-flow'));
  assert.ok(body.modules.some((module) => module.name === 'Social Proof Asset Flow'));
  assert.ok(body.modules.some((module) => module.name === 'Growth Optimization Flow'));
});

test('GET /post-orchestrator/contracts returns expected contract ids', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/contracts' });
  const body = JSON.parse(response.body) as { contracts: Array<{ id: string }> };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    body.contracts.map((contract) => contract.id),
    [
      'PostEvent',
      'PostDraft',
      'ProoflyAssetRequest',
      'ProoflyAssetResult',
      'XgrowOptimizationRequest',
      'XgrowOptimizationResult',
      'PostScheduleItem',
      'PostAnalyticsResult',
    ],
  );
});

test('GET /post-orchestrator/integrations returns read-only provider integrations', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/integrations' });
  const body = JSON.parse(response.body) as {
    integrations: Array<{
      id: string;
      provider: string;
      name: string;
      legacySource?: string;
      executionEnabled: boolean;
      publishingEnabled: boolean;
      safety: { usesCookies: boolean; usesPlaywright: boolean; writesToMind: boolean };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.integrations.some((integration) => integration.id === 'proofly-social-proof-assets'));
  assert.ok(body.integrations.some((integration) => integration.id === 'xgrow-growth-optimization'));
  assert.ok(body.integrations.some((integration) => integration.name === 'Social Proof Asset Flow'));
  assert.ok(body.integrations.some((integration) => integration.name === 'Growth Optimization Flow'));
  assert.ok(body.integrations.every((integration) => integration.executionEnabled === false));
  assert.ok(body.integrations.every((integration) => integration.publishingEnabled === false));
  const xgrow = body.integrations.find((integration) => integration.id === 'xgrow-growth-optimization');
  assert.equal(xgrow?.safety.usesCookies, true);
  assert.equal(xgrow?.safety.usesPlaywright, true);
  assert.equal(xgrow?.safety.writesToMind, false);
  assert.equal(xgrow?.legacySource, 'xgrow');
});

test('GET /post-orchestrator/recovery returns publishing-disabled and security-review blockers', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/recovery' });
  const body = JSON.parse(response.body) as { items: Array<{ id: string; blocker: string; executionEnabled: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.ok(body.items.some((item) => item.id === 'publishing-disabled'));
  assert.ok(body.items.some((item) => item.id === 'growth-optimization-flow-not-integrated'));
  assert.ok(body.items.some((item) => item.id === 'social-proof-asset-flow-not-integrated'));
  assert.ok(body.items.some((item) => item.id === 'growth-optimization-playwright-security-review-required'));
  assert.equal(body.items.every((item) => item.executionEnabled === false), true);
});

test('GET /post-orchestrator/status never implies writesToMind true', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/status' });
  const body = JSON.parse(response.body) as { modules: Array<{ executionEnabled: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.modules.every((module) => module.executionEnabled === false), true);
});

test('GET /post-orchestrator/status does not expose legacy provider names as primary labels', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/status' });
  const body = JSON.parse(response.body) as { modules: Array<{ name: string; internalName?: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.modules.some((module) => module.name === 'Proofly Asset Provider'), false);
  assert.equal(body.modules.some((module) => module.name === 'Xgrow Optimization Provider'), false);
  assert.equal(body.modules.some((module) => module.internalName === 'Proofly Asset Provider'), true);
  assert.equal(body.modules.some((module) => module.internalName === 'Xgrow Optimization Provider'), true);
});

test('GET /post-orchestrator/flows returns typed read-only flow fixtures', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/flows' });
  const body = JSON.parse(response.body) as {
    flows: Array<{
      id: string;
      name: string;
      platform: string;
      publishingEnabled: boolean;
      schedulingEnabled: boolean;
      executionEnabled: boolean;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.flows.some((flow) => flow.id === 'x-post-flow'));
  assert.ok(body.flows.some((flow) => flow.id === 'github-post-flow'));
  assert.ok(body.flows.some((flow) => flow.id === 'linkedin-post-flow'));
  assert.ok(body.flows.some((flow) => flow.id === 'social-proof-asset-flow'));
  assert.ok(body.flows.some((flow) => flow.id === 'growth-optimization-flow'));
  assert.equal(body.flows.every((flow) => flow.publishingEnabled === false), true);
  assert.equal(body.flows.every((flow) => flow.schedulingEnabled === false), true);
  assert.equal(body.flows.every((flow) => flow.executionEnabled === false), true);
});

test('GET /post-orchestrator/drafts returns typed fixture drafts', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/drafts' });
  const body = JSON.parse(response.body) as {
    drafts: Array<{
      id: string;
      approvalRequired: boolean;
      publishingEnabled: boolean;
      schedulingEnabled: boolean;
      executionEnabled: boolean;
      safety: { writesExternalPlatform: boolean; writesToMind: boolean };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.drafts.some((draft) => draft.id === 'x-release-thread-fixture'));
  assert.ok(body.drafts.some((draft) => draft.id === 'github-release-note-fixture'));
  assert.ok(body.drafts.some((draft) => draft.id === 'linkedin-milestone-fixture'));
  assert.ok(body.drafts.some((draft) => draft.id === 'youtube-video-caption-fixture'));
  assert.ok(body.drafts.some((draft) => draft.id === 'social-proof-card-fixture'));
  assert.equal(body.drafts.every((draft) => draft.approvalRequired === true), true);
  assert.equal(body.drafts.every((draft) => draft.publishingEnabled === false), true);
  assert.equal(body.drafts.every((draft) => draft.schedulingEnabled === false), true);
  assert.equal(body.drafts.every((draft) => draft.executionEnabled === false), true);
  assert.equal(body.drafts.every((draft) => draft.safety.writesExternalPlatform === false), true);
  assert.equal(body.drafts.every((draft) => draft.safety.writesToMind === false), true);
});
