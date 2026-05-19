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
    executionGate: {
      executionEnabled: boolean;
      modelRouterDryRunExecutionFlagEnabled: boolean;
      modelRouterDryRunExecutionFlagName: string;
      candidateActionKinds: string[];
      readinessEndpoint: string;
      plansEndpoint: string;
      firstCandidate: string;
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
  assert.equal(body.executionGate.executionEnabled, false);
  assert.equal(body.executionGate.modelRouterDryRunExecutionFlagEnabled, false);
  assert.equal(body.executionGate.modelRouterDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
  assert.equal(body.executionGate.firstCandidate, 'scheduler-run-model-router-dry-run');
  assert.equal(body.executionGate.readinessEndpoint, '/execution/readiness');
  assert.equal(body.executionGate.plansEndpoint, '/execution/plans');
  assert.equal(body.executionGate.candidateActionKinds.includes('scheduler-run-model-router-dry-run'), true);
});

test('GET /scheduler/status returns read-only placeholder scheduler state', async () => {
  const previousReportPath = process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
  process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = path.join(process.cwd(), '.buildflow-test-missing-scheduler-report.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/status' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'placeholder');
    assert.equal(body.enabled, false);
    assert.equal(body.source, 'placeholder');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = previousReportPath;
    }
  }
});

test('GET /scheduler/latest-run returns read-only placeholder latest run state', async () => {
  const previousReportPath = process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
  process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = path.join(process.cwd(), '.buildflow-test-missing-latest-report.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/latest-run' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'placeholder');
    assert.equal(body.enabled, false);
    assert.equal(body.source, 'placeholder');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = previousReportPath;
    }
  }
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

test('GET /local-apps/dashboard returns safe inventory dashboard payload', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/dashboard' });
  const body = JSON.parse(response.body) as {
    id: string;
    appCount: number;
    runningCount: number;
    stoppedCount: number;
    unknownCount: number;
    managedCount: number;
    unmanagedCount: number;
    apps: Array<{ id: string; name: string; actionEnabled: boolean; actionDisabledReason: string; managed: boolean }>;
    actionPolicy: { pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; status: string };
    safety: { readOnlyDashboard: boolean; pluginExecutesShell: boolean; arbitraryCommandExecution: boolean; startStopControlsEnabled: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-dashboard');
  assert.equal(body.appCount, body.apps.length);
  assert.equal(body.actionPolicy.pluginExecutesShell, false);
  assert.equal(body.actionPolicy.arbitraryCommandAllowed, false);
  assert.equal(body.safety.readOnlyDashboard, true);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandExecution, false);
  assert.equal(body.actionPolicy.status, 'enabled');
  assert.equal(body.safety.startStopControlsEnabled, true);
  assert.ok(body.apps.length > 0);
  assert.ok(body.apps.some((app) => app.id === 'model-router'));
});

test('GET /local-apps/orchestrator returns standardized inventory model', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/orchestrator' });
  const body = JSON.parse(response.body) as {
    id: string;
    appCount: number;
    serviceCount: number;
    databaseCount: number;
    definitions: Array<{ id: string; name: string; services: Array<{ id: string }> }>;
    safety: { pluginExecutesShell: boolean; arbitraryCommandExecution: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-orchestrator');
  assert.equal(body.appCount, body.definitions.length);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandExecution, false);
  assert.ok(body.serviceCount >= 0);
});

test('GET /local-apps/onboarding-checklist returns standard onboarding policy', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/onboarding-checklist' });
  const body = JSON.parse(response.body) as {
    id: string;
    requiredFields: string[];
    onboardingSteps: string[];
    safety: { pluginExecutesShell: boolean; arbitraryCommandExecution: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-onboarding-checklist');
  assert.ok(body.requiredFields.includes('appPort'));
  assert.ok(body.onboardingSteps.length > 0);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandExecution, false);
});

