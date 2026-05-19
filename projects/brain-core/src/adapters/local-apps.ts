import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreLocalAppActionReadinessResponse,
  BrainCoreLocalAppDashboardItem,
  BrainCoreLocalAppHealth,
  BrainCoreLocalAppReadinessStatus,
  BrainCoreLocalAppSummary,
  BrainCoreLocalAppsDashboardResponse,
} from '../types/api.js';
import {
  createLocalAppActionPlan,
  listLocalAppActionPlans,
  listLocalAppDefinitions,
  readLocalAppOnboardingChecklist,
  readLocalAppOrchestratorStatus,
} from './local-app-orchestrator.js';

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
    id: 'probot',
    name: 'ProBot legacy dashboard/client service',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
  {
    id: 'office-scheduler',
    name: 'Office Nightly Scheduler',
    status: 'placeholder',
    source: 'placeholder',
    actionsSupported: false,
  },
];

export function listLocalApps(): BrainCoreLocalAppSummary[] {
  const report = readLocalAppsRuntimeReport();
  if (!report || report.status === 'missing') {
    return PLACEHOLDER_APPS;
  }
  if (report.status === 'invalid') {
    return [
      {
        id: 'local-apps-report',
        name: 'Local apps report invalid',
        status: 'unknown',
        source: 'runtime-report',
        actionsSupported: false,
      },
    ];
  }

  return (report.apps ?? []).map((app, index) => ({
    id: safeText(app.id, `local-app-${index + 1}`),
    name: safeText(app.name, 'Unnamed local app'),
    status: normalizeStatus(app.status),
    source: 'runtime-report',
    actionsSupported: false,
  }));
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

export async function readLocalAppsDashboard(fetchImpl: typeof fetch = fetch): Promise<BrainCoreLocalAppsDashboardResponse> {
  const inventory = listLocalAppDefinitions();
  const runtimeInventory = inventory.filter((app) => app.category !== 'brain-core' || app.id !== 'model-router');
  const statusReport = await buildLocalAppsStatus(
    runtimeInventory.map((app) => ({
      name: app.name,
      port: app.appPort ?? null,
      url: app.appUrl ?? '',
      check: app.healthUrl ?? '',
      start: null,
      stop: null,
      restart: null,
      description: app.description,
      repoPath: app.repoPathSummary ?? null,
      startupTimeoutMs: null,
      runtime: null,
      databaseEngine: null,
      databaseServiceName: null,
      databasePort: null,
      databaseName: null,
      databaseUser: null,
      notes: app.description,
    })),
    fetchImpl,
  );
  const timestamp = new Date().toISOString();
  const statusByName = new Map(statusReport.apps.map((app) => [app.name, app]));

  const apps: BrainCoreLocalAppDashboardItem[] = inventory.map((app) => {
    const status = statusByName.get(app.name);
    const lifecycleStatus = normalizeDashboardStatus(status?.status ?? (app.appUrl || app.healthUrl ? 'unknown' : 'unavailable'));
    const managed = app.managed;
    const actionEnabled = false;
    return {
      id: app.id,
      name: app.name,
      label: app.label || app.name,
      category: app.category,
      status: lifecycleStatus,
      health: deriveHealth(lifecycleStatus),
      source: app.category === 'brain-core' ? 'brain-core' : app.repoPathSummary ? 'infrastructure-config' : 'unknown',
      managed,
      startSupported: app.actionPolicy.safeActions.includes('start'),
      stopSupported: app.actionPolicy.safeActions.includes('stop'),
      restartSupported: app.actionPolicy.safeActions.includes('restart'),
      actionEnabled,
      actionDisabledReason: actionEnabled ? '' : 'Controls disabled until Brain Core allowlisted action path is approved.',
      lastCheckedAt: timestamp,
      notes: app.description,
      ...(app.appUrl ? { url: app.appUrl } : {}),
      ...(app.appPort ? { port: app.appPort } : {}),
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
      status: 'disabled',
      executionPath: 'none',
      requiresConfirmation: true,
      requiresAllowlist: true,
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      safeActions: supportedSafeActions,
      blockedActions: ['start', 'stop', 'restart', 'custom-command'],
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
    blockers: inventory.length === 0 ? ['No local apps registry entries were found.'] : ['Brain Core allowlisted action path not yet approved.'],
    nextSafeStep: 'Add a safe allowlisted Brain Core action path and confirmation workflow before enabling controls.',
  };
}

export function readLocalAppsActionReadiness(): BrainCoreLocalAppActionReadinessResponse {
  const criteria = createActionReadinessCriteria(listLocalAppDefinitions());

  return {
    id: 'local-apps-action-readiness',
    status: 'not-ready',
    ready: false,
    criteria,
    satisfiedCount: criteria.filter((criterion) => criterion.satisfied).length,
    unsatisfiedCount: criteria.filter((criterion) => !criterion.satisfied).length,
    blockers: [
      'Brain Core allowlisted action path not yet approved.',
      'Confirmation UX is not enabled for local-app control actions.',
    ],
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
    nextSafeStep: 'Implement a Brain Core allowlisted action flow and confirmation UX before enabling controls.',
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
      satisfied: false,
      detail: 'No approved Brain Core allowlist has been wired for local-app start/stop/restart yet.',
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
      satisfied: false,
      detail: 'Brain Console keeps controls disabled until a safe confirmation path is approved.',
    },
    {
      id: 'audit-logging',
      label: 'Audit logging available',
      satisfied: false,
      detail: 'Controlled-action audit logging remains a planned follow-up.',
    },
    {
      id: 'plugin-shell-exec',
      label: 'Plugin executes shell',
      satisfied: false,
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
      satisfied: false,
      detail: 'Controls remain disabled until the safe action path is explicitly approved.',
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
  if (/probot/i.test(name)) return 'dashboard';
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
