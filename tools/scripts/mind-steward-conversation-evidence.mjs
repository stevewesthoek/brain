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
const ACTORS = new Set(['human', 'assistant', 'tool']);
const CLAIM_TYPES = new Set(['user_statement', 'assistant_statement', 'tool_observation', 'repository_evidence', 'runtime_observation', 'inference', 'recommendation', 'decision', 'unresolved_question']);
const POLARITIES = new Set(['positive', 'negative', 'neutral']);
const MAX_CANDIDATES = 100;
const DEFAULT_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const ADAPTER_ID = 'mind-steward-conversation-evidence-v2';
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

function redactSensitiveText(value) {
  let text = String(value);
  let redactions = 0;
  const replacements = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi, '[REDACTED_SECRET]'],
    [/\b(?:sk|pk|ghp|github_pat|xox[baprs])-[-_a-z0-9]{12,}\b/gi, '[REDACTED_SECRET]'],
    [/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi, (_match, key) => `${key}=[REDACTED_SECRET]`],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED_SECRET]'],
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, (...args) => {
      redactions += 1;
      return typeof replacement === 'function' ? replacement(...args) : replacement;
    });
  }
  return { text, redactions };
}

function contextText(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return '';
  return Object.entries(context).filter(([, value]) => value != null && String(value).trim()).map(([key, value]) => `${key}: ${String(value).trim()}`).join('; ');
}

function redactContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return context ?? null;
  return Object.fromEntries(Object.entries(context).map(([key, value]) => {
    const redacted = redactSensitiveText(value);
    return [key, redacted.text];
  }));
}

function inferClaimType(actor, explicit) {
  if (explicit && !CLAIM_TYPES.has(explicit)) throw new Error('invalid_claim_type');
  if (explicit) return explicit;
  return actor === 'assistant' ? 'assistant_statement' : actor === 'tool' ? 'tool_observation' : 'user_statement';
}

function inferInfrastructure(statement, explicit) {
  if (explicit === 'infrastructure') return true;
  return /\b(?:host|server|service|application|runtime|deploy(?:ment)?|credential|token|oauth|iam|network|ssh|tailscale|tunnel|webgpt|stitch|api key|keychain|database|health|healthy|unavailable|outage|production)\b/i.test(statement);
}

function inferPolarity(statement, explicit) {
  if (explicit && !POLARITIES.has(explicit)) throw new Error('invalid_claim_polarity');
  if (explicit) return explicit;
  if (/\b(?:unhealthy|unavailable|broken|down|failed|failure|outage|revoked|expired|blocked)\b/i.test(statement)) return 'negative';
  if (/\b(?:healthy|available|working|up|success(?:ful)?|ready|active)\b/i.test(statement)) return 'positive';
  return 'neutral';
}

function assertCandidateSafety(candidate) {
  if (candidate.privacy_classification != null && !SAFE_PRIVACY_CLASSES.has(candidate.privacy_classification)) throw new Error('restricted_conversation_content_is_not_allowed');
  if (!CATEGORIES.has(candidate.category)) throw new Error(`unsupported_candidate_category: ${candidate.category}`);
  if (!candidate.statement || candidate.statement.length > 1000) throw new Error('candidate statement must be bounded');
  if (candidate.freshness != null && !FRESHNESS.has(candidate.freshness)) throw new Error('invalid_candidate_freshness');
  if (candidate.actor != null && !ACTORS.has(candidate.actor)) throw new Error('invalid_conversation_actor');
  inferClaimType(candidate.actor ?? 'human', candidate.claim_type);
  inferPolarity(candidate.statement, candidate.polarity);
}

function candidateDigest(candidate, session) {
  return crypto.createHash('sha256').update(JSON.stringify({
    source: `session:${session.provider}:${session.session_id}`,
    source_message_id: candidate.source_message_id ?? null,
    observed_at: candidate.observed_at ?? null,
    statement: candidate.statement,
    actor: candidate.actor,
    claim_type: candidate.claim_type,
  })).digest('hex');
}

