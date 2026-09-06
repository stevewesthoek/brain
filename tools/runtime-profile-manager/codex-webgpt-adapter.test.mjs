import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCodexWebGptIsolationDecision,
  inspectCodexWebGptIntegrationSource,
} from './codex-webgpt-adapter.mjs';

const sources = {
  'src/codex-integration-shared.ts': `
    const configured = process.env.CODEX_HOME?.trim();
    export function getCodexHome() { return resolve(configured || join(homedir(), ".codex")); }
    export function getCodexConfigPath() { return join(getCodexHome(), "config.toml"); }
  `,
  'src/codex-integration.ts': 'writeIntegrationState(updated, { path: getCodexConfigPath(), data: patched.text }); getCodexConfigPath();',
  'src/codex-interrupt-hook.ts': 'canonicalConfigPath(configPath); [hooks.state.key]; trusted_hash = hash;',
  'src/config.ts': 'const configured = process.env.CODEX_CHATGPT_WEB_HOME?.trim();',
  'src/cli.ts': 'process.env.CODEX_CHATGPT_WEB_HOME; takeOption(args, "--home");',
  'src/dev-chat/profile.ts': 'environment.CODEX_WEB_GPT_DEV_HOME; codexHome: join(home, "codex-home"); CODEX_HOME;',
  'docs/architecture.md': 'development profile has a different core home and sandboxed CODEX_HOME.',
  'docs/dev-chat.md': 'separate Electron `userData` directory and a separate persistent browser partition; does not edit the normal `~/.codex/config.toml`.',
};

test('WebGPT source analysis distinguishes legacy direct integration from isolated DEV state', () => {
  const analysis = inspectCodexWebGptIntegrationSource({ sources, version: '5.0.2' });
  assert.equal(analysis.sourceComplete, true);
  assert.equal(analysis.explicitCodexHomeHonored, true);
  assert.equal(analysis.productionDirectIntegrationMutatesConfig, true);
  assert.equal(analysis.hookTrustStateMutated, true);
  assert.equal(analysis.devHasIsolatedCodexHome, true);
  assert.equal(analysis.devAvoidsNormalConfig, true);
  assert.equal(analysis.devHasSeparateBrowserState, true);
  assert.equal(analysis.currentProductionMode, 'legacy_shared_default_root');
  assert.equal(analysis.sourceContentsReturned, false);
});
test('WebGPT isolation decision excludes native profiles and keeps unproven modes candidate-only', () => {
  const decision = buildCodexWebGptIsolationDecision(inspectCodexWebGptIntegrationSource({ sources }));
  assert.equal(decision.status, 'OK');
  assert.equal(decision.productionDirectIntegrationAllowed, false);
  assert.equal(decision.preferredIntegrationMode, 'external_route_provider');
  assert.equal(decision.preferredIntegrationStatus, 'target_contract_not_proven_by_v5_source');
  assert.equal(decision.fallbackIntegrationStatus, 'source_resolution_supported_launcher_lifecycle_unproven');
  assert.deepEqual(decision.nativeProfileIdsExcluded, [
    'runtime_profile:openai.01.cli',
    'runtime_profile:openai.02.cli',
  ]);
  assert.equal(decision.optionalWebGptConsumerProfile, 'runtime_profile:codex.webgpt.production');
});
