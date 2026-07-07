import {
  MAINTENANCE_REPORT_MODE,
  MAINTENANCE_SCHEMA_VERSION,
  maintenanceDetectorStatuses,
  maintenanceDetectorTypes,
  maintenanceFindingStatuses,
  maintenanceRiskLevels,
  type MaintenanceDetectorType,
  type MaintenanceFinding,
  type MaintenanceReport,
  type MaintenanceValidationIssue,
  type MaintenanceValidationResult,
} from './types.js';
import {
  MIND_MAINTENANCE_COMPATIBLE_PILOT_FILES,
  MIND_MAINTENANCE_PILOT_FILE_GROUPS,
  MIND_MAINTENANCE_REPORT_OUTPUTS,
  mindMaintenancePilotGroupForPath,
  type MindMaintenancePilotFile,
} from './pilot-file-loader.js';

const PILOT_FILE_COUNT = MIND_MAINTENANCE_PILOT_FILE_GROUPS.length;
const COMPATIBLE_PILOT_FILES = MIND_MAINTENANCE_COMPATIBLE_PILOT_FILES;
const ALLOWED_OUTPUT_PATHS = MIND_MAINTENANCE_REPORT_OUTPUTS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function pushIssue(issues: MaintenanceValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function validateEvidence(
  value: unknown,
  path: string,
  issues: MaintenanceValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isNonEmptyString(value.path)) pushIssue(issues, `${path}.path`, 'must be a non-empty string');
  if (!isNonEmptyString(value.location)) pushIssue(issues, `${path}.location`, 'must be a non-empty string');
  if (!isNonEmptyString(value.summary)) pushIssue(issues, `${path}.summary`, 'must be a non-empty string');
}

function validateReview(
  value: unknown,
  status: unknown,
  path: string,
  issues: MaintenanceValidationIssue[],
): void {
  if (value === null) {
    if (status !== 'open') pushIssue(issues, path, 'must be present for reviewed findings');
    return;
  }

  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object or null');
    return;
  }

  if (!isNonEmptyString(value.reviewedBy)) pushIssue(issues, `${path}.reviewedBy`, 'must be a non-empty string');
  if (!isIsoDateTime(value.reviewedAt)) pushIssue(issues, `${path}.reviewedAt`, 'must be an ISO date-time');
  if (!['accepted', 'dismissed', 'resolved'].includes(String(value.decision))) {
    pushIssue(issues, `${path}.decision`, 'must be accepted, dismissed, or resolved');
  }
  if (!isNonEmptyString(value.reason)) pushIssue(issues, `${path}.reason`, 'must be a non-empty string');
  if (!isNonEmptyString(value.nextAction)) pushIssue(issues, `${path}.nextAction`, 'must be a non-empty string');
  if (!(value.resolutionRef === null || isNonEmptyString(value.resolutionRef))) {
    pushIssue(issues, `${path}.resolutionRef`, 'must be a non-empty string or null');
  }

  if (status === 'open') pushIssue(issues, path, 'must be null for open findings');
  if (status !== value.decision && status !== 'superseded') {
    pushIssue(issues, `${path}.decision`, 'must match the finding status');
  }
}

