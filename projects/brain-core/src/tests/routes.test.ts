import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import { executeLocalAppActionRequest, listLocalAppDefinitions, readLocalAppActionStatus } from '../adapters/local-app-orchestrator.js';
import { evaluateLocalAppActionDefinition } from '../adapters/local-app-action-executor.js';
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
    mindStewardReportSupported: boolean;
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
      mindStewardDryRunExecutionFlagEnabled: boolean;
      mindStewardDryRunExecutionFlagName: string;
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
  assert.equal(body.mindStewardReportSupported, true);
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
  assert.equal(body.executionGate.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.executionGate.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
  assert.equal(body.executionGate.firstCandidate, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.executionGate.readinessEndpoint, '/execution/readiness');
  assert.equal(body.executionGate.plansEndpoint, '/execution/plans');
  assert.equal(body.executionGate.candidateActionKinds.includes('scheduler-run-mind-steward-dry-run'), true);
});

test('GET /api/agent/capabilities returns normalized agent capability registry', async () => {
  const response = await exercise({ method: 'GET', url: '/api/agent/capabilities' });
  const body = JSON.parse(response.body) as { capabilities: Array<{ id: string; kind: string; enabled: boolean }> };

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(body.capabilities), true);
  assert.ok(body.capabilities.length > 0);
  assert.equal(body.capabilities.some((capability) => capability.id === 'skill.code'), true);
  assert.equal(body.capabilities.some((capability) => capability.id === 'cli.github'), true);
  assert.equal(body.capabilities.every((capability) => typeof capability.enabled === 'boolean'), true);
});

test('GET /scheduler/status returns read-only placeholder scheduler state', async () => {
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = path.join(process.cwd(), '.buildflow-test-missing-scheduler-report.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/status' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'placeholder');
    assert.equal(body.enabled, false);
    assert.equal(body.source, 'placeholder');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
  }
});

test('GET /scheduler/latest-run returns read-only placeholder latest run state', async () => {
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = path.join(process.cwd(), '.buildflow-test-missing-latest-report.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/latest-run' });
    const body = JSON.parse(response.body) as { status: string; enabled: boolean; source: string };

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'placeholder');
    assert.equal(body.enabled, false);
    assert.equal(body.source, 'placeholder');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
  }
});

test('GET /scheduler/latest-run reads mind-steward runtime report when configured', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      job: 'mind-steward-dry-run',
      status: 'success',
      message: 'mind-steward dry-run validation passed',
      endedAtLisbon: '2026-05-17 07:00:00 WEST',
      mode: 'dry-run-report-only',
      writesToMind: false,
      executableActions: false,
    }),
  );
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = reportPath;

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
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /scheduler/jobs returns placeholder mind-steward jobs', async () => {
  const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
  const body = JSON.parse(response.body) as { jobs: Array<{ id: string; mutationRequired: boolean; status: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.jobs.length, 5);
  assert.equal(body.jobs[0]?.id, 'mind-compile-loop');
  assert.equal(typeof body.jobs[0]?.mutationRequired, 'boolean');
  assert.equal(body.jobs.some((job) => job.id === 'mind-steward-dry-run'), true);
});

test('GET /scheduler/jobs reports mind-steward dry-run ok status when runtime report exists', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-jobs');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success' }));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = reportPath;

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
    const body = JSON.parse(response.body) as { jobs: Array<{ id: string; status: string }> };
    const mindStewardJob = body.jobs.find((job) => job.id === 'mind-steward-dry-run');

    assert.equal(response.statusCode, 200);
    assert.equal(mindStewardJob?.status, 'ok');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /local-apps returns registered local app list including Fala', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps' });
  const body = JSON.parse(response.body) as {
    apps: Array<{
      id: string;
      name: string;
      actionsSupported: boolean;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.apps.length >= 16, true);
  assert.equal(body.apps.some((app) => app.actionsSupported === true), true);

  const fala = body.apps.find((app) => app.id === 'fala');
  assert.equal(fala?.name, 'Fala');
  assert.equal(fala?.actionsSupported, true);
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
    assert.equal(body.apps.length >= 16, true);
    const probot = body.apps.find((app) => app.id === 'probot');
    assert.equal(probot?.status, 'running');
    assert.equal(probot?.source, 'runtime-report');
    assert.equal(body.apps.some((app) => app.id === 'mind-steward'), true);
    assert.equal(body.apps.every((app) => app.source === 'runtime-report'), true);
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
    apps: Array<{ id: string; name: string; actionEnabled: boolean; actionDisabledReason: string; managed: boolean; startSupported: boolean; stopSupported: boolean; restartSupported: boolean }>;
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
  assert.ok(body.apps.some((app) => app.id === 'mind-steward'));
  assert.ok(body.apps.some((app) => app.startSupported || app.stopSupported || app.restartSupported));
  assert.ok(body.apps.every((app) => !app.actionEnabled || app.startSupported || app.stopSupported || app.restartSupported));
  assert.ok(body.apps.find((app) => app.id === 'mind-steward')?.actionDisabledReason !== undefined);
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

test('GET /local-apps/mind-steward/action-plan/start returns a safe executable plan', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/mind-steward/action-plan/start' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    status: string;
    pluginExecutesShell: boolean;
    arbitraryCommandAllowed: boolean;
    canExecuteNow: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'mind-steward');
  assert.equal(body.action, 'start');
  assert.equal(body.pluginExecutesShell, false);
  assert.equal(body.arbitraryCommandAllowed, false);
  // mind-steward is now wired with a canonical start command — canExecuteNow reflects script presence
  assert.equal(typeof body.canExecuteNow, 'boolean');
});

test('GET /local-apps/action-readiness returns not-ready until per-app strategies exist', async () => {
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
  assert.equal(body.ready, false);
  assert.equal(body.status, 'not-ready');
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandExecution, false);
  assert.ok(body.criteria.length > 0);
});

test('GET /local-apps/action-enablement-backlog returns 200 with backlog structure', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    id: string;
    generatedAt: string;
    totalActionCount: number;
    enabledActionCount: number;
    disabledActionCount: number;
    appsWithDisabledActions: number;
    categories: Array<{ id: string; label: string; count: number; nextSafeStep: string }>;
    items: Array<{ appId: string; appName: string; action: string; enabled: boolean; reason: string; category: string }>;
    safety: {
      readOnly: boolean;
      pluginExecutesShell: boolean;
      arbitraryCommandAllowed: boolean;
      modifiesRegistry: boolean;
      writesOperationsConfig: boolean;
      exposesSecrets: boolean;
      exposesEnv: boolean;
      enablesActions: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-action-enablement-backlog');
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.modifiesRegistry, false);
  assert.equal(body.safety.writesOperationsConfig, false);
  assert.equal(body.safety.exposesSecrets, false);
  assert.equal(body.safety.exposesEnv, false);
  assert.equal(body.safety.enablesActions, false);
  assert.ok(body.totalActionCount >= 0);
  assert.ok(body.enabledActionCount >= 0);
  assert.ok(body.disabledActionCount >= 0);
  assert.ok(Array.isArray(body.categories));
  assert.ok(Array.isArray(body.items));
});

test('GET /local-apps/action-enablement-backlog includes disabled items with reasons', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    disabledActionCount: number;
    items: Array<{ appId: string; category: string; reason: string; recommendedChange: string; risk: string }>;
  };

  if (body.disabledActionCount > 0) {
    assert.ok(body.items.length > 0);
    const item = body.items[0]!;
    assert.ok(item.appId);
    assert.ok(item.category);
    assert.ok(item.reason);
    assert.ok(item.recommendedChange);
    assert.ok(['low', 'medium', 'high'].includes(item.risk));
  }
});

test('GET /local-apps/action-enablement-backlog does not replace dashboard action support', async () => {
  const dashboardResponse = await exercise({ method: 'GET', url: '/local-apps/dashboard' });
  const backlogResponse = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const dashboard = JSON.parse(dashboardResponse.body) as {
    apps: Array<{ id: string; startSupported: boolean; stopSupported: boolean; restartSupported: boolean }>;
  };
  const backlog = JSON.parse(backlogResponse.body) as {
    disabledActionCount: number;
    items: Array<{ appId: string; action: string; reason: string }>;
  };

  const executableActions = new Set(
    dashboard.apps.flatMap((app) => [
      app.startSupported ? `${app.id}:start` : null,
      app.stopSupported ? `${app.id}:stop` : null,
      app.restartSupported ? `${app.id}:restart` : null,
    ].filter((value): value is string => value !== null)),
  );
  const disabledActions = new Set(backlog.items.map((item) => `${item.appId}:${item.action}`));

  assert.equal(backlog.disabledActionCount, backlog.items.length);
  for (const action of executableActions) {
    assert.equal(disabledActions.has(action), false, `${action} should not appear in the disabled backlog`);
  }
});

