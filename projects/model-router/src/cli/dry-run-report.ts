import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAllDryRunResults,
  createMindContractDryRunResult,
  createMindPathSnapshotFromRoot,
  createMindRouterLoopPlan,
} from '../index.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const RUNTIME_DIR = path.resolve(PACKAGE_ROOT, 'runtime/local/model-router');
const JSON_OUTPUT = path.resolve(RUNTIME_DIR, 'latest.json');

const mindRoot = process.env.MODEL_ROUTER_MIND_ROOT;

if (!mindRoot) {
  writeCiOnlyReport();
  process.exit(0);
}

const relativePaths = [
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

const snapshot = createMindPathSnapshotFromRoot(mindRoot, relativePaths);
const contract = createMindContractDryRunResult(snapshot);
const plans = createAllDryRunResults().map((job) =>
  createMindRouterLoopPlan(job.jobId, snapshot, new Date()),
);

fs.mkdirSync(RUNTIME_DIR, { recursive: true });
fs.writeFileSync(
  JSON_OUTPUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mindRoot,
      contract,
      plans,
    },
    null,
    2,
  ),
);

process.exit(contract.ok ? 0 : 1);

function writeCiOnlyReport(): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(
    JSON_OUTPUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: 'ci-only',
        jobs: createAllDryRunResults(),
      },
      null,
      2,
    ),
  );
}
