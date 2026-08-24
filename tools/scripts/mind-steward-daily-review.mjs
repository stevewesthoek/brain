#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { scanMindInbox, writeReviewReport } from './mind-steward-ingest-envelope.mjs';
import { buildUnifiedReviewInbox, writeUnifiedReviewInbox } from './mind-steward-unified-review-inbox.mjs';
import { buildUnifiedIntelligenceBriefing, writeUnifiedIntelligenceBriefing } from './mind-steward-unified-intelligence-briefing.mjs';
import { applyReviewAction, buildReviewWorkflow, writeReviewWorkflow } from './mind-steward-unified-review-workflow.mjs';
import { buildDailyIntelligenceLoop, writeDailyIntelligenceLoop } from './mind-steward-daily-intelligence-loop.mjs';
import { buildOperationalFeedbackCalibration, writeOperationalFeedbackCalibration } from './mind-steward-operational-feedback-calibration.mjs';
import { buildOperationalReadiness } from './mind-steward-operational-readiness.mjs';

const RUNTIME_ROOT = path.join('runtime', 'local', 'mind-steward');
const REVIEW_ROOT = path.join(RUNTIME_ROOT, 'unified-review');

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function runDailyReview({ repoRoot = process.cwd(), mindRoot, generatedAt = new Date().toISOString() } = {}) {
  if (!mindRoot) throw new Error('mindRoot is required');
  const ingestion = scanMindInbox({ mindRoot, repoRoot, createdAt: generatedAt });
  writeReviewReport(ingestion);
  const projection = buildUnifiedReviewInbox({ ingestion: ingestion.envelopes, generatedAt });
  writeUnifiedReviewInbox({ projection, repoRoot });
  const briefing = buildUnifiedIntelligenceBriefing(projection, { generatedAt });
  writeUnifiedIntelligenceBriefing({ briefing, repoRoot });
  const previous = readJson(path.join(repoRoot, REVIEW_ROOT, 'workflow-latest.json'), null);
  const workflow = buildReviewWorkflow({ briefing, previous: previous?.items ?? [] });
  writeReviewWorkflow({ workflow, repoRoot });
  const dailyLoop = buildDailyIntelligenceLoop({ briefing, workflow, promotions: [], generatedAt, sourcePaths: [
    path.join(REVIEW_ROOT, 'briefing-latest.json'),
    path.join(REVIEW_ROOT, 'workflow-latest.json'),
  ] });
  writeDailyIntelligenceLoop({ loop: dailyLoop, repoRoot });
  const calibration = buildOperationalFeedbackCalibration({ briefing, workflow, dailyLoop, generatedAt, sourcePaths: [
    path.join(REVIEW_ROOT, 'briefing-latest.json'),
    path.join(REVIEW_ROOT, 'workflow-latest.json'),
    path.join(RUNTIME_ROOT, 'daily-loop/latest.json'),
  ] });
  writeOperationalFeedbackCalibration({ report: calibration, repoRoot });
  const readiness = buildOperationalReadiness({ repoRoot, briefing, workflow, calibration, dailyLoop, promotions: [], generatedAt });
  writeJson(path.join(repoRoot, RUNTIME_ROOT, 'readiness/latest.json'), readiness);
  return buildReviewSession({ repoRoot, ingestion, workflow, readiness, calibration, generatedAt });
}

export function buildReviewSession({ repoRoot = process.cwd(), ingestion = null, workflow = null, readiness = null, calibration = null, generatedAt = new Date().toISOString() } = {}) {
  const currentWorkflow = workflow ?? readJson(path.join(repoRoot, REVIEW_ROOT, 'workflow-latest.json'), { items: [], counts: {} });
  const pending = currentWorkflow.items.filter((item) => !['accepted', 'rejected', 'archived'].includes(item.state));
  return {
    session_version: '1.0.0',
    generated_at: generatedAt,
    source: 'infinite-brain-daily-review',
    status: readiness?.status ?? 'unknown',
    usable_for_daily_review: readiness?.usable_for_daily_review ?? true,
    ingestion: ingestion ? { envelopes: ingestion.envelopes.length, failures: ingestion.failures.length } : null,
    counts: currentWorkflow.counts,
    pending: pending.map((item) => ({
      review_id: item.review_id,
      source: item.source.source_reference,
      evidence: item.source.evidence_references,
      source_hash: item.source.source_hash,
      ingestion_id: item.source.ingestion_or_review_id,
      timestamp: item.source.timestamp,
      authority_owner: item.source.authority_owner,
      confidence: item.source.confidence,
      freshness: item.source.freshness,
      uncertainty: item.source.uncertainty,
      decision_options: ['accepted', 'rejected', 'deferred', 'archived'],
      requires_human_decision: true,
    })),
    required_actions: pending.map((item) => ({ action: 'review', review_id: item.review_id, source: item.source.source_reference })),
    calibration_signals: calibration?.signals ?? null,
    invariants: {
      writes_to_mind: false,
      writes_to_brain_canonical: false,
      automatic_decisions: false,
      automatic_promotion: false,
      provider_calls: false,
      new_storage_authority: false,
    },
  };
}

export function recordDailyReviewDecision({ repoRoot = process.cwd(), reviewId, state, reason, reviewer, decidedAt = new Date().toISOString(), sourceReference } = {}) {
  if (!reviewId || !state || !reason || !reviewer || !sourceReference) throw new Error('reviewId, state, reason, reviewer, and sourceReference are required');
  const workflowPath = path.join(repoRoot, REVIEW_ROOT, 'workflow-latest.json');
  const workflow = readJson(workflowPath);
  if (!workflow) throw new Error('daily review workflow is unavailable; run the daily review first');
  const updated = applyReviewAction(workflow, { reviewId, state, reason, decidedAt, reviewer, sourceReference });
  writeReviewWorkflow({ workflow: updated, repoRoot });
  return buildReviewSession({ repoRoot, workflow: updated, generatedAt: decidedAt });
}

function main() {
  const repoRoot = process.env.MIND_STEWARD_REPO_ROOT ?? process.cwd();
  const mindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const args = process.argv.slice(2);
  if (args[0] === '--decision') {
    const [reviewId, state, reason, reviewer, sourceReference] = args.slice(1);
    process.stdout.write(`${JSON.stringify(recordDailyReviewDecision({ repoRoot, reviewId, state, reason, reviewer, sourceReference }), null, 2)}\n`);
    return;
  }
  const session = runDailyReview({ repoRoot, mindRoot });
  process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
