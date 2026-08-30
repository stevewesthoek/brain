import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadNewRelicCredentials } from './infra-new-relic.js';

export const CANONICAL_INFRASTRUCTURE_TELEMETRY_SCHEMA_VERSION = '1.0.0';
export const CANONICAL_HOST_IDS = ['host:dokploy-aws', 'host:cloudpanel-aws', 'host:vm-supabase'] as const;
export type CanonicalHostState = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'STALE' | 'UNKNOWN';

type BackupState = 'HEALTHY' | 'WARNING' | 'FAILED' | 'UNKNOWN';
type BackupRunStatus = 'SUCCESS' | 'FAILED' | 'NOOP' | 'RUNNING' | 'UNKNOWN';

interface CanonicalHostDefinition {
  resourceId: (typeof CANONICAL_HOST_IDS)[number];
  name: string;
  expectedEntityNames: string[];
  backupJobId: string;
  sshAlias: string;
}

const HOSTS: CanonicalHostDefinition[] = [
  { resourceId: 'host:dokploy-aws', name: 'dokploy-aws', expectedEntityNames: ['dokploy-aws'], backupJobId: 'backup_job:dokploy-aws-recovery', sshAlias: 'dokploy' },
  { resourceId: 'host:cloudpanel-aws', name: 'cloudpanel-aws', expectedEntityNames: ['cloudpanel-aws'], backupJobId: 'backup_job:cloudpanel-aws-recovery', sshAlias: 'cloudpanel' },
  { resourceId: 'host:vm-supabase', name: 'vm-supabase', expectedEntityNames: ['vm-supabase', 'supabase'], backupJobId: 'backup_job:supabase-recovery', sshAlias: 'supabase' },
];

const FRESHNESS_SECONDS = 300;
const WARNING_THRESHOLDS = { cpuPercent: 85, memoryPercent: 90, diskUsedPercent: 80 };
const CRITICAL_THRESHOLDS = { cpuPercent: 95, memoryPercent: 95, diskUsedPercent: 90 };
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export interface CanonicalInfrastructureTelemetry {
  schemaVersion: string;
  status: 'ok' | 'not-configured' | 'error';
  generatedAt: string;
  accountId: string | null;
  region: 'EU' | null;
  cacheSeconds: number;
  hosts: CanonicalInfrastructureHost[];
  alerting: {
    status: 'audited' | 'unavailable';
    policyCount: number | null;
    conditionCount: number | null;
    canonicalPolicy: string;
    thresholds: typeof WARNING_THRESHOLDS & { telemetryStaleSeconds: number };
    notes: string[];
  };
  staleEntities: Array<{ name: string; guid: string | null; reason: string }>;
  error?: string;
}

export interface CanonicalInfrastructureHost {
  resourceId: string;
  name: string;
  state: CanonicalHostState;
  stateReason: string;
  entity: {
    guid: string | null;
    name: string | null;
    reporting: boolean;
    alertSeverity: string | null;
    continuityAlias: string | null;
  };
  telemetry: {
    freshness: 'fresh' | 'stale' | 'unknown';
    lastSeenAt: string | null;
    ageSeconds: number | null;
    agentVersion: string | null;
  };
  metrics: {
    cpuPercent: number | null;
    loadAverageOneMinute: number | null;
    memoryUsedPercent: number | null;
    memoryUsedBytes: number | null;
    memoryAvailableBytes: number | null;
    memoryTotalBytes: number | null;
    swapUsedBytes: number | null;
    swapTotalBytes: number | null;
    uptimeSeconds: number | null;
    storage: Array<{
      mountPoint: string;
      usedPercent: number | null;
      usedBytes: number | null;
      freeBytes: number | null;
      totalBytes: number | null;
      inodeUsedPercent: number | null;
    }>;
    network: Array<{
      interfaceName: string;
      receiveBytesPerSecond: number | null;
      transmitBytesPerSecond: number | null;
      receiveErrorsPerSecond: number | null;
      transmitErrorsPerSecond: number | null;
    }>;
    processCount: number | null;
  };
  runtime: {
    docker: 'observed' | 'not_reported' | 'unknown';
    runningContainers: number | null;
    nonRunningContainers: number | null;
    unhealthyContainers: number | null;
    restartCount: number | null;
    systemd: 'observed' | 'unknown';
    activeServices: number | null;
    failedServices: number | null;
    serviceStatuses: Array<{ name: string; status: string }>;
  };
  backup: {
    jobId: string;
    state: BackupState;
    status: BackupRunStatus;
    reason: string;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    sourceRef: string | null;
    runId: string | null;
    recoveryPointId: string | null;
    recoveryPointTime: string | null;
    blobPrefix: string | null;
    objectCount: number | null;
    totalBytes: number | null;
    localValidation: 'PASS' | 'NOT_EXECUTED' | 'UNKNOWN';
    remoteVerification: 'PASS' | 'PARTIAL' | 'NOT_EXECUTED' | 'UNKNOWN';
    tempResourcesCleaned: boolean | null;
    productionLogicalDumpUsed: boolean | null;
    productionTouched: boolean | null;
  };
}

