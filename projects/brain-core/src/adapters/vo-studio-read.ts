/**
 * Video Orchestrator Studio — Approval Workflow & Package Status Reads
 *
 * Provides read-only access to:
 * - Approval workflow state
 * - Package status and progress
 * - Pending approvals queue
 * - Job execution tracking
 */

import type { Approval, ProductionPackage } from '../types/vo-studio.js';

export interface PendingApproval {
  id: string;
  type: 'thumbnail' | 'metadata' | 'final_review';
  packageId: string;
  contentItemId: string;
  requestedAt: string;
  variants: Array<{
    id: string;
    label: string;
    preview?: string;
  }>;
}

export interface ApprovalWorkflowState {
  packageId: string;
  contentItemId: string;
  currentStage: 'thumbnail' | 'metadata' | 'queued' | 'completed';
  approvals: Approval[];
  pendingApprovals: PendingApproval[];
  completedAt?: string;
}

export interface PackageExecutionSummary {
  packageId: string;
  contentItemId: string;
  status: string;
  stage: string;
  progressPercent: number;
  currentJob?: {
    id: string;
    type: string;
    status: string;
    startedAt?: string;
  };
  completedStages: string[];
  failedStages: string[];
}

export interface ApprovalQueueResponse {
  ok: boolean;
  items: PendingApproval[];
  count: number;
  error?: string;
}

export interface WorkflowStateResponse {
  ok: boolean;
  state?: ApprovalWorkflowState;
  error?: string;
}

export interface ExecutionSummaryResponse {
  ok: boolean;
  summary?: PackageExecutionSummary;
  error?: string;
}

export function readApprovalQueue(
  projectId: string,
): ApprovalQueueResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      items: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    items: [],
    count: 0,
  };
}

export function readWorkflowState(
  packageId: string,
): WorkflowStateResponse {
  const errors: string[] = [];

  if (!packageId?.trim()) {
    errors.push('packageId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    state: {
      packageId,
      contentItemId: '',
      currentStage: 'thumbnail',
      approvals: [],
      pendingApprovals: [],
    },
  };
}

export function readExecutionSummary(
  packageId: string,
): ExecutionSummaryResponse {
  const errors: string[] = [];

  if (!packageId?.trim()) {
    errors.push('packageId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    summary: {
      packageId,
      contentItemId: '',
      status: 'pending',
      stage: 'thumbnail',
      progressPercent: 0,
      completedStages: [],
      failedStages: [],
    },
  };
}

export interface JobExecution {
  id: string;
  packageId: string;
  type: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface JobHistoryResponse {
  ok: boolean;
  items: JobExecution[];
  count: number;
  error?: string;
}

export interface PerformanceMetric {
  stage: string;
  avgDurationMs: number;
  successRate: number;
  totalRuns: number;
  failedRuns: number;
}

export interface PerformanceMetricsResponse {
  ok: boolean;
  metrics: PerformanceMetric[];
  projectId?: string;
  error?: string;
}

export interface ApprovalStatistic {
  type: 'thumbnail' | 'metadata' | 'final_review';
  totalRequested: number;
  approved: number;
  rejected: number;
  avgWaitTimeMin: number;
}

export interface ApprovalStatisticsResponse {
  ok: boolean;
  statistics: ApprovalStatistic[];
  projectId?: string;
  error?: string;
}

export interface ErrorSummary {
  stage: string;
  errorType: string;
  count: number;
  lastOccurred: string;
}

export interface ErrorAnalysisResponse {
  ok: boolean;
  errors: ErrorSummary[];
  projectId?: string;
  error?: string;
}

export function readJobHistory(
  projectId: string,
  limit: number = 50,
): JobHistoryResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (limit < 1 || limit > 1000) {
    errors.push('limit must be between 1 and 1000');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      items: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    items: [],
    count: 0,
  };
}

export function readPerformanceMetrics(
  projectId: string,
): PerformanceMetricsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      metrics: [],
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    metrics: [],
    projectId,
  };
}

export function readApprovalStatistics(
  projectId: string,
): ApprovalStatisticsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      statistics: [],
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    statistics: [],
    projectId,
  };
}

export function readErrorAnalysis(
  projectId: string,
): ErrorAnalysisResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: [],
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    errors: [],
    projectId,
  };
}
