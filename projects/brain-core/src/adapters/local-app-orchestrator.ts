import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreLocalAppAction,
  BrainCoreLocalAppActionPlan,
  BrainCoreLocalAppDatabaseDefinition,
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppOrchestratorStatus,
  BrainCoreLocalAppServiceDefinition,
  BrainCoreLocalAppOnboardingChecklist,
} from '../types/api.js';

const LOCAL_APPS_CONFIG_PATH = path.join(process.cwd(), '..', '..', 'operations', 'infrastructure', 'local-apps.json');
const MODEL_ROUTER_REPORT_PATH = path.resolve(process.cwd(), 'runtime/local/model-router/latest.json');

type RegistryApp = {
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

type RegistryRuntime = {
  pathPrepend?: unknown;
  env?: unknown;
  notes?: unknown;
};

type ModelRouterReport = {
  status?: string;
  writesToMind?: boolean;
  executableActions?: boolean;
  message?: string;
  wikiHealth?: unknown;
};

const DEFAULT_ACTION_POLICY = {
  status: 'disabled' as const,
  executionPath: 'none' as const,
  requiresConfirmation: true as const,
  requiresAllowlist: true as const,
  pluginExecutesShell: false as const,
  arbitraryCommandAllowed: false as const,
  safeActions: [] as Array<'start' | 'stop' | 'restart'>,
  blockedActions: ['start', 'stop', 'restart', 'custom-command'] as Array<'start' | 'stop' | 'restart' | 'custom-command'>,
};

export function listLocalAppDefinitions(): BrainCoreLocalAppDefinition[] {
  const registry = readRegistryApps();
  const modelRouter = readModelRouterDefinition();
  return [...registry, ...(modelRouter ? [modelRouter] : [])];
}

export function createLocalAppActionPlan(appId: string, action: BrainCoreLocalAppAction): BrainCoreLocalAppActionPlan {
  const app = listLocalAppDefinitions().find((entry) => entry.id === appId);
  if (!app) {
    return disabledPlan(appId, action, 'App is not registered in the canonical local app inventory.');
  }

  if (app.actionPolicy.status !== 'enabled' || !app.actionPolicy.safeActions.includes(action)) {
    return disabledPlan(appId, action, 'Controls remain disabled until a Brain Core allowlisted action path is approved.');
  }

  return {
    appId,
    action,
    status: 'ready',
    reason: 'Action is declarative only and must execute through Brain Core allowlisted orchestration.',
    requiresConfirmation: true,
    pluginExecutesShell: false,
    arbitraryCommandAllowed: false,
    allowlistRequired: true,
    auditRequired: true,
    canExecuteNow: false,
    steps: [
      { id: 'validate-app', label: 'Validate canonical app id', detail: 'Confirm the app is registered in the local app inventory.' },
      { id: 'validate-action', label: 'Validate action allowlist', detail: 'Confirm the requested action is allowlisted for this app.' },
      { id: 'check-database', label: 'Check database readiness', detail: 'Confirm OrbStack database state when the app depends on one.' },
      { id: 'run-services', label: 'Orchestrate services in order', detail: 'Start, stop, or restart services using the app-specific orchestration path.' },
      { id: 'verify-health', label: 'Verify health and port state', detail: 'Confirm the app responds on its declared localhost URL.' },
      { id: 'report-result', label: 'Report action result', detail: 'Return a safe, read-only result summary.' },
    ],
  };
}

export function readLocalAppOrchestratorStatus(): BrainCoreLocalAppOrchestratorStatus {
  const definitions = listLocalAppDefinitions();
  const serviceCount = definitions.reduce((total, app) => total + app.services.length, 0);
  const databaseCount = definitions.reduce((total, app) => total + (app.database ? 1 : 0), 0);
  const managedCount = definitions.filter((app) => app.managed).length;
  return {
    id: 'local-apps-orchestrator',
    status: definitions.length > 0 ? 'available' : 'unavailable',
    appCount: definitions.length,
    serviceCount,
    databaseCount,
    managedCount,
    definitions,
    actionPolicy: { ...DEFAULT_ACTION_POLICY },
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
    nextSafeStep: 'Register canonical app ids, ports, services, and action allowlists before enabling controls.',
  };
}

export function readLocalAppOnboardingChecklist(): BrainCoreLocalAppOnboardingChecklist {
  return {
    id: 'local-apps-onboarding-checklist',
    status: 'available',
    requiredFields: ['id', 'name', 'label', 'category', 'appPort', 'appUrl', 'services', 'docsRef', 'managed'],
    onboardingSteps: [
      'Assign a canonical app id.',
      'Assign a fixed localhost app port.',
      'Detect and register services.',
      'Assign fixed service ports.',
      'Detect whether OrbStack database support is required.',
      'Assign fixed database host/container ports when needed.',
      'Register docsRef and health checks.',
      'Create a declarative action plan for start/stop/restart.',
      'Add safe tests and Brain Console inventory visibility.',
    ],
    standards: [
      'One app id maps to one canonical dashboard entry.',
      'One app owns one localhost URL.',
      'Services are ordered and explicitly declared.',
      'Database dependencies are optional and explicit.',
      'Brain Console never executes shell commands.',
    ],
    portPolicy: {
      appPort: 'fixed localhost port',
      servicePorts: 'fixed or explicitly documented per service',
      databasePorts: 'fixed OrbStack host/container ports when used',
    },
    databasePolicy: {
      orbStackManaged: true,
      optional: true,
      requiredWhenNeeded: true,
    },
    servicePolicy: {
      oneOrMoreServicesAllowed: true,
      orderedLifecycle: true,
      healthChecked: true,
    },
    docsPolicy: {
      docsRefRequired: true,
      onboardingNotesRequired: true,
      actionPlanRequired: true,
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
    nextSafeStep: 'Register app inventories with canonical ports and action plans, then approve a Brain Core allowlisted execution path.',
  };
}

export function listLocalAppActionPlans(): BrainCoreLocalAppActionPlan[] {
  return listLocalAppDefinitions().flatMap((app) => (['start', 'stop', 'restart'] as const).map((action) => createLocalAppActionPlan(app.id, action)));
}

function readRegistryApps(): BrainCoreLocalAppDefinition[] {
  try {
    const raw = fs.readFileSync(LOCAL_APPS_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRegistryApp).filter((entry): entry is BrainCoreLocalAppDefinition => entry !== null);
  } catch {
    return [];
  }
}

function normalizeRegistryApp(raw: RegistryApp): BrainCoreLocalAppDefinition | null {
  const name = readString(raw.name, '');
  if (!name) return null;
  const id = normalizeId(name);
  const port = readNumber(raw.port ?? raw.appPort);
  const url = readString(raw.url ?? raw.appUrl, '');
  const runtime = readRegistryRuntime(raw.runtime);
  const database = buildDatabase(raw);
  const services = buildServices(name, port, database);
  return {
    id,
    name,
    label: readString(raw.description, name),
    description: readString(raw.description, name),
    category: deriveCategory(name, readStringOrNull(raw.repoPath)),
    managed: Boolean(raw.start || raw.stop || raw.restart),
    services,
    docsRef: 'operations/infrastructure/local-apps.md',
    onboardingStatus: 'registered',
    actionPolicy: {
      ...DEFAULT_ACTION_POLICY,
      safeActions: buildSafeActions(Boolean(raw.start), Boolean(raw.stop), Boolean(raw.restart)),
    },
    ...(readStringOrNull(raw.repoPath) ? { repoPathSummary: summarizePath(readStringOrNull(raw.repoPath)!) } : {}),
    ...(port !== null ? { appPort: port as number } : {}),
    ...(url ? { appUrl: url } : {}),
    ...(readStringOrNull(raw.check ?? raw.healthCheck) ? { healthUrl: readStringOrNull(raw.check ?? raw.healthCheck)! } : {}),
    ...(database ? { database } : {}),
  };
}

function readModelRouterDefinition(): BrainCoreLocalAppDefinition | null {
  const report = readModelRouterReport();
  return {
    id: 'model-router',
    name: 'Model Router',
    label: 'Model Router',
    description: 'Brain Core model routing and report-only dry-run surface.',
    category: 'brain-core',
    managed: false,
    services: [
      {
        id: 'model-router-report',
        label: 'Runtime report',
        type: 'worker',
        required: true,
        startOrder: 1,
        stopOrder: 1,
        status: report ? 'running' : 'unknown',
        actionPolicy: { ...DEFAULT_ACTION_POLICY },
      },
    ],
    docsRef: 'docs/system/obsidian-mind-model-router-roadmap.md',
    onboardingStatus: 'registered',
    actionPolicy: { ...DEFAULT_ACTION_POLICY },
    ...(report?.status ? { description: report.status === 'ok' ? 'Brain Core runtime report indicates Model Router is operational.' : 'Brain Core runtime report indicates Model Router is not fully reported.' } : {}),
    repoPathSummary: 'projects/model-router',
    healthUrl: '/runtime/reports/model-router',
  };
}

function readModelRouterReport(): ModelRouterReport | null {
  try {
    const raw = fs.readFileSync(MODEL_ROUTER_REPORT_PATH, 'utf8');
    return JSON.parse(raw) as ModelRouterReport;
  } catch {
    return null;
  }
}

function buildDatabase(raw: RegistryApp): BrainCoreLocalAppDatabaseDefinition | undefined {
  if (!raw.databaseEngine && !raw.databasePort && !raw.databaseServiceName && !raw.databaseName) return undefined;
  return {
    id: normalizeId(`${readString(raw.name, 'database')}-database`),
    type: normalizeDatabaseType(readStringOrNull(raw.databaseEngine)),
    orbStackManaged: true,
    status: 'unknown',
    actionPolicy: { ...DEFAULT_ACTION_POLICY },
    ...(readNumberOrNull(raw.databasePort) !== null ? { hostPort: readNumberOrNull(raw.databasePort)! } : {}),
    ...(readNumberOrNull(raw.databasePort) !== null ? { containerPort: readNumberOrNull(raw.databasePort)! } : {}),
  };
}

function buildServices(name: string, port: number | undefined, database: BrainCoreLocalAppDatabaseDefinition | undefined): BrainCoreLocalAppServiceDefinition[] {
  const services: BrainCoreLocalAppServiceDefinition[] = [];
  services.push({
    id: normalizeId(name),
    label: name,
    type: 'web',
    required: true,
    startOrder: 1,
    stopOrder: 1,
    status: 'unknown',
    actionPolicy: { ...DEFAULT_ACTION_POLICY },
    ...(port !== undefined ? { port } : {}),
  });
  if (database) {
    services.push({
      id: `${normalizeId(name)}-db-link`,
      label: 'Database dependency',
      type: 'database',
      required: Boolean(database),
      startOrder: 0,
      stopOrder: 2,
      status: database.status,
      actionPolicy: { ...DEFAULT_ACTION_POLICY },
    });
  }
  return services;
}

function buildSafeActions(hasStart: boolean, hasStop: boolean, hasRestart: boolean): Array<'start' | 'stop' | 'restart'> {
  return [
    hasStart ? 'start' : null,
    hasStop ? 'stop' : null,
    hasRestart ? 'restart' : null,
  ].filter((value): value is 'start' | 'stop' | 'restart' => value !== null);
}

function readRegistryRuntime(value: unknown): RegistryRuntime | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const runtime = value as RegistryRuntime;
  const pathPrepend = Array.isArray(runtime.pathPrepend) ? runtime.pathPrepend.filter((entry): entry is string => typeof entry === 'string') : [];
  const env = runtime.env && typeof runtime.env === 'object' && !Array.isArray(runtime.env) ? runtime.env : {};
  const notes = readStringOrNull(runtime.notes);
  if (pathPrepend.length === 0 && Object.keys(env).length === 0 && !notes) return null;
  return { pathPrepend, env, notes };
}

function normalizeDatabaseType(value: string | null): BrainCoreLocalAppDatabaseDefinition['type'] {
  if (value === 'postgres' || value === 'mysql' || value === 'redis' || value === 'sqlite') return value;
  return 'other';
}

function normalizeId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function deriveCategory(name: string, repoPath: string | null): BrainCoreLocalAppDefinition['category'] {
  if (/model router/i.test(name)) return 'brain-core';
  if (/video/i.test(name)) return 'video';
  if (/scheduler|automation/i.test(name)) return 'operations';
  if (/probot/i.test(name)) return 'dashboard';
  if (/firecrawl/i.test(name)) return 'research';
  if (repoPath) return 'local-app';
  return 'other';
}

function summarizePath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, '/');
  if (normalized.length <= 32) return normalized;
  const segments = normalized.split('/').filter(Boolean);
  return segments.slice(-3).join('/');
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function disabledPlan(appId: string, action: BrainCoreLocalAppAction, reason: string): BrainCoreLocalAppActionPlan {
  return {
    appId,
    action,
    status: 'disabled',
    reason,
    requiresConfirmation: true,
    pluginExecutesShell: false,
    arbitraryCommandAllowed: false,
    allowlistRequired: true,
    auditRequired: true,
    canExecuteNow: false,
    steps: [
      { id: 'validate-app', label: 'Validate canonical app id', detail: reason },
    ],
  };
}
