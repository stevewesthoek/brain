/** Test-only H0 harness contracts. This module is deliberately outside the production API. */

export const HARDENING_SCENARIO_SCHEMA = 'agent-mode.hardening-scenario.v1' as const;
export const HARDENING_RESULT_SCHEMA = 'agent-mode.hardening-result.v1' as const;
export const HARDENING_GATE_SCHEMA = 'agent-mode.hardening-gate.v1' as const;

export const HARDENING_FAULT_CLASSES = [
  'provider_outage', 'bedrock_budget_exhaustion', 'codex_quota_exhaustion',
  'host_loss_reconnect', 'process_crash_restart', 'stale_lease', 'duplicate_delivery',
  'stuck_agent', 'spawn_limit', 'sandbox_denial', 'tool_denial', 'corrupted_state',
  'accelerated_soak', 'security', 'auditability',
] as const;
export type HardeningFaultClass = typeof HARDENING_FAULT_CLASSES[number];

export interface HardeningCoverageMatrixEntry {
  readonly faultClass: HardeningFaultClass;
  readonly implementationSeam: string;
  readonly existingDeterministicCoverage: readonly string[];
  readonly missingCoverage: string;
  readonly expectedBehavior: string;
  readonly safetyInvariant: string;
  readonly livenessInvariant: string;
  readonly auditEvidence: string;
  /** Current gate authority; liveAcceptanceRequired is retained as the historical H0-C review dimension. */
  readonly acceptanceRequirement: 'fixture' | 'wall_clock' | 'live' | 'structural';
  readonly liveAcceptanceRequired: boolean;
}

