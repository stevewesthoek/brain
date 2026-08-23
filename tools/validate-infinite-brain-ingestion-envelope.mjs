import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCHEMA_PATH = fileURLToPath(new URL('../operations/specs/infinite-brain-ingestion-envelope-v1.schema.json', import.meta.url));

JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

const SOURCE_TYPES = new Set(['markdown', 'text', 'pdf', 'docx', 'xlsx', 'image', 'audio', 'video', 'url', 'youtube', 'github_repository', 'claude_session', 'codex_session', 'workbench_session']);
const AUTHORITY_OWNERS = new Set(['mind-human', 'brain-runtime', 'external-source']);
const DOMAINS = new Set(['mind', 'brain', 'external']);
const LIFECYCLE_STATES = new Set(['captured', 'normalized', 'ready_for_review', 'reviewed', 'promoted', 'rejected', 'archived']);

function requiredObject(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`${path} must be an object`);
}

function requiredString(value, path, errors) {
  if (typeof value !== 'string' || value.length === 0) errors.push(`${path} must be a non-empty string`);
}

function validateReference(value, path, errors) {
  requiredObject(value, path, errors);
  if (!value || typeof value !== 'object') return;
  requiredString(value.ref, `${path}.ref`, errors);
  if (!['source', 'extracted', 'validation', 'relationship', 'report', 'session'].includes(value.kind)) errors.push(`${path}.kind is unsupported`);
}

export function validateIngestionEnvelope(value) {
  const errors = [];
  requiredObject(value, '/', errors);
  if (!value || typeof value !== 'object') return errors;
  if (value.schema_version !== '1.0.0') errors.push('/schema_version must be 1.0.0');
  requiredObject(value.identity, '/identity', errors);
  requiredObject(value.provenance, '/provenance', errors);
  requiredObject(value.content, '/content', errors);
  requiredObject(value.governance, '/governance', errors);
  requiredObject(value.evidence, '/evidence', errors);
  requiredObject(value.lifecycle, '/lifecycle', errors);
  const allowed = new Set(['schema_version', 'identity', 'provenance', 'content', 'governance', 'evidence', 'lifecycle']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push('/ must NOT have additional properties: ' + key);
  if (value.identity) {
    if (typeof value.identity.ingestion_id !== 'string' || !/^ingestion:[a-z0-9][a-z0-9._:-]*$/.test(value.identity.ingestion_id)) errors.push('/identity.ingestion_id is invalid');
    if (!SOURCE_TYPES.has(value.identity.source_type)) errors.push('/identity.source_type is unsupported');
    validateReference(value.identity.source_reference, '/identity.source_reference', errors);
    requiredString(value.identity.created_at, '/identity.created_at', errors);
    requiredString(value.identity.source_revision, '/identity.source_revision', errors);
  }
  if (value.provenance) {
    requiredString(value.provenance.origin, '/provenance.origin', errors);
    requiredString(value.provenance.adapter, '/provenance.adapter', errors);
    requiredString(value.provenance.captured_at, '/provenance.captured_at', errors);
    if (!['manual', 'webhook', 'file_import', 'session_export', 'repository_reference', 'existing_report', 'other'].includes(value.provenance.capture_method)) errors.push('/provenance.capture_method is unsupported');
    const context = value.provenance.authority_context;
    requiredObject(context, '/provenance.authority_context', errors);
    if (context) {
      if (!AUTHORITY_OWNERS.has(context.authority_owner)) errors.push('/provenance.authority_context.authority_owner must be known');
      if (!DOMAINS.has(context.domain)) errors.push('/provenance.authority_context.domain must be known');
      validateReference(context.source_of_authority, '/provenance.authority_context.source_of_authority', errors);
    }
  }
  if (value.content) {
    requiredString(value.content.detected_format, '/content.detected_format', errors);
    if (!Array.isArray(value.content.extracted_content_references)) errors.push('/content.extracted_content_references must be an array');
    else value.content.extracted_content_references.forEach((item, index) => validateReference(item, `/content.extracted_content_references[${index}]`, errors));
    if (typeof value.content.confidence !== 'number' || value.content.confidence < 0 || value.content.confidence > 1) errors.push('/content.confidence must be between 0 and 1');
    if (!Array.isArray(value.content.uncertainty)) errors.push('/content.uncertainty must be an array');
  }
  if (value.governance) {
    if (!['none', 'possible', 'material'].includes(value.governance.mind_impact)) errors.push('/governance.mind_impact is invalid');
    if (!['none', 'possible', 'material'].includes(value.governance.brain_impact)) errors.push('/governance.brain_impact is invalid');
    if (!['public', 'internal', 'personal', 'sensitive', 'restricted'].includes(value.governance.privacy_classification)) errors.push('/governance.privacy_classification is invalid');
    if (!['fresh', 'stale', 'unknown'].includes(value.governance.freshness)) errors.push('/governance.freshness is invalid');
    if (value.governance.review_required !== true) errors.push('/governance.review_required must be true');
    if (value.governance.promotion_authority !== 'human-approved-bounded-transaction') errors.push('/governance.promotion_authority is invalid');
  }
  if (value.evidence) {
    if (!Array.isArray(value.evidence.source_references) || value.evidence.source_references.length < 1) errors.push('/evidence.source_references requires at least one source');
    else value.evidence.source_references.forEach((item, index) => validateReference(item, `/evidence.source_references[${index}]`, errors));
    if (!Array.isArray(value.evidence.validation_references)) errors.push('/evidence.validation_references must be an array');
    if (typeof value.evidence.extraction_confidence !== 'number' || value.evidence.extraction_confidence < 0 || value.evidence.extraction_confidence > 1) errors.push('/evidence.extraction_confidence must be between 0 and 1');
  }
  if (value.lifecycle) {
    if (!LIFECYCLE_STATES.has(value.lifecycle.state)) errors.push('/lifecycle.state is unsupported');
    if (value.lifecycle.state === 'promoted') {
      if (!value.lifecycle.review_reference) errors.push('/lifecycle promoted state requires review_reference');
      if (!value.lifecycle.promotion_reference) errors.push('/lifecycle promoted state requires promotion_reference');
    }
  }
  return errors;
}

export function assertNoAuthorityEscalation(value) {
  const errors = validateIngestionEnvelope(value);
  if (value?.governance?.review_required !== true) errors.push('/governance review is mandatory');
  if (value?.governance?.promotion_authority !== 'human-approved-bounded-transaction') errors.push('/governance promotion authority is invalid');
  if (value?.lifecycle?.state === 'promoted' && (!value.lifecycle.review_reference || !value.lifecycle.promotion_reference)) {
    errors.push('/lifecycle promotion evidence is incomplete');
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('usage: node tools/validate-infinite-brain-ingestion-envelope.mjs <json-file>');
  const value = JSON.parse(readFileSync(inputPath, 'utf8'));
  const errors = assertNoAuthorityEscalation(value);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('ingestion-envelope=pass');
  }
}
