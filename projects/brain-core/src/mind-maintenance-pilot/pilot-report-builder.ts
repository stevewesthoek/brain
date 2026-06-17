import { detectCompletedActiveFinding } from './completed-active-detector.js';
import {
  detectContradictionFindings,
  type ContradictionCandidate,
} from './contradiction-detector.js';
import {
  detectCapturePromotionFindings,
  type CapturePromotionCandidate,
} from './capture-promotion-detector.js';
import { applyMaintenanceFindingDecisions } from './finding-decision-applier.js';
import type {
  MaintenanceFindingDecision,
  MaintenanceFindingDecisionDocument,
} from './finding-decision-store.js';
import {
  MIND_MAINTENANCE_PILOT_CONFIG,
  MIND_MAINTENANCE_PILOT_FILES,
  MIND_MAINTENANCE_REPORT_OUTPUTS,
  type LoadedMindMaintenancePilotDataset,
  type MindMaintenancePilotFile,
} from './pilot-file-loader.js';
import { assertValidMaintenanceReport } from './report-schema-validator.js';
import {
  detectSourceGapFindings,
  type SourceGapCandidate,
} from './source-gap-detector.js';
import { detectStalePageFinding } from './stale-page-detector.js';
import type {
  MaintenanceDetectorError,
  MaintenanceDetectorMap,
  MaintenanceFinding,
  MaintenanceReport,
  MaintenanceReportSummary,
} from './types.js';

export interface MindMaintenancePilotBuildInput {
  dataset: LoadedMindMaintenancePilotDataset;
  sourceCommit: string;
  generatedAt: string;
  generatedBy?: string;
  sourceGapCandidates?: Partial<Record<MindMaintenancePilotFile, readonly SourceGapCandidate[]>>;
  contradictionCandidates?: readonly ContradictionCandidate[];
  capturePromotionCandidates?: readonly CapturePromotionCandidate[];
  detectorErrors?: readonly MaintenanceDetectorError[];
  decisionDocument?: MaintenanceFindingDecisionDocument;
}

export interface MindMaintenancePilotBuildResult {
  report: MaintenanceReport;
  ambiguousSourceGapCandidates: SourceGapCandidate[];
  excludedSourceGapCandidates: SourceGapCandidate[];
  unmatchedDecisions: MaintenanceFindingDecision[];
}

function reportDateFromTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Mind maintenance report requires an ISO generatedAt timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function assertDatasetBoundary(dataset: LoadedMindMaintenancePilotDataset): void {
  if (dataset.files.length !== MIND_MAINTENANCE_PILOT_FILES.length) {
    throw new Error(`Mind maintenance report requires exactly ${MIND_MAINTENANCE_PILOT_FILES.length} files.`);
  }

  const paths = dataset.files.map((file) => file.path);
  const uniquePaths = new Set(paths);
  if (uniquePaths.size !== MIND_MAINTENANCE_PILOT_FILES.length) {
    throw new Error('Mind maintenance report dataset contains duplicate paths.');
  }

  for (const requiredPath of MIND_MAINTENANCE_PILOT_FILES) {
    if (!uniquePaths.has(requiredPath)) {
      throw new Error(`Mind maintenance report dataset is missing required path: ${requiredPath}`);
    }
  }
}

function normalizeDuplicateContent(content: string): string {
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return withoutFrontmatter
    .replace(/^#\s+.+$/m, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function detectDuplicatePageFindings(
  files: LoadedMindMaintenancePilotDataset['files'],
  reportDate: string,
): MaintenanceFinding[] {
  const byContent = new Map<string, typeof files>();

  for (const file of files) {
    const normalized = normalizeDuplicateContent(file.content);
    if (normalized.length < 120) continue;
    const group = byContent.get(normalized) ?? [];
    byContent.set(normalized, [...group, file]);
  }

  return [...byContent.values()]
    .filter((group) => group.length > 1)
    .map((group, index) => {
      const paths = group.map((file) => file.path).sort();
      const fingerprint = paths.join('|').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 96);

      return {
        id: `finding-duplicate-candidate-${fingerprint || index + 1}`,
        type: 'duplicate-candidate',
        status: 'open',
        created: reportDate,
        sourceRepo: 'mind',
        scope: 'bounded five-file maintenance pilot',
        paths,
        trigger: 'Two or more pilot pages have the same normalized substantive Markdown content.',
        matchedEvidence: group.map((file) => ({
          path: file.path,
          location: 'full page after frontmatter and title normalization',
          summary: 'Normalized substantive content matches another page in the bounded pilot dataset.',
        })),
        comparisonEvidence: group.map((file) => ({
          path: file.path,
          location: 'full page',
          summary: `Candidate duplicate page: ${file.path}`,
        })),
        uncertainty: 'Exact normalized content match is strong evidence of duplication, but a human must choose the canonical page and preservation action.',
        confidence: 0.98,
        risk: 'low',
        recommendedAction: 'Review the matching pages, choose the canonical page, preserve useful links and history, and approve any merge or supersession explicitly.',
        requiresApproval: true,
        noWritePerformed: true,
        deduplicationKey: `duplicate-candidate:${paths.join('|')}`,
        suppressionUntil: null,
        review: null,
      } satisfies MaintenanceFinding;
    });
}

