import test from 'node:test';
import assert from 'node:assert/strict';
import { emitEventRequest, acknowledgeEventRequest, subscribeToEventsRequest } from '../adapters/vo-studio-events.js';

test('emitEventRequest accepts valid event', () => {
  const result = emitEventRequest({
    projectId: 'project-123',
    type: 'package.published',
    payload: { packageId: 'pkg-1', platform: 'youtube' },
    actor: 'automation-rule-42',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.event!.type, 'package.published');
  assert.equal(result.preview.event!.status, 'queued');
  assert.equal(result.preview.event!.projectId, 'project-123');
  assert.deepEqual(result.preview.event!.payload, { packageId: 'pkg-1', platform: 'youtube' });
});

test('emitEventRequest rejects missing projectId', () => {
  const result = emitEventRequest({
    projectId: '',
    type: 'package.published',
    payload: { x: 1 },
    actor: 'actor',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('emitEventRequest rejects missing type', () => {
  const result = emitEventRequest({
    projectId: 'project-123',
    type: '',
    payload: { x: 1 },
    actor: 'actor',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /type is required/);
});

test('emitEventRequest rejects missing payload', () => {
  const result = emitEventRequest({
    projectId: 'project-123',
    type: 'package.published',
    payload: null as unknown as Record<string, unknown>,
    actor: 'actor',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /payload is required/);
});

test('emitEventRequest rejects missing actor', () => {
  const result = emitEventRequest({
    projectId: 'project-123',
    type: 'package.published',
    payload: { x: 1 },
    actor: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /actor is required/);
});

test('emitEventRequest generates unique event IDs', () => {
  const result1 = emitEventRequest({
    projectId: 'project-123',
    type: 'approval.submitted',
    payload: {},
    actor: 'user-1',
  });

  const result2 = emitEventRequest({
    projectId: 'project-123',
    type: 'approval.submitted',
    payload: {},
    actor: 'user-2',
  });

  assert.notEqual(
    result1.preview!.event!.id,
    result2.preview!.event!.id,
  );
});

test('acknowledgeEventRequest accepts valid input', () => {
  const result = acknowledgeEventRequest({
    eventId: 'event-12345-abc',
    projectId: 'project-123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.event!.status, 'acknowledged');
  assert.equal(result.preview.event!.id, 'event-12345-abc');
});

test('acknowledgeEventRequest rejects missing eventId', () => {
  const result = acknowledgeEventRequest({
    eventId: '',
    projectId: 'project-123',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /eventId is required/);
});

test('acknowledgeEventRequest rejects missing projectId', () => {
  const result = acknowledgeEventRequest({
    eventId: 'event-123',
    projectId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('subscribeToEventsRequest accepts valid subscription', () => {
  const result = subscribeToEventsRequest({
    projectId: 'project-123',
    eventTypes: ['package.*', 'approval.*'],
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.subscription!.projectId, 'project-123');
  assert.deepEqual(result.preview.subscription!.eventTypes, ['package.*', 'approval.*']);
  assert.equal(result.preview.subscription!.status, 'active');
  assert.ok(result.preview.subscription!.createdAt);
});

test('subscribeToEventsRequest rejects missing projectId', () => {
  const result = subscribeToEventsRequest({
    projectId: '',
    eventTypes: ['package.*'],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('subscribeToEventsRequest rejects empty eventTypes', () => {
  const result = subscribeToEventsRequest({
    projectId: 'project-123',
    eventTypes: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /eventTypes must be a non-empty array/);
});

test('subscribeToEventsRequest includes webhookId when provided', () => {
  const result = subscribeToEventsRequest({
    projectId: 'project-123',
    eventTypes: ['package.*'],
    webhookId: 'webhook-xyz',
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.subscription!.webhookId, 'webhook-xyz');
});

test('subscribeToEventsRequest generates unique subscription IDs', () => {
  const result1 = subscribeToEventsRequest({
    projectId: 'project-123',
    eventTypes: ['package.*'],
  });

  const result2 = subscribeToEventsRequest({
    projectId: 'project-123',
    eventTypes: ['approval.*'],
  });

  assert.notEqual(
    result1.preview!.subscription!.id,
    result2.preview!.subscription!.id,
  );
});

import { readEventStream, readEventHistory, readActiveSubscriptions } from '../adapters/vo-studio-events.js';

test('readEventStream accepts valid projectId', () => {
  const result = readEventStream('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.events, []);
  assert.equal(result.projectId, 'project-123');
});

test('readEventStream rejects missing projectId', () => {
  const result = readEventStream('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.equal(result.count, 0);
});

test('readEventStream accepts valid limit', () => {
  const result = readEventStream('project-123', 100);

  assert.equal(result.ok, true);
});

test('readEventStream rejects limit below 1', () => {
  const result = readEventStream('project-123', 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readEventStream rejects limit above 500', () => {
  const result = readEventStream('project-123', 501);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readEventHistory accepts valid projectId', () => {
  const result = readEventHistory('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.events, []);
  assert.equal(result.projectId, 'project-123');
});

test('readEventHistory rejects missing projectId', () => {
  const result = readEventHistory('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readEventHistory accepts optional eventType filter', () => {
  const result = readEventHistory('project-123', 'package.*', 50);

  assert.equal(result.ok, true);
});

test('readEventHistory rejects limit below 1', () => {
  const result = readEventHistory('project-123', undefined, 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readEventHistory rejects limit above 500', () => {
  const result = readEventHistory('project-123', undefined, 501);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 500/);
});

test('readActiveSubscriptions accepts valid projectId', () => {
  const result = readActiveSubscriptions('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.subscriptions, []);
  assert.equal(result.projectId, 'project-123');
});

test('readActiveSubscriptions rejects missing projectId', () => {
  const result = readActiveSubscriptions('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});
