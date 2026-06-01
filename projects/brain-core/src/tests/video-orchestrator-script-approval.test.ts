import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveScript,
  requestScriptChanges,
} from '../providers/video-orchestrator-provider.js';

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function createTestRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-core-script-approval-'));
  writeJson(path.join(root, 'channels', 'says-the-bible', 'content-profile.json'), {
    channelId: 'says-the-bible',
    scriptRequirements: {
      approvalRequired: true,
      theologicalReviewRequired: true,
    },
    guardrails: {
      requiresHumanApproval: true,
    },
  });
  return root;
}

function createDraftScript(root: string, jobId: string): string {
  const scriptPath = path.join(root, 'jobs', jobId, 'metadata', 'script.json');
  writeJson(scriptPath, {
    jobId,
    channelId: 'says-the-bible',
    topicId: 'stb-test-topic',
    status: 'draft',
    title: 'Approval API Test',
    wordCount: 120,
    scriptKey: `jobs/${jobId}/scripts/script.md`,
    approval: {
      required: true,
      status: 'pending',
      theologicalReviewRequired: true,
      approvedAt: null,
      approvedBy: null,
      notes: null,
    },
  });
  writeJson(path.join(root, 'jobs', jobId, 'metadata', 'topic.json'), {
    jobId,
    channelId: 'says-the-bible',
    topicId: 'stb-test-topic',
  });
  return scriptPath;
}

test('requestScriptChanges then approveScript updates only script approval metadata', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'approval-api-test-unit';
    const scriptPath = createDraftScript(root, jobId);

    const changes = await requestScriptChanges(jobId, {
      requestedBy: 'Steve',
      notes: 'Tighten application section.',
    });
    assert.equal(changes.ok, true);
    assert.equal(changes.ok && changes.scriptStatus, 'changes_requested');
    assert.equal(changes.ok && changes.generationTriggered, false);
    assert.equal(changes.ok && changes.publishChanged, false);

    let script = readJson<{ status: string; approval: { status: string; notes: string; updatedAt: string } }>(scriptPath);
    assert.equal(script.status, 'changes_requested');
    assert.equal(script.approval.status, 'changes_requested');
    assert.equal(script.approval.notes, 'Tighten application section.');
    assert.match(script.approval.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const approved = await approveScript(jobId, {
      approvedBy: 'Steve',
      notes: 'Approved after changes.',
    });
    assert.equal(approved.ok, true);
    assert.equal(approved.ok && approved.scriptStatus, 'approved');
    assert.equal(approved.ok && approved.theologyReviewRequired, true);

    const approvedScript = readJson<{ status: string; approval: { status: string; approvedBy: string; approvedAt: string; notes: string } }>(scriptPath);
    assert.equal(approvedScript.status, 'approved');
    assert.equal(approvedScript.approval.status, 'approved');
    assert.equal(approvedScript.approval.approvedBy, 'Steve');
    assert.match(approvedScript.approval.approvedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(approvedScript.approval.notes, 'Approved after changes.');
    assert.equal(fs.existsSync(path.join(root, 'jobs', jobId, 'metadata', 'publish.json')), false);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
    } else {
      process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
    }
  }
});

test('approveScript rejects invalid job IDs and already uploaded scripts', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const invalid = await approveScript('../bad', { approvedBy: 'Steve' });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.ok ? '' : invalid.code, 'invalid_job_id');

    const jobId = 'approval-api-uploaded-unit';
    createDraftScript(root, jobId);
    writeJson(path.join(root, 'jobs', jobId, 'metadata', 'publish.json'), {
      jobId,
      publishStatus: 'uploaded',
    });

    const uploaded = await approveScript(jobId, { approvedBy: 'Steve' });
    assert.equal(uploaded.ok, false);
    assert.equal(uploaded.ok ? '' : uploaded.code, 'already_published_or_uploaded');
  } finally {
    if (previousRoot === undefined) {
      delete process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
    } else {
      process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
    }
  }
});