function validateFinding(
  value: unknown,
  path: string,
  detectors: Record<string, unknown> | null,
  issues: MaintenanceValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isNonEmptyString(value.id)) pushIssue(issues, `${path}.id`, 'must be a non-empty string');
  if (!maintenanceDetectorTypes.includes(value.type as MaintenanceDetectorType)) {
    pushIssue(issues, `${path}.type`, 'must be a supported detector type');
  }
  if (!maintenanceFindingStatuses.includes(value.status as never)) {
    pushIssue(issues, `${path}.status`, 'must be a supported finding status');
  }
  if (!isIsoDate(value.created)) pushIssue(issues, `${path}.created`, 'must be an ISO date');
  if (value.sourceRepo !== 'mind') pushIssue(issues, `${path}.sourceRepo`, 'must equal mind');
  if (!isNonEmptyString(value.scope)) pushIssue(issues, `${path}.scope`, 'must be a non-empty string');
  if (!isStringArray(value.paths) || value.paths.length === 0) {
    pushIssue(issues, `${path}.paths`, 'must contain at least one exact path');
  } else {
    for (const findingPath of value.paths) {
      const isPilotPath = COMPATIBLE_PILOT_FILES.includes(findingPath as MindMaintenancePilotFile);
      const isCapturePromotionPath = value.type === 'capture-promotion'
        && (findingPath.startsWith('capture/') || findingPath.startsWith('inbox/'));
      if (!isPilotPath && !isCapturePromotionPath) {
        pushIssue(issues, `${path}.paths`, `contains path outside the pilot boundary: ${findingPath}`);
      }
    }
  }
  if (!isNonEmptyString(value.trigger)) pushIssue(issues, `${path}.trigger`, 'must be a non-empty string');

  if (!Array.isArray(value.matchedEvidence) || value.matchedEvidence.length === 0) {
    pushIssue(issues, `${path}.matchedEvidence`, 'must contain at least one evidence item');
  } else {
    value.matchedEvidence.forEach((item, index) => validateEvidence(item, `${path}.matchedEvidence[${index}]`, issues));
  }

  if (!Array.isArray(value.comparisonEvidence)) {
    pushIssue(issues, `${path}.comparisonEvidence`, 'must be an array');
  } else {
    value.comparisonEvidence.forEach((item, index) =>
      validateEvidence(item, `${path}.comparisonEvidence[${index}]`, issues),
    );
  }

  if (!isNonEmptyString(value.uncertainty)) pushIssue(issues, `${path}.uncertainty`, 'must be a non-empty string');
  if (!isFiniteNumber(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    pushIssue(issues, `${path}.confidence`, 'must be between 0 and 1');
  }
  if (!maintenanceRiskLevels.includes(value.risk as never)) {
    pushIssue(issues, `${path}.risk`, 'must be low, medium, or high');
  }
  if (!isNonEmptyString(value.recommendedAction)) {
    pushIssue(issues, `${path}.recommendedAction`, 'must be a non-empty string');
  }
  if (value.requiresApproval !== true) pushIssue(issues, `${path}.requiresApproval`, 'must equal true');
  if (value.noWritePerformed !== true) pushIssue(issues, `${path}.noWritePerformed`, 'must equal true');
  if (!isNonEmptyString(value.deduplicationKey)) {
    pushIssue(issues, `${path}.deduplicationKey`, 'must be a non-empty string');
  }
  if (!(value.suppressionUntil === null || isIsoDate(value.suppressionUntil))) {
    pushIssue(issues, `${path}.suppressionUntil`, 'must be an ISO date or null');
  }

  validateReview(value.review, value.status, `${path}.review`, issues);

  if (detectors && maintenanceDetectorTypes.includes(value.type as MaintenanceDetectorType)) {
    const detector = detectors[value.type as string];
    if (!isRecord(detector) || detector.enabled !== true) {
      pushIssue(issues, `${path}.type`, 'cannot reference a disabled or missing detector');
    }
  }
}

function validateDetectorMap(value: unknown, issues: MaintenanceValidationIssue[]): Record<string, unknown> | null {
  if (!isRecord(value)) {
    pushIssue(issues, 'detectors', 'must be an object');
    return null;
  }

  for (const detectorType of maintenanceDetectorTypes) {
    const detector = value[detectorType];
    const path = `detectors.${detectorType}`;
    if (!isRecord(detector)) {
      pushIssue(issues, path, 'must be an object');
      continue;
    }
    if (typeof detector.enabled !== 'boolean') pushIssue(issues, `${path}.enabled`, 'must be a boolean');
    if (!maintenanceDetectorStatuses.includes(detector.status as never)) {
      pushIssue(issues, `${path}.status`, 'must be completed, disabled, or failed');
    }
    if (detector.enabled === false && detector.status !== 'disabled') {
      pushIssue(issues, `${path}.status`, 'must be disabled when detector is not enabled');
    }
    if (detector.enabled === true && detector.status === 'disabled') {
      pushIssue(issues, `${path}.status`, 'cannot be disabled when detector is enabled');
    }
  }

  return value;
}

