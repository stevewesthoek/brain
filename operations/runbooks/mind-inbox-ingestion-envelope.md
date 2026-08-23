# Mind Inbox Ingestion Envelope

## Status

MRU0-P3.11 activates the first bounded ingestion capability: an explicit scan of Mind `inbox/new/` for Markdown and plain-text captures. It creates provider-neutral ingestion envelopes and a review report under Brain runtime state.

This is not an always-on watcher. PDF support is bounded to local embedded-text extraction; OCR, compressed-stream/layout interpretation, and external providers are not used.

## Activation

Set the verified local Mind path and run an explicit scan:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
MIND_STEWARD_REPO_ROOT=/Users/Office/Repos/stevewesthoek/brain \
node /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-steward-ingest-envelope.mjs
```

Outputs:

- `runtime/local/mind-steward/ingestion/latest.json`
- `runtime/local/mind-steward/ingestion/latest.md`

The report contains the raw envelope JSON plus a per-item human review projection and bounded failures for unsupported/unreadable files. The original Mind files remain in `inbox/new/`; the scanner does not move, rename, delete, rewrite, classify, or promote them.

## Supported inputs

- `.md` → `markdown`
- `.txt` → `text`
- `.pdf` → `pdf` with limited embedded-text extraction

DOCX, XLSX, images, audio, video, URLs, YouTube, GitHub repositories, and AI sessions remain future capabilities. Invalid, scanned, compressed/unextractable, or oversized PDFs are reported as failures rather than treated as ingested.

## Review boundary

Each envelope contains provenance, source revision, privacy classification, freshness, uncertainty, Mind/Brain impact, and `review_required: true`. `latest.md` projects each item as `needs_review` with the workflow-only options `accepted`, `rejected`, `deferred`, and `archived`. These states do not promote memory. Human review and an existing approved bounded transaction are required before any durable Mind or Brain update.

## Recording a human decision

Decision recording is explicit and produces a Brain-local evidence artifact. It does not modify Mind or Brain canonical knowledge. The decision module accepts a reviewed item plus a reviewer, timestamp, and reason where required:

- `accepted` → `promotion_candidate` only;
- `rejected` → retained evidence with rejection reason;
- `deferred` → review-queue item;
- `archived` → traceable historical evidence.

Decision artifacts are written under `runtime/local/mind-steward/decisions/`. A later durable update still requires the existing human-approved bounded transaction, exact target, validation, and receipt flow.

## Failure and safety behavior

- Missing or symlinked `inbox/new/` fails closed.
- Unsupported extensions appear in the review report.
- Read/hash failures appear in the review report.
- PDF extraction failures appear as `pdf_extraction_failed`.
- Extracted PDF text is written only as Brain-local evidence under `runtime/local/mind-steward/ingestion/extracted/`.
- Outputs are restricted to `brain/runtime/local/mind-steward/`.
- `writes_to_mind=false` and `automatic_promotion=false` are explicit report invariants.
- No external provider, n8n workflow, watcher, or model call is required by this scanner.
