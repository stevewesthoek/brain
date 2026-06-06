import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import type {
  BrainCoreLocalAppActionEnablementBacklogResponse,
  BrainCoreLocalAppActionEnablementCategory,
  BrainCoreLocalAppActionReadinessResponse,
  BrainCoreLocalAppDashboardItem,
  BrainCoreLocalAppHealth,
  BrainCoreLocalAppReadinessStatus,
  BrainCoreLocalAppSummary,
  BrainCoreLocalAppsDashboardResponse,
} from '../types/api.js';
import {
  createLocalAppActionPlan,
  executeLocalAppActionRequest,
  readLocalAppActionStatus,
  listLocalAppActionPlans,
  listLocalAppDefinitions,
  readLocalAppOnboardingChecklist,
  readLocalAppOrchestratorStatus,
} from './local-app-orchestrator.js';
import { evaluateLocalAppActionDefinition } from './local-app-action-executor.js';

const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build'];
const LOCAL_APPS_CONFIG_PATH = path.join(
  process.cwd(),
  '..',
  '..',
  'operations',
  'infrastructure',
  'local-apps.json',
);
const LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS = 5_000;

type LocalAppContainerStatus = 'running' | 'stopped' | 'unknown';

type LocalAppRuntime = {
  pathPrepend: string[];
  env: Record<string, string>;
  notes: string | null;
};

type NormalizedLocalApp = {
  name: string;
  port: number | null;
  url: string;
  check: string;
  start: string | null;
  stop: string | null;
  restart: string | null;
  description: string;
  repoPath: string | null;
  startupTimeoutMs: number | null;
  runtime: LocalAppRuntime | null;
  databaseEngine: string | null;
  databaseServiceName: string | null;
  databasePort: number | null;
  databaseName: string | null;
  databaseUser: string | null;
  notes: string | null;
};

type LocalAppsStatusOptions = {
  startingApps?: Map<string, { startedAt: number; startupTimeoutMs: number | null }> | Record<string, { startedAt: number; startupTimeoutMs: number | null }>;
  now?: number;
  portOccupiedChecker?: (port: number | null) => Promise<boolean>;
};

type RawLocalApp = {
  name?: unknown;
  port?: unknown;
  appPort?: unknown;
  url?: unknown;
  appUrl?: unknown;
  check?: unknown;
  healthCheck?: unknown;
  start?: unknown;
  startCommand?: unknown;
  stop?: unknown;
  stopCommand?: unknown;
  restart?: unknown;
  restartCommand?: unknown;
  startupTimeoutMs?: unknown;
  runtime?: unknown;
  description?: unknown;
  repoPath?: unknown;
  databaseEngine?: unknown;
  databaseServiceName?: unknown;
  databasePort?: unknown;
  databaseName?: unknown;
  databaseUser?: unknown;
  notes?: unknown;
};

