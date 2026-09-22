import { createHash } from 'node:crypto';

export const EXECUTION_TELEMETRY_SCHEMA_VERSION = 'agent-mode.execution-telemetry.v1' as const;
export const MAX_TELEMETRY_EVENTS = 32;
export const MAX_SAFE_ACTIVITY_LENGTH = 160;

export type AgentModeTelemetryStatus = 'queued' | 'running' | 'waiting' | 'rate_limited' | 'blocked' | 'stalled' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';

export type AgentModeExecutionUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  cachedOutputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
};

export type AgentModeExecutionContext = {
  usedTokens: number | null;
  maximumTokens: number | null;
  percentage: number | null;
};

export type AgentModeExecutionCost = {
  estimatedUsd: number | null;
  source: 'runtime' | 'brain-pricing' | 'unavailable';
  pricingVersion: string | null;
  confidence: 'authoritative' | 'estimated' | 'unavailable';
};

export type AgentModeTelemetryEvent = {
  eventId: string;
  occurredAt: string;
  kind: 'lifecycle' | 'activity' | 'usage' | 'warning' | 'failure' | 'result';
  safeActivity: string;
  status: AgentModeTelemetryStatus | null;
};

export type AgentModeExecutionTelemetry = {
  schemaVersion: typeof EXECUTION_TELEMETRY_SCHEMA_VERSION;
  sessionId: string | null;
  runtimeRef: string;
  runtimeProfileRef: string | null;
  provider: string | null;
  modelRef: string | null;
  modelDisplayName: string | null;
  status: AgentModeTelemetryStatus;
  safeActivity: string | null;
  startedAt: string | null;
  updatedAt: string;
  elapsedMs: number | null;
  usage: AgentModeExecutionUsage;
  context: AgentModeExecutionContext;
  cost: AgentModeExecutionCost;
  events: readonly AgentModeTelemetryEvent[];
};

export type CodexTelemetryLine = {
  type: string;
  timestamp?: string;
  thread_id?: string;
  model?: string;
  provider?: string;
  context_window?: number;
  context_used_tokens?: number;
  usage?: Record<string, unknown>;
  item?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

export type ParsedCodexTelemetry = {
  event: AgentModeTelemetryEvent;
  sessionId?: string | undefined;
  modelRef?: string | undefined;
  provider?: string | undefined;
  usage?: Partial<AgentModeExecutionUsage> | undefined;
  context?: Partial<AgentModeExecutionContext> | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function integerOrNull(value: unknown): number | null {
  const result = finiteNonNegative(value);
  return result !== null && Number.isSafeInteger(result) ? result : null;
}

function boundedActivity(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, MAX_SAFE_ACTIVITY_LENGTH) || 'Working';
}

function safeActivityFor(line: CodexTelemetryLine): string {
  const itemType = isRecord(line.item) && typeof line.item.type === 'string' ? line.item.type : '';
  if (line.type === 'thread.started') return 'Codex session started';
  if (line.type === 'turn.started') return 'Working on the goal';
  if (line.type === 'turn.completed') return 'Turn completed';
  if (line.type === 'turn.failed' || line.type === 'error') return 'Codex reported an error';
  if (itemType === 'command_execution') return 'Inspecting the repository';
  if (itemType === 'mcp_tool_call') return 'Using an approved tool';
  if (itemType === 'file_change') return 'Reviewing a file change';
  if (itemType === 'agent_message') return 'Preparing the result';
  if (itemType === 'reasoning') return 'Working';
  return 'Codex activity';
}

function usageFrom(line: CodexTelemetryLine): Partial<AgentModeExecutionUsage> | undefined {
  if (!isRecord(line.usage)) return undefined;
  const usage = line.usage;
  const inputTokens = integerOrNull(usage.input_tokens ?? usage.inputTokens);
  const outputTokens = integerOrNull(usage.output_tokens ?? usage.outputTokens);
  const cachedInputTokens = integerOrNull(usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? usage.cachedInputTokens);
  const cachedOutputTokens = integerOrNull(usage.cached_output_tokens ?? usage.cache_write_input_tokens ?? usage.cachedOutputTokens);
  const reasoningTokens = integerOrNull(usage.reasoning_output_tokens ?? usage.reasoning_tokens ?? usage.reasoningTokens);
  const reportedTotalTokens = integerOrNull(usage.total_tokens ?? usage.totalTokens);
  const totalTokens = reportedTotalTokens ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens + (reasoningTokens ?? 0) : null);
  if ([inputTokens, outputTokens, cachedInputTokens, cachedOutputTokens, reasoningTokens, totalTokens].every((value) => value === null)) return undefined;
  return { inputTokens, outputTokens, cachedInputTokens, cachedOutputTokens, reasoningTokens, totalTokens };
}

