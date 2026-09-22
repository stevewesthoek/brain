import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createJevBridge } from './brain-jev.mjs';
import { sanitizeProviderResult, toSystemOneRequest, validateJevRequest } from './jev-contract.mjs';
import { correctHistoricalCost, readBudget, reconcileBudget, reserveBudget } from './jev-ledger.mjs';

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-jev-ledger-'));
process.env.BRAIN_JEV_STATE_DIR = stateDir;

const request = {
  state: { task: 'classify this bounded fixture', value: 'small' },
  question: { type: 'choice', instructions: 'Choose the fixture label.', options: ['safe', 'review'] },
};

test.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));

test('bounded request validation rejects untrusted or oversized shapes', () => {
  assert.equal(validateJevRequest(request, { callingSurface: 'codex-cli' }).ok, true);
  assert.equal(validateJevRequest({ ...request, question: { ...request.question, options: ['same', 'same'] } }).reasonCode, 'INVALID_REQUEST');
  assert.equal(validateJevRequest({ ...request, state: 'x'.repeat(5000) }).reasonCode, 'INVALID_REQUEST');
  assert.equal(validateJevRequest(request, { callingSurface: 'unknown' }).reasonCode, 'INVALID_SURFACE');
});

test('bounded requests map to the official System One request shape', () => {
  assert.deepEqual(toSystemOneRequest(validateJevRequest(request).request), {
    state: request.state,
    questions: { decision: { type: 'choice', instructions: request.question.instructions, criteria: { safe: null, review: null } } },
  });
});

test('one bounded request can carry multiple independent System One questions', () => {
  const multi = {
    state: { task: 'rank this bounded fixture' },
    questions: {
      intent: { type: 'choice', instructions: 'Choose intent.', options: ['answer', 'task'] },
      complexity: { type: 'choice', instructions: 'Choose complexity.', options: ['simple', 'complex'] },
      verification: { type: 'score', instructions: 'Score verification need.', criteria: ['low', 'high'] },
    },
  };
  const validated = validateJevRequest(multi);
  assert.equal(validated.ok, true, JSON.stringify(validated));
  if (!validated.ok) return;
  assert.deepEqual(Object.keys(toSystemOneRequest(validated.request).questions), ['intent', 'complexity', 'verification']);
  const sanitized = sanitizeProviderResult({
    transportCheck: 'stdin_only',
    model: 'jev-1.13.0',
    answers: {
      intent: { type: 'choice', choice: 'answer', confidence: 0.9, probabilities: { answer: 0.9, task: 0.1 } },
      complexity: { type: 'choice', choice: 'simple', confidence: 0.8, probabilities: { simple: 0.8, complex: 0.2 } },
      verification: { type: 'score', score: 0.2, confidence: 0.7 },
    },
    usage: { input_tokens: 10, output_tokens: 6 },
  }, { expectedQuestions: validated.request.questions });
  assert.equal(sanitized?.answers.verification.score, 0.2);
});

test('multi-question reflex requests remain hard-bounded', () => {
  const questions = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [
    `question-${index}`,
    { type: 'choice', instructions: `Choose bounded answer ${index}.`, options: ['yes', 'no'] },
  ]));
  assert.equal(validateJevRequest({ state: { task: 'bounded' }, questions }).reasonCode, 'INVALID_REQUEST');
});

test('provider result sanitizer drops raw or malformed output', () => {
  assert.equal(sanitizeProviderResult({ transportCheck: 'stdin_only', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'safe', confidence: 0.9, probabilities: { safe: 0.9, review: 0.1 } } }, usage: { input_tokens: 3, output_tokens: 2 } }, { expectedQuestion: request.question }).ok, true);
  assert.equal(sanitizeProviderResult({ transportCheck: 'stdin_only', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'other', confidence: 0.9, probabilities: { other: 1 } } } }, { expectedQuestion: request.question }), null);
  assert.equal(sanitizeProviderResult({ transportCheck: 'stdin_only', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'safe', confidence: 1.2, probabilities: { safe: 2 } } } }, { expectedQuestion: request.question }), null);
  const sanitized = sanitizeProviderResult({ transportCheck: 'stdin_only', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'safe' } }, raw: 'unbounded' });
  assert.equal(JSON.stringify(sanitized).includes('unbounded'), false);
  assert.equal(sanitizeProviderResult({ transportCheck: 'wrong', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'safe' } } }), null);
});

