import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MACHINE_TELEMETRY_INTERVAL_MS = 10_000;
const MACHINE_TELEMETRY_STALE_AFTER_MS = MACHINE_TELEMETRY_INTERVAL_MS * 3;
const MAX_PROCESS_ROWS = 512;
const MAX_SERVICE_PROCESS_ROWS = 16;
const MAX_TOP_PROCESSES = 5;
const MAX_COMMAND_OUTPUT_BYTES = 256 * 1024;
const DISK_DEGRADED_PERCENT = 85;
const DISK_ERROR_PERCENT = 95;
const CORE_MEMORY_DEGRADED_BYTES = 512 * 1024 * 1024;
const CORE_MEMORY_ERROR_BYTES = 1024 * 1024 * 1024;

export type MachineOperationalState = 'CURRENT' | 'STALE' | 'DEGRADED' | 'UNAVAILABLE' | 'ERROR' | 'PENDING';
export type BrainServiceId = 'brain-core' | 'brain-console' | 'scheduler' | 'obsidian';

export interface DiskTelemetry {
  id: 'primary-system-volume';
  mountPoint: '/';
  filesystem: string;
  totalBytes: number | null;
  usedBytes: number | null;
  availableBytes: number | null;
  usedPercent: number | null;
  state: MachineOperationalState;
  sampledAt: string | null;
  source: string;
  message: string;
}

export interface ProcessTelemetry {
  pid: number;
  displayName: string;
  serviceId: BrainServiceId | null;
  cpuPercent: number;
  rssBytes: number;
  uptimeSeconds: number | null;
  state: 'running' | 'sleeping' | 'stopped' | 'unknown';
  resourceState: MachineOperationalState;
  sampledAt: string;
}

export interface ProcessAnomaly {
  id: string;
  state: Exclude<MachineOperationalState, 'CURRENT' | 'PENDING'>;
  title: string;
  explanation: string;
  pid: number | null;
  serviceId: BrainServiceId | null;
}

export interface ProcessTelemetryProjection {
  state: MachineOperationalState;
  sampledAt: string | null;
  sampleLatencyMs: number | null;
  sampledCount: number;
  totalProcessCount: number;
  truncated: boolean;
  topCpu: ProcessTelemetry[];
  topMemory: ProcessTelemetry[];
  brainServices: ProcessTelemetry[];
  anomalies: ProcessAnomaly[];
}

export interface MachineTelemetry {
  schemaVersion: 'machine-telemetry-v1';
  generatedAt: string;
  state: MachineOperationalState;
  disk: DiskTelemetry;
  processes: ProcessTelemetryProjection;
  collector: {
    samplingIntervalMs: number;
    collectionCount: number;
    failureCount: number;
    inFlight: boolean;
    lastCollectionAt: string | null;
    lastCollectionDurationMs: number | null;
    payloadBytes: number;
  };
}

export interface CommandResult {
  stdout: string;
}

export type CommandRunner = (file: string, args: string[]) => Promise<CommandResult>;

export interface MachineSample {
  generatedAt: string;
  disk: DiskTelemetry;
  processes: ProcessTelemetryProjection;
  collectionDurationMs: number;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function finiteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function diskStateForUsage(usedPercent: number | null): MachineOperationalState {
  if (usedPercent === null) return 'UNAVAILABLE';
  if (usedPercent >= DISK_ERROR_PERCENT) return 'ERROR';
  if (usedPercent >= DISK_DEGRADED_PERCENT) return 'DEGRADED';
  return 'CURRENT';
}

export function parseDfOutput(stdout: string, sampledAt: string): DiskTelemetry {
  const line = stdout.split(/\r?\n/).map((entry) => entry.trim()).find((entry) => entry && !entry.toLowerCase().startsWith('filesystem'));
  if (!line) throw new Error('df returned no filesystem row');
  const fields = line.split(/\s+/);
  if (fields.length < 5) throw new Error('df returned an incomplete filesystem row');
  const filesystem = fields[0]!;
  const totalField = fields[1]!;
  const usedField = fields[2]!;
  const availableField = fields[3]!;
  const capacityField = fields[4]!;

  const totalBlocks = finiteNumber(totalField);
  const usedBlocks = finiteNumber(usedField);
  const availableBlocks = finiteNumber(availableField);
  const usedPercent = capacityField.endsWith('%') ? finiteNumber(capacityField.slice(0, -1)) : null;
  if (totalBlocks === null || usedBlocks === null || availableBlocks === null || usedPercent === null) {
    throw new Error('df returned non-numeric filesystem metrics');
  }

  const totalBytes = Math.round(totalBlocks * 1024);
  const usedBytes = Math.round(usedBlocks * 1024);
  const availableBytes = Math.round(availableBlocks * 1024);
  return {
    id: 'primary-system-volume',
    mountPoint: '/',
    filesystem: filesystem.startsWith('/dev/') ? 'local system volume' : filesystem.slice(0, 80),
    totalBytes,
    usedBytes,
    availableBytes,
    usedPercent: clampPercent(usedPercent),
    state: diskStateForUsage(usedPercent),
    sampledAt,
    source: 'system-metrics.df-root',
    message: 'Primary system volume from a bounded read-only df sample.',
  };
}

function parseElapsed(value: string): number | null {
  const parts = value.trim().split(/[-:]/).map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 4) return parts[0]! * 86400 + parts[1]! * 3600 + parts[2]! * 60 + parts[3]!;
  return null;
}

