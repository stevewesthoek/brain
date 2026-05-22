import { execSync } from 'node:child_process';

const SELECTOR_URL = process.env.AI_SELECTOR_URL ?? 'http://127.0.0.1:4890';
const LAUNCHD_LABEL = 'com.office.ai-model-selector';
const PLIST_PATH = `${process.env.HOME ?? '/Users/Office'}/Library/LaunchAgents/com.office.ai-model-selector.plist`;
const HEALTH_TIMEOUT_MS = 3000;

export interface AiModelSelectorStatus {
  running: boolean;
  healthy: boolean;
  uptime?: string | undefined;
  providers?: AiModelSelectorProvider[] | undefined;
  error?: string | undefined;
  lastChecked: string;
}

export interface AiModelSelectorProvider {
  id: string;
  type: string;
  healthy: boolean;
  circuitState: string;
  costPer1kTokens: number;
}

export interface AiModelSelectorControlResult {
  success: boolean;
  action: 'start' | 'stop';
  message: string;
}

export async function getAiModelSelectorStatus(): Promise<AiModelSelectorStatus> {
  const now = new Date().toISOString();

  const running = isLaunchdJobRunning();

  if (!running) {
    return {
      running: false,
      healthy: false,
      lastChecked: now,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const response = await fetch(`${SELECTOR_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        running: true,
        healthy: false,
        error: `Health endpoint returned ${response.status}`,
        lastChecked: now,
      };
    }

    const data = await response.json() as {
      uptime?: string;
      providers?: Array<{
        id: string;
        type: string;
        healthy: boolean;
        circuit_state?: { status: string } | string;
        cost_per_1k_tokens: number;
      }>;
    };

    const providers: AiModelSelectorProvider[] = (data.providers ?? []).map((p) => ({
      id: p.id,
      type: p.type,
      healthy: p.healthy,
      circuitState: typeof p.circuit_state === 'object' && p.circuit_state !== null
        ? (p.circuit_state as { status: string }).status
        : String(p.circuit_state ?? 'unknown'),
      costPer1kTokens: p.cost_per_1k_tokens,
    }));

    return {
      running: true,
      healthy: true,
      uptime: data.uptime,
      providers,
      lastChecked: now,
    };
  } catch (err) {
    return {
      running: true,
      healthy: false,
      error: err instanceof Error ? err.message : 'Unknown health check error',
      lastChecked: now,
    };
  }
}

export function controlAiModelSelector(action: 'start' | 'stop'): AiModelSelectorControlResult {
  try {
    if (action === 'start') {
      execSync(`launchctl load -w "${PLIST_PATH}" 2>/dev/null; launchctl start "${LAUNCHD_LABEL}"`, { timeout: 5000 });
      return { success: true, action, message: 'AI Model Selector service started.' };
    } else {
      execSync(`launchctl stop "${LAUNCHD_LABEL}" 2>/dev/null; launchctl unload "${PLIST_PATH}" 2>/dev/null`, { timeout: 5000 });
      return { success: true, action, message: 'AI Model Selector service stopped.' };
    }
  } catch (err) {
    return {
      success: false,
      action,
      message: err instanceof Error ? err.message : 'Control command failed.',
    };
  }
}

function isLaunchdJobRunning(): boolean {
  try {
    const output = execSync(`launchctl list "${LAUNCHD_LABEL}" 2>/dev/null`, { encoding: 'utf8', timeout: 3000 });
    return !output.includes('Could not find');
  } catch {
    return false;
  }
}
