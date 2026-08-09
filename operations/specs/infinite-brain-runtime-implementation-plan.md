# Infinite Brain Runtime Implementation Plan

**Status:** canonical Brain code handoff
**Version:** 2.0
**Last reviewed:** 2026-08-01
**Roadmap:** `operations/specs/infinite-brain-runtime-roadmap.md`

## Purpose

This plan translates the seven priorities into small code tasks that GPT-5.4 mini or an equivalent lower-tier coding model can execute without architecture decisions.

## Execution contract

Execute exactly one task per change.

For every task:

1. Read only the named files plus directly imported dependencies.
2. Preserve public behavior unless the task explicitly changes it.
3. Add or update the named tests.
4. Run the exact verification commands.
5. Stop on ambiguous ownership, unrelated dirty-file overlap, failed prerequisite, or repeated test failure.
6. Do not activate production writes, schedules, external actions, or new providers.

After each task, report files changed, tests run, and remaining blockers.

## Pre-1.0 Architecture Stabilization Program

The stabilization tasks use the separate `BS0.1`–`BS0.23` namespace. Existing
`B1`, `B2`, and later tasks retain their original IDs, meanings, statuses,
blockers, and evidence links. In particular, the existing `B2.1`–`B2.8`
Context Gateway tasks are unchanged.

### BS0.1 — Inventory and contain mutable Brain Core capabilities

