# MRU0-P3.9 — Information Ingestion and Memory Pipeline Readiness Audit

**Date:** 2026-08-23
**Scope:** read-only readiness audit
**Status:** complete; no ingestion, memory, or client behavior changed

## Executive summary

Brain and Mind have a working capture path, bounded report-only stewardship, and explicit human approval gates. They do not yet provide a universal, automatic conversation/file/media-to-memory pipeline.

The current safe operating shape is:

```text
capture source
→ Mind inbox/new
→ optional sync/classification report
→ human review/proposal/receipt
→ explicitly approved durable Mind write
```

Evidence is not automatically promoted to durable knowledge. The current system preserves that safety boundary.

## Authority and evidence boundary

- **Mind** owns meaning, priorities, human knowledge, and durable personal/business context.
- **Brain** owns operational intelligence, routing, validation, reports, and controlled workflows.
- `inbox/new/` is unreviewed intake, not durable truth.
- `inbox/processed/` contains summaries, proposals, receipts, relation reports, and derivatives; it is not durable truth.
- `inbox/failed/` is the canonical failed-processing surface.
- Durable promotion requires exact-path human review and approval.
- Brain runtime reports are derived evidence and do not become Mind truth by themselves.

Primary evidence: `operations/runbooks/n8n-mind-inbox.md`, `operations/integrations/save-to-mind/README.md`, and the Mind `system/folder-contract.md`, `system/realtime-inbox-processing-spec.md`, and `system/runbooks/review-approved-mind-write.md`.

## Capability inventory

| Capability | Status | Current evidence and actual behavior |
|---|---|---|
| Mind `inbox/new/` intake | **ACTIVE** | Canonical Save-to-Mind and manual/Obsidian intake target. New captures remain unreviewed. |
| Mind `inbox/failed/` failure routing | **ACTIVE** | n8n error routing and Mind folder contract identify it as the canonical failure target. |
| Save-to-Mind webhook | **ACTIVE** | n8n workflow receives source/title/content, writes Markdown to Mind `inbox/new/`, preserves capture metadata, and reports queue state. Repository evidence says the workflow is active; this audit did not call the external endpoint. |
| Cross-repository inbox sync | **PARTIALLY_ACTIVE** | `mind-steward-sync-inbox.mjs` supports explicit dry-run/apply copying from a Brain-side inbox to Mind `inbox/new/`; it is not a universal source adapter. |
| Automatic inbox watcher | **NOT_IMPLEMENTED** | Mind’s real-time specification explicitly says watcher/on-arrival processing is future work and not enabled. |
| Scheduled Mind Steward classification | **PARTIALLY_ACTIVE** | Classification CLI exists and supports dry-run/apply, but the documented scheduler path is report-only and classification is an explicit operator action. |
| Extraction/normalization of captures | **PARTIALLY_ACTIVE** | Mind Steward can produce classification/proposal/report outputs. A general typed extractor covering arbitrary files and media was not found. |
| Human review bucket | **ACTIVE** | `inbox/new/`, `inbox/processed/`, `inbox/failed/`, reports, proposals, receipts, and review runbooks provide separate review surfaces. |
| Approved durable Mind write | **PARTIALLY_ACTIVE** | A narrowly scoped approved-write pilot and review checklist exist. This is not unrestricted promotion automation. |
| Markdown/text capture | **ACTIVE** | Save-to-Mind writes Markdown; text/transcript content can be preserved as Markdown/raw evidence. |
| PDF/DOCX/XLSX normalization | **UNKNOWN** | Storage locations for files exist, but no Brain-owned general parser/normalizer was identified in the audited paths. |
| Image ingestion/understanding | **UNKNOWN** | Image/media references exist for unrelated product workflows; no general Mind image-understanding ingestion path was evidenced. |
| Audio ingestion/transcription | **PARTIALLY_ACTIVE** | Mind has a transcript resource convention and Brain documents explicit transcription surfaces, but no universal audio-to-Mind pipeline was evidenced. |
| Video ingestion/transcription | **PARTIALLY_ACTIVE** | Video/YouTube acquisition and project-specific pipelines exist, but they are not a general Mind ingestion contract and do not establish universal normalized memory output. |
| Video visual understanding/multimodal extraction | **NOT_IMPLEMENTED** | No general Brain/Mind pipeline was found that converts video into reviewed, provenance-linked Mind knowledge. |
| URL ingestion | **PARTIALLY_ACTIVE** | Webhook/source capture and media acquisition references exist; no universal URL fetch, extraction, normalization, and review path was established. |
| YouTube-link ingestion | **PARTIALLY_ACTIVE** | YouTube/video workflows exist, but the audited repository does not establish them as a universal Mind knowledge-ingestion pipeline. |
| Claude session storage/resume | **ACTIVE** | `tools/scripts/sessions.sh` reads Claude JSONL session files under `~/.claude/projects` and resumes them with `claude --resume`. |
| Codex session storage/resume | **ACTIVE** | `tools/scripts/sessions.sh` reads Codex JSONL session files under `~/.codex/sessions` and resumes them with `codex resume`. |
| Codex App export/import ingestion | **UNKNOWN** | No repository-backed parser or documented export ingestion path was found in the audited sources. |
| Claude/Codex conversation extraction | **NOT_IMPLEMENTED** | Session picker parsing is for listing/resume metadata; no automatic decision, lesson, or review-item extraction into Mind/Brain was found. |
| Cross-client session continuity | **PARTIALLY_ACTIVE** | Session storage and resume commands exist, and Brain has continuity contracts/reports, but no universal automatic session-to-memory handoff was found. |
| Short-term memory promotion | **PARTIALLY_ACTIVE** | Inbox, processed proposals, reports, and local memory surfaces exist; no single cross-client promotion mechanism was established. |
| Long-term memory promotion | **PARTIALLY_ACTIVE** | Mind durable folders and explicit approved-write procedures exist; promotion remains human-governed and bounded. |

