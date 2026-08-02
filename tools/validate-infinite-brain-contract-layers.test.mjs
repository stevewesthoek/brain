import assert from 'node:assert/strict';
import test from 'node:test';

import { loadContractLayers, validateContractLayers } from './validate-infinite-brain-contract-layers.mjs';

function fixture() { return structuredClone(loadContractLayers()); }

test('the contract layer map keeps every required family explicitly separated', () => {
  assert.deepEqual(validateContractLayers(fixture()), []);
});

test('candidate, deployed, verified, normative, and generated boundaries fail closed', () => {
  const map = fixture();
  const automation = map.families.find((family) => family.familyId === 'automation');
  automation.deploymentEvidence.status = 'deployed';
  automation.verifiedEvidence.live = true;
  const candidateErrors = validateContractLayers(map);
  assert.ok(candidateErrors.some((error) => error.includes('cannot claim deployed')));
  assert.ok(candidateErrors.some((error) => error.includes('candidate configuration')));

  automation.runtimeConfiguration = { kind: 'policy', repository: 'mind', path: 'system/automation-contract.md' };
  automation.normativeMindSource = { repository: 'brain', path: 'operations/reports/bs0-3-n8n-candidate-activation-freeze-2026-07-13.md', owner: 'brain-runtime' };
  const errors = validateContractLayers(map);
  assert.ok(errors.some((error) => error.includes('runtime configuration')));
  assert.ok(errors.some((error) => error.includes('Mind-owned normative source')));
});

test('completed B1.0a evidence fails closed if live readback provenance is downgraded', () => {
  const map = fixture();
  const deployment = map.families.find((family) => family.familyId === 'save-to-mind-deployment-status');
  deployment.observedEvidence.status = 'historical-partial';
  deployment.verifiedEvidence.live = false;
  const errors = validateContractLayers(map);
  assert.ok(errors.some((error) => error.includes('exact live readback verification')));
});

test('missing validators, contradictory owners, evidence provenance, and compatibility defaults fail closed', () => {
  const map = fixture();
  const maintenance = map.families.find((family) => family.familyId === 'maintenance');
  const folder = map.families.find((family) => family.familyId === 'folder-path');
  maintenance.brainValidator = { repository: 'mind', path: 'system/maintenance-report-contract.md', owner: 'mind-human' };
  maintenance.observedEvidence = { status: 'observed', timestamp: null, provenance: null };
  folder.compatibilityLayer.pathIds = ['kanban-current-authority'];
  const errors = validateContractLayers(map);
  assert.ok(errors.some((error) => error.includes('Brain-owned validator')));
  assert.ok(errors.some((error) => error.includes('timestamp and provenance')));
  assert.ok(errors.some((error) => error.includes('cannot satisfy canonical write policy')));
});
