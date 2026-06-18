import fs from 'node:fs';
import path from 'node:path';

interface GraphifyRuntimeReport {
  status?: string;
  generatedAt?: string;
  mode?: string;
  repo?: {
    path?: string;
  };
  profile?: {
    name?: string;
    repoRole?: string;
    modes?: string[];
  };
  execution?: {
    operation?: string;
    executeRequested?: boolean;
    executionEnabled?: boolean;
    plannedOnly?: boolean;
    graphifyCommand?: string | null;
    blockedReason?: string | null;
    selector?: {
      status?: string;
      resolutionRequested?: boolean;
      resolutionEnabled?: boolean;
      selectedProvider?: string | null;
      selectedModel?: string | null;
      blockedReason?: string | null;
      error?: string | null;
    };
  };
  outputValidation?: {
    status?: string;
    requiredCount?: number;
    availableCount?: number;
    missing?: string[];
  };
  safety?: {
    runsGraphify?: boolean;
    callsAiModelSelector?: boolean;
    writesTargetRepo?: boolean;
    hardcodesModelFallback?: boolean;
  };
}

export type GraphifyStatusReportKey = 'mindKnowledge' | 'brainRuntime';

export interface GraphifyStatusReport {
  available: boolean;
  fileName: 'mind-knowledge-latest.json' | 'brain-runtime-latest.json';
  status: string;
  generatedAt: string | null;
  repoPath: string | null;
  profile: string | null;
  repoRole: string | null;
  modes: string[];
  operation: string | null;
  executeRequested: boolean | null;
  executionEnabled: boolean | null;
  plannedOnly: boolean | null;
  graphifyCommand: string | null;
  blockedReason: string | null;
  selectorStatus: string | null;
  selectorResolutionRequested: boolean | null;
  selectorResolutionEnabled: boolean | null;
  selectedProvider: string | null;
  selectedModel: string | null;
  outputValidation: GraphifyRuntimeReport['outputValidation'] | null;
  safety: GraphifyRuntimeReport['safety'] | null;
}

export interface GraphifyStatus {
  status: 'missing' | 'partial' | 'ok';
  source: 'runtime/local/graphify';
  reportCount: 2;
  availableCount: number;
  reports: Record<GraphifyStatusReportKey, GraphifyStatusReport>;
}

const GRAPHIFY_REPORT_DEFINITIONS = [
  { key: 'mindKnowledge', fileName: 'mind-knowledge-latest.json' },
  { key: 'brainRuntime', fileName: 'brain-runtime-latest.json' },
] as const;

export function getGraphifyStatus(): GraphifyStatus {
  const reports = {
    mindKnowledge: readGraphifyStatusReport('mind-knowledge-latest.json'),
    brainRuntime: readGraphifyStatusReport('brain-runtime-latest.json'),
  };
  const availableCount = Object.values(reports).filter(report => report.available).length;

  return {
    status: availableCount === 0 ? 'missing' : availableCount === GRAPHIFY_REPORT_DEFINITIONS.length ? 'ok' : 'partial',
    source: 'runtime/local/graphify',
    reportCount: GRAPHIFY_REPORT_DEFINITIONS.length,
    availableCount,
    reports,
  };
}

function readGraphifyStatusReport(fileName: GraphifyStatusReport['fileName']): GraphifyStatusReport {
  const report = readGraphifyRuntimeReport(fileName);
  return {
    available: Boolean(report),
    fileName,
    status: report?.status ?? 'missing',
    generatedAt: report?.generatedAt ?? null,
    repoPath: report?.repo?.path ?? null,
    profile: report?.profile?.name ?? null,
    repoRole: report?.profile?.repoRole ?? null,
    modes: report?.profile?.modes ?? [],
    operation: report?.execution?.operation ?? null,
    executeRequested: report?.execution?.executeRequested ?? null,
    executionEnabled: report?.execution?.executionEnabled ?? null,
    plannedOnly: report?.execution?.plannedOnly ?? null,
    graphifyCommand: report?.execution?.graphifyCommand ?? null,
    blockedReason: report?.execution?.blockedReason ?? null,
    selectorStatus: report?.execution?.selector?.status ?? null,
    selectorResolutionRequested: report?.execution?.selector?.resolutionRequested ?? null,
    selectorResolutionEnabled: report?.execution?.selector?.resolutionEnabled ?? null,
    selectedProvider: report?.execution?.selector?.selectedProvider ?? null,
    selectedModel: report?.execution?.selector?.selectedModel ?? null,
    outputValidation: report?.outputValidation ?? null,
    safety: report?.safety ?? null,
  };
}

function readGraphifyRuntimeReport(fileName: string): GraphifyRuntimeReport | null {
  try {
    const fullPath = path.resolve(process.cwd(), '../..', 'runtime/local/graphify', fileName);
    if (!fs.existsSync(fullPath)) return null;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as GraphifyRuntimeReport;
  } catch {
    return null;
  }
}
