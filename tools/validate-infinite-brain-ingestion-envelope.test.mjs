import assert from 'node:assert/strict';
import test from 'node:test';

import { assertNoAuthorityEscalation, validateIngestionEnvelope } from './validate-infinite-brain-ingestion-envelope.mjs';

function envelope() {
  return {
    schema_version: '1.0.0',
    identity: {
      ingestion_id: 'ingestion:test-001',
      source_type: 'markdown',
      source_reference: { ref: 'mind/inbox/new/capture.md', kind: 'source', hash: 'sha256:test' },
      created_at: '2026-08-23T10:00:00Z',
      source_revision: 'sha256:test'
    },
    provenance: {
      origin: 'mind-inbox', capture_method: 'file_import', adapter: 'fixture-adapter', captured_at: '2026-08-23T10:00:00Z',
      authority_context: { authority_owner: 'external-source', domain: 'external', source_of_authority: { ref: 'mind/inbox/new/capture.md', kind: 'source' } }
    },
    content: {
      detected_format: 'text/markdown', extracted_content_references: [{ ref: 'mind/inbox/new/capture.md', kind: 'extracted' }],
      metadata: {}, confidence: 0.9, uncertainty: ['meaning requires human review']
    },
    governance: {
      mind_impact: 'possible', brain_impact: 'none', privacy_classification: 'internal', freshness: 'fresh',
      review_required: true, promotion_authority: 'human-approved-bounded-transaction'
    },
    evidence: {
      source_references: [{ ref: 'mind/inbox/new/capture.md', kind: 'source' }], validation_references: [], extraction_confidence: 0.9, uncertainty: ['meaning requires human review']
    },
    lifecycle: { state: 'ready_for_review' }
  };
}

test('valid envelope preserves provenance, privacy, freshness, and review requirements', () => {
  const value = envelope();
  assert.deepEqual(validateIngestionEnvelope(value), []);
  assert.deepEqual(assertNoAuthorityEscalation(value), []);
});

test('unknown authority fails closed', () => {
  const value = envelope();
  value.provenance.authority_context.authority_owner = 'unknown-authority';
  assert.ok(validateIngestionEnvelope(value).some((error) => error.includes('authority_owner must be known')));
});

test('promotion cannot happen without review and transaction evidence', () => {
  const value = envelope();
  value.lifecycle.state = 'promoted';
  const errors = assertNoAuthorityEscalation(value);
  assert.ok(errors.some((error) => error.includes('review_reference')));
  assert.ok(errors.some((error) => error.includes('promotion_reference')));
});

test('provider settings and execution authority are rejected as extra fields', () => {
  const value = envelope();
  value.provider = { model: 'example-model' };
  value.execution_enabled = true;
  const errors = validateIngestionEnvelope(value);
  assert.ok(errors.some((error) => error.includes('must NOT have additional properties')));
});