test('GET /local-apps/action-plans returns disabled plans by default', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-plans' });
  const body = JSON.parse(response.body) as {
    plans: Array<{ appId: string; action: string; status: string; pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.plans.length > 0);
  assert.ok(body.plans.every((plan) => plan.pluginExecutesShell === false));
  assert.ok(body.plans.every((plan) => plan.arbitraryCommandAllowed === false));
});

test('GET /local-apps/model-router/action-plan/start returns a safe disabled plan', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/model-router/action-plan/start' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    status: string;
    pluginExecutesShell: boolean;
    arbitraryCommandAllowed: boolean;
    canExecuteNow: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'model-router');
  assert.equal(body.action, 'start');
  assert.equal(body.pluginExecutesShell, false);
  assert.equal(body.arbitraryCommandAllowed, false);
  assert.equal(body.canExecuteNow, false);
});

test('GET /local-apps/action-readiness returns ready for controlled endpoints', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-readiness' });
  const body = JSON.parse(response.body) as {
    id: string;
    ready: boolean;
    status: string;
    criteria: Array<{ id: string; satisfied: boolean }>;
    safety: { pluginExecutesShell: boolean; arbitraryCommandExecution: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-action-readiness');
  assert.equal(body.ready, true);
  assert.equal(body.status, 'ready');
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandExecution, false);
  assert.ok(body.criteria.length > 0);
});

test('POST /local-apps/model-router/start returns structured controlled result', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/model-router/start' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    status: string;
    steps: Array<{ id: string; status: string }>;
    safety: { pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; canonicalAppIdRequired: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'model-router');
  assert.equal(body.action, 'start');
  assert.ok(['success', 'failed', 'not_executable', 'blocked'].includes(body.status));
  assert.ok(body.steps.length > 0);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.canonicalAppIdRequired, true);
});

test('POST /local-apps/model-router/start rejects command override parameters', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/model-router/start?command=rm%20-rf%20%2Ftmp%2Funsafe' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    safety: { arbitraryCommandAllowed: boolean; canonicalAppIdRequired: boolean };
    steps: Array<{ label: string; message: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'model-router');
  assert.equal(body.action, 'start');
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.canonicalAppIdRequired, true);
  assert.equal(JSON.stringify(body.steps).includes('rm -rf'), false);
});

test('POST /local-apps/unknown/start rejects unknown app id', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/unknown/start' });
  assert.equal(response.statusCode, 404);
});

test('POST /local-apps/dashboard is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/dashboard' });
  assert.equal(response.statusCode, 404);
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

test('GET /approvals/store returns read-only store health', async () => {
  const response = await exercise({ method: 'GET', url: '/approvals/store' });
  const body = JSON.parse(response.body) as { enabled: boolean; status: string; recordCount: number; writesToMind: boolean; executableActions: boolean };

  assert.equal(response.statusCode, 200);
  assert.equal(body.enabled, false);
  assert.equal(body.status, 'memory');
  assert.equal(body.writesToMind, false);
  assert.equal(body.executableActions, false);
  assert.equal(typeof body.recordCount, 'number');
});

test('GET /approvals/store reports unsafe for invalid configured path', async () => {
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = '/Users/Office/Repos/stevewesthoek/mind/.obsidian/approvals.json';

  try {
    const response = await exercise({ method: 'GET', url: '/approvals/store' });
    const body = JSON.parse(response.body) as { enabled: boolean; status: string; recordCount: number };

    assert.equal(response.statusCode, 200);
    assert.equal(body.enabled, false);
    assert.equal(body.status, 'unsafe');
    assert.equal(body.recordCount, 0);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
  }
});

