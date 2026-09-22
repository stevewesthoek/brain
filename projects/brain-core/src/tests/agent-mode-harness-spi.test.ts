import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { CodexHarnessAdapter, buildCodexEnvironment } from '../agent-mode/codex-harness-adapter.js';
import { admitCodexModel } from '../agent-mode/codex-model-policy.js';
import { parseCodexTelemetryLine } from '../agent-mode/execution-telemetry.js';
import { assessHarnessCompatibility, BRAIN_HARNESS_SPI_SCHEMA_VERSION, HARNESS_CAPABILITY_KEYS, validateBrainHarnessStartInput, type BrainHarnessStartInput } from '../agent-mode/harness-spi.js';
import { validateRuntimeResult } from '../agent-mode/runtime-dispatch.js';
import { MockBrainHarnessAdapter } from './support/mock-harness-adapter.js';

const NOW = '2026-09-19T18:00:00.000Z';

function input(overrides: Partial<BrainHarnessStartInput> = {}): BrainHarnessStartInput {
  return {
    schemaVersion: BRAIN_HARNESS_SPI_SCHEMA_VERSION,
    brainAttemptId: 'attempt:harness:1',
    workspace: { repositoryRoot: '/tmp/brain-harness-fixture', repositoryRef: 'stevewesthoek/brain', access: 'read-only' },
    executionProfile: 'runtime-profile:codex-cli-read-only-v1',
    requestedModel: null,
    taskText: 'Read README.md and report its title.',
    deadline: NOW,
    correlation: { rootGoalId: 'goal:harness:1', taskId: 'task:harness:1', runId: 'run:harness:1', attemptId: 'attempt:harness:1', dispatchId: 'dispatch:harness:1' },
    ...overrides,
  };
}

function writeFakeCodex(command: string, options: { version?: string; help?: string; marker?: string } = {}): void {
  const version = options.version ?? '0.153.2';
  const help = options.help ?? '--json --output-last-message --sandbox --ephemeral --ignore-user-config --skip-git-repo-check';
  const marker = options.marker ?? '';
  writeFileSync(command, `#!/bin/sh
if [ "$1" = "--version" ]; then printf 'codex-cli ${version}\\n'; exit 0; fi
if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf '%s\\n' '${help}'; exit 0; fi
${marker ? `printf 'invoked\\n' > '${marker}'\n` : ''}out=""
prev=""
for arg in "$@"; do if [ "$prev" = "--output-last-message" ]; then out="$arg"; fi; prev="$arg"; done
printf '{"type":"thread.started","thread_id":"thread:harness"}\\n'
printf '{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":4,"total_tokens":16}}\\n'
printf 'bounded adapter result' > "$out"
`);
  chmodSync(command, 0o755);
}

test('Brain Harness SPI is minimal, versioned, and declares every capability explicitly', () => {
  const adapter = new MockBrainHarnessAdapter({ tokenUsage: { inputTokens: 10, outputTokens: 5 }, contextSupported: false });
  const descriptor = adapter.describe();
  assert.equal(descriptor.schemaVersion, BRAIN_HARNESS_SPI_SCHEMA_VERSION);
  assert.equal(descriptor.installationClass, 'BRAIN_MANAGED_OPTIONAL');
  for (const key of HARNESS_CAPABILITY_KEYS) assert.ok(['SUPPORTED', 'UNSUPPORTED', 'UNKNOWN'].includes(descriptor.capabilities[key]));
  assert.equal(descriptor.capabilities.tokenUsage, 'SUPPORTED');
  assert.equal(descriptor.capabilities.contextUsage, 'UNSUPPORTED');
  assert.equal(descriptor.capabilities.costUsage, 'UNSUPPORTED');
  assert.deepEqual(assessHarnessCompatibility(descriptor, ['structuredEvents', 'cancel', 'inspect']), { compatible: true, reasonCode: 'CAPABILITIES_ADMITTED' });
  assert.equal(assessHarnessCompatibility(descriptor, ['costUsage']).compatible, false);
  assert.equal(assessHarnessCompatibility(descriptor, ['toolEvents']).reasonCode, 'CAPABILITY_UNKNOWN');
});

