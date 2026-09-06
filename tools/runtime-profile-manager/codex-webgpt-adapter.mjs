import fs from 'node:fs';
import path from 'node:path';

export const CODEX_WEBGPT_ADAPTER_ID = 'runtime_adapter:codex-web-gpt';
export const CODEX_WEBGPT_ADAPTER_VERSION = '1.0.0';

const SOURCE_FILES = Object.freeze([
  'src/codex-integration-shared.ts',
  'src/codex-integration.ts',
  'src/codex-interrupt-hook.ts',
  'src/config.ts',
  'src/cli.ts',
  'src/dev-chat/profile.ts',
  'docs/architecture.md',
  'docs/dev-chat.md',
]);

function includes(text, pattern) {
  return typeof text === 'string' && text.includes(pattern);
}
function readSourceBundle({ sourceRoot, readFile = (file) => fs.readFileSync(file, 'utf8'), sources = {} } = {}) {
  const bundle = {};
  for (const relativePath of SOURCE_FILES) {
    try {
      bundle[relativePath] = typeof sources[relativePath] === 'string'
        ? sources[relativePath]
        : readFile(path.join(sourceRoot, relativePath));
    } catch {
      bundle[relativePath] = null;
    }
  }
  return bundle;
}

export function inspectCodexWebGptIntegrationSource({ sourceRoot, version = '5.0.2', readFile, sources } = {}) {
  const bundle = readSourceBundle({ sourceRoot, readFile, sources });
  const shared = bundle['src/codex-integration-shared.ts'] ?? '';
  const integration = bundle['src/codex-integration.ts'] ?? '';
  const interruptHook = bundle['src/codex-interrupt-hook.ts'] ?? '';
  const config = bundle['src/config.ts'] ?? '';
  const cli = bundle['src/cli.ts'] ?? '';
  const devProfile = bundle['src/dev-chat/profile.ts'] ?? '';
  const architecture = bundle['docs/architecture.md'] ?? '';
  const devDocs = bundle['docs/dev-chat.md'] ?? '';
  const availableSourceFiles = SOURCE_FILES.filter((relativePath) => typeof bundle[relativePath] === 'string');

  const explicitCodexHomeHonored = includes(shared, 'process.env.CODEX_HOME')
    && includes(shared, 'getCodexHome')
    && includes(shared, 'join(homedir(), ".codex")');
  const productionDirectIntegrationMutatesConfig = includes(shared, 'getCodexConfigPath')
    && includes(integration, 'writeIntegrationState')
    && includes(integration, 'getCodexConfigPath()');
  const hookTrustStateMutated = includes(interruptHook, 'trusted_hash')
    && includes(interruptHook, '[hooks.state.')
    && includes(interruptHook, 'canonicalConfigPath');
  const applicationHomeOverrideHonored = includes(config, 'CODEX_CHATGPT_WEB_HOME')
    && includes(cli, 'CODEX_CHATGPT_WEB_HOME');
  const devHasIsolatedCodexHome = includes(devProfile, 'CODEX_WEB_GPT_DEV_HOME')
    && includes(devProfile, 'codexHome: join(home, "codex-home")');
  const devAvoidsNormalConfig = includes(devDocs, 'does not edit the normal `~/.codex/config.toml`')
    && includes(devProfile, 'CODEX_HOME');
  const devHasSeparateBrowserState = includes(devDocs, 'separate Electron `userData` directory')
    && includes(devDocs, 'persistent browser partition');
  const launcherLifecycleOverrideUnproven = explicitCodexHomeHonored && !includes(architecture, 'dedicated production CODEX_HOME');

  return {
    adapterId: CODEX_WEBGPT_ADAPTER_ID,
    adapterVersion: CODEX_WEBGPT_ADAPTER_VERSION,
    observedVersion: version,
    sourceFilesRead: availableSourceFiles,
    sourceComplete: availableSourceFiles.length === SOURCE_FILES.length,
    explicitCodexHomeHonored,
    applicationHomeOverrideHonored,
    productionDirectIntegrationMutatesConfig,
    hookTrustStateMutated,
    devHasIsolatedCodexHome,
    devAvoidsNormalConfig,
    devHasSeparateBrowserState,
    launcherLifecycleOverrideUnproven,
    currentProductionMode: productionDirectIntegrationMutatesConfig ? 'legacy_shared_default_root' : 'unknown',
    preferredMode: 'external_route_provider',
    fallbackMode: 'dedicated_webgpt_codex_home',
    sourceContentsReturned: false,
    secretsExcluded: true,
  };
}

export function buildCodexWebGptIsolationDecision(analysis) {
  const sourceBoundaryProven = analysis?.explicitCodexHomeHonored === true
    && analysis?.applicationHomeOverrideHonored === true
    && analysis?.devHasIsolatedCodexHome === true
    && analysis?.devAvoidsNormalConfig === true
    && analysis?.devHasSeparateBrowserState === true;
  return {
    adapterId: CODEX_WEBGPT_ADAPTER_ID,
    adapterVersion: CODEX_WEBGPT_ADAPTER_VERSION,
    status: sourceBoundaryProven ? 'OK' : 'NOT_OK',
    sourceBoundaryProven,
    currentProductionMode: analysis?.currentProductionMode ?? 'unknown',
    productionDirectIntegrationAllowed: false,
    productionDirectIntegrationReason: 'shared_default_root_has_multiple_possible_config_writers',
    preferredIntegrationMode: 'external_route_provider',
    preferredIntegrationStatus: 'target_contract_not_proven_by_v5_source',
    fallbackIntegrationMode: 'dedicated_webgpt_codex_home',
    fallbackIntegrationStatus: analysis?.explicitCodexHomeHonored === true
      ? 'source_resolution_supported_launcher_lifecycle_unproven'
      : 'source_resolution_not_proven',
    migrationRequired: true,
    nativeProfileIdsExcluded: [
      'runtime_profile:openai.01.cli',
      'runtime_profile:openai.02.cli',
    ],
    optionalWebGptConsumerProfile: 'runtime_profile:codex.webgpt.production',
    webGptFailureIsolation: 'required',
    devProductionNamespaceCollision: analysis?.devHasIsolatedCodexHome && analysis?.devHasSeparateBrowserState ? 'not_observed' : 'unknown',
    secretsExcluded: true,
  };
}
