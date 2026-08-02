import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-brain-document-consistency.mjs');

test('current active docs pass the consistency checker', () => {
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /docs=pass/);
});

function makeTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-doc-consistency-'));
  const seedPaths = [
    'operations/specs/infinite-brain-runtime-implementation-plan.md',
    'operations/specs/infinite-brain-runtime-roadmap.md',
    'operations/runbooks/infinite-brain-roadmap-status.md',
    'operations/specs/graphify-operational-profiles.json',
    'operations/specs/graphify-transition-governance.json',
    'operations/reports/bs0-19-deletion-readiness-evaluation-2026-07-31.md',
    'operations/reports/roadmap-audit-2026-08-01.md',
    'operations/specs/deletion-readiness-evidence.json',
    'operations/specs/infinite-brain-path-registry.json',
  ];

  for (const relativePath of seedPaths) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, relativePath), target);
  }

  const linkPattern = /\[[^\]]+\]\((\.\.\/[^)]+)\)/g;
  for (const relativePath of seedPaths.filter((candidate) => candidate.endsWith('.md'))) {
    const sourcePath = path.join(root, relativePath);
    const content = fs.readFileSync(sourcePath, 'utf8');
    for (const match of content.matchAll(linkPattern)) {
      const linkedSource = path.resolve(path.dirname(sourcePath), match[1]);
      const linkedRelativePath = path.relative(root, linkedSource);
      if (linkedRelativePath.startsWith('..') || !fs.existsSync(linkedSource)) continue;
      const linkedTarget = path.join(tempRoot, linkedRelativePath);
      fs.mkdirSync(path.dirname(linkedTarget), { recursive: true });
      fs.copyFileSync(linkedSource, linkedTarget);
    }
  }

  return tempRoot;
}

function runValidator(tempRoot) {
  return execFileSync('node', [validator, '--root', tempRoot], { encoding: 'utf8', cwd: root, stdio: 'pipe' });
}

function runValidatorExpectFail(tempRoot) {
  try {
    execFileSync('node', [validator, '--root', tempRoot], { encoding: 'utf8', cwd: root, stdio: 'pipe' });
    assert.fail('expected the seeded stale fixture to fail');
  } catch (error) {
    return error.stdout;
  }
}

