export const MAINTENANCE_SCHEMA_VERSION = '1.0' as const;

export const MAINTENANCE_REPORT_MODE = 'report-only' as const;

export const maintenanceDetectorTypes = [
  'stale-page',
  'completed-but-active',
  'source-gap',
  'duplicate-candidate',
  'contradiction-candidate',
  'capture-promotion',
] as const;

export type MaintenanceDetectorType = (typeof maintenanceDetectorTypes)[number];

export const maintenanceFindingStatuses = [
  'open',
  'accepted',
  'dismissed',
  'resolved',
  'superseded',
] as const;

export type MaintenanceFindingStatus = (typeof maintenanceFindingStatuses)[number];

export const maintenanceRiskLevels = ['low', 'medium', 'high'] as const;
export type MaintenanceRisk = (typeof maintenanceRiskLevels)[number];

export const maintenanceDetectorStatuses = ['completed', 'disabled', 'failed'] as const;
export type MaintenanceDetectorStatus = (typeof maintenanceDetectorStatuses)[number];

export interface MaintenanceEvidence {
  path: string;
  location: string;
  summary: string;
}

export interface MaintenanceReviewRecord {
  reviewedBy: string;
  reviewedAt: string;
  decision: Exclude<MaintenanceFindingStatus, 'open' | 'superseded'>;
  reason: string;
  nextAction: string;
  resolutionRef: string | null;
}

export interface MaintenanceFinding {
  id: string;
  type: MaintenanceDetectorType;
  status: MaintenanceFindingStatus;
  created: string;
  sourceRepo: 'mind';
  scope: string;
  paths: string[];
  trigger: string;
  matchedEvidence: MaintenanceEvidence[];
  comparisonEvidence: MaintenanceEvidence[];
  uncertainty: string;
  confidence: number;
  risk: MaintenanceRisk;
  recommendedAction: string;
  requiresApproval: true;
  noWritePerformed: true;
  deduplicationKey: string;
  suppressionUntil: string | null;
  review: MaintenanceReviewRecord | null;
}

export interface MaintenanceDetectorState {
  enabled: boolean;
  status: MaintenanceDetectorStatus;
}

export type MaintenanceDetectorMap = Record<MaintenanceDetectorType, MaintenanceDetectorState>;

export interface MaintenanceReportConfiguration {
  maxFiles: number;
  maxFindingsPerDetector: number;
  minimumConfidence: number;
  aiAssist: 'never' | 'when-ambiguous';
}

export interface MaintenanceReportSummary {
  filesConsidered: number;
  findingsTotal: number;
  findingsOpen: number;
  findingsAccepted: number;
  findingsDismissed: number;
  findingsResolved: number;
  findingsSuppressed: number;
  detectorErrors: number;
}

export interface MaintenanceDetectorError {
  detector: MaintenanceDetectorType;
  path: string;
  errorType: string;
  summary: string;
  retryable: boolean;
}

export interface MaintenanceSafetySummary {
  allowedOutputPaths: string[];
  sourceFilesChanged: number;
  kanbanChanged: boolean;
  captureFilesChanged: number;
  wikiFilesChanged: number;
  liveFilesChanged: number;
  archiveFilesChanged: number;
  rootFilesCreated: number;
  noWritePerformed: true;
}

export interface MaintenanceReport {
  schemaVersion: typeof MAINTENANCE_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  mode: typeof MAINTENANCE_REPORT_MODE;
  sourceRepo: 'mind';
  sourceCommit: string;
  configuration: MaintenanceReportConfiguration;
  detectors: MaintenanceDetectorMap;
  filesConsidered: string[];
  summary: MaintenanceReportSummary;
  findings: MaintenanceFinding[];
  suppressedFindings: MaintenanceFinding[];
  errors: MaintenanceDetectorError[];
  safety: MaintenanceSafetySummary;
  noWritePerformed: true;
}

export interface MaintenanceValidationIssue {
  path: string;
  message: string;
}

export type MaintenanceValidationResult =
  | { ok: true; value: MaintenanceReport }
  | { ok: false; issues: MaintenanceValidationIssue[] };
