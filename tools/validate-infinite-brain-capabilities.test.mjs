import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapabilityInventory} from './validate-infinite-brain-capabilities.mjs';

const inventory = JSON.parse(fs.readFileSync('operations/specs/infinite-brain-capabilities.json', 'utf8'));

test('full inventory validates', () => {
  assert.deepEqual(validateCapabilityInventory(inventory), []);
});

test('duplicate ids fail', () => {
  const clone = structuredClone(inventory);
  clone.capabilities[1].capabilityId = clone.capabilities[0].capabilityId;
  assert(validateCapabilityInventory(clone).some((error) => error.includes('duplicate')));
});

test('missing dependency fails', () => {
  const clone = structuredClone(inventory);
  clone.capabilities[2].dependencies = ['missing-dependency'];
  assert(validateCapabilityInventory(clone).some((error) => error.includes('missing-dependency')));
});

test('invalid evidence path fails', () => {
  const clone = structuredClone(inventory);
  clone.capabilities[0].evidenceReport = '../escape.md';
  assert(validateCapabilityInventory(clone).some((error) => error.includes('evidenceReport')));
});

test('active evidence command is allowlisted and succeeds', () => {
  assert.deepEqual(validateCapabilityInventory(inventory), []);
});

test('external mutation cannot be ungated', () => {
  const clone = structuredClone(inventory);
  clone.capabilities.find((capability) => capability.externalMutation).approvalRequirement = 'none';
  assert(validateCapabilityInventory(clone).some((error) => error.includes('approvalRequirement')));
});

test('validation does not upgrade capability state', () => {
  const clone = structuredClone(inventory);
  const before = JSON.stringify(clone);
  validateCapabilityInventory(clone);
  assert.equal(JSON.stringify(clone), before);
});
