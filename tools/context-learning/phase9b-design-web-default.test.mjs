import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createCodexDesignWebDefaultController, promoteCodexDesignWebDefault, rollbackCodexDesignWebDefault, restoreCodexDesignWebDefault, runCodexDesignWebDefaultInvocation, validateCodexDesignWebDefaultSpec, CODEX_DESIGN_WEB_DEFAULT_STATE } from './codex-design-web-default.mjs';

const revision = 'phase9b-test';
const prompt = 'Design and implement this responsive web experience, then test and verify it.';
test('Design/Web default activation spec is schema-shaped and exact-scope', () => {
  const spec = JSON.parse(fs.readFileSync(path.resolve('operations/specs/infinite-brain-codex-design-web-default.v1.json'), 'utf8'));
  assert.equal(validateCodexDesignWebDefaultSpec(spec).valid, true);
});
test('Design/Web default promotes only after accepted preflight and selects universal v2', () => {
  let controller = promoteCodexDesignWebDefault(createCodexDesignWebDefaultController({ sourceRevision: revision }), { preflight: { passed: true } });
  assert.equal(controller.state, CODEX_DESIGN_WEB_DEFAULT_STATE);
  const result = runCodexDesignWebDefaultInvocation({ controller, prompt, fixtureId: 'default' });
  assert.equal(result.selectedPath, 'v2');
  assert.equal(result.v2.route.primaryDescriptorId, 'skill.design');
  assert.equal(result.receipt.privacy.rawPromptStored, false);
  assert.equal(result.receipt.safety.writesPerformed, 0);
});
test('default falls back for out-of-scope and high-risk prompts', () => {
  const controller = promoteCodexDesignWebDefault(createCodexDesignWebDefaultController({ sourceRevision: revision }), { preflight: { passed: true } });
  assert.equal(runCodexDesignWebDefaultInvocation({ controller, prompt: 'Research current public evidence with sources.', fixtureId: 'research' }).selectedPath, 'legacy');
  assert.equal(runCodexDesignWebDefaultInvocation({ controller, prompt: 'Deploy the website to production.', fixtureId: 'risk' }).selectedPath, 'legacy');
});
test('rollback disables v2 without replay and restore requires preflight', () => {
  let controller = promoteCodexDesignWebDefault(createCodexDesignWebDefaultController({ sourceRevision: revision }), { preflight: { passed: true } });
  controller = rollbackCodexDesignWebDefault(controller);
  const rolled = runCodexDesignWebDefaultInvocation({ controller, prompt, fixtureId: 'rollback' });
  assert.equal(rolled.v2, null);
  controller = restoreCodexDesignWebDefault(controller, { preflight: { passed: true } });
  assert.equal(runCodexDesignWebDefaultInvocation({ controller, prompt, fixtureId: 'restored' }).selectedPath, 'v2');
});