function contextFrom(line: CodexTelemetryLine): Partial<AgentModeExecutionContext> | undefined {
  const maximumTokens = integerOrNull(line.context_window ?? (isRecord(line.usage) ? line.usage.context_window : undefined));
  const usedTokens = integerOrNull(line.context_used_tokens ?? (isRecord(line.usage) ? line.usage.context_used_tokens : undefined));
  if (maximumTokens === null && usedTokens === null) return undefined;
  const percentage = usedTokens !== null && maximumTokens !== null && maximumTokens > 0
    ? Math.min(100, Math.max(0, Number(((usedTokens / maximumTokens) * 100).toFixed(1))))
    : null;
  return { usedTokens, maximumTokens, percentage };
}

function eventKind(type: string): AgentModeTelemetryEvent['kind'] {
  if (type.includes('error') || type.includes('failed')) return 'failure';
  if (type === 'turn.completed' || type === 'item.completed') return 'result';
  if (type === 'turn.started' || type === 'thread.started') return 'lifecycle';
  if (type.includes('usage')) return 'usage';
  return 'activity';
}

export function parseCodexTelemetryLine(line: string, index = 0): ParsedCodexTelemetry | null {
  if (line.trim().length === 0) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(line); } catch { return null; }
  if (!isRecord(parsed) || typeof parsed.type !== 'string' || parsed.type.length > 96) return null;
  const codexLine = parsed as CodexTelemetryLine;
  const occurredAt = typeof codexLine.timestamp === 'string' && Number.isFinite(Date.parse(codexLine.timestamp)) ? codexLine.timestamp : new Date().toISOString();
  const safeActivity = safeActivityFor(codexLine);
  const status: AgentModeTelemetryStatus | null = codexLine.type === 'turn.completed' ? 'running' : codexLine.type === 'turn.failed' || codexLine.type === 'error' ? 'failed' : 'running';
  const eventMaterial = JSON.stringify({ index, type: codexLine.type, occurredAt, safeActivity });
  return {
    event: {
      eventId: `telemetry-event:sha256:${createHash('sha256').update(eventMaterial).digest('hex')}`,
      occurredAt,
      kind: eventKind(codexLine.type),
      safeActivity,
      status,
    },
    ...(typeof codexLine.thread_id === 'string' ? { sessionId: codexLine.thread_id.slice(0, 256) } : {}),
    ...(typeof codexLine.model === 'string' ? { modelRef: codexLine.model.slice(0, 256) } : {}),
    ...(typeof codexLine.provider === 'string' ? { provider: codexLine.provider.slice(0, 128) } : {}),
    ...(usageFrom(codexLine) ? { usage: usageFrom(codexLine) } : {}),
    ...(contextFrom(codexLine) ? { context: contextFrom(codexLine) } : {}),
  };
}

export function emptyExecutionTelemetry(input: { runtimeRef: string; runtimeProfileRef?: string | null; startedAt?: string | null; modelRef?: string | null }): AgentModeExecutionTelemetry {
  return {
    schemaVersion: EXECUTION_TELEMETRY_SCHEMA_VERSION,
    sessionId: null,
    runtimeRef: input.runtimeRef,
    runtimeProfileRef: input.runtimeProfileRef ?? null,
    provider: null,
    modelRef: input.modelRef ?? null,
    modelDisplayName: null,
    status: 'running',
    safeActivity: 'Starting runtime',
    startedAt: input.startedAt ?? null,
    updatedAt: input.startedAt ?? new Date().toISOString(),
    elapsedMs: null,
    usage: { inputTokens: null, outputTokens: null, cachedInputTokens: null, cachedOutputTokens: null, reasoningTokens: null, totalTokens: null },
    context: { usedTokens: null, maximumTokens: null, percentage: null },
    cost: { estimatedUsd: null, source: 'unavailable', pricingVersion: null, confidence: 'unavailable' },
    events: [],
  };
}

