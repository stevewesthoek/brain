import fs from 'node:fs';
import path from 'node:path';

const REVIEW_STATES = ['needs_review', 'accepted', 'rejected', 'deferred', 'archived'];

function refFor(item, fallback) {
  return item.source_reference?.ref
    ?? item.identity?.source_reference?.ref
    ?? item.source?.file
    ?? item.source_file
    ?? item.file
    ?? item.reference
    ?? fallback;
}

function normalizeItem(item, sourceType, index) {
  const repositoryEvidence = item.content?.github_repository_evidence ?? item.github_repository_evidence ?? [];
  const effectiveSourceType = repositoryEvidence.length ? 'github_repository' : sourceType;
  const source = refFor(item, `${sourceType}:${index + 1}`);
  const sourceHash = item.source_revision
    ?? item.identity?.source_revision
    ?? item.source_hash
    ?? item.source?.source_hash
    ?? item.identity?.source_reference?.hash
    ?? item.hash
    ?? null;
  const provenance = item.provenance ?? { origin: item.origin ?? sourceType, adapter: item.adapter ?? 'unified-review-projection', authority_context: item.authority_context ?? { authority_owner: 'brain-runtime', domain: 'brain' } };
  const candidates = item.candidate_insights ?? [];
  return {
    review_id: `review:${effectiveSourceType}:${index + 1}:${sourceHash ?? 'unhashed'}`,
    ingestion_id: item.ingestion_id ?? item.identity?.ingestion_id ?? null,
    source_type: effectiveSourceType,
    origin: provenance.origin ?? effectiveSourceType,
    timestamp: item.timestamp ?? item.created_at ?? item.identity?.created_at ?? item.decided_at ?? provenance.captured_at ?? null,
    source_reference: source,
    source_hash: sourceHash,
    authority_owner: provenance.authority_context?.authority_owner ?? item.authority_owner ?? 'brain-runtime',
    provenance,
    extracted_information: item.extracted_information ?? item.content?.extracted_information ?? (repositoryEvidence.length ? repositoryEvidence : item.statement ?? item.title ?? item.message ?? candidates),
    repository_evidence: repositoryEvidence,
    confidence: item.confidence ?? item.content?.confidence ?? item.extraction_confidence ?? item.evidence?.extraction_confidence ?? 0.5,
    uncertainty: item.uncertainty ?? item.content?.uncertainty ?? item.evidence?.uncertainty ?? ['source-specific uncertainty not supplied'],
    freshness: item.freshness ?? item.governance?.freshness ?? 'unknown',
    relevance: item.relevance ?? 'unassessed',
    mind_impact: item.mind_impact ?? item.governance?.mind_impact ?? 'possible',
    brain_impact: item.brain_impact ?? item.governance?.brain_impact ?? 'possible',
    requires_human_decision: true,
    review_state: item.review_state ?? 'needs_review',
    decision_options: REVIEW_STATES,
  };
}

export function buildUnifiedReviewInbox({ ingestion = [], pdf = [], conversations = [], maintenance = [], lifecycle = [], feedback = [], generatedAt = new Date().toISOString() } = {}) {
  const sources = [
    ['mind_inbox', ingestion], ['pdf_extraction', pdf], ['conversation_evidence', conversations],
    ['maintenance_finding', maintenance], ['lifecycle_finding', lifecycle], ['operational_feedback', feedback],
  ];
  const items = sources.flatMap(([sourceType, values]) => values.map((item, index) => normalizeItem(item, sourceType, index)));
  const repositoryEvidence = items.flatMap((item) => item.repository_evidence ?? []);
  // Duplicate repository identities are rejected rather than silently merged or ranked.
  const repositoryIds = new Set();
  for (const evidence of repositoryEvidence) {
    const repositoryId = typeof evidence.repository?.repository_id === 'string' ? evidence.repository.repository_id.toLowerCase() : null;
    if (repositoryId && repositoryIds.has(repositoryId)) throw new Error(`duplicate_github_repository_identity:${repositoryId}`);
    if (repositoryId) repositoryIds.add(repositoryId);
  }
  return {
    projection_version: '1.0.0',
    generated_at: generatedAt,
    source: 'infinite-brain-unified-review',
    review_states: REVIEW_STATES,
    items,
    counts: { total: items.length, needs_review: items.filter((item) => item.review_state === 'needs_review').length },
    invariants: {
      writes_to_mind: false,
      writes_to_brain_canonical: false,
      automatic_promotion: false,
      automatic_decisions: false,
      provider_calls: false,
      duplicate_authority: false,
    },
  };
}

export function renderUnifiedReviewInbox(projection) {
  const lines = [
    '# Infinite Brain Unified Review Inbox', '',
    `Generated: ${projection.generated_at}`,
    `Items: ${projection.counts.total}; needs review: ${projection.counts.needs_review}`,
    '',
    '- Review states are workflow states only.',
    '- Requires human decision: true for every item.',
    '- Writes to Mind: false',
    '- Writes to Brain canonical: false',
    '- Automatic promotion: false',
    '',
  ];
  for (const [index, item] of projection.items.entries()) {
    lines.push(`## ${index + 1}. ${item.source_type} — ${item.source_reference}`, '');
    lines.push(`- Review state: **${item.review_state}**`);
    lines.push(`- Decision options: ${item.decision_options.join(', ')}`);
    lines.push(`- Origin: ${item.origin}`);
    lines.push(`- Timestamp: ${item.timestamp ?? 'unknown'}`);
    lines.push(`- Source hash/reference: ${item.source_hash ?? 'reference only'}`);
    lines.push(`- Authority owner: ${item.authority_owner}`);
    lines.push(`- Confidence: ${item.confidence}`);
    lines.push(`- Freshness: ${item.freshness}; relevance: ${item.relevance}`);
    lines.push(`- Mind impact: ${item.mind_impact}; Brain impact: ${item.brain_impact}`);
    lines.push(`- Requires human decision: ${item.requires_human_decision}`);
    lines.push(`- Uncertainty: ${Array.isArray(item.uncertainty) ? item.uncertainty.join('; ') : item.uncertainty}`);
    lines.push(`- Extracted information: ${typeof item.extracted_information === 'string' ? item.extracted_information : JSON.stringify(item.extracted_information)}`, '');
  }
  return `${lines.join('\n')}\n`;
}

export function writeUnifiedReviewInbox({ projection, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'unified-review'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_unified_review_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'latest.json');
  const markdownPath = path.join(resolved, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(projection, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, renderUnifiedReviewInbox(projection), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
