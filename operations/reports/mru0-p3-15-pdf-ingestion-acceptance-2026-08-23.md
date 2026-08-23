# MRU0-P3.15 — PDF Ingestion Adapter Acceptance

**Date:** 2026-08-23
**Status:** accepted; bounded embedded-text PDF support

## Active capability

PDF files in Mind `inbox/new/` are now detected and processed through the existing universal ingestion envelope.

For PDFs with simple embedded literal or hexadecimal text streams, the adapter:

1. verifies the `%PDF-` header and size limit;
2. extracts available embedded text locally;
3. writes the extracted text only as Brain runtime-local evidence;
4. preserves the original Mind source path and SHA-256 revision;
5. creates a `pdf` ingestion envelope with `application/pdf` format metadata;
6. records extraction confidence and limitations as uncertainty;
7. exposes the result through the existing human review projection.

The extracted text is evidence, not a summary, memory, decision, or canonical update.

## Failure behavior

The adapter fails visibly for:

- invalid PDF headers;
- PDFs with no extractable embedded text;
- oversized PDFs above the bounded 25 MB limit;
- read/hash failures.

Failures receive `pdf_extraction_failed` evidence and are not reported as successful envelopes. No OCR or external provider is used.

## Safety boundary

- Mind files are not moved, rewritten, deleted, or promoted.
- Extracted derivatives are restricted to Brain `runtime/local/mind-steward/ingestion/extracted/`.
- Provenance, source hashes, privacy, freshness, uncertainty, and review requirements remain present.
- No automatic summarization, memory creation, priority inference, or canonical Brain update occurs.
- No separate document store, database, watcher, or hidden pipeline was added.

## Limitations

This is not a full PDF renderer or general PDF parser. Compressed streams, layout, tables, scanned pages, images, OCR, annotations, and complex encodings remain unsupported or may fail closed. The environment did not provide a safe `pdftotext`/Python PDF parser dependency, so no dependency was added in this packet.

## Validation

Passed:

- PDF detection;
- bounded embedded-text extraction;
- envelope generation;
- source/provenance preservation;
- privacy and freshness preservation;
- extraction confidence and uncertainty;
- invalid/unextractable PDF failure handling;
- no Mind mutation;
- no automatic promotion;
- deterministic review/report behavior;
- existing envelope, projection, decision-boundary, and ingestion validation tests;
- Brain documentation consistency;
- `git diff --check`.

The focused suite completed with 18 passing tests.

## Roadmap

Next priorities should be reassessed after operating this bounded adapter. Candidates are:

- a separately approved richer PDF parser/normalizer;
- conversation evidence extraction;
- GitHub repository intelligence.

Video, image understanding, DOCX/XLSX, YouTube, and autonomous promotion remain out of scope.
