import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = join(import.meta.dirname ?? __dirname, '../../scripts/inspect-video-orchestrator-publish-readiness.mjs');

async function runInspector(approvalsPath: string): Promise<{
  ok: boolean;
  approvalsPath: string;
  bindingsPath: string;
  scannedBindings: number;
  candidateCount: number;
  readyCount: number;
  blockedCount: number;
  ready: unknown[];
  blocked: unknown[];
}> {
  const { stdout } = await execFileAsync(process.execPath, [SCRIPT_PATH], {
    env: { ...process.env, VO_APPROVALS_PATH: approvalsPath },
    timeout: 10_000,
  });
  return JSON.parse(stdout) as ReturnType<typeof runInspector> extends Promise<infer T> ? T : never;
}

async function writeApprovals(dir: string, records: unknown[]): Promise<string> {
  const approvalsPath = join(dir, 'approvals.json');
  await writeFile(approvalsPath, JSON.stringify(records, null, 2));
  return approvalsPath;
}

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

// ── Output format ─────────────────────────────────────────────────────────────

test('inspector outputs valid JSON to stdout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-format-'));
  const approvalsPath = await writeApprovals(dir, []);

  try {
    const result = await runInspector(approvalsPath);
    assert.ok(result.ok);
    assert.equal(typeof result.approvalsPath, 'string');
    assert.equal(typeof result.bindingsPath, 'string');
    assert.equal(result.scannedBindings, 0);
    assert.equal(result.candidateCount, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector reports actual approvalsPath in output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-paths-'));
  const approvalsPath = await writeApprovals(dir, []);

  try {
    const result = await runInspector(approvalsPath);
    assert.equal(result.approvalsPath, approvalsPath);
    assert.ok(result.bindingsPath.includes('video-orchestrator'), `bindingsPath should include video-orchestrator: ${result.bindingsPath}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Approval filtering ────────────────────────────────────────────────────────

test('inspector counts only approved content bindings with S3 video paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-filter-'));
  const approvals = [
    // included: approved content with S3 video
    {
      id: 'approval-content-1',
      type: 'content',
      status: 'approved',
      projectId: 'says-the-bible',
      actor: 'operator',
      requestedAt: '2026-06-19T10:00:00Z',
      expiresAt: '2026-06-19T10:30:00Z',
      decidedAt: '2026-06-19T10:05:00Z',
      requestPayload: { sourceVideoPath: 's3://prochat-video-dev-909439522876-eu-north-1-an/uploads/real.mp4' },
    },
    // excluded: pending
    {
      id: 'approval-content-2',
      type: 'content',
      status: 'pending',
      projectId: 'says-the-bible',
      actor: 'operator',
      requestedAt: '2026-06-19T10:00:00Z',
      expiresAt: '2026-06-19T10:30:00Z',
      requestPayload: { sourceVideoPath: 's3://prochat-video-dev-909439522876-eu-north-1-an/uploads/real2.mp4' },
    },
    // excluded: approved but non-S3 path
    {
      id: 'approval-content-3',
      type: 'content',
      status: 'approved',
      projectId: 'says-the-bible',
      actor: 'operator',
      requestedAt: '2026-06-19T10:00:00Z',
      expiresAt: '2026-06-19T10:30:00Z',
      decidedAt: '2026-06-19T10:05:00Z',
      requestPayload: { sourceVideoPath: '/tmp/local.mp4' },
    },
    // excluded: metadata type not content
    {
      id: 'approval-metadata-1',
      type: 'metadata',
      status: 'approved',
      projectId: 'says-the-bible',
      actor: 'operator',
      requestedAt: '2026-06-19T10:00:00Z',
      expiresAt: '2026-06-19T10:30:00Z',
      decidedAt: '2026-06-19T10:05:00Z',
      requestPayload: { sourceVideoPath: 's3://prochat-video-dev-909439522876-eu-north-1-an/uploads/real3.mp4' },
    },
  ];
  const approvalsPath = await writeApprovals(dir, approvals);

  try {
    const result = await runInspector(approvalsPath);
    assert.equal(result.scannedBindings, 1, 'only one approved content approval with S3 path should be counted');
    assert.equal(result.blockedCount, 1, 'the one binding has no job metadata, should be blocked');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Blocked reasons ───────────────────────────────────────────────────────────

test('inspector lists all blockers for a partially-ready job', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-blockers-'));
  const approval = {
    id: 'approval-content-partial',
    type: 'content',
    status: 'approved',
    projectId: 'says-the-bible',
    actor: 'operator',
    requestedAt: '2026-06-19T10:00:00Z',
    expiresAt: '2026-06-19T10:30:00Z',
    decidedAt: '2026-06-19T10:05:00Z',
    requestPayload: { sourceVideoPath: 's3://prochat-video-dev-909439522876-eu-north-1-an/uploads/partial.mp4' },
  };
  const approvalsPath = await writeApprovals(dir, [approval]);

  // Only write assets with no thumbnailKey — everything else missing
  const safeId = approval.id.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 80);
  const jobId = `approved-video-${safeId}`;
  await makeJobMetadata(dir, jobId, {
    'assets.json': { generationMode: 'approved-source-video' },
    'status.json': { status: 'processing', executionArn: 'arn:partial' },
  });

  try {
    const result = await runInspector(approvalsPath);
    const candidate = result.blocked[0] as { blocked: string[] } | undefined;
    assert.ok(candidate, 'blocked candidate must exist');

    assert.ok(candidate.blocked.includes('thumbnail_not_approved'), 'must list thumbnail_not_approved');
    assert.ok(candidate.blocked.includes('metadata_not_approved'), 'must list metadata_not_approved');
    assert.ok(candidate.blocked.includes('package_not_queued'), 'must list package_not_queued');
    assert.ok(candidate.blocked.includes('dry_run_not_completed'), 'must list dry_run_not_completed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Safety ────────────────────────────────────────────────────────────────────

test('inspector output does not contain credential material', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-safety-'));
  const approvalsPath = await writeApprovals(dir, []);

  try {
    const { stdout } = await execFileAsync(process.execPath, [SCRIPT_PATH], {
      env: { ...process.env, VO_APPROVALS_PATH: approvalsPath },
      timeout: 10_000,
    });
    assert.ok(!stdout.includes('access_token'), 'must not expose access_token');
    assert.ok(!stdout.includes('refresh_token'), 'must not expose refresh_token');
    assert.ok(!stdout.includes('client_secret'), 'must not expose client_secret');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('inspector exits with code 0 on success', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inspector-exit-'));
  const approvalsPath = await writeApprovals(dir, []);

  try {
    const result = await execFileAsync(process.execPath, [SCRIPT_PATH], {
      env: { ...process.env, VO_APPROVALS_PATH: approvalsPath },
      timeout: 10_000,
    });
    assert.ok(result.stdout.length > 0, 'stdout must not be empty');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
