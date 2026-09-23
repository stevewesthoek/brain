import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cliPath = fileURLToPath(new URL('../bin/brain-agent.js', import.meta.url));

test('brain-agent retains the existing video analyze command entry point', () => {
  assert.throws(() => execFileSync(process.execPath, [cliPath, 'video', 'analyze'], { encoding: 'utf8' }), (error: unknown) => {
    assert.ok(error && typeof error === 'object');
    const failure = error as { status?: number; stderr?: Buffer | string };
    assert.equal(failure.status, 1);
    assert.match(String(failure.stderr), /brain-agent video analyze <url-or-path>/u);
    return true;
  });
});
