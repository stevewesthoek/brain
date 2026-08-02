export type MindCaptureParaType = 'project' | 'area' | 'resource' | 'task' | 'decision' | 'research' | 'inbox';
export type MindCaptureClassification = {
    title: string;
    para_type: MindCaptureParaType;
    confidence: number;
    signal_quality: number;
    summary: string;
    key_points: string[];
    tags: string[];
};
export type MindCaptureClassificationResult = {
    file: string;
    status: 'classified' | 'skipped' | 'failed';
    reason?: string;
    classification?: MindCaptureClassification;
};
export type MindCaptureExecutionMode = 'dry-run' | 'apply';
export type MindCaptureClassificationRun = {
    ok: boolean;
    mindRoot: string;
    selectorUrl: string;
    mode: MindCaptureExecutionMode;
    writesToMind: false;
    executableActions: false;
    processed: number;
    classified: number;
    skipped: number;
    failed: number;
    results: MindCaptureClassificationResult[];
};
export declare function classifyMindCaptureInbox(input: {
    mindRoot: string;
    selectorUrl?: string;
    limit?: number;
    mode?: MindCaptureExecutionMode;
    dryRun?: boolean;
}): Promise<MindCaptureClassificationRun>;
export declare function resolveMindCaptureExecutionMode(input: {
    mode?: string;
    dryRun?: boolean;
}): MindCaptureExecutionMode;
export declare function discoverMindFailedCaptures(mindRoot: string, limit?: number): string[];
