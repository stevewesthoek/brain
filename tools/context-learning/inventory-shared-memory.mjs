import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function hashBytes(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject(value[key])]));
  }
  return value;
}

function hashJson(value) {
  return hashBytes(Buffer.from(JSON.stringify(sortedObject(value))));
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      const stat = fs.lstatSync(absolute);

      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }

      if (entry.isSymbolicLink()) {
        output.push({
          relative,
          kind: 'symlink',
          size: stat.size,
          mode: stat.mode & 0o777,
          mtimeMs: Math.trunc(stat.mtimeMs),
          sha256: hashBytes(Buffer.from(fs.readlinkSync(absolute)))
        });
        continue;
      }

      if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        output.push({
          relative,
          kind: 'file',
          size: stat.size,
          mode: stat.mode & 0o777,
          mtimeMs: Math.trunc(stat.mtimeMs),
          sha256: hashBytes(bytes)
        });
      }
    }
  }

  walk(root);
  return output;
}

function classifyMemoryFile(root, record) {
  const base = path.basename(record.relative);
  if (record.kind !== 'file') return { classId: 'unresolved-historical-evidence', entryType: 'symlink-or-special' };
  if (record.relative === 'MEMORY.md') return { classId: 'derived-hot-recall', entryType: 'memory-index' };
  if (record.relative === 'facts.jsonl') return { classId: 'unresolved-historical-evidence', entryType: 'facts-jsonl' };
  if (!base.endsWith('.md')) return { classId: 'unresolved-historical-evidence', entryType: 'other-file' };

  const prefix = fs.readFileSync(path.join(root, record.relative), 'utf8').slice(0, 4096);
  const typeMatch = prefix.match(/^type:\s*([a-zA-Z0-9_-]+)\s*$/m);
  const type = typeMatch?.[1]?.toLowerCase() ?? 'unknown';

  switch (type) {
    case 'user':
      return { classId: 'mind-candidate', entryType: 'user' };
    case 'project':
      return { classId: 'mind-candidate', entryType: 'project' };
    case 'feedback':
      return { classId: 'brain-candidate', entryType: 'feedback' };
    case 'ref':
      return { classId: 'unresolved-historical-evidence', entryType: 'ref' };
    default:
      return { classId: 'unresolved-historical-evidence', entryType: 'unknown-markdown' };
  }
}

function inspectFacts(root) {
  const factsPath = path.join(root, 'facts.jsonl');
  const result = { total: 0, active: 0, inactive: 0, invalid: 0 };
  if (!fs.existsSync(factsPath) || !fs.statSync(factsPath).isFile()) return result;

  const lines = fs.readFileSync(factsPath, 'utf8').split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const line of lines) {
    result.total += 1;
    try {
      const parsed = JSON.parse(line);
      if (parsed.valid_to === null || parsed.valid_to === undefined) result.active += 1;
      else result.inactive += 1;
    } catch {
      result.invalid += 1;
    }
  }
  return result;
}

export function inventorySharedMemory(memoryRoot) {
  const root = path.resolve(memoryRoot);
  const before = walkFiles(root);
  const sourceFingerprintBefore = hashJson(before);

  const classCounts = {};
  const classBytes = {};
  const entryTypes = {};

  for (const record of before) {
    const classification = classifyMemoryFile(root, record);
    classCounts[classification.classId] = (classCounts[classification.classId] ?? 0) + 1;
    classBytes[classification.classId] = (classBytes[classification.classId] ?? 0) + record.size;
    entryTypes[classification.entryType] = (entryTypes[classification.entryType] ?? 0) + 1;
  }

  const facts = inspectFacts(root);
  const after = walkFiles(root);
  const sourceFingerprintAfter = hashJson(after);
  const mutated = sourceFingerprintBefore !== sourceFingerprintAfter;

  const aggregate = {
    exists: fs.existsSync(root),
    fileCount: before.length,
    totalBytes: before.reduce((sum, item) => sum + item.size, 0),
    classCounts,
    classBytes,
    entryTypes,
    facts,
    sourceFingerprint: sourceFingerprintBefore
  };

  return {
    schemaVersion: '1.0.0',
    mode: 'REPORT_ONLY',
    writesAttempted: 0,
    rawContentIncluded: false,
    filenamesIncluded: false,
    memoryRoot: root === path.join(os.homedir(), '.brain', 'memory') ? '~/.brain/memory' : '<explicit-test-root>',
    ...aggregate,
    sourceFingerprintBefore,
    sourceFingerprintAfter,
    mutated,
    inventoryDigest: hashJson(aggregate)
  };
}

function parseRoot(argv) {
  const index = argv.indexOf('--root');
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value) throw new Error('--root requires a path');
    return value;
  }
  return process.env.BRAIN_MEMORY_DIR ?? path.join(os.homedir(), '.brain', 'memory');
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    const report = inventorySharedMemory(parseRoot(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    if (report.mutated) process.exitCode = 2;
  } catch (error) {
    console.error(`shared-memory-inventory failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