test('POST /actions/request persists approval records when the store path is configured', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-approval-store');
  const storePath = path.join(testDir, 'approvals.json');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;

  try {
    const response = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
    const storeResponse = await exercise({ method: 'GET', url: '/approvals/store' });
    const storeBody = JSON.parse(storeResponse.body) as { status: string; recordCount: number };

    assert.equal(response.statusCode, 202);
    assert.equal(fs.existsSync(storePath), true);
    assert.equal(storeBody.status, 'available');
    assert.equal(storeBody.recordCount > 0, true);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /approvals/store returns invalid for corrupted persisted store', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-approval-store-invalid');
  const storePath = path.join(testDir, 'approvals.json');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(storePath, '{not-json');
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;

  try {
    const response = await exercise({ method: 'GET', url: '/approvals/store' });
    const body = JSON.parse(response.body) as { enabled: boolean; status: string; recordCount: number };

    assert.equal(response.statusCode, 200);
    assert.equal(body.enabled, true);
    assert.equal(body.status, 'invalid');
    assert.equal(body.recordCount, 0);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /actions/request surfaces store summary when approval store is enabled', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-approval-store-summary');
  const storePath = path.join(testDir, 'approvals.json');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;

  try {
    const response = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
    const body = JSON.parse(response.body) as { preview: { wouldExecute: boolean }; policy: { executionEnabled: boolean }; executed: boolean };
    const storeResponse = await exercise({ method: 'GET', url: '/approvals/store' });
    const storeBody = JSON.parse(storeResponse.body) as { enabled: boolean; status: string; recordCount: number };

    assert.equal(response.statusCode, 202);
    assert.equal(body.preview.wouldExecute, false);
    assert.equal(body.policy.executionEnabled, false);
    assert.equal(body.executed, false);
    assert.equal(storeBody.enabled, true);
    assert.equal(storeBody.status, 'available');
    assert.equal(storeBody.recordCount > 0, true);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /actions/request creates an approval record without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/request?kind=manual-request' });
  const body = JSON.parse(response.body) as {
    approval: { id: string; kind: string; status: string };
    preview: { wouldExecute: boolean; requiresApproval: boolean; writesToMind: boolean; externalSideEffects: boolean; commands: string[] };
    policy: { executionEnabled: boolean; executionGate: string; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'manual-request');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.wouldExecute, false);
  assert.equal(body.preview.requiresApproval, true);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.executionGate, 'disabled-until-explicit-enable');
  assert.equal(body.executed, false);
});

test('POST /scheduler/jobs/model-router-dry-run/request-run uses execution plan preview metadata without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
  const body = JSON.parse(response.body) as {
    approval: { kind: string; status: string };
    preview: { kind: string; summary: string; wouldExecute: boolean; writesToMind: boolean };
    policy: { executionEnabled: boolean; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'scheduler-run-model-router-dry-run');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.kind, 'scheduler-run-model-router-dry-run');
  assert.equal(body.preview.summary.toLowerCase().includes('report-only model-router dry-run'), true);
  assert.equal(body.preview.wouldExecute, false);
  assert.equal(body.preview.writesToMind, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.requiresDurableAudit, true);
  assert.equal(body.policy.requiresRollbackPlan, true);
  assert.equal(body.executed, false);
});

