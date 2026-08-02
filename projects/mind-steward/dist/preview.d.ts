export declare const MIND_PREVIEW_CURRENT_CONTEXT_PATH: string;
export declare const MIND_PREVIEW_ALLOWED_TARGETS: readonly string[];
export declare const MIND_PREVIEW_BLOCKED_PREFIXES: readonly string[];
export declare const MIND_PREVIEW_BLOCKED_EXACT_PATHS: readonly string[];
export declare const MIND_PREVIEW_BLOCKED_SUFFIXES: readonly string[];
export type MindPreviewOperation = 'patch' | 'overwrite' | 'create';
export type MindPreviewActionKind = 'mind-steward-update-current-context';
export interface MindPreviewApprovalRecord {
    id: string;
    kind: MindPreviewActionKind;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    expiresAt?: string;
    previewHash: string;
}
export interface MindPreviewPolicyResult {
    targetPath: string;
    allowedRoot: boolean;
    blockedRoot: boolean;
    reasons: string[];
}
export interface CreateMindWritePreviewInput {
    actionKind: MindPreviewActionKind;
    targetPath: string;
    operation: MindPreviewOperation;
    oldContent: string | null;
    newContent: string;
    now?: Date;
}
export interface MindWritePreview {
    kind: 'mind-steward-mind-preview';
    actionKind: MindPreviewActionKind;
    mindRootId: 'mind';
    targetPath: string;
    operation: MindPreviewOperation;
    allowedRoot: boolean;
    blockedRoot: boolean;
    policyReasons: string[];
    oldHash: string | null;
    newHash: string;
    lineCountBefore: number;
    lineCountAfter: number;
    maxLines: number | null;
    unifiedDiff: string;
    writesToMind: false;
    externalSideEffects: false;
    createdAt: string;
}
export interface MindWriteApplyInput {
    preview: MindWritePreview;
    approval: MindPreviewApprovalRecord | null;
    now?: Date;
}
export interface MindWriteApplyResult {
    kind: 'mind-steward-mind-apply';
    actionKind: MindPreviewActionKind;
    targetPath: string;
    applied: boolean;
    writesToMind: boolean;
    externalSideEffects: false;
    approvalId: string;
    previewHash: string;
    oldHash: string | null;
    newHash: string;
    rollback: {
        targetPath: string;
        restoreContentHash: string | null;
        validation: 'rerun-mind-steward-validation';
        instructions: string;
    };
    audit: {
        event: 'applied' | 'blocked';
        approvalId: string;
        previewHash: string;
        kind: MindPreviewActionKind;
        targetPath: string;
        writesToMind: boolean;
        externalSideEffects: false;
        status: 'ok' | 'blocked';
        appliedAt: string | null;
        oldHash: string | null;
        newHash: string;
    };
    validation: {
        accepted: boolean;
        reasons: string[];
    };
}
export interface MindPreviewArtifact {
    previewId: string;
    createdAt: string;
    expiresAt: string;
    actionKind: MindPreviewActionKind;
    targetPath: string;
    operation: MindPreviewOperation;
    oldHash: string | null;
    newHash: string;
    lineCountBefore: number;
    lineCountAfter: number;
    maxLines: number | null;
    unifiedDiff: string;
    writesToMind: false;
    externalSideEffects: false;
    policyReasons: string[];
    blockedRoot: boolean;
    allowedRoot: boolean;
}
export interface MindPreviewArtifactSummary {
    previewId: string;
    createdAt: string;
    expiresAt: string;
    actionKind: MindPreviewActionKind;
    targetPath: string;
    operation: MindPreviewOperation;
    blockedRoot: boolean;
    allowedRoot: boolean;
    expired: boolean;
    writesToMind: false;
    externalSideEffects: false;
}
export interface WriteMindPreviewArtifactInput {
    preview: MindWritePreview;
    previewId?: string;
    expiresAt?: Date;
    runtimeRoot?: string;
}
export interface WriteMindPreviewArtifactResult {
    artifact: MindPreviewArtifact;
    artifactPath: string;
    safeRoot: string;
}
export interface ListMindPreviewArtifactsInput {
    runtimeRoot?: string;
    now?: Date;
}
export interface ReadMindPreviewArtifactInput {
    previewId: string;
    runtimeRoot?: string;
    now?: Date;
}
export declare function evaluateMindPreviewPolicy(targetPath: string): MindPreviewPolicyResult;
export declare function createMindWritePreview(input: CreateMindWritePreviewInput): MindWritePreview;
export declare function applyApprovedMindWritePreview(input: MindWriteApplyInput): MindWriteApplyResult;
export declare function createMindPreviewArtifact(input: WriteMindPreviewArtifactInput): MindPreviewArtifact;
export declare function writeMindPreviewArtifact(input: WriteMindPreviewArtifactInput): WriteMindPreviewArtifactResult;
export declare function listMindPreviewArtifacts(input?: ListMindPreviewArtifactsInput): MindPreviewArtifactSummary[];
export declare function readMindPreviewArtifact(input: ReadMindPreviewArtifactInput): MindPreviewArtifactSummary | null;
