/** Test-only H0-F evidence for capabilities absent from Brain's production composition. */

export const H0_F_STRUCTURAL_EVIDENCE_SCHEMA = 'agent-mode.h0-f-structural-evidence.v1' as const;
export const H0_F_BOUNDARY_TAXONOMY = [
  'RUNTIME_DENIAL',
  'STRUCTURAL_ABSENCE',
  'POLICY_DENIAL',
  'NOT_APPLICABLE',
] as const;
export type H0FBoundaryClassification = typeof H0_F_BOUNDARY_TAXONOMY[number];
export type H0FStructuralFaultClass = 'sandbox_denial' | 'tool_denial';
export type H0FGraphEdgeStatus = 'present' | 'absent' | 'test-only' | 'unreachable' | 'policy-gated';

type H0FGraphEdge = {
  readonly edge: string;
  readonly status: H0FGraphEdgeStatus;
};

export type H0FStructuralEvidence = {
  readonly schemaVersion: typeof H0_F_STRUCTURAL_EVIDENCE_SCHEMA;
  readonly faultClass: H0FStructuralFaultClass;
  readonly classification: 'STRUCTURAL_ABSENCE';
  readonly status: 'structural_pass' | 'failed';
  readonly productionRevision: string;
  readonly harnessPin: string;
  readonly boundary: 'harness-production-composition';
  readonly absentCapabilities: readonly string[];
  readonly sdkSurface: {
    readonly builtInToolSurface: readonly string[];
    readonly reservedToolNames: readonly string[];
    readonly ptcRunCode: 'present';
    readonly codeRuntime: 'present';
    readonly terminalFilesystemSubprocess: 'present-in-sdk-test-surface';
    readonly auxiliaryBrokers: 'not-injected';
    readonly autoRegistration: 'explicit-launch-and-patch-list';
    readonly environmentEnablement: 'explicit-brain-environment';
  };
  readonly attackGraph: readonly H0FGraphEdge[];
  readonly callerControlChecks: readonly string[];
  readonly invalidationConditions: readonly string[];
  readonly evidenceRefs: readonly string[];
};

const COMMON_CALLER_CONTROL_CHECKS = [
  'task-input-cannot-widen-composition',
  'agent-config-cannot-widen-composition',
  'console-and-jarvis-cannot-widen-composition',
  'model-output-cannot-widen-composition',
  'node-command-cannot-widen-composition',
] as const;
const COMMON_INVALIDATION_CONDITIONS = [
  'production-tool-or-sandbox-authority-added',
  'pinned-harness-commit-or-version-changes',
  'production-composition-or-injection-list-changes',
] as const;

const TOOL_GRAPH: readonly H0FGraphEdge[] = [
  { edge: 'model-output -> Harness SDK', status: 'present' },
  { edge: 'Harness SDK -> tool registry', status: 'test-only' },
  { edge: 'tool registry -> Brain adapter/capability broker', status: 'absent' },
  { edge: 'Brain adapter/capability broker -> external effect', status: 'unreachable' },
];
const SANDBOX_GRAPH: readonly H0FGraphEdge[] = [
  { edge: 'worker/model output -> sandbox API', status: 'absent' },
  { edge: 'sandbox API -> filesystem/shell runtime', status: 'test-only' },
  { edge: 'filesystem/shell runtime -> external effect', status: 'unreachable' },
  { edge: 'restricted profile -> denied sandbox rows', status: 'policy-gated' },
];

export const H0_F_STRUCTURAL_EVIDENCE: readonly H0FStructuralEvidence[] = [
  {
    schemaVersion: H0_F_STRUCTURAL_EVIDENCE_SCHEMA,
    faultClass: 'sandbox_denial',
    classification: 'STRUCTURAL_ABSENCE',
    status: 'structural_pass',
    productionRevision: 'h0-e-production-composition',
    harnessPin: 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8',
    boundary: 'harness-production-composition',
    absentCapabilities: ['sandbox-api', 'filesystem-service', 'shell-runtime'],
    sdkSurface: {
      builtInToolSurface: ['run_code'],
      reservedToolNames: ['run_code'],
      ptcRunCode: 'present',
      codeRuntime: 'present',
      terminalFilesystemSubprocess: 'present-in-sdk-test-surface',
      auxiliaryBrokers: 'not-injected',
      autoRegistration: 'explicit-launch-and-patch-list',
      environmentEnablement: 'explicit-brain-environment',
    },
    attackGraph: SANDBOX_GRAPH,
    callerControlChecks: COMMON_CALLER_CONTROL_CHECKS,
    invalidationConditions: COMMON_INVALIDATION_CONDITIONS,
    evidenceRefs: ['h0-f:sandbox:profile', 'h0-f:sandbox:composition', 'h0-f:sandbox:invalidation'],
  },
  {
    schemaVersion: H0_F_STRUCTURAL_EVIDENCE_SCHEMA,
    faultClass: 'tool_denial',
    classification: 'STRUCTURAL_ABSENCE',
    status: 'structural_pass',
    productionRevision: 'h0-e-production-composition',
    harnessPin: 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8',
    boundary: 'harness-production-composition',
    absentCapabilities: ['tool-registry', 'tool-call-dispatch', 'external-capability-broker'],
    sdkSurface: {
      builtInToolSurface: ['run_code'],
      reservedToolNames: ['run_code'],
      ptcRunCode: 'present',
      codeRuntime: 'present',
      terminalFilesystemSubprocess: 'present-in-sdk-test-surface',
      auxiliaryBrokers: 'not-injected',
      autoRegistration: 'explicit-launch-and-patch-list',
      environmentEnablement: 'explicit-brain-environment',
    },
    attackGraph: TOOL_GRAPH,
    callerControlChecks: COMMON_CALLER_CONTROL_CHECKS,
    invalidationConditions: COMMON_INVALIDATION_CONDITIONS,
    evidenceRefs: ['h0-f:tool:registry', 'h0-f:tool:composition', 'h0-f:tool:invalidation'],
  },
];

