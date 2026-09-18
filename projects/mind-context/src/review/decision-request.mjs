import crypto from 'node:crypto';

const DECISION_REQUEST_VERSION = 1;
const DECISION_KINDS = new Set([
  'review-ready-capture',
  'approve-reject-proposal',
  'processing-failure',
  'contradiction',
  'other-human-decision',
]);
const DEEP_LINK_RE = /^evermind:\/\/(?:review\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}|capture\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|queue)$/i;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function requireText(value, code, max = 512) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(code);
  return value.trim();
}

function optionalText(value, code, max = 512) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, code, max);
}

function requireId(value, code) {
  const normalized = requireText(value, code, 128);
  if (!ID_RE.test(normalized)) throw new Error(code);
  return normalized;
}

function normalizeSource(source = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid_decision_source');
  return Object.freeze({
    type: requireText(source.type, 'invalid_decision_source_type', 128),
    provenance: requireText(source.provenance, 'invalid_decision_provenance', 512),
  });
}

function normalizeCreatedAt(value) {
  const input = value ?? new Date().toISOString();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error('invalid_decision_created_at');
  return date.toISOString();
}

function proposalHashInput(proposal) {
  return JSON.stringify({
    id: proposal.id,
    version: proposal.version,
    content: proposal.content,
    destination: proposal.destination,
    source: proposal.source,
    provenance: proposal.provenance,
  });
}

export function computeProposalHash(proposal = {}) {
  const normalized = {
    id: requireId(proposal.id, 'invalid_proposal_id'),
    version: requireText(String(proposal.version ?? ''), 'invalid_proposal_version', 128),
    content: requireText(proposal.content, 'invalid_proposal_content', 1024 * 1024),
    destination: requireText(proposal.destination, 'invalid_proposal_destination', 1024),
    source: requireText(proposal.source, 'invalid_proposal_source', 512),
    provenance: requireText(proposal.provenance, 'invalid_proposal_provenance', 1024),
  };
  return crypto.createHash('sha256').update(proposalHashInput(normalized)).digest('hex');
}

function normalizeProposal(proposal, fallbackSource) {
  if (proposal === undefined || proposal === null) return null;
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) throw new Error('invalid_proposal');
  const id = requireId(proposal.id, 'invalid_proposal_id');
  const version = requireText(String(proposal.version ?? ''), 'invalid_proposal_version', 128);
  const content = optionalText(proposal.content, 'invalid_proposal_content', 1024 * 1024);
  const destination = optionalText(proposal.destination, 'invalid_proposal_destination', 1024);
  const source = optionalText(proposal.source, 'invalid_proposal_source', 512) ?? fallbackSource.type;
  const provenance = optionalText(proposal.provenance, 'invalid_proposal_provenance', 1024) ?? fallbackSource.provenance;
  const hash = optionalText(proposal.hash, 'invalid_proposal_hash', 128);
  if (hash && !SHA256_RE.test(hash)) throw new Error('invalid_proposal_hash');
  if (hash && content && destination) {
    const expected = computeProposalHash({id, version, content, destination, source, provenance});
    if (hash.toLowerCase() !== expected) throw new Error('proposal_hash_mismatch');
  }
  return Object.freeze({id, version, content, destination, source, provenance, hash: hash?.toLowerCase() ?? null});
}

function safeRelativeDestination(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !value.includes('\\')
    && !value.startsWith('/')
    && !/^[A-Za-z]:/.test(value)
    && !value.split('/').includes('..');
}

