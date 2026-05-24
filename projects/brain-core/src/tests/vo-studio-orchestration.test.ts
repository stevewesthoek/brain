import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationRuleRequest, bulkApproveRequest, scheduleWorkflowRequest, registerWebhookRequest } from '../adapters/vo-studio-orchestration.js';

test('createAutomationRuleRequest accepts valid rule', () => {
  const result = createAutomationRuleRequest({
    projectId: 'project-123',
    name: 'Auto-publish on final approval',
    condition: 'status == approved && stage == final_review',
    action: 'publish_package',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.rule!.name, 'Auto-publish on final approval');
  assert.equal(result.preview!.rule!.enabled, true);
});

test('createAutomationRuleRequest rejects missing projectId', () => {
  const result = createAutomationRuleRequest({
    projectId: '',
    name: 'Rule',
    condition: 'x==y',
    action: 'action',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('createAutomationRuleRequest rejects missing name', () => {
  const result = createAutomationRuleRequest({
    projectId: 'project-123',
    name: '',
    condition: 'x==y',
    action: 'action',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /name is required/);
});

test('createAutomationRuleRequest rejects missing condition', () => {
  const result = createAutomationRuleRequest({
    projectId: 'project-123',
    name: 'Rule',
    condition: '',
    action: 'action',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /condition is required/);
});

test('createAutomationRuleRequest rejects missing action', () => {
  const result = createAutomationRuleRequest({
    projectId: 'project-123',
    name: 'Rule',
    condition: 'x==y',
    action: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /action is required/);
});

test('bulkApproveRequest accepts multiple packages', () => {
  const result = bulkApproveRequest({
    packageIds: ['pkg-1', 'pkg-2', 'pkg-3'],
    approvalType: 'metadata',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.batch!.packageCount, 3);
  assert.equal(result.preview!.batch!.approvalType, 'metadata');
  assert.equal(result.preview!.batch!.status, 'approving');
});

test('bulkApproveRequest rejects empty packageIds', () => {
  const result = bulkApproveRequest({
    packageIds: [],
    approvalType: 'thumbnail',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageIds must be a non-empty array/);
});

test('bulkApproveRequest accepts final_review approval type', () => {
  const result = bulkApproveRequest({
    packageIds: ['pkg-1'],
    approvalType: 'final_review',
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.batch!.approvalType, 'final_review');
});

test('scheduleWorkflowRequest accepts valid schedule', () => {
  const result = scheduleWorkflowRequest({
    packageIds: ['pkg-1', 'pkg-2'],
    cronExpression: '0 9 * * *',
    action: 'publish',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.schedule!.packageCount, 2);
  assert.equal(result.preview!.schedule!.cronExpression, '0 9 * * *');
  assert.equal(result.preview!.schedule!.status, 'scheduled');
});

test('scheduleWorkflowRequest rejects empty packageIds', () => {
  const result = scheduleWorkflowRequest({
    packageIds: [],
    cronExpression: '0 9 * * *',
    action: 'publish',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageIds must be a non-empty array/);
});

test('scheduleWorkflowRequest rejects missing cronExpression', () => {
  const result = scheduleWorkflowRequest({
    packageIds: ['pkg-1'],
    cronExpression: '',
    action: 'publish',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /cronExpression is required/);
});

test('scheduleWorkflowRequest rejects missing action', () => {
  const result = scheduleWorkflowRequest({
    packageIds: ['pkg-1'],
    cronExpression: '0 9 * * *',
    action: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /action is required/);
});

test('registerWebhookRequest accepts valid webhook', () => {
  const result = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook',
    events: ['package.published', 'approval.completed'],
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.webhook!.url, 'https://example.com/webhook');
  assert.equal(result.preview!.webhook!.events.length, 2);
  assert.ok(result.preview!.webhook!.secret);
  assert.equal(result.preview!.webhook!.status, 'active');
});

test('registerWebhookRequest rejects missing projectId', () => {
  const result = registerWebhookRequest({
    projectId: '',
    url: 'https://example.com/webhook',
    events: ['package.published'],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('registerWebhookRequest rejects missing url', () => {
  const result = registerWebhookRequest({
    projectId: 'project-123',
    url: '',
    events: ['package.published'],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /url is required/);
});

test('registerWebhookRequest rejects empty events', () => {
  const result = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook',
    events: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /events must be a non-empty array/);
});

test('registerWebhookRequest generates unique webhook IDs', () => {
  const result1 = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook1',
    events: ['package.published'],
  });

  const result2 = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook2',
    events: ['package.published'],
  });

  assert.notEqual(
    result1.preview!.webhook!.id,
    result2.preview!.webhook!.id,
  );
});

test('registerWebhookRequest generates unique secrets', () => {
  const result1 = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook1',
    events: ['package.published'],
  });

  const result2 = registerWebhookRequest({
    projectId: 'project-123',
    url: 'https://example.com/webhook2',
    events: ['package.published'],
  });

  assert.notEqual(
    result1.preview!.webhook!.secret,
    result2.preview!.webhook!.secret,
  );
});

import { readAutomationRules, readSchedules, readWebhooks, readExecutionAudit } from '../adapters/vo-studio-orchestration.js';

test('readAutomationRules accepts valid projectId', () => {
  const result = readAutomationRules('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.rules, []);
  assert.equal(result.projectId, 'project-123');
});

test('readAutomationRules rejects missing projectId', () => {
  const result = readAutomationRules('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.equal(result.count, 0);
});

test('readSchedules accepts valid projectId', () => {
  const result = readSchedules('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.schedules, []);
  assert.equal(result.projectId, 'project-123');
});

test('readSchedules rejects missing projectId', () => {
  const result = readSchedules('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readWebhooks accepts valid projectId', () => {
  const result = readWebhooks('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.webhooks, []);
  assert.equal(result.projectId, 'project-123');
});

test('readWebhooks rejects missing projectId', () => {
  const result = readWebhooks('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readExecutionAudit accepts valid projectId with default limit', () => {
  const result = readExecutionAudit('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.entries, []);
  assert.equal(result.projectId, 'project-123');
});

test('readExecutionAudit accepts custom limit within range', () => {
  const result = readExecutionAudit('project-123', 100);

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});

test('readExecutionAudit rejects missing projectId', () => {
  const result = readExecutionAudit('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readExecutionAudit rejects limit below 1', () => {
  const result = readExecutionAudit('project-123', 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readExecutionAudit rejects limit above 500', () => {
  const result = readExecutionAudit('project-123', 501);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});
