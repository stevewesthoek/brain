import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  authorityRequirements,
  buildRetrievalPlan,
  evidenceCanAuthorize,
  loadRetrievalPolicy,
  validatePolicyInvariants,
} from './b8-4-retrieval-policy.mjs';

const ROOT = path.resolve('.');
const POLICY_PATH = path.join(ROOT, 'operations/specs/b8-4-agent-retrieval-policy.json');
const policy = loadRetrievalPolicy(POLICY_PATH);

test('policy invariants preserve navigation-only structural memory and exact-source authority', () => {
  assert.deepEqual(validatePolicyInvariants(policy), []);
  assert.equal(policy.principles.structuralMemoryRole, 'navigation-only');
  assert.equal(policy.principles.exactSourceRole, 'authority');
});

test('structural navigation is bounded to five file candidates and never full source', () => {
  assert.equal(policy.broadExploration.searchCodeInitialMode, 'files');
  assert.equal(policy.broadExploration.searchCodeInitialLimit, 5);
  assert.equal(policy.broadExploration.fullSourceFromStructuralMemory, false);
});

test('fresh architecture query uses CBM navigation then exact source', () => {
  assert.deepEqual(buildRetrievalPlan({ intent: 'architecture', freshness: 'fresh', policy }), {
    intentClass: 'structuralNavigation',
    steps: ['cbm-structural-memory', 'exact-source-read'],
    fallbackUsed: false,
    authority: 'exact-source',
  });
});

test('stale structural memory falls back to bounded exact-source search', () => {
  const plan = buildRetrievalPlan({ intent: 'caller-callee', freshness: 'stale', policy });
  assert.deepEqual(plan.steps, ['bounded-exact-source-search', 'exact-source-read']);
  assert.equal(plan.fallbackUsed, true);
  assert.equal(plan.fallbackReason, 'provider-stale');
});

test('unavailable and unknown structural memory fail safely to bounded exact source', () => {
  assert.equal(buildRetrievalPlan({ intent: 'blast-radius', freshness: 'unavailable', policy }).fallbackReason, 'provider-unavailable');
  assert.equal(buildRetrievalPlan({ intent: 'route', freshness: 'unknown', policy }).fallbackReason, 'freshness-unknown');
});

test('known source and canonical authority go directly to exact source', () => {
  assert.deepEqual(buildRetrievalPlan({ intent: 'known-file', freshness: 'fresh', policy }).steps, ['exact-source-read']);
  assert.deepEqual(buildRetrievalPlan({ intent: 'roadmap', freshness: 'fresh', policy }).steps, ['exact-source-read']);
  assert.deepEqual(buildRetrievalPlan({ intent: 'security-policy', freshness: 'fresh', policy }).steps, ['exact-source-read']);
});

test('generated projection can navigate but cannot replace exact source', () => {
  const plan = buildRetrievalPlan({ intent: 'graphify', freshness: 'fresh', policy });
  assert.deepEqual(plan.steps, ['projection-for-navigation', 'exact-source-read']);
  assert.equal(evidenceCanAuthorize({ evidenceKind: 'graphify', action: 'edit', exactSourceVerified: false, policy }), false);
});

test('CBM evidence cannot authorize edits or roadmap overrides without exact source', () => {
  assert.equal(evidenceCanAuthorize({ evidenceKind: 'cbm-structural-memory', action: 'edit', exactSourceVerified: false, policy }), false);
  assert.equal(evidenceCanAuthorize({ evidenceKind: 'cbm-structural-memory', action: 'edit', exactSourceVerified: true, policy }), true);
  assert.deepEqual(authorityRequirements('edit', policy), ['exact-source-read-current-target']);
  assert.deepEqual(authorityRequirements('security-policy-decision', policy), ['exact-source-read-canonical-authority']);
});

test('Brain mandatory agent entrypoint encodes B8.4 retrieval authority', () => {
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Codebase Memory MCP structural index first/);
  assert.match(agents, /exact current source before editing/);
  assert.match(agents, /stale, unavailable, or freshness is unknown/);
  assert.match(agents, /Graphify is not the structural default/);
  assert.match(agents, /b8-4-agent-retrieval-policy\.json/);
});

test('Graphify standard no longer claims structural-default authority', () => {
  const standard = fs.readFileSync(path.join(ROOT, 'docs/system/graphify-context-standard.md'), 'utf8');
  assert.match(standard, /frozen legacy projection pending B8\.5/);
  assert.match(standard, /fresh Codebase Memory MCP for structural navigation/);
  assert.match(standard, /exact current source as authority/);
  assert.doesNotMatch(standard, /For broad repo context, use Graphify first/);
});
