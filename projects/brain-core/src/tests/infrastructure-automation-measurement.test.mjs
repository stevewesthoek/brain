import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { validateMeasurementContract } from '../../../../tools/validate-infrastructure-automation-measurement.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-automation-measurement-fixtures-v1.json'), 'utf8'));

test('validates every IKHP6 measurement metric without execution fields', () => {
  assert.deepEqual(validateMeasurementContract({ fixtures }), []);
});

test('requires invalid measurement fixtures to fail schema validation', () => {
  assert.equal(fixtures.invalidMeasurements.length, 3);
  assert.deepEqual(validateMeasurementContract({ fixtures: { ...fixtures, invalidMeasurements: [] } }), []);
  for (const invalidCase of fixtures.invalidMeasurements) {
    const validFixtures = { ...fixtures, invalidMeasurements: [invalidCase] };
    assert.deepEqual(validateMeasurementContract({ fixtures: validFixtures }), []);
  }
});

test('rejects execution fields as an acceptance-contract boundary', () => {
  const invalid = structuredClone(fixtures);
  invalid.validMeasurements[0].executionPerformed = true;
  assert.match(
    validateMeasurementContract({ fixtures: invalid }).join('\n'),
    /executionPerformed/,
  );
});
