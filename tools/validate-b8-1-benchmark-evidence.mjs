/**
 * B8.1 benchmark evidence validator.
 *
 * Validates an offline-only evidence JSON against the B8.1 evidence schema and
 * applies additional semantic checks that cannot be expressed in JSON Schema alone.
 *
 * Usage (CLI):
 *   node tools/validate-b8-1-benchmark-evidence.mjs --evidence=path/to/evidence.json
 *   node tools/validate-b8-1-benchmark-evidence.mjs --evidence=path/to/evidence.json --manifest=path/to/manifest.json
 *
 * Export:
 *   validateEvidence(evidencePath, schemaPath, { manifestPath }) → { valid, errors }
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Load Ajv from n8n's installation so we do not require a local dependency.
// ---------------------------------------------------------------------------
const requireFromN8n = createRequire('/opt/homebrew/lib/node_modules/n8n/');
const Ajv = requireFromN8n('ajv/dist/2020');
const addFormats = requireFromN8n('ajv-formats');

const DEFAULT_SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  '../operations/specs/b8-1-context-memory-benchmark-evidence.schema.json'
);

// ---------------------------------------------------------------------------
// Core validation function
// ---------------------------------------------------------------------------

/**
 * Validate an evidence file.
 *
 * @param {string} evidencePath  - Absolute or relative path to the evidence JSON file.
 * @param {string} [schemaPath]  - Path to the JSON Schema file. Defaults to the canonical schema.
 * @param {{ manifestPath?: string }} [options]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvidence(evidencePath, schemaPath, options = {}) {
  const errors = [];

  // --- Load files -----------------------------------------------------------
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch (err) {
    return { valid: false, errors: [`Failed to read evidence file: ${err.message}`] };
  }

  const resolvedSchemaPath = schemaPath || DEFAULT_SCHEMA_PATH;
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(resolvedSchemaPath, 'utf8'));
  } catch (err) {
    return { valid: false, errors: [`Failed to read schema file: ${err.message}`] };
  }

  // --- JSON Schema validation -----------------------------------------------
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const schemaValid = validate(evidence);

  if (!schemaValid) {
    for (const err of validate.errors || []) {
      errors.push(`Schema: ${err.instancePath || '(root)'} ${err.message}`);
    }
  }

  // --- Semantic check 1: offline-only — optionalModelMediatedMetrics must be absent ---
  if ('optionalModelMediatedMetrics' in evidence) {
    errors.push(
      'Semantic: optionalModelMediatedMetrics must not be present in offline-only evidence records. ' +
      'Model token fields are separately unauthorized and invalidate offline evidence.'
    );
  }

  // --- Semantic check 2: runId pattern (belt-and-suspenders over schema) -----
  if (evidence.runId !== undefined && !/^b8-1-[a-zA-Z0-9._-]+$/.test(evidence.runId)) {
    errors.push(
      `Semantic: runId "${evidence.runId}" does not match required pattern ^b8-1-[a-zA-Z0-9._-]+$`
    );
  }

  // --- Semantic check 3: selectedSubjects and excludedSubjects must not overlap ---
  if (Array.isArray(evidence.selectedSubjects) && Array.isArray(evidence.excludedSubjects)) {
    const overlap = evidence.selectedSubjects.filter((s) =>
      evidence.excludedSubjects.includes(s)
    );
    if (overlap.length > 0) {
      errors.push(
        `Semantic: subjects appear in both selectedSubjects and excludedSubjects: ${overlap.join(', ')}`
      );
    }
  }

  // --- Semantic check 4: networkIsolationProof.selfTestPassed must be true ---
  if (
    evidence.networkIsolationProof !== undefined &&
    evidence.networkIsolationProof.selfTestPassed !== true
  ) {
    errors.push(
      'Semantic: networkIsolationProof.selfTestPassed must be true. ' +
      'Evidence collected without a passing network isolation self-test is invalid.'
    );
  }

  // --- Semantic check 5: fixture IDs against manifest (optional) ------------
  if (options.manifestPath) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf8'));
    } catch (err) {
      errors.push(`Semantic: failed to read manifest file for fixture validation: ${err.message}`);
    }

    if (manifest && Array.isArray(evidence.fixtureResults)) {
      const knownFixtureIds = new Set(
        (manifest.fixtures || []).map((f) => f.fixtureId || f.id)
      );

      if (knownFixtureIds.size > 0) {
        for (const result of evidence.fixtureResults) {
          if (!knownFixtureIds.has(result.fixtureId)) {
            errors.push(
              `Semantic: fixtureResult references unknown fixtureId "${result.fixtureId}" not found in manifest`
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

// Run as CLI only when this module is the entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = parseArgs(process.argv);

  if (!args.evidence) {
    console.error('Usage: node validate-b8-1-benchmark-evidence.mjs --evidence=<path> [--manifest=<path>]');
    process.exit(1);
  }

  const result = validateEvidence(
    args.evidence,
    args.schema || DEFAULT_SCHEMA_PATH,
    { manifestPath: args.manifest }
  );

  if (result.valid) {
    console.log('OK: evidence is valid');
    process.exit(0);
  } else {
    console.error('INVALID: evidence failed validation');
    for (const err of result.errors) {
      console.error(' -', err);
    }
    process.exit(1);
  }
}
