import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  APPROVED_ARTIFACT,
  APPROVED_SHA256,
  APPROVED_WORKFLOW_ID,
  MAX_ARTIFACT_BYTES,
  assertApprovedReportArtifactPath,
  auditRollbackArtifact,
} from './n8n-save-to-mind-artifact-safety.mjs';

function withFixture(value, run) {
  const root = mkdtempSync(join(tmpdir(), 'bs0-4-artifact-'));
  const relativePath = 'fixture.json';
  const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  writeFileSync(join(root, relativePath), bytes);
  try {
    return run({
      repoRoot: root,
      artifactRelativePath: relativePath,
      approvedArtifact: relativePath,
      approvedSha256: createHash('sha256').update(bytes).digest('hex'),
      approvedWorkflowId: APPROVED_WORKFLOW_ID,
      enforceApprovedOutputPath: false,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('approved B1.0a rollback artifact is integrity checked without raw output', () => {
  const result = auditRollbackArtifact();
  assert.equal(result.artifact, 'approved_b1_0a_rollback');
  assert.equal(result.sha256, APPROVED_SHA256);
  assert.equal(result.workflowId, APPROVED_WORKFLOW_ID);
  assert.equal(result.jsonValid, true);
  assert.equal(result.credentialLikeSurfaceFindings, 0);
  assert.equal(result.rawArtifactEmitted, false);
});

test('an unapproved artifact path is rejected before it is inspected', () => {
  assert.throws(
    () => auditRollbackArtifact({ artifactRelativePath: 'operations/automations/n8n/workflows/mind-inbox-fixed.json' }),
    /artifact_path_not_approved/,
  );
});

test('hash, JSON, workflow identity, and credential-like surfaces fail closed', () => {
  const base = { id: APPROVED_WORKFLOW_ID, nodes: [] };

  withFixture(base, (options) => {
    assert.throws(
      () => auditRollbackArtifact({ ...options, approvedSha256: '0'.repeat(64) }),
      /artifact_hash_mismatch/,
    );
  });
  withFixture('{', (options) => {
    assert.throws(() => auditRollbackArtifact(options), /artifact_json_invalid/);
  });
  withFixture({ ...base, id: 'different' }, (options) => {
    assert.throws(
      () => auditRollbackArtifact({ ...options, approvedWorkflowId: APPROVED_WORKFLOW_ID }),
      /artifact_workflow_id_mismatch/,
    );
  });
  withFixture({ ...base, credential: 'test-only-value' }, (options) => {
    assert.throws(() => auditRollbackArtifact(options), /artifact_credential_surface_detected/);
  });
  withFixture({ ...base, note: 'Bearer synthetic-token-value-123456' }, (options) => {
    assert.throws(() => auditRollbackArtifact(options), /artifact_credential_surface_detected/);
  });
  withFixture({ ...base, note: 'TOKEN=synthetic-value-123456' }, (options) => {
    assert.throws(() => auditRollbackArtifact(options), /artifact_credential_surface_detected/);
  });
});

test('oversized artifacts and prohibited output locations fail closed', () => {
  withFixture({ id: APPROVED_WORKFLOW_ID, padding: 'x'.repeat(MAX_ARTIFACT_BYTES) }, (options) => {
    assert.throws(() => auditRollbackArtifact(options), /artifact_size_exceeds_limit/);
  });

  assert.equal(
    assertApprovedReportArtifactPath('operations/reports/artifacts/approved.json'),
    'operations/reports/artifacts/approved.json',
  );
  for (const outputPath of [
    '.env/report.json',
    'operations/system-configs/report.json',
    'operations/infrastructure/report.json',
    'operations/automations/n8n/n8n_backup/report.json',
    'runtime/report.json',
    'operations/reports/report.json',
  ]) {
    assert.throws(() => assertApprovedReportArtifactPath(outputPath));
  }
});

test('CLI accepts no artifact input and emits safe metadata only', () => {
  const success = spawnSync(process.execPath, ['tools/n8n-save-to-mind-artifact-safety.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(success.status, 0);
  assert.match(success.stdout, /raw_artifact_emitted=false/);
  assert.match(success.stdout, /credential_like_surface_findings=0/);
  assert.doesNotMatch(success.stdout, /"nodes"|"connections"/);

  const rejected = spawnSync(process.execPath, ['tools/n8n-save-to-mind-artifact-safety.mjs', APPROVED_ARTIFACT], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /arguments_not_allowed/);
});

test('the repository n8n backup-export wrapper remains statically read-only and bounded', () => {
  const source = readFileSync('tools/scripts/backup-n8n.sh', 'utf8');
  assert.match(source, /timeout/i);
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/);
});