function validateSummary(value: unknown, issues: MaintenanceValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, 'summary', 'must be an object');
    return;
  }

  for (const field of [
    'filesConsidered',
    'findingsTotal',
    'findingsOpen',
    'findingsAccepted',
    'findingsDismissed',
    'findingsResolved',
    'findingsSuppressed',
    'detectorErrors',
  ]) {
    if (!isNonNegativeInteger(value[field])) pushIssue(issues, `summary.${field}`, 'must be a non-negative integer');
  }
}

function validateConfiguration(value: unknown, issues: MaintenanceValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, 'configuration', 'must be an object');
    return;
  }

  if (!isNonNegativeInteger(value.maxFiles) || value.maxFiles !== PILOT_FILE_COUNT) {
    pushIssue(issues, 'configuration.maxFiles', `must equal ${PILOT_FILE_COUNT}`);
  }
  if (!isNonNegativeInteger(value.maxFindingsPerDetector) || value.maxFindingsPerDetector < 1) {
    pushIssue(issues, 'configuration.maxFindingsPerDetector', 'must be a positive integer');
  }
  if (!isFiniteNumber(value.minimumConfidence) || value.minimumConfidence < 0 || value.minimumConfidence > 1) {
    pushIssue(issues, 'configuration.minimumConfidence', 'must be between 0 and 1');
  }
  if (!['never', 'when-ambiguous'].includes(String(value.aiAssist))) {
    pushIssue(issues, 'configuration.aiAssist', 'must be never or when-ambiguous');
  }
}

function validateErrors(value: unknown, issues: MaintenanceValidationIssue[]): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'errors', 'must be an array');
    return;
  }

  value.forEach((error, index) => {
    const path = `errors[${index}]`;
    if (!isRecord(error)) {
      pushIssue(issues, path, 'must be an object');
      return;
    }
    if (!maintenanceDetectorTypes.includes(error.detector as MaintenanceDetectorType)) {
      pushIssue(issues, `${path}.detector`, 'must be a supported detector type');
    }
    if (!isNonEmptyString(error.path)) pushIssue(issues, `${path}.path`, 'must be a non-empty string');
    if (!isNonEmptyString(error.errorType)) pushIssue(issues, `${path}.errorType`, 'must be a non-empty string');
    if (!isNonEmptyString(error.summary)) pushIssue(issues, `${path}.summary`, 'must be a non-empty string');
    if (typeof error.retryable !== 'boolean') pushIssue(issues, `${path}.retryable`, 'must be a boolean');
  });
}

function validateSafety(value: unknown, issues: MaintenanceValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, 'safety', 'must be an object');
    return;
  }

  if (!isStringArray(value.allowedOutputPaths) || value.allowedOutputPaths.length !== ALLOWED_OUTPUT_PATHS.length) {
    pushIssue(issues, 'safety.allowedOutputPaths', 'must contain exactly the two maintenance latest report paths');
  } else {
    for (const outputPath of ALLOWED_OUTPUT_PATHS) {
      if (!value.allowedOutputPaths.includes(outputPath)) {
        pushIssue(issues, 'safety.allowedOutputPaths', `missing required path ${outputPath}`);
      }
    }
  }

  for (const field of [
    'sourceFilesChanged',
    'captureFilesChanged',
    'wikiFilesChanged',
    'liveFilesChanged',
    'archiveFilesChanged',
    'rootFilesCreated',
  ]) {
    if (value[field] !== 0) pushIssue(issues, `safety.${field}`, 'must equal 0 in report-only mode');
  }
  if (value.kanbanChanged !== false) pushIssue(issues, 'safety.kanbanChanged', 'must equal false');
  if (value.noWritePerformed !== true) pushIssue(issues, 'safety.noWritePerformed', 'must equal true');
}

function validateCrossFieldCounts(report: Record<string, unknown>, issues: MaintenanceValidationIssue[]): void {
  if (!Array.isArray(report.filesConsidered) || !Array.isArray(report.findings) || !Array.isArray(report.suppressedFindings) || !Array.isArray(report.errors) || !isRecord(report.summary)) {
    return;
  }

  const findings = report.findings.filter(isRecord);
  const statusCount = (status: string): number => findings.filter((finding) => finding.status === status).length;

  const expectedCounts: Record<string, number> = {
    filesConsidered: report.filesConsidered.length,
    findingsTotal: report.findings.length,
    findingsOpen: statusCount('open'),
    findingsAccepted: statusCount('accepted'),
    findingsDismissed: statusCount('dismissed'),
    findingsResolved: statusCount('resolved'),
    findingsSuppressed: report.suppressedFindings.length,
    detectorErrors: report.errors.length,
  };

  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (report.summary[field] !== expected) {
      pushIssue(issues, `summary.${field}`, `must equal ${expected}`);
    }
  }
}

