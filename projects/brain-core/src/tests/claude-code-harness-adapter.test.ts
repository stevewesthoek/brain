import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ClaudeCodeHarnessAdapter } from '../agent-mode/claude-code-harness-adapter.js';

test('Claude Code adapter probes the external structured stream and normalizes a result', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'brain-claude-adapter-'));
  const command = path.join(root, 'claude');
  await writeFile(command, `#!/bin/sh
if [ "$1" = "--version" ]; then echo '2.1.278 (Claude Code)'; exit 0; fi
if [ "$1" = "--help" ]; then echo '--print --output-format stream-json --no-session-persistence'; exit 0; fi
printf '%s\\n' '{"type":"system","session_id":"session-fixture"}' '{"type":"result","result":"bounded result","usage":{"input_tokens":3,"output_tokens":5},"total_cost_usd":0}'
`, 'utf8');
  await chmod(command, 0o755);
  try {
    const adapter = new ClaudeCodeHarnessAdapter(command);
    const probe = await adapter.probeCompatibility();
    assert.equal(probe.mandatoryContractCompatible, true);
    const handle = await adapter.start({ schemaVersion: 'brain-harness-spi.v1', brainAttemptId: 'attempt:fixture', executionProfile: 'runtime-profile:claude-code-read-only-v1', requestedModel: 'opus', taskText: 'read-only fixture', deadline: '2099-01-01T00:00:00.000Z', workspace: { repositoryRoot: root, repositoryRef: 'repo:fixture', access: 'read-only' }, correlation: { rootGoalId: 'goal:fixture', taskId: 'task:fixture', runId: 'run:fixture', attemptId: 'attempt:fixture', dispatchId: 'dispatch:fixture' } });
    const result = await handle.result;
    assert.equal(result.status, 'succeeded');
    assert.equal(result.resultText, 'bounded result');
    assert.equal(result.settlement.tokens, 8);
    assert.equal(handle.externalSessionId, 'session-fixture');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