/** Roadmap-complete inventory; fixture links are evidence pointers, not a claim of live acceptance. */
export const HARDENING_COVERAGE_MATRIX: readonly HardeningCoverageMatrixEntry[] = [
  { faultClass: 'provider_outage', implementationSeam: 'ModelGateway transport fixture', existingDeterministicCoverage: ['tests/amazon-bedrock-model-gateway.test.ts'], missingCoverage: 'combined outage-recovery workload across later eligible work', expectedBehavior: 'blocked/error classification without false success or silent route switch', safetyInvariant: 'no unapproved provider fallback or success settlement', livenessInvariant: 'outage becomes observable and later work can proceed after recovery', auditEvidence: 'bounded gateway result/error classification and durable attempt facts', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'bedrock_budget_exhaustion', implementationSeam: 'admission budget contract and durable reservation/settlement', existingDeterministicCoverage: ['tests/agent-mode-contracts.test.ts', 'tests/agent-mode-spawn-reservation.test.ts'], missingCoverage: 'combined steps/tokens/cost exhaustion across reopen in one scenario', expectedBehavior: 'next admission denied and settlement exact-once', safetyInvariant: 'no reservation or spend above root ceiling', livenessInvariant: 'unrelated eligible roots remain admissible', auditEvidence: 'reservation, denial reason, settlement and root aggregate', acceptanceRequirement: 'fixture', liveAcceptanceRequired: false },
  { faultClass: 'codex_quota_exhaustion', implementationSeam: 'attempt admission quota evidence', existingDeterministicCoverage: ['tests/agent-mode-contracts.test.ts', 'tests/agent-mode-model-tier-policy.test.ts'], missingCoverage: 'exhausted and stale evidence combined with protected manual reserve', expectedBehavior: 'automatic Codex denied for unknown/stale/exhausted quota', safetyInvariant: 'no real Codex call or protected reserve consumption', livenessInvariant: 'non-Codex eligible route remains governed by explicit policy', auditEvidence: 'stable admission reason and quota evidence reference', acceptanceRequirement: 'fixture', liveAcceptanceRequired: false },
  { faultClass: 'host_loss_reconnect', implementationSeam: 'fixture NodeTransport and node dedup adapter', existingDeterministicCoverage: ['tests/agent-mode-node-transport.test.ts'], missingCoverage: 'compose loss/reconnect with a controller restart in one soak sequence', expectedBehavior: 'disconnect observable; reconnect renegotiates without duplicate commands', safetyInvariant: 'no second active authority or duplicate effect', livenessInvariant: 'valid reconnect restores eligible delivery', auditEvidence: 'delivery state, negotiation, command receipt and dedup record', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'process_crash_restart', implementationSeam: 'StateStore reopen, runtime dispatcher and recovery classifier', existingDeterministicCoverage: ['tests/agent-mode-process-recovery.test.ts', 'tests/agent-mode-runtime-dispatch.test.ts', 'tests/agent-mode-state-relocation.test.ts'], missingCoverage: 'single repeatable H0 schedule spanning all crash boundaries', expectedBehavior: 'resume only safe states; uncertain effects await reconciliation', safetyInvariant: 'no blind effect/runtime replay', livenessInvariant: 'recoverable loss reaches safe re-admission or explicit blocked state', auditEvidence: 'durable dispatch, receipt, settlement and recovery facts', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'stale_lease', implementationSeam: 'StateStore lease/fence transactions', existingDeterministicCoverage: ['tests/agent-mode-contracts.test.ts', 'tests/agent-mode-process-recovery.test.ts', 'tests/k4-0-scheduler-heartbeat.test.ts'], missingCoverage: 'cross-resource stale-authority invariant checked by shared monitor', expectedBehavior: 'expired/old owner writes denied and replacement receives monotonic fence', safetyInvariant: 'no stale-fence write and no fence reset', livenessInvariant: 'safe owner can proceed with fresh authority', auditEvidence: 'lease owner/fence and denial/re-admission event', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'duplicate_delivery', implementationSeam: 'existing idempotency keys, event source, receipts and control service', existingDeterministicCoverage: ['tests/k4-0-scheduler-heartbeat.test.ts', 'tests/agent-mode-node-transport.test.ts', 'tests/agent-mode-runtime-dispatch.test.ts'], missingCoverage: 'one H0 sequence combining event, receipt and command redelivery', expectedBehavior: 'same logical operation converges without duplicate effect/settlement', safetyInvariant: 'exactly-once logical Task/effect semantics', livenessInvariant: 're-delivery does not permanently block eligible work', auditEvidence: 'one durable identity with duplicate outcome evidence', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'stuck_agent', implementationSeam: 'logical time, Agent deadline/TTL, scheduler and attention projection', existingDeterministicCoverage: ['tests/agent-mode-spawn-reservation.test.ts', 'tests/agent-mode-observer.test.ts'], missingCoverage: 'stuck runtime progression to bounded operator-visible attention', expectedBehavior: 'expiry/attention, no infinite reservation or retry', safetyInvariant: 'active slots and budget remain bounded', livenessInvariant: 'stuck work reaches explicit blocked/attention terminal observation', auditEvidence: 'Agent/task IDs, deadline and reason code', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'spawn_limit', implementationSeam: 'K4 SpawnPolicy and atomic child reservation', existingDeterministicCoverage: ['tests/agent-mode-spawn-policy.test.ts', 'tests/agent-mode-spawn-reservation.test.ts', 'tests/agent-mode-organization-delegation-orchestrator.test.ts'], missingCoverage: 'bounded many-request challenge monitored across max depth/concurrency/budget together', expectedBehavior: 'deny excess requests before child lifecycle creation', safetyInvariant: 'child count, concurrency and aggregate budget stay within authority', livenessInvariant: 'previously admitted work remains unaffected', auditEvidence: 'denied policy reason and root aggregate counters', acceptanceRequirement: 'fixture', liveAcceptanceRequired: false },
  { faultClass: 'sandbox_denial', implementationSeam: 'restricted Harness profile and runtime adapter', existingDeterministicCoverage: ['tests/deepseek-harness-restricted-profile.test.ts', 'tests/agent-mode-restricted-harness-runtime.test.ts'], missingCoverage: 'H0 result links denied attempt to no-effect evidence', expectedBehavior: 'unsupported sandbox topology rejected before effect', safetyInvariant: 'no shell/filesystem/provider authority widening', livenessInvariant: 'denial is bounded and observable', auditEvidence: 'profile rejection reason and zero-effect receipt state', acceptanceRequirement: 'structural', liveAcceptanceRequired: true },
  { faultClass: 'tool_denial', implementationSeam: 'capability contract and restricted Harness tool allowlist', existingDeterministicCoverage: ['tests/agent-mode-contracts.test.ts', 'tests/deepseek-harness-restricted-profile.test.ts'], missingCoverage: 'H0 monitor cross-checks denial against runtime/effect counts', expectedBehavior: 'undeclared tool rejected before effect', safetyInvariant: 'no unauthorized capability execution', livenessInvariant: 'denied request settles to explicit failure/blocked state', auditEvidence: 'bounded denial reason and attempt reference', acceptanceRequirement: 'structural', liveAcceptanceRequired: true },
  { faultClass: 'corrupted_state', implementationSeam: 'StateStore parsers, snapshot verifier, Node dedup store', existingDeterministicCoverage: ['tests/agent-mode-node-transport.test.ts', 'tests/agent-mode-state-relocation.test.ts'], missingCoverage: 'broader supported fixture corruption list with uniform public fail-closed result', expectedBehavior: 'corruption is rejected without fabricated healthy state', safetyInvariant: 'no production DB mutation and no partial imported state', livenessInvariant: 'operator-visible bounded error', auditEvidence: 'corruption class and safe object reference only', acceptanceRequirement: 'fixture', liveAcceptanceRequired: false },
  { faultClass: 'accelerated_soak', implementationSeam: 'H0 test-only deterministic runner and injected logical clock', existingDeterministicCoverage: ['tests/agent-mode-hardening-harness.test.ts'], missingCoverage: 'representative composition across all listed subsystem fixtures', expectedBehavior: 'bounded repeatable virtual-time workload', safetyInvariant: 'all safety monitors remain clear under scheduled faults', livenessInvariant: 'progress or explicit blocked outcomes within step bound', auditEvidence: 'bounded result with ordered fault and evidence references', acceptanceRequirement: 'fixture', liveAcceptanceRequired: false },
  { faultClass: 'security', implementationSeam: 'existing admission, scope, service-auth and restricted runtime boundaries', existingDeterministicCoverage: ['tests/agent-mode-contracts.test.ts', 'tests/agent-mode-spawn-policy.test.ts', 'tests/deepseek-harness-restricted-profile.test.ts'], missingCoverage: 'dedicated cross-surface H0 security release review', expectedBehavior: 'all authority expansion remains denied absent explicit policy', safetyInvariant: 'no auth/scope/fence/capability bypass', livenessInvariant: 'security denial stays observable', auditEvidence: 'stable reason codes without secret/raw payload exposure', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
  { faultClass: 'auditability', implementationSeam: 'existing events, runtime receipts, observer and bounded result references', existingDeterministicCoverage: ['tests/agent-mode-observer.test.ts', 'tests/agent-mode-runtime-dispatch.test.ts', 'tests/agent-mode-hardening-harness.test.ts'], missingCoverage: 'audit completeness monitor wired to combined subsystem observations', expectedBehavior: 'fault, authority, recovery, effect and settlement are reconstructible', safetyInvariant: 'no parallel audit ledger or raw secret output', livenessInvariant: 'operator can identify unresolved attention', auditEvidence: 'existing durable event/receipt/evidence references', acceptanceRequirement: 'live', liveAcceptanceRequired: true },
];

export const HARDENING_ACTIONS = [
  'observe', 'provider_unavailable', 'provider_recovered', 'fixture_restart',
  'duplicate_delivery', 'expire_lease', 'host_disconnected', 'host_reconnected',
  'advance_deadline', 'deny_tool', 'reopen_state_store', 'exhaust_budget',
  'set_quota_unknown', 'set_quota_exhausted', 'challenge_spawn_limit',
  'corrupt_fixture_state', 'deny_sandbox',
] as const;
export type HardeningAction = typeof HARDENING_ACTIONS[number];

export interface HardeningScenarioStep {
  readonly stepId: string;
  readonly atLogicalMs: number;
  readonly faultClass: HardeningFaultClass;
  readonly action: HardeningAction;
}

export interface HardeningScenarioV1 {
  readonly schemaVersion: typeof HARDENING_SCENARIO_SCHEMA;
  readonly scenarioId: string;
  readonly durationModel: 'accelerated' | 'wall_clock';
  readonly logicalDurationMs: number;
  readonly seed: number;
  readonly bounds: {
    readonly maxSteps: number;
    readonly maxRootGoals: number;
    readonly maxAgents: number;
    readonly maxTasks: number;
    readonly maxRuns: number;
    readonly maxAttempts: number;
    readonly maxRuntimeOperations: number;
    readonly maxModelCalls: number;
    readonly maxNodeCalls: number;
    readonly maxEvents: number;
    readonly maxFaultInjections: number;
    readonly maxEvidenceRefs: number;
  };
  readonly requiredLiveness: readonly ('safe_work_terminal' | 'recovery_observable' | 'outage_observable' | 'stuck_attention' | 'scheduler_progress')[];
  readonly steps: readonly HardeningScenarioStep[];
}

export interface HardeningCounts {
  readonly rootGoals: number;
  readonly agents: number;
  readonly tasks: number;
  readonly runs: number;
  readonly attempts: number;
  readonly runtimeOperations: number;
  readonly modelCalls: number;
  readonly nodeCalls: number;
  readonly events: number;
  readonly evidenceRefs: number;
  readonly duplicateDeliveries: number;
  readonly uncertainEffects: number;
  readonly activeAgents: number;
  readonly activeLeases: number;
  readonly reservedBudget: number;
  readonly settledBudget: number;
}

export type HardeningInvariantCode =
  | 'duplicate_logical_task' | 'duplicate_external_effect' | 'uncertain_replayed'
  | 'budget_overspend' | 'stale_fence_write' | 'multiple_active_authorities'
  | 'unauthorized_capability' | 'worker_self_approval' | 'voice_lifecycle_authority'
  | 'agent_bound_exceeded' | 'terminal_reactivated' | 'completed_work_replayed'
  | 'secret_in_public_projection' | 'liveness_timeout' | 'audit_evidence_missing';

export interface HardeningObservation {
  readonly counts: HardeningCounts;
  readonly budgetCeiling: number;
  readonly invariantSignals: Readonly<Partial<Record<HardeningInvariantCode, number>>>;
  readonly liveness: Readonly<Partial<Record<NonNullable<HardeningScenarioV1['requiredLiveness'][number]>, boolean>>>;
  readonly auditEvidenceComplete: boolean;
  readonly evidenceRefs: readonly string[];
  readonly recoveryState: 'none' | 'safe_to_resume' | 'awaiting_receipt_reconciliation' | 'uncertain_non_idempotent_effect' | 'already_completed';
}

export interface HardeningResultV1 {
  readonly schemaVersion: typeof HARDENING_RESULT_SCHEMA;
  readonly scenarioId: string;
  readonly seed: number;
  readonly status: 'passed' | 'failed' | 'blocked';
  readonly reasonCode: 'SCENARIO_PASSED' | 'INVARIANT_FAILED' | 'BOUND_EXCEEDED' | 'WALL_CLOCK_NOT_RUN' | 'FIXTURE_ACTION_FAILED';
  readonly logicalDurationMs: number;
  readonly iterations: number;
  readonly faultsInjected: readonly HardeningFaultClass[];
  readonly invariantsChecked: number;
  readonly invariantFailures: readonly HardeningInvariantCode[];
  readonly counts: HardeningCounts;
  readonly recoveryStates: readonly HardeningObservation['recoveryState'][];
  readonly evidenceRefs: readonly string[];
}

const MAX_STEPS = 256;
const MAX_EVIDENCE = 64;
const MAX_SCENARIO_ID = 128;
const MAX_SAFE_COUNT = 1_000_000;
const faultSet = new Set<string>(HARDENING_FAULT_CLASSES);
const actionSet = new Set<string>(HARDENING_ACTIONS);
const actionFaultClasses: Readonly<Record<HardeningAction, readonly HardeningFaultClass[]>> = {
  observe: HARDENING_FAULT_CLASSES,
  provider_unavailable: ['provider_outage'], provider_recovered: ['provider_outage'],
  fixture_restart: ['process_crash_restart'], reopen_state_store: ['process_crash_restart', 'corrupted_state'],
  duplicate_delivery: ['duplicate_delivery'], expire_lease: ['stale_lease'],
  host_disconnected: ['host_loss_reconnect'], host_reconnected: ['host_loss_reconnect'],
  advance_deadline: ['stuck_agent', 'accelerated_soak'], deny_tool: ['tool_denial'],
  exhaust_budget: ['bedrock_budget_exhaustion'], set_quota_unknown: ['codex_quota_exhaustion'],
  set_quota_exhausted: ['codex_quota_exhaustion'], challenge_spawn_limit: ['spawn_limit'],
  corrupt_fixture_state: ['corrupted_state'], deny_sandbox: ['sandbox_denial'],
};
const invariantCodes: readonly HardeningInvariantCode[] = [
  'duplicate_logical_task', 'duplicate_external_effect', 'uncertain_replayed',
  'budget_overspend', 'stale_fence_write', 'multiple_active_authorities',
  'unauthorized_capability', 'worker_self_approval', 'voice_lifecycle_authority',
  'agent_bound_exceeded', 'terminal_reactivated', 'completed_work_replayed',
  'secret_in_public_projection', 'liveness_timeout', 'audit_evidence_missing',
];

function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SCENARIO_ID
    && /^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/.test(value) && !value.includes('..');
}

