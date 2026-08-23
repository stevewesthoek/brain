# MRU0-P2.5 Phase 3 — Proposal Intelligence Foundation

Status: COMPLETE / ACCEPTED

## Scope

This packet prepares explainable proposal records from Phase 2 lifecycle findings for the existing Infinite Brain Decision Core workflow. It emits proposals in memory only and does not write `proposals-latest.json`, call the approval store, request approval, or apply changes.

## Architecture compliance

The implemented flow is:

`lifecycle finding → proposal preparation → existing Decision Core queue → existing approval path`

- No second proposal system, queue, database, or authority layer was created.
- Existing Decision Core proposal and approval-store contracts remain the integration boundary.
- Every proposal retains its originating finding, source references, evidence, authority owner, confidence, freshness, privacy, and Mind-impact classification.
- Mind-impact requiring review is not treated as approval; it raises the required review boundary.
- All proposals require approval, are report-only, remain execution-blocked, and have `applied=false`.
- No canonical source, Mind file, Brain file, report, or approval store is modified by the implementation.

## Implemented files

- `tools/context-learning/proposal-intelligence.mjs`
- `tools/context-learning/proposal-intelligence.test.mjs`

## Proposal fields

Each prepared record includes a stable proposal identifier, originating finding, evidence and source references, canonical targets, authority owner, confidence, expected benefit, risk, alternatives, Mind-impact classification, review boundary, Decision Core-compatible title/action fields, and explicit report-only safety fields.

Duplicate findings are deduplicated by originating finding identity. Ambiguous or executable finding inputs fail closed.

## Validation evidence

- `node --test tools/context-learning/proposal-intelligence.test.mjs` — 4/4 PASS
- `node --test tools/context-learning/knowledge-lifecycle-analysis.test.mjs` — 4/4 PASS
- `npm run validate:context-learning-contracts` — PASS
- `npm run test:context-learning` — PASS
- `npm run validate:context-learning-broker` — PASS
- `npm run test:context-broker` — PASS
- `node tools/validate-brain-document-consistency.mjs` — PASS
- `git diff --check` — PASS

Focused tests cover provenance, Decision Core compatibility, Mind-aware review, duplicate suppression, deterministic output, invalid input rejection, approval gating, execution blocking, and zero canonical updates.

## Explicit non-goals

No approval request, proposal persistence, automatic prioritization of human meaning, autonomous maintenance, execution, remediation, canonical update, conversation ingestion, provider/model routing, or Claude/Codex/Workbench change is included.

## Remaining boundary

Future work may expose these prepared records through the existing Decision Core report/portal only after a separately authorized integration review. Approval and transaction application remain outside this packet.