function processState(value: string): ProcessTelemetry['state'] {
  switch (value.trim().charAt(0).toUpperCase()) {
    case 'R': return 'running';
    case 'S':
    case 'I': return 'sleeping';
    case 'T': return 'stopped';
    default: return 'unknown';
  }
}

function identifyProcess(command: string, pid: number, brainCorePid: number | undefined): { displayName: string; serviceId: BrainServiceId | null } {
  const normalized = command.toLowerCase();
  if (brainCorePid === pid || normalized.includes('/brain-core/') || normalized.includes('brain-core/dist/index')) {
    return { displayName: 'Brain Core', serviceId: 'brain-core' };
  }
  if (normalized.includes('brain-console-service') || normalized.includes('next-server (v') || normalized.includes('/brain-console/.next/')) {
    return { displayName: 'Brain Console', serviceId: 'brain-console' };
  }
  if (normalized.includes('brain-scheduler-runner')) {
    return { displayName: 'Brain Scheduler', serviceId: 'scheduler' };
  }
  if (normalized.includes('obsidian')) {
    return { displayName: 'Obsidian', serviceId: 'obsidian' };
  }
  const executable = command.trim().split(/\s+/)[0]?.split('/').pop() ?? 'process';
  const displayName = executable.replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 80) || 'process';
  return { displayName, serviceId: null };
}

