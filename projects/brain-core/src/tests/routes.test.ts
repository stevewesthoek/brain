import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createRequest(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };

  if (input.method !== undefined) {
    request.method = input.method;
  }

  if (input.url !== undefined) {
    request.url = input.url;
  }

  return request;
}

async function exercise(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

test('GET /status returns read-only status for local requests', async () => {
  const response = await exercise({ method: 'GET', url: '/status' });
  const body = JSON.parse(response.body) as { service: string; mode: string; ok: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.service, 'brain-core');
  assert.equal(body.mode, 'read-only');
  assert.equal(body.ok, true);
});

test('GET /sessions returns placeholder session list', async () => {
  const response = await exercise({ method: 'GET', url: '/sessions' });
  const body = JSON.parse(response.body) as { sessions: Array<{ source: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.sessions.length, 1);
  assert.equal(body.sessions[0]?.source, 'placeholder');
});

test('GET /skills returns a skills list', async () => {
  const response = await exercise({ method: 'GET', url: '/skills' });
  const body = JSON.parse(response.body) as { skills: Array<{ status: string; sourcePath: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.skills.length > 0, true);
  assert.equal(typeof body.skills[0]?.sourcePath, 'string');
});

test('GET /repos returns a repo alias list or setup placeholder', async () => {
  const response = await exercise({ method: 'GET', url: '/repos' });
  const body = JSON.parse(response.body) as { repos: Array<{ alias: string; handoffExists: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.repos.length > 0, true);
  assert.equal(typeof body.repos[0]?.alias, 'string');
  assert.equal(typeof body.repos[0]?.handoffExists, 'boolean');
});

test('GET /orchestrators returns placeholder orchestrator list', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators' });
  const body = JSON.parse(response.body) as { orchestrators: Array<{ id: string; actionsSupported: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.orchestrators.length > 0, true);
  assert.equal(body.orchestrators[0]?.actionsSupported, false);
});

test('GET /capabilities returns manifest with executable actions disabled', async () => {
  const response = await exercise({ method: 'GET', url: '/capabilities' });
  const body = JSON.parse(response.body) as {
    readEndpoints: string[];
    approvalRequestEndpoints: string[];
    executableActionsEnabled: boolean;
    approvalAuditPersistenceSupported: boolean;
    runtimeReportsSupported: boolean;
    runtimeReportEndpoint: string;
    modelRouterReportSupported: boolean;
    obsidianPluginInstalled: boolean;
    liveSchedulerVerified: boolean;
    mindWorkspace: {
      legacyTaskMigrationStatus: string;
      legacyTaskMigrationCommit?: string;
      cleanupInventory: string;
      workspaceIsolationRunbook: string;
      remainingKnownDirtyCategories: string[];
    };
    brainConsole: {
      scaffoldStatus: string;
      installedInMindVault: boolean;
      projectPath: string;
      packageStatus?: string;
      manualInstallRequired?: boolean;
    };
    probot: {
      thinClientStatus: string;
      commandAliasesEnabled: boolean;
      actionsEnabled: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.readEndpoints.includes('/orchestrators'), true);
  assert.equal(body.approvalRequestEndpoints.includes('/sessions/:id/resume'), true);
  assert.equal(body.executableActionsEnabled, false);
  assert.equal(body.approvalAuditPersistenceSupported, true);
  assert.equal(body.runtimeReportsSupported, true);
  assert.equal(body.runtimeReportEndpoint, '/runtime/reports');
  assert.equal(body.modelRouterReportSupported, true);
  assert.equal(body.obsidianPluginInstalled, false);
  assert.equal(body.liveSchedulerVerified, false);
  assert.equal(body.mindWorkspace.legacyTaskMigrationStatus, 'completed');
  assert.equal(body.mindWorkspace.legacyTaskMigrationCommit, '12495d4');
  assert.equal(body.mindWorkspace.cleanupInventory, 'operations/reports/mind-dirty-state-inventory-2026-05-18.md');
  assert.equal(body.mindWorkspace.workspaceIsolationRunbook, 'operations/runbooks/mind-workspace-isolation.md');
  assert.equal(body.mindWorkspace.remainingKnownDirtyCategories.includes('.obsidian/community-plugins.json'), true);
  assert.equal(body.brainConsole.scaffoldStatus, 'validated');
  assert.equal(body.brainConsole.installedInMindVault, false);
  assert.equal(body.brainConsole.projectPath, 'projects/brain-console-obsidian');
  assert.equal(body.brainConsole.packageStatus, 'buildable');
  assert.equal(body.brainConsole.manualInstallRequired, true);
  assert.equal(body.probot.thinClientStatus, 'wired');
  assert.equal(body.probot.commandAliasesEnabled, true);
  assert.equal(body.probot.actionsEnabled, false);
});

test('GET /scheduler/status returns read-only placeholder scheduler state', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/status' });
  const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'placeholder');
  assert.equal(body.enabled, false);
  assert.equal(body.source, 'placeholder');
});

test('GET /scheduler/latest-run returns read-only placeholder latest run state', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/latest-run' });
  const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'placeholder');
  assert.equal(body.enabled, false);
  assert.equal(body.source, 'placeholder');
});

test('GET /scheduler/latest-run reads model-router runtime report when configured', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      job: 'model-router-dry-run',
      status: 'success',
      message: 'model-router dry-run validation passed',
      endedAtLisbon: '2026-05-17 07:00:00 WEST',
      mode: 'dry-run-report-only',
      writesToMind: false,
      executableActions: false,
    }),
  );
  process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/latest-run' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string; latestRunStatus: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'runtime-report');
    assert.equal(body.enabled, true);
    assert.equal(body.source, 'runtime-report');
    assert.equal(body.latestRunStatus, 'ok');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /scheduler/jobs returns placeholder model-router jobs', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
  const body = JSON.parse(response.body) as { jobs: Array<{ id: string; mutationRequired: boolean; status: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.jobs.length, 5);
  assert.equal(body.jobs[0]?.id, 'mind-compile-loop');
  assert.equal(typeof body.jobs[0]?.mutationRequired, 'boolean');
  assert.equal(body.jobs.some((job) => job.id === 'model-router-dry-run'), true);
});

