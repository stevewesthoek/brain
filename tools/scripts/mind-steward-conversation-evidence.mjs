import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertNoAuthorityEscalation } from '../validate-infinite-brain-ingestion-envelope.mjs';

const PROVIDERS = new Set(['claude', 'codex', 'workbench']);
const CATEGORIES = new Set(['decision', 'architecture', 'lesson', 'unresolved_question', 'changed_file', 'validation', 'recurring_problem', 'improvement']);
const SIGNAL_CATEGORIES = new Map([
  ['decision', 'decision'], ['architecture', 'architecture'], ['lesson', 'lesson'],
  ['tradeoff', 'decision'], ['unresolved_question', 'unresolved_question'],
  ['recurring_problem', 'recurring_problem'], ['validated_solution', 'validation'],
  ['changed_behavior', 'improvement'], ['changed_file', 'changed_file'], ['future_action', 'improvement'],
]);
const SAFE_PRIVACY_CLASSES = new Set(['public', 'technical', 'internal']);
const FRESHNESS = new Set(['fresh', 'stale', 'unknown']);
const MAX_CANDIDATES = 100;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk|ghp|github_pat|xox[baprs])-[-_a-z0-9]{12,}\b/i,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*[^\s,;]{8,}/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
];
const SESSION_ROOTS = {
  claude: path.join(process.env.HOME ?? '', '.claude', 'projects'),
  codex: path.join(process.env.HOME ?? '', '.codex', 'sessions'),
};

function assertSafeSessionPath(provider, sessionPath) {
  if (!PROVIDERS.has(provider)) throw new Error('unsupported_session_provider');
  if (!sessionPath) return null;
  if (provider === 'workbench') throw new Error('workbench_session_reference_requires_explicit_metadata');
  const root = path.resolve(SESSION_ROOTS[provider]);
  const resolved = path.resolve(sessionPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('unsafe_session_path');
  return resolved;
}

export function readSessionMetadata({ provider, sessionPath } = {}) {
  const resolved = assertSafeSessionPath(provider, sessionPath);
  if (!resolved) return { provider, metadata_only: true, transcript_read: false };
  const firstLine = fs.readFileSync(resolved, 'utf8').split('\n', 1)[0];
  let parsed = {};
  try { parsed = JSON.parse(firstLine); } catch { parsed = {}; }
  const payload = parsed.payload ?? parsed;
  return {
    provider,
    session_id: payload.session_id ?? payload.id ?? path.basename(resolved).replace(/\.jsonl?$/, ''),
    repository: payload.repository ?? payload.cwd ?? null,
    workspace: payload.worktree ?? payload.cwd ?? null,
    timestamp: parsed.timestamp ?? payload.timestamp ?? null,
    metadata_only: true,
    transcript_read: false,
  };
}

function validateSessionContext(session) {
  for (const name of ['session_id', 'repository', 'workspace']) {
    if (session[name] != null && (typeof session[name] !== 'string' || session[name].length > 500)) throw new Error(`invalid_session_${name}`);
  }
  if (session.freshness != null && !FRESHNESS.has(session.freshness)) throw new Error('invalid_session_freshness');
  if (session.timestamp != null && typeof session.timestamp !== 'string') throw new Error('invalid_session_timestamp');
}

function assertNoSecretLikeContent(statement) {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(statement))) throw new Error('secret_like_conversation_content_is_not_allowed');
}

function contextText(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return '';
  return Object.entries(context).filter(([, value]) => value != null && String(value).trim()).map(([key, value]) => `${key}: ${String(value).trim()}`).join('; ');
}

function assertCandidateSafety(candidate) {
  if (candidate.privacy_classification != null && !SAFE_PRIVACY_CLASSES.has(candidate.privacy_classification)) throw new Error('restricted_conversation_content_is_not_allowed');
  if (!CATEGORIES.has(candidate.category)) throw new Error(`unsupported_candidate_category: ${candidate.category}`);
  if (!candidate.statement || candidate.statement.length > 1000) throw new Error('candidate statement must be bounded');
  assertNoSecretLikeContent(candidate.statement);
  if (candidate.freshness != null && !FRESHNESS.has(candidate.freshness)) throw new Error('invalid_candidate_freshness');
}

export function extractConversationCandidates({ session, records = [] } = {}) {
  if (!Array.isArray(records) || records.length > MAX_CANDIDATES) throw new Error('conversation_records_limit_exceeded');
  const candidates = records.flatMap((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('conversation_record_must_be_object');
    if ('transcript' in record || 'messages' in record || 'content' in record) throw new Error('raw_transcript_record_is_not_allowed');
    const candidate = record.candidate ?? record;
    const common = {
      confidence: candidate.confidence ?? record.confidence,
      uncertainty: candidate.uncertainty ?? record.uncertainty,
      observed_at: candidate.observed_at ?? record.observed_at ?? session.timestamp ?? null,
      freshness: candidate.freshness ?? record.freshness ?? session.freshness ?? 'unknown',
      repository: candidate.repository ?? record.repository ?? session.repository ?? null,
      ...(candidate.privacy_classification ?? record.privacy_classification ? { privacy_classification: candidate.privacy_classification ?? record.privacy_classification } : {}),
    };
    const signals = candidate.signals ?? record.signals;
    if (signals && typeof signals === 'object' && !Array.isArray(signals)) {
      return Object.entries(signals).flatMap(([signal, value]) => {
        const category = SIGNAL_CATEGORIES.get(signal);
        if (!category || value == null || String(value).trim() === '') return [];
        const values = Array.isArray(value) ? value : [value];
        return values.map((entry) => ({ ...common, category, statement: `${String(entry).trim()}${contextText(candidate.context ?? record.context) ? ` Context: ${contextText(candidate.context ?? record.context)}` : ''}`, ...(candidate.context ?? record.context ? { context: candidate.context ?? record.context } : {}) }));
      });
    }
    return [{ ...common, category: candidate.category, statement: candidate.statement, ...(candidate.context ?? record.context ? { context: candidate.context ?? record.context } : {}) }];
  });
  if (candidates.length > MAX_CANDIDATES) throw new Error('conversation_candidates_limit_exceeded');
  candidates.forEach((candidate) => {
    assertCandidateSafety(candidate);
    if (candidate.repository != null && candidate.repository !== session.repository) throw new Error('conflicting_repository_context');
  });
  return candidates;
}

