/**
 * Video Orchestrator — Workflow Orchestration & Automation
 *
 * Provides write and read operations for:
 * - Automation rules (conditions + actions)
 * - Scheduled workflows
 * - Webhook integrations
 * - State machine transitions
 * - Audit trails
 */

import { requestAction } from './actions.js';

export interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAutomationRuleRequest {
  projectId: string;
  name: string;
  condition: string;
  action: string;
}

export interface CreateAutomationRuleResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    rule: AutomationRule;
  };
  error?: string;
}

export function createAutomationRuleRequest(
  request: CreateAutomationRuleRequest,
): CreateAutomationRuleResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.name?.trim()) {
    errors.push('name is required');
  }
  if (!request.condition?.trim()) {
    errors.push('condition is required');
  }
  if (!request.action?.trim()) {
    errors.push('action is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const ruleId = `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-automation-rule-create');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      rule: {
        id: ruleId,
        name: request.name,
        condition: request.condition,
        action: request.action,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    },
  };
}

export interface BulkApproveRequest {
  packageIds: string[];
  approvalType: 'thumbnail' | 'metadata' | 'final_review';
}

export interface BulkApproveResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    batch: {
      packageCount: number;
      approvalType: string;
      status: string;
    };
  };
  error?: string;
}

export function bulkApproveRequest(request: BulkApproveRequest): BulkApproveResponse {
  const errors: string[] = [];

  if (!Array.isArray(request.packageIds) || request.packageIds.length === 0) {
    errors.push('packageIds must be a non-empty array');
  }

  for (let i = 0; i < (request.packageIds?.length ?? 0); i++) {
    if (!request.packageIds[i]?.trim()) {
      errors.push(`packageIds[${i}] is required`);
    }
  }

  if (!request.approvalType?.trim()) {
    errors.push('approvalType is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-bulk-approve');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      batch: {
        packageCount: request.packageIds.length,
        approvalType: request.approvalType,
        status: 'approving',
      },
    },
  };
}

export interface ScheduleWorkflowRequest {
  packageIds: string[];
  cronExpression: string;
  action: string;
}

export interface ScheduleWorkflowResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    schedule: {
      id: string;
      packageCount: number;
      cronExpression: string;
      action: string;
      status: string;
    };
  };
  error?: string;
}

export function scheduleWorkflowRequest(
  request: ScheduleWorkflowRequest,
): ScheduleWorkflowResponse {
  const errors: string[] = [];

  if (!Array.isArray(request.packageIds) || request.packageIds.length === 0) {
    errors.push('packageIds must be a non-empty array');
  }
  if (!request.cronExpression?.trim()) {
    errors.push('cronExpression is required');
  }
  if (!request.action?.trim()) {
    errors.push('action is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const scheduleId = `schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-schedule-workflow');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      schedule: {
        id: scheduleId,
        packageCount: request.packageIds.length,
        cronExpression: request.cronExpression,
        action: request.action,
        status: 'scheduled',
      },
    },
  };
}

export interface RegisterWebhookRequest {
  projectId: string;
  url: string;
  events: string[];
}

export interface RegisterWebhookResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    webhook: {
      id: string;
      url: string;
      events: string[];
      secret: string;
      status: string;
    };
  };
  error?: string;
}