function isSafeEvidenceRef(value: unknown): value is string {
  return isBoundedId(value) && !/[\\\s]/.test(value) && !/(secret|credential|prompt|payload)/i.test(value);
}

/** Runtime validation is intentionally closed: unknown properties/action forms fail closed. */
export function validateHardeningScenario(value: unknown): HardeningScenarioV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid hardening scenario');
  const candidate = value as Record<string, unknown>;
  const allowedKeys = ['schemaVersion', 'scenarioId', 'durationModel', 'logicalDurationMs', 'seed', 'bounds', 'requiredLiveness', 'steps'];
  if (Object.keys(candidate).some((key) => !allowedKeys.includes(key))) throw new Error('unknown scenario field');
  if (candidate.schemaVersion !== HARDENING_SCENARIO_SCHEMA || !isBoundedId(candidate.scenarioId)) throw new Error('invalid scenario identity');
  if (candidate.durationModel !== 'accelerated' && candidate.durationModel !== 'wall_clock') throw new Error('invalid duration model');
  if (!Number.isSafeInteger(candidate.logicalDurationMs) || Number(candidate.logicalDurationMs) <= 0 || Number(candidate.logicalDurationMs) > 31 * 24 * 60 * 60 * 1000) throw new Error('logical duration is out of bounds');
  if (!Number.isSafeInteger(candidate.seed) || Number(candidate.seed) < 0 || Number(candidate.seed) > 0xffff_ffff) throw new Error('seed is out of bounds');
  if (!candidate.bounds || typeof candidate.bounds !== 'object' || Array.isArray(candidate.bounds)) throw new Error('scenario bounds are required');
  const bounds = candidate.bounds as Record<string, unknown>;
  const boundKeys = ['maxSteps', 'maxRootGoals', 'maxAgents', 'maxTasks', 'maxRuns', 'maxAttempts', 'maxRuntimeOperations', 'maxModelCalls', 'maxNodeCalls', 'maxEvents', 'maxFaultInjections', 'maxEvidenceRefs'];
  if (Object.keys(bounds).length !== boundKeys.length || boundKeys.some((key) => !Object.hasOwn(bounds, key))) throw new Error('scenario bounds must be complete');
  for (const key of boundKeys) {
    const cap = Number(bounds[key]);
    const absolute = key === 'maxSteps' ? MAX_STEPS : key === 'maxEvidenceRefs' ? MAX_EVIDENCE : MAX_SAFE_COUNT;
    if (!Number.isSafeInteger(cap) || cap < 0 || cap > absolute) throw new Error(`scenario bound ${key} is invalid`);
  }
  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0 || candidate.steps.length > Number(bounds.maxSteps) || candidate.steps.length > MAX_STEPS) throw new Error('scenario step count is out of bounds');
  if (!Array.isArray(candidate.requiredLiveness) || candidate.requiredLiveness.some((entry) => !['safe_work_terminal', 'recovery_observable', 'outage_observable', 'stuck_attention', 'scheduler_progress'].includes(String(entry)))) throw new Error('invalid liveness contract');
  const stepIds = new Set<string>();
  let previous = -1;
  const steps = candidate.steps.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid scenario step');
    const step = raw as Record<string, unknown>;
    if (Object.keys(step).some((key) => !['stepId', 'atLogicalMs', 'faultClass', 'action'].includes(key))) throw new Error('unknown scenario step field');
    if (!isBoundedId(step.stepId) || stepIds.has(step.stepId)) throw new Error('invalid or duplicate step identity');
    if (!Number.isSafeInteger(step.atLogicalMs) || Number(step.atLogicalMs) < previous || Number(step.atLogicalMs) > Number(candidate.logicalDurationMs)) throw new Error('step time is outside logical duration or order');
    if (typeof step.faultClass !== 'string' || !faultSet.has(step.faultClass)) throw new Error('unknown fault class');
    if (typeof step.action !== 'string' || !actionSet.has(step.action)) throw new Error('unknown fixture action');
    if (step.action !== 'observe' && !actionFaultClasses[step.action as HardeningAction].includes(step.faultClass as HardeningFaultClass)) throw new Error('fixture action does not match fault class');
    stepIds.add(step.stepId);
    previous = Number(step.atLogicalMs);
    return { stepId: step.stepId, atLogicalMs: previous, faultClass: step.faultClass as HardeningFaultClass, action: step.action as HardeningAction };
  });
  if (steps.filter((step) => step.action !== 'observe').length > Number(bounds.maxFaultInjections)) throw new Error('fault injection bound exceeded');
  return {
    schemaVersion: HARDENING_SCENARIO_SCHEMA,
    scenarioId: candidate.scenarioId,
    durationModel: candidate.durationModel,
    logicalDurationMs: Number(candidate.logicalDurationMs),
    seed: Number(candidate.seed),
    bounds: Object.fromEntries(boundKeys.map((key) => [key, Number(bounds[key])])) as unknown as HardeningScenarioV1['bounds'],
    requiredLiveness: [...new Set(candidate.requiredLiveness as HardeningScenarioV1['requiredLiveness'])],
    steps,
  };
}

