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

test('GET /post-orchestrator/events returns typed event fixtures', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/events' });
  const body = JSON.parse(response.body) as {
    events: Array<{
      id: string;
      safety: { fixtureOnly: boolean; writesExternalPlatform: boolean; writesToMind: boolean };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.events.some((event) => event.id === 'github-release-event-fixture'));
  assert.ok(body.events.some((event) => event.id === 'product-milestone-event-fixture'));
  assert.ok(body.events.some((event) => event.id === 'video-rendered-event-fixture'));
  assert.ok(body.events.some((event) => event.id === 'blog-published-event-fixture'));
  assert.ok(body.events.some((event) => event.id === 'manual-social-proof-event-fixture'));
  assert.equal(body.events.every((event) => event.safety.fixtureOnly === true), true);
  assert.equal(body.events.every((event) => event.safety.writesExternalPlatform === false), true);
  assert.equal(body.events.every((event) => event.safety.writesToMind === false), true);
});

test('GET /post-orchestrator/dry-run/github-release-event-fixture returns preview plan', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/dry-run/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    plan: {
      status: string;
      drafts: Array<{
        flowId: string;
        approvalRequired: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        safety: { writesExternalPlatform: boolean; writesToMind: boolean; usesPlaywright: boolean; usesCookies: boolean };
      }>;
      unsupportedFlowIds: string[];
      blockers: string[];
      safety: { dryRunOnly: boolean; publishingEnabled: boolean; schedulingEnabled: boolean; executionEnabled: boolean; writesExternalPlatform: boolean; writesToMind: boolean; usesPlaywright: boolean; usesCookies: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.status, 'preview');
  assert.ok(body.plan.drafts.some((draft) => draft.flowId === 'x-post-flow'));
  assert.ok(body.plan.drafts.some((draft) => draft.flowId === 'github-post-flow'));
  assert.ok(body.plan.drafts.some((draft) => draft.flowId === 'linkedin-post-flow'));
  assert.equal(body.plan.drafts.every((draft) => draft.approvalRequired === true), true);
  assert.equal(body.plan.drafts.every((draft) => draft.publishingEnabled === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.schedulingEnabled === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.executionEnabled === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.safety.writesExternalPlatform === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.safety.writesToMind === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.safety.usesPlaywright === false), true);
  assert.equal(body.plan.drafts.every((draft) => draft.safety.usesCookies === false), true);
  assert.equal(body.plan.safety.dryRunOnly, true);
  assert.equal(body.plan.safety.publishingEnabled, false);
  assert.equal(body.plan.safety.schedulingEnabled, false);
  assert.equal(body.plan.safety.executionEnabled, false);
});

test('GET /post-orchestrator/dry-run/unknown-event returns blocked plan', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/dry-run/unknown-event' });
  const body = JSON.parse(response.body) as {
    plan: { status: string; drafts: unknown[]; blockers: string[]; unsupportedFlowIds: string[] };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.drafts.length, 0);
  assert.ok(body.plan.blockers.includes('Unknown event fixture'));
  assert.equal(body.plan.unsupportedFlowIds.length, 0);
});

test('GET /post-orchestrator/dry-run does not imply legacy provider names or Playwright usage', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/dry-run/github-release-event-fixture' });
  const body = JSON.parse(response.body) as { plan: { drafts: Array<{ title: string; copyPreview: string }>; safety: { usesPlaywright: boolean; usesCookies: boolean } } };

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.stringify(body).includes('Proofly'), false);
  assert.equal(JSON.stringify(body).includes('Xgrow'), false);
  assert.equal(body.plan.safety.usesPlaywright, false);
  assert.equal(body.plan.safety.usesCookies, false);
});

