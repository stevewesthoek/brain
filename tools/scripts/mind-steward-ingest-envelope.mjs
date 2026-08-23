#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertNoAuthorityEscalation } from '../validate-infinite-brain-ingestion-envelope.mjs';
import { projectIngestionReview, renderIngestionReviewMarkdown } from './mind-steward-review-projection.mjs';

const SUPPORTED_EXTENSIONS = new Map([
  ['.md', 'markdown'],
  ['.txt', 'text'],
]);

function isoFromStat(stat) {
  return new Date(stat.mtimeMs).toISOString();
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function safeOutputRoot(repoRoot, outputRoot) {
  const defaultRoot = path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'ingestion');
  const resolvedRoot = path.resolve(outputRoot ?? defaultRoot);
  const allowedRoot = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolvedRoot !== allowedRoot && !resolvedRoot.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`unsafe_ingestion_output: ${resolvedRoot}`);
  }
  return resolvedRoot;
}

function listInboxFiles(inboxRoot) {
  if (!fs.existsSync(inboxRoot)) throw new Error(`inbox_not_found: ${inboxRoot}`);
  if (fs.lstatSync(inboxRoot).isSymbolicLink()) throw new Error(`unsafe_inbox_symlink: ${inboxRoot}`);
  return fs.readdirSync(inboxRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'README.md')
    .map((entry) => path.join(inboxRoot, entry.name))
    .sort();
}

function makeEnvelope({ filePath, inboxRoot, stat, digest, sourceType, createdAt = new Date().toISOString() }) {
  const relative = path.relative(inboxRoot, filePath).replaceAll(path.sep, '/');
  const sourceRef = `mind/inbox/new/${relative}`;
  const reference = { ref: sourceRef, kind: 'source', hash: `sha256:${digest}` };
  return {
    schema_version: '1.0.0',
    identity: {
      ingestion_id: `ingestion:mind-inbox-${digest.slice(0, 20)}`,
      source_type: sourceType,
      source_reference: reference,
      created_at: createdAt,
      source_revision: `sha256:${digest}`,
    },
    provenance: {
      origin: 'mind-inbox/new',
      capture_method: 'file_import',
      adapter: 'mind-steward-inbox-envelope-v1',
      captured_at: isoFromStat(stat),
      authority_context: {
        authority_owner: 'external-source',
        domain: 'external',
        source_of_authority: reference,
      },
    },
    content: {
      detected_format: sourceType === 'markdown' ? 'text/markdown' : 'text/plain',
      extracted_content_references: [reference],
      metadata: { filename: relative, size_bytes: stat.size, modified_at: isoFromStat(stat) },
      entities: [],
      relationships: [],
      confidence: 1,
      uncertainty: ['meaning and destination require human review'],
    },
    governance: {
      mind_impact: 'possible',
      brain_impact: 'none',
      privacy_classification: 'internal',
      freshness: 'fresh',
      review_required: true,
      promotion_authority: 'human-approved-bounded-transaction',
    },
    evidence: {
      source_references: [reference],
      validation_references: [],
      extraction_confidence: 1,
      uncertainty: ['no semantic extraction performed by this adapter'],
    },
    lifecycle: { state: 'ready_for_review' },
  };
}

export function scanMindInbox({ mindRoot, repoRoot = process.cwd(), outputRoot, createdAt = new Date().toISOString() } = {}) {
  if (!mindRoot) throw new Error('mindRoot is required');
  const inboxRoot = path.resolve(mindRoot, 'inbox', 'new');
  const resolvedOutputRoot = safeOutputRoot(repoRoot, outputRoot);
  const envelopes = [];
  const failures = [];

  for (const filePath of listInboxFiles(inboxRoot)) {
    const relative = path.relative(inboxRoot, filePath).replaceAll(path.sep, '/');
    const sourceType = SUPPORTED_EXTENSIONS.get(path.extname(filePath).toLowerCase());
    if (!sourceType) {
      failures.push({ file: relative, code: 'unsupported_file_type', message: 'Only Markdown and plain text are active in P3.11.' });
      continue;
    }
    try {
      const stat = fs.statSync(filePath);
      const envelope = makeEnvelope({ filePath, inboxRoot, stat, digest: hashFile(filePath), sourceType, createdAt });
      const errors = assertNoAuthorityEscalation(envelope);
      if (errors.length) failures.push({ file: relative, code: 'envelope_validation_failed', errors });
      else envelopes.push(envelope);
    } catch (error) {
      failures.push({ file: relative, code: 'read_failed', message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: 'mind/inbox/new',
    output_root: resolvedOutputRoot,
    writes_to_mind: false,
    automatic_promotion: false,
    envelopes,
    failures,
  };
}

export function writeReviewReport(report) {
  fs.mkdirSync(report.output_root, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(report.output_root, 'latest.json');
  const markdownPath = path.join(report.output_root, 'latest.md');
  const projection = projectIngestionReview(report);
  const markdown = renderIngestionReviewMarkdown(projection);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, markdown, { mode: 0o600 });
  return { jsonPath, markdownPath };
}

function main() {
  const mindRoot = process.env.MIND_STEWARD_MIND_ROOT;
  const repoRoot = process.env.MIND_STEWARD_REPO_ROOT ?? path.resolve(new URL('../..', import.meta.url).pathname);
  if (!mindRoot) throw new Error('MIND_STEWARD_MIND_ROOT is required');
  const report = scanMindInbox({ mindRoot, repoRoot });
  const paths = writeReviewReport(report);
  console.log(JSON.stringify({ ...report, ...paths }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
