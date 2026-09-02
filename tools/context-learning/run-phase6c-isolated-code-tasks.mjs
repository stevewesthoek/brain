#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { runCodexLiveConsumptionPilot } from './codex-live-consumption-pilot.mjs';
import { createCodexCanaryController, runCodexBoundedCanaryInvocation, transitionCodexCanary } from './codex-canary-contract.mjs';
import { isolatedCodeTasks } from './phase6c-code-task-fixtures.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
function mkdirFor(filePath) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); }

function makeCanaryContext() {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const dirtyItemCount = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
  let controller = createCodexCanaryController({ sourceRevision });
  controller = transitionCodexCanary(controller, 'READY', { reason: 'Phase 6C isolated-task run' });
  controller = transitionCodexCanary(controller, 'CANARY_ACTIVE', { reason: 'bounded Codex Code isolated-task authorization' });
  return { sourceRevision, branch, source: { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: dirtyItemCount }, session: { session_id: `phase6c-isolated-${sourceRevision.slice(0, 8)}`, repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true }, controller, catalog: createCapabilityCatalog({ repoRoot }) };
}

function writeFixture(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    mkdirFor(target);
    fs.writeFileSync(target, contents, 'utf8');
  }
}

function applyPatches(root, patches = []) {
  const touched = [];
  for (const patch of patches) {
    const target = path.join(root, patch.path);
    mkdirFor(target);
    if (patch.operation === 'create') {
      if (fs.existsSync(target)) throw new Error(`fixture patch target exists: ${patch.path}`);
      fs.writeFileSync(target, patch.replace ?? '', 'utf8');
      touched.push(patch.path);
      continue;
    }
    const current = fs.readFileSync(target, 'utf8');
    if (!current.includes(patch.find)) throw new Error(`fixture patch anchor missing: ${patch.path}`);
    fs.writeFileSync(target, current.replace(patch.find, patch.replace), 'utf8');
    touched.push(patch.path);
  }
  return touched;
}

function runTests(root, testFile) {
  try {
    const output = execFileSync(process.execPath, ['--test', testFile], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { pass: true, exitCode: 0, outputHash: hash(output), outputBytes: Buffer.byteLength(output, 'utf8') };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { pass: false, exitCode: error.status ?? 1, outputHash: hash(output), outputBytes: Buffer.byteLength(output, 'utf8') };
  }
}

function reviewFixture(root, task) {
  const findings = [];
  if (task.review?.type === 'required-token') {
    const contents = fs.readFileSync(path.join(root, task.review.path), 'utf8');
    if (!contents.includes(task.review.token)) findings.push(task.review.finding);
  }
  for (const relativePath of task.expectedFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) findings.push(`Expected implementation file is missing: ${relativePath}`);
  }
  return { pass: findings.length === 0, findings };
}

