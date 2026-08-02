import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MIND_MAINTENANCE_PILOT_CONFIG,
  MIND_MAINTENANCE_PILOT_FILES,
  MIND_MAINTENANCE_TARGET_PILOT_FILES,
  loadMindMaintenancePilotDataset,
} from '../mind-maintenance-pilot/pilot-file-loader.js';
import { detectStalePageFinding } from '../mind-maintenance-pilot/stale-page-detector.js';

async function createPilotFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-pilot-'));

  const contents: Record<string, string> = {
    'system/agent-context/00-current-context.md': `# Current Context

## Status

\`\`\`yaml
status: review-needed
last_reviewed: 2026-05-22
review_after: 2026-06-05
freshness_risk: high
\`\`\`
`,
    'projects/prochat-qa-memory/STRATEGY-PLAN.md': `# QA Memory Strategy

Status: draft
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: medium
`,
    'organizations/prochat/brand/product-strategy.md': `# ProChat OS Strategy

Status: current
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: high
`,
    'wiki/organisations/prochat/brand/product-strategy.md': `# ProChat OS Strategy

Status: current
Last reviewed: 2026-06-13
Review after: 2026-07-13
Freshness risk: high
`,
    'system/reports/dashboard.md': '# Dashboard\n',
    'system/automation-roadmap.md': '# Automation Roadmap\n',
  };

  for (const relativePath of MIND_MAINTENANCE_PILOT_FILES) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents[relativePath] ?? '', 'utf8');
  }

  return root;
}

test('pilot configuration is disabled, report-only, and content-write locked', () => {
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.enabled, false);
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.mode, 'report-only');
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.allowContentWrites, false);
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.maxFiles, 5);
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.detectors['stale-page'], true);
  assert.equal(MIND_MAINTENANCE_PILOT_CONFIG.detectors['duplicate-candidate'], false);
});

test('loads exactly the bounded five-file pilot dataset', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  const dataset = await loadMindMaintenancePilotDataset(root);

  assert.equal(dataset.files.length, 5);
  assert.deepEqual(
    dataset.files.map((file) => file.path),
    [...MIND_MAINTENANCE_PILOT_FILES],
  );
  assert.ok(dataset.files.every((file) => file.absolutePath.startsWith(root)));
});

test('loads the bounded five-file target-path pilot dataset during migration', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'mind-maintenance-target-pilot-'));
  context.after(async () => rm(root, { recursive: true, force: true }));

  for (const relativePath of MIND_MAINTENANCE_TARGET_PILOT_FILES) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `# ${relativePath}\n`, 'utf8');
  }

  const dataset = await loadMindMaintenancePilotDataset(root, MIND_MAINTENANCE_TARGET_PILOT_FILES);

  assert.equal(dataset.files.length, 5);
  assert.deepEqual(
    dataset.files.map((file) => file.path),
    [...MIND_MAINTENANCE_TARGET_PILOT_FILES],
  );
  assert.ok(dataset.files.every((file) => file.absolutePath.startsWith(root)));
});

test('loads an explicitly requested registered compatibility reader without making it a default', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));
  const requestedPaths = [...MIND_MAINTENANCE_TARGET_PILOT_FILES];
  requestedPaths[2] = 'wiki/organisations/prochat/brand/product-strategy.md';
  const compatibilityPath = path.join(root, requestedPaths[2]!);
  await mkdir(path.dirname(compatibilityPath), { recursive: true });
  await writeFile(compatibilityPath, '# Compatibility strategy\n', 'utf8');

  const dataset = await loadMindMaintenancePilotDataset(root, requestedPaths);

  assert.equal(dataset.files[2]?.path, 'wiki/organisations/prochat/brand/product-strategy.md');
  assert.notDeepEqual(MIND_MAINTENANCE_PILOT_FILES, requestedPaths);
});