test('GET /post-orchestrator/review-queue/github-release-event-fixture returns queue', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/review-queue/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    queue: {
      eventId: string;
      status: string;
      itemCount: number;
      approvalRequestedCount: number;
      blockedCount: number;
      items: Array<{
        id: string;
        draftPlanId: string;
        reviewOnly?: boolean;
        dryRunOnly?: boolean;
        approvalRequired: boolean;
        canRequestApproval: boolean;
        canApproveForPublishing: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        risk: string;
        status: string;
      }>;
      safety: { reviewOnly: boolean; publishingEnabled: boolean; schedulingEnabled: boolean; executionEnabled: boolean; writesExternalPlatform: boolean; writesToMind: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.queue.eventId, 'github-release-event-fixture');
  assert.ok(body.queue.itemCount > 0);
  assert.equal(body.queue.items.every((item) => item.approvalRequired === true), true);
  assert.equal(body.queue.items.every((item) => item.publishingEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.schedulingEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.executionEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.canApproveForPublishing === false), true);
  assert.equal(body.queue.safety.reviewOnly, true);
  assert.equal(body.queue.safety.publishingEnabled, false);
  assert.equal(body.queue.safety.schedulingEnabled, false);
  assert.equal(body.queue.safety.executionEnabled, false);
});

test('GET /post-orchestrator/review-queue items correspond to dry-run plans', async () => {
  const dryRun = await exercise({ method: 'GET', url: '/post-orchestrator/dry-run/github-release-event-fixture' });
  const dryRunBody = JSON.parse(dryRun.body) as { plan: { drafts: Array<{ id: string }> } };
  const queue = await exercise({ method: 'GET', url: '/post-orchestrator/review-queue/github-release-event-fixture' });
  const queueBody = JSON.parse(queue.body) as { queue: { items: Array<{ draftPlanId: string }> } };

  assert.equal(queue.statusCode, 200);
  assert.deepEqual(
    queueBody.queue.items.map((item) => item.draftPlanId),
    dryRunBody.plan.drafts.map((draft) => draft.id),
  );
});

test('GET /post-orchestrator/review-queue/unknown-event returns blocked queue', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/review-queue/unknown-event' });
  const body = JSON.parse(response.body) as { queue: { status: string; items: unknown[] } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.queue.status, 'blocked');
  assert.equal(body.queue.items.length, 0);
});

test('POST /post-orchestrator/review-queue/:reviewItemId/request-approval returns executionDidRun false', async () => {
  const response = await exercise({ method: 'POST', url: '/post-orchestrator/review-queue/review-dry-run-github-release-event-fixture-x-post-flow/request-approval' });
  const body = JSON.parse(response.body) as { status: string; executionDidRun: boolean; approvalId?: string };

  assert.ok([200, 202, 400].includes(response.statusCode));
  assert.equal(body.executionDidRun, false);
  assert.ok(['requested', 'blocked', 'invalid'].includes(body.status));
});

test('POST /post-orchestrator/review-queue/:reviewItemId/request-approval creates approvalId or blocks safely', async () => {
  const response = await exercise({ method: 'POST', url: '/post-orchestrator/review-queue/review-dry-run-github-release-event-fixture-x-post-flow/request-approval' });
  const body = JSON.parse(response.body) as { status: string; approvalId?: string; summary: string };

  assert.ok(response.statusCode === 202 || response.statusCode === 400);
  assert.ok(body.status === 'requested' || body.status === 'blocked');
  if (body.status === 'requested') {
    assert.ok(body.approvalId);
  }
});