test('admitted harness input rejects authority-shaped extensions and write scope', () => {
  assert.equal(validateBrainHarnessStartInput(input()), true);
  const malicious = { ...input(), budget: { dollars: 1_000_000 }, credentials: 'inherit', modelPolicy: 'override' } as unknown;
  assert.equal(validateBrainHarnessStartInput(malicious), false);
  assert.equal(validateBrainHarnessStartInput({ ...input(), workspace: { ...input().workspace, access: 'read-write' } }), false);
  assert.equal(validateBrainHarnessStartInput({ ...input(), correlation: { ...input().correlation, shell: 'rm -rf' } }), false);
});

test('mock harness contract covers ordered success events, usage, unknown events, and inspection', async () => {
  const adapter = new MockBrainHarnessAdapter({ emitUnknownEvent: true, tokenUsage: { inputTokens: 10, outputTokens: 5 } });
  const handle = await adapter.start(input());
  const events = [];
  for await (const event of adapter.events(handle)) events.push(event);
  const result = await handle.result;
  assert.equal(result.status, 'succeeded');
  assert.equal(result.settlement.tokens, 0);
  assert.equal(events[0]?.type, 'started');
  assert.equal(events.some((event) => event.type === 'unknown'), true);
  assert.equal(events.some((event) => event.type === 'usage'), true);
  assert.equal(events.at(-1)?.type, 'completed');
  assert.equal((await adapter.inspect(handle)).status, 'succeeded');
  await adapter.close(handle);
});

test('mock harness maps failure, cancellation, and uncertainty without fabricating success', async () => {
  const failed = await new MockBrainHarnessAdapter({ outcome: 'failure' }).start(input({ brainAttemptId: 'attempt:harness:failed' }));
  assert.equal((await failed.result).status, 'failed');

  const cancelled = await new MockBrainHarnessAdapter({ outcome: 'cancel' }).start(input({ brainAttemptId: 'attempt:harness:cancelled' }));
  assert.equal((await cancelled.result).status, 'cancelled');

  const uncertain = await new MockBrainHarnessAdapter({ outcome: 'uncertainty' }).start(input({ brainAttemptId: 'attempt:harness:uncertain' }));
  await assert.rejects(uncertain.result, /runtime_outcome_uncertain/u);
});

test('Codex compatibility probe separates adapter capability from installed binary facts', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-harness-probe-'));
  const compatible = path.join(root, 'codex-compatible.sh');
  const incompatible = path.join(root, 'codex-incompatible.sh');
  const marker = path.join(root, 'unexpected-user-work');
  writeFakeCodex(compatible, { version: '99.7.3' });
  writeFakeCodex(incompatible, { version: '99.7.4', help: '--sandbox --ephemeral', marker });
  chmodSync(compatible, 0o755);
  chmodSync(incompatible, 0o755);
  try {
    const compatibleProbe = await new CodexHarnessAdapter(compatible).probeCompatibility();
    assert.equal(compatibleProbe.binaryDiscoverable, true);
    assert.equal(compatibleProbe.observedVendorVersion, '99.7.3');
    assert.equal(compatibleProbe.structuredProtocol, 'COMPATIBLE');
    assert.equal(compatibleProbe.mandatoryContractCompatible, true);
    assert.equal(compatibleProbe.optionalCapabilities.costUsage, 'UNKNOWN');

    const incompatibleAdapter = new CodexHarnessAdapter(incompatible);
    const incompatibleProbe = await incompatibleAdapter.probeCompatibility();
    assert.equal(incompatibleProbe.observedVendorVersion, '99.7.4');
    assert.equal(incompatibleProbe.structuredProtocol, 'INCOMPATIBLE');
    const handle = await incompatibleAdapter.start(input({ workspace: { repositoryRoot: root, repositoryRef: 'brain', access: 'read-only' } }));
    assert.equal((await handle.result).failureCode, 'CODEX_PROTOCOL_UNSUPPORTED');
    assert.equal((await incompatibleAdapter.inspect(handle)).status, 'failed');
    assert.equal(existsSync(marker), false);

    const missing = await new CodexHarnessAdapter(path.join(root, 'missing-codex')).probeCompatibility();
    assert.equal(missing.binaryDiscoverable, false);
    assert.equal(missing.reasonCode, 'BINARY_NOT_FOUND');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Codex protocol tolerates additive fields and unknown events while preserving unavailable observations', () => {
  const future = parseCodexTelemetryLine(JSON.stringify({ type: 'future.event', future_field: { secret: 'ignored' }, timestamp: NOW }), 0);
  const noUsage = parseCodexTelemetryLine(JSON.stringify({ type: 'turn.completed', timestamp: NOW }), 1);
  assert.ok(future);
  assert.equal(future?.event.kind, 'activity');
  assert.equal('future_field' in future!, false);
  assert.equal(noUsage?.usage, undefined);
  assert.equal(noUsage?.context, undefined);
  assert.equal(admitCodexModel('99.7.3'), null);
  assert.equal(admitCodexModel('gpt-5.6-luna'), 'gpt-5.6-luna');
});