test('rejects substituted, missing, duplicate, and relative-root datasets', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    loadMindMaintenancePilotDataset(root, [
      ...MIND_MAINTENANCE_PILOT_FILES.slice(0, 4),
      'wiki/unbounded-page.md',
    ]),
    /missing required path|outside the bounded/i,
  );

  await assert.rejects(
    loadMindMaintenancePilotDataset(root, MIND_MAINTENANCE_PILOT_FILES.slice(0, 4)),
    /exactly 5 files/i,
  );

  await assert.rejects(
    loadMindMaintenancePilotDataset(root, [
      ...MIND_MAINTENANCE_PILOT_FILES.slice(0, 4),
      MIND_MAINTENANCE_PILOT_FILES[0]!,
    ]),
    /unique/i,
  );

  await assert.rejects(loadMindMaintenancePilotDataset('relative/mind'), /absolute Mind repository root/i);
});

test('emits the expected stale finding for current context after review_after', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  const dataset = await loadMindMaintenancePilotDataset(root);
  const currentContext = dataset.files.find((file) => file.path === 'system/agent-context/00-current-context.md');
  assert.ok(currentContext);

  const finding = detectStalePageFinding({ file: currentContext, reportDate: '2026-06-13' });

  assert.ok(finding);
  assert.equal(finding.type, 'stale-page');
  assert.equal(finding.status, 'open');
  assert.deepEqual(finding.paths, ['system/agent-context/00-current-context.md']);
  assert.equal(finding.risk, 'high');
  assert.equal(finding.requiresApproval, true);
  assert.equal(finding.noWritePerformed, true);
  assert.equal(finding.comparisonEvidence.length, 0);
  assert.match(finding.uncertainty, /does not show.*incorrect/i);
  assert.equal(
    finding.deduplicationKey,
    'stale-page:system/agent-context/00-current-context.md:review_after',
  );
});

test('detects stale freshness metadata inside Mind-style fenced yaml status blocks', () => {
  const finding = detectStalePageFinding({
    file: {
      path: 'system/agent-context/00-current-context.md',
      absolutePath: '/tmp/mind/system/agent-context/00-current-context.md',
      content: `# Current Context

## Status

\`\`\`yaml
status: current
last_reviewed: 2026-06-14
review_after: 2026-06-28
freshness_risk: high
\`\`\`
`,
    },
    reportDate: '2026-07-04',
  });

  assert.ok(finding);
  assert.equal(finding.type, 'stale-page');
  assert.deepEqual(finding.paths, ['system/agent-context/00-current-context.md']);
  assert.equal(finding.risk, 'high');
  assert.equal(finding.requiresApproval, true);
  assert.equal(finding.noWritePerformed, true);
  assert.equal(finding.trigger, 'review_after date has passed');
  assert.match(finding.matchedEvidence[0]?.summary ?? '', /review_after is 2026-06-28/);
  assert.match(finding.recommendedAction, /Review the page/);
});

test('does not mark future-review or metadata-free pages as stale', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  const dataset = await loadMindMaintenancePilotDataset(root);
  const qaStrategy = dataset.files.find(
    (file) => file.path === 'projects/prochat-qa-memory/STRATEGY-PLAN.md',
  );
  const dashboard = dataset.files.find((file) => file.path === 'system/reports/dashboard.md');
  assert.ok(qaStrategy);
  assert.ok(dashboard);

  assert.equal(detectStalePageFinding({ file: qaStrategy, reportDate: '2026-06-13' }), null);
  assert.equal(detectStalePageFinding({ file: dashboard, reportDate: '2026-06-13' }), null);
});

test('does not treat the review_after date itself as overdue', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  const dataset = await loadMindMaintenancePilotDataset(root);
  const currentContext = dataset.files.find((file) => file.path === 'system/agent-context/00-current-context.md');
  assert.ok(currentContext);

  assert.equal(detectStalePageFinding({ file: currentContext, reportDate: '2026-06-05' }), null);
});

test('rejects invalid report dates', async (context) => {
  const root = await createPilotFixture();
  context.after(async () => rm(root, { recursive: true, force: true }));

  const dataset = await loadMindMaintenancePilotDataset(root);
  const currentContext = dataset.files.find((file) => file.path === 'system/agent-context/00-current-context.md');
  assert.ok(currentContext);

  assert.throws(
    () => detectStalePageFinding({ file: currentContext, reportDate: '13-06-2026' }),
    /ISO report date/i,
  );
});
