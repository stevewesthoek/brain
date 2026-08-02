# B5.4 — Controlled Write Pilot

**Status:** complete (2026-07-31)
**Prerequisites:** Mind M5.1–M5.3 PASS; Brain B5.1–B5.3 validated
**Repository mutation:** none (verified by before/after hash check)

## Pilot scope

- Target: `mind/system/evals/write-pilot/synthetic-frontmatter-target.md`
- Change: frontmatter lines 4–5 only (freshness_status, last_reviewed)
- Proposal type: synthetic frontmatter freshness edit
- Authorization: fixture-only (`human-review-fixture`)

## Validation results

| Gate | Result |
|---|---|
| Before hash matches proposal | PASS |
| Exact-scope approval validation | PASS |
| Scope hash computation | PASS |
| Apply receipt matches expected | PASS |
| Idempotent replay receipt matches | PASS |
| Idempotency conflict rejected | PASS |
| Approval expiry rejected | PASS |
| Before-hash mismatch rejected | PASS |
| Section-scope mismatch rejected | PASS |
| Path traversal rejected | PASS |
| Model-supplied authorization rejected | PASS |
| Rollback equivalence | PASS |
| Repository mutation | false |
| Three repeatability runs identical | PASS |
| Brain exact-scope approval tests | PASS |
| Target file unchanged after pilot | PASS |
| kanban.md unchanged | PASS |
| tasks.md unchanged | PASS |

Note on kanban.md and tasks.md: `git diff --stat` shows pre-existing working-tree modifications to those files unrelated to this pilot (existing uncommitted user edits). The pilot validator operates entirely in-memory and made no filesystem writes.

## Repeatability evidence

Three consecutive runs of `validate-write-pilot.mjs` produced identical JSON output with `status: "passed"`. All three exited 0.

## Brain exact-scope approval test results

```
node --test dist/tests/infinite-brain-exact-scope-approval.test.js

✔ exact approval validates and preview is deterministic (7.803166ms)
✔ fixture apply succeeds once and identical retry is idempotent (0.228125ms)
✔ unapproved extra path fails closed (0.182625ms)
✔ path traversal and normalized substitution fail closed (0.113875ms)
✔ changed before hash fails closed (0.086083ms)
✔ unapproved section fails closed (0.072959ms)
✔ expired approval fails closed (0.057958ms)
✔ same idempotency key with changed content fails closed (0.14875ms)
✔ consumed approval cannot be replayed under a new key (0.161041ms)
✔ missing or weakened rollback fails closed (0.094125ms)
✔ model-supplied approver identity fails closed (0.0655ms)
✔ model-supplied scope broadening fails closed (0.051917ms)
✔ repository state change blocks fixture apply (0.072458ms)
ℹ tests 13
ℹ pass 13
ℹ fail 0
```

## Controls verified

- B5.1: Proposal and approval schemas enforce exact paths, sections, before hashes, expiry, idempotency, and rollback
- B5.2: Executor bound to capability state (fixture-only policy)
- B5.3: Full write/rollback loop exercised on synthetic fixture

## Safety boundary

- No production Mind mutation authorized
- No proposal type broadening authorized
- Fixture file remained byte-equivalent to before-state throughout
- Unrelated Mind files unchanged
- No scheduler, deployment, credential, or external action occurred

## Authorization boundary

This pilot validates the mechanism only. It does not authorize:
- production controlled writes
- broadened proposal types
- batch writes
- writes to kanban.md, tasks.md, or meaningful content

## Appendix — validator JSON output (run 1 of 3)

```json
{
  "status": "passed",
  "targetPath": "system/evals/write-pilot/synthetic-frontmatter-target.md",
  "beforeHash": "2a124e5bdb01bf3b189699e0a9a55198b86f515366315d5f659fedcbd91ea0a8",
  "afterHash": "2d54ca14a827c5c2813d188d0d2bd2f9c9f51cf85f3c25145ea495ca04375724",
  "scopeHash": "ea0253d5316a6ddc4c3dec6f831cf3e20dd4d0940ee13a35dc68b31ce849e36a",
  "changedLines": [
    4,
    5
  ],
  "approvalValidAt": "2026-07-31T12:30:00.000Z",
  "expiryRejectedAt": "2026-08-01T12:00:00.001Z",
  "applyStatus": "applied",
  "replayStatus": "idempotent-replay",
  "idempotencyConflictRejected": true,
  "beforeHashMismatchRejected": true,
  "sectionScopeMismatchRejected": true,
  "pathTraversalRejected": true,
  "modelSuppliedAuthorizationRejected": true,
  "rollbackEquivalent": true,
  "repositoryMutated": false
}
```