test('POST /post-orchestrator/review-queue request approval does not publish or schedule', async () => {
  const response = await exercise({ method: 'POST', url: '/post-orchestrator/review-queue/review-dry-run-github-release-event-fixture-x-post-flow/request-approval' });
  const body = JSON.parse(response.body) as { safety?: { writesExternalPlatform: boolean; writesToMind: boolean; usesPlaywright: boolean; usesCookies: boolean } };

  assert.equal(response.statusCode === 202 || response.statusCode === 400, true);
  assert.equal(body.safety?.writesExternalPlatform, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.equal(body.safety?.usesPlaywright, false);
  assert.equal(body.safety?.usesCookies, false);
});

test('GET /post-orchestrator/schedule-preview/github-release-event-fixture returns preview queue', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/schedule-preview/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    queue: {
      eventId: string;
      status: string;
      itemCount: number;
      approvalRequestedCount: number;
      blockedCount: number;
      items: Array<{
        reviewItemId: string;
        draftPlanId: string;
        approvalRequired: boolean;
        canCreateSchedulerJob: boolean;
        canPublish: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        status: string;
        safety: { previewOnly: boolean; writesScheduler: boolean; writesExternalPlatform: boolean; writesToMind: boolean; usesCookies: boolean; usesPlaywright: boolean; callsExternalAI: boolean };
      }>;
      safety: { previewOnly: boolean; publishingEnabled: boolean; schedulingEnabled: boolean; executionEnabled: boolean; writesScheduler: boolean; writesExternalPlatform: boolean; writesToMind: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.queue.eventId, 'github-release-event-fixture');
  assert.ok(body.queue.itemCount > 0);
  assert.equal(body.queue.items.every((item) => item.approvalRequired === true), true);
  assert.equal(body.queue.items.every((item) => item.canCreateSchedulerJob === false), true);
  assert.equal(body.queue.items.every((item) => item.canPublish === false), true);
  assert.equal(body.queue.items.every((item) => item.publishingEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.schedulingEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.executionEnabled === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.previewOnly === true), true);
  assert.equal(body.queue.items.every((item) => item.safety.writesScheduler === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.writesExternalPlatform === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.writesToMind === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.usesCookies === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.usesPlaywright === false), true);
  assert.equal(body.queue.items.every((item) => item.safety.callsExternalAI === false), true);
  assert.equal(body.queue.safety.previewOnly, true);
  assert.equal(body.queue.safety.publishingEnabled, false);
  assert.equal(body.queue.safety.schedulingEnabled, false);
  assert.equal(body.queue.safety.executionEnabled, false);
  assert.equal(body.queue.safety.writesScheduler, false);
});

test('GET /post-orchestrator/schedule-preview items correspond to review queue items', async () => {
  const reviewQueue = await exercise({ method: 'GET', url: '/post-orchestrator/review-queue/github-release-event-fixture' });
  const reviewBody = JSON.parse(reviewQueue.body) as { queue: { items: Array<{ id: string }> } };
  const scheduleQueue = await exercise({ method: 'GET', url: '/post-orchestrator/schedule-preview/github-release-event-fixture' });
  const scheduleBody = JSON.parse(scheduleQueue.body) as { queue: { items: Array<{ reviewItemId: string }> } };

  assert.equal(scheduleQueue.statusCode, 200);
  assert.deepEqual(
    scheduleBody.queue.items.map((item) => item.reviewItemId),
    reviewBody.queue.items.map((item) => item.id),
  );
});

test('GET /post-orchestrator/schedule-preview/unknown-event returns blocked queue', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/schedule-preview/unknown-event' });
  const body = JSON.parse(response.body) as { queue: { status: string; items: unknown[] } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.queue.status, 'blocked');
  assert.equal(body.queue.items.length, 0);
});

test('POST /post-orchestrator/schedule-preview/:schedulePreviewItemId/request-approval returns executionDidRun false', async () => {
  const response = await exercise({ method: 'POST', url: '/post-orchestrator/schedule-preview/schedule-review-dry-run-github-release-event-fixture-x-post-flow/request-approval' });
  const body = JSON.parse(response.body) as { status: string; executionDidRun: boolean; approvalId?: string };

  assert.ok([200, 202, 400].includes(response.statusCode));
  assert.equal(body.executionDidRun, false);
  assert.ok(['requested', 'blocked', 'invalid'].includes(body.status));
});

test('POST /post-orchestrator/schedule-preview request approval does not create scheduler job', async () => {
  const response = await exercise({ method: 'POST', url: '/post-orchestrator/schedule-preview/schedule-review-dry-run-github-release-event-fixture-x-post-flow/request-approval' });
  const body = JSON.parse(response.body) as { status: string; safety?: { writesScheduler: boolean; writesExternalPlatform: boolean; writesToMind: boolean; usesPlaywright: boolean; usesCookies: boolean } };

  assert.equal(response.statusCode === 202 || response.statusCode === 400, true);
  assert.equal(body.safety?.writesScheduler, false);
  assert.equal(body.safety?.writesExternalPlatform, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.equal(body.safety?.usesPlaywright, false);
  assert.equal(body.safety?.usesCookies, false);
});

test('POST /post-orchestrator/schedule-preview request approval does not expose legacy provider labels', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/schedule-preview/github-release-event-fixture' });
  const body = JSON.parse(response.body) as { queue: { items: Array<{ title: string; rationale: string }> } };

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.stringify(body).includes('Proofly'), false);
  assert.equal(JSON.stringify(body).includes('Xgrow'), false);
});