function createDetectorMap(errors: readonly MaintenanceDetectorError[]): MaintenanceDetectorMap {
  const failed = new Set(errors.map((error) => error.detector));

  return {
    'stale-page': {
      enabled: true,
      status: failed.has('stale-page') ? 'failed' : 'completed',
    },
    'completed-but-active': {
      enabled: true,
      status: failed.has('completed-but-active') ? 'failed' : 'completed',
    },
    'source-gap': {
      enabled: true,
      status: failed.has('source-gap') ? 'failed' : 'completed',
    },
    'duplicate-candidate': {
      enabled: true,
      status: failed.has('duplicate-candidate') ? 'failed' : 'completed',
    },
    'contradiction-candidate': {
      enabled: true,
      status: failed.has('contradiction-candidate') ? 'failed' : 'completed',
    },
    'capture-promotion': {
      enabled: true,
      status: failed.has('capture-promotion') ? 'failed' : 'completed',
    },
  };
}

function createSummary(
  filesConsidered: number,
  findings: readonly MaintenanceFinding[],
  suppressedFindings: readonly MaintenanceFinding[],
  errors: readonly MaintenanceDetectorError[],
): MaintenanceReportSummary {
  return {
    filesConsidered,
    findingsTotal: findings.length,
    findingsOpen: findings.filter((finding) => finding.status === 'open').length,
    findingsAccepted: findings.filter((finding) => finding.status === 'accepted').length,
    findingsDismissed: findings.filter((finding) => finding.status === 'dismissed').length,
    findingsResolved: findings.filter((finding) => finding.status === 'resolved').length,
    findingsSuppressed: suppressedFindings.length,
    detectorErrors: errors.length,
  };
}

function createReportId(generatedAt: string): string {
  const normalized = new Date(generatedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `mind-maintenance-${normalized}`;
}

export function buildMindMaintenancePilotReport(
  input: MindMaintenancePilotBuildInput,
): MindMaintenancePilotBuildResult {
  assertDatasetBoundary(input.dataset);
  if (!input.sourceCommit.trim()) {
    throw new Error('Mind maintenance report requires a source commit.');
  }

  const reportDate = reportDateFromTimestamp(input.generatedAt);
  const errors = [...(input.detectorErrors ?? [])];
  const detectors = createDetectorMap(errors);
  const detectedFindings: MaintenanceFinding[] = [];
  const ambiguousSourceGapCandidates: SourceGapCandidate[] = [];
  const excludedSourceGapCandidates: SourceGapCandidate[] = [];

  for (const file of input.dataset.files) {
    if (detectors['stale-page'].status !== 'failed') {
      const finding = detectStalePageFinding({ file, reportDate });
      if (finding) detectedFindings.push(finding);
    }

    if (detectors['completed-but-active'].status !== 'failed') {
      const finding = detectCompletedActiveFinding({ file, reportDate });
      if (finding) detectedFindings.push(finding);
    }

    if (detectors['source-gap'].status !== 'failed') {
      const result = detectSourceGapFindings({
        file,
        reportDate,
        candidates: input.sourceGapCandidates?.[file.path] ?? [],
      });
      detectedFindings.push(...result.findings);
      ambiguousSourceGapCandidates.push(...result.ambiguousCandidates);
      excludedSourceGapCandidates.push(...result.excludedCandidates);
    }
  }

  if (detectors['duplicate-candidate'].status !== 'failed') {
    detectedFindings.push(...detectDuplicatePageFindings(input.dataset.files, reportDate));
  }

  if (detectors['contradiction-candidate'].status !== 'failed') {
    detectedFindings.push(...detectContradictionFindings({
      dataset: input.dataset,
      reportDate,
      candidates: input.contradictionCandidates ?? [],
    }));
  }

  if (detectors['capture-promotion'].status !== 'failed') {
    detectedFindings.push(...detectCapturePromotionFindings({
      reportDate,
      candidates: input.capturePromotionCandidates ?? [],
    }));
  }

  const decisionApplication = input.decisionDocument
    ? applyMaintenanceFindingDecisions({
        findings: detectedFindings,
        decisions: input.decisionDocument,
        reportDate,
      })
    : {
        findings: detectedFindings,
        suppressedFindings: [] as MaintenanceFinding[],
        unmatchedDecisions: [] as MaintenanceFindingDecision[],
      };

  const findings = decisionApplication.findings;
  const suppressedFindings = decisionApplication.suppressedFindings;
  const report: MaintenanceReport = {
    schemaVersion: '1.0',
    reportId: createReportId(input.generatedAt),
    generatedAt: new Date(input.generatedAt).toISOString(),
    generatedBy: input.generatedBy?.trim() || 'brain/mind-steward',
    mode: 'report-only',
    sourceRepo: 'mind',
    sourceCommit: input.sourceCommit.trim(),
    configuration: {
      maxFiles: MIND_MAINTENANCE_PILOT_CONFIG.maxFiles,
      maxFindingsPerDetector: MIND_MAINTENANCE_PILOT_CONFIG.maxFindingsPerDetector,
      minimumConfidence: MIND_MAINTENANCE_PILOT_CONFIG.minimumConfidence,
      aiAssist: MIND_MAINTENANCE_PILOT_CONFIG.aiAssist,
    },
    detectors,
    filesConsidered: [...MIND_MAINTENANCE_PILOT_FILES],
    summary: createSummary(input.dataset.files.length, findings, suppressedFindings, errors),
    findings,
    suppressedFindings,
    errors,
    safety: {
      allowedOutputPaths: [...MIND_MAINTENANCE_REPORT_OUTPUTS],
      sourceFilesChanged: 0,
      kanbanChanged: false,
      captureFilesChanged: 0,
      wikiFilesChanged: 0,
      liveFilesChanged: 0,
      archiveFilesChanged: 0,
      rootFilesCreated: 0,
      noWritePerformed: true,
    },
    noWritePerformed: true,
  };

  assertValidMaintenanceReport(report);

  return {
    report,
    ambiguousSourceGapCandidates,
    excludedSourceGapCandidates,
    unmatchedDecisions: decisionApplication.unmatchedDecisions,
  };
}
