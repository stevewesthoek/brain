import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

import { createObservationAdapter, candidateFromObservation } from './observation-core.mjs';

export const LOCAL_RUNTIME_OBSERVER_ID = 'local-runtime-observer';
export const LOCAL_RUNTIME_OBSERVER_VERSION = '1.0.0';

function defaultRun(command, args) {
  try {
    return { ok: true, stdout: execFileSync(command, args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }) };
  } catch (error) {
    return { ok: false, stdout: '', error: error instanceof Error ? error.message : String(error) };
  }
}

function commandPath(command) {
  if (process.platform === 'darwin') {
    if (command === 'ps') return '/bin/ps';
    if (command === 'lsof') return '/usr/sbin/lsof';
  }
  return command;
}

function normalizeCommandIdentity(command) {
  const value = basename(String(command ?? '').trim()).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return value || 'unknown';
}

export function parseProcessList(text) {
  const processes = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const pid = Number(parts[0]);
    const parentPid = Number(parts[1]);
    const state = parts.at(-1);
    const command = parts.slice(2, -1).join(' ');
    if (!Number.isInteger(pid) || pid < 1 || !Number.isInteger(parentPid) || parentPid < 0 || !command || !/^[A-Za-z?]+$/.test(state ?? '')) continue;
    processes.push({ pid, parentPid, commandIdentity: normalizeCommandIdentity(command), state });
  }
  return processes;
}

function parseEndpoint(address) {
  const match = String(address ?? '').match(/^(.*):([0-9]+)$/);
  if (!match) return null;
  const rawHost = match[1].replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const hostClass = rawHost === '127.0.0.1' || rawHost === '::1' || rawHost === 'localhost'
    ? 'loopback'
    : rawHost === '0.0.0.0' || rawHost === '*'
      ? 'unknown'
      : 'local-network';
  return { hostClass, port };
}

export function parseListeningSockets(text) {
  const byProcess = new Map();
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (line.startsWith('p')) {
      const pid = Number(line.slice(1));
      current = Number.isInteger(pid) && pid > 0 ? { pid, commandIdentity: 'unknown', protocol: 'unknown', addresses: [] } : null;
      if (current) byProcess.set(pid, current);
    } else if (current && line.startsWith('c')) {
      current.commandIdentity = normalizeCommandIdentity(line.slice(1));
    } else if (current && line.startsWith('P')) {
      current.protocol = line.slice(1).toLowerCase() === 'tcp' ? 'tcp' : 'unknown';
    } else if (current && line.startsWith('n')) {
      const endpoint = parseEndpoint(line.slice(1));
      if (endpoint) current.addresses.push(endpoint);
    }
  }
  return [...byProcess.values()].flatMap((entry) => entry.addresses.map((endpoint) => ({
    ownerProcessId: entry.pid,
    commandIdentity: entry.commandIdentity,
    protocol: entry.protocol,
    ...endpoint,
    reachability: 'listening',
  })));
}

