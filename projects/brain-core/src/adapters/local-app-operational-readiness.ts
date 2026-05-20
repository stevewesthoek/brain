import type {
  BrainCoreLocalAppReachabilityEntry,
  BrainCoreLocalAppReachabilityStatus,
  BrainCoreLocalAppsOperationalReadinessResponse,
} from '../types/api.js';
import { listLocalAppDefinitions } from './local-app-orchestrator.js';

const PER_APP_TIMEOUT_MS = 1_500;
const TOTAL_CAP_MS = 8_000;

export async function readLocalAppsOperationalReadiness(
  fetchImpl: typeof fetch = fetch,
): Promise<BrainCoreLocalAppsOperationalReadinessResponse> {
  const inventory = listLocalAppDefinitions();
  const startedAt = Date.now();
  const totalDeadline = startedAt + TOTAL_CAP_MS;
  const generatedAt = new Date(startedAt).toISOString();

  const entries = await Promise.all(
    inventory.map((app): Promise<BrainCoreLocalAppReachabilityEntry> => {
      return probeApp(app.id, app.name, app.healthUrl ?? null, fetchImpl, totalDeadline);
    }),
  );

  const totalCheckDurationMs = Date.now() - startedAt;

  return {
    id: 'local-apps-operational-readiness',
    generatedAt,
    appCount: entries.length,
    reachableCount: entries.filter((e) => e.reachabilityStatus === 'reachable').length,
    unreachableCount: entries.filter((e) => e.reachabilityStatus === 'unreachable').length,
    unknownCount: entries.filter((e) => e.reachabilityStatus === 'unknown').length,
    notConfiguredCount: entries.filter((e) => e.reachabilityStatus === 'not-configured').length,
    staleCount: entries.filter((e) => e.reachabilityStatus === 'stale').length,
    apps: entries,
    totalCheckDurationMs,
    safety: {
      readOnly: true,
      pluginExecutesShell: false,
      executesShell: false,
      exposesSecrets: false,
      exposesEnv: false,
      writesFiles: false,
    },
  };
}

async function probeApp(
  appId: string,
  appName: string,
  healthUrl: string | null,
  fetchImpl: typeof fetch,
  totalDeadline: number,
): Promise<BrainCoreLocalAppReachabilityEntry> {
  const checkedAt = new Date().toISOString();

  if (!healthUrl) {
    return {
      appId,
      appName,
      reachabilityStatus: 'not-configured',
      healthUrl: null,
      checkedAt,
      responseTimeMs: null,
      httpStatus: null,
      note: 'No health URL configured for this app.',
    };
  }

  const remainingMs = totalDeadline - Date.now();
  const timeoutMs = Math.min(PER_APP_TIMEOUT_MS, Math.max(remainingMs, 0));

  if (timeoutMs <= 0) {
    return {
      appId,
      appName,
      reachabilityStatus: 'stale',
      healthUrl,
      checkedAt,
      responseTimeMs: null,
      httpStatus: null,
      note: 'Check skipped: total readiness cap was reached before this app could be probed.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const probeStart = Date.now();

  try {
    const response = await fetchImpl(healthUrl, { signal: controller.signal });
    const responseTimeMs = Date.now() - probeStart;
    const reachabilityStatus: BrainCoreLocalAppReachabilityStatus = response.ok ? 'reachable' : 'unreachable';
    return {
      appId,
      appName,
      reachabilityStatus,
      healthUrl,
      checkedAt,
      responseTimeMs,
      httpStatus: response.status,
      note: response.ok
        ? `Health check responded ${response.status} in ${responseTimeMs}ms.`
        : `Health check returned non-OK status ${response.status}.`,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - probeStart;
    const isTimeout = controller.signal.aborted;
    return {
      appId,
      appName,
      reachabilityStatus: 'unreachable',
      healthUrl,
      checkedAt,
      responseTimeMs,
      httpStatus: null,
      note: isTimeout
        ? `Health check timed out after ${responseTimeMs}ms.`
        : `Health check failed: ${safeErrorMessage(err)}.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown error';
  const msg = err.message;
  return msg
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*=)[^\s]+/gi, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .slice(0, 120);
}
