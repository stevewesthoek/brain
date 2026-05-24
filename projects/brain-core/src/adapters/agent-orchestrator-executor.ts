import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentOrchestratorPlan,
  AgentOrchestratorTask,
  AgentOrchestratorRunRecord,
  AgentOrchestratorApprovalDecision,
  AgentOrchestratorExecuteResult,
} from '../types/api.js';
import { updatePlan } from './agent-orchestrator-planner.js';

const DEFAULT_APPROVALS_DIR = path.resolve(
  process.cwd(),
  '../../../../../.local/video-orchestrator/state/agent-orchestrator-approvals',
);

// ─── Topological sort (Kahn's algorithm) ────────────────────────────────────

export function topologicalSort(tasks: AgentOrchestratorTask[]): AgentOrchestratorTask[] {
  const taskMap = new Map<string, AgentOrchestratorTask>(
    tasks.map((t) => [t.id, t]),
  );

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, task.dependencies.length);
    adjacency.set(task.id, adjacency.get(task.id) ?? []);

    for (const depId of task.dependencies) {
      const neighbors = adjacency.get(depId) ?? [];
      neighbors.push(task.id);
      adjacency.set(depId, neighbors);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: AgentOrchestratorTask[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const task = taskMap.get(current);
    if (task) {
      sorted.push(task);
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== tasks.length) {
    throw new Error(
      `Cycle detected in task graph. Sorted ${sorted.length} of ${tasks.length} tasks.`,
    );
  }

  return sorted;
}

// ─── Dependency check ────────────────────────────────────────────────────────

export function dependenciesComplete(
  task: AgentOrchestratorTask,
  results: Map<string, unknown>,
): boolean {
  return task.dependencies.every((depId) => results.has(depId));
}

// ─── Approval gate support ───────────────────────────────────────────────────

export function recordApprovalDecision(
  planId: string,
  taskId: string,
  approved: boolean,
  approvedBy?: string,
): AgentOrchestratorApprovalDecision {
  const decision: AgentOrchestratorApprovalDecision = {
    id: Date.now(),
    planId,
    taskId,
    approved,
    approvedBy,
    approvedAt: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(DEFAULT_APPROVALS_DIR, { recursive: true });
    const filePath = path.join(DEFAULT_APPROVALS_DIR, `${planId}-${taskId}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(decision, null, 2)}\n`);
  } catch {
    // Non-fatal: approval recorded in memory even if disk write fails
  }

  return decision;
}

export function getApprovalDecision(
  planId: string,
  taskId: string,
): AgentOrchestratorApprovalDecision | null {
  try {
    const filePath = path.join(DEFAULT_APPROVALS_DIR, `${planId}-${taskId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(
      fs.readFileSync(filePath, 'utf8'),
    ) as AgentOrchestratorApprovalDecision;
  } catch {
    return null;
  }
}

// ─── Task execution stubs ────────────────────────────────────────────────────
// These are execution stubs for Phase 0.7.
// Phase 2+ will wire real provider calls (Gemini free-tier, Claude API, Codex CLI).
// Each stub records intent and returns a structured placeholder result.

function executeGeminiTask(task: AgentOrchestratorTask): unknown {
  return {
    provider: 'gemini',
    status: 'stub',
    taskId: task.id,
    prompt: task.prompt ?? '',
    note: 'Phase 0.7: Gemini free-tier execution stub. Wire gemini-cli in Phase 2.',
    completedAt: new Date().toISOString(),
  };
}

function executeClaudeTask(task: AgentOrchestratorTask): unknown {
  return {
    provider: 'claude',
    status: 'stub',
    taskId: task.id,
    prompt: task.prompt ?? '',
    note: 'Phase 0.7: Claude API execution stub. Wire claude-api in Phase 2.',
    completedAt: new Date().toISOString(),
  };
}

function executeCodexTask(task: AgentOrchestratorTask): unknown {
  return {
    provider: 'codex',
    status: 'stub',
    taskId: task.id,
    prompt: task.prompt ?? '',
    note: 'Phase 0.7: Codex CLI execution stub. Wire codex-review.sh in Phase 2.',
    completedAt: new Date().toISOString(),
  };
}

function executeBashTask(task: AgentOrchestratorTask): unknown {
  return {
    provider: 'bash',
    status: 'stub',
    taskId: task.id,
    command: task.prompt ?? '',
    note: 'Phase 0.7: Bash execution stub. Wire child_process in Phase 2.',
    completedAt: new Date().toISOString(),
  };
}

function executeN8nTask(task: AgentOrchestratorTask): unknown {
  return {
    provider: 'n8n',
    status: 'stub',
    taskId: task.id,
    workflow: task.prompt ?? '',
    note: 'Phase 0.7: n8n workflow trigger stub. Wire n8n-api.sh in Phase 2.',
    completedAt: new Date().toISOString(),
  };
}

function dispatchTask(task: AgentOrchestratorTask): unknown {
  switch (task.executorType) {
    case 'gemini':
      return executeGeminiTask(task);
    case 'claude':
      return executeClaudeTask(task);
    case 'codex':
      return executeCodexTask(task);
    case 'bash':
      return executeBashTask(task);
    case 'n8n':
      return executeN8nTask(task);
    default:
      throw new Error(`Unknown executor type: ${String(task.executorType)}`);
  }
}

// ─── Orchestration Executor ──────────────────────────────────────────────────

export class OrchestrationExecutor {
  private plan: AgentOrchestratorPlan;
  private ledger: AgentOrchestratorRunRecord[] = [];

  constructor(plan: AgentOrchestratorPlan) {
    this.plan = plan;
  }

  executeAll(): AgentOrchestratorExecuteResult {
    const results = new Map<string, unknown>();
    const errors = new Map<string, string>();

    let sorted: AgentOrchestratorTask[];
    try {
      sorted = topologicalSort(this.plan.tasks);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, results: [], errors: [['__topology__', msg]], ledger: [] };
    }

    for (const task of sorted) {
      // Skip if dependencies are not complete
      if (!dependenciesComplete(task, results)) {
        task.status = 'blocked';
        this.recordExecution(task, 'failed', 'blocked: unmet dependencies');
        errors.set(task.id, 'blocked: unmet dependencies');
        continue;
      }

      // Check approval gates
      if (this.plan.approvalGates.includes(task.id)) {
        const decision = getApprovalDecision(this.plan.id, task.id);
        if (!decision || !decision.approved) {
          task.status = 'blocked';
          this.recordExecution(task, 'failed', 'blocked: pending approval gate');
          errors.set(task.id, 'blocked: pending approval gate');
          continue;
        }
      }

      try {
        task.status = 'running';
        const result = dispatchTask(task);
        task.result = result;
        task.status = 'completed';
        results.set(task.id, result);
        this.recordExecution(task, 'completed', result);
      } catch (error) {
        task.status = 'failed';
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.set(task.id, errorMsg);
        task.error = errorMsg;
        this.recordExecution(task, 'failed', errorMsg);
      }
    }

    // Persist updated plan with task statuses
    const isFullyComplete = this.plan.tasks.every(
      (t) => t.status === 'completed',
    );
    const hasFailed = this.plan.tasks.some((t) => t.status === 'failed');

    this.plan.status = isFullyComplete
      ? 'completed'
      : hasFailed
        ? 'failed'
        : 'executing';

    if (isFullyComplete) {
      this.plan.completedAt = new Date().toISOString();
    }

    updatePlan(this.plan);

    return {
      ok: errors.size === 0,
      results: Array.from(results.entries()),
      errors: Array.from(errors.entries()),
      ledger: this.ledger,
    };
  }

  private recordExecution(
    task: AgentOrchestratorTask,
    outcome: 'completed' | 'failed',
    data: unknown,
  ): void {
    this.ledger.push({
      taskId: task.id,
      outcome,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  getExecutionLedger(): AgentOrchestratorRunRecord[] {
    return this.ledger;
  }
}
