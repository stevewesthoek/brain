import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const TOOL = path.join(ROOT, 'tools/n8n-save-to-mind-plan.mjs');
const CANDIDATE = path.join(ROOT, 'operations/automations/n8n/workflows/mind-inbox-fixed.json');

function run(args) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {},
  });
}

function withFixture(mutator = (value) => value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-save-to-mind-plan-'));
  const workflow = JSON.parse(fs.readFileSync(CANDIDATE, 'utf8'));
  // The rollback fixture models stored historical activation metadata; the
  // repository candidate itself must remain paused.
  workflow.active = true;
  const fixture = mutator(structuredClone(workflow));
  const file = path.join(dir, 'rollback.json');
  fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
  return { dir, file };
}

test('status plan treats the candidate as unverified and emits no live command', () => {
  const result = run(['status-plan']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workflow_id=FwP5INe9qoo1OwGC/);
  assert.match(result.stdout, /repository_candidate=true/);
  assert.match(result.stdout, /deployed=unverified/);
  assert.match(result.stdout, /activation_state=not_asserted/);
  assert.match(result.stdout, /schedule_state=not_asserted/);
  assert.match(result.stdout, /b1_0a=incomplete/);
  assert.match(result.stdout, /live_commands_emitted=false/);
  assert.doesNotMatch(result.stdout, /n8n-api\.sh|update-workflow|get-workflow/);
  assert.match(result.stdout, /network_access=false/);
  assert.match(result.stdout, /credentials_read=false/);
});

test('candidate review plan requires rollback but emits no deployment command', () => {
  const fixture = withFixture();
  try {
    const result = run(['deploy-plan', fixture.file, CANDIDATE]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /change_boundary=repository-candidate-only/);
    assert.match(result.stdout, /live_commands_emitted=false/);
    assert.match(result.stdout, /approval_required_for_live_action=true/);
    assert.doesNotMatch(result.stdout, /n8n-api\.sh|update-workflow|get-workflow/);
    assert.match(result.stdout, /network_access=false/);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('rollback plan validates workflow id', () => {
  const fixture = withFixture((workflow) => ({ ...workflow, id: 'wrong-workflow' }));
  try {
    const result = run(['rollback-plan', fixture.file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /workflow id must be FwP5INe9qoo1OwGC/);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('deploy plan rejects activation changes', () => {
  const fixture = withFixture((workflow) => ({ ...workflow, active: !workflow.active }));
  try {
    const result = run(['deploy-plan', fixture.file, CANDIDATE]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback activation evidence must remain true/);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('deploy plan rejects unrelated node changes', () => {
  const fixture = withFixture((workflow) => {
    const node = workflow.nodes.find((item) => item.id !== 'build-processed-note');
    node.name = `${node.name} changed`;
    return workflow;
  });
  try {
    const result = run(['deploy-plan', fixture.file, CANDIDATE]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /changed node identity|changed unrelated node/);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('deploy plan rejects retired routing paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-save-to-mind-candidate-'));
  const rollback = withFixture();
  try {
    const candidate = JSON.parse(fs.readFileSync(CANDIDATE, 'utf8'));
    candidate.nodes.find((node) => node.id === 'build-processed-note').parameters.jsCode = candidate.nodes
      .find((node) => node.id === 'build-processed-note')
      .parameters.jsCode.replaceAll('inbox/new', 'capture/inbox');
    const candidateFile = path.join(dir, 'candidate.json');
    fs.writeFileSync(candidateFile, `${JSON.stringify(candidate, null, 2)}\n`);
    const result = run(['deploy-plan', rollback.file, candidateFile]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /retired path capture\/inbox/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(rollback.dir, { recursive: true, force: true });
  }
});
