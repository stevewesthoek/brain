/**
 * Tests for B8.1 benchmark evidence validator.
 * Run: node --test tools/validate-b8-1-benchmark-evidence.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateEvidence } from './validate-b8-1-benchmark-evidence.mjs';
import { computePlanDigest } from './prepare-b8-1-context-memory-benchmark.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SCHEMA = path.join(root, 'operations/specs/b8-1-context-memory-benchmark-evidence.schema.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write evidence to a temp file and return its path.
 * The caller is responsible for cleanup (or use withTempEvidence).
 */
function writeTempEvidence(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-1-evidence-'));
  const filePath = path.join(dir, 'evidence.json');
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
  return { filePath, dir };
}

/** Build a minimal valid evidence object. */
function minimalEvidence(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    runId: 'b8-1-test-run-001',
    partialEvidence: true,
    selectedSubjects: ['cbm'],
    excludedSubjects: ['graphify', 'exact-source'],
    pinnedRepositoryCommits: {
      'brain-next': {
        repositoryId: 'stevewesthoek/brain-next',
        commit: 'a'.repeat(40)
      }
    },
    manifestHash: 'sha256:' + 'b'.repeat(64),
    preflightReceiptHash: 'sha256:' + 'c'.repeat(64),
    planSha256: 'f'.repeat(64),
    subjectBinaryIdentity: {
      cbm: {
        stablePath: '/synthetic/home/.local/bin/codebase-memory-mcp',
        resolvedPath: '/synthetic/home/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp',
        sha256: 'd'.repeat(64),
        version: '1.2.3'
      }
    },
    // Task 4: networkIsolationProof requires specific fields when CBM is selected
    networkIsolationProof: {
      required: true,
      status: 'passed',
      adapterIdentity: {
        path: '/usr/bin/sandbox-exec',
        sha256: 'a'.repeat(64)
      },
      profilePath: '/path/to/profile.sb',
      profileSha256: 'e'.repeat(64),
      controlSucceeded: true,
      sandboxedChildStarted: true,
      sandboxedConnectionDenied: true,
      selfTestPassed: true
    },
    fixtureResults: [
      {
        fixtureId: 'fix-001',
        subject: 'cbm',
        fileCorrect: true,
        lineCorrect: true
      }
    ],
    offlineMetrics: {
      fileAccuracy: 1.0,
      lineAccuracy: 1.0,
      setAccuracy: 1.0
    },
    violations: [],
    cleanupStatus: {
      runDirectory: '/tmp/b8-1-test-run-001',
      removed: true
    },
    ...overrides
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeBoundRun(selectedSubjects = ['exact-source']) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-1-bound-evidence-'));
  const runId = 'b8-1-bound-run-001';
  const runDir = path.join(tempRoot, runId);
  fs.mkdirSync(path.join(runDir, 'evidence'), { recursive: true });

  const commit = '1'.repeat(40);
  const manifest = {
    schemaVersion: '1.0.0',
    repositories: [{ repositoryId: 'repo', localPath: '/synthetic/repo', pinnedCommit: commit }],
    fixtures: [{ fixtureId: 'fixture-1', repositoryId: 'repo' }],
  };
  const manifestPath = path.join(tempRoot, 'manifest.json');
  writeJson(manifestPath, manifest);
  const manifestHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')}`;

  const excludedSubjects = ['cbm', 'graphify', 'exact-source'].filter(subject => !selectedSubjects.includes(subject));
  const cbmSelected = selectedSubjects.includes('cbm');
  const cbmTemplate = minimalEvidence();
  const subjectBinaryIdentity = cbmSelected ? cbmTemplate.subjectBinaryIdentity : {};
  const networkIsolationProof = cbmSelected
    ? cbmTemplate.networkIsolationProof
    : { required: false, status: 'not-required' };
  const fixtureResults = selectedSubjects.map(subject => ({
    fixtureId: 'fixture-1',
    subject,
    fileCorrect: true,
    lineCorrect: true,
  }));

  const planInputs = {
    schemaVersion: '1.0.0',
    runId,
    partialEvidence: excludedSubjects.length > 0,
    selectedSubjects: [...selectedSubjects].sort(),
    excludedSubjects: [...excludedSubjects].sort(),
    manifestPath,
    manifestHash,
    manifestSchemaPath: '/synthetic/manifest.schema.json',
    manifestSchemaHash: `sha256:${'2'.repeat(64)}`,
    evidenceSchemaPath: DEFAULT_SCHEMA,
    evidenceSchemaHash: `sha256:${'3'.repeat(64)}`,
    pinnedRepositoryCommits: [{ repositoryId: 'repo', commit }],
    subjectBinaryIdentity,
    networkIsolationProof,
    cbmVerification: cbmSelected ? {
      required: true,
      status: 'passed',
      binaryIdentity: subjectBinaryIdentity.cbm,
      networkIsolationProof,
    } : { required: false, status: 'not-required' },
    graphifyStatus: {
      status: excludedSubjects.includes('graphify') ? 'excluded-subject' : 'blocked',
      reason: 'bounded code-only invocation is not proven',
      profilePath: '/synthetic/graphify-profiles.json',
      profileSha256: '4'.repeat(64),
      governancePath: '/synthetic/graphify-governance.json',
      governanceSha256: '5'.repeat(64),
    },
    diskResult: { name: 'disk-budget', status: 'pass', detail: '4096 MB available' },
    plannedWritePaths: [path.join(runDir, 'evidence')],
    sourceStateHash: `sha256:${'6'.repeat(64)}`,
    checks: [{ name: 'manifest-validation', status: 'pass', detail: 'fixture manifest valid' }],
  };
  const planSha256 = computePlanDigest(planInputs);
  const artifact = { ...planInputs, planSha256, createdAt: '2026-08-03T10:00:00.000Z' };
  const runPlanPath = path.join(runDir, 'run-plan.json');
  const receiptPath = path.join(runDir, 'preflight-receipt.json');
  writeJson(runPlanPath, artifact);
  writeJson(receiptPath, artifact);
  const preflightReceiptHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(receiptPath)).digest('hex')}`;

  const evidence = minimalEvidence({
    runId,
    partialEvidence: excludedSubjects.length > 0,
    selectedSubjects,
    excludedSubjects,
    pinnedRepositoryCommits: { repo: { repositoryId: 'repo', commit } },
    manifestHash,
    preflightReceiptHash,
    planSha256,
    subjectBinaryIdentity,
    networkIsolationProof,
    fixtureResults,
    cleanupStatus: { runDirectory: runDir, removed: false },
  });
  const evidencePath = path.join(runDir, 'evidence', 'evidence.json');
  writeJson(evidencePath, evidence);
  return { tempRoot, runDir, manifestPath, runPlanPath, receiptPath, evidencePath, evidence, artifact };
}

// ---------------------------------------------------------------------------
// Test 1: Valid minimal evidence passes
// ---------------------------------------------------------------------------
test('valid minimal evidence passes', () => {
  const { filePath, dir } = writeTempEvidence(minimalEvidence());
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join('; ')}`);
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: Evidence with optionalModelMediatedMetrics is rejected
// ---------------------------------------------------------------------------
test('evidence with optionalModelMediatedMetrics is rejected', () => {
  const evidence = minimalEvidence({
    optionalModelMediatedMetrics: {
      modelInputTokens: 1000,
      modelOutputTokens: 200,
      modelName: 'claude-3-sonnet',
      timeToAnswerMs: 4500
    }
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when optionalModelMediatedMetrics is present');
    assert.ok(
      result.errors.some((e) => /optionalModelMediatedMetrics/.test(e)),
      `Expected error mentioning optionalModelMediatedMetrics; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: Evidence with modelInputTokens inside offlineMetrics is rejected
// (additionalProperties: false on offlineMetrics)
// ---------------------------------------------------------------------------
test('evidence with modelInputTokens inside offlineMetrics is rejected', () => {
  const evidence = minimalEvidence();
  evidence.offlineMetrics.modelInputTokens = 5000;
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when modelInputTokens is in offlineMetrics');
    assert.ok(
      result.errors.some((e) => /additional propert|additionalPropert|modelInputTokens/i.test(e)),
      `Expected additionalProperties error; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: Missing required fields are rejected
// ---------------------------------------------------------------------------
test('missing required fields are rejected', () => {
  const evidence = minimalEvidence();
  delete evidence.cleanupStatus;
  delete evidence.manifestHash;
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when required fields are missing');
    assert.ok(
      result.errors.length >= 2,
      `Expected at least 2 errors for 2 missing fields; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('non-object evidence root fails closed without throwing', () => {
  const { filePath, dir } = writeTempEvidence(null);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /evidence root must be a JSON object/.test(error)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: Invalid runId pattern is rejected
// ---------------------------------------------------------------------------
test('invalid runId pattern is rejected', () => {
  const evidence = minimalEvidence({ runId: 'not-a-valid-run-id' });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when runId does not match pattern');
    assert.ok(
      result.errors.some((e) => /runId|pattern/i.test(e)),
      `Expected runId pattern error; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: Overlapping selected/excluded subjects rejected
// ---------------------------------------------------------------------------
test('overlapping selectedSubjects and excludedSubjects are rejected', () => {
  const evidence = minimalEvidence({
    selectedSubjects: ['cbm', 'graphify'],
    excludedSubjects: ['graphify']
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when subjects overlap');
    assert.ok(
      result.errors.some((e) => /overlap|both selected|graphify/i.test(e)),
      `Expected overlap error; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: networkIsolationProof.selfTestPassed=false is rejected
// ---------------------------------------------------------------------------
test('networkIsolationProof.selfTestPassed=false is rejected', () => {
  const evidence = minimalEvidence({
    networkIsolationProof: {
      adapter: 'pf',
      selfTestPassed: false,
      profilePath: '/etc/pf.conf',
      selfTestDetail: 'DNS resolution succeeded (isolation failure)'
    }
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when selfTestPassed is false');
    assert.ok(
      result.errors.some((e) => /selfTestPassed/i.test(e)),
      `Expected selfTestPassed error; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: Valid comprehensive evidence passes
// ---------------------------------------------------------------------------
test('valid comprehensive evidence passes', () => {
  const evidence = minimalEvidence({
    runAt: '2026-08-03T10:00:00.000Z',
    partialEvidence: false,
    selectedSubjects: ['cbm', 'graphify', 'exact-source'],
    excludedSubjects: [],
    pinnedRepositoryCommits: {
      'brain-next': {
        repositoryId: 'stevewesthoek/brain-next',
        commit: '1234567890abcdef1234567890abcdef12345678'
      },
      mind: {
        repositoryId: 'stevewesthoek/mind',
        commit: 'abcdef1234567890abcdef1234567890abcdef12'
      }
    },
    subjectBinaryIdentity: {
      cbm: {
        stablePath: '/synthetic/home/.local/bin/codebase-memory-mcp',
        resolvedPath: '/synthetic/home/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp',
        sha256: 'e'.repeat(64),
        version: '2.0.0'
      },
      graphify: {
        version: '1.5.0'
      }
    },
    // Task 4: networkIsolationProof with new schema when CBM selected
    networkIsolationProof: {
      required: true,
      status: 'passed',
      adapterIdentity: {
        path: '/usr/bin/sandbox-exec',
        sha256: 'a'.repeat(64)
      },
      profilePath: '/path/to/profile.sb',
      profileSha256: 'f'.repeat(64),
      controlSucceeded: true,
      sandboxedChildStarted: true,
      sandboxedConnectionDenied: true,
      selfTestPassed: true,
      selfTestDetail: 'All outbound connections blocked; loopback access denied with EPERM'
    },
    fixtureResults: [
      {
        fixtureId: 'fix-001',
        subject: 'cbm',
        fileCorrect: true,
        lineCorrect: true,
        callerPrecision: 0.95,
        callerRecall: 0.90,
        calleePrecision: 0.88,
        calleeRecall: 0.92,
        setAccuracy: 0.93
      },
      {
        fixtureId: 'fix-002',
        subject: 'graphify',
        fileCorrect: true,
        lineCorrect: false,
        callerPrecision: 1.0,
        callerRecall: 1.0,
        setAccuracy: 0.75
      },
      {
        fixtureId: 'fix-003',
        subject: 'exact-source',
        fileCorrect: true,
        lineCorrect: true
      }
    ],
    offlineMetrics: {
      serializedPayloadBytes: 204800,
      pinnedTokenizerEstimate: 51200,
      tokenizerName: 'cl100k_base',
      tokenizerVersion: '1.0.0',
      indexingDurationMs: 3200,
      refreshDurationMs: 800,
      peakCpuPercent: 42.5,
      peakMemoryMb: 512.0,
      diskUsageMb: 128.0,
      retrievalOperationCount: 150,
      fileAccuracy: 1.0,
      lineAccuracy: 0.667,
      setAccuracy: 0.847
    },
    violations: [],
    cleanupStatus: {
      runDirectory: '/tmp/b8-1-comprehensive-test',
      removed: true,
      removedAt: '2026-08-03T10:05:00.000Z'
    }
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join('; ')}`);
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: Evidence without cleanupStatus fails schema
// ---------------------------------------------------------------------------
test('evidence without cleanupStatus fails schema', () => {
  const evidence = minimalEvidence();
  delete evidence.cleanupStatus;
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false, 'Expected invalid when cleanupStatus is absent');
    assert.ok(
      result.errors.some((e) => /cleanupStatus/i.test(e)),
      `Expected cleanupStatus error; got: ${result.errors.join('; ')}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: Violations array can be non-empty and still pass schema
// (violations are recorded facts, not schema failures)
// ---------------------------------------------------------------------------
test('non-empty violations array passes schema validation', () => {
  const evidence = minimalEvidence({
    violations: [
      {
        reason: 'indexing_timeout',
        detail: 'CBM indexing exceeded 30s timeout threshold',
        timestamp: '2026-08-03T10:02:30.000Z'
      },
      {
        reason: 'disk_usage_exceeded',
        detail: 'Peak disk usage 1.2GB exceeded 1GB budget'
      }
    ]
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, true, `Expected valid with non-empty violations; got errors: ${result.errors.join('; ')}`);
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('exact-source-only evidence accepts exact not-required network proof', () => {
  const evidence = minimalEvidence({
    partialEvidence: true,
    selectedSubjects: ['exact-source'],
    excludedSubjects: ['cbm', 'graphify'],
    subjectBinaryIdentity: {},
    networkIsolationProof: { required: false, status: 'not-required' },
    fixtureResults: [{ fixtureId: 'fix-001', subject: 'exact-source', fileCorrect: true, lineCorrect: true }],
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, true, result.errors.join('; '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CBM exclusion rejects adapter and self-test data', () => {
  const evidence = minimalEvidence({
    partialEvidence: true,
    selectedSubjects: ['exact-source'],
    excludedSubjects: ['cbm', 'graphify'],
    subjectBinaryIdentity: {},
    networkIsolationProof: {
      required: false,
      status: 'not-required',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: 'a'.repeat(64) },
      selfTestPassed: true,
    },
    fixtureResults: [{ fixtureId: 'fix-001', subject: 'exact-source', fileCorrect: true, lineCorrect: true }],
  });
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /exactly.*not-required|additional propert/i.test(error)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CBM evidence requires full binary identity and complete isolation proof', () => {
  const evidence = minimalEvidence();
  delete evidence.subjectBinaryIdentity.cbm.resolvedPath;
  evidence.networkIsolationProof.sandboxedChildStarted = false;
  const { filePath, dir } = writeTempEvidence(evidence);
  try {
    const result = validateEvidence(filePath, DEFAULT_SCHEMA);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /resolvedPath|complete passed proof/i.test(error)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('valid evidence binds to manifest, run plan, and receipt bytes', () => {
  const bound = makeBoundRun();
  try {
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, true, result.errors.join('; '));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('run directory basename mismatch fails binding', () => {
  const bound = makeBoundRun();
  try {
    bound.evidence.runId = 'b8-1-different-run';
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /basename/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('run-plan runId mismatch fails even when artifact digests are internally consistent', () => {
  const bound = makeBoundRun();
  try {
    const changedRunId = 'b8-1-altered-plan-run';
    const artifacts = [];
    for (const artifactPath of [bound.runPlanPath, bound.receiptPath]) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      artifact.runId = changedRunId;
      const { planSha256: _oldDigest, createdAt: _createdAt, ...digestInputs } = artifact;
      artifact.planSha256 = computePlanDigest(digestInputs);
      writeJson(artifactPath, artifact);
      artifacts.push(artifact);
    }
    bound.evidence.planSha256 = artifacts[0].planSha256;
    bound.evidence.preflightReceiptHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(bound.receiptPath)).digest('hex')}`;
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /run-plan\.json runId/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('actual manifest SHA-256 mismatch fails binding', () => {
  const bound = makeBoundRun();
  try {
    const manifest = JSON.parse(fs.readFileSync(bound.manifestPath, 'utf8'));
    manifest.note = 'changed bytes';
    writeJson(bound.manifestPath, manifest);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /actual manifest SHA-256/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('actual preflight receipt SHA-256 mismatch fails binding', () => {
  const bound = makeBoundRun();
  try {
    fs.appendFileSync(bound.receiptPath, '\n');
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /actual preflight-receipt.*SHA-256/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('run-plan content mismatch fails digest binding', () => {
  const bound = makeBoundRun();
  try {
    const runPlan = JSON.parse(fs.readFileSync(bound.runPlanPath, 'utf8'));
    runPlan.diskResult.detail = 'different disk result';
    writeJson(bound.runPlanPath, runPlan);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /recomputes to/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('malformed run artifacts fail closed instead of throwing', () => {
  const bound = makeBoundRun();
  try {
    fs.writeFileSync(bound.runPlanPath, 'null');
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /run-plan\.json must contain a JSON object/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('receipt and plan deterministic inputs must match', () => {
  const bound = makeBoundRun();
  try {
    const receipt = JSON.parse(fs.readFileSync(bound.receiptPath, 'utf8'));
    receipt.graphifyStatus.reason = 'different reason';
    writeJson(bound.receiptPath, receipt);
    bound.evidence.preflightReceiptHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(bound.receiptPath)).digest('hex')}`;
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /deterministic plan inputs differ/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('pinned commit mismatch fails manifest binding', () => {
  const bound = makeBoundRun();
  try {
    bound.evidence.pinnedRepositoryCommits.repo.commit = '9'.repeat(40);
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /pinnedRepositoryCommits/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('selected and excluded subject mismatch fails run binding', () => {
  const bound = makeBoundRun();
  try {
    bound.evidence.selectedSubjects = ['graphify'];
    bound.evidence.excludedSubjects = ['cbm', 'exact-source'];
    bound.evidence.partialEvidence = true;
    bound.evidence.fixtureResults = [{ fixtureId: 'fixture-1', subject: 'graphify', fileCorrect: true, lineCorrect: true }];
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /selectedSubjects do not match|excludedSubjects do not match/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('missing fixture result for selected subject fails', () => {
  const bound = makeBoundRun();
  try {
    bound.evidence.fixtureResults = [];
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /missing fixtureResult/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('fixture result for excluded subject fails', () => {
  const bound = makeBoundRun();
  try {
    bound.evidence.fixtureResults.push({ fixtureId: 'fixture-1', subject: 'cbm', fileCorrect: true, lineCorrect: true });
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /excluded subject/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('CBM identity and isolation proof must match the approved run plan', () => {
  const bound = makeBoundRun(['cbm', 'exact-source']);
  try {
    bound.evidence.networkIsolationProof.profileSha256 = '7'.repeat(64);
    writeJson(bound.evidencePath, bound.evidence);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /network isolation proof does not match/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('blocked Graphify can never support full selected-subject evidence', () => {
  const bound = makeBoundRun(['graphify', 'exact-source']);
  try {
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, { manifestPath: bound.manifestPath, runDir: bound.runDir });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /selected Graphify subject requires/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});

test('non-string run-plan manifestPath fails closed instead of throwing', () => {
  const bound = makeBoundRun(['exact-source']);
  try {
    const malformed = { ...bound.artifact, manifestPath: 42 };
    malformed.planSha256 = computePlanDigest((({ planSha256, createdAt, ...inputs }) => inputs)(malformed));
    writeJson(bound.runPlanPath, malformed);
    const result = validateEvidence(bound.evidencePath, DEFAULT_SCHEMA, {
      manifestPath: bound.manifestPath,
      runDir: bound.runDir,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /manifestPath must be a string/.test(error)));
  } finally {
    fs.rmSync(bound.tempRoot, { recursive: true, force: true });
  }
});
