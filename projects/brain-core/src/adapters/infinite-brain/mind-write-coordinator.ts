/**
 * Infinite Brain Runtime — Mind Write Coordinator
 * Safely coordinates Mind writes with iOS Obsidian sync
 * Detects git lock, waits for sync to complete, aborts on timeout
 */

import fs from 'fs/promises';
import path from 'path';
import type { GitLockStatus, WriteLockAcquisition } from './types.js';

// Mind repo path (typically ~/Repos/stevewesthoek/mind)
const MIND_REPO_PATH = process.env.MIND_REPO_PATH || path.resolve('../../mind');
const GIT_LOCK_FILE = path.join(MIND_REPO_PATH, '.git', 'index.lock');

// Exponential backoff: 1s, 2s, 4s, ..., up to 5 minutes max
const BACKOFF_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  maxTotalWaitMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Check if git lock file exists
 */
async function gitLockExists(): Promise<boolean> {
  try {
    await fs.access(GIT_LOCK_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exponential backoff waiter
 * Returns true if lock released, false if timeout
 */
async function waitForGitLock(): Promise<GitLockStatus> {
  let delayMs = BACKOFF_CONFIG.initialDelayMs;
  let totalWaitMs = 0;

  while (totalWaitMs < BACKOFF_CONFIG.maxTotalWaitMs) {
    const locked = await gitLockExists();
    if (!locked) {
      return {
        locked: false,
        waitTimeMs: totalWaitMs,
        message: 'Git lock released',
      };
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    totalWaitMs += delayMs;
    delayMs = Math.min(delayMs * 2, BACKOFF_CONFIG.maxDelayMs);
  }

  return {
    locked: true,
    waitTimeMs: totalWaitMs,
    message: `Timeout after ${totalWaitMs}ms waiting for git lock`,
  };
}

/**
 * Placeholder for git status safety.
 *
 * This coordinator intentionally does not invoke git directly. Brain write
 * execution must later use a Brain-owned allowlisted command/action to verify
 * repository cleanliness before any Mind mutation is permitted.
 */
async function checkGitStatus(): Promise<{ clean: boolean; reason?: string }> {
  return {
    clean: false,
    reason: 'Mind git status was not checked by an allowlisted Brain action; writes remain blocked.',
  };
}

/**
 * Acquire write lock before mutations
 * Returns success/failure + reason
 */
export async function acquireWriteLock(): Promise<WriteLockAcquisition> {
  try {
    // Step 1: Check git lock
    const lockStatus = await waitForGitLock();
    if (lockStatus.locked) {
      return {
        acquired: false,
        reason: lockStatus.message,
      };
    }

    // Step 2: Check git status (no uncommitted changes)
    const gitStatus = await checkGitStatus();
    if (!gitStatus.clean) {
      return {
        acquired: false,
        reason: gitStatus.reason || 'Unknown git status issue',
      };
    }

    // Step 3: All checks passed
    return { acquired: true };
  } catch (error) {
    return {
      acquired: false,
      reason: `Write lock acquisition failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Verify Mind is safe to write (diagnostic helper)
 */
export async function verifyIosSyncReady(): Promise<{
  ready: boolean;
  checks: {
    gitLockFree: boolean;
    gitStatusClean: boolean;
  };
  reason?: string | undefined;
}> {
  try {
    const locked = await gitLockExists();
    const gitStatus = await checkGitStatus();

    return {
      ready: !locked && gitStatus.clean,
      checks: {
        gitLockFree: !locked,
        gitStatusClean: gitStatus.clean,
      },
      reason: gitStatus.reason !== undefined ? gitStatus.reason : undefined,
    };
  } catch (error) {
    return {
      ready: false,
      checks: {
        gitLockFree: false,
        gitStatusClean: false,
      },
      reason: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get configured Mind repo path
 */
export function getMindRepoPath(): string {
  return MIND_REPO_PATH;
}

/**
 * Get git lock file path
 */
export function getGitLockPath(): string {
  return GIT_LOCK_FILE;
}
