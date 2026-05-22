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
    }),
  );
  fs.writeFileSync(
    localAppsPath,
    JSON.stringify({
      status: 'ok',
      apps: [{ id: 'probot', name: 'ProBot', status: 'running', actionsSupported: false }],
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
