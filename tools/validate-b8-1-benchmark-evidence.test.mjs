/**
 * Tests for B8.1 benchmark evidence validator.
 * Run: node --test tools/validate-b8-1-benchmark-evidence.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateEvidence } from './validate-b8-1-benchmark-evidence.mjs';

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
    selectedSubjects: ['cbm'],
    excludedSubjects: [],
    pinnedRepositoryCommits: {
      'brain-next': {
        repositoryId: 'stevewesthoek/brain-next',
        commit: 'a'.repeat(40)
      }
    },
    manifestHash: 'sha256:' + 'b'.repeat(64),
    preflightReceiptHash: 'sha256:' + 'c'.repeat(64),
    subjectBinaryIdentity: {
      cbm: {
        sha256: 'd'.repeat(64),
        version: '1.2.3'
      }
    },
    // Task 4: networkIsolationProof requires specific fields when CBM is selected
    networkIsolationProof: {
      status: 'passed',
      adapter: 'sandbox-exec',
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
        sha256: 'e'.repeat(64),
        version: '2.0.0'
      },
      graphify: {
        version: '1.5.0'
      }
    },
    // Task 4: networkIsolationProof with new schema when CBM selected
    networkIsolationProof: {
      status: 'passed',
      adapter: 'sandbox-exec',
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
