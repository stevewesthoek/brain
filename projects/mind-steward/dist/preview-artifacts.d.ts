import type { MindMaintenancePreviewQueue } from './maintenance-preview.js';
export interface WriteMaintenancePreviewArtifactInput {
    queue: MindMaintenancePreviewQueue;
    runtimeRoot?: string;
}
export interface MaintenancePreviewArtifactMeta {
    queueId: string;
    createdAt: string;
    expiresAt: string;
    actionCount: number;
    approvalRequiredCount: number;
}
export declare function writeMaintenancePreviewArtifact(input: WriteMaintenancePreviewArtifactInput): MaintenancePreviewArtifactMeta;
export interface ListMaintenancePreviewArtifactsInput {
    runtimeRoot?: string;
}
export interface MaintenancePreviewArtifactListItem {
    queueId: string;
    createdAt: string;
    expiresAt: string;
    expired: boolean;
    actionCount: number;
    approvalRequiredCount: number;
}
export declare function listMaintenancePreviewArtifacts(input: ListMaintenancePreviewArtifactsInput): MaintenancePreviewArtifactListItem[];
export interface ReadMaintenancePreviewArtifactInput {
    queueId: string;
    runtimeRoot?: string;
}
export declare function readMaintenancePreviewArtifact(input: ReadMaintenancePreviewArtifactInput): MindMaintenancePreviewQueue | null;
