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

const GRAPHIFY_REPORT_DEFINITIONS = [
  { key: 'mindKnowledge', fileName: 'mind-knowledge-latest.json' },
  { key: 'brainRuntime', fileName: 'brain-runtime-latest.json' },
] as const;

export function getGraphifyStatus() {
  const reports = Object.fromEntries(
    GRAPHIFY_REPORT_DEFINITIONS.map(({ key, fileName }) => {
      const report = readGraphifyRuntimeReport(fileName);
      return [
        key,
        {
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
        },
      ];
    }),
  );

  const availableCount = Object.values(reports).filter(report => report.available).length;

  return {
    status: availableCount === 0 ? 'missing' : availableCount === GRAPHIFY_REPORT_DEFINITIONS.length ? 'ok' : 'partial',
    source: 'runtime/local/graphify',
    reportCount: GRAPHIFY_REPORT_DEFINITIONS.length,
    availableCount,
    reports,
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