test('bridge shares a bounded budget and does not repeat a settled call', async () => {
  let calls = 0;
  const bridge = createJevBridge({
    inspectReference: async () => ({ storageState: 'present', diagnosticCode: 'keychain_item_present' }),
    invokeBoundedRequest: async () => {
      calls += 1;
      return { transportCheck: 'stdin_only', model: 'jev-latest', answers: { decision: { type: 'choice', choice: 'safe', confidence: 0.9, probabilities: { safe: 0.9, review: 0.1 } } }, usage: { input_tokens: 3, output_tokens: 2 } };
    },
    now: () => new Date('2098-02-03T00:00:00Z'),
  });
  const first = await bridge.decide(request, { callingSurface: 'test' });
  const second = await bridge.decide(request, { callingSurface: 'test' });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.cost.basis, 'token_calculated');
  assert.equal(first.cost.pricing.modelRef, 'jev-1.13.0');
  assert.equal(second.reasonCode, 'JEV_CALL_ALREADY_SETTLED');
  assert.equal(calls, 1);
  const budget = await readBudget(new Date('2098-02-03T00:00:00Z'));
  assert.equal(budget.calls, 1);
  assert.equal(budget.reserved_spend_usd, 0);
  assert.equal(budget.reconciled_spend_usd, 0);
});

test('missing credential fails closed before reservation or provider invocation', async () => {
  let calls = 0;
  const now = new Date('2099-04-03T00:00:00Z');
  const bridge = createJevBridge({
    inspectReference: async () => ({ storageState: 'missing', diagnosticCode: 'keychain_item_missing' }),
    invokeBoundedRequest: async () => {
      calls += 1;
      throw new Error('provider_secret_must_not_be_revealed');
    },
    now: () => now,
  });
  const result = await bridge.decide(request, { callingSurface: 'brain' });
  assert.deepEqual(result, { ok: false, reasonCode: 'CREDENTIAL_MISSING', credentialState: 'missing', containsSecrets: false });
  assert.equal(calls, 0);
  const budget = await readBudget(now);
  assert.equal(budget.calls, 0);
  assert.equal(budget.reserved_spend_usd, 0);
  assert.equal(budget.reconciled_spend_usd, 0);
});

test('provider exceptions are sanitized and the reservation is settled', async () => {
  const now = new Date('2099-05-03T00:00:00Z');
  const bridge = createJevBridge({
    inspectReference: async () => ({ storageState: 'present', diagnosticCode: 'keychain_item_present' }),
    invokeBoundedRequest: async () => {
      throw new Error('provider_secret_must_not_be_revealed');
    },
    now: () => now,
  });
  const result = await bridge.decide(request, { callingSurface: 'brain' });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, 'provider_request_failed');
  assert.equal(result.containsSecrets, false);
  assert.equal(JSON.stringify(result).includes('provider_secret_must_not_be_revealed'), false);
  const budget = await readBudget(now);
  assert.equal(budget.calls, 0);
  assert.equal(budget.reserved_spend_usd, 0);
  assert.equal(budget.reconciled_spend_usd, 0);
});

test('historical conservative settlements have an explicit idempotent correction record', async () => {
  const now = new Date('2098-04-03T00:00:00Z');
  const reserved = await reserveBudget({ callId: 'historical-correction-call', projectedSpendUsd: 0.1, callingSurface: 'test', now });
  assert.equal(reserved.ok, true);
  await reconcileBudget({ callId: 'historical-correction-call', settledSpendUsd: 0.1, inputTokens: 314, outputTokens: 31, now });
  const corrected = await correctHistoricalCost({ utcMonth: '2098-04', modelRef: 'jev-1.13.0', reason: 'test historical correction', now });
  assert.equal(corrected.outcome, 'corrected');
  if (corrected.outcome === 'corrected') {
    assert.equal(corrected.oldSettledSpendUsd, 0.1);
    assert.equal(corrected.newSettledSpendUsd, 0.000013);
    assert.equal(corrected.differenceUsd, -0.099987);
  }
  const repeated = await correctHistoricalCost({ utcMonth: '2098-04', modelRef: 'jev-1.13.0', reason: 'test historical correction', now });
  assert.equal(repeated.outcome, 'already_corrected');
});

test('brain reflex calls respect a separate pilot allowance inside the global ceiling', async () => {
  const now = new Date('2100-01-03T00:00:00Z');
  const first = await reserveBudget({ callId: 'pilot-one', projectedSpendUsd: 0.2, callingSurface: 'brain', now });
  const second = await reserveBudget({ callId: 'pilot-two', projectedSpendUsd: 0.1, callingSurface: 'brain', now });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.outcome, 'exhausted');
  const budget = await readBudget(now);
  assert.equal(budget.pilot_limit_usd, 0.25);
  assert.equal(budget.pilot_reserved_spend_usd, 0.2);
  assert.equal(budget.reconciled_spend_usd, 0);
});

test('concurrent reservations admit exactly the bounded monthly ceiling', async () => {
  const now = new Date('2097-03-03T00:00:00Z');
  const results = await Promise.all(Array.from({ length: 101 }, (_, index) => reserveBudget({ callId: `concurrent-${index}`, projectedSpendUsd: 0.1, callingSurface: 'test', now })));
  assert.equal(results.filter((result) => result.ok).length, 100);
  assert.equal(results.filter((result) => result.outcome === 'exhausted').length, 1);
  const budget = await readBudget(now);
  assert.equal(Number(budget.reserved_spend_usd.toFixed(6)), 10);
  assert.equal(budget.reconciled_spend_usd, 0);
});
