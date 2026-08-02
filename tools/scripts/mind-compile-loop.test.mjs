import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const COMPILE_LOOP = path.join(SCRIPT_DIR, 'mind-compile-loop.sh');
const SCHEDULER = path.join(SCRIPT_DIR, 'office-nightly-scheduler.sh');
const CLASSIFY_WRAPPER = path.join(SCRIPT_DIR, 'mind-steward-classify-captures.sh');
const BIBLE_WRAPPER = path.join(SCRIPT_DIR, 'bible-studies-pipeline.sh');
const BIBLE_PIPELINE = path.join(SCRIPT_DIR, 'bible-studies/pipeline.mjs');

test('compile loop is report-only and never appends to a temporary Mind fixture', (t) => {
  const mindRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-compile-loop-'));
  const inbox = path.join(mindRoot, 'inbox/new');
  const legacyLog = path.join(mindRoot, 'wiki/log.md');
  fs.mkdirSync(inbox, { recursive: true });
  fs.mkdirSync(path.dirname(legacyLog), { recursive: true });
  fs.writeFileSync(legacyLog, 'unchanged\n');
  fs.writeFileSync(path.join(inbox, 'fixture.md'), [
    '---',
    'title: Fixture',
    'para_type: project',
    '---',
    '',
    'Fixture content.',
  ].join('\n'));
  t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));

  const output = execFileSync('bash', [COMPILE_LOOP], {
    encoding: 'utf8',
    env: { MIND_DIR: mindRoot, PATH: process.env.PATH ?? '' },
  });

  assert.match(output, /mode=report-only/);
  assert.match(output, /destination unresolved/);
  assert.equal(fs.readFileSync(legacyLog, 'utf8'), 'unchanged\n');
  assert.equal(fs.existsSync(path.join(mindRoot, 'live')), false);
});

test('scheduler and wrappers pin safe modes without an environment apply switch', (t) => {
  const scheduler = fs.readFileSync(SCHEDULER, 'utf8');
  const compileLoop = fs.readFileSync(COMPILE_LOOP, 'utf8');
  const wrapper = fs.readFileSync(CLASSIFY_WRAPPER, 'utf8');
  const bibleWrapper = fs.readFileSync(BIBLE_WRAPPER, 'utf8');
  const biblePipeline = fs.readFileSync(BIBLE_PIPELINE, 'utf8');

  assert.match(scheduler, /printf 'bash %q --mode=report-only >> %q 2>&1'/);
  assert.doesNotMatch(compileLoop, />>/);
  assert.doesNotMatch(compileLoop, /proposed_dest=/);
  assert.match(wrapper, /MODE="dry-run"/);
  assert.doesNotMatch(wrapper, /MIND_STEWARD_CLASSIFY_DRY_RUN/);
  assert.match(scheduler, /skipping job=bible-studies-pipeline reason=bs0-2-quiesced/);
  assert.doesNotMatch(scheduler, /if run_bible_studies_pipeline/);
  assert.match(bibleWrapper, /MODE="report-only"/);
  assert.match(biblePipeline, /executionMode !== 'apply'/);

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-studies-quiesced-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const output = execFileSync('bash', [BIBLE_WRAPPER], {
    encoding: 'utf8',
    env: { HOME: home, PATH: process.env.PATH ?? '' },
  });
  assert.match(output, /mode=report-only/);
  assert.equal(fs.existsSync(path.join(home, '.local/state/bible-studies')), false);
});