interface NewRelicEntity {
  guid?: string;
  name?: string;
  reporting?: boolean;
  alertSeverity?: string;
}

interface NrqlResult {
  facet?: string | string[];
  [key: string]: unknown;
}

interface NewRelicResponse {
  data?: {
    actor?: {
      hosts?: { results?: { entities?: NewRelicEntity[] } };
      account?: {
        hostSamples?: { results?: NrqlResult[] };
        storageSamples?: { results?: NrqlResult[] };
        networkSamples?: { results?: NrqlResult[] };
        processSamples?: { results?: NrqlResult[] };
        containerSamples?: { results?: NrqlResult[] };
        containerStateSamples?: { results?: NrqlResult[] };
        historicalHostSamples?: { results?: NrqlResult[] };
        alerts?: {
          policiesSearch?: { totalCount?: number; policies?: Array<{ id?: string; name?: string; incidentPreference?: string }> };
          nrqlConditionsSearch?: { totalCount?: number };
        };
      };
    };
  };
  errors?: Array<{ message?: string }>;
}

interface RuntimeProbe {
  activeServices: number;
  failedServices: number;
  serviceStatuses: Array<{ name: string; status: string }>;
  dockerInstalled: boolean;
  dockerRunning: number | null;
  dockerTotal: number | null;
  dockerUnhealthy: number | null;
}

const SERVICES_BY_HOST: Record<string, string[]> = {
  dokploy: ['docker', 'cloudflared', 'tailscaled'],
  cloudpanel: ['cloudflared', 'clp-nginx', 'clp-php-fpm', 'mariadb', 'nginx', 'php8.4-fpm', 'tailscaled'],
  supabase: ['cloudflared', 'docker', 'newrelic-infra', 'tailscaled', 'pgdump-upload.timer'],
};

function probeRuntime(definition: CanonicalHostDefinition): Promise<RuntimeProbe | null> {
  const services = SERVICES_BY_HOST[definition.sshAlias] ?? [];
  const serviceArgs = services.map((service) => `printf 'service_${service}=%s\\n' "$(systemctl is-active ${service} 2>/dev/null || true)"`).join('; ');
  const command = `printf 'activeServices=%s\\n' "$(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | wc -l)"; printf 'failedServices=%s\\n' "$(systemctl --failed --type=service --no-legend 2>/dev/null | wc -l)"; ${serviceArgs}; if command -v docker >/dev/null 2>&1; then printf 'dockerInstalled=true\\n'; printf 'dockerRunning=%s\\n' "$(sudo -n docker ps -q 2>/dev/null | wc -l)"; printf 'dockerTotal=%s\\n' "$(sudo -n docker ps -aq 2>/dev/null | wc -l)"; printf 'dockerUnhealthy=%s\\n' "$(sudo -n docker ps --format '{{.Status}}' 2>/dev/null | grep -ci unhealthy || true)"; else printf 'dockerInstalled=false\\n'; fi`;
  return new Promise((resolve) => {
    execFile('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', definition.sshAlias, command], { timeout: 7_000, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error) { resolve(null); return; }
      const values = new Map([...stdout.matchAll(/^([^=\n]+)=(.*)$/gm)].map((match) => [match[1]!, match[2]!]));
      const serviceStatuses = services.map((name) => ({ name, status: values.get(`service_${name}`) || 'unknown' }));
      const number = (key: string): number | null => { const value = Number(values.get(key)); return Number.isFinite(value) ? value : null; };
      resolve({ activeServices: number('activeServices') ?? 0, failedServices: number('failedServices') ?? 0, serviceStatuses, dockerInstalled: values.get('dockerInstalled') === 'true', dockerRunning: number('dockerRunning'), dockerTotal: number('dockerTotal'), dockerUnhealthy: number('dockerUnhealthy') });
    });
  });
}

