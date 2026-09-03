import assert from 'node:assert/strict';
import test from 'node:test';
import { createClaudeCodeDefaultController, promoteClaudeCodeDefault, rollbackClaudeCodeDefault, restoreClaudeCodeDefault, runClaudeCodeDefaultInvocation } from './claude-code-default.mjs';

const active = (domain) => promoteClaudeCodeDefault(createClaudeCodeDefaultController({ domain, sourceRevision: 'test' }), { preflight: { passed: true } });
test('Code and Research defaults use the same Brain contract with independent state', () => {
  for (const [domain, prompt] of [['code', 'Fix the parser bug in this code.'], ['research', 'Research current public evidence with citations.']]) {
    const result = runClaudeCodeDefaultInvocation({ controller: active(domain), prompt, fixtureId: domain });
    assert.equal(result.selectedPath, 'v2');
    assert.equal(result.v2.receipt.consumer, 'claude-code');
    assert.equal(result.receipt.rawPromptStored, false);
  }
});
test('each Claude Code default rolls back independently and restores only with preflight', () => {
  let code = active('code'); const research = active('research');
  code = rollbackClaudeCodeDefault(code);
  assert.equal(runClaudeCodeDefaultInvocation({ controller: code, prompt: 'Fix the parser bug.' }).v2, null);
  assert.equal(runClaudeCodeDefaultInvocation({ controller: research, prompt: 'Research current evidence.' }).selectedPath, 'v2');
  assert.equal(restoreClaudeCodeDefault(code, { preflight: { passed: true } }).defaultActive, true);
});