export function registerWebhookRequest(
  request: RegisterWebhookRequest,
): RegisterWebhookResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.url?.trim()) {
    errors.push('url is required');
  }
  if (!Array.isArray(request.events) || request.events.length === 0) {
    errors.push('events must be a non-empty array');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const webhookId = `webhook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const secret = Math.random().toString(36).slice(2, 32);

  const result = requestAction('custom-webhook-register');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      webhook: {
        id: webhookId,
        url: request.url,
        events: request.events,
        secret,
        status: 'active',
      },
    },
  };
}

export interface AutomationRuleEntry {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface AutomationRulesResponse {
  ok: boolean;
  rules: AutomationRuleEntry[];
  count: number;
  projectId?: string;
  error?: string;
}

export interface ScheduleEntry {
  id: string;
  packageCount: number;
  cronExpression: string;
  action: string;
  status: string;
  nextRunAt?: string;
  lastRunAt?: string;
}

export interface SchedulesResponse {
  ok: boolean;
  schedules: ScheduleEntry[];
  count: number;
  projectId?: string;
  error?: string;
}

export interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  status: string;
  createdAt: string;
  lastTriggeredAt?: string;
  deliveryCount: number;
  failureCount: number;
}

export interface WebhooksResponse {
  ok: boolean;
  webhooks: WebhookEntry[];
  count: number;
  projectId?: string;
  error?: string;
}

export interface ExecutionAuditEntry {
  id: string;
  timestamp: string;
  eventType: string;
  packageId?: string;
  ruleId?: string;
  scheduleId?: string;
  webhookId?: string;
  status: string;
  details: Record<string, unknown>;
}

export interface ExecutionAuditResponse {
  ok: boolean;
  entries: ExecutionAuditEntry[];
  count: number;
  projectId?: string;
  error?: string;
}

export function readAutomationRules(projectId: string): AutomationRulesResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      rules: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    rules: [],
    count: 0,
    projectId,
  };
}

export function readSchedules(projectId: string): SchedulesResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      schedules: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    schedules: [],
    count: 0,
    projectId,
  };
}

export function readWebhooks(projectId: string): WebhooksResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      webhooks: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    webhooks: [],
    count: 0,
    projectId,
  };
}

export function readExecutionAudit(
  projectId: string,
  limit: number = 50,
): ExecutionAuditResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (limit < 1 || limit > 500) {
    errors.push('limit must be between 1 and 500');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      entries: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    entries: [],
    count: 0,
    projectId,
  };
}

export interface RotateWebhookSecretRequest {
  webhookId: string;
  projectId: string;
}

export interface RotateWebhookSecretResponse {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    webhook?: {
      id: string;
      projectId: string;
      newSecret: string;
      rotatedAt: string;
      status: string;
    };
  };
  error?: string;
}

export function rotateWebhookSecretRequest(
  request: RotateWebhookSecretRequest,
): RotateWebhookSecretResponse {
  const errors: string[] = [];

  if (!request.webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-webhook-rotate-secret');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const newSecret = Math.random().toString(36).slice(2, 32);
  const now = new Date().toISOString();

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      webhook: {
        id: request.webhookId,
        projectId: request.projectId,
        newSecret,
        rotatedAt: now,
        status: 'active',
      },
    },
  };
}

export interface DisableWebhookRequest {
  webhookId: string;
  projectId: string;
  reason: string;
}

export interface DisableWebhookResponse {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    webhook?: {
      id: string;
      projectId: string;
      reason: string;
      disabledAt: string;
      status: string;
    };
  };
  error?: string;
}

export function disableWebhookRequest(
  request: DisableWebhookRequest,
): DisableWebhookResponse {
  const errors: string[] = [];

  if (!request.webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.reason?.trim()) {
    errors.push('reason is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-webhook-disable');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const now = new Date().toISOString();

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      webhook: {
        id: request.webhookId,
        projectId: request.projectId,
        reason: request.reason,
        disabledAt: now,
        status: 'disabled',
      },
    },
  };
}

export interface WebhookSecurityAuditEntry {
  id: string;
  webhookId: string;
  event: string;
  actor: string;
  at: string;
  detail?: string;
}

export interface WebhookSecurityAuditResponse {
  ok: boolean;
  entries: WebhookSecurityAuditEntry[];
  count: number;
  webhookId?: string;
  projectId?: string;
  error?: string;
}

export function readWebhookSecurityAudit(
  webhookId: string,
  projectId: string,
  limit?: number,
): WebhookSecurityAuditResponse {
  const errors: string[] = [];
  const finalLimit = limit ?? 50;

  if (!webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (finalLimit < 1 || finalLimit > 500) {
    errors.push('limit must be between 1 and 500');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      entries: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    entries: [],
    count: 0,
    webhookId,
    projectId,
  };
}

export interface WebhookStatus {
  webhookId: string;
  status: 'active' | 'disabled' | 'rate-limited';
  lastDeliveryAt?: string;
  deliveryCount: number;
  failureCount: number;
  secretRotatedAt?: string;
}

export interface WebhookStatusResponse {
  ok: boolean;
  status?: WebhookStatus;
  webhookId?: string;
  error?: string;
}

export function readWebhookStatus(
  webhookId: string,
): WebhookStatusResponse {
  const errors: string[] = [];

  if (!webhookId?.trim()) {
    errors.push('webhookId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    status: {
      webhookId,
      status: 'active',
      deliveryCount: 0,
      failureCount: 0,
    },
    webhookId,
  };
}