let cache: { expiresAt: number; value: CanonicalInfrastructureTelemetry; probeRuntime: boolean } | null = null;

export async function getCanonicalInfrastructureTelemetry(options: { now?: Date; root?: string; forceRefresh?: boolean; probeRuntime?: boolean } = {}): Promise<CanonicalInfrastructureTelemetry> {
  const now = options.now ?? new Date();
  if (!options.forceRefresh && cache && cache.expiresAt > now.getTime() && (!options.probeRuntime || cache.probeRuntime)) return cache.value;

  const credentials = loadNewRelicCredentials();
  const accountId = credentials.accountId ?? null;
  const base = {
    schemaVersion: CANONICAL_INFRASTRUCTURE_TELEMETRY_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    accountId,
    region: accountId ? 'EU' as const : null,
    cacheSeconds: 15,
  };
  if (!credentials.apiKey || !accountId || !/^\d+$/.test(accountId)) {
    const value = { ...base, status: 'not-configured' as const, hosts: HOSTS.map((host) => unknownHost(host, 'New Relic EU credentials are not configured.')), alerting: alertingUnavailable(), staleEntities: [], error: 'New Relic credentials are not configured.' };
    cache = { expiresAt: now.getTime() + 15_000, value, probeRuntime: Boolean(options.probeRuntime) };
    return value;
  }

  try {
    const response = await fetchNewRelic(credentials.apiKey, accountId);
    if (!response.data?.actor) throw new Error(response.errors?.map((error) => error.message).filter(Boolean).join('; ') || 'New Relic returned no actor data.');
    const entities = response.data.actor.hosts?.results?.entities ?? [];
    const hostSamples = indexByFacet(response.data.actor.account?.hostSamples?.results ?? []);
    const storageSamples = indexByFacet(response.data.actor.account?.storageSamples?.results ?? []);
    const networkSamples = indexByFacet(response.data.actor.account?.networkSamples?.results ?? []);
    const processSamples = indexByFacet(response.data.actor.account?.processSamples?.results ?? []);
    const containerSamples = indexByFacet(response.data.actor.account?.containerSamples?.results ?? []);
    const containerStateSamples = indexByFacet(response.data.actor.account?.containerStateSamples?.results ?? []);
    const historicalHostSamples = response.data.actor.account?.historicalHostSamples?.results ?? [];
    const backups = readBackupStates(options.root ?? DEFAULT_ROOT);
    const runtimeProbes = options.probeRuntime ? await Promise.all(HOSTS.map((definition) => probeRuntime(definition))) : HOSTS.map(() => null);
    const hosts = HOSTS.map((definition, index) => buildHost(definition, entities, hostSamples, storageSamples, networkSamples, processSamples, containerSamples, containerStateSamples, backups, runtimeProbes[index] ?? null, now));
    const staleNames = new Set(historicalHostSamples.map((sample) => typeof sample.facet === 'string' ? sample.facet : null).filter((name): name is string => Boolean(name)));
    const staleEntities = [...entities.filter((entity) => entity.name), ...[...staleNames].map((name) => ({ name }))]
      .filter((entity) => entity.name && !HOSTS.some((host) => host.expectedEntityNames.includes(entity.name!)))
      .filter((entity, index, all) => all.findIndex((candidate) => candidate.name === entity.name) === index)
      .map((entity) => ({ name: entity.name!, guid: 'guid' in entity ? entity.guid ?? null : null, reason: 'Reporting entity is not one of the three canonical production host identities; retained as historical/unmapped evidence.' }));
    const value = { ...base, status: 'ok' as const, hosts, alerting: alertingAudited(response.data.actor.account?.alerts), staleEntities };
    cache = { expiresAt: now.getTime() + 15_000, value, probeRuntime: Boolean(options.probeRuntime) };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const value = { ...base, status: 'error' as const, hosts: HOSTS.map((host) => unknownHost(host, `New Relic query unavailable: ${message}`)), alerting: alertingUnavailable(), staleEntities: [], error: message };
    cache = { expiresAt: now.getTime() + 15_000, value, probeRuntime: Boolean(options.probeRuntime) };
    return value;
  }
}

