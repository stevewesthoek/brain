import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { burnInCases, cohortCases } from './phase6b-canary-cases.mjs';
import {
  acceptCodexCanary,
  createCodexCanaryController,
  runCodexBoundedCanaryInvocation,
  transitionCodexCanary
} from './codex-canary-contract.mjs';

const repoRoot = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const catalog = createCapabilityCatalog({ repoRoot });
const source = { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: 0 };
const session = { session_id: 'phase6b-test-session', repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true };

function activeController() {
  let controller = createCodexCanaryController({ sourceRevision });
  controller = transitionCodexCanary(controller, 'READY');
  return transitionCodexCanary(controller, 'CANARY_ACTIVE');
}

function invoke(controller, item, overrides = {}) {
  return runCodexBoundedCanaryInvocation({
    repoRoot,
    controller,
    catalog,
    prompt: item.prompt,
    fixtureId: item.id ?? 'phase6b-test',
    routeClass: item.routeClass ?? 'read-only-analysis',
    source,
    session,
    currentState: item.currentState ?? {},
    failureMode: item.failureMode ?? null,
    ...overrides
  });
}

test('Phase 6B controller is explicit, bounded, and cannot become production default', () => {
  let controller = createCodexCanaryController({ sourceRevision });
  assert.equal(controller.state, 'DISABLED');
  assert.equal(controller.productionActive, false);
  controller = transitionCodexCanary(controller, 'READY');
  controller = transitionCodexCanary(controller, 'CANARY_ACTIVE');
  assert.equal(controller.mode, 'CANARY');
  assert.equal(controller.domain, 'code');
  assert.deepEqual(controller.allowedRouteClasses, ['read-only-analysis', 'read-only-plan']);
  assert.throws(() => transitionCodexCanary(controller, 'PRODUCTION_DEFAULT'), /production_default_forbidden/);
  assert.equal(controller.productionActive, false);
});

test('authorized Code invocation consumes the real Codex path and emits atomic bounded evidence', () => {
  const prompt = 'Analyze the repository architecture.';
  const result = invoke(activeController(), { id: 'real-code-path', prompt, routeClass: 'read-only-analysis' });
  assert.equal(result.selectedPath, 'v2');
  assert.equal(result.livePath.live_consumed, true);
  assert.equal(result.livePath.activation_state, 'LIVE_BOUNDED_READ_ONLY');
  assert.equal(result.v2.mode, 'CODEX_READ_ONLY_PILOT_MODE');
  assert.equal(result.v2.activationState, 'PILOT-ACTIVE');
  assert.equal(result.v2.universalEntry.conformance, true);
  assert.equal(result.v2.taskPacket.sourceRevision, sourceRevision);
  assert.equal(result.v2.graph.sourceRevision, sourceRevision);
  assert.ok(result.v2.taskPacket.selectedCapabilityRefs.length >= 1);
  assert.ok(result.v2.evidencePackets.length >= 1);
  assert.equal(result.v2.safety.providerCalls, 0);
  assert.equal(result.v2.safety.writes, 0);
  assert.equal(result.v2.safety.executionAttempts, 0);
  assert.equal(result.v2.metrics.fullRepositoryLoaded, false);
  assert.equal(result.v2.metrics.fullConversationLoaded, false);
  assert.equal(result.v2.metrics.secretsLoaded, false);
  assert.ok(result.v2.metrics.maxSimultaneousActiveContext <= result.v2.metrics.totalReferencedContext);
  assert.equal(JSON.stringify(result.receipt).includes(prompt), false);
  assert.equal(result.receipt.writesAttempted, 0);
  assert.equal(result.receipt.providerCalls, 0);
});