/** Controlled logical time; never patches process-global Date or sleeps. */
export class HardeningLogicalClock {
  private elapsedMs = 0;
  constructor(private readonly startedAtMs: number, private readonly maximumDurationMs: number) {
    if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0 || !Number.isSafeInteger(maximumDurationMs) || maximumDurationMs <= 0) throw new Error('invalid logical clock bounds');
  }
  nowMs(): number { return this.startedAtMs + this.elapsedMs; }
  elapsed(): number { return this.elapsedMs; }
  advanceTo(elapsedMs: number): void {
    if (!Number.isSafeInteger(elapsedMs) || elapsedMs < this.elapsedMs || elapsedMs > this.maximumDurationMs) throw new Error('logical clock cannot move backwards or exceed duration');
    this.elapsedMs = elapsedMs;
  }
}

export interface HardeningStepContext { readonly step: HardeningScenarioStep; readonly logicalNowMs: number; readonly seed: number; }
export interface HardeningFixtureAdapter {
  execute(action: HardeningAction, context: HardeningStepContext): Promise<HardeningObservation> | HardeningObservation;
}

function emptyCounts(): HardeningCounts {
  return { rootGoals: 0, agents: 0, tasks: 0, runs: 0, attempts: 0, runtimeOperations: 0, modelCalls: 0, nodeCalls: 0, events: 0, evidenceRefs: 0, duplicateDeliveries: 0, uncertainEffects: 0, activeAgents: 0, activeLeases: 0, reservedBudget: 0, settledBudget: 0 };
}

