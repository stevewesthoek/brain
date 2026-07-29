# Infinite Brain Runtime Implementation Plan

**Status:** canonical Brain code handoff
**Version:** 2.0
**Last reviewed:** 2026-07-10
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

## Priority 1 — Canonical coherence and migration closure

### B1.0e — Reconcile candidate node topology with live workflow

- **Status:** superseded (2026-07-22) by completed B1.0f controlled topology migration design and completed B1.0a guarded deployment/readback. Retained as historical decision evidence.
- **Evidence:** `operations/reports/b1-0a-save-to-mind-live-routing-2026-07-10.md` and `operations/reports/b1-0a-guarded-live-completion-2026-07-22.md`.

### B1.1 — Create one Mind contract module

- **Files:** `projects/brain-core/src/mind-paths.ts`, new `projects/brain-core/src/contracts/mind-contract.ts`, related tests
- **Change:** move current target paths, authority labels, review surfaces, and historical-only paths into one exported immutable contract; retain backward-compatible re-exports from `mind-paths.ts`.
- **Tests:** current success intake is only `inbox/new`; current failure intake is only the verified active path; historical paths are never returned as active candidates.
- **Verify:** `npm run typecheck`; focused Mind path tests.
- **Stop if:** the active failure path is not confirmed by Mind's folder contract and Save-to-Mind configuration.

### B1.2 — Fix Mind Steward typecheck

- **File:** `projects/mind-steward/src/cli/classify-captures.ts`
- **Change:** assign `runInput.limit` only after narrowing `limit` to a finite `number`; do not use a type assertion.
- **Test:** add or update argument parsing test for missing, valid, and invalid limit.
- **Verify:** `cd projects/mind-steward && npm run typecheck && npm test`.
- **Stop if:** another failure appears; report it as a separate task.

### B1.3 — Migrate the classifier to the shared contract

- **Files:** `projects/mind-steward/src/classifier.ts`, package dependency/import boundary, tests
- **Change:** resolve intake through the canonical contract instead of hard-coding `capture/inbox`; use `inbox/new` only after B1.1.
- **Tests:** missing inbox, empty inbox, one Markdown file, README exclusion, path traversal/symlink safety.
- **Verify:** Mind Steward typecheck and tests.
- **Stop if:** importing Brain Core creates a circular package dependency; extract the contract to a dependency-free shared package.

### B1.4 — Make classification report-only by default

- **Files:** classifier CLI and tests
- **Change:** default to dry-run; require an explicit `--apply=true` flag plus existing approval enforcement for source mutation; reject simultaneous dry-run/apply flags.
- **Tests:** no flag does not modify fixture; apply without approval fails; approved fixture applies exactly one allowed metadata change.
- **Verify:** compare fixture hashes before and after each mode.
- **Stop if:** no approval validator is available; implement dry-run default only and leave apply disabled.

### B1.5 — Resolve the Mind Steward package boundary

- **Files:** `projects/mind-steward/README.md`, Brain Core/Mind Steward imports and scripts
- **Change:** choose the lower-complexity result based on dependency inventory: either make Mind Steward a thin CLI over Brain Core services or move its unique services into Brain Core and mark the package deprecated. Do not keep two path/policy implementations.
- **Tests:** behavior parity for dry-run report, preview, and classification fixtures.
- **Verify:** both packages typecheck; one canonical implementation is referenced in docs.
- **Stop if:** behavior parity cannot be demonstrated; retain package and document the blocker.

### B1.6 — Update active AI instruction paths

- **Status:** pending. No dated completion evidence or cross-configuration validation is recorded.
- **Files:** global Claude, Codex, Gemini, Cursor, Kiro, and IDE context Markdown/config instruction files identified by `rg 'mind/router|mind/00-memory-map|mind/0[346]-' operations/system-configs`
- **Change:** point to `mind/system/agent-context/AGENTS.md`, `00-start-here.md`, `00-current-context.md`, and `00-memory-map.md`; update target research/task/project paths.
- **Verify:** the same `rg` returns no unexplained active old path; run config-specific validation if available.
- **Stop if:** a file is generated; update its canonical source and regenerate instead.

### B1.7 — Add a cross-repo contract check

- **Status:** pending. No dated completion evidence or stale-path failure fixture is recorded.
- **Files:** new script under `tools/scripts/`, test fixture, package script
- **Change:** validate that required Mind entrypoints exist, current intake paths agree, bridge/schema versions match, and active global instructions use current paths.
- **Verify:** command passes on current repos and fails on a fixture with one stale path.
- **Stop if:** validation requires reading personal content; check paths and metadata only.