test('Codex adapter remains external-process JSONL execution behind the SPI', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-harness-spi-'));
  const repository = path.join(root, 'repo');
  const fakeCodex = path.join(root, 'fake-codex.sh');
  mkdirSync(path.join(repository, '.git'), { recursive: true });
  writeFakeCodex(fakeCodex);
  chmodSync(fakeCodex, 0o755);
  try {
    const adapter = new CodexHarnessAdapter(fakeCodex);
    const handle = await adapter.start(input({ workspace: { repositoryRoot: repository, repositoryRef: 'brain', access: 'read-only' } }));
    const events = [];
    for await (const event of adapter.events(handle)) events.push(event);
    const result = await handle.result;
    assert.equal(result.status, 'succeeded');
    assert.equal(result.settlement.cost, 0);
    assert.equal(result.telemetry?.cost.estimatedUsd, null);
    assert.equal(result.telemetry?.sessionId, 'thread:harness');
    assert.equal(result.telemetry?.usage.totalTokens, 16);
    assert.equal(events.some((event) => event.type === 'usage'), true);
    assert.equal((await adapter.inspect(handle)).status, 'succeeded');
    await adapter.close(handle);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Codex process failures normalize to a valid bounded Brain failure result', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-harness-failure-normalization-'));
  const failingCodex = path.join(root, 'failing-codex.sh');
  writeFileSync(failingCodex, `#!/bin/sh
if [ "$1" = "--version" ]; then printf 'codex-cli 0.153.2\\n'; exit 0; fi
if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf '%s\\n' '--json --output-last-message --sandbox --ephemeral --ignore-user-config --skip-git-repo-check'; exit 0; fi
printf '%*s\\n' 2048 'provider failure detail' >&2
printf '{"type":"turn.failed"}\\n'
exit 1
`);
  chmodSync(failingCodex, 0o755);
  try {
    const adapter = new CodexHarnessAdapter(failingCodex);
    const handle = await adapter.start(input({ workspace: { repositoryRoot: root, repositoryRef: 'brain', access: 'read-only' } }));
    const result = await handle.result;
    assert.equal(result.status, 'failed');
    assert.equal(result.failureCode, 'CODEX_EXEC_FAILED');
    assert.deepEqual(result.traceSummary, ['CODEX_EXEC_FAILED']);
    assert.equal(validateRuntimeResult({ ...result, usage: result.settlement }), true);
    await adapter.close(handle);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Codex child environment is bounded and does not inherit common provider credentials', () => {
  const environment = buildCodexEnvironment('/usr/local/bin/codex');
  assert.equal(environment.PATH?.startsWith('/usr/local/bin:'), true);
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY']) assert.equal(key in environment, false);
});
