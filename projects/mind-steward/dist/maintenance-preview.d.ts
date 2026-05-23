import type { MindWikiHealthFinding } from './wiki-health.js';
export type MindMaintenancePreviewActionKind = 'create-missing-wiki-log' | 'update-wiki-index-link' | 'add-source-trace-placeholder' | 'review-stale-capture' | 'review-failed-capture' | 'review-oversized-wiki-page' | 'review-orphan-wiki-page' | 'review-stale-claim' | 'review-broken-link' | 'no-op-info';
export type MindMaintenancePreviewRisk = 'low' | 'medium' | 'high';
export type MindMaintenancePreviewOperation = 'none' | 'create' | 'patch' | 'review';
export interface MindMaintenancePreviewAction {
    id: string;
    kind: MindMaintenancePreviewActionKind;
    targetPath: string;
    sourceFindingId: string;
    title: string;
    summary: string;
    recommendation: string;
    risk: MindMaintenancePreviewRisk;
    proposedOperation: MindMaintenancePreviewOperation;
    requiresApproval: boolean;
    blockedBy: string[];
    writesToMind: false;
    externalSideEffects: false;
}
export interface MindMaintenancePreviewQueue {
    kind: 'mind-maintenance-preview-queue';
    createdAt: string;
    source: 'wiki-health';
    actions: MindMaintenancePreviewAction[];
    summary: {
        total: number;
        lowRiskCount: number;
        mediumRiskCount: number;
        highRiskCount: number;
        approvalRequiredCount: number;
        blockedCount: number;
    };
    writesToMind: false;
    externalSideEffects: false;
}
export declare function createMindMaintenancePreviewQueueFromFindings(findings: MindWikiHealthFinding[], now?: Date): MindMaintenancePreviewQueue;
