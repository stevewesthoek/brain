import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { routeRequest } from '../api/routes.js';
import {
  planProjectExecution,
  savePlan,
  retrievePlan,
  listPlans,
} from '../adapters/agent-orchestrator-planner.js';
import {
  OrchestrationExecutor,
  topologicalSort,
  dependenciesComplete,
  recordApprovalDecision,
  getApprovalDecision,
} from '../adapters/agent-orchestrator-executor.js';
import type {
  AgentOrchestratorTask,
  AgentOrchestratorPlan,
} from '../types/api.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

// Build a minimal POST request that fires 'data' then 'end' events for readJsonBody
function createPostRequest(url: string, body: unknown): IncomingMessage {
  const payload = JSON.stringify(body);
  const listeners: Record<string, Array<(arg: unknown) => void>> = {};

  const request = {
    socket: { remoteAddress: '127.0.0.1' },
    method: 'POST',
    url,
    on(event: string, cb: (arg: unknown) => void) {
      listeners[event] = listeners[event] ?? [];
      listeners[event]!.push(cb);

      if (event === 'data') {
        // Fire synchronously-ish so data is available
        Promise.resolve().then(() => cb(payload));
      }
      if (event === 'end') {
        // Fire after data
        Promise.resolve().then(() => Promise.resolve().then(() => cb(undefined)));
      }
      return request;
    },
  } as unknown as IncomingMessage;

  return request;
}

function createGetRequest(url: string): IncomingMessage {
  return {
    socket: { remoteAddress: '127.0.0.1' },
    method: 'GET',
    url,
  } as unknown as IncomingMessage;
}

async function exerciseGet(url: string): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createGetRequest(url), response);
  return response;
}

async function exercisePost(url: string, body?: unknown): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createPostRequest(url, body ?? {}), response);
  return response;
}

const PLANS_DIR = path.resolve(
  process.cwd(),
  '../../../../../.local/video-orchestrator/state/agent-orchestrator-plans',
);

const APPROVALS_DIR = path.resolve(
  process.cwd(),
  '../../../../../.local/video-orchestrator/state/agent-orchestrator-approvals',
);

function cleanupDirs(): void {
  try { fs.rmSync(PLANS_DIR, { recursive: true, force: true }); } catch { /* ok */ }
  try { fs.rmSync(APPROVALS_DIR, { recursive: true, force: true }); } catch { /* ok */ }
}

// ─── Plan decomposition ───────────────────────────────────────────────────────

test('planProjectExecution decomposes a simple goal into tasks', () => {
  cleanupDirs();
  const plan = planProjectExecution('analyze the codebase', '');
  cleanupDirs();

  assert.equal(plan.goal, 'analyze the codebase');
  assert.equal(plan.status, 'planning');
  assert.equal(plan.id.startsWith('plan-'), true);
  assert.equal(plan.tasks.length >= 2, true);
  assert.equal(Array.isArray(plan.approvalGates), true);
  assert.equal(typeof plan.createdAt, 'string');
});

test('planProjectExecution produces ai_analysis and ai_generation tasks for generic goal', () => {
  cleanupDirs();
  const plan = planProjectExecution('research AI trends', '');
  cleanupDirs();

  const types = plan.tasks.map((t) => t.type);
  assert.equal(types.includes('ai_analysis'), true);
  assert.equal(types.includes('ai_generation'), true);
});

test('planProjectExecution adds code_change tasks for code goal', () => {
  cleanupDirs();
  const plan = planProjectExecution('implement a new feature', 'TypeScript codebase');
  cleanupDirs();

  const types = plan.tasks.map((t) => t.type);
  assert.equal(types.includes('code_change'), true);
  assert.equal(types.some((t) => t === 'approval_gate'), true);
  assert.equal(plan.approvalGates.length > 0, true);
});

test('planProjectExecution adds approval_gate for publish goal', () => {
  cleanupDirs();
  const plan = planProjectExecution('publish to production', '');
  cleanupDirs();

  const gateTask = plan.tasks.find((t) => t.type === 'approval_gate');
  assert.equal(gateTask !== undefined, true);
  assert.equal(plan.approvalGates.includes(gateTask!.id), true);
});

test('planProjectExecution adds file_operation task for file goal', () => {
  cleanupDirs();
  const plan = planProjectExecution('write output to file', '');
  cleanupDirs();

  const types = plan.tasks.map((t) => t.type);
  assert.equal(types.includes('file_operation'), true);
});

