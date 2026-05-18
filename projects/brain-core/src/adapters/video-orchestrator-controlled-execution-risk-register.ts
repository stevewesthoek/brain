import type {
  BrainCoreVideoControlledExecutionRiskItem,
  BrainCoreVideoControlledExecutionRiskRegister,
  BrainCoreVideoControlledExecutionRiskRegisterResponse,
} from '../types/api.js';

const safety: BrainCoreVideoControlledExecutionRiskItem['safety'] = {
  readOnly: true,
  canAcceptRisk: false,
  canExecuteMitigation: false,
  canCreateApproval: false,
  canRegisterAction: false,
  canExecute: false,
  canDecommissionStb: false,
  writesToMind: false,
};

function risk(input: Omit<BrainCoreVideoControlledExecutionRiskItem, 'safety'>): BrainCoreVideoControlledExecutionRiskItem {
  return { ...input, safety };
}

export function readVideoControlledExecutionRiskRegister(): BrainCoreVideoControlledExecutionRiskRegisterResponse {
  const risks: BrainCoreVideoControlledExecutionRiskItem[] = [
    risk({
      id: 'risk-stb-mutation',
      title: 'Accidental STB mutation',
      severity: 'blocking',
      likelihood: 'low',
      category: 'stb-mutation',
      status: 'blocked',
      mitigations: ['Keep STB as source of truth only', 'No execution paths exist'],
      blockers: ['No execution route exists'],
      owner: 'system',
    }),
    risk({
      id: 'risk-file-write',
      title: 'Accidental file writes',
      severity: 'blocking',
      likelihood: 'medium',
      category: 'file-write',
      status: 'blocked',
      mitigations: ['No write APIs registered', 'No output path approved'],
      blockers: ['File writes remain disabled'],
      owner: 'system',
    }),
    risk({
      id: 'risk-cleanup',
      title: 'Generated artifact cleanup failure',
      severity: 'high',
      likelihood: 'medium',
      category: 'cleanup',
      status: 'blocked',
      mitigations: ['Keep cleanup checklist read-only', 'Do not create artifacts'],
      blockers: ['No artifact directory exists'],
      owner: 'future-policy',
    }),
    risk({
      id: 'risk-approval',
      title: 'Approval ambiguity',
      severity: 'high',
      likelihood: 'medium',
      category: 'approval',
      status: 'blocked',
      mitigations: ['No approval execution paths', 'Operator review packet stays preview-only'],
      blockers: ['No approval execution model approved'],
      owner: 'operator',
    }),
    risk({
      id: 'risk-platform-posting',
      title: 'Platform posting accident',
      severity: 'blocking',
      likelihood: 'low',
      category: 'platform-posting',
      status: 'blocked',
      mitigations: ['No publishing routes', 'Publishing remains disabled'],
      blockers: ['No platform publish route exists'],
      owner: 'system',
    }),
    risk({
      id: 'risk-model-drift',
      title: 'Model/API drift',
      severity: 'medium',
      likelihood: 'medium',
      category: 'model-drift',
      status: 'watch',
      mitigations: ['Keep adapters deterministic', 'Prefer read-only summaries'],
      blockers: ['No live execution to compare against'],
      owner: 'future-policy',
    }),
    risk({
      id: 'risk-process-failure',
      title: 'Long-running process or ffmpeg failure',
      severity: 'blocking',
      likelihood: 'low',
      category: 'process-failure',
      status: 'blocked',
      mitigations: ['No ffmpeg runner exists', 'No long-running execution path exists'],
      blockers: ['Execution remains disabled'],
      owner: 'system',
    }),
    risk({
      id: 'risk-comparison',
      title: 'Output comparison false positives',
      severity: 'high',
      likelihood: 'medium',
      category: 'comparison',
      status: 'blocked',
      mitigations: ['Keep comparison preview fixture-only', 'No generated artifact reads'],
      blockers: ['No real output comparison exists'],
      owner: 'future-policy',
    }),
    risk({
      id: 'risk-rollback',
      title: 'Rollback failure',
      severity: 'high',
      likelihood: 'medium',
      category: 'rollback',
      status: 'blocked',
      mitigations: ['Rollback checklist stays read-only', 'No destructive actions available'],
      blockers: ['No rollback execution path exists'],
      owner: 'operator',
    }),
    risk({
      id: 'risk-operator-confusion',
      title: 'Operator confusion',
      severity: 'medium',
      likelihood: 'medium',
      category: 'operator-confusion',
      status: 'blocked',
      mitigations: ['Use roadmap checkpoint and review packet as top-level summaries'],
      blockers: ['No single executable path is available'],
      owner: 'operator',
    }),
  ];

  const blockingCount = risks.filter(item => item.severity === 'blocking').length;
  const highCount = risks.filter(item => item.severity === 'high').length;
  const mediumCount = risks.filter(item => item.severity === 'medium').length;
  const blockers = risks.flatMap(item => item.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const register: BrainCoreVideoControlledExecutionRiskRegister = {
    id: 'video-orchestrator-controlled-execution-risk-register',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canAcceptRisk: false,
    canExecuteMitigation: false,
    risks,
    summary: {
      totalRisks: risks.length,
      blockingCount,
      highCount,
      mediumCount,
    },
    blockers,
    nextSafeStep: 'Keep the risk register preview-only until operator approval exists.',
    safety: {
      readOnly: true,
      canAcceptRisk: false,
      canExecuteMitigation: false,
      canCreateApproval: false,
      canRegisterAction: false,
      canExecute: false,
      canDecommissionStb: false,
      writesToMind: false,
    },
  };

  return { register };
}
