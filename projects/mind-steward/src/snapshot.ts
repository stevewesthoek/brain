import fs from 'node:fs';
import path from 'node:path';
import type { MindContractSnapshot, MindPathKind, MindPathStatus } from './contracts.js';

const DISALLOWED_SEGMENTS = ['.env', '.git', 'node_modules', 'dist', 'build'];
const SMALL_MARKDOWN_SIZE_LIMIT = 256 * 1024;
const SMALL_MARKDOWN_LINE_LIMIT = 5000;

export function createMindPathSnapshotFromRoot(rootPath: string, relativePaths: string[]): MindContractSnapshot {
  const normalizedRoot = path.resolve(rootPath);
  if (!isSafeRootPath(normalizedRoot)) {
    throw new Error(`Unsafe mind-steward root path: ${rootPath}`);
  }

  return {
    paths: relativePaths.map((relativePath) => collectPathStatus(normalizedRoot, relativePath)),
  };
}

function collectPathStatus(rootPath: string, relativePath: string): MindPathStatus {
  const absolutePath = path.resolve(rootPath, relativePath);
  const exists = fs.existsSync(absolutePath);

  if (!exists) {
    return {
      path: relativePath,
      kind: pathHasTrailingSlash(relativePath) ? 'directory' : 'file',
      exists: false,
    };
  }

  const stats = fs.lstatSync(absolutePath);
  const kind: MindPathKind = stats.isDirectory() ? 'directory' : 'file';
  const status: MindPathStatus = {
    path: relativePath,
    kind,
    exists: true,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    followedSymlink: stats.isSymbolicLink(),
  };

  if (kind === 'file' && isSmallMarkdownFile(relativePath, stats.size)) {
    const contents = fs.readFileSync(absolutePath, 'utf8');
    status.lineCount = contents.split('\n').length;
  }

  return status;
}

function isSmallMarkdownFile(relativePath: string, sizeBytes: number): boolean {
  return relativePath.toLowerCase().endsWith('.md') && sizeBytes <= SMALL_MARKDOWN_SIZE_LIMIT;
}

function pathHasTrailingSlash(relativePath: string): boolean {
  return relativePath.endsWith(path.sep) || relativePath.endsWith('/');
}

function isSafeRootPath(rootPath: string): boolean {
  const normalized = rootPath.replace(/\\/g, '/').toLowerCase();
  return !DISALLOWED_SEGMENTS.some((segment) => normalized.includes(segment));
}
