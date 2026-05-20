import test from 'node:test';
import assert from 'node:assert/strict';
import '../api/routes.js';
import {
  __localAppsOperatorSummaryTestHooks,
} from '../adapters/local-app-operator-summary.js';
import type {
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppOperatorSummaryItem,
  BrainCoreLocalAppOperatorSummaryLastAction,
} from '../types/api.js';

const baseApp: BrainCoreLocalAppDefinition = {
  id: 'video-orchestrator',
  name: 'Video Orchestrator',
  label: 'Video Orchestrator',
  description: 'Video Orchestrator',
  category: 'video',
  appPort: 4310,
  appUrl: 'http://127.0.0.1:4310',
  healthUrl: 'http://127.0.0.1:4310/status',
  managed: true,
  services: [],
  docsRef: 'operations/infrastructure/local-apps.md',
  onboardingStatus: 'registered',
  actionPolicy: {
    status: 'enabled',
    executionPath: 'brain-core-allowlisted-action',
    requiresConfirmation: true,
    requiresAllowlist: true,
    pluginExecutesShell: false,
    arbitraryCommandAllowed: false,
    safeActions: ['start', 'restart'],
    blockedActions: ['custom-command'],
  },
};

const recentFailedAction: BrainCoreLocalAppOperatorSummaryLastAction = {
  action: 'restart',
  status: 'failed',
  ok: false,
  endedAt: '2026-05-20T00:00:00.000Z',
  message: 'Failed with API_TOKEN=abc123 and path /Users/Office/private/app/.env',
};

test('operator summary prioritizes recent failed action over generic unreachable start', () => {
  const nextAction = __localAppsOperatorSummaryTestHooks.deriveNextAction(
    baseApp,
    'unreachable',
    ['start', 'restart'],
    [],
    recentFailedAction,
  );

  assert.equal(nextAction.kind, 'restart');
  assert.equal(nextAction.executable, true);
  assert.match(nextAction.reason, /Recent restart action failed/);
  assert.doesNotMatch(nextAction.reason, /API_TOKEN=abc123/);
  assert.doesNotMatch(nextAction.reason, /\/Users\/Office\/private/);
});

test('operator summary falls back to inspect-health when a failed action cannot restart', () => {
  const nextAction = __localAppsOperatorSummaryTestHooks.deriveNextAction(
    baseApp,
    'unreachable',
    ['start'],
    [],
    recentFailedAction,
  );

  assert.equal(nextAction.kind, 'inspect-health');
  assert.equal(nextAction.executable, false);
  assert.match(nextAction.reason, /restart is not currently supported/i);
});

test('operator summary top attention items are severity ranked and deterministic', () => {
  const items: BrainCoreLocalAppOperatorSummaryItem[] = [
    createItem('zz-lifecycle', 'Zulu Lifecycle', 'attention', 'reachable', 'add-lifecycle-script', false),
    createItem('aa-unreachable', 'Alpha Unreachable', 'attention', 'unreachable', 'start', true),
    createItem('mm-blocked', 'Mike Blocked', 'blocked', 'reachable', 'manual-review', false),
    createItem('bb-failed', 'Beta Failed', 'attention', 'unreachable', 'restart', true, recentFailedAction),
    createItem('cc-stale', 'Charlie Stale', 'attention', 'stale', 'inspect-health', false),
    createItem('dd-not-configured', 'Delta Not Configured', 'attention', 'not-configured', 'configure-health-url', false),
  ];

  const orderedIds = [...items]
    .sort(__localAppsOperatorSummaryTestHooks.compareAttentionItems)
    .map((item) => item.appId);

  assert.deepEqual(orderedIds, [
    'bb-failed',
    'mm-blocked',
    'aa-unreachable',
    'cc-stale',
    'dd-not-configured',
    'zz-lifecycle',
  ]);
});

test('operator summary sanitizes secret-like values and local paths in action text', () => {
  const sanitized = __localAppsOperatorSummaryTestHooks.sanitizeOperatorSummaryText(
    'Failed with SECRET_KEY=abc123 at /Users/Office/private/app/.env',
  );

  assert.match(sanitized, /SECRET_KEY=\[redacted\]/);
  assert.doesNotMatch(sanitized, /abc123/);
  assert.doesNotMatch(sanitized, /\/Users\/Office\/private/);
});

function createItem(
  appId: string,
  appName: string,
  status: BrainCoreLocalAppOperatorSummaryItem['status'],
  reachabilityStatus: BrainCoreLocalAppOperatorSummaryItem['reachabilityStatus'],
  nextActionKind: BrainCoreLocalAppOperatorSummaryItem['nextRecommendedAction']['kind'],
  executable: boolean,
  lastAction?: BrainCoreLocalAppOperatorSummaryLastAction,
): BrainCoreLocalAppOperatorSummaryItem {
  return {
    appId,
    appName,
    status,
    reachabilityStatus,
    actionEnabled: executable,
    supportedActions: executable ? ['start'] : [],
    disabledActions: [],
    ...(lastAction ? { lastAction } : {}),
    nextRecommendedAction: {
      label: nextActionKind,
      kind: nextActionKind,
      reason: nextActionKind,
      executable,
    },
    freshness: {
      fresh: false,
      source: 'operational-readiness',
    },
  };
}
