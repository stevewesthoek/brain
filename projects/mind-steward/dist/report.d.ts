import type { MindContractDryRunResult, MindContractSnapshot, MindRouterLoopPlan } from './contracts.js';
import { type MindWikiHealthResult } from './wiki-health.js';
export interface MindStewardDryRunReport {
    generatedAt: string;
    mode: 'dry-run-report-only';
    writesToMind: false;
    executableActions: false;
    validationStatus: 'ok' | 'blocked' | 'failed';
    contractSummary: {
        ok: boolean;
        missingRequiredPathCount: number;
        missingRouterContractFileCount: number;
        missingLiveFileCount: number;
        missingIndexFileCount: number;
        failureBufferStatus: MindContractDryRunResult['failureBufferStatus'];
        failureBufferReadyForArchivePhase: boolean;
    };
    loopPlans: MindRouterLoopPlan[];
    actionCountsByKind: Record<string, number>;
    blockersByLoop: Record<string, string[]>;
    warningsByLoop: Record<string, string[]>;
    snapshotStats: {
        pathCount: number;
        existingPathCount: number;
        missingPathCount: number;
        failedCaptureCount: number;
        captureInboxCount: number;
        oldestCaptureInboxAgeDays?: number;
    };
    wikiHealth: MindStewardWikiHealthReport;
    maintenancePreview: MindStewardMaintenancePreviewMetadata;
}
export interface MindStewardWikiHealthReport {
    status: 'available' | 'unavailable';
    checkedAt?: string;
    ok: boolean;
    summary: MindWikiHealthResult['summary'];
    findings: Array<Pick<MindWikiHealthResult['findings'][number], 'id' | 'severity' | 'path' | 'message' | 'recommendation'>>;
}
export interface MindStewardMaintenancePreviewMetadata {
    status: 'available' | 'unavailable';
    actionCount: number;
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
    approvalRequiredCount: number;
    topActions: Array<{
        kind: string;
        title: string;
        risk: string;
    }>;
    writesToMind: false;
    externalSideEffects: false;
}
export declare function createMindStewardDryRunReport(snapshot: MindContractSnapshot, now?: Date): MindStewardDryRunReport;
