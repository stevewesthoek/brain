import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'brain-core-scheduler-'));
const manifestPath = path.join(tempRoot, 'typed-scheduler-jobs.json');
const stateDir = path.join(tempRoot, 'state');
const reportPath = path.join(tempRoot, 'latest-run.md');
copyFileSync(path.join(repoRoot, 'operations/specs/typed-scheduler-jobs.json'), manifestPath);
mkdirSync(path.join(stateDir, 'receipts'), { recursive: true });
writeFileSync(reportPath, '# Brain Scheduler Latest Run\n\nGenerated at: 2026-08-29T02:00:00.000Z\n\n| Job | Lifecycle | Result | Ended | Duration (s) |\n| --- | --- | --- | --- | --- |\n');
for (const id of ['mind-steward-dry-run', 'local-apps-report', 'video-runtime-report', 'mind-compile-loop']) {
  writeFileSync(path.join(stateDir, 'receipts', `${id}.json`), JSON.stringify({ status: 'success', jobId: id, endedAt: '2026-08-29T02:00:00.000Z', durationSeconds: 1, exitCode: 0, artifacts: [] }));
}
writeFileSync(path.join(stateDir, 'scheduler-latest.json'), JSON.stringify({ status: 'success', startedAt: '2026-08-29T02:00:00.000Z', endedAt: '2026-08-29T02:00:01.000Z', trigger: 'test', failedJobIds: [] }));
writeFileSync(path.join(stateDir, 'history.jsonl'), Array.from({ length: 25 }, (_, index) => JSON.stringify({ run: index + 1 })).join('\n'));
process.env.BRAIN_SCHEDULER_REPO_ROOT = repoRoot;
process.env.BRAIN_SCHEDULER_MANIFEST_PATH = manifestPath;
process.env.BRAIN_SCHEDULER_INSTALLED_PLIST = path.join(repoRoot, 'operations/system-configs/launchagents/com.office.nightly-scheduler.plist');
process.env.OFFICE_SCHEDULER_STATE_DIR = stateDir;
process.env.OFFICE_SCHEDULER_REPORT_FILE = reportPath;

const { getInfraOfficeScheduler } = await import('../adapters/infra-office-scheduler.js');

test('Brain Core returns every canonical job with lifecycle and bounded history', async () => {
  const response = await getInfraOfficeScheduler();
  assert.equal(response.status, 'ok');
  assert.equal(response.manifest.valid, true);
  assert.equal(response.manifest.jobCount, 17);
  assert.equal(response.jobs.length, 17);
  assert.equal(response.jobs.find((job) => job.id === 'ing-bank-statement-download')?.status, 'blocked');
  assert.equal(response.jobs.find((job) => job.id === 'stb-pipeline-batch')?.status, 'disabled');
  assert.equal(response.jobs.filter((job) => job.status === 'success').length, 4);
  assert.equal(response.jobs.find((job) => job.id === 'gemini-cleanup')?.reviewCategory, 'OBSOLETE');
  assert.equal(response.jobs.find((job) => job.id === 'video-orchestrator-storage-cleanup')?.reviewCategory, 'OBSOLETE');
  assert.match(response.jobs.find((job) => job.id === 'video-orchestrator-storage-cleanup')?.policyReason ?? '', /video-runtime-report/);
  assert.match(response.jobs.find((job) => job.id === 'video-orchestrator-storage-cleanup')?.humanAction ?? '', /Do not enable/);
  assert.equal(response.jobs.find((job) => job.id === 'video-orchestrator-storage-cleanup')?.status, 'disabled');
  const googleAds = response.jobs.find((job) => job.id === 'google-ads-sync');
  assert.equal(googleAds?.reviewCategory, 'BLOCKED');
  assert.equal(googleAds?.lifecycle, 'disabled');
  assert.equal(googleAds?.mode, 'disabled');
  assert.equal(googleAds?.enabled, false);
  assert.equal(googleAds?.status, 'disabled');
  assert.match(googleAds?.policyReason ?? '', /replacement\/hardening/);
  const memoryRefresh = response.jobs.find((job) => job.id === 'memory-context-refresh');
  assert.equal(memoryRefresh?.reviewCategory, 'BLOCKED');
  assert.equal(memoryRefresh?.lifecycle, 'disabled');
  assert.equal(memoryRefresh?.mode, 'disabled');
  assert.equal(memoryRefresh?.enabled, false);
  assert.equal(memoryRefresh?.status, 'disabled');
  assert.deepEqual(memoryRefresh?.artifacts, ['~/.brain/memory-context.md']);
  assert.match(memoryRefresh?.policyReason ?? '', /manual \/ on-demand only/);
  assert.match(memoryRefresh?.humanAction ?? '', /must not run automatically/);
  assert.deepEqual(response.jobs.reduce<Record<string, number>>((counts, job) => {
    counts[job.reviewCategory] = (counts[job.reviewCategory] ?? 0) + 1;
    return counts;
  }, {}), { BLOCKED: 10, 'NEEDS REVIEW': 1, OBSOLETE: 2, ACTIVE: 4 });
  assert.ok(response.jobs.every((job) => ['ACTIVE', 'BLOCKED', 'NEEDS REVIEW', 'OBSOLETE'].includes(job.reviewCategory)));
  assert.equal(response.history.length, 20);
  assert.equal(response.health, 'warning', 'policy-blocked inventory is visible as a warning, not green evidence');
});

test('Brain Core fails closed when an active job has unapproved authority', async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.jobs.find((job: { id: string }) => job.id === 'local-apps-report').authority = 'external-review-required';
  writeFileSync(manifestPath, JSON.stringify(manifest));
  try {
    const response = await getInfraOfficeScheduler();
    assert.equal(response.status, 'error');
    assert.equal(response.health, 'failed');
    assert.equal(response.manifest.valid, false);
  } finally {
    copyFileSync(path.join(repoRoot, 'operations/specs/typed-scheduler-jobs.json'), manifestPath);
  }
});

test('Brain Core fails closed when the canonical manifest is invalid', async () => {
  writeFileSync(manifestPath, '{"registryVersion":"broken"}\n');
  const response = await getInfraOfficeScheduler();
  assert.equal(response.status, 'error');
  assert.equal(response.health, 'failed');
  assert.equal(response.manifest.valid, false);
});
