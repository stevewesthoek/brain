# BS0.17 — Exact-scope approval semantics

**Date:** 2026-07-15  
**Status:** complete  
**Repository:** Brain only  
**Commit/push:** not performed

## Canonical ownership and boundary

Brain Core owns approval validation and fixture-only apply semantics. Mind Steward preview artifacts are proposal evidence only and never approval authority. Existing `infinite-brain-operator-approval.ts` remains an intent-record gate with execution disabled; BS0.17 did not broaden it or create a competing runtime authority.

The implemented boundary is:

- `projects/brain-core/src/adapters/infinite-brain-exact-scope-approval.ts`
- `projects/brain-core/src/tests/infinite-brain-exact-scope-approval.test.ts`

Preview and fixture apply call the same canonical validator.

## Approval schema and lifecycle

An approval binds trusted approval identity, approval/expiry times, one stable idempotency key, exact repository-relative paths, exact pre-change hashes, explicit allowed line sections, and rollback requirements per path.

The lifecycle is validation → deterministic preview → one fixture-only apply → receipt → consumed approval. An identical retry returns `idempotent-replay` without applying twice. Different content under the same key fails with `idempotency_conflict`; a consumed approval under a new key fails with `approval_replay`.

## Trusted versus model-supplied fields

Trusted execution context owns approval identity and authorization evidence. Proposal/model data may contain bounded requested changes only. Model-supplied approval identity, authorization, files, expiry, or rollback fields fail closed with `model_supplied_authorization`.

## Exact scope and rollback rules

The shared validator rejects extra files, path normalization/traversal, stale before hashes, section expansion, expiry, idempotency mismatch, missing/weakened rollback, and repository-state drift. Each path requires `restore-before-content` rollback evidence whose before hash matches the approval.

Repository, deployed, observed, verified, and approval state remain separate. This task changed repository implementation and tests only.

## Files examined

- `projects/brain-core/src/adapters/infinite-brain-operator-approval.ts`
- `projects/mind-steward/src/preview.ts` (read-only evidence)
- `operations/specs/1779034874780-mind-steward-mind-write-apply-policy.md`
- canonical BS0 roadmap, implementation plan, and status runbook

## Files changed

- `projects/brain-core/src/adapters/infinite-brain-exact-scope-approval.ts`
- `projects/brain-core/src/tests/infinite-brain-exact-scope-approval.test.ts`
- this evidence report
- canonical implementation plan, roadmap, and status runbook
- `operations/specs/mcp-provider-admissions.json`
- `operations/reports/workbench-mcp-provider-admission-reconciliation-2026-07-16.md`

## Fixture results

Focused suite: 13 passed, 0 failed.

Positive coverage proves exact approval validation, deterministic preview, one fixture-only apply, receipt evidence, and a non-duplicating identical retry.

Negative coverage proves fail-closed behavior for extra paths, traversal/normalization, changed hashes, section expansion, expiry, changed-content idempotency reuse, consumed-approval replay, weakened rollback, model-supplied identity/scope, and repository-state drift.

## Validation evidence

- Focused `tsx` test: 13/13 pass.
- Brain Core TypeScript check: pass.
- Workbench provider admission validator: pass, one provider verified.
- Provider-admission focused tests: 2/2 pass.
- Verified Workbench revision: `4f8217059f6f3a681f150ca4145b8a5793f11616`.
- All 24 pinned provider artifacts and `packages/mcp/dist/server.js` revalidated without digest changes.
- Infinite Brain conformance: pass, 6 layers and 11 commands.
- Known warning retained: Mind `MS0.9` plan/evidence drift.
- Changed-path security scan: no findings.
- Registry JSON validation: pass.
- Changed Markdown links and repository-relative paths: pass.
- `git diff --check`: pass.
- No n8n, webhook, live fixture, credential, deployment, restart, grant, schedule, activation, external write, Mind change, Workbench change, commit, or push occurred.

## Unrelated-worktree proof

The implementation used two new isolated source/test files plus exact documentation and provider-admission evidence changes. Existing unrelated Brain and Workbench Private dirty paths were preserved; no broad staging or overwrite occurred.

## Remaining blockers

None for BS0.17. B1.0a remains separately incomplete and authorization-gated. BS0.10 remains blocked by Mind M1.4.

## Exact next task

`BS0.18 — Introduce typed capability workers`

## Final verdict

`BS0_17_COMPLETE_NEXT_BS0_18`