test('other domains and high-risk requests remain outside the bounded selector', () => {
  const controller = activeController();
  const research = invoke(controller, { id: 'outside-research', prompt: 'Research this company', routeClass: 'read-only-analysis' });
  assert.equal(research.v2.route.primaryRouteFamily, 'research');
  assert.equal(research.selectedPath, 'legacy');
  assert.equal(research.state, 'OFF');
  assert.equal(research.scope.matched, false);
  const risky = invoke(controller, { id: 'high-risk-deploy', prompt: 'Deploy this.', routeClass: 'high-risk' });
  assert.equal(risky.selectedPath, 'legacy');
  assert.equal(risky.scope.matched, false);
  assert.equal(risky.v2.graph.execution.executionReady, false);
  assert.ok(risky.v2.graph.safetyGateNodes.length >= 2);
  assert.equal(risky.v2.safety.providerCalls, 0);
  assert.equal(risky.v2.safety.writes, 0);
});

test('stale, conflict, and injected failures fail closed to the prior path', () => {
  const controller = activeController();
  for (const item of cohortCases.filter((candidate) => candidate.category === 'stale-conflict-continuation')) {
    const result = invoke(controller, item);
    assert.equal(result.selectedPath, 'legacy', item.id);
    assert.equal(result.v2.fallback.active, true, item.id);
    if (item.currentState?.descriptorFresh === false) {
      assert.equal(result.v2.fallback.reason, 'context_or_conformance_blocked', item.id);
    } else {
      assert.equal(result.v2.continuity.resumeDecision, 'BLOCKED', item.id);
    }
    assert.equal(result.v2.safety.writes, 0, item.id);
    assert.equal(result.v2.safety.providerCalls, 0, item.id);
  }
  for (const item of cohortCases.filter((candidate) => candidate.category === 'controlled-fallback')) {
    const result = invoke(controller, item);
    assert.equal(result.selectedPath, 'legacy', item.id);
    assert.equal(result.v2.fallback.active, true, item.id);
    assert.equal(result.v2.safety.writes, 0, item.id);
    assert.equal(result.v2.safety.providerCalls, 0, item.id);
  }
});

test('burn-in fixture and cohort boundaries are explicit and serializable', () => {
  assert.equal(burnInCases.length, 5);
  assert.ok(cohortCases.length >= 40);
  assert.equal(cohortCases.filter((item) => item.category === 'normal').length, 20);
  assert.equal(cohortCases.filter((item) => item.category === 'vague-edge').length, 10);
  assert.equal(cohortCases.filter((item) => item.category === 'stale-conflict-continuation').length, 5);
  assert.equal(cohortCases.filter((item) => item.category === 'high-risk').length, 5);
  assert.equal(cohortCases.filter((item) => item.category === 'controlled-fallback').length, 5);
  assert.equal(Object.isFrozen(burnInCases), true);
  assert.equal(Object.isFrozen(cohortCases), true);
});

test('rollback disables v2 selection and re-enable does not replay inert packets', () => {
  let controller = activeController();
  const active = invoke(controller, burnInCases[0]);
  assert.equal(active.selectedPath, 'v2');
  controller = transitionCodexCanary(controller, 'ROLLED_BACK');
  const rolledBack = invoke(controller, { ...burnInCases[0], id: 'rollback-test' });
  assert.equal(rolledBack.selectedPath, 'legacy');
  assert.equal(rolledBack.v2, null);
  assert.equal(rolledBack.livePath.live_consumed, false);
  controller = transitionCodexCanary(controller, 'READY');
  controller = transitionCodexCanary(controller, 'CANARY_ACTIVE');
  const reenabled = invoke(controller, { ...burnInCases[0], id: 'reenabled-test' });
  assert.equal(reenabled.selectedPath, 'v2');
  assert.equal(reenabled.v2.taskPacket.status, 'PLANNED');
  assert.equal(reenabled.v2.safety.executionAttempts, 0);
  controller = acceptCodexCanary(controller);
  assert.equal(controller.state, 'CANARY_ACCEPTED');
  assert.equal(controller.productionActive, false);
});
