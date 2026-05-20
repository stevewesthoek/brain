import type {
  BrainCoreLocalAppAction,
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppOperatorSummaryDisabledAction,
  BrainCoreLocalAppOperatorSummaryFreshness,
  BrainCoreLocalAppOperatorSummaryItem,
  BrainCoreLocalAppOperatorSummaryItemStatus,
  BrainCoreLocalAppOperatorSummaryLastAction,
  BrainCoreLocalAppOperatorSummaryNextAction,
  BrainCoreLocalAppOperatorSummarySafety,
  BrainCoreLocalAppsOperatorSummaryResponse,
  BrainCoreLocalAppReachabilityStatus,
} from '../types/api.js';
import { evaluateLocalAppActionDefinition } from './local-app-action-executor.js';
import { readLocalAppsOperationalReadiness } from './local-app-operational-readiness.js';
import { listLocalAppDefinitions, readLocalAppActionStatus } from './local-app-orchestrator.js';

const SUMMARY_SAFETY: BrainCoreLocalAppOperatorSummarySafety = {
  readOnly: true,
  pluginExecutesShell: false,
  arbitraryCommandAllowed: false,
  exposesSecrets: false,
  writesToMind: false,
  performsLifecycleAction: false,
};

const ACTIONS: BrainCoreLocalAppAction[] = ['start', 'stop', 'restart'];

export async function readLocalAppsOperatorSummary(
  fetchImpl: typeof fetch = fetch,
): Promise<BrainCoreLocalAppsOperatorSummaryResponse> {
  const generatedAt = new Date().toISOString();
  const inventory = listLocalAppDefinitions();
  const actionStatus = readLocalAppActionStatus();

  const operationalReadiness = await readLocalAppsOperationalReadiness(fetchImpl);
  const readinessMap = new Map(operationalReadiness.items.map((item) => [item.appId, item]));

  let executableActionCount = 0;
  let disabledActionCount = 0;

  const items: BrainCoreLocalAppOperatorSummaryItem[] = inventory.map((app) => {
    const readinessItem = readinessMap.get(app.id);

    const supportedActions: BrainCoreLocalAppAction[] = [];
    const disabledActions: BrainCoreLocalAppOperatorSummaryDisabledAction[] = [];

    for (const action of ACTIONS) {
      const evaluation = evaluateLocalAppActionDefinition(app, action);
      if (evaluation.executable) {
        supportedActions.push(action);
        executableActionCount++;
      } else {
        disabledActions.push({
          action,
          reason: evaluation.reason,
          category: categorizeReason(evaluation.reason),
        });
        disabledActionCount++;
      }
    }

    const reachabilityStatus: BrainCoreLocalAppReachabilityStatus =
      readinessItem?.status ?? 'unknown';
    const actionEnabled = supportedActions.length > 0;

    const lastAction = resolveLastAction(app.id, actionStatus);
    const recentFailedAction = lastAction && !lastAction.ok ? lastAction : undefined;

    const itemStatus = deriveItemStatus(app, reachabilityStatus, actionEnabled, disabledActions, recentFailedAction);
    const nextRecommendedAction = deriveNextAction(app, reachabilityStatus, supportedActions, disabledActions, recentFailedAction);

    const freshness: BrainCoreLocalAppOperatorSummaryFreshness = {
      ...(readinessItem?.checkedAt !== undefined ? { checkedAt: readinessItem.checkedAt } : {}),
      fresh: readinessItem?.freshness?.fresh ?? false,
      source: 'operational-readiness',
    };

    return {
      appId: app.id,
      appName: app.name,
      status: itemStatus,
      reachabilityStatus,
      actionEnabled,
      supportedActions,
      disabledActions,
      ...(lastAction ? { lastAction } : {}),
      nextRecommendedAction,
      freshness,
    };
  });

  const attentionItems = items.filter((item) => item.status === 'attention' || item.status === 'blocked');
  const topAttentionItems = attentionItems.slice(0, 5).map((item) => ({
    appId: item.appId,
    appName: item.appName,
    status: item.status,
    reason: item.nextRecommendedAction.reason,
    nextRecommendedAction: item.nextRecommendedAction.label,
  }));

  return {
    id: 'local-apps-operator-summary',
    generatedAt,
    appCount: items.length,
    executableActionCount,
    disabledActionCount,
    reachableCount: items.filter((i) => i.reachabilityStatus === 'reachable').length,
    unreachableCount: items.filter((i) => i.reachabilityStatus === 'unreachable').length,
    notConfiguredCount: items.filter((i) => i.reachabilityStatus === 'not-configured').length,
    staleCount: items.filter((i) => i.reachabilityStatus === 'stale').length,
    attentionCount: attentionItems.length,
    items,
    topAttentionItems,
    safety: SUMMARY_SAFETY,
  };
}