function boundedCounts(counts: HardeningCounts, bounds: HardeningScenarioV1['bounds']): boolean {
  const pairs: readonly [number, number][] = [
    [counts.rootGoals, bounds.maxRootGoals], [counts.agents, bounds.maxAgents], [counts.tasks, bounds.maxTasks],
    [counts.runs, bounds.maxRuns], [counts.attempts, bounds.maxAttempts], [counts.runtimeOperations, bounds.maxRuntimeOperations],
    [counts.modelCalls, bounds.maxModelCalls], [counts.nodeCalls, bounds.maxNodeCalls], [counts.events, bounds.maxEvents],
    [counts.evidenceRefs, bounds.maxEvidenceRefs],
  ];
  const allCounts = Object.values(counts);
  return allCounts.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    && pairs.every(([value, max]) => Number.isSafeInteger(value) && value >= 0 && value <= max)
    && Number.isFinite(counts.reservedBudget) && counts.reservedBudget >= 0
    && Number.isFinite(counts.settledBudget) && counts.settledBudget >= 0;
}

function checkObservation(observation: HardeningObservation, scenario: HardeningScenarioV1): HardeningInvariantCode[] {
  const failures = new Set<HardeningInvariantCode>();
  if (!Number.isFinite(observation.budgetCeiling) || observation.budgetCeiling < 0) failures.add('budget_overspend');
  for (const code of invariantCodes) {
    const signal = observation.invariantSignals[code] ?? 0;
    if (!Number.isFinite(signal) || signal !== 0) failures.add(code);
  }
  if (observation.counts.settledBudget + observation.counts.reservedBudget > observation.budgetCeiling) failures.add('budget_overspend');
  if (observation.counts.agents > scenario.bounds.maxAgents) failures.add('agent_bound_exceeded');
  if (!observation.auditEvidenceComplete) failures.add('audit_evidence_missing');
  if (observation.evidenceRefs.some((ref) => !isSafeEvidenceRef(ref)) || observation.evidenceRefs.length > scenario.bounds.maxEvidenceRefs) failures.add('secret_in_public_projection');
  return [...failures];
}

