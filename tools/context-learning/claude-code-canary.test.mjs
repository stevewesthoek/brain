import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';
import { createClaudeCodeAdapter, CLAUDE_CODE_ADAPTER_ID } from './claude-code-consumer-adapter.mjs';
import {
  activateUniversalConsumerCanary,
  createUniversalConsumerCanaryController,
  rollbackUniversalConsumerCanary,
  runUniversalConsumerCanaryInvocation
} from './universal-consumer-canary.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;

function setup() {
  const adapter = createClaudeCodeAdapter();
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
  const controller = activateUniversalConsumerCanary(
    createUniversalConsumerCanaryController({
      consumer: 'claude-code',
      domain: 'code',
      adapterId: CLAUDE_CODE_ADAPTER_ID,
      sourceRevision,
      priorPath: 'claude-code-current-entry'
    }),
    { preflight: { passed: true }, timestamp: '2026-09-02T00:00:00.000Z' }
  );
  return { adapter, catalog, controller };
}

function input(message) {
  return { message, workspace: { boundary: repoRoot, resolved: true }, session: { id: 'test-session', resumable: true } };
}

test('Claude Code adapter is a thin native boundary over the universal contract', () => {
  const adapter = createClaudeCodeAdapter();
  const request = adapter.translate(input('Fix the parser bug in the code.'));
  assert.equal(adapter.adapterId, CLAUDE_CODE_ADAPTER_ID);
  assert.equal(request.environment.environmentId, 'claude-code');
  assert.equal(request.schemaVersion, '1.0.0');
  assert.equal(request.intent, 'Fix the parser bug in the code.');
  assert(adapter.capabilities().some((item) => item.capabilityId === 'brain.route'));
});

test('canary activation requires preflight and selects Brain-owned Code', () => {
  const { adapter, catalog, controller } = setup();
  const result = runUniversalConsumerCanaryInvocation({ controller, adapter, catalog, repoRoot, nativeInput: input('Fix the null handling bug in the code.'), fixtureId: 'activation' });
  assert.equal(controller.state, 'CANARY_ACTIVE');
  assert.equal(result.selectedPath, 'v2');
  assert.equal(result.v2.route.primaryRouteFamily, 'code');
  assert.equal(result.v2.route.primaryDescriptorId, 'skill.code');
  assert.equal(result.receipt.rawPromptStored, false);
  assert.equal(result.receipt.transcriptCanonical, false);
  assert.equal(result.v2.safety.writesPerformed, 0);
  assert.throws(() => activateUniversalConsumerCanary({ state: 'CONFORMANT' }, { preflight: { passed: false } }), /preflight_required/);
});

test('out-of-scope, high-risk, stale, and injected failures fall back explicitly', () => {
  const { adapter, catalog, controller } = setup();
  const cases = [
    ['out-of-scope', input('Research the latest market options with citations.'), null, 'outside_bounded_code_canary_scope'],
    ['high-risk', input('Deploy this to production.'), null, 'high_risk_legacy_boundary'],
    ['stale', input('Continue this task from the previous session.'), { contextFresh: false }, 'continuity_stale'],
    ['broker-failure', input('Fix the parser bug in the code.'), {}, 'universal_result_blocked']
  ];
  for (const [fixtureId, nativeInput, currentState, reason] of cases) {
    const result = runUniversalConsumerCanaryInvocation({ controller, adapter, catalog, repoRoot, nativeInput, currentState, fixtureId, failureMode: fixtureId === 'broker-failure' ? 'context_broker_unavailable' : null });
    assert.equal(result.selectedPath, 'legacy', fixtureId);
    assert.equal(result.receipt.fallback.active, true, fixtureId);
    assert.equal(result.reason, reason, fixtureId);
    assert.equal(result.receipt.rawPromptStored, false, fixtureId);
    assert.equal(result.receipt.sideEffects.writesPerformed, 0, fixtureId);
  }
});

test('rollback disables v2 and leaves the prior path explicit', () => {
  const { adapter, catalog, controller } = setup();
  const rolledBack = rollbackUniversalConsumerCanary(controller, { timestamp: '2026-09-02T00:01:00.000Z' });
  const result = runUniversalConsumerCanaryInvocation({ controller: rolledBack, adapter, catalog, repoRoot, nativeInput: input('Fix the parser bug in the code.'), fixtureId: 'rollback' });
  assert.equal(rolledBack.state, 'ROLLED_BACK');
  assert.equal(result.selectedPath, 'legacy');
  assert.equal(result.v2, null);
  assert.equal(result.priorPath, 'claude-code-current-entry');
  assert.equal(result.receipt.executionPerformed, false);
});

test('activation specification is schema-valid and does not make Claude Code default', () => {
  const spec = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-claude-code-canary.v1.json'));
  const schema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-claude-code-canary.v1.schema.json'));
  assert.deepEqual(validateJsonSchema(schema, spec, schema), []);
  assert.equal(spec.defaultActive, false);
  assert.equal(spec.productionActive, false);
  assert.equal(spec.scope.otherConsumersActivated, 0);
  assert.equal(spec.scope.otherDomainsActivated, 0);
});
