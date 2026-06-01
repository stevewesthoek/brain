import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyMindCaptureInbox } from '../classifier.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const RUNTIME_DIR = path.resolve(PACKAGE_ROOT, 'runtime/local/mind-steward');

const args = parseArgs(process.argv.slice(2));
const mindRoot = args['mind-root'] || process.env.MIND_STEWARD_MIND_ROOT || path.resolve(PACKAGE_ROOT, '..', '..', 'mind');
const selectorUrl = args['selector-url'] || process.env.AI_SELECTOR_URL || 'http://127.0.0.1:4890';
const jsonOutput = args['output-json'] || path.resolve(RUNTIME_DIR, 'classify-latest.json');
const mdOutput = args['output-md'] || path.resolve(RUNTIME_DIR, 'classify-latest.md');
const limit = args.limit ? Number(args.limit) : undefined;
const dryRun = args['dry-run'] === 'true';

const startedAt = new Date().toISOString();
const runInput: Parameters<typeof classifyMindCaptureInbox>[0] = {
  mindRoot,
  selectorUrl,
  dryRun,
};
if (Number.isFinite(limit)) {
  runInput.limit = limit;
}
const run = await classifyMindCaptureInbox(runInput);
const endedAt = new Date().toISOString();

const report = {
  job: 'mind-steward-classify-captures',
  mode: dryRun ? 'dry-run' : 'apply-classification',
  writesToMind: !dryRun,
  executableActions: !dryRun,
  startedAt,
  endedAt,
  ...run,
};
type ClassificationCliReport = typeof report;

fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.mkdirSync(path.dirname(mdOutput), { recursive: true });
fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdOutput, renderMarkdown(report));

if (!run.ok) {
  process.exitCode = 1;
}

function renderMarkdown(report: ClassificationCliReport): string {
  const lines = [
    '# Mind Steward Capture Classification',
    '',
    `- Job: ${report.job}`,
    `- Mode: ${report.mode}`,
    `- Writes to Mind: ${report.writesToMind}`,
    `- Started: ${report.startedAt}`,
    `- Ended: ${report.endedAt}`,
    `- Processed: ${report.processed}`,
    `- Classified: ${report.classified}`,
    `- Skipped: ${report.skipped}`,
    `- Failed: ${report.failed}`,
    '',
    '## Results',
    ...report.results.map((result) => {
      const reason = result.reason ? ` — ${result.reason}` : '';
      return `- ${result.status}: ${result.file}${reason}`;
    }),
    '',
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
