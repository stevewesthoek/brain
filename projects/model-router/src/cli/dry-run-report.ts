import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMindPathSnapshotFromRoot, createModelRouterDryRunReport } from '../index.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const RUNTIME_DIR = path.resolve(PACKAGE_ROOT, 'runtime/local/model-router');

const args = parseArgs(process.argv.slice(2));
const mindRoot = args['mind-root'] || process.env.MODEL_ROUTER_MIND_ROOT;
const jsonOutput = args['output-json'] || path.resolve(RUNTIME_DIR, 'latest.json');
const mdOutput = args['output-md'] || path.resolve(RUNTIME_DIR, 'latest.md');

const report = mindRoot
  ? createModelRouterDryRunReport(
      createMindPathSnapshotFromRoot(mindRoot, createMindRelativePaths()),
    )
  : createModelRouterDryRunReport({ paths: [] });

fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.mkdirSync(path.dirname(mdOutput), { recursive: true });
fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdOutput, renderMarkdown(report));

function createMindRelativePaths(): string[] {
  return [
    'HOME.md',
    'TODAY.md',
    'README.md',
    'AGENTS.md',
    'router/current.md',
    'router/map.md',
    'router/rules.md',
    'router/taxonomy.md',
    'router/maintenance.md',
    'router/model-router.md',
    'capture/inbox/',
    'capture/daily/',
    'capture/failed/',
    'capture/inbox/README.md',
    'capture/daily/README.md',
    'capture/failed/README.md',
    'live/dashboard.md',
    'live/tasks.md',
    'live/projects.md',
    'live/workflows.md',
    'live/decisions.md',
    'wiki/index.md',
    'sources/index.md',
    'archive/index.md',
    '01-inbox/',
    '02-strategy/',
    '03-projects/',
    '04-tasks/',
    '05-areas/',
    '06-resources/',
    '07-templates/',
    '08-archive/',
  ];
}

function renderMarkdown(report: ReturnType<typeof createModelRouterDryRunReport>): string {
  const lines = [
    '# Model Router Dry-Run Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${report.mode}`,
    `- Writes to Mind: ${report.writesToMind}`,
    `- Executable actions: ${report.executableActions}`,
    `- Validation status: ${report.validationStatus}`,
    '',
    '## Contract Summary',
    `- OK: ${report.contractSummary.ok}`,
    `- Missing required paths: ${report.contractSummary.missingRequiredPathCount}`,
    `- Missing router contract files: ${report.contractSummary.missingRouterContractFileCount}`,
    `- Missing live files: ${report.contractSummary.missingLiveFileCount}`,
    `- Missing index files: ${report.contractSummary.missingIndexFileCount}`,
    `- Failure buffer status: ${report.contractSummary.failureBufferStatus}`,
    `- Failure buffer ready for archive phase: ${report.contractSummary.failureBufferReadyForArchivePhase}`,
    '',
    '## Snapshot Stats',
    `- Path count: ${report.snapshotStats.pathCount}`,
    `- Existing path count: ${report.snapshotStats.existingPathCount}`,
    `- Missing path count: ${report.snapshotStats.missingPathCount}`,
    `- Failed capture count: ${report.snapshotStats.failedCaptureCount}`,
    `- Capture inbox count: ${report.snapshotStats.captureInboxCount}`,
    report.snapshotStats.oldestCaptureInboxAgeDays !== undefined
      ? `- Oldest capture inbox age days: ${report.snapshotStats.oldestCaptureInboxAgeDays}`
      : '- Oldest capture inbox age days: unavailable',
    '',
    '## Loop Plans',
    ...report.loopPlans.map((plan) => `- ${plan.jobId}: ${plan.actions.length} action(s), ${plan.blockedBy.length} blocker(s)`),
  ];

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}
