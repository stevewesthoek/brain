import fs from 'node:fs';
import path from 'node:path';

const FINDING_TYPES = ['review_usefulness', 'information_quality', 'workflow_friction'];

function finding({ type, evidence, affectedCapability, confidence, uncertainty, improvementArea }) {
  return { finding_type: type, evidence, affected_capability: affectedCapability, confidence, uncertainty, possible_improvement_area: improvementArea, report_only: true };
}

export function buildOperationalFeedbackCalibration({ briefing = null, workflow = null, dailyLoop = null, generatedAt = dailyLoop?.generated_at ?? workflow?.generated_at ?? briefing?.generated_at ?? new Date().toISOString(), sourcePaths = [] } = {}) {
  const items = workflow?.items ?? [];
  const briefingItems = briefing?.attention_queue ?? [];
  const findings = [];
  const deferred = items.filter((item) => item.state === 'deferred');
  const rejected = items.filter((item) => item.state === 'rejected');
  const stale = items.filter((item) => item.source?.freshness === 'stale');
  const missingProvenance = items.filter((item) => !item.source?.source_reference || !item.source?.evidence_references?.length || !item.source?.source_hash);
  const repeated = items.filter((item) => (item.history ?? []).length > 1 || (item.history ?? []).filter((entry) => entry.state === 'deferred').length > 1);
  const duplicateHashes = new Map();
  for (const item of briefingItems) if (item.source_hash) duplicateHashes.set(item.source_hash, [...(duplicateHashes.get(item.source_hash) ?? []), item.review_id]);
  const duplicates = [...duplicateHashes.entries()].filter(([, ids]) => ids.length > 1);
  const failedIngestion = briefingItems.filter((item) => /failure|failed|error/i.test(`${item.source_type} ${item.extracted_information ?? ''}`));
  const missingContext = items.filter((item) => (Array.isArray(item.source?.uncertainty) ? item.source.uncertainty : [item.source?.uncertainty]).some((value) => /context|uncertain|unknown/i.test(String(value))));

  if (items.length) findings.push(finding({ type: 'review_usefulness', evidence: { reviewed_items: items.length, accepted_items: items.filter((item) => item.state === 'accepted').length, rejected_items: rejected.length, deferred_items: deferred.length }, affectedCapability: 'human review workflow', confidence: 1, uncertainty: [], improvementArea: 'Compare these report-only counts over time before changing workflow guidance.' }));
  if (repeated.length) findings.push(finding({ type: 'review_usefulness', evidence: repeated.map((item) => ({ review_id: item.review_id, history_entries: item.history.length })), affectedCapability: 'review history continuity', confidence: 0.9, uncertainty: ['Repeated review indicates friction but does not establish its cause.'], improvementArea: 'Inspect repeated items and clarify evidence or review guidance.' }));
  if (rejected.length) findings.push(finding({ type: 'information_quality', evidence: rejected.map((item) => ({ review_id: item.review_id, source: item.source.source_reference })), affectedCapability: 'evidence quality', confidence: 0.7, uncertainty: ['Rejection is a human outcome and is not proof of a false positive.'], improvementArea: 'Review rejected evidence for noise or missing context.' }));
  if (stale.length) findings.push(finding({ type: 'information_quality', evidence: stale.map((item) => item.review_id), affectedCapability: 'freshness tracking', confidence: 1, uncertainty: [], improvementArea: 'Review source freshness policy or refresh stale evidence.' }));
  if (duplicates.length) findings.push(finding({ type: 'information_quality', evidence: duplicates.map(([source_hash, review_ids]) => ({ source_hash, review_ids })), affectedCapability: 'deduplication', confidence: 1, uncertainty: ['Matching hashes identify duplicate source revisions, not duplicate meaning.'], improvementArea: 'Inspect duplicate source revisions before changing ingestion behavior.' }));
  if (missingContext.length) findings.push(finding({ type: 'workflow_friction', evidence: missingContext.map((item) => item.review_id), affectedCapability: 'context retrieval', confidence: 0.8, uncertainty: ['The report cannot determine which context is missing.'], improvementArea: 'Add or link bounded context before review.' }));
  if (missingProvenance.length) findings.push(finding({ type: 'workflow_friction', evidence: missingProvenance.map((item) => item.review_id), affectedCapability: 'provenance validation', confidence: 1, uncertainty: [], improvementArea: 'Repair provenance at the source or reject the item; do not promote it.' }));
  if (failedIngestion.length) findings.push(finding({ type: 'workflow_friction', evidence: failedIngestion.map((item) => item.review_id), affectedCapability: 'ingestion', confidence: 0.9, uncertainty: ['Failure text is evidence of an issue, not a diagnosis.'], improvementArea: 'Inspect the bounded ingestion failure report.' }));
  return {
    calibration_version: '1.0.0', generated_at: generatedAt, source: 'infinite-brain-operational-feedback', source_paths: sourcePaths,
    real_inputs_present: Boolean(briefing || workflow || dailyLoop),
    signals: { reviewed_items: items.length, accepted_items: items.filter((item) => item.state === 'accepted').length, rejected_items: rejected.length, deferred_items: deferred.length, repeated_review_items: repeated.length, noisy_or_rejected_items: rejected.length, missing_context_items: missingContext.length, stale_items: stale.length, duplicate_findings: duplicates.length, missing_provenance_items: missingProvenance.length, failed_ingestion_items: failedIngestion.length },
    findings,
    invariants: { report_only: true, writes_to_mind: false, writes_to_brain_canonical: false, automatic_proposals: false, automatic_promotion: false, provider_calls: false, new_storage_authority: false },
    limitations: ['signals are observations, not diagnoses', 'no automatic optimization or change decision', 'no synthetic usage data when source artifacts are absent'],
  };
}

export function renderOperationalFeedbackCalibration(report) {
  const lines = ['# Infinite Brain Operational Feedback and Calibration', '', `Generated: ${report.generated_at}`, `Real inputs present: ${report.real_inputs_present}`, '', '## Signals', ''];
  for (const [key, value] of Object.entries(report.signals)) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Report-only findings', '');
  for (const item of report.findings) lines.push(`### ${item.finding_type} — ${item.affected_capability}`, '', `- Evidence: ${JSON.stringify(item.evidence)}`, `- Confidence: ${item.confidence}`, `- Uncertainty: ${item.uncertainty.join('; ') || 'none supplied'}`, `- Possible improvement area: ${item.possible_improvement_area}`, '- No automatic proposal or change is created.', '');
  if (!report.findings.length) lines.push('_No feedback findings were generated from the available artifacts._', '');
  lines.push('This report is observational only. It does not decide, propose, promote, or write canonical state.', '');
  return `${lines.join('\n')}\n`;
}

export function writeOperationalFeedbackCalibration({ report, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'calibration'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_calibration_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'latest.json');
  const markdownPath = path.join(resolved, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, renderOperationalFeedbackCalibration(report), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
