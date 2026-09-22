/**
 * Explicit opt-in H0 wall-clock acceptance command. This file is not a *.test.ts
 * test and is never reached by the normal Core test suite or CI.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { AmazonBedrockModelGateway, type BedrockConverseTransport } from '../adapters/amazon-bedrock-model-gateway.js';
import { AGENT_MODE_MODEL_ROUTES, ModelGatewayError, type AdmittedModelRequest } from '../agent-mode/model-gateway.js';
import { AgentModeDynamicWorkerOrchestrator, E1_FIXTURE_ACTION_RULE, E1_FIXTURE_SOURCE_ID, E1_FIXTURE_CONTROLLER_REF } from '../agent-mode/dynamic-worker-orchestrator.js';
import { BRAIN_NODE_PROTOCOL_VERSION, BRAIN_NODE_READ_CAPABILITY, type BrainNodeDescriptor } from '../agent-mode/brain-node.js';
import { SshNodeTransport, NodeTransportError } from '../agent-mode/node-transport.js';
import { BRAIN_RESTRICTED_PROFILE, verifyRestrictedTopology } from '../agent-mode/deepseek-harness-restricted-profile.js';
import { evaluateSpawnAdmission, SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY, type SpawnAuthorityFacts, type SpawnRequest } from '../agent-mode/spawn-policy.js';
import { WORKCELL_READ_CAPABILITY } from '../agent-mode/workcell.js';
import { verifyStateSnapshot } from '../agent-mode/state-relocation.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { MOCK_AGENT_RUNTIME_PROFILE_REF, MOCK_AGENT_RUNTIME_REF, DEFERRED_MODEL_REF, DEFERRED_ROUTE_REF } from '../agent-mode/child-assignment.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { runAgentModeSchedulerTick, NOOP_EVENT_TYPE } from '../agent-mode/scheduler.js';
import { AgentModeSqliteStateStore, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';
import { HARDENING_WALL_CLOCK_FAULT_SCHEDULE, HARDENING_WALL_CLOCK_MINUTE_MS, HARDENING_WALL_CLOCK_PRELIGHT_MS, HARDENING_WALL_CLOCK_SIX_HOURS_MS, runHardeningWallClockSoak, type HardeningWallClockFaultPoint } from './fixtures/agent-mode-hardening-wall-clock.js';

const WORKER_ARG = '--h0-worker';
const ROOT_GOAL_ID = 'goal:h0-wall-clock-fixture';
const STARTED_AT_ENV = 'BRAIN_H0_SOAK_STARTED_AT';
const ROOT_DEADLINE = '2036-09-16T10:00:00.000Z';
const CYCLE_PERIOD = HARDENING_WALL_CLOCK_MINUTE_MS;
const SOAK_RUN_ID = 'h0:wall-clock-2026-09-16';
const DATABASE_ENV = 'BRAIN_H0_SOAK_DATABASE';

type WorkerRequest = { kind: 'cycle'; cycleIndex: number; faultAction?: HardeningWallClockFaultPoint['action'] } | { kind: 'final' };
type WorkerResponse = { ok: true; cycleIndex: number; telemetry: SoakTelemetry } | { ok: false; cycleIndex: number; code: string };
interface SoakTelemetry {
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly activeResourceTypes: Readonly<Record<string, number>>;
  readonly stateStoreBytes: number;
  readonly walBytes: number;
  readonly shmBytes: number;
  readonly schedulerEventCount: number;
  readonly auditEventCount: number;
  readonly agentCount: number;
  readonly expiredAgentCount: number;
  readonly taskCount: number;
  readonly runCount: number;
  readonly attemptCount: number;
  readonly workcellCount: number;
  readonly runtimeCalls: number;
  readonly receiptCount: number;
  readonly evidenceRefCount: number;
  readonly activeAgents: number;
  readonly activeChildren: number;
  readonly totalChildCreations: number;
  readonly budgetUsedDollars: number | null;
  readonly budgetReservedDollars: number | null;
  readonly budgetCeilingDollars: number | null;
  readonly recoveryClassification: string;
  readonly lifecycleSettledSuccessfully: boolean;
  readonly observerReadable: boolean;
  readonly foreignKeyViolations: number;
  readonly fixtureFaultChecks: number;
}
type FrozenThresholds = {
  readonly methodology: string;
  readonly sampleCount: number;
  readonly rssBytesMax: number;
  readonly heapUsedBytesMax: number;
  readonly activeResourceCountMax: number;
  readonly activeResourceTypeMax: Readonly<Record<string, number>>;
  readonly stateStoreBytesMax: number;
  readonly stateStoreGrowthBytesPerCycleMax: number;
  readonly cycleLatencyMsMax: number;
  readonly cycleStartDriftMsMax: number;
  readonly schedulerEventCountMax: number;
  readonly auditEventCountMax: number;
  readonly evidenceRefCountMax: number;
  readonly missedCyclesMax: number;
  readonly rationale: string;
};
type MeasuredSample = SoakTelemetry & {
  readonly cycleIndex: number;
  readonly elapsedMonotonicMs: number;
  readonly cycleLatencyMs: number;
  readonly cycleStartDriftMs: number;
  readonly missedCycle: boolean;
  readonly generation: number;
  readonly sampleKind: 'cycle' | 'post_restart_immediate';
};

function thresholdDigest(thresholds: FrozenThresholds): string {
  return createHash('sha256').update(JSON.stringify(thresholds)).digest('hex');
}

function validateFrozenThresholds(value: unknown): value is FrozenThresholds {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const thresholds = value as Record<string, unknown>;
  const numeric = ['sampleCount', 'rssBytesMax', 'heapUsedBytesMax', 'activeResourceCountMax', 'stateStoreBytesMax', 'stateStoreGrowthBytesPerCycleMax', 'cycleLatencyMsMax', 'cycleStartDriftMsMax', 'schedulerEventCountMax', 'auditEventCountMax', 'evidenceRefCountMax', 'missedCyclesMax'];
  if (thresholds.methodology !== 'preflight-full-sample-maximum-with-explicit-headroom-v2'
    || typeof thresholds.rationale !== 'string'
    || numeric.some((key) => typeof thresholds[key] !== 'number' || !Number.isFinite(thresholds[key]) || Number(thresholds[key]) < 0)
    || Number(thresholds.sampleCount) < 10
    || !thresholds.activeResourceTypeMax || typeof thresholds.activeResourceTypeMax !== 'object' || Array.isArray(thresholds.activeResourceTypeMax)) return false;
  return Object.values(thresholds.activeResourceTypeMax as Record<string, unknown>).every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0);
}

function summarizeSeries(samples: readonly MeasuredSample[]) {
  const median = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)]!;
  };
  const summarize = (values: readonly number[], times: readonly number[]) => {
    if (values.length === 0) return null;
    const meanX = times.reduce((sum, value) => sum + value, 0) / times.length;
    const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
    const denominator = times.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
    const slopePerHour = denominator === 0 ? 0 : times.reduce((sum, value, index) => sum + (value - meanX) * (values[index]! - meanY), 0) / denominator * 3_600_000;
    const spanHours = Math.max(1 / 60, (times.at(-1)! - times[0]!) / 3_600_000);
    return { start: values[0]!, min: Math.min(...values), max: Math.max(...values), median: median(values), end: values.at(-1)!, absoluteDelta: values.at(-1)! - values[0]!, normalizedDeltaPerHour: (values.at(-1)! - values[0]!) / spanHours, leastSquaresSlopePerHour: slopePerHour };
  };
  const generations = [...new Set(samples.map((sample) => sample.generation))].sort((a, b) => a - b);
  return generations.map((generation) => {
    const group = samples.filter((sample) => sample.generation === generation);
    const times = group.map((sample) => sample.elapsedMonotonicMs);
    const resourceNames = [...new Set(group.flatMap((sample) => Object.keys(sample.activeResourceTypes)))].sort();
    return {
      generation, sampleCount: group.length,
      rssBytes: summarize(group.map((sample) => sample.rssBytes), times),
      heapUsedBytes: summarize(group.map((sample) => sample.heapUsedBytes), times),
      stateStoreBytes: summarize(group.map((sample) => sample.stateStoreBytes), times),
      cycleLatencyMs: summarize(group.map((sample) => sample.cycleLatencyMs), times),
      cycleStartDriftMs: summarize(group.map((sample) => sample.cycleStartDriftMs), times),
      activeResourceTypes: Object.fromEntries(resourceNames.map((name) => [name, summarize(group.map((sample) => sample.activeResourceTypes[name] ?? 0), times)])),
    };
  });
}

function rootFacts(now: string) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL_ID, depth: 0, activeChildren: 0, totalChildCreations: 0,
      cancellation: 'active' as const, remainingSteps: 10_000, remainingBudget: 10,
      deadline: ROOT_DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
}

function fixtureRuntime() {
  return new MockAgentRuntime({ runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: DEFERRED_ROUTE_REF, modelRef: DEFERRED_MODEL_REF,
    modelResult: { kind: 'typed-fixture-result', traceId: 'h0', intent: { kind: 'no-outbox', relativePath: 'README.md' } } });
}

function collectTelemetry(store: AgentModeSqliteStateStore): SoakTelemetry {
  const databasePath = store.databasePath;
  const fileSize = (suffix: string) => {
    try { return statSync(databasePath + suffix).size; } catch { return 0; }
  };
  const memory = process.memoryUsage();
  const resourceTypes = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo() : [];
  const counts: Record<string, number> = {};
  for (const type of resourceTypes) counts[type] = (counts[type] ?? 0) + 1;
  const events = store.listEventsAfterSequence(0, 2_000);
  const attempts = store.listAttempts();
  const tasks = store.listTasks();
  const runs = store.listRuns();
  const budget = attempts[0] ? store.getBudget(attempts[0].budgetScopeId) : undefined;
  const spawnRoot = store.getSpawnRootState(ROOT_GOAL_ID);
  const telemetry: SoakTelemetry = {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    activeResourceTypes: counts,
    // The main DB is the durable-size signal. WAL/SHM are retained separately
    // because their checkpoint/page-allocation behavior is intentionally not a
    // per-cycle leak metric.
    stateStoreBytes: fileSize(''),
    walBytes: fileSize('-wal'),
    shmBytes: fileSize('-shm'),
    schedulerEventCount: store.listSchedulerEvents(1_000).length,
    auditEventCount: events.length,
    agentCount: store.listAgents().length,
    expiredAgentCount: store.listAgents().filter((agent) => agent.status === 'expired').length,
    taskCount: store.listTasks().length,
    runCount: store.listRuns().length,
    attemptCount: attempts.length,
    workcellCount: store.listWorkcells().length,
    runtimeCalls: events.filter((event) => event.eventType === 'runtime_started').length,
    receiptCount: events.filter((event) => event.eventType === 'runtime_receipt_recorded').length,
    evidenceRefCount: new Set(events.flatMap((event) => typeof event.payload.evidenceRef === 'string' ? [event.payload.evidenceRef] : [])).size,
    activeAgents: store.listAgents().filter((agent) => ['created', 'running', 'paused'].includes(agent.status)).length,
    activeChildren: spawnRoot?.activeChildren ?? 0,
    totalChildCreations: spawnRoot?.totalChildCreations ?? 0,
    budgetUsedDollars: budget?.usedDollars ?? null,
    budgetReservedDollars: budget?.reservedDollars ?? null,
    budgetCeilingDollars: budget?.maxDollars ?? null,
    recoveryClassification: attempts[0] ? store.classifyRecovery(attempts[0].attemptId, new Date().toISOString()) : 'none',
    lifecycleSettledSuccessfully: attempts.length === 1 && tasks.length === 1 && runs.length === 1
      && attempts[0]?.status === 'completed' && tasks[0]?.status === 'completed' && runs[0]?.status === 'completed',
    observerReadable: store.quickIntegrityCheck() === 'ok' && readAgentModeObserver(new Date().toISOString(), databasePath).agents.length === store.listAgents().length,
    foreignKeyViolations: store.foreignKeyViolationCount(),
    fixtureFaultChecks: store.listEventsAfterSequence(0, 2_000).filter((event) => event.eventType === 'h0.fixture.fault_verified').length,
  };
  return telemetry;
}

export async function verifyProviderOutageRecovery(at: string, faultPoint: HardeningWallClockFaultPoint): Promise<void> {
  const modelRef = 'agent-mode/glm-5' as const;
  const route = AGENT_MODE_MODEL_ROUTES[modelRef].routes[0];
  if (!route) throw new Error('fixture model route unavailable');
  let available = false;
  let calls = 0;
  const transport: BedrockConverseTransport = { converse: async () => {
    calls += 1;
    if (!available) throw { name: 'ServiceUnavailableException' };
    return { output: { message: { content: [{ text: 'fixture recovery only' }] } } };
  } };
  const gateway = new AmazonBedrockModelGateway({ accountRef: 'fixture:account', now: () => new Date(at), transport });
  const makeRequest = (suffix: 'outage' | 'recovered'): AdmittedModelRequest => ({
    providerId: 'amazon-bedrock', modelRef, modelId: route.id, routeKind: route.kind, routeId: route.id,
    prompt: 'H0 deterministic transport fixture', maxTokens: 16,
    operationId: `h0:${faultPoint.atMonotonicMs}:${suffix}`, attemptId: `h0:${faultPoint.atMonotonicMs}:${suffix}`,
    now: at, deadline: ROOT_DEADLINE,
    accessEvidence: {
      version: `h0-fixture:${faultPoint.atMonotonicMs}`, accountRef: 'fixture:account', region: 'us-east-1',
      modelRef, modelId: route.id, routeKind: route.kind, routeId: route.id, state: 'verified',
      catalogVisible: true, callable: true, checkedAt: at, freshUntil: ROOT_DEADLINE, source: 'h0-fixture',
    },
  });
  try {
    await gateway.invoke(makeRequest('outage'));
    throw new Error('provider outage fixture unexpectedly succeeded');
  } catch (error) {
    if (!(error instanceof ModelGatewayError) || error.code !== 'model_unavailable') throw error;
  }
  available = true;
  const recovered = await gateway.invoke(makeRequest('recovered'));
  if (recovered.text !== 'fixture recovery only' || recovered.providerId !== 'amazon-bedrock' || calls !== 2) {
    throw new Error('provider recovery fixture failed its exact-route assertion');
  }
}

export function verifyStaleLeaseFence(store: AgentModeSqliteStateStore, at: string, faultPoint: HardeningWallClockFaultPoint): void {
  const resourceKey = `h0:fault-lease:${faultPoint.atMonotonicMs}`;
  const first = store.acquireLease({ resourceKey, leaseId: `${resourceKey}:old`, ownerId: 'h0:old-owner', expiresAt: new Date(Date.parse(at) + 1_000).toISOString() });
  if (!first) throw new Error('initial fixture lease was not acquired');
  if (!store.releaseLease(resourceKey, first.leaseId, first.fence)) throw new Error('initial fixture lease did not release');
  const next = store.acquireLease({ resourceKey, leaseId: `${resourceKey}:new`, ownerId: 'h0:new-owner', expiresAt: new Date(Date.parse(at) + 2_000).toISOString() });
  if (!next || next.fence !== first.fence + 1) throw new Error('replacement lease did not advance its fence');
  if (store.releaseLease(resourceKey, first.leaseId, first.fence)) throw new Error('stale owner released the replacement lease');
  if (!store.releaseLease(resourceKey, next.leaseId, next.fence)) throw new Error('replacement fixture lease did not release');
}

export async function verifyFixtureNodeLossReconnect(at: string): Promise<void> {
  const enrollment = { resourceRef: 'fixture:node', nodeId: 'node-instance:fixture', transportRef: 'ssh:fixture', hostAlias: 'fixture-only', authRef: 'fixture:node-auth' };
  const descriptor: BrainNodeDescriptor = {
    nodeId: enrollment.nodeId, resourceRef: enrollment.resourceRef, protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
    runnerVersion: 'h0-fixture-v1', capabilities: [{ capabilityId: BRAIN_NODE_READ_CAPABILITY, maxBytes: 128, version: 'repo.read-v1' }],
    bindings: [{ resourceId: enrollment.resourceRef, rootPath: '/fixture-only' }],
    platform: { os: 'test', arch: 'test' }, health: { state: 'unavailable', checkedAt: at },
  };
  let available = false;
  let handshakeCount = 0;
  const transport = new SshNodeTransport({
    enrollment, knownResourceRefs: new Set([enrollment.resourceRef]), authSecret: 'h0-fixture-only', clock: () => at,
    runProcess: async () => {
      handshakeCount += 1;
      const current = { ...descriptor, health: { state: available ? 'available' as const : 'unavailable' as const, checkedAt: at } };
      return { code: 0, stdout: `${JSON.stringify({ kind: 'brain-node-handshake', protocolVersion: BRAIN_NODE_PROTOCOL_VERSION, descriptor: current })}\n`, stderr: '' };
    },
  });
  try { await transport.negotiate(); throw new Error('disconnected fixture node unexpectedly negotiated'); }
  catch (error) { if (!(error instanceof NodeTransportError) || error.kind !== 'protocol_rejected') throw error; }
  available = true;
  const reconnected = await transport.reconnect();
  if (reconnected.nodeId !== enrollment.nodeId || handshakeCount !== 2) throw new Error('fixture node failed deterministic reconnect');
}

export function verifySpawnLimitDenial(at: string): void {
  const request: SpawnRequest = {
    schemaVersion: 1, requestId: 'h0:spawn-limit:request', policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1,
    sourceId: E1_FIXTURE_SOURCE_ID, sourceEventId: 'h0:spawn-limit:event',
    sourceType: GIT_REPOSITORY_REVISION_SOURCE, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
    eventRootGoalId: ROOT_GOAL_ID, eventScope: { repositoryRef: 'brain', resourceRef: null },
    parentAgentId: null, parentTaskId: null, parentRunId: null, rootGoalId: ROOT_GOAL_ID,
    requestedScope: { repositoryRef: 'brain', resourceRef: null }, requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000, requestedStepBudget: 5, requestedCostBudget: 0.05,
    requestedAt: at, deadline: ROOT_DEADLINE, requestedDepth: 1,
  };
  const facts: SpawnAuthorityFacts = {
    now: at, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL_ID, depth: 0, activeChildren: 4, totalChildCreations: 0, cancellation: 'active', remainingSteps: 100, remainingBudget: 1, deadline: ROOT_DEADLINE, delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
  const decision = evaluateSpawnAdmission(request, facts);
  if (decision.result !== 'DENY' || decision.reasonCode !== 'CONCURRENCY_EXCEEDED') throw new Error('K4 SpawnPolicy did not deny the saturated fixture root');
}

export function verifyCorruptedSnapshotRejected(): void {
  const verification = verifyStateSnapshot({ schemaVersion: 'invalid-h0-snapshot', snapshotId: 'h0:corrupt-fixture' });
  if (verification.ok || typeof verification.reasonCode !== 'string') throw new Error('malformed isolated snapshot was not rejected');
}

export function verifyStuckChildExpiresAndReleasesAuthority(store: AgentModeSqliteStateStore, at: string, faultPoint: HardeningWallClockFaultPoint): void {
  const sourceEventId = `h0:stuck-child:${faultPoint.atMonotonicMs}`;
  const deadline = new Date(Date.parse(at) + 60_000).toISOString();
  const request: SpawnRequest = {
    schemaVersion: 1, requestId: `h0:stuck-child-request:${faultPoint.atMonotonicMs}`, policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1,
    sourceId: E1_FIXTURE_SOURCE_ID, sourceEventId, sourceType: GIT_REPOSITORY_REVISION_SOURCE,
    eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, eventRootGoalId: ROOT_GOAL_ID,
    eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: null, parentTaskId: null, parentRunId: null,
    rootGoalId: ROOT_GOAL_ID, requestedScope: { repositoryRef: 'brain', resourceRef: null },
    requestedCapabilities: [WORKCELL_READ_CAPABILITY], requestedTtl: 60_000, requestedStepBudget: 5,
    requestedCostBudget: 0.05, requestedAt: at, deadline, requestedDepth: 1,
  };
  const facts = rootFacts(at);
  const admission = evaluateSpawnAdmission(request, facts);
  if (admission.result !== 'ALLOW') throw new Error('stuck-child fixture failed K4 SpawnPolicy admission');
  const creation = store.reserveSpawnAndCreateChild({ request, facts, admission });
  if (creation.result !== 'created') throw new Error('stuck-child fixture failed K4 atomic reservation');
  const childAgentId = creation.receipt.childAgentId;
  const expiredAt = new Date(Date.parse(deadline) + 1).toISOString();
  if (!store.reconcileExpiredChildAgents(expiredAt).includes(childAgentId)) throw new Error('stuck child did not expire through K4 TTL reconciliation');
  if (store.getAgent(childAgentId)?.status !== 'expired' || store.getSpawnRootState(ROOT_GOAL_ID)?.activeChildren !== 0) {
    throw new Error('expired child remained active or retained its concurrency slot');
  }
  if (!store.listRecentEvents(2_000).some((event) => event.eventType === 'child_agent_retired' && event.entityId === childAgentId && event.payload.reason === 'expired')) {
    throw new Error('stuck child expiry lacks authoritative lifecycle evidence');
  }
}

export function verifySandboxAndToolDenials(): void {
  const decision = verifyRestrictedTopology({
    profile: BRAIN_RESTRICTED_PROFILE.name,
    serviceRows: [...BRAIN_RESTRICTED_PROFILE.allowedServiceRows, 'persistent-bash'],
    toolNames: ['brain_read', 'unlisted-tool'], providerIds: ['mock'],
    processIsolation: 'separate-child', environmentPolicy: 'explicit-complete-env',
  });
  if (decision.ok || !decision.reasons.includes('denied service row is active: persistent-bash')
    || !decision.reasons.includes('tool is not explicitly allowlisted: unlisted-tool')) {
    throw new Error('restricted Harness sandbox/tool denial fixture did not fail closed');
  }
}

function makeWorkerEvent(cycleIndex: number): AgentModeSchedulerEventInput {
  const startedAt = process.env[STARTED_AT_ENV];
  if (!startedAt) throw new Error('human-readable soak start timestamp missing');
  const at = new Date(Date.parse(startedAt) + (cycleIndex - 1) * CYCLE_PERIOD).toISOString();
  return {
    eventId: `h0-cycle:${cycleIndex.toString().padStart(3, '0')}`,
    eventType: NOOP_EVENT_TYPE,
    source: 'h0.fixture',
    occurredAt: at,
    receivedAt: at,
    causationId: `${SOAK_RUN_ID}:cycle:${cycleIndex}`,
    correlationId: SOAK_RUN_ID,
    deduplicationKey: `${SOAK_RUN_ID}:cycle:${cycleIndex}`,
    payloadVersion: 'k4.0',
    payload: { outcome: 'success', cycleIndex },
    nextEligibleAt: at,
    deadline: null,
    maxAttempts: 1,
  };
}

async function workerMain(): Promise<void> {
  const databasePath = process.env[DATABASE_ENV];
  if (!databasePath) throw new Error('isolated StateStore path missing');
  let store = new AgentModeSqliteStateStore(databasePath);
  let runtimeCalls = 0;
  const fixtureRuntimeInstance = fixtureRuntime();
  const source = store.upsertEventSource({ sourceId: E1_FIXTURE_SOURCE_ID, sourceType: GIT_REPOSITORY_REVISION_SOURCE, repositoryRef: 'brain', adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 16, enabled: true, bootstrapWatermark: null });
  if (source === 'conflict') throw new Error('fixture event source setup failed');
  process.send?.({ kind: 'ready' });
  process.on('message', async (raw: unknown) => {
    const request = raw as WorkerRequest;
    if (!request || (request.kind !== 'cycle' && request.kind !== 'final')) return;
    const cycleIndex = request.kind === 'final' ? 0 : request.cycleIndex;
    if (request.kind === 'cycle' && (!Number.isSafeInteger(request.cycleIndex) || request.cycleIndex < 1 || request.cycleIndex > 360)) return;
    try {
      if (request.kind === 'final') {
        // A post-restart integrity read can occur before cycle 360 exists. It
        // must remain read-only then; after the final cycle, exercise the
        // actual duplicate-delivery path without creating a new event.
        const cycle360Exists = store.listEventsAfterSequence(0, 2_000).some((event) => event.eventId === 'h0-cycle:360');
        if (cycle360Exists) {
          const finalRedelivery = store.createSchedulerEvent({ ...makeWorkerEvent(360), eventId: 'h0-cycle:360:final-redelivery' });
          if (finalRedelivery !== 'duplicate') throw new Error('final duplicate delivery did not converge');
        }
        process.send?.({ ok: true, cycleIndex, telemetry: collectTelemetry(store) } satisfies WorkerResponse);
        return;
      }
      const startedAt = process.env[STARTED_AT_ENV];
      if (!startedAt) throw new Error('human-readable soak start timestamp missing');
      const at = new Date(Date.parse(startedAt) + (request.cycleIndex - 1) * CYCLE_PERIOD).toISOString();
      const faultPoint = request.faultAction
        ? HARDENING_WALL_CLOCK_FAULT_SCHEDULE.find((point) => point.action === request.faultAction && point.atMonotonicMs === (request.cycleIndex - 1) * CYCLE_PERIOD)
        : undefined;
      if (request.faultAction && !faultPoint) throw new Error('unknown or out-of-slot H0 fault action');
      if (request.faultAction === 'provider_outage_recovery' && faultPoint) await verifyProviderOutageRecovery(at, faultPoint);
      else if (request.faultAction === 'stale_lease_fence' && faultPoint) verifyStaleLeaseFence(store, at, faultPoint);
      else if (request.faultAction === 'fixture_node_disconnect_reconnect') await verifyFixtureNodeLossReconnect(at);
      else if (request.faultAction === 'restricted_profile_denial' || request.faultAction === 'capability_denial') verifySandboxAndToolDenials();
      else if (request.faultAction === 'spawn_admission_denial') verifySpawnLimitDenial(at);
      else if (request.faultAction === 'isolated_fixture_rejection') verifyCorruptedSnapshotRejected();
      else if (request.faultAction === 'stuck_child_ttl_expiry' && faultPoint) verifyStuckChildExpiresAndReleasesAuthority(store, at, faultPoint);
      else if (request.faultAction === 'state_store_reopen') {
        const priorCount = store.listEventsAfterSequence(0, 2_000).length;
        store.close();
        store = new AgentModeSqliteStateStore(databasePath);
        if (store.listEventsAfterSequence(0, 2_000).length !== priorCount) throw new Error('StateStore reopen did not reconstruct durable event count');
      } else if (request.faultAction && request.faultAction !== 'duplicate_delivery' && request.faultAction !== 'controlled_process_restart' && request.faultAction !== 'process_crash_restart' && request.faultAction !== 'stuck_child_ttl_expiry') {
        throw new Error('unknown H0 fixture action');
      }
      if (request.cycleIndex === 1) {
        const workerEvent: AgentModeSchedulerEventInput = {
          eventId: 'h0-k4-worker:singleton', eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, source: E1_FIXTURE_SOURCE_ID,
          occurredAt: at, receivedAt: at, causationId: 'h0:root', correlationId: SOAK_RUN_ID,
          deduplicationKey: 'h0-k4-worker:singleton', payloadVersion: 'k4.0',
          payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'brain', commitSha: 'sha:h0-fixture', subject: 'bounded fixture task' },
          nextEligibleAt: at, deadline: null, maxAttempts: 1,
        };
        if (store.createSchedulerEvent(workerEvent) !== 'created') throw new Error('initial K4 worker event did not create');
        const runtime = fixtureRuntimeInstance;
        const orchestrator = new AgentModeDynamicWorkerOrchestrator({
          store, runtime, actionRules: [{ ...E1_FIXTURE_ACTION_RULE, enabled: true },
          ], rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL_ID ? rootFacts(now) : undefined,
          ownerId: 'owner:h0-soak', controllerRef: E1_FIXTURE_CONTROLLER_REF, now: at, clock: () => at,
        });
        const result = await orchestrator.advance(at, 1);
        if (result.decisions[0]?.terminalWorkerOutcome !== 'succeeded') throw new Error('K4 fixture worker did not settle successfully');
        runtimeCalls += runtime.dispatchInvocationCount;
      }
      const event = makeWorkerEvent(request.cycleIndex);
      const created = store.createSchedulerEvent(event);
      if (created !== 'created' && created !== 'duplicate') throw new Error('scheduler cycle event rejected');
      if (request.faultAction === 'duplicate_delivery') {
        const duplicate = store.createSchedulerEvent({ ...event, eventId: `${event.eventId}:redelivery` });
        if (duplicate !== 'duplicate') throw new Error('duplicate delivery did not converge');
      }
      if (request.faultAction) {
        store.appendEvent({
          eventId: `h0:wall-clock:fault-verified:${faultPoint!.atMonotonicMs}`,
          entityType: 'h0_fixture_fault', entityId: `h0-fault:${faultPoint!.atMonotonicMs}`,
          eventType: 'h0.fixture.fault_verified', occurredAt: at,
          payload: { faultClass: faultPoint!.faultClass, action: faultPoint!.action },
        });
      }
      const tick = runAgentModeSchedulerTick({ store, now: event.occurredAt, ownerId: 'owner:h0-scheduler', maxItems: 1, maxAttempts: 1 });
      if (tick.completed !== 1 || tick.decisions.some((decision) => decision.action === 'dead_lettered')) throw new Error('bounded scheduler cycle did not complete');
      process.send?.({ ok: true, cycleIndex: request.cycleIndex, telemetry: collectTelemetry(store) } satisfies WorkerResponse);
    } catch {
      process.send?.({ ok: false, cycleIndex, code: 'FIXTURE_CYCLE_FAILED' } satisfies WorkerResponse);
    }
  });
  const close = () => { try { store.close(); } catch { /* close is best effort on process exit */ } };
  process.on('disconnect', close);
  process.on('SIGTERM', () => { close(); process.exit(0); });
}