test('planProjectExecution task dependencies all reference known task IDs', () => {
  cleanupDirs();
  const plan = planProjectExecution('implement and deploy a feature', '');
  cleanupDirs();

  const taskIds = new Set(plan.tasks.map((t) => t.id));
  let allValid = true;
  for (const task of plan.tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        allValid = false;
      }
    }
  }
  assert.equal(allValid, true);
});

// ─── Topological sort ─────────────────────────────────────────────────────────

test('topologicalSort orders tasks by dependency (linear chain)', () => {
  const tasks: AgentOrchestratorTask[] = [
    { id: 't3', description: 'C', type: 'ai_generation', dependencies: ['t2'], status: 'pending', executorType: 'gemini' },
    { id: 't1', description: 'A', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 't2', description: 'B', type: 'ai_analysis', dependencies: ['t1'], status: 'pending', executorType: 'gemini' },
  ];

  const sorted = topologicalSort(tasks);
  const ids = sorted.map((t) => t.id);

  assert.equal(sorted.length, 3);
  assert.equal(ids.indexOf('t1') < ids.indexOf('t2'), true);
  assert.equal(ids.indexOf('t2') < ids.indexOf('t3'), true);
});

test('topologicalSort handles parallel tasks (diamond DAG)', () => {
  const tasks: AgentOrchestratorTask[] = [
    { id: 'root', description: 'Root', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 'left', description: 'Left', type: 'ai_analysis', dependencies: ['root'], status: 'pending', executorType: 'gemini' },
    { id: 'right', description: 'Right', type: 'ai_analysis', dependencies: ['root'], status: 'pending', executorType: 'gemini' },
    { id: 'merge', description: 'Merge', type: 'ai_generation', dependencies: ['left', 'right'], status: 'pending', executorType: 'claude' },
  ];

  const sorted = topologicalSort(tasks);
  const ids = sorted.map((t) => t.id);

  assert.equal(sorted.length, 4);
  assert.equal(ids[0], 'root');
  assert.equal(ids[3], 'merge');
  assert.equal(ids.includes('left'), true);
  assert.equal(ids.includes('right'), true);
});

test('topologicalSort throws on cycle', () => {
  const tasks: AgentOrchestratorTask[] = [
    { id: 'a', description: 'A', type: 'ai_analysis', dependencies: ['b'], status: 'pending', executorType: 'gemini' },
    { id: 'b', description: 'B', type: 'ai_analysis', dependencies: ['a'], status: 'pending', executorType: 'gemini' },
  ];

  let threw = false;
  try {
    topologicalSort(tasks);
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
});

test('topologicalSort handles empty task list', () => {
  const sorted = topologicalSort([]);
  assert.equal(sorted.length, 0);
});

// ─── Dependency check ─────────────────────────────────────────────────────────

test('dependenciesComplete returns true when all deps are in results', () => {
  const task: AgentOrchestratorTask = {
    id: 't2',
    description: 'B',
    type: 'ai_generation',
    dependencies: ['t1'],
    status: 'pending',
    executorType: 'gemini',
  };

  const results = new Map<string, unknown>([['t1', { ok: true }]]);
  assert.equal(dependenciesComplete(task, results), true);
});

test('dependenciesComplete returns false when a dep is missing', () => {
  const task: AgentOrchestratorTask = {
    id: 't2',
    description: 'B',
    type: 'ai_generation',
    dependencies: ['t1', 'missing'],
    status: 'pending',
    executorType: 'gemini',
  };

  const results = new Map<string, unknown>([['t1', { ok: true }]]);
  assert.equal(dependenciesComplete(task, results), false);
});

test('dependenciesComplete returns true for task with no dependencies', () => {
  const task: AgentOrchestratorTask = {
    id: 't1',
    description: 'A',
    type: 'ai_analysis',
    dependencies: [],
    status: 'pending',
    executorType: 'gemini',
  };

  assert.equal(dependenciesComplete(task, new Map()), true);
});

// ─── Executor: happy path ─────────────────────────────────────────────────────

test('OrchestrationExecutor executes all tasks in order (no gates)', () => {
  cleanupDirs();
  const plan = planProjectExecution('analyze the system', '');
  // Remove all approval gates for this test
  plan.approvalGates = [];

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.results.length > 0, true);

  const ledger = executor.getExecutionLedger();
  assert.equal(ledger.length > 0, true);
  assert.equal(ledger.every((entry) => entry.outcome === 'completed' || entry.outcome === 'failed'), true);
  assert.equal(ledger.every((entry) => typeof entry.timestamp === 'string'), true);
});

