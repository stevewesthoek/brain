#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertNoAuthorityEscalation } from '../validate-infinite-brain-ingestion-envelope.mjs';
import { projectIngestionReview, renderIngestionReviewMarkdown } from './mind-steward-review-projection.mjs';
import { buildGitHubRepositoryEvidence, extractGitHubRepositoryUrls } from './mind-steward-github-repository-evidence.mjs';

const SUPPORTED_EXTENSIONS = new Map([
  ['.md', 'markdown'],
  ['.txt', 'text'],
  ['.pdf', 'pdf'],
  ['.mp4', 'video'],
  ['.webm', 'video'],
  ['.mov', 'video'],
  ['.mkv', 'video'],
  ['.m4v', 'video'],
  ['.avi', 'video'],
  ['.flv', 'video'],
  ['.wmv', 'video'],
]);
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const VIDEO_URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

function isoFromStat(stat) {
  return new Date(stat.mtimeMs).toISOString();
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readGitHubReferences(filePath, sourceReference, sourceHash, ingestionId, capturedAt) {
  const extension = path.extname(filePath).toLowerCase();
  if (!['.md', '.txt'].includes(extension)) return [];
  const text = fs.readFileSync(filePath, 'utf8').slice(0, 200_000);
  return extractGitHubRepositoryUrls(text).map((url) => buildGitHubRepositoryEvidence({
    url, sourceReference, sourceHash, ingestionId, retrievedAt: capturedAt,
  }));
}

function detectVideoReference(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const directVideo = SUPPORTED_EXTENSIONS.get(extension) === 'video';
  if (directVideo) return { sourceType: 'video', detectedFormat: `video/${extension.slice(1)}`, source: null };
  if (!['.md', '.txt'].includes(extension)) return null;
  const text = fs.readFileSync(filePath, 'utf8').slice(0, 200_000);
  const source = text.match(VIDEO_URL_PATTERN)?.[0]?.replace(/[),.;]+$/, '') ?? null;
  if (!source) return null;
  const host = (new URL(source).hostname || '').toLowerCase().replace(/^www\./, '');
  const sourceType = host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')
    ? 'youtube'
    : /\.(mp4|webm|mov|mkv|m4v|avi|flv|wmv)(?:$|\?)/i.test(source)
      ? 'video'
      : null;
  return sourceType ? { sourceType, detectedFormat: 'text/markdown', source } : null;
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

function decodePdfLiteral(value) {
  return value.replace(/\\([\\()nrtbf])/g, (_, escaped) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[escaped] ?? escaped);
}

export function extractPdfText(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > MAX_PDF_BYTES) throw new Error('pdf_too_large');
  const header = bytes.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') throw new Error('invalid_pdf_header');
  const source = bytes.toString('latin1');
  const literalMatches = [...source.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)].map((match) => {
    const literal = match[0].replace(/\)\s*Tj$/, '').slice(1);
    return decodePdfLiteral(literal);
  });
  const hexMatches = [...source.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)].map((match) => {
    const hex = match[1].replace(/\s/g, '');
    return Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex').toString('latin1');
  });
  const text = [...literalMatches, ...hexMatches].join(' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('pdf_text_unavailable');
  return { text, confidence: 0.7, uncertainty: ['limited embedded-text extraction; layout and compressed streams are not interpreted'] };
}

function makeEnvelope({ filePath, inboxRoot, stat, digest, sourceType, createdAt = new Date().toISOString(), extractedContentReferences, detectedFormat, metadata, confidence, uncertainty, evidenceUncertainty }) {
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
      detected_format: detectedFormat ?? (sourceType === 'markdown' ? 'text/markdown' : 'text/plain'),
      extracted_content_references: extractedContentReferences ?? [reference],
      metadata: metadata ?? { filename: relative, size_bytes: stat.size, modified_at: isoFromStat(stat) },
      entities: [],
      relationships: [],
      confidence: confidence ?? 1,
      uncertainty: uncertainty ?? ['meaning and destination require human review'],
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
      extraction_confidence: confidence ?? 1,
      uncertainty: evidenceUncertainty ?? ['no semantic extraction performed by this adapter'],
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
    let sourceType = SUPPORTED_EXTENSIONS.get(path.extname(filePath).toLowerCase());
    if (!sourceType) {
      failures.push({ file: relative, code: 'unsupported_file_type', message: 'Only Markdown, plain text, bounded PDF text extraction, and bounded video references/files are active.' });
      continue;
    }
    try {
      const stat = fs.statSync(filePath);
      const digest = hashFile(filePath);
      const videoReference = detectVideoReference(filePath);
      if (videoReference) sourceType = videoReference.sourceType;
      let extraction;
      let extractedContentReferences;
      if (sourceType === 'pdf') {
        extraction = extractPdfText(filePath);
        const extractedDir = path.join(resolvedOutputRoot, 'extracted');
        fs.mkdirSync(extractedDir, { recursive: true, mode: 0o700 });
        const extractedPath = path.join(extractedDir, `${digest}.txt`);
        fs.writeFileSync(extractedPath, `${extraction.text}\n`, { mode: 0o600 });
        const extractedHash = crypto.createHash('sha256').update(extraction.text).digest('hex');
        extractedContentReferences = [{ ref: path.relative(repoRoot, extractedPath).replaceAll(path.sep, '/'), kind: 'extracted', hash: `sha256:${extractedHash}` }];
      }
      const envelope = makeEnvelope({
        filePath, inboxRoot, stat, digest, sourceType, createdAt, extractedContentReferences,
        detectedFormat: videoReference?.detectedFormat ?? (sourceType === 'pdf' ? 'application/pdf' : undefined),
        metadata: videoReference
          ? { filename: relative, size_bytes: stat.size, modified_at: isoFromStat(stat), video_source: videoReference.source, source_kind: videoReference.sourceType }
          : sourceType === 'pdf' ? { filename: relative, size_bytes: stat.size, modified_at: isoFromStat(stat), extraction: 'embedded-text-limited' } : undefined,
        confidence: extraction?.confidence,
        uncertainty: extraction ? [...extraction.uncertainty, 'meaning and destination require human review'] : undefined,
        evidenceUncertainty: extraction?.uncertainty,
      });
      envelope.content.github_repository_evidence = readGitHubReferences(
        filePath,
        envelope.identity.source_reference.ref,
        envelope.identity.source_revision,
        envelope.identity.ingestion_id,
        envelope.provenance.captured_at,
      );
      const errors = assertNoAuthorityEscalation(envelope);
      if (errors.length) failures.push({ file: relative, code: 'envelope_validation_failed', errors });
      else envelopes.push(envelope);
    } catch (error) {
      const code = error instanceof Error && error.message.startsWith('pdf_') || error instanceof Error && error.message === 'invalid_pdf_header' ? 'pdf_extraction_failed' : 'read_failed';
      failures.push({ file: relative, code, message: error instanceof Error ? error.message : String(error) });
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
