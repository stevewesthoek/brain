/**
 * Narrow Apply-one writer for enriched video evidence.
 *
 * Preview generation is safe and writes only Brain runtime audit material.
 * Applying requires a concrete, single-use approval matching the preview and a
 * second confirmation token. The writer never moves/deletes the original
 * capture and never accepts an arbitrary Mind path.
 */
import crypto from 'node:crypto';
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VideoAnalysisResult } from '../video-analysis-types.js';
import { MIND_TARGET_PATHS } from '../../mind-paths.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const BRAIN_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PREVIEW_ROOT = path.resolve(
  process.env.BRAIN_VIDEO_ANALYSIS_PREVIEW_ROOT ?? path.join(PACKAGE_ROOT, 'runtime', 'local', 'brain-core', 'video-analysis', 'previews'),
);
const RECEIPT_ROOT = path.resolve(
  process.env.BRAIN_VIDEO_ANALYSIS_RECEIPT_ROOT ?? path.join(PACKAGE_ROOT, 'runtime', 'local', 'brain-core', 'video-analysis', 'receipts'),
);

export interface VideoAnalysisApplyOnePreview {
  schema_version: '1.0.0';
  kind: 'video-analysis-apply-one-preview';
  preview_id: string;
  proposal_id: string;
  idempotency_key: string;
  generated_at: string;
  source_commit: string;
  job_id: string;
  target_relative_path: string;
  target_path: string;
  expected_before_hash: string | null;
  after_hash: string;
  preview_hash: string;
  content: string;
  source_sha256: string;
  safety: {
    max_files_changed: 1;
    allow_delete: false;
    allow_broad_folder_write: false;
    exact_canonical_destination: true;
    original_capture_preserved: true;
  };
}

export interface VideoAnalysisApplyOneApproval {
  approval_id: string;
  proposal_id: string;
  approved_by: string;
  approved_at: string;
  expires_at: string;
  source_commit: string;
  idempotency_key: string;
  target_relative_path: string;
  expected_before_hash: string | null;
  preview_hash: string;
  after_hash: string;
  manual_confirmation: boolean;
  confirmation_token: string;
  reason: string;
}

export interface VideoAnalysisApplyOneResult {
  status: 'preview_ready' | 'pending_approval' | 'already_applied' | 'blocked' | 'applied' | 'failed';
  ok: boolean;
  target_relative_path: string;
  target_path: string;
  preview_id: string | null;
  preview_hash: string | null;
  after_hash: string | null;
  proposal_id: string | null;
  approval_id: string | null;
  confirmation_token: string | null;
  rollback_artifact: string | null;
  receipt_path: string | null;
  blockers: string[];
  changed_paths: string[];
  wrote_to_mind: boolean;
  applied: boolean;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashFile(filePath: string): string {
  return sha256(readFileSync(filePath, 'utf8'));
}

function resolveMindRoot(explicit?: string): string {
  const configured = explicit ?? process.env.BRAIN_CORE_MIND_STEWARD_MIND_ROOT ?? path.resolve(BRAIN_ROOT, '..', 'mind');
  return path.resolve(configured);
}

function writeRuntimeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  renameSync(temporary, filePath);
  chmodSync(filePath, 0o600);
}

function assertNoSymlinkPath(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('target_outside_mind_root');
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error('symlink_escape_blocked');
    }
  }
}

