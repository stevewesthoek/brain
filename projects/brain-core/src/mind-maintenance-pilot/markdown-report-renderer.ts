import type {
  MaintenanceDetectorError,
  MaintenanceDetectorMap,
  MaintenanceFinding,
  MaintenanceReport,
} from './types.js';

function renderDetectorStatus(detectors: MaintenanceDetectorMap): string[] {
  return Object.entries(detectors).map(([name, state]) => {
    const label = name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return `- ${label}: ${state.status}`;
  });
}

function renderFinding(finding: MaintenanceFinding): string[] {
  const lines = [
    `### ${finding.id}`,
    '',
    `- **Type:** ${finding.type}`,
    `- **Risk:** ${finding.risk}`,
    `- **Confidence:** ${finding.confidence.toFixed(2)}`,
    `- **Paths:** ${finding.paths.map((path) => `\`${path}\``).join(', ')}`,
    `- **Trigger:** ${finding.trigger}`,
    `- **Uncertainty:** ${finding.uncertainty}`,
    `- **Recommended review:** ${finding.recommendedAction}`,
    `- **Approval required:** ${finding.requiresApproval ? 'yes' : 'no'}`,
    `- **Write performed:** ${finding.noWritePerformed ? 'no' : 'yes'}`,
    '',
    '**Matched evidence**',
    '',
  ];

  for (const evidence of finding.matchedEvidence) {
    lines.push(`- \`${evidence.path}\` — ${evidence.location}: ${evidence.summary}`);
  }

  if (finding.comparisonEvidence.length > 0) {
    lines.push('', '**Comparison evidence**', '');
    for (const evidence of finding.comparisonEvidence) {
      lines.push(`- \`${evidence.path}\` — ${evidence.location}: ${evidence.summary}`);
    }
  }

  return lines;
}

function renderDetectorErrors(errors: readonly MaintenanceDetectorError[]): string[] {
  if (errors.length === 0) return ['None.'];

  return errors.map(
    (error) =>
      `- **${error.detector}** on \`${error.path}\`: ${error.summary} `
      + `(type: ${error.errorType}; retryable: ${error.retryable ? 'yes' : 'no'})`,
  );
}

function renderNoFindingSection(report: MaintenanceReport): string[] {
  const findingPaths = new Set(report.findings.flatMap((finding) => finding.paths));
  const noFindingPaths = report.filesConsidered.filter((path) => !findingPaths.has(path));

  if (noFindingPaths.length === 0) return [];

  return [
    '## No findings detected',
    '',
    'The enabled detectors found no evidence meeting the configured threshold for:',
    '',
    ...noFindingPaths.map((path) => `- \`${path}\``),
    '',
    'This does not prove those pages can never require maintenance.',
    '',
  ];
}

export function renderMindMaintenanceReportMarkdown(report: MaintenanceReport): string {
  const lines: string[] = [
    '# Mind Maintenance Report',
    '',
    `**Report ID:** \`${report.reportId}\`  `,
    `**Generated:** ${report.generatedAt}  `,
    `**Source commit:** \`${report.sourceCommit}\`  `,
    `**Mode:** ${report.mode}  `,
    `**Writes performed:** ${report.noWritePerformed ? 'none' : 'yes'}`,
    '',
    '## Summary',
    '',
    `- Files considered: ${report.summary.filesConsidered}`,
    `- Open findings: ${report.summary.findingsOpen}`,
    `- Accepted findings: ${report.summary.findingsAccepted}`,
    `- Dismissed findings: ${report.summary.findingsDismissed}`,
    `- Resolved findings: ${report.summary.findingsResolved}`,
    `- Suppressed findings: ${report.summary.findingsSuppressed}`,
    `- Detector errors: ${report.summary.detectorErrors}`,
    `- Source files changed: ${report.safety.sourceFilesChanged}`,
    '',
    '## Detectors',
    '',
    ...renderDetectorStatus(report.detectors),
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('## Findings', '', 'No valid findings were detected by enabled detectors.', '');
  } else {
    const highRisk = report.findings.filter((finding) => finding.risk === 'high');
    const otherFindings = report.findings.filter((finding) => finding.risk !== 'high');

    lines.push('## High-priority findings', '');
    if (highRisk.length === 0) {
      lines.push('No high-risk findings.', '');
    } else {
      for (const finding of highRisk) {
        lines.push(...renderFinding(finding), '');
      }
    }

    lines.push('## Other findings', '');
    if (otherFindings.length === 0) {
      lines.push('None.', '');
    } else {
      for (const finding of otherFindings) {
        lines.push(...renderFinding(finding), '');
      }
    }
  }

  lines.push(...renderNoFindingSection(report));
  lines.push('## Detector errors', '', ...renderDetectorErrors(report.errors), '');
  lines.push(
    '## Safety verification',
    '',
    `- Pilot boundary respected: ${report.filesConsidered.length === 5 ? 'yes' : 'no'}`,
    `- Source files changed: ${report.safety.sourceFilesChanged === 0 ? 'no' : 'yes'}`,
    `- \`kanban.md\` changed: ${report.safety.kanbanChanged ? 'yes' : 'no'}`,
    `- Capture files changed: ${report.safety.captureFilesChanged}`,
    `- Wiki files changed: ${report.safety.wikiFilesChanged}`,
    `- Live files changed: ${report.safety.liveFilesChanged}`,
    `- Archive files changed: ${report.safety.archiveFilesChanged}`,
    `- Root files created: ${report.safety.rootFilesCreated}`,
    '',
    '## Review instructions',
    '',
    '- **Leave open** — useful but not yet reviewed.',
    '- **Accept** — concern is valid; prepare a separate exact-path proposal.',
    '- **Dismiss** — not useful; record the reason and suppress unchanged recurrence.',
    '- **Resolve** — only after an approved action is completed or review confirms no change is needed.',
    '',
    'Accepting a finding does not authorize a content write.',
    '',
  );

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}
