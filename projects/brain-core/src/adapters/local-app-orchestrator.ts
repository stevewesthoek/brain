import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreLocalAppAction,
  BrainCoreLocalAppActionPlan,
  BrainCoreLocalAppActionPolicy,
  BrainCoreLocalAppActionResult,
  BrainCoreLocalAppActionSafety,
  BrainCoreLocalAppActionResultStep,
  BrainCoreLocalAppActionStatusResponse,
  BrainCoreLocalAppDatabaseDefinition,
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppOrchestratorStatus,
  BrainCoreLocalAppServiceDefinition,
  BrainCoreLocalAppOnboardingChecklist,
} from '../types/api.js';
import { LocalAppActionExecutor, evaluateLocalAppActionDefinition } from './local-app-action-executor.js';
import { readManagedLocalAppProcesses } from './local-app-action-executor.js';

const LOCAL_APPS_CONFIG_PATH = path.join(process.cwd(), '..', '..', 'operations', 'infrastructure', 'local-apps.json');
const MODEL_ROUTER_REPORT_PATH = path.resolve(process.cwd(), 'runtime/local/model-router/latest.json');
const LOCAL_APP_ACTION_AUDIT_PATH_ENV = 'BRAIN_CORE_LOCAL_APP_ACTION_AUDIT_PATH';
const DEFAULT_LOCAL_APP_ACTION_AUDIT_PATH = path.resolve(process.cwd(), 'runtime/local/local-apps/actions-audit.jsonl');
const DISALLOWED_AUDIT_PATH_SEGMENTS = new Set(['.env', '.git', 'node_modules', 'operations', 'mind']);

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

function createActionPolicy(safeActions: Array<'start' | 'stop' | 'restart'>): BrainCoreLocalAppActionPolicy {
  return {
    status: (safeActions.length > 0 ? 'enabled' : 'disabled') as any,
    executionPath: (safeActions.length > 0 ? 'brain-core-allowlisted-action' : 'none') as any,
    requiresConfirmation: true,
    requiresAllowlist: true,
    pluginExecutesShell: false,
    arbitraryCommandAllowed: false,
    safeActions,
    blockedActions: ['custom-command'] as Array<'start' | 'stop' | 'restart' | 'custom-command'>,
  };
}

const RECENT_ACTION_LIMIT = 20;
const localAppActionAuditState: {
  status: 'enabled' | 'disabled' | 'error';
  path: string;
  persistedResultCount: number;
  lastPersistedAt?: string;
  lastError?: string;
} = {
  status: 'enabled',
  path: summarizeAuditPath(DEFAULT_LOCAL_APP_ACTION_AUDIT_PATH),
  persistedResultCount: 0,
};
const localAppInFlightActions = new Map<string, BrainCoreLocalAppActionResult>();
const localAppRecentResults: BrainCoreLocalAppActionResult[] = [];
const localAppLastErrorByApp = new Map<string, BrainCoreLocalAppActionResult>();
const executor = new LocalAppActionExecutor();

type ExecuteLocalAppActionRequestOptions = {
  forceExecutorError?: boolean;
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
    return {
      ...disabledPlan(appId, action, 'No executable strategy is registered for this app yet.'),
      steps: createActionPlanSteps(app, action),
    };
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
    canExecuteNow: true,
    steps: createActionPlanSteps(app, action),
  };
}

export async function executeLocalAppAction(appId: string, action: BrainCoreLocalAppAction): Promise<BrainCoreLocalAppActionResult | undefined> {
  const result = await executeLocalAppActionRequest(appId, action);
  return result.status === 'not_found' ? undefined : result;
}

export async function executeLocalAppActionRequest(
  appId: string,
  action: BrainCoreLocalAppAction,
  options: ExecuteLocalAppActionRequestOptions = {},
): Promise<BrainCoreLocalAppActionResult> {
  try {
    if (options.forceExecutorError) {
      throw new Error('Forced local app executor failure for regression coverage.');
    }

    const result = await executor.executeAction(appId, action as 'start' | 'stop' | 'restart');
    recordActionResult(result);
    return result;
  } catch (error) {
    const startedAtMs = Date.now();
    const id = `local-app-${action}-${normalizeId(appId || 'unknown')}-${startedAtMs}`;
    const result = createActionResult({
      id,
      appId,
      action,
      status: 'failed',
      ok: false,
      message: 'Local app action failed safely. Brain Core remains available.',
      errorCode: 'local_app_action_failed',
      error: redactError(error),
      startedAtMs,
      steps: [
        {
          id: 'crash-safe-boundary',
          label: 'Crash-safe action boundary',
          type: 'validation',
          status: 'failed',
          message: 'An action error was caught and converted to a structured result.',
        },
      ],
      safety: localActionSafety(false, false),
      nextState: 'unknown',
    });
    recordActionResult(result);
    return result;
  }
}

