/**
 * Infinite Brain Metadata Write Allowlist
 * Single-file write scope policy for metadata writer
 *
 * Purpose: Allow only one explicitly allowlisted test file to be written
 * Safety:
 * - allowlistedOnly: true
 * - singleFileOnly: true
 * - arbitraryWritesAllowed: false
 * - deletesFiles: false
 * - movesFiles: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_REPO_PATH = path.resolve(BRAIN_ROOT, '..', 'mind');

const DEFAULT_ALLOWLISTED_TEST_PATH = path.resolve(
  DEFAULT_MIND_REPO_PATH,
  '00_System',
  'InfiniteBrainWriteTest.md'
);

export interface MetadataWriteAllowlistValidation {
  allowed: boolean;
  reason: string;
  normalizedPath: string | null;
  safety: {
    allowlistedOnly: boolean;
    singleFileOnly: boolean;
    arbitraryWritesAllowed: boolean;
    deletesFiles: boolean;
    movesFiles: boolean;
    broadMindAccess: boolean;
  };
}

function getMindRepoPath(): string {
  const envPath = process.env.IBR_MIND_REPO_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return DEFAULT_MIND_REPO_PATH;
}

function getAllowlistedTestPath(): string {
  const envPath = process.env.IBR_METADATA_WRITE_ALLOWLIST_PATH;
  if (envPath) {
    // Env override allowed for tests
    const resolvedPath = path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
    return resolvedPath;
  }
  return DEFAULT_ALLOWLISTED_TEST_PATH;
}

function normalizePath(targetPath: string): string {
  return path.resolve(targetPath);
}

function isPathInsideMind(targetPath: string, mindPath: string): boolean {
  const normalized = normalizePath(targetPath);
  const mindNormalized = normalizePath(mindPath);
  return normalized.startsWith(mindNormalized);
}

/**
 * Returns the single allowlisted metadata write path
 */
export function getMetadataWriteAllowlist(): string {
  return getAllowlistedTestPath();
}

/**
 * Resolves the test path with validation
 */
export function resolveMetadataWriteTestPath(): MetadataWriteAllowlistValidation {
  const testPath = getAllowlistedTestPath();
  const mindPath = getMindRepoPath();

  // Validate: path inside Mind
  if (!isPathInsideMind(testPath, mindPath)) {
    return {
      allowed: false,
      reason: 'Path is outside Mind repo',
      normalizedPath: normalizePath(testPath),
      safety: {
        allowlistedOnly: true,
        singleFileOnly: true,
        arbitraryWritesAllowed: false,
        deletesFiles: false,
        movesFiles: false,
        broadMindAccess: false,
      },
    };
  }

  // Validate: is .md file
  if (!testPath.endsWith('.md')) {
    return {
      allowed: false,
      reason: 'Path is not a markdown (.md) file',
      normalizedPath: normalizePath(testPath),
      safety: {
        allowlistedOnly: true,
        singleFileOnly: true,
        arbitraryWritesAllowed: false,
        deletesFiles: false,
        movesFiles: false,
        broadMindAccess: false,
      },
    };
  }

  // Validate: not a directory
  try {
    const stat = fs.statSync(testPath);
    if ((stat as any).isDirectory?.()) {
      return {
        allowed: false,
        reason: 'Path is a directory, not a file',
        normalizedPath: normalizePath(testPath),
        safety: {
          allowlistedOnly: true,
          singleFileOnly: true,
          arbitraryWritesAllowed: false,
          deletesFiles: false,
          movesFiles: false,
          broadMindAccess: false,
        },
      };
    }
  } catch {
    // File may not exist yet, which is ok for validation
  }

  return {
    allowed: true,
    reason: 'Path passes allowlist validation',
    normalizedPath: normalizePath(testPath),
    safety: {
      allowlistedOnly: true,
      singleFileOnly: true,
      arbitraryWritesAllowed: false,
      deletesFiles: false,
      movesFiles: false,
      broadMindAccess: false,
    },
  };
}

/**
 * Check if a target path is exactly the allowlisted path
 */
export function isMetadataWritePathAllowlisted(targetPath: string): boolean {
  const normalized = normalizePath(targetPath);
  const allowlisted = normalizePath(getAllowlistedTestPath());
  return normalized === allowlisted;
}

/**
 * Validate that only one file is targeted
 * Returns allowed:true only if exactly one target and it is allowlisted
 */
export function validateSingleFileWriteScope(targetPath: string): MetadataWriteAllowlistValidation {
  const normalized = normalizePath(targetPath);

  // Validate single file
  if (!isMetadataWritePathAllowlisted(normalized)) {
    return {
      allowed: false,
      reason: 'Target path is not the allowlisted test file',
      normalizedPath: normalized,
      safety: {
        allowlistedOnly: true,
        singleFileOnly: true,
        arbitraryWritesAllowed: false,
        deletesFiles: false,
        movesFiles: false,
        broadMindAccess: false,
      },
    };
  }

  // Validate: path inside Mind
  const mindPath = getMindRepoPath();
  if (!isPathInsideMind(normalized, mindPath)) {
    return {
      allowed: false,
      reason: 'Target path is outside Mind repo',
      normalizedPath: normalized,
      safety: {
        allowlistedOnly: true,
        singleFileOnly: true,
        arbitraryWritesAllowed: false,
        deletesFiles: false,
        movesFiles: false,
        broadMindAccess: false,
      },
    };
  }

  // Validate: is .md file
  if (!normalized.endsWith('.md')) {
    return {
      allowed: false,
      reason: 'Target is not a markdown (.md) file',
      normalizedPath: normalized,
      safety: {
        allowlistedOnly: true,
        singleFileOnly: true,
        arbitraryWritesAllowed: false,
        deletesFiles: false,
        movesFiles: false,
        broadMindAccess: false,
      },
    };
  }

  // Validate: not a directory
  try {
    const stat = fs.statSync(normalized);
    if ((stat as any).isDirectory?.()) {
      return {
        allowed: false,
        reason: 'Target path is a directory, not a file',
        normalizedPath: normalized,
        safety: {
          allowlistedOnly: true,
          singleFileOnly: true,
          arbitraryWritesAllowed: false,
          deletesFiles: false,
          movesFiles: false,
          broadMindAccess: false,
        },
      };
    }
  } catch {
    // File may not exist yet, which is ok
  }

  return {
    allowed: true,
    reason: 'Target path passes single-file write scope validation',
    normalizedPath: normalized,
    safety: {
      allowlistedOnly: true,
      singleFileOnly: true,
      arbitraryWritesAllowed: false,
      deletesFiles: false,
      movesFiles: false,
      broadMindAccess: false,
    },
  };
}
