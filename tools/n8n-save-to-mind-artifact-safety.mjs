#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { SECRET_SURFACE_POLICY } from '../operations/specs/infinite-brain-boundary-contracts.js';

export const APPROVED_ARTIFACT = 'operations/reports/artifacts/b1-0a-live-workflow-rollback.json';
export const APPROVED_SHA256 = '703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd';
export const APPROVED_WORKFLOW_ID = 'FwP5INe9qoo1OwGC';
export const MAX_ARTIFACT_BYTES = 128 * 1024;
export const APPROVED_REPORT_ARTIFACT_DIRECTORY = 'operations/reports/artifacts';
export const PROHIBITED_OUTPUT_PATH_PREFIXES = [
  '.env',
  'operations/system-configs',
  'operations/infrastructure',
  'operations/automations/n8n/n8n_backup',
  'runtime',
];

const CREDENTIAL_KEY = SECRET_SURFACE_POLICY.keyPattern;
const CREDENTIAL_VALUE = SECRET_SURFACE_POLICY.valuePattern;

function countCredentialLikeSurface(value) {
  if (typeof value === 'string') return CREDENTIAL_VALUE.test(value) ? 1 : 0;
  if (!value || typeof value !== 'object') return 0;

  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    if (CREDENTIAL_KEY.test(key)) count += 1;
    count += countCredentialLikeSurface(child);
  }
  return count;
}

export function assertApprovedReportArtifactPath(outputRelativePath) {
  const normalized = outputRelativePath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    PROHIBITED_OUTPUT_PATH_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  ) {
    throw new Error('prohibited_output_path');
  }
  if (
    normalized === APPROVED_REPORT_ARTIFACT_DIRECTORY ||
    !normalized.startsWith(`${APPROVED_REPORT_ARTIFACT_DIRECTORY}/`)
  ) {
    throw new Error('output_path_not_an_approved_report_artifact');
  }
  return normalized;
}

export function auditRollbackArtifact({
  repoRoot = process.cwd(),
  artifactRelativePath = APPROVED_ARTIFACT,
  approvedArtifact = APPROVED_ARTIFACT,
  approvedSha256 = APPROVED_SHA256,
  approvedWorkflowId = APPROVED_WORKFLOW_ID,
  enforceApprovedOutputPath = true,
} = {}) {
  const artifactPath = resolve(repoRoot, artifactRelativePath);
  const approvedPath = resolve(repoRoot, approvedArtifact);
  if (artifactPath !== approvedPath) throw new Error('artifact_path_not_approved');
  if (enforceApprovedOutputPath) assertApprovedReportArtifactPath(approvedArtifact);

  const stat = statSync(artifactPath);
  if (!stat.isFile()) throw new Error('artifact_not_a_regular_file');
  if (stat.size > MAX_ARTIFACT_BYTES) throw new Error('artifact_size_exceeds_limit');

  const bytes = readFileSync(artifactPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== approvedSha256) throw new Error('artifact_hash_mismatch');

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('artifact_json_invalid');
  }

  if (artifact?.id !== approvedWorkflowId) throw new Error('artifact_workflow_id_mismatch');

  const credentialLikeSurfaceFindings = countCredentialLikeSurface(artifact);
  if (credentialLikeSurfaceFindings !== 0) throw new Error('artifact_credential_surface_detected');

  return {
    artifact: 'approved_b1_0a_rollback',
    bytes: stat.size,
    sha256,
    workflowId: approvedWorkflowId,
    jsonValid: true,
    credentialLikeSurfaceFindings,
    rawArtifactEmitted: false,
  };
}

function main() {
  if (process.argv.length !== 2) throw new Error('arguments_not_allowed');
  const result = auditRollbackArtifact();
  process.stdout.write([
    `artifact=${result.artifact}`,
    `bytes=${result.bytes}`,
    `sha256=${result.sha256}`,
    `workflow_id=${result.workflowId}`,
    `json_valid=${result.jsonValid}`,
    `credential_like_surface_findings=${result.credentialLikeSurfaceFindings}`,
    `raw_artifact_emitted=${result.rawArtifactEmitted}`,
    'result=pass',
  ].join('\n') + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`result=fail\nreason=${error.message}\n`);
    process.exitCode = 1;
  }
}
