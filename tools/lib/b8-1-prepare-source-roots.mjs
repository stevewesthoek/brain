#!/usr/bin/env node
/**
 * b8-1-prepare-source-roots.mjs
 *
 * Idempotent helper: creates or verifies deterministic clean detached worktrees
 * under /Users/Office/.brain/benchmark/b8-1/source-roots/<repositoryId>/<pinnedCommit>/
 *
 * Usage: node tools/lib/b8-1-prepare-source-roots.mjs [--check]
 *   --check: verify existing roots without creating
 *
 * Uses local Git object stores only. No network clones.
 * Idempotent: if root already exists at exact commit and clean, skips.
 * Cleanup: reports roots for commits no longer in the manifest (does not delete).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const SOURCE_ROOTS_BASE = '/Users/Office/.brain/benchmark/b8-1/source-roots';

// Map of repositoryId -> local git repo path
// These are the canonical local clone locations for the source repositories
const REPO_LOCAL_PATHS = {
  brain: '/Users/Office/Repos/stevewesthoek/brain-next',
  workbench: '/Users/Office/Repos/prochattools/saas/workbench-private',
  prochat: '/Users/Office/Repos/prochattools/web/prochat',
};

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  // Load manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    console.error(`ERROR: failed to read manifest: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const results = [];
  let anyError = false;

  for (const repo of manifest.repositories) {
    const { repositoryId, pinnedCommit } = repo;
    const localRepoPath = REPO_LOCAL_PATHS[repositoryId];
    if (!localRepoPath) {
      console.error(`ERROR: no local repo path configured for repositoryId="${repositoryId}"`);
      anyError = true;
      results.push({ repositoryId, pinnedCommit, status: 'error', detail: 'no local repo path configured' });
      continue;
    }

    const worktreePath = path.join(SOURCE_ROOTS_BASE, repositoryId, pinnedCommit);

    if (fs.existsSync(worktreePath)) {
      // Verify existing worktree
      const verifyResult = verifyWorktree(worktreePath, pinnedCommit, repositoryId);
      if (verifyResult.ok) {
        console.log(`OK       ${repositoryId}@${pinnedCommit.slice(0, 12)}  ${worktreePath}`);
        results.push({ repositoryId, pinnedCommit, status: 'ok', path: worktreePath });
      } else {
        console.error(`FAIL     ${repositoryId}@${pinnedCommit.slice(0, 12)}  ${verifyResult.error}`);
        anyError = true;
        results.push({ repositoryId, pinnedCommit, status: 'fail', path: worktreePath, detail: verifyResult.error });
      }
    } else if (checkOnly) {
      console.error(`MISSING  ${repositoryId}@${pinnedCommit.slice(0, 12)}  ${worktreePath}`);
      anyError = true;
      results.push({ repositoryId, pinnedCommit, status: 'missing', path: worktreePath });
    } else {
      // Create the worktree
      const createResult = createWorktree(localRepoPath, worktreePath, pinnedCommit, repositoryId);
      if (createResult.ok) {
        console.log(`CREATED  ${repositoryId}@${pinnedCommit.slice(0, 12)}  ${worktreePath}`);
        results.push({ repositoryId, pinnedCommit, status: 'created', path: worktreePath });
      } else {
        console.error(`ERROR    ${repositoryId}@${pinnedCommit.slice(0, 12)}  ${createResult.error}`);
        anyError = true;
        results.push({ repositoryId, pinnedCommit, status: 'error', path: worktreePath, detail: createResult.error });
      }
    }
  }

  console.log('');
  console.log(`Results: ${results.filter(r => r.status === 'ok' || r.status === 'created').length} ready, ` +
    `${results.filter(r => r.status === 'fail' || r.status === 'error' || r.status === 'missing').length} problems`);

  if (!anyError) {
    console.log('');
    console.log('All source roots are ready. Use these --source-root overrides:');
    for (const r of results) {
      if (r.path) {
        console.log(`  --source-root ${r.repositoryId}=${r.path}`);
      }
    }
  }

  if (anyError) process.exitCode = 1;
}

function verifyWorktree(worktreePath, pinnedCommit, repositoryId) {
  try {
    const head = execFileSync('git', ['-C', worktreePath, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (head !== pinnedCommit) {
      return { ok: false, error: `HEAD is ${head}, expected ${pinnedCommit}` };
    }
    const status = execFileSync('git', ['-C', worktreePath, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (status.trim() !== '') {
      return { ok: false, error: `worktree is not clean: ${status.trim().slice(0, 80)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function createWorktree(localRepoPath, worktreePath, pinnedCommit, repositoryId) {
  // Verify local repo has the commit
  try {
    execFileSync('git', ['-C', localRepoPath, 'rev-parse', '--verify', `${pinnedCommit}^{commit}`], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch (e) {
    return { ok: false, error: `commit ${pinnedCommit} not found in ${localRepoPath}` };
  }

  // Create parent directory
  try {
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  } catch (e) {
    return { ok: false, error: `failed to create parent directory: ${e.message}` };
  }

  // Create detached worktree at exact pinned commit
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, pinnedCommit], {
      cwd: localRepoPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    return { ok: false, error: `git worktree add failed: ${e.message}` };
  }

  // Verify
  return verifyWorktree(worktreePath, pinnedCommit, repositoryId);
}

main();