test('OrchestrationExecutor records completed task results in ledger', () => {
  cleanupDirs();
  const tasks: AgentOrchestratorTask[] = [
    { id: 't1', description: 'Analyze', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 't2', description: 'Generate', type: 'ai_generation', dependencies: ['t1'], status: 'pending', executorType: 'gemini' },
  ];

  const plan: AgentOrchestratorPlan = {
    id: `plan-${Date.now()}`,
    projectId: 'test',
    goal: 'test goal',
    tasks,
    approvalGates: [],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, true);
  const ledger = executor.getExecutionLedger();
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0]?.taskId, 't1');
  assert.equal(ledger[0]?.outcome, 'completed');
  assert.equal(ledger[1]?.taskId, 't2');
  assert.equal(ledger[1]?.outcome, 'completed');
});

// ─── Executor: dependency blocking ───────────────────────────────────────────

test('OrchestrationExecutor reports error when dependency references unknown task', () => {
  cleanupDirs();
  // When a dependency ID is not in the task list, Kahn's algorithm treats it as
  // a cycle (unreachable node) and returns a topology error.
  const tasks: AgentOrchestratorTask[] = [
    { id: 't1', description: 'Root', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'bash' },
    { id: 't2', description: 'Child', type: 'ai_generation', dependencies: ['t-missing'], status: 'pending', executorType: 'gemini' },
  ];

  const plan: AgentOrchestratorPlan = {
    id: `plan-${Date.now()}`,
    projectId: 'test',
    goal: 'test unresolvable dep',
    tasks,
    approvalGates: [],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, false);
  // Unreachable node is reported as a topology error
  const topoError = result.errors.find(([id]) => id === '__topology__');
  assert.equal(topoError !== undefined, true);
});

// ─── Executor: approval gates ─────────────────────────────────────────────────

test('OrchestrationExecutor blocks task at unapproved gate', () => {
  cleanupDirs();
  const tasks: AgentOrchestratorTask[] = [
    { id: 'task-1', description: 'Analyze', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 'gate-1', description: 'Approval gate', type: 'approval_gate', dependencies: ['task-1'], status: 'pending', executorType: 'claude' },
    { id: 'task-2', description: 'Execute', type: 'ai_generation', dependencies: ['gate-1'], status: 'pending', executorType: 'gemini' },
  ];

  const planId = `plan-${Date.now()}`;
  const plan: AgentOrchestratorPlan = {
    id: planId,
    projectId: 'test',
    goal: 'test approval gate',
    tasks,
    approvalGates: ['gate-1'],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, false);
  const gateError = result.errors.find(([id]) => id === 'gate-1');
  assert.equal(gateError !== undefined, true);
  assert.equal((gateError?.[1] as string).includes('approval gate'), true);
});

test('OrchestrationExecutor proceeds past gate when approved', () => {
  cleanupDirs();
  const planId = `plan-${Date.now()}`;

  const tasks: AgentOrchestratorTask[] = [
    { id: 'task-1', description: 'Analyze', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 'gate-1', description: 'Approval gate', type: 'approval_gate', dependencies: ['task-1'], status: 'pending', executorType: 'claude' },
    { id: 'task-2', description: 'Generate', type: 'ai_generation', dependencies: ['gate-1'], status: 'pending', executorType: 'gemini' },
  ];

  const plan: AgentOrchestratorPlan = {
    id: planId,
    projectId: 'test',
    goal: 'test approved gate',
    tasks,
    approvalGates: ['gate-1'],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  // Pre-approve the gate
  recordApprovalDecision(planId, 'gate-1', true, 'test');

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.results.length, 3);
});

// ─── Approval persistence ─────────────────────────────────────────────────────

test('recordApprovalDecision persists and retrieves a decision', () => {
  cleanupDirs();
  const planId = `plan-${Date.now()}`;
  const taskId = 'gate-1';

  recordApprovalDecision(planId, taskId, true, 'operator');
  const decision = getApprovalDecision(planId, taskId);
  cleanupDirs();

  assert.equal(decision !== null, true);
  assert.equal(decision!.planId, planId);
  assert.equal(decision!.taskId, taskId);
  assert.equal(decision!.approved, true);
  assert.equal(decision!.approvedBy, 'operator');
  assert.equal(typeof decision!.approvedAt, 'string');
});

test('recordApprovalDecision records rejection correctly', () => {
  cleanupDirs();
  const planId = `plan-${Date.now()}`;
  const taskId = 'gate-2';

  recordApprovalDecision(planId, taskId, false, 'operator');
  const decision = getApprovalDecision(planId, taskId);
  cleanupDirs();

  assert.equal(decision !== null, true);
  assert.equal(decision!.approved, false);
});

