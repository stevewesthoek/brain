import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function checkLinks(relativePath, findings) {
  const source = read(relativePath);
  const sourcePath = path.join(ROOT, relativePath);
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const targetPath = target.split('#', 1)[0];
    const resolved = path.resolve(path.dirname(sourcePath), targetPath);
    if (!fs.existsSync(resolved)) findings.push(`${relativePath}: broken link ${target}`);
  }
}

export function validateBrainSchedulerDocumentation() {
  const findings = [];
  const registry = JSON.parse(read('operations/specs/typed-scheduler-jobs.json'));
  const categories = registry.jobs.reduce((grouped, job) => {
    (grouped[job.reviewCategory] ??= []).push(job);
    return grouped;
  }, {});
  const counts = Object.fromEntries(Object.entries(categories).map(([key, jobs]) => [key, jobs.length]));
  const expectedCounts = { ACTIVE: 4, BLOCKED: 10, 'NEEDS REVIEW': 0, OBSOLETE: 2 };
  if (registry.jobs.length !== 16) findings.push(`registry job count is ${registry.jobs.length}, expected 16`);
  for (const [key, expected] of Object.entries(expectedCounts)) if ((counts[key] ?? 0) !== expected) findings.push(`registry ${key} count is ${counts[key] ?? 0}, expected ${expected}`);
  if (registry.scheduler.launchAgentLabel !== 'com.office.nightly-scheduler') findings.push('launch label drift');
  if (registry.scheduler.runner !== 'tools/scripts/brain-scheduler-runner.mjs') findings.push('runner drift');
  if (registry.scheduler.runAtLoad !== false) findings.push('RunAtLoad must be false');
  const activeIds = registry.jobs.filter((job) => job.reviewCategory === 'ACTIVE').map((job) => job.id);
  const expectedActive = ['mind-steward-dry-run', 'local-apps-report', 'video-runtime-report', 'mind-compile-loop'];
  if (JSON.stringify(activeIds) !== JSON.stringify(expectedActive)) findings.push(`active set drift: ${activeIds.join(', ')}`);

  const currentState = read('operations/runbooks/brain-scheduler-current-state.md');
  for (const required of ['com.office.nightly-scheduler', 'brain-scheduler-runner.mjs', 'RunAtLoad', '16 jobs', '720cbd1ed858a5eb03a4329d2993efb3615b0284', 'Brain Core', 'Brain Console']) {
    if (!currentState.includes(required)) findings.push(`current state missing ${required}`);
  }
 const runbook = read('operations/runbooks/brain-scheduler.md');
 for (const required of ['RunAtLoad=false', 'The four Active jobs are', 'brain-scheduler-troubleshooting.md', 'Repository-only documentation']) {
   if (!runbook.includes(required)) findings.push(`runbook missing ${required}`);
 }
  const coreRoutes = read('projects/brain-core/src/api/routes.ts');
  const coreAdapter = read('projects/brain-core/src/adapters/infra-office-scheduler.ts');
  const consoleDashboard = read('projects/brain-console/components/scheduler-dashboard.tsx');
  for (const [source, required, label] of [
    [coreRoutes, "url.pathname === '/infra/scheduler'", 'Core scheduler route'],
    [coreRoutes, 'getInfraOfficeScheduler()', 'Core scheduler adapter'],
    [coreAdapter, "launchAgentLabel !== 'com.office.nightly-scheduler'", 'Core identity validation'],
    [consoleDashboard, "brainCoreRequest('/infra/scheduler'", 'Console Core consumer'],
    [consoleDashboard, 'job.reviewCategory', 'Console review category'],
  ]) if (!source.includes(required)) findings.push(`${label} contract missing ${required}`);

 const currentDocs = {
    'operations/infrastructure/scheduler-inventory.md': ['17 jobs', 'RunAtLoad guard'],
    'operations/runbooks/ing-statement-automation.md': ['**Status:** ✅ Active', 'FORCE_RUN=1 bash'],
    'operations/runbooks/n8n.md': ['RunAtLoad` also triggers', 'captured automatically by the next scheduled backup'],
    'operations/runbooks/shared-memory-system.md': ['generated nightly by `brain/tools/scripts/memory-context-refresh.sh` (wired into `office-nightly-scheduler.sh`)'],
    'operations/runbooks/notebooklm.md': ['2. Add to `office-nightly-scheduler.sh`:'],
  };
  for (const [relativePath, staleTokens] of Object.entries(currentDocs)) {
    const source = read(relativePath);
    for (const token of staleTokens) if (source.includes(token)) findings.push(`${relativePath}: stale current guidance ${token}`);
  }

  for (const relativePath of [
    'operations/runbooks/brain-scheduler-current-state.md',
    'operations/runbooks/brain-scheduler-lessons-learned.md',
    'operations/runbooks/brain-scheduler-report-index.md',
    'operations/runbooks/brain-scheduler-troubleshooting.md',
    'operations/runbooks/brain-scheduler-change-checklist.md',
    'operations/runbooks/brain-scheduler.md',
    'operations/infrastructure/scheduler-inventory.md',
  ]) checkLinks(relativePath, findings);
  return findings;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const findings = validateBrainSchedulerDocumentation();
  if (findings.length) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('brain-scheduler-documentation-valid');
  }
}