function makeResult(input: Omit<HardeningResultV1, 'schemaVersion'>): HardeningResultV1 {
  return { schemaVersion: HARDENING_RESULT_SCHEMA, ...input };
}

/** Executes only closed fixture actions, with deterministic order and a hard step/time budget. */
export async function runHardeningScenario(value: unknown, adapter: HardeningFixtureAdapter): Promise<HardeningResultV1> {
  const scenario = validateHardeningScenario(value);
  if (scenario.durationModel === 'wall_clock') return makeResult({
    scenarioId: scenario.scenarioId, seed: scenario.seed, status: 'blocked', reasonCode: 'WALL_CLOCK_NOT_RUN',
    logicalDurationMs: 0, iterations: 0, faultsInjected: [], invariantsChecked: 0, invariantFailures: [],
    counts: emptyCounts(), recoveryStates: [], evidenceRefs: [],
  });
  const clock = new HardeningLogicalClock(0, scenario.logicalDurationMs);
  const failures = new Set<HardeningInvariantCode>();
  const faults: HardeningFaultClass[] = [];
  const recoveryStates: HardeningObservation['recoveryState'][] = [];
  const evidenceRefs = new Set<string>();
  let latestCounts = emptyCounts();
  let latestObservation: HardeningObservation | undefined;
  let checks = 0;
  let boundExceeded = false;
  let iterations = 0;
  for (const step of scenario.steps) {
    iterations += 1;
    clock.advanceTo(step.atLogicalMs);
    let observation: HardeningObservation;
    try {
      observation = await adapter.execute(step.action, { step, logicalNowMs: clock.nowMs(), seed: scenario.seed });
    } catch {
      return makeResult({ scenarioId: scenario.scenarioId, seed: scenario.seed, status: 'failed', reasonCode: 'FIXTURE_ACTION_FAILED', logicalDurationMs: clock.elapsed(), iterations, faultsInjected: faults, invariantsChecked: checks, invariantFailures: [...failures], counts: latestCounts, recoveryStates, evidenceRefs: [...evidenceRefs] });
    }
    if (step.action !== 'observe') faults.push(step.faultClass);
    checks += invariantCodes.length + scenario.requiredLiveness.length + 3;
    checkObservation(observation, scenario).forEach((failure) => failures.add(failure));
    if (!boundedCounts(observation.counts, scenario.bounds)) { failures.add('agent_bound_exceeded'); boundExceeded = true; }
    latestCounts = observation.counts;
    latestObservation = observation;
    recoveryStates.push(observation.recoveryState);
    observation.evidenceRefs.forEach((ref) => evidenceRefs.add(ref));
    if (evidenceRefs.size > scenario.bounds.maxEvidenceRefs) failures.add('audit_evidence_missing');
    if (failures.size > 0) break;
  }
  for (const liveness of scenario.requiredLiveness) {
    checks += 1;
    if (latestObservation?.liveness[liveness] !== true) failures.add('liveness_timeout');
  }
  const status = failures.size > 0 ? 'failed' : 'passed';
  return makeResult({
    scenarioId: scenario.scenarioId, seed: scenario.seed, status, reasonCode: status === 'passed' ? 'SCENARIO_PASSED' : boundExceeded ? 'BOUND_EXCEEDED' : 'INVARIANT_FAILED',
    logicalDurationMs: clock.elapsed(), iterations, faultsInjected: faults, invariantsChecked: checks,
    invariantFailures: [...failures].sort(), counts: latestCounts, recoveryStates, evidenceRefs: [...evidenceRefs].sort(),
  });
}