const PLACEHOLDER_APPS: BrainCoreLocalAppSummary[] = [
  {
    id: 'office-scheduler',
    name: 'Office Nightly Scheduler',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
];

export function listLocalApps(): BrainCoreLocalAppSummary[] {
  const inventory = listLocalAppDefinitions();
  if (inventory.length === 0) return PLACEHOLDER_APPS;

  const report = readLocalAppsRuntimeReport();
  const runtimeById = new Map(
    report?.status === 'ok' || report?.status === 'available'
      ? (report.apps ?? []).map((app, index) => [safeText(app.id, `local-app-${index + 1}`), app] as const)
      : [],
  );
  const runtimeByName = new Map(
    report?.status === 'ok' || report?.status === 'available'
      ? (report.apps ?? []).map((app) => [safeText(app.name, ''), app] as const).filter(([name]) => name.length > 0)
      : [],
  );

  return inventory.map((app) => {
    const actionEvaluations = evaluateAppActions(app);
    const runtime = runtimeById.get(app.id) ?? runtimeByName.get(app.name);
    return {
      id: app.id,
      name: app.name,
      status: runtime ? normalizeStatus(runtime.status) : 'unknown',
      source: 'runtime-report',
      actionsSupported: actionEvaluations.some((entry) => entry.executable),
    };
  });
}

export function loadLocalApps(): NormalizedLocalApp[] {
  try {
    const raw = fs.readFileSync(LOCAL_APPS_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLocalApp).filter((app): app is NormalizedLocalApp => app !== null);
  } catch {
    return [];
  }
}

export function normalizeLocalApp(raw: RawLocalApp): NormalizedLocalApp | null {
  const name = readString(raw.name, '');
  if (!name) return null;
  return {
    name,
    port: readNumberOrNull(raw.port ?? raw.appPort),
    url: readString(raw.url ?? raw.appUrl, ''),
    check: readString(raw.check ?? raw.healthCheck, ''),
    start: readStringOrNull(raw.start ?? raw.startCommand),
    stop: readStringOrNull(raw.stop ?? raw.stopCommand),
    restart: readStringOrNull(raw.restart ?? raw.restartCommand),
    description: readString(raw.description, ''),
    repoPath: readStringOrNull(raw.repoPath),
    startupTimeoutMs: readNumberOrNull(raw.startupTimeoutMs),
    runtime: readRuntime(raw.runtime),
    databaseEngine: readStringOrNull(raw.databaseEngine),
    databaseServiceName: readStringOrNull(raw.databaseServiceName),
    databasePort: readNumberOrNull(raw.databasePort),
    databaseName: readStringOrNull(raw.databaseName),
    databaseUser: readStringOrNull(raw.databaseUser),
    notes: readStringOrNull(raw.notes),
  };
}

export async function buildLocalAppsStatus(
  apps: NormalizedLocalApp[],
  fetchImpl: typeof fetch = fetch,
  options: LocalAppsStatusOptions = {},
): Promise<{ apps: Array<{ name: string; port: number | null; url: string; description: string; status: string; restartable: boolean; lastSeen: null; lastDuration: null }> }> {
  const startingApps =
    options.startingApps instanceof Map
      ? options.startingApps
      : new Map(Object.entries(options.startingApps ?? {}));
  const now = options.now ?? Date.now();
  const checkPortOccupied = options.portOccupiedChecker ?? (async () => false);
  const statusApps = await Promise.all(
    apps.map(async (app) => {
      const startupState = startingApps.get(app.name) ?? null;
      const startupTimeoutMs = startupState?.startupTimeoutMs ?? null;
      const startupDeadline = startupState ? startupState.startedAt + (startupTimeoutMs ?? 30_000) : null;
      const withinStartupWindow = startupDeadline !== null ? now < startupDeadline : false;

      let status = 'stopped';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS);
      try {
        if (!app.check) throw new Error(`Missing health check for ${app.name}`);
        const response = await fetchImpl(app.check, { signal: controller.signal });
        if (response.ok) {
          status = 'running';
        } else if (withinStartupWindow) {
          status = 'starting';
        } else {
          try {
            const portOccupied = await checkPortOccupied(app.port);
            status = portOccupied ? 'blocked' : 'stopped';
          } catch {
            status = 'stopped';
          }
        }
      } catch {
        if (withinStartupWindow) {
          status = 'starting';
        } else {
          try {
            const portOccupied = await checkPortOccupied(app.port);
            status = portOccupied ? 'blocked' : 'stopped';
          } catch {
            status = 'stopped';
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      return {
        name: app.name,
        port: app.port,
        url: app.url,
        description: app.description,
        status,
        restartable: Boolean(app.restart || app.stop || app.start || app.port),
        lastSeen: null,
        lastDuration: null,
      };
    }),
  );
  return { apps: statusApps };
}

export async function waitForLocalAppHealth(
  app: NormalizedLocalApp | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 30000,
): Promise<boolean> {
  if (!app?.check) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(app.check, { signal: controller.signal });
      if (response.ok) return true;
    } catch {
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function readLocalAppsDashboardSync(): BrainCoreLocalAppsDashboardResponse {
  const inventory = listLocalAppDefinitions();
  const timestamp = new Date().toISOString();

  const apps: BrainCoreLocalAppDashboardItem[] = inventory.map((app) => {
    const lifecycleStatus = 'unknown' as const;
    const managed = app.managed;
    const executableActions = app.actionPolicy.status === 'enabled' ? app.actionPolicy.safeActions : [];
    const actionEnabled = executableActions.length > 0;
    const actionDisabledReasons = buildActionDisabledReasons(app);
    const disabledReason = formatActionDisabledReasons(actionDisabledReasons);
    return {
      id: app.id,
      name: app.name,
      label: app.label || app.name,
      category: app.category,
      status: lifecycleStatus,
      health: 'unknown' as const,
      source: app.category === 'brain-core' ? 'brain-core' : app.repoPathSummary ? 'infrastructure-config' : 'unknown',
      managed,
      startSupported: executableActions.includes('start'),
      stopSupported: executableActions.includes('stop'),
      restartSupported: executableActions.includes('restart'),
      actionEnabled,
      actionDisabledReason: disabledReason,
      actionDisabledReasons,
      lastCheckedAt: timestamp,
      notes: app.description,
      ...(app.appUrl ? { url: app.appUrl } : {}),
      ...(app.appPort ? { port: app.appPort } : {}),
      servicePorts: app.services.map((service) => service.port).filter((port): port is number => typeof port === 'number' && Number.isFinite(port)),
      ...(app.database?.hostPort ? { databasePort: app.database.hostPort } : {}),
      ...(app.database?.containerName ? { containerName: app.database.containerName } : {}),
    };
  });

  return {
    id: 'local-apps-dashboard',
    status: inventory.length > 0 ? 'unavailable' : 'unavailable',
    appCount: apps.length,
    runningCount: 0,
    stoppedCount: 0,
    unknownCount: apps.length,
    managedCount: apps.filter((app) => app.managed).length,
    unmanagedCount: apps.filter((app) => !app.managed).length,
    apps,
    actionPolicy: {
      status: 'planned',
      executionPath: 'brain-core-allowlisted-action',
      requiresConfirmation: true,
      requiresAllowlist: true,
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      safeActions: [],
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
      startStopControlsEnabled: false,
    },
    blockers: inventory.length === 0 ? ['No local apps registry entries were found.'] : [],
    nextSafeStep: 'Register a safe per-app execution strategy before enabling app action buttons.',
  };
}

export async function readLocalAppsDashboard(fetchImpl: typeof fetch = fetch): Promise<BrainCoreLocalAppsDashboardResponse> {
  const inventory = listLocalAppDefinitions();
  // Use port probing instead of HTTP health checks to avoid saturating dev servers with connections
  const portStatusByName = new Map(
    await Promise.all(
      inventory.map(async (app) => {
        const port = app.appPort;
        if (!port) return [app.name, 'unknown' as const] as const;
        const up = await isPortListening(port);
        return [app.name, up ? 'running' : 'stopped'] as const;
      }),
    ),
  );
  const timestamp = new Date().toISOString();
  const statusByName = portStatusByName;

  const containerStatusByName = new Map(
    await Promise.all(
      inventory.map(async (app) => {
        const containerName = app.database?.containerName;
        if (!containerName) return [app.name, null] as const;
        return [app.name, await dockerContainerState(containerName)] as const;
      }),
    ),
  );

  const apps: BrainCoreLocalAppDashboardItem[] = inventory.map((app) => {
    const portStatus = statusByName.get(app.name);
    const lifecycleStatus = normalizeDashboardStatus(portStatus ?? (app.appUrl || app.healthUrl ? 'unknown' : 'unavailable'));
    const managed = app.managed;
    const actionEvaluations = evaluateAppActions(app);
    const executableActions = actionEvaluations.filter((entry) => entry.executable).map((entry) => entry.action);
    const actionEnabled = executableActions.length > 0;
    const actionDisabledReasons = buildActionDisabledReasons(app);
    const disabledReason = formatActionDisabledReasons(actionDisabledReasons);
    const containerStatus = containerStatusByName.get(app.name) ?? null;
    return {
      id: app.id,
      name: app.name,
      label: app.label || app.name,
      category: app.category,
      status: lifecycleStatus,
      health: deriveHealth(lifecycleStatus),
      source: app.category === 'brain-core' ? 'brain-core' : app.repoPathSummary ? 'infrastructure-config' : 'unknown',
      managed,
      startSupported: executableActions.includes('start'),
      stopSupported: executableActions.includes('stop'),
      restartSupported: executableActions.includes('restart'),
      actionEnabled,
      actionDisabledReason: disabledReason,
      actionDisabledReasons,
      lastCheckedAt: timestamp,
      notes: app.description,
      ...(app.appUrl ? { url: app.appUrl } : {}),
      ...(app.appPort ? { port: app.appPort } : {}),
      servicePorts: app.services
        .map((service) => service.port)
        .filter((port): port is number => typeof port === 'number' && Number.isFinite(port)),
      ...(app.database?.hostPort ? { databasePort: app.database.hostPort } : {}),
      ...(app.database?.containerName ? { containerName: app.database.containerName } : {}),
      ...(containerStatus ? { containerStatus } : {}),
    };
  });

  const runningCount = apps.filter((app) => app.status === 'running').length;
  const stoppedCount = apps.filter((app) => app.status === 'stopped').length;
  const unknownCount = apps.filter((app) => app.status === 'unknown' || app.status === 'unavailable').length;
  const managedCount = apps.filter((app) => app.managed).length;
  const unmanagedCount = apps.length - managedCount;
  const supportedSafeActions = Array.from(new Set(apps.flatMap((app) => [
    app.startSupported ? 'start' : null,
    app.stopSupported ? 'stop' : null,
    app.restartSupported ? 'restart' : null,
  ].filter((value): value is 'start' | 'stop' | 'restart' => value !== null))));
  const criteria = createActionReadinessCriteria(inventory);

  return {
    id: 'local-apps-dashboard',
    status: inventory.length > 0 ? (unknownCount > 0 ? 'partial' : 'available') : 'unavailable',
    appCount: apps.length,
    runningCount,
    stoppedCount,
    unknownCount,
    managedCount,
    unmanagedCount,
    apps,
    actionPolicy: {
      status: supportedSafeActions.length > 0 ? 'enabled' : 'planned',
      executionPath: 'brain-core-allowlisted-action',
      requiresConfirmation: true,
      requiresAllowlist: true,
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      safeActions: supportedSafeActions,
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
      startStopControlsEnabled: supportedSafeActions.length > 0,
    },
    blockers: inventory.length === 0 ? ['No local apps registry entries were found.'] : [],
    nextSafeStep: 'Register a safe per-app execution strategy before enabling app action buttons.',
  };
}

export function readLocalAppsSourceDiagnostics() {
  const canonicalCount = loadLocalApps().length;
  const dashboardResponse = readLocalAppsDashboardSync();
  const orchestratorDefs = listLocalAppDefinitions();
  const brainCoreAugmentedCount = Math.max(0, orchestratorDefs.length - canonicalCount);
  const expectedDisplayedCount = orchestratorDefs.length;
  const displayedCountMatchesDefinitions =
    dashboardResponse.appCount === expectedDisplayedCount && dashboardResponse.apps.length === expectedDisplayedCount;
  const mismatches = [
    canonicalCount === 0 ? 'No canonical local apps registry entries were found.' : null,
    displayedCountMatchesDefinitions ? null : 'Dashboard app count differs from canonical registry plus Brain Core definitions.',
  ].filter((entry): entry is string => typeof entry === 'string');

  return {
    id: 'local-apps-source-diagnostics',
    status: canonicalCount > 0 && displayedCountMatchesDefinitions ? 'available' : 'error',
    canonicalSource: 'operations/infrastructure/local-apps.json',
    canonicalAppCount: canonicalCount,
    brainCoreAugmentedCount,
    expectedDisplayedCount,
    dashboardAppCount: dashboardResponse.appCount,
    orchestratorAppCount: orchestratorDefs.length,
    displayedAppCount: dashboardResponse.apps.length,
    sourceFiles: [
      {
        path: 'operations/infrastructure/local-apps.json',
        usedFor: 'canonical-registry',
        appCount: canonicalCount,
        readable: true,
        error: null,
      },
      {
        path: 'projects/brain-core/runtime/local/mind-steward/latest.json',
        usedFor: 'brain-core-augmented-definition',
        appCount: brainCoreAugmentedCount,
        readable: true,
        error: null,
      },
    ],
    mismatches,
    nextSafeStep: displayedCountMatchesDefinitions ? 'Dashboard displays the canonical registry plus Brain Core augmented definitions.' : 'Repair local apps source wiring before trusting dashboard counts.',
    safety: {
      readOnlyDashboard: true,
      pluginExecutesShell: false,
      arbitraryCommandExecution: false,
      exposesSecrets: false,
      exposesEnv: false,
      platformWrites: false,
      mindWrites: false,
      destructiveActions: false,
    },
  };
}

export function readLocalAppsActionReadiness(): BrainCoreLocalAppActionReadinessResponse {
  const criteria = createActionReadinessCriteria(listLocalAppDefinitions());

  return {
    id: 'local-apps-action-readiness',
    status: criteria.every((criterion) => criterion.satisfied) ? 'ready' : 'not-ready',
    ready: criteria.every((criterion) => criterion.satisfied),
    criteria,
    satisfiedCount: criteria.filter((criterion) => criterion.satisfied).length,
    unsatisfiedCount: criteria.filter((criterion) => !criterion.satisfied).length,
    blockers: ['Per-app executable strategies are still being registered; unsupported apps return not_executable.'],
    safety: {
      readOnlyDashboard: true,
      pluginExecutesShell: false,
      arbitraryCommandExecution: false,
      exposesSecrets: false,
      exposesEnv: false,
      platformWrites: false,
      mindWrites: false,
      destructiveActions: false,
      startStopControlsEnabled: criteria.every((criterion) => criterion.satisfied),
    },
    nextSafeStep: 'Register executable strategies per app; direct POST requests still return structured not_executable results.',
  };
}

export function readLocalAppsOrchestratorStatus() {
  return readLocalAppOrchestratorStatus();
}

export function readLocalAppsOnboardingChecklist() {
  return readLocalAppOnboardingChecklist();
}

export function readLocalAppsActionPlans() {
  return { plans: listLocalAppActionPlans() };
}

export function readLocalAppsActionPlan(appId: string, action: string) {
  const normalizedAction = action === 'start' || action === 'stop' || action === 'restart' ? action : 'start';
  return createLocalAppActionPlan(appId, normalizedAction);
}

export function readLocalAppsActionsStatus() {
  return readLocalAppActionStatus();
}

export function readLocalAppsActionEnablementBacklog(): BrainCoreLocalAppActionEnablementBacklogResponse {
  const allApps = listLocalAppDefinitions();
  const actions = ['start', 'stop', 'restart'] as const;

  const backlogItems = [];
  let totalActionCount = 0;
  let enabledActionCount = 0;

  for (const app of allApps) {
    for (const action of actions) {
      totalActionCount++;
      const evaluation = evaluateLocalAppActionDefinition(app, action);

      if (evaluation.executable) {
        enabledActionCount++;
      } else {
        const category = categorizeDisabledReason(evaluation.reason);
        backlogItems.push({
          appId: app.id,
          appName: app.name,
          action,
          enabled: false as const,
          reason: evaluation.reason,
          category: category as BrainCoreLocalAppActionEnablementCategory,
          commandSummary: evaluation.commandLabel,
          repoPathSummary: app.repoPathSummary,
          recommendedChange: getRecommendedChange(category, evaluation.reason, app),
          risk: getRiskLevel(category) as 'low' | 'medium' | 'high',
          canBeAutoFixed: false as const,
          requiresHumanReview: true as const,
        });
      }
    }
  }

  // Group by category
  const categoryCounts = new Map<string, number>();
  for (const item of backlogItems) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }

  const categoryLabels: Record<string, string> = {
    'missing-command': 'Missing command definition',
    'missing-repo-local-script': 'Needs repo-local script',
    'unsafe-command-shape': 'Unsafe command syntax',
    'missing-working-directory': 'Missing working directory',
    'missing-helper': 'Helper script missing',
    'dynamic-stop-after-brain-core-start': 'Dynamic stop after Brain Core start',
    'manual-only': 'Manual execution required',
    'not-yet-allowlisted': 'Not yet allowlisted',
    'other': 'Other blocker',
  };

  const categories = Array.from(categoryCounts.entries())
    .map(([id, count]) => ({
      id: id as BrainCoreLocalAppActionEnablementCategory,
      label: categoryLabels[id] ?? id,
      count,
      nextSafeStep: getNextSafeStep(id),
    }))
    .sort((a, b) => b.count - a.count);

  const uniqueAppsWithDisabled = new Set(backlogItems.map((item) => item.appId)).size;

  return {
    id: 'local-apps-action-enablement-backlog',
    generatedAt: new Date().toISOString(),
    totalActionCount,
    enabledActionCount,
    disabledActionCount: backlogItems.length,
    appsWithDisabledActions: uniqueAppsWithDisabled,
    categories,
    items: backlogItems.sort((a, b) => {
      // Sort by: risk desc, category, app name, action
      const riskOrder = { high: 0, medium: 1, low: 2 };
      if (riskOrder[a.risk] !== riskOrder[b.risk]) return riskOrder[a.risk] - riskOrder[b.risk];
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.appName !== b.appName) return a.appName.localeCompare(b.appName);
      return a.action.localeCompare(b.action);
    }),
    safety: {
      readOnly: true,
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      modifiesRegistry: false,
      writesOperationsConfig: false,
      exposesSecrets: false,
      exposesEnv: false,
      enablesActions: false,
    },
    nextSafeStep: 'Review backlog items by category to understand what needs to be done before each action can be safely enabled.',
  };
}

function categorizeDisabledReason(reason: string): string {
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

function getRiskLevel(category: string): 'low' | 'medium' | 'high' {
  switch (category) {
    case 'unsafe-command-shape':
      return 'high';
    case 'missing-helper':
    case 'missing-working-directory':
      return 'medium';
    default:
      return 'low';
  }
}

function getRecommendedChange(category: string, reason: string, app: any): string {
  switch (category) {
    case 'missing-command':
      return `Add startCommand, stopCommand, or restartCommand to ${app.name} in operations/infrastructure/local-apps.json.`;
    case 'missing-repo-local-script':
      return `Register a repo-local start script for ${app.name} before inline environment variables can be used.`;
    case 'unsafe-command-shape':
      return `Rewrite ${app.name} command to avoid shell metacharacters or use a bash script instead.`;
    case 'missing-working-directory':
      return `Ensure repoPath is set correctly for ${app.name} and the directory exists on disk.`;
    case 'missing-helper':
      return `Create the missing helper script or update the command path for ${app.name}.`;
    case 'dynamic-stop-after-brain-core-start':
      return `Start ${app.name} from Brain Console first so Brain Core can record a managed npm process before Stop becomes available.`;
    case 'manual-only':
      return `${app.name} is configured for manual execution only. Review if automation is possible.`;
    case 'not-yet-allowlisted':
      return `Command for ${app.name} uses a strategy not yet allowlisted for Brain Core execution. Review safety before enabling.`;
    default:
      return `Review ${app.name} configuration and re-evaluate the action.`;
  }
}

function getNextSafeStep(category: string): string {
  switch (category) {
    case 'missing-command':
      return 'Add command definitions in local-apps.json for apps that should be automated.';
    case 'missing-repo-local-script':
      return 'Create repo-local scripts (e.g., scripts/dev/start-local.sh) and update commands to reference them.';
    case 'unsafe-command-shape':
      return 'Wrap unsafe commands in bash scripts or rewrite to avoid shell metacharacters.';
    case 'missing-working-directory':
      return 'Verify repoPath settings and ensure working directories exist.';
    case 'missing-helper':
      return 'Create missing helper scripts or update command paths.';
    case 'dynamic-stop-after-brain-core-start':
      return 'Start the app from Brain Console so Brain Core can manage a stop record.';
    case 'manual-only':
      return 'Consider registering automated strategies if manual-only is no longer necessary.';
    case 'not-yet-allowlisted':
      return 'Review command strategy against allowlist and determine if it can be safely added.';
    default:
      return 'Review configuration and safety requirements.';
  }
}

export async function runLocalAppsAction(appId: string, action: string, options: { forceExecutorError?: boolean } = {}) {
  const normalizedAction = action === 'start' || action === 'stop' || action === 'restart' ? action : undefined;
  if (!normalizedAction) return { kind: 'invalid-action' as const };
  const result = await executeLocalAppActionRequest(appId, normalizedAction, options);
  if (result.status === 'not_found') return { kind: 'missing-app' as const, result };
  return { kind: 'result' as const, result };
}

function buildActionDisabledReasons(
  app: ReturnType<typeof listLocalAppDefinitions>[number],
): Partial<Record<'start' | 'stop' | 'restart', string>> {
  return Object.fromEntries(
    (['start', 'stop', 'restart'] as const)
      .map((action) => {
        const readiness = evaluateLocalAppActionDefinition(app, action);
        return readiness.executable ? null : [action, readiness.reason] as const;
      })
      .filter((entry): entry is readonly ['start' | 'stop' | 'restart', string] => entry !== null),
  );
}

function evaluateAppActions(app: ReturnType<typeof listLocalAppDefinitions>[number]) {
  return (['start', 'stop', 'restart'] as const).map((action) => ({
    action,
    ...evaluateLocalAppActionDefinition(app, action),
  }));
}

function formatActionDisabledReasons(reasons: Partial<Record<'start' | 'stop' | 'restart', string>>): string {
  return (['start', 'stop', 'restart'] as const)
    .map((action) => reasons[action] ? `${action}: ${reasons[action]}` : null)
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' | ');
}

function createActionReadinessCriteria(inventory: ReturnType<typeof listLocalAppDefinitions>) {
  return [
    {
      id: 'inventory-stable',
      label: 'App inventory stable',
      satisfied: inventory.length > 0,
      detail: 'Canonical local app definitions are available from the orchestrator registry.',
    },
    {
      id: 'canonical-ids',
      label: 'Canonical app IDs',
      satisfied: inventory.every((app) => /^[a-z0-9][a-z0-9-]*$/i.test(app.id)),
      detail: 'IDs are derived from safe names and normalized to lowercase kebab case.',
    },
    {
      id: 'allowlist-defined',
      label: 'Allowlisted actions defined',
      satisfied: inventory.some((app) => app.actionPolicy.status === 'enabled' && app.actionPolicy.safeActions.length > 0),
      detail: 'At least one app must have an approved Brain Core execution strategy before buttons are enabled.',
    },
    {
      id: 'brain-core-action-endpoint',
      label: 'Brain Core action endpoint exists',
      satisfied: true,
      detail: 'POST /local-apps/:id/start|stop|restart is registered, but still gated behind approval.',
    },
    {
      id: 'confirmation-ux',
      label: 'Confirmation UX exists',
      satisfied: true,
      detail: 'Brain Console confirms before calling Brain Core action endpoints.',
    },
    {
      id: 'audit-logging',
      label: 'Audit logging available',
      satisfied: false,
      detail: 'Structured in-memory action results are available; persistent audit logging is still planned.',
    },
    {
      id: 'plugin-shell-exec',
      label: 'Plugin executes shell',
      satisfied: true,
      detail: 'Obsidian plugin does not execute shell commands.',
    },
    {
      id: 'arbitrary-commands-blocked',
      label: 'Arbitrary commands blocked',
      satisfied: true,
      detail: 'UI does not accept raw shell commands.',
    },
    {
      id: 'user-approved',
      label: 'User approved enabling controls',
      satisfied: true,
      detail: 'Controls are enabled for canonical Brain Core action endpoints only.',
    },
  ] as BrainCoreLocalAppActionReadinessResponse['criteria'];
}

function readLocalAppsRuntimeReport(): LocalAppsRuntimeReport | undefined {
  const configuredPath = process.env.BRAIN_CORE_LOCAL_APPS_REPORT_PATH;
  const defaultPath = path.resolve(process.cwd(), 'runtime/local/local-apps/latest.json');
  const resolved = configuredPath ? resolveSafeRuntimePath(configuredPath) : defaultPath;
  if (!resolved || !fs.existsSync(resolved)) {
    return undefined;
  }

  try {
    const body = JSON.parse(fs.readFileSync(resolved, 'utf8')) as LocalAppsRuntimeReport;
    if (body.executableActions || body.writesToMind) {
      return { status: 'invalid', message: 'Local apps report declares unsupported execution flags.', apps: [] };
    }
    return body;
  } catch {
    return { status: 'invalid', message: 'Local apps report JSON could not be parsed safely.', apps: [] };
  }
}

function resolveSafeRuntimePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (DISALLOWED_SEGMENTS.some((segment) => segments.includes(segment))) {
    return undefined;
  }
  if (segments.includes('mind')) {
    return undefined;
  }
  return path.resolve(rawPath);
}

function normalizeStatus(status: LocalAppsRuntimeReport['apps'][number]['status']): BrainCoreLocalAppSummary['status'] {
  return status === 'running' || status === 'stopped' || status === 'disabled' ? status : 'unknown';
}

function dockerContainerState(containerName: string): Promise<'running' | 'stopped' | 'unknown'> {
  return new Promise((resolve) => {
    execFile('docker', ['inspect', '--format', '{{.State.Status}}', containerName], { timeout: 5_000 }, (error, stdout) => {
      if (error) {
        resolve('unknown');
        return;
      }
      const state = stdout.trim().toLowerCase();
      if (state === 'running') {
        resolve('running');
        return;
      }
      if (state === 'exited' || state === 'created' || state === 'paused' || state === 'restarting' || state === 'dead') {
        resolve('stopped');
        return;
      }
      resolve('unknown');
    });
  });
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket
      .on('connect', () => { socket.destroy(); resolve(true); })
      .on('error', () => { socket.destroy(); resolve(false); })
      .on('timeout', () => { socket.destroy(); resolve(false); })
      .connect(port, '127.0.0.1');
  });
}

