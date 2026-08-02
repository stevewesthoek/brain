import fs from 'node:fs';
import path from 'node:path';
import { describeMindPath, resolveCanonicalMindPath } from './path-registry.js';
const DEFAULT_REQUIRED_FILES = ['wiki/log.md'];
const INBOX_NEW = resolveCanonicalMindPath('inbox-new');
const INBOX_FAILED = resolveCanonicalMindPath('inbox-failed');
const DEFAULT_WIKI_LIMIT = 500;
const DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS = 7;
const DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS = 3;
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'runtime'];
export function createMindWikiHealthResultFromRoot(rootPath, now = new Date()) {
    const normalizedRoot = path.resolve(rootPath);
    if (!isSafeRootPath(normalizedRoot)) {
        throw new Error(`Unsafe mind-steward wiki health root path: ${rootPath}`);
    }
    const checkedPaths = [...DEFAULT_REQUIRED_FILES];
    const findings = [];
    for (const required of DEFAULT_REQUIRED_FILES) {
        if (!exists(normalizedRoot, required)) {
            findings.push(createFinding('missing-required-file', 'error', required, `Missing required wiki contract file: ${required}`, `Create ${required} with the required Mind OS contract content.`));
        }
    }
    const staleCaptureCutoff = now.getTime() - DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const failedCaptureCutoff = now.getTime() - DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    for (const captureFile of listAllFiles(path.join(normalizedRoot, INBOX_NEW))) {
        const relative = path.relative(normalizedRoot, captureFile).replace(/\\/g, '/');
        const modifiedAt = fs.statSync(captureFile).mtime.getTime();
        if (modifiedAt < staleCaptureCutoff) {
            findings.push(createFinding('stale-capture-inbox', 'warning', relative, `${relative} is older than ${DEFAULT_CAPTURE_INBOX_MAX_AGE_DAYS} days.`, 'Review, route, or archive the capture.'));
        }
    }
    for (const failedFile of listAllFiles(path.join(normalizedRoot, INBOX_FAILED))) {
        const relative = path.relative(normalizedRoot, failedFile).replace(/\\/g, '/');
        const modifiedAt = fs.statSync(failedFile).mtime.getTime();
        if (modifiedAt < failedCaptureCutoff) {
            findings.push(createFinding('stale-failed-capture', 'warning', relative, `${relative} is older than ${DEFAULT_FAILED_CAPTURE_MAX_AGE_DAYS} days.`, 'Retry or review the failed capture.'));
        }
    }
    const summary = {
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
function createFinding(id, severity, filePath, message, recommendation) {
    return {
        id,
        severity,
        path: filePath,
        message,
        recommendation,
        writesToMind: false,
    };
}
function exists(rootPath, relativePath) {
    return fs.existsSync(path.join(rootPath, relativePath));
}
function readText(rootPath, relativePath) {
    return fs.readFileSync(path.join(rootPath, relativePath), 'utf8');
}
function listMarkdownFiles(directoryPath) {
    if (!fs.existsSync(directoryPath))
        return [];
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const files = [];
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
function listAllFiles(directoryPath) {
    if (!fs.existsSync(directoryPath))
        return [];
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const files = [];
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
function lineCount(contents) {
    return contents.split('\n').length;
}
function containsSourceTrace(contents) {
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
function extractWikiLinks(contents) {
    const matches = contents.matchAll(/\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|[^\]]*)?\]\]/g);
    return Array.from(matches, (match) => match[1] ?? '');
}
function normalizeWikiLink(link) {
    return link.replace(/^\.\//, '').replace(/\.md$/i, '');
}
function isReferencedByIndex(relativePath, knownLinks) {
    const normalized = relativePath.replace(/^wiki\//, '').replace(/\.md$/i, '');
    return knownLinks.some((link) => normalizeWikiLink(link) === normalized || normalizeWikiLink(link) === relativePath);
}
function isSafeRootPath(rootPath) {
    const normalized = rootPath.replace(/\\/g, '/').toLowerCase();
    return !DISALLOWED_SEGMENTS.some((segment) => normalized.includes(segment));
}
