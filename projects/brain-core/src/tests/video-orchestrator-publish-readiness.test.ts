import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Helpers for test fixture construction

async function makeJobMetadata(
  jobsRoot: string,
  jobId: string,
  files: Record<string, Record<string, unknown>>,
): Promise<void> {
  const metadataDir = join(jobsRoot, jobId, 'metadata');
  await mkdir(metadataDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(metadataDir, name), JSON.stringify(content, null, 2));
  }
}

function sanitizeApprovalId(approvalId: string): string {
  return approvalId.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 80);
}

function deriveJobId(approvalId: string): string {
  return `approved-video-${sanitizeApprovalId(approvalId)}`;
}

type ReadinessCandidate = {
  approvalId: string;
  jobId: string;
  dispatched: boolean;
  ready: boolean;
  blocked: string[];
  executionArn: string | null;
};

type ReadinessResult = {
  ok: boolean;
  approvalsPath: string;
  bindingsPath: string;
  scannedBindings: number;
  candidateCount: number;
  readyCount: number;
  blockedCount: number;
  ready: ReadinessCandidate[];
  blocked: ReadinessCandidate[];
};

async function runInspector(
  approvalsPath: string,
  jobsRoot: string,
): Promise<ReadinessResult> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  const scriptPath = join(import.meta.dirname ?? __dirname, '../../scripts/inspect-video-orchestrator-publish-readiness.mjs');

  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    env: { ...process.env, VO_APPROVALS_PATH: approvalsPath, VO_JOBS_ROOT: jobsRoot },
    timeout: 10_000,
  });

  return JSON.parse(stdout) as ReadinessResult;
}

type ApprovalRecord = {
  id: string;
  type: string;
  status: string;
  projectId: string;
  actor: string;
  requestedAt: string;
  expiresAt: string;
  requestPayload: Record<string, unknown>;
  decidedAt?: string;
};

function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'approval-content-test-001',
    type: 'content',
    status: 'approved',
    projectId: 'says-the-bible',
    actor: 'operator',
    requestedAt: '2026-06-19T10:00:00.000Z',
    expiresAt: '2026-06-19T10:30:00.000Z',
    decidedAt: '2026-06-19T10:05:00.000Z',
    requestPayload: {
      title: 'Test Moving Video',
      description: 'Phase 1W readiness test',
      sourceVideoPath: 's3://prochat-video-dev-909439522876-eu-north-1-an/uploads/real-video.mp4',
      sourceAudioPath: '',
      backgroundImagePath: '',
    },
    ...overrides,
  };
}

// ── Inspector output shape ────────────────────────────────────────────────────

