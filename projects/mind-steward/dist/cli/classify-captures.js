import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyMindCaptureInbox, discoverMindFailedCaptures, } from '../classifier.js';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const RUNTIME_DIR = path.resolve(PACKAGE_ROOT, 'runtime/local/mind-steward');
const args = parseArgs(process.argv.slice(2));
const mindRoot = args['mind-root'] || process.env.MIND_STEWARD_MIND_ROOT || path.resolve(PACKAGE_ROOT, '..', '..', 'mind');
const selectorUrl = args['selector-url'] || process.env.AI_SELECTOR_URL || 'http://127.0.0.1:4890';
const jsonOutput = args['output-json'] || path.resolve(RUNTIME_DIR, 'classify-latest.json');
const mdOutput = args['output-md'] || path.resolve(RUNTIME_DIR, 'classify-latest.md');
const mode = resolveCliMode(args);
const startedAt = new Date().toISOString();
const runInput = {
    mindRoot,
    selectorUrl,
    mode,
};
const parsedLimit = parseLimitArg(args.limit);
if (parsedLimit !== undefined) {
    runInput.limit = parsedLimit;
}
const run = await classifyMindCaptureInbox(runInput);
const failedItems = discoverMindFailedCaptures(mindRoot);
const endedAt = new Date().toISOString();
const report = {
    job: 'mind-steward-classify-captures',
    startedAt,
    endedAt,
    ...run,
    executableActions: run.writesToMind,
    failedQueueCount: failedItems.length,
    failedItems,
};
fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.mkdirSync(path.dirname(mdOutput), { recursive: true });
fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdOutput, renderMarkdown(report));
if (!run.ok) {
    process.exitCode = 1;
}
function renderMarkdown(report) {
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
        `- Failed queue items: ${report.failedQueueCount}`,
        '',
        '## Failed Queue',
        ...(report.failedItems.length > 0 ? report.failedItems.map((file) => `- ${file}`) : ['- none']),
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
function parseArgs(argv) {
    const result = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg?.startsWith('--'))
            continue;
        const [key, inlineValue] = arg.slice(2).split('=', 2);
        if (!key)
            continue;
        if (inlineValue !== undefined) {
            result[key] = inlineValue;
            continue;
        }
        const next = argv[index + 1];
        if (next && !next.startsWith('--')) {
            result[key] = next;
            index += 1;
        }
        else {
            result[key] = 'true';
        }
    }
    return result;
}
function resolveCliMode(args) {
    const rawMode = args.mode;
    const rawDryRun = args['dry-run'];
    if (rawMode !== undefined && rawMode !== 'dry-run' && rawMode !== 'apply') {
        throw new Error("--mode must be exactly 'dry-run' or 'apply'");
    }
    if (rawDryRun !== undefined && rawDryRun !== 'true' && rawDryRun !== 'false') {
        throw new Error("--dry-run must be 'true' or 'false' when supplied");
    }
    if (rawMode !== undefined
        && rawDryRun !== undefined
        && rawDryRun === 'true'
        && rawMode !== 'dry-run') {
        throw new Error('--mode and --dry-run conflict; refusing to classify');
    }
    // The legacy boolean flag is intentionally never an apply switch.  Apply
    // requires the explicit, separately documented --mode=apply contract.
    return rawMode ?? 'dry-run';
}
function parseLimitArg(value) {
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error('--limit must be a finite number');
    }
    return parsed;
}