## Priority 2 — Context Gateway

### B2.1 — Scaffold the dependency-free core

- **Path:** `projects/mind-context/`
- **Change:** create TypeScript package with `src/core`, `src/cli`, `src/adapters`, `src/tests`; use Node standard library first; add build, typecheck, and test scripts.
- **Verify:** empty package typechecks and one smoke test passes.
- **Stop if:** workspace conventions require another location; use the existing convention and document it.

### B2.2 — Add the context-pack schema

- **Files:** `operations/specs/context-pack.schema.json`, package types and schema tests
- **Change:** implement version `1.0` fields from strategy; reject unknown authority/freshness states and negative budgets.
- **Verify:** valid example passes; missing citation, invalid scope, and oversized/negative budget fixtures fail.
- **Stop if:** Mind bridge field names differ; align docs before code.

### B2.3 — Implement deterministic discovery

- **Files:** `projects/mind-context/src/core/discover.ts`, tests
- **Change:** search only allowed scopes and Markdown files; exclude history/archive/generated/runtime by default; return path, title, headings, frontmatter, and explicit links.
- **Tests:** scope inclusion/exclusion, symlink escape, missing root, deterministic sort.
- **Verify:** focused tests and typecheck.
- **Stop if:** discovery reads secrets or binary files; fail closed.

### B2.4 — Implement deterministic ranking

- **Files:** `rank.ts`, tests
- **Change:** rank by exact term/title match, explicit link, canonical-path class, current status, freshness, and authority; return score components.
- **Tests:** fixed fixtures with stable ordering; current canonical source outranks capture and generated summary.
- **Verify:** repeat test twice and compare identical output.
- **Stop if:** model or embedding access is required; keep lexical baseline.

### B2.5 — Implement budgeting and rendering

- **Files:** `budget.ts`, `render.ts`, tests
- **Change:** estimate tokens consistently, include highest-ranked complete excerpts within budget, record omitted sources, and render JSON/Markdown from one normalized pack.
- **Tests:** zero, small, exact, and exceeded budgets; no partial invalid YAML/frontmatter excerpt.
- **Verify:** schema validation on rendered JSON.
- **Stop if:** truncation loses a citation; omit the excerpt instead.

### B2.6 — Implement CLI commands

- **Files:** CLI entrypoint and tests
- **Change:** add `resolve`, `explain`, and `health`; require explicit query and scope; support JSON and Markdown output.
- **Tests:** exit codes and structured errors for missing root, missing query, invalid scope, and insufficient evidence.
- **Verify:** run all three commands against fixtures.
- **Stop if:** command writes to Mind; Context Gateway is read-only.

### B2.7 — Enforce the retrieval trust boundary

- **Files:** Context Gateway renderer/core, threat fixtures, tests
- **Change:** label every excerpt as untrusted source data; prevent source text from changing query, scope, permissions, tool calls, approval state, or output schema; record source path for every excerpt.
- **Tests:** include source text that says to ignore rules, reveal other scopes, call a tool, approve a write, or hide citations; output must retain the text only as quoted data and preserve the original request.
- **Verify:** all injection/data-poisoning fixtures pass with zero scope or permission changes.
- **Stop if:** an adapter concatenates source text into system/developer instructions; fix the boundary before continuing.

### B2.8 — Add thin adapters

- **Prerequisite:** B2.1–B2.6 and Priority 3 baseline pass.
- **Change:** add MCP first, then API/Console adapters only when required; each calls the same core function and returns the same schema version.
- **Tests:** contract test compares source IDs and authority fields across CLI and adapter.
- **Verify:** adapter parity test.
- **Stop if:** adapter needs separate ranking logic; refactor core instead.

## Priority 3 — Retrieval evaluation

### B3.1 — Add evaluation loader

- **Files:** Mind evaluation YAML fixtures, new loader and tests in `projects/mind-context`
- **Change:** load question and expectation files; validate IDs, existing paths, scopes, and forbidden-source rules.
- **Verify:** valid corpus loads; duplicate ID and missing expectation fail.
- **Stop if:** loader needs a YAML dependency not already approved; use JSON fixtures or existing parser.

### B3.2 — Add metric calculator

- **Files:** `src/evals/metrics.ts`, tests
- **Change:** calculate top-k precision, required-source recall, forbidden-source violations, privacy violations, authority/freshness accuracy, token estimate, and latency.
- **Verify:** hand-calculated fixture results match exactly.
- **Stop if:** a metric lacks ground truth; report `not-measured`.

### B3.3 — Add fixed benchmark command