- **Status:** complete (2026-07-13).
- **Purpose:** Establish a bounded inventory of mutable Brain Core capabilities and immediate containment state.
- **Exact outcome:** Every discovered mutable route family is classified with a privilege boundary and containment decision; Critical/High unauthenticated HTTP mutations fail closed before handler execution.
- **Prerequisites:** None; this is the current highest-priority execution task.
- **Likely scope:** `projects/brain-core/` route boundary and focused deterministic tests.
- **Minimum validation:** Focused containment, existing approval/publish tests, and Brain Core typecheck pass.
- **Safety boundary:** No deployment, external action, credential access, Mind write, or runtime activation; Critical/High HTTP capabilities are contained rather than enabled.
- **Stop conditions:** Missing owner, ambiguous capability state, credential exposure, or unrelated dirty-file overlap.
- **Evidence:** [BS0.1 mutable capability containment report](../reports/bs0-1-mutable-capability-containment-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.2 — Quiesce unsafe Mind writes

- **Status:** complete (2026-07-13).
- **Purpose:** Ensure broad or unsafe Mind mutation paths are disabled or report-only.
- **Exact outcome:** Unsafe write capabilities are paused, disabled, or explicitly approval-gated with evidence.
- **Prerequisites:** BS0.1 capability inventory.
- **Likely scope:** Mind-write adapters, approval gates, scheduler entrypoints, and capability status metadata.
- **Minimum validation:** Fixture hash checks prove report-only behavior; paused capabilities cannot execute writes.
- **Safety boundary:** Do not modify Mind content or invoke live jobs.
- **Stop conditions:** Any write path cannot be proven bounded, reversible, or approval-gated.
- **Evidence:** [BS0.2 unsafe Mind write quiescence report](../reports/bs0-2-unsafe-mind-write-quiescence-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.3 — Freeze unsafe n8n candidate activation

- **Status:** complete (2026-07-14).
- **Purpose:** Prevent an unverified candidate workflow from being treated as deployed truth.
- **Exact outcome:** Candidate activation, schedule, and live-state claims are explicitly frozen until B1.0a evidence exists.
- **Prerequisites:** BS0.1 inventory and existing B1.0a rollback/preflight evidence.
- **Likely scope:** n8n candidate metadata, runbooks, deployment planners, and capability state.
- **Minimum validation:** Static workflow checks prove no activation or schedule mutation is requested.
- **Safety boundary:** No n8n query, webhook, deployment, schedule action, or credential access.
- **Stop conditions:** Candidate/live state cannot be distinguished or planner boundaries are weakened.
- **Evidence:** [BS0.3 n8n candidate activation freeze report](../reports/bs0-3-n8n-candidate-activation-freeze-2026-07-13.md), plus the existing B1.0a rollback/preflight evidence.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.4 — Audit credential and backup safety

- **Status:** complete (2026-07-14).
- **Purpose:** Prove that credential material and rollback artifacts are protected before further runtime work.
- **Exact outcome:** Credential-bearing paths are excluded from reports and backups; rollback artifacts are identified and integrity-checked.
- **Prerequisites:** BS0.1 inventory and existing B1.0a artifact list.
- **Likely scope:** deployment wrappers, backup/rollback manifests, secret-exclusion rules, and evidence reports.
- **Minimum validation:** Focused secret scan; artifact hash check; no credential values printed.
- **Safety boundary:** Never read or expose secrets; use metadata-only checks.
- **Stop conditions:** Secret material is encountered, backup provenance is unclear, or rollback cannot be restored safely.
- **Evidence:** [BS0.4 credential and backup safety report](../reports/bs0-4-credential-backup-safety-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.5 — Create the contract registry

- **Status:** complete (2026-07-14).
- **Purpose:** Register human policy, executable contracts, ownership, versions, and evidence sources.
- **Exact outcome:** One machine-readable registry distinguishes Mind authority, Brain implementation, bridge policy, and runtime evidence.
- **Prerequisites:** BS0.1–BS0.4 and existing Brain–Mind bridge evidence.
- **Likely scope:** `operations/specs/`, contract schemas, registry validator, and implementation-plan links.
- **Minimum validation:** Registry schema, unique owners, unique versions, and valid repository-relative links.
- **Safety boundary:** Registry is descriptive; it cannot authorize writes or deployment.
- **Stop conditions:** Two contracts claim the same authority without an explicit relationship.
- **Evidence:** [BS0.5 contract registry report](../reports/bs0-5-contract-registry-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.6 — Create the canonical path registry

- **Status:** complete (2026-07-14).
- **Purpose:** Establish one versioned registry for canonical path meaning and executable validation.
- **Exact outcome:** Active, compatibility, historical, and generated paths are represented separately with owners and replacement rules.
- **Prerequisites:** BS0.5 and Mind folder/task contract evidence.
- **Likely scope:** Brain Core path modules, path schemas, Mind bridge references, and validators.
- **Minimum validation:** Canonical path fixtures pass; compatibility paths are never returned as active defaults.
- **Safety boundary:** No folder moves or deletions.
- **Stop conditions:** A path has no owner, replacement, or evidence class.
- **Evidence:** [BS0.6 canonical path registry report](../reports/bs0-6-canonical-path-registry-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.7 — Split mixed normative and executable contracts

- **Status:** complete (2026-07-14).
- **Purpose:** Separate human policy from executable schemas, validators, and runtime state.
- **Exact outcome:** Normative Mind documents, Brain schemas, and observed/deployed state have explicit boundaries.
- **Prerequisites:** BS0.5 and BS0.6.
- **Likely scope:** Bridge docs, JSON schemas, runbooks, status pages, and contract tests.
- **Minimum validation:** Each contract has one owner and references its source policy or evidence.
- **Safety boundary:** Documentation and schema separation only; no behavior change without a later task.
- **Stop conditions:** A proposed split would change authority or capability state without evidence.
- **Evidence:** [BS0.7 contract layer separation report](../reports/bs0-7-contract-layer-separation-2026-07-13.md).
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.8 — Migrate Mind Steward to the canonical path registry

- **Status:** complete (2026-07-14). Evidence: [BS0.8 Mind Steward path-registry migration report](../reports/bs0-8-mind-steward-path-registry-migration-2026-07-14.md).
- **Purpose:** Make Mind Steward consume the canonical path registry rather than duplicate path policy.
- **Exact outcome:** Classifier, plans, preview, reports, and health checks resolve active paths from the registry.
- **Prerequisites:** BS0.6, BS0.7, and the B1.5 package-boundary decision.
- **Likely scope:** `projects/mind-steward/` and its tests.
- **Minimum validation:** Typecheck, focused tests, and negative fixtures for every legacy path.
- **Safety boundary:** Report-only by default; no broad Mind writes.
- **Stop conditions:** Circular package dependency, behavior drift, or missing failed-path evidence.
- **Evidence:** Dated migration report with parity results.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.9 — Migrate Brain Core path consumers

- **Status:** complete (2026-07-14). Evidence: [BS0.9 Brain Core path-consumer migration report](../reports/bs0-9-brain-core-path-consumer-migration-2026-07-14.md).
- **Purpose:** Move Brain Core readers, validators, writers, and adapters to the canonical registry.
- **Exact outcome:** No active Brain Core consumer requires a legacy path as its default or sole target.
- **Prerequisites:** BS0.6–BS0.8.
- **Likely scope:** `projects/brain-core/src/`, adapters, API types, and focused tests.
- **Minimum validation:** Typecheck, focused path tests, compatibility tests, and no-active-default assertion.
- **Safety boundary:** Preserve compatibility reads only where explicitly registered.
- **Stop conditions:** A consumer cannot distinguish active, compatibility, and historical paths.
- **Evidence:** Dated consumer-migration report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.10 — Migrate active legacy-path producers

- **Status:** complete (2026-07-31). Evidence: [BS0.10 legacy producer migration report](../reports/bs0-10-legacy-producer-migration-2026-07-31.md). M1.4 resolved; all four legacy producers retired with exit guards.
- **Purpose:** Stop scheduled and automation producers from creating new legacy-path output.
- **Exact outcome:** Compile, Bible Studies, review, and proposal producers target canonical review/domain paths.
- **Prerequisites:** BS0.6–BS0.9 and M1.4 task-authority decision where task output is affected.
- **Likely scope:** `tools/scripts/`, scheduler producers, proposal writers, and runbooks.
- **Minimum validation:** Dry-run output assertions and producer inventory show no legacy active destination.
- **Safety boundary:** No live schedule activation; fixture-only or report-only validation.
- **Stop conditions:** Target authority is unresolved or a producer would mutate human authority directly.
- **Evidence:** Dated producer-migration report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.11 — Reconcile scheduler behavior and documentation

- **Status:** complete (2026-07-14). The user explicitly authorized this
  repository-only scheduler-truth lane while BS0.10 remains blocked; external
  activation is recorded as unknown, never inferred. Evidence:
  [BS0.11 scheduler reconciliation report](../reports/bs0-11-scheduler-reconciliation-2026-07-14.md).
- **Purpose:** Make scheduler jobs, runbooks, dependencies, and failure behavior agree.
- **Exact outcome:** Every scheduled job has an accurate documented command, privilege, dependency, timeout, retry, receipt, failure, and kill-switch contract.
- **Prerequisites:** BS0.1, BS0.9, and BS0.10.
- **Likely scope:** office scheduler, Mind Steward scripts, compile loop, and runbooks.
- **Minimum validation:** Static scheduler manifest and dry-run command verification.
- **Safety boundary:** Do not activate schedules or run external jobs.
- **Stop conditions:** A scheduler path would perform an unapproved write or has no kill switch.
- **Evidence:** Dated scheduler reconciliation report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.12 — Implement the capability-state model

- **Status:** complete (2026-07-14). Evidence: [BS0.12 capability-state model report](../reports/bs0-12-capability-state-model-2026-07-14.md).
- **Purpose:** Represent repository, deployed, observed, and verified capability states separately.
- **Exact outcome:** Capability state has a schema, allowed transitions, owner, evidence command, and freshness policy.
- **Prerequisites:** BS0.1, BS0.5, and BS0.11.
- **Likely scope:** capability schema, status tooling, and runbook integration.
- **Minimum validation:** Valid/invalid state-transition fixtures and stale-evidence checks.
- **Safety boundary:** State model cannot promote capability without evidence.
- **Stop conditions:** Manual claims cannot be distinguished from verified evidence.
- **Evidence:** Dated capability-state validation report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.13 — Generate the capability manifest from evidence

- **Status:** complete (2026-07-14). Evidence: [BS0.13 capability manifest report](../reports/bs0-13-capability-manifest-2026-07-14.md).
- **Purpose:** Replace manually maintained capability claims with evidence-derived manifest entries.
- **Exact outcome:** Generated status is reproducible from declared checks and preserves uncertainty.
- **Prerequisites:** BS0.12.
- **Likely scope:** manifest generator, evidence commands, status Markdown, and tests.
- **Minimum validation:** Repeated generation is deterministic; missing evidence never becomes active.
- **Safety boundary:** Generator is read-only and cannot execute unapproved actions.
- **Stop conditions:** Generator would infer deployment or authorization from repository state alone.
- **Evidence:** Dated manifest-generation report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.14 — Introduce typed scheduler job manifests incrementally

- **Status:** complete (2026-07-14). Evidence: [BS0.14 typed scheduler manifests report](../reports/bs0-14-typed-scheduler-manifests-2026-07-14.md).
- **Purpose:** Make scheduler privilege and operational behavior machine-checkable without a wholesale rewrite.
- **Exact outcome:** One bounded job family has typed manifests for privilege, dependencies, timeouts, retries, receipts, failures, and kill switches.
- **Prerequisites:** BS0.11–BS0.13.
- **Likely scope:** scheduler manifests, one pilot job, validator, and runbook.
- **Minimum validation:** Manifest validator and fixture job dry-run.
- **Safety boundary:** No scheduler activation; incremental pilot only.
- **Stop conditions:** Typed manifest requires broad scheduler rewrite or hides existing side effects.
- **Evidence:** Dated typed-job pilot report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.15 — Contain and capacity-bound Graphify

- **Status:** complete (2026-07-14). Evidence: [BS0.15 Graphify containment report](../reports/bs0-15-graphify-containment-capacity-2026-07-14.md).
- **Purpose:** Keep graphs and generated reports bounded, reproducible, and non-authoritative.
- **Exact outcome:** Graphify profiles exclude unsafe/generated/vendor state and declare size, retention, and regeneration limits.
- **Prerequisites:** BS0.1 and BS0.13.
- **Likely scope:** Graphify profiles, `.graphifyignore`, generated-output policy, and validation scripts.
- **Minimum validation:** Bounded profile run metadata and output-retention assertions.
- **Safety boundary:** Generated output cannot become authority or trigger writes.
- **Stop conditions:** Profile includes secrets, runtime state, or unbounded generated output.
- **Evidence:** Dated Graphify containment report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.16 — Build the layered conformance suite

- **Status:** complete (2026-07-15). Evidence: [BS0.16 layered conformance report](../reports/bs0-16-layered-conformance-suite-2026-07-15.md).
- **Purpose:** Validate path, contract, capability, scheduler, bridge, and safety invariants in layers.
- **Exact outcome:** A deterministic suite fails on stale paths, mismatched versions, unsafe defaults, or unsupported state claims.
- **Prerequisites:** BS0.5–BS0.15.
- **Likely scope:** `tools/scripts/`, fixtures, package scripts, and cross-repository metadata checks.
- **Minimum validation:** Current repositories pass; deliberately stale fixture fails.
- **Safety boundary:** Metadata/path checks only; no personal content reads.
- **Stop conditions:** Test requires credentials, live services, or broad Mind content.
- **Evidence:** Dated conformance report with pass/fail fixture output.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.17 — Implement exact-scope approval semantics

- **Status:** complete (2026-07-15). Evidence: [BS0.17 exact-scope approval semantics report](../reports/bs0-17-exact-scope-approval-semantics-2026-07-15.md).
- **Purpose:** Ensure proposals and approvals cannot expand target paths, files, sections, or authority.
- **Exact outcome:** Approvals bind exact paths, before hashes, allowed sections, expiry, idempotency, and rollback requirements.
- **Prerequisites:** BS0.5, BS0.7, BS0.12, and BS0.16.
- **Likely scope:** bridge schemas, approval validators, preview/apply code, and fixtures.
- **Minimum validation:** Scope-expansion, replay, hash-mismatch, and expiry fixtures fail closed.
- **Safety boundary:** No production or Mind writes; fixtures only.
- **Stop conditions:** Model output can populate approval identity or broaden scope.
- **Evidence:** Dated approval-semantics report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.18 — Introduce typed capability workers

- **Status:** complete (2026-07-16). Evidence: [BS0.18 typed capability workers report](../reports/bs0-18-typed-capability-workers-2026-07-16.md).
- **Purpose:** Give each bounded capability an explicit worker interface and state boundary.
- **Exact outcome:** One pilot worker reports typed inputs, outputs, receipts, failures, and kill-switch state.
- **Prerequisites:** BS0.12–BS0.17.
- **Likely scope:** one report-only worker, capability registry, scheduler manifest, and tests.
- **Minimum validation:** Fixture execution, receipt validation, timeout, retry, and failure tests.
- **Safety boundary:** Report-only worker; no external or Mind mutation.
- **Stop conditions:** Worker requires distributed decomposition or unbounded privileges.
- **Evidence:** Dated worker pilot report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.19 — Implement the cross-repository deletion-readiness gate

- **Status:** complete (2026-08-01). Evidence: [BS0.19 deletion-readiness evaluation](../reports/bs0-19-deletion-readiness-evaluation-2026-07-31.md). Executable gate: `node tools/validate-deletion-readiness.mjs`. Fail-closed invariant: SAFE requires all six universal proof fields and every exact `deletionPrerequisites` identifier as structured `{ status, evidence, appliesTo }` objects; only `status=satisfied` with nonblank evidence and `appliesTo` equal to `global` or containing the exact registry literal is positive; legacy strings never contribute to SAFE; retirement or non-authoritative classification does not substitute for human deletion approval; 63 focused tests pass (63/63). Live verdict (all 19 non-canonical registry entries): 0 SAFE, 2 PARTIAL, 17 BLOCKED; no deletion performed. Note: graphify-operational-output (.graphify-out/, a compatibility root) is BLOCKED because the profile catalog governs runtime/local/graphify/... output roots which explicitly exclude .graphify-out/ from the corpus — a catalog pass for a different root cannot satisfy the graphify-profile-conformance prerequisite for this compatibility path.
- **Purpose:** Prove legacy paths have no active producers, consumers, links, or authority dependencies before deletion.
- **Exact outcome:** Gate reports SAFE, PARTIAL, or BLOCKED per path and requires explicit approval for deletion.
- **Prerequisites:** BS0.6, BS0.9–BS0.18, and M1.3/M1.4 authority results.
- **Likely scope:** Brain validator, Mind metadata/path inventory, link/backlink checks, and deletion reports.
- **Minimum validation:** Known stale fixture is blocked; fully migrated fixture is safe; ambiguous fixture is partial.
- **Safety boundary:** Never delete files or folders.
- **Stop conditions:** Cross-repository evidence is incomplete or authority is unresolved.
- **Evidence:** Dated deletion-readiness report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.20 — Create the retrieval evaluation corpus

- **Status:** complete (2026-07-16). Evidence: [BS0.20 retrieval evaluation corpus report](../reports/bs0-20-retrieval-evaluation-corpus-2026-07-16.md).
- **Purpose:** Establish evaluation-first ground truth before retrieval expansion.
- **Exact outcome:** Versioned synthetic/redacted questions, expected sources, forbidden sources, privacy cases, and contradiction cases exist.
- **Prerequisites:** BS0.16 and safety containment exit.
- **Likely scope:** `operations/specs/` or fixture-owned evaluation corpus, never personal production content.
- **Minimum validation:** Every question has scope, authority, freshness, and expected-unknown metadata.
- **Safety boundary:** No secrets or unredacted personal content in fixtures.
- **Stop conditions:** Expected source is disputed or fixture would expose private material.
- **Evidence:** Dated corpus inventory and validation report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.21 — Define the context-pack schema

- **Status:** complete (2026-07-16). Evidence: [BS0.21 context-pack schema report](../reports/bs0-21-context-pack-schema-2026-07-16.md).
- **Purpose:** Define the executable context-pack contract only after safety and authority boundaries are stable.
- **Exact outcome:** Version `1.0` schema validates authority, freshness, scopes, citations, conflicts, unknowns, and budgets.
- **Prerequisites:** BS0.5, BS0.7, BS0.16, and BS0.20.
- **Likely scope:** `operations/specs/context-pack.schema.json`, types, fixtures, and bridge documentation.
- **Minimum validation:** Valid pack passes; missing citation, invalid authority, scope escape, and negative budget fail.
- **Safety boundary:** Schema is a contract, not a retrieval or write permission.
- **Stop conditions:** Mind bridge policy and executable schema disagree.
- **Evidence:** Dated schema conformance report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.22 — Implement deterministic retrieval vertical slices

- **Status:** complete (2026-07-16). Evidence: [BS0.22 deterministic retrieval slice report](../reports/bs0-22-deterministic-retrieval-slice-2026-07-16.md).
- **Purpose:** Implement small deterministic retrieval slices before semantic ranking or broad adapters.
- **Exact outcome:** One CLI/core vertical slice supports authorized discovery, citation, freshness, conflict, unknown, and budget behavior.
- **Prerequisites:** BS0.20, BS0.21, and existing B2 Context Gateway task boundaries.
- **Likely scope:** New `projects/mind-context/` core/CLI tests, without changing existing B2 task IDs.
- **Minimum validation:** Deterministic fixtures, scope exclusion, symlink safety, citation, and budget tests.
- **Safety boundary:** Read-only retrieval; source text is untrusted data and cannot change policy or permissions.
- **Stop conditions:** Retrieval requires live Mind writes, semantic ranking before baseline, or unresolved authority.
- **Evidence:** Dated retrieval vertical-slice report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

### BS0.23 — Add thin retrieval adapters only after core parity

- **Status:** complete (2026-07-17). Evidence: [BS0.23 thin retrieval adapters report](../reports/bs0-23-thin-retrieval-adapters-2026-07-17.md), [BS0.23 / B1.1-B1.4 batch summary](../reports/bs0-23-b1-1-b1-4-batch-summary-2026-07-17.md).
- **Purpose:** Add adapters only after the deterministic retrieval core passes parity and safety checks.
- **Exact outcome:** One thin CLI/MCP/API/Console adapter delegates to the tested core without duplicating policy.
- **Prerequisites:** BS0.21, BS0.22, existing B2 core tasks, and conformance evidence.
- **Likely scope:** Adapter boundary only; no second retrieval implementation.
- **Minimum validation:** Adapter parity tests, schema validation, scope enforcement, and unavailable-core failure behavior.
- **Safety boundary:** Adapter is read-only and cannot authorize or execute writes.
- **Stop conditions:** Adapter adds policy, bypasses core validation, or requires a provider before core parity.
- **Evidence:** Dated adapter-parity report.
- **Authorization:** This task does not authorize deployment or external writes unless separately approved.

## Priority 1 — Canonical coherence and migration closure

### B1.0 — Align repository Save-to-Mind path configuration

- **Status:** complete (2026-07-10). Evidence: [B1.0 completion report](../reports/b1-0-save-to-mind-path-configuration-2026-07-10.md).
- **Files:** `operations/automations/n8n/workflows/mind-inbox-fixed.json`, `operations/runbooks/n8n-mind-inbox.md`, focused path-contract validation, dated evidence report.
- **Change:** make repository success-path defaults use `inbox/new` and failed-processing defaults use `inbox/failed`; preserve environment-variable overrides; remove `capture/inbox` and `capture/failed` as active defaults; retain retired paths only in explicitly historical fixtures or migration evidence; update the canonical n8n runbook.
- **Tests:** validate workflow JSON; deterministically extract and assert success and failure defaults from both repository workflow definitions; prove no active retired-path default remains.
- **Verify:** focused path validation passes; workflow JSON parses; runbook separates repository configuration from unverified live deployment state; no credential value is printed; no external action or Mind write occurs.
- **Safety:** do not deploy or update the live n8n workflow, activate schedules, invoke webhooks, access credentials, or perform external writes. Live deployment and verification require a separate explicitly approved task.
- **Stop if:** required edits expose or require credentials, or unrelated dirty changes overlap any required file.

### B1.0b — Align downstream Save-to-Mind consumers and deployment tooling

- **Status:** complete (2026-07-10). Evidence: [B1.0b completion report](../reports/b1-0b-downstream-consumers-deployment-tooling-2026-07-10.md).
- **Files:** `projects/mind-steward/src/classifier.ts`, related tests, the canonical sync consumer or its replacement, credential-abstracting n8n status/deploy/rollback tooling, and a dated evidence report.
- **Change:** move downstream intake discovery from `capture/inbox` to `inbox/new`; define failed-item discovery or operator handling for `inbox/failed`; restore or replace the missing non-overwriting sync consumer; identify or add a safe n8n status/deploy/rollback wrapper that never prints credentials.
- **Tests:** focused classifier path tests; sync non-overwrite tests; failed-path discovery or operator-handling tests; dry-run status/deploy/rollback wrapper validation without live deployment.
- **Verify:** downstream consumers can discover `inbox/new` and safely handle `inbox/failed`; rollback artifacts and exact wrapper commands are available; no credentials are read or printed; no live deployment, webhook invocation, external write, or Mind write occurs.
- **Safety:** preserve B1.0a's explicit approval gate for all live actions.
- **Stop if:** downstream ownership is ambiguous, rollback cannot be proven without live action, credentials would be exposed, or unrelated dirty changes overlap required files.

### B1.0c — Reconcile candidate workflow metadata with live workflow

- **Status:** complete (2026-07-11). Evidence: [B1.0a preflight report](../reports/b1-0a-save-to-mind-live-routing-2026-07-10.md).
- **Files:** `operations/automations/n8n/workflows/mind-inbox-fixed.json`, focused planner tests if required, and the B1.0a preflight report.
- **Change:** change only the candidate workflow name from `Mind Inbox — Capture & Classify with Signal Scoring` to the exact live name `Save to Mind — Capture for Mind Steward`; do not alter activation, settings, sharing, credentials, node identities, routing logic, or schedules.
- **Tests:** rerun repository workflow validation, Mind Steward tests, sync tests, planner tests, and the identical deploy-plan comparison against the validated live rollback artifact.
- **Verify:** the workflow-name boundary passes; stop and report any next planner mismatch without weakening or bypassing the planner.
- **Safety:** repository-only; no live n8n query, deployment, webhook, schedule action, credential access, external write, or Mind write.
- **Stop if:** any change beyond the exact workflow name is required, the rollback artifact hash changes unexpectedly, or the planner reports another boundary mismatch.

### B1.0d — Reconcile candidate sharing metadata with live workflow

- **Status:** complete (2026-07-11). Evidence: [B1.0a preflight report](../reports/b1-0a-save-to-mind-live-routing-2026-07-10.md).
- **Files:** `operations/automations/n8n/workflows/mind-inbox-fixed.json`, focused planner tests if required, and the B1.0a preflight report.
- **Change:** reconcile only `shared[0].project` from the validated live rollback artifact. Preserve `shared[0].createdAt`, `projectId`, `role`, `updatedAt`, and `workflowId`, which already match; do not alter workflow activation, settings, tags, credentials, node identities, routing logic, schedules, or any other field.
- **Tests:** rerun repository workflow validation, Mind Steward tests, sync tests, planner tests, JSON validation, and the identical deploy-plan comparison.
- **Verify:** the sharing boundary passes; stop and report any next planner mismatch without weakening or bypassing the planner.
- **Safety:** repository-only; do not query live n8n again, deploy, invoke webhooks, change schedules, access credentials, perform external writes, or modify Mind.
- **Stop if:** the live project metadata cannot be copied without exposing credential material, any field outside `shared[0].project` must change, the rollback artifact changes unexpectedly, or the planner reports another boundary mismatch.

### B1.0e — Reconcile candidate node topology with live workflow

- **Status:** superseded (2026-07-22) by completed B1.0f controlled topology migration design and completed B1.0a guarded deployment/readback. Retained as historical decision evidence. Evidence: [B1.0a preflight report](../reports/b1-0a-save-to-mind-live-routing-2026-07-10.md), [B1.0a guarded live completion](../reports/b1-0a-guarded-live-completion-2026-07-22.md).
- **Files:** `operations/automations/n8n/workflows/mind-inbox-fixed.json`, `tools/n8n-save-to-mind-plan.mjs` only if a stricter topology contract is required, focused planner tests, and the B1.0a preflight report.
- **Change:** compare live and candidate node/connection graphs using safe structural metadata; determine the smallest semantics-preserving repository change that retains required live node identities while introducing canonical `inbox/new` and `inbox/failed` routing. Do not delete or rename live nodes merely to satisfy the candidate.
- **Tests:** validate exact node IDs, names, types, connection graph, activation, settings, sharing, credentials, routing paths, workflow JSON, Mind Steward, sync, planner, and rollback compatibility.
- **Verify:** the planner no longer reports `workflow removed node resolve-inbox-path`; stop and document each subsequent boundary separately.
- **Safety:** repository-only; no live n8n query, deployment, webhook, schedule action, credential access, external write, or Mind write.
- **Stop if:** semantic equivalence cannot be proven, live node logic must be replaced wholesale, credential-bearing node parameters would need inspection, or the planner would need to be weakened.
- **Outcome:** candidate introduces a different three-node processing chain, including a new HTTP classification node, while removing three live processing identities. Semantic equivalence cannot be proven as an ordinary bounded update; controlled topology migration is required.

### B1.0f — Design and validate controlled Save-to-Mind topology migration

- **Status:** complete (2026-07-11). Evidence: [B1.0a preflight report](../reports/b1-0a-save-to-mind-live-routing-2026-07-10.md).
- **Files:** new machine-checkable topology migration manifest, `tools/n8n-save-to-mind-plan.mjs` or a dedicated stricter topology planner, focused tests, `operations/automations/n8n/workflows/mind-inbox-fixed.json` only where the approved manifest requires repository metadata, and the B1.0a preflight report.
- **Change:** define every retained, removed, added, renamed, type-changed, and rewired node between the validated live rollback artifact and candidate; preserve webhook, GitHub file-check/create/update, response, activation, settings, sharing, credential, and schedule boundaries; explicitly approve the candidate classification chain and canonical `inbox/new` / `inbox/failed` behavior as a topology migration rather than an ordinary update.
- **Tests:** deterministic manifest validation; exact graph diff; allowed and forbidden node-transition tests; connection-graph tests; path-routing tests; rollback-artifact ID/hash checks; rejection of unlisted node, credential, activation, schedule, settings, sharing, or webhook changes.
- **Verify:** the stricter planner emits a bounded migration plan, exact deployment and rollback commands, and expected post-deployment graph; no live action occurs.
- **Safety:** requires separate explicit approval for the topology migration design and another explicit approval for live deployment and fixtures. Never weaken the existing ordinary-update planner.
- **Stop if:** any graph transition is not listed, rollback cannot restore the original graph, credential-bearing parameters require inspection, webhook identity changes, or post-deployment verification cannot prove exact graph and routing state.

### B1.0a — Deploy and verify Save-to-Mind target paths

- **Status:** complete (2026-07-22). Evidence: [B1.0a guarded live completion](../reports/b1-0a-guarded-live-completion-2026-07-22.md). The admitted MRP-6 Workbench path executed one fresh two-phase candidate update and confirmed the exact approved candidate by canonical readback: `candidateUpdate=1`, `rollbackUpdate=0`, `readback=2`, `protectedDomains=unchanged`, `reasonCode=READBACK_CANDIDATE_CONFIRMED`. The accepted completion evidence is the exact live candidate readback plus deterministic route and downstream-consumer proofs; no webhook fixture or Mind write was performed.
- **Files:** live n8n workflow configuration and deployment evidence only; repository edits only where deployment evidence requires documentation updates.
- **Change:** deploy the reviewed controlled-migration workflow configuration, verify the deployed definition routes success to `inbox/new/` and failed processing to `inbox/failed/`, preserve the approved environment-override expressions and downstream consumer compatibility, and record rollback evidence without inspecting runtime environment values.
- **Tests:** exact precondition and post-update canonical readbacks; deterministic success/failure route proof; fixture-adapter contract tests; downstream sync/classification consumer tests; rollback artifact and dispatch-safety tests.
- **Verify:** live workflow canonical hash matches the reviewed repository definition; canonical target paths are present and retired target paths are absent; downstream sync/classification consumers can read the new paths; rollback remains validated and available without a rollback mutation.
- **Safety:** requires explicit approval before any deployment, webhook invocation, schedule activation, credential access, or external write. Never print credential values.
- **Stop if:** approval is absent, rollback is unavailable, downstream consumers are incompatible, path evidence is ambiguous, or any write would escape the approved fixtures.

### B1.1 — Create one Mind contract module

- **Status:** complete (2026-07-17). Evidence: [B1.1 Mind contract module report](../reports/b1-1-mind-contract-module-2026-07-17.md), [BS0.23 / B1.1-B1.4 batch summary](../reports/bs0-23-b1-1-b1-4-batch-summary-2026-07-17.md).
- **Files:** `projects/brain-core/src/mind-paths.ts`, new `projects/brain-core/src/contracts/mind-contract.ts`, related tests
- **Change:** move current target paths, authority labels, review surfaces, and historical-only paths into one exported immutable contract; retain backward-compatible re-exports from `mind-paths.ts`.
- **Tests:** current success intake is only `inbox/new`; current failure intake is only the verified active path; historical paths are never returned as active candidates.
- **Verify:** `npm run typecheck`; focused Mind path tests.
- **Stop if:** the active failure path is not confirmed by Mind's folder contract and Save-to-Mind configuration.

### B1.2 — Fix Mind Steward typecheck

- **Status:** complete (2026-07-17). Evidence: [B1.2 Mind Steward typecheck report](../reports/b1-2-mind-steward-typecheck-2026-07-17.md), [BS0.23 / B1.1-B1.4 batch summary](../reports/bs0-23-b1-1-b1-4-batch-summary-2026-07-17.md).
- **File:** `projects/mind-steward/src/cli/classify-captures.ts`
- **Change:** assign `runInput.limit` only after narrowing `limit` to a finite `number`; do not use a type assertion.
- **Test:** add or update argument parsing test for missing, valid, and invalid limit.
- **Verify:** `cd projects/mind-steward && npm run typecheck && npm test`.
- **Stop if:** another failure appears; report it as a separate task.

### B1.3 — Migrate the classifier to the shared contract

- **Status:** complete (2026-07-17). Evidence: [B1.3 classifier shared contract report](../reports/b1-3-classifier-shared-contract-2026-07-17.md), [BS0.23 / B1.1-B1.4 batch summary](../reports/bs0-23-b1-1-b1-4-batch-summary-2026-07-17.md).
- **Files:** `projects/mind-steward/src/classifier.ts`, package dependency/import boundary, tests
- **Change:** resolve intake through the canonical contract instead of hard-coding `capture/inbox`; use `inbox/new` only after B1.1.
- **Tests:** missing inbox, empty inbox, one Markdown file, README exclusion, path traversal/symlink safety.
- **Verify:** Mind Steward typecheck and tests.
- **Stop if:** importing Brain Core creates a circular package dependency; extract the contract to a dependency-free shared package.

### B1.4 — Make classification report-only by default

- **Status:** complete (2026-07-17). Evidence: [B1.4 classification report-only default report](../reports/b1-4-classification-report-only-default-2026-07-17.md), [BS0.23 / B1.1-B1.4 batch summary](../reports/bs0-23-b1-1-b1-4-batch-summary-2026-07-17.md).
- **Files:** classifier CLI and tests
- **Change:** default to dry-run; require an explicit `--apply=true` flag plus existing approval enforcement for source mutation; reject simultaneous dry-run/apply flags.
- **Tests:** no flag does not modify fixture; apply without approval fails; approved fixture applies exactly one allowed metadata change.
- **Verify:** compare fixture hashes before and after each mode.
- **Stop if:** no approval validator is available; implement dry-run default only and leave apply disabled.

### B1.5 — Resolve the Mind Steward package boundary

- **Status:** complete (2026-07-14). Evidence: [B1.5 Mind Steward package-boundary report](../reports/b1-5-mind-steward-package-boundary-2026-07-14.md).
- **Files:** `projects/mind-steward/README.md`, Brain Core/Mind Steward imports and scripts
- **Change:** choose the lower-complexity result based on dependency inventory: either make Mind Steward a thin CLI over Brain Core services or move its unique services into Brain Core and mark the package deprecated. Do not keep two path/policy implementations.
- **Tests:** behavior parity for dry-run report, preview, and classification fixtures.
- **Verify:** both packages typecheck; one canonical implementation is referenced in docs.
- **Stop if:** behavior parity cannot be demonstrated; retain package and document the blocker.

### B1.6 — Update active AI instruction paths

- **Status:** complete (2026-07-30). Evidence: [B1.6 active AI instruction paths report](../reports/b1-6-active-ai-instruction-paths-2026-07-30.md).
- **Files:** global Claude, Codex, Gemini, Cursor, Kiro, and IDE context Markdown/config instruction files identified by `rg 'mind/router|mind/00-memory-map|mind/0[346]-' operations/system-configs`
- **Change:** point to `mind/system/agent-context/AGENTS.md`, `00-start-here.md`, `00-current-context.md`, and `00-memory-map.md`; update target research/task/project paths.
- **Verify:** the same `rg` returns no unexplained active old path; run config-specific validation if available.
- **Stop if:** a file is generated; update its canonical source and regenerate instead.

### B1.7 — Add a cross-repo contract check

- **Status:** complete (2026-07-30). Evidence: [B1.7 cross-repo contract report](../reports/b1-7-cross-repo-contract-2026-07-30.md).
- **Files:** new script under `tools/scripts/`, test fixture, package script
- **Change:** validate that required Mind entrypoints exist, current intake paths agree, bridge/schema versions match, and active global instructions use current paths.
- **Verify:** command passes on current repos and fails on a fixture with one stale path.
- **Stop if:** validation requires reading personal content; check paths and metadata only.

## Priority 2 — Context Gateway

### B2.1 — Scaffold the dependency-free core

- **Path:** `projects/mind-context/`
- **Status:** complete (2026-07-16). Evidence: [B2.1 Mind Context package scaffold report](../reports/b2-1-mind-context-package-scaffold-2026-07-16.md).
- **Change:** create the package scaffold with `src/core`, `src/cli`, `src/adapters`, `test`, and `fixtures`; keep the canonical runtime dependency-free and Node-stdlib-first; add build, typecheck, test, and smoke scripts.
- **Verify:** package build/check passes and one smoke test passes.
- **Stop if:** workspace conventions require another location; use the existing convention and document it.

### B2.2 — Add the context-pack schema

- **Files:** `operations/specs/context-pack.schema.json`, package types and schema tests
- **Status:** complete (2026-07-16). Evidence: [B2.2 context-pack schema report](../reports/b2-2-context-pack-schema-2026-07-16.md).
- **Change:** implement version `1.0` fields from strategy; reject unknown authority/freshness states, unauthorized scopes, missing hashes, missing provenance, hidden unknowns, and negative or oversized budgets.
- **Verify:** valid example passes; negative fixtures fail through one canonical validator.
- **Stop if:** Mind bridge field names differ; align docs before code.

### B2.3 — Implement deterministic discovery

- **Files:** `projects/mind-context/src/core/discover.ts`, tests
- **Status:** complete (2026-07-16). Evidence: [B2.3 deterministic discovery report](../reports/b2-3-deterministic-discovery-2026-07-16.md).
- **Change:** search only allowed scopes and Markdown files; exclude history/archive/generated/runtime by default; return path, title, headings, frontmatter, explicit links, freshness, authority, and privacy metadata.
- **Tests:** scope inclusion/exclusion, symlink escape, missing root, deterministic sort, binary rejection, and secret-path rejection.
- **Verify:** focused tests and build/check.
- **Stop if:** discovery reads secrets or binary files; fail closed.

### B2.4 — Implement deterministic ranking

- **Files:** `rank.ts`, tests
- **Status:** complete (2026-07-16). Evidence: [B2.4 deterministic ranking report](../reports/b2-4-deterministic-ranking-2026-07-16.md).
- **Change:** rank by exact term/title match, explicit link, canonical-path class, current status, freshness, and authority; return score components.
- **Tests:** fixed fixtures with stable ordering; current canonical source outranks capture and generated summary.
- **Verify:** repeat test twice and compare identical output.
- **Stop if:** model or embedding access is required; keep lexical baseline.

### B2.5 — Implement budgeting and rendering

- **Files:** `budget.ts`, `render.ts`, tests
- **Status:** complete (2026-07-16). Evidence: [B2.5 budgeting and rendering report](../reports/b2-5-budgeting-rendering-2026-07-16.md).
- **Change:** estimate tokens consistently, include highest-ranked complete excerpts within budget, record omitted sources, and render JSON/Markdown from one normalized pack.
- **Tests:** zero, small, exact, and exceeded budgets; no partial invalid YAML/frontmatter excerpt.
- **Verify:** schema validation on rendered JSON.
- **Stop if:** truncation loses a citation; omit the excerpt instead.

### B2.6 — Implement CLI commands

- **Files:** CLI entrypoint and tests
- **Status:** complete (2026-07-16). Evidence: [B2.6 CLI commands report](../reports/b2-6-cli-commands-2026-07-16.md).
- **Change:** add `resolve`, `explain`, and `health`; require explicit query and scope; support JSON and Markdown output.
- **Tests:** exit codes and structured errors for missing root, missing query, invalid scope, and insufficient evidence.
- **Verify:** run all three commands against fixtures.
- **Stop if:** command writes to Mind; Context Gateway is read-only.

### B2.7 — Enforce the retrieval trust boundary

- **Files:** Context Gateway renderer/core, threat fixtures, tests
- **Status:** complete (2026-07-16). Evidence: [B2.7 trust boundary report](../reports/b2-7-trust-boundary-2026-07-16.md).
- **Change:** label every excerpt as untrusted source data; prevent source text from changing query, scope, permissions, tool calls, approval state, or output schema; record source path for every excerpt.
- **Tests:** include source text that says to ignore rules, reveal other scopes, call a tool, approve a write, or hide citations; output must retain the text only as quoted data and preserve the original request.
- **Verify:** all injection/data-poisoning fixtures pass with zero scope or permission changes.
- **Stop if:** an adapter concatenates source text into system/developer instructions; fix the boundary before continuing.

### B2.8 — Add thin adapters

- **Prerequisite:** B2.1–B2.6 and Priority 3 baseline pass.
- **Status:** complete (2026-07-16). Evidence: [B2.8 thin adapters report](../reports/b2-8-thin-adapters-2026-07-16.md).
- **Change:** add MCP first, then API/Console adapters only when required; each calls the same core function and returns the same schema version.
- **Tests:** contract test compares source IDs and authority fields across CLI and adapter.
- **Verify:** adapter parity test.
- **Stop if:** adapter needs separate ranking logic; refactor core instead.

## Priority 3 — Retrieval evaluation

### B3.1 — Add evaluation loader

- **Files:** Mind evaluation fixtures, new loader and tests in `projects/mind-context`
- **Status:** complete (2026-07-16). Evidence: [B3.1 evaluation loader report](../reports/b3-1-evaluation-loader-2026-07-16.md).
- **Change:** load question and expectation files; validate IDs, existing paths, scopes, and forbidden-source rules.
- **Verify:** valid corpus loads; duplicate ID and missing expectation fail.
- **Stop if:** loader needs a YAML dependency not already approved; use JSON fixtures or existing parser.

### B3.2 — Add metric calculator

- **Files:** `src/evals/metrics.mjs`, tests
- **Status:** complete (2026-07-16). Evidence: [B3.2 metric calculator report](../reports/b3-2-metric-calculator-2026-07-16.md).
- **Change:** calculate top-k precision, required-source recall, forbidden-source violations, privacy violations, authority/freshness accuracy, token estimate, and latency.
- **Verify:** hand-calculated fixture results match exactly.
- **Stop if:** a metric lacks ground truth; report `not-measured`.

### B3.3 — Add fixed benchmark command

- **Status:** complete (2026-07-16). Evidence: [B3.3 fixed benchmark command report](../reports/b3-3-fixed-benchmark-command-2026-07-16.md).
- **Change:** add `npm run eval` producing timestamped JSON plus compact Markdown; separate environment metadata from scores.
- **Verify:** repeated deterministic runs on the same commit return equal source metrics.
- **Stop if:** current working tree contains fixture changes; record commit and dirty state.

### B3.4 — Gate semantic rankers

- **Status:** complete (2026-07-16). Evidence: [B3.4 semantic ranker gate report](../reports/b3-4-semantic-ranker-gate-2026-07-16.md).
- **Change:** require any graph, embedding, or model ranker PR to run lexical baseline and candidate on the same corpus and report deltas.
- **Verify:** a synthetic worse ranker fails the gate.
- **Stop if:** candidate increases privacy violations or forbidden-source hits; reject regardless of average precision.

## Priority 4 — Capability truth

### B4.1 — Define capability manifest schema

- **Files:** `operations/specs/capability-manifest.schema.json`, example, tests
- **Status:** complete (2026-07-16). Evidence: [B4.1 capability manifest schema report](../reports/b4-1-capability-manifest-schema-2026-07-16.md).
- **Fields:** ID, owner, state, safety mode, entrypoint, evidence command, last verified, dependencies, feature flag, rollback/disable command.
- **Verify:** unknown state, missing owner, and active-without-evidence fail.
- **Stop if:** a state cannot be tied to observable evidence; keep it `planned`.

### B4.2 — Inventory Infinite Brain capabilities

- **File:** `operations/specs/infinite-brain-capabilities.json`
- **Status:** complete (2026-07-16). Evidence: [B4.2 capability inventory report](../reports/b4-2-capability-inventory-2026-07-16.md).
- **Change:** record current capabilities without upgrading their state; use `planned` when evidence is absent.
- **Verify:** every entry validates and every `active` evidence command succeeds.
- **Stop if:** evidence requires external mutation; downgrade to `approval-gated` or `report-only`.

### B4.3 — Generate live status

- **Files:** generator script and `operations/runbooks/infinite-brain-roadmap-status.md`
- **Status:** complete (2026-07-16). Evidence: [B4.3 generated live status report](../reports/b4-3-generated-live-status-2026-07-16.md).
- **Change:** render the status table from the manifest and health evidence; preserve a short human notes section outside generated markers.
- **Verify:** generator is idempotent; manual edits inside generated markers are detected.
- **Stop if:** generation would overwrite the human notes section.

### B4.4 — Expose one status view

- **Status:** complete (2026-07-16). Evidence: [B4.4 and B5.1-B5.3 batch summary](../reports/b4-4-b5-1-b5-3-batch-2026-07-16.md).
- **Change:** make CLI and Brain Console read the capability manifest/status API; remove hand-maintained duplicate capability tables from active docs.
- **Verify:** same capability IDs/states appear in generated Markdown and Console/API fixture.
- **Stop if:** Console needs a new status store; use the manifest.

## Priority 5 — Controlled proposal application

### B5.1 — Align proposal and approval schemas

- **Status:** complete (2026-07-16). Evidence: [B4.4 and B5.1-B5.3 batch summary](../reports/b4-4-b5-1-b5-3-batch-2026-07-16.md).
- **Files:** Brain–Mind bridge contract, proposal/approval TypeScript types, JSON schemas, tests
- **Change:** use one version; require exact paths, sections, before hashes, source commit, expiry, source references, and idempotency key.
- **Verify:** schema/type fixture parity; globs, folders, stale hashes, expired and replayed approvals fail.
- **Stop if:** any active executor accepts a payload that the schema rejects.

### B5.2 — Bind executor to capability state

- **Status:** complete (2026-07-16). Evidence: [B4.4 and B5.1-B5.3 batch summary](../reports/b4-4-b5-1-b5-3-batch-2026-07-16.md).
- **Change:** executor runs only when the relevant capability is `approval-gated` or `active`, feature flag is enabled, and kill switch is off.
- **Tests:** every missing gate fails closed before filesystem write.
- **Verify:** run focused executor tests and confirm fixture hashes are unchanged for every blocked case.
- **Stop if:** capability state, feature flag, or kill switch cannot be checked before opening the target for write.

### B5.3 — Complete fixture write/rollback loop

- **Status:** complete (2026-07-16). Evidence: [B4.4 and B5.1-B5.3 batch summary](../reports/b4-4-b5-1-b5-3-batch-2026-07-16.md).
- **Change:** run proposal → preview → approval → write → verify → rollback → verify on Mind-owned synthetic fixture only.
- **Verify:** hashes and receipt fields match expected fixtures; unrelated files unchanged.
- **Stop if:** rollback or no-unapproved-path checks fail once.

### B5.4 — Activate one approved proposal type

- **Status:** complete (2026-07-31). Evidence: [B5.4 controlled write pilot report](../reports/b5-4-controlled-write-pilot-2026-07-31.md). Three repeatability runs passed; all rejection and rollback gates passed; no repository mutation.
- **Prerequisite:** Mind tasks M5.1–M5.3 and B5.1–B5.3 pass.
- **Change:** allow only the selected proposal type and explicit fixture/allowlisted path policy.
- **Verify:** three repeatability runs; non-allowlisted and meaning-changing edits fail.
- **Stop if:** any rollback or unrelated-file check fails.

## Priority 6 — Measured automation

### B6.1 — Add pilot manifest and runner

- **Status:** complete (2026-07-16). Evidence: [B6.1-B6.3 pilot batch summary](../reports/b6-1-b6-3-batch-2026-07-16.md).
- **Change:** implement one active pilot maximum; require start/end, sample limit, feature flag, kill conditions, metrics, and human verdict path.
- **Verify:** second simultaneous active pilot is rejected.
- **Stop if:** the pilot lacks a baseline, kill condition, or human verdict path.

### B6.2 — Capture honest measurements

- **Status:** complete (2026-07-16). Evidence: [B6.1-B6.3 pilot batch summary](../reports/b6-1-b6-3-batch-2026-07-16.md).
- **Change:** record latency, selected/omitted source counts, error count, review decisions, correction time when supplied, and rollback count; use null for missing evidence.
- **Verify:** missing values never become zero.
- **Stop if:** a metric cannot identify its source or collection window.

### B6.3 — Enforce verdict outcome

- **Status:** complete (2026-07-16). Evidence: [B6.1-B6.3 pilot batch summary](../reports/b6-1-b6-3-batch-2026-07-16.md).
- **Change:** `retire` disables schedule/flag; `revise` returns report-only; `retain` keeps current scope only and does not expand it.
- **Verify:** fixtures for all verdicts update capability state correctly.
- **Stop if:** `retain` expands scope or authority beyond the completed pilot.

## Priority 7 — Simplification and performance

### B7.1 — Split Brain Core routes by domain

- **Files:** `projects/brain-core/src/api/routes.ts` and new domain router modules
- **Status:** complete (2026-07-16). Evidence: [B7.1 continuous-processing route extraction](../reports/b7-1-continuous-processing-route-extraction-2026-07-16.md).
- **Change:** inventory route prefixes; extract one prefix per task using shared response/error helpers; preserve route behavior.
- **Verify:** route tests pass after each extraction; no multi-domain extraction in one change.
- **Stop if:** public response changes; revert the task and document dependency.

### B7.2 — Remove duplicate path and policy constants

- **Status:** complete (2026-07-17). Evidence: [B7.2 duplicate path and policy constants](../reports/b7-2-duplicate-path-and-policy-constants-2026-07-17.md), [B7.2-B7.6 batch summary](../reports/b7-2-b7-6-batch-summary-2026-07-17.md).
- **Change:** use B1.1 contract from Mind Steward, Brain Core, scripts, validators, and adapters; remove duplicates only after tests use the shared contract.
- **Verify:** `rg` finds one active definition per concern; historical fixtures remain labeled.
- **Stop if:** a consumer cannot import the shared contract without creating a circular dependency.

### B7.3 — Fix Graphify scope and retention

- **Files:** `.graphifyignore`, scheduler profile/config, generated-output runbook
- **Status:** complete (2026-07-17). Evidence: [B7.3 Graphify scope and retention](../reports/b7-3-graphify-scope-retention-2026-07-17.md), [B7.2-B7.6 batch summary](../reports/b7-2-b7-6-batch-summary-2026-07-17.md).
- **Change:** create separate bounded profiles for Brain architecture and Mind knowledge; exclude Obsidian plugins, builds, vendored tools, system app binaries, runtime, and generated history; keep only latest plus explicitly retained snapshots.
- **Verify:** fresh reports use current commits and show project-owned modules; generated files remain untracked.
- **Stop if:** cleanup would delete audit evidence; move it to bounded archive by separate approved task.

### B7.4 — Separate mutable local state from canonical configs

- **Scope:** `operations/system-configs`, project build output, browser/computer-use state
- **Status:** complete (2026-07-17). Evidence: [B7.4 mutable state inventory](../reports/b7-4-mutable-state-inventory-2026-07-17.md), [B7.2-B7.6 batch summary](../reports/b7-2-b7-6-batch-summary-2026-07-17.md).
- **Change:** inventory tracked source, packaged binaries, mutable state, generated caches, and secrets-adjacent files; propose moves/ignore rules before moving anything.
- **Verify:** report includes size, tracking state, owner, regeneration source, and migration risk.
- **Stop if:** a file is an installed runtime dependency with no reproducible install path; document before moving.

### B7.5 — Add documentation consistency check

- **Status:** complete (2026-07-17). Evidence: [B7.5 documentation consistency check](../reports/b7-5-document-consistency-2026-07-17.md), [B7.2-B7.6 batch summary](../reports/b7-2-b7-6-batch-summary-2026-07-17.md).
- **Change:** scan active docs/config instructions for old Mind paths, broken canonical links, duplicate status owners, and unsupported capability wording.
- **Verify:** seeded stale fixture fails; current canonical docs pass.
- **Stop if:** the check treats archived/history references as active defects; add explicit exclusions first.

### B7.6 — Add performance budgets

- **Budgets:** Brain Core startup, Context Gateway p50/p95 latency, context tokens, graph build scope, runtime/generated storage, route module size.
- **Status:** complete (2026-07-17). Evidence: [B7.6 performance budgets](../reports/b7-6-performance-budgets-2026-07-17.md), [B7.2-B7.6 batch summary](../reports/b7-2-b7-6-batch-summary-2026-07-17.md).
- **Change:** create documented thresholds and a report command; do not fail CI until a baseline is recorded.
- **Verify:** report includes actual, budget, status, and measurement source.
- **Stop if:** no repeatable measurement method exists; create a baseline task instead of inventing a threshold.

### B7.7 — Add backup, restore, and runtime recovery checks

- **Files:** existing backup/runbook sources, new non-destructive verification script and fixtures
- **Change:** inventory canonical vs generated/runtime data; add a restore-to-temporary-directory check for Mind entrypoints, Brain contracts, capability manifest, and rollback evidence; document retention and deletion boundaries.
- **Verify:** restore check never writes to live repos and reports hashes, missing files, and recovery order.
- **Status:** complete (2026-07-17). Evidence: [B7.7 backup/restore/runtime recovery report](../reports/b7-7-backup-restore-runtime-recovery-2026-07-17.md), [Priority 7 completion summary](../reports/p7-completion-summary-2026-07-17.md).
- **Stop if:** a canonical file has no documented backup or reproducible source; report the gap before changing storage.

## Priority 8 — Context-memory efficiency and freshness

### B8.1 — Benchmark structural code-memory options on the M1 Pro

- **Status:** incomplete after rejected v7w run. The owner-approved v7w plan was materialized once and executed once: exact-source passed 10/10, CBM errored 10/10, and canonical evidence validation failed. The authorization is consumed, current execution authority is `none`, B8.2–B8.6 remain blocked, and P8 remains 0/6 accepted. Evidence: [v7w failed-run disposition](../reports/b8-1-failed-run-disposition-v7w-2026-08-09.md).
- **Scope:** Codebase Memory MCP, Graphify only after its bounded executable contract is proven, and exact-source exploration on representative Brain, Workbench, and one normal application repository. Graphify is currently blocked.
- **Change:** after explicit benchmark authorization and approval of the exact emitted plan digest, record indexing time, incremental refresh latency, CPU, peak memory, disk use, retrieval quality, and offline operation counts; keep all tests local and read-only. Offline evidence excludes model-mediated token fields.
- **Verify:** repeatable benchmark fixtures and a dated comparison report identify the preferred default and fallback.
- **Stop if:** authorization or the exact approved digest is absent/stale, Graphify remains blocked while selected, or a benchmark requires credentials, personal Mind content, or an unbounded model run.

### B8.2 — Reconcile and formally admit Codebase Memory MCP as the structural default

- **Status:** incomplete; blocked on accepted B8.1 evidence and provider-admission review.
- **Change:** reconcile the existing pinned candidate binary, candidate admission, and preliminary isolated indexes against the approved B8.1 decision; install or repackage only when that decision requires it, then formally admit the provider through the existing MCP boundary and add repository indexes only within the accepted rollout scope.
- **Verify:** provider schema, executable provenance, exact tool inventory, read-only behavior, accepted repository scope, and rollback/uninstall instructions pass before any default activation or wider rollout.
- **Safety:** no repository writes, network mutation, credentials, default activation, or automatic rollout to every repository without canonical acceptance.

### B8.3 — Implement incremental freshness and repository inventory

- **Status:** planned; blocked on B8.2.
- **Change:** define the approved repository inventory, file-watch or incremental refresh behavior, ignored/generated paths, commit/freshness metadata, resource budgets, and failure receipts.
- **Verify:** a changed source file becomes queryable within the documented freshness budget without an LLM or full reindex; generated/runtime changes remain excluded.
- **Stop if:** watcher load exceeds host budgets, indexes cross repository boundaries, or stale state is reported as current.

### B8.4 — Define agent retrieval and exact-source-read policy

- **Status:** planned; blocked on B8.2 and B8.3.
- **Change:** require agents to use structural memory for architecture, symbol, route, caller/callee, and blast-radius navigation before broad exploration, while requiring exact source reads before edits or authority claims.
- **Verify:** instruction fixtures distinguish graph navigation, canonical documents, generated projections, and exact source authority; unavailable-service fallback remains ordinary bounded repository reads.
- **Safety:** graph output cannot authorize writes, override roadmaps, or replace source verification.

### B8.5 — Convert Graphify to bounded event-driven knowledge synthesis

- **Status:** planned; blocked on B8.1 and B8.4.
- **Scope:** selected Brain architecture documents and explicitly approved Mind knowledge scopes only.
- **Change:** remove unconditional nightly full scans; retain bounded profiles, relevant-change detection, explicit/manual triggers, changed-document-only enrichment, retention limits, and non-authoritative freshness metadata.
- **Verify:** code-only changes do not invoke an LLM; relevant document changes mark the Graphify projection stale; bounded regeneration excludes secrets, runtime state, generated output, and unapproved Mind content.
- **Stop if:** a profile requires a local LLM, broad personal-vault ingestion, or model interpretation of unchanged code.

### B8.6 — Roll out, measure, and retain rollback

- **Status:** planned; blocked on B8.2–B8.5.
- **Change:** pilot the two-layer architecture on Brain and one normal code repository, record freshness, resource load, token/tool-call deltas, retrieval quality, and operator burden, then approve or reject wider rollout.
- **Verify:** success thresholds, graceful degradation, index rebuild, Graphify disablement, and complete uninstall/rollback are tested without affecting repository availability.
- **Exit:** Codebase Memory is the measured structural default, Graphify is bounded to approved semantic scopes, or the pilot is rolled back with evidence.

## Final verification

Run only after all selected tasks for a priority are complete:

```bash
cd projects/brain-core
npm run typecheck
npm test

cd ../mind-steward
npm run typecheck
npm test
```

Also run the cross-repo contract check, Context Gateway evaluation, capability manifest validation, and documentation consistency check after those commands exist.

No task in this plan authorizes production deployment, continuous execution, external writes, broad Mind mutation, or removal of user data.
