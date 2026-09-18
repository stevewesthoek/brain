import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveCaptureRoot} from '../capture/capture.mjs';

const DURABLE_ROOTS = new Set([
  'organizations',
  'projects',
  'repos',
  'people',
  'faith',
  'knowledge',
  'resources',
  'history',
]);

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try { return JSON.parse(trimmed); }
    catch { return trimmed.slice(1, -1); }
  }
  return trimmed;
}

function parseFrontmatter(markdown) {
  if (typeof markdown !== 'string' || !markdown.startsWith('---\n')) return {metadata: {}, body: markdown};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {metadata: {}, body: markdown};
  const metadata = {};
  for (const line of markdown.slice(4, end).split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    metadata[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return {metadata, body: markdown.slice(end + 5)};
}

function parseCaptureMarkdown(markdown, sourcePath) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('invalid_capture_document');
  const {metadata, body: rawBody} = parseFrontmatter(markdown);
  const native = metadata.capture_id && metadata.status === 'raw' && metadata.authority === 'unreviewed';
  if (native) {
    const body = rawBody.replace(/^\s*# Raw capture\s*\n+/i, '').trim();
    return {
      captureId: String(metadata.capture_id),
      capturedAt: String(metadata.captured_at ?? ''),
      sourceType: String(metadata.source_type ?? ''),
      provenance: String(metadata.provenance ?? ''),
      status: String(metadata.status),
      authority: String(metadata.authority),
      content: body,
      sourcePath,
      legacy: false,
    };
  }

  const normalized = markdown.trim();
  const basename = path.basename(sourcePath ?? 'legacy-capture.md');
  const digest = crypto.createHash('sha256').update(`${basename}\n${normalized}`).digest('hex').slice(0, 24);
  const inferredSource = metadata.source ?? metadata.tool ?? 'legacy-markdown';
  const inferredCapturedAt = metadata.created ?? metadata.captured_at ?? metadata.extracted ?? '';
  return {
    captureId: `legacy-${digest}`,
    capturedAt: String(inferredCapturedAt),
    sourceType: String(metadata.type ?? 'legacy'),
    provenance: String(inferredSource),
    status: 'raw',
    authority: 'unreviewed',
    content: normalized,
    sourcePath,
    legacy: true,
  };
}

function reviewPaths(root) {
  const resolvedRoot = resolveCaptureRoot(root);
  return {
    root: resolvedRoot,
    newDir: path.join(resolvedRoot, 'inbox', 'new'),
    rawDir: path.join(resolvedRoot, 'inbox', 'raw'),
    processedDir: path.join(resolvedRoot, 'inbox', 'processed'),
  };
}

function captureFiles(root) {
  const {newDir} = reviewPaths(root);
  if (!fs.existsSync(newDir)) return [];
  return fs.readdirSync(newDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => path.join(newDir, name));
}

function loadCaptureFile(file) {
  return parseCaptureMarkdown(fs.readFileSync(file, 'utf8'), file);
}

export function listReviewQueue({root} = {}) {
  const items = [];
  for (const file of captureFiles(root)) {
    try {
      const capture = loadCaptureFile(file);
      items.push({
        captureId: capture.captureId,
        capturedAt: capture.capturedAt,
        sourceType: capture.sourceType,
        provenance: capture.provenance,
        legacy: capture.legacy,
        preview: capture.content.slice(0, 180),
        relativePath: path.relative(resolveCaptureRoot(root), file).split(path.sep).join('/'),
      });
    } catch {
      items.push({
        captureId: null,
        state: 'invalid',
        relativePath: path.relative(resolveCaptureRoot(root), file).split(path.sep).join('/'),
      });
    }
  }
  return items;
}

export function getReviewCapture({root, captureId} = {}) {
  if (!captureId) throw new Error('missing_capture_id');
  for (const file of captureFiles(root)) {
    try {
      const capture = loadCaptureFile(file);
      if (capture.captureId === captureId) {
        const relativePath = path.relative(resolveCaptureRoot(root), file).split(path.sep).join('/');
        return {...capture, relativePath};
      }
    } catch {
      // Invalid inbox files remain visible in listReviewQueue but are not reviewable captures.
    }
  }
  throw new Error('capture_not_found');
}

function resolveDestination(root, destination) {
  if (typeof destination !== 'string' || !destination.trim()) throw new Error('missing_destination');
  const normalized = destination.trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.isAbsolute(normalized) || normalized.split('/').includes('..')) throw new Error('invalid_destination');
  const first = normalized.split('/')[0];
  if (!DURABLE_ROOTS.has(first)) throw new Error('invalid_destination');
  if (path.extname(normalized).toLowerCase() !== '.md') throw new Error('invalid_destination');
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('invalid_destination');
  return {absolute, relative: relative.split(path.sep).join('/')};
}

function receiptMarkdown({capture, decision, reviewedAt, destination, reason, archivedSource}) {
  return [
    '---',
    `capture_id: ${JSON.stringify(capture.captureId)}`,
    `reviewed_at: ${JSON.stringify(reviewedAt)}`,
    `decision: ${JSON.stringify(decision)}`,
    `source_capture: ${JSON.stringify(archivedSource)}`,
    ...(destination ? [`destination: ${JSON.stringify(destination)}`] : []),
    ...(reason ? [`reason: ${JSON.stringify(reason)}`] : []),
    '---',
    '',
    '# Evermind review receipt',
    '',
    `Decision: ${decision}`,
    destination ? `Destination: ${destination}` : '',
    reason ? `Reason: ${reason}` : '',
    '',
  ].filter((line) => line !== '').join('\n') + '\n';
}

function archiveCapture(paths, capture) {
  fs.mkdirSync(paths.rawDir, {recursive: true});
  const archived = path.join(paths.rawDir, path.basename(capture.sourcePath));
  if (fs.existsSync(archived)) throw new Error('review_archive_exists');
  fs.renameSync(capture.sourcePath, archived);
  return archived;
}

function writeReceipt(paths, capture, data) {
  fs.mkdirSync(paths.processedDir, {recursive: true});
  const safeTimestamp = data.reviewedAt.replace(/[:.]/g, '-');
  const filename = `${safeTimestamp}-review-${capture.captureId}.md`;
  const receiptPath = path.join(paths.processedDir, filename);
  fs.writeFileSync(receiptPath, receiptMarkdown({capture, ...data}), {encoding: 'utf8', flag: 'wx', mode: 0o600});
  return receiptPath;
}

export function approveReviewCapture({root, captureId, destination, content, reviewedAt = new Date().toISOString()} = {}) {
  const paths = reviewPaths(root);
  const capture = getReviewCapture({root: paths.root, captureId});
  const target = resolveDestination(paths.root, destination);
  const approvedContent = typeof content === 'string' && content.trim() ? content.trim() : capture.content;
  if (!approvedContent) throw new Error('missing_approved_content');
  if (fs.existsSync(target.absolute)) throw new Error('destination_exists');

  fs.mkdirSync(path.dirname(target.absolute), {recursive: true});
  fs.writeFileSync(target.absolute, `${approvedContent}\n`, {encoding: 'utf8', flag: 'wx', mode: 0o600});

  let archived;
  try {
    archived = archiveCapture(paths, capture);
    const archivedSource = path.relative(paths.root, archived).split(path.sep).join('/');
    const receiptPath = writeReceipt(paths, capture, {
      decision: 'approved',
      reviewedAt,
      destination: target.relative,
      archivedSource,
    });
    return {
      captureId,
      decision: 'approved',
      destination: target.relative,
      archivedSource,
      receipt: path.relative(paths.root, receiptPath).split(path.sep).join('/'),
    };
  } catch (error) {
    try {
      if (archived && fs.existsSync(archived) && !fs.existsSync(capture.sourcePath)) fs.renameSync(archived, capture.sourcePath);
      if (fs.existsSync(target.absolute)) fs.unlinkSync(target.absolute);
    } catch {
      // Best-effort rollback; surface the original failure.
    }
    throw error;
  }
}

export function rejectReviewCapture({root, captureId, reason = '', reviewedAt = new Date().toISOString()} = {}) {
  const paths = reviewPaths(root);
  const capture = getReviewCapture({root: paths.root, captureId});
  let archived;
  try {
    archived = archiveCapture(paths, capture);
    const archivedSource = path.relative(paths.root, archived).split(path.sep).join('/');
    const receiptPath = writeReceipt(paths, capture, {
      decision: 'rejected',
      reviewedAt,
      reason: typeof reason === 'string' ? reason.trim() : '',
      archivedSource,
    });
    return {
      captureId,
      decision: 'rejected',
      archivedSource,
      receipt: path.relative(paths.root, receiptPath).split(path.sep).join('/'),
    };
  } catch (error) {
    try {
      if (archived && fs.existsSync(archived) && !fs.existsSync(capture.sourcePath)) fs.renameSync(archived, capture.sourcePath);
    } catch {
      // Best-effort rollback; surface the original failure.
    }
    throw error;
  }
}

export {DURABLE_ROOTS, parseCaptureMarkdown, resolveDestination};