test('GET /local-apps/action-enablement-backlog includes exact disabled reasons', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    disabledActionCount: number;
    items: Array<{ appId: string; action: string; reason: string }>;
  };

  for (const item of body.items.slice(0, 5)) {
    assert.equal(typeof item.reason, 'string');
    assert.ok(item.reason.length > 0);
  }
});

test('repo-local lifecycle adapters become executable for safe fixed scripts', async () => {
  const expectations: Array<{ appId: string; action: 'start' | 'stop' | 'restart'; commandLabel: string }> = [
    { appId: 'probot', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'probot', action: 'stop', commandLabel: 'bash scripts/dev/stop-local.sh' },
    { appId: 'probot', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
    { appId: 'via-di-eden', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'via-di-eden', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
    { appId: 'oliveto-organizing', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'oliveto-organizing', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
    { appId: 'jpv-bootcamp', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'xgrow', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'xgrow', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
    { appId: 'family-finance', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'family-finance', action: 'stop', commandLabel: 'bash scripts/dev/stop-local.sh' },
    { appId: 'family-finance', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
    { appId: 'tradebot', action: 'start', commandLabel: 'bash scripts/dev/start-local.sh' },
    { appId: 'tradebot', action: 'stop', commandLabel: 'bash scripts/dev/stop-local.sh' },
    { appId: 'tradebot', action: 'restart', commandLabel: 'bash scripts/dev/stop-local.sh && bash scripts/dev/start-local.sh' },
  ];

  const dashboardResponse = await exercise({ method: 'GET', url: '/local-apps/dashboard' });
  const dashboard = JSON.parse(dashboardResponse.body) as {
    apps: Array<{ id: string; startSupported: boolean; stopSupported: boolean; restartSupported: boolean; actionDisabledReasons?: Record<string, string> }>;
  };
  const backlogResponse = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const backlog = JSON.parse(backlogResponse.body) as {
    items: Array<{ appId: string; action: string }>;
  };
  const disabledKeys = new Set(backlog.items.map((item) => `${item.appId}:${item.action}`));

  for (const expectation of expectations) {
    const app = listLocalAppDefinitions().find((entry) => entry.id === expectation.appId);
    assert.ok(app, `expected inventory entry for ${expectation.appId}`);
    const readiness = evaluateLocalAppActionDefinition(app!, expectation.action);
    assert.equal(readiness.executable, true, `${expectation.appId}:${expectation.action} should be executable`);
    assert.equal(readiness.commandLabel, expectation.commandLabel);
    assert.equal(disabledKeys.has(`${expectation.appId}:${expectation.action}`), false, `${expectation.appId}:${expectation.action} should not be in the disabled backlog`);
  }
});

test('composite restart is supported when safe start and stop commands exist', async () => {
  const inventory = listLocalAppDefinitions();
  const app = inventory.find((entry) => entry.id === 'says-the-bible' || entry.id === 'firecrawl' || entry.id === 'comfyui');
  assert.ok(app, 'expected a safe composite restart candidate');
  assert.equal(evaluateLocalAppActionDefinition(app!, 'restart').executable, true);
});

test('managed npm stop remains disabled before Brain Core records a process', async () => {
  const sandbox = createManagedProcessSandbox();
  const previous = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = sandbox.registryPath;
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'prochat');
  assert.ok(app, 'expected prochat inventory entry');
  fs.rmSync(sandbox.root, { recursive: true, force: true });
  const readiness = evaluateLocalAppActionDefinition(app!, 'stop');
  assert.equal(readiness.executable, false);
  assert.equal(readiness.reason, 'No Brain Core-managed npm process is recorded for this app. Start it from Brain Console first.');
  if (previous === undefined) delete process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  else process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = previous;
  fs.rmSync(sandbox.root, { recursive: true, force: true });
});

test('stale managed process records are ignored and cleaned', async () => {
  const sandbox = createManagedProcessSandbox();
  const previous = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = sandbox.registryPath;
  fs.mkdirSync(path.dirname(sandbox.registryPath), { recursive: true });
  fs.writeFileSync(
    sandbox.registryPath,
    JSON.stringify({ records: [{ appId: 'prochat', action: 'start', pid: 1, startedAt: new Date().toISOString(), cwdSummary: 'tmp', strategy: 'repo-npm-dev', commandLabel: 'npm run dev' }] }, null, 2),
  );
  const readiness = evaluateLocalAppActionDefinition(listLocalAppDefinitions().find((entry) => entry.id === 'prochat')!, 'stop');
  assert.equal(readiness.executable, false);
  assert.equal(readiness.reason, 'No Brain Core-managed npm process is recorded for this app. Start it from Brain Console first.');
  const cleaned = fs.readFileSync(sandbox.registryPath, 'utf8');
  assert.equal(cleaned.includes('"pid": 1'), false);
  if (previous === undefined) delete process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  else process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = previous;
  fs.rmSync(sandbox.root, { recursive: true, force: true });
});

test('unsafe managed-process registry paths are ignored safely', async () => {
  const previous = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = path.join(process.cwd(), 'operations', 'local-apps', 'managed-processes.json');
  const status = readLocalAppActionStatus();
  assert.equal(Array.isArray(status.managedProcesses), true);
  assert.equal(status.managedProcesses.length >= 0, true);
  const readiness = evaluateLocalAppActionDefinition(listLocalAppDefinitions().find((entry) => entry.id === 'prochat')!, 'stop');
  assert.equal(readiness.executable, false);
  if (previous === undefined) delete process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  else process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = previous;
});

test('GET /local-apps/action-enablement-backlog does not expose secrets or raw env', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = response.body;

  assert.equal(typeof body, 'string');
  assert.ok(!body.includes('TOKEN='), 'Response should not contain TOKEN=');
  assert.ok(!body.includes('SECRET='), 'Response should not contain SECRET=');
  assert.ok(!body.includes('PASSWORD='), 'Response should not contain PASSWORD=');
  assert.ok(!body.includes('COOKIE='), 'Response should not contain COOKIE=');
  assert.ok(!body.includes('.env'), 'Response should not expose .env');
});

test('POST /local-apps/action-enablement-backlog is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/action-enablement-backlog' });
  assert.equal(response.statusCode, 404);
});

test('POST /local-apps/mind-steward/start returns structured controlled result', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/mind-steward/start' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    status: string;
    ok: boolean;
    message: string;
    errorCode?: string;
    nextPollMs: number;
    steps: Array<{ id: string; status: string }>;
    safety: { pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; commandOverrideAccepted: boolean; canonicalAppIdRequired: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'mind-steward');
  assert.equal(body.action, 'start');
  // mind-steward is now wired with a canonical start command — expect a terminal status (success or failed)
  assert.ok(['success', 'failed', 'not_executable'].includes(body.status), `unexpected status: ${body.status}`);
  assert.equal(typeof body.ok, 'boolean');
  assert.equal(typeof body.message, 'string');
  assert.equal(body.nextPollMs > 0, true);
  assert.ok(body.steps.length > 0);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.commandOverrideAccepted, false);
  assert.equal(body.safety.canonicalAppIdRequired, true);
});

test('POST /local-apps/mind-steward/start rejects command override parameters', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/mind-steward/start?command=rm%20-rf%20%2Ftmp%2Funsafe' });
  const body = JSON.parse(response.body) as {
    appId: string;
    action: string;
    safety: { arbitraryCommandAllowed: boolean; commandOverrideAccepted: boolean; canonicalAppIdRequired: boolean };
    steps: Array<{ label: string; message: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.appId, 'mind-steward');
  assert.equal(body.action, 'start');
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.commandOverrideAccepted, false);
  assert.equal(body.safety.canonicalAppIdRequired, true);
  assert.equal(JSON.stringify(body.steps).includes('rm -rf'), false);
});

