import { runLiveWorkcellCodingWorker, type LiveWorkcellCodingWorkerOptions, type LiveWorkcellCodingWorkerResult } from './live-workcell-coding-worker.js';
import { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import type { ModelGateway } from './model-gateway.js';
import { GitCliWorkcellAdapter } from './workcell.js';

export const K35_ROOT_BUDGET = Object.freeze({ maxSteps: 16, maxTokens: 12_000, maxDollars: 0.02 });
export const K35_CHILD_BUDGET = Object.freeze({ maxSteps: 6, maxTokens: 6_000, maxDollars: 0.01 });

export type K35WorkerDefinition = {
  label: 'A' | 'B';
  taskId: string;
  runId: string;
  attemptId: string;
  workerAgentId: string;
  relativePath: string;
  replacementText: string;
};

export const K35_WORKERS: readonly K35WorkerDefinition[] = Object.freeze([
  { label: 'A', taskId: 'task:k3-5-worker-a', runId: 'run:k3-5-worker-a', attemptId: 'attempt:k3-5-worker-a', workerAgentId: 'agent:worker-k3-5-a', relativePath: 'src/worker-a.ts', replacementText: 'K3_5_A_PASS' },
  { label: 'B', taskId: 'task:k3-5-worker-b', runId: 'run:k3-5-worker-b', attemptId: 'attempt:k3-5-worker-b', workerAgentId: 'agent:worker-k3-5-b', relativePath: 'src/worker-b.ts', replacementText: 'K3_5_B_PASS' },
]);

export type K35ConcurrentWorkerOptions = {
  databasePath: string;
  repositoryRoot: string;
  workcellsRoot: string;
  harnessRoot: string;
  baseRef: string;
  now: string;
  fixtureMode?: boolean;
  accountRef?: string;
  routeEvidence?: LiveWorkcellCodingWorkerOptions['routeEvidence'];
  modelAccessEvidence?: LiveWorkcellCodingWorkerOptions['modelAccessEvidence'];
  gatewayFactory: (worker: K35WorkerDefinition) => ModelGateway;
};

export type K35ConcurrentWorkerResult = {
  status: 'completed' | 'failed';
  rootTaskId: string;
  baseRevision: string;
  sameBaseRevision: boolean;
  actualOverlap: boolean;
  maximumConcurrentWorkers: number;
  workers: readonly [LiveWorkcellCodingWorkerResult, LiveWorkcellCodingWorkerResult];
  rootBudget: typeof K35_ROOT_BUDGET;
  childBudget: typeof K35_CHILD_BUDGET;
};

export async function runK35ConcurrentWorkers(options: K35ConcurrentWorkerOptions): Promise<K35ConcurrentWorkerResult> {
  if (K35_WORKERS.length !== 2) throw new Error('K3.5 statically admits exactly two workers');
  if (K35_CHILD_BUDGET.maxSteps * 2 > K35_ROOT_BUDGET.maxSteps || K35_CHILD_BUDGET.maxTokens * 2 > K35_ROOT_BUDGET.maxTokens || K35_CHILD_BUDGET.maxDollars * 2 > K35_ROOT_BUDGET.maxDollars) throw new Error('child budget envelope exceeds K3.5 root budget');
  const git = new GitCliWorkcellAdapter();
  const repository = await git.validateRepository(options.repositoryRoot);
  if (repository.headRevision !== options.baseRef) throw new Error('K3.5 workers must use the explicitly pinned common base revision');
  const store = new AgentModeSqliteStateStore(options.databasePath);
  store.recordEvent({ eventId: 'k3-5-root-budget-admitted', entityType: 'task', entityId: 'task:k3-5-root', eventType: 'k3-5_root_budget_admitted', occurredAt: options.now, payload: { ...K35_ROOT_BUDGET, childBudget: K35_CHILD_BUDGET, staticallyAdmittedWorkers: 2, baseRevision: options.baseRef } });
  store.close();
  let active = 0;
  let maximumConcurrentWorkers = 0;
  const starts: string[] = [];
  const ends: string[] = [];
  let releaseBarrier: (() => void) | undefined;
  const bothStarted = new Promise<void>((resolve) => { releaseBarrier = resolve; });
  const start = async (worker: K35WorkerDefinition, workcellId: string): Promise<void> => {
    active += 1;
    maximumConcurrentWorkers = Math.max(maximumConcurrentWorkers, active);
    starts.push(`${worker.label}:${workcellId}`);
    if (starts.length === 2) releaseBarrier?.();
    await bothStarted;
  };
  const end = async (worker: K35WorkerDefinition, workcellId: string): Promise<void> => {
    active -= 1;
    ends.push(`${worker.label}:${workcellId}`);
  };
  const run = (worker: K35WorkerDefinition): Promise<LiveWorkcellCodingWorkerResult> => {
    const child: LiveWorkcellCodingWorkerOptions = {
      databasePath: options.databasePath, repositoryRoot: options.repositoryRoot, workcellsRoot: options.workcellsRoot, harnessRoot: options.harnessRoot,
      baseRef: options.baseRef, now: options.now, ...(options.fixtureMode === undefined ? {} : { fixtureMode: options.fixtureMode }), ...(options.accountRef ? { accountRef: options.accountRef } : {}), ...(options.routeEvidence ? { routeEvidence: options.routeEvidence } : {}), ...(options.modelAccessEvidence ? { modelAccessEvidence: options.modelAccessEvidence } : {}),
      gateway: options.gatewayFactory(worker), taskId: worker.taskId, runId: worker.runId, attemptId: worker.attemptId, workerAgentId: worker.workerAgentId,
      jarvisAgentId: 'agent:jarvis-k3-5-root', budgetScopeId: `budget:${worker.taskId.replace(/^task:/, '')}`, reservationId: `reservation:${worker.taskId.replace(/^task:/, '')}`,
      resourceKey: `resource:${worker.taskId.replace(/^task:/, '')}-runtime`, leaseId: `lease:${worker.taskId.replace(/^task:/, '')}`, nodeId: `node:brain-local-${worker.label.toLowerCase()}`,
      controllerRef: `controller:brain-agent-k3-5-${worker.label.toLowerCase()}`, repositoryRef: 'disposable-k3-5-fixture', relativePath: worker.relativePath,
      taskText: `In the Brain-authorized Workcell, read ${worker.relativePath}, change the exact marker BEFORE to ${worker.replacementText} using brain_workcell_patch, then summarize the result.`,
      onExecutionWindowStart: (input) => start(worker, input.workcellId), onExecutionWindowEnd: (input) => end(worker, input.workcellId),
    };
    return runLiveWorkcellCodingWorker(child);
  };
  const workers = await Promise.all(K35_WORKERS.map(run)) as [LiveWorkcellCodingWorkerResult, LiveWorkcellCodingWorkerResult];
  const reopened = new AgentModeSqliteStateStore(options.databasePath);
  const records = reopened?.listWorkcells() ?? [];
  const sameBaseRevision = records.length === 2 && records.every((workcell) => workcell.baseRef === options.baseRef);
  const actualOverlap = maximumConcurrentWorkers >= 2 && starts.length === 2 && ends.length === 2;
  reopened?.recordEvent({ eventId: 'k3-5-root-result', entityType: 'task', entityId: 'task:k3-5-root', eventType: 'k3-5_root_result_recorded', occurredAt: options.now, payload: { workerStatuses: workers.map((worker) => worker.status), sameBaseRevision, actualOverlap, maximumConcurrentWorkers, workcellIds: workers.map((worker) => worker.workcellId) } });
  reopened?.close();
  return { status: workers.every((worker) => worker.status === 'completed') && sameBaseRevision && actualOverlap ? 'completed' : 'failed', rootTaskId: 'task:k3-5-root', baseRevision: options.baseRef, sameBaseRevision, actualOverlap, maximumConcurrentWorkers, workers, rootBudget: K35_ROOT_BUDGET, childBudget: K35_CHILD_BUDGET };
}