async function fetchNewRelic(apiKey: string, accountId: string): Promise<NewRelicResponse> {
  const query = `query { actor { hosts: entitySearch(query: "accountId = ${accountId} AND type = 'HOST' AND domain = 'INFRA'") { results { entities { guid name reporting alertSeverity } } } account(id: ${accountId}) { alerts { policiesSearch { totalCount policies { id name incidentPreference } } nrqlConditionsSearch { totalCount } } hostSamples: nrql(query: "SELECT latest(timestamp), latest(cpuPercent), latest(loadAverageOneMinute), latest(memoryUsedBytes), latest(memoryTotalBytes), latest(memoryAvailableBytes), latest(memoryUsedPercent), latest(swapUsedBytes), latest(swapTotalBytes), latest(uptime), latest(agentVersion) FROM SystemSample FACET hostname SINCE 15 minutes ago LIMIT 100") { results } historicalHostSamples: nrql(query: "SELECT latest(timestamp), latest(agentVersion) FROM SystemSample FACET hostname SINCE 30 days ago LIMIT 100") { results } storageSamples: nrql(query: "SELECT latest(timestamp), latest(diskUsedBytes), latest(diskTotalBytes), latest(diskFreeBytes), latest(diskUsedPercent), latest(inodeUsedPercent) FROM StorageSample FACET hostname, mountPoint SINCE 15 minutes ago LIMIT 100") { results } networkSamples: nrql(query: "SELECT latest(timestamp), latest(receiveBytesPerSecond), latest(transmitBytesPerSecond), latest(receiveErrorsPerSecond), latest(transmitErrorsPerSecond) FROM NetworkSample FACET hostname, interfaceName SINCE 15 minutes ago LIMIT 100") { results } processSamples: nrql(query: "SELECT uniqueCount(processId) FROM ProcessSample FACET hostname SINCE 15 minutes ago LIMIT 100") { results } containerSamples: nrql(query: "SELECT latest(timestamp), uniqueCount(containerId), latest(state), latest(restartCount) FROM ContainerSample FACET hostname SINCE 15 minutes ago LIMIT 100") { results } containerStateSamples: nrql(query: "SELECT uniqueCount(containerId), latest(restartCount) FROM ContainerSample FACET hostname, state SINCE 15 minutes ago LIMIT 100") { results } } } }`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const raw = await fetch('https://api.eu.newrelic.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', 'API-Key': apiKey }, body: JSON.stringify({ query }), signal: controller.signal });
    if (!raw.ok) throw new Error(`New Relic API returned ${raw.status}`);
    return await raw.json() as NewRelicResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function indexByFacet(results: NrqlResult[]): Map<string, NrqlResult[]> {
  const output = new Map<string, NrqlResult[]>();
  for (const result of results) {
    const facet = result.facet;
    if (typeof facet === 'string') output.set(facet, [...(output.get(facet) ?? []), result]);
    if (Array.isArray(facet) && typeof facet[0] === 'string') output.set(facet.join('\u0000'), [...(output.get(facet.join('\u0000')) ?? []), result]);
  }
  return output;
}

function resultsForHost(index: Map<string, NrqlResult[]>, hostname: string): NrqlResult[] {
  return [...index.entries()]
    .filter(([key]) => key === hostname || key.startsWith(`${hostname}\u0000`))
    .flatMap(([, values]) => values);
}