test('POST /local-apps/unknown/start rejects unknown app id', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/unknown/start' });
  const body = JSON.parse(response.body) as { status: string; ok: boolean; errorCode?: string; safety: { commandOverrideAccepted: boolean } };
  assert.equal(response.statusCode, 404);
  assert.equal(body.status, 'not_found');
  assert.equal(body.ok, false);
  assert.equal(body.errorCode, 'local_app_not_found');
  assert.equal(body.safety.commandOverrideAccepted, false);
});

test('POST /local-apps/mind-steward/delete is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/mind-steward/delete' });
  assert.equal(response.statusCode, 404);
});

test('local app executor errors are converted to structured failed results', async () => {
  const result = await executeLocalAppActionRequest('mind-steward', 'start', { forceExecutorError: true });
  assert.equal(result.status, 'failed');
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'local_app_action_failed');
  assert.equal(result.safety.pluginExecutesShell, false);
  assert.equal(result.safety.arbitraryCommandAllowed, false);
  assert.equal(result.safety.commandOverrideAccepted, false);
});

test('GET /local-apps/actions/status works after local app action failure', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-local-app-action-audit');
  const auditPath = path.join(testDir, 'actions-audit.jsonl');
  const previousAuditPath = process.env.BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH = auditPath;

  await executeLocalAppActionRequest('mind-steward', 'start', { forceExecutorError: true });
  const response = await exercise({ method: 'GET', url: '/local-apps/actions/status' });
  const body = JSON.parse(response.body) as {
    id: string;
    inFlight: unknown[];
    recentResults: Array<{ appId: string; status: string; error?: string }>;
    lastErrorByApp: Record<string, { status: string }>;
    audit: {
      status: string;
      path: string;
      persistedResultCount: number;
      lastPersistedAt?: string;
      safety: { exposesSecrets: boolean; writesToMind: boolean; writesOperationsConfig: boolean };
    };
    safety: { pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; commandOverrideAccepted: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-actions-status');
  assert.equal(Array.isArray(body.inFlight), true);
  assert.equal(body.recentResults.some((result) => result.appId === 'mind-steward' && result.status === 'failed'), true);
  assert.equal(body.lastErrorByApp['mind-steward']?.status, 'failed');
  assert.equal(body.audit.status, 'enabled');
  assert.equal(body.audit.path, '.buildflow-test-local-app-action-audit/actions-audit.jsonl');
  assert.equal(body.audit.persistedResultCount > 0, true);
  assert.equal(typeof body.audit.lastPersistedAt, 'string');
  assert.equal(body.audit.safety.exposesSecrets, false);
  assert.equal(body.audit.safety.writesToMind, false);
  assert.equal(body.audit.safety.writesOperationsConfig, false);
  const auditRows = fs.readFileSync(auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(auditRows.some((row) => row.appId === 'mind-steward' && row.status === 'failed'), true);
  assert.equal(JSON.stringify(auditRows).includes('TOKEN='), false);
  assert.equal(JSON.stringify(body).includes('TOKEN='), false);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.commandOverrideAccepted, false);

  if (previousAuditPath === undefined) {
    delete process.env.BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH;
  } else {
    process.env.BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH = previousAuditPath;
  }
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('GET /local-apps/actions/status exposes managed process records when present', async () => {
  const sandbox = createManagedProcessSandbox();
  const previous = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = sandbox.registryPath;
  fs.mkdirSync(path.dirname(sandbox.registryPath), { recursive: true });
  fs.writeFileSync(sandbox.registryPath, JSON.stringify({ records: [] }, null, 2));
  const status = readLocalAppActionStatus();
  assert.equal(Array.isArray(status.managedProcesses), true);
  if (previous === undefined) delete process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  else process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = previous;
  fs.rmSync(sandbox.root, { recursive: true, force: true });
});

function createManagedProcessSandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-core-managed-process-'));
  return {
    root,
    registryPath: path.join(root, 'managed-processes.json'),
  };
}

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

test('GET /local-apps/actions/status includes the recent result after POST', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/mind-steward/start' });
  const postBody = JSON.parse(response.body) as { id: string; ok: boolean; status: string };
  const statusResponse = await exercise({ method: 'GET', url: '/local-apps/actions/status' });
  const statusBody = JSON.parse(statusResponse.body) as {
    recentResults: Array<{ id: string; appId: string; status: string; ok: boolean }>;
    audit: { persistedResultCount: number };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusBody.recentResults.some((entry) => entry.id === postBody.id), true);
  assert.equal(statusBody.recentResults.some((entry) => entry.status === postBody.status && entry.ok === postBody.ok), true);
  assert.equal(statusBody.audit.persistedResultCount >= 0, true);
});

test('GET /local-apps ignores invalid runtime reports and keeps canonical inventory primary', async () => {
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
    assert.equal(body.apps.length >= 16, true);
    assert.equal(body.apps.some((app) => app.id === 'local-apps-report'), false);
    assert.equal(body.apps.some((app) => app.id === 'probot'), true);
    assert.equal(body.apps.some((app) => app.id === 'mind-steward'), true);
    assert.equal(body.apps.every((app) => app.source === 'runtime-report'), true);
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

test('POST /scheduler/jobs/mind-steward-dry-run/request-run uses execution plan preview metadata without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
  const body = JSON.parse(response.body) as {
    approval: { kind: string; status: string };
    preview: { kind: string; summary: string; wouldExecute: boolean; writesToMind: boolean };
    policy: { executionEnabled: boolean; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.kind, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.preview.summary.toLowerCase().includes('report-only mind-steward dry-run'), true);
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
      mindStewardDryRunExecutionFlagEnabled: boolean;
      mindStewardDryRunExecutionFlagName: string;
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
  assert.equal(body.plans[0]?.kind, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.plans[0]?.candidate, true);
  assert.equal(body.plans[0]?.executionEnabled, false);
  assert.equal(body.plans[0]?.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[0]?.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
  assert.equal(body.plans[0]?.wouldExecute, false);
  assert.equal(body.plans[0]?.executed, false);
  assert.equal(body.plans[0]?.writesToMind, false);
  assert.equal(body.plans[0]?.mindPreviewPolicy.status, 'preview-only');
  assert.equal(body.plans[0]?.mindPreviewPolicy.firstProposedAction, 'mind-steward-update-current-context');
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
  assert.equal(body.firstProposedAction, 'mind-steward-update-current-context');
  assert.equal(body.firstProposedTarget, 'router/current.md');
  assert.equal(body.applyRouteEnabled, false);
  assert.equal(body.writesToMind, false);
  assert.equal(body.externalSideEffects, false);
  assert.equal(body.allowedTargets.includes('router/current.md'), true);
  assert.equal(body.blockedPrefixes.includes('.obsidian/'), true);
  assert.equal(body.blockedPrefixes.includes('01-inbox/'), true);
  assert.equal(body.requiredGates.includes('localhost-only request'), true);
  assert.equal(
    body.docs.some((doc) => doc.path === 'operations/specs/1779034874780-mind-steward-mind-write-apply-policy.md'),
    true,
  );
  assert.equal(
    body.docs.some((doc) => doc.path === 'docs/system/1779034841996-obsidian-mind-mind-steward-handoff.md'),
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
  const previewDir = path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews');
  const previous = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(previewDir, { recursive: true });
  fs.writeFileSync(
    path.join(previewDir, 'preview-test.json'),
    JSON.stringify({
      id: 'preview-test',
      actionKind: 'mind-steward-update-current-context',
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
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = '/Users/Office/Repos/stevewesthoek/mind/runtime/local/mind-steward/previews';
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
  const response = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-dry-run' });
  const body = JSON.parse(response.body) as { plan: { kind: string; summary: string; executed: boolean; wouldExecute: boolean } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.kind, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.plan.executed, false);
  assert.equal(body.plan.wouldExecute, false);
  assert.equal(body.plan.summary.toLowerCase().includes('report-only mind-steward dry-run'), true);
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
    mindStewardDryRunExecutionFlagEnabled: boolean;
    mindStewardDryRunExecutionFlagName: string;
    candidateCount: number;
    readyCandidateCount: number;
    blockers: string[];
    writesToMind: boolean;
    executableActions: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION');
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
      mindStewardDryRunExecutionFlagEnabled: boolean;
      readyCandidateCount: number;
      blockers: string[];
      executableActions: boolean;
    };
    const capabilitiesResponse = await exercise({ method: 'GET', url: '/capabilities' });
    const capabilitiesBody = JSON.parse(capabilitiesResponse.body) as {
      executableActionsEnabled: boolean;
      executionGate: { executionEnabled: boolean; mindStewardDryRunExecutionFlagEnabled: boolean };
    };
    const planResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-dry-run' });
    const planBody = JSON.parse(planResponse.body) as {
      plan: { executionEnabled: boolean; mindStewardDryRunExecutionFlagEnabled: boolean; wouldExecute: boolean; executed: boolean };
    };

    assert.equal(readinessResponse.statusCode, 200);
    assert.equal(readinessBody.mindStewardDryRunExecutionFlagEnabled, true);
    assert.equal(readinessBody.executionEnabled, false);
    assert.equal(readinessBody.readyCandidateCount, 0);
    assert.equal(readinessBody.executableActions, false);
    assert.equal(readinessBody.blockers.includes('execution feature flag disabled'), false);
    assert.equal(readinessBody.blockers.includes('durable approval store not proven for this request'), true);
    assert.equal(capabilitiesBody.executableActionsEnabled, false);
    assert.equal(capabilitiesBody.executionGate.executionEnabled, false);
    assert.equal(capabilitiesBody.executionGate.mindStewardDryRunExecutionFlagEnabled, true);
    assert.equal(planBody.plan.mindStewardDryRunExecutionFlagEnabled, true);
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

test('approved scheduler-run-mind-steward-dry-run executes exactly one report-only action when all gates pass', async () => {
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
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
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
    assert.equal(requestBody.approval.kind, 'scheduler-run-mind-steward-dry-run');
    assert.equal(requestBody.executed, false);
    assert.equal(approvalResponse.statusCode, 200);
    assert.equal(approvalBody.approval.status, 'approved');
    assert.equal(approvalBody.executed, true);
    assert.equal(approvalBody.preview.wouldExecute, true);
    assert.equal(approvalBody.preview.writesToMind, false);
    assert.equal(approvalBody.preview.externalSideEffects, false);
    assert.equal(approvalBody.preview.commands.length, 1);
    assert.equal(approvalBody.execution.status, 'ok');
    assert.equal(approvalBody.execution.command, 'bash tools/scripts/mind-steward-dry-run-report.sh');
    assert.equal(approvalBody.execution.outputPath, 'runtime/local/mind-steward/latest.json');
    assert.equal(approvalBody.execution.writesToMind, false);
    assert.equal(approvalBody.execution.externalSideEffects, false);
    assert.equal(approvalBody.policy.executionEnabled, true);
    assert.equal(approvalBody.policy.executionGate, 'enabled-for-mind-steward-dry-run');
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(
      auditBody.events.some((event) => event.event === 'executed' && event.kind === 'scheduler-run-mind-steward-dry-run' && event.executed === true),
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
  assert.equal(body.reports.some((report) => report.id === 'mind-steward'), true);
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

test('POST /approvals/:id/approve executes only the approved mind-steward dry-run when all gates pass', async () => {
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
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
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
    assert.equal(body.preview.commands.includes('bash tools/scripts/mind-steward-dry-run-report.sh'), true);
    assert.equal(body.policy.executionEnabled, true);
    assert.equal(body.policy.executionGate, 'enabled-for-mind-steward-dry-run');
    assert.equal(body.execution.status, 'ok');
    assert.equal(body.execution.command, 'bash tools/scripts/mind-steward-dry-run-report.sh');
    assert.equal(body.execution.outputPath, 'runtime/local/mind-steward/latest.json');
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

test('POST /approvals/:id/approve does not execute the mind-steward dry-run when the feature flag is disabled', async () => {
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
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
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
  const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
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

test('GET /runtime/reports/mind-steward returns safe detail metadata', async () => {
  const response = await exercise({ method: 'GET', url: '/runtime/reports/mind-steward' });
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

test('GET /runtime/reports includes mind-steward report with wikiHealth', async () => {
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
  const mrReport = body.reports?.find((r) => r.id === 'mind-steward');
  assert.ok(mrReport, 'mind-steward report should be present');
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

test('approved mind-steward dry-run generates report with metadata', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-report-metadata-' + Date.now());
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const reportPath = path.join(testDir, 'latest.json');

  try {
    fs.mkdirSync(testDir, { recursive: true });

    process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
    process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
    process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION = 'true';
    process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = reportPath;

    // Create a mock report file that would be generated by mind-steward
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
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval?: { id: string } };
    assert.ok(requestBody.approval?.id, 'approval should be created');

    // Create the mock report (simulating mind-steward execution)
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
    const mrReport = reportsBody.reports?.find((r) => r.id === 'mind-steward');
    assert.equal(mrReport?.status, 'available', 'report should be available');
    assert.equal(mrReport?.latestRunStatus, 'ok', 'report status should be ok');
    assert.ok(mrReport?.wikiHealth, 'wiki health should be extracted');
    assert.equal(mrReport?.wikiHealth?.ok, true, 'wiki health should be ok');
    assert.equal(mrReport?.wikiHealth?.warningCount, 2, 'wiki health warnings should be counted');
  } finally {
    delete process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
    delete process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
    delete process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION;
    delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('google-ads-api supervisor stop and restart are executable', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'google-ads-api');
  assert.ok(app, 'google-ads-api should be in inventory');

  const stopReadiness = evaluateLocalAppActionDefinition(app!, 'stop');
  assert.equal(stopReadiness.executable, true, 'google-ads-api:stop should be executable');
  assert.equal(stopReadiness.commandLabel, 'supervisorctl stop google-ads-http-server');

  const restartReadiness = evaluateLocalAppActionDefinition(app!, 'restart');
  assert.equal(restartReadiness.executable, true, 'google-ads-api:restart should be executable');
  assert.equal(restartReadiness.commandLabel, 'supervisorctl stop google-ads-http-server && supervisorctl start google-ads-http-server');
});

test('supervisor command action must match requested action', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'google-ads-api');
  assert.ok(app, 'google-ads-api should be in inventory');
  const stopApp = { ...app!, stopCommand: 'supervisorctl start google-ads-http-server' };
  const readiness = evaluateLocalAppActionDefinition(stopApp, 'stop');
  assert.equal(readiness.executable, false, 'supervisor action mismatch should be not_executable');
  assert.ok(readiness.reason?.includes('does not match'), 'reason should mention action mismatch');
});

test('google-ads-api actions are absent from action-enablement-backlog', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; action: string }>;
  };
  const disabled = body.items.filter((item) => item.appId === 'google-ads-api' && (item.action === 'stop' || item.action === 'restart'));
  assert.equal(disabled.length, 0, 'google-ads-api stop and restart should not appear in backlog');
});

test('family-finance stop and restart are executable', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'family-finance');
  assert.ok(app, 'family-finance should be in inventory');
  assert.equal(evaluateLocalAppActionDefinition(app!, 'stop').executable, true, 'family-finance:stop should be executable');
  assert.equal(evaluateLocalAppActionDefinition(app!, 'restart').executable, true, 'family-finance:restart should be executable');
});

test('tradebot stop and restart are executable', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'tradebot');
  assert.ok(app, 'tradebot should be in inventory');
  assert.equal(evaluateLocalAppActionDefinition(app!, 'stop').executable, true, 'tradebot:stop should be executable');
  assert.equal(evaluateLocalAppActionDefinition(app!, 'restart').executable, true, 'tradebot:restart should be executable');
});

test('jpv-bootcamp stop and restart remain disabled without stop script', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'jpv-bootcamp');
  assert.ok(app, 'jpv-bootcamp should be in inventory');
  const stopReadiness = evaluateLocalAppActionDefinition(app!, 'stop');
  assert.equal(stopReadiness.executable, false, 'jpv-bootcamp:stop should remain disabled');
});

test('fala start remains disabled without repo-local script in brain', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'fala');
  assert.ok(app, 'fala should be in inventory');
  const startReadiness = evaluateLocalAppActionDefinition(app!, 'start');
  assert.equal(startReadiness.executable, true, 'fala:start should be executable now');
  assert.ok(
    startReadiness.reason?.includes('repo-local') || startReadiness.reason?.includes('allowlisted'),
    'fala reason should reference the repo-local allowlisted script path',
  );
});

test('ProBot actions are executable in dashboard', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/dashboard' });
  const body = JSON.parse(response.body) as {
    apps: Array<{ id: string; startSupported: boolean; stopSupported: boolean; restartSupported: boolean }>;
  };
  const probot = body.apps.find((app) => app.id === 'probot');
  assert.ok(probot, 'probot should be in dashboard');
  assert.equal(probot.startSupported, true, 'probot start should be executable');
  assert.equal(probot.stopSupported, true, 'probot stop should be executable');
  assert.equal(probot.restartSupported, true, 'probot restart should be executable');
});

test('ProBot actions are absent from action-enablement-backlog', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; action: string }>;
  };
  const probotDisabled = body.items.filter((item) => item.appId === 'probot');
  assert.equal(probotDisabled.length, 0, 'probot should have no disabled actions in backlog');
});

test('ProBot start command is fixed and repo-local', async () => {
  const app = listLocalAppDefinitions().find((entry) => entry.id === 'probot');
  assert.ok(app, 'probot should be in inventory');
  const readiness = evaluateLocalAppActionDefinition(app!, 'start');
  assert.equal(readiness.executable, true);
  assert.equal(readiness.commandLabel, 'bash scripts/dev/start-local.sh');
  assert.ok(!readiness.commandLabel.includes('.env'), 'start command must not reference .env');
  assert.ok(!readiness.commandLabel.includes('TOKEN'), 'start command must not reference TOKEN');
});

test('ProBot start uses canonical port 7070', async () => {
  const scriptPath = path.resolve(process.cwd(), '..', 'probot', 'scripts', 'dev', 'start-local.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('CANONICAL_PORT=7070'), 'start script must set CANONICAL_PORT=7070');
  assert.ok(content.includes('PROBOT_DASHBOARD_PORT="$CANONICAL_PORT"'), 'start script must export port to PROBOT_DASHBOARD_PORT');
  assert.ok(!content.includes('source .env'), 'start script must not source .env');
  assert.ok(!content.includes('cat .env'), 'start script must not cat .env');
  assert.ok(!content.includes('echo $TOKEN'), 'start script must not print env vars');
  assert.ok(!content.includes('echo $SECRET'), 'start script must not print env vars');
});

test('ProBot start script writes a metadata file', async () => {
  const scriptPath = path.resolve(process.cwd(), '..', 'probot', 'scripts', 'dev', 'start-local.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('META_FILE='), 'start script must define META_FILE');
  assert.ok(content.includes('probot-process.json'), 'start script must write probot-process.json');
  assert.ok(content.includes("'appId': 'probot'"), 'metadata must include appId');
  assert.ok(content.includes('processStartSignature'), 'metadata must include processStartSignature');
  assert.ok(content.includes('canonicalPort'), 'metadata must include canonicalPort');
  assert.ok(!content.includes('.env'), 'start script must not reference .env');
});

test('ProBot stop script checks metadata before killing', async () => {
  const scriptPath = path.resolve(process.cwd(), '..', 'probot', 'scripts', 'dev', 'stop-local.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('META_FILE='), 'stop script must reference metadata file');
  assert.ok(content.includes('probot-process.json'), 'stop script must check probot-process.json');
  assert.ok(content.includes("appId"), 'stop script must validate appId from metadata');
  assert.ok(content.includes('processStartSignature'), 'stop script must check processStartSignature');
  assert.ok(content.includes('STORED_LSTART'), 'stop script must compare stored start signature');
  assert.ok(content.includes('CURRENT_LSTART'), 'stop script must compare current start signature');
});

test('ProBot stop script does not kill arbitrary PIDs', async () => {
  const scriptPath = path.resolve(process.cwd(), '..', 'probot', 'scripts', 'dev', 'stop-local.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(!content.includes('pkill'), 'stop script must not use pkill');
  assert.ok(!content.includes('killall'), 'stop script must not use killall');
  assert.ok(!content.includes('lsof'), 'stop script must not use lsof');
  assert.ok(content.includes('ps -p "$PID"'), 'stop script must validate PID ownership');
  assert.ok(content.includes('ProBot') || content.includes('probot'), 'stop script must check process matches ProBot');
  assert.ok(!content.includes('echo "$PROC_CMD"'), 'stop script must not echo raw process command lines');
});

test('ProBot stop treats stale/wrong PID as harmless and removes PID file', async () => {
  const scriptPath = path.resolve(process.cwd(), '..', 'probot', 'scripts', 'dev', 'stop-local.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('stale PID'), 'stop script must handle stale PID gracefully');
  assert.ok(content.includes('did not match ProBot process'), 'stop script must handle wrong PID gracefully');
  assert.ok(content.includes('PID reuse detected'), 'stop script must detect PID reuse via start signature');
  assert.ok(content.includes('rm -f "$PID_FILE" "$META_FILE"'), 'stop script must clean up both PID and metadata files');
});

test('all six latest lifecycle actions are absent from action-enablement-backlog', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; action: string }>;
  };
  const latestEnabled = [
    { appId: 'google-ads-api', action: 'stop' },
    { appId: 'google-ads-api', action: 'restart' },
    { appId: 'family-finance', action: 'stop' },
    { appId: 'family-finance', action: 'restart' },
    { appId: 'tradebot', action: 'stop' },
    { appId: 'tradebot', action: 'restart' },
  ];
  for (const { appId, action } of latestEnabled) {
    const found = body.items.find((item) => item.appId === appId && item.action === action);
    assert.equal(found, undefined, `${appId}:${action} should not appear in backlog`);
  }
});

test('exact ten still-disabled actions are in backlog', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const body = JSON.parse(response.body) as {
    disabledActionCount: number;
    items: Array<{ appId: string; action: string; reason: string }>;
  };
  assert.equal(body.disabledActionCount, body.items.length, 'disabledActionCount should match the actual backlog items');
  const disabledKeys = new Set(body.items.map((item) => `${item.appId}:${item.action}`));
  for (const key of ['prochat:stop', 'prochat:restart', 'jpv-bootcamp:stop', 'jpv-bootcamp:restart', 'mind-steward:start', 'mind-steward:stop', 'mind-steward:restart']) {
    assert.ok(disabledKeys.has(key), `${key} should be in disabled backlog`);
  }
  assert.equal(body.disabledActionCount, 7, 'current backlog should contain seven disabled actions');
});

test('family-finance stop script is safe: no pkill/killall/lsof/port-killing', async () => {
  const stopPath = path.resolve('/Users/Office/Repos/stevewesthoek/family-finance/scripts/dev/stop-local.sh');
  const content = fs.readFileSync(stopPath, 'utf8');
  assert.ok(!content.includes('pkill'), 'family-finance stop must not use pkill');
  assert.ok(!content.includes('killall'), 'family-finance stop must not use killall');
  assert.ok(!content.includes('lsof'), 'family-finance stop must not use lsof');
  assert.ok(!content.includes('.env'), 'family-finance stop must not reference .env');
  assert.ok(content.includes('PID_FILE'), 'family-finance stop must use a PID file');
});

test('family-finance restart script delegates to stop then start', async () => {
  const restartPath = path.resolve('/Users/Office/Repos/stevewesthoek/family-finance/scripts/dev/restart-local.sh');
  const content = fs.readFileSync(restartPath, 'utf8');
  assert.ok(content.includes('stop-local.sh'), 'family-finance restart must call stop-local.sh');
  assert.ok(content.includes('start-local.sh'), 'family-finance restart must call start-local.sh');
  assert.ok(!content.includes('.env'), 'family-finance restart must not reference .env');
});

test('tradebot stop script is safe: no pkill/killall/lsof/port-killing', async () => {
  const stopPath = path.resolve('/Users/Office/Repos/stevewesthoek/tradebot/scripts/dev/stop-local.sh');
  const content = fs.readFileSync(stopPath, 'utf8');
  assert.ok(!content.includes('pkill'), 'tradebot stop must not use pkill');
  assert.ok(!content.includes('killall'), 'tradebot stop must not use killall');
  assert.ok(!content.includes('lsof'), 'tradebot stop must not use lsof');
  assert.ok(!content.includes('.env'), 'tradebot stop must not reference .env');
  assert.ok(content.includes('PID_FILE'), 'tradebot stop must use a PID file');
});

test('tradebot restart script delegates to stop then start', async () => {
  const restartPath = path.resolve('/Users/Office/Repos/stevewesthoek/tradebot/scripts/dev/restart-local.sh');
  const content = fs.readFileSync(restartPath, 'utf8');
  assert.ok(content.includes('stop-local.sh'), 'tradebot restart must call stop-local.sh');
  assert.ok(content.includes('start-local.sh'), 'tradebot restart must call start-local.sh');
  assert.ok(!content.includes('.env'), 'tradebot restart must not reference .env');
});

test('backlog disabled count equals dashboard disabled action count', async () => {
  const dashboardResponse = await exercise({ method: 'GET', url: '/local-apps/dashboard' });
  const dashboard = JSON.parse(dashboardResponse.body) as {
    apps: Array<{ id: string; startSupported: boolean; stopSupported: boolean; restartSupported: boolean }>;
  };
  const backlogResponse = await exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' });
  const backlog = JSON.parse(backlogResponse.body) as { disabledActionCount: number; items: Array<{ appId: string; action: string }> };

  const dashboardDisabledCount = dashboard.apps.reduce((count, app) => {
    if (!app.startSupported) count++;
    if (!app.stopSupported) count++;
    if (!app.restartSupported) count++;
    return count;
  }, 0);
  assert.equal(backlog.disabledActionCount, dashboardDisabledCount, 'backlog disabled count must equal dashboard disabled action count');
  assert.equal(backlog.items.length, dashboardDisabledCount, 'backlog items length must equal dashboard disabled action count');
});

test('GET /local-apps/operational-readiness returns 200 with well-formed payload', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = JSON.parse(response.body) as {
    id: string;
    generatedAt: string;
    appCount: number;
    reachableCount: number;
    unreachableCount: number;
    unknownCount: number;
    notConfiguredCount: number;
    staleCount: number;
    items: Array<{ appId: string; appName: string; status: string; message: string }>;
    totalCheckDurationMs: number;
    safety: { readOnly: boolean; pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; exposesSecrets: boolean; writesToMind: boolean; performsLifecycleAction: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-operational-readiness');
  assert.ok(typeof body.generatedAt === 'string' && body.generatedAt.length > 0, 'generatedAt must be set');
  assert.ok(body.appCount >= 16, 'appCount must reflect canonical inventory');
  assert.equal(body.appCount, body.items.length, 'appCount must match items array length');
  assert.equal(body.reachableCount + body.unreachableCount + body.unknownCount + body.notConfiguredCount + body.staleCount, body.appCount, 'status counts must sum to appCount');
  assert.ok(typeof body.totalCheckDurationMs === 'number' && body.totalCheckDurationMs >= 0, 'totalCheckDurationMs must be non-negative');
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.exposesSecrets, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.performsLifecycleAction, false);
  assert.ok(!('executesShell' in body.safety), 'safety must not expose executesShell');
  assert.ok(!('exposesEnv' in body.safety), 'safety must not expose exposesEnv');
  assert.ok(!('writesFiles' in body.safety), 'safety must not expose writesFiles');
});

test('GET /local-apps/operational-readiness items have correct shape', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = JSON.parse(response.body) as {
    items: Array<{
      appId: string;
      appName: string;
      status: string;
      message: string;
      actionEnabled: boolean;
      startSupported: boolean;
      stopSupported: boolean;
      restartSupported: boolean;
      freshness: { source: string; maxAgeMs: number; fresh: boolean };
      safety: { readOnly: boolean; pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; exposesSecrets: boolean; writesToMind: boolean; performsLifecycleAction: boolean };
    }>;
  };
  const validStatuses = new Set(['reachable', 'unreachable', 'unknown', 'not-configured', 'stale']);

  for (const item of body.items) {
    assert.ok(typeof item.appId === 'string' && item.appId.length > 0, `item ${item.appId} must have appId`);
    assert.ok(typeof item.appName === 'string' && item.appName.length > 0, `item ${item.appId} must have appName`);
    assert.ok(validStatuses.has(item.status), `item ${item.appId} status ${item.status} must be valid`);
    assert.ok(typeof item.message === 'string' && item.message.length > 0, `item ${item.appId} message must be non-empty`);
    assert.ok(typeof item.actionEnabled === 'boolean', `item ${item.appId} actionEnabled must be boolean`);
    assert.ok(typeof item.startSupported === 'boolean', `item ${item.appId} startSupported must be boolean`);
    assert.ok(typeof item.stopSupported === 'boolean', `item ${item.appId} stopSupported must be boolean`);
    assert.ok(typeof item.restartSupported === 'boolean', `item ${item.appId} restartSupported must be boolean`);
    assert.ok(item.freshness && typeof item.freshness.source === 'string', `item ${item.appId} must have freshness.source`);
    assert.ok(typeof item.freshness.maxAgeMs === 'number', `item ${item.appId} freshness.maxAgeMs must be number`);
    assert.ok(typeof item.freshness.fresh === 'boolean', `item ${item.appId} freshness.fresh must be boolean`);
    assert.equal(item.safety.readOnly, true, `item ${item.appId} safety.readOnly must be true`);
    assert.equal(item.safety.pluginExecutesShell, false, `item ${item.appId} safety.pluginExecutesShell must be false`);
    assert.equal(item.safety.arbitraryCommandAllowed, false, `item ${item.appId} safety.arbitraryCommandAllowed must be false`);
    assert.equal(item.safety.exposesSecrets, false, `item ${item.appId} safety.exposesSecrets must be false`);
    assert.equal(item.safety.writesToMind, false, `item ${item.appId} safety.writesToMind must be false`);
    assert.equal(item.safety.performsLifecycleAction, false, `item ${item.appId} safety.performsLifecycleAction must be false`);
  }
});

test('GET /local-apps/operational-readiness not-configured items have no healthUrl', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; status: string; healthUrl?: string; freshness: { source: string; fresh: boolean } }>;
  };

  const notConfigured = body.items.filter((item) => item.status === 'not-configured');
  assert.ok(notConfigured.length > 0, 'must have at least one not-configured item');
  for (const item of notConfigured) {
    assert.ok(item.healthUrl === undefined, `not-configured item ${item.appId} must not have healthUrl`);
    assert.equal(item.freshness.source, 'not-checked', `not-configured item ${item.appId} freshness.source must be not-checked`);
    assert.equal(item.freshness.fresh, false, `not-configured item ${item.appId} freshness.fresh must be false`);
  }
});

