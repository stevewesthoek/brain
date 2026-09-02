import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { createCodexCodeDefaultController, promoteCodexCodeDefault, rollbackCodexCodeDefault, restoreCodexCodeDefault, runCodexCodeDefaultInvocation, validateCodexCodeDefaultSpec } from './codex-code-default.mjs';

const repoRoot = new URL('../../', import.meta.url).pathname;
const catalog = createCapabilityCatalog({ repoRoot });
const preflight = { passed: true };

function activeController() {
  return promoteCodexCodeDefault(createCodexCodeDefaultController({ sourceRevision: 'test-revision' }), { preflight, timestamp: '2026-09-02T00:00:00.000Z' });
}

test('Phase 7A contract is Codex Code DEFAULT and validates', () => {
  const spec = {
    schemaVersion: '1.0.0', activationId: 'test', consumer: 'codex', domain: 'code', mode: 'DEFAULT', status: 'CODE_V2_DEFAULT_FOR_CODEX', universalConsumerContractVersion: '1.0.0', priorPath: 'codex-current-entry', defaultActive: true, productionActive: false, activationPerformed: true, scope: {}, fallback: {}, rollback: {}, states: ['CANARY_ACCEPTED', 'CODE_V2_DEFAULT_FOR_CODEX', 'ROLLED_BACK']
  };
  assert.equal(validateCodexCodeDefaultSpec(spec).valid, true);
});

test('promotion requires preflight and is exactly scoped', () => {
  const controller = createCodexCodeDefaultController({ sourceRevision: 'test-revision' });
  assert.throws(() => promoteCodexCodeDefault(controller), /preflight_required/);
  const promoted = promoteCodexCodeDefault(controller, { preflight });
  assert.deepEqual({ consumer: promoted.consumer, domain: promoted.domain, mode: promoted.mode, state: promoted.state, defaultActive: promoted.defaultActive, productionActive: promoted.productionActive }, { consumer: 'codex', domain: 'code', mode: 'DEFAULT', state: 'CODE_V2_DEFAULT_FOR_CODEX', defaultActive: true, productionActive: false });
});

test('default entry selects v2 for Code and retains redacted receipts', () => {
  const result = runCodexCodeDefaultInvocation({ controller: activeController(), repoRoot, catalog, prompt: 'Fix the null handling bug in the code.', fixtureId: 'test-default' });
  assert.equal(result.selectedPath, 'v2');
  assert.equal(result.v2.route.primaryRouteFamily, 'code');
  assert.equal(result.receipt.privacy.rawPromptStored, false);
  assert.equal(result.receipt.executionPerformed, false);
});

test('default entry falls back for high-risk, other-domain, stale, and controlled failures', () => {
  const controller = activeController();
  for (const input of [
    { prompt: 'Deploy this code to production.', fixtureId: 'test-high-risk' },
    { prompt: 'Improve the browser visual design.', fixtureId: 'test-other-domain' },
    { prompt: 'Continue the code task after the branch advanced.', fixtureId: 'test-stale', currentState: { repositoryRevision: 'old-revision' } },
    { prompt: 'Fix the code while the Context Broker is unavailable.', fixtureId: 'test-failure', failureMode: 'broker_unavailable' }
  ]) {
    const result = runCodexCodeDefaultInvocation({ controller, repoRoot, catalog, ...input });
    assert.equal(result.selectedPath, 'legacy', input.fixtureId);
    assert.equal(result.receipt.fallback.active, true, input.fixtureId);
  }
});

test('rollback disables v2 without invoking it and restore requires preflight', () => {
  const rolledBack = rollbackCodexCodeDefault(activeController());
  assert.equal(rolledBack.state, 'ROLLED_BACK');
  const result = runCodexCodeDefaultInvocation({ controller: rolledBack, repoRoot, catalog, prompt: 'Fix the null handling bug in the code.' });
  assert.equal(result.selectedPath, 'legacy');
  assert.equal(result.v2, null);
  assert.throws(() => restoreCodexCodeDefault(rolledBack), /restore_preflight_required/);
  assert.equal(restoreCodexCodeDefault(rolledBack, { preflight }).state, 'CODE_V2_DEFAULT_FOR_CODEX');
});
