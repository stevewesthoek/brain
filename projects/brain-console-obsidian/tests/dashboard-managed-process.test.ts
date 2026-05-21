import { describe, expect, it } from 'vitest';
import { deriveDashboardSnapshot } from '../src/dashboard.js';
import type { BrainConsoleViewState } from '../src/view.js';

function baseState(overrides: Partial<BrainConsoleViewState> = {}): BrainConsoleViewState {
  return {
    status: { service: 'brain-core', mode: 'read-only', ok: true },
    localAppsDashboard: {
      id: 'local-apps-dashboard',
      status: 'available',
      appCount: 1,
      runningCount: 1,
      stoppedCount: 0,
      unknownCount: 0,
      managedCount: 1,
      unmanagedCount: 0,
      apps: [],
      actionPolicy: {
        status: 'enabled',
        executionPath: 'brain-core-allowlisted-action',
        requiresConfirmation: true,
        requiresAllowlist: true,
        pluginExecutesShell: false,
        arbitraryCommandAllowed: false,
        safeActions: ['start', 'stop', 'restart'],
        blockedActions: ['custom-command'],
      },
      safety: {
        readOnlyDashboard: true,
        pluginExecutesShell: false,
        arbitraryCommandExecution: false,
        exposesSecrets: false,
        exposesEnv: false,
        platformWrites: false,
        mindWrites: false,
        destructiveActions: false,
        startStopControlsEnabled: true,
      },
      blockers: [],
      nextSafeStep: 'Review local apps.',
    },
    localAppsActionStatus: {
      id: 'local-apps-actions-status',
      inFlight: [],
      recentResults: [],
      lastErrorByApp: {},
      locks: [],
      managedProcesses: [
        {
          appId: 'prochat',
          action: 'start',
          pid: 12345,
          startedAt: '2026-05-21T08:00:00.000Z',
          cwdSummary: 'prochat',
          strategy: 'repo-npm-dev',
          commandLabel: 'npm run dev',
        },
      ],
      audit: {
        status: 'enabled',
        path: 'runtime/local/local-apps/actions-audit.jsonl',
        persistedResultCount: 0,
        safety: {
          pluginExecutesShell: false,
          arbitraryCommandAllowed: false,
          commandOverrideAccepted: false,
          exposesSecrets: false,
          writesToMind: false,
          writesOperationsConfig: false,
        },
      },
      safety: {
        pluginExecutesShell: false,
        arbitraryCommandAllowed: false,
        commandOverrideAccepted: false,
        exposesSecrets: false,
      },
    },
    ...overrides,
  } as BrainConsoleViewState;
}

describe('Dashboard managed-process summary', () => {
  it('counts active Brain Core-managed local app processes', () => {
    const snapshot = deriveDashboardSnapshot(baseState(), 'http://127.0.0.1:4877');

    expect(snapshot.localAppManagedProcessCount).toBe(1);
    expect(snapshot.nextAction).toBe('1 Brain Core-managed local app process active');
  });

  it('keeps execution blockers higher priority than managed-process visibility', () => {
    const snapshot = deriveDashboardSnapshot(
      baseState({
        executionReadiness: {
          id: 'execution-readiness',
          status: 'blocked',
          readyCandidateCount: 0,
          blockers: ['Approval policy missing.'],
          candidates: [],
          safety: {
            readOnly: true,
            writesToMind: false,
            mutatesRuntime: false,
            executesShell: false,
            externalSideEffects: false,
          },
        } as any,
      }),
      'http://127.0.0.1:4877',
    );

    expect(snapshot.localAppManagedProcessCount).toBe(1);
    expect(snapshot.nextAction).toBe('Blocked: Approval policy missing.');
  });
});