function defaultDeepLink(kind, requestId, captureId, proposalId) {
  if (kind === 'review-ready-capture') return `evermind://capture/${captureId}`;
  if (kind === 'approve-reject-proposal') return `evermind://review/${proposalId}`;
  return 'evermind://queue';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createDecisionRequest({
  kind,
  requestId,
  captureId,
  proposalId,
  source,
  proposal,
  title,
  summary,
  deepLink,
  createdAt,
} = {}) {
  if (!DECISION_KINDS.has(kind)) throw new Error('invalid_decision_kind');
  const normalizedSource = normalizeSource(source);
  const normalizedRequestId = requireId(requestId ?? captureId ?? proposalId, 'invalid_decision_request_id');
  const normalizedCaptureId = captureId === undefined || captureId === null ? null : requireId(captureId, 'invalid_capture_id');
  const normalizedProposalId = proposalId === undefined || proposalId === null ? null : requireId(proposalId, 'invalid_proposal_id');
  if (kind === 'review-ready-capture' && !normalizedCaptureId) throw new Error('review_capture_requires_capture_id');
  if (kind === 'approve-reject-proposal' && !normalizedProposalId && !proposal?.id) throw new Error('proposal_request_requires_proposal_id');
  const normalizedProposal = normalizeProposal(proposal, normalizedSource);
  const finalProposalId = normalizedProposalId ?? normalizedProposal?.id ?? null;
  const target = deepLink ?? defaultDeepLink(kind, normalizedRequestId, normalizedCaptureId, finalProposalId);
  if (!DEEP_LINK_RE.test(target)) throw new Error('invalid_decision_deep_link');

  return deepFreeze({
    schemaVersion: DECISION_REQUEST_VERSION,
    requestId: normalizedRequestId,
    kind,
    createdAt: normalizeCreatedAt(createdAt),
    captureId: normalizedCaptureId,
    proposalId: finalProposalId,
    source: normalizedSource,
    proposal: normalizedProposal,
    title: optionalText(title, 'invalid_decision_title', 200),
    summary: optionalText(summary, 'invalid_decision_summary', 500),
    deepLink: target,
  });
}

export function createReviewReadyCaptureRequest({captureId, sourceType = 'drop-file', provenance = 'drop-folder', createdAt} = {}) {
  return createDecisionRequest({
    kind: 'review-ready-capture',
    requestId: captureId,
    captureId,
    source: {type: sourceType, provenance},
    title: 'Evermind capture ready for review',
    summary: 'A new capture is waiting for human review.',
    createdAt,
  });
}

export function createProcessingFailureRequest({requestId = `failure-${Date.now()}`, errorCode = 'processing_failure', createdAt} = {}) {
  return createDecisionRequest({
    kind: 'processing-failure',
    requestId,
    source: {type: 'evermind-processing', provenance: 'local-watcher'},
    title: 'Evermind processing needs attention',
    summary: `Processing stopped safely (${requireText(errorCode, 'invalid_error_code', 128)}).`,
    createdAt,
  });
}

export function isOneClickApprovable(request) {
  if (!request || !Object.isFrozen(request) || request.kind !== 'approve-reject-proposal' || !request.proposal || !Object.isFrozen(request.proposal)) return false;
  const proposal = request.proposal;
  if (request.proposalId !== proposal.id || !proposal.version || !proposal.hash || !SHA256_RE.test(proposal.hash)) return false;
  if (!proposal.content || !safeRelativeDestination(proposal.destination) || !proposal.source || !proposal.provenance) return false;
  return computeProposalHash(proposal) === proposal.hash;
}

export function allowedDecisionActions(request) {
  return isOneClickApprovable(request) ? ['approve', 'review', 'reject'] : ['review', 'reject'];
}

export function assertDecisionActionAllowed(request, action) {
  const normalized = requireText(action, 'invalid_decision_action', 32).toLowerCase();
  if (!allowedDecisionActions(request).includes(normalized)) {
    throw new Error(normalized === 'approve' ? 'approve_requires_immutable_proposal' : 'decision_action_not_allowed');
  }
  return normalized;
}

export function serializeDecisionRequest(request) {
  const validated = createDecisionRequest(request);
  return `${JSON.stringify(validated)}\n`;
}

export function deserializeDecisionRequest(serialized) {
  let parsed;
  try { parsed = JSON.parse(String(serialized)); }
  catch { throw new Error('invalid_decision_request_json'); }
  if (parsed?.schemaVersion !== DECISION_REQUEST_VERSION) throw new Error('unsupported_decision_request_version');
  return createDecisionRequest(parsed);
}

export {DECISION_KINDS, DECISION_REQUEST_VERSION, DEEP_LINK_RE};
