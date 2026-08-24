import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_MAX_PREVIEW_CHARS = 1600;
export const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function resolveMindSource({ mindRoot, sourceReference }) {
  if (!mindRoot || typeof sourceReference !== 'string' || !sourceReference.startsWith('mind/')) return null;
  const relativePath = sourceReference.slice('mind/'.length);
  const root = path.resolve(mindRoot);
  const sourcePath = path.resolve(root, relativePath);
  if (sourcePath !== root && !sourcePath.startsWith(`${root}${path.sep}`)) return null;
  return sourcePath;
}

function unavailable(item, reason, extra = {}) {
  return {
    status: 'unavailable',
    source_identity: item.review_id,
    source_reference: item.source?.source_reference ?? null,
    source_hash: item.source?.source_hash ?? null,
    ingestion_id: item.source?.ingestion_or_review_id ?? null,
    provenance: {
      evidence_references: item.source?.evidence_references ?? [],
      authority_owner: item.source?.authority_owner ?? null,
    },
    freshness: item.source?.freshness ?? 'unknown',
    confidence: item.source?.confidence ?? null,
    uncertainty: item.source?.uncertainty ?? [],
    review_state: item.state ?? 'unknown',
    content_preview: null,
    truncated: false,
    reason,
    safety: { read_only: true, writes_to_mind: false, writes_to_brain_canonical: false, stored_source_content: false },
    ...extra,
  };
}

export function buildEvidencePreview(item, { mindRoot, now = new Date(), maxChars = DEFAULT_MAX_PREVIEW_CHARS, staleAfterMs = DEFAULT_STALE_AFTER_MS } = {}) {
  if (!item?.review_id || !item?.source) return unavailable(item ?? {}, 'invalid_review_identity_or_source');
  const source = item.source;
  if (!source.source_reference || !isSha256(source.source_hash) || !source.ingestion_or_review_id || !source.authority_owner) {
    return unavailable(item, 'invalid_provenance');
  }
  if (!Number.isInteger(maxChars) || maxChars < 1) return unavailable(item, 'invalid_preview_bound');
  const sourcePath = resolveMindSource({ mindRoot, sourceReference: source.source_reference });
  if (!sourcePath) return unavailable(item, 'source_reference_not_allowlisted');
  if (!fs.existsSync(sourcePath)) return unavailable(item, 'source_unavailable');
  let stat;
  let content;
  try {
    stat = fs.statSync(sourcePath);
    if (!stat.isFile()) return unavailable(item, 'source_not_a_file');
    content = fs.readFileSync(sourcePath, 'utf8');
  } catch {
    return unavailable(item, 'source_unreadable');
  }
  const actualHash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
  if (actualHash.toLowerCase() !== source.source_hash.toLowerCase()) {
    return unavailable(item, 'source_hash_mismatch', { actual_source_hash: actualHash });
  }
  const ageMs = Math.max(0, now.getTime() - stat.mtimeMs);
  const freshness = ageMs > staleAfterMs ? 'stale' : 'fresh';
  return {
    status: 'available',
    source_identity: item.review_id,
    source_reference: source.source_reference,
    source_hash: source.source_hash,
    ingestion_id: source.ingestion_or_review_id,
    provenance: {
      evidence_references: source.evidence_references ?? [],
      authority_owner: source.authority_owner,
    },
    freshness,
    confidence: source.confidence ?? null,
    uncertainty: source.uncertainty ?? [],
    review_state: item.state,
    content_preview: content.slice(0, maxChars),
    truncated: content.length > maxChars,
    reason: freshness === 'stale' ? 'source exceeds preview freshness window' : null,
    source_size: content.length,
    safety: { read_only: true, writes_to_mind: false, writes_to_brain_canonical: false, stored_source_content: false },
  };
}

export function attachEvidencePreviews(workflow, options = {}) {
  if (!workflow || !Array.isArray(workflow.items)) throw new Error('review workflow items are required');
  const seen = new Set();
  const items = workflow.items.map((item) => {
    if (seen.has(item.review_id)) throw new Error(`duplicate review identity: ${item.review_id}`);
    seen.add(item.review_id);
    return { ...item, evidence_preview: buildEvidencePreview(item, options) };
  });
  return { ...workflow, items };
}
