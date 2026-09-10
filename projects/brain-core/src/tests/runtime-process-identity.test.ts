import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import test from 'node:test';
import { readRuntimeProcessIdentity } from '../agent-mode/runtime-process-identity.js';

async function waitForIdentity(child: ChildProcess, runId: string, expected: boolean): Promise<ReturnType<typeof readRuntimeProcessIdentity>> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const identity = readRuntimeProcessIdentity(child.pid ?? 0, runId);
    if (Boolean(identity) === expected) return identity;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return readRuntimeProcessIdentity(child.pid ?? 0, runId);
}

function stop(child: ChildProcess): void {
  if (!child.killed) child.kill('SIGTERM');
}

test('K3.4 acceptance process title is recognized by the real runtime identity reader', async () => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', "process.title='brain-agent k3-4-live-acceptance'; setInterval(()=>{},1000)"], { stdio: 'ignore' });
  try {
    const identity = await waitForIdentity(child, 'run:k3-4-identity-positive', true);
    assert.ok(identity);
    assert.match(identity.command, /brain-agent/);
    assert.ok(identity.startedAt);
    assert.ok(identity.token);
  } finally { stop(child); }
});
test('generic unrelated Node process is not recognized as an owned brain-agent runtime', async () => {
  const child = spawn(process.execPath, ['--input-type=module', '-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  try {
    const identity = await waitForIdentity(child, 'run:k3-4-identity-negative', false);
    assert.equal(identity, undefined);
  } finally { stop(child); }
});