export function createConversationEvidence({ session, candidates = [], asOf = new Date().toISOString() } = {}) {
  if (!session?.provider || !PROVIDERS.has(session.provider)) throw new Error('supported provider is required');
  if (!session.session_id) throw new Error('session_id is required');
  if (session.transcript_read === true) throw new Error('full_transcript_ingestion_is_not_allowed');
  validateSessionContext(session);
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) throw new Error('conversation_candidates_limit_exceeded');
  for (const candidate of candidates) {
    assertCandidateSafety(candidate);
    if (candidate.repository != null && candidate.repository !== session.repository) throw new Error('conflicting_repository_context');
  }
  const sourceRef = `session:${session.provider}:${session.session_id}`;
  const digest = crypto.createHash('sha256').update(JSON.stringify({ sourceRef, asOf, candidates })).digest('hex');
  const sourceReference = { ref: sourceRef, kind: 'session', hash: `sha256:${digest}` };
  const envelope = {
    schema_version: '1.0.0',
    identity: {
      ingestion_id: `ingestion:conversation-${digest.slice(0, 20)}`,
      source_type: `${session.provider}_session`,
      source_reference: sourceReference,
      created_at: asOf,
      source_revision: `sha256:${digest}`,
    },
    provenance: {
      origin: `${session.provider}-session-reference`,
      capture_method: 'session_export',
      adapter: 'mind-steward-conversation-evidence-v1',
      captured_at: session.timestamp ?? asOf,
      authority_context: { authority_owner: 'external-source', domain: 'external', source_of_authority: sourceReference },
    },
    content: {
      detected_format: 'application/session-evidence+json',
      extracted_content_references: [sourceReference],
      metadata: { provider: session.provider, session_id: session.session_id, repository: session.repository ?? null, workspace: session.workspace ?? null, transcript_read: false },
      entities: [], relationships: [], confidence: candidates.length ? Math.min(...candidates.map((candidate) => candidate.confidence ?? 0.5)) : 0.5,
      uncertainty: ['candidate extraction is bounded and requires human review', 'conversation context is not copied by default'],
    },
    governance: { mind_impact: 'possible', brain_impact: 'possible', privacy_classification: 'restricted', freshness: session.freshness ?? 'unknown', review_required: true, promotion_authority: 'human-approved-bounded-transaction' },
    evidence: { source_references: [sourceReference], validation_references: [], extraction_confidence: candidates.length ? Math.min(...candidates.map((candidate) => candidate.confidence ?? 0.5)) : 0.5, uncertainty: ['no full transcript stored'] },
    lifecycle: { state: 'ready_for_review' },
  };
  const errors = assertNoAuthorityEscalation(envelope);
  if (errors.length) throw new Error(`conversation_envelope_invalid: ${errors.join('; ')}`);
  return {
    envelope,
    candidate_insights: candidates.map((candidate, index) => ({ candidate_id: `candidate:${digest.slice(0, 12)}:${index + 1}`, category: candidate.category, statement: candidate.statement, context: candidate.context ?? null, source_session_id: session.session_id, observed_at: candidate.observed_at ?? session.timestamp ?? asOf, repository: session.repository ?? null, freshness: candidate.freshness ?? session.freshness ?? 'unknown', provenance: { source: sourceReference, retrieved_at: asOf }, confidence: candidate.confidence ?? 0.5, uncertainty: candidate.uncertainty ?? 'requires human review' })),
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
  };
}

export function readConversationEvidenceFile({ filePath, repoRoot = process.cwd() } = {}) {
  if (!filePath) throw new Error('conversation_evidence_file_required');
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward', 'conversation-evidence');
  const resolved = path.resolve(filePath);
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_conversation_input');
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const envelope = parsed.envelope ?? parsed;
  const errors = assertNoAuthorityEscalation(envelope);
  if (errors.length) throw new Error(`conversation_envelope_invalid: ${errors.join('; ')}`);
  if (envelope.content?.metadata?.transcript_read === true) throw new Error('full_transcript_ingestion_is_not_allowed');
  const candidates = parsed.candidate_insights ?? envelope.candidate_insights ?? [];
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) throw new Error('conversation_candidates_limit_exceeded');
  const sessionId = envelope.content?.metadata?.session_id;
  const repository = envelope.content?.metadata?.repository ?? null;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.statement !== 'string') throw new Error('conversation_candidate_invalid');
    assertCandidateSafety(candidate);
    if (candidate.source_session_id && candidate.source_session_id !== sessionId) throw new Error('conflicting_session_context');
    if (candidate.repository != null && candidate.repository !== repository) throw new Error('conflicting_repository_context');
    if (candidate.freshness != null && !FRESHNESS.has(candidate.freshness)) throw new Error('invalid_candidate_freshness');
  }
  return { ...envelope, candidate_insights: candidates };
}

export function writeConversationEvidence({ envelope, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'conversation-evidence'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_conversation_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const filePath = path.join(resolved, `${envelope.envelope.identity.ingestion_id.replace(':', '-')}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}
