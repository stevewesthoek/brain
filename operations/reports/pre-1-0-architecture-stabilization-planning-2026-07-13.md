# Pre-1.0 Architecture Stabilization Planning Evidence

**Date:** 2026-07-13
**Task:** Add the approved Pre-1.0 Architecture Stabilization Program to the canonical Brain roadmap and implementation plan
**Mode:** documentation and planning only
**Verdict:** **COMPLETE — planning changes applied; execution not authorized**

## Accepted architectural conclusions

The roadmap and implementation plan now record these conclusions:

1. Brain and Mind remain separate.
2. Mind owns meaning, decisions, priorities, and human-readable authority.
3. Brain owns runtime, schemas, automation, deployment, and machine truth.
4. The bridge is an interface, not a third authority owner.
5. Query, authorization, and execution are separate boundaries.
6. Localhost is not authentication or authorization.
7. n8n performs authenticated immutable intake, not authoritative classification or direct promotion.
8. Mind Steward is proposal-only by default and remains the sole classification/proposal engine.
9. Canonical path meaning and executable path validation use one versioned registry, with repository, deployed, observed, and verified state represented separately.
10. Compatibility paths never remain active defaults.
11. Runtime capability truth is generated from evidence.
12. Scheduler jobs require explicit privilege, dependency, timeout, retry, receipt, failure, and kill-switch semantics.
13. Cross-repository conformance, rollback, and restoration proof precede broad controlled writes.
14. Graphs and generated reports remain non-authoritative.
15. `kanban.md` remains current task authority until M1.4 proves a lossless switch.
16. Repository configuration, deployed state, observed state, and verified state remain distinct.

## Explicitly deferred

- broad Brain or Mind folder restructuring;
- immediate deletion of existing contracts;
- a wholesale scheduler rewrite;
- distributed-service decomposition before bounded module/process boundaries are proven;
- Context Gateway implementation before safety containment;
- automatic migration of unresolved authority conflicts;
- deletion of legacy paths before cross-repository proof.

## Files inspected

- `operations/specs/infinite-brain-runtime-roadmap.md`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- `operations/runbooks/infinite-brain-roadmap-status.md`
- `operations/specs/mind-folder-compatibility-final-audit-2026-07-07.md`
- `operations/reports/b1-0-save-to-mind-path-configuration-2026-07-10.md`
- `operations/reports/b1-0a-save-to-mind-live-routing-2026-07-10.md`
- `operations/reports/b1-0b-downstream-consumers-deployment-tooling-2026-07-10.md`
- `operations/reports/mind-inbox-set-node-env-architecture-2026-07-09.md`
- `operations/specs/infinite-brain-runtime-decision-log.md`
- External B1.x repository-wide audit supplied in the conversation.
- External B1.y migration decision matrix supplied in the conversation.
- Mind M1.x authority/status evidence was used as planning input only; Mind was not modified.

## Files changed

- `operations/specs/infinite-brain-runtime-roadmap.md` — added P0–P7 stabilization lanes, principles, deferrals, and sequencing rules.
- `operations/specs/infinite-brain-runtime-implementation-plan.md` — added pending `BS0.1`–`BS0.23` tasks and preserved existing task sections.
- `operations/runbooks/infinite-brain-roadmap-status.md` — added planning priority only; capability facts were not rewritten.
- This report.

No Mind file, application code, test, automation, workflow, infrastructure,
credential, runtime-state, generated-output, deployment, commit, or push was
modified.

## Exact tasks added

The following identifiers were added exactly once, all with **Status: pending**:

```text
BS0.1  Inventory and contain mutable Brain Core capabilities
BS0.2  Quiesce unsafe Mind writes
BS0.3  Freeze unsafe n8n candidate activation
BS0.4  Audit credential and backup safety
BS0.5  Create the contract registry
BS0.6  Create the canonical path registry
BS0.7  Split mixed normative and executable contracts
BS0.8  Migrate Mind Steward to the canonical path registry
BS0.9  Migrate Brain Core path consumers
BS0.10 Migrate active legacy-path producers
BS0.11 Reconcile scheduler behavior and documentation
BS0.12 Implement the capability-state model
BS0.13 Generate the capability manifest from evidence
BS0.14 Introduce typed scheduler job manifests incrementally
BS0.15 Contain and capacity-bound Graphify
BS0.16 Build the layered conformance suite
BS0.17 Implement exact-scope approval semantics
BS0.18 Introduce typed capability workers
BS0.19 Implement the cross-repository deletion-readiness gate
BS0.20 Create the retrieval evaluation corpus
BS0.21 Define the context-pack schema
BS0.22 Implement deterministic retrieval vertical slices
BS0.23 Add thin retrieval adapters only after core parity
```