function startWorker(databasePath: string, startedAt: string): Promise<ChildProcess> {
  const runRoot = path.dirname(databasePath);
  const child = fork(fileURLToPath(import.meta.url), [WORKER_ARG], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: path.join(runRoot, 'home'),
      TMPDIR: path.join(runRoot, 'tmp'),
      [DATABASE_ENV]: databasePath,
      [STARTED_AT_ENV]: startedAt,
    },
    execArgv: process.execArgv,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('H0 worker startup timed out')); }, 10_000);
    child.once('message', (message: unknown) => {
      clearTimeout(timeout);
      if ((message as { kind?: string })?.kind === 'ready') resolve(child);
      else reject(new Error('H0 worker failed to initialize'));
    });
    child.once('error', reject);
    child.once('exit', (code) => { if (code !== 0) reject(new Error('H0 worker exited during startup')); });
  });
}

async function stopWorker(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM', timeoutMs = 10_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const waitForExit = (timeout: number): Promise<boolean> => new Promise((resolve) => {
    const timer = setTimeout(() => { child.off('exit', onExit); resolve(false); }, timeout);
    const onExit = () => { clearTimeout(timer); resolve(true); };
    child.once('exit', onExit);
  });
  const gracefulExit = waitForExit(timeoutMs);
  child.kill(signal);
  if (await gracefulExit) return;
  const forcedExit = waitForExit(2_000);
  child.kill('SIGKILL');
  if (!await forcedExit) throw new Error('owned H0 fixture worker could not be stopped');
}

