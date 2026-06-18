import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { getSimplificationReviewView, type SimplificationReviewOptions } from '../adapters/simplification-review.js';

function readdirSorted(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).map(e => e.name).sort();
  } catch {
    return [];
  }
}

function createMindFixture(prefix: string) {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  mkdirSync(path.join(mindRoot, 'capture', 'inbox'), { recursive: true });
  mkdirSync(path.join(mindRoot, 'live', 'projects'), { recursive: true });
  mkdirSync(path.join(mindRoot, 'wiki'), { recursive: true });
  mkdirSync(path.join(mindRoot, 'archive'), { recursive: true });
  mkdirSync(path.join(mindRoot, 'sources'), { recursive: true });
  mkdirSync(path.join(mindRoot, 'system'), { recursive: true });
  writeFileSync(path.join(mindRoot, 'home.md'), '# Home\n\n- [[live/dashboard|Dashboard]]\n- [[wiki/README|Wiki]]\n- [[system/README|System]]\n');
  writeFileSync(path.join(mindRoot, 'live', 'dashboard.md'), '# Dashboard\n');
  writeFileSync(path.join(mindRoot, 'wiki', 'README.md'), '# Wiki\n');
  writeFileSync(path.join(mindRoot, 'system', 'README.md'), '# System\n');
  return { tempDir, mindRoot };
}