test('GET /execution/plans returns the future first execution candidate', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans' });
  const body = JSON.parse(response.body) as {
    plans: Array<{
      kind: string;
      candidate: boolean;
      executionEnabled: boolean;
      modelRouterDryRunExecutionFlagEnabled: boolean;
      modelRouterDryRunExecutionFlagName: string;
      wouldExecute: boolean;
      executed: boolean;
      writesToMind: boolean;
      mindPreviewPolicy: {
        status: string;
        firstProposedAction: string;
        firstProposedTarget: string;
        writesToMind: boolean;
        externalSideEffects: boolean;
        applyRouteEnabled: boolean;
        allowedTargets: string[];
        blockedPrefixes: string[];
        requiredGates: string[];
      };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plans.length, 1);
  assert.equal(body.plans[0]?.kind, 'scheduler-run-model-router-dry-run');
  assert.equal(body.plans[0]?.candidate, true);
  assert.equal(body.plans[0]?.executionEnabled, false);
  assert.equal(body.plans[0]?.modelRouterDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[0]?.modelRouterDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
  assert.equal(body.plans[0]?.wouldExecute, false);
  assert.equal(body.plans[0]?.executed, false);
  assert.equal(body.plans[0]?.writesToMind, false);
  assert.equal(body.plans[0]?.mindPreviewPolicy.status, 'preview-only');
  assert.equal(body.plans[0]?.mindPreviewPolicy.firstProposedAction, 'model-router-update-current-context');
  assert.equal(body.plans[0]?.mindPreviewPolicy.firstProposedTarget, 'router/current.md');
  assert.equal(body.plans[0]?.mindPreviewPolicy.writesToMind, false);
  assert.equal(body.plans[0]?.mindPreviewPolicy.externalSideEffects, false);
  assert.equal(body.plans[0]?.mindPreviewPolicy.applyRouteEnabled, false);
  assert.equal(body.plans[0]?.mindPreviewPolicy.allowedTargets.includes('router/current.md'), true);
  assert.equal(body.plans[0]?.mindPreviewPolicy.blockedPrefixes.includes('.obsidian/'), true);
  assert.equal(body.plans[0]?.mindPreviewPolicy.blockedPrefixes.includes('03-projects/'), true);
  assert.equal(body.plans[0]?.mindPreviewPolicy.requiredGates.includes('fresh preview hash referenced by approval'), true);
});

test('GET /execution/mind-preview-policy returns preview-only policy metadata', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/mind-preview-policy' });
  const body = JSON.parse(response.body) as {
    status: string;
    firstProposedAction: string;
    firstProposedTarget: string;
    applyRouteEnabled: boolean;
    writesToMind: boolean;
    externalSideEffects: boolean;
    allowedTargets: string[];
    blockedPrefixes: string[];
    requiredGates: string[];
    docs: Array<{ path: string; description: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'preview-only');
  assert.equal(body.firstProposedAction, 'model-router-update-current-context');
  assert.equal(body.firstProposedTarget, 'router/current.md');
  assert.equal(body.applyRouteEnabled, false);
  assert.equal(body.writesToMind, false);
  assert.equal(body.externalSideEffects, false);
  assert.equal(body.allowedTargets.includes('router/current.md'), true);
  assert.equal(body.blockedPrefixes.includes('.obsidian/'), true);
  assert.equal(body.blockedPrefixes.includes('01-inbox/'), true);
  assert.equal(body.requiredGates.includes('localhost-only request'), true);
  assert.equal(
    body.docs.some((doc) => doc.path === 'operations/specs/1779034874780-model-router-mind-write-apply-policy.md'),
    true,
  );
  assert.equal(
    body.docs.some((doc) => doc.path === 'docs/system/1779034841996-obsidian-mind-model-router-handoff.md'),
    true,
  );
});

test('GET /execution/mind-previews returns empty list when no preview artifacts exist', async () => {
  const previous = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = path.join(process.cwd(), '.buildflow-test-mind-previews-missing');
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: Array<{ writesToMind: boolean; externalSideEffects: boolean }> };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 0);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previous;
  }
});

test('GET /execution/mind-previews/latest returns empty state when no preview artifacts exist', async () => {
  const previous = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = path.join(process.cwd(), '.buildflow-test-mind-previews-empty');
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews/latest' });
    const body = JSON.parse(response.body) as { status: string; preview?: { writesToMind: boolean } };
    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'empty');
    assert.equal(body.preview, undefined);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previous;
  }
});