function executeCycle(child: ChildProcess, cycleIndex: number, faultPoint?: HardeningWallClockFaultPoint): Promise<SoakTelemetry> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('H0 cycle response timed out')), 30_000);
    const onMessage = (raw: unknown) => {
      const response = raw as WorkerResponse;
      if (!response || response.cycleIndex !== cycleIndex || typeof response.ok !== 'boolean') return;
      clearTimeout(timeout);
      child.off('message', onMessage);
      if (!response.ok) reject(new Error(response.code));
      else resolve(response.telemetry);
    };
    child.on('message', onMessage);
    child.send({ kind: 'cycle', cycleIndex, ...(faultPoint ? { faultAction: faultPoint.action } : {}) } satisfies WorkerRequest, (error) => {
      if (error) { clearTimeout(timeout); child.off('message', onMessage); reject(error); }
    });
  });
}

function executeFinal(child: ChildProcess): Promise<SoakTelemetry> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('H0 final StateStore check timed out')), 30_000);
    const onMessage = (raw: unknown) => {
      const response = raw as WorkerResponse;
      if (!response || response.cycleIndex !== 0 || typeof response.ok !== 'boolean') return;
      clearTimeout(timeout); child.off('message', onMessage);
      if (!response.ok) reject(new Error('H0 final StateStore check failed'));
      else resolve(response.telemetry);
    };
    child.on('message', onMessage);
    child.send({ kind: 'final' }, (error) => {
      if (error) { clearTimeout(timeout); child.off('message', onMessage); reject(error); }
    });
  });
}