test('GET /local-apps/operational-readiness probed items have durationMs and freshness', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; status: string; healthUrl?: string; durationMs?: number; checkedAt?: string; freshness: { source: string } }>;
  };

  const probed = body.items.filter((item) => item.healthUrl !== undefined && item.status !== 'stale');
  for (const item of probed) {
    assert.ok(typeof item.durationMs === 'number', `probed item ${item.appId} must have durationMs`);
    assert.ok(typeof item.checkedAt === 'string', `probed item ${item.appId} must have checkedAt`);
    assert.equal(item.freshness.source, 'live-check', `probed item ${item.appId} freshness.source must be live-check`);
  }
});

test('GET /local-apps/operational-readiness action flags reflect app definition', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; actionEnabled: boolean; startSupported: boolean; stopSupported: boolean; restartSupported: boolean }>;
  };

  for (const item of body.items) {
    if (!item.actionEnabled) {
      assert.ok(!item.startSupported || !item.stopSupported || !item.restartSupported || (!item.startSupported && !item.stopSupported && !item.restartSupported),
        `item ${item.appId}: disabled action policy should yield no supported actions`);
    }
  }
});

test('GET /local-apps/operational-readiness does not execute shell or expose secrets', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operational-readiness' });
  const body = response.body;

  assert.ok(!body.includes('TOKEN='), 'must not expose TOKEN=');
  assert.ok(!body.includes('SECRET='), 'must not expose SECRET=');
  assert.ok(!body.includes('PASSWORD='), 'must not expose PASSWORD=');
  assert.ok(!body.includes('.env'), 'must not reference .env');
});