test('GET /execution/mind-previews/:id returns not found for unknown id', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/mind-previews/preview-missing' });
  const body = JSON.parse(response.body) as { error: { code: string } };
  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /execution/mind-previews lists safe fixture preview artifacts', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-mind-previews');
  const previewDir = path.join(testDir, 'runtime', 'local', 'model-router', 'previews');
  const previous = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(previewDir, { recursive: true });
  fs.writeFileSync(
    path.join(previewDir, 'preview-test.json'),
    JSON.stringify({
      id: 'preview-test',
      actionKind: 'model-router-update-current-context',
      targetPath: 'router/current.md',
      createdAt: '2026-05-17T12:00:00.000Z',
      expiresAt: '2026-05-18T12:00:00.000Z',
      expired: false,
      allowedRoot: true,
      blockedRoot: false,
      operation: 'overwrite',
      oldHash: 'old',
      newHash: 'new',
      lineCountBefore: 1,
      lineCountAfter: 2,
      maxLines: 150,
      unifiedDiff: 'diff',
      policyReasons: [],
      writesToMind: false,
      externalSideEffects: false,
    }),
  );
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previewDir;

  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: Array<{ id: string; writesToMind: boolean; externalSideEffects: boolean }> };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 1);
    assert.equal(body.previews[0]?.id, 'preview-test');
    assert.equal(body.previews[0]?.writesToMind, false);
    assert.equal(body.previews[0]?.externalSideEffects, false);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previous;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /execution/mind-previews ignores unsafe preview path configuration', async () => {
  const previous = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = '/Users/Office/Repos/stevewesthoek/mind/runtime/local/model-router/previews';
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: unknown[] };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 0);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previous;
  }
});

test('GET /execution/plans/:kind returns the execution plan by kind', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-model-router-dry-run' });
  const body = JSON.parse(response.body) as { plan: { kind: string; summary: string; executed: boolean; wouldExecute: boolean } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.kind, 'scheduler-run-model-router-dry-run');
  assert.equal(body.plan.executed, false);
  assert.equal(body.plan.wouldExecute, false);
  assert.equal(body.plan.summary.toLowerCase().includes('report-only model-router dry-run'), true);
});

test('GET /execution/plans/:kind returns not found for unknown kind', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans/unknown-kind' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /execution/readiness returns execution disabled and blockers with the feature flag off by default', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/readiness' });
  const body = JSON.parse(response.body) as {
    executionEnabled: boolean;
    modelRouterDryRunExecutionFlagEnabled: boolean;
    modelRouterDryRunExecutionFlagName: string;
    candidateCount: number;
    readyCandidateCount: number;
    blockers: string[];
    writesToMind: boolean;
    executableActions: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.modelRouterDryRunExecutionFlagEnabled, false);
  assert.equal(body.modelRouterDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
  assert.equal(body.candidateCount, 1);
  assert.equal(body.readyCandidateCount, 0);
  assert.equal(body.writesToMind, false);
  assert.equal(body.executableActions, false);
  assert.equal(body.blockers.includes('execution feature flag disabled'), true);
});

test('GET /execution/readiness reports the feature flag when enabled but keeps execution disabled', async () => {
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
  process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = 'true';

  try {
    const readinessResponse = await exercise({ method: 'GET', url: '/execution/readiness' });
    const readinessBody = JSON.parse(readinessResponse.body) as {
      executionEnabled: boolean;
      modelRouterDryRunExecutionFlagEnabled: boolean;
      readyCandidateCount: number;
      blockers: string[];
      executableActions: boolean;
    };
    const capabilitiesResponse = await exercise({ method: 'GET', url: '/capabilities' });
    const capabilitiesBody = JSON.parse(capabilitiesResponse.body) as {
      executableActionsEnabled: boolean;
      executionGate: { executionEnabled: boolean; modelRouterDryRunExecutionFlagEnabled: boolean };
    };
    const planResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-model-router-dry-run' });
    const planBody = JSON.parse(planResponse.body) as {
      plan: { executionEnabled: boolean; modelRouterDryRunExecutionFlagEnabled: boolean; wouldExecute: boolean; executed: boolean };
    };

    assert.equal(readinessResponse.statusCode, 200);
    assert.equal(readinessBody.modelRouterDryRunExecutionFlagEnabled, true);
    assert.equal(readinessBody.executionEnabled, false);
    assert.equal(readinessBody.readyCandidateCount, 0);
    assert.equal(readinessBody.executableActions, false);
    assert.equal(readinessBody.blockers.includes('execution feature flag disabled'), false);
    assert.equal(readinessBody.blockers.includes('durable approval store not proven for this request'), true);
    assert.equal(capabilitiesBody.executableActionsEnabled, false);
    assert.equal(capabilitiesBody.executionGate.executionEnabled, false);
    assert.equal(capabilitiesBody.executionGate.modelRouterDryRunExecutionFlagEnabled, true);
    assert.equal(planBody.plan.modelRouterDryRunExecutionFlagEnabled, true);
    assert.equal(planBody.plan.executionEnabled, false);
    assert.equal(planBody.plan.wouldExecute, false);
    assert.equal(planBody.plan.executed, false);
  } finally {
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = previousFlag;
    }
  }
});