function observationForProcess(processInfo, listeners, now, observerId = LOCAL_RUNTIME_OBSERVER_ID) {
  const observedAt = new Date(now).toISOString();
  const resourceId = `application:local-process-${processInfo.pid}`;
  const candidateId = `candidate:local-process-${processInfo.pid}`;
  const ownListeners = listeners.filter((entry) => entry.ownerProcessId === processInfo.pid);
  return {
    schemaVersion: '1.0.0',
    observationId: `observation:local-runtime:${processInfo.pid}:${observedAt}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
    resourceId,
    providerId: 'local-runtime',
    observedAt,
    status: 'unknown',
    freshness: 'fresh',
    sourceEntityId: `process:${processInfo.pid}`,
    metricsSummary: { processState: processInfo.state, listenerCount: ownListeners.length },
    conditionCodes: ['environment_unknown', 'owner_unknown', 'identity_candidate'],
    provenance: {
      source: 'local-runtime-observer',
      readOnly: true,
      authority: 'local-observation',
      classification: 'OBSERVED-VERIFIED',
      confidence: 'medium',
      evidenceRefs: [`process:${processInfo.pid}`],
    },
    observationKind: 'discovery',
    observer: { observerId, adapterKind: 'local-runtime', adapterVersion: LOCAL_RUNTIME_OBSERVER_VERSION },
    candidateId,
    environment: { state: 'unknown', environmentClass: 'unknown', environmentRef: null, basis: ['process-observation-does-not-classify-environment'] },
    runtimeIdentity: {
      state: 'candidate', runtimeKind: 'process', runtimeRef: null, version: null, profileRef: null, identityStability: 'process-instance',
    },
    processEvidence: {
      state: 'confirmed', processIds: [processInfo.pid], parentProcessIds: [processInfo.parentPid], ownerState: 'unknown', ownerRef: null, commandIdentity: processInfo.commandIdentity,
    },
    endpointEvidence: {
      state: ownListeners.length > 0 ? 'confirmed' : 'unknown',
      endpoints: ownListeners.map((entry) => ({ protocol: entry.protocol, hostClass: entry.hostClass, port: entry.port, reachability: entry.reachability, ownerProcessId: entry.ownerProcessId })),
    },
    ownershipEvidence: { state: 'unknown', ownerRef: null, ownerKind: 'unknown', custody: 'unknown', mutationAuthority: 'unknown', writerRefs: [] },
    routeOwnershipEvidence: { state: 'not_applicable', ownerRef: null, ownerKind: 'unknown', custody: 'unknown', mutationAuthority: 'none', writerRefs: [] },
    dependencyEvidence: { state: 'unknown', dependencies: [] },
    identityBindingEvidence: { state: 'unknown', accountRefs: [], sessionRefs: [], runtimeProfileRefs: [], custody: 'unknown', principalMatch: 'unknown' },
    healthCapability: { state: 'unknown', adapterRef: null, capabilities: [] },
    lifecycleCapability: { state: 'unknown', ownerManaged: 'unknown', launchAtLogin: 'unknown', keepRunningWhenWindowCloses: 'unknown', quiescenceState: 'not_observable', activeWorkloadCount: null },
    isolationEvidence: { state: 'unknown', environmentRef: null, boundaryRefs: [], dimensions: { process: 'unknown', environment: 'unknown', state: 'unknown' } },
    redaction: { classification: 'non-secret-allowlisted', secretsExcluded: true, excludedClasses: ['process_arguments', 'environment_variables', 'filesystem_state', 'credentials'] },
  };
}

export function discoverLocalRuntime({
  now = new Date(),
  maxProcesses = 500,
  run = defaultRun,
  includeProcess = () => true,
  includeListener = () => true,
} = {}) {
  // ucomm returns the executable identity without collecting command arguments.
  const processResult = run(commandPath('ps'), ['-axo', 'pid=,ppid=,ucomm=,state=']);
  const socketResult = run(commandPath('lsof'), ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pcPn']);
  const allProcesses = processResult.ok ? parseProcessList(processResult.stdout) : [];
  const processes = allProcesses.filter(includeProcess).slice(0, maxProcesses);
  const listeners = socketResult.ok ? parseListeningSockets(socketResult.stdout).filter(includeListener) : [];
  const observations = processes.map((entry) => observationForProcess(entry, listeners, now));
  const candidates = observations.map((observation) => candidateFromObservation(observation, { resourceKind: 'runtime-process' }));
  return {
    observer: { observerId: LOCAL_RUNTIME_OBSERVER_ID, adapterKind: 'local-runtime', adapterVersion: LOCAL_RUNTIME_OBSERVER_VERSION },
    observedAt: new Date(now).toISOString(),
    sourceAvailability: { process: processResult.ok ? 'available' : 'unavailable', listener: socketResult.ok ? 'available' : 'unavailable' },
    processCount: allProcesses.length,
    listenerCount: listeners.length,
    processes,
    listeners,
    observations,
    candidates,
  };
}

export function createLocalRuntimeObserver(options = {}) {
  let latest = null;
  return createObservationAdapter({
    observerId: LOCAL_RUNTIME_OBSERVER_ID,
    adapterKind: 'local-runtime',
    adapterVersion: LOCAL_RUNTIME_OBSERVER_VERSION,
    discover: async (context = {}) => {
      latest = discoverLocalRuntime({ ...options, ...context });
      return latest;
    },
    observe: async (candidate) => latest?.candidates?.find((entry) => entry.candidateId === candidate?.candidateId) ?? null,
    verifyRelationship: async ({ sourceId, targetId } = {}) => ({
      relationId: `relationship:${sourceId ?? 'unknown'}:${targetId ?? 'unknown'}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
      sourceId: sourceId ?? null,
      targetId: targetId ?? null,
      state: 'unknown',
      provenance: { source: 'local-runtime-observer', readOnly: true, authority: 'local-observation' },
    }),
  });
}