function bounded(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function validateH0FStructuralEvidence(value: unknown): H0FStructuralEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid H0-F evidence');
  const candidate = value as Record<string, unknown>;
  const allowedKeys = ['schemaVersion', 'faultClass', 'classification', 'status', 'productionRevision', 'harnessPin', 'boundary', 'absentCapabilities', 'sdkSurface', 'attackGraph', 'callerControlChecks', 'invalidationConditions', 'evidenceRefs'];
  if (Object.keys(candidate).some((key) => !allowedKeys.includes(key))) throw new Error('unknown H0-F evidence field');
  if (candidate.schemaVersion !== H0_F_STRUCTURAL_EVIDENCE_SCHEMA || (candidate.faultClass !== 'sandbox_denial' && candidate.faultClass !== 'tool_denial') || candidate.classification !== 'STRUCTURAL_ABSENCE' || (candidate.status !== 'structural_pass' && candidate.status !== 'failed') || candidate.boundary !== 'harness-production-composition' || !bounded(candidate.productionRevision) || !bounded(candidate.harnessPin, 64)) throw new Error('invalid H0-F evidence identity');
  if (!Array.isArray(candidate.absentCapabilities) || candidate.absentCapabilities.length === 0 || candidate.absentCapabilities.length > 8 || candidate.absentCapabilities.some((entry) => !bounded(entry, 64))) throw new Error('invalid H0-F absent capabilities');
  const sdk = candidate.sdkSurface;
  if (!sdk || typeof sdk !== 'object' || Array.isArray(sdk)) throw new Error('invalid H0-F SDK surface');
  const sdkRecord = sdk as Record<string, unknown>;
  const sdkKeys = ['builtInToolSurface', 'reservedToolNames', 'ptcRunCode', 'codeRuntime', 'terminalFilesystemSubprocess', 'auxiliaryBrokers', 'autoRegistration', 'environmentEnablement'];
  if (Object.keys(sdkRecord).length !== sdkKeys.length || sdkKeys.some((key) => !Object.hasOwn(sdkRecord, key)) || !Array.isArray(sdkRecord.builtInToolSurface) || !Array.isArray(sdkRecord.reservedToolNames) || sdkRecord.builtInToolSurface.length > 16 || sdkRecord.reservedToolNames.length > 16 || sdkRecord.builtInToolSurface.some((entry) => !bounded(entry, 64)) || sdkRecord.reservedToolNames.some((entry) => !bounded(entry, 64)) || sdkRecord.ptcRunCode !== 'present' || sdkRecord.codeRuntime !== 'present' || sdkRecord.terminalFilesystemSubprocess !== 'present-in-sdk-test-surface' || sdkRecord.auxiliaryBrokers !== 'not-injected' || sdkRecord.autoRegistration !== 'explicit-launch-and-patch-list' || sdkRecord.environmentEnablement !== 'explicit-brain-environment') throw new Error('invalid H0-F SDK surface');
  if (!Array.isArray(candidate.attackGraph) || candidate.attackGraph.length < 3 || candidate.attackGraph.length > 8 || candidate.attackGraph.some((edge) => !edge || typeof edge !== 'object' || !bounded((edge as Record<string, unknown>).edge, 160) || !['present', 'absent', 'test-only', 'unreachable', 'policy-gated'].includes((edge as Record<string, unknown>).status as string))) throw new Error('invalid H0-F attack graph');
  for (const key of ['callerControlChecks', 'invalidationConditions', 'evidenceRefs']) {
    const entries = candidate[key];
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 16 || entries.some((entry) => !bounded(entry, 160) || /(?:secret|credential|prompt|payload)/iu.test(entry))) throw new Error(`invalid H0-F ${key}`);
  }
  return value as H0FStructuralEvidence;
}
