# B8.1 Execution-Gate Merge-Readiness Audit — 2026-08-03

**Verdict:** PASS, subject to the final clean-tree, pushed-feature, and unchanged-`origin/main` checks immediately before fast-forward landing.

**Scope:** the 14 pre-audit feature commits through baseline HEAD `24ac9e30d63438a5c87fd01a864db799f262c343`, plus the audited merge-readiness fix worktree/final feature commit, based on `origin/main` `9d8c01a5a49e94b6aed1b62d721386c9b9b3416a`.

**Execution boundary:** this audit did not execute B8.1, start Codebase Memory, run Graphify, create an index, materialize into the real home, or modify provider/source repositories or user configuration.

## Roadmap truth

- B8.1 was not executed and remains incomplete.
- B8.2 remains incomplete and blocked on accepted B8.1 evidence.
- Graphify remains blocked as a benchmark subject until its bounded executable contract is proven.
- P8 remains 0/6 accepted.
- A dry-run is observational only. The next authorized action must explicitly approve the exact emitted benchmark plan digest before any synthetic-home materialization or benchmark execution.

## Audit coverage

All 14 pre-audit feature commits, the final fix diff, and every resulting feature-diff path were reviewed for secret material, generated output, machine-specific paths, global dependencies, hidden home writes, unrelated changes, stale contracts, import side effects, deterministic output, and fail-closed behavior.

Adversarial review covered invalid schema, fixture, commit, path and symlink inputs; stale or changed approvals; CBM identity mismatch; isolation timeout, refusal, launch error and proof identity; blocked Graphify; disk unknown and insufficient; write escape; run collision; rollback; exact-source evidence; and receipt, manifest, plan, subject, fixture, cleanup and source-state mismatches.

## Verified defects fixed

1. Regenerated `package-lock.json` with registry-backed Ajv resolutions and complete transitives; removed the ignored `node_modules` dependency from clean installs.
2. Replaced committed machine paths in the B8.1 manifest with portable manifest-relative paths and enforced non-symlink source roots outside forbidden areas.
3. Added explicit, manifest-hash-bound exclusions for five escaping Brain source symlinks. Exports remove only those declared symlinks and reject every undeclared escaping or broken symlink before fixture validation or materialization.
4. Rejected duplicate repository IDs, absolute fixture paths, traversal/forbidden verification roots, nested verification extras, missing count roots and unreadable count trees. File counting no longer treats read failure as zero.
5. Closed archive descriptor and temporary-export leaks, made cleanup failures visible, revalidated the physical run path immediately before writes, emitted the full canonical plan for approval review, and verified owned-run rollback removal.
6. Bound the isolation adapter, Node runtime, fixed child helper and sandbox profile identities into the proof and approved plan. Only a structured status-1 EPERM/EACCES result proves denial.
7. Selected the CBM digest by the admitted entrypoint instead of artifact array order.
8. Made the evidence schema and semantic validator converge on the complete subject partition, derived `partialEvidence`, CBM selected/excluded proof rules, double-dot-free run IDs, offline-only metrics and cleanup state.
9. Bound evidence to exact run-plan and receipt fields, receipt bytes, manifest bytes, subject partition, pinned commits, CBM proof, fixture coverage, planned writes, cleanup manifest and both clean/pinned source-state files.
10. Replaced duplicate provider-root verification with the shared verifier, honored explicit revisions, corrected committed-source versus working-tree runtime semantics, enforced artifact containment, and made the runtime-truth module import-safe.
11. Corrected Workbench candidate wording, removed machine-specific active documentation paths, reconciled the active P8 implementation/status documents and removed full-diff trailing whitespace.

## Validation evidence

The required automated suites passed **296/296** tests:

| Suite | Result |
|---|---:|
| B8.1 manifest | 35/35 |
| B8.1 preflight/materialization | 43/43 |
| B8.1 evidence | 36/36 |
| Brain document consistency | 39/39 |
| Shared MCP provider verification | 15/15 |
| MCP runtime truth | 46/46 |
| MCP provider admissions | 14/14 |
| Deletion readiness | 63/63 |
| Graphify operational profiles | 5/5 |

The live document-consistency validator passed for 10 active files. `git diff --check` passed. The separate live deletion-readiness run returned the expected exit 1 with `SAFE=0`, `PARTIAL=2`, and `BLOCKED=17`; this is a truthful operational blocker, not a merge-readiness failure.

## Digest and evidence binding result

- Identical canonical plan inputs produce an identical digest.
- Subject selection, manifest/schema hashes, CBM identity, isolation helper/runtime/profile identity, Graphify profile and planned write changes alter the digest.
- Missing, malformed, wrong or stale approval creates no owned run directory.
- Exact-source evidence accepts only the exact CBM `not-required` proof.
- Selected CBM evidence requires the complete approved identity and isolation proof.
- Run directory, manifest, receipt, plan, subjects, commits, fixtures, cleanup and source-state mismatches fail closed.
- Missing fixture coverage and results for excluded subjects fail.
- Blocked Graphify cannot be represented as full B8.1 completion.

## Remaining blockers

No feature-merge blocker remains after validation. Operationally, B8.1 still requires explicit benchmark authorization and an exact plan-digest approval; Graphify remains unavailable as a selected subject. Deletion readiness remains blocked at the recorded 0/2/17 verdict.

## Exact next task

After merge, obtain explicit authorization to generate and review a fresh B8.1 dry-run plan. Do not materialize or execute until the exact emitted digest is separately approved. If Graphify is still blocked, either resolve its bounded executable contract or make an explicit canonical ineligibility decision before claiming full B8.1 completion.
