# MRU0-P3.12 — Active Mind Inbox Ingestion Workflow Validation

**Date:** 2026-08-23
**Commit under validation:** `186faf74`
**Mode:** read-only operational validation
**Scope:** existing Mind `inbox/new/` → ingestion envelope → review artifact → human decision

## Executive result

The active first ingestion capability is operating within its approved boundary.

Observed against `/Users/Office/Repos/stevewesthoek/mind/inbox/new/`:

| Signal | Result |
|---|---:|
| Files detected, excluding `README.md` | 11 |
| Successful Markdown/text envelopes | 11 |
| Failed ingestions | 0 |
| Unsupported formats in live inbox | 0 |
| Duplicate source revisions | 0 |
| Missing required metadata | 0 |
| Canonical path check | PASS |
| Provenance preserved | PASS |
| Privacy classification present | PASS |
| Mind mutation | 0 |
| Automatic promotion | 0 |

The live scan used a fixed observation timestamp (`2026-08-23T00:00:00Z`) so the validation result is deterministic. No Mind file was written, moved, renamed, deleted, or rewritten.

## Workflow assessment

```text
Mind/inbox/new
  → explicit scanner
  → Markdown/text envelope
  → Brain review report
  → human decision: promote, reject, defer, or archive
```

### ACTIVE

- Mind `inbox/new/` is the observed and documented canonical input path.
- Markdown and plain-text files are detected without source-specific storage.
- Each accepted input receives a source hash, source reference, format, metadata, freshness, privacy classification, uncertainty, and mandatory review state.
- Unsupported/unreadable inputs are represented as bounded failures rather than falsely accepted.
- Review outputs remain Brain-local under `runtime/local/mind-steward/ingestion/`.
- Existing envelope and ingestion tests pass.
- The workflow preserves Mind meaning and human promotion authority.

### FRICTION

1. **Explicit scan only:** no watcher or scheduled scanner is enabled. This is safe and intentional, but users must run the documented command to refresh the review report.
2. **Summary-level Markdown report:** `latest.md` communicates counts and safety state but does not list every file or provide per-item review links. The JSON report contains the detailed envelopes.
3. **No duplicate disposition workflow:** duplicate detection is validated, but the current active formats have not yet produced a live duplicate group and no separate disposition action exists.
4. **No semantic extraction:** Markdown/text envelopes preserve source references and metadata but do not summarize or classify meaning. This is appropriate for the activation boundary; Mind Steward review remains separate.
5. **PDF is intentionally not active:** no existing safe PDF capability was established, so PDF remains a visible unsupported-format path rather than an unverified partial implementation.

## Failure and safety validation

Focused tests prove:

- inbox detection for Markdown and text;
- unsupported PDF visibility;
- envelope provenance and revision preservation;
- privacy and freshness fields;
- deterministic repeated validation;
- duplicate source-revision reporting;
- missing inbox failure rather than fallback to another path;
- no Mind writes;
- no automatic promotion;
- no output outside the approved Brain runtime-local boundary;
- unsafe output roots fail closed.

The live result had no failures to route. The test fixture confirms unsupported files become report-visible failures and are not included as successful envelopes.

## Mind/Brain alignment

- **Mind:** continues to own meaning, priorities, personal knowledge, and final memory decisions.
- **Brain:** performs bounded scanning, hashing, envelope validation, reporting, and failure visibility.
- **Evidence:** remains the captured file, envelope metadata, and processing result.
- **Human review:** remains required before any promotion, rejection, deferral, or archival decision is applied.

No new inbox, database, memory store, adapter family, watcher, provider call, or autonomous decision path was introduced.

## Roadmap input

The next highest-value improvement is a read-only review projection that lists each envelope and failure with direct source references and clear decision state. It should improve review usefulness without adding storage or changing authority.

After that, a separately authorized PDF adapter may be considered only if an existing safe extraction capability, privacy boundary, provenance model, and failure handling are proven. DOCX, XLSX, image, audio, video, GitHub, YouTube, and conversation ingestion remain future roadmap items.

## Validation commands

```text
node --test tools/scripts/validate-mind-steward-ingestion.test.mjs tools/scripts/mind-steward-ingest-envelope.test.mjs tools/validate-infinite-brain-ingestion-envelope.test.mjs
node tools/validate-brain-document-consistency.mjs
git diff --check
```

All passed. The live scan was read-only and used the existing adapter; no external n8n or provider call was made.