function readDockerContainerStatus(containerName: string): Promise<'running' | 'stopped' | 'unknown'> {
  return new Promise((resolve) => {
    execFile('docker', ['inspect', '--format', '{{.State.Status}}', containerName], { timeout: 5_000 }, (error, stdout) => {
      if (error) {
        resolve('unknown');
        return;
      }
      const state = stdout.trim().toLowerCase();
      if (state === 'running') resolve('running');
      else if (state === 'exited' || state === 'created' || state === 'paused' || state === 'dead') resolve('stopped');
      else resolve('unknown');
    });
  });
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      const [key, recordValue] = entry;
      return key.length > 0 && typeof recordValue === 'string';
    }),
  );
}

function readRuntime(value: unknown): LocalAppRuntime | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const runtime = value as { pathPrepend?: unknown; env?: unknown; notes?: unknown };
  const pathPrepend = readStringArray(runtime.pathPrepend);
  const env = readStringRecord(runtime.env);
  const notes = readStringOrNull(runtime.notes);
  if (pathPrepend.length === 0 && Object.keys(env).length === 0 && !notes) return null;
  return { pathPrepend, env, notes };
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeDashboardStatus(status: string): 'running' | 'stopped' | 'unknown' | 'unavailable' {
  if (status === 'running' || status === 'stopped' || status === 'unknown' || status === 'unavailable') return status;
  if (status === 'starting' || status === 'blocked') return 'unknown';
  return 'unavailable';
}

function deriveHealth(status: 'running' | 'stopped' | 'unknown' | 'unavailable'): BrainCoreLocalAppHealth {
  if (status === 'running') return 'healthy';
  if (status === 'stopped') return 'warning';
  if (status === 'unknown') return 'unknown';
  return 'error';
}

function deriveCategory(name: string, repoPath: string | null): string {
  if (/video/i.test(name)) return 'video';
  if (/scheduler|automation/i.test(name)) return 'operations';
  if (repoPath) return 'local-app';
  return 'unknown';
}

interface LocalAppsRuntimeReport {
  status: 'ok' | 'failed' | 'unknown' | 'available' | 'invalid' | 'missing';
  apps: Array<{
    id?: string;
    name?: string;
    status?: 'unknown' | 'disabled' | 'running' | 'stopped';
    actionsSupported?: boolean;
  }>;
  writesToMind?: false;
  executableActions?: false;
  message?: string;
}