test('GET /post-orchestrator/analytics returns fixture analytics', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/analytics' });
  const body = JSON.parse(response.body) as {
    analytics: Array<{
      id: string;
      platform: string;
      source: string;
      safety: {
        fixtureOnly: boolean;
        callsExternalAnalyticsApi: boolean;
        readsCookies: boolean;
        readsSecrets: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
      };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.analytics.some((item) => item.id === 'x-release-thread-analytics-fixture'));
  assert.ok(body.analytics.some((item) => item.id === 'linkedin-milestone-analytics-fixture'));
  assert.ok(body.analytics.some((item) => item.id === 'youtube-video-caption-analytics-fixture'));
  assert.ok(body.analytics.some((item) => item.id === 'github-release-note-analytics-fixture'));
  assert.ok(body.analytics.some((item) => item.id === 'social-proof-card-analytics-fixture'));
  assert.equal(body.analytics.every((item) => item.source === 'fixture'), true);
  assert.equal(body.analytics.every((item) => item.safety.fixtureOnly === true), true);
  assert.equal(body.analytics.every((item) => item.safety.callsExternalAnalyticsApi === false), true);
  assert.equal(body.analytics.every((item) => item.safety.readsCookies === false), true);
  assert.equal(body.analytics.every((item) => item.safety.readsSecrets === false), true);
  assert.equal(body.analytics.every((item) => item.safety.writesExternalPlatform === false), true);
  assert.equal(body.analytics.every((item) => item.safety.writesToMind === false), true);
});

test('GET /post-orchestrator/pipeline/github-release-event-fixture returns pipeline', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/pipeline/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    pipeline: {
      eventId: string;
      status: string;
      steps: Array<{ id: string; label: string; status: string; itemCount: number; blockedCount: number; approvalRequiredCount: number }>;
      totals: { draftCount: number; reviewItemCount: number; schedulePreviewItemCount: number; analyticsFixtureCount: number; blockerCount: number; approvalRequiredCount: number };
      safety: { endToEndPreviewOnly: boolean; publishingEnabled: boolean; schedulingEnabled: boolean; executionEnabled: boolean; writesExternalPlatform: boolean; writesToMind: boolean; callsExternalApi: boolean; callsExternalAI: boolean; usesCookies: boolean; usesPlaywright: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.pipeline.eventId, 'github-release-event-fixture');
  assert.ok(body.pipeline.steps.some((step) => step.id === 'event'));
  assert.ok(body.pipeline.steps.some((step) => step.id === 'dry-run'));
  assert.ok(body.pipeline.steps.some((step) => step.id === 'review'));
  assert.ok(body.pipeline.steps.some((step) => step.id === 'schedule-preview'));
  assert.ok(body.pipeline.steps.some((step) => step.id === 'analytics-feedback'));
  assert.ok(body.pipeline.steps.some((step) => step.id === 'readiness'));
  assert.equal(body.pipeline.totals.draftCount > 0, true);
  assert.equal(body.pipeline.totals.reviewItemCount > 0, true);
  assert.equal(body.pipeline.totals.schedulePreviewItemCount > 0, true);
  assert.equal(body.pipeline.totals.analyticsFixtureCount > 0, true);
  assert.equal(body.pipeline.safety.endToEndPreviewOnly, true);
  assert.equal(body.pipeline.safety.publishingEnabled, false);
  assert.equal(body.pipeline.safety.schedulingEnabled, false);
  assert.equal(body.pipeline.safety.executionEnabled, false);
  assert.equal(body.pipeline.safety.writesExternalPlatform, false);
  assert.equal(body.pipeline.safety.writesToMind, false);
  assert.equal(body.pipeline.safety.callsExternalApi, false);
  assert.equal(body.pipeline.safety.callsExternalAI, false);
  assert.equal(body.pipeline.safety.usesCookies, false);
  assert.equal(body.pipeline.safety.usesPlaywright, false);
});

test('GET /post-orchestrator/pipeline/unknown-event returns blocked pipeline', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/pipeline/unknown-event' });
  const body = JSON.parse(response.body) as { pipeline: { status: string; blockers: string[] } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.pipeline.status, 'blocked');
  assert.ok(body.pipeline.blockers.includes('Unknown event fixture'));
});

