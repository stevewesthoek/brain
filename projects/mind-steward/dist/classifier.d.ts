declare const APPROVED_BEDROCK_PROVIDER = "claude-bedrock";
declare const APPROVED_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6";
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
export type MindBedrockRoute = {
    provider_id: typeof APPROVED_BEDROCK_PROVIDER;
    model: typeof APPROVED_BEDROCK_MODEL;
    timeout_inference_sec: number;
    region: string;
};
export type MindBedrockExecFile = (file: string, args: string[], options: {
    encoding: 'utf8';
    timeout: number;
    maxBuffer: number;
    windowsHide: boolean;
}, callback: (error: Error | null, stdout: string, stderr: string) => void) => void;
export declare function classifyMindCaptureInbox(input: {
    mindRoot: string;
    selectorUrl?: string;
    limit?: number;
    mode?: MindCaptureExecutionMode;
    dryRun?: boolean;
    bedrockConverse?: (route: MindBedrockRoute, prompt: string) => Promise<string>;
}): Promise<MindCaptureClassificationRun>;
export declare function resolveMindCaptureExecutionMode(input: {
    mode?: string;
    dryRun?: boolean;
}): MindCaptureExecutionMode;
export declare function discoverMindFailedCaptures(mindRoot: string, limit?: number): string[];
export declare function converseWithBedrockAws(route: MindBedrockRoute, prompt: string, runExecFile?: MindBedrockExecFile): Promise<string>;
export {};
