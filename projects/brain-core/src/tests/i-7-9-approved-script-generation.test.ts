import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateApprovedScript,
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
  const root = mkdtempSync(path.join(tmpdir(), 'brain-core-i7-9-'));

  // Setup ProChat channel
  writeJson(path.join(root, 'channels', 'prochat', 'content-profile.json'), {
    channelId: 'prochat',
    scriptRequirements: {
      approvalRequired: true,
      theologicalReviewRequired: false,
    },
  });

  // Setup Says the Bible channel
  writeJson(path.join(root, 'channels', 'says-the-bible', 'content-profile.json'), {
    channelId: 'says-the-bible',
    scriptRequirements: {
      approvalRequired: true,
      theologicalReviewRequired: true,
    },
  });

  return root;
}

function createApprovedScript(root: string, jobId: string, channelId: string = 'prochat'): string {
  const scriptPath = path.join(root, 'jobs', jobId, 'metadata', 'script.json');
  writeJson(scriptPath, {
    jobId,
    channelId,
    topicId: 'test-topic',
    status: 'approved',
    title: 'Test Approved Script',
    wordCount: 120,
    scriptKey: `jobs/${jobId}/scripts/script.md`,
    approval: {
      required: true,
      status: 'approved',
      theologicalReviewRequired: channelId === 'says-the-bible',
      approvedAt: '2026-06-01T00:00:00Z',
      approvedBy: 'test-user',
      notes: 'Test approval',
    },
  });
  writeJson(path.join(root, 'jobs', jobId, 'metadata', 'topic.json'), {
    jobId,
    channelId,
    topicId: 'test-topic',
  });
  return scriptPath;
}

function createPendingScript(root: string, jobId: string): string {
  const scriptPath = path.join(root, 'jobs', jobId, 'metadata', 'script.json');
  writeJson(scriptPath, {
    jobId,
    channelId: 'prochat',
    topicId: 'test-topic',
    status: 'draft',
    title: 'Test Pending Script',
    wordCount: 100,
    approval: {
      required: true,
      status: 'pending',
      theologicalReviewRequired: false,
      notes: null,
    },
  });
  writeJson(path.join(root, 'jobs', jobId, 'metadata', 'topic.json'), {
    jobId,
    channelId: 'prochat',
  });
  return scriptPath;
}

function createChangesRequestedScript(root: string, jobId: string): string {
  const scriptPath = path.join(root, 'jobs', jobId, 'metadata', 'script.json');
  writeJson(scriptPath, {
    jobId,
    channelId: 'prochat',
    topicId: 'test-topic',
    status: 'changes_requested',
    title: 'Test Changes Script',
    wordCount: 100,
    approval: {
      required: true,
      status: 'changes_requested',
      theologicalReviewRequired: false,
      notes: 'Please revise',
    },
  });
  writeJson(path.join(root, 'jobs', jobId, 'metadata', 'topic.json'), {
    jobId,
    channelId: 'prochat',
  });
  return scriptPath;
}

test('[I-7.9] Pending script cannot generate', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'i-7-9-pending-001';
    createPendingScript(root, jobId);

    const result = await generateApprovedScript(jobId, { requestedBy: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'script_not_approved');
      assert.match(result.message, /not 'approved'/);
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Changes requested script cannot generate', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'i-7-9-changes-001';
    createChangesRequestedScript(root, jobId);

    const result = await generateApprovedScript(jobId, { requestedBy: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'script_not_approved');
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Approved ProChat script can generate', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'i-7-9-prochat-approved-001';
    createApprovedScript(root, jobId, 'prochat');

    const result = await generateApprovedScript(jobId, { requestedBy: 'test' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.generationStarted, true);
      assert.equal(result.publishBlocked, true);
      assert.equal(result.jobId, jobId);
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Says the Bible without theology review cannot generate', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'i-7-9-stb-no-theology-001';
    const scriptPath = path.join(root, 'jobs', jobId, 'metadata', 'script.json');
    writeJson(scriptPath, {
      jobId,
      channelId: 'says-the-bible',
      topicId: 'test-topic',
      status: 'approved',
      title: 'Test STB Script',
      wordCount: 100,
      approval: {
        required: true,
        status: 'approved',
        theologicalReviewRequired: false,
        approvedAt: '2026-06-01T00:00:00Z',
        approvedBy: 'test-user',
        notes: 'Approved without theology',
      },
    });
    writeJson(path.join(root, 'jobs', jobId, 'metadata', 'topic.json'), {
      jobId,
      channelId: 'says-the-bible',
    });

    const result = await generateApprovedScript(jobId, { requestedBy: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'theology_review_required');
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Approved Says the Bible script with theology review can generate', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const jobId = 'i-7-9-stb-with-theology-001';
    createApprovedScript(root, jobId, 'says-the-bible');

    const result = await generateApprovedScript(jobId, { requestedBy: 'test' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.generationStarted, true);
      assert.equal(result.publishBlocked, true);
      assert.equal(result.jobId, jobId);
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Invalid job ID rejected', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const result = await generateApprovedScript('invalid/../job', { requestedBy: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'invalid_job_id');
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});

test('[I-7.9] Missing script metadata rejected', async () => {
  const previousRoot = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT;
  const root = createTestRoot();
  process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = root;

  try {
    const result = await generateApprovedScript('nonexistent-job', { requestedBy: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'script_missing');
    }
  } finally {
    process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT = previousRoot;
  }
});
