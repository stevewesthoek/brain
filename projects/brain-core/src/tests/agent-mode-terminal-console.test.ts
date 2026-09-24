import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { applyCodexTelemetry, emptyExecutionTelemetry, finishExecutionTelemetry, parseCodexTelemetryLine, validateExecutionTelemetry } from '../agent-mode/execution-telemetry.js';
import { renderTerminalConsole, runTerminalConsole, startTerminalSubmissionFeedback } from '../agent-mode/terminal-console.js';
import { renderTerminalMarkdown } from '../agent-mode/terminal-markdown.js';
import { AgentModeTerminalIntakeService, TERMINAL_INTAKE_SCHEMA_VERSION, type TerminalExecutionStatus } from '../agent-mode/terminal-intake.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-19T16:00:00.000Z';

function status(overrides: Partial<TerminalExecutionStatus> = {}): TerminalExecutionStatus {
  return {
    schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION,
    rootGoalId: 'root:jarvis:fixture',
    taskId: 'root:jarvis:fixture',
    rootRunId: 'run:jarvis:fixture',
    status: 'running',
    childAgentId: 'agent:child:fixture',
    childTaskId: 'task:fixture',
    childRunId: 'run:child:fixture',
    attemptId: 'attempt:fixture',
    resultText: null,
    resultRef: null,
    evidenceRef: null,
    reasonCode: null,
    workerCount: 1,
    runtimeRef: 'runtime:codex-cli',
    runtimeProfileRef: 'runtime-profile:codex-cli-read-only-v1',
    modelRef: 'model:deferred',
    requestedModel: 'auto',
    repositoryRef: 'stevewesthoek/brain',
    startedAt: NOW,
    elapsedMs: 12_000,
    safeActivity: 'Inspecting the repository',
    lastActivityAt: NOW,
    activity: [],
    telemetry: null,
    updatedAt: NOW,
    ...overrides,
  };
}

test('Codex JSONL telemetry normalizes usage, context, and safe activity without raw payloads', () => {
  const started = parseCodexTelemetryLine(JSON.stringify({ type: 'thread.started', thread_id: 'thread:fixture', model: 'gpt-5.6-luna' }), 0);
  const turn = parseCodexTelemetryLine(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1200, output_tokens: 300, cached_input_tokens: 100, reasoning_output_tokens: 40, total_tokens: 1500, context_window: 128000, context_used_tokens: 1500 } }), 1);
  const derivedTotal = parseCodexTelemetryLine(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1200, output_tokens: 300, reasoning_output_tokens: 40 } }), 2);
  assert.ok(started);
  assert.ok(turn);
  assert.ok(derivedTotal);
  let telemetry = emptyExecutionTelemetry({ runtimeRef: 'runtime:codex-cli', modelRef: null, startedAt: NOW });
  telemetry = applyCodexTelemetry(telemetry, started);
  telemetry = applyCodexTelemetry(telemetry, turn);
  telemetry = finishExecutionTelemetry(telemetry, 'succeeded', '2026-09-19T16:00:12.000Z');
  assert.equal(telemetry.sessionId, 'thread:fixture');
  assert.equal(telemetry.modelRef, 'gpt-5.6-luna');
  assert.equal(telemetry.usage.totalTokens, 1500);
  assert.equal(telemetry.usage.cachedInputTokens, 100);
  assert.equal(telemetry.context.percentage, 1.2);
  assert.equal(telemetry.cost.estimatedUsd, null);
  assert.equal(telemetry.events.some((event) => event.safeActivity.includes('Result available')), true);
  assert.equal(derivedTotal.usage?.totalTokens, 1540);
  assert.equal(validateExecutionTelemetry(telemetry), true);
});

test('terminal presentation distinguishes unavailable observations from authoritative zero', () => {
  const unavailable = renderTerminalConsole(status({ status: 'completed', telemetry: emptyExecutionTelemetry({ runtimeRef: 'runtime:codex-cli', startedAt: NOW }) }));
  assert.doesNotMatch(unavailable, /Tokens unavailable|Context unavailable|Cost unavailable/u);
  assert.match(renderTerminalConsole(status({ status: 'completed', telemetry: emptyExecutionTelemetry({ runtimeRef: 'runtime:codex-cli', startedAt: NOW }) }), { expanded: true }), /Usage unavailable/u);

  const genuineZero = renderTerminalConsole(status({
    status: 'completed',
    telemetry: finishExecutionTelemetry({
      ...emptyExecutionTelemetry({ runtimeRef: 'runtime:codex-cli', startedAt: NOW }),
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: null, cachedOutputTokens: null, reasoningTokens: null, totalTokens: 0 },
      cost: { estimatedUsd: 0, source: 'runtime', pricingVersion: null, confidence: 'authoritative' },
    }, 'succeeded', '2026-09-19T16:00:12.000Z'),
  }));
  assert.match(genuineZero, /Tokens 0/u);
  assert.match(genuineZero, /Cost \$0\.0000 est\./u);
});

