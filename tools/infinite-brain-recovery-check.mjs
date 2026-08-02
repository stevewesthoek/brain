#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_INVENTORY = path.join(ROOT, 'operations/specs/infinite-brain-recovery-inventory.json');
const BANNED_ROOTS = [
  path.resolve(ROOT),
  path.resolve(ROOT, '../mind'),
  path.resolve(ROOT, '../prochattools/saas/workbench-private'),
];

function fail(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  throw error;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value) || value.includes('\0')) fail('invalid_path', { value });
  const normalized = path.normalize(value).replaceAll('\\', '/');
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || normalized.endsWith('/..')) fail('path_traversal_detected', { value });
  return normalized;
}

function assertSafeDestination(destinationRoot) {
  const resolved = path.resolve(destinationRoot);
  if (!path.isAbsolute(resolved)) fail('destination_must_be_absolute', { destinationRoot });
  for (const bannedRoot of BANNED_ROOTS) {
    if (resolved === bannedRoot || resolved.startsWith(`${bannedRoot}${path.sep}`)) {
      fail('live_repository_destination_rejected', { destinationRoot: resolved, bannedRoot });
    }
  }
  return resolved;
}

function validateInventory(inventory) {
  const errors = [];
  if (inventory?.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inventory?.reviewedAt ?? '')) errors.push('reviewedAt must be YYYY-MM-DD');
  if (!Array.isArray(inventory?.entries) || inventory.entries.length === 0) errors.push('entries must be non-empty');
  const ids = new Set();
  const orders = new Set();
  for (const [index, entry] of (inventory.entries ?? []).entries()) {
    const prefix = `entry:${index}`;
    for (const field of ['id', 'sourceRepository', 'sourcePath', 'stateClass', 'recoveryMode', 'restoreOrder', 'sampleContent', 'provenance']) {
      if (!(field in entry)) errors.push(`${prefix}:missing:${field}`);
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) errors.push(`${prefix}:invalid:id`);
    ids.add(entry.id);
    if (!['brain', 'mind'].includes(entry.sourceRepository)) errors.push(`${prefix}:invalid:sourceRepository`);
    try { normalizePath(entry.sourcePath); } catch (error) { errors.push(`${prefix}:invalid:sourcePath:${error.code ?? error.message}`); }
    if (!['canonical', 'generated', 'runtime', 'cache'].includes(entry.stateClass)) errors.push(`${prefix}:invalid:stateClass`);
    if (!['required', 'optional', 'excluded'].includes(entry.recoveryMode)) errors.push(`${prefix}:invalid:recoveryMode`);
    if (!Number.isInteger(entry.restoreOrder) || entry.restoreOrder < 1 || orders.has(entry.restoreOrder)) errors.push(`${prefix}:invalid:restoreOrder`);
    orders.add(entry.restoreOrder);
    if (typeof entry.sampleContent !== 'string') errors.push(`${prefix}:invalid:sampleContent`);
    const provenance = entry.provenance ?? {};
    const reproducible = Array.isArray(provenance.reproducibleSourceRefs) ? provenance.reproducibleSourceRefs : null;
    const backups = Array.isArray(provenance.backupEvidenceRefs) ? provenance.backupEvidenceRefs : null;
    if (!reproducible || !backups) errors.push(`${prefix}:invalid:provenance`);
    for (const ref of [...(reproducible ?? []), ...(backups ?? [])]) {
      try { normalizePath(ref); } catch (error) { errors.push(`${prefix}:invalid:provenanceRef:${error.code ?? error.message}`); }
    }
    if (entry.recoveryMode !== 'excluded' && ((reproducible?.length ?? 0) + (backups?.length ?? 0) === 0)) {
      errors.push(`${prefix}:missing:provenance`);
    }
    if (entry.recoveryMode === 'required' && entry.stateClass === 'cache') errors.push(`${prefix}:required cache entry is not allowed`);
  }
  return errors;
}

function buildFixtureSet(inventory, overrides = new Map()) {
  return inventory.entries.map((entry) => {
    const override = overrides.get(entry.id);
    const content = override?.content ?? entry.sampleContent;
    return {
      id: entry.id,
      path: normalizePath(`${entry.sourceRepository}/${entry.sourcePath}`),
      sourceRepository: entry.sourceRepository,
      sourcePath: entry.sourcePath,
      stateClass: entry.stateClass,
      recoveryMode: entry.recoveryMode,
      restoreOrder: entry.restoreOrder,
      content,
      hash: sha256(content),
      provenance: entry.provenance,
    };
  });
}

function ensureNoSymlinkEscape(targetPath, destinationRoot) {
  const relative = path.relative(destinationRoot, targetPath);
  const segments = relative.split(path.sep).filter(Boolean);
  let cursor = destinationRoot;
  for (const segment of segments.slice(0, -1)) {
    cursor = path.join(cursor, segment);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) fail('symlink_escape_detected', { targetPath, cursor });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function restoreFixture(destinationRoot, fixture) {
  const targetPath = path.resolve(destinationRoot, fixture.path);
  if (!targetPath.startsWith(`${destinationRoot}${path.sep}`) && targetPath !== destinationRoot) fail('path_traversal_detected', { targetPath });
  ensureNoSymlinkEscape(targetPath, destinationRoot);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, fixture.content, 'utf8');
  const restoredHash = sha256(fs.readFileSync(targetPath, 'utf8'));
  if (restoredHash !== fixture.hash) fail('hash_mismatch', { targetPath, expected: fixture.hash, actual: restoredHash });
  return { targetPath, restoredHash };
}

