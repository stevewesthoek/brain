import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertNoAuthorityEscalation } from '../validate-infinite-brain-ingestion-envelope.mjs';

const PROVIDERS = new Set(['claude', 'codex', 'workbench']);
const CATEGORIES = new Set(['decision', 'architecture', 'lesson', 'unresolved_question', 'changed_file', 'validation', 'recurring_problem', 'improvement']);
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

export function createConversationEvidence({ session, candidates = [], asOf = new Date().toISOString() } = {}) {
  if (!session?.provider || !PROVIDERS.has(session.provider)) throw new Error('supported provider is required');
  if (!session.session_id) throw new Error('session_id is required');
  if (session.transcript_read === true) throw new Error('full_transcript_ingestion_is_not_allowed');
  for (const candidate of candidates) {
    if (!CATEGORIES.has(candidate.category)) throw new Error(`unsupported_candidate_category: ${candidate.category}`);
    if (!candidate.statement || candidate.statement.length > 1000) throw new Error('candidate statement must be bounded');
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
    governance: { mind_impact: 'possible', brain_impact: 'possible', privacy_classification: 'restricted', freshness: 'unknown', review_required: true, promotion_authority: 'human-approved-bounded-transaction' },
    evidence: { source_references: [sourceReference], validation_references: [], extraction_confidence: candidates.length ? Math.min(...candidates.map((candidate) => candidate.confidence ?? 0.5)) : 0.5, uncertainty: ['no full transcript stored'] },
    lifecycle: { state: 'ready_for_review' },
  };
  const errors = assertNoAuthorityEscalation(envelope);
  if (errors.length) throw new Error(`conversation_envelope_invalid: ${errors.join('; ')}`);
  return {
    envelope,
    candidate_insights: candidates.map((candidate, index) => ({ candidate_id: `candidate:${digest.slice(0, 12)}:${index + 1}`, category: candidate.category, statement: candidate.statement, confidence: candidate.confidence ?? 0.5, uncertainty: candidate.uncertainty ?? 'requires human review' })),
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
  };
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