test('routing disclosure distinguishes runtime availability from cost admission', () => {
  const rendered = renderTerminalConsole(status({
    requestedModel: 'auto',
    conversationHistory: [
      { turnId: 'turn:user', sequence: 1, speakerRole: 'user', text: 'What model are you using?', status: 'completed', createdAt: NOW },
      { turnId: 'turn:jarvis', sequence: 2, speakerRole: 'jarvis', text: 'routing facts', status: 'completed', createdAt: NOW },
    ],
    modelAdmissions: [
      { modelRef: 'agent-mode/claude-opus-4.6', runtimeAvailable: true, autoAdmitted: false, reasonCode: 'cost_unknown' },
    ],
  }), { width: 200 });
  assert.match(rendered, /Opus 4\.6 runtime available, Auto denied \(cost_unknown\)/u);
});

test('terminal console renders compact and expanded views and line fallback without ANSI in non-TTY mode', async () => {
  const telemetry = finishExecutionTelemetry({
    ...emptyExecutionTelemetry({ runtimeRef: 'runtime:codex-cli', modelRef: 'gpt-5.6-luna', startedAt: NOW }),
    usage: { inputTokens: 100, outputTokens: 40, cachedInputTokens: null, cachedOutputTokens: null, reasoningTokens: null, totalTokens: 140 },
    context: { usedTokens: 140, maximumTokens: 128_000, percentage: 0.1 },
  }, 'succeeded', '2026-09-19T16:00:12.000Z');
  const completed = status({ status: 'completed', modelRef: 'agent-mode/minimax-m2.5', resultText: 'bounded result', telemetry, safeActivity: 'Result available', conversationHistory: [
    { turnId: 'turn:user', sequence: 1, speakerRole: 'user', text: 'Hi Jarvis', status: 'completed', createdAt: NOW },
    { turnId: 'turn:jarvis', sequence: 2, speakerRole: 'jarvis', text: 'Hello from the durable transcript.', status: 'completed', createdAt: NOW },
  ] });
  const compact = renderTerminalConsole(completed);
  const expanded = renderTerminalConsole(completed, { expanded: true });
  assert.match(compact, /Tokens 140/);
  assert.match(compact, /You\nHi Jarvis/u);
  assert.match(compact, /Jarvis\nHello from the durable transcript\./u);
  assert.doesNotMatch(compact, /turn:user/u);
  assert.match(compact, /Auto →/u);
  assert.match(compact, /Context 140 \/ 128\.0k/);
  assert.doesNotMatch(compact, /root:jarvis:fixture/u);
  assert.match(compact, /┌─ Jarvis/u);
  assert.match(expanded, /Task\s+task:fixture/u);
  assert.match(expanded, /bounded result/);
  const narrow = renderTerminalConsole(completed, { width: 40 });
  assert.equal(narrow.split('\n').every((line) => line.length <= 40), true);
  const veryNarrow = renderTerminalConsole(completed, { width: 20 });
  assert.equal(veryNarrow.split('\n').every((line) => line.length <= 20), true);
  assert.match(renderTerminalConsole(completed, { color: true }), /\u001b\[/u);

  const output: { text: string } = { text: '' };
  const errors: { text: string } = { text: '' };
  const result = await runTerminalConsole({ rootGoalId: completed.rootGoalId, isTTY: false, pollMs: 250, clock: () => 1_000, readStatus: async () => completed, output: { write(value) { output.text += value; } }, errorOutput: { write(value) { errors.text += value; } } });
  assert.equal(result.status?.status, 'completed');
  assert.equal(result.detached, false);
  assert.equal(result.timing.firstFeedbackMs, null);
  assert.equal(result.timing.firstStatusMs, 0);
  assert.equal(result.timing.resultCompletedMs, 0);
  assert.match(output.text, /^\[completed\]/u);
  assert.doesNotMatch(output.text, /\u001b/u);
  assert.equal(errors.text, '');
});

test('submission feedback appears before intake resolves and stops cleanly', () => {
  let nowMs = 0;
  const output = { text: '', isTTY: true, write(value: string) { output.text += value; } };
  const feedback = startTerminalSubmissionFeedback({ output, clock: () => nowMs, intervalMs: 10_000, color: false });
  assert.match(output.text, /Jarvis · Auto → evaluating · 00:00/u);
  nowMs = 1_000;
  feedback.stop();
  feedback.stop();
  assert.match(output.text, /\u001b\[2K/u);
});

test('TTY resize redraw preserves prior turns and one active timer without overflow or duplicate output', async () => {
  const writes: string[] = [];
  const inputState = { listeners: new Map<string, (...args: unknown[]) => void>() };
  const input = {
    isTTY: true,
    resume() { return input; },
    pause() { return input; },
    setRawMode() { return input; },
    on(event: 'data' | 'keypress' | 'resize', listener: (...args: unknown[]) => void) { inputState.listeners.set(event, listener); return input; },
    removeListener(event: 'data' | 'keypress' | 'resize') { inputState.listeners.delete(event); return input; },
  };
  const output: { isTTY: boolean; columns: number; write(value: string): void } = {
    isTTY: true,
    columns: 80,
    write(value) {
      writes.push(value);
      if (!resized && value.startsWith('\u001b[2J')) {
        resized = true;
        output.columns = 40;
        inputState.listeners.get('resize')?.();
      }
    },
  };
  let resized = false;
  let reads = 0;
  const history = [
    { turnId: 'turn:user:1', sequence: 1, speakerRole: 'user' as const, text: 'First earlier question', status: 'completed' as const, createdAt: NOW },
    { turnId: 'turn:jarvis:1', sequence: 2, speakerRole: 'jarvis' as const, text: 'First earlier answer', status: 'completed' as const, createdAt: NOW },
    { turnId: 'turn:user:2', sequence: 3, speakerRole: 'user' as const, text: 'Second earlier question', status: 'completed' as const, createdAt: NOW },
    { turnId: 'turn:jarvis:2', sequence: 4, speakerRole: 'jarvis' as const, text: 'Second earlier answer wraps across the narrowed terminal width.', status: 'completed' as const, createdAt: NOW },
  ];
  const result = await runTerminalConsole({
    rootGoalId: 'root:jarvis:resize-fixture',
    startedAt: NOW,
    clock: () => Date.parse(NOW) + 12_000,
    isTTY: true,
    pollMs: 250,
    input,
    output,
    errorOutput: { write() {} },
    readStatus: async () => {
      reads += 1;
      return status({
        status: reads === 1 ? 'running' : 'completed',
        conversationHistory: history,
        resultText: reads === 1 ? null : 'Current Jarvis result',
      });
    },
  });

  assert.equal(result.detached, false);
  assert.equal(resized, true);
  const draws = writes.filter((value) => value.startsWith('\u001b[2J\u001b[H'));
  assert.equal(draws.length, 3, 'initial running draw, resize redraw, and terminal draw');
  const resizeDraw = draws[1]!.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
  assert.match(resizeDraw, /00:12/u);
  assert.equal((resizeDraw.match(/00:12/gu) ?? []).length, 1, 'the elapsed timer appears once');
  const normalizedResizeDraw = resizeDraw.replace(/\s+/gu, ' ');
  assert.match(normalizedResizeDraw, /Second earlier answer wraps across the narrowed terminal width\./u);
  assert.equal((normalizedResizeDraw.match(/Second earlier answer wraps across the narrowed terminal width\./gu) ?? []).length, 1);
  assert.equal(resizeDraw.split('\n').filter(Boolean).every((line) => line.length <= 40), true);
  assert.equal((resizeDraw.match(/◐/gu) ?? []).length, 1, 'one active spinner frame');
  assert.equal(result.status?.status, 'completed');
});
test('in-flight Jev phase is visible without inventing worker state', () => {
  const rendered = renderTerminalConsole(status({ childAgentId: null, childTaskId: null, childRunId: null, attemptId: null, modelRef: null, runtimeRef: null, runtimeProfileRef: null, reflexPhase: 'preflight', safeActivity: 'Jev preflight' }), { width: 80 });
  assert.match(rendered, /Jev ◐ preflight/u);
  assert.match(rendered, /Jev preflight/u);
});

test('terminal Markdown rendering formats bounded headings, emphasis, code, lists, and fences', () => {
  const rendered = renderTerminalMarkdown('# Heading\n\n**bold** and `code`\n\n- one\n1. two\n\n```\nconst x = 1;\n```', { width: 40, color: true });
  assert.match(rendered.join('\n'), /Heading/u);
  assert.match(rendered.join('\n'), /\u001b\[1mbold\u001b\[22m/u);
  assert.match(rendered.join('\n'), /\u001b\[36mcode\u001b\[39m/u);
  assert.match(rendered.join('\n'), /• one/u);
  assert.match(rendered.join('\n'), /1\. two/u);
  assert.match(rendered.join('\n'), /const x = 1;/u);
  const wrappedInline = renderTerminalMarkdown('**bold words remain formatted across a narrow terminal** and `inline code wraps safely across rows`', { width: 20, color: true });
  const visibleInline = wrappedInline.join('\n').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
  assert.match(visibleInline.replace(/\s+/gu, ' '), /bold words remain formatted across a narrow terminal and inline code wraps safely across rows/u);
  assert.doesNotMatch(visibleInline, /\*\*|`/u);
  assert.equal(visibleInline.split('\n').every((line) => line.length <= 20), true);
});

test('terminal result is not rendered twice when durable and receipt text differ only by whitespace', () => {
  const rendered = renderTerminalConsole(status({ resultText: 'Hello   from Jarvis', conversationHistory: [
    { turnId: 'turn:user', sequence: 1, speakerRole: 'user', text: 'Hi', status: 'completed', createdAt: NOW },
    { turnId: 'turn:jarvis', sequence: 2, speakerRole: 'jarvis', text: '  Hello from Jarvis  ', status: 'completed', createdAt: NOW },
  ] }));
  assert.equal((rendered.match(/Hello from Jarvis/gu) ?? []).length, 1);
});

test('routing questions render Brain-owned Auto and Jev facts instead of model-authored claims', () => {
  const rendered = renderTerminalConsole(status({
    status: 'completed',
    modelRef: 'agent-mode/minimax-m2.5',
    runtimeRef: 'runtime:model-gateway',
    reflex: {
      mode: 'ACTIVE_PILOT', status: 'fallback', latencyMs: 11,
      recommendationModelRef: 'agent-mode/glm-5', actualRouteModelRef: 'agent-mode/minimax-m2.5',
      confidence: 0.3, usage: { inputTokens: 1, outputTokens: 1 }, cost: { amountUsd: 0.000001, basis: 'fixture' },
      reasonCode: 'REFLEX_RECOMMENDATION_NOT_ADMITTED', postflightStatus: 'fallback',
    },
    conversationHistory: [
      { turnId: 'turn:user:model', sequence: 1, speakerRole: 'user', text: 'What model are you using?', status: 'completed', createdAt: NOW },
      { turnId: 'turn:jarvis:model', sequence: 2, speakerRole: 'jarvis', text: "I'm using Claude 3.5 (Sonnet).", status: 'completed', createdAt: NOW },
    ],
  }), { width: 180 });
  assert.match(rendered, /Brain routing: Auto selected MiniMax M2\.5 via model-gateway/u);
  assert.match(rendered, /Jev ACTIVE_PILOT · fallback/u);
  assert.match(rendered, /REFLEX_RECOMMENDATION_NOT_ADMITTED/u);
  assert.doesNotMatch(rendered, /Claude 3\.5/u);
});

test('unsupported provider tool-call text is never rendered as a successful answer', () => {
  const rendered = renderTerminalConsole(status({ status: 'failed', resultText: null, safeActivity: 'Execution failed', reasonCode: 'UNSUPPORTED_TOOL_REQUEST', conversationHistory: [
    { turnId: 'turn:user:tool', sequence: 1, speakerRole: 'user', text: 'Inspect the repository.', status: 'completed', createdAt: NOW },
    { turnId: 'turn:jarvis:tool', sequence: 2, speakerRole: 'jarvis', text: '<minimax:tool_call><invoke name="filesystem_list_allowed_directories">', status: 'failed', createdAt: NOW },
  ] }));
  assert.doesNotMatch(rendered, /<minimax:tool_call>|<invoke/u);
  assert.match(rendered, /unsupported|Execution failed/u);
  const receiptOnly = renderTerminalConsole(status({ status: 'failed', resultText: '<minimax:tool_call><invoke name="filesystem_list_allowed_directories">' }));
  assert.doesNotMatch(receiptOnly, /<minimax:tool_call>|<invoke/u);
});

test('terminal failure shows a bounded Bedrock outage message and not provider payload text', () => {
  const rendered = renderTerminalConsole(status({
    status: 'failed',
    reasonCode: 'MODEL_GATEWAY_ACCOUNT_ACCESS_UNAVAILABLE',
    safeActivity: 'Execution failed',
  }));
  assert.match(rendered, /Bedrock account access unavailable/u);
  assert.doesNotMatch(rendered, /Error 002|ValidationException|credentials|access key/u);
});
test('TTY console restores cursor and raw-mode state after a terminal result', async () => {
  const output: { text: string } = { text: '' };
  const inputState = { rawModes: [] as boolean[], resumed: 0, paused: 0, listeners: new Map<string, (...args: unknown[]) => void>() };
  const input = {
    isTTY: true,
    setRawMode(value: boolean) { inputState.rawModes.push(value); return input; },
    resume() { inputState.resumed += 1; },
    pause() { inputState.paused += 1; },
    on(event: 'data' | 'keypress' | 'resize', listener: (...args: unknown[]) => void) { inputState.listeners.set(event, listener); return input; },
    removeListener(event: 'data' | 'keypress' | 'resize') { inputState.listeners.delete(event); return input; },
  };
  const result = await runTerminalConsole({ rootGoalId: 'root:jarvis:fixture', isTTY: true, pollMs: 250, input, readStatus: async () => status({ status: 'completed', safeActivity: 'Result available' }), output: { isTTY: true, write(value) { output.text += value; } }, errorOutput: { write() {} } });
  assert.equal(result.detached, false);
  assert.deepEqual(inputState.rawModes, [true, false]);
  assert.equal(inputState.resumed, 1);
  assert.equal(inputState.paused, 1);
  assert.match(output.text, /\u001b\[\?25l/u);
  assert.match(output.text, /Auto → evaluating/u);
  assert.match(output.text, /\u001b\[\?25h/u);
});

test('Codex runtime persists structured telemetry through existing Agent Mode events and receipt', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-terminal-console-runtime-'));
  const repository = path.join(root, 'repo');
  const fakeCodex = path.join(root, 'fake-codex.sh');
  mkdirSync(path.join(repository, '.git'), { recursive: true });
  writeFileSync(fakeCodex, '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "codex-cli 0.153.2\\n"; exit 0; fi\nif [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf "%s\\n" "--json --output-last-message --sandbox --ephemeral --ignore-user-config --skip-git-repo-check"; exit 0; fi\nout=""\nprev=""\nfor arg in "$@"; do if [ "$prev" = "--output-last-message" ]; then out="$arg"; fi; prev="$arg"; done\nprintf \'{"type":"thread.started","thread_id":"thread:fixture"}\\n\'\nprintf \'{"type":"turn.started"}\\n\'\nprintf \'{"type":"item.started","item":{"type":"command_execution"}}\\n\'\nprintf \'{"type":"turn.completed","usage":{"input_tokens":120,"output_tokens":30,"total_tokens":150}}\\n\'\nprintf \'bounded result\' > "$out"\n');
  chmodSync(fakeCodex, 0o755);
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [root], codexCommand: fakeCodex, now: () => NOW });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:telemetry', operatorId: 'operator:test', repositoryRef: 'brain', repositoryRoot: repository, model: 'codex', codexEscalation: { runtime: 'codex-cli', reason: 'approved telemetry fixture', requestedCapability: 'read-only repository inspection', approvalId: 'approval:fixture', approvedBy: 'operator:test' }, text: 'Read only.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    await service.execute(accepted.receipt.rootGoalId);
    const current = service.status(accepted.receipt.rootGoalId);
    assert.equal(current.status, 'completed');
    assert.equal(current.telemetry?.usage.totalTokens, 150);
    assert.equal(current.telemetry?.sessionId, 'thread:fixture');
    assert.equal(current.safeActivity, 'Result available');
    assert.ok(store.listEvents(current.attemptId ?? '').some((event) => event.eventType === 'runtime_telemetry'));
    assert.equal(store.getRuntimeReceiptForAttempt(current.attemptId ?? '')?.telemetry?.usage.totalTokens, 150);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
