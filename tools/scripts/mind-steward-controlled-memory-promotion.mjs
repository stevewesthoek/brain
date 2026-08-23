import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const STATES = ['not_eligible', 'promotion_candidate', 'awaiting_confirmation', 'approved_for_promotion', 'promoted', 'rejected'];
const TARGETS = new Set(['Mind', 'Brain', 'evidence/archive only']);

function requireAcceptedReview(review) {
  if (!review?.review_id || !review.source?.source_reference || !review.source?.ingestion_or_review_id || !review.source?.source_hash || !review.source?.authority_owner || review.source?.freshness == null || review.source?.confidence == null || review.source?.uncertainty == null) throw new Error('promotion provenance is required');
  if (review.state !== 'accepted') throw new Error('review must be accepted before promotion preparation');
  const decision = [...(review.history ?? [])].reverse().find((entry) => entry.state === 'accepted');
  if (!decision?.action_id) throw new Error('accepted review decision is required');
  return decision;
}

function promotionId(review) {
  return `promotion:${crypto.createHash('sha256').update(`${review.review_id}|${review.source.source_hash ?? 'unhashed'}`).digest('hex').slice(0, 24)}`;
}

function sourceFromReview(review) {
  return {
    source_reference: review.source.source_reference,
    review_history_reference: `review-history:${review.review_id}`,
    decision_reference: [...review.history].reverse().find((entry) => entry.state === 'accepted').action_id,
    ingestion_or_review_id: review.source.ingestion_or_review_id,
    timestamp: review.source.timestamp,
    source_hash: review.source.source_hash,
    authority_owner: review.source.authority_owner,
    freshness: review.source.freshness,
    confidence: review.source.confidence,
    uncertainty: review.source.uncertainty,
    provenance: review.source.evidence_references,
  };
}

export function createPromotionCandidate({ review, targetDomain, proposedDestination, rollbackReference, existingPromotion = null } = {}) {
  const decision = requireAcceptedReview(review);
  if (existingPromotion?.source?.ingestion_or_review_id === review.source.ingestion_or_review_id && ['promotion_candidate', 'awaiting_confirmation', 'approved_for_promotion', 'promoted'].includes(existingPromotion.state)) throw new Error('duplicate promotion prevented');
  if (!TARGETS.has(proposedDestination)) throw new Error(`invalid promotion destination: ${proposedDestination}`);
  if (!targetDomain) throw new Error('target authority domain is required');
  if (!rollbackReference) throw new Error('rollback reference is required');
  return {
    schema_version: '1.0.0',
    promotion_id: promotionId(review),
    state: 'promotion_candidate',
    target_authority_domain: targetDomain,
    proposed_destination: proposedDestination,
    source: sourceFromReview(review),
    rollback_reference: rollbackReference,
    candidate_reason: decision.reason,
    history: [],
    evidence_preserved: true,
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
    provider_calls: false,
    new_storage_authority: false,
  };
}

export function requestPromotionConfirmation(candidate, { requestedAt, reviewer, reason } = {}) {
  if (candidate.state !== 'promotion_candidate' && candidate.state !== 'awaiting_confirmation') throw new Error('promotion candidate is not awaiting confirmation');
  if (!requestedAt || !reviewer || !reason) throw new Error('confirmation request requires timestamp, reviewer, and reason');
  return {
    ...candidate,
    state: 'awaiting_confirmation',
    history: [...candidate.history, { state: 'awaiting_confirmation', requested_at: requestedAt, reviewer, reason }],
  };
}

export function approvePromotion(candidate, { targetDomain, proposedDestination, scope, approvedAt, reviewer, reason } = {}) {
  if (candidate.state !== 'awaiting_confirmation') throw new Error('promotion confirmation is required');
  if (!TARGETS.has(proposedDestination) || proposedDestination !== candidate.proposed_destination) throw new Error('approved destination must match candidate');
  if (!targetDomain || targetDomain !== candidate.target_authority_domain) throw new Error('approved authority domain must match candidate');
  if (!scope || !approvedAt || !reviewer || !reason) throw new Error('approval requires target, scope, timestamp, reviewer, and reason');
  return {
    ...candidate,
    state: 'approved_for_promotion',
    history: [...candidate.history, { state: 'approved_for_promotion', target_domain: targetDomain, destination: proposedDestination, scope, approved_at: approvedAt, reviewer, reason }],
  };
}

export function recordPromotionReceipt(candidate, { receiptReference, promotedAt, reviewer, rollbackReference } = {}) {
  if (candidate.state !== 'approved_for_promotion') throw new Error('approved promotion is required');
  if (!receiptReference || !promotedAt || !reviewer || !rollbackReference) throw new Error('promotion receipt and rollback reference are required');
  return {
    ...candidate,
    state: 'promoted',
    rollback_reference: rollbackReference,
    history: [...candidate.history, { state: 'promoted', receipt_reference: receiptReference, promoted_at: promotedAt, reviewer, rollback_reference: rollbackReference }],
    writes_to_mind: false,
    writes_to_brain_canonical: false,
  };
}

export function rejectPromotion(candidate, { rejectedAt, reviewer, reason } = {}) {
  if (!reason || !rejectedAt || !reviewer) throw new Error('rejection requires reason, timestamp, and reviewer');
  if (candidate.state === 'promoted') throw new Error('promoted candidate cannot be rejected');
  return { ...candidate, state: 'rejected', history: [...candidate.history, { state: 'rejected', rejected_at: rejectedAt, reviewer, reason }] };
}

export function writePromotionArtifact({ artifact, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'promotions'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_promotion_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const filePath = path.join(resolved, `${artifact.promotion_id.replace(':', '-')}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}