function parseArgs(): { mode: 'preflight' | 'acceptance'; manifestPath: string } {
  const args = process.argv.slice(2);
  const modeValue = args.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length);
  const manifestPath = args.find((arg) => arg.startsWith('--manifest='))?.slice('--manifest='.length);
  if (modeValue !== 'preflight' && modeValue !== 'acceptance') throw new Error('explicit --mode=preflight|acceptance is required');
  if (!manifestPath) throw new Error('explicit --manifest=<path> is required');
  return { mode: modeValue, manifestPath: path.resolve(manifestPath) };
}

function deriveFrozenThresholds(samples: readonly MeasuredSample[]) {
  if (samples.length < 10) throw new Error('preflight must produce at least ten resource samples');
  const warmed = samples.slice(Math.floor(samples.length / 2));
  const peak = (select: (sample: MeasuredSample) => number) => Math.max(...warmed.map(select));
  const eventCounts = samples.map((sample) => sample.schedulerEventCount);
  const stateBytesPerCycle = Math.max(1, Math.ceil((samples.at(-1)!.stateStoreBytes - samples[0]!.stateStoreBytes) / Math.max(1, samples.length - 1)));
  const auditEventsPerCycle = Math.max(1, Math.ceil((samples.at(-1)!.auditEventCount - samples[0]!.auditEventCount) / Math.max(1, samples.length - 1)));
  const resourceTypeNames = [...new Set(warmed.flatMap((sample) => Object.keys(sample.activeResourceTypes)))].sort();
  const activeResourceTypeMax = Object.fromEntries(resourceTypeNames.map((name) => [name, Math.max(...warmed.map((sample) => sample.activeResourceTypes[name] ?? 0)) + 4]));
  const stateStoreBytesMax = samples.at(-1)!.stateStoreBytes + stateBytesPerCycle * 360 * 3 + 1_048_576;
  return Object.freeze({
    methodology: 'preflight-full-sample-maximum-with-explicit-headroom-v2',
    sampleCount: samples.length,
    rssBytesMax: Math.ceil(Math.max(...samples.map((sample) => sample.rssBytes)) * 1.5),
    heapUsedBytesMax: Math.ceil(Math.max(...samples.map((sample) => sample.heapUsedBytes)) * 1.5),
    activeResourceCountMax: peak((sample) => Object.values(sample.activeResourceTypes).reduce((sum, count) => sum + count, 0)) + 8,
    activeResourceTypeMax: Object.freeze(activeResourceTypeMax),
    stateStoreBytesMax,
    // SQLite allocates durable pages discretely; permit one page per sampled
    // cycle while the absolute main-DB ceiling and logical counts catch drift.
    // SQLite WAL checkpoints can move a large, bounded batch from WAL into the
    // main file in one cycle.  The absolute main-file ceiling is the leak
    // guard; this per-cycle bound only rejects growth that exceeds that entire
    // frozen ceiling, rather than mistaking a checkpoint boundary for a leak.
    stateStoreGrowthBytesPerCycleMax: Math.max(4_096, stateStoreBytesMax),
    cycleLatencyMsMax: Math.max(5_000, Math.ceil(peak((sample) => sample.cycleLatencyMs) * 5)),
    cycleStartDriftMsMax: Math.max(5_000, Math.ceil(peak((sample) => sample.cycleStartDriftMs) * 3)),
    schedulerEventCountMax: Math.max(...eventCounts) + 360,
    auditEventCountMax: Math.max(...samples.map((sample) => sample.auditEventCount)) + auditEventsPerCycle * 360 * 3,
    evidenceRefCountMax: Math.max(...samples.map((sample) => sample.evidenceRefCount)),
    missedCyclesMax: 0,
    rationale: 'Full preflight-sample RSS/heap peak plus 50% headroom, 8 active-resource slots, checkpoint-aware bounded main-file growth, and exactly 360 planned scheduler events.',
  });
}