test('inspector returns required top-level fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-shape-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  await writeFile(approvalsPath, '[]');

  try {
    const result = await runInspector(approvalsPath, jobsRoot);

    assert.ok(result.ok, 'ok must be true');
    assert.equal(typeof result.approvalsPath, 'string', 'approvalsPath must be a string');
    assert.equal(typeof result.bindingsPath, 'string', 'bindingsPath must be a string');
    assert.equal(typeof result.scannedBindings, 'number', 'scannedBindings must be a number');
    assert.equal(typeof result.candidateCount, 'number', 'candidateCount must be a number');
    assert.equal(typeof result.readyCount, 'number', 'readyCount must be a number');
    assert.equal(typeof result.blockedCount, 'number', 'blockedCount must be a number');
    assert.ok(Array.isArray(result.ready), 'ready must be an array');
    assert.ok(Array.isArray(result.blocked), 'blocked must be an array');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Zero candidates ───────────────────────────────────────────────────────────

test('inspector reports zero candidates when approvals store is empty', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-empty-'));
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, '[]');

  try {
    const result = await runInspector(approvalsPath, dir);

    assert.equal(result.scannedBindings, 0);
    assert.equal(result.candidateCount, 0);
    assert.equal(result.readyCount, 0);
    assert.equal(result.blockedCount, 0);
    assert.deepEqual(result.ready, []);
    assert.deepEqual(result.blocked, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector skips pending content approvals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-pending-'));
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, JSON.stringify([makeApproval({ status: 'pending' })]));

  try {
    const result = await runInspector(approvalsPath, dir);
    assert.equal(result.scannedBindings, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector skips rejected content approvals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-rejected-'));
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, JSON.stringify([makeApproval({ status: 'rejected' })]));

  try {
    const result = await runInspector(approvalsPath, dir);
    assert.equal(result.scannedBindings, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector skips approved content approvals without an S3 sourceVideoPath', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-no-s3-'));
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, JSON.stringify([
    makeApproval({
      requestPayload: { sourceVideoPath: '/tmp/local-video.mp4' },
    }),
  ]));

  try {
    const result = await runInspector(approvalsPath, dir);
    assert.equal(result.scannedBindings, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector skips non-content approval types', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-metadata-type-'));
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, JSON.stringify([makeApproval({ type: 'metadata' })]));

  try {
    const result = await runInspector(approvalsPath, dir);
    assert.equal(result.scannedBindings, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Blocked candidates ────────────────────────────────────────────────────────

test('inspector reports dispatched job with no metadata as blocked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-no-meta-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  const approval = makeApproval();

  await writeFile(approvalsPath, JSON.stringify([approval]));

  try {
    const result = await runInspector(approvalsPath, jobsRoot);

    assert.equal(result.scannedBindings, 1);
    assert.equal(result.blockedCount, 1);
    assert.equal(result.readyCount, 0);
    assert.ok(result.blocked[0]?.blocked.includes('missing_assets_json'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector reports job missing thumbnail as blocked with thumbnail_not_approved', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-no-thumb-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  const approval = makeApproval();
  const jobId = deriveJobId(approval.id);

  await writeFile(approvalsPath, JSON.stringify([approval]));
  await makeJobMetadata(jobsRoot, jobId, {
    'assets.json': { generationMode: 'approved-source-video', videoKey: 'uploads/real.mp4' },
    'status.json': { status: 'processing', executionArn: 'arn:fake' },
  });

  try {
    const result = await runInspector(approvalsPath, jobsRoot);
    assert.equal(result.blockedCount, 1);
    const candidate = result.blocked[0];
    assert.ok(candidate?.blocked.includes('thumbnail_not_approved'), `expected thumbnail_not_approved in ${JSON.stringify(candidate?.blocked)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector reports job missing metadata as blocked with metadata_not_approved', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-no-meta-approv-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  const approval = makeApproval();
  const jobId = deriveJobId(approval.id);

  await writeFile(approvalsPath, JSON.stringify([approval]));
  await makeJobMetadata(jobsRoot, jobId, {
    'assets.json': { generationMode: 'approved-source-video', thumbnailKey: 'thumb/approved.jpg' },
    'status.json': { status: 'processing', executionArn: 'arn:fake' },
  });

  try {
    const result = await runInspector(approvalsPath, jobsRoot);
    assert.equal(result.blockedCount, 1);
    const candidate = result.blocked[0];
    assert.ok(candidate?.blocked.includes('metadata_not_approved'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector reports job missing dry-run proof as blocked with dry_run_not_completed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-no-dryrun-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  const approval = makeApproval();
  const jobId = deriveJobId(approval.id);

  await writeFile(approvalsPath, JSON.stringify([approval]));
  await makeJobMetadata(jobsRoot, jobId, {
    'assets.json': { generationMode: 'approved-source-video', thumbnailKey: 'thumb/approved.jpg' },
    'status.json': { status: 'processing', executionArn: 'arn:fake' },
    'publish.json': { title: 'Test Title', dryRunPassed: false },
    'package.json': { packageId: 'pkg-001', status: 'queued' },
  });

  try {
    const result = await runInspector(approvalsPath, jobsRoot);
    assert.equal(result.blockedCount, 1);
    const candidate = result.blocked[0];
    assert.ok(candidate?.blocked.includes('dry_run_not_completed'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Ready candidates ──────────────────────────────────────────────────────────

test('inspector reports fully-ready job in ready array', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-ready-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');
  const approval = makeApproval();
  const jobId = deriveJobId(approval.id);

  await writeFile(approvalsPath, JSON.stringify([approval]));
  await makeJobMetadata(jobsRoot, jobId, {
    'assets.json': {
      generationMode: 'approved-source-video',
      thumbnailKey: 'thumbnails/approved.jpg',
    },
    'status.json': {
      status: 'processing',
      executionArn: 'arn:aws:states:eu-north-1:123456789012:execution:video:real',
    },
    'publish.json': {
      title: 'Test Phase 1W Video',
      dryRunPassed: true,
    },
    'package.json': {
      packageId: 'pkg-ready-001',
      status: 'queued',
    },
  });

  try {
    const result = await runInspector(approvalsPath, jobsRoot);

    assert.equal(result.scannedBindings, 1);
    assert.equal(result.readyCount, 1);
    assert.equal(result.blockedCount, 0);
    assert.equal(result.ready.length, 1);
    const candidate = result.ready[0];
    assert.ok(candidate, 'ready candidate must exist');
    assert.equal(candidate.jobId, jobId);
    assert.equal(candidate.approvalId, approval.id);
    assert.equal(candidate.ready, true);
    assert.deepEqual(candidate.blocked, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Multiple candidates ───────────────────────────────────────────────────────

test('inspector separates ready and blocked candidates correctly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'readiness-mixed-'));
  const approvalsPath = join(dir, 'approvals.json');
  const jobsRoot = join(dir, 'jobs');

  const approvalReady = makeApproval({ id: 'approval-content-ready-001' });
  const approvalBlocked = makeApproval({ id: 'approval-content-blocked-001' });

  await writeFile(approvalsPath, JSON.stringify([approvalReady, approvalBlocked]));

  const jobIdReady = deriveJobId(approvalReady.id);
  const jobIdBlocked = deriveJobId(approvalBlocked.id);

  await makeJobMetadata(jobsRoot, jobIdReady, {
    'assets.json': { generationMode: 'approved-source-video', thumbnailKey: 'thumbs/r.jpg' },
    'status.json': { status: 'processing', executionArn: 'arn:ready' },
    'publish.json': { title: 'Ready', dryRunPassed: true },
    'package.json': { packageId: 'pkg-ready' },
  });

  await makeJobMetadata(jobsRoot, jobIdBlocked, {
    'assets.json': { generationMode: 'approved-source-video' },
    'status.json': { status: 'processing', executionArn: 'arn:blocked' },
  });

  try {
    const result = await runInspector(approvalsPath, jobsRoot);

    assert.equal(result.scannedBindings, 2);
    assert.equal(result.readyCount, 1);
    assert.equal(result.blockedCount, 1);
    assert.equal(result.ready[0]?.jobId, jobIdReady);
    assert.equal(result.blocked[0]?.jobId, jobIdBlocked);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
