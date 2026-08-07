# Agent Mode Progress

## Current goal

Generate B8.1 v7u canonical authorization package (Node 20 binding). Supersede noncompliant Node 25 v7t. No materialization or execution.

## Current state — 2026-08-07 09:50 UTC (V7U Recovery)

- Source: `brain-next`, branch `main`, HEAD `39e33b69` (synced with origin/main).
- **Active:** v7u canonical approvable contract (Node 20 binding).
- v7u plan: `operations/reports/b8-1-canonical-plan-v7u-2026-08-07.json` (11.9 KB).
- v7u receipt: `operations/reports/b8-1-dry-run-receipt-v7u-2026-08-07.json` (4.2 KB).
- v7u run ID: `b8-1-canonical-authorization-20260807-final-v7u`.
- **v7u digest:** `0a2a543df98182b60ab67e88d3e9445e2a922d0ba4fa51dd2738183d1e72b1ed` ✓ VERIFIED.
- **Node runtime:** `/Users/Office/.nvm/versions/node/v20.20.2/bin/node` (SHA-256: `38de4fc456c0c439bac48c727d378f749abb4e31f4116703bb1ee9a746fccbb6`).
- incremental-reindex SHA256: `438a154b0232a36191683ab503fb6941cd90e37408c6b9dc7764b1db9b36fd98`.
- sourceStateHash: `sha256:a0af2027907af240ffc93f12ff8fe842a5405e9b0b894055acd9ac9bc64bb643`.
- Subjects: `cbm`, `exact-source`; Graphify excluded; partial evidence true.
- Preflight: **executionReady=true**, zero blockers, 21 contained write paths, minimum 2000 MB disk constraint passed.
- All 13 checks pass (12 pass, 1 excluded-subject per spec).
- All six focused B8.1 suites: 268/268 pass.
- JSON validation, document consistency, MCP admission, Graphify-profile validation, secret scan: all pass.
- `git diff --check`: pass.
- B8.1 status: `corrected-contract-awaiting-owner-approval`.
- P8 progress: 0/6 completed (awaiting B8.1 owner approval).
- B8.2: Blocked pending v7u owner approval and execution.

## Historical versions (superseded)

| Version | Node | Digest | Status | Notes |
|---------|------|--------|--------|-------|
| v7r | v25.9.0 | `0eec69c1befd7ce...` | failed historical | Executed 2026-08-06; all 10 CBM fixtures failed (output format) |
| v7s | v25.9.0 | `90ef52be30be8d...` | noncanonical historical | Roadmap/handoff stale; not canonical |
| v7t | v25.9.0 | `1c0892469683acb...` | runtime-mismatch historical | Node 25 binding; violated Node 20 stop condition; never executed; see `b8-1-v7t-disposition-2026-08-07.md` |

## Changes in this recovery

- Preserved v7t as historical disposition: `b8-1-v7t-disposition-2026-08-07.md` (canonical Node 25 output; noncompliant runtime; never materialized).
- Generated v7u with explicit Node 20.20.2 binary binding.
- Verified v7u digest exactly matches pre-calculated canonical: `0a2a543df98182b60ab67e88d3e9445e2a922d0ba4fa51dd2738183d1e72b1ed`.
- Updated `operations/reports/b8-1-benchmark-authorization-package-2026-08-04.md`: v7u sole approvable; v7r/v7s/v7t marked historical; Node 20 binding documented.
- All validation suites pass; ready for owner approval.

## Remaining work

1. **Do NOT materialize or execute v7u** (awaiting owner approval only).
2. Owner provides exact approval wording (see authorization package).
3. After approval: materialize, execute, validate evidence, owner disposition (separate steps).
4. Post-execution: B8.2 unblocks; P8 tasks become actionable.
