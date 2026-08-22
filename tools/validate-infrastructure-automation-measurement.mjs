import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { validateJsonSchema } from './context-learning/context-learning-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schemaPath = path.join(root, 'operations/specs/infrastructure-automation-measurement-v1.schema.json');
const fixturePath = path.join(root, 'operations/fixtures/infrastructure-automation-measurement-fixtures-v1.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export function validateMeasurementContract({ schema = readJson(schemaPath), fixtures = readJson(fixturePath) } = {}) {
  const errors = [];
  const expectedMetrics = [
    'false_positive',
    'failed_remediation_attempt',
    'mttd',
    'mttr',
    'backup_success',
    'restore_test_success',
    'credential_expiry_warning_coverage',
    'alert_noise_reduction',
  ];

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('measurement schema must declare JSON Schema Draft 2020-12');
  }
  if (!schema.$id) errors.push('measurement schema requires a stable $id');
  if (schema.additionalProperties !== false) errors.push('measurement schema must reject unknown fields');

  const validMeasurements = fixtures.validMeasurements ?? [];
  const validMetrics = validMeasurements.map((measurement) => measurement.metric).sort();
  if (JSON.stringify(validMetrics) !== JSON.stringify([...expectedMetrics].sort())) {
    errors.push('valid fixtures must cover each measurement metric exactly once');
  }

  for (const [index, measurement] of validMeasurements.entries()) {
    errors.push(...validateJsonSchema(schema, measurement, schema, `$.validMeasurements[${index}]`));
    for (const forbiddenField of ['executionEnabled', 'executionPerformed', 'actualEffects', 'remediation']) {
      if (Object.hasOwn(measurement, forbiddenField)) {
        errors.push(`valid measurement ${measurement.measurementId ?? index} contains forbidden execution field ${forbiddenField}`);
      }
    }
  }

  for (const invalidCase of fixtures.invalidMeasurements ?? []) {
    const validationErrors = validateJsonSchema(schema, invalidCase.measurement, schema, `$.invalidMeasurements.${invalidCase.caseId}`);
    if (validationErrors.length === 0) errors.push(`invalid fixture must fail: ${invalidCase.caseId}`);
  }

  return errors;
}

export function main() {
  const errors = validateMeasurementContract();
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    return 1;
  }

  console.log('infrastructure-automation-measurement-valid metrics=8 executionEnabled=false executionPerformed=false actualEffects=[]');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