Each task includes purpose, exact outcome, prerequisites, likely scope,
minimum validation, safety boundary, stop conditions, evidence-report
requirement, and an explicit no-deployment/no-external-write authorization
boundary.

## Preserved task IDs and statuses

Existing B1 task IDs and recorded states remain unchanged:

| Task | Preserved state |
|---|---|
| B1.0 | complete (2026-07-10) |
| B1.0b | complete (2026-07-10) |
| B1.0c | complete (2026-07-11) |
| B1.0d | complete (2026-07-11) |
| B1.0e | blocked — outcome B proven (2026-07-11) |
| B1.0f | complete (2026-07-11) |
| B1.0a | postponed pending Workbench guarded live-update capability (2026-07-12); incomplete and separate |
| B1.1–B1.7 | no existing status field; preserved as existing pending-plan tasks |

Existing B2 Context Gateway tasks `B2.1`–`B2.8` remain in place with their
original names and content. Later B3–B7 tasks also remain unchanged.

## Missing or external audit artifacts

- The requested `operations/specs/mind-folder-compatibility-final-audit-2026-07-10.md` does not exist.
- The repository contains and this task used `operations/specs/mind-folder-compatibility-final-audit-2026-07-07.md`.
- No repository-stored B1.y migration-decision report was found. The B1.y matrix supplied in the conversation is treated as an external planning input pending archival.
- The B1.x repository-wide audit supplied in the conversation is treated as an external planning input pending archival; stored B1.0 reports were used where exact repository evidence existed.
- No false repository link was created for any missing or external artifact.

## Validation performed

Pre-edit:

- `git status --short` completed; unrelated dirty files were preserved.
- No `BS0.*` identifier existed before editing.
- Existing B2 headings were confirmed as `B2.1`–`B2.8` Context Gateway tasks.
- The 2026-07-07 compatibility audit exists and was inspected.

Post-edit:

- `BS0.1` through `BS0.23` each occur exactly once in the implementation plan.
- P0 through P7 each occur exactly once in the roadmap.
- Existing B2.1–B2.8 headings remain exactly once and retain their original task names.
- Existing B1 headings and status lines remain present; B1.0a remains postponed/incomplete and separate.
- `BS0.1` is identified as the highest-priority execution lane in roadmap and status planning sections.
- M1.3 is described only as independently continuable documentation cleanup.
- M1.4 is described as blocked.
- Focused secret-material scan over changed Markdown returned no findings.
- Edited Markdown was reviewed as plain text; no malformed relative links were introduced.
- Final `git status --short` was run; unrelated worktree changes remained preserved.
- No Mind file changed; no application, automation, infrastructure, credential, runtime, generated, or deployment file changed.

## Unresolved blockers

1. `B1.0a` still requires a guarded live executor and separate explicit deployment approval.
2. Live n8n success/failure behavior remains unverified; this planning change does not alter that state.
3. Mind M1.3 runtime/authority-dependent cleanup remains bounded by its independent-cleanup rule.
4. Mind M1.4 remains blocked.
5. The full B1.x and B1.y audit artifacts are not archived in Brain; the external inputs remain explicitly labeled as such.

## Verdict

**COMPLETE.** The approved stabilization program is now represented in the
canonical Brain roadmap and implementation plan under the non-conflicting
`BS0.1`–`BS0.23` namespace. Existing B1, B2, and later task IDs and meanings
were preserved. `BS0.1` is the highest-priority lane. B1.0a remains separate,
incomplete, and guarded. No execution, deployment, external write, or Mind
change was authorized or performed.

## Exact next step

Prepare the corresponding Mind planning update, preserving Mind ownership and
the M1.3/M1.4 boundaries. Do not execute BS0.1 as part of this planning task.
