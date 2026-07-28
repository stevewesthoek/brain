export interface MindCanonicalPaths {
  inboxNew: string;
  inboxFailed: string;
  inboxRaw: string;
  inboxProcessed: string;
  projects: string;
  organizations: string;
  repos: string;
  people: string;
  faith: string;
  knowledge: string;
  resources: string;
  history: string;
  agentContext: string;
  kanban: string;
  graphOutput: string;
}

export interface MindPathPolicy {
  blockedPrefixes: readonly string[];
  blockedExactPaths: readonly string[];
  blockedSuffixes: readonly string[];
  historicalPrefixes: readonly string[];
  generatedPrefixes: readonly string[];
  compatibilityPrefixes: readonly string[];
}

export interface MindPreviewPolicy {
  allowedTargets: readonly string[];
  blockedPrefixes: readonly string[];
  blockedExactPaths: readonly string[];
  blockedSuffixes: readonly string[];
  secretPrefixes: readonly string[];
}

export type MindPathKind = 'file' | 'directory';
export type MindPathEra = 'target' | 'legacy-fallback';

export interface MindContractPathCandidate {
  path: string;
  kind: MindPathKind;
  era: MindPathEra;
  purpose: string;
}

export interface MindContract {
  currentSuccessPath: string;
  currentFailurePath: string;
  activeCandidatePaths: readonly MindContractPathCandidate[];
  authorityLabels: readonly string[];
  reviewSurfaces: readonly string[];
  historicalOnlyPaths: readonly string[];
}

export interface ExactScopeApprovalPolicy {
  forbiddenModelFields: readonly string[];
  rollbackStrategy: 'restore-before-content';
}

export interface SecretSurfacePolicy {
  keyPattern: RegExp;
  valuePattern: RegExp;
}

export const MIND_CANONICAL_PATHS: MindCanonicalPaths;
export const MIND_PATH_POLICY: MindPathPolicy;
export const MIND_PREVIEW_POLICY: MindPreviewPolicy;
export const MIND_CONTRACT: MindContract;
export const MIND_MAINTENANCE_POLICY: MindPathPolicy;
export const EXACT_SCOPE_APPROVAL_POLICY: ExactScopeApprovalPolicy;
export const SECRET_SURFACE_POLICY: SecretSurfacePolicy;

export function loadBoundaryPathRegistry(): unknown;