export function parsePsOutput(stdout: string, sampledAt: string, brainCorePid?: number, maxRows = MAX_PROCESS_ROWS): { processes: ProcessTelemetry[]; totalProcessCount: number; truncated: boolean } {
  const rows = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const generalProcesses: ProcessTelemetry[] = [];
  const serviceProcesses: ProcessTelemetry[] = [];
  let totalProcessCount = 0;
  for (const line of rows) {
    const match = line.match(/^(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const cpuPercent = finiteNumber(match[2]!);
    const rssKb = finiteNumber(match[3]!);
    if (!Number.isInteger(pid) || cpuPercent === null || rssKb === null) continue;
    totalProcessCount += 1;
    const identity = identifyProcess(match[6]!, pid, brainCorePid);
    const rssBytes = Math.round(rssKb * 1024);
    const resourceState = identity.serviceId === 'brain-core'
      ? rssBytes >= CORE_MEMORY_ERROR_BYTES ? 'ERROR' : rssBytes >= CORE_MEMORY_DEGRADED_BYTES ? 'DEGRADED' : 'CURRENT'
      : 'CURRENT';
    const process: ProcessTelemetry = {
      pid,
      displayName: identity.displayName,
      serviceId: identity.serviceId,
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      rssBytes,
      uptimeSeconds: parseElapsed(match[4]!),
      state: processState(match[5]!),
      resourceState,
      sampledAt,
    };
    if (process.serviceId !== null) {
      if (serviceProcesses.length < MAX_SERVICE_PROCESS_ROWS) serviceProcesses.push(process);
    } else if (generalProcesses.length < maxRows) {
      generalProcesses.push(process);
    }
  }
  const serviceBudget = Math.min(serviceProcesses.length, MAX_SERVICE_PROCESS_ROWS);
  const processes = [...generalProcesses.slice(0, Math.max(0, maxRows - serviceBudget)), ...serviceProcesses.slice(0, serviceBudget)];
  return { processes, totalProcessCount, truncated: totalProcessCount > processes.length };
}

function processProjectionFromRows(input: { processes: ProcessTelemetry[]; totalProcessCount: number; truncated: boolean }, sampledAt: string, sampleLatencyMs: number): ProcessTelemetryProjection {
  const topCpu = [...input.processes].sort((left, right) => right.cpuPercent - left.cpuPercent).slice(0, MAX_TOP_PROCESSES);
  const topMemory = [...input.processes].sort((left, right) => right.rssBytes - left.rssBytes).slice(0, MAX_TOP_PROCESSES);
  const brainServices = input.processes.filter((process) => process.serviceId !== null).sort((left, right) => right.rssBytes - left.rssBytes).slice(0, MAX_TOP_PROCESSES);
  const anomalies: ProcessAnomaly[] = input.processes
    .filter((process) => process.resourceState === 'DEGRADED' || process.resourceState === 'ERROR')
    .slice(0, MAX_TOP_PROCESSES)
    .map((process) => ({
      id: `process-memory-${process.pid}`,
      state: process.resourceState === 'ERROR' ? 'ERROR' : 'DEGRADED',
      title: `${process.displayName} memory pressure`,
      explanation: `${process.displayName} (PID ${process.pid}) is above the conservative memory envelope.`,
      pid: process.pid,
      serviceId: process.serviceId,
    }));
  return {
    state: 'CURRENT',
    sampledAt,
    sampleLatencyMs,
    sampledCount: input.processes.length,
    totalProcessCount: input.totalProcessCount,
    truncated: input.truncated,
    topCpu,
    topMemory,
    brainServices,
    anomalies,
  };
}

async function defaultCommandRunner(file: string, args: string[]): Promise<CommandResult> {
  const result = await execFileAsync(file, args, { timeout: 2_000, maxBuffer: MAX_COMMAND_OUTPUT_BYTES });
  return { stdout: String(result.stdout) };
}

export async function collectMachineTelemetry(options: { runCommand?: CommandRunner; brainCorePid?: number; now?: () => Date; maxProcessRows?: number } = {}): Promise<MachineSample> {
  const runCommand = options.runCommand ?? defaultCommandRunner;
  const now = options.now ?? (() => new Date());
  const startedAt = Date.now();
  const sampledAt = nowIso(now);
  const [diskResult, processResult] = await Promise.allSettled([
    runCommand('/bin/df', ['-kP', '/']),
    runCommand('/bin/ps', ['-axo', 'pid=,pcpu=,rss=,etime=,state=,command=']),
  ]);
  let disk: DiskTelemetry;
  if (diskResult.status === 'fulfilled') {
    try {
      disk = parseDfOutput(diskResult.value.stdout, sampledAt);
    } catch (error) {
      disk = unavailableDisk(sampledAt, error instanceof Error ? error.message : 'Disk output was malformed.');
    }
  } else {
    disk = unavailableDisk(sampledAt, 'Disk collector could not read the primary volume.');
  }
  let processes: ProcessTelemetryProjection;
  if (processResult.status === 'fulfilled') {
    try {
      const parsed = parsePsOutput(processResult.value.stdout, sampledAt, options.brainCorePid, options.maxProcessRows);
      processes = processProjectionFromRows(parsed, sampledAt, Date.now() - startedAt);
    } catch (error) {
      processes = unavailableProcesses(sampledAt, Date.now() - startedAt, error instanceof Error ? error.message : 'Process output was malformed.');
    }
  } else {
    processes = unavailableProcesses(sampledAt, Date.now() - startedAt, 'Process collector could not read the process list.');
  }
  return { generatedAt: sampledAt, disk, processes, collectionDurationMs: Date.now() - startedAt };
}

function unavailableDisk(sampledAt: string, message: string): DiskTelemetry {
  return { id: 'primary-system-volume', mountPoint: '/', filesystem: 'unavailable', totalBytes: null, usedBytes: null, availableBytes: null, usedPercent: null, state: 'UNAVAILABLE', sampledAt, source: 'system-metrics.df-root', message };
}

function unavailableProcesses(sampledAt: string, sampleLatencyMs: number | null, message: string): ProcessTelemetryProjection {
  return { state: 'UNAVAILABLE', sampledAt, sampleLatencyMs, sampledCount: 0, totalProcessCount: 0, truncated: false, topCpu: [], topMemory: [], brainServices: [], anomalies: [], };
}

function aggregateState(disk: DiskTelemetry, processes: ProcessTelemetryProjection): MachineOperationalState {
  const states = [disk.state, processes.state];
  return (['ERROR', 'DEGRADED', 'STALE', 'UNAVAILABLE', 'PENDING', 'CURRENT'] as MachineOperationalState[]).find((state) => states.includes(state)) ?? 'UNAVAILABLE';
}

function unavailableMachineTelemetry(now: () => Date, collectionCount: number, failureCount: number, inFlight: boolean): MachineTelemetry {
  const generatedAt = nowIso(now);
  const disk = unavailableDisk(generatedAt, 'Waiting for the first bounded machine telemetry sample.');
  const processes = unavailableProcesses(generatedAt, null, 'Waiting for the first bounded machine telemetry sample.');
  const base = { schemaVersion: 'machine-telemetry-v1' as const, generatedAt, state: 'PENDING' as const, disk, processes, collector: { samplingIntervalMs: MACHINE_TELEMETRY_INTERVAL_MS, collectionCount, failureCount, inFlight, lastCollectionAt: null, lastCollectionDurationMs: null, payloadBytes: 0 } };
  base.collector.payloadBytes = Buffer.byteLength(JSON.stringify(base), 'utf8');
  return base;
}

export class MachineTelemetryCollector {
  private snapshot: MachineTelemetry | null = null;
  private inFlight: Promise<MachineTelemetry> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private collectionCount = 0;
  private failureCount = 0;
  private lastCollectionAt: string | null = null;
  private lastCollectionDurationMs: number | null = null;

  constructor(private readonly options: { intervalMs?: number; now?: () => Date; collect?: () => Promise<MachineSample> } = {}) {}

  read(): MachineTelemetry {
    const now = this.options.now ?? (() => new Date());
    if (!this.snapshot) {
      void this.refresh();
      return unavailableMachineTelemetry(now, this.collectionCount, this.failureCount, this.inFlight !== null);
    }
    const ageMs = Date.now() - new Date(this.snapshot.generatedAt).getTime();
    if (ageMs >= (this.options.intervalMs ?? MACHINE_TELEMETRY_INTERVAL_MS)) void this.refresh();
    if (ageMs <= MACHINE_TELEMETRY_STALE_AFTER_MS) return this.withCollector(this.snapshot, true);
    return this.withCollector({
      ...this.snapshot,
      state: 'STALE',
      disk: this.snapshot.disk.state === 'CURRENT' ? { ...this.snapshot.disk, state: 'STALE' } : this.snapshot.disk,
      processes: this.snapshot.processes.state === 'CURRENT' ? { ...this.snapshot.processes, state: 'STALE' } : this.snapshot.processes,
    }, true);
  }

  refresh(): Promise<MachineTelemetry> {
    if (this.inFlight) return this.inFlight;
    const now = this.options.now ?? (() => new Date());
    this.inFlight = (this.options.collect ?? (() => collectMachineTelemetry({ now })))()
      .then((sample) => {
        this.collectionCount += 1;
        this.lastCollectionAt = sample.generatedAt;
        this.lastCollectionDurationMs = sample.collectionDurationMs;
        const next: MachineTelemetry = {
          schemaVersion: 'machine-telemetry-v1',
          generatedAt: sample.generatedAt,
          state: aggregateState(sample.disk, sample.processes),
          disk: sample.disk,
          processes: sample.processes,
          collector: { samplingIntervalMs: this.options.intervalMs ?? MACHINE_TELEMETRY_INTERVAL_MS, collectionCount: this.collectionCount, failureCount: this.failureCount, inFlight: false, lastCollectionAt: this.lastCollectionAt, lastCollectionDurationMs: this.lastCollectionDurationMs, payloadBytes: 0 },
        };
        next.collector.payloadBytes = Buffer.byteLength(JSON.stringify(next), 'utf8');
        this.snapshot = next;
        return next;
      })
      .catch(() => {
        this.failureCount += 1;
        if (this.snapshot) return this.withCollector({ ...this.snapshot, state: 'STALE' }, false);
        return unavailableMachineTelemetry(now, this.collectionCount, this.failureCount, false);
      })
      .finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => { void this.refresh(); }, this.options.intervalMs ?? MACHINE_TELEMETRY_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private withCollector(snapshot: MachineTelemetry, inFlight: boolean): MachineTelemetry {
    return { ...snapshot, collector: { ...snapshot.collector, collectionCount: this.collectionCount, failureCount: this.failureCount, inFlight, lastCollectionAt: this.lastCollectionAt, lastCollectionDurationMs: this.lastCollectionDurationMs } };
  }
}

export const machineTelemetryCollector = new MachineTelemetryCollector({ collect: () => collectMachineTelemetry({ brainCorePid: process.pid }) });

export function startMachineTelemetryCollector(): void {
  machineTelemetryCollector.start();
}

export function readMachineTelemetry(): MachineTelemetry {
  return machineTelemetryCollector.read();
}
