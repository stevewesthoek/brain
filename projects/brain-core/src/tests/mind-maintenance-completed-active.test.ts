import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCompletedActiveFinding } from '../mind-maintenance-pilot/completed-active-detector.js';
import type { LoadedMindMaintenancePilotFile } from '../mind-maintenance-pilot/pilot-file-loader.js';

function createFile(
  path: LoadedMindMaintenancePilotFile['path'],
  content: string,
): LoadedMindMaintenancePilotFile {
  return {
    path,
    absolutePath: `/tmp/mind/${path}`,
    content,
  };
}

test('emits a finding for explicit active and completed metadata', () => {
  const file = createFile(
    'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
    `---
status: active
completed_on: 2026-06-10
---
# QA Memory Strategy
`,
  );

  const finding = detectCompletedActiveFinding({ file, reportDate: '2026-06-13' });

  assert.ok(finding);
  assert.equal(finding.type, 'completed-but-active');
  assert.equal(finding.status, 'open');
  assert.deepEqual(finding.paths, [file.path]);
  assert.equal(finding.matchedEvidence.length, 2);
  assert.equal(finding.requiresApproval, true);
  assert.equal(finding.noWritePerformed, true);
  assert.match(finding.uncertainty, /transition state|maintenance/i);
  assert.match(finding.recommendedAction, /separately approved change/i);
});

test('emits a finding for current navigation with explicit supersession metadata', () => {
  const file = createFile(
    'live/dashboard.md',
    `# Dashboard

Status: current
Superseded by: Brain Console
`,
  );

  const finding = detectCompletedActiveFinding({ file, reportDate: '2026-06-13' });

  assert.ok(finding);
  assert.equal(finding.risk, 'high');
  assert.ok(finding.matchedEvidence.some((evidence) => /superseded_by/i.test(evidence.summary)));
});

test('does not emit for active metadata without explicit completion evidence', () => {
  const file = createFile(
    'live/dashboard.md',
    `# Dashboard

Status: current
Primary interface: Brain Console
`,
  );

  assert.equal(detectCompletedActiveFinding({ file, reportDate: '2026-06-13' }), null);
});

test('does not emit for completion metadata without active evidence', () => {
  const file = createFile(
    'system/automation-roadmap.md',
    `# Automation Roadmap

Status: completed
Completed on: 2026-06-10
`,
  );

  assert.equal(detectCompletedActiveFinding({ file, reportDate: '2026-06-13' }), null);
});

test('does not infer a mismatch from completed roadmap subsections or title wording', () => {
  const file = createFile(
    'system/automation-roadmap.md',
    `# Final Automation Roadmap

Status: active

## Foundation — completed

## Report writer — remaining
`,
  );

  assert.equal(detectCompletedActiveFinding({ file, reportDate: '2026-06-13' }), null);
});

test('does not treat unrelated dates as completion evidence', () => {
  const file = createFile(
    'wiki/organisations/prochat/brand/prochat-os-strategy.md',
    `---
status: current
last_reviewed: 2026-06-13
review_after: 2026-07-13
---
# ProChat OS Strategy
`,
  );

  assert.equal(detectCompletedActiveFinding({ file, reportDate: '2026-06-13' }), null);
});

test('rejects invalid report dates', () => {
  const file = createFile(
    'live/dashboard.md',
    `Status: active
Completed: true
`,
  );

  assert.throws(
    () => detectCompletedActiveFinding({ file, reportDate: 'June 13, 2026' }),
    /ISO report date/i,
  );
});
