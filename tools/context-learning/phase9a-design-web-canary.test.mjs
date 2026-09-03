import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { semanticProjection, validateUniversalConsumerContract } from './universal-consumer-contract.mjs';
import { createCodexDesignWebAdapter } from './codex-design-web-consumer-adapter.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, runUniversalConsumerCanaryInvocation, rollbackUniversalConsumerCanary, transitionUniversalConsumerCanary } from './universal-consumer-canary.mjs';
import { makePhase9aCohort } from './run-phase9a-design-web-canary.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: 'phase9a-test' });
const adapter = createCodexDesignWebAdapter();
const required = ['workspace.read', 'workspace.write', 'frontend.implementation', 'browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction', 'image.reference.external', 'tests.run'];
const input = (message, id) => ({ id, message, requiredCapabilities: required, workspace: { boundary: repoRoot, resolved: true }, session: { id: `phase9a-test-${id}`, resumable: true } });

test('design/web adapter keeps Brain route and capability ownership universal', () => {
  assert.equal(validateUniversalConsumerContract().length, 0);
  const result = adapter.consume(input('Redesign this dashboard and implement the responsive frontend, then test and verify it.', 'route'));
  assert.equal(result.route.primaryRouteFamily, 'mixed');
  assert.equal(result.route.primaryDescriptorId, 'skill.design');
  assert.equal(result.compositionGraph.primaryOwner.capabilityId, 'skill.design');
  assert(result.taskPacket.selectedCapabilityRefs.some((item) => item.capabilityId === 'skill.web-design'));
  assert(result.compositionGraph.qualityGateNodes.includes('gate-gate.visual-qa'));
  assert.equal(result.safety.writesPerformed, 0);
  assert.equal(result.receipt.rawPromptStored, false);
  assert.equal(semanticProjection(result).route.owner, 'skill.design');
});

test('combined canary accepts design and mixed families but rejects research', () => {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  let controller = createUniversalConsumerCanaryController({ consumer: 'codex', domain: 'design-web', allowedRouteFamilies: ['design', 'mixed'], adapterId: adapter.adapterId, sourceRevision, priorPath: 'codex-current-design-web-entry' });
  controller = activateUniversalConsumerCanary(controller, { preflight: { passed: true } });
  const design = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: input('Make this page look amazing.', 'design'), fixtureId: 'design', catalog, repoRoot });
  const mixed = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: input('Design and implement this responsive web experience, then test and verify it.', 'mixed'), fixtureId: 'mixed', catalog, repoRoot });
  const research = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: input('Research current public evidence with sources.', 'research'), fixtureId: 'research', catalog, repoRoot });
  assert.equal(design.selectedPath, 'v2');
  assert.equal(mixed.selectedPath, 'v2');
  assert.equal(research.selectedPath, 'legacy');
  assert.equal(research.reason, 'outside_bounded_design-web_canary_scope');
  controller = rollbackUniversalConsumerCanary(controller);
  assert.equal(runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: input('Make this page look amazing.', 'rollback'), fixtureId: 'rollback', catalog, repoRoot }).v2, null);
  controller = transitionUniversalConsumerCanary(controller, 'CONFORMANT');
  controller = activateUniversalConsumerCanary(controller, { preflight: { passed: true } });
  assert.equal(runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: input('Make this page look amazing.', 'reenabled'), fixtureId: 'reenabled', catalog, repoRoot }).selectedPath, 'v2');
});

test('cohort shape covers the required Design/Web categories', () => {
  const cohort = makePhase9aCohort();
  assert.equal(cohort.length, 120);
  for (const category of ['LANDING', 'DASHBOARD', 'MOBILE', 'A11Y', 'DESIGN_ONLY', 'IMPLEMENTATION', 'MIXED', 'VAGUE', 'RESEARCH_DESIGN', 'PREMIUM_BRAND']) assert(cohort.some((item) => item.category === category));
});

test('isolated fixture is complete and contains no external asset dependency', () => {
  const fixture = path.join(repoRoot, 'tools/context-learning/fixtures/phase9a');
  for (const file of ['index.html', 'styles.css', 'app.js']) assert(fs.existsSync(path.join(fixture, file)), file);
  assert(!fs.readFileSync(path.join(fixture, 'index.html'), 'utf8').match(/https?:\/\//));
});