## Current pipeline by stage

| Stage | Current state | Gap |
|---|---|---|
| Input | Multiple sources: webhook, Obsidian/manual captures, files, transcripts, sessions | No universal source adapter contract |
| Inbox | Canonical Mind `inbox/new/`, raw, processed, and failed folders | Non-Markdown and session inputs need explicit adapters |
| Extraction | Mind Steward classification/proposal reports; project-specific media tooling | No general multimodal/document extraction layer |
| Normalization | Markdown capture and documented processed/proposal surfaces | No universal provenance-rich normalized envelope for all input types |
| Review | Human review instructions, reports, proposals, receipts, and approval pilots | No unified cross-source review queue |
| Short-term memory | Local/session memory and processed intake surfaces | Fragmented across environments and not canonical Mind truth |
| Long-term memory | Mind durable folders after review/approval | No automatic safe promotion, intentionally |

## Session and environment findings

Claude and Codex session files are locally accessible JSONL stores. The existing picker extracts listing metadata and resumes sessions; it does not ingest full conversations into Brain or Mind. The audit found no repository contract for Codex App local database/export ingestion, and no automatic scan that extracts decisions, lessons, or review items.

The existing local Claude memory orchestrator is a separate local short-term memory surface. It should not be treated as a replacement for Mind’s canonical intake or as cross-environment durable truth.

Workbench/Brain Core exposes read-only runtime and stewardship reports, but the audited documentation explicitly keeps `writesToMind=false` and executable actions disabled for these surfaces.

## Human review and promotion

The review model is the strongest existing part of the design:

1. Capture lands in `inbox/new/`.
2. Optional processing produces a report, proposal, receipt, or failure record.
3. A human reviews source, provenance, scope, and target path.
4. Only an explicitly approved, bounded transaction may update durable Mind knowledge.
5. Validation and rollback evidence are required for controlled writes.

This prevents evidence, inference, proposal, decision, and durable knowledge from being conflated.

## Risks and dependencies

- **Pipeline fragmentation:** webhook, Obsidian/manual capture, local memory, project media tools, and session stores do not share one ingestion envelope.
- **Format coverage uncertainty:** repository evidence does not establish safe PDF/DOCX/XLSX/image/video normalization.
- **Session privacy:** Claude/Codex JSONL files may contain sensitive conversation content; any future parser needs explicit privacy and retention controls.
- **Stale documentation risk:** some historical Mind reports describe prior migration states; current folder contract and current Brain runbooks are the relevant authorities.
- **External runtime dependency:** n8n and deployment state are documented as active but were not live-called during this read-only audit.
- **Promotion risk:** automatic durable writes would bypass the currently validated authority boundary and require a separate approved phase.

Dependencies for future work are the existing Mind folder contract, Brain Context Broker/session continuity contracts, Mind Steward report/proposal surfaces, Decision Core/approval contracts, provenance/freshness rules, and validation receipts. No new database or parallel inbox is warranted.

## Priority recommendations

1. **P3.9.1 — Canonical ingestion envelope/readiness contract:** define one provider-neutral reference envelope for source, format, provenance, revision, privacy, freshness, and Mind-impact classification without implementing ingestion.
2. **P3.9.2 — Adapter coverage audit:** separately verify/document supported Markdown, office documents, image, audio, video, URL, and YouTube adapters; keep unsupported formats fail-closed.
3. **P3.9.3 — Session extraction design:** define privacy-preserving, opt-in extraction from Claude/Codex sessions into review-only proposals; do not scan or promote automatically.
4. **P3.9.4 — Unified review projection:** project existing reports/proposals/receipts into one read-only review view, without creating a second store or changing authority.
5. **P3.9.5 — Controlled promotion gate:** only after the preceding evidence is complete, design narrowly bounded, reversible, human-approved durable writes.

## What is explicitly not authorized by this audit

- no watcher or always-on ingestion;
- no conversation harvesting;
- no automatic memory promotion;
- no new database, queue, inbox, or parallel knowledge store;
- no provider/model expansion;
- no Mind or Brain authority transfer;
- no changes to Claude, Codex, Workbench, or protected configuration;
- no execution/remediation authority.

## Conclusion

The foundation is **partially implemented but operationally safe**. Capture, failure routing, review surfaces, and bounded approval controls exist. Universal file/media/session ingestion and automatic cross-client memory promotion do not. The next bounded task should be a contract and adapter-coverage design packet, not runtime activation.