export function runRecoveryCheck({ inventoryPath = DEFAULT_INVENTORY, destinationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-')), fixtures = null } = {}) {
  const inventory = readJson(inventoryPath);
  const inventoryErrors = validateInventory(inventory);
  if (inventoryErrors.length > 0) fail('inventory_validation_failed', { inventoryErrors });
  const safeDestinationRoot = assertSafeDestination(destinationRoot);
  const tempRoot = safeDestinationRoot;
  fs.mkdirSync(tempRoot, { recursive: true });
  const activeFixtures = fixtures ?? buildFixtureSet(inventory);
  const fixtureMap = new Map(activeFixtures.map((fixture) => [fixture.id, fixture]));
  const orderedEntries = [...inventory.entries].sort((a, b) => a.restoreOrder - b.restoreOrder || a.id.localeCompare(b.id));
  const report = {
    schemaVersion: '1.0.0',
    inventoryPath: path.relative(ROOT, inventoryPath).replaceAll(path.sep, '/'),
    destinationClass: tempRoot === destinationRoot ? 'temporary' : 'temporary',
    cleanupCompleted: false,
    totalEntries: orderedEntries.length,
    restoredFiles: [],
    missingFiles: [],
    optionalMissingFiles: [],
    excludedFiles: [],
    recoveryOrder: orderedEntries.map((entry) => ({
      id: entry.id,
      stateClass: entry.stateClass,
      recoveryMode: entry.recoveryMode,
      source: `${entry.sourceRepository}/${entry.sourcePath}`,
    })),
    provenance: orderedEntries.map((entry) => ({
      id: entry.id,
      reproducibleSourceRefs: entry.provenance.reproducibleSourceRefs,
      backupEvidenceRefs: entry.provenance.backupEvidenceRefs,
    })),
  };

  try {
    for (const entry of orderedEntries) {
      const fixture = fixtureMap.get(entry.id);
      if (!fixture) {
        const missingRecord = {
          id: entry.id,
          source: `${entry.sourceRepository}/${entry.sourcePath}`,
          stateClass: entry.stateClass,
          recoveryMode: entry.recoveryMode,
        };
        if (entry.recoveryMode === 'required') report.missingFiles.push(missingRecord);
        else if (entry.recoveryMode === 'optional') report.optionalMissingFiles.push(missingRecord);
        else report.excludedFiles.push(missingRecord);
        continue;
      }

      if (entry.recoveryMode === 'excluded') {
        report.excludedFiles.push({
          id: entry.id,
          source: `${entry.sourceRepository}/${entry.sourcePath}`,
          stateClass: entry.stateClass,
          recoveryMode: entry.recoveryMode,
          hash: fixture.hash,
          skippedWrite: true,
        });
        continue;
      }

      const expectedPath = normalizePath(`${entry.sourceRepository}/${entry.sourcePath}`);
      let fixturePath;
      try {
        fixturePath = normalizePath(fixture.path);
      } catch (error) {
        fail(error.code ?? 'fixture_path_invalid', { id: entry.id, fixturePath: fixture.path });
      }
      if (fixturePath !== expectedPath) fail('fixture_path_mismatch', { id: entry.id, fixturePath: fixture.path });
      const restored = restoreFixture(tempRoot, fixture);
      report.restoredFiles.push({
        id: entry.id,
        source: `${entry.sourceRepository}/${entry.sourcePath}`,
        stateClass: entry.stateClass,
        recoveryMode: entry.recoveryMode,
        hash: restored.restoredHash,
        reproducibleSourceRefs: entry.provenance.reproducibleSourceRefs,
        backupEvidenceRefs: entry.provenance.backupEvidenceRefs,
      });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    report.cleanupCompleted = true;
  }

  report.missingCount = report.missingFiles.length;
  report.optionalMissingCount = report.optionalMissingFiles.length;
  report.excludedCount = report.excludedFiles.length;
  report.restoredCount = report.restoredFiles.length;
  report.reportHash = sha256(JSON.stringify({
    schemaVersion: report.schemaVersion,
    totalEntries: report.totalEntries,
    restoredFiles: report.restoredFiles,
    missingFiles: report.missingFiles,
    optionalMissingFiles: report.optionalMissingFiles,
    excludedFiles: report.excludedFiles,
    recoveryOrder: report.recoveryOrder,
    provenance: report.provenance,
  }));
  return report;
}

function main() {
  const inventoryArgIndex = process.argv.indexOf('--inventory');
  const destinationArgIndex = process.argv.indexOf('--destination-root');
  const inventoryPath = inventoryArgIndex >= 0 ? path.resolve(process.argv[inventoryArgIndex + 1]) : DEFAULT_INVENTORY;
  const destinationRoot = destinationArgIndex >= 0 ? process.argv[destinationArgIndex + 1] : fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-'));
  const report = runRecoveryCheck({ inventoryPath, destinationRoot });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    const code = error?.code ?? 'recovery_check_failed';
    process.stderr.write(`${code}${error?.details ? ` ${JSON.stringify(error.details)}` : ''}\n`);
    process.exitCode = 1;
  }
}
