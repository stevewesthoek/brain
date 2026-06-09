/**
 * Graphify Backend Adapter
 *
 * Maps AI Model Selector results to Graphify CLI arguments.
 * Never allows silent fallback to any default backend.
 *
 * Registered providers (ai-providers.json): ollama-m4pro, ollama-m1, whisper-m4pro,
 * whisper-m1, codex-cli, claude-bedrock.
 *
 * Graphify-compatible providers: claude-bedrock, ollama-m4pro, ollama-m1.
 * Excluded: codex-cli (no Graphify CLI backend), whisper-m4pro, whisper-m1 (audio-only).
 *
 * Adapter mapping:
 *   claude-bedrock  → --backend bedrock  (uses AWS_PROFILE / AWS_REGION / AWS_DEFAULT_REGION)
 *                     NOTE: model is "bedrock-model-portfolio" which is not a concrete model ID.
 *                     Graphify will use its own Bedrock model selection unless --model is provided.
 *                     Do NOT pass --model with this provider unless a concrete model ID is available.
 *   ollama-m4pro    → --backend ollama + OLLAMA_BASE_URL=http://localhost:11434
 *   ollama-m1       → --backend ollama + OLLAMA_BASE_URL=http://192.168.2.2:11434
 *
 * Graphify extract --backend valid values: gemini|kimi|claude|openai|deepseek|ollama|bedrock
 * Ollama host override: OLLAMA_BASE_URL environment variable.
 * Bedrock auth: AWS_PROFILE, AWS_REGION, or AWS_DEFAULT_REGION environment variables.
 */

// Backends confirmed in Graphify CLI source (v0.8.36):
const GRAPHIFY_BACKENDS = ['azure', 'bedrock', 'claude', 'claude-cli', 'deepseek', 'gemini', 'kimi', 'ollama', 'openai'];

// Provider ID → Graphify backend name.
// Only registered providers in ai-providers.json are mapped here.
// "openai" is NOT a registered provider — do not add it.
const PROVIDER_TO_BACKEND = {
  // Registered: claude-bedrock
  'claude-bedrock': 'bedrock',
  'bedrock': 'bedrock',
  // Registered: ollama-m4pro, ollama-m1
  'ollama-m4pro': 'ollama',
  'ollama-m1': 'ollama',
  // Generic ollama aliases (type-based fallback)
  'ollama': 'ollama',
  'ollama-local': 'ollama',
  // openai-compatible type maps to openai backend (for unknown future providers, not current registered ones)
  'openai-compatible': 'openai',
  // Other potential providers (not currently registered)
  'azure-openai': 'azure',
  'azure': 'azure',
  'gemini': 'gemini',
  'google-gemini': 'gemini',
  'deepseek': 'deepseek',
  'claude': 'claude',
  'anthropic': 'claude',
  'kimi': 'kimi',
};

// Providers that are explicitly rejected for Graphify use.
const UNSUPPORTED_PROVIDERS = new Set([
  'codex-cli',   // CLI-only tool, no Graphify backend integration
  'codex',
  'github-copilot',
  'whisper-m4pro',   // audio transcription only
  'whisper-m1',      // audio transcription only
]);

// Known Bedrock model IDs that are portfolio aliases, not concrete model IDs.
// When the selector returns one of these, --model is omitted to let Graphify choose.
const BEDROCK_PORTFOLIO_IDS = new Set([
  'bedrock-model-portfolio',
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

  // For Bedrock: skip portfolio alias model IDs — let Graphify use its own selection.
  // For Ollama: model is passed via --model.
  // For other backends: pass model if available.
  const isBedrock = classification.backend === 'bedrock';
  const isPortfolioAlias = BEDROCK_PORTFOLIO_IDS.has(model);

  if (model && !(isBedrock && isPortfolioAlias)) {
    args.push('--model', model);
  }

  // Ollama host override: use OLLAMA_BASE_URL (Graphify reads this env var).
  // The --api-base flag is not exposed in graphify extract; use env var instead.
  if (classification.backend === 'ollama') {
    const ollamaHost = baseUrl || (classification.providerId === 'ollama-m1' ? 'http://192.168.2.2:11434' : 'http://localhost:11434');
    env.OLLAMA_BASE_URL = ollamaHost;
  }

  if (apiKey && apiKey !== 'null') {
    if (classification.backend === 'openai' || classification.backend === 'azure') {
      env.OPENAI_API_KEY = apiKey;
    } else if (classification.backend === 'gemini') {
      env.GOOGLE_API_KEY = apiKey;
    } else if (classification.backend === 'claude') {
      env.ANTHROPIC_API_KEY = apiKey;
    }
    // Bedrock uses AWS_PROFILE / AWS_REGION from the environment — no key injection needed here.
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
      recommendation: 'Re-run the AI Model Selector with a Graphify-compatible provider constraint (e.g. required_capability: graphify_semantic_backend). Registered compatible providers: claude-bedrock (bedrock backend), ollama-m4pro (ollama backend), ollama-m1 (ollama backend). Excluded: codex-cli (no Graphify backend), whisper-m4pro, whisper-m1 (audio-only).',
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