/** Validate serialized result material before it is written into bounded evidence. */
export function validateHardeningResult(value: unknown): HardeningResultV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid hardening result');
  const result = value as Record<string, unknown>;
  const keys = ['schemaVersion', 'scenarioId', 'seed', 'status', 'reasonCode', 'logicalDurationMs', 'iterations', 'faultsInjected', 'invariantsChecked', 'invariantFailures', 'counts', 'recoveryStates', 'evidenceRefs'];
  if (Object.keys(result).length !== keys.length || Object.keys(result).some((key) => !keys.includes(key))) throw new Error('invalid hardening result fields');
  if (result.schemaVersion !== HARDENING_RESULT_SCHEMA || !isBoundedId(result.scenarioId)) throw new Error('invalid hardening result identity');
  if (!['passed', 'failed', 'blocked'].includes(String(result.status)) || !['SCENARIO_PASSED', 'INVARIANT_FAILED', 'BOUND_EXCEEDED', 'WALL_CLOCK_NOT_RUN', 'FIXTURE_ACTION_FAILED'].includes(String(result.reasonCode))) throw new Error('invalid hardening result status');
  if ((result.status === 'blocked' && result.reasonCode !== 'WALL_CLOCK_NOT_RUN') || (result.status === 'failed' && ['SCENARIO_PASSED', 'WALL_CLOCK_NOT_RUN'].includes(String(result.reasonCode))) || (result.status === 'passed' && result.reasonCode !== 'SCENARIO_PASSED')) throw new Error('hardening result status/reason mismatch');
  for (const key of ['seed', 'logicalDurationMs', 'iterations', 'invariantsChecked']) if (!Number.isSafeInteger(result[key]) || Number(result[key]) < 0) throw new Error('invalid hardening result count');
  if (!Array.isArray(result.faultsInjected) || result.faultsInjected.some((fault) => typeof fault !== 'string' || !faultSet.has(fault))) throw new Error('invalid hardening result faults');
  if (result.faultsInjected.length > MAX_STEPS) throw new Error('hardening result fault list is out of bounds');
  if (!Array.isArray(result.invariantFailures) || result.invariantFailures.some((code) => !invariantCodes.includes(code as HardeningInvariantCode))) throw new Error('invalid hardening result invariants');
  if (result.status === 'passed' && (result.invariantFailures.length !== 0 || result.reasonCode !== 'SCENARIO_PASSED')) throw new Error('passed result contradicts invariant facts');
  if (!Array.isArray(result.recoveryStates) || result.recoveryStates.some((state) => !['none', 'safe_to_resume', 'awaiting_receipt_reconciliation', 'uncertain_non_idempotent_effect', 'already_completed'].includes(String(state)))) throw new Error('invalid recovery summary');
  if (!Array.isArray(result.evidenceRefs) || result.evidenceRefs.length > MAX_EVIDENCE || result.evidenceRefs.some((ref) => !isSafeEvidenceRef(ref)) || new Set(result.evidenceRefs).size !== result.evidenceRefs.length) throw new Error('invalid bounded evidence references');
  if (!result.counts || typeof result.counts !== 'object' || Array.isArray(result.counts)) throw new Error('invalid hardening result counts');
  const countRecord = result.counts as Record<string, unknown>;
  const countKeys = ['rootGoals', 'agents', 'tasks', 'runs', 'attempts', 'runtimeOperations', 'modelCalls', 'nodeCalls', 'events', 'evidenceRefs', 'duplicateDeliveries', 'uncertainEffects', 'activeAgents', 'activeLeases', 'reservedBudget', 'settledBudget'];
  const countValues = Object.values(countRecord);
  if (Object.keys(countRecord).length !== countKeys.length || Object.keys(countRecord).some((key) => !countKeys.includes(key)) || countValues.some((count) => typeof count !== 'number' || !Number.isFinite(count) || count < 0)) throw new Error('invalid hardening result counts');
  return value as HardeningResultV1;
}

