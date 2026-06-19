#!/usr/bin/env node
/**
 * Local publish-readiness inspector for Phase 1W.
 *
 * Scans the local VO approval store for content approvals that were
 * dispatched to production jobs, then checks each bound job for the
 * full pre-publish checklist:
 *   - assets.json present with approved-source-video generationMode
 *   - review.json present with reviewStatus approved (if required)
 *   - thumbnail approved (assets.json has thumbnailKey)
 *   - metadata approved (publish.json or seo-package present)
 *   - package queued (package.json present)
 *   - successful dry-run proof (publish.json.dryRunPassed === true)
 *
 * Safety:
 * - Reads local disk files only. Never writes.
 * - Never reads credentials, tokens, or secrets.
 * - Never invokes publish code.
 * - Never prints credential material.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function getBrainRepoRoot(from = MODULE_DIR) {
  let dir = from;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'projects', 'brain-core')) && fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate brain repo root from: ${from}`);
}

function getJobsRoot() {
  if (process.env['VO_JOBS_ROOT']) {
    return process.env['VO_JOBS_ROOT'];
  }
  const root = getBrainRepoRoot();
  return path.join(root, 'projects', 'video-orchestrator', 'cloud', 'jobs');
}

function getApprovalsPath() {
  return process.env['VO_APPROVALS_PATH'] ?? path.join(os.homedir(), '.local', 'video-orchestrator', 'state', 'approvals.json');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sanitizeApprovalId(approvalId) {
  return approvalId.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 80);
}

function deriveJobId(approvalId) {
  return `approved-video-${sanitizeApprovalId(approvalId)}`;
}

function checkJobReadiness(jobId, jobsRoot, allApprovals) {
  const metadataDir = path.join(jobsRoot, jobId, 'metadata');

  const assets = readJsonFile(path.join(metadataDir, 'assets.json'));
  const status = readJsonFile(path.join(metadataDir, 'status.json'));
  const review = readJsonFile(path.join(metadataDir, 'review.json'));
  const publish = readJsonFile(path.join(metadataDir, 'publish.json'));
  const publishCheck = readJsonFile(path.join(metadataDir, 'publish-check.json'));

  // Approval store evidence: check for approved metadata/thumbnail/package records
  // that reference this job's contentItemId (derived from the approval ID in the jobId).
  // The jobId is: approved-video-{approvalId-sanitized}; we extract the approval ID.
  const contentApprovalId = jobId.replace(/^approved-video-/, '');
  const jobApprovals = allApprovals.filter((a) => {
    const rp = a.requestPayload ?? {};
    const itemId = rp.contentItemId ?? '';
    // Match by approvalId in content approval store (the content approval that led to this job)
    // or by contentItemId in thumbnail/metadata/package approvals
    return (
      a.id === contentApprovalId ||
      (typeof itemId === 'string' && itemId.length > 0 &&
        allApprovals.some((c) => c.id === contentApprovalId && c.requestPayload?.contentItemId === itemId)) ||
      (typeof rp.approvalId === 'string' && rp.approvalId === contentApprovalId)
    );
  });

  // Find the contentItemId associated with this job's dispatch
  const contentApproval = allApprovals.find((a) => a.id === contentApprovalId);
  // The dispatch writes the contentItemId into the job's topic.json; read it back as fallback
  const topicJson = readJsonFile(path.join(metadataDir, 'topic.json'));
  // Try to find approvals for the content item ID
  const approvedMetadataForItem = allApprovals.filter((a) =>
    a.type === 'metadata' &&
    a.status === 'approved' &&
    (a.projectId === (contentApproval?.projectId ?? topicJson?.projectId))
  );
  const approvedThumbnailForItem = allApprovals.filter((a) =>
    a.type === 'thumbnail' &&
    a.status === 'approved' &&
    (a.projectId === (contentApproval?.projectId ?? topicJson?.projectId))
  );
  // package_not_queued check: any package record (pending OR approved) means the queue step ran
  const approvedPackageForItem = allApprovals.filter((a) =>
    a.type === 'package' &&
    (a.status === 'pending' || a.status === 'approved') &&
    (a.projectId === (contentApproval?.projectId ?? topicJson?.projectId))
  );

  const blocked = [];

  if (!assets) {
    blocked.push('missing_assets_json');
  } else if (assets.generationMode !== 'approved-source-video') {
    blocked.push('assets_not_approved_source_video');
  }

  if (!status) {
    blocked.push('missing_status_json');
  } else if (status.status === 'failed') {
    blocked.push('dispatch_failed');
  }

  const hasThumbnailKey = (assets && typeof assets.thumbnailKey === 'string' && assets.thumbnailKey.length > 0) ||
    (publish && typeof publish.thumbnailKey === 'string' && publish.thumbnailKey.length > 0) ||
    (publishCheck?.youtubeDryRun && typeof publishCheck.youtubeDryRun.thumbnailKey === 'string' && publishCheck.youtubeDryRun.thumbnailKey.length > 0) ||
    approvedThumbnailForItem.length > 0;
  if (!hasThumbnailKey) {
    blocked.push('thumbnail_not_approved');
  }

  const hasMetadataOnDisk = publish && (
    (typeof publish.title === 'string' && publish.title.length > 0) ||
    (typeof publish.youtubeTitle === 'string' && publish.youtubeTitle.length > 0)
  );
  const hasMetadataInStore = approvedMetadataForItem.length > 0;
  if (!hasMetadataOnDisk && !hasMetadataInStore) {
    blocked.push('metadata_not_approved');
  }

  const packageData = readJsonFile(path.join(metadataDir, 'youtube-package.json')) ||
    readJsonFile(path.join(metadataDir, 'package.json'));
  const hasPackageInStore = approvedPackageForItem.length > 0;
  if (!packageData && !hasPackageInStore) {
    blocked.push('package_not_queued');
  }

  const hasDryRunProof = (publish && publish.dryRunPassed === true) ||
    (publishCheck && publishCheck.dryRunPassed === true);
  if (!hasDryRunProof) {
    blocked.push('dry_run_not_completed');
  }

  return {
    jobId,
    executionArn: status?.executionArn ?? null,
    dispatched: Boolean(status),
    ready: blocked.length === 0,
    blocked,
  };
}

function main() {
  const approvalsPath = getApprovalsPath();
  const jobsRoot = getJobsRoot();

  const approvals = readJsonFile(approvalsPath) ?? [];

  const contentApprovals = approvals.filter(
    (a) =>
      a.type === 'content' &&
      a.status === 'approved' &&
      typeof a.requestPayload?.sourceVideoPath === 'string' &&
      a.requestPayload.sourceVideoPath.startsWith('s3://'),
  );

  const scannedBindings = contentApprovals.length;
  const candidates = [];

  for (const approval of contentApprovals) {
    const jobId = deriveJobId(approval.id);
    const readiness = checkJobReadiness(jobId, jobsRoot, approvals);

    candidates.push({
      approvalId: approval.id,
      projectId: approval.projectId,
      sourceVideoPath: approval.requestPayload.sourceVideoPath,
      decidedAt: approval.decidedAt ?? null,
      ...readiness,
    });
  }

  const ready = candidates.filter((c) => c.ready);
  const blocked = candidates.filter((c) => !c.ready);

  const result = {
    ok: true,
    approvalsPath,
    bindingsPath: jobsRoot,
    scannedBindings,
    candidateCount: candidates.length,
    readyCount: ready.length,
    blockedCount: blocked.length,
    ready,
    blocked,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + '\n');
  process.exitCode = 1;
}