function normalizeCandidate(candidate, session, asOf = new Date().toISOString()) {
  const redacted = redactSensitiveText(candidate.statement);
  const actor = candidate.actor ?? 'human';
  const claimType = inferClaimType(actor, candidate.claim_type);
  const statement = redacted.text;
  const normalized = { ...candidate, actor, claim_type: claimType, statement, ...(candidate.context ? { context: redactContext(candidate.context) } : {}) };
  assertCandidateSafety(normalized);
  const contentHash = `sha256:${candidateDigest(normalized, session)}`;
  const sourceRef = `session:${session.provider}:${session.session_id}`;
  const eventId = `event:conversation-${contentHash.slice(7, 31)}`;
  const infrastructure = inferInfrastructure(statement, candidate.routing_classification);
  return {
    ...normalized,
    event_id: eventId,
    content_hash: contentHash,
    source_message_id: candidate.source_message_id ?? null,
    source_window: candidate.source_window ?? null,
    observed_at: candidate.observed_at ?? session.timestamp ?? asOf,
    claim_key: candidate.claim_key ?? null,
    polarity: inferPolarity(statement, candidate.polarity),
    routing_classification: infrastructure ? 'infrastructure' : 'general_review',
    routing_target: infrastructure ? 'ikhp:evidence-candidate' : 'mind-steward:review-only',
    redactions: redacted.redactions,
    provenance: {
      source_system: session.provider,
      source_session: sourceRef,
      source_message: candidate.source_message_id ?? null,
      observed_at: candidate.observed_at ?? session.timestamp ?? null,
      adapter: ADAPTER_ID,
      evidence_hash: contentHash,
      retrieved_at: asOf,
    },
  };
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
        return values.map((entry) => normalizeCandidate({ ...common, category, statement: `${String(entry).trim()}${contextText(candidate.context ?? record.context) ? ` Context: ${contextText(candidate.context ?? record.context)}` : ''}`, ...(candidate.context ?? record.context ? { context: candidate.context ?? record.context } : {}), actor: candidate.actor ?? record.actor, claim_type: candidate.claim_type ?? record.claim_type, claim_key: candidate.claim_key ?? record.claim_key, polarity: candidate.polarity ?? record.polarity, source_message_id: candidate.source_message_id ?? record.source_message_id, source_window: candidate.source_window ?? record.source_window, routing_classification: candidate.routing_classification ?? record.routing_classification }, session));
      });
    }
    return [normalizeCandidate({ ...common, category: candidate.category, statement: candidate.statement, ...(candidate.context ?? record.context ? { context: candidate.context ?? record.context } : {}), actor: candidate.actor ?? record.actor, claim_type: candidate.claim_type ?? record.claim_type, claim_key: candidate.claim_key ?? record.claim_key, polarity: candidate.polarity ?? record.polarity, source_message_id: candidate.source_message_id ?? record.source_message_id, source_window: candidate.source_window ?? record.source_window, routing_classification: candidate.routing_classification ?? record.routing_classification }, session)];
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
  const normalizedCandidates = candidates.map((candidate) => normalizeCandidate(candidate, session, asOf));
  for (const candidate of normalizedCandidates) {
    if (candidate.repository != null && candidate.repository !== session.repository) throw new Error('conflicting_repository_context');
  }
  const sourceRef = `session:${session.provider}:${session.session_id}`;
  const digest = crypto.createHash('sha256').update(JSON.stringify({ sourceRef, candidates: normalizedCandidates })).digest('hex');
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
      adapter: ADAPTER_ID,
      captured_at: session.timestamp ?? asOf,
      authority_context: { authority_owner: 'external-source', domain: 'external', source_of_authority: sourceReference },
    },
    content: {
      detected_format: 'application/session-evidence+json',
      extracted_content_references: [sourceReference],
      metadata: { provider: session.provider, session_id: session.session_id, repository: session.repository ?? null, workspace: session.workspace ?? null, transcript_read: false, adapter_version: ADAPTER_ID, processing_watermark: asOf, source_owned_raw_content: true },
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
    candidate_insights: normalizedCandidates.map((candidate, index) => ({ ...candidate, candidate_id: `candidate:${digest.slice(0, 12)}:${index + 1}`, source_session_id: session.session_id, repository: session.repository ?? null, freshness: candidate.freshness ?? session.freshness ?? 'unknown', confidence: candidate.confidence ?? 0.5, uncertainty: candidate.uncertainty ?? 'requires human review' })),
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
  };
}

export function createConversationEvidenceAdapter({ provider } = {}) {
  if (!PROVIDERS.has(provider)) throw new Error('supported provider is required');
  return {
    adapter_id: ADAPTER_ID,
    provider,
    discover_since({ records = [], watermark = null } = {}) {
      if (!Array.isArray(records) || records.length > MAX_CANDIDATES) throw new Error('conversation_records_limit_exceeded');
      return records.filter((record) => !watermark || String(record?.observed_at ?? '') > String(watermark));
    },
    normalize(record, session, asOf) {
      return extractConversationCandidates({ session: { ...session, provider }, records: [record] , asOf })[0];
    },
    verify_source(record) {
      return Boolean(record && typeof record === 'object' && !('transcript' in record) && !('messages' in record) && !('content' in record));
    },
    privacy_classify(record) {
      return record?.privacy_classification ?? 'internal';
    },
    checkpoint(events = [], asOf = new Date().toISOString()) {
      return { watermark: asOf, event_count: events.length, event_ids: events.map((event) => event.event_id).slice(-MAX_CANDIDATES) };
    },
    health() {
      return { adapter_id: ADAPTER_ID, provider, supported: true, bounded: true, raw_transcript_reads: false, provider_calls: false, report_only: true };
    },
  };
}

