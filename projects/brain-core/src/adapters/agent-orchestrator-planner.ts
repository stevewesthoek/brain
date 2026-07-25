import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentOrchestratorPlan,
  AgentOrchestratorTask,
  AgentOrchestratorTaskType,
  AgentOrchestratorExecutorType,
} from '../types/api.js';

const DEFAULT_PLANS_DIR = path.resolve(
  process.cwd(),
  '../../../../../.local/video-orchestrator/state/agent-orchestrator-plans',
);

function resolvePlansDir(): string {
  const configuredRoot = process.env.BRAIN_CORE_AGENT_ORCHESTRATOR_STATE_ROOT?.trim();
  return configuredRoot
    ? path.resolve(configuredRoot, 'plans')
    : DEFAULT_PLANS_DIR;
}

// ─── Provider routing rules ──────────────────────────────────────────────────
// Gemini free-tier: text analysis/generation (eligible, non-sensitive)
// Claude: code review/generation, complex reasoning (paid)
// Codex: code review, second opinion (paid subscription)
// Bash: file operations (local, fast)
// n8n: workflow automation triggers

function selectExecutorForTaskType(
  type: AgentOrchestratorTaskType,
): AgentOrchestratorExecutorType {
  switch (type) {
    case 'ai_analysis':
    case 'ai_generation':
      return 'gemini';
    case 'code_change':
      return 'claude';
    case 'file_operation':
      return 'bash';
    case 'external_api_call':
      return 'n8n';
    case 'approval_gate':
      return 'claude';
    default:
      return 'gemini';
  }
}

// ─── Plan decomposition ──────────────────────────────────────────────────────
// This builds a static execution plan from a goal description.
// In Phase 2+, this will call Gemini free-tier to dynamically decompose goals.
// For now the planner produces a deterministic skeleton plan that can be
// extended by real AI execution when provider integrations are wired.

function buildDefaultTasksForGoal(goal: string): AgentOrchestratorTask[] {
  const normalized = goal.toLowerCase();

  const baseAnalysis: AgentOrchestratorTask = {
    id: 'task-1',
    description: `Analyze context and requirements for: ${goal}`,
    type: 'ai_analysis',
    dependencies: [],
    status: 'pending',
    executorType: 'gemini',
    prompt: `Analyze the following goal and identify key requirements, risks, and constraints:\n\n${goal}`,
  };

  const planGeneration: AgentOrchestratorTask = {
    id: 'task-2',
    description: 'Generate step-by-step execution plan',
    type: 'ai_generation',
    dependencies: ['task-1'],
    status: 'pending',
    executorType: 'gemini',
    prompt: `Based on the analysis, generate a detailed step-by-step plan for: ${goal}`,
  };

  const tasks: AgentOrchestratorTask[] = [baseAnalysis, planGeneration];

  // Add code-related tasks for code goals
  if (
    normalized.includes('code') ||
    normalized.includes('build') ||
    normalized.includes('implement') ||
    normalized.includes('fix') ||
    normalized.includes('refactor')
  ) {
    tasks.push({
      id: 'task-3',
      description: 'Implement code changes',
      type: 'code_change',
      dependencies: ['task-2'],
      status: 'pending',
      executorType: 'claude',
      prompt: `Implement the planned changes for: ${goal}`,
    });

    tasks.push({
      id: 'task-4',
      description: 'Review implemented changes',
      type: 'code_change',
      dependencies: ['task-3'],
      status: 'pending',
      executorType: 'codex',
      prompt: `Review the implementation for correctness, security, and quality.`,
    });

    tasks.push({
      id: 'task-5',
      description: 'Approval gate: review before proceeding',
      type: 'approval_gate',
      dependencies: ['task-4'],
      status: 'pending',
      executorType: 'claude',
    });
  }

  // Add publish/deploy tasks (always gated)
  if (
    normalized.includes('publish') ||
    normalized.includes('deploy') ||
    normalized.includes('release') ||
    normalized.includes('push')
  ) {
    const gateId = tasks.length > 2 ? `task-${tasks.length}` : 'task-3';
    const prevId = tasks[tasks.length - 1]?.id ?? 'task-2';

    tasks.push({
      id: gateId,
      description: 'Approval gate: confirm before publishing or deploying',
      type: 'approval_gate',
      dependencies: [prevId],
      status: 'pending',
      executorType: 'claude',
    });
  }

  // Add file operation tasks
  if (
    normalized.includes('file') ||
    normalized.includes('write') ||
    normalized.includes('save') ||
    normalized.includes('create')
  ) {
    const prevId = tasks[tasks.length - 1]?.id ?? 'task-2';
    tasks.push({
      id: `task-${tasks.length + 1}`,
      description: 'Write output files',
      type: 'file_operation',
      dependencies: [prevId],
      status: 'pending',
      executorType: 'bash',
      prompt: `Write the generated output to the appropriate file paths.`,
    });
  }

  return tasks;
}

function extractApprovalGateIds(tasks: AgentOrchestratorTask[]): string[] {
  return tasks
    .filter((task) => task.type === 'approval_gate')
    .map((task) => task.id);
}

export function planProjectExecution(goal: string, _context: string): AgentOrchestratorPlan {
  const tasks = buildDefaultTasksForGoal(goal);
  const approvalGates = extractApprovalGateIds(tasks);

  const plan: AgentOrchestratorPlan = {
    id: `plan-${Date.now()}`,
    projectId: 'orchestrator',
    goal,
    tasks,
    approvalGates,
    createdAt: new Date().toISOString(),
    status: 'planning',
  };

  return plan;
}

// ─── Plan persistence ─────────────────────────────────────────────────────────

export function savePlan(plan: AgentOrchestratorPlan): boolean {
  try {
    const plansDir = resolvePlansDir();
    fs.mkdirSync(plansDir, { recursive: true });
    const filePath = path.join(plansDir, `${plan.id}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function retrievePlan(planId: string): AgentOrchestratorPlan | null {
  try {
    const filePath = path.join(resolvePlansDir(), `${planId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentOrchestratorPlan;
  } catch {
    return null;
  }
}

export function listPlans(): AgentOrchestratorPlan[] {
  try {
    const plansDir = resolvePlansDir();
    if (!fs.existsSync(plansDir)) {
      return [];
    }
    return fs
      .readdirSync(plansDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => {
        try {
          return JSON.parse(
            fs.readFileSync(path.join(plansDir, entry.name), 'utf8'),
          ) as AgentOrchestratorPlan;
        } catch {
          return null;
        }
      })
      .filter((p): p is AgentOrchestratorPlan => p !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function updatePlan(plan: AgentOrchestratorPlan): boolean {
  return savePlan(plan);
}

export { selectExecutorForTaskType };