test('getApprovalDecision returns null when no decision recorded', () => {
  cleanupDirs();
  const decision = getApprovalDecision('plan-nonexistent', 'gate-nonexistent');
  cleanupDirs();

  assert.equal(decision, null);
});

// ─── Plan persistence ─────────────────────────────────────────────────────────

test('savePlan persists and retrievePlan reloads a plan', () => {
  cleanupDirs();
  const plan = planProjectExecution('test save/reload', '');
  const saved = savePlan(plan);

  assert.equal(saved, true);

  const loaded = retrievePlan(plan.id);
  cleanupDirs();

  assert.equal(loaded !== null, true);
  assert.equal(loaded!.id, plan.id);
  assert.equal(loaded!.goal, plan.goal);
  assert.equal(loaded!.tasks.length, plan.tasks.length);
});

test('retrievePlan returns null for unknown plan ID', () => {
  cleanupDirs();
  const result = retrievePlan('plan-does-not-exist');
  cleanupDirs();

  assert.equal(result, null);
});

test('listPlans returns all saved plans', async () => {
  cleanupDirs();
  const plan1 = planProjectExecution('goal one', '');
  // Small async pause to ensure different Date.now() values for unique plan IDs
  await new Promise<void>((resolve) => { setTimeout(resolve, 2); });
  const plan2 = planProjectExecution('goal two', '');

  savePlan(plan1);
  savePlan(plan2);

  const plans = listPlans();
  cleanupDirs();

  assert.equal(plans.length >= 2, true);
  assert.equal(plans.some((p) => p.goal === 'goal one'), true);
  assert.equal(plans.some((p) => p.goal === 'goal two'), true);
});

test('listPlans returns empty array when no plans saved', () => {
  cleanupDirs();
  const plans = listPlans();
  cleanupDirs();

  assert.equal(plans.length, 0);
});

// ─── API endpoint tests ───────────────────────────────────────────────────────

test('GET /api/agent/plans returns list response', async () => {
  cleanupDirs();
  const response = await exerciseGet('/api/agent/plans');
  const body = JSON.parse(response.body) as { ok: boolean; plans: unknown[] };
  cleanupDirs();

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.plans), true);
});

test('POST /api/agent/plan creates a new execution plan', async () => {
  cleanupDirs();
  const response = await exercisePost('/api/agent/plan', {
    goal: 'analyze the brain codebase',
    context: 'TypeScript monorepo',
  });

  const body = JSON.parse(response.body) as { ok: boolean; plan: AgentOrchestratorPlan };
  cleanupDirs();

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.plan.id.startsWith('plan-'), true);
  assert.equal(body.plan.goal, 'analyze the brain codebase');
  assert.equal(body.plan.tasks.length >= 2, true);
  assert.equal(body.plan.status, 'planning');
});

test('POST /api/agent/plan returns 400 when goal is missing', async () => {
  cleanupDirs();
  const response = await exercisePost('/api/agent/plan', { context: 'no goal' });
  const body = JSON.parse(response.body) as { error: { code: string } };
  cleanupDirs();

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, 'missing_goal');
});

test('GET /api/agent/plans/:id returns a saved plan', async () => {
  cleanupDirs();
  // Create plan first
  const createResponse = await exercisePost('/api/agent/plan', { goal: 'fetch plan by id' });
  const createBody = JSON.parse(createResponse.body) as { plan: AgentOrchestratorPlan };
  const planId = createBody.plan.id;

  const getResponse = await exerciseGet(`/api/agent/plans/${planId}`);
  const getBody = JSON.parse(getResponse.body) as { ok: boolean; plan: AgentOrchestratorPlan };
  cleanupDirs();

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getBody.ok, true);
  assert.equal(getBody.plan.id, planId);
});