function buildHost(definition: CanonicalHostDefinition, entities: NewRelicEntity[], hostSamples: Map<string, NrqlResult[]>, storageSamples: Map<string, NrqlResult[]>, networkSamples: Map<string, NrqlResult[]>, processSamples: Map<string, NrqlResult[]>, containerSamples: Map<string, NrqlResult[]>, containerStateSamples: Map<string, NrqlResult[]>, backups: Map<string, CanonicalInfrastructureHost['backup']>, runtimeProbe: RuntimeProbe | null, now: Date): CanonicalInfrastructureHost {
  const entity = entities.find((candidate) => candidate.name && definition.expectedEntityNames.includes(candidate.name));
  const telemetryName = entity?.name ?? definition.expectedEntityNames[0]!;
  const system = first(hostSamples.get(telemetryName));
  const storage = resultsForHost(storageSamples, telemetryName);
  const network = resultsForHost(networkSamples, telemetryName);
  const process = first(processSamples.get(telemetryName));
  const container = first(containerSamples.get(telemetryName));
  const containerStates = resultsForHost(containerStateSamples, telemetryName);
  const lastSeenMs = latestTimestamp([system, ...storage, ...network, container]);
  const ageSeconds = lastSeenMs === null ? null : Math.max(0, Math.floor((now.getTime() - lastSeenMs) / 1000));
  const freshness = ageSeconds === null ? 'unknown' : ageSeconds <= FRESHNESS_SECONDS ? 'fresh' : 'stale';
  const backup = backups.get(definition.backupJobId) ?? unknownBackup(definition.backupJobId, 'No machine-readable current backup evidence is available.');
  const metrics = {
    cpuPercent: numberValue(system, 'latest.cpuPercent'), loadAverageOneMinute: numberValue(system, 'latest.loadAverageOneMinute'),
    memoryUsedPercent: numberValue(system, 'latest.memoryUsedPercent') ?? ratioPercent(system, 'latest.memoryUsedBytes', 'latest.memoryTotalBytes'),
    memoryUsedBytes: numberValue(system, 'latest.memoryUsedBytes'), memoryAvailableBytes: numberValue(system, 'latest.memoryAvailableBytes') ?? difference(system, 'latest.memoryTotalBytes', 'latest.memoryUsedBytes'), memoryTotalBytes: numberValue(system, 'latest.memoryTotalBytes'),
    swapUsedBytes: numberValue(system, 'latest.swapUsedBytes'), swapTotalBytes: numberValue(system, 'latest.swapTotalBytes'), uptimeSeconds: numberValue(system, 'latest.uptime'),
    storage: storage.map((item) => ({ mountPoint: facetPart(item, 1) ?? 'unknown', usedPercent: numberValue(item, 'latest.diskUsedPercent'), usedBytes: numberValue(item, 'latest.diskUsedBytes'), freeBytes: numberValue(item, 'latest.diskFreeBytes'), totalBytes: numberValue(item, 'latest.diskTotalBytes'), inodeUsedPercent: numberValue(item, 'latest.inodeUsedPercent') })),
    network: network.map((item) => ({ interfaceName: facetPart(item, 1) ?? 'unknown', receiveBytesPerSecond: numberValue(item, 'latest.receiveBytesPerSecond'), transmitBytesPerSecond: numberValue(item, 'latest.transmitBytesPerSecond'), receiveErrorsPerSecond: numberValue(item, 'latest.receiveErrorsPerSecond'), transmitErrorsPerSecond: numberValue(item, 'latest.transmitErrorsPerSecond') })),
    processCount: numberValue(process, 'uniqueCount.processId'),
  };
  const maxDisk = Math.max(...metrics.storage.map((item) => item.usedPercent ?? 0), 0);
  const runningContainers = runtimeProbe?.dockerRunning ?? sumContainerState(containerStates, 'running') ?? numberValue(container, 'uniqueCount.containerId');
  const nonRunningContainers = sumContainerStatesExcept(containerStates, 'running');
  const unhealthyContainers = runtimeProbe?.dockerUnhealthy ?? sumContainerState(containerStates, 'unhealthy');
  const restartCount = Math.max(...containerStates.map((item) => numberValue(item, 'latest.restartCount') ?? 0), numberValue(container, 'latest.restartCount') ?? 0);
  const state = hostState(entity, freshness, metrics.cpuPercent, metrics.memoryUsedPercent, maxDisk, backup.state, runtimeProbe?.failedServices ?? 0);
  return {
    resourceId: definition.resourceId, name: definition.name, state,
    stateReason: stateReason(state, entity, freshness, metrics.cpuPercent, metrics.memoryUsedPercent, maxDisk, backup, runtimeProbe?.failedServices ?? 0),
    entity: { guid: entity?.guid ?? null, name: entity?.name ?? null, reporting: entity?.reporting === true, alertSeverity: entity?.alertSeverity ?? null, continuityAlias: definition.resourceId === 'host:vm-supabase' && entity?.name === 'supabase' ? 'supabase' : null },
    telemetry: { freshness, lastSeenAt: lastSeenMs === null ? null : new Date(lastSeenMs).toISOString(), ageSeconds, agentVersion: stringValue(system, 'latest.agentVersion') },
    metrics,
    runtime: { docker: runtimeProbe?.dockerInstalled === false ? 'not_reported' : (runningContainers === null && nonRunningContainers === null) ? entity ? 'not_reported' : 'unknown' : 'observed', runningContainers, nonRunningContainers: runtimeProbe?.dockerTotal !== null && runtimeProbe?.dockerTotal !== undefined && runningContainers !== null ? Math.max(0, runtimeProbe.dockerTotal - runningContainers) : nonRunningContainers, unhealthyContainers, restartCount, systemd: runtimeProbe ? 'observed' : 'unknown', activeServices: runtimeProbe?.activeServices ?? null, failedServices: runtimeProbe?.failedServices ?? null, serviceStatuses: runtimeProbe?.serviceStatuses ?? [] },
    backup,
  };
}

