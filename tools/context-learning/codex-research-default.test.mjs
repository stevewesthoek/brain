import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { createCodexResearchDefaultController, promoteCodexResearchDefault, rollbackCodexResearchDefault, restoreCodexResearchDefault, runCodexResearchDefaultInvocation, validateCodexResearchDefaultSpec, CODEX_RESEARCH_DEFAULT_STATE } from './codex-research-default.mjs';

const repoRoot = new URL('../../', import.meta.url).pathname;
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
const preflight = { passed: true };

function activeController() { return promoteCodexResearchDefault(createCodexResearchDefaultController({ sourceRevision }), { preflight, timestamp: '2026-09-03T00:00:01.000Z' }); }

test('Phase 8D default contract is exact Codex Research scope', () => {
  const spec = { schemaVersion: '1.0.0', activationId: 'test', consumer: 'codex', domain: 'research', mode: 'DEFAULT', status: CODEX_RESEARCH_DEFAULT_STATE, universalConsumerContractVersion: '1.0.0', adapterRevision: 'codex-research-adapter@1.0.0', priorPath: 'codex-current-research-entry', defaultActive: true, productionActive: false, activationPerformed: true, scope: { consumerOnly: 'codex', domainOnly: 'research', otherConsumersActivated: 0, otherDomainsActivated: 0, codeDefaultChanged: false }, fallback: { path: 'codex-current-research-entry', trigger: 'test', manualConfigSurgeryRequired: false }, rollback: { mechanism: 'test', targetTimeSeconds: 60, validation: 'test' }, states: ['CANARY_ACCEPTED', CODEX_RESEARCH_DEFAULT_STATE, 'ROLLED_BACK'] };
  assert.equal(validateCodexResearchDefaultSpec(spec).valid, true);
});

test('promotion requires preflight and selects Brain Research by default', () => {
  const controller = createCodexResearchDefaultController({ sourceRevision: 'test-revision' });
  assert.throws(() => promoteCodexResearchDefault(controller), /preflight_required/);
  const promoted = promoteCodexResearchDefault(controller, { preflight, timestamp: '2026-09-03T00:00:01.000Z' });
  assert.deepEqual({ consumer: promoted.consumer, domain: promoted.domain, mode: promoted.mode, state: promoted.state, defaultActive: promoted.defaultActive, productionActive: promoted.productionActive }, { consumer: 'codex', domain: 'research', mode: 'DEFAULT', state: CODEX_RESEARCH_DEFAULT_STATE, defaultActive: true, productionActive: false });
});

test('default Research invocation uses universal route and preserves provenance', () => {
  const result = runCodexResearchDefaultInvocation({ controller: activeController(), repoRoot, catalog, prompt: 'Research current public evidence with citations.', fixtureId: 'phase8d-default' });
  assert.equal(result.selectedPath, 'v2');
  assert.equal(result.v2.route.primaryRouteFamily, 'research');
  assert.equal(result.receipt.privacy.rawPromptStored, false);
  assert.equal(result.receipt.executionPerformed, false);
  assert.equal(result.priorPath.name, 'codex-current-research-entry');
});

test('default Research falls back for out-of-domain, stale, and controlled failures', () => {
  const controller = activeController();
  for (const input of [
    { prompt: 'Fix the null handling bug in the code.', fixtureId: 'phase8d-other-domain' },
    { prompt: 'Research this after the branch advanced.', fixtureId: 'phase8d-stale', currentState: { repositoryRevision: 'old-revision' } },
    { prompt: 'Research this while the Context Broker is unavailable.', fixtureId: 'phase8d-failure', failureMode: 'broker_unavailable' }
  ]) {
    const result = runCodexResearchDefaultInvocation({ controller, repoRoot, catalog, ...input });
    assert.equal(result.selectedPath, 'legacy', input.fixtureId);
    assert.equal(result.receipt.fallback.active, true, input.fixtureId);
  }
});

test('rollback makes Research packets inert and restore requires preflight', () => {
  const rolledBack = rollbackCodexResearchDefault(activeController(), { timestamp: '2026-09-03T00:20:00.000Z' });
  assert.equal(rolledBack.state, 'ROLLED_BACK');
  const result = runCodexResearchDefaultInvocation({ controller: rolledBack, repoRoot, catalog, prompt: 'Research current public evidence.' });
  assert.equal(result.selectedPath, 'legacy');
  assert.equal(result.v2, null);
  assert.throws(() => restoreCodexResearchDefault(rolledBack), /restore_preflight_required/);
  assert.equal(restoreCodexResearchDefault(rolledBack, { preflight }).state, CODEX_RESEARCH_DEFAULT_STATE);
});
