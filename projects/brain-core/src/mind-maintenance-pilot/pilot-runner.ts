import { loadMindMaintenancePilotDataset } from './pilot-file-loader.js';
import {
  buildMindMaintenancePilotReport,
  type MindMaintenancePilotBuildInput,
} from './pilot-report-builder.js';
import { writeMindMaintenanceLatestReports } from './report-writer.js';
import {
  captureMindMaintenanceIntegritySnapshot,
  compareMindMaintenanceIntegritySnapshots,
  type MindMaintenanceIntegrityResult,
} from './source-integrity-validator.js';
import type { MaintenanceDetectorError } from './types.js';
import type { SourceGapCandidate } from './source-gap-detector.js';
import type { MindMaintenancePilotFile } from './pilot-file-loader.js';

export interface MindMaintenancePilotRunnerInput {
  enabled: boolean;
  mindRoot: string;
  sourceCommit: string;
  generatedAt: string;
  generatedBy?: string;
  sourceGapCandidates?: Partial<Record<MindMaintenancePilotFile, readonly SourceGapCandidate[]>>;
  detectorErrors?: readonly MaintenanceDetectorError[];
  listChangedPaths: () => Promise<readonly string[]>;
}

export interface MindMaintenancePilotRunnerSuccess {
  ok: true;
  status: 'completed';
  mode: 'report-only';
  reportId: string;
  sourceCommit: string;
  filesConsidered: 5;
  findingsTotal: number;
  detectorErrors: number;
  reports: [string, string];
  sourceFilesChanged: 0;
  integrity: MindMaintenanceIntegrityResult;
  nextAction: 'Review the Markdown report.';
}

export interface MindMaintenancePilotRunnerFailure {
  ok: false;
  status: 'disabled' | 'integrity-failed';
  mode: 'report-only';
  reportId?: string;
  sourceCommit: string;
  integrity?: MindMaintenanceIntegrityResult;
  error: string;
  nextAction: string;
}

export type MindMaintenancePilotRunnerResult =
  | MindMaintenancePilotRunnerSuccess
  | MindMaintenancePilotRunnerFailure;

function normalizeChangedPaths(paths: readonly string[]): Set<string> {
  return new Set(
    paths
      .map((changedPath) => changedPath.trim().replaceAll('\\', '/'))
      .filter((changedPath) => changedPath.length > 0),
  );
}

function findNewlyChangedPaths(
  before: readonly string[],
  after: readonly string[],
): string[] {
  const beforeSet = normalizeChangedPaths(before);
  return [...normalizeChangedPaths(after)].filter((changedPath) => !beforeSet.has(changedPath));
}

export async function runMindMaintenancePilot(
  input: MindMaintenancePilotRunnerInput,
): Promise<MindMaintenancePilotRunnerResult> {
  if (!input.enabled) {
    return {
      ok: false,
      status: 'disabled',
      mode: 'report-only',
      sourceCommit: input.sourceCommit,
      error: 'Mind maintenance pilot is disabled by default and requires explicit invocation.',
      nextAction: 'Enable only the bounded report-only pilot for one explicit run.',
    };
  }

  const preRunChangedPaths = await input.listChangedPaths();
  const dataset = await loadMindMaintenancePilotDataset(input.mindRoot);
  const beforeIntegrity = await captureMindMaintenanceIntegritySnapshot(dataset);

  const buildInput: MindMaintenancePilotBuildInput = {
    dataset,
    sourceCommit: input.sourceCommit,
    generatedAt: input.generatedAt,
    ...(input.generatedBy === undefined ? {} : { generatedBy: input.generatedBy }),
    ...(input.sourceGapCandidates === undefined
      ? {}
      : { sourceGapCandidates: input.sourceGapCandidates }),
    ...(input.detectorErrors === undefined ? {} : { detectorErrors: input.detectorErrors }),
  };

  const { report } = buildMindMaintenancePilotReport(buildInput);
  const writeResult = await writeMindMaintenanceLatestReports({ dataset, report });

  const afterIntegrity = await captureMindMaintenanceIntegritySnapshot(dataset);
  const postRunChangedPaths = await input.listChangedPaths();
  const newlyChangedPaths = findNewlyChangedPaths(preRunChangedPaths, postRunChangedPaths);
  const integrity = compareMindMaintenanceIntegritySnapshots(
    beforeIntegrity,
    afterIntegrity,
    newlyChangedPaths,
  );

  if (!integrity.ok) {
    return {
      ok: false,
      status: 'integrity-failed',
      mode: 'report-only',
      reportId: report.reportId,
      sourceCommit: report.sourceCommit,
      integrity,
      error: 'Mind maintenance pilot introduced or observed a protected source change.',
      nextAction: 'Inspect integrity failures before treating the generated reports as valid.',
    };
  }

  return {
    ok: true,
    status: 'completed',
    mode: 'report-only',
    reportId: report.reportId,
    sourceCommit: report.sourceCommit,
    filesConsidered: 5,
    findingsTotal: report.summary.findingsTotal,
    detectorErrors: report.summary.detectorErrors,
    reports: [writeResult.jsonPath, writeResult.markdownPath],
    sourceFilesChanged: 0,
    integrity,
    nextAction: 'Review the Markdown report.',
  };
}
