import { joinMindPath, loadMindPathRegistry, resolveCanonicalMindPath } from './path-registry.js';
import { MIND_CONTRACT } from '../../../operations/specs/infinite-brain-boundary-contracts.js';

const canonical = (pathId: string) => resolveCanonicalMindPath(pathId);

export const MIND_ROUTER_CONTRACT_FILES = [
  'AGENTS.md', '00-start-here.md', '00-current-context.md', '00-memory-map.md',
].map((file) => joinMindPath(canonical('agent-context'), file));

export const MIND_CURRENT_SUCCESS_PATH = MIND_CONTRACT.currentSuccessPath;
export const MIND_CURRENT_FAILURE_PATH = MIND_CONTRACT.currentFailurePath;
export const MIND_REVIEW_SURFACES = MIND_CONTRACT.reviewSurfaces;
export const MIND_HISTORICAL_ONLY_PATHS = MIND_CONTRACT.historicalOnlyPaths;
export const MIND_AUTHORITY_LABELS = MIND_CONTRACT.authorityLabels;
export { MIND_CONTRACT };

export const MIND_REQUIRED_PATHS = [
  'inbox-new', 'inbox-failed', 'projects', 'organizations', 'repos', 'people',
  'faith', 'knowledge', 'resources', 'history', 'agent-context', 'kanban-current-authority',
].map(canonical);

export const MIND_LIVE_FILES: string[] = [];
export const MIND_REQUIRED_INDEX_FILES: string[] = [];
export const MIND_LEGACY_READ_ONLY_PATHS = loadMindPathRegistry().entries
  .filter((entry) => !entry.activeDefaultAllowed && ['compatibility-read', 'historical-read'].includes(entry.readPolicy))
  .flatMap((entry) => entry.literal ? [entry.literal] : []);

export const MIND_ANTI_CLUTTER_LIMITS = {
  [joinMindPath(canonical('agent-context'), '00-current-context.md')]: { maxLines: 150 },
  [canonical('inbox-new')]: { maxAgeDays: 7 },
  [canonical('inbox-failed')]: { maxAgeDays: 3 },
} as const;

export type MindRouterJobId = 'mind-compile-loop' | 'mind-memory-loop' | 'mind-hygiene-loop' | 'mind-drift-error-loop';
export type MindRouterMode = 'dry-run' | 'write';
export type MindPathKind = 'file' | 'directory';
export interface MindPathStatus { path: string; kind: MindPathKind; exists: boolean; sizeBytes?: number; lineCount?: number; modifiedAt?: string; followedSymlink?: boolean; }
export type MindSaveToMindTarget = 'inbox-new' | 'unknown';
export type MindFailureBufferStatus = 'not-configured' | 'folder-only' | 'test-verified' | 'real-error-verified' | 'unknown';
export interface MindContractSnapshot { paths: MindPathStatus[]; saveToMindTarget?: MindSaveToMindTarget; liveDeploymentVerified?: boolean; failureBufferStatus?: MindFailureBufferStatus; }
export interface MindRouterJobResult { jobId: MindRouterJobId; mode: MindRouterMode; ok: boolean; checkedPaths: string[]; plannedWrites: string[]; warnings: string[]; errors: string[]; }
export interface MindContractDryRunResult extends MindRouterJobResult { missingRequiredPaths: string[]; missingRouterContractFiles: string[]; missingLiveFiles: string[]; missingIndexFiles: string[]; presentLegacyReadOnlyPaths: string[]; saveToMindTarget: MindContractSnapshot['saveToMindTarget']; liveDeploymentVerified: boolean; failureBufferStatus: MindFailureBufferStatus; failureBufferReadyForArchivePhase: boolean; }
export type MindRouterPlanActionKind = 'compile-capture' | 'promote-memory' | 'summarize-file' | 'split-file' | 'archive-stale-capture' | 'review-failed-capture' | 'verify-contract';
export interface MindRouterPlanAction { kind: MindRouterPlanActionKind; path: string; reason: string; targetPath?: string; risk: 'low' | 'medium' | 'high'; }
export interface MindRouterLoopPlan extends MindRouterJobResult { actions: MindRouterPlanAction[]; blockedBy: string[]; }