function unknownHost(definition: CanonicalHostDefinition, reason: string): CanonicalInfrastructureHost {
  return { resourceId: definition.resourceId, name: definition.name, state: 'UNKNOWN', stateReason: reason, entity: { guid: null, name: null, reporting: false, alertSeverity: null, continuityAlias: null }, telemetry: { freshness: 'unknown', lastSeenAt: null, ageSeconds: null, agentVersion: null }, metrics: { cpuPercent: null, loadAverageOneMinute: null, memoryUsedPercent: null, memoryUsedBytes: null, memoryAvailableBytes: null, memoryTotalBytes: null, swapUsedBytes: null, swapTotalBytes: null, uptimeSeconds: null, storage: [], network: [], processCount: null }, runtime: { docker: 'unknown', runningContainers: null, nonRunningContainers: null, unhealthyContainers: null, restartCount: null, systemd: 'unknown', activeServices: null, failedServices: null, serviceStatuses: [] }, backup: unknownBackup(definition.backupJobId, 'Backup state not evaluated because New Relic is unavailable.') };
}

function hostState(entity: NewRelicEntity | undefined, freshness: string, cpu: number | null, memory: number | null, disk: number, backup: BackupState, failedServices: number): CanonicalHostState {
  if (!entity || freshness === 'unknown') return 'UNKNOWN';
  if (!entity.reporting || freshness === 'stale') return 'STALE';
  if (backup === 'FAILED' || String(entity.alertSeverity).toUpperCase() === 'CRITICAL' || (cpu ?? 0) >= CRITICAL_THRESHOLDS.cpuPercent || (memory ?? 0) >= CRITICAL_THRESHOLDS.memoryPercent || disk >= CRITICAL_THRESHOLDS.diskUsedPercent) return 'CRITICAL';
  if (backup === 'WARNING' || failedServices > 0 || String(entity.alertSeverity).toUpperCase() === 'WARNING' || (cpu ?? 0) >= WARNING_THRESHOLDS.cpuPercent || (memory ?? 0) >= WARNING_THRESHOLDS.memoryPercent || disk >= WARNING_THRESHOLDS.diskUsedPercent) return 'WARNING';
  return 'HEALTHY';
}

