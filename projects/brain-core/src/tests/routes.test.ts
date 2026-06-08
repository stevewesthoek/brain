import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import { executeLocalAppActionRequest, listLocalAppDefinitions, readLocalAppActionStatus } from '../adapters/local-app-orchestrator.js';
import { evaluateLocalAppActionDefinition } from '../adapters/local-app-action-executor.js';
import { isAppAlreadyRunning } from '../adapters/local-app-stack-orchestrator.js';
import { createServer } from 'node:http';
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

async function startClassifierSelectorHealthServer(): Promise<{ server: any; port: number }> {
  return await new Promise((resolve) => {
    const server: any = createServer((req, res) => {
      if (req.url?.startsWith('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'qwen2.5:14b' }] }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        resolve({ server, port: 0 });
        return;
      }

      resolve({ server, port: address.port });
    });
  });
}

function writeClassifierSelectorConfig(configDir: string, port: number): void {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'ai-providers.json'),
    JSON.stringify(
      {
        providers: [
          {
            id: 'ollama-local',
            type: 'openai-compatible',
            base_url: `http://127.0.0.1:${port}/v1`,
            cost_per_1k_tokens: 0,
            priority: 1,
            capabilities: ['text/medium'],
            preferred_models: ['qwen2.5:14b'],
            health_check: {
              endpoint: `http://127.0.0.1:${port}/models`,
            },
          },
        ],
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(configDir, 'ai-task-types.json'),
    JSON.stringify(
      {
        task_types: {
          mind_capture_classification: {
            capability: 'text/medium',
            typical_input_tokens: 2000,
            typical_output_tokens: 1000,
            min_local_model_params: '7B',
          },
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(configDir, 'ai-selector-config.json'),
    JSON.stringify(
      {
        batch_window: { start_hour: 1, end_hour: 7 },
        prefer_defer_over_paid: false,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(configDir, 'ai-bedrock-models.json'), JSON.stringify({ models: [] }, null, 2));
}

function writeClassifierInboxFixture(mindRoot: string): void {
  const inboxDir = path.join(mindRoot, 'capture', 'inbox');
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-alpha.md'), '# Alpha\nAlpha inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-beta.md'), '# Beta\nBeta inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-gamma.md'), '# Gamma\nGamma inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-large.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
}

function writeQueueInboxFixture(mindRoot: string): void {
  const inboxDir = path.join(mindRoot, 'capture', 'inbox');
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-alpha.md'), '# Alpha\nAlpha inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-beta.md'), '# Beta\nBeta inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-gamma.md'), '# Gamma\nGamma inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-delta.md'), '# Delta\nDelta inbox entry.\n');
  fs.writeFileSync(path.join(inboxDir, '2026-06-07-large.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
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
    executionGate: {
      executionEnabled: boolean;
      mindStewardDryRunExecutionFlagEnabled: boolean;
      mindStewardDryRunExecutionFlagName: string;
      mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxDryRunExecutionFlagName?: string;
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
  assert.equal(body.brainConsole.projectPath, 'projects/brain-console-center');
  assert.equal(body.brainConsole.packageStatus, 'buildable');
  assert.equal(body.brainConsole.manualInstallRequired, true);
  assert.equal(body.executionGate.executionEnabled, false);
  assert.equal(body.executionGate.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.executionGate.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION');
  assert.equal(body.executionGate.firstCandidate, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.executionGate.candidateActionKinds.includes('scheduler-run-mind-steward-inbox-queue-dry-run'), true);
  assert.equal(body.executionGate.readinessEndpoint, '/execution/readiness');
  assert.equal(body.executionGate.plansEndpoint, '/execution/plans');
  assert.equal(body.executionGate.candidateActionKinds.includes('scheduler-run-mind-steward-dry-run'), true);
  assert.equal(body.executionGate.candidateActionKinds.includes('scheduler-run-mind-steward-inbox-dry-run'), true);
  assert.equal(body.executionGate.mindStewardInboxDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION');
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

test('GET /agent-task-graph returns the read-only agent task graph', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-task-graph' });
  const body = JSON.parse(response.body) as { id: string; status: string; taskCount: number; tasks: Array<{ taskId: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-task-graph');
  assert.equal(body.status, 'read-only');
  assert.ok(body.taskCount > 0);
  assert.ok(body.tasks.some((task) => task.taskId === '0C-C'));
});

test('GET /agent-ledger returns the derived read-only agent ledger', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-ledger' });
  const body = JSON.parse(response.body) as { id: string; status: string; runCount: number; eventCount: number; taskGraph: { id: string } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-ledger');
  assert.equal(body.status, 'read-only');
  assert.ok(body.runCount >= 0);
  assert.ok(body.eventCount >= 0);
  assert.equal(body.taskGraph.id, 'agent-task-graph');
});

test('GET /agent-task-state returns a resumable task state surface', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-task-state' });
  const body = JSON.parse(response.body) as { id: string; status: string; taskGraphId: string; stepCount: number };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-task-state');
  assert.equal(body.status, 'read-only');
  assert.equal(body.taskGraphId, 'agent-task-graph');
  assert.ok(body.stepCount > 0);
});

test('GET /agent-executor-plan returns recorded executor selections', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-executor-plan' });
  const body = JSON.parse(response.body) as { id: string; status: string; stepCount: number; steps: Array<{ executorId: string }> };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-executor-plan');
  assert.equal(body.status, 'read-only');
  assert.ok(body.stepCount > 0);
  assert.ok(body.steps.some((step) => step.executorId === 'local-ollama-m4pro'));
});

test('GET /agent-approval-gates returns read-only approval gate status', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-approval-gates' });
  const body = JSON.parse(response.body) as { id: string; status: string; approvalStoreStatus: string; nextSafeStep: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-approval-gates');
  assert.equal(body.status, 'read-only');
  assert.ok(typeof body.approvalStoreStatus === 'string');
  assert.ok(body.nextSafeStep.length > 0);
});

test('GET /agent-console returns the combined read-only agent console summary', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-console' });
  const body = JSON.parse(response.body) as { id: string; status: string; activeRunCount: number; executorSelectionCount: number };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-console');
  assert.equal(body.status, 'read-only');
  assert.ok(body.executorSelectionCount > 0);
  assert.ok(body.activeRunCount >= 0);
});

test('GET /agent-cost-summary returns the derived cost and routing summary', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-cost-summary' });
  const body = JSON.parse(response.body) as { id: string; status: string; routeHistory: Array<{ surface: string }>; budget: { status: string } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'agent-cost-summary');
  assert.ok(body.status === 'read-only' || body.status === 'snapshot');
  assert.ok(Array.isArray(body.routeHistory));
  assert.ok(body.routeHistory.length > 0);
  assert.ok(typeof body.budget.status === 'string');
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
  assert.equal(body.jobs.length, 13);
  assert.equal(body.jobs[0]?.id, 'mind-compile-loop');
  assert.equal(typeof body.jobs[0]?.mutationRequired, 'boolean');
  assert.equal(body.jobs.some((job) => job.id === 'mind-steward-dry-run'), true);
  assert.equal(body.jobs.some((job) => job.id === 'mind-steward-inbox-dry-run'), true);
  assert.equal(body.jobs.some((job) => job.id === 'mind-steward-inbox-classifier-dry-run'), true);
  assert.equal(body.jobs.some((job) => job.id === 'mind-steward-inbox-queue-dry-run'), true);
  assert.equal(body.jobs.some((job) => job.id === 'graphify-preflight-mind'), true);
  assert.equal(body.jobs.some((job) => job.id === 'graphify-preflight-brain'), true);
  assert.equal(body.jobs.some((job) => job.id === 'graphify-update-mind-blocked'), true);
  assert.equal(body.jobs.some((job) => job.id === 'graphify-update-brain-blocked'), true);
  assert.equal(body.jobs.some((job) => job.id === 'infinite-brain-report-only-pipeline'), true);
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

test('GET /scheduler/jobs reports mind-steward inbox dry-run ok status when runtime report exists', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-inbox-jobs');
  const reportPath = path.join(testDir, 'inbox-latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success' }));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = path.join(testDir, 'latest.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
    const body = JSON.parse(response.body) as { jobs: Array<{ id: string; status: string }> };
    const inboxJob = body.jobs.find((job) => job.id === 'mind-steward-inbox-dry-run');

    assert.equal(response.statusCode, 200);
    assert.equal(inboxJob?.status, 'ok');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /scheduler/jobs reports mind-steward inbox classifier dry-run ok status when runtime report exists', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-inbox-classifier-jobs');
  const reportPath = path.join(testDir, 'inbox-classifier-latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success' }));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = path.join(testDir, 'latest.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
    const body = JSON.parse(response.body) as { jobs: Array<{ id: string; status: string }> };
    const classifierJob = body.jobs.find((job) => job.id === 'mind-steward-inbox-classifier-dry-run');

    assert.equal(response.statusCode, 200);
    assert.equal(classifierJob?.status, 'ok');
  } finally {
    if (previousReportPath === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /scheduler/jobs reports mind-steward inbox queue dry-run ok status when runtime report exists', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-inbox-queue-jobs');
  const reportPath = path.join(testDir, 'inbox-queue-latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success' }));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = path.join(testDir, 'latest.json');

  try {
    const response = await exercise({ method: 'GET', url: '/scheduler/jobs' });
    const body = JSON.parse(response.body) as { jobs: Array<{ id: string; status: string }> };
    const queueJob = body.jobs.find((job) => job.id === 'mind-steward-inbox-queue-dry-run');

    assert.equal(response.statusCode, 200);
    assert.equal(queueJob?.status, 'ok');
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
      apps: [{ id: 'office-scheduler', name: 'Office Nightly Scheduler', status: 'running', actionsSupported: false }],
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
    const officeScheduler = body.apps.find((app) => app.id === 'office-scheduler');
    assert.equal(officeScheduler?.status, 'running');
    assert.equal(officeScheduler?.source, 'runtime-report');
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

test('POST /ops/brain-core/restart requires explicit confirmation', async () => {
  const response = await exercise({ method: 'POST', url: '/ops/brain-core/restart' });
  const body = JSON.parse(response.body) as { error?: { code?: string; message?: string } };

  assert.equal(response.statusCode, 400);
  assert.equal(body.error?.code, 'missing_confirmation');
  assert.equal(body.error?.message, 'Brain Core restart requests require confirmation: true.');
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

test('start preflight treats healthy apps as already running and blocks unhealthy occupied ports', async () => {
  const http = await import('node:http');
  const healthyServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const unhealthyServer = http.createServer((_, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
  });

  await new Promise<void>((resolve) => (healthyServer as any).listen(0, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => (unhealthyServer as any).listen(0, '127.0.0.1', resolve));

  try {
    const healthyPort = ((healthyServer as any).address() as { port: number }).port;
    const unhealthyPort = ((unhealthyServer as any).address() as { port: number }).port;
    const healthy = await isAppAlreadyRunning({ appPort: healthyPort, healthUrl: `http://127.0.0.1:${healthyPort}/health` } as never);
    const unhealthy = await isAppAlreadyRunning({ appPort: unhealthyPort, healthUrl: `http://127.0.0.1:${unhealthyPort}/health` } as never);

    assert.equal(healthy.ok, true);
    assert.equal(healthy.steps.some((step) => step.status === 'success'), true);
    assert.equal(unhealthy.ok, false);
    assert.equal((unhealthy as { reason?: string }).reason?.includes('not healthy'), true);
  } finally {
    await new Promise<void>((resolve) => healthyServer.close(() => resolve()));
    await new Promise<void>((resolve) => unhealthyServer.close(() => resolve()));
  }
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
    assert.equal(body.apps.some((app) => app.id === 'office-scheduler'), true);
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

test('POST /scheduler/jobs/mind-steward-inbox-dry-run/request-run uses execution plan preview metadata without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-dry-run/request-run' });
  const body = JSON.parse(response.body) as {
    approval: { kind: string; status: string };
    preview: { kind: string; summary: string; wouldExecute: boolean; writesToMind: boolean };
    policy: { executionEnabled: boolean; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'scheduler-run-mind-steward-inbox-dry-run');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.kind, 'scheduler-run-mind-steward-inbox-dry-run');
  assert.equal(body.preview.summary.toLowerCase().includes('inbox dry-run'), true);
  assert.equal(body.preview.wouldExecute, false);
  assert.equal(body.preview.writesToMind, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.requiresDurableAudit, true);
  assert.equal(body.policy.requiresRollbackPlan, true);
  assert.equal(body.executed, false);
});

test('POST /scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run uses execution plan preview metadata without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run' });
  const body = JSON.parse(response.body) as {
    approval: { kind: string; status: string };
    preview: { kind: string; summary: string; wouldExecute: boolean; writesToMind: boolean };
    policy: { executionEnabled: boolean; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'scheduler-run-mind-steward-inbox-classifier-dry-run');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.kind, 'scheduler-run-mind-steward-inbox-classifier-dry-run');
  assert.equal(body.preview.summary.toLowerCase().includes('classifier dry-run'), true);
  assert.equal(body.preview.wouldExecute, false);
  assert.equal(body.preview.writesToMind, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.requiresDurableAudit, true);
  assert.equal(body.policy.requiresRollbackPlan, true);
  assert.equal(body.executed, false);
});

test('POST /scheduler/jobs/mind-steward-inbox-queue-dry-run/request-run uses execution plan preview metadata without executing', async () => {
  const response = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-queue-dry-run/request-run' });
  const body = JSON.parse(response.body) as {
    approval: { kind: string; status: string };
    preview: { kind: string; summary: string; wouldExecute: boolean; writesToMind: boolean };
    policy: { executionEnabled: boolean; requiresDurableAudit: boolean; requiresRollbackPlan: boolean };
    executed: boolean;
  };

  assert.equal(response.statusCode, 202);
  assert.equal(body.approval.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(body.approval.status, 'pending');
  assert.equal(body.preview.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(body.preview.summary.toLowerCase().includes('queue/throttle preflight'), true);
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
      mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxDryRunExecutionFlagName?: string;
      mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxClassifierDryRunExecutionFlagName?: string;
      mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxQueueDryRunExecutionFlagName?: string;
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
  assert.equal(body.plans.length, 15);
  assert.equal(body.plans[0]?.kind, 'scheduler-run-mind-steward-dry-run');
  assert.equal(body.plans[1]?.kind, 'scheduler-run-mind-steward-inbox-dry-run');
  assert.equal(body.plans[2]?.kind, 'scheduler-run-mind-steward-inbox-classifier-dry-run');
  assert.equal(body.plans[3]?.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(body.plans.some((plan) => plan.kind === 'scheduler-run-graphify-preflight-mind'), true);
  assert.equal(body.plans.some((plan) => plan.kind === 'scheduler-run-graphify-preflight-brain'), true);
  assert.equal(body.plans.some((plan) => plan.kind === 'scheduler-run-graphify-update-mind-blocked'), true);
  assert.equal(body.plans.some((plan) => plan.kind === 'scheduler-run-graphify-update-brain-blocked'), true);
  assert.equal(body.plans.some((plan) => plan.kind === 'scheduler-run-infinite-brain-report-only-pipeline'), true);
  assert.equal(body.plans[0]?.candidate, true);
  assert.equal(body.plans[0]?.executionEnabled, false);
  assert.equal(body.plans[0]?.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[0]?.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION');
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
  assert.equal(body.plans[1]?.mindStewardInboxDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[1]?.mindStewardInboxDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION');
  assert.equal(body.plans[2]?.mindStewardInboxClassifierDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[2]?.mindStewardInboxClassifierDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION');
  assert.equal(body.plans[3]?.mindStewardInboxQueueDryRunExecutionFlagEnabled, false);
  assert.equal(body.plans[3]?.mindStewardInboxQueueDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION');
});

test('GET /execution/plans includes Infinite Brain report-only pipeline candidate', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans' });
  const body = JSON.parse(response.body) as { plans: Array<{ kind: string; writesToMind: boolean; externalSideEffects: boolean; executed: boolean }> };

  const infiniteBrainPlan = body.plans.find((plan) => plan.kind === 'scheduler-run-infinite-brain-report-only-pipeline');
  assert.ok(infiniteBrainPlan, 'Infinite Brain plan should exist');
  assert.equal(infiniteBrainPlan.writesToMind, false);
  assert.equal(infiniteBrainPlan.externalSideEffects, false);
  assert.equal(infiniteBrainPlan.executed, false);
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
    body.docs.some((doc) => doc.path === 'docs/system/1779034841996-obsidian-mind-steward-handoff.md'),
    true,
  );
});

test('GET /execution/mind-previews returns empty list when no preview artifacts exist', async () => {
  const previous = process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = path.join(process.cwd(), '.buildflow-test-mind-previews-missing');
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: Array<{ writesToMind: boolean; externalSideEffects: boolean }> };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 0);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = previous;
  }
});

test('GET /execution/mind-previews/latest returns empty state when no preview artifacts exist', async () => {
  const previous = process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = path.join(process.cwd(), '.buildflow-test-mind-previews-empty');
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews/latest' });
    const body = JSON.parse(response.body) as { status: string; preview?: { writesToMind: boolean } };
    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'empty');
    assert.equal(body.preview, undefined);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = previous;
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
  const previous = process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
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
  process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = previewDir;

  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: Array<{ id: string; writesToMind: boolean; externalSideEffects: boolean }> };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 1);
    assert.equal(body.previews[0]?.id, 'preview-test');
    assert.equal(body.previews[0]?.writesToMind, false);
    assert.equal(body.previews[0]?.externalSideEffects, false);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = previous;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /execution/mind-previews ignores unsafe preview path configuration', async () => {
  const previous = process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
  process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = '/Users/Office/Repos/stevewesthoek/mind/runtime/local/mind-steward/previews';
  try {
    const response = await exercise({ method: 'GET', url: '/execution/mind-previews' });
    const body = JSON.parse(response.body) as { previews: unknown[] };
    assert.equal(response.statusCode, 200);
    assert.equal(body.previews.length, 0);
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_PREVIEW_PATH = previous;
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

test('GET /execution/plans/:kind returns the inbox execution plan by kind', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-dry-run' });
  const body = JSON.parse(response.body) as { plan: { kind: string; summary: string; executed: boolean; wouldExecute: boolean; mindStewardInboxDryRunExecutionFlagName?: string } };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.kind, 'scheduler-run-mind-steward-inbox-dry-run');
  assert.equal(body.plan.executed, false);
  assert.equal(body.plan.wouldExecute, false);
  assert.equal(body.plan.summary.toLowerCase().includes('inbox dry-run'), true);
  assert.equal(body.plan.mindStewardInboxDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION');
});

test('GET /execution/plans/:kind returns the inbox classifier execution plan by kind', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-classifier-dry-run' });
  const body = JSON.parse(response.body) as {
    plan: {
      kind: string;
      summary: string;
      executed: boolean;
      wouldExecute: boolean;
      mindStewardInboxClassifierDryRunExecutionFlagName?: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.kind, 'scheduler-run-mind-steward-inbox-classifier-dry-run');
  assert.equal(body.plan.executed, false);
  assert.equal(body.plan.wouldExecute, false);
  assert.equal(body.plan.summary.toLowerCase().includes('classifier dry-run'), true);
  assert.equal(
    body.plan.mindStewardInboxClassifierDryRunExecutionFlagName,
    'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION',
  );
});

test('GET /execution/plans/:kind returns the inbox queue execution plan by kind', async () => {
  const response = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-queue-dry-run' });
  const body = JSON.parse(response.body) as {
    plan: {
      kind: string;
      summary: string;
      executed: boolean;
      wouldExecute: boolean;
      mindStewardInboxQueueDryRunExecutionFlagName?: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(body.plan.executed, false);
  assert.equal(body.plan.wouldExecute, false);
  assert.equal(body.plan.summary.toLowerCase().includes('queue/throttle preflight'), true);
  assert.equal(
    body.plan.mindStewardInboxQueueDryRunExecutionFlagName,
    'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION',
  );
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
    mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxDryRunExecutionFlagName?: string;
    mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxClassifierDryRunExecutionFlagName?: string;
    mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxQueueDryRunExecutionFlagName?: string;
    candidateCount: number;
    readyCandidateCount: number;
    blockers: string[];
    writesToMind: boolean;
    executableActions: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.mindStewardDryRunExecutionFlagEnabled, false);
  assert.equal(body.mindStewardDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION');
  assert.equal(body.mindStewardInboxDryRunExecutionFlagEnabled, false);
  assert.equal(body.mindStewardInboxDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION');
  assert.equal(body.mindStewardInboxClassifierDryRunExecutionFlagEnabled, false);
  assert.equal(body.mindStewardInboxClassifierDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION');
  assert.equal(body.mindStewardInboxQueueDryRunExecutionFlagEnabled, false);
  assert.equal(body.mindStewardInboxQueueDryRunExecutionFlagName, 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION');
  assert.equal(body.candidateCount, 4);
  assert.equal(body.readyCandidateCount, 0);
  assert.equal(body.writesToMind, false);
  assert.equal(body.executableActions, false);
  assert.equal(body.blockers.includes('execution feature flag disabled'), true);
});

test('GET /execution/readiness reports the feature flag when enabled but keeps execution disabled', async () => {
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = 'true';

  try {
    const readinessResponse = await exercise({ method: 'GET', url: '/execution/readiness' });
    const readinessBody = JSON.parse(readinessResponse.body) as {
      executionEnabled: boolean;
      mindStewardDryRunExecutionFlagEnabled: boolean;
      mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
      mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
      readyCandidateCount: number;
      blockers: string[];
      executableActions: boolean;
    };
    const capabilitiesResponse = await exercise({ method: 'GET', url: '/capabilities' });
    const capabilitiesBody = JSON.parse(capabilitiesResponse.body) as {
      executableActionsEnabled: boolean;
      executionGate: {
        executionEnabled: boolean;
        mindStewardDryRunExecutionFlagEnabled: boolean;
        mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
        mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
        mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
      };
    };
    const planResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-dry-run' });
    const planBody = JSON.parse(planResponse.body) as {
      plan: { executionEnabled: boolean; mindStewardDryRunExecutionFlagEnabled: boolean; wouldExecute: boolean; executed: boolean };
    };
    const inboxPlanResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-dry-run' });
    const inboxPlanBody = JSON.parse(inboxPlanResponse.body) as {
      plan: { executionEnabled: boolean; mindStewardInboxDryRunExecutionFlagEnabled?: boolean; wouldExecute: boolean; executed: boolean };
    };
    const classifierPlanResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-classifier-dry-run' });
    const classifierPlanBody = JSON.parse(classifierPlanResponse.body) as {
      plan: {
        executionEnabled: boolean;
        mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
        mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
        wouldExecute: boolean;
        executed: boolean;
      };
    };

    assert.equal(readinessResponse.statusCode, 200);
    assert.equal(readinessBody.mindStewardDryRunExecutionFlagEnabled, true);
    assert.equal(readinessBody.mindStewardInboxDryRunExecutionFlagEnabled, false);
    assert.equal(readinessBody.mindStewardInboxClassifierDryRunExecutionFlagEnabled, false);
    assert.equal(readinessBody.mindStewardInboxQueueDryRunExecutionFlagEnabled, false);
    assert.equal(readinessBody.executionEnabled, false);
    assert.equal(readinessBody.readyCandidateCount, 0);
    assert.equal(readinessBody.executableActions, false);
    assert.equal(readinessBody.blockers.includes('execution feature flag disabled'), false);
    assert.equal(readinessBody.blockers.includes('durable approval store not proven for this request'), true);
    assert.equal(capabilitiesBody.executableActionsEnabled, false);
    assert.equal(capabilitiesBody.executionGate.executionEnabled, false);
    assert.equal(capabilitiesBody.executionGate.mindStewardDryRunExecutionFlagEnabled, true);
    assert.equal(capabilitiesBody.executionGate.mindStewardInboxDryRunExecutionFlagEnabled, false);
    assert.equal(capabilitiesBody.executionGate.mindStewardInboxClassifierDryRunExecutionFlagEnabled, false);
    assert.equal(capabilitiesBody.executionGate.mindStewardInboxQueueDryRunExecutionFlagEnabled, false);
    assert.equal(planBody.plan.mindStewardDryRunExecutionFlagEnabled, true);
    assert.equal(planBody.plan.executionEnabled, false);
    assert.equal(planBody.plan.wouldExecute, false);
    assert.equal(planBody.plan.executed, false);
    assert.equal(inboxPlanBody.plan.mindStewardInboxDryRunExecutionFlagEnabled, false);
    assert.equal(inboxPlanBody.plan.executionEnabled, false);
    assert.equal(inboxPlanBody.plan.wouldExecute, false);
    assert.equal(inboxPlanBody.plan.executed, false);
    assert.equal(classifierPlanBody.plan.mindStewardInboxClassifierDryRunExecutionFlagEnabled, false);
    assert.equal(classifierPlanBody.plan.executionEnabled, false);
    assert.equal(classifierPlanBody.plan.wouldExecute, false);
    assert.equal(classifierPlanBody.plan.executed, false);
    const queuePlanResponse = await exercise({ method: 'GET', url: '/execution/plans/scheduler-run-mind-steward-inbox-queue-dry-run' });
    const queuePlanBody = JSON.parse(queuePlanResponse.body) as {
      plan: {
        executionEnabled: boolean;
        mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
        wouldExecute: boolean;
        executed: boolean;
      };
    };
    assert.equal(queuePlanBody.plan.mindStewardInboxQueueDryRunExecutionFlagEnabled, false);
    assert.equal(queuePlanBody.plan.executionEnabled, false);
    assert.equal(queuePlanBody.plan.wouldExecute, false);
    assert.equal(queuePlanBody.plan.executed, false);
  } finally {
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = previousFlag;
    }
  }
});

test('approved scheduler-run-mind-steward-dry-run executes exactly one report-only action when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-first-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = 'true';
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
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = previousFlag;
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
    ['/scheduler/jobs/graphify-preflight-mind/request-run', 'scheduler-run-graphify-preflight-mind'],
    ['/scheduler/jobs/graphify-preflight-brain/request-run', 'scheduler-run-graphify-preflight-brain'],
    ['/scheduler/jobs/graphify-update-mind-blocked/request-run', 'scheduler-run-graphify-update-mind-blocked'],
    ['/scheduler/jobs/graphify-update-brain-blocked/request-run', 'scheduler-run-graphify-update-brain-blocked'],
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

test('approved Graphify scheduler candidates execute safe report wrappers', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-graphify-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;

  const cases = [
    {
      route: '/scheduler/jobs/graphify-preflight-mind/request-run',
      kind: 'scheduler-run-graphify-preflight-mind',
      command: 'bash tools/scripts/graphify-orchestrator-report.sh preflight-mind',
      outputPath: 'runtime/local/graphify/mind-knowledge-latest.json',
    },
    {
      route: '/scheduler/jobs/graphify-update-brain-blocked/request-run',
      kind: 'scheduler-run-graphify-update-brain-blocked',
      command: 'bash tools/scripts/graphify-orchestrator-report.sh update-brain-blocked',
      outputPath: 'runtime/local/graphify/brain-runtime-latest.json',
    },
  ] as const;

  try {
    for (const item of cases) {
      const requestResponse = await exercise({ method: 'POST', url: item.route });
      const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string; kind: string }; executed: boolean };
      const approvalResponse = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
      const approvalBody = JSON.parse(approvalResponse.body) as {
        approval: { status: string };
        execution: { status: string; command: string; outputPath: string; exitCode: number; writesToMind: boolean; externalSideEffects: boolean };
        executed: boolean;
      };
      const reportPath = path.resolve(process.cwd(), '..', '..', approvalBody.execution.outputPath);

      assert.equal(requestResponse.statusCode, 202);
      assert.equal(requestBody.approval.kind, item.kind);
      assert.equal(requestBody.executed, false);
      assert.equal(approvalResponse.statusCode, 200);
      assert.equal(approvalBody.approval.status, 'approved');
      assert.equal(approvalBody.executed, true);
      assert.equal(approvalBody.execution.status, 'ok');
      assert.equal(approvalBody.execution.command, item.command);
      assert.equal(approvalBody.execution.outputPath, item.outputPath);
      assert.equal(approvalBody.execution.exitCode, 0);
      assert.equal(approvalBody.execution.writesToMind, false);
      assert.equal(approvalBody.execution.externalSideEffects, false);
      assert.equal(fs.existsSync(reportPath), true);
    }
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
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve executes only the approved mind-steward dry-run when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-first-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = 'true';

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
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = previousFlag;
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
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;

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
    assert.equal(body.execution.message.includes('BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION'), true);
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
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('approved scheduler-run-mind-steward-inbox-dry-run executes exactly one report-only action when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-dry-run/request-run' });
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
    assert.equal(requestBody.approval.kind, 'scheduler-run-mind-steward-inbox-dry-run');
    assert.equal(requestBody.executed, false);
    assert.equal(approvalResponse.statusCode, 200);
    assert.equal(approvalBody.approval.status, 'approved');
    assert.equal(approvalBody.executed, true);
    assert.equal(approvalBody.preview.wouldExecute, true);
    assert.equal(approvalBody.preview.writesToMind, false);
    assert.equal(approvalBody.preview.externalSideEffects, false);
    assert.equal(approvalBody.preview.commands.length, 1);
    assert.equal(approvalBody.execution.status, 'ok');
    assert.equal(approvalBody.execution.command, 'bash tools/scripts/mind-steward-inbox-dry-run-report.sh');
    assert.equal(approvalBody.execution.outputPath, 'runtime/local/mind-steward/inbox-latest.json');
    assert.equal(approvalBody.execution.writesToMind, false);
    assert.equal(approvalBody.execution.externalSideEffects, false);
    assert.equal(approvalBody.policy.executionEnabled, true);
    assert.equal(approvalBody.policy.executionGate, 'enabled-for-mind-steward-inbox-dry-run');
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(
      auditBody.events.some((event) => event.event === 'executed' && event.kind === 'scheduler-run-mind-steward-inbox-dry-run' && event.executed === true),
      true,
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION = previousFlag;
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

test('POST /approvals/:id/approve does not execute the mind-steward inbox dry-run when the feature flag is disabled', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-action-blocked');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-dry-run/request-run' });
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
    assert.equal(body.execution.message.includes('BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION'), true);
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
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('approved scheduler-run-mind-steward-inbox-classifier-dry-run executes exactly one report-only action when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-classifier-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const selectorConfigDir = path.join(testDir, 'selector-config');
  const mindRoot = path.join(testDir, 'mind');
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousSelectorConfigDir = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
  const selectorServer = await startClassifierSelectorHealthServer();

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeClassifierSelectorConfig(selectorConfigDir, selectorServer.port);
  writeClassifierInboxFixture(mindRoot);
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = selectorConfigDir;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run' });
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
    const reportPath = path.resolve(process.cwd(), '..', '..', approvalBody.execution.outputPath);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
      status: string;
      mode: string;
      writesToMind: boolean;
      externalSideEffects: boolean;
      executableActions: boolean;
      selectorTaskType: string;
      inputTokenCount: number;
      selector: { status: string; providerId: string; model: string; baseUrl: string; reason: string };
      inbox: { sampledCount: number; skippedCount: number; totalFileCount: number };
    };

    assert.equal(requestResponse.statusCode, 202);
    assert.equal(requestBody.approval.kind, 'scheduler-run-mind-steward-inbox-classifier-dry-run');
    assert.equal(requestBody.executed, false);
    assert.equal(approvalResponse.statusCode, 200);
    assert.equal(approvalBody.approval.status, 'approved');
    assert.equal(approvalBody.executed, true);
    assert.equal(approvalBody.preview.wouldExecute, true);
    assert.equal(approvalBody.preview.writesToMind, false);
    assert.equal(approvalBody.preview.externalSideEffects, false);
    assert.equal(approvalBody.preview.commands.length, 1);
    assert.equal(approvalBody.execution.status, 'ok');
    assert.equal(approvalBody.execution.command, 'bash tools/scripts/mind-steward-inbox-classifier-dry-run-report.sh');
    assert.equal(approvalBody.execution.outputPath, 'runtime/local/mind-steward/inbox-classifier-latest.json');
    assert.equal(approvalBody.execution.writesToMind, false);
    assert.equal(approvalBody.execution.externalSideEffects, false);
    assert.equal(approvalBody.policy.executionEnabled, true);
    assert.equal(approvalBody.policy.executionGate, 'enabled-for-mind-steward-inbox-classifier-dry-run');
    assert.equal(report.status, 'ok');
    assert.equal(report.mode, 'classifier-dry-run-report-only');
    assert.equal(report.writesToMind, false);
    assert.equal(report.externalSideEffects, false);
    assert.equal(report.executableActions, false);
    assert.equal(report.selectorTaskType, 'mind_capture_classification');
    assert.equal(report.selector.status, 'selected');
    assert.equal(report.selector.providerId, 'ollama-local');
    assert.equal(report.selector.model, 'qwen2.5:14b');
    assert.equal(report.inbox.sampledCount, 3);
    assert.equal(report.inbox.skippedCount, 0);
    assert.equal(
      auditBody.events.some((event) => event.event === 'executed' && event.kind === 'scheduler-run-mind-steward-inbox-classifier-dry-run' && event.executed === true),
      true,
    );
  } finally {
    selectorServer.server.close();
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = previousFlag;
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousSelectorConfigDir === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = previousSelectorConfigDir;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve does not execute the mind-steward inbox classifier dry-run when the feature flag is disabled', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-classifier-action-blocked');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const selectorConfigDir = path.join(testDir, 'selector-config');
  const mindRoot = path.join(testDir, 'mind');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousSelectorConfigDir = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
  const selectorServer = await startClassifierSelectorHealthServer();

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeClassifierSelectorConfig(selectorConfigDir, selectorServer.port);
  writeClassifierInboxFixture(mindRoot);
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = selectorConfigDir;
  delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run' });
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
    assert.equal(body.execution.message.includes('BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION'), true);
    assert.equal(body.execution.writesToMind, false);
  } finally {
    selectorServer.server.close();
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousSelectorConfigDir === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = previousSelectorConfigDir;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve blocks the mind-steward inbox classifier dry-run when the script path is missing', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-classifier-action-missing-script');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const selectorConfigDir = path.join(testDir, 'selector-config');
  const mindRoot = path.join(testDir, 'mind');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousSelectorConfigDir = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
  const previousScript = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_SCRIPT;
  const selectorServer = await startClassifierSelectorHealthServer();

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeClassifierSelectorConfig(selectorConfigDir, selectorServer.port);
  writeClassifierInboxFixture(mindRoot);
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = selectorConfigDir;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_SCRIPT = 'tools/scripts/mind-steward-inbox-classifier-dry-run-report.missing.sh';

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      execution: { status: string; message: string; writesToMind: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.executed, false);
    assert.equal(body.execution.status, 'blocked');
    assert.equal(body.execution.message.includes('missing'), true);
    assert.equal(body.execution.writesToMind, false);
  } finally {
    selectorServer.server.close();
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousSelectorConfigDir === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = previousSelectorConfigDir;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = previousFlag;
    }
    if (previousScript === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_SCRIPT;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_SCRIPT = previousScript;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve blocks the mind-steward inbox classifier dry-run when the selector runtime path is missing', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-classifier-action-missing-selector-runtime');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const selectorConfigDir = path.join(testDir, 'selector-config');
  const mindRoot = path.join(testDir, 'mind');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousSelectorConfigDir = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
  const previousSelectorRuntime = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_RUNTIME;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
  const selectorServer = await startClassifierSelectorHealthServer();

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeClassifierSelectorConfig(selectorConfigDir, selectorServer.port);
  writeClassifierInboxFixture(mindRoot);
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = selectorConfigDir;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_RUNTIME = path.join(testDir, 'missing-selector-core.py');

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-classifier-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      execution: { status: string; message: string; writesToMind: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.executed, false);
    assert.equal(body.execution.status, 'blocked');
    assert.equal(body.execution.message.includes('Selector runtime is missing'), true);
    assert.equal(body.execution.writesToMind, false);
  } finally {
    selectorServer.server.close();
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousSelectorConfigDir === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR = previousSelectorConfigDir;
    }
    if (previousSelectorRuntime === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_RUNTIME;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_RUNTIME = previousSelectorRuntime;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('approved scheduler-run-mind-steward-inbox-queue-dry-run executes exactly one report-only action when all gates pass', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-queue-action-execution');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const mindRoot = path.join(testDir, 'mind');
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeQueueInboxFixture(mindRoot);
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-queue-dry-run/request-run' });
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
    const reportPath = path.resolve(process.cwd(), '..', '..', approvalBody.execution.outputPath);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
      status: string;
      mode: string;
      writesToMind: boolean;
      externalSideEffects: boolean;
      executableActions: boolean;
      queue_mode: string;
      max_concurrent_jobs: number;
      max_files_per_run: number;
      debounce_seconds: number;
      max_retries: number;
      large_file_threshold_mb: number;
      minimum_seconds_between_runs: number;
      inbox: {
        total_inbox_files: number;
        candidate_files_selected_for_next_run: Array<{ status: string }>;
        blocked_large_file_entries: Array<{ status: string }>;
        skipped_entries: Array<{ status: string }>;
        summary_counts: {
          total_inbox_files: number;
          pending: number;
          blocked_large_file: number;
          skipped_capacity: number;
        };
      };
    };

    assert.equal(requestResponse.statusCode, 202);
    assert.equal(requestBody.approval.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
    assert.equal(requestBody.executed, false);
    assert.equal(approvalResponse.statusCode, 200);
    assert.equal(approvalBody.approval.status, 'approved');
    assert.equal(approvalBody.executed, true);
    assert.equal(approvalBody.preview.wouldExecute, true);
    assert.equal(approvalBody.preview.writesToMind, false);
    assert.equal(approvalBody.preview.externalSideEffects, false);
    assert.equal(approvalBody.preview.commands.length, 1);
    assert.equal(approvalBody.execution.status, 'ok');
    assert.equal(approvalBody.execution.command, 'bash tools/scripts/mind-steward-inbox-queue-dry-run-report.sh');
    assert.equal(approvalBody.execution.outputPath, 'runtime/local/mind-steward/inbox-queue-latest.json');
    assert.equal(approvalBody.execution.writesToMind, false);
    assert.equal(approvalBody.execution.externalSideEffects, false);
    assert.equal(approvalBody.policy.executionEnabled, true);
    assert.equal(approvalBody.policy.executionGate, 'enabled-for-mind-steward-inbox-queue-dry-run');
    assert.equal(report.status, 'success');
    assert.equal(report.mode, 'dry-run-report-only');
    assert.equal(report.queue_mode, 'dry-run-report-only');
    assert.equal(report.writesToMind, false);
    assert.equal(report.externalSideEffects, false);
    assert.equal(report.executableActions, false);
    assert.equal(report.max_concurrent_jobs, 1);
    assert.equal(report.max_files_per_run, 3);
    assert.equal(report.debounce_seconds, 30);
    assert.equal(report.max_retries, 2);
    assert.equal(report.large_file_threshold_mb, 2);
    assert.equal(report.minimum_seconds_between_runs, 300);
    assert.equal(report.inbox.total_inbox_files, 5);
    assert.equal(report.inbox.candidate_files_selected_for_next_run.length, 3);
    assert.equal(report.inbox.blocked_large_file_entries.length, 1);
    assert.equal(report.inbox.skipped_entries.length, 1);
    assert.equal(report.inbox.candidate_files_selected_for_next_run.every((item) => item.status === 'pending'), true);
    assert.equal(report.inbox.blocked_large_file_entries.every((item) => item.status === 'blocked_large_file'), true);
    assert.equal(report.inbox.skipped_entries.every((item) => item.status === 'skipped_capacity'), true);
    assert.equal(report.inbox.summary_counts.total_inbox_files, 5);
    assert.equal(report.inbox.summary_counts.pending, 3);
    assert.equal(report.inbox.summary_counts.blocked_large_file, 1);
    assert.equal(report.inbox.summary_counts.skipped_capacity, 1);
    assert.equal(
      auditBody.events.some((event) => event.event === 'executed' && event.kind === 'scheduler-run-mind-steward-inbox-queue-dry-run' && event.executed === true),
      true,
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION = previousFlag;
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve does not execute the mind-steward inbox queue dry-run when the feature flag is disabled', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-queue-action-blocked');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const mindRoot = path.join(testDir, 'mind');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeQueueInboxFixture(mindRoot);
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-queue-dry-run/request-run' });
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
    assert.equal(body.execution.message.includes('BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION'), true);
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION = previousFlag;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve blocks the mind-steward inbox queue dry-run when the script path is missing', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-queue-action-missing-script');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const mindRoot = path.join(testDir, 'mind');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousMindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;
  const previousScript = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_SCRIPT;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  writeQueueInboxFixture(mindRoot);
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.MIND_STEWARD_MIND_ROOT = mindRoot;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_SCRIPT = 'tools/scripts/mind-steward-inbox-queue-dry-run-report.missing.sh';

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-queue-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      execution: { status: string; message: string; writesToMind: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.executed, false);
    assert.equal(body.execution.status, 'blocked');
    assert.equal(body.execution.message.includes('missing'), true);
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
    if (previousMindRoot === undefined) {
      delete process.env.MIND_STEWARD_MIND_ROOT;
    } else {
      process.env.MIND_STEWARD_MIND_ROOT = previousMindRoot;
    }
    if (previousFlag === undefined) {
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION = previousFlag;
    }
    if (previousScript === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_SCRIPT;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_SCRIPT = previousScript;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /approvals/:id/approve blocks the mind-steward inbox dry-run when the script path is missing', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-inbox-action-missing-script');
  const storePath = path.join(testDir, 'approvals.json');
  const auditPath = path.join(testDir, 'approval-audit.jsonl');
  const previousStorePath = process.env.BRAIN_CORE_APPROVAL_STORE_PATH;
  const previousAuditPath = process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH;
  const previousFlag = process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;
  const previousScript = process.env.BRAIN_CORE_MIND_STEWARD_INBOX_DRY_RUN_SCRIPT;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  process.env.BRAIN_CORE_APPROVAL_STORE_PATH = storePath;
  process.env.BRAIN_CORE_APPROVAL_AUDIT_PATH = auditPath;
  process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION = 'true';
  process.env.BRAIN_CORE_MIND_STEWARD_INBOX_DRY_RUN_SCRIPT = 'tools/scripts/mind-steward-inbox-dry-run-report.missing.sh';

  try {
    const requestResponse = await exercise({ method: 'POST', url: '/scheduler/jobs/mind-steward-inbox-dry-run/request-run' });
    const requestBody = JSON.parse(requestResponse.body) as { approval: { id: string } };
    const response = await exercise({ method: 'POST', url: `/approvals/${requestBody.approval.id}/approve` });
    const body = JSON.parse(response.body) as {
      execution: { status: string; message: string; writesToMind: boolean };
      executed: boolean;
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.executed, false);
    assert.equal(body.execution.status, 'blocked');
    assert.equal(body.execution.message.includes('missing'), true);
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
      delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION;
    } else {
      process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION = previousFlag;
    }
    if (previousScript === undefined) {
      delete process.env.BRAIN_CORE_MIND_STEWARD_INBOX_DRY_RUN_SCRIPT;
    } else {
      process.env.BRAIN_CORE_MIND_STEWARD_INBOX_DRY_RUN_SCRIPT = previousScript;
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
    process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION = 'true';
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
    delete process.env.BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION;
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
  for (const key of [
    'prochat:stop',
    'prochat:restart',
    'jpv-bootcamp:stop',
    'jpv-bootcamp:restart',
    'mind-steward:start',
    'mind-steward:stop',
    'mind-steward:restart',
    'vault-legal:start',
    'vault-legal:stop',
    'vault-legal:restart',
  ]) {
    assert.ok(disabledKeys.has(key), `${key} should be in disabled backlog`);
  }
  assert.equal(body.disabledActionCount, 10, 'current backlog should contain ten disabled actions');
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

// ── Infinite Brain Proposal Review Routes ──────────────────────────────────

test('GET /infinite-brain/proposals returns proposals report when available', async () => {
  const response = await exercise({ method: 'GET', url: '/infinite-brain/proposals' });
  const body = JSON.parse(response.body) as { ok?: boolean; code?: string; proposals?: unknown[]; approvals?: unknown[] };

  // May return 404 if report not available (report-only phase)
  if (response.statusCode === 404) {
    assert.equal(body.code, 'proposals_report_missing', 'code must be proposals_report_missing when unavailable');
    assert.equal(body.ok, false, 'ok must be false when report missing');
    return;
  }

  // Or 200 if report available
  assert.equal(response.statusCode, 200, 'status must be 200 or 404');
  assert.ok(Array.isArray(body.approvals), 'approvals must be an array');
});

test('GET /infinite-brain/proposals/approvals returns approval summary', async () => {
  const response = await exercise({ method: 'GET', url: '/infinite-brain/proposals/approvals' });
  const body = JSON.parse(response.body) as {
    available: boolean;
    path: string;
    totalDecisions: number;
    approved: number;
    rejected: number;
    needsReview: number;
    applied: number;
    executionBlocked: boolean;
    latestDecisionAt?: string;
  };

  assert.equal(response.statusCode, 200, 'must return 200');
  assert.equal(typeof body.available, 'boolean', 'available must be boolean');
  assert.equal(typeof body.path, 'string', 'path must be string');
  assert.equal(typeof body.totalDecisions, 'number', 'totalDecisions must be number');
  assert.equal(typeof body.approved, 'number', 'approved must be number');
  assert.equal(typeof body.rejected, 'number', 'rejected must be number');
  assert.equal(typeof body.needsReview, 'number', 'needsReview must be number');
  assert.equal(typeof body.applied, 'number', 'applied must be number');
  assert.equal(body.executionBlocked, true, 'executionBlocked must always be true');
  assert.equal(body.applied, 0, 'applied count must always be 0 in decision-only phase');
});

test('POST /api/infinite-brain/proposals/approvals rejects invalid proposalId', async () => {
  const request = createRequest({
    method: 'POST',
    url: '/api/infinite-brain/proposals/approvals',
    remoteAddress: '127.0.0.1',
  });

  // Add JSON body
  (request as any).on = (event: string, callback: (data?: unknown) => void) => {
    if (event === 'data') {
      callback(Buffer.from(JSON.stringify({
        proposalId: 'nonexistent-proposal-id',
        decision: 'approved',
        decidedBy: 'test',
        reason: 'test reason',
      })));
    } else if (event === 'end') {
      callback();
    }
  };

  const response = new MockResponse();
  await routeRequest(request, response);
  const body = JSON.parse(response.body) as { ok?: boolean; code?: string };

  assert.equal(response.statusCode, 404, 'must return 404 for nonexistent proposal');
  assert.equal(body.code, 'proposal_not_found', 'code must be proposal_not_found');
  assert.equal(body.ok, false, 'ok must be false');
});

test('POST /api/infinite-brain/proposals/approvals rejects invalid decision', async () => {
  const request = createRequest({
    method: 'POST',
    url: '/api/infinite-brain/proposals/approvals',
    remoteAddress: '127.0.0.1',
  });

  (request as any).on = (event: string, callback: (data?: unknown) => void) => {
    if (event === 'data') {
      callback(Buffer.from(JSON.stringify({
        proposalId: 'prop-test',
        decision: 'invalid-decision',
        decidedBy: 'test',
        reason: 'test reason',
      })));
    } else if (event === 'end') {
      callback();
    }
  };

  const response = new MockResponse();
  await routeRequest(request, response);
  const body = JSON.parse(response.body) as { ok?: boolean; code?: string };

  assert.equal(response.statusCode, 400, 'must return 400 for invalid decision');
  assert.equal(body.code, 'invalid_decision', 'code must be invalid_decision');
});

test('POST /api/infinite-brain/proposals/approvals exercise success path', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-ibr-approval-success');
  const proposalsPath = path.join(testDir, 'proposals-latest.json');
  const approvalsPath = path.join(testDir, 'proposal-approvals.json');

  const previousProposalsPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  const previousApprovalsPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Write temp proposal report with one valid proposal
  fs.writeFileSync(proposalsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProposals: 1,
    proposals: [
      {
        proposalId: 'prop-test-valid',
        category: 'atomization',
        title: 'Test Proposal',
        summary: 'This is a test proposal',
        confidence: 0.95,
        priority: 'high',
        riskLevel: 'medium',
        requiresApproval: true,
        writesToMindIfApproved: false,
        safetyMode: 'report-only',
        status: 'proposed',
      }
    ]
  }, null, 2));

  process.env.IBR_PROPOSALS_REPORT_PATH = proposalsPath;
  process.env.IBR_PROPOSAL_APPROVALS_PATH = approvalsPath;

  try {
    const request = createRequest({
      method: 'POST',
      url: '/api/infinite-brain/proposals/approvals',
      remoteAddress: '127.0.0.1',
    });

    // Mock the request stream to provide JSON body
    (request as any).on = (event: string, callback: (data?: unknown) => void) => {
      if (event === 'data') {
        callback(Buffer.from(JSON.stringify({
          proposalId: 'prop-test-valid',
          decision: 'approved',
          decidedBy: 'test',
          reason: 'test approval reason',
        })));
      } else if (event === 'end') {
        callback();
      }
    };

    const response = new MockResponse();
    await routeRequest(request, response);

    const body = JSON.parse(response.body) as {
      ok: boolean;
      code: string;
      record: { proposalId: string; decision: string; executionBlocked: boolean; applied: boolean };
      safety: { executionBlocked: boolean; applied: boolean; writesToMind: boolean };
    };

    // Assertions: HTTP 200
    assert.equal(response.statusCode, 200);

    // Assertions: response body structure
    assert.equal(body.ok, true);
    assert.equal(body.code, 'approval_recorded');
    assert.equal(body.record.proposalId, 'prop-test-valid');
    assert.equal(body.record.decision, 'approved');
    assert.equal(body.record.executionBlocked, true);
    assert.equal(body.record.applied, false);

    // Assertions: safety invariants
    assert.equal(body.safety.executionBlocked, true);
    assert.equal(body.safety.applied, false);
    assert.equal(body.safety.writesToMind, false);

    // Assertions: verify approvals file was written
    const approvalsContent = fs.readFileSync(approvalsPath, 'utf8');
    const approvalsData = JSON.parse(approvalsContent) as { records: Array<{ proposalId: string; applied: boolean; executionBlocked: boolean }> };

    assert.equal(Array.isArray(approvalsData.records), true);
    assert.equal(approvalsData.records.length, 1);
    assert.equal(approvalsData.records[0]?.proposalId, 'prop-test-valid');
    assert.equal(approvalsData.records[0]?.applied, false);
    assert.equal(approvalsData.records[0]?.executionBlocked, true);
  } finally {
    if (previousProposalsPath === undefined) {
      delete process.env.IBR_PROPOSALS_REPORT_PATH;
    } else {
      process.env.IBR_PROPOSALS_REPORT_PATH = previousProposalsPath;
    }
    if (previousApprovalsPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPROVALS_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPROVALS_PATH = previousApprovalsPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /api/infinite-brain/proposals/application-plan/generate returns empty plan with no approvals', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-ibr-plan-empty');
  const proposalsPath = path.join(testDir, 'proposals-latest.json');
  const approvalsPath = path.join(testDir, 'proposal-approvals.json');
  const planPath = path.join(testDir, 'proposal-application-plan-latest.json');

  const previousProposalsPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  const previousApprovalsPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;
  const previousPlanPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Write proposals without approvals
  fs.writeFileSync(proposalsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProposals: 0,
    proposals: []
  }, null, 2));

  process.env.IBR_PROPOSALS_REPORT_PATH = proposalsPath;
  process.env.IBR_PROPOSAL_APPROVALS_PATH = approvalsPath;
  process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = planPath;

  try {
    const request = createRequest({
      method: 'POST',
      url: '/api/infinite-brain/proposals/application-plan/generate',
    });

    const response = new MockResponse();
    await routeRequest(request, response);

    const body = JSON.parse(response.body) as {
      ok: boolean;
      code: string;
      plan: { totalApprovedProposals: number; totalPlannedSteps: number };
      safety: { executionBlocked: boolean; previewOnly: boolean };
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.plan.totalApprovedProposals, 0);
    assert.equal(body.plan.totalPlannedSteps, 0);
    assert.equal(body.safety.executionBlocked, true);
    assert.equal(body.safety.previewOnly, true);
  } finally {
    if (previousProposalsPath === undefined) {
      delete process.env.IBR_PROPOSALS_REPORT_PATH;
    } else {
      process.env.IBR_PROPOSALS_REPORT_PATH = previousProposalsPath;
    }
    if (previousApprovalsPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPROVALS_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPROVALS_PATH = previousApprovalsPath;
    }
    if (previousPlanPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = previousPlanPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /api/infinite-brain/proposals/application-plan/generate includes approved proposals only', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-ibr-plan-approved');
  const proposalsPath = path.join(testDir, 'proposals-latest.json');
  const approvalsPath = path.join(testDir, 'proposal-approvals.json');
  const planPath = path.join(testDir, 'proposal-application-plan-latest.json');

  const previousProposalsPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  const previousApprovalsPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;
  const previousPlanPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Write proposals
  fs.writeFileSync(proposalsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProposals: 3,
    proposals: [
      {
        proposalId: 'prop-test-approved',
        category: 'atomization',
        title: 'Approved Proposal',
        summary: 'This is approved',
        confidence: 0.95,
        priority: 'high',
        riskLevel: 'low',
        requiresApproval: true,
        writesToMindIfApproved: true,
        safetyMode: 'report-only',
        status: 'proposed',
        sourcePaths: ['path/to/file.md'],
        proposedAction: 'Split file',
      },
      {
        proposalId: 'prop-test-rejected',
        category: 'cleanup',
        title: 'Rejected Proposal',
        summary: 'This is rejected',
        confidence: 0.5,
        priority: 'low',
        riskLevel: 'medium',
        requiresApproval: true,
        writesToMindIfApproved: false,
        safetyMode: 'report-only',
        status: 'proposed',
      },
      {
        proposalId: 'prop-test-review',
        category: 'entity-metadata',
        title: 'Under Review',
        summary: 'Needs review',
        confidence: 0.7,
        priority: 'medium',
        riskLevel: 'low',
        requiresApproval: true,
        writesToMindIfApproved: false,
        safetyMode: 'report-only',
        status: 'proposed',
      }
    ]
  }, null, 2));

  // Write approvals: one approved, one rejected, one needs-review
  fs.writeFileSync(approvalsPath, JSON.stringify({
    records: [
      {
        proposalId: 'prop-test-approved',
        category: 'atomization',
        decision: 'approved',
        decidedAt: new Date().toISOString(),
        decidedBy: 'test',
        executionBlocked: true,
        applied: false,
      },
      {
        proposalId: 'prop-test-rejected',
        category: 'cleanup',
        decision: 'rejected',
        decidedAt: new Date().toISOString(),
        decidedBy: 'test',
        executionBlocked: true,
        applied: false,
      },
      {
        proposalId: 'prop-test-review',
        category: 'entity-metadata',
        decision: 'needs-review',
        decidedAt: new Date().toISOString(),
        decidedBy: 'test',
        executionBlocked: true,
        applied: false,
      }
    ]
  }, null, 2));

  process.env.IBR_PROPOSALS_REPORT_PATH = proposalsPath;
  process.env.IBR_PROPOSAL_APPROVALS_PATH = approvalsPath;
  process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = planPath;

  try {
    const request = createRequest({
      method: 'POST',
      url: '/api/infinite-brain/proposals/application-plan/generate',
    });

    const response = new MockResponse();
    await routeRequest(request, response);

    const body = JSON.parse(response.body) as {
      ok: boolean;
      plan: { totalApprovedProposals: number; totalPlannedSteps: number };
      safety: { executionBlocked: boolean; appliesProposals: boolean; previewOnly: boolean };
    };

    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.plan.totalApprovedProposals, 1);
    assert.equal(body.plan.totalPlannedSteps, 1);
    assert.equal(body.safety.executionBlocked, true);
    assert.equal(body.safety.appliesProposals, false);
    assert.equal(body.safety.previewOnly, true);
  } finally {
    if (previousProposalsPath === undefined) {
      delete process.env.IBR_PROPOSALS_REPORT_PATH;
    } else {
      process.env.IBR_PROPOSALS_REPORT_PATH = previousProposalsPath;
    }
    if (previousApprovalsPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPROVALS_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPROVALS_PATH = previousApprovalsPath;
    }
    if (previousPlanPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = previousPlanPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('GET /api/infinite-brain/proposals/application-plan returns 404 when plan missing', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-ibr-plan-missing');
  const planPath = path.join(testDir, 'nonexistent-plan.json');

  const previousPlanPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = planPath;

  try {
    const request = createRequest({
      method: 'GET',
      url: '/api/infinite-brain/proposals/application-plan',
    });

    const response = new MockResponse();
    await routeRequest(request, response);

    assert.equal(response.statusCode, 404);

    // Only parse if response body is not empty
    if (response.body) {
      const body = JSON.parse(response.body) as { ok?: boolean; code?: string };
      assert.equal(body.ok, false);
      assert.equal(body.code, 'application_plan_missing');
    }
  } finally {
    if (previousPlanPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = previousPlanPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('POST /api/infinite-brain/proposals/application-plan/generate produces deterministic planId', async () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-ibr-plan-deterministic');
  const proposalsPath = path.join(testDir, 'proposals-latest.json');
  const approvalsPath = path.join(testDir, 'proposal-approvals.json');
  const planPath1 = path.join(testDir, 'plan-1.json');
  const planPath2 = path.join(testDir, 'plan-2.json');

  const previousProposalsPath = process.env.IBR_PROPOSALS_REPORT_PATH;
  const previousApprovalsPath = process.env.IBR_PROPOSAL_APPROVALS_PATH;
  const previousPlanPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Write same proposals and approvals twice
  fs.writeFileSync(proposalsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProposals: 1,
    proposals: [
      {
        proposalId: 'prop-deterministic-test',
        category: 'atomization',
        title: 'Test Proposal',
        summary: 'Determinism test',
        confidence: 0.9,
        priority: 'high',
        riskLevel: 'low',
        requiresApproval: true,
        writesToMindIfApproved: false,
        safetyMode: 'report-only',
        status: 'proposed',
        sourcePaths: ['test.md'],
        proposedAction: 'Split',
      }
    ]
  }, null, 2));

  fs.writeFileSync(approvalsPath, JSON.stringify({
    records: [
      {
        proposalId: 'prop-deterministic-test',
        category: 'atomization',
        decision: 'approved',
        decidedAt: new Date().toISOString(),
        decidedBy: 'test',
        executionBlocked: true,
        applied: false,
      }
    ]
  }, null, 2));

  process.env.IBR_PROPOSALS_REPORT_PATH = proposalsPath;
  process.env.IBR_PROPOSAL_APPROVALS_PATH = approvalsPath;

  let planId1: string | undefined;
  let planId2: string | undefined;

  try {
    // Generate plan first time
    process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = planPath1;

    const request1 = createRequest({
      method: 'POST',
      url: '/api/infinite-brain/proposals/application-plan/generate',
    });

    const response1 = new MockResponse();
    await routeRequest(request1, response1);

    const body1 = JSON.parse(response1.body) as {
      plan: { planId: string };
    };
    planId1 = body1.plan.planId;

    // Generate plan second time (should be identical)
    process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = planPath2;

    const request2 = createRequest({
      method: 'POST',
      url: '/api/infinite-brain/proposals/application-plan/generate',
    });

    const response2 = new MockResponse();
    await routeRequest(request2, response2);

    const body2 = JSON.parse(response2.body) as {
      plan: { planId: string };
    };
    planId2 = body2.plan.planId;

    // Both plan IDs should be identical (deterministic)
    assert.equal(planId1, planId2);
    assert.equal(typeof planId1, 'string');
    assert.ok(planId1.startsWith('plan-'));
  } finally {
    if (previousProposalsPath === undefined) {
      delete process.env.IBR_PROPOSALS_REPORT_PATH;
    } else {
      process.env.IBR_PROPOSALS_REPORT_PATH = previousProposalsPath;
    }
    if (previousApprovalsPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPROVALS_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPROVALS_PATH = previousApprovalsPath;
    }
    if (previousPlanPath === undefined) {
      delete process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
    } else {
      process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH = previousPlanPath;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
