import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildDailyIntelligenceLoop, loadDailyIntelligenceInputs, renderDailyIntelligenceLoop, writeDailyIntelligenceLoop } from './mind-steward-daily-intelligence-loop.mjs';

const workflowItem = (state, source, freshness = 'fresh') => ({ review_id: `review:${source}`, state, source: { source_reference: source, evidence_references: [`evidence:${source}`], freshness, confidence: 0.8, uncertainty: [], authority_owner: 'mind' } });

test('summarizes real workflow and promotion state deterministically', () => {
  const input = { generated_at: 'fixed', source: 'infinite-brain-unified-review', attention_queue: [] };
  const workflow = { generated_at: 'fixed', items: [workflowItem('new', 'new.md'), workflowItem('accepted', 'accepted.md'), workflowItem('deferred', 'deferred.md'), workflowItem('reviewing', 'stale.md', 'stale')] };
  const promotions = [{ promotion_id: 'promotion:one', state: 'promotion_candidate', source: { source_reference: 'accepted.md' }, rollback_reference: 'rollback:one' }];
  const loop = buildDailyIntelligenceLoop({ briefing: input, workflow, promotions, generatedAt: 'fixed', sourcePaths: ['briefing.json', 'workflow.json'] });
  assert.deepEqual(loop.current_state, { pending_reviews: 2, accepted_items: 1, deferred_items: 1, promotion_candidates: 1, unresolved_conflicts: 0, stale_items: 1, workflow_states: { new: 1, reviewing: 1, accepted: 1, rejected: 0, deferred: 1, archived: 0 } });
  assert.equal(loop.attention_queue.find((entry) => entry.review_id === 'review:new.md').available_action, 'review');
  assert.equal(loop.promotion_actions[0].available_action, 'prepare promotion');
  assert.equal(renderDailyIntelligenceLoop(loop), renderDailyIntelligenceLoop(buildDailyIntelligenceLoop({ briefing: input, workflow, promotions, generatedAt: 'fixed', sourcePaths: ['briefing.json', 'workflow.json'] })));
});

test('does not invent intelligence when runtime artifacts are absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-daily-empty-'));
  const inputs = loadDailyIntelligenceInputs(root);
  const loop = buildDailyIntelligenceLoop({ briefing: inputs.briefing.value, workflow: inputs.workflow.value, promotions: inputs.promotions, sourcePaths: inputs.source_paths, generatedAt: 'fixed' });
  assert.equal(loop.real_inputs_present, false);
  assert.equal(loop.current_state.pending_reviews, 0);
  assert.equal(loop.attention_queue.length, 0);
});

test('preserves provenance and keeps output runtime-local', () => {
  const loop = buildDailyIntelligenceLoop({ workflow: { items: [workflowItem('new', 'source.md')] }, generatedAt: 'fixed' });
  assert.deepEqual(loop.attention_queue[0].evidence_references, ['evidence:source.md']);
  assert.equal(loop.invariants.automatic_scheduling, false);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-daily-output-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  assert.ok(writeDailyIntelligenceLoop({ loop, repoRoot: root }).jsonPath.includes('daily-loop/latest.json'));
  assert.throws(() => writeDailyIntelligenceLoop({ loop, repoRoot: root, outputRoot: path.join(root, 'outside') }), /unsafe_daily_loop_output/);
});
