#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { scanMindInbox } from './mind-steward-ingest-envelope.mjs';

export function validateMindStewardIngestion({ mindRoot, repoRoot = process.cwd(), asOf = new Date().toISOString() } = {}) {
  const scan = scanMindInbox({ mindRoot, repoRoot, createdAt: asOf });
  const duplicateGroups = new Map();
  for (const envelope of scan.envelopes) {
    const revision = envelope.identity.source_revision;
    const entries = duplicateGroups.get(revision) ?? [];
    entries.push(envelope.identity.source_reference.ref);
    duplicateGroups.set(revision, entries);
  }
  const duplicates = [...duplicateGroups.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([source_revision, files]) => ({ source_revision, files }));
  const missingMetadata = scan.envelopes.flatMap((envelope) => {
    const missing = [];
    if (!envelope.identity.source_revision) missing.push('source_revision');
    if (!envelope.provenance.captured_at) missing.push('captured_at');
    if (!envelope.content.detected_format) missing.push('detected_format');
    if (!envelope.governance.privacy_classification) missing.push('privacy_classification');
    if (!envelope.governance.freshness) missing.push('freshness');
    return missing.length ? [{ file: envelope.identity.source_reference.ref, missing }] : [];
  });
  const reviewClarity = scan.envelopes.map((envelope) => ({
    file: envelope.identity.source_reference.ref,
    state: envelope.lifecycle.state,
    review_required: envelope.governance.review_required,
    has_uncertainty: envelope.content.uncertainty.length > 0 && envelope.evidence.uncertainty.length > 0,
    has_source_reference: envelope.evidence.source_references.length > 0,
  }));
  const friction = [];
  if (scan.failures.length) friction.push('unsupported_or_unreadable_inputs_require_manual_review');
  if (duplicates.length) friction.push('duplicate_inputs_require_human_disposition');
  if (missingMetadata.length) friction.push('envelopes_missing_required_metadata');
  friction.push('explicit_scan_required_no_watcher');
  friction.push('human_review_required_before_promotion');
  return {
    schema_version: '1.0.0',
    as_of: asOf,
    source: 'mind/inbox/new',
    workflow: 'inbox → ingestion envelope → review artifact → human decision',
    counts: {
      files_detected: scan.envelopes.length + scan.failures.length,
      successful_ingestions: scan.envelopes.length,
      failed_ingestions: scan.failures.length,
      unsupported_formats: scan.failures.filter((failure) => failure.code === 'unsupported_file_type').length,
      duplicate_groups: duplicates.length,
      missing_metadata_items: missingMetadata.length,
    },
    path_check: { expected: 'mind/inbox/new', observed: scan.source, pass: scan.source === 'mind/inbox/new' },
    envelopes: scan.envelopes,
    failures: scan.failures,
    duplicates,
    missing_metadata: missingMetadata,
    review_clarity: reviewClarity,
    friction,
    invariants: {
      writes_to_mind: scan.writes_to_mind === false,
      automatic_promotion: scan.automatic_promotion === false,
      new_storage_system: false,
      provenance_preserved: scan.envelopes.every((envelope) => envelope.evidence.source_references.length > 0 && envelope.identity.source_revision),
      privacy_preserved: scan.envelopes.every((envelope) => Boolean(envelope.governance.privacy_classification)),
    },
    assessment: {
      active: ['canonical inbox path', 'Markdown/text detection', 'envelope provenance and revision', 'review-only output', 'unsupported-format visibility'],
      friction: [...new Set(friction)],
      roadmap: ['PDF normalization if a safe existing capability is approved', 'duplicate disposition workflow', 'richer review projection'],
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const mindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const repoRoot = process.env.MIND_STEWARD_REPO_ROOT ?? process.cwd();
  if (!mindRoot) throw new Error('MIND_STEWARD_MIND_ROOT is required');
  console.log(JSON.stringify(validateMindStewardIngestion({ mindRoot, repoRoot }), null, 2));
}