test('GET /scheduler/jobs reports model-router dry-run ok status when runtime report exists', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-jobs');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success' }));
  process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
    const body = JSON.parse(response.body) as { jobs: Array<{ id: string; status: string }> };
    const modelRouterJob = body.jobs.find((job) => job.id === 'model-router-dry-run');

    assert.equal(response.statusCode, 200);
    assert.equal(modelRouterJob?.status, 'ok');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /local-apps returns placeholder local app list', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps' });
  const body = JSON.parse(response.body) as { apps: Array<{ id: string; actionsSupported: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.apps.length > 0, true);
  assert.equal(body.apps[0]?.actionsSupported, false);
});

test('GET /video/status returns read-only placeholder video state', async () => {
  const response = await exercise({ method: 'GET', url: '/video/status' });
  const body = JSON.parse(response.body) as { enabled: boolean; queueDepth: number; source: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.enabled, false);
  assert.equal(body.queueDepth, 0);
  assert.equal(body.source, 'placeholder');
});

test('GET /video/status and /video/queue read from safe video runtime report when configured', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-video-report');
  const reportPath = path.join(testDir, 'latest.json');
  const previousPath = process.env.BRAIN_CORE_VIDEO_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
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
  process.env.BRAIN_CORE_VIDEO_REPORT_PATH = reportPath;

  try {
    const statusResponse = await exercise({ method: 'GET', url: '/video/status' });
    const statusBody = JSON.parse(statusResponse.body) as { status: string; enabled: boolean; queueDepth: number; source: string };
    const queueResponse = await exercise({ method: 'GET', url: '/video/queue' });
    const queueBody = JSON.parse(queueResponse.body) as { queue: Array<{ id: string; title: string; status: string; source: string }> };

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusBody.status, 'ok');
    assert.equal(statusBody.enabled, true);
    assert.equal(statusBody.queueDepth, 1);
    assert.equal(statusBody.source, 'runtime-report');
    assert.equal(queueBody.queue.length, 1);
    assert.equal(queueBody.queue[0]?.id, 'video-1');
    assert.equal(queueBody.queue[0]?.source, 'runtime-report');
  } finally {
    if (previousPath === undefined) {
      delete process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_VIDEO_REPORT_PATH = previousPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /video/queue returns read-only queue list', async () => {
  const response = await exercise({ method: 'GET', url: '/video/queue' });
  const body = JSON.parse(response.body) as { queue: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body.queue), true);
});