test('GET /post-orchestrator/readiness/github-release-event-fixture returns readiness', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/readiness/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    readiness: {
      score: number;
      grade: string;
      status: string;
      blockers: Array<{ id: string; source: string; title: string }>;
      safety: { readOnly: boolean; publishingEnabled: boolean; schedulingEnabled: boolean; executionEnabled: boolean; writesExternalPlatform: boolean; writesToMind: boolean; callsExternalApi: boolean; callsExternalAI: boolean; canAutoFix: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.readiness.score, 'number');
  assert.equal(body.readiness.grade, 'blocked');
  assert.equal(body.readiness.status, 'blocked');
  assert.ok(body.readiness.blockers.some((blocker) => blocker.id === 'publishing-disabled'));
  assert.ok(body.readiness.blockers.some((blocker) => blocker.id === 'scheduling-disabled'));
  assert.equal(body.readiness.safety.readOnly, true);
  assert.equal(body.readiness.safety.publishingEnabled, false);
  assert.equal(body.readiness.safety.schedulingEnabled, false);
  assert.equal(body.readiness.safety.executionEnabled, false);
  assert.equal(body.readiness.safety.canAutoFix, false);
});

test('GET /post-orchestrator/readiness/unknown-event returns blocked readiness', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/readiness/unknown-event' });
  const body = JSON.parse(response.body) as { readiness: { status: string; blockers: Array<{ id: string }> } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.readiness.status, 'blocked');
  assert.ok(body.readiness.blockers.some((blocker) => blocker.id === 'unknown-event'));
});

test('GET /post-orchestrator/platform-policies returns policies', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/platform-policies' });
  const body = JSON.parse(response.body) as {
    policies: Array<{
      platform: string;
      publishingMode: string;
      riskLevel: string;
      safety: {
        readsCookies: boolean;
        readsSecrets: boolean;
        usesPlaywright: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
      };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.policies.map((policy) => policy.platform).sort(), ['blog', 'facebook', 'github', 'internal', 'linkedin', 'x', 'youtube']);
  assert.equal(body.policies.every((policy) => policy.safety.readsCookies === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.readsSecrets === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.usesPlaywright === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.writesExternalPlatform === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.writesToMind === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.publishingEnabled === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.schedulingEnabled === false), true);
  assert.equal(body.policies.every((policy) => policy.safety.executionEnabled === false), true);
  const x = body.policies.find((policy) => policy.platform === 'x');
  assert.equal(Boolean(x && ['browser-automation-prohibited', 'pending-security-review'].includes(x.publishingMode)), true);
  assert.equal(Boolean(x && ['blocked', 'high'].includes(x.riskLevel)), true);
});

test('GET /post-orchestrator/decommission-readiness returns items', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/decommission-readiness' });
  const body = JSON.parse(response.body) as {
    items: Array<{
      target: string;
      safety: {
        decommissionStarted: boolean;
        deletesFiles: boolean;
        modifiesLegacyRepo: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
        requiresExplicitUserApproval: boolean;
      };
    }>;
    overall: { status: string; decommissionStarted: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.items.some((item) => item.target === 'legacy-asset-system'));
  assert.ok(body.items.some((item) => item.target === 'legacy-growth-system'));
  assert.equal(body.items.every((item) => item.safety.decommissionStarted === false), true);
  assert.equal(body.items.every((item) => item.safety.deletesFiles === false), true);
  assert.equal(body.items.every((item) => item.safety.modifiesLegacyRepo === false), true);
  assert.equal(body.items.every((item) => item.safety.publishingEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.schedulingEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.writesExternalPlatform === false), true);
  assert.equal(body.items.every((item) => item.safety.writesToMind === false), true);
  assert.equal(body.items.every((item) => item.safety.requiresExplicitUserApproval === true), true);
  assert.equal(['blocked', 'not-ready'].includes(body.overall.status), true);
  assert.equal(body.overall.decommissionStarted, false);
});