- **Change:** add `npm run eval` producing timestamped JSON plus compact Markdown; separate environment metadata from scores.
- **Verify:** repeated deterministic runs on the same commit return equal source metrics.
- **Stop if:** current working tree contains fixture changes; record commit and dirty state.

### B3.4 — Gate semantic rankers

- **Change:** require any graph, embedding, or model ranker PR to run lexical baseline and candidate on the same corpus and report deltas.
- **Verify:** a synthetic worse ranker fails the gate.
- **Stop if:** candidate increases privacy violations or forbidden-source hits; reject regardless of average precision.

## Priority 4 — Capability truth

### B4.1 — Define capability manifest schema

- **Files:** `operations/specs/capability-manifest.schema.json`, example, tests
- **Fields:** ID, owner, state, safety mode, entrypoint, evidence command, last verified, dependencies, feature flag, rollback/disable command.
- **Verify:** unknown state, missing owner, and active-without-evidence fail.
- **Stop if:** a state cannot be tied to observable evidence; keep it `planned`.

### B4.2 — Inventory Infinite Brain capabilities

- **File:** `operations/specs/infinite-brain-capabilities.json`
- **Change:** record current capabilities without upgrading their state; use `planned` when evidence is absent.
- **Verify:** every entry validates and every `active` evidence command succeeds.
- **Stop if:** evidence requires external mutation; downgrade to `approval-gated` or `report-only`.

### B4.3 — Generate live status

- **Files:** generator script and `operations/runbooks/infinite-brain-roadmap-status.md`
- **Change:** render the status table from the manifest and health evidence; preserve a short human notes section outside generated markers.
- **Verify:** generator is idempotent; manual edits inside generated markers are detected.
- **Stop if:** generation would overwrite the human notes section.

### B4.4 — Expose one status view

- **Change:** make CLI and Brain Console read the capability manifest/status API; remove hand-maintained duplicate capability tables from active docs.
- **Verify:** same capability IDs/states appear in generated Markdown and Console/API fixture.
- **Stop if:** Console needs a new status store; use the manifest.

## Priority 5 — Controlled proposal application

### B5.1 — Align proposal and approval schemas

- **Files:** Brain–Mind bridge contract, proposal/approval TypeScript types, JSON schemas, tests
- **Change:** use one version; require exact paths, sections, before hashes, source commit, expiry, source references, and idempotency key.
- **Verify:** schema/type fixture parity; globs, folders, stale hashes, expired and replayed approvals fail.
- **Stop if:** any active executor accepts a payload that the schema rejects.

### B5.2 — Bind executor to capability state

- **Change:** executor runs only when the relevant capability is `approval-gated` or `active`, feature flag is enabled, and kill switch is off.
- **Tests:** every missing gate fails closed before filesystem write.
- **Verify:** run focused executor tests and confirm fixture hashes are unchanged for every blocked case.
- **Stop if:** capability state, feature flag, or kill switch cannot be checked before opening the target for write.

### B5.3 — Complete fixture write/rollback loop

- **Change:** run proposal → preview → approval → write → verify → rollback → verify on Mind-owned synthetic fixture only.
- **Verify:** hashes and receipt fields match expected fixtures; unrelated files unchanged.
- **Stop if:** rollback or no-unapproved-path checks fail once.

### B5.4 — Activate one approved proposal type

- **Prerequisite:** Mind tasks M5.1–M5.3 and B5.1–B5.3 pass.
- **Change:** allow only the selected proposal type and explicit fixture/allowlisted path policy.
- **Verify:** three repeatability runs; non-allowlisted and meaning-changing edits fail.
- **Stop if:** any rollback or unrelated-file check fails.

## Priority 6 — Measured automation

### B6.1 — Add pilot manifest and runner

- **Change:** implement one active pilot maximum; require start/end, sample limit, feature flag, kill conditions, metrics, and human verdict path.
- **Verify:** second simultaneous active pilot is rejected.
- **Stop if:** the pilot lacks a baseline, kill condition, or human verdict path.

### B6.2 — Capture honest measurements

- **Change:** record latency, selected/omitted source counts, error count, review decisions, correction time when supplied, and rollback count; use null for missing evidence.
- **Verify:** missing values never become zero.
- **Stop if:** a metric cannot identify its source or collection window.

### B6.3 — Enforce verdict outcome

- **Change:** `retire` disables schedule/flag; `revise` returns report-only; `retain` keeps current scope only and does not expand it.
- **Verify:** fixtures for all verdicts update capability state correctly.
- **Stop if:** `retain` expands scope or authority beyond the completed pilot.

