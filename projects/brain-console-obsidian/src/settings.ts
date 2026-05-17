export interface BrainConsoleSettings {
  brainCoreUrl: string;
}

export const DEFAULT_BRAIN_CONSOLE_SETTINGS: BrainConsoleSettings = {
  brainCoreUrl: 'http://localhost:4877',
};

export function normalizeBrainCoreUrl(rawValue: string): { value: string; warning?: string; error?: string } {
  try {
    const url = new URL(rawValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { value: DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl, error: 'Brain Core URL must use http or https.' };
    }
    const warning = isLikelyLocalhost(url.hostname)
      ? undefined
      : 'Brain Core URL is not localhost; this plugin is intended for local read-only use.';
    return { value: url.toString().replace(/\/+$/g, ''), warning };
  } catch {
    return { value: DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl, error: 'Brain Core URL is invalid.' };
  }
}

function isLikelyLocalhost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}