export function readLocalAppActionStatus(): BrainCoreLocalAppActionStatusResponse {
  return {
    id: 'local-apps-actions-status',
    inFlight: Array.from(localAppInFlightActions.values()),
    recentResults: [...localAppRecentResults],
    lastErrorByApp: Object.fromEntries(localAppLastErrorByApp),
    locks: Array.from(localAppInFlightActions.values()).map((entry) => ({
      appId: entry.appId,
      action: entry.action,
      startedAt: entry.startedAt,
    })),
    managedProcesses: readManagedLocalAppProcesses(),
    audit: readLocalAppActionAuditStatus(),
    safety: {
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      commandOverrideAccepted: false,
      exposesSecrets: false,
    },
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

function createActionPlanSteps(app: BrainCoreLocalAppDefinition, action: BrainCoreLocalAppAction): BrainCoreLocalAppActionPlan['steps'] {
  return createOrderedActionTargets(app, action).map((target) => ({
    id: target.id,
    label: target.label,
    detail: `${target.type} ${action} step is derived from the canonical app definition.`,
  }));
}

function createExecutionSteps(
  app: BrainCoreLocalAppDefinition,
  action: BrainCoreLocalAppAction,
  status: BrainCoreLocalAppActionResultStep['status'] = 'not_executable',
  message?: string,
): BrainCoreLocalAppActionResultStep[] {
  return createOrderedActionTargets(app, action).map((target) => ({
    id: target.id,
    label: target.label,
    type: target.type,
    status,
    message: message ?? `${target.label} has no safe executable ${action} strategy registered yet.`,
  }));
}

function createOrderedActionTargets(app: BrainCoreLocalAppDefinition, action: BrainCoreLocalAppAction): Array<{ id: string; label: string; type: 'database' | 'service' | 'validation' | 'health-check' | 'report' }> {
  const services = [...app.services].sort((left, right) => action === 'stop' ? left.stopOrder - right.stopOrder : left.startOrder - right.startOrder);
  const targets: Array<{ id: string; label: string; type: 'database' | 'service' | 'validation' | 'health-check' | 'report' }> = [
    { id: 'validate-app', label: 'Validate canonical app id', type: 'validation' },
  ];

  if ((action === 'start' || action === 'restart') && app.database) {
    targets.push({ id: app.database.id, label: 'Database dependency', type: 'database' });
  }

  targets.push(...services.filter((service) => service.type !== 'database').map((service) => ({
    id: service.id,
    label: service.label,
    type: 'service' as const,
  })));

  if (action === 'stop' && app.database) {
    targets.push({ id: app.database.id, label: 'Database dependency', type: 'database' });
  }

  targets.push({ id: 'verify-health', label: 'Verify health and port state', type: 'health-check' });
  targets.push({ id: 'report-result', label: 'Report result', type: 'report' });
  return targets;
}

function localActionSafety(allowlistedApp: boolean, allowlistedAction: boolean): BrainCoreLocalAppActionSafety {
  return {
    pluginExecutesShell: false,
    arbitraryCommandAllowed: false,
    commandOverrideAccepted: false,
    canonicalAppIdRequired: true,
    allowlistedDefinitionRequired: allowlistedApp,
    allowlistedApp,
    allowlistedAction,
    exposesSecrets: false,
  };
}

function createActionResult(input: {
  id: string;
  appId: string;
  action: BrainCoreLocalAppAction;
  status: BrainCoreLocalAppActionResult['status'];
  ok: boolean;
  message: string;
  errorCode?: string;
  error?: string;
  startedAtMs: number;
  steps: BrainCoreLocalAppActionResultStep[];
  safety: BrainCoreLocalAppActionSafety;
  nextState: BrainCoreLocalAppActionResult['nextState'];
  nextPollMs?: number;
}): BrainCoreLocalAppActionResult {
  const endedAtMs = Date.now();
  const endedAt = new Date(endedAtMs).toISOString();
  return {
    id: input.id,
    appId: input.appId,
    action: input.action,
    status: input.status,
    ok: input.ok,
    message: input.message,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.error ? { error: input.error } : {}),
    startedAt: new Date(input.startedAtMs).toISOString(),
    endedAt,
    finishedAt: endedAt,
    durationMs: Math.max(0, endedAtMs - input.startedAtMs),
    nextPollMs: input.nextPollMs ?? 1500,
    steps: input.steps,
    safety: input.safety,
    nextState: input.nextState,
  };
}

function recordActionResult(result: BrainCoreLocalAppActionResult): void {
  localAppRecentResults.unshift(result);
  localAppRecentResults.splice(RECENT_ACTION_LIMIT);
  if (!result.ok || result.errorCode) {
    localAppLastErrorByApp.set(result.appId, result);
  }
  persistLocalAppActionAudit(result);
}

function readLocalAppActionAuditStatus(): BrainCoreLocalAppActionStatusResponse['audit'] {
  return {
    ...localAppActionAuditState,
    safety: {
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      commandOverrideAccepted: false,
      exposesSecrets: false,
      writesToMind: false,
      writesOperationsConfig: false,
    },
  };
}

function persistLocalAppActionAudit(result: BrainCoreLocalAppActionResult): void {
  const auditPath = resolveLocalAppActionAuditPath();
  if (!auditPath) {
    localAppActionAuditState.status = 'disabled';
    localAppActionAuditState.path = '[invalid-audit-path]';
    localAppActionAuditState.lastError = 'Audit path is unsafe or disabled.';
    return;
  }

  try {
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.appendFileSync(auditPath, `${JSON.stringify(createLocalAppActionAuditEntry(result))}\n`);
    localAppActionAuditState.status = 'enabled';
    localAppActionAuditState.path = summarizeAuditPath(auditPath);
    localAppActionAuditState.persistedResultCount += 1;
    localAppActionAuditState.lastPersistedAt = new Date().toISOString();
    delete localAppActionAuditState.lastError;
  } catch (error) {
    localAppActionAuditState.status = 'error';
    localAppActionAuditState.path = summarizeAuditPath(auditPath);
    localAppActionAuditState.lastError = redactError(error);
  }
}

function createLocalAppActionAuditEntry(result: BrainCoreLocalAppActionResult) {
  return {
    id: result.id,
    appId: result.appId,
    action: result.action,
    status: result.status,
    ok: result.ok,
    errorCode: result.errorCode ?? null,
    message: result.message,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMs: result.durationMs,
    nextState: result.nextState,
    stepCount: result.steps.length,
    stepStatuses: result.steps.map((step) => ({ id: step.id, status: step.status, type: step.type })),
    safety: result.safety,
  };
}

function resolveLocalAppActionAuditPath(): string | null {
  const rawPath = process.env[LOCAL_APP_ACTION_AUDIT_PATH_ENV] || DEFAULT_LOCAL_APP_ACTION_AUDIT_PATH;
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase()).filter(Boolean);
  if (segments.some((segment) => DISALLOWED_AUDIT_PATH_SEGMENTS.has(segment))) return null;
  return path.resolve(rawPath);
}

