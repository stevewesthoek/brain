import type { BrainConsoleViewState } from './view.js';
import type { BrainCoreStatus, BrainCoreRuntimeReportSummary } from './client.js';

export type ConnectionStatus = 'online' | 'degraded' | 'offline';
export type AttentionLevel = 'clear' | 'watch' | 'review' | 'blocked';

export interface DashboardSnapshot {
  connectionStatus: ConnectionStatus;
  attentionLevel: AttentionLevel;
  attentionScore: number;
  brainCoreOnline: boolean;
  wikiHealthOk: boolean;
  wikiHealthWarnings: number;
  wikiHealthErrors: number;
  maintenanceCount: number;
  approvalsCount: number;
  schedulerHealthy: boolean;
  nextAction: string;
  refreshedAt?: Date;
  brainCoreUrl: string;
}

export function deriveDashboardSnapshot(state: BrainConsoleViewState, brainCoreUrl: string): DashboardSnapshot {
  const brainCoreOnline = state.status?.ok === true;
  const offline = state.offline === true;

  // Connection status
  const connectionStatus: ConnectionStatus = offline
    ? 'offline'
    : !brainCoreOnline && state.warning
    ? 'degraded'
    : 'online';

  // Wiki health
  const modelRouterReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  const wikiHealth = modelRouterReport?.wikiHealth;
  const wikiHealthOk = wikiHealth?.ok === true;
  const wikiHealthWarnings = wikiHealth?.warningCount ?? 0;
  const wikiHealthErrors = wikiHealth?.errorCount ?? 0;

  // Maintenance queue
  const maintenanceCount = (state.mindPreviews ?? []).filter((p) => !p.expired).length;

  // Approvals
  const approvalsCount = state.approvals?.length ?? 0;

  // Scheduler
  const schedulerHealthy = state.schedulerStatus?.latestRunStatus !== 'failed';

  // Calculate attention score (0-100)
  let attentionScore = 0;
  if (offline) attentionScore = 100;
  else if (wikiHealthErrors > 0) attentionScore = 85;
  else if (approvalsCount > 0 || maintenanceCount > 0) attentionScore = 50;
  else if (wikiHealthWarnings > 0) attentionScore = 30;
  else attentionScore = 10;

  // Attention level
  const attentionLevel: AttentionLevel =
    offline ? 'blocked' :
    attentionScore >= 70 ? 'review' :
    attentionScore >= 40 ? 'watch' :
    'clear';

  // Next action
  const nextAction = deriveNextAction(state, attentionLevel);

  return {
    connectionStatus,
    attentionLevel,
    attentionScore,
    brainCoreOnline,
    wikiHealthOk,
    wikiHealthWarnings,
    wikiHealthErrors,
    maintenanceCount,
    approvalsCount,
    schedulerHealthy,
    nextAction,
    refreshedAt: new Date(),
    brainCoreUrl,
  };
}

function deriveNextAction(state: BrainConsoleViewState, level: AttentionLevel): string {
  if (state.offline) return 'Start Brain Core to load live data';

  const blockers = state.executionReadiness?.blockers ?? [];
  if (blockers.length > 0) return `Blocked: ${blockers[0]}`;

  const readyCount = state.executionReadiness?.readyCandidateCount ?? 0;
  if (readyCount > 0) return `${readyCount} candidate(s) ready`;

  if ((state.approvals ?? []).length > 0) return 'Review pending approvals';
  if ((state.mindPreviews ?? []).filter(p => !p.expired).length > 0) return 'Review maintenance queue';

  return 'System healthy, all clear';
}

export function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return 'never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const ms = now - d.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getConnectionStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'online': return '#22c55e'; // green
    case 'degraded': return '#eab308'; // yellow
    case 'offline': return '#ef4444'; // red
  }
}

export function getAttentionBadgeColor(level: AttentionLevel): string {
  switch (level) {
    case 'clear': return '#22c55e';
    case 'watch': return '#eab308';
    case 'review': return '#f97316';
    case 'blocked': return '#ef4444';
  }
}