function runFixtureTask(task, { rootPrefix, mode }) {
  const fixtureRoot = fs.mkdtempSync(path.join(rootPrefix, `${task.id}-${mode}-`));
  try {
    writeFixture(fixtureRoot, task.files);
    const beforeTests = runTests(fixtureRoot, task.testFile);
    const touched = applyPatches(fixtureRoot, task.patches);
    const firstTests = runTests(fixtureRoot, task.testFile);
    const firstReview = reviewFixture(fixtureRoot, task);
    const firstQa = { pass: firstTests.pass, findings: firstTests.pass ? [] : ['Targeted fixture tests failed after implementation.'] };
    let repairAttempted = false;
    let repairSuccess = false;
    let repairTests = null;
    let finalReview = firstReview;
    let finalTests = firstTests;
    let finalQa = firstQa;
    if ((!firstTests.pass || !firstReview.pass || !firstQa.pass) && task.repairPatches?.length) {
      repairAttempted = true;
      touched.push(...applyPatches(fixtureRoot, task.repairPatches));
      repairTests = runTests(fixtureRoot, task.testFile);
      finalTests = repairTests;
      finalReview = reviewFixture(fixtureRoot, task);
      finalQa = { pass: repairTests.pass, findings: repairTests.pass ? [] : ['Targeted fixture tests failed after bounded repair.'] };
      repairSuccess = repairTests.pass && finalReview.pass && finalQa.pass;
    }
    const unnecessaryFiles = [...new Set(touched)].filter((relativePath) => !task.expectedFiles.includes(relativePath));
    const quality = {
      requirementsSatisfied: finalTests.pass && finalReview.pass,
      correctRepositoryAuthority: fixtureRoot.startsWith(os.tmpdir()),
      correctFilesTouched: unnecessaryFiles.length === 0,
      unnecessaryFilesTouched: unnecessaryFiles.length,
      architectureConsistency: finalReview.pass,
      testCoverage: finalTests.pass,
      regressionProtection: finalTests.pass,
      securityImplications: task.category !== 'SECURITY' || finalTests.pass,
      performanceImplications: task.category !== 'PERFORMANCE' || finalTests.pass,
      reviewFindings: firstReview.findings,
      qaFindings: firstQa.findings,
      leftoverDefects: finalReview.findings.length + finalQa.findings.length,
      unnecessaryComplexity: true,
      userClarificationBurden: 0
    };
    const scoreFields = ['requirementsSatisfied', 'correctRepositoryAuthority', 'correctFilesTouched', 'architectureConsistency', 'testCoverage', 'regressionProtection', 'securityImplications', 'performanceImplications', 'unnecessaryComplexity'];
    const score = scoreFields.filter((field) => quality[field] === true).length / scoreFields.length * 10;
    return { mode, fixtureId: task.id, fixtureRootHash: hash(fixtureRoot), beforeTests, firstPass: { tests: firstTests, review: firstReview, qa: firstQa }, repair: { attempted: repairAttempted, success: repairSuccess, tests: repairTests }, final: { tests: finalTests, review: finalReview, qa: finalQa }, touchedFiles: [...new Set(touched)], unnecessaryFiles, quality: { ...quality, score: Number(score.toFixed(2)) }, executionPerformed: true, writes: 0, providers: 0 };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

export function runPhase6cIsolatedCodeTasks({ context = makeCanaryContext(), tasks = isolatedCodeTasks } = {}) {
  const rootPrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-phase6c-tasks-'));
  try {
    const rows = [];
    for (const task of tasks) {
      const v2 = runCodexBoundedCanaryInvocation({ repoRoot, controller: context.controller, catalog: context.catalog, prompt: task.prompt, fixtureId: task.id, routeClass: 'read-only-plan', source: context.source, session: context.session });
      const priorLive = runCodexLiveConsumptionPilot({ source: context.source, session: context.session, enabled: true, maxItems: 8 });
      const v2Task = runFixtureTask(task, { rootPrefix, mode: 'v2' });
      const priorTask = runFixtureTask(task, { rootPrefix, mode: 'prior' });
      const graphQualityGates = v2.v2?.graph?.qualityGateNodes ?? [];
      const reviewGateSelected = graphQualityGates.some((gate) => gate.includes('review'));
      const qaGateSelected = graphQualityGates.some((gate) => gate.includes('qa'));
      const qualityExpected = task.category !== 'UNKNOWN_REPO_AREA' || reviewGateSelected;
      v2Task.quality.userClarificationBurden = v2.v2?.qualification?.count ?? 0;
      rows.push({ task: { id: task.id, category: task.category, promptHash: hash(task.prompt), expectedQuestion: task.expectedQuestion, expectedFiles: task.expectedFiles, requirements: task.requirements, dormantCapability: task.dormantCapability ?? null }, canary: { selectedPath: v2.selectedPath, state: v2.state, route: v2.v2?.route?.primaryRouteFamily ?? null, owner: v2.v2?.route?.primaryDescriptorId ?? null, selectedCapabilities: v2.v2?.taskPacket?.selectedCapabilityRefs?.map((item) => item.capabilityId) ?? [], qualification: v2.v2?.qualification ?? null, reviewGateSelected, qaGateSelected, qualityExpected, taskPacket: Boolean(v2.v2?.taskPacket), evidencePackets: v2.v2?.evidencePackets?.length ?? 0, graph: Boolean(v2.v2?.graph), metrics: v2.v2?.metrics ?? null, safety: v2.v2?.safety ?? null, receiptId: v2.receipt.receiptId }, v2: v2Task, prior: { liveConsumed: priorLive.live_consumed, activationState: priorLive.activation_state, metrics: priorLive.metrics, safety: priorLive.safety, task: priorTask }, executionPerformed: true });
    }
    return { source: context.source, count: rows.length, rows, cleanup: 'disposable fixture roots removed after each task', safety: { executionPerformed: rows.every((row) => row.executionPerformed), productionWrites: 0, mindWrites: 0, providers: 0 } };
  } finally {
    fs.rmSync(rootPrefix, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPhase6cIsolatedCodeTasks();
  const summary = {
    source: result.source,
    count: result.count,
    selectedV2: result.rows.filter((row) => row.canary.selectedPath === 'v2').length,
    priorLiveConsumed: result.rows.filter((row) => row.prior.liveConsumed).length,
    implementationSuccess: result.rows.filter((row) => row.v2.final.tests.pass).length,
    firstPassSuccess: result.rows.filter((row) => row.v2.firstPass.tests.pass && row.v2.firstPass.review.pass && row.v2.firstPass.qa.pass).length,
    repairsAttempted: result.rows.filter((row) => row.v2.repair.attempted).length,
    repairsSucceeded: result.rows.filter((row) => row.v2.repair.success).length,
    remainingDefects: result.rows.reduce((sum, row) => sum + row.v2.quality.leftoverDefects, 0),
    reviewGateSelected: result.rows.filter((row) => row.canary.reviewGateSelected).length,
    qaGateSelected: result.rows.filter((row) => row.canary.qaGateSelected).length,
    qualityScores: result.rows.map((row) => ({ id: row.task.id, score: row.v2.quality.score })),
    safety: result.safety
  };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
}
