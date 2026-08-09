/**
 * B8.1 benchmark evidence validator.
 *
 * Validates an offline-only evidence JSON against the B8.1 evidence schema and
 * applies additional semantic checks that cannot be expressed in JSON Schema alone.
 *
 * Usage (CLI):
 *   node tools/validate-b8-1-benchmark-evidence.mjs --evidence=path/to/evidence.json
 *   node tools/validate-b8-1-benchmark-evidence.mjs --evidence=path/to/evidence.json --manifest=path/to/manifest.json
 *   node tools/validate-b8-1-benchmark-evidence.mjs --evidence=path/to/evidence.json --manifest=path/to/manifest.json --run-dir=path/to/run
 *
 * Export:
 *   validateEvidence(evidencePath, schemaPath, { manifestPath, runDir }) → { valid, errors }
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { computePlanDigest } from './lib/b8-1-plan-digest.mjs';
import { selectRefreshProbeTarget } from './lib/b8-1-cbm-incremental-reindex.mjs';

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
const DEFAULT_MANIFEST_SCHEMA_PATH = path.resolve(
  import.meta.dirname,
  '../operations/specs/b8-1-context-memory-benchmark-manifest.schema.json'
);
const VALID_SUBJECTS = ['cbm', 'graphify', 'exact-source'];

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sameSet(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length && new Set(left).size === left.length
    && left.every(value => right.includes(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizePinnedCommits(value) {
  const entries = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return entries
    .filter(isRecord)
    .map(entry => ({ repositoryId: entry.repositoryId, commit: entry.commit ?? entry.pinnedCommit }))
    .sort((a, b) => String(a.repositoryId).localeCompare(String(b.repositoryId)));
}

function planDigestInputs(artifact) {
  const { planSha256: _planSha256, createdAt: _createdAt, ...inputs } = artifact;
  return inputs;
}

function hashCanonicalValue(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

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
    const schemaStat = fs.lstatSync(resolvedSchemaPath);
    if (!schemaStat.isFile() || schemaStat.isSymbolicLink()) throw new Error('schema must be a non-symlink regular file');
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
  if (!isRecord(evidence)) {
    errors.push('Semantic: evidence root must be a JSON object');
    return { valid: false, errors };
  }

  // --- Semantic check 1: offline-only — optionalModelMediatedMetrics must be absent ---
  if ('optionalModelMediatedMetrics' in evidence) {
    errors.push(
      'Semantic: optionalModelMediatedMetrics must not be present in offline-only evidence records. ' +
      'Model token fields are separately unauthorized and invalidate offline evidence.'
    );
  }

  // --- Semantic check 2: runId pattern (belt-and-suspenders over schema) -----
  if (evidence.runId !== undefined && (!/^b8-1-[a-zA-Z0-9._-]+$/.test(evidence.runId) || evidence.runId.includes('..'))) {
    errors.push(
      `Semantic: runId "${evidence.runId}" must match ^b8-1-[a-zA-Z0-9._-]+$ and must not contain ".."`
    );
  }

  // --- Semantic checks 3-4: complete subject partition and CBM proof --------
  const selectedSubjects = Array.isArray(evidence.selectedSubjects) ? evidence.selectedSubjects : [];
  const excludedSubjects = Array.isArray(evidence.excludedSubjects) ? evidence.excludedSubjects : [];
  const fixtureResults = Array.isArray(evidence.fixtureResults) ? evidence.fixtureResults : [];
  const overlap = selectedSubjects.filter(subject => excludedSubjects.includes(subject));
  if (overlap.length > 0) {
    errors.push(`Semantic: subjects appear in both selectedSubjects and excludedSubjects: ${overlap.join(', ')}`);
  }
  const combinedSubjects = [...new Set([...selectedSubjects, ...excludedSubjects])].sort();
  if (!sameSet(combinedSubjects, VALID_SUBJECTS)) {
    errors.push('Semantic: selectedSubjects and excludedSubjects must form a complete partition of cbm, graphify, and exact-source');
  }

  const expectedPartialEvidence = excludedSubjects.length > 0;
  if (evidence.partialEvidence !== expectedPartialEvidence) {
    errors.push(`Semantic: partialEvidence must be ${expectedPartialEvidence} for the declared subject partition`);
  }
  if (excludedSubjects.includes('graphify') && evidence.partialEvidence !== true) {
    errors.push('Semantic: Graphify exclusion is partial evidence and cannot represent full B8.1 completion');
  }

  const cbmSelected = selectedSubjects.includes('cbm');
  const proof = evidence.networkIsolationProof;
  const cbmIdentity = evidence.subjectBinaryIdentity?.cbm;
  if (cbmSelected) {
    if (!cbmIdentity) {
      errors.push('Semantic: CBM is selected but subjectBinaryIdentity.cbm is missing');
    }
    const completeProof = proof?.required === true
      && proof?.status === 'passed'
      && typeof proof?.adapterIdentity?.path === 'string'
      && /^[a-f0-9]{64}$/.test(proof?.adapterIdentity?.sha256 ?? '')
      && typeof proof?.runtimeIdentity?.path === 'string'
      && /^[a-f0-9]{64}$/.test(proof?.runtimeIdentity?.sha256 ?? '')
      && typeof proof?.runtimeIdentity?.version === 'string'
      && /^[a-f0-9]{64}$/.test(proof?.childIdentity?.sha256 ?? '')
      && /^[a-f0-9]{64}$/.test(proof?.profileSha256 ?? '')
      && proof?.controlSucceeded === true
      && proof?.sandboxedChildStarted === true
      && proof?.sandboxedConnectionDenied === true
      && proof?.selfTestPassed === true;
    if (!completeProof) {
      errors.push('Semantic: CBM is selected but networkIsolationProof is not a complete passed proof');
    }
  } else {
    if (cbmIdentity) {
      errors.push('Semantic: CBM not selected but subjectBinaryIdentity.cbm is present');
    }
    if (!sameValue(proof, { required: false, status: 'not-required' })) {
      errors.push('Semantic: CBM not selected requires exactly {required:false,status:"not-required"} with no adapter or self-test data');
    }
  }

  for (const [subject] of Object.entries(evidence.subjectBinaryIdentity ?? {})) {
    if (excludedSubjects.includes(subject)) {
      errors.push(`Semantic: excluded subject "${subject}" must not have binary identity data`);
    }
  }
  for (const result of fixtureResults) {
    if (!isRecord(result)) continue;
    if (excludedSubjects.includes(result.subject)) {
      errors.push(`Semantic: fixtureResult for excluded subject "${result.subject}" is not allowed`);
    }
  }

  // --- Semantic check 5: bind the actual manifest and fixture coverage ------
  let manifest = null;
  if (options.manifestPath) {
    try {
      const manifestStat = fs.lstatSync(options.manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new Error('manifest must be a non-symlink regular file');
      const manifestBytes = fs.readFileSync(options.manifestPath);
      manifest = JSON.parse(manifestBytes.toString('utf8'));
      const actualManifestHash = `sha256:${crypto.createHash('sha256').update(manifestBytes).digest('hex')}`;
      if (evidence.manifestHash !== actualManifestHash) {
        errors.push(`Binding: actual manifest SHA-256 ${actualManifestHash} does not match evidence.manifestHash ${evidence.manifestHash}`);
      }
    } catch (err) {
      errors.push(`Semantic: failed to read manifest file for fixture validation: ${err.message}`);
    }
  }

  if (manifest) {
    const manifestFixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
    const fixtureIds = manifestFixtures.filter(isRecord).map(fixture => fixture.fixtureId || fixture.id);
    const knownFixtureIds = new Set(fixtureIds);
    const seenResults = new Set();
    for (const result of fixtureResults) {
      if (!isRecord(result)) continue;
      const resultKey = `${result.subject}:${result.fixtureId}`;
      if (!knownFixtureIds.has(result.fixtureId)) {
        errors.push(`Semantic: fixtureResult references unknown fixtureId "${result.fixtureId}" not found in manifest`);
      }
      if (seenResults.has(resultKey)) {
        errors.push(`Semantic: duplicate fixtureResult for ${resultKey}`);
      }
      seenResults.add(resultKey);
    }
    for (const subject of selectedSubjects) {
      for (const fixtureId of fixtureIds) {
        if (!seenResults.has(`${subject}:${fixtureId}`)) {
          errors.push(`Semantic: missing fixtureResult for selected subject "${subject}" fixture "${fixtureId}"`);
        }
      }
    }

    const manifestCommits = normalizePinnedCommits(
      (Array.isArray(manifest.repositories) ? manifest.repositories : [])
        .filter(isRecord)
        .map(repo => ({ repositoryId: repo.repositoryId, commit: repo.pinnedCommit }))
    );
    if (!sameValue(normalizePinnedCommits(evidence.pinnedRepositoryCommits), manifestCommits)) {
      errors.push('Binding: evidence pinnedRepositoryCommits do not match the actual manifest');
    }
  }

  // --- Semantic check 6: bind evidence to the actual run artifacts ----------
  if (options.runDir) {
    const runDir = path.resolve(options.runDir);
    let physicalRunDir;
    try {
      const runDirStat = fs.lstatSync(runDir);
      if (!runDirStat.isDirectory() || runDirStat.isSymbolicLink()) throw new Error('run directory must be a non-symlink directory');
      physicalRunDir = fs.realpathSync(runDir);
    } catch (error) {
      errors.push(`Binding: invalid --run-dir ${runDir}: ${error.message}`);
      return { valid: false, errors };
    }
    const readRunArtifact = (filePath, label) => {
      const artifactStat = fs.lstatSync(filePath);
      if (!artifactStat.isFile() || artifactStat.isSymbolicLink()) throw new Error(`${label} must be a non-symlink regular file`);
      const physicalPath = fs.realpathSync(filePath);
      const relative = path.relative(physicalRunDir, physicalPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} resolves outside the run directory`);
      return fs.readFileSync(physicalPath);
    };
    try {
      readRunArtifact(path.resolve(evidencePath), 'evidence file');
    } catch (error) {
      errors.push(`Binding: ${error.message}`);
    }
    const runDirBasename = path.basename(runDir);
    if (!options.manifestPath) {
      errors.push('Binding: --manifest is required when --run-dir is supplied');
    }
    if (evidence.runId && evidence.runId !== runDirBasename) {
      errors.push(`Binding: evidence.runId "${evidence.runId}" does not match run directory basename "${runDirBasename}"`);
    }

    const runPlanPath = path.join(runDir, 'run-plan.json');
    const receiptPath = path.join(runDir, 'preflight-receipt.json');
    const cleanupManifestPath = path.join(runDir, 'cleanup-manifest.json');
    const sourceStateBeforePath = path.join(runDir, 'source-state-before.json');
    const sourceStateAfterPath = path.join(runDir, 'source-state-after.json');
    let runPlan = null;
    let receipt = null;
    try {
      runPlan = JSON.parse(readRunArtifact(runPlanPath, 'run-plan.json').toString('utf8'));
      if (!isRecord(runPlan)) {
        errors.push(`Binding: run-plan.json must contain a JSON object`);
        runPlan = null;
      }
    } catch (err) {
      errors.push(`Binding: run-plan.json missing or unparseable at ${runPlanPath}: ${err.message}`);
    }
    try {
      const receiptBytes = readRunArtifact(receiptPath, 'preflight-receipt.json');
      receipt = JSON.parse(receiptBytes.toString('utf8'));
      if (!isRecord(receipt)) {
        errors.push(`Binding: preflight-receipt.json must contain a JSON object`);
        receipt = null;
      }
      const actualReceiptHash = `sha256:${crypto.createHash('sha256').update(receiptBytes).digest('hex')}`;
      if (evidence.preflightReceiptHash !== actualReceiptHash) {
        errors.push(`Binding: actual preflight-receipt.json SHA-256 ${actualReceiptHash} does not match evidence.preflightReceiptHash ${evidence.preflightReceiptHash}`);
      }
    } catch (err) {
      errors.push(`Binding: preflight-receipt.json missing or unparseable at ${receiptPath}: ${err.message}`);
    }

    // v4 plan layout uses repo-relative paths and a runContext sub-object.
    // Detect which layout the artifact uses and validate accordingly.
    const isV4Layout = (artifact) => {
      if (!isRecord(artifact)) return false;
      return 'planVersion' in artifact && (
        'manifestRepoRelPath' in artifact || 'runContext' in artifact
      );
    };

    // v3/v4 required fields (repo-relative layout)
    const requiredPlanFieldsV4 = [
      'planVersion', 'runId', 'partialEvidence', 'selectedSubjects', 'excludedSubjects',
      'manifestRepoRelPath', 'manifestHash',
      'manifestSchemaRepoRelPath', 'manifestSchemaHash',
      'evidenceSchemaRepoRelPath', 'evidenceSchemaHash',
      'pinnedRepositoryCommits', 'subjectBinaryIdentity', 'networkIsolationProof', 'cbmVerification', 'graphifyStatus',
      'diskResult', 'sourceStateHash', 'checks', 'planSha256',
    ];
    // Legacy layout (v1/v2 evidence validator tests — absolute paths at top level)
    const requiredPlanFields = [
      'schemaVersion', 'runId', 'partialEvidence', 'selectedSubjects', 'excludedSubjects', 'manifestPath', 'manifestHash',
      'manifestSchemaPath', 'manifestSchemaHash', 'evidenceSchemaPath', 'evidenceSchemaHash',
      'pinnedRepositoryCommits', 'subjectBinaryIdentity', 'networkIsolationProof', 'cbmVerification', 'graphifyStatus',
      'diskResult', 'plannedWritePaths', 'runDirectoryPhysical', 'sourceStateHash', 'checks', 'planSha256',
    ];

    for (const [artifactName, artifact] of [['run-plan.json', runPlan], ['preflight-receipt.json', receipt]]) {
      if (!artifact) continue;
      const useV4 = isV4Layout(artifact);
      const activeRequiredFields = useV4 ? requiredPlanFieldsV4 : requiredPlanFields;

      // For v4 layout, runContext holds physical paths and is allowed as an extra field
      const allowedPlanFields = useV4
        ? [...activeRequiredFields, 'createdAt', 'runContext', 'sourceLogicalIdentity']
        : [...requiredPlanFields, 'createdAt'];

      const artifactKeys = Object.keys(artifact);
      const missingFields = allowedPlanFields.filter(f => activeRequiredFields.includes(f) && !(f in artifact));
      const extraFields = artifactKeys.filter(f => !allowedPlanFields.includes(f));

      if (missingFields.length > 0) {
        for (const field of missingFields) {
          errors.push(`Binding: ${artifactName} is missing required field ${field}`);
        }
      }
      if (!useV4 && extraFields.length > 0) {
        errors.push(`Binding: ${artifactName} must contain exactly the approved plan fields plus observational createdAt`);
      }
      for (const field of activeRequiredFields) {
        if (!(field in artifact)) errors.push(`Binding: ${artifactName} is missing required field ${field}`);
      }

      if (useV4) {
        // v4: plannedWritePaths are in runContext; selectedSubjects/excludedSubjects at top level
        if (!Array.isArray(artifact.selectedSubjects) || !Array.isArray(artifact.excludedSubjects)) {
          errors.push(`Binding: ${artifactName} subject fields must be arrays`);
        }
        if (isRecord(artifact.runContext) && !Array.isArray(artifact.runContext.plannedWritePaths)) {
          errors.push(`Binding: ${artifactName} runContext.plannedWritePaths must be an array`);
        }
      } else {
        if (!Array.isArray(artifact.selectedSubjects)
          || !Array.isArray(artifact.excludedSubjects)
          || !Array.isArray(artifact.plannedWritePaths)) {
          errors.push(`Binding: ${artifactName} subject and planned-write fields must be arrays`);
        }
      }
      if (!Array.isArray(artifact.checks) || artifact.checks.some(check =>
        !isRecord(check)
        || !sameSet(Object.keys(check), ['name', 'status', 'detail'])
        || typeof check.name !== 'string'
        || typeof check.status !== 'string'
        || !['pass', 'excluded-subject'].includes(check.status)
        || (check.detail !== null && typeof check.detail !== 'string')
      )) {
        errors.push(`Binding: ${artifactName} checks must contain full nonblocking {name,status,detail} records`);
      }
    }

    if (runPlan) {
      const recomputedPlanSha256 = computePlanDigest(planDigestInputs(runPlan));
      if (runPlan.planSha256 !== recomputedPlanSha256) {
        errors.push(`Binding: run-plan.json content recomputes to ${recomputedPlanSha256}, not ${runPlan.planSha256}`);
      }
      if (runPlan.planSha256 !== evidence.planSha256) {
        errors.push('Binding: run-plan.json planSha256 does not match evidence.planSha256');
      }
    }
    if (receipt) {
      const recomputedReceiptPlanSha256 = computePlanDigest(planDigestInputs(receipt));
      if (receipt.planSha256 !== recomputedReceiptPlanSha256) {
        errors.push(`Binding: preflight-receipt.json content recomputes to ${recomputedReceiptPlanSha256}, not ${receipt.planSha256}`);
      }
      if (receipt.planSha256 !== evidence.planSha256) {
        errors.push('Binding: preflight-receipt.json planSha256 does not match evidence.planSha256');
      }
    }
    if (runPlan && receipt && !sameValue(planDigestInputs(runPlan), planDigestInputs(receipt))) {
      errors.push('Binding: run-plan.json and preflight-receipt.json deterministic plan inputs differ');
    }

    if (runPlan) {
      if (runPlan.runId !== evidence.runId) {
        errors.push('Binding: run-plan.json runId does not match evidence.runId');
      }

      // v4 layout: runDirectoryPhysical is in runContext; legacy: at top level
      const planRunDirPhysical = isV4Layout(runPlan)
        ? runPlan.runContext?.runDirectoryPhysical
        : runPlan.runDirectoryPhysical;
      if (planRunDirPhysical !== physicalRunDir) {
        errors.push('Binding: physical run directory does not match the approved plan');
      }

      if (options.manifestPath) {
        if (isV4Layout(runPlan)) {
          // v4: manifestRepoRelPath is repo-relative; skip absolute path check
          if (typeof runPlan.manifestRepoRelPath !== 'string') {
            errors.push('Binding: run-plan.json manifestRepoRelPath must be a string');
          }
        } else {
          if (typeof runPlan.manifestPath !== 'string') {
            errors.push('Binding: run-plan.json manifestPath must be a string');
          } else if (path.resolve(runPlan.manifestPath) !== path.resolve(options.manifestPath)) {
            errors.push('Binding: run-plan.json manifestPath does not match --manifest');
          }
        }
      }
      if (runPlan.manifestHash !== evidence.manifestHash) {
        errors.push('Binding: run-plan.json manifestHash does not match evidence.manifestHash');
      }

      // Evidence schema hashes known to be backward-compatible predecessors of the current schema.
      // Schema 1.0.0 (v4) is a strict subset of 1.1.0 (v5s path-independent extension).
      const KNOWN_COMPATIBLE_EVIDENCE_SCHEMA_HASHES = new Set([
        'sha256:62fa2b034037b391be094564475f4d9f079a95fae78d602db0092c22a94128a1', // v1.0.0
      ]);

      if (isV4Layout(runPlan)) {
        // v4+: schema paths are repo-relative — verify hash or known-compatible predecessor
        const schemaBindingsV4 = [
          ['manifest schema', runPlan.manifestSchemaHash, DEFAULT_MANIFEST_SCHEMA_PATH, false],
          ['evidence schema', runPlan.evidenceSchemaHash, path.resolve(resolvedSchemaPath), true],
        ];
        for (const [label, declaredHash, expectedPath, allowCompatible] of schemaBindingsV4) {
          try {
            const schemaStat = fs.lstatSync(expectedPath);
            if (!schemaStat.isFile() || schemaStat.isSymbolicLink()) throw new Error(`${label} must be a non-symlink regular file`);
            const actualHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(expectedPath)).digest('hex')}`;
            if (declaredHash !== actualHash) {
              if (allowCompatible && KNOWN_COMPATIBLE_EVIDENCE_SCHEMA_HASHES.has(declaredHash)) {
                // Plan was authored against a known-compatible predecessor schema version
              } else {
                throw new Error(`${label} hash ${actualHash} does not match approved ${declaredHash}`);
              }
            }
          } catch (error) {
            errors.push(`Binding: ${error.message}`);
          }
        }
      } else {
        const schemaBindings = [
          ['manifest schema', runPlan.manifestSchemaPath, runPlan.manifestSchemaHash, DEFAULT_MANIFEST_SCHEMA_PATH],
          ['evidence schema', runPlan.evidenceSchemaPath, runPlan.evidenceSchemaHash, path.resolve(resolvedSchemaPath)],
        ];
        for (const [label, declaredPath, declaredHash, expectedPath] of schemaBindings) {
          try {
            if (typeof declaredPath !== 'string' || path.resolve(declaredPath) !== expectedPath) {
              throw new Error(`approved ${label} path does not match the canonical validator path`);
            }
            const schemaStat = fs.lstatSync(expectedPath);
            if (!schemaStat.isFile() || schemaStat.isSymbolicLink()) throw new Error(`${label} must be a non-symlink regular file`);
            const actualHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(expectedPath)).digest('hex')}`;
            if (declaredHash !== actualHash) throw new Error(`${label} hash ${actualHash} does not match approved ${declaredHash}`);
          } catch (error) {
            errors.push(`Binding: ${error.message}`);
          }
        }
      }

      if (!sameSet(runPlan.selectedSubjects ?? [], selectedSubjects)) {
        errors.push('Binding: run-plan selectedSubjects do not match evidence selectedSubjects');
      }
      if (!sameSet(runPlan.excludedSubjects ?? [], excludedSubjects)) {
        errors.push('Binding: run-plan excludedSubjects do not match evidence excludedSubjects');
      }
      if (runPlan.partialEvidence !== evidence.partialEvidence) {
        errors.push('Binding: run-plan partialEvidence does not match evidence.partialEvidence');
      }
      if (!sameValue(normalizePinnedCommits(runPlan.pinnedRepositoryCommits), normalizePinnedCommits(evidence.pinnedRepositoryCommits))) {
        errors.push('Binding: run-plan pinnedRepositoryCommits do not match evidence');
      }
      if (cbmSelected && !sameValue(runPlan.subjectBinaryIdentity?.cbm, cbmIdentity)) {
        errors.push('Binding: CBM binary identity does not match run-plan.json');
      }
      if (!sameValue(runPlan.networkIsolationProof, proof)) {
        errors.push('Binding: network isolation proof does not match run-plan.json');
      }
      if (selectedSubjects.includes('graphify') && runPlan.graphifyStatus?.status !== 'passed') {
        errors.push('Binding: selected Graphify subject requires graphifyStatus.status="passed"; blocked Graphify cannot support full evidence');
      }
      if (excludedSubjects.includes('graphify') && runPlan.graphifyStatus?.status !== 'excluded-subject') {
        errors.push('Binding: excluded Graphify subject requires graphifyStatus.status="excluded-subject"');
      }
      const expectedCbmVerification = cbmSelected ? {
        required: true,
        status: 'passed',
        binaryIdentity: runPlan.subjectBinaryIdentity?.cbm,
        networkIsolationProof: runPlan.networkIsolationProof,
      } : { required: false, status: 'not-required' };
      if (!sameValue(runPlan.cbmVerification, expectedCbmVerification)) {
        errors.push('Binding: run-plan CBM verification is inconsistent with selected subjects and bound proof');
      }

      // v4: plannedWritePaths in runContext; legacy: at top level
      const plannedWritePaths = isV4Layout(runPlan)
        ? (runPlan.runContext?.plannedWritePaths ?? null)
        : (runPlan.plannedWritePaths ?? null);
      if (Array.isArray(plannedWritePaths)) {
        const brainRoot = path.resolve(runDir, '..', '..', '..', '..');
        const benchmarkRoot = path.resolve(runDir, '..', '..', '..');
        const allowedAncestors = new Set([
          brainRoot,
          benchmarkRoot,
          path.join(benchmarkRoot, 'b8-1'),
          path.join(benchmarkRoot, 'b8-1', 'runs'),
        ]);
        for (const plannedPath of plannedWritePaths) {
          if (typeof plannedPath !== 'string') {
            errors.push('Binding: planned write paths must be strings');
            continue;
          }
          const resolvedPlannedPath = path.resolve(plannedPath);
          const relative = path.relative(runDir, resolvedPlannedPath);
          const isRunPath = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
          if (!isRunPath && !allowedAncestors.has(resolvedPlannedPath)) {
            errors.push(`Binding: planned write path is outside the bound run or its exact benchmark ancestors: ${plannedPath}`);
          }
        }
      }
    }

    if (typeof evidence.cleanupStatus?.runDirectory !== 'string' || path.resolve(evidence.cleanupStatus.runDirectory) !== runDir) {
      errors.push('Binding: cleanupStatus.runDirectory does not match --run-dir');
    }
    if (evidence.cleanupStatus?.removed !== false || 'removedAt' in (evidence.cleanupStatus ?? {})) {
      errors.push('Binding: evidence for an existing --run-dir must declare removed=false with no removedAt');
    }

    try {
      const cleanupManifest = JSON.parse(readRunArtifact(cleanupManifestPath, 'cleanup-manifest.json').toString('utf8'));
      if (!isRecord(cleanupManifest)
        || cleanupManifest.runId !== evidence.runId
        || typeof cleanupManifest.runDirectory !== 'string'
        || path.resolve(cleanupManifest.runDirectory) !== runDir
        || cleanupManifest.runDirectoryPhysical !== physicalRunDir) {
        errors.push('Binding: cleanup-manifest.json does not match evidence runId and --run-dir');
      }
    } catch (error) {
      errors.push(`Binding: cleanup-manifest.json missing or unparseable at ${cleanupManifestPath}: ${error.message}`);
    }

    try {
      const before = JSON.parse(readRunArtifact(sourceStateBeforePath, 'source-state-before.json').toString('utf8'));
      const after = JSON.parse(readRunArtifact(sourceStateAfterPath, 'source-state-after.json').toString('utf8'));
      if (!Array.isArray(before) || !Array.isArray(after)) {
        errors.push('Binding: source-state proof files must contain arrays');
      } else if (!sameValue(before, after)) {
        errors.push('Binding: source-state-before.json and source-state-after.json must be identical');
      } else {
        const hasLogicalIdentity = isV4Layout(runPlan) && isRecord(runPlan?.sourceLogicalIdentity);

        if (hasLogicalIdentity) {
          const logicalHash = hashCanonicalValue(runPlan.sourceLogicalIdentity);
          const approvedHash = runPlan.sourceStateHash?.replace(/^sha256:/, '');
          if (!approvedHash || logicalHash !== approvedHash) {
            errors.push('Binding: sourceLogicalIdentity hash does not match the approved sourceStateHash');
          }
          const logicalRepos = Array.isArray(runPlan.sourceLogicalIdentity.repositories)
            ? runPlan.sourceLogicalIdentity.repositories : [];
          const expectedCommits = new Map(logicalRepos.map(r => [r.repositoryId, r.pinnedCommit]));
          const sourceRepositoryIds = [];
          for (const state of before) {
            sourceRepositoryIds.push(state?.repositoryId);
            if (!isRecord(state)
              || typeof state.repositoryId !== 'string'
              || !expectedCommits.has(state.repositoryId)
              || state.HEAD !== expectedCommits.get(state.repositoryId)
              || state.pinnedCommit !== expectedCommits.get(state.repositoryId)
              || state.statusPorcelain !== ''
              || state.pinnedCommitAvailable !== true
              || state.statusSha256 !== crypto.createHash('sha256').update(state.statusPorcelain ?? '').digest('hex')) {
              errors.push(`Binding: source-state entry is not clean and pinned for ${state?.repositoryId ?? '<unknown>'}`);
            }
          }
          if (!sameSet(sourceRepositoryIds, [...expectedCommits.keys()])) errors.push('Binding: source-state entries must uniquely cover the exact pinned repository set');
        } else {
          const beforeHash = hashCanonicalValue(before);
          const approvedHash = runPlan?.sourceStateHash?.replace(/^sha256:/, '');
          if (!approvedHash || beforeHash !== approvedHash) {
            errors.push('Binding: source-state proof files do not match the approved sourceStateHash');
          }
          const expectedCommits = new Map(normalizePinnedCommits(runPlan?.pinnedRepositoryCommits).map(item => [item.repositoryId, item.commit]));
          const sourceRepositoryIds = [];
          for (const state of before) {
            sourceRepositoryIds.push(state?.repositoryId);
            if (!isRecord(state)
              || typeof state.repositoryId !== 'string'
              || !expectedCommits.has(state.repositoryId)
              || state.HEAD !== expectedCommits.get(state.repositoryId)
              || state.pinnedCommit !== expectedCommits.get(state.repositoryId)
              || state.statusPorcelain !== ''
              || state.pinnedCommitAvailable !== true
              || state.statusSha256 !== crypto.createHash('sha256').update(state.statusPorcelain ?? '').digest('hex')) {
              errors.push(`Binding: source-state entry is not clean and pinned for ${state?.repositoryId ?? '<unknown>'}`);
            }
          }
          if (!sameSet(sourceRepositoryIds, [...expectedCommits.keys()])) errors.push('Binding: source-state entries must uniquely cover the exact pinned repository set');
        }
      }
    } catch (error) {
      errors.push(`Binding: source-state proof missing or unparseable: ${error.message}`);
    }
  }

  // --- Semantic check E53: schema 2.1.0/3.x strict metric enforcement ---
  if (evidence.schemaVersion === '2.1.0' || evidence.schemaVersion === '3.0.0' || evidence.schemaVersion === '3.1.0') {
    const isV7MetricSchema = evidence.schemaVersion === '3.0.0' || evidence.schemaVersion === '3.1.0';
    // offlineMetrics must be absent
    if ('offlineMetrics' in evidence) {
      errors.push(`Semantic(E53): offlineMetrics must not be present when schemaVersion is "${evidence.schemaVersion}"`);
    }

    // subjectMetrics must be present with at least one entry
    const subjectMetrics = evidence.subjectMetrics;
    if (!subjectMetrics || typeof subjectMetrics !== 'object' || Array.isArray(subjectMetrics)) {
      errors.push(`Semantic(E53): subjectMetrics must be a non-empty object when schemaVersion is "${evidence.schemaVersion}"`);
    } else if (Object.keys(subjectMetrics).length === 0) {
      errors.push(`Semantic(E53): subjectMetrics must have at least one entry when schemaVersion is "${evidence.schemaVersion}"`);
    } else {
      // v7 binding: subjectMetrics keys must exactly equal selectedSubjects
      const metricSubjects = new Set(Object.keys(subjectMetrics));
      const selected = new Set(evidence.selectedSubjects ?? []);
      for (const subj of selected) {
        if (!metricSubjects.has(subj)) {
          errors.push(`Semantic(E53): subjectMetrics missing entry for selected subject "${subj}"`);
        }
      }
      for (const subj of metricSubjects) {
        if (!selected.has(subj)) {
          errors.push(`Semantic(E53): subjectMetrics contains entry for non-selected subject "${subj}"`);
        }
      }

      for (const [subjectId, metrics] of Object.entries(subjectMetrics)) {
        if (!isRecord(metrics)) {
          errors.push(`Semantic(E53): subjectMetrics.${subjectId} must be an object`);
          continue;
        }

        // v7 (3.x): peakCpuPercent and peakRssMb may be null (not measured) but must not be zero-fallback
        if (isV7MetricSchema) {
          const requiredNumericFields = ['serializedPayloadBytes', 'retrievalOperationCount'];
          for (const field of requiredNumericFields) {
            if (!(field in metrics)) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} is required`);
            } else if (typeof metrics[field] !== 'number') {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} must be numeric`);
            }
          }
          // CPU/RSS: must be numeric or null — zero is only valid if actually measured
          for (const field of ['peakCpuPercent', 'peakRssMb']) {
            if (!(field in metrics)) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} is required`);
            } else if (metrics[field] !== null && typeof metrics[field] !== 'number') {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} must be numeric or null`);
            }
          }
          // resourceProvenance required for schema 3.x
          if (!('resourceProvenance' in metrics) || !isRecord(metrics.resourceProvenance)) {
            errors.push(`Semantic(E53): subjectMetrics.${subjectId}.resourceProvenance is required for schema 3.x`);
          } else if (typeof metrics.resourceProvenance.method !== 'string' || metrics.resourceProvenance.method.length === 0) {
            errors.push(`Semantic(E53): subjectMetrics.${subjectId}.resourceProvenance.method must be a non-empty string`);
          }
        } else {
          // 2.1.0: original strict numeric enforcement
          const numericOnlyFields = ['peakCpuPercent', 'peakRssMb', 'serializedPayloadBytes', 'retrievalOperationCount'];
          for (const field of numericOnlyFields) {
            if (!(field in metrics)) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} is required`);
            } else if (typeof metrics[field] !== 'number') {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.${field} must be numeric (not-applicable is forbidden)`);
            }
          }
        }

        // tokenizer must be an object with name, version, tokenCount — no N/A
        if (!('tokenizer' in metrics)) {
          errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer is required`);
        } else {
          const tok = metrics.tokenizer;
          if (!isRecord(tok) || Array.isArray(tok)) {
            errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer must be an object (not-applicable is forbidden)`);
          } else {
            if (typeof tok.name !== 'string' || tok.name.length === 0) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer.name must be a non-empty string`);
            }
            if (typeof tok.version !== 'string' || tok.version.length === 0) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer.version must be a non-empty string`);
            }
            if (typeof tok.tokenCount !== 'number' || !Number.isInteger(tok.tokenCount) || tok.tokenCount < 0) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer.tokenCount must be a non-negative integer`);
            }
            // v7: reject false tokenizer identity
            if (isV7MetricSchema && tok.name === 'cl100k_base') {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.tokenizer.name "cl100k_base" is a false identity — use a truthful estimator name`);
            }
          }
        }

        // retrievalAccuracy must be present and contain callerCalleeF1 when caller/callee data exists
        if (!('retrievalAccuracy' in metrics)) {
          errors.push(`Semantic(E53): subjectMetrics.${subjectId}.retrievalAccuracy is required`);
        } else if (isV7MetricSchema && isRecord(metrics.retrievalAccuracy)) {
          const ra = metrics.retrievalAccuracy;
          if (ra.callerRecall !== undefined && ra.calleeRecall !== undefined) {
            if (!('callerCalleeF1' in ra)) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.retrievalAccuracy.callerCalleeF1 is required when callerRecall and calleeRecall are present`);
            }
          }
        }

        // repositoryMetrics must be present and bound to pinned repos
        if (!('repositoryMetrics' in metrics)) {
          errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics is required`);
        } else if (!isRecord(metrics.repositoryMetrics)) {
          errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics must be an object`);
        } else {
          // v7 binding: repositoryMetrics keys must equal pinned repository IDs
          if (isV7MetricSchema) {
            const pinnedRepoIds = new Set(Object.values(evidence.pinnedRepositoryCommits ?? {}).map(r => r.repositoryId));
            const repoMetricKeys = new Set(Object.keys(metrics.repositoryMetrics));
            for (const repoId of pinnedRepoIds) {
              if (!repoMetricKeys.has(repoId)) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics missing entry for pinned repo "${repoId}"`);
              }
            }
            for (const repoId of repoMetricKeys) {
              if (!pinnedRepoIds.has(repoId)) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics contains entry for non-pinned repo "${repoId}"`);
              }
            }
          }

          for (const [repoId, repoMetrics] of Object.entries(metrics.repositoryMetrics)) {
            if (!isRecord(repoMetrics)) {
              errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId} must be an object`);
              continue;
            }
            // indexDiskBytes: numeric for cbm, N/A object for exact-source in schema 3.x
            const idxVal = repoMetrics.indexDiskBytes;
            if (isV7MetricSchema) {
              if (idxVal === undefined || idxVal === null) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.indexDiskBytes is required`);
              } else if (typeof idxVal === 'number' && (idxVal < 0 || !Number.isInteger(idxVal))) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.indexDiskBytes must be a non-negative integer or N/A object`);
              } else if (typeof idxVal !== 'number' && !(isRecord(idxVal) && idxVal.status === 'not-applicable')) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.indexDiskBytes must be a non-negative integer or N/A object`);
              }
            } else {
              if (typeof idxVal !== 'number' || !Number.isInteger(idxVal) || idxVal < 0) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.indexDiskBytes must be a non-negative integer`);
              }
            }
            // Timing fields
            for (const timingField of ['initialIndexingTimeMs', 'incrementalRefreshLatencyMs']) {
              const val = repoMetrics[timingField];
              if (val === undefined || val === null) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.${timingField} is required`);
              } else if (subjectId !== 'exact-source' && typeof val !== 'number') {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.${timingField} must be numeric for subject "${subjectId}"`);
              }
            }
            if (evidence.schemaVersion === '3.1.0') {
              const refreshTarget = repoMetrics.refreshProbeTarget;
              if (subjectId === 'cbm') {
                const expectedTarget = selectRefreshProbeTarget(manifest, repoId);
                if (typeof refreshTarget !== 'string' || refreshTarget !== expectedTarget) {
                  errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.refreshProbeTarget must equal manifest-derived target "${expectedTarget}"`);
                }
              } else if (!(isRecord(refreshTarget) && refreshTarget.status === 'not-applicable')) {
                errors.push(`Semantic(E53): subjectMetrics.${subjectId}.repositoryMetrics.${repoId}.refreshProbeTarget must be a not-applicable object`);
              }
            }
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