function summarizeAuditPath(auditPath: string): string {
  const relative = path.relative(process.cwd(), auditPath);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
  return `[external-safe-runtime-path]/${path.basename(auditPath)}`;
}

function redactError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*=)[^\s]+/gi, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .slice(0, 240);
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
  const startCommand = readStringOrNull(raw.start || raw.startCommand);
  const stopCommand = readStringOrNull(raw.stop || raw.stopCommand);
  const restartCommand = readStringOrNull(raw.restart || raw.restartCommand);
  const repoPath = readStringOrNull(raw.repoPath);
  const commandWorkdir = repoPath ? repoPath.replace(/^~/, process.env.HOME || '/root') : undefined;
  const definitionBase = {
    id,
    name,
    label: readString(raw.description, name),
    description: readString(raw.description, name),
    category: deriveCategory(name, repoPath),
    managed: Boolean(startCommand || stopCommand || restartCommand),
    services,
    docsRef: 'operations/infrastructure/local-apps.md',
    onboardingStatus: 'registered' as const,
    actionPolicy: createActionPolicy([]),
    ...(repoPath ? { repoPathSummary: summarizePath(repoPath) } : {}),
    ...(port !== null ? { appPort: port as number } : {}),
    ...(url ? { appUrl: url } : {}),
    ...(readStringOrNull(raw.check ?? raw.healthCheck) ? { healthUrl: readStringOrNull(raw.check ?? raw.healthCheck)! } : {}),
    ...(database ? { database } : {}),
    ...(startCommand ? { startCommand } : {}),
    ...(stopCommand ? { stopCommand } : {}),
    ...(restartCommand ? { restartCommand } : {}),
    ...(commandWorkdir ? { commandWorkdir } : {}),
  } satisfies BrainCoreLocalAppDefinition;
  const safeActions = (['start', 'stop', 'restart'] as const).filter((action) =>
    evaluateLocalAppActionDefinition(definitionBase, action).executable,
  );

  return {
    ...definitionBase,
    actionPolicy: createActionPolicy(safeActions),
    ...(repoPath ? { repoPathSummary: summarizePath(repoPath) } : {}),
    ...(port !== null ? { appPort: port as number } : {}),
    ...(url ? { appUrl: url } : {}),
    ...(readStringOrNull(raw.check ?? raw.healthCheck) ? { healthUrl: readStringOrNull(raw.check ?? raw.healthCheck)! } : {}),
    ...(database ? { database } : {}),
    ...(startCommand ? { startCommand } : {}),
    ...(stopCommand ? { stopCommand } : {}),
    ...(restartCommand ? { restartCommand } : {}),
    ...(commandWorkdir ? { commandWorkdir } : {}),
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