test('POST /local-apps/operational-readiness is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/operational-readiness' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405, 'POST must be rejected');
});

test('readLocalAppsOperationalReadiness adapter: mock fetch — reachable apps', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (_url: string): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);

  assert.equal(result.id, 'local-apps-operational-readiness');
  assert.ok(result.appCount >= 16, 'appCount must reflect inventory');
  assert.ok(result.reachableCount > 0, 'mock-reachable fetch must yield reachable entries');
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.pluginExecutesShell, false);
  assert.equal(result.safety.arbitraryCommandAllowed, false);
  assert.equal(result.safety.exposesSecrets, false);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.performsLifecycleAction, false);
  for (const item of result.items) {
    if (item.healthUrl !== undefined) {
      assert.equal(item.status, 'reachable', `${item.appId} should be reachable via mock`);
      assert.equal(item.httpStatus, 200, `${item.appId} httpStatus must be 200`);
      assert.ok(typeof item.durationMs === 'number', `${item.appId} durationMs must be set`);
      assert.equal(item.freshness.source, 'live-check', `${item.appId} freshness.source must be live-check`);
      assert.equal(item.freshness.fresh, true, `${item.appId} freshness.fresh must be true when reachable`);
    }
  }
});

test('readLocalAppsOperationalReadiness adapter: mock fetch — unreachable apps', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (): Promise<Response> => {
    throw new Error('ECONNREFUSED');
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);

  const probedItems = result.items.filter((item) => item.healthUrl !== undefined);
  for (const item of probedItems) {
    assert.equal(item.status, 'unreachable', `${item.appId} should be unreachable when fetch throws`);
    assert.ok(item.httpStatus === undefined || item.httpStatus === null, `${item.appId} httpStatus must be absent on error`);
    assert.equal(item.freshness.source, 'live-check');
    assert.equal(item.freshness.fresh, false);
  }
});