function deriveItemStatus(
  app: BrainCoreLocalAppDefinition,
  reachabilityStatus: BrainCoreLocalAppReachabilityStatus,
  actionEnabled: boolean,
  disabledActions: BrainCoreLocalAppOperatorSummaryDisabledAction[],
  recentFailedAction?: BrainCoreLocalAppOperatorSummaryLastAction,
): BrainCoreLocalAppOperatorSummaryItemStatus {
  if (recentFailedAction) return 'attention';
  if (reachabilityStatus === 'unreachable') return 'attention';
  if (reachabilityStatus === 'stale') return 'attention';
  if (!app.healthUrl && app.managed) return 'attention';
  if (!actionEnabled && disabledActions.length > 0 && app.managed) return 'blocked';
  if (reachabilityStatus === 'unknown') return 'unknown';
  return 'ok';
}

function deriveNextAction(
  app: BrainCoreLocalAppDefinition,
  reachabilityStatus: BrainCoreLocalAppReachabilityStatus,
  supportedActions: BrainCoreLocalAppAction[],
  disabledActions: BrainCoreLocalAppOperatorSummaryDisabledAction[],
  recentFailedAction?: BrainCoreLocalAppOperatorSummaryLastAction,
): BrainCoreLocalAppOperatorSummaryNextAction {
  if (reachabilityStatus === 'unreachable' && supportedActions.includes('start')) {
    return {
      label: `Start ${app.name}`,
      kind: 'start',
      reason: 'App is unreachable and start is supported.',
      executable: true,
    };
  }

  if (recentFailedAction && supportedActions.includes('restart')) {
    return {
      label: `Restart ${app.name}`,
      kind: 'restart',
      reason: `Recent ${recentFailedAction.action} action failed: ${recentFailedAction.message}`,
      executable: true,
    };
  }

  if (!app.healthUrl) {
    return {
      label: 'Configure health URL',
      kind: 'configure-health-url',
      reason: `${app.name} has no health URL configured — reachability cannot be checked.`,
      executable: false,
    };
  }

  const lifecycleGap = disabledActions.find(
    (da) => da.category === 'missing-command' || da.category === 'missing-repo-local-script',
  );
  if (lifecycleGap) {
    return {
      label: 'Add lifecycle script',
      kind: 'add-lifecycle-script',
      reason: `${app.name} ${lifecycleGap.action} action needs a lifecycle script: ${lifecycleGap.reason}`,
      executable: false,
    };
  }

  if (reachabilityStatus === 'unreachable') {
    return {
      label: 'Inspect health',
      kind: 'inspect-health',
      reason: `${app.name} is unreachable but no automated action is available.`,
      executable: false,
    };
  }

  if (disabledActions.length > 0) {
    return {
      label: 'Manual review',
      kind: 'manual-review',
      reason: `${app.name} has ${disabledActions.length} disabled action(s) that require manual review.`,
      executable: false,
    };
  }

  return {
    label: 'No action needed',
    kind: 'none',
    reason: `${app.name} is operating normally.`,
    executable: false,
  };
}

function resolveLastAction(
  appId: string,
  actionStatus: ReturnType<typeof readLocalAppActionStatus>,
): BrainCoreLocalAppOperatorSummaryLastAction | undefined {
  const mostRecent = actionStatus.recentResults.find((r) => r.appId === appId);
  const lastError = actionStatus.lastErrorByApp[appId];
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

function categorizeReason(reason: string): string {
  if (reason.includes('No canonical')) return 'missing-command';
  if (reason.includes('inline environment variables')) return 'missing-repo-local-script';
  if (reason.includes('secret-looking') || reason.includes('shell metacharacters')) return 'unsafe-command-shape';
  if (reason.includes('working directory')) return 'missing-working-directory';
  if (reason.includes('does not exist on disk')) return 'missing-helper';
  if (reason.includes('Start it from Brain Console first')) return 'dynamic-stop-after-brain-core-start';
  if (reason.includes('Manual')) return 'manual-only';
  if (reason.includes('allowlist')) return 'not-yet-allowlisted';
  return 'other';
}
