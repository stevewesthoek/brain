/**
 * Graphify Backend Adapter
 *
 * Maps AI Model Selector results to Graphify CLI arguments.
 * Never allows silent fallback to any default backend.
 */

const GRAPHIFY_BACKENDS = ['azure', 'bedrock', 'claude', 'claude-cli', 'deepseek', 'gemini', 'kimi', 'ollama', 'openai'];

const PROVIDER_TO_BACKEND = {
  'ollama': 'ollama',
  'ollama-local': 'ollama',
  'openai': 'openai',
  'openai-compatible': 'openai',
  'claude-bedrock': 'bedrock',
  'bedrock': 'bedrock',
  'azure-openai': 'azure',
  'azure': 'azure',
  'gemini': 'gemini',
  'google-gemini': 'gemini',
  'deepseek': 'deepseek',
  'claude': 'claude',
  'anthropic': 'claude',
  'kimi': 'kimi',
};

const UNSUPPORTED_PROVIDERS = new Set([
  'codex-cli',
  'codex',
  'github-copilot',
]);

export function classifyGraphifyProviderSupport(selectorResult) {
  if (!selectorResult) {
    return { supported: false, reason: 'No selector result provided' };
  }

  const providerId = selectorResult.selectedProvider ?? selectorResult.provider_id ?? '';
  const providerType = selectorResult.provider_type ?? '';

  if (UNSUPPORTED_PROVIDERS.has(providerId)) {
    return {
      supported: false,
      reason: `Provider '${providerId}' selected by AI Model Selector, but Graphify CLI has no ${providerId} backend. Graphify supports: ${GRAPHIFY_BACKENDS.join(', ')}`,
      providerId,
    };
  }

  const backendFromId = PROVIDER_TO_BACKEND[providerId];
  const backendFromType = PROVIDER_TO_BACKEND[providerType];
  const backend = backendFromId ?? backendFromType;

  if (!backend) {
    return {
      supported: false,
      reason: `Cannot map provider '${providerId}' (type: '${providerType}') to a Graphify backend. Supported backends: ${GRAPHIFY_BACKENDS.join(', ')}`,
      providerId,
      providerType,
    };
  }

  return { supported: true, backend, providerId, providerType };
}

export function buildGraphifyBackendArgs(selectorResult) {
  const classification = classifyGraphifyProviderSupport(selectorResult);

  if (!classification.supported) {
    return { ok: false, error: classification.reason };
  }

  const model = selectorResult.selectedModel ?? selectorResult.model ?? '';
  const baseUrl = selectorResult.baseUrl ?? selectorResult.base_url ?? '';
  const apiKey = selectorResult.api_key ?? null;

  const args = [];
  const env = {};

  args.push('--backend', classification.backend);

  if (model) {
    args.push('--model', model);
  }

  if (baseUrl && ['openai', 'ollama', 'azure'].includes(classification.backend)) {
    args.push('--api-base', baseUrl);
  }

  if (apiKey && apiKey !== 'null') {
    if (classification.backend === 'openai' || classification.backend === 'azure') {
      env.OPENAI_API_KEY = apiKey;
    } else if (classification.backend === 'gemini') {
      env.GOOGLE_API_KEY = apiKey;
    } else if (classification.backend === 'claude') {
      env.ANTHROPIC_API_KEY = apiKey;
    }
  }

  return {
    ok: true,
    args,
    env,
    backend: classification.backend,
    model,
    baseUrl: baseUrl || null,
    providerId: classification.providerId,
  };
}

export function buildGraphifyExecutionPlan({ operation, repoRoot, selectorResult }) {
  const backendResult = buildGraphifyBackendArgs(selectorResult);

  if (!backendResult.ok) {
    return {
      canExecute: false,
      error: backendResult.error,
      recommendation: 'Re-run the AI Model Selector with a Graphify-compatible provider constraint (e.g. required_capability: graphify_semantic_backend). Supported: openai, gemini, claude, bedrock, ollama, deepseek, kimi, azure.',
    };
  }

  const baseCommand = operation === 'update'
    ? ['graphify', repoRoot, '--update']
    : ['graphify', 'extract', repoRoot, '--out', repoRoot];

  const fullArgs = [...baseCommand, ...backendResult.args];

  return {
    canExecute: true,
    command: fullArgs,
    commandString: fullArgs.join(' '),
    env: backendResult.env,
    backend: backendResult.backend,
    model: backendResult.model,
    baseUrl: backendResult.baseUrl,
    providerId: backendResult.providerId,
  };
}