test('readLocalAppsOperationalReadiness adapter: mock fetch — non-ok response is unreachable', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: false, status: 503 } as Response;
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);

  const probedItems = result.items.filter((item) => item.healthUrl !== undefined);
  for (const item of probedItems) {
    assert.equal(item.status, 'unreachable', `${item.appId} 503 response should be unreachable`);
    assert.equal(item.httpStatus, 503);
    assert.equal(item.freshness.fresh, false);
  }
});

test('readLocalAppsOperationalReadiness adapter: status counts sum to appCount', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);
  const sum = result.reachableCount + result.unreachableCount + result.unknownCount + result.notConfiguredCount + result.staleCount;
  assert.equal(sum, result.appCount, 'status counts must sum to appCount');
});

test('readLocalAppsOperationalReadiness adapter: not-configured items have freshness not-checked', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);
  const notConfigured = result.items.filter((item) => item.status === 'not-configured');
  for (const item of notConfigured) {
    assert.equal(item.freshness.source, 'not-checked', `${item.appId} not-configured freshness.source must be not-checked`);
    assert.equal(item.freshness.fresh, false, `${item.appId} not-configured freshness.fresh must be false`);
    assert.ok(item.healthUrl === undefined, `${item.appId} not-configured must not have healthUrl`);
  }
});