test('GET /local-apps reads from safe local-apps runtime report when configured', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-local-apps-report');
  const reportPath = path.join(testDir, 'latest.json');
  const previousPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      status: 'ok',
      apps: [{ id: 'probot', name: 'ProBot', status: 'running', actionsSupported: false }],
      writesToMind: false,
      executableActions: false,
    }),
  );
  process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/local-apps' });
    const body = JSON.parse(response.body) as { apps: Array<{ id: string; name: string; status: string; actionsSupported: boolean; source: string }> };

    assert.equal(response.statusCode, 200);
    assert.equal(body.apps.length, 1);
    assert.equal(body.apps[0]?.id, 'probot');
    assert.equal(body.apps[0]?.status, 'running');
    assert.equal(body.apps[0]?.actionsSupported, false);
    assert.equal(body.apps[0]?.source, 'runtime-report');
  } finally {
    if (previousPath === undefined) {
      delete process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = previousPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /video/status falls back to failed read-only state when runtime report is invalid', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-video-invalid');
  const reportPath = path.join(testDir, 'latest.json');
  const previousPath = process.env.BRAIN_CORE_VIDEO_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ status: 'ok', writesToMind: false, executableActions: true }),
  );
  process.env.BRAIN_CORE_VIDEO_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/video/status' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string; message: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'failed');
    assert.equal(body.enabled, false);
    assert.equal(body.source, 'runtime-report');
    assert.equal(body.message.includes('unsupported execution flags'), true);
  } finally {
    if (previousPath === undefined) {
      delete process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_VIDEO_REPORT_PATH = previousPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /local-apps falls back to invalid runtime-report placeholder when report is invalid', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-local-apps-invalid');
  const reportPath = path.join(testDir, 'latest.json');
  const previousPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'ok', writesToMind: false, executableActions: true }));
  process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/local-apps' });
    const body = JSON.parse(response.body) as { apps: Array<{ id: string; status: string; actionsSupported: boolean; source: string }> };

    assert.equal(response.statusCode, 200);
    assert.equal(body.apps[0]?.id, 'local-apps-report');
    assert.equal(body.apps[0]?.status, 'unknown');
    assert.equal(body.apps[0]?.actionsSupported, false);
    assert.equal(body.apps[0]?.source, 'runtime-report');
  } finally {
    if (previousPath === undefined) {
      delete process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH = previousPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /approvals returns placeholder approvals list before action requests', async () => {
  const response = await exercise({ method: 'GET', url: '/approvals' });
  const body = JSON.parse(response.body) as { approvals: Array<{ id: string; status: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approvals.length > 0, true);
  assert.equal(typeof body.approvals[0]?.status, 'string');
});

test('POST /actions/request creates an approval record without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
  const body = JSON.parse(response.body) as { approval: { id: string; kind: string; status: string }; executed: boolean };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'manual-request');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.executed, false);
});

