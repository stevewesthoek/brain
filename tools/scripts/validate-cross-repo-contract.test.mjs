import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, validateLive } from './validate-cross-repo-contract.mjs';

test('current Brain/Mind contract passes', () => {
  const result = validateLive();
  assert.equal(result.bridgeContractId, 'brain-mind-bridge');
  assert.equal(result.mindBridgeVersion, '2.0');
  assert.deepEqual(result.intakePaths, ['inbox/new', 'inbox/raw', 'resources', 'inbox/processed', 'inbox/failed']);
});

test('stale-path fixture fails with a scoped reason', () => assert.throws(() => validateFixture('stale-path.json'), /STALE_ACTIVE_PATH/));

test('valid fixture passes without the live Mind repository', () => assert.deepEqual(validateFixture('valid.json'), { fixture: 'valid.json', result: 'pass' }));

for (const [name, expected] of [
  ['missing-entrypoint', 'MISSING_ENTRYPOINT'],
  ['intake-mismatch', 'INTAKE_PATH_MISMATCH'],
  ['bridge-mismatch', 'BRIDGE_CONTRACT_MISMATCH'],
  ['schema-mismatch', 'SCHEMA_VERSION_MISMATCH'],
  ['malformed', 'MALFORMED_METADATA'],
]) test(`${name} fails safely`, () => assert.throws(() => validateFixture(`${name}.json`), new RegExp(expected)));

test('arbitrary fixture roots are rejected', () => assert.throws(() => validateFixture('../valid.json'), /INVALID_FIXTURE|PATH_ESCAPE/));
