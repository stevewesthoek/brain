export declare const MIND_ROUTER_CONTRACT_FILES: readonly ["router/current.md", "router/map.md", "router/rules.md", "router/taxonomy.md", "router/maintenance.md", "router/mind-steward.md"];
export declare const MIND_REQUIRED_PATHS: readonly ["HOME.md", "TODAY.md", "README.md", "AGENTS.md", "router/", "capture/inbox/", "capture/daily/", "capture/failed/", "live/", "wiki/", "sources/", "archive/"];
export declare const MIND_LIVE_FILES: readonly ["live/dashboard.md", "live/tasks.md", "live/projects.md", "live/workflows.md", "live/decisions.md"];
export declare const MIND_REQUIRED_INDEX_FILES: readonly ["capture/inbox/README.md", "capture/daily/README.md", "capture/failed/README.md", "wiki/index.md", "sources/index.md", "archive/index.md"];
export declare const MIND_LEGACY_READ_ONLY_PATHS: readonly ["01-inbox/", "02-strategy/", "03-projects/", "04-tasks/", "05-areas/", "06-resources/", "07-templates/", "08-archive/"];
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
export type MindSaveToMindTarget = 'legacy-01-inbox' | 'capture-inbox' | 'unknown';
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
export declare const MIND_ANTI_CLUTTER_LIMITS: {
    readonly 'router/current.md': {
        readonly maxLines: 150;
    };
    readonly 'TODAY.md': {
        readonly maxLines: 200;
    };
    readonly 'live/tasks.md': {
        readonly maxLines: 300;
    };
    readonly 'live/projects.md': {
        readonly maxLines: 250;
    };
    readonly 'wiki/*.md': {
        readonly maxLines: 500;
    };
    readonly 'capture/inbox/': {
        readonly maxAgeDays: 7;
    };
    readonly 'capture/failed/': {
        readonly maxAgeDays: 3;
    };
};
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
