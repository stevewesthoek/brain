import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { REGISTRY_PATH, validateContractRegistry } from './validate-infinite-brain-contract-registry.mjs';

function registryFixture() {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

test('the committed registry is deterministic and valid', () => {
  assert.deepEqual(validateContractRegistry(registryFixture()), []);
});

test('duplicate contracts and invalid owners fail closed', () => {
  const registry = registryFixture();
  registry.entries.push({ ...registry.entries[0] });
  registry.entries[1].executableOwner = 'mind-human';
  const errors = validateContractRegistry(registry);
  assert.ok(errors.some((error) => error.includes('duplicated')));
  assert.ok(errors.some((error) => error.includes('assigns runtime execution to Mind')));
});

test('candidate, historical, compatibility, and validator boundaries fail closed', () => {
  const registry = registryFixture();
  const candidate = registry.entries.find((entry) => entry.lifecycleState === 'candidate');
  const historical = registry.entries.find((entry) => entry.contractId === 'bs0-stabilization-program-evidence');
  const compatibility = registry.entries.find((entry) => entry.contractId === 'task-kanban-contract');
  const schemaContract = registry.entries.find((entry) => entry.contractId === 'graphify-strategy');
  candidate.stateClaims = { deployment: 'deployed', verified: true, activation: 'asserted', schedule: 'asserted' };
  historical.runtimeConsumers.push({ repository: 'brain', path: 'tools/validate-infinite-brain-contract-registry.mjs' });
  delete compatibility.compatibilityException;
  schemaContract.validators = [];
  const errors = validateContractRegistry(registry);
  assert.ok(errors.some((error) => error.includes('candidate state')));
  assert.ok(errors.some((error) => error.includes('historical evidence')));
  assert.ok(errors.some((error) => error.includes('compatibility exception')));
  assert.ok(errors.some((error) => error.includes('executable schema requires')));
});