export function buildConversationEvidenceReport({ events = [], generatedAt = new Date().toISOString(), staleAfterMs = DEFAULT_STALE_AFTER_MS } = {}) {
  if (!Array.isArray(events) || events.length > MAX_CANDIDATES) throw new Error('conversation_events_limit_exceeded');
  const seen = new Set();
  const unique = [];
  let duplicates = 0;
  for (const event of events) {
    if (!event?.event_id) throw new Error('conversation_event_id_required');
    if (seen.has(event.event_id)) { duplicates += 1; continue; }
    seen.add(event.event_id);
    unique.push(event);
  }
  const now = new Date(generatedAt).getTime();
  const stale = unique.filter((event) => event.freshness === 'stale' || (event.freshness !== 'fresh' && event.observed_at && now - new Date(event.observed_at).getTime() > staleAfterMs));
  const infrastructure = unique.filter((event) => event.routing_classification === 'infrastructure');
  const groups = new Map();
  for (const event of infrastructure) {
    if (!event.claim_key || event.polarity === 'neutral') continue;
    const key = event.claim_key;
    const group = groups.get(key) ?? { claim_key: key, positive: [], negative: [] };
    group[event.polarity].push(event.event_id);
    groups.set(key, group);
  }
  const contradictions = [...groups.values()].filter((group) => group.positive.length && group.negative.length);
  return {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    report_type: 'conversation-evidence-report-only',
    source_count: new Set(unique.map((event) => event.provenance?.source_system ?? 'unknown')).size,
    evidence_count: unique.length,
    duplicate_count: duplicates,
    evidence: unique,
    candidate_themes: [...new Set(unique.map((event) => event.category))],
    contradictions,
    stale_evidence: stale.map((event) => event.event_id),
    infrastructure_evidence: infrastructure.map((event) => ({ event_id: event.event_id, routing_target: 'ikhp:evidence-candidate', canonical_mutation: false })),
    redactions: unique.reduce((count, event) => count + (event.redactions ?? 0), 0),
    invariants: { report_only: true, writes_to_mind: false, writes_to_brain_canonical: false, ikhp_canonical_mutation: false, provider_calls: false, raw_transcripts_stored: false, new_authority_store: false },
  };
}

export function ingestConversationEvidence({ session, records = [], existingEvents = [], asOf = new Date().toISOString(), staleAfterMs = DEFAULT_STALE_AFTER_MS } = {}) {
  const candidates = extractConversationCandidates({ session, records });
  const incoming = candidates.map((candidate) => ({ ...candidate, source_session_id: session.session_id, repository: session.repository ?? null }));
  const report = buildConversationEvidenceReport({ events: [...existingEvents, ...incoming], generatedAt: asOf, staleAfterMs });
  return { events: report.evidence, report, checkpoint: createConversationEvidenceAdapter({ provider: session.provider }).checkpoint(report.evidence, asOf), health: createConversationEvidenceAdapter({ provider: session.provider }).health() };
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
  const sanitizedCandidates = candidates.map((candidate) => {
    if (!candidate || typeof candidate.statement !== 'string') throw new Error('conversation_candidate_invalid');
    const redacted = redactSensitiveText(candidate.statement);
    const sanitized = redacted.redactions ? { ...candidate, statement: redacted.text, redactions: (candidate.redactions ?? 0) + redacted.redactions } : candidate;
    assertCandidateSafety(sanitized);
    if (sanitized.source_session_id && sanitized.source_session_id !== sessionId) throw new Error('conflicting_session_context');
    if (sanitized.repository != null && sanitized.repository !== repository) throw new Error('conflicting_repository_context');
    if (sanitized.freshness != null && !FRESHNESS.has(sanitized.freshness)) throw new Error('invalid_candidate_freshness');
    return sanitized;
  });
  return { ...envelope, candidate_insights: sanitizedCandidates };
}

export function writeConversationEvidenceReport({ report, repoRoot = process.cwd(), outputRoot } = {}) {
  if (!report || report.report_type !== 'conversation-evidence-report-only') throw new Error('conversation_report_required');
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'conversation-reports'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_conversation_report_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const filePath = path.join(resolved, 'latest.json');
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return filePath;
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
