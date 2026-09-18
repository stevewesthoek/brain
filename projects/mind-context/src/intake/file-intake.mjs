import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {MAX_CAPTURE_BYTES, writeRawCapture} from '../capture/capture.mjs';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.html', '.htm', '.xml', '.yaml', '.yml', '.log']);
const URL_EXTENSIONS = new Set(['.url', '.webloc']);
const KIND_BY_EXTENSION = new Map([
  ['.pdf', 'pdf'], ['.doc', 'document'], ['.docx', 'document'], ['.pages', 'document'], ['.rtf', 'document'],
  ['.mp3', 'audio'], ['.m4a', 'audio'], ['.wav', 'audio'], ['.aac', 'audio'], ['.flac', 'audio'],
  ['.mp4', 'video'], ['.mov', 'video'], ['.m4v', 'video'], ['.webm', 'video'], ['.avi', 'video'], ['.mkv', 'video'],
  ['.png', 'image'], ['.jpg', 'image'], ['.jpeg', 'image'], ['.webp', 'image'], ['.heic', 'image'],
]);

function ensureDirectory(value, code) {
  if (!value) throw new Error(code);
  const resolved = path.resolve(String(value));
  fs.mkdirSync(resolved, {recursive: true});
  if (!fs.statSync(resolved).isDirectory()) throw new Error(code);
  return fs.realpathSync(resolved);
}

export function defaultArtifactRoot() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Evermind', 'artifacts');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'Evermind', 'artifacts');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'evermind', 'artifacts');
}

function fileSha256(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function fileSignatureFromStat(stat) {
  return `${stat.size}:${stat.mtimeNs?.toString() ?? Math.round(stat.mtimeMs)}:${stat.ino ?? ''}`;
}

export function fileSignature(file) {
  return fileSignatureFromStat(fs.statSync(file));
}

export function inferFileKind(file) {
  const ext = path.extname(file).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (URL_EXTENSIONS.has(ext)) return 'url';
  return KIND_BY_EXTENSION.get(ext) ?? 'file';
}

function parseUrlShortcut(file, content) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.url') return content.match(/^URL=(.+)$/im)?.[1]?.trim() ?? '';
  if (ext === '.webloc') return content.match(/<string>(https?:\/\/[^<]+)<\/string>/i)?.[1]?.replaceAll('&amp;', '&').trim() ?? '';
  return '';
}

function extractImmediate(file, kind, stat) {
  if (kind === 'text' && stat.size <= MAX_CAPTURE_BYTES / 2) return {status: 'extracted', text: fs.readFileSync(file, 'utf8').trim()};
  if (kind === 'url' && stat.size <= 128 * 1024) {
    const url = parseUrlShortcut(file, fs.readFileSync(file, 'utf8'));
    return url ? {status: 'url-detected', text: url} : {status: 'pending', text: ''};
  }
  return {status: 'pending', text: ''};
}

function buildContent({basename, kind, stat, hash, artifact, extraction}) {
  const lines = [
    '# Dropped file', '',
    `Original filename: ${basename}`,
    `Source kind: ${kind}`,
    `Size bytes: ${stat.size}`,
    `SHA-256: ${hash}`,
    `Artifact: ${artifact}`,
    `Extraction status: ${extraction.status}`,
  ];
  if (extraction.text) lines.push('', '## Extracted input', '', extraction.text);
  else lines.push('', 'Extraction/analysis is pending. The raw artifact is preserved locally for the processing pipeline.');
  return lines.join('\n');
}

export function ingestDroppedFile({root, dropFolder, artifactRoot = defaultArtifactRoot(), filePath} = {}) {
  const resolvedDrop = ensureDirectory(dropFolder, 'invalid_drop_folder');
  const resolvedArtifacts = ensureDirectory(artifactRoot, 'invalid_artifact_root');
  const candidate = fs.realpathSync(path.resolve(filePath));
  const relativeToDrop = path.relative(resolvedDrop, candidate);
  if (!relativeToDrop || relativeToDrop.startsWith('..') || path.isAbsolute(relativeToDrop) || relativeToDrop.split(path.sep).includes('.evermind')) throw new Error('drop_file_outside_folder');
  const stat = fs.statSync(candidate);
  if (!stat.isFile()) throw new Error('invalid_drop_file');

  const initialSignature = fileSignatureFromStat(stat);
  const hash = fileSha256(candidate);
  const captureId = crypto.randomUUID();
  const basename = path.basename(candidate);
  const targetDir = path.join(resolvedArtifacts, captureId);
  const target = path.join(targetDir, basename);
  const kind = inferFileKind(candidate);
  const extraction = extractImmediate(candidate, kind, stat);
  const artifact = `${captureId}/${basename}`.split(path.sep).join('/');
  try {
    fs.mkdirSync(targetDir, {recursive: false, mode: 0o700});
    fs.copyFileSync(candidate, target, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target, 0o600);
    if (fileSignature(candidate) !== initialSignature) throw new Error('source_changed_during_ingest');
    const capture = writeRawCapture({
      root,
      captureId,
      content: buildContent({basename, kind, stat, hash, artifact, extraction}),
      sourceType: kind === 'url' ? 'drop-url' : `drop-${kind}`,
      provenance: `drop-folder:${resolvedDrop}`,
    });
    return {...capture, artifactRoot: resolvedArtifacts, artifact, hash, kind, extractionStatus: extraction.status, sourceFile: candidate};
  } catch (error) {
    try { fs.unlinkSync(target); } catch {}
    try { fs.rmdirSync(targetDir); } catch {}
    throw error;
  }
}

export {TEXT_EXTENSIONS, URL_EXTENSIONS};