function canonicalTarget(mindRoot: string, jobId: string): { relative: string; absolute: string } {
  if (!/^video-analysis-[a-f0-9]{20}$/.test(jobId)) throw new Error('invalid_video_job_id');
  const relative = `${MIND_TARGET_PATHS.inboxProcessed}/video-analysis/${jobId}.md`;
  const absolute = path.resolve(mindRoot, ...relative.split('/'));
  assertNoSymlinkPath(resolveMindRoot(mindRoot), absolute);
  return { relative, absolute };
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderMindArtifact(result: VideoAnalysisResult): string {
  const observations = result.visual_observations.length > 0
    ? result.visual_observations.map((finding) => `- **[${finding.timestamp || formatTimestamp(finding.timestamp_seconds)}] ${finding.label}** — ${finding.observation}`).join('\n')
    : '- No visual observations were returned by the selected-frame vision pass.';
  const points = result.key_points.length > 0 ? result.key_points.map(point => `- ${point}`).join('\n') : '- None returned.';
  const transcript = result.transcript.text.trim() || '_No transcript was available._';
  return `---
type: video-analysis
schema_version: ${result.schema_version}
job_id: ${result.job_id}
source_kind: ${result.source.kind}
source: ${result.source.uri}
source_sha256: ${result.provenance.source_sha256}
processor: ${result.processing.processor}
transcript_provider: ${result.processing.transcript_provider ?? 'none'}
vision_provider: ${result.processing.vision_provider ?? 'none'}
vision_model: ${result.processing.vision_model ?? 'none'}
frames_extracted: ${result.processing.frames_extracted}
frames_sent_to_paid_vision: ${result.processing.frames_sent_to_paid_vision}
created_at: ${result.provenance.created_at}
original_capture_reference: ${result.source.original_capture_reference ?? 'none'}
review_required: true
---

# ${result.metadata.title ?? result.title ?? 'Video analysis'}

## Source

- **Reference:** ${result.source.uri}
- **Channel/uploader:** ${result.metadata.channel ?? result.channel ?? 'unknown'}
- **Duration:** ${result.metadata.duration_seconds ?? 'unknown'} seconds
- **Original capture:** ${result.source.original_capture_reference ?? 'not supplied'}

## Summary

${result.summary || result.human_summary || 'No summary returned.'}

## Key points

${points}

## Timestamped visual findings

${observations}

## Transcript

${transcript}

## Processing evidence

- Transcript path: ${result.processing.transcript_provider ?? 'none'}
- Frames extracted locally: ${result.processing.frames_extracted}
- Frames sent to paid vision: ${result.processing.frames_sent_to_paid_vision}
- Vision route: ${result.processing.vision_provider ?? 'none'} / ${result.processing.vision_model ?? 'none'}
- Warnings: ${result.warnings.length > 0 ? result.warnings.join('; ') : 'none'}
`;
}

function confirmationToken(preview: Pick<VideoAnalysisApplyOnePreview, 'preview_id' | 'after_hash' | 'target_relative_path'>): string {
  return `confirm-${sha256(`${preview.preview_id}|${preview.after_hash}|${preview.target_relative_path}`).slice(0, 24)}`;
}

function computePreviewHash(preview: Pick<VideoAnalysisApplyOnePreview, 'target_relative_path' | 'expected_before_hash' | 'after_hash' | 'content'>): string {
  return sha256(JSON.stringify({
    target: preview.target_relative_path,
    expectedBeforeHash: preview.expected_before_hash,
    afterHash: preview.after_hash,
    content: preview.content,
  }));
}

export function prepareVideoAnalysisApplyOnePreview(
  result: VideoAnalysisResult,
  options: { mindRoot?: string; sourceCommit?: string; previewRoot?: string } = {},
): VideoAnalysisApplyOneResult & { preview: VideoAnalysisApplyOnePreview | null } {
  const blockers: string[] = [];
  let target: { relative: string; absolute: string };
  try {
    target = canonicalTarget(resolveMindRoot(options.mindRoot), result.job_id);
  } catch (error) {
    return {
      status: 'blocked', ok: false, target_relative_path: '', target_path: '', preview_id: null,
      preview_hash: null, after_hash: null, proposal_id: null, approval_id: null,
      confirmation_token: null, rollback_artifact: null, receipt_path: null,
      blockers: [error instanceof Error ? error.message : 'invalid_target'], changed_paths: [],
      wrote_to_mind: false, applied: false, preview: null,
    };
  }

  const content = renderMindArtifact(result);
  const afterHash = sha256(content);
  let expectedBeforeHash: string | null = null;
  if (existsSync(target.absolute)) {
    if (lstatSync(target.absolute).isSymbolicLink()) blockers.push('target_symlink_blocked');
    else if (statSync(target.absolute).isDirectory()) blockers.push('target_is_directory');
    else {
      expectedBeforeHash = hashFile(target.absolute);
      if (expectedBeforeHash === afterHash) {
        return {
          status: 'already_applied', ok: true, target_relative_path: target.relative, target_path: target.absolute,
          preview_id: null, preview_hash: null, after_hash: afterHash, proposal_id: null, approval_id: null,
          confirmation_token: null, rollback_artifact: null, receipt_path: null, blockers: [], changed_paths: [],
          wrote_to_mind: false, applied: false, preview: null,
        };
      }
      blockers.push('canonical_target_conflict');
    }
  }
  if (blockers.length > 0) {
    return {
      status: 'blocked', ok: false, target_relative_path: target.relative, target_path: target.absolute,
      preview_id: null, preview_hash: null, after_hash: afterHash, proposal_id: null, approval_id: null,
      confirmation_token: null, rollback_artifact: null, receipt_path: null, blockers, changed_paths: [],
      wrote_to_mind: false, applied: false, preview: null,
    };
  }

  const sourceCommit = options.sourceCommit ?? process.env.BRAIN_VIDEO_SOURCE_COMMIT ?? 'unknown';
  const idempotencyKey = `video-apply-${result.job_id}`;
  const proposalId = `video-proposal-${sha256(`${result.job_id}|${afterHash}`).slice(0, 20)}`;
  const previewId = `video-preview-${sha256(`${proposalId}|${target.relative}`).slice(0, 20)}`;
  const previewHash = computePreviewHash({ target_relative_path: target.relative, expected_before_hash: expectedBeforeHash, after_hash: afterHash, content });
  const preview: VideoAnalysisApplyOnePreview = {
    schema_version: '1.0.0', kind: 'video-analysis-apply-one-preview', preview_id: previewId,
    proposal_id: proposalId, idempotency_key: idempotencyKey, generated_at: new Date().toISOString(),
    source_commit: sourceCommit, job_id: result.job_id, target_relative_path: target.relative,
    target_path: target.absolute, expected_before_hash: expectedBeforeHash, after_hash: afterHash,
    preview_hash: previewHash, content,
    source_sha256: result.provenance.source_sha256,
    safety: { max_files_changed: 1, allow_delete: false, allow_broad_folder_write: false, exact_canonical_destination: true, original_capture_preserved: true },
  };
  writeRuntimeJson(path.join(path.resolve(options.previewRoot ?? PREVIEW_ROOT), `${previewId}.json`), preview);
  const token = confirmationToken(preview);
  return {
    status: 'pending_approval', ok: true, target_relative_path: target.relative, target_path: target.absolute,
    preview_id: previewId, preview_hash: previewHash, after_hash: afterHash, proposal_id: proposalId,
    approval_id: null, confirmation_token: token, rollback_artifact: null, receipt_path: null,
    blockers: ['concrete_operator_approval_and_second_confirmation_required'], changed_paths: [],
    wrote_to_mind: false, applied: false, preview,
  };
}

export function applyVideoAnalysisApplyOne(
  preview: VideoAnalysisApplyOnePreview,
  approval: VideoAnalysisApplyOneApproval,
  options: { mindRoot?: string; receiptRoot?: string } = {},
): VideoAnalysisApplyOneResult {
  const base = {
    target_relative_path: preview.target_relative_path, target_path: preview.target_path,
    preview_id: preview.preview_id, preview_hash: preview.preview_hash, after_hash: preview.after_hash,
    proposal_id: preview.proposal_id, approval_id: approval.approval_id, confirmation_token: null,
    rollback_artifact: null, receipt_path: null, changed_paths: [], wrote_to_mind: false, applied: false,
  };
  const blockers: string[] = [];
  if (computePreviewHash(preview) !== preview.preview_hash) blockers.push('preview_content_hash_mismatch');
  if (sha256(preview.content) !== preview.after_hash) blockers.push('after_hash_content_mismatch');
  if (approval.proposal_id !== preview.proposal_id) blockers.push('proposal_id_mismatch');
  if (approval.idempotency_key !== preview.idempotency_key) blockers.push('idempotency_key_mismatch');
  if (approval.target_relative_path !== preview.target_relative_path) blockers.push('target_path_mismatch');
  if (approval.expected_before_hash !== preview.expected_before_hash) blockers.push('expected_before_hash_mismatch');
  if (approval.preview_hash !== preview.preview_hash || approval.after_hash !== preview.after_hash) blockers.push('preview_hash_mismatch');
  if (approval.source_commit !== preview.source_commit) blockers.push('source_commit_mismatch');
  if (!approval.manual_confirmation || approval.confirmation_token !== confirmationToken(preview)) blockers.push('second_confirmation_required');
  if (!approval.approved_by.trim() || !approval.reason.trim()) blockers.push('approval_identity_or_reason_missing');
  if (!Number.isFinite(Date.parse(approval.expires_at)) || Date.parse(approval.expires_at) <= Date.now()) blockers.push('approval_expired');
  if (blockers.length > 0) return { ...base, status: 'blocked', ok: false, blockers };

  const targetRoot = resolveMindRoot(options.mindRoot);
  let createdTargetIdentity: { dev: number; ino: number } | null = null;
  try {
    const expectedTarget = canonicalTarget(targetRoot, preview.job_id);
    if (expectedTarget.relative !== preview.target_relative_path || expectedTarget.absolute !== preview.target_path) throw new Error('canonical_target_mismatch');
    assertNoSymlinkPath(targetRoot, preview.target_path);
    if (existsSync(preview.target_path)) {
      if (!lstatSync(preview.target_path).isFile()) throw new Error('target_not_regular_file');
      if (hashFile(preview.target_path) === preview.after_hash) {
        return { ...base, status: 'already_applied', ok: true, blockers: [] };
      }
      throw new Error('target_changed_since_preview');
    }
    const receiptRoot = path.resolve(options.receiptRoot ?? RECEIPT_ROOT);
    const approvalAuditPath = path.join(
      receiptRoot,
      `${sha256(preview.preview_id)}.${sha256(approval.approval_id)}.approval.json`,
    );
    // Persist the accepted approval before touching Mind. If this audit write
    // fails, the operation fails closed and no Mind file is created.
    writeRuntimeJson(approvalAuditPath, {
      schema_version: '1.0',
      kind: 'video-analysis-apply-one-approval-audit',
      status: 'accepted',
      preview_id: preview.preview_id,
      proposal_id: preview.proposal_id,
      approval_id: approval.approval_id,
      approved_by: approval.approved_by,
      approved_at: approval.approved_at,
      expires_at: approval.expires_at,
      source_commit: approval.source_commit,
      target_relative_path: approval.target_relative_path,
      expected_before_hash: approval.expected_before_hash,
      preview_hash: approval.preview_hash,
      after_hash: approval.after_hash,
      manual_confirmation: approval.manual_confirmation,
      reason: approval.reason,
      recorded_at: new Date().toISOString(),
    });
    mkdirSync(path.dirname(preview.target_path), { recursive: true });
    const temporary = path.join(path.dirname(preview.target_path), `.${path.basename(preview.target_path)}.${process.pid}.tmp`);
    writeFileSync(temporary, preview.content, { mode: 0o600, flag: 'wx' });
    try {
      // A hard link is create-only: unlike rename, it cannot replace a target
      // that appeared after the preflight check.
      linkSync(temporary, preview.target_path);
      const createdTarget = statSync(preview.target_path);
      createdTargetIdentity = { dev: createdTarget.dev, ino: createdTarget.ino };
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    const actual = hashFile(preview.target_path);
    if (actual !== preview.after_hash) throw new Error('post_write_hash_mismatch');

    const rollbackPath = path.join(receiptRoot, `${preview.preview_id}.rollback.json`);
    const receiptPath = path.join(receiptRoot, `${preview.preview_id}.receipt.json`);
    writeRuntimeJson(rollbackPath, {
      schema_version: '1.0', operation: 'remove-created-file-if-still-matching', target_path: preview.target_path,
      after_hash: actual, content: preview.content, created_at: new Date().toISOString(),
    });
    const receipt = {
      schema_version: '1.0', kind: 'video-analysis-apply-one-receipt', proposal_id: preview.proposal_id,
      approval_id: approval.approval_id, idempotency_key: preview.idempotency_key,
      attempted_paths: [preview.target_relative_path], before_hash: preview.expected_before_hash,
      after_hash: actual, status: 'applied', validation: { post_write_hash_match: true, max_files_changed: 1, no_unapproved_paths_changed: true },
      approval_audit: approvalAuditPath, rollback_artifact: rollbackPath,
      executor_version: 'brain-video-analysis-writer-v1', applied_at: new Date().toISOString(),
    };
    writeRuntimeJson(receiptPath, receipt);
    return { ...base, status: 'applied', ok: true, rollback_artifact: rollbackPath, receipt_path: receiptPath, changed_paths: [preview.target_relative_path], wrote_to_mind: true, applied: true, blockers: [] };
  } catch (error) {
    if (createdTargetIdentity && existsSync(preview.target_path)) {
      try {
        if (!lstatSync(preview.target_path).isSymbolicLink()) {
          const current = statSync(preview.target_path);
          if (current.dev === createdTargetIdentity.dev && current.ino === createdTargetIdentity.ino) unlinkSync(preview.target_path);
        }
      } catch {
        // Preserve the original failure; cleanup is best-effort and identity-bound.
      }
    }
    return { ...base, status: 'failed', ok: false, blockers: [error instanceof Error ? error.message : 'apply_failed'] };
  }
}