test('seeded stale fixture fails the consistency checker', () => {
  const tempRoot = makeTempRoot();
  try {
    const stalePath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    fs.writeFileSync(stalePath, `${fs.readFileSync(stalePath, 'utf8')}\nStale path: capture/inbox/old.md\n`);
    assert.match(runValidatorExpectFail(tempRoot), /docs=fail/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("'retired' exception word exempts tasks.md references on lines that say 'retired'", () => {
  // The current live status page contains "tasks.md retired and non-authoritative"
  // and the live docs pass. This confirms the 'retired' exception is doing its job.
  const statusPath = path.join(root, 'operations/runbooks/infinite-brain-roadmap-status.md');
  const content = fs.readFileSync(statusPath, 'utf8');
  assert.match(content, /tasks\.md retired/, 'status page must still contain the retired reference');
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /docs=pass/);
});

test("'retired' exception does not suppress unrelated stale tasks.md references", () => {
  const tempRoot = makeTempRoot();
  try {
    // Seed a standalone minimal doc with a stale tasks.md reference that has no exception word.
    // Bypass the broken-link and next-task checks by only seeding the roadmap-status file
    // with a simple content that passes those checks but fails the stale-path check.
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    fs.writeFileSync(statusPath, [
      '# Fixture Status',
      '',
      'B1.0a — Deploy and verify Save-to-Mind target paths',
      'the first bounded measured-automation pilot batch',
      '',
      'See live/tasks.md for the current task list.',
      '',
    ].join('\n'));
    // Also seed a minimal roadmap that passes its next-task check.
    const roadmapPath = path.join(tempRoot, 'operations/specs/infinite-brain-runtime-roadmap.md');
    fs.writeFileSync(roadmapPath, [
      '# Fixture Roadmap',
      '**Version:** 2.0',
      '',
      'B1.0a guarded-deployment lane are complete',
      '',
    ].join('\n'));
    assert.match(runValidatorExpectFail(tempRoot), /docs=fail/);
    assert.match(runValidatorExpectFail(tempRoot), /stale-path/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("'retired' exception does not suppress stale capture/inbox/ on non-retired lines", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    // A line with the stale path but no exception word must still fail.
    fs.writeFileSync(statusPath, `${content}\nPlease send files to capture/inbox/new.md\n`);
    assert.match(runValidatorExpectFail(tempRoot), /docs=fail/);
    assert.match(runValidatorExpectFail(tempRoot), /stale-path/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("exception words on the same line as stale pattern suppress the error (source-level check)", () => {
  // Verify the checkStalePaths logic by examining the validator source.
  // The stale pattern must be detected only when NO exception word appears on the same line.
  const validatorSource = fs.readFileSync(validator, 'utf8');
  // 'retired' must be in the exceptionWords array.
  assert.match(validatorSource, /'retired'/);
  // The exception check must use lineText.toLowerCase().includes(word).
  assert.match(validatorSource, /lineText\.toLowerCase\(\)\.includes\(word\)/);
});

// P8 contradiction checks — prevent active docs from claiming states contradicted
// by documented evidence (candidate CBM binary, historical B8 artifacts, executable
// retention-policy validator, governance deletion prohibition).

function makeMinimalStatus() {
  // Returns a minimal roadmap-status content string that passes all existing checks.
  return [
    '# Status',
    '',
    'B1.0a — Deploy and verify Save-to-Mind target paths',
    'the first bounded measured-automation pilot batch',
    '',
  ].join('\n');
}

test("false 'no CBM installation exists' claim fails p8-contradiction check", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    fs.writeFileSync(statusPath, makeMinimalStatus() + '\nNo Codebase Memory installation exists.\n');
    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /p8-contradiction:false-no-cbm-installation/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("false 'P8 is literally unstarted' claim fails p8-contradiction check", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    fs.writeFileSync(statusPath, makeMinimalStatus() + '\nP8 is literally unstarted with no prior work.\n');
    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /p8-contradiction:false-p8-wholly-unstarted/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("'P8 is intentionally deferred and unstarted' wording fails p8-contradiction check", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    // Note: text must not contain a dot between "P8" and "deferred and unstarted" because
    // the regex uses [^.]{0,80} to keep the match bounded to a single sentence.
    fs.writeFileSync(statusPath, makeMinimalStatus() + '\nP8 is intentionally deferred and unstarted, requiring no further work.\n');
    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /p8-contradiction:false-p8-wholly-unstarted/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("false 'Graphify has no executable retention policy' claim fails p8-contradiction check", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    fs.writeFileSync(statusPath, makeMinimalStatus() + '\nGraphify has no executable retention policy for pruning.\n');
    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /p8-contradiction:false-no-graphify-retention-policy/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("precise P8 wording with candidate-installed and no-approved-activation passes the p8-contradiction checks", () => {
  const validatorSource = fs.readFileSync(validator, 'utf8');
  // The contradiction error codes must be present in the validator source.
  assert.match(validatorSource, /false-no-cbm-installation/);
  assert.match(validatorSource, /false-p8-wholly-unstarted/);
  assert.match(validatorSource, /false-no-graphify-retention-policy/);
  assert.match(validatorSource, /obsolete-b8-label-as-canonical/);

  // Precise wording accepted by the validator must NOT match any forbidden pattern.
  const preciseContent = [
    'P8 remains intentionally deferred. No canonical P8 task is accepted complete.',
    'Preliminary out-of-sequence CBM experiments and candidate installation exist',
    'under an obsolete B8 numbering scheme. A CBM candidate binary is installed',
    '(admission status: candidate); no approved default activation exists.',
    'An executable retention-policy validator enforces maxRuns and maxAgeDays.',
    'graphify-transition-governance.json prohibits deletion of graphify-out/.',
  ].join('\n');
  assert.doesNotMatch(preciseContent, /no (codebase[- ]memory|CBM) installation exists/i, 'precise wording must not claim no installation exists');
  assert.doesNotMatch(preciseContent, /P8[^.]{0,80}(is literally unstarted|has no prior|was never started|deferred and unstarted)/i, 'precise wording must not claim P8 wholly unstarted');
  assert.doesNotMatch(preciseContent, /graphify has no (executable )?retention.polic/i, 'precise wording must not deny retention policy');
  assert.doesNotMatch(preciseContent, /\bB8\.4R\b.*current canonical/i, 'precise wording must not treat obsolete label as canonical');
});

test("governance JSON with obsolete B8 currentPhase fails p8-contradiction check", () => {
  const tempRoot = makeTempRoot();
  try {
    // Overwrite the governance JSON (already copied by makeTempRoot) with an obsolete currentPhase.
    const govDest = path.join(tempRoot, 'operations/specs/graphify-transition-governance.json');
    const gov = JSON.parse(fs.readFileSync(govDest, 'utf8'));
    gov.migrationPath.currentPhase = 'B8.4R-complete';
    fs.writeFileSync(govDest, JSON.stringify(gov, null, 2));
    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /p8-contradiction:governance-obsolete-b8-current-phase/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("cross-document verdict count mismatch fails consistency check", () => {
  const tempRoot = makeTempRoot();
  try {
    // Overwrite the implementation plan with a different verdict triple.
    const planPath = path.join(tempRoot, 'operations/specs/infinite-brain-runtime-implementation-plan.md');
    const planContent = fs.readFileSync(planPath, 'utf8');
    // Replace the real triple with a deliberately mismatched one.
    const patched = planContent.replace(
      /\d+ SAFE[,\s\/]+\d+ PARTIAL[,\s\/]+\d+ BLOCKED/,
      '99 SAFE, 0 PARTIAL, 0 BLOCKED'
    );
    fs.writeFileSync(planPath, patched);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /docs=fail/);
    assert.match(out, /cross-document-count-mismatch:verdict-triple/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});



test('missing verdict triple fails consistency check', () => {
  const tempRoot = makeTempRoot();
  try {
    const planPath = path.join(tempRoot, 'operations/specs/infinite-brain-runtime-implementation-plan.md');
    const content = fs.readFileSync(planPath, 'utf8');
    const patched = content.replace(
      /\d+\s+SAFE[,\s\/]+\d+\s+PARTIAL[,\s\/]+\d+\s+BLOCKED/,
      'verdict counts intentionally removed',
    );
    assert.notEqual(patched, content, 'fixture must contain a verdict triple before removal');
    fs.writeFileSync(planPath, patched);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /cross-document-count-missing:verdict-triple:operations\/specs\/infinite-brain-runtime-implementation-plan\.md/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('missing focused-test count fails consistency check', () => {
  const tempRoot = makeTempRoot();
  try {
    const planPath = path.join(tempRoot, 'operations/specs/infinite-brain-runtime-implementation-plan.md');
    const content = fs.readFileSync(planPath, 'utf8');
    const patched = content.replace(
      /\d+ focused tests pass \(\d+\/\d+\)/,
      'focused-test count intentionally removed',
    );
    assert.notEqual(patched, content, 'fixture must contain a focused-test count before removal');
    fs.writeFileSync(planPath, patched);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /cross-document-count-missing:test-count:operations\/specs\/infinite-brain-runtime-implementation-plan\.md/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('pass receipt reports every distinct inspected file', () => {
  const tempRoot = makeTempRoot();
  try {
    const out = runValidator(tempRoot);
    assert.match(out, /^docs=pass$/m);
    assert.match(out, /^files=9$/m);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('legacy proof values fail for a SAFE-capable live evidence record', () => {
  const tempRoot = makeTempRoot();
  try {
    const evidencePath = path.join(tempRoot, 'operations/specs/deletion-readiness-evidence.json');
    const evidenceIndex = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const evidence = evidenceIndex.entries['legacy-task-summary'];
    assert.ok(evidence, 'live legacy-task-summary evidence record must exist');
    delete evidence.missingRollback;
    delete evidence.missingApproval;
    evidence.noActiveProducer = 'legacy nonblank universal proof';
    evidence.prerequisiteEvidence['M1.4-lossless-task-migration'] = 'legacy nonblank prerequisite proof';
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidenceIndex, null, 2)}\n`);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /legacy-universal-proof:noActiveProducer/);
    assert.match(out, /legacy-prerequisite-proof:M1\.4-lossless-task-migration/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});




test('B8.1 before any CBM installation fails when installed candidate evidence exists', () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    assert.match(content, /candidate installation|existing candidate binary/i);
    fs.writeFileSync(statusPath, `${content}\nB8.1 benchmark evidence is required before any Codebase Memory MCP installation.\n`);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /p8-contradiction:false-preinstallation-sequencing/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('installed candidate with approved-activation and further-rollout gate passes', () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    fs.writeFileSync(
      statusPath,
      `${content}\nA preliminary Codebase Memory candidate is already installed. B8.1 benchmark evidence is required before approved default activation or further rollout.\n`,
    );

    const out = runValidator(tempRoot);
    assert.match(out, /^docs=pass$/m);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("'P8 is the first task' fails phase-as-task consistency check", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    fs.writeFileSync(statusPath, `${content}\nP8 is the first task when the phase is authorized.\n`);

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /p8-contradiction:phase-as-task/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("'B8.1 is the first canonical task when P8 is authorized' passes", () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    fs.writeFileSync(statusPath, `${content}\nB8.1 is the first canonical task when P8 is authorized.\n`);

    const out = runValidator(tempRoot);
    assert.match(out, /^docs=pass$/m);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});




test('B8.1 before provider admission and installation fails with installed candidate evidence', () => {
  const tempRoot = makeTempRoot();
  try {
    const statusPath = path.join(tempRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
    const content = fs.readFileSync(statusPath, 'utf8');
    fs.writeFileSync(
      statusPath,
      `${content}\nP8 must begin with B8.1 benchmark evidence before provider admission, installation, watchers, or scheduler changes.\n`,
    );

    const out = runValidatorExpectFail(tempRoot);
    assert.match(out, /p8-contradiction:false-preinstallation-sequencing/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
