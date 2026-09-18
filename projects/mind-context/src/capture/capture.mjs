import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_CAPTURE_BYTES = 1024 * 1024;

function normalizeText(value, field) {
  if (typeof value !== 'string') throw new Error(`invalid_${field}`);
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) throw new Error(`missing_${field}`);
  return normalized;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function resolveCaptureRoot(root) {
  if (!root) throw new Error('missing_root');
  const resolved = path.resolve(String(root));
  let stat;
  let real;
  try {
    stat = fs.statSync(resolved);
    real = fs.realpathSync(resolved);
  } catch {
    throw new Error('invalid_capture_root');
  }
  if (!stat.isDirectory()) throw new Error('invalid_capture_root');
  return real;
}

export function resolveInboxNew(root) {
  const resolvedRoot = resolveCaptureRoot(root);
  const inbox = path.resolve(resolvedRoot, 'inbox', 'new');
  const relative = path.relative(resolvedRoot, inbox);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('capture_path_outside_root');
  return {root: resolvedRoot, inbox};
}

export function buildRawCapture({content, sourceType = 'manual', provenance = 'manual', capturedAt = new Date().toISOString(), captureId} = {}) {
  const normalizedContent = normalizeText(content, 'content');
  if (Buffer.byteLength(normalizedContent, 'utf8') > MAX_CAPTURE_BYTES) throw new Error('capture_too_large');
  const normalizedSourceType = normalizeText(sourceType, 'source_type');
  const normalizedProvenance = normalizeText(provenance, 'provenance');
  const timestamp = new Date(capturedAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error('invalid_captured_at');
  const iso = timestamp.toISOString();
  const id = captureId ?? crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))) throw new Error('invalid_capture_id');

  const markdown = [
    '---',
    `capture_id: ${yamlString(id)}`,
    `captured_at: ${yamlString(iso)}`,
    `source_type: ${yamlString(normalizedSourceType)}`,
    `provenance: ${yamlString(normalizedProvenance)}`,
    'status: "raw"',
    'authority: "unreviewed"',
    '---',
    '',
    '# Raw capture',
    '',
    normalizedContent,
    '',
  ].join('\n');

  return {captureId: id, capturedAt: iso, sourceType: normalizedSourceType, provenance: normalizedProvenance, content: normalizedContent, markdown};
}

export function writeRawCapture({root, ...input} = {}) {
  const {root: resolvedRoot, inbox} = resolveInboxNew(root);
  const capture = buildRawCapture(input);
  fs.mkdirSync(inbox, {recursive: true});
  const realInbox = fs.realpathSync(inbox);
  const inboxRelative = path.relative(resolvedRoot, realInbox);
  if (!inboxRelative || inboxRelative.startsWith('..') || path.isAbsolute(inboxRelative)) throw new Error('capture_path_outside_root');
  const safeTimestamp = capture.capturedAt.replace(/[:.]/g, '-');
  const filename = `${safeTimestamp}-${capture.captureId}.md`;
  const target = path.resolve(realInbox, filename);
  const relative = path.relative(resolvedRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('capture_path_outside_root');
  fs.writeFileSync(target, capture.markdown, {encoding: 'utf8', flag: 'wx', mode: 0o600});
  return {
    captureId: capture.captureId,
    capturedAt: capture.capturedAt,
    sourceType: capture.sourceType,
    provenance: capture.provenance,
    relativePath: relative.split(path.sep).join('/'),
  };
}

export {MAX_CAPTURE_BYTES};
