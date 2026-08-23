import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

export function loadOperationalLearningInputs(repoRoot = process.cwd()) {
  const root = path.join(repoRoot, 'runtime', 'local', 'mind-steward');
  const files = { daily_loop: path.join(root, 'daily-loop', 'latest.json'), calibration: path.join(root, 'calibration', 'latest.json'), readiness: path.join(root, 'readiness', 'latest.json'), workflow: path.join(root, 'unified-review', 'workflow-latest.json'), briefing: path.join(root, 'unified-review', 'briefing-latest.json') };
  return { artifacts: Object.fromEntries(Object.entries(files).map(([name, filePath]) => [name, readJson(filePath)])), source_paths: Object.values(files) };
}

function candidateFromFinding(item, category) {
  return { category, evidence: item.evidence, affected_capability: item.affected_capability, confidence: item.confidence, uncertainty: item.uncertainty, possible_impact: item.possible_improvement_area, mind_review_may_be_required: /context|mind|meaning|priority/i.test(item.affected_capability), report_only: true };
}

export function buildOperationalLearningCheckpoint({ artifacts = {}, sourcePaths = [], generatedAt = artifacts.daily_loop?.generated_at ?? artifacts.calibration?.generated_at ?? artifacts.readiness?.generated_at ?? artifacts.workflow?.generated_at ?? new Date().toISOString() } = {}) {
  const workflow = artifacts.workflow;
  const calibration = artifacts.calibration;
  const readiness = artifacts.readiness;
  const workflowItems = workflow?.items ?? [];
  const findings = calibration?.findings ?? [];
  const capabilitiesUsed = Object.entries(artifacts).filter(([, value]) => value !== null).map(([name]) => name).sort();
  const failedWorkflows = (calibration?.signals?.failed_ingestion_items ?? 0) + (readiness?.status === 'not_ready' ? 1 : 0);
  const successfulWorkflows = workflowItems.filter((item) => ['accepted', 'archived'].includes(item.state)).length;
  const friction = findings.filter((item) => item.finding_type === 'workflow_friction');
  const quality = findings.filter((item) => item.finding_type === 'information_quality');
  const review = findings.filter((item) => item.finding_type === 'review_usefulness');
  const improvementCandidates = [
    ...friction.filter((item) => item.confidence >= 0.9).map((item) => candidateFromFinding(item, 'immediate_fix')),
    ...quality.filter((item) => item.confidence >= 0.8).map((item) => candidateFromFinding(item, 'future_capability')),
    ...findings.filter((item) => item.uncertainty?.length).map((item) => candidateFromFinding(item, 'experimental_idea')),
  ];
  return {
    checkpoint_version: '1.0.0', generated_at: generatedAt, source: 'infinite-brain-operational-learning', source_paths: sourcePaths, real_inputs_present: capabilitiesUsed.length > 0,
    usage_observations: { capabilities_used: capabilitiesUsed, review_volume: workflowItems.length, successful_workflows: successfulWorkflows, failed_workflows: failedWorkflows, evidence_basis: sourcePaths },
    friction_observations: { repeated_manual_steps: review.flatMap((item) => item.evidence ?? []), unclear_outputs: friction.flatMap((item) => item.evidence ?? []), missing_context: calibration?.signals?.missing_context_items ?? 0, unsupported_inputs: calibration?.signals?.failed_ingestion_items ?? 0, stale_information: calibration?.signals?.stale_items ?? 0 },
    improvement_candidates: improvementCandidates,
    roadmap_guidance: { immediate_fixes: improvementCandidates.filter((item) => item.category === 'immediate_fix'), future_capabilities: improvementCandidates.filter((item) => item.category === 'future_capability'), experimental_ideas: improvementCandidates.filter((item) => item.category === 'experimental_idea') },
    reassessment_guidance: { minimum_real_usage_period: '2 weeks or 10 completed review sessions, whichever is later', evidence_required: ['calibration reports from real sessions', 'review and decision history', 'readiness results', 'operator-noted friction'], do_not_infer_from: ['empty runtime state', 'synthetic fixtures', 'single-session results'] },
    invariants: { report_only: true, automatic_changes: false, automatic_proposals: false, writes_to_mind: false, writes_to_brain_canonical: false, provider_calls: false, autonomous_optimization: false, new_storage_authority: false },
    limitations: ['observations are not diagnoses', 'candidates are not proposals or decisions', 'no usage claims are made without runtime artifacts'],
  };
}

export function renderOperationalLearningCheckpoint(report) {
  const lines = ['# Infinite Brain Operational Learning Checkpoint', '', `Generated: ${report.generated_at}`, `Real inputs present: ${report.real_inputs_present}`, '', '## Usage observations', '', `- Capabilities used: ${report.usage_observations.capabilities_used.join(', ') || 'none observed'}`, `- Review volume: ${report.usage_observations.review_volume}`, `- Successful workflows: ${report.usage_observations.successful_workflows}`, `- Failed workflows: ${report.usage_observations.failed_workflows}`, '', '## Friction observations', ''];
  for (const [key, value] of Object.entries(report.friction_observations)) lines.push(`- ${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`);
  lines.push('', '## Roadmap guidance', '');
  for (const [key, values] of Object.entries(report.roadmap_guidance)) lines.push(`- ${key}: ${values.length} report-only candidate(s)`);
  lines.push('', `Reassess after ${report.reassessment_guidance.minimum_real_usage_period}.`, 'No automatic change, proposal, promotion, or canonical write is produced.', '');
  return `${lines.join('\n')}\n`;
}

export function writeOperationalLearningCheckpoint({ report, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'learning'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_learning_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'latest.json'); const markdownPath = path.join(resolved, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); fs.writeFileSync(markdownPath, renderOperationalLearningCheckpoint(report), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
