import type { TerminalExecutionStatus } from './terminal-intake.js';
import { renderTerminalMarkdown } from './terminal-markdown.js';
import { buildJarvisRoutingDisclosure, describeJarvisReflexStatus, hasJarvisRoutingFacts, hasUnsupportedToolCallText, isJarvisRoutingQuestion } from './jarvis-routing-transparency.js';

export const TERMINAL_CONSOLE_POLL_MS = 1_000;
const FINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'uncertain']);
const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];
const ANSI = {
  reset: '\u001b[0m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  dim: '\u001b[2m',
};

export type TerminalConsoleStream = {
  write(value: string): boolean | void;
  isTTY?: boolean;
  columns?: number;
};

export type TerminalConsoleInput = {
  isTTY?: boolean;
  setRawMode?: (value: boolean) => TerminalConsoleInput;
  resume?: () => void;
  pause?: () => void;
  on?: (event: 'data' | 'keypress' | 'resize', listener: (...args: unknown[]) => void) => TerminalConsoleInput;
  removeListener?: (event: 'data' | 'keypress' | 'resize', listener: (...args: unknown[]) => void) => TerminalConsoleInput;
};

export type TerminalConsoleOptions = {
  rootGoalId: string;
  startedAt?: string;
  readStatus: () => Promise<TerminalExecutionStatus>;
  output?: TerminalConsoleStream;
  errorOutput?: TerminalConsoleStream;
  input?: TerminalConsoleInput;
  isTTY?: boolean;
  json?: boolean;
  color?: boolean;
  width?: number;
  clock?: () => number;
  pollMs?: number;
  onCancel?: () => Promise<string>;
};

export type TerminalSubmissionFeedbackOptions = {
  output: TerminalConsoleStream;
  color?: boolean;
  clock?: () => number;
  intervalMs?: number;
};

export type TerminalSubmissionFeedback = { stop: () => void };

export type TerminalConsoleTiming = {
  submittedAtMs: number;
  firstFeedbackMs: number | null;
  firstStatusMs: number | null;
  routeVisibleMs: number | null;
  firstRuntimeEventMs: number | null;
  firstVisibleResultMs: number | null;
  resultCompletedMs: number | null;
  finalRenderMs: number | null;
};

export type TerminalConsoleResult = {
  detached: boolean;
  status: TerminalExecutionStatus | null;
  timing: TerminalConsoleTiming;
};

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? 'unavailable' : value.toLocaleString('en-US');
}

function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'unavailable';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatCost(value: number | null | undefined): string {
  return value === null || value === undefined ? 'unavailable' : `$${value.toFixed(4)} est.`;
}

function formatElapsed(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) return '—';
  const seconds = Math.floor(value / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

/** Shows bounded progress while the authenticated intake request is pending. */
export function startTerminalSubmissionFeedback(options: TerminalSubmissionFeedbackOptions): TerminalSubmissionFeedback {
  const now = options.clock ?? (() => Date.now());
  const startedAt = now();
  const color = options.color ?? false;
  const frame = (index: number): string => {
    const elapsed = formatElapsed(Math.max(0, now() - startedAt));
    const spinner = SPINNER_FRAMES[index % SPINNER_FRAMES.length] ?? '|';
    return `${paint(spinner, 'cyan', color)} ${paint('Jarvis', 'cyan', color)} · Auto → evaluating · ${elapsed}`;
  };
  let frameIndex = 0;
  options.output.write(`\n${frame(frameIndex)}`);
  const timer = setInterval(() => {
    frameIndex += 1;
    options.output.write(`\r\u001b[2K${frame(frameIndex)}`);
  }, Math.max(100, options.intervalMs ?? 250));
  (timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      options.output.write('\r\u001b[2K');
    },
  };
}

function currentElapsed(status: TerminalExecutionStatus, nowMs?: number, fallbackStartedAt?: string): number | null {
  if (status.status !== 'running' && status.status !== 'queued') return status.elapsedMs;
  const started = Date.parse(status.startedAt ?? fallbackStartedAt ?? '');
  if (nowMs !== undefined && Number.isFinite(started) && nowMs >= started) return nowMs - started;
  return status.elapsedMs;
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function fit(value: string, width: number): string {
  const normalized = clean(value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, ''));
  if (width <= 0) return '';
  if (normalized.length <= width) return value;
  if (width <= 1) return normalized.slice(0, width);
  return `${normalized.slice(0, width - 1)}…`;
}

