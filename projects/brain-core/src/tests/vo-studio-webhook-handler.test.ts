import test from 'node:test';
import assert from 'node:assert/strict';
import { processWebhookEventRequest, verifyWebhookSignatureRequest, routeEventRequest } from '../adapters/vo-studio-webhook-handler.js';

test('processWebhookEventRequest accepts valid webhook event', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    platform: 'youtube',
    eventType: 'video.published',
    payload: { videoId: 'vid-789', title: 'My Video' },
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.delivery!.webhookId, 'webhook-123');
  assert.equal(result.preview.delivery!.projectId, 'project-456');
  assert.equal(result.preview.delivery!.platform, 'youtube');
  assert.equal(result.preview.delivery!.eventType, 'video.published');
  assert.equal(result.preview.delivery!.status, 'received');
  assert.ok(result.preview.delivery!.id);
  assert.ok(result.preview.delivery!.receivedAt);
});

test('processWebhookEventRequest rejects missing webhookId', () => {
  const result = processWebhookEventRequest({
    webhookId: '',
    projectId: 'project-456',
    platform: 'youtube',
    eventType: 'video.published',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
});

test('processWebhookEventRequest rejects missing projectId', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: '',
    platform: 'youtube',
    eventType: 'video.published',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('processWebhookEventRequest rejects missing platform', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    platform: '',
    eventType: 'video.published',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /platform is required/);
});

test('processWebhookEventRequest rejects missing eventType', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    platform: 'youtube',
    eventType: '',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /eventType is required/);
});

test('processWebhookEventRequest rejects missing payload', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    platform: 'youtube',
    eventType: 'video.published',
    payload: null as unknown as Record<string, unknown>,
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /payload is required/);
});

test('processWebhookEventRequest generates unique delivery IDs', () => {
  const result1 = processWebhookEventRequest({
    webhookId: 'webhook-1',
    projectId: 'project-1',
    platform: 'youtube',
    eventType: 'video.published',
    payload: { x: 1 },
  });

  const result2 = processWebhookEventRequest({
    webhookId: 'webhook-2',
    projectId: 'project-2',
    platform: 'tiktok',
    eventType: 'video.published',
    payload: { y: 2 },
  });

  assert.notEqual(
    result1.preview!.delivery!.id,
    result2.preview!.delivery!.id,
  );
});

test('processWebhookEventRequest includes optional signature when provided', () => {
  const result = processWebhookEventRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    platform: 'youtube',
    eventType: 'video.published',
    payload: {},
    signature: 'sig-xyz',
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.delivery!.signature, 'sig-xyz');
});

test('verifyWebhookSignatureRequest accepts valid signature', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    secret: 'secret-key-789',
    signature: 'sig-abc123',
    rawBody: '{"event":"video.published"}',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.verification!.webhookId, 'webhook-123');
  assert.equal(result.preview.verification!.projectId, 'project-456');
  assert.equal(result.preview.verification!.status, 'verified');
  assert.ok(result.preview.verification!.verifiedAt);
});

test('verifyWebhookSignatureRequest rejects missing webhookId', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: '',
    projectId: 'project-456',
    secret: 'secret',
    signature: 'sig',
    rawBody: 'body',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
});

test('verifyWebhookSignatureRequest rejects missing projectId', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: 'webhook-123',
    projectId: '',
    secret: 'secret',
    signature: 'sig',
    rawBody: 'body',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('verifyWebhookSignatureRequest rejects missing secret', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    secret: '',
    signature: 'sig',
    rawBody: 'body',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /secret is required/);
});

test('verifyWebhookSignatureRequest rejects missing signature', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    secret: 'secret',
    signature: '',
    rawBody: 'body',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /signature is required/);
});

test('verifyWebhookSignatureRequest rejects missing rawBody', () => {
  const result = verifyWebhookSignatureRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    secret: 'secret',
    signature: 'sig',
    rawBody: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /rawBody is required/);
});

test('routeEventRequest maps youtube events to publish type', () => {
  const result = routeEventRequest({
    projectId: 'project-123',
    platform: 'youtube',
    platformEventType: 'video.published',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.routing!.projectId, 'project-123');
  assert.equal(result.preview.routing!.platform, 'youtube');
  assert.equal(result.preview.routing!.platformEventType, 'video.published');
  assert.ok(result.preview.routing!.internalEventType.startsWith('publish.'));
  assert.equal(result.preview.routing!.status, 'mapped');
});

test('routeEventRequest maps tiktok events to publish type', () => {
  const result = routeEventRequest({
    projectId: 'project-123',
    platform: 'tiktok',
    platformEventType: 'video.approved',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
  assert.ok(result.preview.routing!.internalEventType.startsWith('publish.'));
});

test('routeEventRequest preserves approval events', () => {
  const result = routeEventRequest({
    projectId: 'project-123',
    platform: 'internal',
    platformEventType: 'approval.submitted',
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.routing!.internalEventType, 'approval.submitted');
});

test('routeEventRequest rejects missing projectId', () => {
  const result = routeEventRequest({
    projectId: '',
    platform: 'youtube',
    platformEventType: 'video.published',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('routeEventRequest rejects missing platform', () => {
  const result = routeEventRequest({
    projectId: 'project-123',
    platform: '',
    platformEventType: 'video.published',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /platform is required/);
});

test('routeEventRequest rejects missing platformEventType', () => {
  const result = routeEventRequest({
    projectId: 'project-123',
    platform: 'youtube',
    platformEventType: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /platformEventType is required/);
});

import { readWebhookDeliveries, readPlatformEventMapping } from '../adapters/vo-studio-webhook-handler.js';

test('readWebhookDeliveries accepts valid inputs', () => {
  const result = readWebhookDeliveries('webhook-123', 'project-456');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.deliveries, []);
  assert.equal(result.webhookId, 'webhook-123');
  assert.equal(result.projectId, 'project-456');
});

test('readWebhookDeliveries rejects missing webhookId', () => {
  const result = readWebhookDeliveries('', 'project-456');

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
  assert.equal(result.count, 0);
});

test('readWebhookDeliveries rejects missing projectId', () => {
  const result = readWebhookDeliveries('webhook-123', '');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readWebhookDeliveries accepts valid limit', () => {
  const result = readWebhookDeliveries('webhook-123', 'project-456', 100);

  assert.equal(result.ok, true);
});

test('readWebhookDeliveries rejects limit below 1', () => {
  const result = readWebhookDeliveries('webhook-123', 'project-456', 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readWebhookDeliveries rejects limit above 500', () => {
  const result = readWebhookDeliveries('webhook-123', 'project-456', 501);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readPlatformEventMapping accepts valid platform', () => {
  const result = readPlatformEventMapping('youtube');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.mappings, []);
  assert.equal(result.platform, 'youtube');
});

test('readPlatformEventMapping rejects missing platform', () => {
  const result = readPlatformEventMapping('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /platform is required/);
  assert.equal(result.count, 0);
});

test('readPlatformEventMapping accepts multiple platform types', () => {
  const result1 = readPlatformEventMapping('tiktok');
  const result2 = readPlatformEventMapping('instagram');

  assert.equal(result1.ok, true);
  assert.equal(result2.ok, true);
  assert.equal(result1.platform, 'tiktok');
  assert.equal(result2.platform, 'instagram');
});
