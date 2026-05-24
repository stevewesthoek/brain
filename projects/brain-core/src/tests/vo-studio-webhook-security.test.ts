import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateWebhookSecretRequest, disableWebhookRequest } from '../adapters/vo-studio-orchestration.js';

test('rotateWebhookSecretRequest accepts valid input', () => {
  const result = rotateWebhookSecretRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.webhook!.id, 'webhook-123');
  assert.equal(result.preview.webhook!.projectId, 'project-456');
  assert.ok(result.preview.webhook!.newSecret);
  assert.equal(result.preview.webhook!.status, 'active');
  assert.ok(result.preview.webhook!.rotatedAt);
});

test('rotateWebhookSecretRequest rejects missing webhookId', () => {
  const result = rotateWebhookSecretRequest({
    webhookId: '',
    projectId: 'project-456',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
});

test('rotateWebhookSecretRequest rejects missing projectId', () => {
  const result = rotateWebhookSecretRequest({
    webhookId: 'webhook-123',
    projectId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('rotateWebhookSecretRequest generates unique secrets', () => {
  const result1 = rotateWebhookSecretRequest({
    webhookId: 'webhook-1',
    projectId: 'project-1',
  });

  const result2 = rotateWebhookSecretRequest({
    webhookId: 'webhook-2',
    projectId: 'project-2',
  });

  assert.notEqual(
    result1.preview!.webhook!.newSecret,
    result2.preview!.webhook!.newSecret,
  );
});

test('rotateWebhookSecretRequest secret is non-empty string', () => {
  const result = rotateWebhookSecretRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
  });

  assert.equal(result.ok, true);
  assert.ok(typeof result.preview!.webhook!.newSecret === 'string');
  assert.ok(result.preview!.webhook!.newSecret.length > 0);
});

test('disableWebhookRequest accepts valid input', () => {
  const result = disableWebhookRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    reason: 'Webhook no longer needed',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.webhook!.id, 'webhook-123');
  assert.equal(result.preview.webhook!.projectId, 'project-456');
  assert.equal(result.preview.webhook!.reason, 'Webhook no longer needed');
  assert.equal(result.preview.webhook!.status, 'disabled');
});

test('disableWebhookRequest rejects missing webhookId', () => {
  const result = disableWebhookRequest({
    webhookId: '',
    projectId: 'project-456',
    reason: 'reason',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
});

test('disableWebhookRequest rejects missing projectId', () => {
  const result = disableWebhookRequest({
    webhookId: 'webhook-123',
    projectId: '',
    reason: 'reason',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('disableWebhookRequest rejects missing reason', () => {
  const result = disableWebhookRequest({
    webhookId: 'webhook-123',
    projectId: 'project-456',
    reason: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /reason is required/);
});

import { readWebhookSecurityAudit, readWebhookStatus } from '../adapters/vo-studio-orchestration.js';

test('readWebhookSecurityAudit accepts valid input', () => {
  const result = readWebhookSecurityAudit('webhook-123', 'project-456');

  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, []);
  assert.equal(result.count, 0);
  assert.equal(result.webhookId, 'webhook-123');
  assert.equal(result.projectId, 'project-456');
});

test('readWebhookSecurityAudit rejects missing webhookId', () => {
  const result = readWebhookSecurityAudit('', 'project-456');

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
  assert.deepEqual(result.entries, []);
});

test('readWebhookSecurityAudit rejects missing projectId', () => {
  const result = readWebhookSecurityAudit('webhook-123', '');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readWebhookSecurityAudit rejects limit below 1', () => {
  const result = readWebhookSecurityAudit('webhook-123', 'project-456', 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readWebhookSecurityAudit rejects limit above 500', () => {
  const result = readWebhookSecurityAudit('webhook-123', 'project-456', 501);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readWebhookStatus accepts valid webhookId', () => {
  const result = readWebhookStatus('webhook-123');

  assert.equal(result.ok, true);
  assert.ok(result.status);
  assert.equal(result.status.webhookId, 'webhook-123');
  assert.equal(result.status.status, 'active');
  assert.equal(result.status.deliveryCount, 0);
  assert.equal(result.status.failureCount, 0);
  assert.equal(result.webhookId, 'webhook-123');
});

test('readWebhookStatus rejects missing webhookId', () => {
  const result = readWebhookStatus('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /webhookId is required/);
});

test('readWebhookStatus status is valid literal', () => {
  const result = readWebhookStatus('webhook-123');

  assert.equal(result.ok, true);
  const validStatuses = ['active', 'disabled', 'rate-limited'];
  assert.ok(validStatuses.includes(result.status!.status));
});

test('readWebhookStatus echoes webhookId at top level', () => {
  const result = readWebhookStatus('webhook-abc-123');

  assert.equal(result.ok, true);
  assert.equal(result.webhookId, 'webhook-abc-123');
  assert.equal(result.status!.webhookId, 'webhook-abc-123');
});
