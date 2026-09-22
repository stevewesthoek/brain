import type { TerminalExecutionStatus } from './terminal-intake.js';
import { runTerminalConsole, type TerminalConsoleInput, type TerminalConsoleOptions, type TerminalConsoleStream } from './terminal-console.js';

export type InteractiveTurnReceipt = { rootGoalId: string; rootRunId: string; conversationId?: string; startedAt?: string };

export type InteractiveTurnSubmissionHooks = {
  onStart?: (text: string, turnNumber: number) => void;
  onFinish?: (text: string, turnNumber: number, receipt: InteractiveTurnReceipt | null) => void;
};

export type InteractiveTerminalSessionOptions = {
  initialText: string | null;
  conversationId?: string;
  interactive: boolean;
  json?: boolean;
  prompt: () => Promise<string | null>;
  submitTurn: (text: string, turnNumber: number, conversationId?: string) => Promise<InteractiveTurnReceipt | null>;
  readStatus: (rootGoalId: string) => Promise<TerminalExecutionStatus>;
  cancelTurn: (rootRunId: string) => Promise<string>;
  submissionHooks?: InteractiveTurnSubmissionHooks;
  output?: TerminalConsoleStream;
  errorOutput?: TerminalConsoleStream;
  input?: TerminalConsoleInput;
  isTTY?: boolean;
  color?: boolean;
  pollMs?: number;
  onFailure?: (status: TerminalExecutionStatus) => void;
};

export type InteractiveTerminalSessionResult = {
  turnCount: number;
  explicitExit: boolean;
  detached: boolean;
  lastStatus: TerminalExecutionStatus | null;
};

function isExplicitSessionExit(text: string): boolean {
  return ['/exit', '/quit', 'exit', 'quit', 'detach'].includes(text.trim().toLowerCase());
}

/**
 * Keeps the interactive conversation alive across independently durable turns.
 * Each turn still enters Brain through the existing authenticated intake and
 * K4 lifecycle; this helper owns only prompt/follow/render sequencing.
 */
export async function runInteractiveTerminalSession(options: InteractiveTerminalSessionOptions): Promise<InteractiveTerminalSessionResult> {
  let text = options.initialText;
  let turnCount = 0;
  let lastStatus: TerminalExecutionStatus | null = null;
  let conversationId = options.conversationId;
  while (text !== null) {
    const trimmed = text.trim();
    if (isExplicitSessionExit(trimmed)) return { turnCount, explicitExit: true, detached: false, lastStatus };
    if (trimmed.length === 0) {
      if (!options.interactive) return { turnCount, explicitExit: false, detached: false, lastStatus };
      text = await options.prompt();
      continue;
    }
    turnCount += 1;
    options.submissionHooks?.onStart?.(trimmed, turnCount);
    let receipt: InteractiveTurnReceipt | null = null;
    try {
      receipt = await options.submitTurn(trimmed, turnCount, conversationId);
    } finally {
      options.submissionHooks?.onFinish?.(trimmed, turnCount, receipt);
    }
    if (!receipt) return { turnCount, explicitExit: false, detached: false, lastStatus };
    conversationId = receipt.conversationId ?? conversationId;
    const consoleOptions: TerminalConsoleOptions = {
      rootGoalId: receipt.rootGoalId,
      ...(receipt.startedAt ? { startedAt: receipt.startedAt } : {}),
      readStatus: () => options.readStatus(receipt.rootGoalId),
      onCancel: () => options.cancelTurn(receipt.rootRunId),
      ...(options.json === undefined ? {} : { json: options.json }),
      ...(options.output === undefined ? {} : { output: options.output }),
      ...(options.errorOutput === undefined ? {} : { errorOutput: options.errorOutput }),
      ...(options.input === undefined ? {} : { input: options.input }),
      ...(options.isTTY === undefined ? {} : { isTTY: options.isTTY }),
      ...(options.color === undefined ? {} : { color: options.color }),
      ...(options.pollMs === undefined ? {} : { pollMs: options.pollMs }),
    };
    const consoleResult = await runTerminalConsole(consoleOptions);
    lastStatus = consoleResult.status;
    if (consoleResult.detached || !options.interactive) {
      return { turnCount, explicitExit: false, detached: consoleResult.detached, lastStatus };
    }
    if (lastStatus && lastStatus.status !== 'completed') options.onFailure?.(lastStatus);
    // Terminal completion is a turn boundary, not a session boundary.
    text = await options.prompt();
  }
  return { turnCount, explicitExit: false, detached: false, lastStatus };
}
