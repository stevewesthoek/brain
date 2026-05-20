import type {
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppOperationalReadinessFreshness,
  BrainCoreLocalAppOperationalReadinessItem,
  BrainCoreLocalAppOperationalReadinessSafety,
  BrainCoreLocalAppReachabilityStatus,
  BrainCoreLocalAppsOperationalReadinessResponse,
} from '../types/api.js';
import { listLocalAppDefinitions, readLocalAppActionStatus } from './local-app-orchestrator.js';

const PER_APP_TIMEOUT_MS = 1_500;

const ITEM_SAFETY: BrainCoreLocalAppOperationalReadinessSafety = {
  readOnly: true,
  pluginExecutesShell: false,
  arbitraryCommandAllowed: false,
  exposesSecrets: false,
  writesToMind: false,
  performsLifecycleAction: false,
};

export async function readLocalAppsOperationalReadiness(
  fetchImpl: typeof fetch = fetch,
): Promise<BrainCoreLocalAppsOperationalReadinessResponse> {
  const inventory = listLocalAppDefinitions();
  const actionStatus = readLocalAppActionStatus();
  const startedAt = Date.now();
  const generatedAt = new Date(startedAt).toISOString();

  const items = await Promise.all(
    inventory.map((app): Promise<BrainCoreLocalAppOperationalReadinessItem> => {
      return probeApp(app, fetchImpl, actionStatus.recentResults, actionStatus.lastErrorByApp);
    }),
  );

  const totalCheckDurationMs = Date.now() - startedAt;

  return {
    id: 'local-apps-operational-readiness',
    generatedAt,
    appCount: items.length,
    reachableCount: items.filter((e) => e.status === 'reachable').length,
    unreachableCount: items.filter((e) => e.status === 'unreachable').length,
    unknownCount: items.filter((e) => e.status === 'unknown').length,
    notConfiguredCount: items.filter((e) => e.status === 'not-configured').length,
    staleCount: items.filter((e) => e.status === 'stale').length,
    items,
    totalCheckDurationMs,
    safety: ITEM_SAFETY,
  };
}

async function probeApp(
  app: BrainCoreLocalAppDefinition,
  fetchImpl: typeof fetch,
  recentResults: ReturnType<typeof readLocalAppActionStatus>['recentResults'],
  lastErrorByApp: ReturnType<typeof readLocalAppActionStatus>['lastErrorByApp'],
): Promise<BrainCoreLocalAppOperationalReadinessItem> {
  const { id: appId, name: appName, appUrl, healthUrl, appPort: port, actionPolicy } = app;
  const safeActions = actionPolicy.safeActions;
  const actionEnabled = actionPolicy.status === 'enabled' && safeActions.length > 0;
  const startSupported = safeActions.includes('start');
  const stopSupported = safeActions.includes('stop');
  const restartSupported = safeActions.includes('restart');

  const lastAction = resolveLastAction(appId, recentResults, lastErrorByApp);

  if (!healthUrl) {
    return {
      appId,
      appName,
      ...(appUrl !== undefined ? { appUrl } : {}),
      ...(port !== undefined ? { port } : {}),
      status: 'not-configured',
      message: 'No health URL configured for this app.',
      actionEnabled,
      startSupported,
      stopSupported,
      restartSupported,
      ...(lastAction ? { lastAction } : {}),
      freshness: {
        source: 'not-checked',
        maxAgeMs: PER_APP_TIMEOUT_MS,
        fresh: false,
      },
      safety: ITEM_SAFETY,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_APP_TIMEOUT_MS);
  const probeStart = Date.now();

  try {
    const response = await fetchImpl(healthUrl, { signal: controller.signal });
    const durationMs = Date.now() - probeStart;
    const checkedAt = new Date().toISOString();
    const status: BrainCoreLocalAppReachabilityStatus = response.ok ? 'reachable' : 'unreachable';
    const freshness: BrainCoreLocalAppOperationalReadinessFreshness = {
      source: 'live-check',
      maxAgeMs: PER_APP_TIMEOUT_MS,
      ageMs: 0,
      fresh: response.ok,
    };
    return {
      appId,
      appName,
      ...(appUrl !== undefined ? { appUrl } : {}),
      healthUrl,
      ...(port !== undefined ? { port } : {}),
      status,
      httpStatus: response.status,
      checkedAt,
      durationMs,
      message: response.ok
        ? `Health check responded ${response.status} in ${durationMs}ms.`
        : `Health check returned non-OK status ${response.status}.`,
      actionEnabled,
      startSupported,
      stopSupported,
      restartSupported,
      ...(lastAction ? { lastAction } : {}),
      freshness,
      safety: ITEM_SAFETY,
    };
  } catch (err) {
    const durationMs = Date.now() - probeStart;
    const checkedAt = new Date().toISOString();
    const isTimeout = controller.signal.aborted;
    return {
      appId,
      appName,
      ...(appUrl !== undefined ? { appUrl } : {}),
      healthUrl,
      ...(port !== undefined ? { port } : {}),
      status: 'unreachable',
      checkedAt,
      durationMs,
      message: isTimeout
        ? `Health check timed out after ${durationMs}ms.`
        : `Health check failed: ${safeErrorMessage(err)}.`,
      actionEnabled,
      startSupported,
      stopSupported,
      restartSupported,
      ...(lastAction ? { lastAction } : {}),
      freshness: {
        source: 'live-check',
        maxAgeMs: PER_APP_TIMEOUT_MS,
        ageMs: durationMs,
        fresh: false,
      },
      safety: ITEM_SAFETY,
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveLastAction(
  appId: string,
  recentResults: ReturnType<typeof readLocalAppActionStatus>['recentResults'],
  lastErrorByApp: ReturnType<typeof readLocalAppActionStatus>['lastErrorByApp'],
): BrainCoreLocalAppOperationalReadinessItem['lastAction'] {
  const mostRecent = recentResults.find((r) => r.appId === appId);
  const lastError = lastErrorByApp[appId];
  const candidate = mostRecent ?? lastError;
  if (!candidate) return undefined;
  return {
    action: candidate.action,
    status: candidate.status,
    ok: candidate.ok,
    endedAt: candidate.endedAt,
    message: candidate.message,
  };
}

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown error';
  const msg = err.message;
  return msg
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*=)[^\s]+/gi, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .slice(0, 120);
}
