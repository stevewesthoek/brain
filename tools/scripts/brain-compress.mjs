#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CACHE_DIR = path.join(os.homedir(), '.brain', 'cache', 'compression');
const DEFAULT_KEEP = 24;

function usage() {
  console.log(`Usage:
  brain-compress compress [file|-] [--type auto|json|log|text] [--keep N] [--json] [--no-store]
  brain-compress retrieve <hash> [--query TEXT]
  brain-compress eval [file|-] [--type auto|json|log|text] [--needle TEXT] [--keep N] [--json]

Purpose:
  Explicit, reversible compression for large JSON, logs, and text. This is not a proxy
  and does not route Claude, Codex, Gemini, or application model calls.`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (['json', 'no-store'].includes(key)) {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readInput(target) {
  if (!target || target === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(target, 'utf8');
}

function tokenEstimate(text) {
  return Math.ceil(String(text).length / 4);
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
}

function writeOriginal(hash, original, metadata) {
  ensureCacheDir();
  const contentPath = path.join(CACHE_DIR, `${hash}.txt`);
  const metadataPath = path.join(CACHE_DIR, `${hash}.json`);
  fs.writeFileSync(contentPath, original, { mode: 0o600 });
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', { mode: 0o600 });
}

function detectType(text, requested) {
  if (requested && requested !== 'auto') return requested;
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      return 'text';
    }
  }
  const lines = text.split(/\r?\n/);
  const logSignals = lines.filter((line) => /\b(error|warn|fatal|exception|failed|traceback|timeout|denied)\b/i.test(line)).length;
  if (lines.length > 20 && logSignals > 0) return 'log';
  return 'text';
}

function stableStringify(value) {
  if (Array.isArray(value)) return value.map(stableStringify);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableStringify(value[key])]));
  }
  return value;
}

function isImportantJsonItem(item) {
  const text = JSON.stringify(item);
  return /\b(error|warn|fatal|exception|failed|critical|denied|timeout|unauthorized|traceback)\b/i.test(text);
}

function compressArray(array, keep) {
  if (array.length <= keep) return array;
  const firstCount = Math.max(2, Math.floor(keep * 0.25));
  const lastCount = Math.max(2, Math.floor(keep * 0.15));
  const selected = new Map();

  array.slice(0, firstCount).forEach((item, index) => selected.set(index, item));
  array.slice(-lastCount).forEach((item, offset) => selected.set(array.length - lastCount + offset, item));
  array.forEach((item, index) => {
    if (isImportantJsonItem(item)) selected.set(index, item);
  });

  for (let i = firstCount; i < array.length - lastCount && selected.size < keep; i += Math.max(1, Math.floor(array.length / keep))) {
    selected.set(i, array[i]);
  }

  const items = [...selected.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, item]) => ({ __index: index, value: item }));

  return {
    __brain_compressed_array: true,
    original_count: array.length,
    kept_count: items.length,
    selection: 'first + last + error-like + even sample',
    items,
  };
}

function compressJsonValue(value, keep, depth = 0) {
  if (depth > 5) return value;
  if (Array.isArray(value)) return compressArray(value.map((item) => compressJsonValue(item, keep, depth + 1)), keep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, compressJsonValue(value[key], keep, depth + 1)]),
    );
  }
  return value;
}

function compressJson(text, keep) {
  const parsed = JSON.parse(text);
  return JSON.stringify(stableStringify(compressJsonValue(parsed, keep)));
}