export function validateMaintenanceReport(value: unknown): MaintenanceValidationResult {
  const issues: MaintenanceValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: '$', message: 'report must be an object' }] };
  }

  if (value.schemaVersion !== MAINTENANCE_SCHEMA_VERSION) {
    pushIssue(issues, 'schemaVersion', `must equal ${MAINTENANCE_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(value.reportId)) pushIssue(issues, 'reportId', 'must be a non-empty string');
  if (!isIsoDateTime(value.generatedAt)) pushIssue(issues, 'generatedAt', 'must be an ISO date-time');
  if (!isNonEmptyString(value.generatedBy)) pushIssue(issues, 'generatedBy', 'must be a non-empty string');
  if (value.mode !== MAINTENANCE_REPORT_MODE) pushIssue(issues, 'mode', `must equal ${MAINTENANCE_REPORT_MODE}`);
  if (value.sourceRepo !== 'mind') pushIssue(issues, 'sourceRepo', 'must equal mind');
  if (!isNonEmptyString(value.sourceCommit)) pushIssue(issues, 'sourceCommit', 'must be a non-empty string');

  validateConfiguration(value.configuration, issues);
  const detectors = validateDetectorMap(value.detectors, issues);

  if (!isStringArray(value.filesConsidered)) {
    pushIssue(issues, 'filesConsidered', 'must be an array of non-empty strings');
  } else {
    if (value.filesConsidered.length !== PILOT_FILE_COUNT) {
      pushIssue(issues, 'filesConsidered', `must contain exactly ${PILOT_FILE_COUNT} files`);
    }
    for (const group of MIND_MAINTENANCE_PILOT_FILE_GROUPS) {
      const selected = value.filesConsidered.filter(candidate =>
        (group.candidates as readonly string[]).includes(candidate),
      );
      if (selected.length !== 1) {
        pushIssue(issues, 'filesConsidered', `must contain exactly one path for pilot group ${group.id}`);
      }
    }
    for (const candidate of value.filesConsidered) {
      if (!mindMaintenancePilotGroupForPath(candidate)) {
        pushIssue(issues, 'filesConsidered', `contains path outside the pilot boundary: ${candidate}`);
      }
    }
  }

  validateSummary(value.summary, issues);

  if (!Array.isArray(value.findings)) {
    pushIssue(issues, 'findings', 'must be an array');
  } else {
    value.findings.forEach((finding, index) => validateFinding(finding, `findings[${index}]`, detectors, issues));
  }

  if (!Array.isArray(value.suppressedFindings)) {
    pushIssue(issues, 'suppressedFindings', 'must be an array');
  } else {
    value.suppressedFindings.forEach((finding, index) =>
      validateFinding(finding, `suppressedFindings[${index}]`, detectors, issues),
    );
  }

  validateErrors(value.errors, issues);
  validateSafety(value.safety, issues);

  if (value.noWritePerformed !== true) pushIssue(issues, 'noWritePerformed', 'must equal true');

  validateCrossFieldCounts(value, issues);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as MaintenanceReport };
}

export function assertValidMaintenanceReport(value: unknown): asserts value is MaintenanceReport {
  const result = validateMaintenanceReport(value);
  if (!result.ok) {
    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    throw new Error(`Invalid maintenance report: ${details}`);
  }
}

export function isMaintenanceFinding(value: unknown): value is MaintenanceFinding {
  const detectorMap = Object.fromEntries(
    maintenanceDetectorTypes.map((type) => [type, { enabled: true, status: 'completed' }]),
  );
  const issues: MaintenanceValidationIssue[] = [];
  validateFinding(value, 'finding', detectorMap, issues);
  return issues.length === 0;
}
