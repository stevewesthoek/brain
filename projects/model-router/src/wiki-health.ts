import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_REQUIRED_FILES = ['wiki/index.md', 'wiki/log.md', 'sources/index.md'] as const;
const DEFAULT_WIKI_LIMIT = 500;
const DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS = 7;
const DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS = 3;
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'runtime'];

export type MindWikiHealthSeverity = 'info' | 'warning' | 'error';

export interface MindWikiHealthFinding {
  id: string;
  severity: MindWikiHealthSeverity;
  path: string;
  message: string;
  recommendation: string;
  writesToMind: false;
}

export interface MindWikiHealthSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  staleCaptureCount: number;
  failedCaptureCount: number;
  oversizedWikiPageCount: number;
  missingSourceTraceCount: number;
}

export interface MindWikiHealthResult {
  kind: 'mind-wiki-health';
  ok: boolean;
  checkedAt: string;
  checkedPaths: string[];
  findings: MindWikiHealthFinding[];
  summary: MindWikiHealthSummary;
  writesToMind: false;
  externalSideEffects: false;
}

export function createMindWikiHealthResultFromRoot(rootPath: string, now = new Date()): MindWikiHealthResult {
  const normalizedRoot = path.resolve(rootPath);
  if (!isSafeRootPath(normalizedRoot)) {
    throw new Error(`Unsafe model-router wiki health root path: ${rootPath}`);
  }

  const checkedPaths = [...DEFAULT_REQUIRED_FILES];
  const findings: MindWikiHealthFinding[] = [];
  const visitedWikiFiles = listMarkdownFiles(path.join(normalizedRoot, 'wiki'));

  for (const required of DEFAULT_REQUIRED_FILES) {
    if (!exists(normalizedRoot, required)) {
      findings.push(createFinding('missing-required-file', 'error', required, `Missing required wiki contract file: ${required}`, `Create ${required} with the required Mind OS contract content.`));
    }
  }

  if (exists(normalizedRoot, 'sources/index.md')) {
    const contents = readText(normalizedRoot, 'sources/index.md').trim();
    if (contents.length === 0) {
      findings.push(createFinding('empty-sources-index', 'error', 'sources/index.md', 'sources/index.md exists but is empty.', 'Add a minimal source catalog so compiled pages can trace back to sources.'));
    }
  }

  if (exists(normalizedRoot, 'wiki/index.md')) {
    const indexContents = readText(normalizedRoot, 'wiki/index.md');
    const knownIndexLinks = extractWikiLinks(indexContents).map(normalizeWikiLink);

    for (const filePath of visitedWikiFiles) {
      const relative = path.relative(normalizedRoot, filePath).replace(/\\/g, '/');
      if (relative === 'wiki/index.md' || relative === 'wiki/log.md') continue;
      const contents = fs.readFileSync(filePath, 'utf8');
      if (lineCount(contents) > DEFAULT_WIKI_LIMIT) {
        findings.push(createFinding('oversized-wiki-page', 'warning', relative, `${relative} exceeds the wiki target line limit of ${DEFAULT_WIKI_LIMIT}.`, 'Split the page or move subtopics into linked pages.'));
      }
      if (!containsSourceTrace(contents)) {
        findings.push(createFinding('missing-source-trace', 'warning', relative, `${relative} does not contain an obvious source trace marker.`, 'Add a brief source or capture link when the page is compiled from evidence.'));
      }
      if (!isReferencedByIndex(relative, knownIndexLinks)) {
        findings.push(createFinding('orphan-wiki-page', 'warning', relative, `${relative} is not referenced from wiki/index.md.`, 'Add the page to wiki/index.md if it is meant to be discoverable.'));
      }
    }
  }

  const staleCaptureCutoff = now.getTime() - DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const failedCaptureCutoff = now.getTime() - DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const captureFile of listAllFiles(path.join(normalizedRoot, 'capture', 'inbox'))) {
    const relative = path.relative(normalizedRoot, captureFile).replace(/\\/g, '/');
    const modifiedAt = fs.statSync(captureFile).mtime.getTime();
    if (modifiedAt < staleCaptureCutoff) {
      findings.push(createFinding('stale-capture-inbox', 'warning', relative, `${relative} is older than ${DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS} days.`, 'Review, route, or archive the capture.'));
    }
  }

  for (const failedFile of listAllFiles(path.join(normalizedRoot, 'capture', 'failed'))) {
    const relative = path.relative(normalizedRoot, failedFile).replace(/\\/g, '/');
    const modifiedAt = fs.statSync(failedFile).mtime.getTime();
    if (modifiedAt < failedCaptureCutoff) {
      findings.push(createFinding('stale-failed-capture', 'warning', relative, `${relative} is older than ${DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS} days.`, 'Retry or review the failed capture.'));
    }
  }

  const summary: MindWikiHealthSummary = {
    errorCount: findings.filter((finding) => finding.severity === 'error').length,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    staleCaptureCount: findings.filter((finding) => finding.id === 'stale-capture-inbox').length,
    failedCaptureCount: findings.filter((finding) => finding.id === 'stale-failed-capture').length,
    oversizedWikiPageCount: findings.filter((finding) => finding.id === 'oversized-wiki-page').length,
    missingSourceTraceCount: findings.filter((finding) => finding.id === 'missing-source-trace').length,
  };

  return {
    kind: 'mind-wiki-health',
    ok: summary.errorCount === 0,
    checkedAt: now.toISOString(),
    checkedPaths,
    findings,
    summary,
    writesToMind: false,
    externalSideEffects: false,
  };
}

function createFinding(
  id: string,
  severity: MindWikiHealthSeverity,
  filePath: string,
  message: string,
  recommendation: string,
): MindWikiHealthFinding {
  return {
    id,
    severity,
    path: filePath,
    message,
    recommendation,
    writesToMind: false,
  };
}

function exists(rootPath: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootPath, relativePath));
}

function readText(rootPath: string, relativePath: string): string {
  return fs.readFileSync(path.join(rootPath, relativePath), 'utf8');
}

function listMarkdownFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolute);
    }
  }
  return files;
}

function listAllFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listAllFiles(absolute));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function lineCount(contents: string): number {
  return contents.split('\n').length;
}

function containsSourceTrace(contents: string): boolean {
  return [
    'source:',
    'sources:',
    '[[sources/',
    'capture:',
    'captures:',
    '[[capture/',
    'Source',
    'Sources',
  ].some((needle) => contents.includes(needle));
}

function extractWikiLinks(contents: string): string[] {
  const matches = contents.matchAll(/\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|[^\]]*)?\]\]/g);
  return Array.from(matches, (match) => match[1] ?? '');
}

function normalizeWikiLink(link: string): string {
  return link.replace(/^\.\//, '').replace(/\.md$/i, '');
}

function isReferencedByIndex(relativePath: string, knownLinks: string[]): boolean {
  const normalized = relativePath.replace(/^wiki\//, '').replace(/\.md$/i, '');
  return knownLinks.some((link) => normalizeWikiLink(link) === normalized || normalizeWikiLink(link) === relativePath);
}

function isSafeRootPath(rootPath: string): boolean {
  const normalized = rootPath.replace(/\\/g, '/').toLowerCase();
  return !DISALLOWED_SEGMENTS.some((segment) => normalized.includes(segment));
}