function stateReason(state: CanonicalHostState, entity: NewRelicEntity | undefined, freshness: string, cpu: number | null, memory: number | null, disk: number, backup: CanonicalInfrastructureHost['backup'], failedServices: number): string {
  if (!entity) return 'No canonical New Relic infrastructure entity is reporting.';
  if (!entity.reporting || freshness === 'stale') return 'Canonical entity is not reporting fresh telemetry.';
  if (backup.state === 'FAILED') return backup.reason;
  if (failedServices > 0) return `${failedServices} systemd service(s) are failed.`;
  if (state === 'CRITICAL') return `Critical threshold breached or New Relic alert is ${entity.alertSeverity ?? 'critical'}.`;
  if (state === 'WARNING') return `Warning threshold reached (cpu=${cpu ?? 'unknown'}%, memory=${memory ?? 'unknown'}%, maxDisk=${disk || 'unknown'}%).`;
  return 'Canonical host telemetry is fresh and within configured thresholds.';
}

function readBackupStates(root: string): Map<string, CanonicalInfrastructureHost['backup']> {
  const generatedPath = path.resolve(root, 'runtime/local/infrastructure/backup-runtime-state.json');
  const trackedPath = path.resolve(root, 'operations/infrastructure/health/backup-runtime-state.v1.json');
  const candidates = [generatedPath, trackedPath].filter((filePath) => fs.existsSync(filePath));
  for (const filePath of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { states?: Array<Record<string, unknown>> };
      if (!Array.isArray(data.states)) throw new Error('states must be an array');
      return new Map(data.states.map((policy) => [String(policy.backupJobId ?? ''), parseBackupEvidence(policy)]));
    } catch {
      if (filePath === generatedPath) return new Map(HOSTS.map((host) => [host.backupJobId, unknownBackup(host.backupJobId, 'Generated backup runtime state is malformed; telemetry failed closed.')]))
    }
  }
  return new Map();
}

function parseBackupEvidence(policy: Record<string, unknown>): CanonicalInfrastructureHost['backup'] {
  const status = normalizeBackupRunStatus(policy.status);
  const state = normalizeBackupState(policy.state, status);
  return {
    jobId: String(policy.backupJobId ?? ''), state, status,
    reason: String(policy.reason ?? 'Current backup state is unknown.'),
    lastAttemptAt: typeof policy.lastAttemptAt === 'string' ? policy.lastAttemptAt : null,
    lastSuccessAt: typeof policy.lastSuccessAt === 'string' ? policy.lastSuccessAt : null,
    sourceRef: typeof policy.sourceRef === 'string' ? policy.sourceRef : null,
    runId: typeof policy.runId === 'string' ? policy.runId : null,
    recoveryPointId: typeof policy.recoveryPointId === 'string' ? policy.recoveryPointId : null,
    recoveryPointTime: typeof policy.recoveryPointTime === 'string' ? policy.recoveryPointTime : null,
    blobPrefix: typeof policy.blobPrefix === 'string' ? policy.blobPrefix : null,
    objectCount: numberOrNull(policy.objectCount), totalBytes: numberOrNull(policy.totalBytes),
    localValidation: normalizeLocalValidation(policy.localValidation),
    remoteVerification: normalizeRemoteVerification(policy.remoteVerification),
    tempResourcesCleaned: booleanOrNull(policy.tempResourcesCleaned),
    productionLogicalDumpUsed: booleanOrNull(policy.productionLogicalDumpUsed),
    productionTouched: booleanOrNull(policy.productionTouched),
  };
}

