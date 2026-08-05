import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const gov = loadJSON('operations/specs/graphify-transition-governance.json');
const admissions = loadJSON('operations/specs/mcp-provider-admissions.json');
const caps = loadJSON('operations/specs/infinite-brain-capabilities.json');

const oneShot = gov.migrationPath.oneShotExecutions[0];
const mcAdmission = admissions.admissions.find(
  (a) => a.admissionId === 'mind-context-for-brain'
);
const mcCap = caps.capabilities.find(
  (c) => c.capabilityId === 'mind-context-mcp-provider'
);

test('M7.1: one-shot status is completed-owner-ratified', () => {
  assert.equal(oneShot.status, 'completed-owner-ratified');
});

test('M7.1: exactly two receipts — accepted and superseded', () => {
  assert.equal(oneShot.receipts.length, 2);
  const [superseded, accepted] = oneShot.receipts;
  assert.match(superseded.path, /000530/);
  assert.match(accepted.path, /000604/);
  assert.equal(superseded.postPublicationFailure, 'ENOTEMPTY staging cleanup');
  assert.equal(accepted.postPublicationFailure, null);
});

test('M7.1: accepted receipt has expected SHA-256', () => {
  const accepted = oneShot.receipts[1];
  assert.equal(
    accepted.sha256,
    'd03f2fb3f16dfda2edc323f5166669607fc51389dac7e1ab387c88bae3379bee'
  );
});

test('M7.1: superseded receipt has expected SHA-256', () => {
  const superseded = oneShot.receipts[0];
  assert.equal(
    superseded.sha256,
    '5c641c52da57703029d81d3f78a5273af97e7aca146f4e27c75ab24074234bd1'
  );
});

test('M7.1: owner disposition resolved — not required', () => {
  assert.equal(oneShot.ownerDispositionRequired, false);
  assert.ok(oneShot.ownerDisposition);
  assert.equal(
    oneShot.ownerDisposition.acceptedRunId,
    '20260804T000604198Z-06de527423e0'
  );
  assert.equal(
    oneShot.ownerDisposition.supersededDiagnosticRunId,
    '20260804T000530178Z-06de527423e0'
  );
});

test('M7.1: currentExecutionAuthority is none — replay blocked', () => {
  assert.equal(gov.migrationPath.currentExecutionAuthority, 'none');
});

test('M7.1: no recurring authority granted', () => {
  assert.equal(oneShot.recurringAuthorityGranted, false);
});

test('M7.1: Mind commit bound to Graphify run', () => {
  assert.equal(
    oneShot.mindCommit,
    '06de527423e05d4208cdcf485be92a2d1028c46d'
  );
});

test('M2.4: admission status is active-local', () => {
  assert.equal(mcAdmission.status, 'active-local');
});

test('M2.4: provider revision is 51e9091c (live approved)', () => {
  assert.equal(
    mcAdmission.provider.revision,
    '51e9091c7374e0642f4fe076b895c184152dd516'
  );
});

test('M2.4: Mind pin is a21f9ed5', () => {
  assert.equal(
    mcAdmission.scope.fixedEnvironment.MIND_CONTEXT_EXPECTED_HEAD,
    'a21f9ed5d7270ae7dd939b93c5df525c933091f8'
  );
});

test('M2.4: exactly three read-only tools admitted', () => {
  const tools = mcAdmission.scope.tools;
  assert.equal(tools.length, 3);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'mind_context_explain',
    'mind_context_health',
    'mind_context_resolve',
  ]);
  for (const t of tools) {
    assert.equal(t.risk, 'read');
    assert.equal(t.approval, 'none');
  }
});

test('M2.4: no mutation tool or suboperation exposed', () => {
  const tools = mcAdmission.scope.tools;
  for (const t of tools) {
    assert.notEqual(t.risk, 'write');
    assert.notEqual(t.risk, 'external-mutation');
    assert.deepEqual(t.allowedSuboperations, []);
  }
});

test('M2.4: provider is loopback-only with no authentication relay', () => {
  assert.equal(mcAdmission.transport.networkPolicy, 'loopback-only');
  assert.equal(mcAdmission.authentication.mode, 'none');
  assert.equal(mcAdmission.authentication.relayAllowed, false);
});

test('M2.4: enforcement is provider-enforced', () => {
  assert.equal(mcAdmission.scope.enforcementStatus, 'provider-enforced');
});

test('M2.4: capability state verified/deployed/read-only', () => {
  assert.equal(mcCap.state, 'verified');
  assert.equal(mcCap.safetyMode, 'read-only');
  assert.equal(mcCap.deployedState, 'deployed');
  assert.equal(mcCap.externalMutation, false);
});

test('M2.4: provider revision agrees across admission and template', () => {
  const templatePath = path.join(
    root,
    'operations/system-configs/mcp/mind-context/codex-config.template.toml'
  );
  const template = fs.readFileSync(templatePath, 'utf8');
  assert.ok(
    template.includes(mcAdmission.provider.revision),
    'template must contain the admitted provider revision'
  );
  assert.ok(
    template.includes(
      mcAdmission.scope.fixedEnvironment.MIND_CONTEXT_EXPECTED_HEAD
    ),
    'template must contain the admitted Mind HEAD'
  );
});

test('cross-document: governance and admission Mind commits are consistent', () => {
  // The Graphify Mind commit is the run-time source (06de527),
  // while the provider Mind pin is the post-closure final Mind HEAD (08b2d1a).
  // They should differ because Mind advanced after the Graphify run.
  assert.notEqual(
    oneShot.mindCommit,
    mcAdmission.scope.fixedEnvironment.MIND_CONTEXT_EXPECTED_HEAD,
    'Graphify and provider pin to different Mind commits (expected)'
  );
});
