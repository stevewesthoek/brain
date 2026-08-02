import { MIND_CONTRACT } from '../../../operations/specs/infinite-brain-boundary-contracts.js';
export declare const MIND_ROUTER_CONTRACT_FILES: string[];
export declare const MIND_CURRENT_SUCCESS_PATH: string;
export declare const MIND_CURRENT_FAILURE_PATH: string;
export declare const MIND_REVIEW_SURFACES: readonly string[];
export declare const MIND_HISTORICAL_ONLY_PATHS: readonly string[];
export declare const MIND_AUTHORITY_LABELS: readonly string[];
export { MIND_CONTRACT };
export declare const MIND_REQUIRED_PATHS: string[];
export declare const MIND_LIVE_FILES: string[];
export declare const MIND_REQUIRED_INDEX_FILES: string[];
export declare const MIND_LEGACY_READ_ONLY_PATHS: string[];
export declare const MIND_ANTI_CLUTTER_LIMITS: {
    readonly [x: string]: {
        readonly maxLines: 150;
        readonly maxAgeDays?: never;
    } | {
        readonly maxAgeDays: 7;
        readonly maxLines?: never;
    } | {
        readonly maxAgeDays: 3;
        readonly maxLines?: never;
    };
};
export type MindRouterJobId = 'mind-compile-loop' | 'mind-memory-loop' | 'mind-hygiene-loop' | 'mind-drift-error-loop';
export type MindRouterMode = 'dry-run' | 'write';
export type MindPathKind = 'file' | 'directory';
export interface MindPathStatus {
    path: string;
    kind: MindPathKind;
    exists: boolean;
    sizeBytes?: number;
    lineCount?: number;
    modifiedAt?: string;
    followedSymlink?: boolean;
}
export type MindSaveToMindTarget = 'inbox-new' | 'unknown';
export type MindFailureBufferStatus = 'not-configured' | 'folder-only' | 'test-verified' | 'real-error-verified' | 'unknown';
export interface MindContractSnapshot {
    paths: MindPathStatus[];
    saveToMindTarget?: MindSaveToMindTarget;
    liveDeploymentVerified?: boolean;
    failureBufferStatus?: MindFailureBufferStatus;
}
export interface MindRouterJobResult {
    jobId: MindRouterJobId;
    mode: MindRouterMode;
    ok: boolean;
    checkedPaths: string[];
    plannedWrites: string[];
    warnings: string[];
    errors: string[];
}
export interface MindContractDryRunResult extends MindRouterJobResult {
    missingRequiredPaths: string[];
    missingRouterContractFiles: string[];
    missingLiveFiles: string[];
    missingIndexFiles: string[];
    presentLegacyReadOnlyPaths: string[];
    saveToMindTarget: MindContractSnapshot['saveToMindTarget'];
    liveDeploymentVerified: boolean;
    failureBufferStatus: MindFailureBufferStatus;
    failureBufferReadyForArchivePhase: boolean;
}
export type MindRouterPlanActionKind = 'compile-capture' | 'promote-memory' | 'summarize-file' | 'split-file' | 'archive-stale-capture' | 'review-failed-capture' | 'verify-contract';
export interface MindRouterPlanAction {
    kind: MindRouterPlanActionKind;
    path: string;
    reason: string;
    targetPath?: string;
    risk: 'low' | 'medium' | 'high';
}
export interface MindRouterLoopPlan extends MindRouterJobResult {
    actions: MindRouterPlanAction[];
    blockedBy: string[];
}