function unknownBackup(jobId: string, reason: string): CanonicalInfrastructureHost['backup'] {
  return { jobId, state: 'UNKNOWN', status: 'UNKNOWN', reason, lastAttemptAt: null, lastSuccessAt: null, sourceRef: null, runId: null, recoveryPointId: null, recoveryPointTime: null, blobPrefix: null, objectCount: null, totalBytes: null, localValidation: 'UNKNOWN', remoteVerification: 'UNKNOWN', tempResourcesCleaned: null, productionLogicalDumpUsed: null, productionTouched: null };
}
function normalizeBackupState(value: unknown, status: BackupRunStatus = 'UNKNOWN'): BackupState { if (value === 'HEALTHY' || value === 'WARNING' || value === 'FAILED') return value; if (status === 'SUCCESS' || status === 'NOOP') return 'HEALTHY'; if (status === 'FAILED') return 'FAILED'; if (status === 'RUNNING') return 'WARNING'; return 'UNKNOWN'; }
function normalizeBackupRunStatus(value: unknown): BackupRunStatus { return value === 'SUCCESS' || value === 'FAILED' || value === 'NOOP' || value === 'RUNNING' ? value : 'UNKNOWN'; }
function normalizeLocalValidation(value: unknown): 'PASS' | 'NOT_EXECUTED' | 'UNKNOWN' { return value === 'PASS' || value === 'NOT_EXECUTED' ? value : 'UNKNOWN'; }
function normalizeRemoteVerification(value: unknown): 'PASS' | 'PARTIAL' | 'NOT_EXECUTED' | 'UNKNOWN' { return value === 'PASS' || value === 'PARTIAL' || value === 'NOT_EXECUTED' ? value : 'UNKNOWN'; }
function numberOrNull(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function booleanOrNull(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null; }
function alertingAudited(alerts?: { policiesSearch?: { totalCount?: number; policies?: Array<{ id?: string; name?: string; incidentPreference?: string }> }; nrqlConditionsSearch?: { totalCount?: number } }): CanonicalInfrastructureTelemetry['alerting'] {
  const canonical = alerts?.policiesSearch?.policies?.find((policy) => policy.name === 'Production Infrastructure - Host Telemetry');
  return {
    status: 'audited',
    policyCount: alerts?.policiesSearch?.totalCount ?? null,
    conditionCount: alerts?.nrqlConditionsSearch?.totalCount ?? null,
    canonicalPolicy: canonical ? `${canonical.name} (${canonical.id ?? 'id unavailable'})` : 'Production Infrastructure - Host Telemetry (not found)',
    thresholds: { ...WARNING_THRESHOLDS, telemetryStaleSeconds: FRESHNESS_SECONDS },
    notes: ['Existing account policies were inventoried; broad historical application policies remain separate.', 'Only canonical host identities are eligible for this view.', 'Canonical host policy uses loss-of-signal, CPU, memory, and storage conditions with warning/critical terms.'],
  };
}
function alertingUnavailable(): CanonicalInfrastructureTelemetry['alerting'] { return { status: 'unavailable', policyCount: null, conditionCount: null, canonicalPolicy: 'Production Infrastructure', thresholds: { ...WARNING_THRESHOLDS, telemetryStaleSeconds: FRESHNESS_SECONDS }, notes: ['Alert inventory unavailable because New Relic credentials or API access is unavailable.'] }; }
function first(values: NrqlResult[] | undefined): NrqlResult | undefined { return values?.[0]; }
function latestTimestamp(values: Array<NrqlResult | undefined>): number | null { const timestamps = values.map((value) => numberValue(value, 'latest.timestamp')).filter((value): value is number => value !== null); return timestamps.length ? Math.max(...timestamps) : null; }
function facetPart(value: NrqlResult, index: number): string | null { return Array.isArray(value.facet) && typeof value.facet[index] === 'string' ? value.facet[index] : null; }
function numberValue(value: NrqlResult | undefined, key: string): number | null { return typeof value?.[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : null; }
function stringValue(value: NrqlResult | undefined, key: string): string | null { return typeof value?.[key] === 'string' ? value[key] as string : null; }
function ratioPercent(value: NrqlResult | undefined, numerator: string, denominator: string): number | null { const top = numberValue(value, numerator); const bottom = numberValue(value, denominator); return top !== null && bottom ? top / bottom * 100 : null; }
function difference(value: NrqlResult | undefined, total: string, used: string): number | null { const top = numberValue(value, total); const bottom = numberValue(value, used); return top !== null && bottom !== null ? Math.max(0, top - bottom) : null; }
function sumContainerState(values: NrqlResult[], state: string): number | null {
  const matches = values.filter((value) => facetPart(value, 1)?.toLowerCase() === state.toLowerCase());
  return values.length ? matches.reduce((total, value) => total + (numberValue(value, 'uniqueCount.containerId') ?? 0), 0) : null;
}
function sumContainerStatesExcept(values: NrqlResult[], state: string): number | null {
  const matches = values.filter((value) => facetPart(value, 1)?.toLowerCase() !== state.toLowerCase());
  return values.length ? matches.reduce((total, value) => total + (numberValue(value, 'uniqueCount.containerId') ?? 0), 0) : null;
}