test('GET /approvals/audit returns approval audit events', async () => {
  await exercise({ method: 'POST', url: '/actions/request?kind=custom-audit-test' });
  const response = await exercise({ method: 'GET', url: '/approvals/audit' });
  const body = JSON.parse(response.body) as {
    events: Array<{ event: string; kind: string; persisted: boolean; executed: boolean; source: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.events.some((event) => event.event === 'requested' && event.kind === 'custom-audit-test'), true);
  assert.equal(typeof body.events[0]?.persisted, 'boolean');
  assert.equal(body.events.every((event) => event.executed === false), true);
});

test('GET /runtime/reports returns report summaries', async () => {
  const response = await exercise({ method: 'GET', url: '/runtime/reports' });
  const body = JSON.parse(response.body) as { reports: Array<{ id: string; writesToMind: boolean; executableActions: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.reports.some((report) => report.id === 'model-router'), true);
  assert.equal(body.reports.every((report) => report.writesToMind === false), true);
  assert.equal(body.reports.every((report) => report.executableActions === false), true);
});

test('approval audit JSONL persistence writes to a safe runtime path', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-approval-audit');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;

  try {
    const response = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
    const body = JSON.parse(response.body) as { approval: { id: string } };
    const auditResponse = await exercise({ method: 'GET', url: '/approvals/audit' });
    const auditBody = JSON.parse(auditResponse.body) as { events: Array<{ approvalId: string; source: string; persisted: boolean; executed: boolean }> };

    assert.equal(response.statusCode, 202);
    assert.equal(fs.existsSync(auditPath), true);
    assert.equal(auditBody.events.some((event) => event.approvalId === body.approval.id && event.source === 'jsonl'), true);
    assert.equal(auditBody.events.every((event) => event.executed === false), true);
    assert.equal(auditBody.events.some((event) => event.persisted === true), true);
  } finally {
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('invalid approval audit path falls back to memory and does not throw', async () => {
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = '/Users/Office/Repos/stevewesthoek/mind/.env/approval-audit.jsonl';

  try {
    const response = await exercise({ method: 'POST', url: '/actions/request?kind=custom-approval-fallback-test' });
    const body = JSON.parse(response.body) as { approval: { status: string } };
    const auditResponse = await exercise({ method: 'GET', url: '/approvals/audit' });
    const auditBody = JSON.parse(auditResponse.body) as { events: Array<{ kind: string; source: string }> };

    assert.equal(response.statusCode, 202);
    assert.equal(body.approval.status, 'pending');
    assert.equal(
      auditBody.events.some((event) => event.kind === 'custom-approval-fallback-test' && event.source === 'memory'),
      true,
    );
  } finally {
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
  }
});

test('POST /actions/request rejects unsupported custom kinds without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/request?kind=unsafe-kernel-hook' });
  const body = JSON.parse(response.body) as { accepted: boolean; approval?: { kind: string; status: string }; executed: boolean; message: string };

  assert.equal(response.statusCode, 202);
  assert.equal(body.accepted, false);
  assert.equal(body.approval, undefined);
  assert.equal(body.executed, false);
  assert.equal(body.message.includes('Unsupported approval request kind'), true);
});

test('roadmap POST targets create approval requests without executing', async () => {
  const routes = [
    ['/scheduler/jobs/mind-compile-loop/request-run', 'scheduler-run-mind-compile-loop'],
    ['/skills/profile?profile=research', 'skill-profile-research'],
    ['/sessions/abc123/resume', 'session-resume-abc123'],
    ['/local-apps/probot/start', 'local-app-start-probot'],
    ['/local-apps/probot/stop', 'local-app-stop-probot'],
    ['/local-apps/probot/restart', 'local-app-restart-probot'],
  ] as const;

  for (const [url, kind] of routes) {
    const response = await exercise({ method: 'POST', url });
    const body = JSON.parse(response.body) as { approval: { kind: string; status: string }; executed: boolean };

    assert.equal(response.statusCode, 202);
    assert.equal(body.approval.kind, kind);
    assert.equal(body.approval.status, 'pending');
    assert.equal(body.executed, false);
  }
});

test('POST /approvals/:id/approve marks approval approved without executing', async () => {
  const requestResponse = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
  const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
  const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
  const body = JSON.parse(response.body) as { approval: { status: string }; executed: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approval.status, 'approved');
  assert.equal(body.executed, false);
});

test('POST /approvals/:id/reject marks approval rejected without executing', async () => {
  const requestResponse = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
  const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
  const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/reject` });
  const body = JSON.parse(response.body) as { approval: { status: string }; executed: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approval.status, 'rejected');
  assert.equal(body.executed, false);
});

test('POST /approvals/:id/approve records missing audit event when approval does not exist', async () => {
  const response = await exercise({ method: 'POST', url: '/approvals/approval-missing/approve' });
  const body = JSON.parse(response.body) as { approval: { status: string }; executed: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.approval.status, 'expired');
  assert.equal(body.executed, false);
});

test('unsupported non-GET/POST requests are rejected', async () => {
  const response = await exercise({ method: 'PUT', url: '/status' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 405);
  assert.equal(body.error.code, 'method_not_allowed');
});

test('non-local requests are rejected', async () => {
  const response = await exercise({ method: 'GET', url: '/status', remoteAddress: '203.0.113.10' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 403);
  assert.equal(body.error.code, 'forbidden_non_local_request');
});
