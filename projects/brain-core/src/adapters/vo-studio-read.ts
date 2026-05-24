/**
 * Video Orchestrator Studio — Approval Workflow & Package Status Reads
 *
 * Provides read-only access to:
 * - Approval workflow state
 * - Package status and progress
 * - Pending approvals queue
 * - Job execution tracking
 */

import { readPendingVOApprovals } from './vo-studio-approval-store.js';
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

  // Phase 1W: read from the VO approval store persisted to
  // ~/.local/video-orchestrator/state/approvals.json
  const pending = readPendingVOApprovals(projectId);
  const items: PendingApproval[] = pending.map((record) => ({
    id: record.id,
    // Map VO approval types to the PendingApproval type union.
    // 'content' → 'metadata' (closest semantic match for draft/queue review)
    // 'thumbnail' | 'metadata' → direct pass-through
    // 'package' → 'final_review'
    type: record.type === 'thumbnail'
      ? 'thumbnail'
      : record.type === 'metadata'
      ? 'metadata'
      : 'final_review',
    packageId: (record.requestPayload.packageId as string | undefined) ?? '',
    contentItemId: (record.requestPayload.contentItemId as string | undefined) ?? '',
    requestedAt: record.requestedAt,
    variants: [],
  }));

  return {
    ok: true,
    items,
    count: items.length,
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

export interface PublishingJob {
  id: string;
  packageId: string;
  platformId: string;
  accountId: string;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  error?: string;
}

export interface PublishingQueueResponse {
  ok: boolean;
  jobs: PublishingJob[];
  count: number;
  error?: string;
}

export interface DistributionSummary {
  packageId: string;
  totalPlatforms: number;
  published: number;
  scheduled: number;
  failed: number;
  platforms: Array<{
    platformId: string;
    status: string;
    accounts: number;
  }>;
}

export interface DistributionSummaryResponse {
  ok: boolean;
  summary?: DistributionSummary;
  error?: string;
}

export interface PublishingMetrics {
  totalPublished: number;
  thisWeek: number;
  thisMonth: number;
  avgTimeToPublish: number;
  platformBreakdown: Record<string, number>;
  failureRate: number;
}

export interface PublishingMetricsResponse {
  ok: boolean;
  metrics?: PublishingMetrics;
  projectId?: string;
  error?: string;
}

export function readPublishingQueue(
  projectId: string,
  status?: string,
): PublishingQueueResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      jobs: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    jobs: [],
    count: 0,
  };
}

export function readDistributionSummary(
  packageId: string,
): DistributionSummaryResponse {
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
      totalPlatforms: 0,
      published: 0,
      scheduled: 0,
      failed: 0,
      platforms: [],
    },
  };
}

export function readPublishingMetrics(
  projectId: string,
): PublishingMetricsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    metrics: {
      totalPublished: 0,
      thisWeek: 0,
      thisMonth: 0,
      avgTimeToPublish: 0,
      platformBreakdown: {},
      failureRate: 0,
    },
    projectId,
  };
}

export interface WebhookDeliveryRates {
  successCount: number;
  failureCount: number;
  pendingCount: number;
  successRate: number;
  byPlatform: Record<string, { success: number; failure: number; pending: number }>;
}

export interface WebhookDeliveryRatesResponse {
  ok: boolean;
  metrics?: WebhookDeliveryRates;
  projectId?: string;
  error?: string;
}

export function readWebhookDeliveryRates(projectId: string): WebhookDeliveryRatesResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    metrics: {
      successCount: 0,
      failureCount: 0,
      pendingCount: 0,
      successRate: 0,
      byPlatform: {},
    },
    projectId,
  };
}

export interface EventLatencyEntry {
  eventType: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  sampleCount: number;
}

export interface EventLatencyMetricsResponse {
  ok: boolean;
  entries: EventLatencyEntry[];
  projectId?: string;
  error?: string;
}

export function readEventLatencyMetrics(projectId: string): EventLatencyMetricsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      entries: [],
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    entries: [],
    projectId,
  };
}

export interface RoutingStatEntry {
  platform: string;
  mappingCount: number;
  eventTypes: string[];
  lastRoutedAt: string;
}

export interface RoutingStatisticsResponse {
  ok: boolean;
  stats: RoutingStatEntry[];
  projectId?: string;
  error?: string;
}

export function readRoutingStatistics(projectId: string): RoutingStatisticsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      stats: [],
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    stats: [],
    projectId,
  };
}

export interface PipelineHealthComponent {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface PipelineHealth {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: Record<string, PipelineHealthComponent>;
}

export interface PipelineHealthResponse {
  ok: boolean;
  health?: PipelineHealth;
  projectId?: string;
  error?: string;
}

export function readPipelineHealth(projectId: string): PipelineHealthResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    health: {
      score: 100,
      status: 'healthy',
      components: {},
    },
    projectId,
  };
}