test('GET /api/agent/plans/:id returns 404 for missing plan', async () => {
  cleanupDirs();
  const response = await exerciseGet('/api/agent/plans/plan-nonexistent');
  const body = JSON.parse(response.body) as { error: { code: string } };
  cleanupDirs();

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('POST /api/agent/execute returns 400 when planId is missing', async () => {
  cleanupDirs();
  const response = await exercisePost('/api/agent/execute', {});
  const body = JSON.parse(response.body) as { error: { code: string } };
  cleanupDirs();

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, 'missing_plan_id');
});

test('POST /api/agent/execute returns 404 for unknown planId', async () => {
  cleanupDirs();
  const response = await exercisePost('/api/agent/execute', { planId: 'plan-missing' });
  const body = JSON.parse(response.body) as { error: { code: string } };
  cleanupDirs();

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('POST /api/agent/plan-approval records approval decision', async () => {
  cleanupDirs();
  const planId = `plan-${Date.now()}`;
  const taskId = 'gate-1';

  const response = await exercisePost('/api/agent/plan-approval', {
    planId,
    taskId,
    approved: true,
    approvedBy: 'operator',
  });

  const body = JSON.parse(response.body) as { ok: boolean; decision: { approved: boolean } };
  cleanupDirs();

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.decision.approved, true);
});

test('POST /api/agent/plan-approval returns 400 when fields missing', async () => {
  cleanupDirs();
  const response = await exercisePost('/api/agent/plan-approval', { approved: true });
  const body = JSON.parse(response.body) as { error: { code: string } };
  cleanupDirs();

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, 'missing_fields');
});

// ─── Error handling ───────────────────────────────────────────────────────────

test('OrchestrationExecutor handles cycle gracefully without crashing', () => {
  cleanupDirs();
  const tasks: AgentOrchestratorTask[] = [
    { id: 'a', description: 'A', type: 'ai_analysis', dependencies: ['b'], status: 'pending', executorType: 'gemini' },
    { id: 'b', description: 'B', type: 'ai_analysis', dependencies: ['a'], status: 'pending', executorType: 'gemini' },
  ];

  const plan: AgentOrchestratorPlan = {
    id: `plan-${Date.now()}`,
    projectId: 'test',
    goal: 'cycle test',
    tasks,
    approvalGates: [],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, false);
  assert.equal(result.errors.length > 0, true);
  const topologyError = result.errors.find(([id]) => id === '__topology__');
  assert.equal(topologyError !== undefined, true);
});

test('OrchestrationExecutor blocks downstream task when upstream is at approval gate', () => {
  cleanupDirs();
  // t1 runs, gate is blocked (no approval), t2 depends on gate so also gets blocked
  const tasks: AgentOrchestratorTask[] = [
    { id: 't1', description: 'Analyze', type: 'ai_analysis', dependencies: [], status: 'pending', executorType: 'gemini' },
    { id: 'gate', description: 'Gate', type: 'approval_gate', dependencies: ['t1'], status: 'pending', executorType: 'claude' },
    { id: 't2', description: 'Downstream', type: 'ai_generation', dependencies: ['gate'], status: 'pending', executorType: 'gemini' },
  ];

  const plan: AgentOrchestratorPlan = {
    id: `plan-${Date.now()}`,
    projectId: 'test',
    goal: 'blocked downstream test',
    tasks,
    approvalGates: ['gate'],
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  const executor = new OrchestrationExecutor(plan);
  const result = executor.executeAll();
  cleanupDirs();

  assert.equal(result.ok, false);
  // t1 succeeds
  const successIds = result.results.map(([id]) => id);
  assert.equal(successIds.includes('t1'), true);
  // gate and t2 are blocked
  assert.equal(result.errors.some(([id]) => id === 'gate'), true);
  assert.equal(result.errors.some(([id]) => id === 't2'), true);
  // ledger records all 3 (t1 completed, gate failed, t2 failed)
  assert.equal(result.ledger.length, 3);
});

// ─── Provider routing ─────────────────────────────────────────────────────────

test('planProjectExecution assigns gemini to ai_analysis and ai_generation tasks', () => {
  cleanupDirs();
  const plan = planProjectExecution('analyze trends', '');
  cleanupDirs();

  const analysisTasks = plan.tasks.filter(
    (t) => t.type === 'ai_analysis' || t.type === 'ai_generation',
  );
  assert.equal(analysisTasks.every((t) => t.executorType === 'gemini'), true);
});

test('planProjectExecution assigns claude to code_change tasks', () => {
  cleanupDirs();
  const plan = planProjectExecution('implement the new API', '');
  cleanupDirs();

  const codeTasks = plan.tasks.filter((t) => t.type === 'code_change');
  assert.equal(codeTasks.length > 0, true);
  assert.equal(codeTasks.some((t) => t.executorType === 'claude' || t.executorType === 'codex'), true);
});

test('planProjectExecution assigns bash to file_operation tasks', () => {
  cleanupDirs();
  const plan = planProjectExecution('write output to file', '');
  cleanupDirs();

  const fileTasks = plan.tasks.filter((t) => t.type === 'file_operation');
  assert.equal(fileTasks.every((t) => t.executorType === 'bash'), true);
});
