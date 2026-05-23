export type MindWikiHealthSeverity = 'info' | 'warning' | 'error';
export interface MindWikiHealthFinding {
    id: string;
    severity: MindWikiHealthSeverity;
    path: string;
    message: string;
    recommendation: string;
    writesToMind: false;
}
export interface MindWikiHealthSummary {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    staleCaptureCount: number;
    failedCaptureCount: number;
    oversizedWikiPageCount: number;
    missingSourceTraceCount: number;
}
export interface MindWikiHealthResult {
    kind: 'mind-wiki-health';
    ok: boolean;
    checkedAt: string;
    checkedPaths: string[];
    findings: MindWikiHealthFinding[];
    summary: MindWikiHealthSummary;
    writesToMind: false;
    externalSideEffects: false;
}
export declare function createMindWikiHealthResultFromRoot(rootPath: string, now?: Date): MindWikiHealthResult;