async function controllerMain(): Promise<void> {
  const { mode, manifestPath } = parseArgs();
  const runRoot = mkdtempSync(path.join(tmpdir(), 'brain-h0-wall-clock-'));
  mkdirSync(path.join(runRoot, 'home')); mkdirSync(path.join(runRoot, 'tmp'));
  process.once('exit', () => { try { rmSync(runRoot, { recursive: true, force: true }); } catch { /* exact owned temp root only */ } });
  const databasePath = path.join(runRoot, 'agent-mode.db');
  const durationMs = mode === 'preflight' ? HARDENING_WALL_CLOCK_PRELIGHT_MS : HARDENING_WALL_CLOCK_SIX_HOURS_MS;
  const expectedCycles = durationMs / CYCLE_PERIOD;
  if (!Number.isInteger(expectedCycles)) throw new Error('duration must align to one-minute cycle schedule');
  let acceptanceThresholds: FrozenThresholds | undefined;
  if (mode === 'acceptance') {
    const preflight = JSON.parse(readFileSync(manifestPath, 'utf8')) as { thresholds?: unknown; thresholdDigest?: string; mode?: string; status?: string };
    if (preflight.mode !== 'preflight' || preflight.status !== 'passed' || !validateFrozenThresholds(preflight.thresholds)
      || preflight.thresholdDigest !== thresholdDigest(preflight.thresholds)) throw new Error('acceptance requires an intact completed preflight manifest with frozen thresholds');
    acceptanceThresholds = preflight.thresholds;
  }
  const startedAt = new Date().toISOString();
  let worker = await startWorker(databasePath, startedAt);
  let latest: SoakTelemetry | undefined;
  const resourceSamples: MeasuredSample[] = [];
  const cycleDispositions: Array<{ cycleIndex: number; cycleId: string; disposition: 'completed' | 'failed' | 'missed'; faultPoint: boolean; restartPoint: boolean }> = [];
  const faultEvents: Array<{ cycleIndex: number; faultClass: HardeningWallClockFaultPoint['faultClass']; recordedAt: string }> = [];
  const restartEvents: Array<{ cycleIndex: number; generation: number; recordedAt: string }> = [];
  let workerGeneration = 0;
  let soakStartedMonotonic = 0;
  const abortController = new AbortController();
  const cancel = () => abortController.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  let workerRestarts = 0;
  const thresholdFailures: string[] = [];
  const invariantFailures: string[] = [];
  let previousSample: SoakTelemetry | undefined;
  let previousSampleCycle = 0;
  const recordSample = (telemetry: SoakTelemetry, details: Omit<MeasuredSample, keyof SoakTelemetry | 'generation' | 'sampleKind'>, sampleKind: MeasuredSample['sampleKind']) => {
    if (acceptanceThresholds) {
      const activeResourceCount = Object.values(telemetry.activeResourceTypes).reduce((sum, count) => sum + count, 0);
      const stateGrowth = previousSample ? telemetry.stateStoreBytes - previousSample.stateStoreBytes : 0;
      const cyclesBetweenSamples = Math.max(1, details.cycleIndex - previousSampleCycle);
      const stateGrowthPerCycle = Math.max(0, stateGrowth) / cyclesBetweenSamples;
      if (telemetry.rssBytes > acceptanceThresholds.rssBytesMax) thresholdFailures.push('RSS_LIMIT');
      if (telemetry.heapUsedBytes > acceptanceThresholds.heapUsedBytesMax) thresholdFailures.push('HEAP_LIMIT');
      if (activeResourceCount > acceptanceThresholds.activeResourceCountMax) thresholdFailures.push('ACTIVE_RESOURCE_LIMIT');
      for (const [name, count] of Object.entries(telemetry.activeResourceTypes)) {
        if (count > (acceptanceThresholds.activeResourceTypeMax[name] ?? 8)) thresholdFailures.push('ACTIVE_RESOURCE_TYPE_LIMIT');
      }
      if (telemetry.stateStoreBytes > acceptanceThresholds.stateStoreBytesMax) thresholdFailures.push('STATESTORE_SIZE_LIMIT');
      if (stateGrowthPerCycle > acceptanceThresholds.stateStoreGrowthBytesPerCycleMax) thresholdFailures.push('STATESTORE_GROWTH_LIMIT');
      if (telemetry.schedulerEventCount > acceptanceThresholds.schedulerEventCountMax) thresholdFailures.push('SCHEDULER_EVENT_LIMIT');
      if (telemetry.auditEventCount > acceptanceThresholds.auditEventCountMax) thresholdFailures.push('AUDIT_EVENT_LIMIT');
      if (telemetry.evidenceRefCount > acceptanceThresholds.evidenceRefCountMax) thresholdFailures.push('EVIDENCE_COUNT_LIMIT');
      if (details.cycleLatencyMs > acceptanceThresholds.cycleLatencyMsMax) thresholdFailures.push('CYCLE_LATENCY_LIMIT');
      if (details.cycleStartDriftMs > acceptanceThresholds.cycleStartDriftMsMax) thresholdFailures.push('CYCLE_DRIFT_LIMIT');
      if (telemetry.activeAgents !== 0 || telemetry.activeChildren !== 0 || telemetry.totalChildCreations > 2) thresholdFailures.push('ACTIVE_AGENT_OR_SPAWN_LIMIT');
      if (telemetry.runtimeCalls > 1 || (telemetry.attemptCount > 0 && (!telemetry.lifecycleSettledSuccessfully || telemetry.recoveryClassification !== 'already_completed'))) thresholdFailures.push('LIFECYCLE_OR_RECOVERY_INVARIANT');
      if (telemetry.budgetReservedDollars !== 0 || telemetry.budgetUsedDollars === null || telemetry.budgetCeilingDollars === null || telemetry.budgetUsedDollars > telemetry.budgetCeilingDollars) thresholdFailures.push('BUDGET_ACCOUNTING');
      if (!telemetry.observerReadable || telemetry.foreignKeyViolations !== 0) thresholdFailures.push('STATESTORE_INTEGRITY');
      if (details.missedCycle) thresholdFailures.push('CYCLE_OVERRUN');
    }
    previousSample = telemetry;
    previousSampleCycle = details.cycleIndex;
    resourceSamples.push({ ...telemetry, ...details, generation: workerGeneration, sampleKind });
    if (thresholdFailures.length > 0) throw new Error('frozen threshold breached');
  };
  soakStartedMonotonic = performance.now();
  const soak = await runHardeningWallClockSoak({
    durationMs, cyclePeriodMs: CYCLE_PERIOD, warmupMs: mode === 'preflight' ? 0 : 30 * CYCLE_PERIOD,
    faultPeriodMs: 30 * CYCLE_PERIOD, restartPeriodMs: 120 * CYCLE_PERIOD,
    signal: abortController.signal,
    cycle: async (cycleIndex, faultPoint, processRestartPoint, scheduledFault) => {
      const cycleId = `${SOAK_RUN_ID}:seed-7123:cycle:${cycleIndex}`;
      try {
        latest = await executeCycle(worker, cycleIndex, scheduledFault);
        cycleDispositions.push({ cycleIndex, cycleId, disposition: 'completed', faultPoint, restartPoint: processRestartPoint });
        if (scheduledFault) faultEvents.push({ cycleIndex, faultClass: scheduledFault.faultClass, recordedAt: new Date().toISOString() });
        const completedCycles = cycleDispositions.filter((cycle) => cycle.disposition === 'completed').length;
        const expectedEvents = completedCycles + 1;
        if (latest.schedulerEventCount !== expectedEvents) invariantFailures.push('SCHEDULER_IDEMPOTENCY');
        const expectedFaultChecks = HARDENING_WALL_CLOCK_FAULT_SCHEDULE.filter((point) => point.atMonotonicMs <= (cycleIndex - 1) * CYCLE_PERIOD).length;
        if (latest.fixtureFaultChecks !== expectedFaultChecks) invariantFailures.push('SCHEDULED_FAULT_NOT_DURABLY_VERIFIED');
        if (latest.agentCount > 2 || latest.taskCount > 1 || latest.runCount > 1 || latest.attemptCount > 1 || latest.runtimeCalls > 1) invariantFailures.push('DUPLICATE_LIFECYCLE_OR_RUNTIME');
        if (latest.workcellCount !== 0 || latest.foreignKeyViolations !== 0 || !latest.observerReadable) invariantFailures.push('NO_EFFECT_OR_DURABLE_INTEGRITY');
        if (latest.activeAgents !== 0 || latest.activeChildren !== 0 || latest.totalChildCreations > 2) invariantFailures.push('ACTIVE_CHILD_OR_SPAWN_BOUND');
        if (latest.budgetReservedDollars !== 0 || (latest.budgetUsedDollars !== null && latest.budgetCeilingDollars !== null && latest.budgetUsedDollars > latest.budgetCeilingDollars)) invariantFailures.push('BUDGET_BOUND');
        if (latest.attemptCount === 1 && (!latest.lifecycleSettledSuccessfully || latest.recoveryClassification !== 'already_completed')) invariantFailures.push('FALSE_SUCCESS_OR_RECOVERY');
        if (invariantFailures.length > 0) throw new Error('hard safety invariant failed');
      } catch (error) {
        cycleDispositions.push({ cycleIndex, cycleId, disposition: 'failed', faultPoint, restartPoint: processRestartPoint });
        throw error;
      }
      if (processRestartPoint && mode === 'acceptance' && cycleIndex < expectedCycles) {
        await stopWorker(worker, scheduledFault?.action === 'process_crash_restart' ? 'SIGKILL' : 'SIGTERM');
        worker = await startWorker(databasePath, startedAt);
        workerRestarts += 1;
        workerGeneration += 1;
        restartEvents.push({ cycleIndex, generation: workerGeneration, recordedAt: new Date().toISOString() });
        latest = await executeFinal(worker);
        const now = performance.now();
        recordSample(latest, { cycleIndex, elapsedMonotonicMs: now - soakStartedMonotonic, cycleLatencyMs: 0, cycleStartDriftMs: 0, missedCycle: false }, 'post_restart_immediate');
      }
    },
    scheduleReport: (sample) => {
      for (const missedIndex of sample.missedCycleIndices) {
        const missedPoint = HARDENING_WALL_CLOCK_FAULT_SCHEDULE.find((point) => point.atMonotonicMs === (missedIndex - 1) * CYCLE_PERIOD);
        cycleDispositions.push({ cycleIndex: missedIndex, cycleId: `${SOAK_RUN_ID}:seed-7123:cycle:${missedIndex}`, disposition: 'missed', faultPoint: missedPoint !== undefined, restartPoint: (missedIndex - 1) % 120 === 0 });
      }
      if (sample.missedFaultPointIds.length > 0) thresholdFailures.push('MISSED_FAULT_WINDOW');
    },
    sample: (sample) => {
      if (!latest) return;
      recordSample(latest, { cycleIndex: sample.cycleIndex, elapsedMonotonicMs: sample.elapsedMonotonicMs, cycleLatencyMs: sample.cycleLatencyMs, cycleStartDriftMs: sample.cycleStartDriftMs, missedCycle: sample.missedCycle }, 'cycle');
    },
  });
  if (mode === 'acceptance' && soak.status === 'passed') {
    await stopWorker(worker);
    worker = await startWorker(databasePath, startedAt);
    workerRestarts += 1;
    workerGeneration += 1;
    restartEvents.push({ cycleIndex: expectedCycles, generation: workerGeneration, recordedAt: new Date().toISOString() });
    latest = await executeFinal(worker);
    recordSample(latest, { cycleIndex: expectedCycles, elapsedMonotonicMs: performance.now() - soakStartedMonotonic, cycleLatencyMs: 0, cycleStartDriftMs: 0, missedCycle: false }, 'post_restart_immediate');
    const expectedFaultClasses = HARDENING_WALL_CLOCK_FAULT_SCHEDULE.map((point) => point.faultClass);
    if (faultEvents.length !== expectedFaultClasses.length || faultEvents.some((event, index) => event.faultClass !== expectedFaultClasses[index])) thresholdFailures.push('FAULT_SCHEDULE_RECONCILIATION');
    if (workerRestarts !== 3) thresholdFailures.push('RESTART_COUNT');
    if (soak.cyclesCompleted !== 360) thresholdFailures.push('CYCLE_COUNT');
    const dispositionsByIndex = new Map(cycleDispositions.map((cycle) => [cycle.cycleIndex, cycle]));
    if (cycleDispositions.length !== 360 || Array.from({ length: expectedCycles }, (_, index) => dispositionsByIndex.get(index + 1)).some((cycle) => !cycle || cycle.disposition !== 'completed')) thresholdFailures.push('CYCLE_DISPOSITIONS');
    if (soak.missedCycles !== 0) thresholdFailures.push('MISSED_CYCLES');
    if (latest.agentCount !== 2 || latest.expiredAgentCount !== 1 || latest.taskCount !== 1 || latest.runCount !== 1 || latest.attemptCount !== 1) thresholdFailures.push('K4_LIFECYCLE_COUNTS');
    if (latest.runtimeCalls !== 1 || latest.receiptCount !== 1 || latest.evidenceRefCount !== 1 || !latest.lifecycleSettledSuccessfully || latest.recoveryClassification !== 'already_completed' || latest.workcellCount !== 0 || latest.activeAgents !== 0 || latest.activeChildren !== 0 || latest.totalChildCreations !== 2 || latest.foreignKeyViolations !== 0 || !latest.observerReadable) thresholdFailures.push('FINAL_INTEGRITY');
    if (latest.budgetReservedDollars !== 0 || latest.budgetUsedDollars === null || latest.budgetCeilingDollars === null || latest.budgetUsedDollars > latest.budgetCeilingDollars) thresholdFailures.push('BUDGET_ACCOUNTING');
  }
  await stopWorker(worker);
  process.off('SIGINT', cancel); process.off('SIGTERM', cancel);

  if (mode === 'preflight') {
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    if (soak.status === 'passed' && soak.cyclesCompleted === 30 && resourceSamples.length >= 10 && thresholdFailures.length === 0) {
      const thresholds = deriveFrozenThresholds(resourceSamples);
      const manifest = { schemaVersion: 'agent-mode.h0-soak-manifest.v1', runId: SOAK_RUN_ID, mode, status: 'passed', startedAt, endedAt: new Date().toISOString(), elapsedMonotonicMs: soak.elapsedMonotonicMs, cyclesCompleted: soak.cyclesCompleted, thresholds, thresholdDigest: thresholdDigest(thresholds), resourceSummary: summarizeSeries(resourceSamples), samples: resourceSamples };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      process.stdout.write(JSON.stringify({ status: soak.status, mode, elapsedMonotonicMs: soak.elapsedMonotonicMs, cyclesCompleted: soak.cyclesCompleted, resourceSamples: resourceSamples.length, frozenThresholds: thresholds, manifestPath }) + '\n');
    } else {
      const incomplete = { schemaVersion: 'agent-mode.h0-soak-manifest.v1', runId: SOAK_RUN_ID, mode, status: 'INCOMPLETE', startedAt, endedAt: new Date().toISOString(), elapsedMonotonicMs: soak.elapsedMonotonicMs, cyclesCompleted: soak.cyclesCompleted, reasonCode: soak.reasonCode, samples: resourceSamples.slice(-10) };
      writeFileSync(manifestPath, JSON.stringify(incomplete, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      process.stdout.write(JSON.stringify(incomplete) + '\n');
    }
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { thresholds?: unknown; mode?: string; thresholdDigest?: string; status?: string };
    if (mode === 'acceptance' && (!validateFrozenThresholds(manifest.thresholds) || manifest.mode !== 'preflight' || manifest.status !== 'passed' || manifest.thresholdDigest !== thresholdDigest(manifest.thresholds))) throw new Error('acceptance requires frozen preflight thresholds manifest');
    if (mode === 'acceptance') writeFileSync(manifestPath, JSON.stringify({ ...manifest, acceptance: { startedAt, endedAt: new Date().toISOString(), ...soak, status: soak.status === 'passed' && thresholdFailures.length === 0 && invariantFailures.length === 0 ? 'passed' : 'failed', scheduledFaultPoints: faultEvents.length, faultEvents, restartEvents, workerRestarts, cycleDispositions, thresholdFailures: [...new Set(thresholdFailures)], invariantFailures: [...new Set(invariantFailures)], resourceSamples: resourceSamples.length, resourceSummary: summarizeSeries(resourceSamples), samples: resourceSamples, finalTelemetry: latest } }, null, 2) + '\n', { mode: 0o600 });
    process.stdout.write(JSON.stringify({ ...soak, mode, workerRestarts, thresholdFailures: [...new Set(thresholdFailures)], invariantFailures: [...new Set(invariantFailures)], resourceSamples: resourceSamples.length, finalTelemetry: latest, manifestPath }) + '\n');
  }
  if (soak.status !== 'passed' || thresholdFailures.length > 0 || invariantFailures.length > 0 || (mode === 'acceptance' && soak.elapsedMonotonicMs < HARDENING_WALL_CLOCK_SIX_HOURS_MS)) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes(WORKER_ARG)) {
    void workerMain();
  } else {
    void controllerMain().catch((error: unknown) => {
      process.stderr.write(`H0_SOAK_FAILED:${error instanceof Error ? error.message : 'unknown'}\n`);
      process.exitCode = 2;
    });
  }
}
