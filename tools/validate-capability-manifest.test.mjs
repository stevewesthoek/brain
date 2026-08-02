import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCapabilityManifest} from './capability-manifest-utils.mjs';
import {validateFixtureSet} from './validate-capability-manifest.mjs';

const fixtureSet = JSON.parse(fs.readFileSync('operations/fixtures/capability-manifest-fixtures-v1.json', 'utf8'));

function applyPathRemoval(target, removePath) {
  const match = /^capabilities\[(\d+)\]\.(.+)$/.exec(removePath ?? '');
  if (!match) throw new Error(`unsupported_remove:${removePath}`);
  const index = Number(match[1]);
  const key = match[2];
  delete target.capabilities[index][key];
}

function applyPatch(target, patch) {
  for (const entry of patch?.capabilities ?? []) {
    const item = target.capabilities.find((capability) => capability.capabilityId === entry.capabilityId);
    if (!item) throw new Error(`missing_capability:${entry.capabilityId}`);
    Object.assign(item, entry);
  }
}

test('valid fixture passes', () => {
  assert.deepEqual(validateFixtureSet(fixtureSet), []);
  assert.deepEqual(validateCapabilityManifest(fixtureSet.valid, {runEvidence: true}), []);
});

for (const item of fixtureSet.invalid) {
  test(`invalid ${item.name} fails`, () => {
    const clone = structuredClone(fixtureSet.valid);
    if (item.remove) applyPathRemoval(clone, item.remove);
    if (item.patch) applyPatch(clone, item.patch);
    assert(validateCapabilityManifest(clone).length > 0);
  });
}

test('verified evidence commands are allowlisted and succeed', () => {
  const verified = structuredClone(fixtureSet.valid);
  assert.deepEqual(validateCapabilityManifest(verified, {runEvidence: true}), []);
});