export function applyCodexTelemetry(current: AgentModeExecutionTelemetry, parsed: ParsedCodexTelemetry): AgentModeExecutionTelemetry {
  const updatedAt = parsed.event.occurredAt;
  const usage = { ...current.usage, ...(parsed.usage ?? {}) };
  const context = { ...current.context, ...(parsed.context ?? {}) };
  const events = [...current.events.filter((event) => event.eventId !== parsed.event.eventId), parsed.event].slice(-MAX_TELEMETRY_EVENTS);
  const startedAt = current.startedAt ?? updatedAt;
  const elapsedMs = Date.parse(startedAt) <= Date.parse(updatedAt) ? Date.parse(updatedAt) - Date.parse(startedAt) : null;
  return {
    ...current,
    sessionId: parsed.sessionId ?? current.sessionId,
    provider: parsed.provider ?? current.provider,
    modelRef: parsed.modelRef ?? current.modelRef,
    status: parsed.event.status ?? current.status,
    safeActivity: parsed.event.safeActivity,
    startedAt,
    updatedAt,
    elapsedMs,
    usage,
    context: { ...context, percentage: context.usedTokens !== null && context.maximumTokens !== null && context.maximumTokens > 0 ? Number(((context.usedTokens / context.maximumTokens) * 100).toFixed(1)) : context.percentage },
    events,
  };
}

export function finishExecutionTelemetry(current: AgentModeExecutionTelemetry, status: Exclude<AgentModeTelemetryStatus, 'queued' | 'running' | 'waiting' | 'rate_limited' | 'blocked' | 'stalled'>, updatedAt: string): AgentModeExecutionTelemetry {
  const startedAt = current.startedAt;
  const safeActivity = status === 'succeeded' ? 'Result available' : status === 'cancelled' ? 'Cancelled by Brain policy' : status === 'failed' ? 'Execution failed' : 'Runtime uncertain';
  const kind: AgentModeTelemetryEvent['kind'] = status === 'succeeded' ? 'result' : status === 'failed' ? 'failure' : 'lifecycle';
  const terminalEvent: AgentModeTelemetryEvent = { eventId: `telemetry-terminal:${status}:${updatedAt}`, occurredAt: updatedAt, kind, safeActivity, status };
  return { ...current, status, safeActivity, updatedAt, elapsedMs: startedAt && Date.parse(updatedAt) >= Date.parse(startedAt) ? Date.parse(updatedAt) - Date.parse(startedAt) : current.elapsedMs, events: [...current.events, terminalEvent].slice(-MAX_TELEMETRY_EVENTS) };
}

export function validateExecutionTelemetry(value: unknown): value is AgentModeExecutionTelemetry {
  if (!isRecord(value) || value.schemaVersion !== EXECUTION_TELEMETRY_SCHEMA_VERSION || typeof value.runtimeRef !== 'string' || typeof value.status !== 'string' || !isRecord(value.usage) || !isRecord(value.context) || !isRecord(value.cost) || !Array.isArray(value.events) || value.events.length > MAX_TELEMETRY_EVENTS) return false;
  const usage = value.usage;
  const context = value.context;
  const cost = value.cost;
  const usageValid = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cachedOutputTokens', 'reasoningTokens', 'totalTokens'].every((key) => usage[key] === null || (Number.isSafeInteger(usage[key]) && Number(usage[key]) >= 0));
  const contextValid = ['usedTokens', 'maximumTokens', 'percentage'].every((key) => context[key] === null || (typeof context[key] === 'number' && Number.isFinite(context[key]) && Number(context[key]) >= 0));
  const costValid = (cost.estimatedUsd === null || (typeof cost.estimatedUsd === 'number' && Number.isFinite(cost.estimatedUsd) && cost.estimatedUsd >= 0)) && ['runtime', 'brain-pricing', 'unavailable'].includes(String(cost.source)) && ['authoritative', 'estimated', 'unavailable'].includes(String(cost.confidence));
  return usageValid && contextValid && costValid && value.events.every((event) => isRecord(event) && typeof event.eventId === 'string' && typeof event.occurredAt === 'string' && typeof event.safeActivity === 'string');
}
