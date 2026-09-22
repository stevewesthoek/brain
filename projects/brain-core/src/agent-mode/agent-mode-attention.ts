import { createHash } from 'node:crypto';

export const AGENT_MODE_ATTENTION_SCHEMA_VERSION = 'agent-mode-attention-v1' as const;
export const AGENT_MODE_NOTIFICATION_READ_SCHEMA_VERSION = 'agent-mode-notification-read-v1' as const;
export const AGENT_MODE_ATTENTION_MAX_ITEMS = 100;

export type AgentModeEscalationKind =
  | 'uncertain_attempt'
  | 'scheduler_dead_letter'
  | 'workcell_validation_failure';

export type AgentModeEscalationSeverity = 'warning' | 'critical';
export type AgentModeEscalationStatus = 'open' | 'resolved';
export type AgentModeAttentionSourceType = 'attempt' | 'scheduler_event' | 'scheduler_schedule' | 'workcell_validation';
export type AgentModeNotificationKind = 'operator_escalation' | 'pending_review' | 'uncertain_attempt' | 'scheduler_dead_letter';

export type AgentModeEscalation = {
  schemaVersion: typeof AGENT_MODE_ATTENTION_SCHEMA_VERSION;
  escalationId: string;
  kind: AgentModeEscalationKind;
  severity: AgentModeEscalationSeverity;
  rootGoalId: string | null;
  agentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  workcellId: string | null;
  reviewId: string | null;
  sourceType: AgentModeAttentionSourceType;
  sourceId: string;
  reasonCode: string;
  status: AgentModeEscalationStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type AgentModeNotification = {
  schemaVersion: typeof AGENT_MODE_ATTENTION_SCHEMA_VERSION;
  notificationId: string;
  kind: AgentModeNotificationKind;
  severity: AgentModeEscalationSeverity;
  sourceType: AgentModeAttentionSourceType | 'review';
  sourceId: string;
  escalationId: string | null;
  reviewId: string | null;
  rootGoalId: string | null;
  agentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  workcellId: string | null;
  titleCode: string;
  messageCode: string;
  createdAt: string;
  read: boolean | null;
  readAt: string | null;
};

export type AgentModeNotificationReadReceipt = {
  notificationId: string;
  operatorId: string;
  readAt: string;
};

export type AgentModeAttentionSummary = {
  openEscalationCount: number;
  pendingReviewCount: number;
  uncertainItemCount: number;
  deadLetterCount: number;
  notificationCount: number;
  unreadNotificationCount: number | null;
};

export type AgentModeAttentionReconcileResult = {
  createdEscalations: number;
  resolvedEscalations: number;
  createdNotifications: number;
  existingNotifications: number;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function attentionHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function deriveEscalationId(input: Pick<AgentModeEscalation, 'kind' | 'sourceType' | 'sourceId' | 'reasonCode'>): string {
  return `agent-mode-escalation:${attentionHash({ kind: input.kind, sourceType: input.sourceType, sourceId: input.sourceId, reasonCode: input.reasonCode })}`;
}

export function deriveNotificationId(input: { kind: AgentModeNotificationKind; sourceType: string; sourceId: string; transitionId: string }): string {
  return `agent-mode-notification:${attentionHash({ kind: input.kind, sourceType: input.sourceType, sourceId: input.sourceId, transitionId: input.transitionId })}`;
}

export function escalationMaterial(escalation: AgentModeEscalation): string {
  return canonicalJson({
    schemaVersion: escalation.schemaVersion,
    escalationId: escalation.escalationId,
    kind: escalation.kind,
    severity: escalation.severity,
    rootGoalId: escalation.rootGoalId,
    agentId: escalation.agentId,
    taskId: escalation.taskId,
    runId: escalation.runId,
    attemptId: escalation.attemptId,
    workcellId: escalation.workcellId,
    reviewId: escalation.reviewId,
    sourceType: escalation.sourceType,
    sourceId: escalation.sourceId,
    reasonCode: escalation.reasonCode,
  });
}

export function notificationMaterial(notification: AgentModeNotification): string {
  return canonicalJson({
    schemaVersion: notification.schemaVersion,
    notificationId: notification.notificationId,
    kind: notification.kind,
    severity: notification.severity,
    sourceType: notification.sourceType,
    sourceId: notification.sourceId,
    escalationId: notification.escalationId,
    reviewId: notification.reviewId,
    rootGoalId: notification.rootGoalId,
    agentId: notification.agentId,
    taskId: notification.taskId,
    runId: notification.runId,
    attemptId: notification.attemptId,
    workcellId: notification.workcellId,
    titleCode: notification.titleCode,
    messageCode: notification.messageCode,
    createdAt: notification.createdAt,
  });
}

export function readReceiptId(notificationId: string, operatorId: string): string {
  return `agent-mode-notification-read:${attentionHash({ notificationId, operatorId })}`;
}