test('approved scheduler-run-model-router-dry-run executes exactly one report-only action when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-first-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string; kind: string }; executed: boolean };
    const approvalResponse = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const approvalBody = JSON.parse(approvalResponse.body) as {
      executed: boolean;
      approval: { kind: string; status: string };
      preview: { wouldExecute: boolean; writesToMind: boolean; externalSideEffects: boolean; commands: string[] };
      policy: { executionEnabled: boolean; executionGate: string };
      execution: { status: string; command: string; outputPath: string; writesToMind: boolean; externalSideEffects: boolean };
    };
    const auditResponse = await exercise({ method: 'GET', url: '/approvals/audit' });
    const auditBody = JSON.parse(auditResponse.body) as { events: Array<{ event: string; kind: string; executed: boolean }> };
    const outputPath = path.resolve(process.cwd(), '..', '..', approvalBody.execution.outputPath);

    assert.equal(requestResponse.statusCode, 202);
    assert.equal(requestBody.approval.kind, 'scheduler-run-model-router-dry-run');
    assert.equal(requestBody.executed, false);
    assert.equal(approvalResponse.statusCode, 200);
    assert.equal(approvalBody.approval.status, 'approved');
    assert.equal(approvalBody.executed, true);
    assert.equal(approvalBody.preview.wouldExecute, true);
    assert.equal(approvalBody.preview.writesToMind, false);
    assert.equal(approvalBody.preview.externalSideEffects, false);
    assert.equal(approvalBody.preview.commands.length, 1);
    assert.equal(approvalBody.execution.status, 'ok');
    assert.equal(approvalBody.execution.command, 'bash tools/scripts/model-router-dry-run-report.sh');
    assert.equal(approvalBody.execution.outputPath, 'runtime/local/model-router/latest.json');
    assert.equal(approvalBody.execution.writesToMind, false);
    assert.equal(approvalBody.execution.externalSideEffects, false);
    assert.equal(approvalBody.policy.executionEnabled, true);
    assert.equal(approvalBody.policy.executionGate, 'enabled-for-model-router-dry-run');
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(
      auditBody.events.some((event) => event.event === 'executed' && event.kind === 'scheduler-run-model-router-dry-run' && event.executed === true),
      true,
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = previousFlag;
    }
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /approvals/audit returns approval audit events', async () => {
  await exercise({ method: 'POST', url: '/actions/request?kind=custom-audit-test' });
  const response = await exercise({ method: 'GET', url: '/approvals/audit' });
  const body = JSON.parse(response.body) as {
    events: Array<{ event: string; kind: string; persisted: boolean; executed: boolean; source: string }>;
  };

  const matchingEvents = body.events.filter((event) => event.kind === 'custom-audit-test');

  assert.equal(response.statusCode, 200);
  assert.equal(matchingEvents.some((event) => event.event === 'requested'), true);
  assert.equal(typeof body.events[0]?.persisted, 'boolean');
  assert.equal(matchingEvents.every((event) => event.executed === false), true);
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

    const matchingEvents = auditBody.events.filter((event) => event.approvalId === body.approval.id);

    assert.equal(response.statusCode, 202);
    assert.equal(fs.existsSync(auditPath), true);
    assert.equal(matchingEvents.some((event) => event.source === 'jsonl'), true);
    assert.equal(matchingEvents.every((event) => event.executed === false), true);
    assert.equal(matchingEvents.some((event) => event.persisted === true), true);
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
  ] as const;

  for (const [url, kind] of routes) {
    const response = await exercise({ method: 'POST', url });
    const body = JSON.parse(response.body) as {
      approval: { kind: string; status: string };
      preview: { wouldExecute: boolean };
      policy: { executionEnabled: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 202);
    assert.equal(body.approval.kind, kind);
    assert.equal(body.approval.status, 'pending');
    assert.equal(body.preview.wouldExecute, false);
    assert.equal(body.policy.executionEnabled, false);
    assert.equal(body.executed, false);
  }
});