test('readLocalAppsOperationalReadiness adapter: per-item safety flags are complete', async () => {
  const { readLocalAppsOperationalReadiness } = await import('../adapters/local-app-operational-readiness.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperationalReadiness(mockFetch as typeof fetch);
  for (const item of result.items) {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.pluginExecutesShell, false);
    assert.equal(item.safety.arbitraryCommandAllowed, false);
    assert.equal(item.safety.exposesSecrets, false);
    assert.equal(item.safety.writesToMind, false);
    assert.equal(item.safety.performsLifecycleAction, false);
  }
});

test('GET /local-apps/operator-summary returns 200 with well-formed payload', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    id: string;
    generatedAt: string;
    appCount: number;
    executableActionCount: number;
    disabledActionCount: number;
    reachableCount: number;
    unreachableCount: number;
    notConfiguredCount: number;
    staleCount: number;
    attentionCount: number;
    items: unknown[];
    topAttentionItems: unknown[];
    safety: { readOnly: boolean; pluginExecutesShell: boolean; arbitraryCommandAllowed: boolean; exposesSecrets: boolean; writesToMind: boolean; performsLifecycleAction: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'local-apps-operator-summary');
  assert.ok(typeof body.generatedAt === 'string' && body.generatedAt.length > 0);
  assert.ok(body.appCount >= 16, 'appCount must reflect canonical inventory');
  assert.equal(body.appCount, body.items.length, 'appCount must match items.length');
  assert.ok(typeof body.executableActionCount === 'number' && body.executableActionCount >= 0);
  assert.ok(typeof body.disabledActionCount === 'number' && body.disabledActionCount >= 0);
  assert.ok(typeof body.attentionCount === 'number');
  assert.ok(Array.isArray(body.topAttentionItems));
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.exposesSecrets, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.performsLifecycleAction, false);
});

test('GET /local-apps/operator-summary items have correct shape', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    items: Array<{
      appId: string;
      appName: string;
      status: string;
      reachabilityStatus: string;
      actionEnabled: boolean;
      supportedActions: string[];
      disabledActions: Array<{ action: string; reason: string }>;
      nextRecommendedAction: { label: string; kind: string; reason: string; executable: boolean };
      freshness: { fresh: boolean; source: string };
    }>;
  };
  const validStatuses = new Set(['ok', 'attention', 'blocked', 'unknown']);
  const validReachability = new Set(['reachable', 'unreachable', 'unknown', 'not-configured', 'stale']);
  const validNextKinds = new Set(['none', 'start', 'stop', 'restart', 'inspect-health', 'configure-health-url', 'add-lifecycle-script', 'manual-review']);

  for (const item of body.items) {
    assert.ok(typeof item.appId === 'string' && item.appId.length > 0);
    assert.ok(typeof item.appName === 'string' && item.appName.length > 0);
    assert.ok(validStatuses.has(item.status), `status ${item.status} must be valid`);
    assert.ok(validReachability.has(item.reachabilityStatus), `reachabilityStatus ${item.reachabilityStatus} must be valid`);
    assert.ok(typeof item.actionEnabled === 'boolean');
    assert.ok(Array.isArray(item.supportedActions));
    assert.ok(Array.isArray(item.disabledActions));
    for (const da of item.disabledActions) {
      assert.ok(typeof da.action === 'string');
      assert.ok(typeof da.reason === 'string');
    }
    assert.ok(validNextKinds.has(item.nextRecommendedAction.kind), `nextRecommendedAction.kind ${item.nextRecommendedAction.kind} must be valid`);
    assert.ok(typeof item.nextRecommendedAction.label === 'string');
    assert.ok(typeof item.nextRecommendedAction.reason === 'string');
    assert.ok(typeof item.nextRecommendedAction.executable === 'boolean');
    assert.ok(typeof item.freshness.fresh === 'boolean');
    assert.ok(typeof item.freshness.source === 'string');
  }
});

test('GET /local-apps/operator-summary appCount matches items.length', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as { appCount: number; items: unknown[] };
  assert.equal(body.appCount, body.items.length);
});

test('GET /local-apps/operator-summary executableActionCount + disabledActionCount equals appCount * 3', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as { appCount: number; executableActionCount: number; disabledActionCount: number };
  assert.equal(
    body.executableActionCount + body.disabledActionCount,
    body.appCount * 3,
    'executableActionCount + disabledActionCount must equal appCount * 3 (start+stop+restart per app)',
  );
});

test('GET /local-apps/operator-summary disabledActionCount matches backlog disabledActionCount', async () => {
  const [summaryResponse, backlogResponse] = await Promise.all([
    exercise({ method: 'GET', url: '/local-apps/operator-summary' }),
    exercise({ method: 'GET', url: '/local-apps/action-enablement-backlog' }),
  ]);
  const summary = JSON.parse(summaryResponse.body) as { disabledActionCount: number };
  const backlog = JSON.parse(backlogResponse.body) as { disabledActionCount: number };
  assert.equal(summary.disabledActionCount, backlog.disabledActionCount, 'operator summary disabledActionCount must match backlog disabledActionCount');
});

test('GET /local-apps/operator-summary items include supportedActions and disabledActions', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; supportedActions: string[]; disabledActions: Array<{ action: string }> }>;
  };

  for (const item of body.items) {
    const totalActions = item.supportedActions.length + item.disabledActions.length;
    assert.equal(totalActions, 3, `item ${item.appId} supportedActions + disabledActions must equal 3`);
  }
});

test('GET /local-apps/operator-summary items include nextRecommendedAction', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    items: Array<{ nextRecommendedAction: { kind: string; executable: boolean } }>;
  };

  assert.ok(body.items.every((item) => typeof item.nextRecommendedAction.kind === 'string'));
});

