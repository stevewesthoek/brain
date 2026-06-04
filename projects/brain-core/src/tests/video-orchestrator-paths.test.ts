import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  getBrainRepoRoot,
  getVideoJobsDiagnostics,
  getVideoOrchestratorCloudRoot,
  getVideoOrchestratorJobsRoot,
} from '../providers/video-orchestrator-provider.js';

const brainRoot = '/Users/Office/Repos/stevewesthoek/brain';

test('video orchestrator jobs root resolves from brain-core source path', () => {
  const moduleDir = path.join(brainRoot, 'projects', 'brain-core', 'src', 'providers');

  assert.equal(getBrainRepoRoot(moduleDir), brainRoot);
  assert.equal(
    getVideoOrchestratorCloudRoot(moduleDir),
    path.join(brainRoot, 'projects', 'video-orchestrator', 'cloud'),
  );
  assert.equal(
    getVideoOrchestratorJobsRoot(moduleDir),
    path.join(brainRoot, 'projects', 'video-orchestrator', 'cloud', 'jobs'),
  );
});

test('video orchestrator jobs root resolution is independent of cwd', async () => {
  const previousCwd = process.cwd();
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'brain-core-cwd-'));
  const moduleDir = path.join(brainRoot, 'projects', 'brain-core', 'dist', 'providers');

  try {
    process.chdir(tempRoot);
    assert.equal(getBrainRepoRoot(moduleDir), brainRoot);
    assert.ok(getVideoOrchestratorJobsRoot(moduleDir).endsWith('projects/video-orchestrator/cloud/jobs'));
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('missing video orchestrator jobs root produces explicit diagnostics', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'brain-core-missing-jobs-'));
  const moduleDir = path.join(tempRoot, 'projects', 'brain-core', 'src', 'providers');

  try {
    const diagnostics = await getVideoJobsDiagnostics(moduleDir);

    assert.equal(diagnostics.repoRoot, tempRoot);
    assert.equal(
      diagnostics.jobsRoot,
      path.join(tempRoot, 'projects', 'video-orchestrator', 'cloud', 'jobs'),
    );
    assert.equal(diagnostics.expectedCanonicalPath, 'projects/video-orchestrator/cloud/jobs');
    assert.equal(diagnostics.jobDirectoryExists, false);
    assert.equal(diagnostics.jobDirectoryReadable, false);
    assert.equal(diagnostics.localJobFolderCount, 0);
    assert.equal(diagnostics.modulePath, moduleDir);
    assert.ok(diagnostics.error);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