test('POST /approvals/:id/approve executes only the approved model-router dry-run when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-first-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = 'true';

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      approval: { status: string };
      preview: { wouldExecute: boolean; writesToMind: boolean; externalSideEffects: boolean; commands: string[] };
      policy: { executionEnabled: boolean; executionGate: string };
      execution: { status: string; command: string; outputPath: string; exitCode: number; writesToMind: boolean; externalSideEffects: boolean };
      executed: boolean;
    };
    const auditResponse = await exercise({ method: 'GET', url: '/approvals/audit' });
    const auditBody = JSON.parse(auditResponse.body) as { events: Array<{ event: string; executed: boolean; execution?: { status: string } }> };

    assert.equal(response.statusCode, 200);
    assert.equal(body.approval.status, 'approved');
    assert.equal(body.executed, true);
    assert.equal(body.preview.wouldExecute, true);
    assert.equal(body.preview.writesToMind, false);
    assert.equal(body.preview.externalSideEffects, false);
    assert.equal(body.preview.commands.includes('bash tools/scripts/model-router-dry-run-report.sh'), true);
    assert.equal(body.policy.executionEnabled, true);
    assert.equal(body.policy.executionGate, 'enabled-for-model-router-dry-run');
    assert.equal(body.execution.status, 'ok');
    assert.equal(body.execution.command, 'bash tools/scripts/model-router-dry-run-report.sh');
    assert.equal(body.execution.outputPath, 'runtime/local/model-router/latest.json');
    assert.equal(body.execution.exitCode, 0);
    assert.equal(body.execution.writesToMind, false);
    assert.equal(body.execution.externalSideEffects, false);
    assert.equal(auditBody.events.some((event) => event.event === 'executed' && event.executed === true && event.execution?.status === 'ok'), true);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve does not execute the model-router dry-run when the feature flag is disabled', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-first-action-blocked');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      policy: { executionEnabled: boolean };
      execution: { status: string; message: string; writesToMind: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.executed, false);
    assert.equal(body.policy.executionEnabled, false);
    assert.equal(body.execution.status, 'blocked');
    assert.equal(body.execution.message.includes('BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION'), true);
    assert.equal(body.execution.writesToMind, false);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_STORE_PATH = previousStorePath;
    }
    if (previousAuditPath === undefined) {
      delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    } else {
      process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = previousAuditPath;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
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

test('GET /approvals/:id returns approval detail with age and expiration', async () => {
  // Create an approval first
  const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
  const requestBody = JSON.parse(requestResponse.body) as { approval?: { id: string } };
  const approvalId = requestBody.approval?.id;
  assert.ok(approvalId, 'approval should be created');

  // Get the detail
  const response = await exercise({ method: 'GET', url: `/approvals/${approvalId}` });
  const body = JSON.parse(response.body) as {
    approval?: {
      id: string;
      status: string;
      ageMinutes?: number;
      expired?: boolean;
      createdAt: string;
      expiresAt: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.approval);
  assert.equal(body.approval.id, approvalId);
  assert.equal(body.approval.status, 'pending');
  assert.ok(body.approval.ageMinutes !== undefined, 'ageMinutes should be calculated');
  assert.ok(body.approval.ageMinutes >= 0, 'ageMinutes should be non-negative');
  assert.equal(body.approval.expired, false, 'pending approval should not be expired');
});

test('GET /approvals/:id returns not found for unknown approval', async () => {
  const response = await exercise({ method: 'GET', url: '/approvals/approval-not-exists' });
  const body = JSON.parse(response.body) as { error?: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error?.code, 'not_found');
});

test('GET /runtime/reports/model-router returns safe detail metadata', async () => {
  const response = await exercise({ method: 'GET', url: '/runtime/reports/model-router' });
  const body = JSON.parse(response.body) as {
    report?: {
      exists: boolean;
      status: string;
      latestRunStatus: string;
      writesToMind: boolean;
      externalSideEffects: boolean;
      applyEnabled: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.report);
  assert.equal(body.report.writesToMind, false, 'report must never write to Mind');
  assert.equal(body.report.externalSideEffects, false, 'report must have no external side effects');
  assert.equal(body.report.applyEnabled, false, 'report must not have apply enabled');
});

test('GET /runtime/reports includes model-router report with wikiHealth', async () => {
  const response = await exercise({ method: 'GET', url: '/runtime/reports' });
  const body = JSON.parse(response.body) as {
    reports?: Array<{
      id: string;
      status: string;
      wikiHealth?: { ok: boolean; errorCount: number; warningCount: number };
      writesToMind: boolean;
      executableActions: boolean;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.reports, 'reports should exist');
  const mrReport = body.reports?.find((r) => r.id === 'model-router');
  assert.ok(mrReport, 'model-router report should be present');
  assert.equal(mrReport.writesToMind, false, 'report should not write to Mind');
  assert.equal(mrReport.executableActions, false, 'report should have no executable actions');
});

test('GET /runtime/reports report status is never applied when read', async () => {
  const response = await exercise({ method: 'GET', url: '/runtime/reports' });
  const body = JSON.parse(response.body) as {
    reports?: Array<{
      id: string;
      writesToMind: boolean;
      executableActions: boolean;
    }>;
  };

  assert.equal(response.statusCode, 200);
  for (const report of body.reports ?? []) {
    assert.equal(
      report.writesToMind,
      false,
      `${report.id} report must never write to Mind`,
    );
    assert.equal(
      report.executableActions,
      false,
      `${report.id} report must never have executable actions`,
    );
  }
});

test('approved model-router dry-run generates report with metadata', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-report-metadata-' + Date.now());
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const reportPath = path.join(testDir, 'latest.json');

  try {
    fs.mkdirSync(testDir, { recursive: true });

    process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
    process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
    process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = 'true';
    process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH = reportPath;

    // Create a mock report file that would be generated by model-router
    const mockReport = {
      generatedAt: new Date().toISOString(),
      mode: 'dry-run-report-only',
      status: 'success',
      message: 'Model router dry-run completed successfully.',
      writesToMind: false,
      executableActions: false,
      wikiHealth: {
        status: 'available',
        ok: true,
        summary: {
          errorCount: 0,
          warningCount: 2,
        },
      },
    };

    // Request approval
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/model-router-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval?: { id: string } };
    assert.ok(requestBody.approval?.id, 'approval should be created');

    // Create the mock report (simulating model-router execution)
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(mockReport));

    // Verify report is readable via GET /runtime/reports
    const reportsResponse = await exercise({ method: 'GET', url: '/runtime/reports' });
    const reportsBody = JSON.parse(reportsResponse.body) as {
      reports?: Array<{
        id: string;
        status: string;
        latestRunStatus: string;
        wikiHealth?: { ok: boolean; errorCount: number; warningCount: number };
      }>;
    };

    assert.equal(reportsResponse.statusCode, 200);
    const mrReport = reportsBody.reports?.find((r) => r.id === 'model-router');
    assert.equal(mrReport?.status, 'available', 'report should be available');
    assert.equal(mrReport?.latestRunStatus, 'ok', 'report status should be ok');
    assert.ok(mrReport?.wikiHealth, 'wiki health should be extracted');
    assert.equal(mrReport?.wikiHealth?.ok, true, 'wiki health should be ok');
    assert.equal(mrReport?.wikiHealth?.warningCount, 2, 'wiki health warnings should be counted');
  } finally {
    delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    delete process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
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