function modelLabel(value: string | null | undefined): string {
  if (!value) return 'selecting…';
  if (value === 'agent-mode/minimax-m2.5') return 'MiniMax M2.5';
  if (value === 'agent-mode/glm-5') return 'GLM-5';
  if (value === 'agent-mode/claude-opus-4.6') return 'Opus 4.6';
  if (value === 'model:deferred') return 'selecting…';
  if (value === 'codex-cli' || value === 'runtime:codex-cli') return 'Codex escalation';
  return value.startsWith('agent-mode/') ? value.slice('agent-mode/'.length) : value;
}

function wrap(value: string, width: number, maxLines = 64): string[] {
  const normalized = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
  const lines: string[] = [];
  for (const original of normalized.split(/\r?\n/u)) {
    const line = original.trimEnd();
    if (line.length === 0) {
      lines.push('');
      continue;
    }
    for (let offset = 0; offset < line.length && lines.length < maxLines; offset += width) lines.push(line.slice(offset, offset + width));
    if (lines.length >= maxLines) break;
  }
  return lines.slice(0, maxLines);
}

function paint(value: string, color: keyof typeof ANSI | null, enabled: boolean): string {
  return enabled && color ? `${ANSI[color]}${value}${ANSI.reset}` : value;
}

function statusColor(status: TerminalExecutionStatus['status']): keyof typeof ANSI {
  if (status === 'completed') return 'green';
  if (status === 'failed' || status === 'uncertain') return 'red';
  if (status === 'cancelled') return 'yellow';
  return 'cyan';
}

function statusLabel(status: TerminalExecutionStatus['status']): string {
  return status === 'completed' ? 'completed' : status;
}