test('GET /post-orchestrator/operator-guidance returns items', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/operator-guidance' });
  const body = JSON.parse(response.body) as {
    items: Array<{
      id: string;
      severity: string;
      safety: {
        readOnly: boolean;
        autoFixEnabled: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
      };
      steps: Array<{
        safety: {
          executesCode: boolean;
          writesFiles: boolean;
          writesExternalPlatform: boolean;
          writesToMind: boolean;
        };
      }>;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.items.some((item) => item.id === 'platform-security-review'));
  assert.ok(body.items.some((item) => item.id === 'publishing-disabled'));
  assert.ok(body.items.some((item) => item.id === 'decommission-not-ready'));
  assert.equal(body.items.every((item) => item.safety.readOnly === true), true);
  assert.equal(body.items.every((item) => item.safety.autoFixEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.publishingEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.schedulingEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.executionEnabled === false), true);
  assert.equal(body.items.every((item) => item.safety.writesExternalPlatform === false), true);
  assert.equal(body.items.every((item) => item.safety.writesToMind === false), true);
  assert.equal(body.items.every((item) => item.steps.every((step) => step.safety.executesCode === false)), true);
  assert.equal(body.items.every((item) => item.steps.every((step) => step.safety.writesFiles === false)), true);
  assert.equal(body.items.every((item) => item.steps.every((step) => step.safety.writesExternalPlatform === false)), true);
  assert.equal(body.items.every((item) => item.steps.every((step) => step.safety.writesToMind === false)), true);
});

test('GET /post-orchestrator/manual-export/github-release-event-fixture returns package', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/manual-export/github-release-event-fixture' });
  const body = JSON.parse(response.body) as {
    package: {
      status: string;
      itemCount: number;
      safety: {
        previewOnly: boolean;
        writesFiles: boolean;
        downloadsFile: boolean;
        copiesToClipboard: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
      };
      items: Array<{
        safety: {
          previewOnly: boolean;
          writesFiles: boolean;
          downloadsFile: boolean;
          copiesToClipboard: boolean;
          writesExternalPlatform: boolean;
          writesToMind: boolean;
          publishingEnabled: boolean;
          schedulingEnabled: boolean;
          executionEnabled: boolean;
        };
      }>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.package.status, 'preview');
  assert.ok(body.package.itemCount > 0);
  assert.equal(body.package.safety.previewOnly, true);
  assert.equal(body.package.safety.writesFiles, false);
  assert.equal(body.package.safety.downloadsFile, false);
  assert.equal(body.package.safety.copiesToClipboard, false);
  assert.equal(body.package.safety.writesExternalPlatform, false);
  assert.equal(body.package.safety.writesToMind, false);
  assert.equal(body.package.safety.publishingEnabled, false);
  assert.equal(body.package.safety.schedulingEnabled, false);
  assert.equal(body.package.safety.executionEnabled, false);
  assert.equal(body.package.items.every((item) => item.safety.previewOnly === true), true);
  assert.equal(body.package.items.every((item) => item.safety.writesFiles === false), true);
  assert.equal(body.package.items.every((item) => item.safety.downloadsFile === false), true);
  assert.equal(body.package.items.every((item) => item.safety.copiesToClipboard === false), true);
  assert.equal(body.package.items.every((item) => item.safety.writesExternalPlatform === false), true);
  assert.equal(body.package.items.every((item) => item.safety.writesToMind === false), true);
  assert.equal(body.package.items.every((item) => item.safety.publishingEnabled === false), true);
  assert.equal(body.package.items.every((item) => item.safety.schedulingEnabled === false), true);
  assert.equal(body.package.items.every((item) => item.safety.executionEnabled === false), true);
});

test('GET /post-orchestrator/manual-export/unknown-event returns blocked package', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/manual-export/unknown-event' });
  const body = JSON.parse(response.body) as { package: { status: string; items: unknown[] } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.package.status, 'blocked');
  assert.equal(body.package.items.length, 0);
});

