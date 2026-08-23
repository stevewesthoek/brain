import fs from 'node:fs';
import path from 'node:path';

const CAPABILITIES = [
  ['mind_inbox_ingestion', 'tools/scripts/mind-steward-ingest-envelope.mjs', 'operations/runbooks/mind-inbox-ingestion-envelope.md'],
  ['evidence_normalization', 'tools/scripts/mind-steward-review-projection.mjs', 'operations/runbooks/mind-steward-unified-review-inbox.md'],
  ['review_inbox', 'tools/scripts/mind-steward-unified-review-inbox.mjs', 'operations/runbooks/mind-steward-unified-review-inbox.md'],
  ['intelligence_briefing', 'tools/scripts/mind-steward-unified-intelligence-briefing.mjs', 'operations/runbooks/mind-steward-unified-intelligence-briefing.md'],
  ['review_workflow', 'tools/scripts/mind-steward-unified-review-workflow.mjs', 'operations/runbooks/mind-steward-unified-review-workflow.md'],
  ['promotion_boundary', 'tools/scripts/mind-steward-controlled-memory-promotion.mjs', 'operations/runbooks/mind-steward-controlled-memory-promotion.md'],
  ['calibration_feedback', 'tools/scripts/mind-steward-operational-feedback-calibration.mjs', 'operations/runbooks/mind-steward-operational-feedback-calibration.md'],
];

function inspectJson(filePath) {
  if (!fs.existsSync(filePath)) return { present: false, valid: null, path: filePath };
  try { JSON.parse(fs.readFileSync(filePath, 'utf8')); return { present: true, valid: true, path: filePath }; } catch { return { present: true, valid: false, path: filePath }; }
}

export function buildOperationalReadiness({ repoRoot = process.cwd(), briefing = null, workflow = null, calibration = null, dailyLoop = null, promotions = [], generatedAt = dailyLoop?.generated_at ?? workflow?.generated_at ?? briefing?.generated_at ?? new Date().toISOString() } = {}) {
  const capabilities = CAPABILITIES.map(([name, implementation, documentation]) => ({ name, implementation, documentation, available: fs.existsSync(path.join(repoRoot, implementation)) && fs.existsSync(path.join(repoRoot, documentation)) }));
  const runtimeRoot = path.join(repoRoot, 'runtime', 'local', 'mind-steward');
  const runtimeFiles = [path.join(runtimeRoot, 'unified-review', 'briefing-latest.json'), path.join(runtimeRoot, 'unified-review', 'workflow-latest.json'), path.join(runtimeRoot, 'daily-loop', 'latest.json'), path.join(runtimeRoot, 'calibration', 'latest.json')].map((filePath) => inspectJson(filePath));
  const workflowItems = workflow?.items ?? [];
  const calibrationSignals = calibration?.signals ?? {};
  const stale = workflowItems.filter((item) => item.source?.freshness === 'stale');
  const missingProvenance = workflowItems.filter((item) => !item.source?.source_reference || !item.source?.evidence_references?.length || !item.source?.source_hash);
  const conflicts = workflowItems.filter((item) => (Array.isArray(item.source?.uncertainty) ? item.source.uncertainty : [item.source?.uncertainty]).some((value) => /conflict|contradict/i.test(String(value))));
  const pending = workflowItems.filter((item) => ['new', 'reviewing'].includes(item.state));
  const deferred = workflowItems.filter((item) => item.state === 'deferred');
  const activePromotions = promotions.filter((item) => ['promotion_candidate', 'awaiting_confirmation', 'approved_for_promotion'].includes(item.state));
  const failedIngestion = calibrationSignals.failed_ingestion_items ?? 0;
  const missingRuntime = runtimeFiles.filter((item) => !item.present).length;
  const status = capabilities.every((item) => item.available) && runtimeFiles.every((item) => item.valid !== false)
    ? (failedIngestion || missingProvenance.length || conflicts.length || stale.length ? 'ready_with_attention' : missingRuntime === runtimeFiles.length ? 'ready_with_empty_runtime_state' : 'ready')
    : 'not_ready';
  return {
    readiness_version: '1.0.0', generated_at: generatedAt, source: 'infinite-brain-operational-readiness', status, usable_for_daily_review: status !== 'not_ready',
    capabilities, data_health: { stale_artifacts: stale.length, missing_provenance: missingProvenance.length, unresolved_conflicts: conflicts.length, failed_ingestion: failedIngestion, runtime_artifacts_present: runtimeFiles.filter((item) => item.present).length, runtime_artifacts_missing: missingRuntime, runtime_files: runtimeFiles },
    workflow_health: { pending_reviews: pending.length, unresolved_decisions: workflowItems.filter((item) => !['accepted', 'rejected', 'archived'].includes(item.state)).length, promotion_candidates: activePromotions.length, deferred_items: deferred.length },
    operator_guidance: { commands: ['node tools/scripts/mind-steward-daily-intelligence-loop.mjs', 'node tools/scripts/mind-steward-operational-feedback-calibration.mjs'], outputs: ['runtime/local/mind-steward/daily-loop/latest.json', 'runtime/local/mind-steward/daily-loop/latest.md', 'runtime/local/mind-steward/calibration/latest.json', 'runtime/local/mind-steward/calibration/latest.md'], attention: [...pending.map((item) => ({ review_id: item.review_id, action: 'review', source: item.source.source_reference })), ...deferred.map((item) => ({ review_id: item.review_id, action: 'review', source: item.source.source_reference })), ...activePromotions.map((item) => ({ promotion_id: item.promotion_id, action: 'prepare promotion', source: item.source.source_reference }))] },
    limitations: ['readiness does not repair failures', 'runtime-local artifacts may be absent before first use', 'no automatic scheduling, changes, promotion, or provider calls'],
    invariants: { automatic_repair: false, automatic_changes: false, provider_calls: false, writes_to_mind: false, writes_to_brain_canonical: false, new_storage_authority: false },
  };
}

export function renderOperationalReadiness(report) {
  const lines = ['# Infinite Brain Operational Readiness', '', `Generated: ${report.generated_at}`, `Status: **${report.status}**`, `Usable for daily review: ${report.usable_for_daily_review}`, '', '## Capabilities', ''];
  for (const item of report.capabilities) lines.push(`- ${item.name}: ${item.available ? 'available' : 'missing'} (${item.implementation}; ${item.documentation})`);
  lines.push('', '## Data health', '');
  for (const [key, value] of Object.entries(report.data_health).filter(([key]) => key !== 'runtime_files')) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Workflow health', '');
  for (const [key, value] of Object.entries(report.workflow_health)) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Operator guidance', '', ...report.operator_guidance.commands.map((command) => `- Run: \`${command}\``), ...report.operator_guidance.attention.map((item) => `- Attention: ${item.action} ${item.review_id ?? item.promotion_id} (${item.source})`), '', 'This is a read-only readiness report. It does not repair, schedule, decide, promote, or write canonical state.', '');
  return `${lines.join('\n')}\n`;
}

export function writeOperationalReadiness({ report, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'readiness'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_readiness_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'latest.json'); const markdownPath = path.join(resolved, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); fs.writeFileSync(markdownPath, renderOperationalReadiness(report), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
