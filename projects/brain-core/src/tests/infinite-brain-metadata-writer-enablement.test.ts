/**
 * Infinite Brain Metadata Writer Enablement Gate Tests
 * Tests for recording operator intent (dry-run vs disabled vs future-enabled)
 * Safety: All writes remain false, no real writes to Mind
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  generateMetadataWriterEnablementRecord,
  writeMetadataWriterEnablementRecord,
  readMetadataWriterEnablementRecord,
  readMetadataWriterEnablementSummary,
  type MetadataWriterEnablementRecord,
  type MetadataWriterEnablementDecision,
} from '../adapters/infinite-brain-metadata-writer-enablement.js';

test('Missing enablement record returns available: false', () => {
  const summary = readMetadataWriterEnablementSummary();
  assert.equal(summary.available, false, 'should not be available without record');
});

test('Generated enablement record for "disabled" decision has writeEnabled: false', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test-operator-1',
    decision: 'disabled',
    reason: 'Testing disabled gate',
  });

  assert.equal(record.writeEnabled, false, 'writeEnabled must be false');
  assert.equal(record.canWrite, false, 'canWrite must be false');
  assert.equal(record.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(record.executionEnabled, false, 'executionEnabled must be false');
  assert.equal(record.decision, 'disabled', 'decision should be disabled');
  assert.equal(record.scope, 'metadata-writer-enablement', 'scope should match');
});

test('Generated enablement record for "dry-run-only" has all write flags false', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test-operator-2',
    decision: 'dry-run-only',
    reason: 'Testing dry-run gate',
  });

  assert.equal(record.writeEnabled, false, 'writeEnabled must be false');
  assert.equal(record.canWrite, false, 'canWrite must be false');
  assert.equal(record.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(record.executionEnabled, false, 'executionEnabled must be false');
  assert.equal(record.decision, 'dry-run-only', 'decision should be dry-run-only');
});

test('Generated enablement record for "future-enabled-requested" still has writeEnabled: false', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test-operator-3',
    decision: 'future-enabled-requested',
    reason: 'Planning ahead',
  });

  assert.equal(record.writeEnabled, false, 'writeEnabled must be false (future is still disabled)');
  assert.equal(record.canWrite, false, 'canWrite must be false');
  assert.equal(record.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(record.executionEnabled, false, 'executionEnabled must be false');
  assert.equal(record.decision, 'future-enabled-requested', 'decision should be future-enabled-requested');
});

test('Enablement record includes deterministic enablementId', () => {
  const record1 = generateMetadataWriterEnablementRecord({
    operator: 'alice',
    decision: 'dry-run-only',
    reason: 'Same test',
  });

  const record2 = generateMetadataWriterEnablementRecord({
    operator: 'alice',
    decision: 'dry-run-only',
    reason: 'Same test',
  });

  assert.equal(record1.enablementId, record2.enablementId, 'enablementId should be deterministic');
  assert(record1.enablementId.startsWith('enbl-'), 'enablementId should start with enbl-');
});

test('Enablement record different for different operators or decisions', () => {
  const record1 = generateMetadataWriterEnablementRecord({
    operator: 'alice',
    decision: 'disabled',
    reason: 'Test',
  });

  const record2 = generateMetadataWriterEnablementRecord({
    operator: 'bob',
    decision: 'disabled',
    reason: 'Test',
  });

  assert.notEqual(record1.enablementId, record2.enablementId, 'different operators should generate different IDs');
});

test('Enablement record for dry-run-only includes required next gates', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test',
    decision: 'dry-run-only',
    reason: 'Test gates',
  });

  assert(Array.isArray(record.requiredNextGates), 'requiredNextGates should be array');
  assert(record.requiredNextGates.length > 0, 'dry-run-only should have required gates');
  assert(
    record.requiredNextGates.includes('iosSyncSafetyVerification'),
    'should include iosSyncSafetyVerification'
  );
  assert(
    record.requiredNextGates.includes('allowlistedWriterDeployment'),
    'should include allowlistedWriterDeployment'
  );
});

test('Enablement record for disabled has no required gates', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test',
    decision: 'disabled',
    reason: 'Test disabled',
  });

  assert.deepEqual(record.requiredNextGates, [], 'disabled should have no required gates');
});

test('Written and read enablement record match', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibr-enablement-'));
  const recordPath = path.join(tempDir, 'metadata-writer-enablement-test.json');

  try {
    process.env.IBR_METADATA_WRITER_ENABLEMENT_PATH = recordPath;

    const original = generateMetadataWriterEnablementRecord({
      operator: 'test-operator',
      decision: 'dry-run-only',
      reason: 'Write and read test',
    });

    const writeSuccess = writeMetadataWriterEnablementRecord(original);
    assert.equal(writeSuccess, true, 'write should succeed');

    const read = readMetadataWriterEnablementRecord();
    assert.equal(read?.enablementId, original.enablementId, 'enablementId should match');
    assert.equal(read?.operator, original.operator, 'operator should match');
    assert.equal(read?.decision, original.decision, 'decision should match');
    assert.equal(read?.writeEnabled, false, 'writeEnabled should still be false');
  } finally {
    delete process.env.IBR_METADATA_WRITER_ENABLEMENT_PATH;
    fs.rmSync(tempDir, { recursive: true });
  }
});

test('Safety block has all write fields false', () => {
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test',
    decision: 'dry-run-only',
    reason: 'Safety block test',
  });

  assert.equal(record.safety.writesToMind, false, 'writesToMind must be false');
  assert.equal(record.safety.modifiesMind, false, 'modifiesMind must be false');
  assert.equal(record.safety.appliesProposals, false, 'appliesProposals must be false');
  assert.equal(record.safety.canWrite, false, 'canWrite must be false');
  assert.equal(record.safety.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(record.safety.writeEnabled, false, 'writeEnabled must be false');
  assert.equal(record.safety.executionEnabled, false, 'executionEnabled must be false');
  assert.equal(record.safety.enablementRecordOnly, true, 'enablementRecordOnly must be true');
  assert.equal(record.safety.continuousRuntime, false, 'continuousRuntime must be false');
  assert.equal(record.safety.modelCalls, false, 'modelCalls must be false');
  assert.equal(record.safety.usesShell, false, 'usesShell must be false');
});

test('Summary reflects writeEnabled: false when record exists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibr-enablement-'));
  const recordPath = path.join(tempDir, 'metadata-writer-enablement-summary-test.json');

  try {
    process.env.IBR_METADATA_WRITER_ENABLEMENT_PATH = recordPath;

    const record = generateMetadataWriterEnablementRecord({
      operator: 'summary-test',
      decision: 'dry-run-only',
      reason: 'Summary test',
    });

    writeMetadataWriterEnablementRecord(record);

    const summary = readMetadataWriterEnablementSummary();

    assert.equal(summary.available, true, 'should be available');
    assert.equal(summary.writeEnabled, false, 'summary writeEnabled must be false');
    assert.equal(summary.canWrite, false, 'summary canWrite must be false');
    assert.equal(summary.canWriteToMind, false, 'summary canWriteToMind must be false');
    assert.equal(summary.executionEnabled, false, 'summary executionEnabled must be false');
    assert.equal(summary.decision, 'dry-run-only', 'summary decision should match');
  } finally {
    delete process.env.IBR_METADATA_WRITER_ENABLEMENT_PATH;
    fs.rmSync(tempDir, { recursive: true });
  }
});

test('Enablement record has generatedAt timestamp', () => {
  const before = new Date().toISOString();
  const record = generateMetadataWriterEnablementRecord({
    operator: 'test',
    decision: 'disabled',
    reason: 'Timestamp test',
  });
  const after = new Date().toISOString();

  assert(record.generatedAt >= before && record.generatedAt <= after, 'generatedAt should be current time');
});