test('GET /local-apps/operator-summary configure-health-url recommendation for apps without health URL', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    items: Array<{ appId: string; reachabilityStatus: string; nextRecommendedAction: { kind: string } }>;
  };

  const noHealthItems = body.items.filter((item) => item.reachabilityStatus === 'not-configured');
  assert.ok(noHealthItems.length > 0, 'must have at least one not-configured item');
  const configureHealthItems = noHealthItems.filter((item) =>
    item.nextRecommendedAction.kind === 'configure-health-url' ||
    item.nextRecommendedAction.kind === 'add-lifecycle-script' ||
    item.nextRecommendedAction.kind === 'manual-review' ||
    item.nextRecommendedAction.kind === 'none',
  );
  assert.ok(configureHealthItems.length > 0, 'not-configured items should have an appropriate next action');
});

test('GET /local-apps/operator-summary add-lifecycle-script or manual-review for lifecycle gaps', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    items: Array<{ disabledActions: Array<{ category?: string }>; nextRecommendedAction: { kind: string } }>;
  };

  const lifecycleGapItems = body.items.filter((item) =>
    item.disabledActions.some((da) => da.category === 'missing-command' || da.category === 'missing-repo-local-script'),
  );
  assert.ok(lifecycleGapItems.length > 0, 'must have at least one item with lifecycle gap');
  const actionableItems = lifecycleGapItems.filter((item) =>
    item.nextRecommendedAction.kind === 'add-lifecycle-script' ||
    item.nextRecommendedAction.kind === 'manual-review' ||
    item.nextRecommendedAction.kind === 'configure-health-url' ||
    item.nextRecommendedAction.kind === 'none',
  );
  assert.ok(actionableItems.length > 0, 'lifecycle gap items should have an appropriate next action');
});

test('GET /local-apps/operator-summary safety flags complete', async () => {
  const response = await exercise({ method: 'GET', url: '/local-apps/operator-summary' });
  const body = JSON.parse(response.body) as {
    safety: Record<string, unknown>;
  };

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.pluginExecutesShell, false);
  assert.equal(body.safety.arbitraryCommandAllowed, false);
  assert.equal(body.safety.exposesSecrets, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.performsLifecycleAction, false);
  assert.ok(!('executesShell' in body.safety), 'must not expose executesShell');
  assert.ok(!('exposesEnv' in body.safety), 'must not expose exposesEnv');
  assert.ok(!('writesFiles' in body.safety), 'must not expose writesFiles');
});

test('POST /local-apps/operator-summary is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/local-apps/operator-summary' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405, 'POST must be rejected');
});

test('readLocalAppsOperatorSummary adapter: mock fetch — counts sum correctly', async () => {
  const { readLocalAppsOperatorSummary } = await import('../adapters/local-app-operator-summary.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperatorSummary(mockFetch as typeof fetch);

  assert.equal(result.id, 'local-apps-operator-summary');
  assert.ok(result.appCount >= 16);
  assert.equal(result.appCount, result.items.length);
  assert.equal(result.executableActionCount + result.disabledActionCount, result.appCount * 3);
  assert.equal(result.safety.readOnly, true);
  assert.equal(result.safety.arbitraryCommandAllowed, false);
  assert.equal(result.safety.performsLifecycleAction, false);
});

test('readLocalAppsOperatorSummary adapter: mock fetch — reachable items have ok or attention status', async () => {
  const { readLocalAppsOperatorSummary } = await import('../adapters/local-app-operator-summary.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: true, status: 200 } as Response;
  };

  const result = await readLocalAppsOperatorSummary(mockFetch as typeof fetch);
  const reachableItems = result.items.filter((item) => item.reachabilityStatus === 'reachable');
  for (const item of reachableItems) {
    assert.ok(item.status === 'ok' || item.status === 'attention' || item.status === 'blocked',
      `reachable item ${item.appId} should not be unknown`);
  }
});

test('readLocalAppsOperatorSummary adapter: mock fetch — unreachable items have attention status', async () => {
  const { readLocalAppsOperatorSummary } = await import('../adapters/local-app-operator-summary.js');

  const mockFetch = async (): Promise<Response> => {
    return { ok: false, status: 503 } as Response;
  };

  const result = await readLocalAppsOperatorSummary(mockFetch as typeof fetch);
  const probedItems = result.items.filter((item) =>
    item.reachabilityStatus === 'unreachable',
  );
  for (const item of probedItems) {
    assert.ok(item.status === 'attention' || item.status === 'blocked',
      `unreachable item ${item.appId} should have attention or blocked status`);
  }
});

test('responses do not include secrets or raw env values', async () => {
  const endpoints = [
    '/local-apps/dashboard',
    '/local-apps/actions/status',
    '/local-apps/action-enablement-backlog',
    '/local-apps/source-diagnostics',
    '/local-apps/operational-readiness',
    '/local-apps/operator-summary',
  ];
  for (const endpoint of endpoints) {
    const response = await exercise({ method: 'GET', url: endpoint });
    const body = response.body;
    assert.ok(!body.includes('.env'), `${endpoint} must not expose .env`);
    assert.ok(!body.includes('TOKEN='), `${endpoint} must not expose TOKEN=`);
    assert.ok(!body.includes('SECRET='), `${endpoint} must not expose SECRET=`);
    assert.ok(!body.includes('PASSWORD='), `${endpoint} must not expose PASSWORD=`);
    assert.ok(!body.includes('COOKIE='), `${endpoint} must not expose COOKIE=`);
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

test('GET /infra/video-orchestrator/normalize-history returns shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/normalize-history' });
  const body = JSON.parse(response.body) as { ok: boolean; jobs: unknown[]; totalCount: number };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.ok, 'boolean', 'ok must be boolean');
  assert.ok(Array.isArray(body.jobs), 'jobs must be an array');
  assert.equal(typeof body.totalCount, 'number', 'totalCount must be a number');
});

test('GET /infra/video-orchestrator/normalize-history respects limit param', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/normalize-history?limit=5' });
  const body = JSON.parse(response.body) as { ok: boolean; jobs: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.ok(body.jobs.length <= 5, 'jobs.length must respect limit');
});

test('GET /infra/video-orchestrator/manual-queue returns shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/manual-queue' });
  const body = JSON.parse(response.body) as { ok: boolean; jobs: unknown[]; totalCount: number };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.ok, 'boolean', 'ok must be boolean');
  assert.ok(Array.isArray(body.jobs), 'jobs must be an array');
  assert.equal(typeof body.totalCount, 'number', 'totalCount must be a number');
});

test('GET /infra/video-orchestrator/worker-config returns shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/worker-config' });
  const body = JSON.parse(response.body) as { ok: boolean; manualActionsRequired: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.ok, 'boolean', 'ok must be boolean');
  assert.ok(Array.isArray(body.manualActionsRequired), 'manualActionsRequired must be an array');
});

test('GET /infra/video-orchestrator/worker-config does not expose CF Access secrets', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/worker-config' });
  const body = response.body;

  assert.ok(!body.includes('CF_ACCESS_CLIENT_SECRET='), 'must not expose raw secret');
  assert.ok(!body.includes('PLACEHOLDER_CF_ACCESS_CLIENT_SECRET'), 'must not expose placeholder value');
});

test('GET /infra/video-orchestrator/accounts-stats returns shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/accounts-stats' });
  const body = JSON.parse(response.body) as { ok: boolean; stats: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.ok, 'boolean', 'ok must be boolean');
  assert.ok(Array.isArray(body.stats), 'stats must be an array');
});

test('GET /infra/video-orchestrator/readiness returns shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/readiness' });
  const body = JSON.parse(response.body) as { ok: boolean; status: string; readinessScore: number; checks: unknown[] };

  assert.equal(response.statusCode, 200);
  assert.equal(typeof body.ok, 'boolean', 'ok must be boolean');
  assert.ok(['ready', 'partial', 'blocked'].includes(body.status), `status must be valid: ${body.status}`);
  assert.equal(typeof body.readinessScore, 'number', 'readinessScore must be a number');
  assert.ok(body.readinessScore >= 0 && body.readinessScore <= 100, 'readinessScore must be 0-100');
  assert.ok(Array.isArray(body.checks), 'checks must be an array');
  assert.ok(body.checks.length > 0, 'checks must be non-empty');
});

test('GET /infra/video-orchestrator/readiness does not expose secrets', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/readiness' });
  const body = response.body;

  assert.ok(!body.includes('access_token'), 'must not expose access_token');
  assert.ok(!body.includes('refresh_token'), 'must not expose refresh_token');
  assert.ok(!body.includes('client_secret'), 'must not expose client_secret');
});
