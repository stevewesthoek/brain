import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { extractPdfText, scanMindInbox, writeReviewReport } from './mind-steward-ingest-envelope.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-envelope-'));
  const mindRoot = path.join(root, 'mind');
  const repoRoot = path.join(root, 'brain');
  fs.mkdirSync(path.join(mindRoot, 'inbox', 'new'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'runtime', 'local', 'mind-steward'), { recursive: true });
  return { root, mindRoot, repoRoot, inbox: path.join(mindRoot, 'inbox', 'new') };
}

test('detects Markdown and text files and creates reviewable envelopes', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.inbox, 'note.md'), '# Note\n');
  fs.writeFileSync(path.join(f.inbox, 'plain.txt'), 'Plain text\n');
  const report = scanMindInbox({ mindRoot: f.mindRoot, repoRoot: f.repoRoot });
  assert.equal(report.envelopes.length, 2);
  assert.equal(report.failures.length, 0);
  assert.ok(report.envelopes.every((item) => item.lifecycle.state === 'ready_for_review'));
  assert.ok(report.envelopes.every((item) => item.governance.review_required === true));
});

test('PDF with no extractable text is visible as a bounded failure', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.inbox, 'document.pdf'), '%PDF-fixture');
  const report = scanMindInbox({ mindRoot: f.mindRoot, repoRoot: f.repoRoot });
  assert.equal(report.envelopes.length, 0);
  assert.deepEqual(report.failures[0], { file: 'document.pdf', code: 'pdf_extraction_failed', message: 'pdf_text_unavailable' });
});

test('extracts bounded embedded PDF text and preserves review uncertainty', () => {
  const f = fixture();
  const pdf = '%PDF-1.4\n1 0 obj\n<<>>\nstream\n(Hello PDF) Tj\nendstream\nendobj\n%%EOF';
  fs.writeFileSync(path.join(f.inbox, 'document.pdf'), pdf);
  const extraction = extractPdfText(path.join(f.inbox, 'document.pdf'));
  assert.equal(extraction.text, 'Hello PDF');
  const report = scanMindInbox({ mindRoot: f.mindRoot, repoRoot: f.repoRoot, createdAt: '2026-08-23T12:00:00Z' });
  assert.equal(report.envelopes.length, 1);
  assert.equal(report.envelopes[0].identity.source_type, 'pdf');
  assert.equal(report.envelopes[0].content.detected_format, 'application/pdf');
  assert.ok(report.envelopes[0].content.uncertainty.some((item) => item.includes('limited embedded-text extraction')));
  assert.equal(fs.existsSync(path.join(f.repoRoot, 'runtime', 'local', 'mind-steward', 'ingestion', 'extracted')), true);
});

test('report writes only to Brain runtime/local and never promotes or writes Mind', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.inbox, 'note.md'), '# Note\n');
  const before = fs.readFileSync(path.join(f.inbox, 'note.md'), 'utf8');
  const report = scanMindInbox({ mindRoot: f.mindRoot, repoRoot: f.repoRoot });
  const paths = writeReviewReport(report);
  assert.equal(report.writes_to_mind, false);
  assert.equal(report.automatic_promotion, false);
  assert.equal(fs.readFileSync(path.join(f.inbox, 'note.md'), 'utf8'), before);
  assert.ok(paths.jsonPath.startsWith(path.join(f.repoRoot, 'runtime', 'local', 'mind-steward')));
  assert.match(fs.readFileSync(paths.markdownPath, 'utf8'), /Human review must use/);
});

test('unsafe output root fails closed', () => {
  const f = fixture();
  assert.throws(() => scanMindInbox({ mindRoot: f.mindRoot, repoRoot: f.repoRoot, outputRoot: path.join(f.root, 'outside') }), /unsafe_ingestion_output/);
});
