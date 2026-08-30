import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listRuntimeReports } from '../adapters/runtime-reports.js';

test('runtime reports return missing by default', () => {
  const previousMindStewardPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousVideoPath = process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
  const previousLocalAppsPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = '/tmp/brain-core-missing-mind-steward.json';
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = '/tmp/brain-core-missing-approval-audit.jsonl';
  process.env.BRAIN_CORE_VIDEO_REPORT_PATH = '/tmp/brain-core-missing-video.json';
  process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = '/tmp/brain-core-missing-local-apps.json';

  try {
    const reports = listRuntimeReports();
    const mindSteward = reports.find((report) => report.id === 'mind-steward');
    const approvalAudit = reports.find((report) => report.id === 'approval-audit');
    const video = reports.find((report) => report.id === 'video');
    const localApps = reports.find((report) => report.id === 'local-apps');

    assert.equal(mindSteward?.status, 'missing');
    assert.equal(approvalAudit?.status, 'missing');
    assert.equal(video?.status, 'missing');
    assert.equal(localApps?.status, 'missing');
    assert.equal(reports.every((report) => report.writesToMind === false), true);
    assert.equal(reports.every((report) => report.executableActions === false), true);
  } finally {
    if (previousMindStewardPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousMindStewardPath;
    }
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    if (previousVideoPath === undefined) {
      delete process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_VIDEO_REPORT_PATH = previousVideoPath;
    }
    if (previousLocalAppsPath === undefined) {
      delete process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = previousLocalAppsPath;
    }
  }
});

test('runtime reports honor configured mind-steward JSON and approval-audit JSONL paths', () => {
  const baseDir = '/tmp/codex-runtime-reports-test';
  const mindStewardPath = path.join(baseDir, 'runtime', 'local', 'mind-steward', 'latest.json');
  const auditPath = path.join(baseDir, 'runtime', 'local', 'brain-core', 'approval-audit.jsonl');
  const previousMindStewardPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(mindStewardPath), { recursive: true });
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(
    mindStewardPath,
    JSON.stringify({
      status: 'success',
      message: 'mind-steward dry-run validation passed',
      writesToMind: false,
      executableActions: false,
      wikiHealth: {
        status: 'available',
        ok: false,
        summary: {
          errorCount: 1,
          warningCount: 2,
        },
      },
    }),
  );
  fs.writeFileSync(auditPath, JSON.stringify({ persisted: true }) + '\n');
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = mindStewardPath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;

  try {
    const reports = listRuntimeReports();
    const mindSteward = reports.find((report) => report.id === 'mind-steward');
    const approvalAudit = reports.find((report) => report.id === 'approval-audit');

    assert.equal(mindSteward?.status, 'available');
    assert.equal(mindSteward?.latestRunStatus, 'ok');
    assert.equal(mindSteward?.wikiHealth?.status, 'available');
    assert.equal(mindSteward?.wikiHealth?.warningCount, 2);
    assert.equal(approvalAudit?.status, 'available');
    assert.equal(approvalAudit?.latestRunStatus, 'unknown');
  } finally {
    if (previousMindStewardPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousMindStewardPath;
    }
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('runtime reports reject unsafe paths and return invalid', () => {
  const previousMindStewardPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = '/Users/Office/Repos/stevewesthoek/mind/.env/latest.json';

  try {
    const reports = listRuntimeReports();
    const mindSteward = reports.find((report) => report.id === 'mind-steward');

    assert.equal(mindSteward?.status, 'invalid');
  } finally {
    if (previousMindStewardPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousMindStewardPath;
    }
  }
});

test('runtime reports honor configured video and local-apps JSON paths', () => {
  const baseDir = '/tmp/codex-runtime-video-local-apps-test';
  const videoPath = path.join(baseDir, 'runtime', 'local', 'video', 'latest.json');
  const localAppsPath = path.join(baseDir, 'runtime', 'local', 'local-apps', 'latest.json');
  const previousVideoPath = process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
  const previousLocalAppsPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;

  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(videoPath), { recursive: true });
  fs.mkdirSync(path.dirname(localAppsPath), { recursive: true });
  fs.writeFileSync(
    videoPath,
    JSON.stringify({
      status: 'ok',
      enabled: true,
      latestRunAt: '2026-05-18T00:00:00.000Z',
      message: 'read-only report',
      queue: [{ id: 'video-1', title: 'Example', status: 'queued' }],
      writesToMind: false,
      executableActions: false,
      storage: {
        schemaVersion: '1.0.0',
        status: 'partial',
        generatedAt: '2026-05-18T00:00:00.000Z',
        roots: [{
          id: 'legacy-video',
          classification: 'UNKNOWN',
          status: 'partial',
          exists: true,
          bytes: 42,
          fileCount: 1,
          directoryCount: 1,
          oldestModifiedAt: null,
          newestModifiedAt: null,
          ageBuckets: { unknown: 1 },
          warnings: ['legacy-video:permission-denied'],
        }],
        totals: { bytes: 42, files: 1, directories: 1, temporaryBytes: 0, durableBytes: 0, legacyBytes: 0, unknownBytes: 42 },
        ageBuckets: { unknown: 1 },
        warningThresholds: { staleAgeDays: 30, unknownBytes: 1, legacyBytes: 1 },
        bounds: { maxDepth: 4, maxFilesPerRoot: 5000, maxDirectoriesPerRoot: 1000, timeoutSeconds: 2 },
        warnings: ['unknown-storage-present'],
        collectionErrors: ['legacy-video:permission-denied'],
        candidateCount: 0,
        safety: { reportOnly: true, writesToMind: false, executableActions: false, deletesFiles: false, movesFiles: false, archivesFiles: false, networkAccess: false, privateContentNames: false },
      },
    }),
  );
  fs.writeFileSync(
    localAppsPath,
    JSON.stringify({
      status: 'ok',
      apps: [{ id: 'office-scheduler', name: 'Office Nightly Scheduler', status: 'running', actionsSupported: false }],
      writesToMind: false,
      executableActions: false,
    }),
  );
  process.env.BRAIN_CORE_VIDEO_REPORT_PATH = videoPath;
  process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = localAppsPath;

  try {
    const reports = listRuntimeReports();
    const video = reports.find((report) => report.id === 'video');
    const localApps = reports.find((report) => report.id === 'local-apps');

    assert.equal(video?.status, 'available');
    assert.equal(video?.storage?.status, 'partial');
    assert.equal(video?.storage?.totals.unknownBytes, 42);
    const unsafeReport = JSON.parse(fs.readFileSync(videoPath, 'utf8')) as { storage: { safety: { deletesFiles: boolean } } };
    unsafeReport.storage.safety.deletesFiles = true;
    fs.writeFileSync(videoPath, JSON.stringify(unsafeReport));
    const unsafeVideo = listRuntimeReports().find((report) => report.id === 'video');
    assert.equal(unsafeVideo?.storage, undefined, 'Brain Core must not expose storage telemetry with unsafe flags');
    assert.equal(localApps?.status, 'available');
    assert.equal(reports.every((report) => report.writesToMind === false), true);
    assert.equal(reports.every((report) => report.executableActions === false), true);
  } finally {
    if (previousVideoPath === undefined) {
      delete process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_VIDEO_REPORT_PATH = previousVideoPath;
    }
    if (previousLocalAppsPath === undefined) {
      delete process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = previousLocalAppsPath;
    }
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
