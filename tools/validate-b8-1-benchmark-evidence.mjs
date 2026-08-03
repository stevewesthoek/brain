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
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Load Ajv from local repository, not n8n.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

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
 * @param {{ manifestPath?: string, runDir?: string }} [options]
 *   - runDir: when provided, bind evidence to the actual run directory (Task 5)
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

  // --- Semantic check 4: networkIsolationProof semantics ---
  // Task 4: When CBM is selected, require full isolation proof with all required fields.
  // When CBM is NOT selected, require status="not-required" only.
  if (evidence.networkIsolationProof !== undefined) {
    const cbmSelected = Array.isArray(evidence.selectedSubjects) && evidence.selectedSubjects.includes('cbm');
    const proof = evidence.networkIsolationProof;

    if (cbmSelected) {
      // CBM selected: require full proof with selfTestPassed=true
      if (proof.status !== 'passed') {
        errors.push(
          `Semantic: CBM is selected but networkIsolationProof.status is "${proof.status}" (expected "passed")`
        );
      }
      if (proof.selfTestPassed !== true) {
        errors.push(
          'Semantic: CBM is selected but networkIsolationProof.selfTestPassed is not true. ' +
          'Evidence collected without a passing network isolation self-test is invalid.'
        );
      }
    } else {
      // CBM NOT selected: require status="not-required" only
      if (proof.status !== 'not-required') {
        errors.push(
          `Semantic: CBM not selected but networkIsolationProof.status is "${proof.status}" ` +
          '(expected "not-required" with no other fields)'
        );
      }
    }
  }

  // --- Semantic check 4b: subjectBinaryIdentity.cbm when CBM is selected ---
  // Task 4: When CBM is selected, require subjectBinaryIdentity.cbm.
  // When CBM is NOT selected, it must not be present.
  if (evidence.subjectBinaryIdentity !== undefined) {
    const cbmSelected = Array.isArray(evidence.selectedSubjects) && evidence.selectedSubjects.includes('cbm');
    if (cbmSelected && !evidence.subjectBinaryIdentity.cbm) {
      errors.push(
        'Semantic: CBM is selected but subjectBinaryIdentity.cbm is missing'
      );
    }
    if (!cbmSelected && evidence.subjectBinaryIdentity.cbm) {
      errors.push(
        'Semantic: CBM not selected but subjectBinaryIdentity.cbm is present'
      );
    }
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

  // --- Semantic check 6: Bind evidence to run directory (Task 5) ---
  if (options.runDir) {
    const runDir = path.resolve(options.runDir);
    const runDirBasename = path.basename(runDir);

    // Verify run-directory basename equals evidence.runId
    if (evidence.runId && evidence.runId !== runDirBasename) {
      errors.push(
        `Binding: evidence.runId "${evidence.runId}" does not match run directory basename "${runDirBasename}"`
      );
    }

    // Verify run-plan.json exists and parses
    const runPlanPath = path.join(runDir, 'run-plan.json');
    let runPlan = null;
    try {
      runPlan = JSON.parse(fs.readFileSync(runPlanPath, 'utf8'));
    } catch (err) {
      errors.push(
        `Binding: run-plan.json missing or unparseable at ${runPlanPath}: ${err.message}`
      );
    }

    // Verify preflight-receipt.json exists and parses
    const receiptPath = path.join(runDir, 'preflight-receipt.json');
    let receipt = null;
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    } catch (err) {
      errors.push(
        `Binding: preflight-receipt.json missing or unparseable at ${receiptPath}: ${err.message}`
      );
    }

    // Cross-check fields
    if (runPlan && evidence.manifestHash) {
      if (runPlan.manifestHash !== evidence.manifestHash) {
        errors.push(
          `Binding: run-plan.json manifestHash ${runPlan.manifestHash} does not match evidence.manifestHash ${evidence.manifestHash}`
        );
      }
    }

    if (receipt && evidence.preflightReceiptHash) {
      if (receipt.manifestHash !== evidence.manifestHash) {
        errors.push(
          `Binding: preflight-receipt.json manifestHash does not match evidence.manifestHash`
        );
      }
    }

    // Verify planSha256 when present
    if (runPlan && evidence.planSha256 && runPlan.planSha256) {
      if (runPlan.planSha256 !== evidence.planSha256) {
        errors.push(
          `Binding: run-plan.json planSha256 ${runPlan.planSha256.slice(0, 16)}... ` +
          `does not match evidence.planSha256 ${evidence.planSha256.slice(0, 16)}...`
        );
      }
    }

    // Verify selectedSubjects match
    if (runPlan && evidence.selectedSubjects) {
      const runSubjects = new Set(runPlan.selectedSubjects || []);
      const evidenceSubjects = new Set(evidence.selectedSubjects);
      if (runSubjects.size !== evidenceSubjects.size || ![...runSubjects].every(s => evidenceSubjects.has(s))) {
        errors.push(
          `Binding: run-plan selectedSubjects [${[...runSubjects]}] ` +
          `do not match evidence selectedSubjects [${[...evidenceSubjects]}]`
        );
      }
    }

    // Verify excludedSubjects match
    if (runPlan && evidence.excludedSubjects) {
      const runExcluded = new Set(runPlan.excludedSubjects || []);
      const evidenceExcluded = new Set(evidence.excludedSubjects);
      if (runExcluded.size !== evidenceExcluded.size || ![...runExcluded].every(s => evidenceExcluded.has(s))) {
        errors.push(
          `Binding: run-plan excludedSubjects do not match evidence excludedSubjects`
        );
      }
    }

    // Verify CBM binary identity when CBM is selected
    if (evidence.selectedSubjects && evidence.selectedSubjects.includes('cbm') && evidence.subjectBinaryIdentity?.cbm) {
      if (runPlan && runPlan.cbmBinaryIdentity) {
        if (runPlan.cbmBinaryIdentity.sha256 !== evidence.subjectBinaryIdentity.cbm.sha256) {
          errors.push(
            `Binding: CBM binary identity sha256 mismatch between run-plan and evidence`
          );
        }
      }
    }

    // Verify network-isolation proof when CBM is selected
    if (evidence.selectedSubjects && evidence.selectedSubjects.includes('cbm') && evidence.networkIsolationProof?.status === 'passed') {
      if (runPlan && runPlan.networkProfileSha256) {
        if (runPlan.networkProfileSha256 !== evidence.networkIsolationProof.profileSha256) {
          errors.push(
            `Binding: network profile sha256 mismatch between run-plan and evidence`
          );
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
    console.error('Usage: node validate-b8-1-benchmark-evidence.mjs --evidence=<path> [--manifest=<path>] [--run-dir=<path>]');
    process.exit(1);
  }

  const result = validateEvidence(
    args.evidence,
    args.schema || DEFAULT_SCHEMA_PATH,
    { manifestPath: args.manifest, runDir: args['run-dir'] }
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
