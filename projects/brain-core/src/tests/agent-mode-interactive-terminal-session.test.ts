import assert from 'node:assert/strict';
import test from 'node:test';
import { runInteractiveTerminalSession } from '../agent-mode/interactive-terminal-session.js';
import { TERMINAL_INTAKE_SCHEMA_VERSION, type TerminalExecutionStatus } from '../agent-mode/terminal-intake.js';

const NOW = '2026-09-20T18:00:00.000Z';

function status(rootGoalId: string, state: TerminalExecutionStatus['status']): TerminalExecutionStatus {
  return {
    schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION,
    rootGoalId,
    taskId: rootGoalId,
    rootRunId: `run:jarvis:${rootGoalId}`,
    status: state,
    childAgentId: `agent:worker:${rootGoalId}`,
    childTaskId: `task:${rootGoalId}`,
    childRunId: `run:${rootGoalId}`,
    attemptId: `attempt:${rootGoalId}`,
    resultText: state === 'completed' ? `result for ${rootGoalId}` : null,
    resultRef: state === 'completed' ? `result:${rootGoalId}` : null,
    evidenceRef: state === 'completed' ? `evidence:${rootGoalId}` : null,
    reasonCode: state === 'failed' ? 'WORKER_FAILED' : null,
    workerCount: 1,
    runtimeRef: 'runtime:codex-cli',
    runtimeProfileRef: 'runtime-profile:codex-cli-read-only-v1',
    modelRef: 'model:deferred',
    requestedModel: 'auto',
    repositoryRef: 'brain',
    startedAt: NOW,
    elapsedMs: 1_000,
    safeActivity: state === 'completed' ? 'Result available' : 'Execution failed',
    lastActivityAt: NOW,
    activity: [],
    telemetry: null,
    updatedAt: NOW,
  };
}

test('completed turns return to INPUT_READY until an explicit session exit', async () => {
  const prompts = ['hi', 'What repository am I in?', '/exit'];
  const submitted: string[] = [];
  const output = { text: '', write(value: string) { output.text += value; } };
  const result = await runInteractiveTerminalSession({
    initialText: prompts.shift() ?? null,
    interactive: true,
    prompt: async () => prompts.shift() ?? null,
    submitTurn: async (text, turnNumber) => { submitted.push(`${turnNumber}:${text}`); return { rootGoalId: `root:${turnNumber}`, rootRunId: `run:${turnNumber}` }; },
    readStatus: async (rootGoalId) => status(rootGoalId, 'completed'),
    cancelTurn: async () => 'cancelled',
    output,
    errorOutput: output,
    isTTY: false,
    pollMs: 250,
  });
  assert.deepEqual(submitted, ['1:hi', '2:What repository am I in?']);
  assert.equal(result.turnCount, 2);
  assert.equal(result.explicitExit, true);
  assert.equal(result.lastStatus?.status, 'completed');
  assert.equal((output.text.match(/\[completed\]/gu) ?? []).length, 2);
});

test('a failed turn reports failure and returns to the next prompt', async () => {
  const prompts = ['first', 'second', '/quit'];
  const failures: string[] = [];
  let turn = 0;
  const result = await runInteractiveTerminalSession({
    initialText: prompts.shift() ?? null,
    interactive: true,
    prompt: async () => prompts.shift() ?? null,
    submitTurn: async () => ({ rootGoalId: `root:failure:${++turn}`, rootRunId: `run:failure:${turn}` }),
    readStatus: async (rootGoalId) => status(rootGoalId, rootGoalId.endsWith(':1') ? 'failed' : 'completed'),
    cancelTurn: async () => 'cancelled',
    isTTY: false,
    onFailure: (value) => failures.push(value.reasonCode ?? 'unknown'),
  });
  assert.deepEqual(failures, ['WORKER_FAILED']);
  assert.equal(result.turnCount, 2);
  assert.equal(result.explicitExit, true);
  assert.equal(result.lastStatus?.status, 'completed');
});

test('submission hooks bracket the network intake and clean up on failure', async () => {
  const events: string[] = [];
  const result = await runInteractiveTerminalSession({
    initialText: 'hello',
    interactive: false,
    prompt: async () => null,
    submitTurn: async () => { events.push('submit'); throw new Error('fixture intake failure'); },
    readStatus: async () => status('root:never', 'completed'),
    cancelTurn: async () => 'cancelled',
    submissionHooks: {
      onStart: () => events.push('start'),
      onFinish: (_text, _turn, receipt) => events.push(receipt ? 'finish:receipt' : 'finish:null'),
    },
  }).catch(() => ({ turnCount: 1, explicitExit: false, detached: false, lastStatus: null }));
  assert.deepEqual(events, ['start', 'submit', 'finish:null']);
  assert.equal(result.turnCount, 1);
});