function telemetryLine(status: TerminalExecutionStatus, expanded: boolean): string {
  const telemetry = status.telemetry;
  const usage = telemetry?.usage;
  const context = telemetry?.context;
  const contextText = context?.usedTokens !== null && context?.usedTokens !== undefined && context?.maximumTokens !== null && context?.maximumTokens !== undefined
    ? `Context ${formatTokens(context.usedTokens)} / ${formatTokens(context.maximumTokens)} · ${context.percentage ?? '—'}%`
    : null;
  const parts = [
    usage?.totalTokens !== null && usage?.totalTokens !== undefined ? `Tokens ${formatTokens(usage.totalTokens)}` : null,
    contextText,
    telemetry?.cost.estimatedUsd !== null && telemetry?.cost.estimatedUsd !== undefined ? `Cost ${formatCost(telemetry.cost.estimatedUsd)}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : expanded ? 'Usage unavailable' : '';
}

export function renderTerminalConsole(status: TerminalExecutionStatus, options: { expanded?: boolean; width?: number; color?: boolean; nowMs?: number; spinnerIndex?: number; startedAt?: string } = {}): string {
  const expanded = options.expanded ?? false;
  const width = Math.max(20, Math.min(options.width ?? 120, 180));
  const color = options.color ?? false;
  const repository = status.repositoryRef ?? 'bounded context';
  const requested = status.requestedModel === 'auto' ? 'Auto' : modelLabel(status.requestedModel);
  const effective = status.modelRef && status.modelRef !== 'model:deferred' ? modelLabel(status.modelRef) : null;
  const model = effective && status.requestedModel === 'auto' ? `${requested} → ${effective}` : effective ?? requested;
  const runtime = status.runtimeRef?.replace(/^runtime:/u, '') ?? 'pending';
  const access = status.repositoryRef ? 'read-only' : 'bounded context';
  const agentLabel = `${formatCount(status.workerCount)} agent${status.workerCount === 1 ? '' : 's'}`;
  const elapsed = formatElapsed(currentElapsed(status, options.nowMs, options.startedAt));
  const reflex = status.reflex
    ? describeJarvisReflexStatus(status.reflex)
    : status.reflexPhase === 'preflight' ? 'Jev ◐ preflight' : 'Jev status not recorded';
  const header = `${paint('Jarvis', 'cyan', color)} · ${fit(repository, Math.max(12, width - 46))}    ${fit(model, 18)} · ${fit(runtime, 18)}`;
  const reason = status.reasonCode === 'MODEL_GATEWAY_ACCOUNT_ACCESS_UNAVAILABLE'
    ? 'Bedrock account access unavailable'
    : status.reasonCode?.startsWith('MODEL_GATEWAY_') ? status.reasonCode.replace('MODEL_GATEWAY_', 'provider ').toLowerCase().replaceAll('_', ' ') : null;
  const state = `${status.status === 'running' ? '●' : status.status === 'completed' ? '✓' : status.status === 'failed' || status.status === 'uncertain' ? '!' : '·'} ${statusLabel(status.status)}${reason ? ` · ${reason}` : ''} · ${agentLabel} · ${access}`;
  const activity = status.safeActivity ?? (status.status === 'running' ? 'Working' : 'No activity recorded');
  const spinner = SPINNER_FRAMES[(options.spinnerIndex ?? 0) % SPINNER_FRAMES.length] ?? '|';
  const lines = [
    fit(`┌─ ${header}`, width),
    fit(`│ ${fit(`${status.requestedModel === 'auto' ? 'Auto' : model} · ${reflex} · ${elapsed}`, Math.max(1, width - 2))}`, width),
    paint(fit(state, width), statusColor(status.status), color),
    `${paint(status.status === 'running' || status.status === 'queued' ? spinner : '✓', status.status === 'running' ? 'cyan' : statusColor(status.status), color)} ${fit(activity ?? 'Working', Math.max(1, width - 2))}`,
  ];
  const telemetry = telemetryLine(status, expanded);
  if (telemetry) lines.push(fit(telemetry, width));
  const history = status.conversationHistory ?? [];
  const displayedHistoryTexts: string[] = [];
  let displayResultText = status.resultText && hasUnsupportedToolCallText(status.resultText)
    ? 'No tool was executed; the selected runtime returned an unsupported tool request.'
    : status.resultText;
  let latestJarvisIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.speakerRole === 'jarvis') { latestJarvisIndex = index; break; }
  }
  const latestJarvisTurn = latestJarvisIndex >= 0 ? history[latestJarvisIndex] : undefined;
  const latestJarvisQuestion = latestJarvisIndex > 0 ? history[latestJarvisIndex - 1] : undefined;
  if (latestJarvisTurn && latestJarvisQuestion?.speakerRole === 'user'
    && Boolean(latestJarvisTurn.rootGoalId && latestJarvisQuestion.rootGoalId === latestJarvisTurn.rootGoalId)
    && isJarvisRoutingQuestion(latestJarvisQuestion.text)) {
    const facts = latestJarvisTurn.routingFacts;
    displayResultText = hasJarvisRoutingFacts(facts)
      ? buildJarvisRoutingDisclosure({ requestedModel: facts.requestedModel, route: facts.runtimeRef ? { modelRef: facts.modelRef, modelId: facts.modelId, providerId: facts.providerId, runtimeRef: facts.runtimeRef, selectionReason: facts.selectionReason } : null, reflex: facts.reflex ?? null })
      : 'Brain routing metadata for this turn is not recorded; the selected model and Jev status cannot be verified.';
  }
  if (history.length > 0) {
    lines.push('');
    const boundedHistory = history.slice(-64);
    for (const [index, turn] of boundedHistory.entries()) {
      const previous = index > 0 ? boundedHistory[index - 1] : undefined;
      const displayText = hasUnsupportedToolCallText(turn.text)
        ? 'No tool was executed; the selected runtime returned an unsupported tool request.'
        : turn.speakerRole === 'jarvis' && previous?.speakerRole === 'user'
          && Boolean(turn.rootGoalId && previous.rootGoalId === turn.rootGoalId)
          && isJarvisRoutingQuestion(previous.text)
          ? hasJarvisRoutingFacts(turn.routingFacts)
            ? buildJarvisRoutingDisclosure({ requestedModel: turn.routingFacts.requestedModel, route: turn.routingFacts.runtimeRef ? { modelRef: turn.routingFacts.modelRef, modelId: turn.routingFacts.modelId, providerId: turn.routingFacts.providerId, runtimeRef: turn.routingFacts.runtimeRef, selectionReason: turn.routingFacts.selectionReason } : null, reflex: turn.routingFacts.reflex ?? null })
            : 'Brain routing metadata for this turn is not recorded; the selected model and Jev status cannot be verified.'
          : turn.text;
      displayedHistoryTexts.push(displayText);
      lines.push(paint(turn.speakerRole === 'user' ? 'You' : 'Jarvis', turn.speakerRole === 'user' ? 'dim' : 'cyan', color));
      lines.push(...renderTerminalMarkdown(displayText, { width, color }));
      if (turn.status !== 'completed') lines.push(paint(`[${turn.status}]`, 'yellow', color));
      lines.push('');
    }
    if (lines.at(-1) === '') lines.pop();
    const normalizeDisplayText = (value: string): string => value.replace(/\s+/gu, ' ').trim();
    if (displayResultText && !displayedHistoryTexts.some((text) => normalizeDisplayText(text) === normalizeDisplayText(displayResultText))) {
      lines.push('', paint('Jarvis', 'cyan', color), ...renderTerminalMarkdown(displayResultText.slice(0, 12_000), { width, color }));
    }
  } else if (displayResultText) {
    lines.push('', paint('Jarvis', 'cyan', color));
    lines.push(...renderTerminalMarkdown(displayResultText.slice(0, 12_000), { width, color }));
  }
  if (expanded) {
    const detailRows = [
      `Root      ${status.rootGoalId}`,
      `Task      ${status.childTaskId ?? '—'}`,
      `Run       ${status.childRunId ?? '—'}`,
      `Attempt   ${status.attemptId ?? '—'}`,
      `Worker    ${status.childAgentId ?? '—'}`,
      `Result    ${status.resultRef ?? '—'}`,
      `Evidence  ${status.evidenceRef ?? '—'}`,
      `Elapsed   ${formatElapsed(currentElapsed(status, options.nowMs, options.startedAt))}`,
      `Jev       ${status.reflex ? `${status.reflex.mode} · ${status.reflex.status}` : 'skipped'}`,
      `Route     ${status.requestedModel === 'auto' ? `Auto → ${modelLabel(status.modelRef)}` : model}`,
      `Updated   ${status.updatedAt ?? '—'}`,
    ];
    lines.push('', paint('Details', 'dim', color), ...detailRows.map((row) => fit(row, width)));
    const events = status.activity.slice(-8);
    if (events.length > 0) lines.push('', paint('Recent activity', 'dim', color), ...events.map((event) => fit(`${event.occurredAt} · ${event.safeActivity}`, width)));
  }
  lines.push('', fit(`└─ ${paint('[i] details · [c] cancel · [d/q] detach · Ctrl-C detach', 'dim', color)}`, width));
  return lines.join('\n');
}

function lineFor(status: TerminalExecutionStatus): string {
  const activity = status.safeActivity ? ` · ${JSON.stringify(status.safeActivity)}` : '';
  return `[${status.status}] ${status.workerCount} agent${status.workerCount === 1 ? '' : 's'} · ${status.runtimeRef ?? 'runtime pending'}${activity}`;
}

function isFinal(status: TerminalExecutionStatus | null): boolean {
  return status !== null && FINAL_STATUSES.has(status.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Provider-independent Brain terminal view. It only reads the durable status endpoint. */
export async function runTerminalConsole(options: TerminalConsoleOptions): Promise<TerminalConsoleResult> {
  const output = options.output ?? process.stdout;
  const errorOutput = options.errorOutput ?? process.stderr;
  const input = options.input ?? process.stdin;
  const tty = options.isTTY ?? Boolean(output.isTTY && input.isTTY);
  const json = options.json ?? false;
  const color = options.color ?? (tty && !process.env.NO_COLOR);
  const pollMs = Math.max(250, options.pollMs ?? TERMINAL_CONSOLE_POLL_MS);
  let detached = false;
  let expanded = false;
  let lastLine = '';
  let current: TerminalExecutionStatus | null = null;
  let unavailablePolls = 0;
  let spinnerIndex = 0;
  const now = options.clock ?? (() => Date.now());
  const submittedAtMs = options.startedAt && Number.isFinite(Date.parse(options.startedAt)) ? Date.parse(options.startedAt) : now();
  const timing: TerminalConsoleTiming = { submittedAtMs, firstFeedbackMs: null, firstStatusMs: null, routeVisibleMs: null, firstRuntimeEventMs: null, firstVisibleResultMs: null, resultCompletedMs: null, finalRenderMs: null };

  const detach = (): void => { detached = true; };
  const onData = (chunk: unknown): void => {
    const value = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (value.includes('\u0003') || value === 'q' || value === 'd') detach();
    if (value === 'i') expanded = !expanded;
    if (value === 'c' && options.onCancel) void options.onCancel().then((message) => errorOutput.write(`${message}\n`)).catch(() => errorOutput.write('Cancel request unavailable; use brain-agent cancel explicitly.\n'));
  };
  const consoleWidth = (): number => options.width ?? output.columns ?? 120;
  const onResize = (): void => { if (tty && current && !detached) output.write(`\u001b[2J\u001b[H${renderTerminalConsole(current, { expanded, color, width: consoleWidth(), nowMs: options.clock?.() ?? Date.now(), spinnerIndex, ...(options.startedAt ? { startedAt: options.startedAt } : {}) })}\n`); };
  if (tty) {
    output.write('\u001b[?25l');
    output.write(`${paint('Jarvis', 'cyan', color)} · Auto → evaluating · ${SPINNER_FRAMES[0]} · 00:00\n`);
    timing.firstFeedbackMs = now() - submittedAtMs;
    input.resume?.();
    input.setRawMode?.(true);
    input.on?.('data', onData);
    input.on?.('resize', onResize);
  }
  try {
    while (!detached) {
      try {
        current = await options.readStatus();
        const observedAt = now();
        unavailablePolls = 0;
        timing.firstStatusMs ??= observedAt - submittedAtMs;
        if (current.modelRef && current.modelRef !== 'model:deferred') timing.routeVisibleMs ??= observedAt - submittedAtMs;
        if (current.activity.length > 0) timing.firstRuntimeEventMs ??= observedAt - submittedAtMs;
        if (current.resultText || current.conversationHistory?.some((turn) => turn.speakerRole === 'jarvis')) timing.firstVisibleResultMs ??= observedAt - submittedAtMs;
        if (json) {
          output.write(`${JSON.stringify({ event: current.status === 'queued' ? 'queued' : current.status === 'running' ? 'running' : current.status, rootGoalId: options.rootGoalId, status: current })}\n`);
        } else if (tty) {
          output.write(`\u001b[2J\u001b[H${renderTerminalConsole(current, { expanded, color, width: consoleWidth(), nowMs: observedAt, spinnerIndex, ...(options.startedAt ? { startedAt: options.startedAt } : {}) })}\n`);
          spinnerIndex = (spinnerIndex + 1) % SPINNER_FRAMES.length;
        } else {
          const line = lineFor(current);
          if (line !== lastLine) output.write(`${line}\n`);
          lastLine = line;
        }
        if (isFinal(current)) {
          timing.resultCompletedMs ??= observedAt - submittedAtMs;
          timing.finalRenderMs = now() - submittedAtMs;
          return { detached: false, status: current, timing };
        }
      } catch {
        unavailablePolls += 1;
        const message = '[heartbeat] Brain Core status temporarily unavailable; retrying';
        if (tty) output.write(`\u001b[2J\u001b[HJarvis · STATUS UNAVAILABLE\n\n${message}\n`);
        else if (unavailablePolls === 1 || unavailablePolls % 5 === 0) errorOutput.write(`${message}\n`);
      }
      await sleep(pollMs);
    }
    if (!json) errorOutput.write(`Jarvis detached — durable execution continues at root ${options.rootGoalId}.\n`);
    timing.finalRenderMs = now() - submittedAtMs;
    return { detached: true, status: current, timing };
  } finally {
    if (tty) {
      input.removeListener?.('data', onData);
      input.removeListener?.('resize', onResize);
      input.setRawMode?.(false);
      input.pause?.();
      output.write('\u001b[?25h');
    }
  }
}

export const terminalConsoleFormatting = { formatCount, formatTokens, formatCost, formatElapsed, lineFor };