## Priority 7 — Simplification and performance

### B7.1 — Split Brain Core routes by domain

- **Files:** `projects/brain-core/src/api/routes.ts` and new domain router modules
- **Change:** inventory route prefixes; extract one prefix per task using shared response/error helpers; preserve route behavior.
- **Verify:** route tests pass after each extraction; no multi-domain extraction in one change.
- **Stop if:** public response changes; revert the task and document dependency.

### B7.2 — Remove duplicate path and policy constants

- **Change:** use B1.1 contract from Mind Steward, Brain Core, scripts, validators, and adapters; remove duplicates only after tests use the shared contract.
- **Verify:** `rg` finds one active definition per concern; historical fixtures remain labeled.
- **Stop if:** a consumer cannot import the shared contract without creating a circular dependency.

### B7.3 — Fix Graphify scope and retention

- **Files:** `.graphifyignore`, scheduler profile/config, generated-output runbook
- **Change:** create separate bounded profiles for Brain architecture and Mind knowledge; exclude Obsidian plugins, builds, vendored tools, system app binaries, runtime, and generated history; keep only latest plus explicitly retained snapshots.
- **Verify:** fresh reports use current commits and show project-owned modules; generated files remain untracked.
- **Stop if:** cleanup would delete audit evidence; move it to bounded archive by separate approved task.

### B7.4 — Separate mutable local state from canonical configs

- **Scope:** `operations/system-configs`, project build output, browser/computer-use state
- **Change:** inventory tracked source, packaged binaries, mutable state, generated caches, and secrets-adjacent files; propose moves/ignore rules before moving anything.
- **Verify:** report includes size, tracking state, owner, regeneration source, and migration risk.
- **Stop if:** a file is an installed runtime dependency with no reproducible install path; document before moving.

### B7.5 — Add documentation consistency check

- **Change:** scan active docs/config instructions for old Mind paths, broken canonical links, duplicate status owners, and unsupported capability wording.
- **Verify:** seeded stale fixture fails; current canonical docs pass.
- **Stop if:** the check treats archived/history references as active defects; add explicit exclusions first.

### B7.6 — Add performance budgets

- **Budgets:** Brain Core startup, Context Gateway p50/p95 latency, context tokens, graph build scope, runtime/generated storage, route module size.
- **Change:** create documented thresholds and a report command; do not fail CI until a baseline is recorded.
- **Verify:** report includes actual, budget, status, and measurement source.
- **Stop if:** no repeatable measurement method exists; create a baseline task instead of inventing a threshold.

### B7.7 — Add backup, restore, and runtime recovery checks

- **Files:** existing backup/runbook sources, new non-destructive verification script and fixtures
- **Change:** inventory canonical vs generated/runtime data; add a restore-to-temporary-directory check for Mind entrypoints, Brain contracts, capability manifest, and rollback evidence; document retention and deletion boundaries.
- **Verify:** restore check never writes to live repos and reports hashes, missing files, and recovery order.
- **Stop if:** a canonical file has no documented backup or reproducible source; report the gap before changing storage.

## Priority 8 — Context-memory efficiency and freshness

### B8.1 — Benchmark structural code-memory options on the M1 Pro

- **Status:** planned.
- **Scope:** Codebase Memory MCP, existing Graphify code-only mode, and exact-source exploration on representative Brain, Workbench, and one normal application repository.
- **Change:** record indexing time, incremental refresh latency, CPU, peak memory, disk use, retrieval quality, tool calls, and model-token use; keep all tests local and read-only.
- **Verify:** repeatable benchmark fixtures and a dated comparison report identify the preferred default and fallback.
- **Stop if:** a benchmark requires credentials, personal Mind content, or an unbounded model run.

### B8.2 — Admit and install Codebase Memory MCP as the structural default

- **Status:** planned; blocked on B8.1 evidence and provider-admission review.
- **Change:** install or package a pinned Codebase Memory version, register it through the existing MCP provider-admission boundary, and configure one isolated index per approved repository.
- **Verify:** provider schema, executable provenance, exact tool inventory, read-only behavior, and rollback/uninstall instructions pass.
- **Safety:** no repository writes, network mutation, credentials, or automatic rollout to every repository.

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
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run typecheck
npm test

cd /Users/Office/Repos/stevewesthoek/brain/projects/mind-steward
npm run typecheck
npm test
```

Also run the cross-repo contract check, Context Gateway evaluation, capability manifest validation, and documentation consistency check after those commands exist.

No task in this plan authorizes production deployment, continuous execution, external writes, broad Mind mutation, or removal of user data.