function compressLines(text, keep) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= keep) return text;

  const selected = new Map();
  const first = Math.max(4, Math.floor(keep * 0.25));
  const last = Math.max(4, Math.floor(keep * 0.25));
  lines.slice(0, first).forEach((line, index) => selected.set(index, line));
  lines.slice(-last).forEach((line, offset) => selected.set(lines.length - last + offset, line));

  lines.forEach((line, index) => {
    if (/\b(error|warn|fatal|exception|failed|critical|denied|timeout|unauthorized|traceback)\b/i.test(line)) {
      selected.set(index, line);
    }
  });

  const seen = new Set();
  const compact = [...selected.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, line]) => {
      const normalized = line.trim().replace(/\d{2,}/g, '#');
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

  const output = [];
  let previousIndex = -1;
  for (const [index, line] of compact) {
    if (previousIndex !== -1 && index > previousIndex + 1) {
      output.push(`[... ${index - previousIndex - 1} line(s) omitted; original is retrievable ...]`);
    }
    output.push(line);
    previousIndex = index;
  }
  return output.join('\n');
}

function compressText(text, keep) {
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length <= keep / 3) return compressLines(text, keep);
  const selected = [];
  paragraphs.forEach((paragraph, index) => {
    if (index < 3 || index >= paragraphs.length - 3 || /^#{1,6}\s/.test(paragraph) || /\b(error|failed|warning|important|decision|summary)\b/i.test(paragraph)) {
      selected.push(paragraph.trim());
    }
  });
  return selected.join('\n\n[... paragraph(s) omitted; original is retrievable ...]\n\n');
}

function compressContent(text, type, keep) {
  if (type === 'json') return compressJson(text, keep);
  if (type === 'log') return compressLines(text, keep);
  return compressText(text, keep);
}

function outputResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error(`brain-compress: ${result.type}; ${result.tokens_before} -> ${result.tokens_after} est. tokens; saved ${result.tokens_saved}; hash ${result.hash}`);
  console.log(result.compressed);
}

function retrieve(hash, query) {
  const contentPath = path.join(CACHE_DIR, `${hash}.txt`);
  if (!fs.existsSync(contentPath)) {
    throw new Error(`No cached original found for hash ${hash}`);
  }
  const original = fs.readFileSync(contentPath, 'utf8');
  if (!query) return original;
  return original
    .split(/\r?\n/)
    .filter((line) => line.toLowerCase().includes(query.toLowerCase()))
    .join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    usage();
    return;
  }

  if (command === 'retrieve') {
    const hash = args._[1];
    if (!hash) throw new Error('retrieve requires a hash');
    console.log(retrieve(hash, args.query));
    return;
  }

  if (!['compress', 'eval'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const target = args._[1] || '-';
  const original = readInput(target);
  const keep = Number.parseInt(args.keep || String(DEFAULT_KEEP), 10);
  const type = detectType(original, args.type || 'auto');
  const hash = hashContent(original);
  const candidate = compressContent(original, type, keep);
  const compressed = tokenEstimate(candidate) < tokenEstimate(original) ? candidate : original;
  const result = {
    ok: true,
    command,
    type,
    hash,
    cache_path: path.join(CACHE_DIR, `${hash}.txt`),
    tokens_before: tokenEstimate(original),
    tokens_after: tokenEstimate(compressed),
    tokens_saved: tokenEstimate(original) - tokenEstimate(compressed),
    compression_ratio: Number((tokenEstimate(compressed) / Math.max(1, tokenEstimate(original))).toFixed(3)),
    compression_applied: compressed !== original,
    retrievable: !args['no-store'],
    compressed,
  };

  if (!args['no-store']) {
    writeOriginal(hash, original, {
      created_at: new Date().toISOString(),
      source: target,
      type,
      tokens_before: result.tokens_before,
      tokens_after: result.tokens_after,
      command,
    });
  }

  if (command === 'eval') {
    const needle = args.needle || '';
    result.needle = needle || null;
    result.needle_preserved = needle ? compressed.includes(needle) || original.includes(needle) : null;
    result.retrieve_check = retrieve(hash, needle || undefined).length > 0;
  }

  outputResult(result, Boolean(args.json));
}

try {
  main();
} catch (error) {
  console.error(`brain-compress: ${error.message}`);
  process.exit(1);
}
