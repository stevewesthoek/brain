import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { runRecoveryCheck } from './infinite-brain-recovery-check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const inventoryPath = path.join(root, 'operations/specs/infinite-brain-recovery-inventory.json');
const validator = path.join(root, 'tools/infinite-brain-recovery-check.mjs');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function cloneFixtures(overrides = new Map(), removals = new Set()) {
  return inventory.entries
    .filter((entry) => !removals.has(entry.id))
    .map((entry) => {
      const override = overrides.get(entry.id);
      const content = override?.content ?? entry.sampleContent;
      return {
        id: entry.id,
        path: `${entry.sourceRepository}/${entry.sourcePath}`.replaceAll('\\', '/'),
        content,
        hash: override?.hash ?? sha256(content),
      };
    });
}

test('recovery verifier restores canonical, generated, and runtime fixtures into a temp dir only', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-valid-'));
  try {
    const report = runRecoveryCheck({ inventoryPath, destinationRoot: tempRoot });
    assert.equal(report.cleanupCompleted, true);
    assert.equal(report.totalEntries, inventory.entries.length);
    assert.equal(report.missingCount, 0);
    assert.equal(report.optionalMissingCount, 0);
    assert.ok(report.restoredCount > 0);
    assert.equal(report.reportHash.length, 64);
    assert.deepEqual(report.recoveryOrder.map((item) => item.id), inventory.entries.slice().sort((a, b) => a.restoreOrder - b.restoreOrder || a.id.localeCompare(b.id)).map((item) => item.id));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('missing canonical file fails closed and reports the gap', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-missing-'));
  try {
    const fixtures = cloneFixtures(new Map(), new Set(['brain-roadmap-status']));
    const report = runRecoveryCheck({ inventoryPath, destinationRoot: tempRoot, fixtures });
    assert.equal(report.missingCount, 1);
    assert.equal(report.missingFiles[0].id, 'brain-roadmap-status');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('hash mismatch fails closed', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-hash-'));
  try {
    const original = inventory.entries.find((entry) => entry.id === 'brain-roadmap');
    assert.ok(original);
    const fixtures = cloneFixtures(
      new Map([
        [
          'brain-roadmap',
          {
            content: '# changed content\n',
            hash: sha256(original.sampleContent),
          },
        ],
      ])
    );
    assert.throws(() => runRecoveryCheck({ inventoryPath, destinationRoot: tempRoot, fixtures }), /hash_mismatch/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('generated file omitted safely is reported but not treated as fatal', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-optional-'));
  try {
    const fixtures = cloneFixtures(new Map(), new Set(['mutable-state-inventory']));
    const report = runRecoveryCheck({ inventoryPath, destinationRoot: tempRoot, fixtures });
    assert.equal(report.missingCount, 0);
    assert.equal(report.optionalMissingCount, 1);
    assert.equal(report.optionalMissingFiles[0].id, 'mutable-state-inventory');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('runtime file is excluded from restore writes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-runtime-'));
  try {
    const fixtures = cloneFixtures();
    const report = runRecoveryCheck({ inventoryPath, destinationRoot: tempRoot, fixtures });
    assert.ok(report.excludedFiles.some((item) => item.id === 'runtime-rollback-snapshot'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('traversal, symlink escape, and live destination checks fail closed', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-guards-'));
  try {
    assert.throws(
      () => runRecoveryCheck({
        inventoryPath,
        destinationRoot: tempRoot,
        fixtures: [
          { id: 'brain-roadmap', path: '../escape.md', content: 'bad' },
        ],
      }),
      /path_traversal_detected/
    );

    const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-symlink-'));
    try {
      const symlinkInventoryPath = path.join(symlinkRoot, 'inventory.json');
      fs.writeFileSync(
        symlinkInventoryPath,
        JSON.stringify(
          {
            schemaVersion: '1.0.0',
            reviewedAt: '2026-07-17',
            entries: [
              {
                id: 'symlink-escape-target',
                sourceRepository: 'brain',
                sourcePath: 'link-parent/escape/file.md',
                stateClass: 'canonical',
                recoveryMode: 'required',
                restoreOrder: 1,
                sampleContent: '# symlink escape\n',
                provenance: {
                  reproducibleSourceRefs: ['operations/specs/infinite-brain-recovery-inventory.json'],
                  backupEvidenceRefs: ['operations/reports/b7-7-backup-restore-runtime-recovery-2026-07-17.md'],
                },
              },
            ],
          },
          null,
          2
        )
      );
      fs.mkdirSync(path.join(symlinkRoot, 'brain', 'link-parent'), { recursive: true });
      fs.symlinkSync(path.join(symlinkRoot, 'outside'), path.join(symlinkRoot, 'brain', 'link-parent', 'escape'));
      assert.throws(
        () => runRecoveryCheck({
          inventoryPath: symlinkInventoryPath,
          destinationRoot: symlinkRoot,
          fixtures: [
            {
              id: 'symlink-escape-target',
              path: 'brain/link-parent/escape/file.md',
              content: '# symlink escape\n',
              hash: sha256('# symlink escape\n'),
            },
          ],
        }),
        /symlink_escape_detected/
      );
    } finally {
      fs.rmSync(symlinkRoot, { recursive: true, force: true });
    }

    const liveRoot = path.resolve(root);
    assert.throws(
      () => runRecoveryCheck({ inventoryPath, destinationRoot: liveRoot }),
      /live_repository_destination_rejected/
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('repeated reports are deterministic', () => {
  const tempRootA = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-repeat-a-'));
  const tempRootB = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-recovery-repeat-b-'));
  try {
    const reportA = runRecoveryCheck({ inventoryPath, destinationRoot: tempRootA });
    const reportB = runRecoveryCheck({ inventoryPath, destinationRoot: tempRootB });
    assert.equal(reportA.reportHash, reportB.reportHash);
    assert.deepEqual(
      {
        restoredFiles: reportA.restoredFiles,
        missingFiles: reportA.missingFiles,
        optionalMissingFiles: reportA.optionalMissingFiles,
        excludedFiles: reportA.excludedFiles,
        recoveryOrder: reportA.recoveryOrder,
        provenance: reportA.provenance,
      },
      {
        restoredFiles: reportB.restoredFiles,
        missingFiles: reportB.missingFiles,
        optionalMissingFiles: reportB.optionalMissingFiles,
        excludedFiles: reportB.excludedFiles,
        recoveryOrder: reportB.recoveryOrder,
        provenance: reportB.provenance,
      }
    );
  } finally {
    fs.rmSync(tempRootA, { recursive: true, force: true });
    fs.rmSync(tempRootB, { recursive: true, force: true });
  }
});

test('CLI emits a JSON report', () => {
  const output = execFileSync('node', [validator], { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.cleanupCompleted, true);
  assert.equal(report.missingCount, 0);
  assert.equal(report.optionalMissingCount, 0);
});