export type HardeningCoverageStatus = 'fixture_pass' | 'wall_clock_pass' | 'live_pass' | 'structural_pass' | 'not_run' | 'blocked' | 'failed';
export interface HardeningCoverageEntry { readonly faultClass: HardeningFaultClass; readonly status: HardeningCoverageStatus; readonly evidence: readonly string[]; }
export interface HardeningGateResult { readonly schemaVersion: typeof HARDENING_GATE_SCHEMA; readonly status: 'PASS' | 'FAIL' | 'INCOMPLETE'; readonly missing: readonly string[]; }

export function evaluateHardeningGate(entries: readonly HardeningCoverageEntry[], options: { readonly wallClockSoak: HardeningCoverageStatus; readonly securityReview: HardeningCoverageStatus }): HardeningGateResult {
  const missing: string[] = [];
  const allowedStatuses = new Set<HardeningCoverageStatus>(['fixture_pass', 'wall_clock_pass', 'live_pass', 'structural_pass', 'not_run', 'blocked', 'failed']);
  if (!Array.isArray(entries) || !allowedStatuses.has(options.wallClockSoak) || !allowedStatuses.has(options.securityReview)) return { schemaVersion: HARDENING_GATE_SCHEMA, status: 'FAIL', missing: ['invalid_gate_input'] };
  if (entries.some((entry) => !entry || !faultSet.has(entry.faultClass) || !allowedStatuses.has(entry.status) || !Array.isArray(entry.evidence) || entry.evidence.some((ref: unknown) => !isSafeEvidenceRef(ref)))) return { schemaVersion: HARDENING_GATE_SCHEMA, status: 'FAIL', missing: ['invalid_gate_entry'] };
  for (const faultClass of HARDENING_FAULT_CLASSES) {
    const matching = entries.filter((entry) => entry.faultClass === faultClass);
    if (matching.some((entry) => entry.status === 'failed')) return { schemaVersion: HARDENING_GATE_SCHEMA, status: 'FAIL', missing: [`scenario:${faultClass}`] };
    if (matching.length !== 1 || !matching[0]?.evidence.length || matching[0]?.status === 'not_run' || matching[0]?.status === 'blocked') missing.push(`scenario:${faultClass}`);
    else {
      const requirement = HARDENING_COVERAGE_MATRIX.find((entry) => entry.faultClass === faultClass)?.acceptanceRequirement;
      if (requirement === 'live' && matching[0]?.status !== 'live_pass') missing.push(`live_acceptance:${faultClass}`);
      if (requirement === 'structural' && matching[0]?.status !== 'structural_pass') missing.push(`structural_acceptance:${faultClass}`);
      if (requirement === 'wall_clock' && matching[0]?.status !== 'wall_clock_pass' && matching[0]?.status !== 'live_pass') missing.push(`wall_clock_acceptance:${faultClass}`);
    }
  }
  if (options.wallClockSoak !== 'wall_clock_pass' && options.wallClockSoak !== 'live_pass') missing.push('wall_clock_soak');
  if (options.securityReview !== 'live_pass') missing.push('security_release_review');
  return { schemaVersion: HARDENING_GATE_SCHEMA, status: missing.length ? 'INCOMPLETE' : 'PASS', missing: missing.sort() };
}