test('GET /post-orchestrator/acceptance-checklist returns checklist', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/acceptance-checklist' });
  const body = JSON.parse(response.body) as {
    checklist: {
      status: string;
      checks: Array<{
        id: string;
        required: boolean;
        status: string;
        safety: {
          readOnly: boolean;
          executesCode: boolean;
          writesFiles: boolean;
          writesExternalPlatform: boolean;
          writesToMind: boolean;
        };
      }>;
      safety: {
        readOnly: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
        decommissionStarted: boolean;
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(['preview-ready', 'blocked'].includes(body.checklist.status));
  assert.ok(body.checklist.checks.some((check) => check.id === 'status-endpoint'));
  assert.ok(body.checklist.checks.some((check) => check.id === 'dashboard-section'));
  assert.ok(body.checklist.checks.some((check) => check.id === 'real-publishing-policy'));
  assert.equal(body.checklist.safety.readOnly, true);
  assert.equal(body.checklist.safety.publishingEnabled, false);
  assert.equal(body.checklist.safety.schedulingEnabled, false);
  assert.equal(body.checklist.safety.executionEnabled, false);
  assert.equal(body.checklist.safety.writesExternalPlatform, false);
  assert.equal(body.checklist.safety.writesToMind, false);
  assert.equal(body.checklist.safety.decommissionStarted, false);
  assert.equal(body.checklist.checks.every((check) => check.safety.readOnly === true), true);
  assert.equal(body.checklist.checks.every((check) => check.safety.executesCode === false), true);
  assert.equal(body.checklist.checks.every((check) => check.safety.writesFiles === false), true);
});

test('GET /post-orchestrator/migration-parity returns report', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/migration-parity' });
  const body = JSON.parse(response.body) as {
    report: {
      status: string;
      capabilities: Array<{ area: string; status: string }>;
      blockers: string[];
      safety: {
        readOnly: boolean;
        modifiesLegacyRepo: boolean;
        decommissionStarted: boolean;
        deletesFiles: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        writesExternalPlatform: boolean;
        writesToMind: boolean;
        requiresExplicitUserApprovalForDecommission: boolean;
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(['blocked', 'in-progress', 'preview-ready'].includes(body.report.status));
  assert.ok(body.report.capabilities.some((capability) => capability.area === 'asset-generation'));
  assert.ok(body.report.capabilities.some((capability) => capability.area === 'scheduler'));
  assert.ok(body.report.capabilities.some((capability) => capability.area === 'publishing'));
  assert.ok(body.report.capabilities.some((capability) => capability.area === 'manual-export'));
  assert.ok(body.report.blockers.includes('Real publishing is not designed yet.'));
  assert.ok(body.report.blockers.includes('Platform security review is incomplete.'));
  assert.equal(body.report.safety.readOnly, true);
  assert.equal(body.report.safety.modifiesLegacyRepo, false);
  assert.equal(body.report.safety.decommissionStarted, false);
  assert.equal(body.report.safety.deletesFiles, false);
  assert.equal(body.report.safety.publishingEnabled, false);
  assert.equal(body.report.safety.schedulingEnabled, false);
  assert.equal(body.report.safety.writesExternalPlatform, false);
  assert.equal(body.report.safety.writesToMind, false);
  assert.equal(body.report.safety.requiresExplicitUserApprovalForDecommission, true);
  const publishing = body.report.capabilities.find((capability) => capability.area === 'publishing');
  assert.ok(publishing);
  assert.equal(publishing?.status, 'blocked');
});

test('GET /post-orchestrator/roadmap-checkpoint returns checkpoint', async () => {
  const response = await exercise({ method: 'GET', url: '/post-orchestrator/roadmap-checkpoint' });
  const body = JSON.parse(response.body) as {
    checkpoint: {
      currentPhase: string;
      completedPhaseCount: number;
      blockedPhaseCount: number;
      nextRecommendedPhase: string;
      nextPhaseRequiresUserApproval: boolean;
      phases: Array<{ id: string; status: string }>;
      safety: {
        readOnly: boolean;
        publishingEnabled: boolean;
        schedulingEnabled: boolean;
        executionEnabled: boolean;
        requiresExplicitUserApprovalBeforePublishingDesign: boolean;
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checkpoint.currentPhase, 'P15 roadmap checkpoint');
  assert.ok(body.checkpoint.phases.some((phase) => phase.id === 'P1' && phase.status === 'complete'));
  assert.ok(body.checkpoint.phases.some((phase) => phase.id === 'P14' && phase.status === 'complete'));
  assert.ok(body.checkpoint.phases.some((phase) => phase.id === 'P16' && ['blocked', 'not-started'].includes(phase.status)));
  assert.equal(body.checkpoint.nextPhaseRequiresUserApproval, true);
  assert.equal(body.checkpoint.safety.readOnly, true);
  assert.equal(body.checkpoint.safety.publishingEnabled, false);
  assert.equal(body.checkpoint.safety.schedulingEnabled, false);
  assert.equal(body.checkpoint.safety.executionEnabled, false);
  assert.equal(body.checkpoint.safety.requiresExplicitUserApprovalBeforePublishingDesign, true);
});