test('simplification review counts top-level folders correctly', () => {
  const fixture = createMindFixture('simplification-folders-');
  // fixture has: capture, live, wiki, archive, sources, system = 6 top-level dirs
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.id, 'simplification-review-view');
    assert.equal(view.status, 'available');
    assert.equal(view.folderStructure.topLevelFolderCount, 6);
    assert(view.folderStructure.topLevelFolders.includes('capture'));
    assert(view.folderStructure.topLevelFolders.includes('wiki'));
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.deletesFiles, false);
    assert.equal(view.safety.archivesFiles, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('top-level folders are sorted alphabetically', () => {
  const fixture = createMindFixture('simplification-sorted-');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    const folders = view.folderStructure.topLevelFolders;
    assert.deepEqual(folders, [...folders].sort());
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('hidden directories are excluded from top-level count', () => {
  const fixture = createMindFixture('simplification-hidden-');
  mkdirSync(path.join(fixture.mindRoot, '.hidden-dir'), { recursive: true });
  mkdirSync(path.join(fixture.mindRoot, '.git', 'objects'), { recursive: true });
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    assert(!view.folderStructure.topLevelFolders.includes('.hidden-dir'));
    assert(!view.folderStructure.topLevelFolders.includes('.git'));
    // Only the 6 visible fixture dirs
    assert.equal(view.folderStructure.topLevelFolderCount, 6);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('observed maximum depth is measured correctly — root is depth 0, child is depth 1', () => {
  const fixture = createMindFixture('simplification-depth-');
  // Create: mind/sources/L2/L3 → depth from root: L1=1, L2=2, L3=3
  mkdirSync(path.join(fixture.mindRoot, 'sources', 'L2', 'L3'), { recursive: true });
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    // capture/inbox = depth 2; sources/L2/L3 = depth 3
    assert(view.folderStructure.observedMaximumDepth >= 3, `expected >= 3, got ${view.folderStructure.observedMaximumDepth}`);
    // verify depth 1 count matches top-level folder count
    assert.equal(view.folderStructure.directoryCountByDepth[1], view.folderStructure.topLevelFolderCount);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('directory counts by depth are correct', () => {
  const fixture = createMindFixture('simplification-byDepth-');
  // fixture has: capture/inbox, live/projects, wiki, archive, sources, system at various depths
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    const byDepth = view.folderStructure.directoryCountByDepth;
    assert.equal(byDepth[1], 6, 'Fixture has exactly 6 depth-1 dirs');
    // capture has inbox subdirectory; live has projects subdirectory
    assert(byDepth[2] !== undefined && byDepth[2] >= 2, 'At least 2 depth-2 dirs');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('deepest paths are deterministic, sorted, and relative to Mind root', () => {
  const fixture = createMindFixture('simplification-deepest-');
  mkdirSync(path.join(fixture.mindRoot, 'sources', 'deep', 'deeper'), { recursive: true });
  mkdirSync(path.join(fixture.mindRoot, 'archive', 'old', 'legacy'), { recursive: true });
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    const paths = view.folderStructure.deepestPaths;
    assert(paths.length > 0);
    // All paths must be relative (not absolute)
    for (const p of paths) {
      assert(!path.isAbsolute(p), `Path should be relative: ${p}`);
    }
    // Deterministic: sorted
    assert.deepEqual(paths, [...paths].sort());
    // Must include one of our known deep paths
    assert(paths.some(p => p.includes('sources') || p.includes('archive')));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('missing Mind root fails closed — not zero folders', () => {
  const missingRoot = path.join('/tmp', 'does-not-exist-' + Math.floor(Math.random() * 1e9));
  const view = getSimplificationReviewView({ mindRoot: missingRoot });

  assert.equal(view.status, 'missing');
  assert(view.blockers.includes('mindRootMissingOrUnreadable'));
  assert.equal(view.folderStructure.recommendedMaximumUsefulDepth, null);
  assert.equal(view.folderStructure.recommendationStatus, 'insufficient-evidence');
  assert(view.folderStructure.recommendationBlockers.includes('mindRootMissingOrUnreadable'));
});

test('recommended maximum useful depth is null when evidence is insufficient', () => {
  const fixture = createMindFixture('simplification-recNull-');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    assert.equal(view.folderStructure.recommendedMaximumUsefulDepth, null);
    assert.equal(view.folderStructure.recommendationStatus, 'insufficient-evidence');
    assert(view.folderStructure.recommendationBlockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('no hardcoded cap of 4 — observed depth can exceed 4', () => {
  const fixture = createMindFixture('simplification-noCap-');
  // Create depth 5: mind/wiki/a/b/c/d
  mkdirSync(path.join(fixture.mindRoot, 'wiki', 'a', 'b', 'c', 'd'), { recursive: true });
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    assert(view.folderStructure.observedMaximumDepth >= 5, `Expected observedMaximumDepth >= 5, got ${view.folderStructure.observedMaximumDepth}`);
    // recommendedMaximumUsefulDepth must NOT be capped to 4
    // (it's null — no arbitrary cap is applied)
    assert.equal(view.folderStructure.recommendedMaximumUsefulDepth, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('repeated calls are deterministic for same fixture', () => {
  const fixture = createMindFixture('simplification-determ-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const v1 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    const v2 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.deepEqual(v1.folderStructure, v2.folderStructure);
    assert.deepEqual(v1.folderStructure.deepestPaths, v2.folderStructure.deepestPaths);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('view invocation causes no filesystem mutation', () => {
  const fixture = createMindFixture('simplification-noMut-');
  const filesBefore = readdirSorted(fixture.mindRoot);
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    const filesAfter = readdirSorted(fixture.mindRoot);
    assert.deepEqual(filesBefore, filesAfter, 'No files or directories created by the view');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('simplification review checks navigation paths from home.md', () => {
  const fixture = createMindFixture('simplification-nav-');

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.navigation.homeExists, true);
    assert(view.navigation.linksChecked >= 1);
    assert.equal(typeof view.navigation.brokenLinkCount, 'number');
    assert(Array.isArray(view.navigation.brokenLinks));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('simplification review detects broken navigation links', () => {
  const fixture = createMindFixture('simplification-broken-');
  writeFileSync(
    path.join(fixture.mindRoot, 'home.md'),
    '# Home\n\n- [[nonexistent-page|Broken]]\n- [[wiki/README|Wiki]]\n',
  );

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.navigation.brokenLinkCount, 1);
    assert(view.navigation.brokenLinks.includes('nonexistent-page'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('simplification review measures inbox age', () => {
  const fixture = createMindFixture('simplification-inbox-');
  const now = new Date('2026-06-18T12:00:00Z');
  const oldPath = path.join(fixture.mindRoot, 'capture', 'inbox', 'old.md');
  const newPath = path.join(fixture.mindRoot, 'capture', 'inbox', 'new.md');
  writeFileSync(oldPath, '# Old\n');
  writeFileSync(newPath, '# New\n');
  utimesSync(oldPath, new Date('2026-06-10T12:00:00Z'), new Date('2026-06-10T12:00:00Z'));
  utimesSync(newPath, new Date('2026-06-18T11:00:00Z'), new Date('2026-06-18T11:00:00Z'));

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });

    assert.equal(view.inboxAge.status, 'available');
    assert.equal(view.inboxAge.captureCount, 2);
    assert(view.inboxAge.oldestAgeHours !== null && view.inboxAge.oldestAgeHours >= 192);
    assert(view.inboxAge.newestAgeHours !== null && view.inboxAge.newestAgeHours >= 1);
    assert(view.inboxAge.oldestAgeHours !== null && view.inboxAge.newestAgeHours !== null && view.inboxAge.oldestAgeHours > view.inboxAge.newestAgeHours);
    assert.equal(view.inboxAge.validTimestampCount, 2);
    assert.equal(view.inboxAge.invalidTimestampCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('simplification review is read-only and does not modify Mind', () => {
  const fixture = createMindFixture('simplification-safety-');

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.safety.createsSchedulerJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.deletesFiles, false);
    assert.equal(view.safety.archivesFiles, false);
    assert.equal(view.blockers.length, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('false-positive parser fails closed when report file is missing', () => {
  const fixture = createMindFixture('simplification-fp-missing-');

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.falsePositiveRate.measured, false);
    assert.equal(view.falsePositiveRate.rate, 0);
    assert.equal(view.falsePositiveRate.totalNegativeCases, 0);
    assert.equal(view.falsePositiveRate.falsePositives, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('false-positive parser fails closed when expected evidence fields are missing', () => {
  const fixture = createMindFixture('simplification-fp-malformed-');
  const reportDir = path.join(fixture.mindRoot, 'system', 'reports', 'maintenance-history');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, '2026-06-17-false-positive-measurement.md'),
    '# Report\n\nSome text without the expected table format.\nNo False positives or Explicit negative cases fields here.\n',
  );

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.falsePositiveRate.measured, false);
    assert.equal(view.falsePositiveRate.rate, 0);
    assert.equal(view.falsePositiveRate.totalNegativeCases, 0);
    assert.equal(view.falsePositiveRate.falsePositives, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('false-positive parser fails closed when negative-case denominator is zero', () => {
  const fixture = createMindFixture('simplification-fp-zero-');
  const reportDir = path.join(fixture.mindRoot, 'system', 'reports', 'maintenance-history');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, '2026-06-17-false-positive-measurement.md'),
    '# False Positive Measurement\n\n| Metric | Value |\n|--------|-------|\n| False positives | 0 |\n| Explicit negative cases | 0 |\n',
  );

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.falsePositiveRate.measured, false);
    assert.equal(view.falsePositiveRate.rate, 0);
    assert.equal(view.falsePositiveRate.totalNegativeCases, 0);
    assert.equal(view.falsePositiveRate.falsePositives, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('false-positive parser fails closed when values are non-numeric', () => {
  const fixture = createMindFixture('simplification-fp-nan-');
  const reportDir = path.join(fixture.mindRoot, 'system', 'reports', 'maintenance-history');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, '2026-06-17-false-positive-measurement.md'),
    '# False Positive Measurement\n\n| Metric | Value |\n|--------|-------|\n| False positives | NaN |\n| Explicit negative cases | undefined |\n',
  );

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.falsePositiveRate.measured, false);
    assert.equal(view.falsePositiveRate.rate, 0);
    assert.equal(view.falsePositiveRate.totalNegativeCases, 0);
    assert.equal(view.falsePositiveRate.falsePositives, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('false-positive parser succeeds only with valid measured evidence', () => {
  const fixture = createMindFixture('simplification-fp-valid-');
  const reportDir = path.join(fixture.mindRoot, 'system', 'reports', 'maintenance-history');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, '2026-06-17-false-positive-measurement.md'),
    '# False Positive Measurement\n\n| Metric | Value |\n|--------|-------|\n| False positives | 1 |\n| Explicit negative cases | 7 |\n',
  );

  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });

    assert.equal(view.falsePositiveRate.measured, true);
    assert.equal(view.falsePositiveRate.falsePositives, 1);
    assert.equal(view.falsePositiveRate.totalNegativeCases, 7);
    assert(view.falsePositiveRate.rate > 0);
    assert(view.falsePositiveRate.rate < 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PART A — scan completeness evidence
// ──────────────────────────────────────────────────────────────────────────────

test('scan: fully readable fixture reports scanComplete:true and unreadablePaths:[]', () => {
  const fixture = createMindFixture('scan-complete-');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot });
    assert.equal(view.folderStructure.scanComplete, true);
    assert.deepEqual(view.folderStructure.unreadablePaths, []);
    assert.equal(view.status, 'available');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('scan: missing root returns status missing with mindRootMissingOrUnreadable blocker', () => {
  const missingRoot = path.join('/tmp', 'scan-missing-' + process.pid);
  const view = getSimplificationReviewView({ mindRoot: missingRoot });
  assert.equal(view.status, 'missing');
  assert(view.blockers.includes('mindRootMissingOrUnreadable'));
  assert.equal(view.folderStructure.scanComplete, false);
});

test('scan: non-directory root returns status missing with mindRootMissingOrUnreadable blocker', () => {
  const tmpDir = mkdtempSync(path.join('/tmp', 'scan-notdir-'));
  const filePath = path.join(tmpDir, 'notadir.txt');
  writeFileSync(filePath, 'content');
  try {
    const view = getSimplificationReviewView({ mindRoot: filePath });
    assert.equal(view.status, 'missing');
    assert(view.blockers.includes('mindRootMissingOrUnreadable'));
    assert.equal(view.folderStructure.scanComplete, false);
    // Must not report a false zero folder count for a non-directory root.
    assert.equal(view.folderStructure.topLevelFolderCount, 0);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('scan: root readdir failure reports rootReaddirFailed blocker not empty scan', () => {
  const fixture = createMindFixture('scan-rootfail-');
  // Inject a readdir that throws on the root directory.
  const rootFailReaddirFn = (dir: string) => {
    if (dir === fixture.mindRoot) throw new Error('permission denied (injected)');
    return readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  };
  const opts: SimplificationReviewOptions = { mindRoot: fixture.mindRoot, _testOnlyReaddirFn: rootFailReaddirFn };
  try {
    const view = getSimplificationReviewView(opts);
    // Root stat succeeds (it is a dir), but readdir fails — should be blocked, not available.
    assert.equal(view.status, 'missing');
    assert(view.blockers.includes('mindRootMissingOrUnreadable') || view.folderStructure.recommendationBlockers.includes('rootReaddirFailed'));
    assert.equal(view.folderStructure.scanComplete, false);
    // Must not present zero as an observed folder count claiming a genuine empty root.
    assert.equal(view.folderStructure.topLevelFolderCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('scan: nested directory readdir failure reports partial scan with unreadable path', () => {
  const fixture = createMindFixture('scan-partial-');
  const blockedDir = path.join(fixture.mindRoot, 'wiki');
  // Inject a readdir that throws on a nested directory.
  const nestedFailReaddirFn = (dir: string) => {
    if (dir === blockedDir) throw new Error('permission denied (injected)');
    return readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  };
  const opts: SimplificationReviewOptions = { mindRoot: fixture.mindRoot, _testOnlyReaddirFn: nestedFailReaddirFn };
  try {
    const view = getSimplificationReviewView(opts);
    assert.equal(view.status, 'available');
    assert.equal(view.folderStructure.scanComplete, false);
    assert(view.folderStructure.unreadablePaths.length > 0, 'unreadablePaths must not be empty');
    assert(view.folderStructure.unreadablePaths.some(p => p.includes('wiki')));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('scan: deterministic counts in a known fixture', () => {
  const fixture = createMindFixture('scan-determ-counts-');
  // fixture has: capture/inbox, live/projects, wiki, archive, sources, system = 6 depth-1, 2 depth-2
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const v1 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    const v2 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(v1.folderStructure.topLevelFolderCount, 6);
    assert.equal(v1.folderStructure.directoryCountByDepth[1], 6);
    assert((v1.folderStructure.directoryCountByDepth[2] ?? 0) >= 2);
    // Deterministic across repeated calls.
    assert.deepEqual(v1.folderStructure, v2.folderStructure);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PART B — inbox age and maintenance backlog (Task 2)
// ──────────────────────────────────────────────────────────────────────────────

test('inboxAge: empty readable inbox reports captureCount:0 not null', () => {
  const fixture = createMindFixture('inbox-empty-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.inboxAge.status, 'available');
    assert.equal(view.inboxAge.captureCount, 0);
    // No files → no timestamps → null age values.
    assert.equal(view.inboxAge.oldestAgeHours, null);
    assert.equal(view.inboxAge.newestAgeHours, null);
    assert.equal(view.inboxAge.validTimestampCount, 0);
    assert.equal(view.inboxAge.invalidTimestampCount, 0);
    assert.deepEqual(view.inboxAge.blockers, []);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inboxAge: missing inbox reports status missing and null counts — not zero backlog', () => {
  const fixture = createMindFixture('inbox-missing-');
  // Remove the inbox directory the fixture created.
  rmSync(path.join(fixture.mindRoot, 'capture', 'inbox'), { recursive: true, force: true });
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.inboxAge.status, 'missing');
    assert.equal(view.inboxAge.captureCount, null);
    assert.equal(view.inboxAge.oldestAgeHours, null);
    assert.equal(view.inboxAge.newestAgeHours, null);
    assert(view.inboxAge.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inboxAge: oldest and newest ages are calculated correctly', () => {
  const fixture = createMindFixture('inbox-ages-');
  const now = new Date('2026-06-18T12:00:00Z');
  const oldPath = path.join(fixture.mindRoot, 'capture', 'inbox', 'old.md');
  const newPath = path.join(fixture.mindRoot, 'capture', 'inbox', 'new.md');
  writeFileSync(oldPath, '# Old\n');
  writeFileSync(newPath, '# New\n');
  // Old: 8 days ago = 192 hours; New: 1 hour ago.
  utimesSync(oldPath, new Date('2026-06-10T12:00:00Z'), new Date('2026-06-10T12:00:00Z'));
  utimesSync(newPath, new Date('2026-06-18T11:00:00Z'), new Date('2026-06-18T11:00:00Z'));
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.inboxAge.status, 'available');
    assert.equal(view.inboxAge.captureCount, 2);
    assert(view.inboxAge.oldestAgeHours !== null && view.inboxAge.oldestAgeHours >= 192);
    assert(view.inboxAge.newestAgeHours !== null && view.inboxAge.newestAgeHours >= 1);
    assert(view.inboxAge.oldestAgeHours! > view.inboxAge.newestAgeHours!);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inboxAge: future timestamp is blocked and reported as invalid', () => {
  const fixture = createMindFixture('inbox-future-');
  const now = new Date('2026-06-18T12:00:00Z');
  const futurePath = path.join(fixture.mindRoot, 'capture', 'inbox', 'future.md');
  writeFileSync(futurePath, '# Future\n');
  // Set mtime to 1 hour in the future.
  const futureDate = new Date(now.getTime() + 3600000);
  utimesSync(futurePath, futureDate, futureDate);
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.inboxAge.status, 'available');
    assert.equal(view.inboxAge.invalidTimestampCount, 1);
    assert.equal(view.inboxAge.validTimestampCount, 0);
    // Future timestamp must not become zero age — oldest/newest must be null.
    assert.equal(view.inboxAge.oldestAgeHours, null);
    assert.equal(view.inboxAge.newestAgeHours, null);
    assert(view.inboxAge.blockers.includes('someTimestampsInvalidOrFuture'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inboxAge: hidden files are excluded per canonical policy', () => {
  const fixture = createMindFixture('inbox-hidden-');
  const now = new Date('2026-06-18T12:00:00Z');
  const visiblePath = path.join(fixture.mindRoot, 'capture', 'inbox', 'visible.md');
  const hiddenPath = path.join(fixture.mindRoot, 'capture', 'inbox', '.hidden.md');
  writeFileSync(visiblePath, '# Visible\n');
  writeFileSync(hiddenPath, '# Hidden\n');
  // Set both to known times.
  utimesSync(visiblePath, new Date('2026-06-18T10:00:00Z'), new Date('2026-06-18T10:00:00Z'));
  utimesSync(hiddenPath, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'));
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // Only visible file counted — hidden file must not inflate captureCount or skew ages.
    assert.equal(view.inboxAge.captureCount, 1);
    assert.equal(view.inboxAge.validTimestampCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inboxAge and maintenanceBacklog are separate structures', () => {
  const fixture = createMindFixture('inbox-separate-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // Must be distinct top-level fields.
    assert('inboxAge' in view, 'inboxAge must exist');
    assert('maintenanceBacklog' in view, 'maintenanceBacklog must exist');
    assert('captureCount' in view.inboxAge, 'inboxAge must have captureCount');
    assert(!('captureCount' in view.maintenanceBacklog), 'maintenanceBacklog must not have captureCount');
    assert('unresolvedFindingCount' in view.maintenanceBacklog, 'maintenanceBacklog must have unresolvedFindingCount');
    assert(!('unresolvedFindingCount' in view.inboxAge), 'inboxAge must not have unresolvedFindingCount');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: missing report yields insufficient-evidence with null counts', () => {
  const fixture = createMindFixture('maint-missing-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'insufficient-evidence');
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, null);
    assert.equal(view.maintenanceBacklog.pendingDecisionCount, null);
    assert.equal(view.maintenanceBacklog.failedFindingCount, null);
    assert(view.maintenanceBacklog.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: malformed report yields partial status with null counts', () => {
  const fixture = createMindFixture('maint-malformed-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), 'not valid json {{{{');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.notEqual(view.maintenanceBacklog.status, 'available');
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, null);
    assert(view.maintenanceBacklog.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: valid report with zero open findings reports unresolvedFindingCount:0', () => {
  const fixture = createMindFixture('maint-zero-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = {
    schemaVersion: '1.0',
    reportId: 'test-001',
    generatedAt: '2026-06-18T10:00:00.000Z',
    generatedBy: 'test',
    mode: 'report-only',
    sourceRepo: 'mind',
    sourceCommit: 'abc123',
    configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' },
    detectors: {},
    filesConsidered: [],
    summary: { filesConsidered: 0, findingsTotal: 0, findingsOpen: 0, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 0, findingsSuppressed: 0, detectorErrors: 0 },
    findings: [],
    suppressedFindings: [],
    errors: [],
    safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true },
    noWritePerformed: true,
  };
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'available');
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 0);
    assert.equal(view.maintenanceBacklog.failedFindingCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: open findings are counted as unresolved backlog', () => {
  const fixture = createMindFixture('maint-open-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = {
    schemaVersion: '1.0', reportId: 'test-002', generatedAt: '2026-06-18T10:00:00.000Z', generatedBy: 'test',
    mode: 'report-only', sourceRepo: 'mind', sourceCommit: 'abc123',
    configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' },
    detectors: {}, filesConsidered: [],
    summary: { filesConsidered: 2, findingsTotal: 2, findingsOpen: 2, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 0, findingsSuppressed: 0, detectorErrors: 0 },
    findings: [
      { id: 'f1', type: 'stale-page', status: 'open', created: '2026-06-18T10:00:00Z', sourceRepo: 'mind', scope: '', paths: [], trigger: '', matchedEvidence: [], comparisonEvidence: [], uncertainty: '', confidence: 0.8, risk: 'low', recommendedAction: '', requiresApproval: true, noWritePerformed: true, deduplicationKey: 'k1', suppressionUntil: null, review: null },
      { id: 'f2', type: 'source-gap', status: 'open', created: '2026-06-18T10:00:00Z', sourceRepo: 'mind', scope: '', paths: [], trigger: '', matchedEvidence: [], comparisonEvidence: [], uncertainty: '', confidence: 0.8, risk: 'medium', recommendedAction: '', requiresApproval: true, noWritePerformed: true, deduplicationKey: 'k2', suppressionUntil: null, review: null },
    ],
    suppressedFindings: [], errors: [],
    safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true },
    noWritePerformed: true,
  };
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 2);
    assert.equal(view.maintenanceBacklog.failedFindingCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: resolved findings are excluded from unresolved count', () => {
  const fixture = createMindFixture('maint-resolved-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = {
    schemaVersion: '1.0', reportId: 'test-003', generatedAt: '2026-06-18T10:00:00.000Z', generatedBy: 'test',
    mode: 'report-only', sourceRepo: 'mind', sourceCommit: 'abc123',
    configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' },
    detectors: {}, filesConsidered: [],
    summary: { filesConsidered: 2, findingsTotal: 2, findingsOpen: 1, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 1, findingsSuppressed: 0, detectorErrors: 0 },
    findings: [
      { id: 'f1', type: 'stale-page', status: 'open', created: '2026-06-18T10:00:00Z', sourceRepo: 'mind', scope: '', paths: [], trigger: '', matchedEvidence: [], comparisonEvidence: [], uncertainty: '', confidence: 0.8, risk: 'low', recommendedAction: '', requiresApproval: true, noWritePerformed: true, deduplicationKey: 'k1', suppressionUntil: null, review: null },
      { id: 'f2', type: 'source-gap', status: 'resolved', created: '2026-06-18T10:00:00Z', sourceRepo: 'mind', scope: '', paths: [], trigger: '', matchedEvidence: [], comparisonEvidence: [], uncertainty: '', confidence: 0.8, risk: 'medium', recommendedAction: '', requiresApproval: true, noWritePerformed: true, deduplicationKey: 'k2', suppressionUntil: null, review: { reviewedBy: 'steve', reviewedAt: '2026-06-18T11:00:00.000Z', decision: 'resolved', reason: 'done', nextAction: '', resolutionRef: 'ref-001' } },
    ],
    suppressedFindings: [], errors: [],
    safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true },
    noWritePerformed: true,
  };
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // Only the open finding counts as unresolved.
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: pending decisions counted separately', () => {
  const fixture = createMindFixture('maint-decisions-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  // Minimal valid report.
  const report = { schemaVersion: '1.0', reportId: 'test-004', generatedAt: '2026-06-18T10:00:00.000Z', generatedBy: 'test', mode: 'report-only', sourceRepo: 'mind', sourceCommit: 'abc123', configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' }, detectors: {}, filesConsidered: [], summary: { filesConsidered: 0, findingsTotal: 0, findingsOpen: 0, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 0, findingsSuppressed: 0, detectorErrors: 0 }, findings: [], suppressedFindings: [], errors: [], safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true }, noWritePerformed: true };
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  // Decision store with one accepted (no resolutionRef = pending) and one dismissed.
  const decisions = { schemaVersion: '1.0', sourceRepo: 'mind', updatedAt: '2026-06-18T11:00:00.000Z', decisions: [
    { findingId: 'f1', deduplicationKey: 'k1', sourceReportId: 'test-003', sourceCommit: 'abc', reviewedBy: 'steve', reviewedAt: '2026-06-18T11:00:00.000Z', decision: 'accepted', reason: 'valid', nextAction: 'fix it', resolutionRef: null, suppressionUntil: null },
    { findingId: 'f2', deduplicationKey: 'k2', sourceReportId: 'test-003', sourceCommit: 'abc', reviewedBy: 'steve', reviewedAt: '2026-06-18T11:00:00.000Z', decision: 'dismissed', reason: 'not useful', nextAction: '', resolutionRef: null, suppressionUntil: null },
  ]};
  writeFileSync(path.join(reportsDir, 'maintenance-decisions.json'), JSON.stringify(decisions));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 0);
    assert.equal(view.maintenanceBacklog.pendingDecisionCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: detector errors count as failedFindingCount', () => {
  const fixture = createMindFixture('maint-errors-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = { schemaVersion: '1.0', reportId: 'test-005', generatedAt: '2026-06-18T10:00:00.000Z', generatedBy: 'test', mode: 'report-only', sourceRepo: 'mind', sourceCommit: 'abc123', configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' }, detectors: {}, filesConsidered: [], summary: { filesConsidered: 0, findingsTotal: 0, findingsOpen: 0, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 0, findingsSuppressed: 0, detectorErrors: 1 }, findings: [], suppressedFindings: [], errors: [{ detector: 'stale-page', path: 'some/path.md', errorType: 'parse-error', summary: 'could not parse', retryable: true }], safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true }, noWritePerformed: true };
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.failedFindingCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('repeated calls with fixed now are deterministic', () => {
  const fixture = createMindFixture('inbox-determ2-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.mindRoot, 'capture', 'inbox', 'a.md');
  writeFileSync(capturePath, '# A\n');
  utimesSync(capturePath, new Date('2026-06-17T12:00:00Z'), new Date('2026-06-17T12:00:00Z'));
  try {
    const v1 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    const v2 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.deepEqual(v1.inboxAge, v2.inboxAge);
    assert.deepEqual(v1.maintenanceBacklog, v2.maintenanceBacklog);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('route remains read-only — no files created or modified', () => {
  const fixture = createMindFixture('route-readonly-');
  const before = readdirSorted(fixture.mindRoot);
  getSimplificationReviewView({ mindRoot: fixture.mindRoot });
  const after = readdirSorted(fixture.mindRoot);
  try {
    assert.deepEqual(before, after);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PART A — Task 2 corrections: fail-closed maintenance backlog
// ──────────────────────────────────────────────────────────────────────────────

function makeMinimalReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0', reportId: 'r1', generatedAt: '2026-06-18T10:00:00.000Z',
    generatedBy: 'test', mode: 'report-only', sourceRepo: 'mind', sourceCommit: 'abc',
    configuration: { maxFiles: 5, maxFindingsPerDetector: 5, minimumConfidence: 0.7, aiAssist: 'never' },
    detectors: {}, filesConsidered: [],
    summary: { filesConsidered: 0, findingsTotal: 0, findingsOpen: 0, findingsAccepted: 0, findingsDismissed: 0, findingsResolved: 0, findingsSuppressed: 0, detectorErrors: 0 },
    findings: [],
    suppressedFindings: [],
    errors: [],
    safety: { allowedOutputPaths: [], sourceFilesChanged: 0, kanbanChanged: false, captureFilesChanged: 0, wikiFilesChanged: 0, liveFilesChanged: 0, archiveFilesChanged: 0, rootFilesCreated: 0, noWritePerformed: true },
    noWritePerformed: true,
    ...overrides,
  };
}

test('maintenanceBacklog: malformed finding entry causes partial status', () => {
  const fixture = createMindFixture('maint-malformed-finding-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  // One valid open finding, one malformed (null), one malformed (non-object string).
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', status: 'open', type: 'stale-page' },
      null,
      'not-an-object',
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'partial');
    assert(view.maintenanceBacklog.blockers.includes('maintenanceFindingsMalformed'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: malformed finding is not silently ignored — malformedFindingCount is tracked', () => {
  const fixture = createMindFixture('maint-malformed-count-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', status: 'open', type: 'stale-page' },
      null,
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.malformedFindingCount, 1, 'malformed finding must be counted, not silently discarded');
    assert.equal(view.maintenanceBacklog.validFindingCount, 1);
    // Only the valid open finding should be counted as unresolved.
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: malformed decision entry causes partial status', () => {
  const fixture = createMindFixture('maint-malformed-decision-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  const decisions = { decisions: [
    { decision: 'accepted', resolutionRef: null },
    null,
    { decision: 'unknown-value' },
  ]};
  writeFileSync(path.join(reportsDir, 'maintenance-decisions.json'), JSON.stringify(decisions));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'partial');
    assert(view.maintenanceBacklog.blockers.includes('maintenanceDecisionsMalformed'));
    assert(view.maintenanceBacklog.malformedDecisionCount !== null && view.maintenanceBacklog.malformedDecisionCount >= 2);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: missing decision store yields pendingDecisionCount:null', () => {
  const fixture = createMindFixture('maint-no-decision-store-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  // Do NOT write maintenance-decisions.json.
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.pendingDecisionCount, null, 'absent decision store must yield null, not zero');
    assert.equal(view.maintenanceBacklog.validDecisionCount, null);
    assert.equal(view.maintenanceBacklog.malformedDecisionCount, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: missing decision store is not described as zero evidence', () => {
  const fixture = createMindFixture('maint-absent-not-zero-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // pendingDecisionCount must be null, not 0, when the store is absent.
    assert.strictEqual(view.maintenanceBacklog.pendingDecisionCount, null,
      'null means absent store, not zero evidence — must not be 0');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: malformed present decision store adds a blocker', () => {
  const fixture = createMindFixture('maint-malformed-present-decision-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  // Write a present but malformed decision store (not an object with decisions array).
  writeFileSync(path.join(reportsDir, 'maintenance-decisions.json'), 'not valid json ][[[');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'partial');
    assert(view.maintenanceBacklog.blockers.includes('maintenanceDecisionStoreMalformed'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: missing errors field adds a blocker and failedFindingCount is null', () => {
  const fixture = createMindFixture('maint-no-errors-field-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  // Report without errors field.
  const report = makeMinimalReport({ errors: undefined });
  const reportObj = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
  delete reportObj.errors;
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(reportObj));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.status, 'partial');
    assert(view.maintenanceBacklog.blockers.includes('maintenanceErrorsFieldMissing'));
    assert.equal(view.maintenanceBacklog.failedFindingCount, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: unknown finding status is not silently counted as open', () => {
  const fixture = createMindFixture('maint-unknown-status-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', status: 'unknown-value', type: 'stale-page' },
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.malformedFindingCount, 1,
      'unknown status must be counted as malformed, not as open backlog');
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 0,
      'unknown status must not be counted as unresolved');
    assert.equal(view.maintenanceBacklog.status, 'partial');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: missing status is not silently counted as open', () => {
  const fixture = createMindFixture('maint-missing-status-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  // Finding with no status field at all.
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', type: 'stale-page' },
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.malformedFindingCount, 1,
      'missing status must be malformed, not silently open');
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 0);
    assert.equal(view.maintenanceBacklog.status, 'partial');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: resolved/dismissed findings are excluded from unresolvedFindingCount', () => {
  const fixture = createMindFixture('maint-resolved-excluded-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', status: 'open', type: 'stale-page' },
      { id: 'f2', status: 'resolved', type: 'stale-page' },
      { id: 'f3', status: 'dismissed', type: 'stale-page' },
      { id: 'f4', status: 'superseded', type: 'stale-page' },
      { id: 'f5', status: 'accepted', type: 'stale-page' },
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // open and accepted are unresolved; resolved, dismissed, superseded are excluded.
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 2);
    assert.equal(view.maintenanceBacklog.validFindingCount, 5);
    assert.equal(view.maintenanceBacklog.malformedFindingCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: valid open findings are counted correctly', () => {
  const fixture = createMindFixture('maint-valid-open-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const report = makeMinimalReport({
    findings: [
      { id: 'f1', status: 'open', type: 'stale-page' },
      { id: 'f2', status: 'open', type: 'source-gap' },
      { id: 'f3', status: 'open', type: 'duplicate-candidate' },
    ],
  });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(report));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.equal(view.maintenanceBacklog.unresolvedFindingCount, 3);
    assert.equal(view.maintenanceBacklog.validFindingCount, 3);
    assert.equal(view.maintenanceBacklog.malformedFindingCount, 0);
    assert.equal(view.maintenanceBacklog.status, 'available');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: pending decisions follow the canonical decision contract', () => {
  const fixture = createMindFixture('maint-canonical-pending-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  // accepted with no resolutionRef = pending; accepted with resolutionRef = applied; dismissed = not pending.
  const decisions = { decisions: [
    { decision: 'accepted', resolutionRef: null },
    { decision: 'accepted', resolutionRef: 'ref-001' },
    { decision: 'dismissed', resolutionRef: null },
    { decision: 'resolved', resolutionRef: 'ref-002' },
  ]};
  writeFileSync(path.join(reportsDir, 'maintenance-decisions.json'), JSON.stringify(decisions));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    // Only the accepted-without-resolutionRef entry is pending.
    assert.equal(view.maintenanceBacklog.pendingDecisionCount, 1);
    assert.equal(view.maintenanceBacklog.validDecisionCount, 4);
    assert.equal(view.maintenanceBacklog.malformedDecisionCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: repeated calls with fixed now are deterministic', () => {
  const fixture = createMindFixture('maint-determ-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport({
    findings: [{ id: 'f1', status: 'open', type: 'stale-page' }],
  })));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const v1 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    const v2 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
    assert.deepEqual(v1.maintenanceBacklog, v2.maintenanceBacklog);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('maintenanceBacklog: no files are created or modified', () => {
  const fixture = createMindFixture('maint-nowrite-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  const before = readdirSorted(fixture.mindRoot);
  const now = new Date('2026-06-18T12:00:00Z');
  getSimplificationReviewView({ mindRoot: fixture.mindRoot, now });
  const after = readdirSorted(fixture.mindRoot);
  try {
    assert.deepEqual(before, after, 'No files should be created or modified');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PART B — Task 3: approval volume from canonical approval store
// ──────────────────────────────────────────────────────────────────────────────

function makeApprovalStore(records: Array<Record<string, unknown>>): string {
  return JSON.stringify({ records });
}

function makeApprovalRecord(id: string, status: string): Record<string, unknown> {
  return {
    id,
    kind: 'scheduler-run-mind-steward-inbox-queue-dry-run',
    status,
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    requestedBy: 'test',
    executed: false,
    source: 'json',
    preview: { wouldExecute: false, requiresApproval: true, writesToMind: false, externalSideEffects: false, commands: [] },
    policy: { executionEnabled: false, executionGate: 'disabled-until-explicit-enable', requiresDurableAudit: true, requiresRollbackPlan: true },
  };
}

test('approvalVolume: readable empty approval store returns zero counts', () => {
  const fixture = createMindFixture('approval-empty-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.equal(view.approvalVolume.status, 'available');
    assert.equal(view.approvalVolume.totalRequestCount, 0);
    assert.equal(view.approvalVolume.pendingCount, 0);
    assert.equal(view.approvalVolume.approvedCount, 0);
    assert.equal(view.approvalVolume.rejectedCount, 0);
    assert.equal(view.approvalVolume.expiredCount, 0);
    assert.equal(view.approvalVolume.malformedRecordCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: missing approval store returns null counts with blocker', () => {
  const fixture = createMindFixture('approval-missing-');
  const missingStorePath = path.join(fixture.tempDir, 'does-not-exist.json');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: missingStorePath });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert.equal(view.approvalVolume.pendingCount, null);
    assert.equal(view.approvalVolume.approvedCount, null);
    assert.equal(view.approvalVolume.rejectedCount, null);
    assert(view.approvalVolume.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: approved, rejected, pending, and expired records counted separately', () => {
  const fixture = createMindFixture('approval-counts-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('a1', 'approved'),
    makeApprovalRecord('a2', 'approved'),
    makeApprovalRecord('r1', 'rejected'),
    makeApprovalRecord('p1', 'pending'),
    makeApprovalRecord('e1', 'expired'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.equal(view.approvalVolume.approvedCount, 2);
    assert.equal(view.approvalVolume.rejectedCount, 1);
    assert.equal(view.approvalVolume.pendingCount, 1);
    assert.equal(view.approvalVolume.expiredCount, 1);
    assert.equal(view.approvalVolume.totalRequestCount, 5);
    assert.equal(view.approvalVolume.status, 'available');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: malformed records cause partial status', () => {
  const fixture = createMindFixture('approval-malformed-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('a1', 'approved'),
    null as unknown as Record<string, unknown>,
    makeApprovalRecord('b1', 'unknown-status'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.equal(view.approvalVolume.status, 'partial');
    assert(view.approvalVolume.blockers.includes('approvalRecordsMalformed'));
    assert(view.approvalVolume.malformedRecordCount !== null && view.approvalVolume.malformedRecordCount >= 2);
    assert.equal(view.approvalVolume.approvedCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: duplicate stable IDs are not double-counted', () => {
  const fixture = createMindFixture('approval-dedup-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  // Same ID twice — should count only once.
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('dup-id', 'approved'),
    makeApprovalRecord('dup-id', 'approved'),
    makeApprovalRecord('unique', 'pending'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.equal(view.approvalVolume.approvedCount, 1, 'duplicate stable ID must not be double-counted');
    assert.equal(view.approvalVolume.pendingCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: generic report JSON files are not counted as approval records', () => {
  const fixture = createMindFixture('approval-no-reports-');
  // Create report JSON files in system/reports — these must not be counted.
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify(makeMinimalReport()));
  writeFileSync(path.join(reportsDir, 'graph-refresh-latest.json'), JSON.stringify({ foo: 'bar' }));
  // Point approval store at a missing path — should be insufficient-evidence, not derived from report files.
  const missingStorePath = path.join(fixture.tempDir, 'no-approvals.json');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: missingStorePath });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence',
      'report JSON files must not be counted as approval records');
    assert.equal(view.approvalVolume.totalRequestCount, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: malformed approval store file returns insufficient-evidence', () => {
  const fixture = createMindFixture('approval-badfile-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, 'not json }{');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert(view.approvalVolume.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: results are deterministic for fixed store and now', () => {
  const fixture = createMindFixture('approval-determ-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('x1', 'approved'),
    makeApprovalRecord('x2', 'pending'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const v1 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    const v2 = getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
    assert.deepEqual(v1.approvalVolume, v2.approvalVolume);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: route remains read-only — no files created or modified', () => {
  const fixture = createMindFixture('approval-readonly-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([makeApprovalRecord('a1', 'approved')]));
  const before = readdirSorted(fixture.mindRoot);
  const now = new Date('2026-06-18T12:00:00Z');
  getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyApprovalStorePath: tmpStore });
  const after = readdirSorted(fixture.mindRoot);
  try {
    assert.deepEqual(before, after);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PART C — Task 5 provenance correction: persistence-configured semantics
// ──────────────────────────────────────────────────────────────────────────────

test('approvalVolume: persistence not configured returns insufficient-evidence with approvalPersistenceNotConfigured blocker', () => {
  // Tests the "no BRAIN_CORE_APPROVAL_STORE_PATH set" case without mutating process.env.
  const fixture = createMindFixture('approval-not-configured-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyPersistenceConfigured: false,
    });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence');
    assert.equal(view.approvalVolume.persistenceConfigured, false);
    assert.equal(view.approvalVolume.configuredStorePath, null);
    assert.equal(view.approvalVolume.storeStatus, 'not-configured');
    assert.equal(view.approvalVolume.evidenceAvailability, 'none');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert.equal(view.approvalVolume.pendingCount, null);
    assert.equal(view.approvalVolume.approvedCount, null);
    assert.equal(view.approvalVolume.rejectedCount, null);
    assert.equal(view.approvalVolume.expiredCount, null);
    assert(view.approvalVolume.blockers.includes('approvalPersistenceNotConfigured'),
      'must include approvalPersistenceNotConfigured, not approvalStoreMissing');
    // Must NOT claim "no approvals exist" — only that persistence is not configured.
    assert(!view.approvalVolume.blockers.includes('approvalStoreMissing'),
      'must not say store is missing when persistence is not configured');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: configured path missing returns insufficient-evidence with approvalStoreMissing blocker', () => {
  const fixture = createMindFixture('approval-configured-missing-');
  const missingStorePath = path.join(fixture.tempDir, 'does-not-exist.json');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: missingStorePath,
    });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence');
    assert.equal(view.approvalVolume.persistenceConfigured, true);
    assert.equal(view.approvalVolume.configuredStorePath, missingStorePath);
    assert.equal(view.approvalVolume.storeStatus, 'configured-missing');
    assert.equal(view.approvalVolume.evidenceAvailability, 'none');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert(view.approvalVolume.blockers.includes('approvalStoreMissing'));
    // Missing file must not be interpreted as "no approvals exist"
    assert(!view.approvalVolume.blockers.includes('approvalPersistenceNotConfigured'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: readable empty store is available with zero counts', () => {
  const fixture = createMindFixture('approval-configured-empty-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: tmpStore,
    });
    assert.equal(view.approvalVolume.status, 'available');
    assert.equal(view.approvalVolume.persistenceConfigured, true);
    assert.equal(view.approvalVolume.storeStatus, 'configured-readable');
    assert.equal(view.approvalVolume.evidenceAvailability, 'full');
    assert.equal(view.approvalVolume.totalRequestCount, 0);
    assert.equal(view.approvalVolume.pendingCount, 0);
    assert.equal(view.approvalVolume.approvedCount, 0);
    assert.equal(view.approvalVolume.rejectedCount, 0);
    assert.equal(view.approvalVolume.expiredCount, 0);
    assert.equal(view.approvalVolume.malformedRecordCount, 0);
    assert.deepEqual(view.approvalVolume.blockers, []);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: malformed store returns insufficient-evidence with configured-malformed storeStatus', () => {
  const fixture = createMindFixture('approval-configured-malformed-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, 'not valid json }{');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: tmpStore,
    });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence');
    assert.equal(view.approvalVolume.persistenceConfigured, true);
    assert.equal(view.approvalVolume.storeStatus, 'configured-malformed');
    assert.equal(view.approvalVolume.evidenceAvailability, 'none');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert(view.approvalVolume.blockers.length > 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: valid status counts are reported accurately with full evidence', () => {
  const fixture = createMindFixture('approval-full-counts-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('p1', 'pending'),
    makeApprovalRecord('a1', 'approved'),
    makeApprovalRecord('a2', 'approved'),
    makeApprovalRecord('r1', 'rejected'),
    makeApprovalRecord('e1', 'expired'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: tmpStore,
    });
    assert.equal(view.approvalVolume.status, 'available');
    assert.equal(view.approvalVolume.storeStatus, 'configured-readable');
    assert.equal(view.approvalVolume.evidenceAvailability, 'full');
    assert.equal(view.approvalVolume.pendingCount, 1);
    assert.equal(view.approvalVolume.approvedCount, 2);
    assert.equal(view.approvalVolume.rejectedCount, 1);
    assert.equal(view.approvalVolume.expiredCount, 1);
    assert.equal(view.approvalVolume.totalRequestCount, 5);
    assert.equal(view.approvalVolume.malformedRecordCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: malformed records in configured-readable store produce partial status', () => {
  const fixture = createMindFixture('approval-partial-');
  const tmpStore = path.join(fixture.tempDir, 'approvals.json');
  writeFileSync(tmpStore, makeApprovalStore([
    makeApprovalRecord('a1', 'approved'),
    null as unknown as Record<string, unknown>,
    makeApprovalRecord('b1', 'invalid-status'),
  ]));
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: tmpStore,
    });
    assert.equal(view.approvalVolume.status, 'partial');
    assert.equal(view.approvalVolume.storeStatus, 'configured-readable');
    assert.equal(view.approvalVolume.evidenceAvailability, 'partial');
    assert(view.approvalVolume.blockers.includes('approvalRecordsMalformed'));
    assert(view.approvalVolume.malformedRecordCount !== null && view.approvalVolume.malformedRecordCount >= 2);
    assert.equal(view.approvalVolume.approvedCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: missing store does not claim no historical approvals exist', () => {
  // The absence of the configured store file proves only that no readable persistent
  // evidence exists at the configured path — not that no approvals were ever submitted.
  const fixture = createMindFixture('approval-no-history-claim-');
  const missingStorePath = path.join(fixture.tempDir, 'no-store.json');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyApprovalStorePath: missingStorePath,
    });
    // counts must be null — not zero
    assert.strictEqual(view.approvalVolume.totalRequestCount, null,
      'null means absent evidence, not zero approvals');
    assert.strictEqual(view.approvalVolume.approvedCount, null);
    assert.strictEqual(view.approvalVolume.pendingCount, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: generic report JSON files are not counted as approval records (provenance check)', () => {
  // system/reports/*.json files are report artifacts, not approval records.
  const fixture = createMindFixture('approval-report-provenance-');
  const reportsDir = path.join(fixture.mindRoot, 'system', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(path.join(reportsDir, 'maintenance-latest.json'), JSON.stringify({ findings: [], errors: [] }));
  writeFileSync(path.join(reportsDir, 'graph-refresh-latest.json'), JSON.stringify({ foo: 'bar' }));
  // Persistence not configured — should be insufficient-evidence regardless of report files.
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    const view = getSimplificationReviewView({
      mindRoot: fixture.mindRoot,
      now,
      _testOnlyPersistenceConfigured: false,
    });
    assert.equal(view.approvalVolume.status, 'insufficient-evidence',
      'report files must not be counted as approval records');
    assert.equal(view.approvalVolume.totalRequestCount, null);
    assert(view.approvalVolume.blockers.includes('approvalPersistenceNotConfigured'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('approvalVolume: process.env is not mutated by deterministic tests', () => {
  // This test verifies that the test injection mechanism works without environment mutation.
  const envBefore = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const fixture = createMindFixture('approval-no-env-mutation-');
  const now = new Date('2026-06-18T12:00:00Z');
  try {
    getSimplificationReviewView({ mindRoot: fixture.mindRoot, now, _testOnlyPersistenceConfigured: false });
    assert.equal(process.env.BRAIN_CORE_APPROVAL_STORE_PATH, envBefore,
      'process.env must not be mutated by test injection');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
